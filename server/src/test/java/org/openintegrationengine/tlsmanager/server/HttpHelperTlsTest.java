/* SPDX-License-Identifier: MPL-2.0 */
package org.openintegrationengine.tlsmanager.server;

import com.sun.net.httpserver.HttpsConfigurator;
import com.sun.net.httpserver.HttpsParameters;
import com.sun.net.httpserver.HttpsServer;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.conn.ssl.SSLConnectionSocketFactory;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.asn1.x509.BasicConstraints;
import org.bouncycastle.asn1.x509.ExtendedKeyUsage;
import org.bouncycastle.asn1.x509.Extension;
import org.bouncycastle.asn1.x509.GeneralName;
import org.bouncycastle.asn1.x509.GeneralNames;
import org.bouncycastle.asn1.x509.KeyPurposeId;
import org.bouncycastle.asn1.x509.KeyUsage;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mozilla.javascript.Context;
import org.mozilla.javascript.ImporterTopLevel;
import org.mozilla.javascript.Scriptable;
import org.openintegrationengine.tlsmanager.server.util.MockConfigurationController;
import org.openintegrationengine.tlsmanager.shared.PersistenceMode;
import org.openintegrationengine.tlsmanager.shared.models.TLSPluginConfiguration;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLPeerUnverifiedException;
import javax.net.ssl.TrustManagerFactory;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyFactory;
import java.security.KeyStore;
import java.security.interfaces.RSAKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.MGF1ParameterSpec;
import java.security.spec.PSSParameterSpec;
import java.security.spec.RSAKeyGenParameterSpec;
import java.security.spec.RSAPublicKeySpec;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class HttpHelperTlsTest {
    private static final char[] PASSWORD = "synthetic-test-store".toCharArray();
    private static final AtomicLong SERIAL = new AtomicLong(1);
    private static Identity ca, intermediate, server, wrongHost, clientA, clientB, expired, wrongUsage, foreignClient, expiredServer;
    @TempDir Path temp;
    private CertificateService certificates;
    private SocketFactoryService sockets;

    @BeforeAll static void createCertificates() throws Exception {
        ca = identity("Synthetic root", null, true, null, null, false);
        intermediate = identity("Synthetic intermediate", ca, true, null, null, false);
        server = identity("localhost", intermediate, false, "localhost", KeyPurposeId.id_kp_serverAuth, false);
        wrongHost = identity("other.example.invalid", intermediate, false, "other.example.invalid", KeyPurposeId.id_kp_serverAuth, false);
        clientA = identity("client-A", ca, false, null, KeyPurposeId.id_kp_clientAuth, false);
        clientB = identity("client-B", ca, false, null, KeyPurposeId.id_kp_clientAuth, false);
        expired = identity("expired-client", ca, false, null, KeyPurposeId.id_kp_clientAuth, true);
        wrongUsage = identity("localhost", ca, false, "localhost", KeyPurposeId.id_kp_clientAuth, false);
        Identity foreignCa = identity("Foreign synthetic root", null, true, null, null, false);
        foreignClient = identity("foreign-client", foreignCa, false, null, KeyPurposeId.id_kp_clientAuth, false);
        expiredServer = identity("localhost", ca, false, "localhost", KeyPurposeId.id_kp_serverAuth, true);
    }

    @BeforeEach void prepareStores() throws Exception {
        certificates = new CertificateService(null);
        certificates.init(new TLSPluginConfiguration(PersistenceMode.FILESYSTEM,
                temp.resolve("trust.p12").toString(), new String(PASSWORD),
                temp.resolve("keys.p12").toString(), new String(PASSWORD), false));
        sockets = new SocketFactoryService(new MockConfigurationController(), certificates);
        trust(ca);
        clients(clientA, clientB);
    }

    @Test void managedPrivateCaValidatesCompleteChainWithoutSystemRoots() throws Exception {
        try (Endpoint endpoint = new Endpoint(server, false, false)) {
            assertEquals("anonymous", request(endpoint, null));
            assertEquals("anonymous", request(endpoint, null, true, Set.of("root")));
        }
    }

    @Test void rejectsUntrustedChainAndHostnameMismatch() throws Exception {
        trust(clientA);
        try (Endpoint endpoint = new Endpoint(server, false, false)) {
            assertThrows(Exception.class, () -> request(endpoint, null));
        }
        trust(ca);
        try (Endpoint endpoint = new Endpoint(wrongHost, false, false)) {
            assertThrows(Exception.class, () -> request(endpoint, null));
        }
    }

    @Test void validatesPinnedLeafUsageAndDoesNotDisableHostnameChecks() throws Exception {
        trust(wrongUsage);
        try (Endpoint endpoint = new Endpoint(wrongUsage, false, false)) {
            assertThrows(Exception.class, () -> request(endpoint, null));
        }
        trust(wrongHost);
        try (Endpoint endpoint = new Endpoint(wrongHost, false, false)) {
            assertThrows(Exception.class, () -> request(endpoint, null));
        }
        trust(expiredServer);
        try (Endpoint endpoint = new Endpoint(expiredServer, false, false)) {
            assertThrows(Exception.class, () -> request(endpoint, null));
        }
    }

    @Test void optionalClientAuthenticationNeverOffersAnIdentityByDefault() throws Exception {
        try (Endpoint endpoint = new Endpoint(server, true, false)) {
            assertEquals("anonymous", request(endpoint, null));
            assertEquals("CN=client-A", request(endpoint, "a"));
            assertEquals("anonymous", request(endpoint, null));
        }
    }

    @Test void mandatoryClientAuthenticationUsesOnlyTheSelectedIdentity() throws Exception {
        try (Endpoint endpoint = new Endpoint(server, false, true)) {
            assertEquals("CN=client-A", request(endpoint, "a"));
            assertEquals("CN=client-B", request(endpoint, "b"));
            assertThrows(Exception.class, () -> request(endpoint, null));
        }
    }

    @Test void incompatibleExplicitIdentityCannotFallBackToAnonymousOrAnotherClient() throws Exception {
        clients(foreignClient, clientB);
        try (Endpoint endpoint = new Endpoint(server, true, false)) {
            assertThrows(Exception.class, () -> request(endpoint, "a"));
            assertEquals(0, endpoint.requests.get());
            assertEquals("anonymous", request(endpoint, null));
            assertEquals("CN=client-B", request(endpoint, "b"));
        }
    }

    @Test void tls13PreservesAnonymousAndExplicitIdentitySemantics() throws Exception {
        try (Endpoint endpoint = new Endpoint(server, true, false, "TLSv1.3")) {
            assertEquals("anonymous", request(endpoint, null));
            assertEquals("CN=client-A", request(endpoint, "a"));
            clients(foreignClient, clientB);
            assertThrows(Exception.class, () -> request(endpoint, "a"));
            assertEquals(2, endpoint.requests.get());
            assertEquals("CN=client-B", request(endpoint, "b"));
        }
    }

    @Test void rsassaPssClientKeysRetainTheirAlgorithmParameters() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSASSA-PSS");
        generator.initialize(new RSAKeyGenParameterSpec(2048, RSAKeyGenParameterSpec.F4,
                new PSSParameterSpec("SHA-384", "MGF1", MGF1ParameterSpec.SHA384, 48, 1)));
        Identity restricted = identity("pss-sha384-client", ca, false, null,
                KeyPurposeId.id_kp_clientAuth, false, generator.generateKeyPair());
        generator.initialize(2048);
        Identity unrestricted = identity("pss-default-client", ca, false, null,
                KeyPurposeId.id_kp_clientAuth, false, generator.generateKeyPair());
        assertNull(((RSAKey) unrestricted.keys().getPrivate()).getParams());
        RSAPublicKey publicKey = (RSAPublicKey) unrestricted.keys().getPublic();
        var restrictedPublicKey = KeyFactory.getInstance("RSASSA-PSS").generatePublic(new RSAPublicKeySpec(
                publicKey.getModulus(), publicKey.getPublicExponent(),
                new PSSParameterSpec("SHA-384", "MGF1", MGF1ParameterSpec.SHA384, 48, 1)));
        Identity publicConstraint = identity("pss-public-sha384-client", ca, false, null,
                KeyPurposeId.id_kp_clientAuth, false,
                new KeyPair(restrictedPublicKey, unrestricted.keys().getPrivate()));
        clients(restricted, unrestricted);
        try (Endpoint endpoint = new Endpoint(server, false, true, "TLSv1.3")) {
            assertEquals("CN=pss-sha384-client", request(endpoint, "a"));
            assertEquals("CN=pss-default-client", request(endpoint, "b"));
            clients(publicConstraint, unrestricted);
            assertNotNull(sockets.getHttpHelperSocketFactory("a", false, null),
                    "Pair validation must honor the certificate's public-key PSS constraints");
            // Some JSSE versions choose SHA-256 for an unrestricted private key even
            // when its public certificate requires SHA-384. Preserve provider behavior;
            // never rewrite managed private keys to work around provider negotiation.
            SSLConnectionSocketFactory control = plainJsseFactory(publicConstraint);
            String providerResult = null;
            try { providerResult = requestWithFactory(endpoint, control); }
            catch (IOException providerFailure) { /* The helper must fail equally clearly. */ }
            if (providerResult == null) {
                assertThrows(IOException.class, () -> request(endpoint, "a"));
            } else {
                assertEquals("CN=pss-public-sha384-client", providerResult);
                assertEquals(providerResult, request(endpoint, "a"));
            }
        }
        KeyStore mismatched = keyStore();
        mismatched.setKeyEntry("a", restricted.keys().getPrivate(), PASSWORD, unrestricted.chain());
        certificates.storeExtraKeyStore(bytes(mismatched), PASSWORD);
        assertThrows(HttpTlsConfigurationException.class,
                () -> sockets.getHttpHelperSocketFactory("a", false, null));
    }

    @Test void rhinoFacadeConnectsThroughRealManagedTrustAndIdentitySelection() throws Exception {
        try (Endpoint endpoint = new Endpoint(server, true, false);
             HttpRequestService http = new HttpRequestService(sockets);
             var lookup = mockStatic(TLSServicePlugin.class)) {
            http.start();
            TLSServicePlugin plugin = mock(TLSServicePlugin.class);
            when(plugin.getHttpRequestService()).thenReturn(http);
            lookup.when(TLSServicePlugin::getPluginInstance).thenReturn(plugin);
            Context context = Context.enter();
            try {
                context.setOptimizationLevel(-1);
                context.setLanguageVersion(Context.VERSION_ES6);
                ImporterTopLevel shared = new ImporterTopLevel(context);
                context.evaluateString(shared, "importPackage(Packages.org.openintegrationengine.tlsmanager.userutil);",
                        "engine-package-import-harness", 1, null);
                shared.sealObject();
                Scriptable scope = context.newObject(shared);
                scope.setPrototype(shared);
                scope.setParentScope(null);
                String url = "https://localhost:" + endpoint.server.getAddress().getPort() + "/";
                assertEquals(Boolean.TRUE, context.evaluateString(scope,
                        "var r=TLSManager.httpGet('" + url + "',{trustSystemTruststore:false});"
                                + "r.status===200 && r.body==='anonymous';", "channel-script", 1, null));
                assertEquals(Boolean.TRUE, context.evaluateString(scope,
                        "var r=TLSManager.httpPut('" + url + "','synthetic',"
                                + "{trustSystemTruststore:false,mtls:true,clientCertificateAlias:'b'});"
                                + "r.status===200 && r.body==='CN=client-B';", "channel-script", 1, null));
                assertEquals(Boolean.TRUE, context.evaluateString(scope,
                        "var r=TLSManager.httpGet('" + url + "',{trustSystemTruststore:false,mtls:false});"
                                + "r.status===200 && r.body==='anonymous';", "channel-script", 1, null));
            } finally { Context.exit(); }
        }
    }

    @Test void rejectsUnknownNonKeyExpiredAndMismatchedIdentities() throws Exception {
        assertThrows(HttpTlsConfigurationException.class, () -> sockets.getHttpHelperSocketFactory("missing", false, null));
        KeyStore keys = keyStore();
        keys.setCertificateEntry("certificate-only", clientA.certificate());
        keys.setKeyEntry("expired", expired.keys().getPrivate(), PASSWORD, expired.chain());
        keys.setKeyEntry("mismatch", clientA.keys().getPrivate(), PASSWORD, clientB.chain());
        certificates.storeExtraKeyStore(bytes(keys), PASSWORD);
        assertThrows(HttpTlsConfigurationException.class, () -> sockets.getHttpHelperSocketFactory("certificate-only", false, null));
        assertThrows(IllegalStateException.class, () -> sockets.getHttpHelperSocketFactory("expired", false, null));
        assertThrows(IllegalStateException.class, () -> sockets.getHttpHelperSocketFactory("mismatch", false, null));
    }

    @Test void trustSelectionAndMissingServicesFailClosed() throws Exception {
        assertThrows(IllegalStateException.class, () -> sockets.getHttpHelperSocketFactory(null, false, Set.of()));
        assertThrows(HttpTlsConfigurationException.class, () -> sockets.getHttpHelperSocketFactory(null, true, Set.of("unknown")));
        assertThrows(IllegalStateException.class, () -> new SocketFactoryService(new MockConfigurationController(),
                new CertificateService(null)).getHttpHelperSocketFactory(null, true, null));
        HttpHelperTls.Material material = certificates.snapshotHttpHelperTls(null, true, Set.of());
        assertEquals(certificates.getSystemTrustStore().size(), material.trustStore().size());
        assertEquals(0, material.clientKeyStore().size());
    }

    @Test void sameAliasReplacementAndTrustChangesAffectNextRequest() throws Exception {
        try (Endpoint endpoint = new Endpoint(server, false, true)) {
            assertEquals("CN=client-A", request(endpoint, "a"));
            clients(clientB, clientA);
            assertEquals("CN=client-B", request(endpoint, "a"));
            trust(clientA);
            assertThrows(Exception.class, () -> request(endpoint, "a"));
            trust(ca);
            assertEquals("CN=client-B", request(endpoint, "a"));
        }
    }

    @Test void concurrentClientIdentitiesAndAnonymousRequestsDoNotMix() throws Exception {
        try (Endpoint endpoint = new Endpoint(server, true, false)) {
            var executor = Executors.newFixedThreadPool(6);
            try {
                List<Callable<String>> requests = new ArrayList<>();
                for (int i = 0; i < 4; i++) {
                    requests.add(() -> request(endpoint, "a"));
                    requests.add(() -> request(endpoint, "b"));
                    requests.add(() -> request(endpoint, null));
                }
                var results = executor.invokeAll(requests);
                for (int i = 0; i < results.size(); i++) {
                    assertEquals(List.of("CN=client-A", "CN=client-B", "anonymous").get(i % 3), results.get(i).get());
                }
            } finally { executor.shutdownNow(); }
        }
    }

    @Test void failedStoreUpdateBlocksHelpersUntilThatStoreIsRestored() throws Exception {
        assertThrows(RuntimeException.class, () -> certificates.storeExtraTrustStore(new byte[] { 1, 2 }, PASSWORD));
        assertThrows(IllegalStateException.class, () -> sockets.getHttpHelperSocketFactory(null, true, null));
        trust(ca);
        assertNotNull(sockets.getHttpHelperSocketFactory(null, false, null));
    }

    private String request(Endpoint endpoint, String alias) throws Exception {
        return request(endpoint, alias, false, null);
    }

    private String request(Endpoint endpoint, String alias, boolean systemTrust, Set<String> selected) throws Exception {
        return requestWithFactory(endpoint, sockets.getHttpHelperSocketFactory(alias, systemTrust, selected));
    }

    private String requestWithFactory(Endpoint endpoint, SSLConnectionSocketFactory factory) throws Exception {
        try (var http = HttpClients.custom().setSSLSocketFactory(factory)
                .disableAutomaticRetries().disableRedirectHandling()
                .setDefaultRequestConfig(RequestConfig.custom().setConnectTimeout(3000).setSocketTimeout(3000).build()).build();
             var response = http.execute(new HttpGet("https://localhost:" + endpoint.server.getAddress().getPort() + "/"))) {
            assertEquals(200, response.getStatusLine().getStatusCode());
            return EntityUtils.toString(response.getEntity(), StandardCharsets.UTF_8);
        }
    }

    private SSLConnectionSocketFactory plainJsseFactory(Identity identity) throws Exception {
        KeyStore keys = keyStore();
        keys.setKeyEntry("control", identity.keys().getPrivate(), PASSWORD, identity.chain());
        KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        kmf.init(keys, PASSWORD);
        KeyStore trust = keyStore();
        trust.setCertificateEntry("root", ca.certificate());
        TrustManagerFactory tmf = TrustManagerFactory.getInstance("PKIX");
        tmf.init(trust);
        SSLContext context = SSLContext.getInstance("TLS");
        context.init(kmf.getKeyManagers(), tmf.getTrustManagers(), null);
        return new SSLConnectionSocketFactory(context, new String[] { "TLSv1.3" }, null,
                SSLConnectionSocketFactory.getDefaultHostnameVerifier());
    }

    private void trust(Identity identity) throws Exception {
        KeyStore trust = keyStore();
        trust.setCertificateEntry("root", identity.certificate());
        certificates.storeExtraTrustStore(bytes(trust), PASSWORD);
    }

    private void clients(Identity first, Identity second) throws Exception {
        KeyStore keys = keyStore();
        keys.setKeyEntry("a", first.keys().getPrivate(), PASSWORD, first.chain());
        keys.setKeyEntry("b", second.keys().getPrivate(), PASSWORD, second.chain());
        certificates.storeExtraKeyStore(bytes(keys), PASSWORD);
    }

    private static KeyStore keyStore() throws Exception {
        KeyStore result = KeyStore.getInstance("PKCS12");
        result.load(null, PASSWORD);
        return result;
    }

    private static byte[] bytes(KeyStore store) throws Exception {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            store.store(out, PASSWORD); return out.toByteArray();
        }
    }

    private record Identity(KeyPair keys, X509Certificate certificate, X509Certificate[] chain) { }

    private static Identity identity(String name, Identity issuer, boolean isCa, String dns,
            KeyPurposeId usage, boolean expired) throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        return identity(name, issuer, isCa, dns, usage, expired, generator.generateKeyPair());
    }

    private static Identity identity(String name, Identity issuer, boolean isCa, String dns,
            KeyPurposeId usage, boolean expired, KeyPair keys) throws Exception {
        X500Name subject = new X500Name("CN=" + name);
        X500Name issuerName = issuer == null ? subject : X500Name.getInstance(issuer.certificate().getSubjectX500Principal().getEncoded());
        Instant now = Instant.now();
        var builder = new JcaX509v3CertificateBuilder(issuerName, java.math.BigInteger.valueOf(SERIAL.getAndIncrement()),
                Date.from(now.minusSeconds(7200)), Date.from(now.plusSeconds(expired ? -3600 : 86400)), subject, keys.getPublic());
        builder.addExtension(Extension.basicConstraints, true, new BasicConstraints(isCa));
        builder.addExtension(Extension.keyUsage, true, new KeyUsage(isCa ? KeyUsage.keyCertSign | KeyUsage.cRLSign : KeyUsage.digitalSignature | KeyUsage.keyEncipherment));
        if (usage != null) builder.addExtension(Extension.extendedKeyUsage, false, new ExtendedKeyUsage(usage));
        if (dns != null) builder.addExtension(Extension.subjectAlternativeName, false, new GeneralNames(new GeneralName(GeneralName.dNSName, dns)));
        X509Certificate certificate = new JcaX509CertificateConverter().getCertificate(builder.build(
                new JcaContentSignerBuilder("SHA256withRSA").build(issuer == null ? keys.getPrivate() : issuer.keys().getPrivate())));
        List<X509Certificate> chain = new ArrayList<>();
        chain.add(certificate);
        if (issuer != null) chain.addAll(List.of(issuer.chain()));
        return new Identity(keys, certificate, chain.toArray(X509Certificate[]::new));
    }

    private static class Endpoint implements AutoCloseable {
        final HttpsServer server;
        final java.util.concurrent.atomic.AtomicInteger requests = new java.util.concurrent.atomic.AtomicInteger();
        final java.util.concurrent.ExecutorService executor = Executors.newCachedThreadPool();
        Endpoint(Identity identity, boolean wantClient, boolean needClient) throws Exception {
            this(identity, wantClient, needClient, "TLSv1.2");
        }
        Endpoint(Identity identity, boolean wantClient, boolean needClient, String protocol) throws Exception {
            KeyStore keys = keyStore();
            keys.setKeyEntry("server", identity.keys().getPrivate(), PASSWORD, identity.chain());
            KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
            kmf.init(keys, PASSWORD);
            KeyStore trust = keyStore();
            trust.setCertificateEntry("client-root", ca.certificate());
            TrustManagerFactory tmf = TrustManagerFactory.getInstance("PKIX");
            tmf.init(trust);
            SSLContext context = SSLContext.getInstance("TLS");
            context.init(kmf.getKeyManagers(), tmf.getTrustManagers(), null);
            server = HttpsServer.create(new InetSocketAddress("localhost", 0), 0);
            server.setHttpsConfigurator(new HttpsConfigurator(context) {
                @Override public void configure(HttpsParameters parameters) {
                    var ssl = context.getDefaultSSLParameters();
                    ssl.setProtocols(new String[] { protocol });
                    if (needClient) ssl.setNeedClientAuth(true);
                    else if (wantClient) ssl.setWantClientAuth(true);
                    parameters.setSSLParameters(ssl);
                }
            });
            server.setExecutor(executor);
            server.createContext("/", exchange -> {
                requests.incrementAndGet();
                String principal;
                try { principal = ((com.sun.net.httpserver.HttpsExchange) exchange).getSSLSession().getPeerPrincipal().getName(); }
                catch (SSLPeerUnverifiedException e) { principal = "anonymous"; }
                byte[] body = principal.getBytes(StandardCharsets.UTF_8);
                try (exchange) { exchange.sendResponseHeaders(200, body.length); exchange.getResponseBody().write(body); }
            });
            server.start();
        }
        @Override public void close() { server.stop(0); executor.shutdownNow(); }
    }
}
