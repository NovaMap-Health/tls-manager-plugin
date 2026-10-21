/* SPDX-License-Identifier: MPL-2.0 */
package org.openintegrationengine.tlsmanager.server;

import org.apache.http.Header;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpRequestBase;
import org.apache.http.client.methods.RequestBuilder;
import org.apache.http.config.RegistryBuilder;
import org.apache.http.config.SocketConfig;
import org.apache.http.conn.ConnectTimeoutException;
import org.apache.http.conn.socket.ConnectionSocketFactory;
import org.apache.http.conn.socket.PlainConnectionSocketFactory;
import org.apache.http.entity.ByteArrayEntity;
import org.apache.http.entity.ContentType;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.impl.conn.BasicHttpClientConnectionManager;
import org.apache.http.protocol.HttpRequestExecutor;
import org.apache.http.util.EntityUtils;

import javax.net.ssl.SSLException;
import java.io.IOException;
import java.io.InterruptedIOException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Synchronous, request-owned clients. No connection, TLS session, cookie or credential cache crosses calls. */
public final class HttpRequestService implements AutoCloseable {
    private final SocketFactoryService socketFactoryService;
    private final Map<HttpRequestBase, CloseableHttpClient> active = new HashMap<>();
    private boolean running;
    private long generation;

    public HttpRequestService(SocketFactoryService socketFactoryService) {
        this.socketFactoryService = socketFactoryService;
    }

    public synchronized void start() {
        if (!running) {
            generation++;
            running = true;
        }
    }

    public record Response(int status, Map<String, List<String>> headers, String body) { }

    public Response execute(String method, HttpRequestOptions options) {
        long requestGeneration = checkRunning();
        if (Thread.currentThread().isInterrupted()) throw failure("request cancelled");
        var registry = RegistryBuilder.<ConnectionSocketFactory>create()
            .register("http", PlainConnectionSocketFactory.getSocketFactory());
        if ("https".equalsIgnoreCase(options.uri().getScheme())) {
            try {
                registry.register("https", socketFactoryService.getHttpHelperSocketFactory(
                    options.clientCertificateAlias(), options.trustSystemTruststore(), options.trustedServerCertificates()));
            } catch (HttpTlsConfigurationException e) {
                throw failure(e.getMessage());
            } catch (RuntimeException e) {
                // Backend/provider errors can contain credentials. Never carry their causes into script errors.
                throw failure("managed TLS configuration or selected client identity is unavailable or unusable");
            }
        }
        var manager = new BasicHttpClientConnectionManager(registry.build());
        // Also applies to the TLS handshake, before HttpClient installs its response socket timeout.
        manager.setSocketConfig(SocketConfig.custom().setSoTimeout(options.readTimeoutMs()).build());
        var config = RequestConfig.custom().setConnectTimeout(options.connectTimeoutMs())
            .setConnectionRequestTimeout(options.connectTimeoutMs()).setSocketTimeout(options.readTimeoutMs())
            .setRedirectsEnabled(false).setAuthenticationEnabled(false).build();
        var builder = RequestBuilder.create(method).setUri(options.uri()).setConfig(config);
        options.headers().forEach((name, values) -> values.forEach(value -> builder.addHeader(name, value)));
        if (method.equals("POST") || method.equals("PUT") || method.equals("PATCH")) {
            builder.setEntity(new ByteArrayEntity(options.body().getBytes(StandardCharsets.UTF_8)));
            if (!options.headers().containsKey("content-type")) builder.setHeader("Content-Type", "text/plain; charset=UTF-8");
        }
        var request = (HttpRequestBase) builder.build();
        try (CloseableHttpClient client = HttpClients.custom().setConnectionManager(manager)
            .setRequestExecutor(new HttpRequestExecutor(options.readTimeoutMs()))
            .disableRedirectHandling().disableAutomaticRetries().disableCookieManagement().disableAuthCaching().build()) {
            register(request, client, requestGeneration);
            try (CloseableHttpResponse response = client.execute(request)) {
                Map<String, List<String>> headers = new LinkedHashMap<>();
                for (Header header : response.getAllHeaders()) {
                    headers.computeIfAbsent(header.getName().toLowerCase(Locale.ROOT), key -> new ArrayList<>())
                        .add(header.getValue());
                }
                String body = "";
                if (!method.equals("HEAD") && response.getEntity() != null) {
                    ContentType type = ContentType.get(response.getEntity());
                    Charset charset = type == null || type.getCharset() == null ? StandardCharsets.UTF_8 : type.getCharset();
                    body = new String(EntityUtils.toByteArray(response.getEntity()), charset);
                }
                headers.replaceAll((key, values) -> List.copyOf(values));
                return new Response(response.getStatusLine().getStatusCode(), Map.copyOf(headers), body);
            } finally {
                unregister(request);
            }
        } catch (ConnectTimeoutException e) {
            throw failure("connection timed out");
        } catch (SocketTimeoutException e) {
            throw failure("TLS handshake or response read timed out");
        } catch (SSLException e) {
            throw failure("TLS handshake or server certificate verification failed");
        } catch (UnknownHostException e) {
            throw failure("host name could not be resolved");
        } catch (InterruptedIOException e) {
            throw failure("request interrupted or timed out");
        } catch (IOException e) {
            throw failure("HTTP transport failed or request was cancelled");
        } catch (RuntimeException e) {
            if (e instanceof HttpFailure) throw e;
            throw failure("HTTP request or response processing failed");
        } finally {
            request.abort();
            manager.shutdown();
        }
    }

    private synchronized long checkRunning() {
        if (!running) throw failure("HTTP service is not started or has stopped");
        return generation;
    }

    private synchronized void register(HttpRequestBase request, CloseableHttpClient client, long requestGeneration) {
        checkRunning();
        if (generation != requestGeneration) throw failure("request cancelled by HTTP service restart");
        active.put(request, client);
    }

    private synchronized void unregister(HttpRequestBase request) { active.remove(request); }

    @Override
    public void close() {
        Map<HttpRequestBase, CloseableHttpClient> closing;
        synchronized (this) {
            running = false;
            generation++;
            closing = new HashMap<>(active);
            active.clear();
        }
        closing.forEach((request, client) -> {
            request.abort();
            try { client.close(); } catch (IOException ignored) { /* abort already released the connection */ }
        });
    }

    private static HttpFailure failure(String message) { return new HttpFailure("TLSManager: " + message); }

    /** Sanitized exception: intentionally excludes transport/provider cause chains and request data. */
    private static final class HttpFailure extends IllegalStateException {
        private HttpFailure(String message) { super(message); }
    }
}
