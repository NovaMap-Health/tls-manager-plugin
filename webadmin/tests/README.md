# Webadmin regressions

Run `npm run test:regression` from `webadmin/`. This rebuilds the plugin, runs the
certificate utility tests, and tests the shipped bundle in Chromium against the
real OIE host forms and dialogs. Set `TLS_TEST_FILTER` to a browser test name
substring for a focused browser run.

The PKI.js/Web Crypto checks cover certificate details and fingerprints, RSA and
EC keys (PKCS#8, PKCS#1 and SEC1), chain signatures, malformed/unsupported keys,
crypto failures, and delayed parsing/verification across edits and dialog closure.
As in the standalone UI's PKI.js migration, DSA private keys are unsupported.
Browser hashing and key matching require Web Crypto in a secure context (HTTPS
or localhost).

The default host checkout is the sibling `oie-web-client` repository. Set
`OIE_WEB_CLIENT_DIR` to use another checkout. Install that checkout's dependencies
and build its web administrator first; its Playwright Chromium must be installed.
The tests reuse those dependencies rather than introducing a second React/host
implementation or browser dependency tree into this plugin.

APIs are controlled test fixtures: no OIE login, engine installation, database or
real certificate-store write is performed. The temporary HTTP listener, browser
and compiled harness directory are cleaned up on success and failure. Set
`TLS_TEST_OUTPUT` to retain a JSON results/provenance receipt in an existing or new
evidence directory. The command exits nonzero if any regression or page error is
observed.
