/*
 * SPDX-License-Identifier: MPL-2.0
 * Copyright (c) 2026 NovaMap Health Limited <https://novamap.health>
 *
 * TLS Manager certificate service — ported from the standalone web-ui SPA's
 * tlsService to the web administrator's @oie api (replacing axios + the dev
 * internal store). Endpoints live at /api/tlsmanager/* (the plugin servlet's
 * @Path). Each list is enriched by parsing the PEM client-side (jsrsasign) so
 * the UI can show subject/issuer/validity/fingerprint exactly like the SPA.
 *
 * The engine stores the WHOLE store as one list, so create/edit/delete fetch (or
 * reuse) the current list, mutate it, and PUT it back — matching the SPA.
 */
import api from '@oie/web-api';
import { parseCertificate, getSuggestedAlias } from './certificateUtils.js';

const EXT = '/tlsmanager';

// After @oie unwraps the single "list" root key the body is
// { trustedCertificate: [...] } / { localCertificate: [...] } (singletons bare).
function listOf(data, key) {
    let v = data;
    if (v && typeof v === 'object' && v.list) v = v.list;        // in case it's not unwrapped
    if (v && typeof v === 'object' && v[key] !== undefined) v = v[key];
    if (v === null || v === undefined || v === '') return [];
    return Array.isArray(v) ? v : [v];
}

function channelsOf(cert) {
    const s = cert && cert.channelsInUse && cert.channelsInUse.string;
    if (typeof s === 'string') return [s];
    return Array.isArray(s) ? s : [];
}

async function enrich(cert, store) {
    const parsed = await parseCertificate(cert.certificate);
    const base = {
        alias: String(cert.alias ?? ''),
        store,
        hasPrivateKey: store === 'private',
        channelsInUse: channelsOf(cert),
        rawCertificate: cert.certificate,
        rawPrivateKey: cert.key,
        parsedCertificate: parsed
    };
    if (parsed.error) {
        return { ...base, name: base.alias, type: 'Invalid', subject: `Parse Error: ${parsed.error}`, issuer: 'Unknown', validFrom: 'Unknown', validTo: 'Unknown', fingerprintSha1: 'Unknown' };
    }
    return {
        ...base,
        name: (parsed.subject && parsed.subject.CN) || base.alias,
        type: parsed.type || 'Unknown',
        subject: parsed.subjectStr || 'Unknown',
        issuer: parsed.issuerStr || 'Unknown',
        validFrom: parsed.validFrom,
        validTo: parsed.validTo,
        fingerprintSha1: parsed.fingerprintSha1
    };
}

async function fetchStore(path, key, store) {
    const data = await api.get(`${EXT}/${path}`);
    const out = [];
    for (const cert of listOf(data, key)) {
        if (!cert || !cert.certificate || !String(cert.certificate).trim()) continue;
        out.push(await enrich(cert, store));   // eslint-disable-line no-await-in-loop
    }
    return out;
}

export const fetchSystemCertificates = () => fetchStore('systemCertificates', 'trustedCertificate', 'native');
export const fetchTrustedCertificates = () => fetchStore('trustedCertificates', 'trustedCertificate', 'trusted');
export const fetchLocalCertificates = () => fetchStore('localCertificates', 'localCertificate', 'private');

export async function fetchRemoteCertificates(url) {
    if (!url || !String(url).startsWith('https://')) throw new Error('URL must be a valid HTTPS URL');
    const data = await api.get(`${EXT}/remoteCertificates?url=${encodeURIComponent(url)}`);
    const out = [];
    for (const cert of listOf(data, 'trustedCertificate')) {
        if (!cert || !cert.certificate || !String(cert.certificate).trim()) continue;
        const parsed = await parseCertificate(cert.certificate);   // eslint-disable-line no-await-in-loop
        out.push({
            alias: parsed.error ? '' : getSuggestedAlias(parsed),
            certificate: cert.certificate,
            name: parsed.error ? 'Invalid Certificate' : ((parsed.subject && parsed.subject.CN) || 'Unknown'),
            type: parsed.error ? 'Invalid' : (parsed.type || 'Unknown'),
            subject: parsed.subjectStr || 'Unknown',
            issuer: parsed.issuerStr || 'Unknown',
            validFrom: parsed.validFrom, validTo: parsed.validTo,
            fingerprintSha1: parsed.fingerprintSha1, parsedCertificate: parsed, error: parsed.error
        });
    }
    return out;
}

function putList(store, certs) {
    if (store === 'trusted') {
        return api.put(`${EXT}/trustedCertificates`, { list: { trustedCertificate: certs.map((c) => ({ alias: c.alias, certificate: c.rawCertificate })) } });
    }
    return api.put(`${EXT}/localCertificates`, { list: { localCertificate: certs.map((c) => ({ alias: c.alias, certificate: c.rawCertificate, key: c.rawPrivateKey })) } });
}

const currentFor = async (store, current) =>
    current ? current.slice() : (store === 'trusted' ? await fetchTrustedCertificates() : await fetchLocalCertificates());

export async function updateCertificates(store, { alias, pemText, privateKeyText }, current) {
    const certs = await currentFor(store, current);
    const i = certs.findIndex((c) => c.alias === alias);
    const entry = { alias, rawCertificate: pemText, ...(store === 'private' && privateKeyText ? { rawPrivateKey: privateKeyText } : {}) };
    if (i >= 0) certs[i] = { ...certs[i], ...entry }; else certs.push(entry);
    await putList(store, certs);
    return { success: true };
}

export async function updateCertificateAlias(store, oldAlias, newAlias, current) {
    const certs = await currentFor(store, current);
    const i = certs.findIndex((c) => c.alias === oldAlias);
    if (i < 0) throw new Error('Certificate not found');
    certs[i] = { ...certs[i], alias: newAlias };
    await putList(store, certs);
    return { success: true };
}

export async function removeCertificate(store, alias, current) {
    const certs = await currentFor(store, current);
    const i = certs.findIndex((c) => c.alias === alias);
    if (i < 0) throw new Error('Certificate not found');
    certs.splice(i, 1);
    await putList(store, certs);
    return { success: true };
}
