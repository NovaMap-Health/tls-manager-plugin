import { createPrivateKey, webcrypto } from 'node:crypto';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';

export const toPem = (der, type = 'CERTIFICATE') =>
    `-----BEGIN ${type}-----\n${Buffer.from(der).toString('base64').match(/.{1,64}/g).join('\n')}\n-----END ${type}-----\n`;

export async function certificate(name, { type = 'RSA', namedCurve = 'P-256', issuer, ca = false, extensions = [], notBefore = '2025-01-01', notAfter = '2049-12-31' } = {}) {
    const algorithm = type === 'RSA'
        ? { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }
        : { name: 'ECDSA', namedCurve };
    const keys = await webcrypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);
    const cert = new pkijs.Certificate();
    cert.version = 2;
    cert.serialNumber = new asn1js.Integer({ value: 1 });
    cert.subject.typesAndValues.push(new pkijs.AttributeTypeAndValue({ type: '2.5.4.3', value: new asn1js.Utf8String({ value: name }) }));
    cert.issuer = issuer ? issuer.cert.subject : cert.subject;
    cert.notBefore.value = new Date(notBefore);
    cert.notAfter.value = new Date(notAfter);
    cert.notBefore.type = cert.notBefore.value.getUTCFullYear() >= 2050 ? 1 : 0;
    cert.notAfter.type = cert.notAfter.value.getUTCFullYear() >= 2050 ? 1 : 0;
    cert.extensions = [new pkijs.Extension({
        extnID: '2.5.29.19', critical: true,
        extnValue: new pkijs.BasicConstraints({ cA: ca }).toSchema().toBER(false)
    }), ...extensions];
    await cert.subjectPublicKeyInfo.importKey(keys.publicKey);
    await cert.sign(issuer ? issuer.keys.privateKey : keys.privateKey, 'SHA-256');
    const privateKeyPem = toPem(await webcrypto.subtle.exportKey('pkcs8', keys.privateKey), 'PRIVATE KEY');
    const legacyKeyPem = createPrivateKey(privateKeyPem).export({ format: 'pem', type: type === 'RSA' ? 'pkcs1' : 'sec1' });
    return { cert, keys, pem: toPem(cert.toSchema().toBER(false)), privateKeyPem, legacyKeyPem };
}
