import React from 'test:react';
import { createRoot } from 'test:react-dom';
import { platform } from './platform.mjs';
import { register as registerTls } from '../web/plugin.js';
import { register as registerTcp } from 'test:tcp';

registerTls(platform);
registerTcp(platform);
const params = new URLSearchParams(location.search);
if (params.get('view') === 'manager') {
    const root = createRoot(document.querySelector('#manager'));
    root.render(React.createElement(platform.settingsDef.component));
    window.unmount = () => root.unmount();
} else {
    const transport = params.get('transport') || 'TCP Sender';
    const def = platform.connectorDefs.get(transport);
    const connector = { transportName: transport, properties: def.defaults('4.5.2') };
    connector.properties.serverMode = false;
    connector.properties.remoteAddress = 'localhost';
    connector.properties.remotePort = '443';
    const tls = platform.tlsDef.defaults('4.5.2');
    tls.isTlsManagerEnabled = true;
    if (params.has('unknown')) {
        tls.isUseServerDefaultProtocols = false;
        tls.usedProtocols = { string: ['TLSv1.1', 'TLSv1.2'] };
        tls.isUseServerDefaultCiphers = false;
        tls.usedCiphers = { string: ['OLD_CIPHER', 'TLS_AES_128_GCM_SHA256'] };
    }
    connector.properties.pluginProperties = { [platform.tlsDef.propertiesClass]: tls };
    const ctx = {
        connector, channel: { id: 'test-channel', name: 'Test channel' }, platform,
        properties: connector.properties, onChange: () => { window.dirtyCount++; },
        getEntry: () => connector.properties.pluginProperties[platform.tlsDef.propertiesClass],
        setEntry: value => { connector.properties.pluginProperties[platform.tlsDef.propertiesClass] = value; }
    };
    // Match the editor: independent TLS and transport roots in one tab panel.
    let tlsRoot;
    window.mountTls = () => {
        tlsRoot?.unmount();
        tlsRoot = createRoot(document.querySelector('#tls'));
        tlsRoot.render(React.createElement(platform.tlsDef.component, ctx));
    };
    window.dirtyCount = 0;
    window.connector = connector;
    window.tlsProperties = () => connector.properties.pluginProperties[platform.tlsDef.propertiesClass];
    window.mountTls();
    const tcpRoot = createRoot(document.querySelector('#tcp'));
    tcpRoot.render(React.createElement(def.component, ctx));
    window.unmount = () => { tlsRoot.unmount(); tcpRoot.unmount(); };
}
window.ready = true;
