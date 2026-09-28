/*
 * SPDX-License-Identifier: MPL-2.0
 * Copyright (c) 2026 NovaMap Health Limited <https://novamap.health>
 *
 * Build the TLS Manager web admin plugin.
 *
 * The browser can't run JSX and the engine serves webadmin/ files raw (build.sh
 * copies them verbatim into the extension zip, no token filtering), so the JSX
 * source web/plugin.jsx must be compiled to web/plugin.js — the file
 * plugin.json's client.entry points at.
 *
 * NOTE: run `npm run build` (from the webadmin/ root) BEFORE packaging so the
 * freshly-built web/plugin.js is the one shipped. The Maven build wires this in
 * via frontend-maven-plugin (generate-resources), ahead of the build.sh
 * webadmin copy.
 *
 * @oie/* are left EXTERNAL — they are resolved by the host page's import map at
 * runtime (one shared framework instance), never bundled here.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));

await build({
    entryPoints: [path.join(dir, 'web/plugin.jsx')],
    outfile: path.join(dir, 'web/plugin.js'),
    bundle: true,
    format: 'esm',
    target: 'es2022',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    external: ['@oie/web-api', '@oie/web-ui', '@oie/web-shell']
});

console.log('Built web/plugin.js');
