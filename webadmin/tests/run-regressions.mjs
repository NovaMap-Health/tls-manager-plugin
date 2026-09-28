import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import jsrsasign from 'jsrsasign';

const dir = path.dirname(fileURLToPath(import.meta.url));
const host = path.resolve(process.env.OIE_WEB_CLIENT_DIR || path.join(dir, '../../../oie-web-client'));
const hostRequire = createRequire(path.join(host, 'package.json'));
const { chromium, expect } = hostRequire('@playwright/test');
const client = path.join(host, 'web-administrator/client');
const temporary = await mkdtemp(path.join(tmpdir(), 'tls-webadmin-regressions-'));
const results = [];
let browser;
let server;

function certificate(name) {
    const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    return new jsrsasign.KJUR.asn1.x509.Certificate({
        version: 3, serial: { int: 1 }, sigalg: 'SHA256withRSA',
        issuer: { str: `/CN=${name}` }, subject: { str: `/CN=${name}` },
        notbefore: { str: '250101000000Z' }, notafter: { str: '491231235959Z' },
        sbjpubkey: pair.publicKey.export({ type: 'spki', format: 'pem' }),
        cakey: pair.privateKey.export({ type: 'pkcs8', format: 'pem' })
    }).getPEM();
}
const certificates = { 'a.example': certificate('a.example'), 'b.example': certificate('b.example') };
const fixture = overrides => ({
    certificates, failStores: [], failPut: false, failRefreshAfterPut: false,
    stores: { native: [], trusted: [{ alias: 'existing', certificate: certificates['a.example'] }], private: [] },
    ...overrides
});

try {
    await build({
        entryPoints: [path.join(dir, 'browser.mjs')], outfile: path.join(temporary, 'browser.js'),
        bundle: true, format: 'esm', target: 'es2022',
        alias: {
            'test:react': hostRequire.resolve('react'),
            'test:react-dom': hostRequire.resolve('react-dom/client'),
            'test:host-api': path.join(client, 'core/api.js'),
            'test:tcp': path.join(client, 'connectors/tcp.js'),
            '@oie/web-api': path.join(dir, 'platform.mjs'),
            '@oie/web-shell': path.join(dir, 'platform.mjs'),
            '@oie/web-ui': path.join(client, 'core/pkg-ui.js')
        }
    });
    const bundle = await readFile(path.join(temporary, 'browser.js'));
    server = createServer((req, res) => {
        if (req.url === '/browser.js') {
            res.setHeader('Content-Type', 'text/javascript'); res.end(bundle);
        } else {
            res.setHeader('Content-Type', 'text/html');
            res.end('<!doctype html><html><body><div role="tabpanel"><div id="tls"></div><div id="tcp"></div><div id="manager"></div></div><script type="module" src="/browser.js"></script></body></html>');
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true });
    const base = `http://127.0.0.1:${server.address().port}`;

    async function check(name, query, overrides, fn) {
        const context = await browser.newContext();
        const page = await context.newPage();
        page.setDefaultTimeout(7000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
            await page.addInitScript(data => { window.fixture = data; }, fixture(overrides));
            await page.goto(`${base}/?${query}`);
            await page.waitForFunction(() => window.ready);
            await fn(page);
            assert.deepEqual(errors, [], 'No browser errors');
            results.push({ name, status: 'pass' });
            console.log(`PASS ${name}`);
        } catch (error) {
            results.push({ name, status: 'fail', error: error.stack, pageErrors: errors });
            console.error(`FAIL ${name}: ${error.message}`);
        } finally { await context.close(); }
    }

    const properties = page => page.evaluate(() => window.tlsProperties());
    const puts = page => page.evaluate(() => window.testApi.requests.filter(r => r.method === 'PUT'));
    const openImport = async page => {
        await page.getByRole('button', { name: 'Import Certificate', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Import Trusted Certificate', exact: true });
        await dialog.locator('input').fill('new-cert');
        await dialog.locator('textarea').fill(certificates['b.example']);
        return dialog;
    };
    const openUrl = async page => {
        await page.getByRole('button', { name: 'Import from URL', exact: true }).click();
        return page.getByRole('dialog', { name: 'Import Certificate from URL', exact: true });
    };
    const fetchUrl = async (page, dialog, url, count) => {
        await dialog.locator('input[type="text"]').first().fill(url);
        await dialog.getByRole('button', { name: 'Fetch', exact: true }).click();
        await page.waitForFunction(n => window.testApi.remoteCount() === n, count);
    };
    const resolveRemote = async (page, dialog, index, alias) => {
        await page.evaluate(({ index, alias }) => window.testApi.resolveRemote(index, alias), { index, alias });
        await expect(dialog.locator('input[type="text"]').nth(1)).toHaveValue(alias);
    };

    for (const transport of ['TCP Sender', 'TCP Listener']) {
        await check(`${transport}: mode changes update sibling TLS root and preserve values`, `transport=${encodeURIComponent(transport)}`, {}, async page => {
            await expect(page.locator('#tls').getByText('Server Trust', { exact: true })).toBeVisible();
            assert.equal(await page.evaluate(() => window.dirtyCount), 0, 'Viewing does not dirty the connector');
            await page.locator('#tls input[data-fkey="clientCertificateAlias"]').fill('client-key');
            await page.locator('#tcp [data-fkey="serverMode"]').getByLabel('Server', { exact: true }).check();
            await expect(page.locator('#tls').getByText('Server Identity', { exact: true })).toBeVisible();
            await expect(page.locator('#tls').getByText('Server Trust', { exact: true })).toHaveCount(0);
            await page.locator('#tls input[data-fkey="serverCertificateAlias"]').fill('server-key');
            await page.locator('#tcp [data-fkey="serverMode"]').getByLabel('Client', { exact: true }).check();
            await expect(page.locator('#tls input[data-fkey="clientCertificateAlias"]')).toHaveValue('client-key');
            assert.equal((await properties(page)).serverCertificateAlias, 'server-key');
            await page.evaluate(() => window.mountTls());
            await page.locator('#tcp [data-fkey="serverMode"]').getByLabel('Server', { exact: true }).check();
            await expect(page.locator('#tls input[data-fkey="serverCertificateAlias"]')).toHaveValue('server-key');
        });
    }

    for (const [index, key, retained, removed] of [
        [0, 'usedProtocols', 'TLSv1.3', 'TLSv1.1'],
        [1, 'usedCiphers', 'TLS_AES_128_GCM_SHA256', 'OLD_CIPHER']
    ]) {
        await check(`${key}: unknown selections removable, clear respected, repeat idempotent`, 'unknown=1', {}, async page => {
            await expect(page.locator('#tls input[data-fkey="clientCertificateAlias"]')).toBeVisible();
            const edit = page.locator('#tls').getByRole('button', { name: 'Edit…', exact: true }).nth(index);
            await edit.click();
            let dialog = page.getByRole('dialog');
            await expect(dialog.getByLabel(removed, { exact: true })).toBeChecked();
            await dialog.getByLabel(removed, { exact: true }).uncheck();
            await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
            assert.ok((await properties(page))[key].string.includes(removed), 'Cancel preserves saved values');
            await edit.click();
            dialog = page.getByRole('dialog');
            await dialog.getByText('Deselect All', { exact: true }).click();
            await dialog.getByLabel(retained, { exact: true }).check();
            await dialog.getByRole('button', { name: 'OK', exact: true }).click();
            assert.deepEqual((await properties(page))[key], { string: [retained] });
            await edit.click();
            await page.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click();
            assert.deepEqual((await properties(page))[key], { string: [retained] });
        });
    }

    await check('Manual aliases retain focus, accept paste and clear to null after lookup failure', '', { failStores: ['private'] }, async page => {
        const input = page.locator('#tls input[data-fkey="clientCertificateAlias"]');
        await input.pressSequentially('client-key', { delay: 10 });
        await expect(input).toHaveValue('client-key');
        await expect(input).toBeFocused();
        assert.equal((await properties(page)).clientCertificateAlias, 'client-key');
        await input.fill('  pasted-key  ');
        await expect(input).toHaveValue('pasted-key');
        assert.equal((await properties(page)).clientCertificateAlias, 'pasted-key');
        await input.fill('pasted-key');
        await input.press('ControlOrMeta+A');
        await input.press('Backspace');
        await expect(input).toBeFocused();
        assert.equal((await properties(page)).clientCertificateAlias, null);
    });

    await check('Failed initial trusted read blocks writes; unaffected store and retry work', 'view=manager', { failStores: ['trusted'] }, async page => {
        await expect(page.getByRole('alert')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Import Certificate', exact: true })).toBeDisabled();
        assert.deepEqual(await puts(page), []);
        await page.getByRole('button', { name: /^Local Key Pairs/ }).click();
        await expect(page.getByRole('button', { name: 'Import Key Pair', exact: true })).toBeEnabled();
        await page.evaluate(() => { window.fixture.failStores = []; });
        await page.getByRole('button', { name: 'Refresh', exact: true }).click();
        await page.getByRole('button', { name: /^Trusted Certificates/ }).click();
        await expect(page.getByRole('button', { name: 'Import Certificate', exact: true })).toBeEnabled();
        await expect(page.getByRole('cell', { name: 'existing', exact: true }).first()).toBeVisible();
    });

    await check('Failed refresh retains rows but disables import, edit and delete', 'view=manager', {}, async page => {
        await expect(page.getByRole('button', { name: 'Import Certificate', exact: true })).toBeEnabled();
        await page.evaluate(() => { window.fixture.failStores = ['trusted']; });
        await page.getByRole('button', { name: 'Refresh', exact: true }).click();
        await expect(page.getByRole('alert')).toBeVisible();
        await expect(page.getByRole('cell', { name: 'existing', exact: true }).first()).toBeVisible();
        for (const name of ['Import Certificate', 'Edit', 'Delete']) await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
        assert.deepEqual(await puts(page), []);
    });

    await check('Failed local-key-store read blocks only that store and recovers after refresh', 'view=manager', { failStores: ['private'] }, async page => {
        await expect(page.getByRole('button', { name: 'Import Certificate', exact: true })).toBeEnabled();
        await page.getByRole('button', { name: /^Local Key Pairs/ }).click();
        await expect(page.getByRole('alert')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Import Key Pair', exact: true })).toBeDisabled();
        await page.evaluate(() => { window.fixture.failStores = []; });
        await page.getByRole('button', { name: 'Refresh', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Import Key Pair', exact: true })).toBeEnabled();
        assert.deepEqual(await puts(page), []);
    });

    await check('Failed write preserves rows and requires a fresh read before successful retry', 'view=manager', { failPut: true }, async page => {
        let dialog = await openImport(page);
        await dialog.getByRole('button', { name: 'Import', exact: true }).click();
        await expect(page.getByRole('alert')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Import Certificate', exact: true })).toBeDisabled();
        await expect(page.getByRole('cell', { name: 'existing', exact: true }).first()).toBeVisible();
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        await page.evaluate(() => {
            window.fixture.failPut = false;
            window.fixture.stores.trusted.push({ alias: 'server-new', certificate: window.fixture.certificates['a.example'] });
        });
        await page.getByRole('button', { name: 'Refresh', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Import Certificate', exact: true })).toBeEnabled();
        dialog = await openImport(page);
        await dialog.getByRole('button', { name: 'Import', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        const writes = await puts(page);
        assert.equal(writes.length, 2);
        assert.deepEqual(writes[1].body.list.trustedCertificate.map(c => c.alias), ['existing', 'server-new', 'new-cert']);
    });

    await check('Already-open import cannot write after a refresh failure', 'view=manager', {}, async page => {
        const dialog = await openImport(page);
        await page.evaluate(() => {
            window.fixture.failStores = ['trusted'];
            [...document.querySelectorAll('#manager button')].find(b => b.textContent === 'Refresh').click();
        });
        await expect(page.getByRole('alert')).toBeVisible();
        await dialog.getByRole('button', { name: 'Import', exact: true }).click();
        await expect(dialog).toBeVisible();
        assert.deepEqual(await puts(page), []);
    });

    await check('Successful import preserves loaded certificates and failed reload blocks further writes', 'view=manager', { failRefreshAfterPut: true }, async page => {
        const dialog = await openImport(page);
        await dialog.getByRole('button', { name: 'Import', exact: true }).click();
        await expect(page.getByRole('alert')).toBeVisible();
        const writes = await puts(page);
        assert.equal(writes.length, 1);
        assert.deepEqual(writes[0].body.list.trustedCertificate.map(c => c.alias), ['existing', 'new-cert']);
        await expect(page.getByRole('button', { name: 'Import Certificate', exact: true })).toBeDisabled();
    });

    await check('URL fetch results apply only to the latest URL, including reverse completion', 'view=manager', {}, async page => {
        const dialog = await openUrl(page);
        await fetchUrl(page, dialog, 'https://a.example', 1);
        await fetchUrl(page, dialog, 'https://b.example', 2);
        await resolveRemote(page, dialog, 1, 'b.example');
        await page.evaluate(() => window.testApi.resolveRemote(0, 'a.example'));
        await expect(dialog.locator('input[type="text"]').nth(1)).toHaveValue('b.example');
        await dialog.getByRole('button', { name: 'Import', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        const writes = await puts(page);
        assert.equal(writes.length, 1);
        assert.equal(writes[0].body.list.trustedCertificate.at(-1).certificate, certificates['b.example']);
    });

    await check('Failed URL refetch and editing back to a prior URL cannot import the old selection', 'view=manager', {}, async page => {
        const dialog = await openUrl(page);
        await fetchUrl(page, dialog, 'https://a.example', 1);
        await resolveRemote(page, dialog, 0, 'a.example');
        await fetchUrl(page, dialog, 'https://b.example', 2);
        await page.evaluate(() => window.testApi.rejectRemote(1));
        await expect(dialog.getByRole('button', { name: 'Fetch', exact: true })).toBeEnabled();
        await dialog.getByRole('button', { name: 'Import', exact: true }).click();
        assert.deepEqual(await puts(page), []);
        await dialog.locator('input[type="text"]').first().fill('https://a.example');
        await dialog.getByRole('button', { name: 'Import', exact: true }).click();
        assert.deepEqual(await puts(page), []);
        await expect(dialog).toBeVisible();
    });

    await check('Store failure during replacement confirmation cancels the pending write', 'view=manager', {}, async page => {
        const dialog = await openImport(page);
        await dialog.locator('input').fill('existing');
        await dialog.getByRole('button', { name: 'Import', exact: true }).click();
        const confirmation = page.getByRole('dialog', { name: 'Replace Existing Certificate', exact: true });
        await expect(confirmation).toBeVisible();
        await page.evaluate(() => {
            window.fixture.failStores = ['trusted'];
            [...document.querySelectorAll('#manager button')].find(b => b.textContent === 'Refresh').click();
        });
        await expect(page.getByRole('alert')).toBeVisible();
        await confirmation.getByRole('button', { name: 'Replace Certificate', exact: true }).click();
        await expect(confirmation).toHaveCount(0);
        assert.deepEqual(await puts(page), []);
    });

    await check('Closing URL dialog ignores its pending request', 'view=manager', {}, async page => {
        const dialog = await openUrl(page);
        await fetchUrl(page, dialog, 'https://a.example', 1);
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        await page.evaluate(() => window.testApi.resolveRemote(0, 'a.example'));
        await expect(page.getByRole('dialog')).toHaveCount(0);
        assert.deepEqual(await puts(page), []);
    });
} finally {
    await browser?.close();
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await rm(temporary, { recursive: true, force: true });
    if (process.env.TLS_TEST_OUTPUT) {
        await mkdir(process.env.TLS_TEST_OUTPUT, { recursive: true });
        await writeFile(path.join(process.env.TLS_TEST_OUTPUT, 'browser-regression-results.json'), JSON.stringify({
            host, bundleSha256: createHash('sha256').update(await readFile(path.join(dir, '../web/plugin.js'))).digest('hex'),
            results, cleanup: { browserClosed: true, httpServerClosed: true, temporaryRemoved: temporary, engines: 0, databases: 0 }
        }, null, 2) + '\n');
    }
}

const failed = results.filter(r => r.status === 'fail').length;
console.log(`${results.length - failed}/${results.length} browser regressions passed`);
if (failed) process.exitCode = 1;
