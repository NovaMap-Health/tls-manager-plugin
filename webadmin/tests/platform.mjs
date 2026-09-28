// Controlled API boundary; the forms, dialogs, React roots and plugin are real.
import React from 'test:react';
import { asList } from 'test:host-api';

const fixture = window.fixture;
const storeFor = { systemCertificates: 'native', trustedCertificates: 'trusted', localCertificates: 'private' };
const wrapperFor = store => store === 'private' ? 'localCertificate' : 'trustedCertificate';
export const pendingRemote = [];
export const requests = [];

export const api = {
    asList,
    async get(path) {
        requests.push({ method: 'GET', path });
        if (path.startsWith('/tlsmanager/remoteCertificates?')) {
            return new Promise((resolve, reject) => pendingRemote.push({
                url: new URLSearchParams(path.split('?')[1]).get('url'), resolve, reject
            }));
        }
        const store = storeFor[path.split('/').pop()];
        if (store) {
            if (fixture.failStores.includes(store)) throw Object.assign(new Error(`${store} read failed`), { status: 500 });
            return { [wrapperFor(store)]: structuredClone(fixture.stores[store]) };
        }
        if (path === '/extensions/plugins') return { entry: [] };
        if (path === '/server/protocolsAndCipherSuites') return {
            entry: [
                { string: 'enabledServerProtocols', 'string-array': { string: ['TLSv1.3', 'TLSv1.2'] } },
                { string: 'enabledCipherSuites', 'string-array': { string: ['TLS_AES_128_GCM_SHA256'] } }
            ]
        };
        throw new Error(`Unexpected GET: ${path}`);
    },
    async put(path, body) {
        requests.push({ method: 'PUT', path, body: structuredClone(body) });
        if (fixture.failPut) throw new Error('write failed');
        const store = storeFor[path.split('/').pop()];
        fixture.stores[store] = structuredClone(body.list[wrapperFor(store)]);
        if (fixture.failRefreshAfterPut) fixture.failStores = [store];
    }
};

export const platform = {
    React, api,
    store: { getState: key => key === 'serverVersion' ? '4.5.2' : {} },
    connectorDefs: new Map(),
    registerConnectorPropertiesPanel(def) { this.tlsDef = def; },
    registerSettingsPanel(def) { this.settingsDef = def; },
    registerConnectorPanel(name, mode, def) { this.connectorDefs.set(name, def); },
    transmissionModes: () => []
};

window.testApi = {
    requests,
    remoteCount: () => pendingRemote.length,
    resolveRemote(index, alias) {
        const certificate = fixture.certificates[alias];
        pendingRemote[index].resolve({ trustedCertificate: [{ alias, certificate }] });
    },
    rejectRemote(index) { pendingRemote[index].reject(new Error('Remote fetch failed')); }
};

export default api;
