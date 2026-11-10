/* SPDX-License-Identifier: MPL-2.0 */
package org.openintegrationengine.tlsmanager.server;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.mozilla.javascript.Context;
import org.mozilla.javascript.ImporterTopLevel;
import org.mozilla.javascript.Scriptable;

import java.io.IOException;
import java.io.ByteArrayOutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Real Rhino 1.7.13 calls and loopback HTTP, with only plugin lifecycle lookup mocked.
 * The test harness creates the shared package import; it does not by itself prove
 * installed extension visibility. That is covered separately by the packaged-engine smoke test.
 */
class HttpHelpersRhinoTest {
    private HttpServer server;
    private ExecutorService workers;
    private HttpRequestService service;
    private SocketFactoryService socketFactories;
    private TLSServicePlugin plugin;
    private MockedStatic<TLSServicePlugin> pluginLookup;
    private Context context;
    private Scriptable scope;
    private String base;
    private final List<Received> received = new CopyOnWriteArrayList<>();
    private final AtomicInteger redirected = new AtomicInteger();
    private final CountDownLatch slowEntered = new CountDownLatch(1);

    @BeforeEach
    void setUp() throws Exception {
        workers = Executors.newCachedThreadPool();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.setExecutor(workers);
        server.createContext("/", this::respond);
        server.start();
        base = "http://127.0.0.1:" + server.getAddress().getPort();
        socketFactories = mock(SocketFactoryService.class);
        service = new HttpRequestService(socketFactories);
        service.start();
        plugin = mock(TLSServicePlugin.class);
        when(plugin.getHttpRequestService()).thenReturn(service);
        pluginLookup = mockStatic(TLSServicePlugin.class);
        pluginLookup.when(TLSServicePlugin::getPluginInstance).thenReturn(plugin);
        context = Context.enter();
        context.setOptimizationLevel(-1);
        context.setLanguageVersion(Context.VERSION_ES6);
        scope = newScope(context);
    }

    private static Scriptable newScope(Context cx) {
        ImporterTopLevel shared = new ImporterTopLevel(cx);
        cx.evaluateString(shared,
            "importPackage(Packages.org.openintegrationengine.tlsmanager.userutil);",
            "engine-package-import-harness", 1, null);
        shared.sealObject();
        Scriptable callScope = cx.newObject(shared);
        callScope.setPrototype(shared);
        callScope.setParentScope(null);
        return callScope;
    }

    @AfterEach
    void tearDown() throws Exception {
        if (context != null) Context.exit();
        if (pluginLookup != null) pluginLookup.close();
        if (service != null) service.close();
        if (server != null) server.stop(0);
        if (workers != null) {
            workers.shutdownNow();
            assertTrue(workers.awaitTermination(5, TimeUnit.SECONDS), "Owned HTTP handlers did not terminate");
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"Get", "Post", "Put", "Patch", "Delete", "Head", "Options"})
    void allVerbsAcceptOmittedAndExplicitOptions(String verb) {
        boolean body = List.of("Post", "Put", "Patch").contains(verb);
        String args = "'" + base + "/echo'" + (body ? ", 'synthetic-π'" : "");
        for (String options : List.of("", ", null", ", undefined", ", {}",
                ", {headers:{'X-Synthetic':['first','second']},mtls:false,connectTimeoutMs:1000,readTimeoutMs:1000}")) {
            assertEquals(Boolean.TRUE, eval("var r=TLSManager.http" + verb + "(" + args + options + ");"
                + "typeof r.status==='number' && r.status===200 && typeof r.body==='string'"
                + " && Array.isArray(r.headers['x-repeated']) && r.headers['x-repeated'].join('|')==='one|two';"));
            Received request = received.get(received.size() - 1);
            assertEquals(verb.toUpperCase(), request.method());
            assertEquals(body ? "synthetic-π" : "", request.body());
            assertEquals(verb.equals("Head") ? "" : "synthetic-response", string("r.body"));
            if (options.contains("X-Synthetic")) assertEquals(List.of("first", "second"), request.headers());
        }
        assertEquals(5, received.size());
    }

    @Test
    void stringsAndJsonAreSentAsUtf8WithoutObjectCoercion() {
        eval("TLSManager.httpPut('" + base + "/echo', JSON.stringify({message:'café ∑'}),"
            + "{headers:{'Content-Type':'application/json'}});");
        assertEquals("{\"message\":\"café ∑\"}", received.get(0).body());
        assertEquals("application/json", received.get(0).contentType());
        eval("TLSManager.httpPost('" + base + "/echo','prefix-' + 'π');");
        assertEquals("prefix-π", received.get(1).body());
        eval("TLSManager.httpPost('" + base + "/echo', null);");
        eval("TLSManager.httpPatch('" + base + "/echo', undefined);");
        assertEquals("", received.get(2).body());
        // Rhino 1.7.13 coerces top-level undefined to the literal string before Java dispatch.
        assertEquals("undefined", received.get(3).body());
        eval("TLSManager.httpPatch('" + base + "/echo', 'undefined');");
        assertEquals("undefined", received.get(4).body());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "[]", "42", "true", "new Date()", "new String('body')"})
    void unsupportedBodiesFailBeforeNetwork(String body) {
        assertThrows(RuntimeException.class, () -> eval("TLSManager.httpPut('" + base + "/echo'," + body + ");"));
        assertTrue(received.isEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "true", "'options'", "[]", "function(){}",
        "{mtls:'false'}", "{mtls:0}", "{mtls:1}", "{mtls:true}", "{mtls:true,clientCertificateAlias:''}",
        "{mtls:false,clientCertificateAlias:'client'}", "{clientCertificateAlias:'client'}",
        "{mtls:true,clientCertificateAlias:'client'}", "{clientCertificateAlias:42}",
        "{connectTimeoutMs:0}", "{connectTimeoutMs:-1}", "{connectTimeoutMs:0.5}", "{connectTimeoutMs:300001}",
        "{connectTimeoutMs:NaN}", "{connectTimeoutMs:Infinity}", "{connectTimeoutMs:'1000'}",
        "{readTimeoutMs:0}", "{readTimeoutMs:-1}", "{readTimeoutMs:1.5}", "{readTimeoutMs:300001}",
        "{readTimeoutMs:NaN}", "{readTimeoutMs:Infinity}", "{readTimeoutMs:'1000'}",
        "{headers:[]}", "{headers:'header'}", "{headers:{'X-Test':42}}", "{headers:{'X-Test':null}}",
        "{headers:{'X-Test':['valid',42]}}", "{headers:{'X-Test':'a\\r\\nb'}}", "{headers:{'Bad Header':'value'}}",
        "{headers:{'Host':'elsewhere'}}", "{headers:{'content-length':'100'}}",
        "{headers:{'Transfer-Encoding':'chunked'}}", "{headers:{'Connection':'keep-alive'}}",
        "{trustSystemTruststore:'false'}", "{trustedServerCertificates:'ca'}", "{trustedServerCertificates:[1]}",
        "{mtlss:true}", "{followRedirects:true}", "{ignoreCertificateErrors:true}"
    })
    void invalidOptionsFailBeforeNetwork(String options) {
        RuntimeException failure = assertThrows(RuntimeException.class,
            () -> eval("TLSManager.httpGet('" + base + "/echo?secret=query'," + options + ");"));
        assertTrue(received.isEmpty());
        assertFalse(causeMessages(failure).contains("secret=query"), "Errors must not expose URL query data");
    }

    @Test
    void nullAndUndefinedOptionFieldsUseDefaults() {
        assertEquals(200.0, number("TLSManager.httpGet('" + base + "/echo', {headers:null,mtls:undefined,"
            + "clientCertificateAlias:null,connectTimeoutMs:null,readTimeoutMs:undefined,"
            + "trustSystemTruststore:null,trustedServerCertificates:undefined}).status;"));
    }

    @Test
    void statusAndRepeatedHeadersAreNativeJavascriptValues() {
        for (int status : List.of(201, 302, 400, 401, 404, 429, 500, 503)) {
            assertEquals(Boolean.TRUE, eval("var r=TLSManager.httpGet('" + base + "/status/" + status + "');"
                + "r.status===" + status + " && r.body==='status-body' && Array.isArray(r.headers['set-cookie'])"
                + " && r.headers['set-cookie'].length===2 && JSON.parse(JSON.stringify(r)).status===" + status + ";"));
        }
    }

    @Test
    void redirectsAndCookiesAreNotFollowedOrShared() {
        assertEquals(302.0, number("TLSManager.httpGet('" + base + "/redirect').status"));
        assertEquals(0, redirected.get());
        eval("TLSManager.httpGet('" + base + "/status/200'); TLSManager.httpGet('" + base + "/echo');");
        assertNull(received.get(received.size() - 1).cookie());
    }

    @Test
    void responseCharsetAndEmptyResponsesArePredictable() {
        assertEquals("café", string("TLSManager.httpGet('" + base + "/latin1').body"));
        assertEquals("café ∑", string("TLSManager.httpGet('" + base + "/utf8').body"));
        assertEquals("", string("TLSManager.httpGet('" + base + "/empty').body"));
        assertEquals("", string("TLSManager.httpHead('" + base + "/echo').body"));
        RuntimeException failure = assertThrows(RuntimeException.class,
            () -> eval("TLSManager.httpGet('" + base + "/bad-charset?secret=query')"));
        assertFalse(causeMessages(failure).contains("secret=query"));
    }

    @Test
    void resultObjectsAreFreshAndDoNotModifyOptions() {
        assertEquals(Boolean.TRUE, eval("var opts={headers:{'X-Synthetic':['original']}};"
            + "var before=JSON.stringify(opts);var a=TLSManager.httpGet('" + base + "/echo',opts);"
            + "a.status=999;a.body='changed';a.headers['x-repeated'][0]='changed';"
            + "var b=TLSManager.httpGet('" + base + "/echo',opts);"
            + "b.status===200 && b.body==='synthetic-response' && b.headers['x-repeated'][0]==='one'"
            + " && a!==b && a.headers!==b.headers && before===JSON.stringify(opts);"));
    }

    @Test
    void specialHeaderNamesCannotMutateJavascriptPrototypes() {
        assertEquals(Boolean.TRUE, eval("var r=TLSManager.httpGet('" + base + "/special-headers');"
            + "Object.prototype.hasOwnProperty.call(r.headers,'__proto__')"
            + " && Array.isArray(r.headers['__proto__']) && r.headers['__proto__'][0]==='safe-proto'"
            + " && Array.isArray(r.headers.constructor) && r.headers.constructor[0]==='safe-constructor'"
            + " && ({}).polluted===undefined;"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"ftp://localhost/secret", "https://user:secret@localhost/", "https://localhost/#secret",
        "https://localhost:0/", "https://localhost:65536/", "relative/secret", "https://local host/?secret=query"})
    void invalidUrlsAreRejectedWithoutEchoingSecrets(String url) {
        RuntimeException failure = assertThrows(RuntimeException.class,
            () -> eval("TLSManager.httpGet('" + url + "')"));
        assertFalse(causeMessages(failure).contains("secret"));
        assertTrue(received.isEmpty());
    }

    @Test
    void connectTimeoutIsPassedToTransportAndClassifiedWithoutRetry() throws Exception {
        // Controlled injection verifies configuration/classification without relying on an external black-hole host.
        var sockets = mock(org.apache.http.conn.ssl.SSLConnectionSocketFactory.class);
        when(sockets.createSocket(any())).thenAnswer(invocation -> new Socket());
        when(sockets.connectSocket(eq(123), any(), any(), any(), nullable(InetSocketAddress.class), any()))
            .thenThrow(new org.apache.http.conn.ConnectTimeoutException("unsafe-provider-detail"));
        when(socketFactories.getHttpHelperSocketFactory(isNull(), eq(true), isNull())).thenReturn(sockets);
        RuntimeException failure = assertThrows(RuntimeException.class,
            () -> eval("TLSManager.httpGet('https://127.0.0.1:1/?secret=query',{connectTimeoutMs:123})"));
        assertTrue(causeMessages(failure).contains("connection timed out"));
        assertFalse(causeMessages(failure).contains("unsafe-provider-detail"));
        verify(sockets, times(1)).connectSocket(eq(123), any(), any(), any(), nullable(InetSocketAddress.class), any());
    }

    @Test
    void independentScriptScopesCanMutateTheirOwnResults() throws Exception {
        var futures = new java.util.ArrayList<java.util.concurrent.Future<Boolean>>();
        for (int i = 0; i < 12; i++) {
            final int marker = i;
            futures.add(workers.submit(() -> {
                try (MockedStatic<TLSServicePlugin> lookup = mockStatic(TLSServicePlugin.class)) {
                    lookup.when(TLSServicePlugin::getPluginInstance).thenReturn(plugin);
                    Context cx = Context.enter();
                    try {
                        cx.setOptimizationLevel(-1);
                        Scriptable child = newScope(cx);
                        return Boolean.TRUE.equals(cx.evaluateString(child,
                            "var r=TLSManager.httpGet('" + base + "/echo');r.headers.marker=[" + marker + "];"
                                + "r.headers.marker[0]===" + marker + ";", "parallel-channel", 1, null));
                    } finally {
                        Context.exit();
                    }
                }
            }));
        }
        for (var result : futures) assertTrue(result.get(10, TimeUnit.SECONDS));
        assertEquals(12, received.size());
    }

    @Test
    void readTimeoutThrowsAndLaterRequestStillWorks() {
        assertTimeout(Duration.ofSeconds(5), () -> assertThrows(RuntimeException.class,
            () -> eval("TLSManager.httpGet('" + base + "/slow', {readTimeoutMs:80})")));
        assertEquals(200.0, number("TLSManager.httpGet('" + base + "/echo').status"));
    }

    @Test
    void expectContinueWaitUsesTheConfiguredReadTimeout() throws Exception {
        // A raw peer deliberately omits 100 Continue, unlike JDK HttpServer which sends it automatically.
        try (ServerSocket listener = new ServerSocket(0, 1, java.net.InetAddress.getByName("127.0.0.1"))) {
            listener.setSoTimeout(5000);
            var peer = workers.submit(() -> {
                try (Socket socket = listener.accept()) {
                    socket.setSoTimeout(5000);
                    var headers = new ByteArrayOutputStream();
                    int end = 0;
                    while (end != 0x0d0a0d0a) {
                        int value = socket.getInputStream().read();
                        if (value < 0) throw new IOException("Request ended before headers");
                        headers.write(value);
                        end = (end << 8) | value;
                        if (headers.size() > 16384) throw new IOException("Unexpected fixture header length");
                    }
                    assertTrue(headers.toString(StandardCharsets.ISO_8859_1).toLowerCase(java.util.Locale.ROOT)
                        .contains("expect: 100-continue"));
                    assertEquals("continue", new String(socket.getInputStream().readNBytes(8), StandardCharsets.UTF_8));
                    socket.getOutputStream().write("HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok"
                        .getBytes(StandardCharsets.ISO_8859_1));
                    socket.getOutputStream().flush();
                }
                return null;
            });
            try {
                assertTimeout(Duration.ofSeconds(2), () -> assertEquals("ok", string(
                    "TLSManager.httpPost('http://127.0.0.1:" + listener.getLocalPort() + "/','continue',"
                        + "{headers:{Expect:'100-continue'},readTimeoutMs:80}).body")));
            } finally {
                peer.get(5, TimeUnit.SECONDS); // Surface a fixture assertion rather than masking it as a transport error.
            }
        }
    }

    @Test
    void anAlreadyInterruptedCallerDoesNotOpenAConnection() {
        Thread.currentThread().interrupt();
        try {
            assertThrows(RuntimeException.class, () -> eval("TLSManager.httpGet('" + base + "/echo')"));
            assertTrue(received.isEmpty());
        } finally {
            Thread.interrupted();
        }
    }

    @Test
    void transportFailureDoesNotRetryPostOrExposeSensitiveData() {
        RuntimeException failure = assertThrows(RuntimeException.class,
            () -> eval("TLSManager.httpPost('" + base + "/disconnect?secret=query','secret-payload',"
                + "{headers:{Authorization:'secret-auth',Cookie:'secret-cookie'}})"));
        assertEquals(1, received.size(), "A failed state-changing request must not be automatically retried");
        String messages = causeMessages(failure);
        for (String secret : List.of("secret=query", "secret-payload", "secret-auth", "secret-cookie")) {
            assertFalse(messages.contains(secret), "Error leaked " + secret);
        }
    }

    @Test
    void refusedConnectionFailsClearly() throws Exception {
        int unusedPort;
        try (ServerSocket unused = new ServerSocket(0)) { unusedPort = unused.getLocalPort(); }
        assertThrows(RuntimeException.class,
            () -> eval("TLSManager.httpGet('http://127.0.0.1:" + unusedPort + "/?secret=query',{connectTimeoutMs:100})"));
    }

    @Test
    void closingServiceCancelsActiveRequestsAndRejectsNewOnes() throws Exception {
        var request = workers.submit(() -> {
            try (MockedStatic<TLSServicePlugin> lookup = mockStatic(TLSServicePlugin.class)) {
                lookup.when(TLSServicePlugin::getPluginInstance).thenReturn(plugin);
                Context cx = Context.enter();
                try {
                    return assertThrows(RuntimeException.class, () -> cx.evaluateString(newScope(cx),
                        "TLSManager.httpGet('" + base + "/slow', {readTimeoutMs:30000})", "closing", 1, null));
                } finally { Context.exit(); }
            }
        });
        assertTrue(slowEntered.await(5, TimeUnit.SECONDS));
        service.close();
        assertNotNull(request.get(3, TimeUnit.SECONDS));
        assertThrows(RuntimeException.class, () -> eval("TLSManager.httpGet('" + base + "/echo')"));
        service.close(); // Shutdown is idempotent.
    }

    @Test
    void aRequestPreparingTlsCannotCrossAStopAndRestartBoundary() throws Exception {
        CountDownLatch preparing = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        var sockets = mock(org.apache.http.conn.ssl.SSLConnectionSocketFactory.class);
        when(socketFactories.getHttpHelperSocketFactory(isNull(), eq(true), isNull())).thenAnswer(invocation -> {
            preparing.countDown();
            assertTrue(release.await(5, TimeUnit.SECONDS));
            return sockets;
        });
        var request = workers.submit(() -> {
            try (MockedStatic<TLSServicePlugin> lookup = mockStatic(TLSServicePlugin.class)) {
                lookup.when(TLSServicePlugin::getPluginInstance).thenReturn(plugin);
                Context cx = Context.enter();
                try {
                    return assertThrows(RuntimeException.class, () -> cx.evaluateString(newScope(cx),
                        "TLSManager.httpGet('https://127.0.0.1:1/')", "restart-boundary", 1, null));
                } finally { Context.exit(); }
            }
        });
        try {
            assertTrue(preparing.await(5, TimeUnit.SECONDS));
            service.close();
            service.start();
        } finally { release.countDown(); }
        assertNotNull(request.get(5, TimeUnit.SECONDS));
        verifyNoInteractions(sockets);
        assertTrue(received.isEmpty());
    }

    @Test
    void unavailablePluginServiceNeverBecomesARequest() {
        when(plugin.getHttpRequestService()).thenReturn(null);
        assertThrows(RuntimeException.class, () -> eval("TLSManager.httpGet('" + base + "/echo')"));
        assertTrue(received.isEmpty());
    }

    private Object eval(String script) {
        return context.evaluateString(scope, script, "channel-script", 1, null);
    }

    private String string(String script) { return Context.toString(eval(script)); }

    private double number(String script) { return Context.toNumber(eval(script)); }

    private static String causeMessages(Throwable throwable) {
        StringBuilder result = new StringBuilder();
        for (Throwable current = throwable; current != null; current = current.getCause()) {
            if (current.getMessage() != null) result.append(current.getMessage()).append('\n');
        }
        return result.toString();
    }

    private void respond(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        received.add(new Received(exchange.getRequestMethod(),
            new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8),
            exchange.getRequestHeaders().get("X-Synthetic"), exchange.getRequestHeaders().getFirst("Content-Type"),
            exchange.getRequestHeaders().getFirst("Cookie")));
        if (path.equals("/disconnect")) { exchange.close(); return; }
        if (path.equals("/slow")) {
            slowEntered.countDown();
            try { Thread.sleep(1500); } catch (InterruptedException stopped) {
                Thread.currentThread().interrupt(); exchange.close(); return;
            }
        }
        byte[] body = "synthetic-response".getBytes(StandardCharsets.UTF_8);
        int status = 200;
        exchange.getResponseHeaders().add("X-Repeated", "one");
        exchange.getResponseHeaders().add("X-Repeated", "two");
        if (path.startsWith("/status/")) {
            status = Integer.parseInt(path.substring("/status/".length()));
            body = "status-body".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Set-Cookie", "a=1; Path=/");
            exchange.getResponseHeaders().add("Set-Cookie", "b=2; Path=/");
        } else if (path.equals("/redirect")) {
            status = 302;
            exchange.getResponseHeaders().set("Location", base + "/redirect-target");
        } else if (path.equals("/redirect-target")) {
            redirected.incrementAndGet();
        } else if (path.equals("/latin1")) {
            exchange.getResponseHeaders().set("Content-Type", "text/plain; charset=ISO-8859-1");
            body = "café".getBytes(StandardCharsets.ISO_8859_1);
        } else if (path.equals("/utf8")) {
            body = "café ∑".getBytes(StandardCharsets.UTF_8);
        } else if (path.equals("/bad-charset")) {
            exchange.getResponseHeaders().set("Content-Type", "text/plain; charset=not-a-supported-charset");
        } else if (path.equals("/empty")) {
            status = 204;
        } else if (path.equals("/special-headers")) {
            exchange.getResponseHeaders().add("__proto__", "safe-proto");
            exchange.getResponseHeaders().add("Constructor", "safe-constructor");
        }
        boolean empty = status == 204 || exchange.getRequestMethod().equals("HEAD");
        try {
            exchange.sendResponseHeaders(status, empty ? -1 : body.length);
            if (!empty) exchange.getResponseBody().write(body);
        } finally { exchange.close(); }
    }

    private record Received(String method, String body, List<String> headers, String contentType, String cookie) {}
}
