# Webadmin regressions

Run `npm run test:regression` from `webadmin/`. This rebuilds the plugin and tests
the shipped bundle in Chromium against the real OIE host forms and dialogs.

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
