/*
 * SPDX-License-Identifier: MPL-2.0
 * Copyright (c) 2025 NovaMap Health Limited <https://novamap.health>
 */

package org.openintegrationengine.tlsmanager.server;

import com.mirth.connect.client.core.api.MirthApiException;
import com.mirth.connect.connectors.http.HttpDispatcherProperties;
import com.mirth.connect.connectors.tcp.TcpDispatcherProperties;
import com.mirth.connect.connectors.ws.WebServiceDispatcherProperties;
import com.mirth.connect.donkey.model.channel.ConnectorPluginProperties;
import com.mirth.connect.donkey.model.channel.ConnectorProperties;
import com.mirth.connect.model.Channel;
import com.mirth.connect.model.Connector;
import com.mirth.connect.server.controllers.ChannelController;
import com.mirth.connect.server.util.TemplateValueReplacer;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.asn1.pkcs.PrivateKeyInfo;
import org.bouncycastle.openssl.PEMKeyPair;
import org.bouncycastle.openssl.PEMParser;
import org.bouncycastle.openssl.jcajce.JcaPEMKeyConverter;
import org.openintegrationengine.tlsmanager.server.backend.DatabaseTrustStoreBackend;
import org.openintegrationengine.tlsmanager.server.backend.FileTrustStoreBackend;
import org.openintegrationengine.tlsmanager.server.backend.SystemTrustStoreBackend;
import org.openintegrationengine.tlsmanager.server.backend.TrustStoreBackend;
import org.openintegrationengine.tlsmanager.server.util.ConnectionUtils;
import org.openintegrationengine.tlsmanager.shared.PersistenceMode;
import org.openintegrationengine.tlsmanager.shared.models.ConnectionTestResult;
import org.openintegrationengine.tlsmanager.shared.models.LocalCertificate;
import org.openintegrationengine.tlsmanager.shared.models.TLSPluginConfiguration;
import org.openintegrationengine.tlsmanager.shared.models.TrustedCertificate;
import org.openintegrationengine.tlsmanager.shared.properties.TLSConnectorProperties;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.StringReader;
import java.net.URL;
import java.security.InvalidKeyException;
import java.security.Key;
import java.security.KeyFactory;
import java.security.KeyManagementException;
import java.security.KeyStore;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.UnrecoverableKeyException;
import java.security.cert.Certificate;
import java.security.cert.CertificateEncodingException;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.BiConsumer;

import static org.openintegrationengine.tlsmanager.shared.TLSPluginConstants.PKCS12;

@Slf4j
public final class CertificateService {

    @Getter
    private KeyStore systemTrustStore;

    @Getter
    private KeyStore externalTrustStore;

    @Getter
    private KeyStore externalKeyStore;

    private TrustStoreBackend systemTrustStoreBackend;
    private TrustStoreBackend extraTrustStoreBackend;
    private TrustStoreBackend extraKeyStoreBackend;

    private final ChannelController channelController;
    private final TemplateValueReplacer templateValueReplacer;

    public CertificateService(ChannelController channelController) {
        this(new TemplateValueReplacer(), channelController);
    }

    public CertificateService(TemplateValueReplacer templateValueReplacer, ChannelController channelController) {
        this.templateValueReplacer = templateValueReplacer;
        this.channelController = channelController;
    }

    void init(TLSPluginConfiguration pluginConfiguration) {
        systemTrustStoreBackend = new SystemTrustStoreBackend();

        if (pluginConfiguration.persistenceMode() == PersistenceMode.DATABASE) {
            extraTrustStoreBackend = new DatabaseTrustStoreBackend("extraTrustStore");
            extraKeyStoreBackend = new DatabaseTrustStoreBackend("extraKeyStore");
        } else if (pluginConfiguration.persistenceMode() == PersistenceMode.FILESYSTEM) {
            extraTrustStoreBackend = new FileTrustStoreBackend(
                pluginConfiguration.truststorePath(),
                pluginConfiguration.truststorePassword()
            );

            extraKeyStoreBackend = new FileTrustStoreBackend(
                pluginConfiguration.keystorePath(),
                pluginConfiguration.keystorePassword()
            );
        } else {
            // Should not get here
            throw new RuntimeException("Unsupported persistence mode: " + pluginConfiguration.persistenceMode());
        }

        extraTrustStoreBackend.init();
        extraKeyStoreBackend.init();

        byte[] cacertsBytes = systemTrustStoreBackend.load();
        byte[] extraTrustStoreBytes = extraTrustStoreBackend.load();
        byte[] extraKeyStoreBytes = extraKeyStoreBackend.load();

        try {
            systemTrustStore = KeyStore.getInstance(KeyStore.getDefaultType());
            externalTrustStore = KeyStore.getInstance(PKCS12);
            externalKeyStore = KeyStore.getInstance(PKCS12);
        } catch (KeyStoreException e) {
            log.error("Error initializing CertificateService", e);
            throw new RuntimeException(e);
        }

        loadKeyStore(systemTrustStore, cacertsBytes, systemTrustStoreBackend.loadPassword());
        loadKeyStore(externalTrustStore, extraTrustStoreBytes, extraTrustStoreBackend.loadPassword());
        loadKeyStore(externalKeyStore, extraKeyStoreBytes, extraKeyStoreBackend.loadPassword());
    }

    KeyStore getKeyStore(String alias) {
        try {
            var keystore = KeyStore.getInstance(PKCS12);
            keystore.load(null, new char[0]);

            if (alias == null) {
                throw new IllegalArgumentException("Alias cannot be null");
            }

            if (externalKeyStore.isKeyEntry(alias)) {
                var certChain = externalKeyStore.getCertificateChain(alias);
                var privateKey = externalKeyStore.getKey(alias, extraKeyStoreBackend.loadPassword());

                keystore.setKeyEntry(
                    alias,
                    privateKey,
                    new char[0],
                    certChain
                );
            } else {
                log.warn("Alias ({}) is not a key entry", alias);
            }

            return keystore;
        } catch (KeyStoreException | IOException | NoSuchAlgorithmException | CertificateException | UnrecoverableKeyException e) {
            log.error("Error creating a keystore", e);
            throw new RuntimeException(e);
        }
    }

    private void loadKeyStore(KeyStore keystore, byte[] bytes, char[] password) {
        try (var bais = new ByteArrayInputStream(bytes)) {
            keystore.load(bais, password);
        } catch (IOException | NoSuchAlgorithmException | CertificateException e) {
            log.error("Error loading keystore into memory", e);
            throw new RuntimeException(e);
        }
    }

    public void storeExtraTrustStore(byte[] keystoreBytes, char[] password) {
        try (var bais = new ByteArrayInputStream(keystoreBytes)) {
            externalTrustStore.load(bais, password);
            extraTrustStoreBackend.persist(keystoreBytes);
        } catch (CertificateException | IOException | NoSuchAlgorithmException e) {
            log.error("Error overwriting truststore", e);
            throw new RuntimeException(e);
        }
    }

    public void storeExtraKeyStore(byte[] keystoreBytes, char[] password) {
        try (var bais = new ByteArrayInputStream(keystoreBytes)) {
            externalKeyStore.load(bais, password);
            extraKeyStoreBackend.persist(keystoreBytes);
        } catch (CertificateException | IOException | NoSuchAlgorithmException e) {
            log.error("Error overwriting keystore", e);
            throw new RuntimeException(e);
        }
    }

    public Set<String> getTrustedCertificateAliases() {
        try {
            return new HashSet<>(Collections.list(externalTrustStore.aliases()));
        } catch (KeyStoreException e) {
            log.error("Error reading alias list from loaded truststore", e);
            throw new RuntimeException(e);
        }
    }

    public Set<String> getLocalCertificateAliases() {
        try {
            return new HashSet<>(Collections.list(externalKeyStore.aliases()));
        } catch (KeyStoreException e) {
            log.error("Error reading alias list from loaded keystore", e);
            throw new RuntimeException(e);
        }
    }

    public List<TrustedCertificate> getEncodedSystemCertificates() {
        return getEncodedCertificates(systemTrustStore, systemTrustStoreBackend.loadPassword());
    }

    public List<TrustedCertificate> getEncodedLocalCertificates() {
        return getEncodedCertificates(externalKeyStore, extraKeyStoreBackend.loadPassword());
    }

    public List<TrustedCertificate> getEncodedTrustedCertificates() {
        return getEncodedCertificates(externalTrustStore, extraTrustStoreBackend.loadPassword());
    }

    private List<TrustedCertificate> getEncodedCertificates(KeyStore keyStore, char[] password) {
        List<TrustedCertificate> certificates = new ArrayList<>();

        try {
            Enumeration<String> aliases = keyStore.aliases();

            while (aliases.hasMoreElements()) {
                String alias = aliases.nextElement();

                if (keyStore.isKeyEntry(alias)) {
                    LocalCertificate certificate = new LocalCertificate(alias);
                    String encodedCertificate = encodeCertificateChain(keyStore.getCertificateChain(alias));
                    String encodedKey = encodeKey(keyStore.getKey(alias, password));
                    certificate.setCertificate(encodedCertificate);
                    certificate.setKey(encodedKey);
                    certificate.setChannelsInUse(getChannelsInUse(alias));
                    certificates.add(certificate);
                } else if (keyStore.isCertificateEntry(alias)) {
                    TrustedCertificate certificate = new TrustedCertificate(alias);
                    String encodedCertificate = encodeCertificateChain(keyStore.getCertificate(alias));
                    certificate.setCertificate(encodedCertificate);
                    certificate.setChannelsInUse(getChannelsInUse(alias));
                    certificates.add(certificate);
                }
            }
            return certificates;
        } catch (KeyStoreException | CertificateEncodingException | NoSuchAlgorithmException | UnrecoverableKeyException e) {
            throw new RuntimeException(e);
        }
    }

    private Set<String> getChannelsInUse(String alias) {
        final Set<String> channelsInUse = new HashSet<>();
        final List<Channel> channels = channelController.getChannels(null);

        BiConsumer<TLSConnectorProperties, String> addIfInUse = (TLSConnectorProperties properties, String channelName) -> {
            if (properties != null) {
                if (alias.equals(properties.getServerCertificateAlias())) {
                    channelsInUse.add(channelName);
                } else if (alias.equals(properties.getClientCertificateAlias())) {
                    channelsInUse.add(channelName);
                } else if (properties.getTrustedServerCertificates() != null
                    && !properties.getTrustedServerCertificates().isEmpty()
                    && properties.getTrustedServerCertificates().contains(alias)) {
                    channelsInUse.add(channelName);
                }
            }
        };

        for (Channel channel : channels) {
            ConnectorProperties connectorProperties = channel.getSourceConnector().getProperties();

            if (connectorProperties != null) {
                Set<ConnectorPluginProperties> sourceProperties = connectorProperties.getPluginProperties();

                if (sourceProperties != null && !sourceProperties.isEmpty()) {
                    TLSConnectorProperties tlsSourceProperties = (TLSConnectorProperties) sourceProperties
                        .stream()
                        .filter(props -> props instanceof TLSConnectorProperties)
                        .findFirst()
                        .orElse(null);

                    addIfInUse.accept(tlsSourceProperties, channel.getName());
                }
            }
            for (Connector destinationConnector : channel.getDestinationConnectors()) {
                ConnectorProperties destinationConnectorProperties = destinationConnector.getProperties();

                if (connectorProperties != null) {
                    Set<ConnectorPluginProperties> destinationProperties = destinationConnectorProperties.getPluginProperties();

                    TLSConnectorProperties tlsDestinationProperties = (TLSConnectorProperties) destinationProperties
                        .stream()
                        .filter(props -> props instanceof TLSConnectorProperties)
                        .findFirst()
                        .orElse(null);

                    addIfInUse.accept(tlsDestinationProperties, channel.getName());
                }
            }
        }
        return channelsInUse;
    }

    private String encodeCertificateChain(Certificate... chain) throws CertificateEncodingException {
        StringBuilder pem = new StringBuilder();

        for (Certificate cert : chain) {
            String base64Cert = Base64.getMimeEncoder(64, "\n".getBytes())
                .encodeToString(cert.getEncoded());
            pem.append("-----BEGIN CERTIFICATE-----\n")
                .append(base64Cert)
                .append("\n-----END CERTIFICATE-----\n\n");
        }
        return pem.toString();
    }

    private String encodeKey(Key key) throws CertificateEncodingException {
        StringBuilder pem = new StringBuilder();

        if (key instanceof PrivateKey) {
            String base64Key = Base64.getMimeEncoder(64, "\n".getBytes())
                .encodeToString(key.getEncoded());
            pem.append("-----BEGIN PRIVATE KEY-----\n")
                .append(base64Key)
                .append("\n-----END PRIVATE KEY-----\n\n");
        }
        return pem.toString();
    }

    public void setTrustedCertificates(List<TrustedCertificate> trustedCertificates) {
        try {
            KeyStore ks = KeyStore.getInstance("PKCS12");
            char[] password = extraTrustStoreBackend.loadPassword();
            ks.load(null, password);

            for (TrustedCertificate certificate : trustedCertificates) {
                X509Certificate cert = decodeCertificate(certificate.getCertificate());
                ks.setCertificateEntry(certificate.getAlias(), cert);
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ks.store(out, password);
            byte[] keystoreBytes = out.toByteArray();
            storeExtraTrustStore(keystoreBytes, password);
        } catch (CertificateException | IOException | KeyStoreException | NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    private X509Certificate decodeCertificate(String certificate) throws CertificateException {
        CertificateFactory cf = CertificateFactory.getInstance("X.509");
        String certContent = certificate
            .replaceAll("-----BEGIN CERTIFICATE-----", "")
            .replaceAll("-----END CERTIFICATE-----", "")
            .replaceAll("\\s+", "");
        byte[] certBytes = Base64.getDecoder().decode(certContent);
        return (X509Certificate) cf.generateCertificate(
            new java.io.ByteArrayInputStream(certBytes));
    }

    private PrivateKey decodeKey(String key) throws CertificateException, NoSuchAlgorithmException, InvalidKeySpecException, IOException {
        String keyContent = key
            .replaceAll("-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----", "")
            .replaceAll("-----END [A-Z0-9 ]*PRIVATE KEY-----", "")
            .replaceAll("\\s+", "");
        byte[] keyBytes = Base64.getDecoder().decode(keyContent);
        PrivateKey privateKey;
        try {
            privateKey = KeyFactory.getInstance("RSA")
                .generatePrivate(new PKCS8EncodedKeySpec(keyBytes));
        } catch (InvalidKeySpecException e) {
            if (e.getCause() instanceof InvalidKeyException) {
                // Attempt to convert to PKCS#8
                return attemptPkcs8Conversion(key);
            }
            throw e;
        }
        return privateKey;
    }

    private PrivateKey attemptPkcs8Conversion(String key) throws InvalidKeySpecException, IOException {
        try (PEMParser parser = new PEMParser(new StringReader(key))) {
            Object obj = parser.readObject();
            JcaPEMKeyConverter converter = new JcaPEMKeyConverter();

            if (obj instanceof PEMKeyPair) {
                return converter.getKeyPair((PEMKeyPair) obj).getPrivate();
            } else if (obj instanceof PrivateKeyInfo) {
                return converter.getPrivateKey((PrivateKeyInfo) obj);
            } else {
                throw new IllegalArgumentException("Unsupported PEM object: " + obj.getClass());
            }
        }
    }

    public void setLocalCertificates(List<LocalCertificate> localCertificates) {
        try {
            KeyStore ks = KeyStore.getInstance("PKCS12");
            char[] password = extraKeyStoreBackend.loadPassword();
            ks.load(null, password);

            for (LocalCertificate certificate : localCertificates) {
                X509Certificate cert = decodeCertificate(certificate.getCertificate());
                PrivateKey privateKey = decodeKey(certificate.getKey());
                ks.setKeyEntry(certificate.getAlias(), privateKey, password, new Certificate[]{cert});
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ks.store(out, password);
            byte[] keystoreBytes = out.toByteArray();
            storeExtraKeyStore(keystoreBytes, password);
        } catch (CertificateException | InvalidKeySpecException | IOException | KeyStoreException |
                 NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    public List<TrustedCertificate> retrieveRemoteCertificates(String urlString) {
        List<TrustedCertificate> result = new ArrayList<>();
        HttpsURLConnection conn = null;

        try {
            SSLContext sc = SSLContext.getInstance("TLS");

            TrustManager[] trustAll = new TrustManager[]{
                new X509TrustManager() {
                    public X509Certificate[] getAcceptedIssuers() {
                        return new X509Certificate[0];
                    }

                    public void checkClientTrusted(X509Certificate[] certs, String authType) {
                    }

                    public void checkServerTrusted(X509Certificate[] certs, String authType) {
                    }
                }
            };

            sc.init(null, trustAll, new SecureRandom());
            URL url = new URL(urlString);
            conn = (HttpsURLConnection) url.openConnection();
            conn.setSSLSocketFactory(sc.getSocketFactory());
            conn.setHostnameVerifier((h, s) -> true);
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.connect();
            Certificate[] certs = conn.getServerCertificates();

            for (Certificate cert : certs) {
                if (cert instanceof X509Certificate x509) {
                    TrustedCertificate certificate = new TrustedCertificate(null);
                    certificate.setCertificate(encodeCertificateChain(x509));
                    result.add(certificate);
                }
            }
        } catch (IOException | CertificateEncodingException | KeyManagementException | NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
        return result;
    }

    public ConnectionTestResult testTcpConnection(
        String channelId,
        String channelName,
        TcpDispatcherProperties dispatcherProperties
    ) {
        var oTlsPluginProperties = dispatcherProperties.getPluginProperties()
            .stream()
            .filter(TLSConnectorProperties.class::isInstance)
            .map(TLSConnectorProperties.class::cast)
            .findFirst();

        if (oTlsPluginProperties.isEmpty()) {
            log.debug("No TLS plugin properties found for testTcpConnection. Doing non-TLS test");
            // TODO Actually do the test
        }

        var properties = oTlsPluginProperties.get();

        var socketFactoryService = TLSServicePlugin.getPluginInstance().getSocketFactoryService();
        var socketFactory = socketFactoryService.getConnectorSocketFactory(properties);
        try {

            String host = templateValueReplacer.replaceValues(dispatcherProperties.getRemoteAddress(), channelId, channelName);
            int port = Integer.parseInt(templateValueReplacer.replaceValues(dispatcherProperties.getRemotePort(), channelId, channelName));
            int timeout = Integer.parseInt(templateValueReplacer.replaceValues(dispatcherProperties.getResponseTimeout(), channelId, channelName));

            if (!dispatcherProperties.isOverrideLocalBinding()) {
                return ConnectionUtils.testConnection(
                    socketFactory,
                    host,
                    port,
                    timeout,
                    null,
                    0
                );
            } else {
                String localAddr = templateValueReplacer.replaceValues(dispatcherProperties.getLocalAddress(), channelId, channelName);
                int localPort = Integer.parseInt(templateValueReplacer.replaceValues(dispatcherProperties.getLocalPort(), channelId, channelName));

                return ConnectionUtils.testConnection(
                    socketFactory,
                    host,
                    port,
                    timeout,
                    localAddr,
                    localPort
                );
            }
        } catch (Exception e) {
            throw new MirthApiException(e);
        }
    }

    public ConnectionTestResult testHttpConnection(
        String channelId,
        String channelName,
        HttpDispatcherProperties dispatcherProperties
    ) {
        final int TIMEOUT = 5000;

        var oTlsPluginProperties = dispatcherProperties.getPluginProperties()
            .stream()
            .filter(TLSConnectorProperties.class::isInstance)
            .map(TLSConnectorProperties.class::cast)
            .findFirst();

        if (oTlsPluginProperties.isEmpty()) {
            log.debug("No TLS plugin properties found for testTcpConnection. Doing non-TLS test");
            // TODO Actually do the test
        }

        var properties = oTlsPluginProperties.get();

        var socketFactoryService = TLSServicePlugin.getPluginInstance().getSocketFactoryService();
        var socketFactory = socketFactoryService.getConnectorSocketFactory(properties);

        try {
            var url = new URL(templateValueReplacer.replaceValues(dispatcherProperties.getHost(), channelId, channelName));
            var port = url.getPort();

            int computedPort;
            if (port == -1)
                // If no port was provided, default to port 80 or 443.
                computedPort = "https".equalsIgnoreCase(url.getProtocol()) ? 443 : 80;
            else
                computedPort = port;

            return ConnectionUtils.testConnection(
                socketFactory,
                url.getHost(),
                computedPort,
                TIMEOUT,
                null,
                0
            );
        } catch (Exception e) {
            throw new MirthApiException(e);
        }
    }

    public ConnectionTestResult testWsConnection(
        String channelId,
        String channelName,
        WebServiceDispatcherProperties dispatcherProperties
    ) {
        final int MAX_TIMEOUT = 300_000; // 5 minutes???

        var oTlsPluginProperties = dispatcherProperties.getPluginProperties()
            .stream()
            .filter(TLSConnectorProperties.class::isInstance)
            .map(TLSConnectorProperties.class::cast)
            .findFirst();

        if (oTlsPluginProperties.isEmpty()) {
            log.debug("No TLS plugin properties found for testWsConnection. Doing non-TLS test");
            // TODO Actually do the test
        }

        var properties = oTlsPluginProperties.get();

        var socketFactoryService = TLSServicePlugin.getPluginInstance().getSocketFactoryService();
        var socketFactory = socketFactoryService.getConnectorSocketFactory(properties);

        try {
            String host;
            if (dispatcherProperties.getLocationURI() != null && !dispatcherProperties.getLocationURI().isBlank()) {
                host = dispatcherProperties.getLocationURI();
            } else if (dispatcherProperties.getWsdlUrl() != null && !dispatcherProperties.getWsdlUrl().isBlank()) {
                host = dispatcherProperties.getWsdlUrl();
            } else {
                throw new Exception("Both WSDL URL and Location URI are blank. At least one must be populated in order to test connection.");
            }

            var url = new URL(templateValueReplacer.replaceValues(host, channelId, channelName));
            var port = url.getPort();

            int computedPort;
            if (port == -1)
                // If no port was provided, default to port 80 or 443.
                computedPort = "https".equalsIgnoreCase(url.getProtocol()) ? 443 : 80;
            else
                computedPort = port;

            return ConnectionUtils.testConnection(
                socketFactory,
                url.getHost(),
                computedPort,
                MAX_TIMEOUT,
                null,
                0
            );
        } catch (Exception e) {
            throw new MirthApiException(e);
        }
    }

    /**
     * Perform a byte-level clone of a KeyStore object
     *
     * @param keystore The KeyStore object to be cloned
     * @return Byte-level clone of the provided KeyStore
     */
    private KeyStore clone(KeyStore keystore) {
        // This doesn't have to be secret. It is just here because a keystore password cannot be null
        final var password = "sup3rS3cr1t!".toCharArray();

        try (var outStream = new ByteArrayOutputStream()) {
            var finalTrustStore = KeyStore.getInstance(PKCS12);

            keystore.store(outStream, password);

            try (var inStream = new ByteArrayInputStream(outStream.toByteArray())) {
                finalTrustStore.load(inStream, password);
            }

            return finalTrustStore;
        } catch (IOException | CertificateException | KeyStoreException | NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
