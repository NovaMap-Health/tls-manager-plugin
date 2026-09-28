# HTTP helpers for channel scripts

TLS Manager bundles synchronous HTTP helpers named `TLSManager`. Install and enable the normal plugin ZIP, then restart OIE. Newly created JavaScript scopes can call them directly from transformers, JavaScript Writers, and other server channel scripts. No imports, code templates, initialization scripts, custom libraries, or channel resource configuration are needed.

```javascript
var response = TLSManager.httpGet("https://example.org/api");

var response = TLSManager.httpPut("https://partner.example.org/api",
    JSON.stringify({message: "example"}), {
        headers: {"Content-Type": "application/json"},
        mtls: true,
        clientCertificateAlias: "partner-client",
        connectTimeoutMs: 10000,
        readTimeoutMs: 30000
    });
if (response.status >= 400) {
    throw new Error("HTTP request failed: " + response.status);
}
```

## Methods and arguments

```text
TLSManager.httpGet(url, options?)
TLSManager.httpPost(url, body, options?)
TLSManager.httpPut(url, body, options?)
TLSManager.httpPatch(url, body, options?)
TLSManager.httpDelete(url, options?)
TLSManager.httpHead(url, options?)
TLSManager.httpOptions(url, options?)
```

`url` must be an absolute HTTP or HTTPS URL. Embedded username/password credentials and URL fragments are rejected. Ordinary plaintext HTTP is supported, but `mtls: true` is rejected for HTTP. HTTPS never falls back to plaintext.

`body` is a JavaScript string, encoded as UTF-8 regardless of an explicitly supplied Content-Type charset. Set headers to describe that encoding correctly. Without a Content-Type header, body methods send `text/plain; charset=UTF-8`. Use `JSON.stringify` for JSON; objects, arrays, numbers, booleans, and boxed String objects are rejected. `null` sends an empty body. The body argument is required for POST, PUT, and PATCH.

Target Rhino 1.7.13 converts a top-level `undefined` passed to a Java Object parameter into the literal string `"undefined"` before the helper is called. Consequently, an explicit undefined **body** sends that literal text, just like a string containing those characters. Use `null` or `""` for an empty body. For **options**, omitted, null, and explicit undefined all mean defaults; the indistinguishable top-level string `"undefined"` is also treated as omitted. No application wrappers or global-scope mutations are used to change Rhino dispatch.

Options and headers must be ordinary JavaScript objects. Unknown options are rejected to catch misspellings. Missing, null, and undefined option fields use their documented defaults.

| Option | Default | Meaning |
| --- | --- | --- |
| `headers` | `{}` | Header names mapped to strings or arrays of strings; arrays send repeated fields. Empty arrays send no fields. HTTP token names and values without invalid control characters are required. Names are case insensitive. `Host`, `Content-Length`, `Transfer-Encoding`, and `Connection` are reserved for the client. |
| `mtls` | `false` | A boolean; strings such as `"false"` are rejected. False/default explicitly prevents any client certificate being offered. |
| `clientCertificateAlias` | absent | Required, nonempty exact managed private-key alias when `mtls` is true. Supplying an alias while mTLS is disabled is rejected. |
| `connectTimeoutMs` | `10000` | Integer milliseconds, from 1 to 300000, for each TCP connection attempt. Does not bound DNS resolution or the entire request. |
| `readTimeoutMs` | `30000` | Integer milliseconds, from 1 to 300000, of socket read inactivity, including TLS handshake and response reads. Not a total transfer duration or request-write deadline; a continuously streaming response may last longer. |
| `trustSystemTruststore` | `true` | Boolean controlling inclusion of the JVM roots already loaded by the plugin's existing certificate service. |
| `trustedServerCertificates` | all managed trust aliases | Array of exact managed truststore aliases. Omitted/null/undefined selects all managed entries; `[]` selects none. Unknown selected aliases fail. JVM roots remain governed independently by `trustSystemTruststore`. |

The helpers do not make application-level retries or follow redirects. A timeout or dropped connection can occur after a remote system has accepted a request; applications must decide whether retrying a state-changing operation is appropriate.

## Trust and client identities

HTTPS uses `TLSServicePlugin`, `SocketFactoryService`, and `CertificateService`, including the existing managed truststore and private-key backend. No paths, passwords, or private keys are accepted by the public helper API. The existing connector policy of optionally combining managed anchors with the plugin's loaded JVM default roots is preserved. To restrict a call to a managed private CA:

```javascript
var response = TLSManager.httpGet("https://partner.example.org/api", {
    trustSystemTruststore: false,
    trustedServerCertificates: ["partner-ca"]
});
```

TLS chain validation, certificate validity/purpose checks, and hostname verification are enabled. An unavailable/uninitialized certificate service, missing trust selection, or empty effective trust configuration fails closed. An untrusted server remains untrusted even when a valid client identity has been selected.

For mTLS, only the named managed private-key entry and its chain are available to client-certificate selection. Unknown aliases, certificate-only entries, invalid/expired credentials, key/certificate mismatch, and incompatible selections fail. There is no fallback to another alias or a second request without an identity. The TLS key manager still performs normal key-type and issuer compatibility checks.

If a server requests a client certificate incompatible with the selected identity, the handshake fails rather than proceeding anonymously. If a server never requests a certificate, `mtls: true` only makes the selected identity available; it cannot force the server to request client authentication.

When mTLS is disabled, an explicit key manager refuses client-certificate selection, even if the server requests an optional certificate and managed identities exist. This setting does not depend on JVM default key-manager behavior.

The engine's enabled HTTPS protocols and cipher suites are respected. These generic script calls are not associated with any particular connector's extra subject-DN or CRL/OCSP configuration. They do not automatically fetch CRLs or OCSP responses. Existing connector behavior is unchanged. No JVM-global TLS defaults, hostname verifiers, or keystore properties are changed.

Each request obtains a current managed trust/key snapshot, a new SSL context, and its own HTTP client/connection manager. Connections and TLS sessions are not shared across aliases or with non-mTLS requests. Completed trust and certificate changes, including replacement under the same alias, affect subsequent requests without restarting. In-flight requests retain their snapshot. This deliberately avoids long-lived credential/session caches, at the cost of a fresh TLS handshake per call.

## Responses, failures, and resources

Every completed HTTP response returns a fresh native JavaScript object:

```javascript
{
    status: 200,
    headers: {
        "content-type": ["application/json; charset=UTF-8"],
        "set-cookie": ["first=value", "second=value"]
    },
    body: "{\"message\":\"example\"}"
}
```

`status` is numeric. Response header names are lowercased; **all values are arrays**, including singleton headers. Repeated values preserve their order. Access headers with lowercase keys such as `response.headers["content-type"]`. Set-Cookie values are returned, but no cookie jar carries them into another request.

`body` is a string decoded with the response's declared charset, or UTF-8 if none is declared. Unsupported charset declarations throw a response-processing error. HEAD and absent response entities return `""`. Binary responses are not a byte-preserving API: use these helpers for text responses. The full body is materialized in memory before return; avoid unbounded/very large responses.

Apache HttpClient automatically decompresses supported gzip/deflate responses before text decoding. Returned headers describe that processed response; Content-Encoding and the encoded Content-Length can be removed by decompression. An explicit `Expect: 100-continue` request header uses `readTimeoutMs` for its interim-response wait before sending the body, rather than Apache's independent three-second default.

HTTP statuses including 3xx, 4xx, and 5xx are returned normally. Configuration, TLS, timeout, cancellation, and transport failures throw sanitized exceptions without URL query strings, headers, request/response bodies, or underlying credential-provider cause chains. The helper does not log these sensitive values. It never returns an unexplained null or a fabricated success.

Ordinary callers need no `close` call. Responses, connections, and clients are released on success and failure. Plugin stop closes active clients and aborts their requests, and future requests fail until the service starts again. Calls from already interrupted threads are rejected. Interruption of a blocking socket by an arbitrary Java thread interrupt is not a total cancellation guarantee; the configured timeouts and plugin-stop cancellation remain the bounds supported by this client.

## Registration, packaging, and restart

The public class is `org.openintegrationengine.tlsmanager.userutil.TLSManager`. Only that facade is in the imported package. The generated existing plugin descriptor contains:

```xml
<userutilPackages>
    <string>Packages.org.openintegrationengine.tlsmanager.userutil</string>
</userutilPackages>
```

OIE reads enabled-plugin metadata in `JavaScriptBuilder.generateGlobalSealedScript()`, creates `importPackage(Packages.org.openintegrationengine.tlsmanager.userutil);`, and evaluates it while building the sealed shared scope in `JavaScriptScopeUtil`. Users never write that import. `tools/PluginDescriptor.java` updates the generated descriptor during the normal ZIP build, preserving unrelated metadata. The server JAR and its normal extension-library declarations make the facade and internal service visible to the engine's scripting classloader. Engine/Rhino/Apache HTTP classes remain provided dependencies, not duplicated plugin libraries.

Java 17 is required. The plugin declares OIE 4.5.2 and 4.6.0 compatibility. Automated JavaScript tests use Rhino 1.7.13, the version in the inspected OIE 4.6.0 installation. Installing/enabling/upgrading this extension requires the normal engine restart so classloading and shared scopes include the facade. Hot availability is not claimed. Certificate changes through the running plugin do not require restart for subsequent helper calls.

## Validation and smoke test

From the repository root:

```bash
mvn -pl server -am test
./build.sh
```

The generated descriptor and ZIP must be inspected in addition to running unit tests. `HttpHelpersRhinoTest` invokes all helpers in real Rhino scopes against controlled local HTTP endpoints, with plugin lifecycle lookup mocked. Its harness package import **does not by itself prove installed extension registration**. `HttpHelperTlsTest` exercises controlled local HTTPS/mTLS endpoints and the actual certificate integration. A deterministic injected connection timeout checks that the configured connect timeout reaches the transport and is classified without retry; it is not evidence of a real network black-hole timeout.

Live-engine verification must use the built ZIP, an otherwise clean engine with fresh scopes, and scripts that call `TLSManager` directly without imports. Record the actual engine version and restart, descriptor/JAR hashes, transformer/Writer outcomes, and server-observed client identity. Run it in an isolated disposable engine/database and keep sanitized evidence before cleanup. Do not reuse a reference engine's database or shared installation.

The behavior matrix below distinguishes acceptance areas and expected failures. Test output and the actual clean-engine smoke report determine which checks passed; the presence of this procedure is not a claim of live verification.

| Area | Success and edge cases | Required failure/isolation behavior |
| --- | --- | --- |
| Exposure | Descriptor package, server JAR class, new transformer and Writer scopes | Missing/disabled service fails; manual imports cannot substitute for installation proof |
| Methods | All seven verbs, omitted/null/undefined options, UTF-8 strings, repeated headers | Invalid object/body/options/header/timeout values fail before transport |
| Responses | Native numeric status, native header arrays, charset/empty/HEAD, 3xx/4xx/5xx | No redirects, hidden retries, cookie carryover, or shared mutable results |
| Server trust | Managed CA, selected managed aliases, optional loaded JVM roots | Untrusted chain, hostname mismatch, unknown trust alias, and unavailable/empty trust fail |
| Client identity | Exact selected private key and full chain | Missing/non-key/unusable alias fails; no substitute identity and no downgrade |
| No client identity | Optional client-auth endpoint sees no certificate by default/false | Managed and JVM default identities cannot be silently selected |
| Concurrency | Independent calls/scopes, simultaneous identities A/B/default | Connections, sessions, cookies, and mutable result objects never cross calls |
| Updates | Trust removal/addition and certificate replacement under existing alias | New calls observe completed updates; already running calls finish with their snapshot |
| Resources | Successful materialization, read timeout, failed connection, interrupted start | Request resources released; stop aborts active requests and is idempotent |
| Restart ordering | A request is still preparing TLS when stop/start occurs | The pre-stop request cannot register or open a connection in the new service generation |
| Retry/partial completion | Non-2xx returned; request may have reached peer before a transport failure | State-changing calls attempted once; application decides idempotent retry policy |
