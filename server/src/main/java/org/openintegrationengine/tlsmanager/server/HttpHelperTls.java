/* SPDX-License-Identifier: MPL-2.0 */
package org.openintegrationengine.tlsmanager.server;

import org.apache.http.conn.ssl.SSLConnectionSocketFactory;
import org.openintegrationengine.tlsmanager.server.backend.TrustStoreBackend;

import javax.net.ssl.KeyManager;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLEngine;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509ExtendedKeyManager;
import javax.net.ssl.X509ExtendedTrustManager;
import java.net.Socket;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.security.Principal;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.interfaces.RSAKey;
import java.security.spec.MGF1ParameterSpec;
import java.security.spec.PSSParameterSpec;
import java.security.cert.Certificate;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.Collections;
import java.util.List;
import java.util.Set;

/** Internal, per-request adaptation of the plugin's existing managed stores. */
final class HttpHelperTls {
    private static final char[] EMPTY_PASSWORD = new char[0];
    private static final byte[] KEY_CHECK = "TLS Manager client identity validation".getBytes(java.nio.charset.StandardCharsets.US_ASCII);

    private HttpHelperTls() { }

    record Material(KeyStore trustStore, KeyStore clientKeyStore) { }

    static Material snapshot(KeyStore managedTrust, KeyStore systemTrust, KeyStore managedKeys,
            TrustStoreBackend keysBackend, String alias, Set<String> selectedTrust) {
        try {
            KeyStore trust = emptyStore();
            Set<String> selected = selectedTrust == null
                    ? Set.copyOf(Collections.list(managedTrust.aliases())) : Set.copyOf(selectedTrust);
            int index = 0;
            for (String name : selected) {
                Certificate certificate = managedTrust.getCertificate(name);
                if (!(certificate instanceof X509Certificate)) {
                    throw new HttpTlsConfigurationException("A selected managed trust certificate is missing or unusable");
                }
                trust.setCertificateEntry("managed-" + index++, certificate);
            }
            if (systemTrust != null) {
                for (String name : Collections.list(systemTrust.aliases())) {
                    Certificate certificate = systemTrust.getCertificate(name);
                    if (certificate instanceof X509Certificate) {
                        trust.setCertificateEntry("system-" + index++, certificate);
                    }
                }
            }
            if (trust.size() == 0) {
                throw new HttpTlsConfigurationException("TLS Manager has no selected trust certificates");
            }

            KeyStore client = emptyStore();
            if (alias != null) {
                if (alias.isBlank() || !managedKeys.containsAlias(alias)) {
                    throw new HttpTlsConfigurationException("The selected managed client-certificate alias does not exist");
                }
                if (!managedKeys.isKeyEntry(alias)) {
                    throw new HttpTlsConfigurationException("The selected managed client certificate has no private key");
                }
                var key = managedKeys.getKey(alias, keysBackend.loadPassword());
                Certificate[] chain = managedKeys.getCertificateChain(alias);
                if (!(key instanceof PrivateKey privateKey) || chain == null || chain.length == 0) {
                    throw new HttpTlsConfigurationException("The selected managed client credentials are unusable");
                }
                try {
                    validateIdentity(privateKey, chain);
                } catch (GeneralSecurityException e) {
                    throw new HttpTlsConfigurationException("The selected managed client credentials are unusable");
                }
                // A one-entry key manager still performs JSSE key-type and issuer compatibility checks.
                client.setKeyEntry("http-helper-client", privateKey, EMPTY_PASSWORD, chain);
            }
            return new Material(trust, client);
        } catch (GeneralSecurityException | java.io.IOException e) {
            // Backend/JSSE exception text can contain aliases or provider-specific credential details.
            throw new HttpTlsConfigurationException("TLS Manager could not prepare the managed TLS credentials");
        }
    }

    private static KeyStore emptyStore() throws GeneralSecurityException, java.io.IOException {
        KeyStore result = KeyStore.getInstance("PKCS12");
        result.load(null, EMPTY_PASSWORD);
        return result;
    }

    private static void validateIdentity(PrivateKey privateKey, Certificate[] chain) throws GeneralSecurityException {
        for (int i = 0; i < chain.length; i++) {
            if (!(chain[i] instanceof X509Certificate certificate)) {
                throw new CertificateException("Client certificate chain must use X.509");
            }
            certificate.checkValidity();
            if (i + 1 < chain.length) {
                if (!(chain[i + 1] instanceof X509Certificate issuer)
                        || !certificate.getIssuerX500Principal().equals(issuer.getSubjectX500Principal())
                        || issuer.getBasicConstraints() < 0) {
                    throw new CertificateException("Client certificate chain is invalid");
                }
                certificate.verify(issuer.getPublicKey());
                boolean[] usage = issuer.getKeyUsage();
                if (usage != null && (usage.length <= 5 || !usage[5])) {
                    throw new CertificateException("Client issuer cannot sign certificates");
                }
            }
        }
        X509Certificate leaf = (X509Certificate) chain[0];
        checkExtendedUsage(leaf, "1.3.6.1.5.5.7.3.2");
        boolean[] usage = leaf.getKeyUsage();
        if (usage != null && !usage[0]) {
            throw new CertificateException("Client certificate cannot sign TLS handshakes");
        }
        String algorithm = switch (privateKey.getAlgorithm()) {
            case "RSA" -> "SHA256withRSA";
            case "RSASSA-PSS" -> "RSASSA-PSS";
            case "EC" -> "SHA256withECDSA";
            case "DSA" -> "SHA256withDSA";
            case "Ed25519" -> "Ed25519";
            case "Ed448" -> "Ed448";
            case "EdDSA" -> "EdDSA";
            default -> throw new GeneralSecurityException("Unsupported client private-key algorithm");
        };
        Signature signer = Signature.getInstance(algorithm);
        if (algorithm.equals("RSASSA-PSS")) {
            var parameters = privateKey instanceof RSAKey rsa ? rsa.getParams() : null;
            if (parameters == null && leaf.getPublicKey() instanceof RSAKey rsa) {
                parameters = rsa.getParams();
            }
            signer.setParameter(parameters instanceof PSSParameterSpec pss ? pss
                    : new PSSParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA256, 32, 1));
        }
        signer.initSign(privateKey);
        signer.update(KEY_CHECK);
        byte[] signature = signer.sign();
        signer.initVerify(leaf.getPublicKey());
        signer.update(KEY_CHECK);
        if (!signer.verify(signature)) {
            throw new GeneralSecurityException("Client private key does not match its certificate");
        }
    }

    static SSLConnectionSocketFactory socketFactory(Material material, String[] protocols, String[] ciphers) {
        try {
            KeyManager[] keys;
            if (material.clientKeyStore().size() == 0) {
                // Never pass null: JSSE can load a JVM-default client identity for null managers.
                keys = new KeyManager[] { new NoClientCertificate() };
            } else {
                KeyManagerFactory factory = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
                factory.init(material.clientKeyStore(), EMPTY_PASSWORD);
                X509ExtendedKeyManager selected = null;
                for (KeyManager manager : factory.getKeyManagers()) {
                    if (manager instanceof X509ExtendedKeyManager x509) selected = x509;
                }
                if (selected == null) throw new GeneralSecurityException("X.509 key manager unavailable");
                keys = new KeyManager[] { new RequiredClientCertificate(selected) };
            }
            TrustManagerFactory trusts = TrustManagerFactory.getInstance("PKIX");
            trusts.init(material.trustStore());
            X509ExtendedTrustManager delegate = null;
            for (TrustManager trust : trusts.getTrustManagers()) {
                if (trust instanceof X509ExtendedTrustManager manager) delegate = manager;
            }
            if (delegate == null) throw new GeneralSecurityException("X.509 trust manager unavailable");
            SSLContext context = SSLContext.getInstance("TLS");
            context.init(keys, new TrustManager[] { new ValidatingTrustManager(delegate) }, null);
            return new SSLConnectionSocketFactory(context, protocols, ciphers,
                    SSLConnectionSocketFactory.getDefaultHostnameVerifier());
        } catch (GeneralSecurityException e) {
            throw new HttpTlsConfigurationException("TLS Manager could not initialize a secure HTTP context");
        }
    }

    private static void checkExtendedUsage(X509Certificate certificate, String required) throws CertificateException {
        List<String> usage = certificate.getExtendedKeyUsage();
        if (usage != null && !usage.contains(required) && !usage.contains("2.5.29.37.0")) {
            throw new CertificateException("Certificate is not valid for the required TLS role");
        }
    }

    /** PKIX handles complete chains; explicit leaf checks also cover directly trusted leaf entries. */
    private static final class ValidatingTrustManager extends X509ExtendedTrustManager {
        private final X509ExtendedTrustManager delegate;
        private ValidatingTrustManager(X509ExtendedTrustManager delegate) { this.delegate = delegate; }
        private void validateLeaf(X509Certificate[] chain) throws CertificateException {
            if (chain == null || chain.length == 0) throw new CertificateException("Missing server certificate");
            chain[0].checkValidity();
            checkExtendedUsage(chain[0], "1.3.6.1.5.5.7.3.1");
            boolean[] usage = chain[0].getKeyUsage();
            if (usage != null && !usage[0] && (usage.length <= 2 || !usage[2])
                    && (usage.length <= 4 || !usage[4])) {
                throw new CertificateException("Server certificate has no compatible TLS key usage");
            }
        }
        @Override public void checkServerTrusted(X509Certificate[] chain, String type) throws CertificateException {
            validateLeaf(chain); delegate.checkServerTrusted(chain, type);
        }
        @Override public void checkServerTrusted(X509Certificate[] chain, String type, Socket socket) throws CertificateException {
            validateLeaf(chain); delegate.checkServerTrusted(chain, type, socket);
        }
        @Override public void checkServerTrusted(X509Certificate[] chain, String type, SSLEngine engine) throws CertificateException {
            validateLeaf(chain); delegate.checkServerTrusted(chain, type, engine);
        }
        @Override public void checkClientTrusted(X509Certificate[] chain, String type) throws CertificateException {
            delegate.checkClientTrusted(chain, type);
        }
        @Override public void checkClientTrusted(X509Certificate[] chain, String type, Socket socket) throws CertificateException {
            delegate.checkClientTrusted(chain, type, socket);
        }
        @Override public void checkClientTrusted(X509Certificate[] chain, String type, SSLEngine engine) throws CertificateException {
            delegate.checkClientTrusted(chain, type, engine);
        }
        @Override public X509Certificate[] getAcceptedIssuers() { return delegate.getAcceptedIssuers(); }
    }

    private static final class NoClientCertificate extends X509ExtendedKeyManager {
        @Override public String[] getClientAliases(String type, Principal[] issuers) { return null; }
        @Override public String chooseClientAlias(String[] types, Principal[] issuers, Socket socket) { return null; }
        @Override public String chooseEngineClientAlias(String[] types, Principal[] issuers, SSLEngine engine) { return null; }
        @Override public String[] getServerAliases(String type, Principal[] issuers) { return null; }
        @Override public String chooseServerAlias(String type, Principal[] issuers, Socket socket) { return null; }
        @Override public String chooseEngineServerAlias(String type, Principal[] issuers, SSLEngine engine) { return null; }
        @Override public X509Certificate[] getCertificateChain(String alias) { return null; }
        @Override public PrivateKey getPrivateKey(String alias) { return null; }
    }

    /** Refusing an incompatible explicit identity must not turn into anonymous optional mTLS. */
    private static final class RequiredClientCertificate extends X509ExtendedKeyManager {
        private final X509ExtendedKeyManager delegate;
        private RequiredClientCertificate(X509ExtendedKeyManager delegate) { this.delegate = delegate; }
        private String require(String alias) {
            if (alias == null) {
                throw new HttpTlsConfigurationException("The selected managed client certificate is incompatible with the server TLS request");
            }
            return alias;
        }
        @Override public String[] getClientAliases(String type, Principal[] issuers) { return delegate.getClientAliases(type, issuers); }
        @Override public String chooseClientAlias(String[] types, Principal[] issuers, Socket socket) {
            return require(delegate.chooseClientAlias(types, issuers, socket));
        }
        @Override public String chooseEngineClientAlias(String[] types, Principal[] issuers, SSLEngine engine) {
            return require(delegate.chooseEngineClientAlias(types, issuers, engine));
        }
        @Override public String[] getServerAliases(String type, Principal[] issuers) { return null; }
        @Override public String chooseServerAlias(String type, Principal[] issuers, Socket socket) { return null; }
        @Override public String chooseEngineServerAlias(String type, Principal[] issuers, SSLEngine engine) { return null; }
        @Override public X509Certificate[] getCertificateChain(String alias) { return delegate.getCertificateChain(alias); }
        @Override public PrivateKey getPrivateKey(String alias) { return delegate.getPrivateKey(alias); }
    }
}
