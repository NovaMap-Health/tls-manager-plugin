/*
 * SPDX-License-Identifier: MPL-2.0
 * Copyright (c) 2025 NovaMap Health Limited <https://novamap.health>
 */

package org.openintegrationengine.tlsmanager.server;

import com.mirth.connect.server.controllers.ConfigurationController;
import com.mirth.connect.util.MirthSSLUtil;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.conn.ssl.NoopHostnameVerifier;
import org.apache.http.conn.ssl.SSLConnectionSocketFactory;
import org.openintegrationengine.tlsmanager.server.revocation.DualCheckerTrustManager;
import org.openintegrationengine.tlsmanager.shared.models.WeirdIntermediaryContextContainer;
import org.openintegrationengine.tlsmanager.shared.models.WeirdIntermediaryListenerContextContainer;
import org.openintegrationengine.tlsmanager.shared.properties.TLSConnectorProperties;

import javax.net.ssl.KeyManager;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import java.security.KeyManagementException;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.UnrecoverableKeyException;
import java.util.Set;

@Slf4j
public class SocketFactoryService {

    private final ConfigurationController configurationController;
    private final CertificateService certificateService;

    public SocketFactoryService(
        ConfigurationController configurationController,
        CertificateService certificateService
    ) {
        this.certificateService = certificateService;
        this.configurationController = configurationController;
    }

    public SSLConnectionSocketFactory getConnectorSocketFactory(TLSConnectorProperties properties) {
        var contextContainer = generateTLSContextSender(properties);
        return getConnectorSocketFactory(contextContainer);
    }

    /**
     * Creates a request-owned HTTP-helper context. A null client alias explicitly
     * disables client authentication; no connector context or TLS session is reused.
     */
    public SSLConnectionSocketFactory getHttpHelperSocketFactory(String clientAlias,
            boolean trustSystemTruststore, Set<String> trustedServerCertificates) {
        if (certificateService == null || configurationController == null) {
            throw new HttpTlsConfigurationException("TLS Manager certificate services are unavailable");
        }
        var material = certificateService.snapshotHttpHelperTls(clientAlias,
                trustSystemTruststore, trustedServerCertificates);
        var protocols = MirthSSLUtil.getEnabledHttpsProtocols(configurationController.getHttpsServerProtocols());
        var ciphers = MirthSSLUtil.getEnabledHttpsCipherSuites(configurationController.getHttpsCipherSuites());
        if (protocols == null || protocols.length == 0 || ciphers == null || ciphers.length == 0) {
            throw new HttpTlsConfigurationException("TLS Manager HTTPS protocols or cipher suites are unavailable");
        }
        return HttpHelperTls.socketFactory(material, protocols, ciphers);
    }

    public SSLConnectionSocketFactory getConnectorSocketFactory(WeirdIntermediaryContextContainer contextContainer) {
        // Return null to trigger building the connection with OIE's internal logic
        if (contextContainer == null) return null;

        return new SSLConnectionSocketFactory(
            contextContainer.sslContext(),
            contextContainer.protocols(),
            contextContainer.ciphers(),
            contextContainer.hostnameVerifier()
        );
    }

    public WeirdIntermediaryContextContainer generateTLSContextSender(TLSConnectorProperties properties) {
        try {

            var dualcheckerTrustManager = new DualCheckerTrustManager(
                certificateService.getExternalTrustStore(),
                properties.isTrustSystemTruststore() ? certificateService.getSystemTrustStore() : null,
                properties.getSubjectDnValidationMode(),
                properties.getSubjectDnValidationFilter(),
                properties.getOcspMode(),
                properties.getCrlMode(),
                null,
                properties.getTrustedServerCertificates()
            );

            KeyManager[] keyManagers = null;
            var clientAlias = properties.getClientCertificateAlias();
            if (clientAlias != null && !clientAlias.isBlank()) {
                var keystore = certificateService.getKeyStore(clientAlias);

                var keyManagerFactory = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
                keyManagerFactory.init(keystore, new char[0]);
                keyManagers = keyManagerFactory.getKeyManagers();
            }

            var sslContext = SSLContext.getInstance("TLS");
            sslContext.init(keyManagers, new TrustManager[] { dualcheckerTrustManager }, null);

            var protocolArray = properties.isUseServerDefaultProtocols()
                ? MirthSSLUtil.getEnabledHttpsProtocols(configurationController.getHttpsServerProtocols())
                : MirthSSLUtil.getEnabledHttpsProtocols(properties.getUsedProtocols().toArray(new String[0]));

            var cipherArray = properties.isUseServerDefaultCiphers()
                ? MirthSSLUtil.getEnabledHttpsCipherSuites(configurationController.getHttpsCipherSuites())
                : MirthSSLUtil.getEnabledHttpsCipherSuites(properties.getUsedCiphers().toArray(new String[0]));

            var hostnameVerificationStrategy = properties.isHostnameVerificationEnabled()
                ? SSLConnectionSocketFactory.getDefaultHostnameVerifier()
                : NoopHostnameVerifier.INSTANCE;

            return new WeirdIntermediaryContextContainer(
                sslContext,
                protocolArray,
                cipherArray,
                hostnameVerificationStrategy
            );
        } catch (KeyManagementException | NoSuchAlgorithmException | KeyStoreException | UnrecoverableKeyException e) {
            log.error("Error generating SSLContext", e);
            throw new RuntimeException(e);
        }
    }

    public WeirdIntermediaryListenerContextContainer generateTLSContext(TLSConnectorProperties properties) {
        var keystore = certificateService.getKeyStore(properties.getServerCertificateAlias());

        var dualcheckerTrustManager = new DualCheckerTrustManager(
            certificateService.getExternalTrustStore(),
            properties.isTrustSystemTruststore() ? certificateService.getSystemTrustStore() : null,
            properties.getSubjectDnValidationMode(),
            properties.getSubjectDnValidationFilter(),
            properties.getOcspMode(),
            properties.getCrlMode(),
            null,
            properties.getTrustedServerCertificates()
        );

        var protocolArray = properties.isUseServerDefaultProtocols()
            ? MirthSSLUtil.getEnabledHttpsProtocols(configurationController.getHttpsServerProtocols())
            : MirthSSLUtil.getEnabledHttpsProtocols(properties.getUsedProtocols().toArray(new String[0]));

        var cipherArray = properties.isUseServerDefaultCiphers()
            ? MirthSSLUtil.getEnabledHttpsCipherSuites(configurationController.getHttpsCipherSuites())
            : MirthSSLUtil.getEnabledHttpsCipherSuites(properties.getUsedCiphers().toArray(new String[0]));

        var hostnameVerificationStrategy = properties.isHostnameVerificationEnabled()
            ? SSLConnectionSocketFactory.getDefaultHostnameVerifier()
            : NoopHostnameVerifier.INSTANCE;

        try {
            var keyManagerFactory = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
            keyManagerFactory.init(keystore, new char[0]);

            var sslContext = SSLContext.getInstance("TLS");
            sslContext.init(keyManagerFactory.getKeyManagers(), new TrustManager[] { dualcheckerTrustManager }, null);

            return new WeirdIntermediaryListenerContextContainer(
                protocolArray,
                cipherArray,
                hostnameVerificationStrategy,
                keystore,
                sslContext,
                properties.getClientAuthMode()
            );
        } catch (Exception e) {
            log.error("Error generating SSLContext", e);
            throw new RuntimeException(e);
        }
    }
}
