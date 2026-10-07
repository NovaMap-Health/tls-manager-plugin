import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';
import { certificate, toPem } from './certificates.mjs';

// Exercise the browser modules without requiring the host's DOM toast service.
const { outputFiles } = await build({
    stdin: {
        contents: "export * from './web/certificateUtils.js'; export * from './web/verificationUtils.js';",
        resolveDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    },
    bundle: true, format: 'esm', platform: 'browser', write: false,
    plugins: [{ name: 'notifications', setup(builder) {
        builder.onResolve({ filter: /^@oie\/web-ui$/ }, () => ({ path: 'notifications', namespace: 'test' }));
        builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export function toast() {}' }));
    } }]
});
const utils = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const rsa = await certificate('rsa.example');
const ec = await certificate('ec.example', { type: 'EC' });
const root = await certificate('Root CA', { ca: true });
const intermediate = await certificate('Intermediate CA', { ca: true, issuer: root });
const leaf = await certificate('leaf.example', { issuer: intermediate });

for (const [type, fixture, bits] of [['RSA', rsa, 2048], ['ECDSA', ec, 256]]) {
    test(`${type}: PEM and bare DER retain details and fingerprints`, async () => {
        const reference = new X509Certificate(fixture.pem);
        for (const input of [fixture.pem, reference.raw.toString('base64')]) {
            const details = await utils.parseCertificate(input);
            assert.equal(details.error, undefined);
            assert.equal(details.subject.CN, type === 'RSA' ? 'rsa.example' : 'ec.example');
            assert.equal(details.version, 3);
            assert.equal(details.serialNumber, reference.serialNumber);
            assert.equal(details.fingerprintSha1, reference.fingerprint.replaceAll(':', ''));
        }
        const verified = await utils.verifyCertificate(fixture.pem);
        assert.equal(verified.success, true, verified.error);
        assert.equal(verified.certDetails.publicKeyAlgorithm, type);
        assert.equal(verified.certDetails.keySize, bits);
        assert.equal(verified.certDetails.fingerprintSha1, reference.fingerprint);
        assert.equal(verified.certDetails.fingerprintSha256, reference.fingerprint256);
        assert.equal(utils.base64ToPem(fixture.pem), fixture.pem);
        assert.equal(utils.base64ToPrivateKeyPem(fixture.privateKeyPem), fixture.privateKeyPem);
    });

    test(`${type}: PKCS#8 and legacy private keys match; unrelated keys fail`, async () => {
        const other = await certificate('other.example', { type: type === 'RSA' ? 'RSA' : 'EC' });
        for (const key of [fixture.privateKeyPem, fixture.legacyKeyPem]) {
            assert.equal(utils.isValidPemPrivateKey(key), true);
            const matched = await utils.verifyCertificate(fixture.pem, key);
            assert.equal(matched.success, true, matched.keyValidation?.message || matched.error);
            assert.equal(matched.keyValidation.isValid, true);
            const mismatch = await utils.verifyCertificate(other.pem, key);
            assert.equal(mismatch.success, false);
            assert.equal(mismatch.keyValidation.isValid, false);
        }
    });
}

test('SEC1 with EC PARAMETERS and P-384/P-521 key pairs are supported', async () => {
    const parameters = toPem(new asn1js.ObjectIdentifier({ value: '1.2.840.10045.3.1.7' }).toBER(false), 'EC PARAMETERS');
    const key = parameters + ec.legacyKeyPem;
    assert.equal(utils.isValidPemPrivateKey(key), true);
    assert.equal((await utils.verifyCertificate(ec.pem, key)).success, true);
    for (const namedCurve of ['P-384', 'P-521']) {
        const fixture = await certificate(namedCurve, { type: 'EC', namedCurve });
        const result = await utils.verifyCertificate(fixture.pem, fixture.legacyKeyPem);
        assert.equal(result.success, true, result.keyValidation?.message);
        assert.equal(result.certDetails.keySize, Number(namedCurve.slice(2)));
    }
});

test('Malformed certificate/key and unsupported DSA keys fail without throwing', async () => {
    for (const input of ['', 'not PEM', toPem(new Uint8Array([1, 2, 3])), '-----BEGIN CERTIFICATE-----\n!\n-----END CERTIFICATE-----']) {
        assert.equal(utils.isValidPemCertificate(input), false);
        assert.ok((await utils.parseCertificate(input)).error);
        assert.equal((await utils.verifyCertificate(input)).success, false);
    }
    for (const type of ['PRIVATE KEY', 'RSA PRIVATE KEY', 'EC PRIVATE KEY', 'DSA PRIVATE KEY']) {
        const key = toPem(new Uint8Array([1, 2, 3]), type);
        assert.equal(utils.isValidPemPrivateKey(key), false);
        assert.equal((await utils.verifyCertificate(rsa.pem, key)).success, false);
    }
    assert.equal((await utils.verifyCertificate(rsa.pem, ec.privateKeyPem)).keyValidation.isValid, false);
});

test('Ordered RSA chain verifies; reversed chain and wrong issuer signatures fail', async () => {
    const chain = [leaf.pem, intermediate.pem, root.pem].join('\n');
    assert.equal(utils.isValidPemCertificate(chain), true);
    const result = await utils.verifyCertificate(chain);
    assert.equal(result.success, true, result.error);
    assert.equal(result.certificates.length, 3);
    assert.equal(result.chainDetails.length, 3);
    const parsed = await utils.parseCertificateChainFromPem(chain);
    assert.deepEqual(parsed.map(c => c.type), ['End-entity', 'Intermediate', 'Root CA']);
    assert.deepEqual(parsed.map(c => c.alias), ['leaf.example', 'Intermediate CA', 'Root CA']);
    assert.equal((await utils.verifyCertificate([root.pem, intermediate.pem, leaf.pem].join('\n'))).success, false);
    const wrongIssuer = await certificate('Intermediate CA', { ca: true, issuer: root });
    const badSignature = await utils.verifyCertificate([leaf.pem, wrongIssuer.pem, root.pem].join('\n'));
    assert.equal(badSignature.success, false);
    assert.ok(badSignature.chainValidation.errors.some(e => e.includes('signature verification failed')));
});

test('ECDSA certificate chain verifies with the issuer key', async () => {
    const issuer = await certificate('EC root', { ca: true, type: 'EC' });
    const child = await certificate('EC leaf', { issuer, type: 'EC' });
    const result = await utils.verifyCertificate(child.pem + issuer.pem);
    assert.equal(result.success, true, result.error);
});

test('SANs, key usages and certificate type survive the ASN.1 migration', async () => {
    const altNames = new pkijs.AltName({ altNames: [
        new pkijs.GeneralName({ type: 2, value: 'san.example' }),
        new pkijs.GeneralName({ type: 7, value: new asn1js.OctetString({ valueHex: new Uint8Array([127, 0, 0, 1]).buffer }) }),
        new pkijs.GeneralName({ type: 7, value: new asn1js.OctetString({ valueHex: new Uint8Array([0x20, 1, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]).buffer }) }),
        new pkijs.GeneralName({ type: 1, value: 'test@example.org' }),
        new pkijs.GeneralName({ type: 6, value: 'https://san.example' }),
        new pkijs.GeneralName({ type: 4, value: root.cert.subject })
    ] });
    const fixture = await certificate('extensions.example', { extensions: [
        new pkijs.Extension({ extnID: '2.5.29.17', extnValue: altNames.toSchema().toBER(false) }),
        new pkijs.Extension({ extnID: '2.5.29.15', critical: true, extnValue: new asn1js.BitString({ valueHex: new Uint8Array([0xa0]).buffer, unusedBits: 5 }).toBER(false) }),
        new pkijs.Extension({ extnID: '2.5.29.37', extnValue: new pkijs.ExtKeyUsage({ keyPurposes: ['1.3.6.1.5.5.7.3.1'] }).toSchema().toBER(false) })
    ] });
    const details = await utils.parseCertificate(fixture.pem);
    assert.equal(details.type, 'Server Certificate');
    assert.deepEqual(details.subjectAltNames, {
        dns: ['san.example'], ip: ['127.0.0.1', '2001:db8:0:0:0:0:0:1'],
        email: ['test@example.org'], uri: ['https://san.example'], dn: ['CN=Root CA']
    });
    assert.deepEqual(details.extensions.find(e => e.name === 'keyUsage').names, ['digitalSignature', 'keyEncipherment']);
    assert.equal(details.extensions.find(e => e.name === 'keyUsage').critical, true);
    const verified = await utils.verifyCertificate(fixture.pem);
    assert.equal(verified.certDetails.sans.length, 6);
});

test('Expired and not-yet-valid certificates retain their status', async () => {
    const expired = await certificate('expired.example', { notAfter: '2025-01-02' });
    const future = await certificate('future.example', { notBefore: '2098-01-01', notAfter: '2099-01-01' });
    assert.match((await utils.verifyCertificate(expired.pem)).certDetails.status, /Expired/);
    assert.match((await utils.verifyCertificate(future.pem)).certDetails.status, /Not yet valid/);
});

test('Web Crypto digest/import/sign/verify failures produce errors, never success', async () => {
    for (const method of ['digest', 'importKey', 'sign', 'verify']) {
        const original = crypto.subtle[method];
        try {
            crypto.subtle[method] = async () => { throw new Error(`test ${method} failure`); };
            const result = await utils.verifyCertificate(rsa.pem, rsa.privateKeyPem);
            assert.equal(result.success, false, method);
            if (method === 'digest') assert.ok((await utils.parseCertificate(rsa.pem)).error);
            else assert.equal(result.keyValidation.isValid, false, method);
        } finally {
            crypto.subtle[method] = original;
        }
    }
    assert.equal((await utils.verifyCertificate(rsa.pem, rsa.privateKeyPem)).success, true);
});
