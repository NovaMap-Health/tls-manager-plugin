/*
 * SPDX-License-Identifier: MPL-2.0
 * Copyright (c) 2026 NovaMap Health Limited <https://novamap.health>
 *
 * TLS Manager — web administrator plugin (React).
 *
 * Companion UI for the TLS Manager engine plugin. Registers:
 *
 *  1. A "TLS Settings" section on supported connectors (web equivalent of
 *     TLSConnectorPropertiesPlugin / TLSConnectorPanel). The Swing panel uses
 *     a single properties class for all six transports —
 *     org.openintegrationengine.tlsmanager.shared.properties.TLSConnectorProperties
 *     (TLSConnectorPanel.getDefaults() returns `new TLSConnectorProperties()`
 *     regardless of connector kind; TLSListenerProperties/TLSSenderProperties
 *     are unused legacy). The class has no @XStreamAlias, so its FQCN is the
 *     JSON key inside connector.properties.pluginProperties.
 *
 *  2. A "TLS Manager" tab in Settings (web equivalent of the Swing
 *     TLSSettingsPanelPlugin / TLSManagerSettingsPanel, a SettingsPanelPlugin).
 *     Like the Swing panel it is informational: a version header, a link to the
 *     plugin's own certificate-management web UI (served by the engine at
 *     <engineUrl>/tls-manager), and credits. Certificate management itself lives
 *     in that separate web UI, not embedded here — matching Swing. Registered via
 *     registerSettingsPanel, so it appears as a Settings tab, NOT a top-level nav
 *     item in the Plugins pane.
 *
 * Authored in JSX against the host's React (platform.React) so the plugin
 * component shares the app's single React instance. The data model (the field
 * SCHEMA array, the XStream Set<String>/cert-list helpers, defaults) is reused
 * VERBATIM from the original imperative plugin; only the rendering layer became
 * React/JSX. The connector panel now registers { ..., component } where
 * component({ getEntry, setEntry, connector, onChange }) returns
 * <ConnectorForm properties fields onChange/>; the settings panel registers
 * { label, order, component } where component({ platform }) returns JSX.
 *
 * The fieldDefs() `custom` fields still return DOM Nodes built with h()/textInput()
 * — ConnectorForm mounts those verbatim via its DomNode island, so the picker
 * field logic did not need to be ported.
 */
import { platform } from '@oie/web-shell';
const React = platform.React;

import { ConnectorForm, h, clear, textInput, asBool, YES_NO, modal, icon, toast, confirmDialog, promptDialog, checkbox, pickFile } from '@oie/web-ui';
import {
    fetchSystemCertificates, fetchTrustedCertificates, fetchLocalCertificates,
    fetchRemoteCertificates, updateCertificates, updateCertificateAlias, removeCertificate
} from './tlsService.js';
import { isValidPemCertificate, isValidPemPrivateKey, parseCertificateChainFromPem, base64ToPem, base64ToPrivateKeyPem, parseCertificate, getSuggestedAlias } from './certificateUtils.js';
import { verifyCertificate } from './verificationUtils.js';

const FQCN = 'org.openintegrationengine.tlsmanager.shared.properties.TLSConnectorProperties';
// The TLS Manager servlet uses @Path("/tlsmanager") — NOT the usual
// /extensions/<name> convention — so its endpoints live at /api/tlsmanager/...
// (confirmed against the plugin's own web-ui, which calls /api/tlsmanager/*).
const EXT = '/tlsmanager';

/* TLSConnectorPropertiesPlugin.isSupported(transportName) — exact list. */
const SUPPORTED_TRANSPORTS = [
    'HTTP Listener', 'TCP Listener', 'Web Service Listener',
    'HTTP Sender', 'TCP Sender', 'Web Service Sender'
];

/* Verified enum values (shared/models). */
const REVOCATION_MODES = [
    { value: 'DISABLED', label: 'Disabled' },
    { value: 'SOFT_FAIL', label: 'Soft Fail' },
    { value: 'HARD_FAIL', label: 'Hard Fail' }
];
const SUBJECT_DN_MODES = [
    { value: 'NONE', label: 'None' },
    { value: 'PARTIAL', label: 'Partial' },
    { value: 'EXACT', label: 'Exact' }
];
const CLIENT_AUTH_MODES = [
    { value: 'NONE', label: 'None' },
    { value: 'REQUESTED', label: 'Requested' },
    { value: 'REQUIRED', label: 'Required' }
];

/* Fallback protocol list when /server/protocolsAndCipherSuites is unreachable. */
const FALLBACK_PROTOCOLS = ['TLSv1.3', 'TLSv1.2', 'TLSv1.1', 'TLSv1'];

const api = platform.api;

/* ---- XStream Set<String> JSON helpers ------------------------------------
 * Engine JSON renders a set as { string: [...] } (bare object when it has
 * one element) and an empty/missing set as '' or null. Writes follow the
 * same convention used by core views (channel-editor code template libs). */
const setToList = (v) => api.asList(v, 'string').map(String).filter(s => s.length);
const listToSet = (list) => (list && list.length) ? { string: [...list] } : '';

/* List<TrustedCertificate>/List<LocalCertificate> arrive (after the api
 * client unwraps the root "list" key) as { trustedCertificate: [...] } or
 * { localCertificate: [...] } — singletons as a bare object. Used to populate
 * the keystore/truststore alias dropdowns in the connector TLS panel. */
function certList(value) {
    if (value === null || value === undefined || value === '') return [];
    if (typeof value === 'object' && !Array.isArray(value)) {
        for (const key of ['localCertificate', 'trustedCertificate']) {
            if (value[key] !== undefined) { value = value[key]; break; }
        }
    }
    if (value === null || value === undefined || value === '') return [];
    return (Array.isArray(value) ? value : [value]).filter(c => c && typeof c === 'object');
}

const notInstalled = (e) => e && (e.status === 404 || e.status === 501);

/* Map<String,String[]> from /server/protocolsAndCipherSuites:
 * { entry: [{ string: 'enabledServerProtocols', 'string-array': { string: [...] } }, ...] } */
function parseCryptoMap(value) {
    const out = {};
    for (const entry of api.asList(value && value.entry)) {
        if (!entry || typeof entry !== 'object') continue;
        const key = typeof entry.string === 'string' ? entry.string
            : Array.isArray(entry.string) ? entry.string[0] : null;
        if (!key) continue;
        for (const [k, v] of Object.entries(entry)) {
            if (k === 'string' || k.startsWith('@')) continue;
            const list = setToList(v && typeof v === 'object' ? v : { string: v });
            if (list.length) out[key] = list;
        }
    }
    return out;
}

function tlsDefaults(version) {
    /* Mirrors the TLSConnectorProperties() no-arg constructor field for
     * field (JSON keys are the exact Java field names — XStream maps
     * fields, not bean properties). */
    return {
        '@version': version,
        isTlsManagerEnabled: false,
        trustSystemTruststore: true,
        trustedServerCertificates: '',          // Collections.emptySet()
        crlMode: 'HARD_FAIL',
        ocspMode: 'HARD_FAIL',
        subjectDnValidationMode: 'NONE',
        subjectDnValidationFilter: null,
        isUseServerDefaultProtocols: true,
        usedProtocols: '',                      // Collections.emptySet()
        isUseServerDefaultCiphers: true,
        usedCiphers: '',                        // Collections.emptySet()
        serverCertificateAlias: null,           // server mode
        clientAuthMode: 'NONE',                 // server mode
        isHostnameVerificationEnabled: true,    // client mode
        clientCertificateAlias: null            // client mode
    };
}

/* attemptDetermineTransportAndDirectionality(): HTTP/WS Listener → server,
 * HTTP/WS Sender → client, TCP follows the connector's own Mode radio
 * (TcpReceiverProperties/TcpDispatcherProperties.serverMode). */
function isServerMode(connector) {
    const t = connector.transportName;
    if (t === 'HTTP Listener' || t === 'Web Service Listener') return true;
    if (t === 'HTTP Sender' || t === 'Web Service Sender') return false;
    return asBool(connector.properties && connector.properties.serverMode);
}

/* ---- modal pickers (web equivalents of the Swing Protocols/Ciphers/Server
 *      Certificate picker dialogs: a filterable list with Select All / Deselect
 *      All, a "[Server default]" pseudo-option for the protocol/cipher pickers,
 *      and an Unknown Options section that preserves selected values not in the
 *      known list). ------------------------------------------------------ */

const pickRow = (control, label) =>
    h('label.check', { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', cursor: 'pointer' } },
        control, h('span', label));

/* Multi-select picker (Protocols / Ciphers). `serverDefault` adds the
 * "[Server default]" row; checking it clears the individual selections (and vice
 * versa), matching Swing. onApply({ useServerDefault, selected }). */
function openMultiPicker({ title, options, selected, useServerDefault, onApply }) {
    const known = new Set(options);
    const sel = new Set(selected);
    const unknown = [...sel].filter((s) => !known.has(s));
    let useDefault = !!useServerDefault;

    const filterInput = textInput('', { placeholder: 'Filter…', style: { flex: '1' } });
    const listWrap = h('div', { style: { maxHeight: '320px', overflow: 'auto', border: '1px solid var(--line)', borderRadius: '4px', marginTop: '8px' } });
    const unknownWrap = h('div');

    const optBoxes = new Map();
    let defaultBox = null;

    function build() {
        clear(listWrap);
        clear(unknownWrap);
        const f = filterInput.value.trim().toLowerCase();
        defaultBox = h('input', { type: 'checkbox', checked: useDefault });
        defaultBox.addEventListener('change', () => {
            useDefault = defaultBox.checked;
            if (useDefault) { sel.clear(); optBoxes.forEach((b) => { b.checked = false; }); }
        });
        listWrap.appendChild(pickRow(defaultBox, '[Server default]'));
        optBoxes.clear();
        for (const [values, wrap] of [[options, listWrap], [unknown, unknownWrap]]) {
            for (const opt of values) {
                if (f && !opt.toLowerCase().includes(f)) continue;
                const box = h('input', { type: 'checkbox', checked: sel.has(opt) });
                box.addEventListener('change', () => {
                    if (box.checked) { sel.add(opt); useDefault = false; if (defaultBox) defaultBox.checked = false; }
                    else sel.delete(opt);
                });
                optBoxes.set(opt, box);
                wrap.appendChild(pickRow(box, opt));
            }
        }
    }
    build();
    filterInput.addEventListener('input', build);

    const link = (label, fn) => h('a', { href: '#', style: { color: 'var(--accent)' }, onClick: (e) => { e.preventDefault(); fn(); build(); } }, label);
    const selectAll = link('Select All', () => { [...options, ...unknown].forEach((o) => sel.add(o)); useDefault = false; });
    const deselectAll = link('Deselect All', () => { sel.clear(); });

    modal({
        title, size: 'wide',
        body: h('div', { style: { minWidth: '480px' } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
                h('label', 'Filter:'), filterInput, selectAll, h('span.text-text-faint', '|'), deselectAll),
            listWrap,
            unknown.length ? h('div', { style: { marginTop: '10px' } },
                h('div.text-text-faint', { style: { fontWeight: '600', marginBottom: '4px' } }, 'Unknown Options'),
                unknownWrap) : null),
        buttons: [
            { label: 'Cancel' },
            {
                label: 'OK', primary: true,
                onClick: () => onApply({ useServerDefault: useDefault, selected: [...sel] })
            }
        ]
    });
}

/* Single-select picker (Server / Client Certificate). Filterable radio list of
 * keystore aliases plus a "<None>" row. onApply(alias|null). */
function openCertPicker({ title, aliases, current, onApply }) {
    let chosen = current || '';
    const name = 'tlscertpick-' + Math.random().toString(36).slice(2);
    const filterInput = textInput('', { placeholder: 'Filter…', style: { flex: '1' } });
    const listWrap = h('div', { style: { maxHeight: '320px', overflow: 'auto', border: '1px solid var(--line)', borderRadius: '4px', marginTop: '8px' } });

    function build() {
        clear(listWrap);
        const f = filterInput.value.trim().toLowerCase();
        const noneBox = h('input', { type: 'radio', name, checked: !chosen });
        noneBox.addEventListener('change', () => { chosen = ''; });
        listWrap.appendChild(pickRow(noneBox, '<None>'));
        for (const a of aliases) {
            if (f && !a.toLowerCase().includes(f)) continue;
            const box = h('input', { type: 'radio', name, checked: chosen === a });
            box.addEventListener('change', () => { chosen = a; });
            listWrap.appendChild(pickRow(box, a));
        }
    }
    build();
    filterInput.addEventListener('input', build);

    modal({
        title, size: 'wide',
        body: h('div', { style: { minWidth: '420px' } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, h('label', 'Filter:'), filterInput),
            listWrap),
        buttons: [
            { label: 'Cancel' },
            { label: 'OK', primary: true, onClick: () => onApply(chosen || null) }
        ]
    });
}

/* Trusted-certificate picker (Swing "Certificate Picker"). A filterable checkbox
 * list whose first row, "[JVM Truststore]", maps to the boolean
 * trustSystemTruststore flag; the remaining rows are truststore aliases. Unlike
 * the protocol/cipher picker the truststore row is independent of the aliases
 * (you can trust both). Already-saved aliases not in the known list still appear
 * as checked rows; when the engine plugin is absent, an "Add alias" field lets
 * you enter them by hand. onApply({ trustSystemTruststore, selected }). */
const JVM_TRUSTSTORE = '[JVM Truststore]';
function openTrustPicker({ title, aliases, extMissing, trustSystemTruststore, selected, onApply }) {
    const sel = new Set(selected);
    let trustSystem = !!trustSystemTruststore;
    const rowAliases = () => [...new Set([...aliases, ...sel])];

    const filterInput = textInput('', { placeholder: 'Filter…', style: { flex: '1' } });
    const listWrap = h('div', { style: { maxHeight: '320px', overflow: 'auto', border: '1px solid var(--line)', borderRadius: '4px', marginTop: '8px' } });

    function build() {
        clear(listWrap);
        const f = filterInput.value.trim().toLowerCase();
        if (!f || JVM_TRUSTSTORE.toLowerCase().includes(f)) {
            const sysBox = h('input', { type: 'checkbox', checked: trustSystem });
            sysBox.addEventListener('change', () => { trustSystem = sysBox.checked; });
            listWrap.appendChild(pickRow(sysBox, JVM_TRUSTSTORE));
        }
        for (const a of rowAliases()) {
            if (f && !a.toLowerCase().includes(f)) continue;
            const box = h('input', { type: 'checkbox', checked: sel.has(a) });
            box.addEventListener('change', () => { if (box.checked) sel.add(a); else sel.delete(a); });
            listWrap.appendChild(pickRow(box, a));
        }
    }
    build();
    filterInput.addEventListener('input', build);

    const link = (label, fn) => h('a', { href: '#', style: { color: 'var(--accent)' }, onClick: (e) => { e.preventDefault(); fn(); build(); } }, label);
    const selectAll = link('Select All', () => { rowAliases().forEach((a) => sel.add(a)); trustSystem = true; });
    const deselectAll = link('Deselect All', () => { sel.clear(); trustSystem = false; });

    /* Manual entry when the engine plugin can't enumerate the truststore. */
    let addRow = null;
    if (extMissing) {
        const addInput = textInput('', { placeholder: 'Certificate alias', style: { flex: '1' } });
        const add = () => {
            const v = addInput.value.trim();
            if (v) { sel.add(v); addInput.value = ''; build(); }
        };
        const addBtn = h('button.btn', { type: 'button' }, 'Add');
        addBtn.addEventListener('click', add);
        addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
        addRow = h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' } },
            h('label', 'Add alias:'), addInput, addBtn);
    }

    modal({
        title, size: 'wide',
        body: h('div', { style: { minWidth: '480px' } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
                h('label', 'Filter:'), filterInput, selectAll, h('span.text-text-faint', '|'), deselectAll),
            listWrap,
            addRow),
        buttons: [
            { label: 'Cancel' },
            { label: 'OK', primary: true, onClick: () => onApply({ trustSystemTruststore: trustSystem, selected: [...sel] }) }
        ]
    });
}

/* ====================================================================== *
 *  1. "TLS Settings" connector properties panel component
 * ====================================================================== *
 * ctx (props): { getEntry, setEntry, connector, onChange } (+ propertiesClass /
 * channel / platform, unused here). Binds the form to the live entry when present;
 * otherwise to a defaults draft that becomes the entry on first edit (viewing the
 * panel alone must not dirty the channel). The Swing client always serializes the
 * entry — isTlsManagerEnabled=false is the "off" state, so the toggle never
 * removes it. */
function TlsConnectorPanel({ getEntry, setEntry, connector, onChange }) {
    const version = String(platform.store.getState('serverVersion') || '');
    const formRef = React.useRef(null);
    const [server, setServer] = React.useState(() => isServerMode(connector));

    // The host mounts TLS and transport settings in separate React roots. A
    // TCP Mode edit therefore does not rerender this component. Observe the
    // mode control within their shared tab and read the model after its handler.
    React.useEffect(() => {
        if (!connector.transportName.startsWith('TCP') || !formRef.current) return;
        const eventRoot = formRef.current.closest('[role="tabpanel"]') || formRef.current.ownerDocument;
        let active = true;
        const syncMode = (event) => {
            if (!event.target.closest?.('[data-fkey="serverMode"]')) return;
            queueMicrotask(() => { if (active) setServer(isServerMode(connector)); });
        };
        eventRoot.addEventListener('change', syncMode);
        return () => { active = false; eventRoot.removeEventListener('change', syncMode); };
    }, [connector]);

    // The properties object the form mutates: the live entry, or a defaults draft
    // promoted to the entry on the first edit. Held in a ref so it is stable
    // across the async option-load re-render.
    const propsRef = React.useRef(null);
    if (propsRef.current === null) propsRef.current = getEntry() || tlsDefaults(version);
    const props = propsRef.current;

    const commit = () => {
        if (getEntry() !== props) setEntry(props);
        onChange();
    };

    /* Option sources: keystore/truststore aliases from the plugin servlet,
     * protocols/ciphers from the core engine endpoint the Swing panel uses
     * (mirthClient.getProtocolsAndCipherSuites()). Loaded once, asynchronously;
     * the state bump repaints the form (and thus rebuilds fieldDefs() with the
     * resolved option lists). */
    const [data, setData] = React.useState({
        localAliases: null, trustedAliases: null, protocols: null, ciphers: null, extMissing: false
    });

    React.useEffect(() => {
        let cancelled = false;
        Promise.allSettled([
            api.get(`${EXT}/localCertificates`),
            api.get(`${EXT}/trustedCertificates`),
            api.get('/server/protocolsAndCipherSuites')
        ]).then(([local, trusted, crypto]) => {
            if (cancelled) return;
            const next = { localAliases: null, trustedAliases: null, protocols: null, ciphers: null, extMissing: false };
            if (local.status === 'fulfilled') {
                next.localAliases = certList(local.value).map(c => String(c.alias ?? '')).filter(Boolean);
            } else if (notInstalled(local.reason)) {
                next.extMissing = true;
            }
            if (trusted.status === 'fulfilled') {
                next.trustedAliases = certList(trusted.value).map(c => String(c.alias ?? '')).filter(Boolean);
            }
            if (crypto.status === 'fulfilled') {
                const map = parseCryptoMap(crypto.value);
                /* Same keys the Swing panel reads (MirthSSLUtil). */
                next.protocols = map.enabledServerProtocols || map.supportedProtocols || null;
                next.ciphers = map.enabledCipherSuites || map.supportedCipherSuites || null;
            }
            setData(next);
        });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const aliasHint = () => data.extMissing
        ? 'TLS Manager engine plugin not detected — enter the alias manually'
        : undefined;

    const enabled = (p) => asBool(p.isTlsManagerEnabled);

    /* Protocols / Ciphers: a wrench-style button that opens the modal picker,
       plus a summary of the current selection (Swing Protocols/Ciphers Picker). */
    function pickerMultiField(usedKey, defaultKey, label, getOptions, dialogTitle) {
        return {
            label, type: 'custom', visible: enabled,
            render: (p, { onChange }) => {
                const summary = h('span', { style: { marginLeft: '8px', fontSize: '13px' } });
                const repaint = () => {
                    const useDefault = asBool(p[defaultKey]);
                    const list = setToList(p[usedKey]);
                    summary.textContent = useDefault
                        ? (list.length ? `Server default (+${list.length} saved)` : 'Server default')
                        : (list.length ? `${list.length} selected` : 'None selected');
                };
                const btn = h('button.btn', { type: 'button', style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } }, icon('settings'), 'Edit…');
                btn.addEventListener('click', () => openMultiPicker({
                    title: dialogTitle,
                    options: getOptions() || [],
                    selected: setToList(p[usedKey]),
                    useServerDefault: asBool(p[defaultKey]),
                    onApply: ({ useServerDefault, selected }) => {
                        p[defaultKey] = useServerDefault;
                        p[usedKey] = listToSet(selected);
                        onChange();
                        repaint();
                    }
                }));
                repaint();
                return h('div', { style: { display: 'flex', alignItems: 'center' } }, btn, summary);
            }
        };
    }

    /* Server / Client certificate: a button opening the single-select cert picker,
       with the chosen alias shown alongside. Falls back to manual entry when the
       plugin's keystore endpoint is unavailable. */
    function certPickerField(key, label, hint) {
        if (!(data.localAliases && data.localAliases.length)) {
            // A keyed React input survives ConnectorForm's change repaint;
            // recreating a custom DOM input here drops focus on each keystroke.
            return {
                key, label, type: 'text', width: '260px', visible: enabled,
                onSet: (p, value) => { p[key] = value.trim() || null; },
                append: () => h('div.hint', aliasHint() || hint || '')
            };
        }
        return {
            label, type: 'custom', visible: enabled,
            render: (p, { onChange }) => {
                const summary = h('span', { style: { marginLeft: '8px', fontSize: '13px' } });
                const repaint = () => { summary.textContent = p[key] ? String(p[key]) : '<None>'; };
                const btn = h('button.btn', { type: 'button', style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } }, icon('settings'), 'Select…');
                btn.addEventListener('click', () => openCertPicker({
                    title: `${label} Picker`,
                    aliases: data.localAliases || [],
                    current: p[key] || '',
                    onApply: (alias) => { p[key] = alias; onChange(); repaint(); }
                }));
                repaint();
                return h('div', { style: { display: 'flex', alignItems: 'center' } }, btn, summary,
                    hint ? h('span.hint', { style: { marginLeft: '10px' } }, hint) : null);
            }
        };
    }

    function fieldDefs() {
        /* Trusted Server Certificates: a button + summary that opens the Certificate
           Picker modal (Swing parity), folding the System Truststore flag and the
           trusted aliases into one filterable checkbox list. */
        const trustPickerField = (visible, label) => ({
            label, type: 'custom', visible,
            render: (p, { onChange }) => {
                const summary = h('span', { style: { marginLeft: '8px', fontSize: '13px' } });
                const repaint = () => {
                    const certs = setToList(p.trustedServerCertificates);
                    const parts = [];
                    if (asBool(p.trustSystemTruststore)) parts.push('System Truststore');
                    if (certs.length) parts.push(`${certs.length} certificate${certs.length === 1 ? '' : 's'}`);
                    summary.textContent = parts.length ? parts.join(' + ') : 'None';
                };
                const btn = h('button.btn', { type: 'button', style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } }, icon('settings'), 'Edit…');
                btn.addEventListener('click', () => openTrustPicker({
                    title: 'Certificate Picker',
                    aliases: data.trustedAliases || [],
                    extMissing: data.extMissing,
                    trustSystemTruststore: asBool(p.trustSystemTruststore),
                    selected: setToList(p.trustedServerCertificates),
                    onApply: ({ trustSystemTruststore, selected }) => {
                        p.trustSystemTruststore = trustSystemTruststore;
                        p.trustedServerCertificates = listToSet(selected);
                        onChange();
                        repaint();
                    }
                }));
                repaint();
                const hint = data.extMissing
                    ? h('div.hint', { style: { marginTop: '4px' } }, 'TLS Manager engine plugin not detected — add truststore aliases in the picker')
                    : null;
                return h('div', h('div', { style: { display: 'flex', alignItems: 'center' } }, btn, summary), hint);
            }
        });

        return [
            {
                key: 'isTlsManagerEnabled', label: 'Use TLS Manager', type: 'radio',
                options: YES_NO, refresh: true,
                hint: connector.transportName.startsWith('TCP')
                    ? `Settings follow the connector's Mode (currently ${server ? 'Server' : 'Client'})`
                    : undefined
            },

            { section: 'Certificate Validation', visible: enabled },
            {
                key: 'subjectDnValidationMode', label: 'Subject DN Validation', type: 'select',
                options: SUBJECT_DN_MODES, refresh: true, visible: enabled
            },
            {
                key: 'subjectDnValidationFilter', label: 'Subject DN Filter', width: '320px',
                visible: (p) => enabled(p) && p.subjectDnValidationMode !== 'NONE',
                hint: 'Required when Subject DN validation is Partial or Exact'
            },
            { key: 'crlMode', label: 'CRL Checking', type: 'select', options: REVOCATION_MODES, visible: enabled },
            { key: 'ocspMode', label: 'OCSP Checking', type: 'select', options: REVOCATION_MODES, visible: enabled },

            { section: 'Protocols & Ciphers', visible: enabled },
            pickerMultiField('usedProtocols', 'isUseServerDefaultProtocols', 'Enabled Protocols',
                () => data.protocols || FALLBACK_PROTOCOLS, 'Protocols Picker'),
            pickerMultiField('usedCiphers', 'isUseServerDefaultCiphers', 'Enabled Ciphers',
                () => data.ciphers || [], 'Ciphers Picker'),

            /* client mode (sender side) */
            ...(server ? [] : [
                { section: 'Server Trust', visible: enabled },
                trustPickerField(enabled, 'Trusted Server Certificates'),
                {
                    key: 'isHostnameVerificationEnabled', label: 'Hostname Verification',
                    type: 'radio', options: YES_NO, visible: enabled
                },
                certPickerField('clientCertificateAlias', 'Client Certificate',
                    'Presented when the server requests client authentication')
            ]),

            /* server mode (listener side) */
            ...(server ? [
                { section: 'Server Identity', visible: enabled },
                certPickerField('serverCertificateAlias', 'Server Certificate',
                    'Certificate presented to connecting clients (required)'),
                {
                    key: 'clientAuthMode', label: 'Client Authentication', type: 'radio',
                    options: CLIENT_AUTH_MODES, refresh: true, visible: enabled
                },
                trustPickerField((p) => enabled(p) && p.clientAuthMode !== 'NONE', 'Trusted Client Certificates')
            ] : [])
        ];
    }

    return <div ref={formRef}><ConnectorForm properties={props} fields={fieldDefs()} onChange={commit} /></div>;
}

const tlsPanel = {
    id: 'tls-manager',
    title: 'TLS Settings',                      // getSettingsTitle()
    order: 50,
    propertiesClass: FQCN,                      // one class for all six transports (see header)
    isSupported: (transportName) => SUPPORTED_TRANSPORTS.includes(transportName),
    defaults: (version) => tlsDefaults(version),
    component: TlsConnectorPanel
};

/* ====================================================================== *
 *  2. "TLS Manager" settings tab (informational — matches the Swing
 *     TLSManagerSettingsPanel, a SettingsPanelPlugin)
 * ====================================================================== *
 * The TLS Manager's certificate management runs in the plugin's own web UI,
 * served by the engine at <engineUrl>/tls-manager — the Swing
 * TLSManagerSettingsPanel links to exactly that. This tab mirrors that panel:
 * a version header, the link, and credits. (The connector "TLS Settings"
 * section above is the part that plugs into HTTP/TCP/Web Service connectors.)
 *
 * ctx (props): { platform, setTasks } — informational, so it declares no tasks. */
/* valid / expiring / expired / not-yet / invalid from the parsed validity dates. */
function certStatus(cert) {
    if (!cert || (cert.parsedCertificate && cert.parsedCertificate.error)) return { label: 'Invalid', pip: 'err' };
    const now = Date.now();
    const to = cert.validTo && cert.validTo !== 'Unknown' ? Date.parse(cert.validTo) : NaN;
    const from = cert.validFrom && cert.validFrom !== 'Unknown' ? Date.parse(cert.validFrom) : NaN;
    if (!Number.isNaN(from) && from > now) return { label: 'Not Yet Valid', pip: 'warn' };
    if (!Number.isNaN(to) && to < now) return { label: 'Expired', pip: 'err' };
    if (!Number.isNaN(to) && to - now < 30 * 24 * 3600 * 1000) return { label: 'Expiring Soon', pip: 'warn' };
    return { label: 'Valid', pip: 'ok' };
}

const STORE_TABS = [
    { key: 'native', label: 'Native Java Store', readonly: true },
    { key: 'trusted', label: 'Trusted Certificates', readonly: false },
    { key: 'private', label: 'Local Key Pairs', readonly: false }
];

/* Per-store certificate table (React). Action buttons use text rather than the
 * DOM icon() helper so they compose as React children. */
function certTableEl(certs, store, act) {
    if (!certs.length) return <div className="dt-empty" style={{ padding: '24px' }}>No certificates in this store.</div>;
    return (
        <table className="dt">
            <thead><tr>
                <th style={{ width: '130px' }}>Status</th>
                <th>Alias</th>
                <th>Subject</th>
                <th style={{ width: '150px' }}>Type</th>
                <th style={{ width: '110px' }}>Expires</th>
                <th style={{ width: '60px' }}>In Use</th>
                <th style={{ width: '1px' }} />
            </tr></thead>
            <tbody>{certs.map((c) => {
                const s = certStatus(c);
                return (
                    <tr key={c.store + ':' + c.alias}>
                        <td><span className="status-cell"><span className={'pip ' + s.pip} /> {s.label}</span></td>
                        <td>{c.alias}</td>
                        <td title={c.subject} style={{ maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</td>
                        <td>{c.type}</td>
                        <td className="num">{c.validTo}</td>
                        <td className="num">{(c.channelsInUse || []).length || ''}</td>
                        <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                            <button type="button" className="btn btn-sm" onClick={() => act.openDetails(c)}>Details</button>
                            {store !== 'native' && <button type="button" className="btn btn-sm" disabled={!act.canWrite} onClick={() => act.editAlias(c)}>Edit</button>}
                            {store !== 'native' && <button type="button" className="btn btn-sm btn-danger" disabled={!act.canWrite} onClick={() => act.removeCert(c)}>Delete</button>}
                        </td>
                    </tr>
                );
            })}</tbody>
        </table>
    );
}

/* The keystore REST API returns certificates/keys as bare base64 (DER), but the
 * jsrsasign verify/parse path needs PEM (verifyCertificate rejects anything
 * without -----BEGIN-----). Wrap bare base64 in PEM headers, pass real PEM
 * through unchanged — mirrors the SPA's base64ToPem() before verification. */
const toCertPem = (v) => (v && /-----BEGIN/.test(v)) ? v : (v ? base64ToPem(v) : v);
const toKeyPem = (v) => (v && /-----BEGIN/.test(v)) ? v : (v ? base64ToPrivateKeyPem(v) : v);

/* Small inline pill used for SAN values and extension flags (details dialog). */
function chip(text, opts) {
    return h('span', {
        style: Object.assign({
            display: 'inline-block', padding: '1px 9px', margin: '2px',
            fontSize: '12px', border: '1px solid var(--line)', borderRadius: '11px',
            background: 'var(--bg2)', wordBreak: 'break-all'
        }, opts && opts.style)
    }, text);
}

/* Grouped Subject Alternative Name chips (DNS / IP / URI / Email / DN), matching
 * the SPA CertificateDetailsDialog. Returns null when there are no SANs. */
function sanChipsNode(san) {
    if (!san) return null;
    const groups = [
        ['DNS Names', san.dns], ['IP Addresses', san.ip], ['URIs', san.uri],
        ['Email Addresses', san.email], ['Distinguished Names', san.dn]
    ].filter(([, list]) => Array.isArray(list) && list.length);
    if (!groups.length) return null;
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        groups.map(([label, list]) => h('div',
            h('div.text-text-faint', { style: { fontSize: '11px', marginBottom: '2px' } }, label),
            h('div', list.map((v) => chip(v))))));
}

/* Extensions accordion: each entry shows its name, a "Critical" chip when set,
 * and the joined names/value (KeyUsage, basicConstraints, etc.). */
function extensionsNode(extensions) {
    if (!Array.isArray(extensions) || !extensions.length) return null;
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        extensions.map((ext) => h('div',
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                h('strong', { style: { fontSize: '13px' } }, ext.name || 'Extension'),
                ext.critical ? chip('Critical', { style: { borderColor: 'var(--warn)', color: 'var(--warn)' } }) : null),
            (ext.names && ext.names.length)
                ? h('div.text-text-faint', { style: { fontSize: '12px', marginLeft: '4px', wordBreak: 'break-all' } }, ext.names.join(', '))
                : null)));
}

/* Filled status circle (green check / red ✕) as inline SVG. Uses currentColor so
 * the wrapping span's color drives it — CSS vars can't be referenced directly in
 * SVG presentation attributes. */
function statusIcon(ok, size) {
    size = size || 18;
    const span = document.createElement('span');
    span.style.cssText = `display:inline-flex;flex:0 0 auto;color:${ok ? 'var(--ok)' : 'var(--err)'}`;
    span.innerHTML = ok
        ? `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="display:block"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M7.2 12.4l3 3 6.4-6.8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        : `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="display:block"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M8.3 8.3l7.4 7.4M15.7 8.3l-7.4 7.4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>`;
    return span;
}

/* Collapse chevron (points down; rotated 180° when its section is open). */
function chevronIcon(open) {
    const span = document.createElement('span');
    span.style.cssText = `display:inline-flex;flex:0 0 auto;color:var(--text-faint);transition:transform .15s;transform:${open ? 'rotate(180deg)' : 'none'}`;
    span.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" style="display:block"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return span;
}

/* A tinted callout box (success / error / warn) — light background + matching
 * border and text, like the SPA's MUI Alert. `tone` is an --ok/--warn/--err var. */
function tintBox(tone, children, extra) {
    return h('div', {
        style: Object.assign({
            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '6px',
            background: `color-mix(in srgb, var(--${tone}) 12%, transparent)`,
            border: `1px solid color-mix(in srgb, var(--${tone}) 35%, transparent)`,
            color: `color-mix(in srgb, var(--${tone}) 70%, var(--text))`
        }, extra)
    }, children);
}

/* Selectable certificate row for the import-from-URL / chain dialogs: a bordered,
 * clickable card with a radio, a bold name, a text-text-faint secondary line, and an
 * optional type badge — highlighted when selected. Returns { el, radio, paint }. */
function optionRow({ name, checked, primary, secondary, badge, onSelect }) {
    const radio = h('input', { type: 'radio', name, checked, style: { accentColor: 'var(--accent)', flex: '0 0 auto' } });
    const row = h('label', {
        style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', cursor: 'pointer', border: '1px solid var(--line)', borderRadius: '6px' }
    }, radio,
        h('div', { style: { flex: '1', minWidth: '0' } },
            h('div', { style: { fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, primary || '—'),
            secondary ? h('div.text-text-faint', { style: { fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, secondary) : null),
        badge ? chip(badge, { style: { borderColor: 'color-mix(in srgb, var(--accent) 40%, transparent)', color: 'var(--accent)' } }) : null);
    const paint = () => {
        row.style.borderColor = radio.checked ? 'var(--accent)' : 'var(--line)';
        row.style.background = radio.checked ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent';
    };
    radio.addEventListener('change', () => { if (radio.checked) onSelect && onSelect(); paint(); });
    paint();
    return { el: row, radio, paint };
}

/* Render a verifyCertificate() result into `container` (cleared first), matching
 * the SPA's CertificateVerificationSection: a tinted pass/fail banner, then
 * bordered, collapsible cards for chain validation (errors / warnings / details),
 * private-key validation, and the per-certificate chain breakdown. */
function renderVerification(container, res) {
    clear(container);
    if (!res) return;

    if (!res.success) {
        container.appendChild(tintBox('err', [statusIcon(false, 18), h('span', { style: { fontWeight: '500' } }, res.error || 'Certificate verification failed')]));
        return;
    }
    container.appendChild(tintBox('ok', [statusIcon(true, 18), h('span', { style: { fontWeight: '500' } }, 'Certificate verification completed successfully')], { marginBottom: '10px' }));

    // ok === null → neutral header (no status icon), used for the chain breakdown.
    const card = (ok, titleText, bodyNode, openByDefault) => {
        const hasIcon = ok !== null;
        const body = h('div', { style: { padding: hasIcon ? '0 14px 12px 46px' : '0 14px 12px 14px', display: openByDefault ? 'block' : 'none' } }, bodyNode);
        const caret = chevronIcon(openByDefault);
        const head = h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '11px 14px' } },
            hasIcon ? statusIcon(ok, 20) : null,
            h('span', { style: { fontWeight: '600', fontSize: '14px', flex: '1' } }, titleText),
            caret);
        head.addEventListener('click', () => {
            const show = body.style.display === 'none';
            body.style.display = show ? 'block' : 'none';
            caret.style.transform = show ? 'rotate(180deg)' : 'none';
        });
        return h('div', { style: { border: '1px solid var(--line)', borderRadius: '8px', marginTop: '10px', overflow: 'hidden' } }, head, body);
    };
    const group = (label, items, tone) => h('div', { style: { marginBottom: '8px' } },
        h('div', { style: { fontWeight: '600', fontSize: '12px', marginBottom: '3px', color: tone ? `var(--${tone})` : 'var(--text-dim)' } }, label),
        h('ul', { style: { margin: '0', paddingLeft: '18px', fontSize: '13px', lineHeight: '1.55' } }, items.map((m) => h('li', m))));

    const cv = res.chainValidation;
    if (cv) {
        const parts = [];
        if (cv.errors && cv.errors.length) parts.push(group('Errors', cv.errors, 'err'));
        if (cv.warnings && cv.warnings.length) parts.push(group('Warnings', cv.warnings, 'warn'));
        if (cv.details && cv.details.length) parts.push(group('Details', cv.details));
        container.appendChild(card(cv.isValid, 'Chain Validation ' + (cv.isValid ? 'Passed' : 'Failed'),
            parts.length ? parts : h('div.text-text-faint', { style: { fontSize: '13px' } }, 'No issues found.'), true));
    }

    const kv = res.keyValidation;
    if (kv) {
        container.appendChild(card(kv.isValid, 'Private Key Validation ' + (kv.isValid ? 'Passed' : 'Failed'),
            tintBox(kv.isValid ? 'ok' : 'err', [statusIcon(kv.isValid, 16), h('span', kv.message || '')]), true));
    }

    if (res.chainDetails && res.chainDetails.length > 1) {
        const rows = res.chainDetails.map((c, i) => h('div', { style: { padding: '6px 0', fontSize: '13px', borderTop: i ? '1px solid var(--line)' : 'none' } },
            h('div', { style: { fontWeight: '600' } }, `${c.type} (Certificate #${c.index})`),
            h('div.text-text-faint', `Subject: ${c.subject}`),
            h('div.text-text-faint', `Issuer: ${c.issuer}`),
            h('div.text-text-faint', `Valid: ${c.validFrom} – ${c.validTo}`)));
        container.appendChild(card(null, `Certificate Chain (${res.chainDetails.length} certificates)`, rows, false));
    }
}

/* ====================================================================== *
 *  2. "TLS Manager" settings tab — the certificate/keystore manager.
 *     A native port of the plugin's standalone web UI (web-ui/ SPA): the
 *     Native (read-only) / Trusted / Local Key Pairs stores, with import
 *     (file + URL), edit-alias, delete, a details dialog, and client-side
 *     X.509 parsing (jsrsasign, bundled). Each change PUTs the whole store
 *     back to /api/tlsmanager/* and reloads, matching the SPA.
 * ====================================================================== */
function TlsManagerPanel() {
    const cfg = platform.store.getState('webadminConfig') || {};
    const engineUrl = String(cfg.engineUrl || '').replace(/\/+$/, '');
    const [version, setVersion] = React.useState('');
    const [tab, setTab] = React.useState('trusted');
    const [phase, setPhase] = React.useState('loading');   // loading | ready | missing
    const [, force] = React.useReducer((x) => x + 1, 0);
    const storesRef = React.useRef({ native: [], trusted: [], private: [] });
    const storeStateRef = React.useRef(Object.fromEntries(STORE_TABS.map(({ key }) => [key, { status: 'loading', error: '' }])));
    const mountedRef = React.useRef(false);
    const loadRequestRef = React.useRef(0);
    const writePendingRef = React.useRef(false);

    async function loadAll() {
        if (!mountedRef.current || writePendingRef.current) return;
        const request = ++loadRequestRef.current;
        for (const { key } of STORE_TABS) storeStateRef.current[key] = { status: 'loading', error: '' };
        setPhase('loading');
        const results = await Promise.allSettled([fetchSystemCertificates(), fetchTrustedCertificates(), fetchLocalCertificates()]);
        if (!mountedRef.current || request !== loadRequestRef.current) return;
        STORE_TABS.forEach(({ key, label }, index) => {
            const result = results[index];
            if (result.status === 'fulfilled') {
                storesRef.current[key] = result.value;
                storeStateRef.current[key] = { status: 'ready', error: '' };
            } else {
                // A failed read is never an empty store. Keep any previously read
                // rows for inspection, but prohibit whole-store writes until reload.
                storeStateRef.current[key] = {
                    status: 'error',
                    error: `Unable to load ${label}. ${result.reason?.message || 'The request failed.'} Refresh successfully before making changes.`
                };
            }
        });
        const missing = results.every((r) => r.status === 'rejected' && r.reason && (r.reason.status === 404 || r.reason.status === 501));
        setPhase(missing ? 'missing' : 'ready');
        force();
    }
    const refresh = () => loadAll();

    React.useEffect(() => {
        mountedRef.current = true;
        loadAll();
        let active = true;
        api.get('/extensions/plugins').then((raw) => {
            if (!active) return;
            for (const e of api.asList(raw && raw.entry)) {
                if (!e || typeof e !== 'object') continue;
                const name = Array.isArray(e.string) ? e.string[0] : e.string;
                const meta = e.pluginMetaData || Object.values(e).find((v) => v && typeof v === 'object' && v.pluginVersion);
                if (String(name) === 'TLS Manager' && meta && meta.pluginVersion) { setVersion(String(meta.pluginVersion)); return; }
            }
        }).catch(() => { /* leave un-versioned */ });
        return () => {
            active = false;
            mountedRef.current = false;
            ++loadRequestRef.current;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // State objects are revision tokens: a refresh, failed read, or write replaces
    // them. A dialog cannot apply an approval obtained for an older store state.
    function writableStore(store, expected) {
        const state = storeStateRef.current[store];
        if (mountedRef.current && !writePendingRef.current && state?.status === 'ready' && (!expected || expected === state)) return state;
        if (mountedRef.current) toast('The certificate store changed or is unavailable. Refresh and try again.', 'warn');
        return null;
    }

    async function writeStore(store, expected, operation, successMessage, failureMessage) {
        if (!writableStore(store, expected)) return false;
        writePendingRef.current = true;
        storeStateRef.current[store] = { status: 'saving', error: '' };
        force();
        let succeeded = false;
        try {
            await operation(storesRef.current[store]);
            succeeded = true;
            if (mountedRef.current) toast(successMessage, 'success');
        } catch (e) {
            // A rejected response can also represent an uncertain server commit.
            // Require a fresh read before another whole-store mutation or retry.
            storeStateRef.current[store] = { status: 'error', error: 'The save could not be confirmed. Refresh successfully before making changes.' };
            if (mountedRef.current) toast(e.message || failureMessage, 'error');
        } finally {
            writePendingRef.current = false;
        }
        if (mountedRef.current) {
            if (succeeded) await refresh(); else force();
        }
        return succeeded;
    }

    /* ---- imperative dialogs (modal + h, like the connector pickers above) ---- */

    const detailRow = (label, value, mono) => h('div', { style: { display: 'grid', gridTemplateColumns: '170px 1fr', gap: '8px', padding: '3px 0', alignItems: 'baseline' } },
        h('div.text-text-faint', { style: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' } }, label),
        value instanceof Node
            ? h('div', value)
            : h('div', mono ? { className: 'mono', style: { fontSize: '12px', wordBreak: 'break-all' } } : {}, value == null || value === '' ? '—' : String(value)));

    function openDetails(cert) {
        const p = cert.parsedCertificate || {};
        const san = p.subjectAltNames || {};
        const s = certStatus(cert);
        const body = h('div', { style: { width: '70vw', maxWidth: '820px', maxHeight: '70vh', overflow: 'auto' } });
        body.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' } },
            h('strong', { style: { fontSize: '15px' } }, cert.alias),
            h('span', { style: { fontSize: '12px', fontWeight: '600', padding: '2px 12px', borderRadius: '11px', color: '#fff', background: `var(--${s.pip})` } }, s.label)));
        body.appendChild(detailRow('Type', cert.type));
        body.appendChild(detailRow('Store', cert.store));
        body.appendChild(detailRow('Has private key', cert.hasPrivateKey ? 'Yes' : 'No'));
        body.appendChild(detailRow('Subject', cert.subject, true));
        const sanNode = sanChipsNode(san);
        if (sanNode) body.appendChild(detailRow('Subject Alt Names', sanNode));
        body.appendChild(detailRow('Issuer', cert.issuer, true));
        body.appendChild(detailRow('Valid from', cert.validFrom));
        body.appendChild(detailRow('Valid to', cert.validTo));
        body.appendChild(detailRow('SHA-1 fingerprint', cert.fingerprintSha1 ? cert.fingerprintSha1.replace(/(..)(?=.)/g, '$1:').toUpperCase() : '', true));
        const extNode = extensionsNode(p.extensions);
        if (extNode) body.appendChild(detailRow('Extensions', extNode));
        if (cert.channelsInUse && cert.channelsInUse.length) body.appendChild(detailRow('In use by channels', cert.channelsInUse.join(', ')));

        const pem = h('pre.mono', { style: { display: 'none', fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: 'var(--bg2)', padding: '8px', borderRadius: '4px', maxHeight: '220px', overflow: 'auto' } }, cert.rawCertificate || '');
        const pemToggle = h('a', { href: '#', style: { color: 'var(--accent)' }, onClick: (e) => { e.preventDefault(); pem.style.display = pem.style.display === 'none' ? 'block' : 'none'; } }, 'Show / hide raw certificate (PEM)');
        body.appendChild(h('div', { style: { marginTop: '10px' } }, pemToggle, pem));
        if (cert.hasPrivateKey && cert.rawPrivateKey) {
            const key = h('pre.mono', { style: { display: 'none', fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: 'var(--bg2)', padding: '8px', borderRadius: '4px', maxHeight: '180px', overflow: 'auto' } }, cert.rawPrivateKey);
            const keyToggle = h('a', { href: '#', style: { color: 'var(--accent)' }, onClick: (e) => { e.preventDefault(); key.style.display = key.style.display === 'none' ? 'block' : 'none'; } }, 'Show / hide private key');
            body.appendChild(h('div', { style: { marginTop: '8px' } }, keyToggle, key));
        }
        const verifyOut = h('div', { style: { marginTop: '10px' } });
        const verifyBtn = h('button.btn', { type: 'button' }, 'Verify Certificate');
        verifyBtn.addEventListener('click', () => {
            clear(verifyOut);
            verifyOut.appendChild(h('div.text-text-faint', { style: { fontSize: '12px' } }, 'Verifying…'));
            // Stored certs/keys are bare base64 (DER) — wrap to PEM so the jsrsasign
            // verify path accepts them (it rejects anything without -----BEGIN-----).
            try {
                const res = verifyCertificate(toCertPem(cert.rawCertificate), cert.rawPrivateKey ? toKeyPem(cert.rawPrivateKey) : null);
                renderVerification(verifyOut, res || { success: false, error: 'No verification result' });
            } catch (err) {
                renderVerification(verifyOut, { success: false, error: 'Verification failed: ' + err.message });
            }
        });
        body.appendChild(h('div', { style: { marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' } },
            h('strong', { style: { fontSize: '13px' } }, 'Certificate Verification'), verifyBtn));
        body.appendChild(verifyOut);
        modal({ title: `Certificate — ${cert.alias}`, body, size: 'wide', buttons: [{ label: 'Close', primary: true }] });
    }

    // Same wording as the bundled WebUI's ConfirmReplaceCertificateDialog, plus its
    // channels-in-use warning for the certificate that would be replaced.
    function confirmReplace(alias, store) {
        const existing = (storesRef.current[store] || []).find((c) => (c.alias || '').toLowerCase() === alias.toLowerCase());
        const chans = existing && existing.channelsInUse && existing.channelsInUse.length ? existing.channelsInUse : null;
        let msg = `A certificate with the alias "${alias}" already exists in the ${store} store. This will replace the existing certificate. Are you sure you want to continue?`;
        if (chans) msg += `\n\nThe existing certificate is used by ${chans.length} channel(s): ${chans.join(', ')}. Replacing it may affect those channels.`;
        return confirmDialog('Replace Existing Certificate', msg, { okLabel: 'Replace Certificate' });
    }

    async function editAlias(cert) {
        const state = writableStore(cert.store);
        if (!state || !storesRef.current[cert.store].includes(cert)) return;
        const next = await promptDialog('Edit Alias', 'Certificate alias', cert.alias);
        if (next == null) return;
        if (!writableStore(cert.store, state)) return;
        const trimmed = next.trim();
        if (!trimmed || trimmed === cert.alias) return;
        // Match the bundled WebUI (useAliasEdit): a case-insensitive collision with a
        // DIFFERENT entry in the same store prompts before replacing it (Java keystore
        // aliases are case-insensitive) instead of silently overwriting it.
        const lower = trimmed.toLowerCase();
        const collides = (storesRef.current[cert.store] || []).some((c) =>
            (c.alias || '').toLowerCase() === lower && (c.alias || '').toLowerCase() !== cert.alias.toLowerCase());
        if (collides && !await confirmReplace(trimmed, cert.store)) return;
        await writeStore(cert.store, state, (current) => updateCertificateAlias(cert.store, cert.alias, trimmed, current), 'Alias updated', 'Failed to update alias');
    }

    async function removeCert(cert) {
        const state = writableStore(cert.store);
        if (!state || !storesRef.current[cert.store].includes(cert)) return;
        const inUse = cert.channelsInUse && cert.channelsInUse.length;
        const msg = inUse
            ? `"${cert.alias}" is used by ${inUse} channel(s): ${cert.channelsInUse.join(', ')}. Removing it may break TLS on those channels. Continue?`
            : `Remove "${cert.alias}"? This cannot be undone.`;
        if (!await confirmDialog('Remove Certificate', msg, { danger: true, okLabel: 'Remove' })) return;
        await writeStore(cert.store, state, (current) => removeCertificate(cert.store, cert.alias, current), 'Certificate removed', 'Failed to remove certificate');
    }

    /* Live verification for the import dialogs: render verifyCertificate() into
     * `out` whenever a full PEM cert (and optional key) is present, mirroring the
     * SPA's auto-verify. Input here is already PEM (pasted / chain-extracted), so
     * no base64 wrapping is needed. */
    function verifyInto(out, pem, key) {
        pem = (pem || '').trim();
        key = (key || '').trim();
        if (!pem || !isValidPemCertificate(pem)) { clear(out); return; }
        try { renderVerification(out, verifyCertificate(pem, key || null)); }
        catch (e) { renderVerification(out, { success: false, error: e.message }); }
    }

    function openImportFile(store) {
        if (!writableStore(store)) return;
        const aliasInput = textInput('', { placeholder: 'Alias', style: { width: '240px' } });
        const pemArea = h('textarea', { rows: 6, placeholder: '-----BEGIN CERTIFICATE-----', style: { width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px' } });
        const keyArea = store === 'private' ? h('textarea', { rows: 5, placeholder: '-----BEGIN PRIVATE KEY-----', style: { width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px' } }) : null;
        const verifyOut = h('div', { style: { marginTop: '2px' } });
        const reverify = () => verifyInto(verifyOut, pemArea.value, keyArea ? keyArea.value : null);
        // Prefill the alias from the certificate's CN once a valid PEM is loaded
        // (matching Swing's importCertificate), unless the user typed their own.
        let autoAlias = '';
        function suggestAlias() {
            const typed = aliasInput.value.trim();
            if (typed !== '' && typed !== autoAlias) return;   // keep a user-entered alias
            const pem = pemArea.value.trim();
            if (!pem || !isValidPemCertificate(pem)) return;
            let suggested = null;
            try { suggested = getSuggestedAlias(parseCertificate(pem)); } catch { /* ignore parse errors */ }
            if (suggested) { aliasInput.value = suggested; autoAlias = suggested; }
        }
        const pickCert = h('button.btn.btn-sm', { type: 'button' }, 'Choose file…');
        pickCert.addEventListener('click', async () => { const f = await pickFile('.pem,.crt,.cer'); if (f) { pemArea.value = String(f.content || ''); reverify(); suggestAlias(); } });
        pemArea.addEventListener('input', () => { reverify(); suggestAlias(); });
        const pickKey = keyArea ? h('button.btn.btn-sm', { type: 'button' }, 'Choose key file…') : null;
        if (pickKey) pickKey.addEventListener('click', async () => { const f = await pickFile('.pem,.key'); if (f) { keyArea.value = String(f.content || ''); reverify(); } });
        if (keyArea) keyArea.addEventListener('input', reverify);
        const body = h('div', { style: { minWidth: '520px', display: 'flex', flexDirection: 'column', gap: '8px' } },
            h('label', 'Alias'), aliasInput,
            h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, h('label', { style: { flex: '1' } }, 'Certificate (PEM)'), pickCert), pemArea,
            keyArea ? h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, h('label', { style: { flex: '1' } }, 'Private key (PEM)'), pickKey) : null, keyArea,
            verifyOut);
        modal({
            title: store === 'private' ? 'Import Key Pair' : 'Import Trusted Certificate', body, size: 'wide',
            buttons: [{ label: 'Cancel' }, {
                label: 'Import', primary: true, onClick: async () => {
                    const state = writableStore(store);
                    if (!state) return false;
                    const alias = aliasInput.value.trim();
                    const pemText = pemArea.value.trim();
                    const privateKeyText = keyArea ? keyArea.value.trim() : undefined;
                    if (!alias) { toast('Alias is required', 'warn'); return false; }
                    if (!isValidPemCertificate(pemText)) { toast('Not a valid PEM certificate', 'error'); return false; }
                    if (store === 'private' && !isValidPemPrivateKey(privateKeyText)) { toast('Not a valid PEM private key', 'error'); return false; }
                    // Verify (chain + key match) before importing; let the user override on failure.
                    let res; try { res = verifyCertificate(pemText, privateKeyText || null); } catch (e) { res = { success: false, error: e.message }; }
                    if (!res.success && !await confirmDialog('Verification failed', (res.error || 'Certificate verification failed') + '\n\nImport anyway?', { danger: true, okLabel: 'Import anyway' })) return false;
                    if (!writableStore(store, state)) return false;
                    if (storesRef.current[store].some((c) => (c.alias || '').toLowerCase() === alias.toLowerCase()) && !await confirmReplace(alias, store)) return false;
                    return writeStore(store, state, (current) => updateCertificates(store, { alias, pemText, privateKeyText }, current), 'Imported', 'Import failed');
                }
            }]
        });
    }

    function openImportUrl() {
        if (!writableStore('trusted')) return;
        const urlInput = textInput('https://', { style: { flex: '1' } });
        const aliasInput = textInput('', { placeholder: 'Alias', style: { width: '240px' } });
        const heading = h('div', { style: { fontWeight: '600', fontSize: '13px', display: 'none' } }, 'Select a certificate to import');
        const listWrap = h('div', { style: { flexDirection: 'column', gap: '6px', maxHeight: '260px', overflow: 'auto', display: 'none' } });
        const verifyOut = h('div', { style: { marginTop: '2px' } });
        let chosen = null;
        let selectedUrl = null;
        let requestRevision = 0;
        let pending = false;
        let closed = false;
        const rows = [];
        const choose = (c) => { chosen = c; if (c.alias) aliasInput.value = c.alias; verifyInto(verifyOut, toCertPem(c.certificate), null); };
        const fetchBtn = h('button.btn.btn-sm', { type: 'button' }, 'Fetch');
        function invalidateSelection() {
            ++requestRevision;
            chosen = null;
            selectedUrl = null;
            pending = false;
            rows.length = 0;
            clear(listWrap); clear(verifyOut);
            heading.style.display = 'none';
            listWrap.style.display = 'none';
            aliasInput.value = '';
            fetchBtn.disabled = false;
            fetchBtn.textContent = 'Fetch';
        }
        urlInput.addEventListener('input', invalidateSelection);
        fetchBtn.addEventListener('click', async () => {
            if (closed || !mountedRef.current || pending) return;
            const url = urlInput.value.trim();
            invalidateSelection();
            const request = requestRevision;
            const isCurrent = () => !closed && mountedRef.current && request === requestRevision && urlInput.value.trim() === url;
            pending = true;
            fetchBtn.disabled = true;
            fetchBtn.textContent = 'Fetching…';
            try {
                const certs = await fetchRemoteCertificates(url);
                if (!isCurrent()) return;
                selectedUrl = url;
                heading.style.display = certs.length ? 'block' : 'none';
                listWrap.style.display = certs.length ? 'flex' : 'none';
                const name = 'tlsremote-' + Math.random().toString(36).slice(2);
                certs.forEach((c, i) => {
                    const row = optionRow({
                        name, checked: i === 0,
                        primary: c.alias || c.name || c.subject,
                        secondary: c.subject,
                        badge: c.type && c.type !== 'Unknown' ? c.type : null,
                        onSelect: () => { if (isCurrent()) { choose(c); rows.forEach((r) => r.paint()); } }
                    });
                    rows.push(row);
                    listWrap.appendChild(row.el);
                });
                if (certs.length) choose(certs[0]); else toast('No certificates returned', 'warn');
            } catch (e) {
                if (isCurrent()) toast(e.message || 'Fetch failed', 'error');
            } finally {
                if (isCurrent()) {
                    pending = false;
                    fetchBtn.disabled = false;
                    fetchBtn.textContent = 'Fetch';
                }
            }
        });
        const body = h('div', { style: { minWidth: '560px', display: 'flex', flexDirection: 'column', gap: '8px' } },
            h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, h('label', 'URL'), urlInput, fetchBtn),
            heading, listWrap, h('label', 'Alias'), aliasInput, verifyOut);
        modal({
            title: 'Import Certificate from URL', body, size: 'wide',
            onClose: () => { closed = true; ++requestRevision; },
            buttons: [{ label: 'Cancel' }, {
                label: 'Import', primary: true, onClick: async () => {
                    const state = writableStore('trusted');
                    if (!state) return false;
                    if (closed || pending || !chosen || selectedUrl !== urlInput.value.trim()) { toast('Fetch and select a certificate for the current URL first', 'warn'); return false; }
                    const selected = chosen;
                    const request = requestRevision;
                    const url = selectedUrl;
                    const alias = aliasInput.value.trim();
                    if (!alias) { toast('Alias is required', 'warn'); return false; }
                    const stillSelected = () => {
                        if (!closed && !pending && request === requestRevision && chosen === selected && urlInput.value.trim() === url && aliasInput.value.trim() === alias) return true;
                        if (!closed && mountedRef.current) toast('The URL or certificate selection changed. Fetch and select a certificate again.', 'warn');
                        return false;
                    };
                    const pemText = selected.certificate;
                    let res; try { res = verifyCertificate(toCertPem(pemText), null); } catch (e) { res = { success: false, error: e.message }; }
                    if (!res.success && !await confirmDialog('Verification failed', (res.error || 'Certificate verification failed') + '\n\nImport anyway?', { danger: true, okLabel: 'Import anyway' })) return false;
                    if (!stillSelected() || !writableStore('trusted', state)) return false;
                    if (storesRef.current.trusted.some((c) => (c.alias || '').toLowerCase() === alias.toLowerCase()) && !await confirmReplace(alias, 'trusted')) return false;
                    if (!stillSelected()) return false;
                    return writeStore('trusted', state, (current) => updateCertificates('trusted', { alias, pemText }, current), 'Imported', 'Import failed');
                }
            }]
        });
    }

    /* Import a PEM bundle/chain: parse every certificate, list them, and import
     * the selected one into the truststore (matches the SPA's
     * ImportCertificateChainDialog — only the chosen cert is stored, not the
     * whole bundle). Verification of the selection is shown live and gates import. */
    function openImportChain() {
        if (!writableStore('trusted')) return;
        const aliasInput = textInput('', { placeholder: 'Alias', style: { width: '240px' } });
        const pemArea = h('textarea', { rows: 6, placeholder: '-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\n…', style: { width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px' } });
        const foundMsg = h('div.hint', { style: { display: 'none' } });
        const listWrap = h('div', { style: { flexDirection: 'column', gap: '6px', maxHeight: '220px', overflow: 'auto', display: 'none' } });
        const verifyOut = h('div', { style: { marginTop: '2px' } });
        let parsed = [];
        let chosen = null;
        const rows = [];

        const pickCert = h('button.btn.btn-sm', { type: 'button' }, 'Choose file…');
        const choose = (c) => { chosen = c; if (c.alias) aliasInput.value = c.alias; verifyInto(verifyOut, c.certificate, null); };
        function reparse() {
            const text = pemArea.value.trim();
            parsed = text ? parseCertificateChainFromPem(text) : [];
            clear(listWrap); clear(verifyOut); rows.length = 0; chosen = null;
            if (!text) { foundMsg.style.display = 'none'; listWrap.style.display = 'none'; return; }
            foundMsg.style.display = 'block';
            if (!parsed.length) { foundMsg.textContent = 'No valid certificates found in the provided text'; listWrap.style.display = 'none'; return; }
            foundMsg.textContent = `Found ${parsed.length} certificate${parsed.length > 1 ? 's' : ''} in the chain`;
            listWrap.style.display = 'flex';
            const name = 'tlschain-' + Math.random().toString(36).slice(2);
            parsed.forEach((c, i) => {
                const row = optionRow({
                    name, checked: i === 0,
                    primary: c.alias || c.name || c.subject || ('Certificate #' + (i + 1)),
                    secondary: c.subject,
                    badge: c.type && c.type !== 'Unknown' ? c.type : null,
                    onSelect: () => { choose(c); rows.forEach((r) => r.paint()); }
                });
                rows.push(row);
                listWrap.appendChild(row.el);
            });
            choose(parsed[0]);
        }
        pemArea.addEventListener('input', reparse);
        pickCert.addEventListener('click', async () => { const f = await pickFile('.pem,.crt,.cer'); if (f) { pemArea.value = String(f.content || ''); reparse(); } });

        const body = h('div', { style: { minWidth: '560px', display: 'flex', flexDirection: 'column', gap: '8px' } },
            h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, h('label', { style: { flex: '1' } }, 'Certificate chain (PEM)'), pickCert), pemArea,
            foundMsg, listWrap, h('label', 'Alias'), aliasInput, verifyOut);
        modal({
            title: 'Import Certificate Chain', body, size: 'wide',
            buttons: [{ label: 'Cancel' }, {
                label: 'Import', primary: true, onClick: async () => {
                    const state = writableStore('trusted');
                    if (!state) return false;
                    if (!chosen) { toast('Paste a chain and select a certificate', 'warn'); return false; }
                    const certificate = chosen.certificate;
                    const alias = aliasInput.value.trim();
                    if (!alias) { toast('Alias is required', 'warn'); return false; }
                    let res; try { res = verifyCertificate(certificate, null); } catch (e) { res = { success: false, error: e.message }; }
                    if (!res.success && !await confirmDialog('Verification failed', (res.error || 'Certificate verification failed') + '\n\nImport anyway?', { danger: true, okLabel: 'Import anyway' })) return false;
                    if (!writableStore('trusted', state)) return false;
                    if (storesRef.current.trusted.some((c) => (c.alias || '').toLowerCase() === alias.toLowerCase()) && !await confirmReplace(alias, 'trusted')) return false;
                    return writeStore('trusted', state, (current) => updateCertificates('trusted', { alias, pemText: certificate }, current), 'Imported', 'Import failed');
                }
            }]
        });
    }

    /* ---- render ---- */
    if (phase === 'loading') return <div className="dt-empty" style={{ padding: '40px' }}>Loading certificates…</div>;
    if (phase === 'missing') {
        const managerUrl = `${engineUrl}/tls-manager`;
        return (
            <div className="panel"><div className="panel-body" style={{ maxWidth: '760px' }}>
                <p>The TLS Manager engine plugin wasn't detected (its <code>/api/tlsmanager</code> endpoints returned 404). Install the TLS Manager extension on the engine and refresh.</p>
                <p className="text-text-faint">If a standalone TLS Manager UI is deployed, it's at <a href={managerUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{managerUrl}</a>.</p>
                <button type="button" className="btn" onClick={refresh}>Retry</button>
            </div></div>
        );
    }

    const tabDef = STORE_TABS.find((t) => t.key === tab) || STORE_TABS[0];
    const storeState = storeStateRef.current[tab];
    const canWrite = storeState.status === 'ready' && !writePendingRef.current;
    const act = { openDetails, editAlias, removeCert, canWrite };

    return (
        <div>
            <div className="tabs" style={{ marginBottom: '10px' }}>
                {STORE_TABS.map((t) => (
                    <button key={t.key} type="button" className={'tab' + (t.key === tab ? ' active' : '')} onClick={() => setTab(t.key)}>
                        {t.label} ({storesRef.current[t.key].length})
                    </button>
                ))}
            </div>
            <div className="panel">
                <div className="panel-header">
                    {tabDef.label}
                    <div className="panel-tools">
                        <button type="button" className="btn btn-sm" disabled={writePendingRef.current} onClick={refresh}>Refresh</button>
                        {tab === 'trusted' && <button type="button" className="btn btn-sm" disabled={!canWrite} onClick={() => openImportFile('trusted')}>Import Certificate</button>}
                        {tab === 'trusted' && <button type="button" className="btn btn-sm" disabled={!canWrite} onClick={openImportChain}>Import Chain</button>}
                        {tab === 'trusted' && <button type="button" className="btn btn-sm" disabled={!canWrite} onClick={openImportUrl}>Import from URL</button>}
                        {tab === 'private' && <button type="button" className="btn btn-sm btn-primary" disabled={!canWrite} onClick={() => openImportFile('private')}>Import Key Pair</button>}
                    </div>
                </div>
                <div className="panel-body flush">
                    {tabDef.readonly && <div className="hint" style={{ padding: '8px 14px' }}>Read-only system truststore (from the engine's JRE).</div>}
                    {storeState.error && <div role="alert" style={{ padding: '12px 14px', color: 'var(--err)' }}>{storeState.error}</div>}
                    {certTableEl(storesRef.current[tab], tab, act)}
                </div>
            </div>
            <div className="text-text-faint" style={{ marginTop: '10px', fontSize: '11px' }}>
                {version ? `TLS Manager Plugin ${version} · ` : ''}Sponsored by NovaMap Health &amp; Diridium Technologies, donated to the Open Integration Engine.
            </div>
        </div>
    );
}

export function register(platform) {
    platform.registerConnectorPropertiesPanel(tlsPanel);

    platform.registerSettingsPanel({
        label: 'TLS Manager',
        order: 110,
        component: TlsManagerPanel
    });
}
