/*
 * SPDX-License-Identifier: MPL-2.0
 * Copyright (c) 2026 NovaMap Health Limited <https://novamap.health>
 */

package org.openintegrationengine.tlsmanager.server;

import com.mirth.connect.server.controllers.ChannelController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openintegrationengine.tlsmanager.shared.PersistenceMode;
import org.openintegrationengine.tlsmanager.shared.models.LocalCertificate;
import org.openintegrationengine.tlsmanager.shared.models.TLSPluginConfiguration;
import org.openintegrationengine.tlsmanager.shared.models.TrustedCertificate;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.cert.Certificate;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.List;
import java.util.Objects;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

/**
 * Local certificates must keep their full chain so TLS connectors can present the
 * intermediates. Fixtures: a leaf issued by "Test Intermediate CA", and fullchain.pem
 * holding that leaf followed by the intermediate.
 */
class CertificateChainTest {

    private static final String ALIAS = "server";

    @TempDir
    Path directory;

    private CertificateService service;

    @BeforeEach
    void setUp() {
        service = new CertificateService(null, mock(ChannelController.class));
        service.init(new TLSPluginConfiguration(PersistenceMode.FILESYSTEM,
            directory.resolve("truststore.p12").toString(), "truststorePass",
            directory.resolve("keystore.p12").toString(), "keystorePass", false));
    }

    @Test
    void decodesEveryCertificateInAChainInOrder() throws Exception {
        X509Certificate[] chain = CertificateService.decodeCertificateChain(resource("fullchain.pem"));

        assertEquals(2, chain.length);
        assertEquals("CN=test.example", chain[0].getSubjectX500Principal().getName());
        assertEquals("CN=Test Intermediate CA", chain[1].getSubjectX500Principal().getName());
    }

    @Test
    void decodesASingleCertificateAndBareBase64() throws Exception {
        String pem = resource("leaf.pem");
        String bare = pem.replace("-----BEGIN CERTIFICATE-----", "").replace("-----END CERTIFICATE-----", "");

        assertEquals(1, CertificateService.decodeCertificateChain(pem).length);
        assertArrayEquals(CertificateService.decodeCertificateChain(pem),
            CertificateService.decodeCertificateChain(bare));
    }

    @Test
    void ignoresTextAroundPemBlocks() throws Exception {
        String withBagAttributes = "Bag Attributes\n    friendlyName: server\n" + resource("fullchain.pem") + "\ntrailing\n";

        assertEquals(2, CertificateService.decodeCertificateChain(withBagAttributes).length);
    }

    @Test
    void rejectsMissingOrInvalidCertificates() {
        assertThrows(CertificateException.class, () -> CertificateService.decodeCertificateChain(" "));
        assertThrows(CertificateException.class,
            () -> CertificateService.decodeCertificateChain("-----BEGIN CERTIFICATE-----\n@@@\n-----END CERTIFICATE-----"));
    }

    @Test
    void storesTheFullChainForALocalCertificate() throws Exception {
        service.setLocalCertificates(List.of(local(resource("fullchain.pem"))));

        Certificate[] stored = service.getExternalKeyStore().getCertificateChain(ALIAS);
        assertArrayEquals(CertificateService.decodeCertificateChain(resource("fullchain.pem")), stored);
        assertEquals(2, service.getKeyStore(ALIAS).getCertificateChain(ALIAS).length,
            "TLS connectors build their key manager from this keystore");
    }

    @Test
    void exportedChainsCanBeSavedAgain() throws Exception {
        // The UI re-sends every exported entry on any upload, rename or delete.
        service.setLocalCertificates(List.of(local(resource("fullchain.pem"))));
        List<TrustedCertificate> exported = service.getEncodedLocalCertificates();

        service.setLocalCertificates(exported.stream().map(LocalCertificate.class::cast).toList());

        assertEquals(2, service.getExternalKeyStore().getCertificateChain(ALIAS).length);
    }

    @Test
    void trustedEntriesStillHoldOneCertificate() throws Exception {
        TrustedCertificate chain = new TrustedCertificate("ca");
        chain.setCertificate(resource("fullchain.pem"));
        TrustedCertificate single = new TrustedCertificate("ca");
        single.setCertificate(resource("leaf.pem"));

        RuntimeException error = assertThrows(RuntimeException.class, () -> service.setTrustedCertificates(List.of(chain)));
        assertEquals(CertificateException.class, error.getCause().getClass());
        service.setTrustedCertificates(List.of(single));
        assertEquals(1, service.getExternalTrustStore().size());
    }

    private LocalCertificate local(String certificate) throws IOException {
        LocalCertificate local = new LocalCertificate(ALIAS);
        local.setCertificate(certificate);
        local.setKey(resource("leaf.key"));
        return local;
    }

    private static String resource(String name) throws IOException {
        try (InputStream in = CertificateChainTest.class.getResourceAsStream("/certificates/" + name)) {
            return new String(Objects.requireNonNull(in, name).readAllBytes(), StandardCharsets.US_ASCII);
        }
    }
}
