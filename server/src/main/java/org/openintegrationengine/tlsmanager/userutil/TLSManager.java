/* SPDX-License-Identifier: MPL-2.0 */
package org.openintegrationengine.tlsmanager.userutil;

import org.mozilla.javascript.Context;
import org.mozilla.javascript.ScriptRuntime;
import org.mozilla.javascript.Scriptable;
import org.mozilla.javascript.ScriptableObject;
import org.openintegrationengine.tlsmanager.server.HttpRequestOptions;
import org.openintegrationengine.tlsmanager.server.HttpRequestService;
import org.openintegrationengine.tlsmanager.server.TLSServicePlugin;

/**
 * Import-free synchronous HTTP utilities registered by the TLS Manager extension's userutilPackages.
 * <p>Options are ordinary JavaScript objects: headers (string values or arrays of strings), mtls
 * (boolean, default false), clientCertificateAlias (required only with mtls), connectTimeoutMs
 * (default 10000), readTimeoutMs (default 30000), trustSystemTruststore (default true), and
 * trustedServerCertificates (array of managed trust aliases; omitted means all, empty means none).
 * Timeouts are integer milliseconds from 1 through 300000. Connect timeout covers each TCP connect,
 * not DNS; read timeout limits socket inactivity, including the TLS handshake, not total duration.
 * <p>String bodies use UTF-8; null bodies are empty. Other body types are rejected, except that
 * Rhino 1.7.13 converts an explicit undefined body to the literal string "undefined" before invocation.
 * Pass a string or null for bodies. Omitted, null and undefined options all select defaults.
 * Results are fresh native JavaScript objects with numeric status, lowercase headers whose values
 * are arrays of strings, and a string body decoded using its declared charset or UTF-8 by default.
 * HEAD and absent response entities yield an empty string. Responses including 3xx/4xx/5xx are
 * returned; invalid options, TLS, timeout and transport failures throw. Redirects/retries are disabled.
 * <p>HTTPS always uses managed trust with hostname validation. mTLS uses only the selected managed
 * private-key entry; default calls cannot offer any client certificate. Plain HTTP supports no mTLS.
 * Each call owns and closes its context/connection; subsequent calls see completed certificate updates.
 * Install the normal extension artifact and restart OIE to create scopes with this imported package.
 * No initialization scripts, templates, channel resources or manual imports are required.
 */
public final class TLSManager {
    private TLSManager() { }

    /**
     * Executes GET with default options.
     * @param url absolute HTTP(S) URL without embedded credentials or a fragment
     * @return fresh JavaScript object with numeric status, lowercase header arrays and decoded body
     * @throws IllegalArgumentException if arguments are invalid
     * @throws IllegalStateException if services, TLS, timeouts or transport fail
     */
    public static Scriptable httpGet(String url) { return httpGet(url, null); }

    /**
     * Executes GET with the supplied options.
     * @param url absolute HTTP(S) URL without embedded credentials or a fragment
     * @param options ordinary JavaScript options object; null/undefined selects defaults
     * @return fresh JavaScript object with numeric status, lowercase header arrays and decoded body
     * @throws IllegalArgumentException if arguments are invalid
     * @throws IllegalStateException if services, TLS, timeouts or transport fail
     */
    public static Scriptable httpGet(String url, Object options) { return request("GET", url, null, options); }

    /**
     * Executes POST with default options.
     * @param url absolute HTTP(S) URL without embedded credentials or a fragment
     * @param body UTF-8 string, or null for an empty body; use JSON.stringify for objects
     * @return fresh JavaScript object with numeric status, lowercase header arrays and decoded body
     * @throws IllegalArgumentException if arguments are invalid
     * @throws IllegalStateException if services, TLS, timeouts or transport fail
     */
    public static Scriptable httpPost(String url, Object body) { return httpPost(url, body, null); }

    /**
     * Executes POST with the supplied options.
     * @param url absolute HTTP(S) URL without embedded credentials or a fragment
     * @param body UTF-8 string, or null for an empty body; use JSON.stringify for objects
     * @param options ordinary JavaScript options object; null/undefined selects defaults
     * @return fresh JavaScript object with numeric status, lowercase header arrays and decoded body
     * @throws IllegalArgumentException if arguments are invalid
     * @throws IllegalStateException if services, TLS, timeouts or transport fail
     */
    public static Scriptable httpPost(String url, Object body, Object options) { return request("POST", url, body, options); }

    /**
     * Executes PUT with default options.
     * @param url absolute HTTP(S) URL without embedded credentials or a fragment
     * @param body UTF-8 string, or null for an empty body; use JSON.stringify for objects
     * @return fresh JavaScript object with numeric status, lowercase header arrays and decoded body
     * @throws IllegalArgumentException if arguments are invalid
     * @throws IllegalStateException if services, TLS, timeouts or transport fail
     */
    public static Scriptable httpPut(String url, Object body) { return httpPut(url, body, null); }

    /**
     * Executes PUT with the supplied options.
     * @param url absolute HTTP(S) URL without embedded credentials or a fragment
     * @param body UTF-8 string, or null for an empty body; use JSON.stringify for objects
     * @param options ordinary JavaScript options object; null/undefined selects defaults
     * @return fresh JavaScript object with numeric status, lowercase header arrays and decoded body
     * @throws IllegalArgumentException if arguments are invalid
     * @throws IllegalStateException if services, TLS, timeouts or transport fail
     */
    public static Scriptable httpPut(String url, Object body, Object options) { return request("PUT", url, body, options); }

    /**
     * Executes PATCH with default options.
     * @param url absolute HTTP(S) URL without embedded credentials or a fragment
     * @param body UTF-8 string, or null for an empty body; use JSON.stringify for objects
     * @return fresh JavaScript object with numeric status, lowercase header arrays and decoded body
     * @throws IllegalArgumentException if arguments are invalid
     * @throws IllegalStateException if services, TLS, timeouts or transport fail
     */
    public static Scriptable httpPatch(String url, Object body) { return httpPatch(url, body, null); }

    /**
     * Executes PATCH with the supplied options.
     * @param url absolute HTTP(S) URL without embedded credentials or a fragment
     * @param body UTF-8 string, or null for an empty body; use JSON.stringify for objects
     * @param options ordinary JavaScript options object; null/undefined selects defaults
     * @return fresh JavaScript object with numeric status, lowercase header arrays and decoded body
     * @throws IllegalArgumentException if arguments are invalid
     * @throws IllegalStateException if services, TLS, timeouts or transport fail
     */
    public static Scriptable httpPatch(String url, Object body, Object options) { return request("PATCH", url, body, options); }

    /**
     * Executes DELETE with default options.
     * @param url absolute HTTP(S) URL without embedded credentials or a fragment
     * @return fresh JavaScript object with numeric status, lowercase header arrays and decoded body
     * @throws IllegalArgumentException if arguments are invalid
     * @throws IllegalStateException if services, TLS, timeouts or transport fail
     */
    public static Scriptable httpDelete(String url) { return httpDelete(url, null); }

    /**
     * Executes DELETE with the supplied options.
     * @param url absolute HTTP(S) URL without embedded credentials or a fragment
     * @param options ordinary JavaScript options object; null/undefined selects defaults
     * @return fresh JavaScript object with numeric status, lowercase header arrays and decoded body
     * @throws IllegalArgumentException if arguments are invalid
     * @throws IllegalStateException if services, TLS, timeouts or transport fail
     */
    public static Scriptable httpDelete(String url, Object options) { return request("DELETE", url, null, options); }

    /**
     * Executes HEAD with default options.
     * @param url absolute HTTP(S) URL without embedded credentials or a fragment
     * @return fresh JavaScript object with numeric status, lowercase header arrays and decoded body
     * @throws IllegalArgumentException if arguments are invalid
     * @throws IllegalStateException if services, TLS, timeouts or transport fail
     */
    public static Scriptable httpHead(String url) { return httpHead(url, null); }

    /**
     * Executes HEAD with the supplied options.
     * @param url absolute HTTP(S) URL without embedded credentials or a fragment
     * @param options ordinary JavaScript options object; null/undefined selects defaults
     * @return fresh JavaScript object with numeric status, lowercase header arrays and decoded body
     * @throws IllegalArgumentException if arguments are invalid
     * @throws IllegalStateException if services, TLS, timeouts or transport fail
     */
    public static Scriptable httpHead(String url, Object options) { return request("HEAD", url, null, options); }

    /**
     * Executes OPTIONS with default options.
     * @param url absolute HTTP(S) URL without embedded credentials or a fragment
     * @return fresh JavaScript object with numeric status, lowercase header arrays and decoded body
     * @throws IllegalArgumentException if arguments are invalid
     * @throws IllegalStateException if services, TLS, timeouts or transport fail
     */
    public static Scriptable httpOptions(String url) { return httpOptions(url, null); }

    /**
     * Executes OPTIONS with the supplied options.
     * @param url absolute HTTP(S) URL without embedded credentials or a fragment
     * @param options ordinary JavaScript options object; null/undefined selects defaults
     * @return fresh JavaScript object with numeric status, lowercase header arrays and decoded body
     * @throws IllegalArgumentException if arguments are invalid
     * @throws IllegalStateException if services, TLS, timeouts or transport fail
     */
    public static Scriptable httpOptions(String url, Object options) { return request("OPTIONS", url, null, options); }

    private static Scriptable request(String method, String url, Object body, Object options) {
        Context context = Context.getCurrentContext();
        if (context == null) throw new IllegalStateException("TLSManager requires an active channel JavaScript context");
        HttpRequestOptions normalized = HttpRequestOptions.parse(url, body, options);
        HttpRequestService service;
        try {
            service = TLSServicePlugin.getPluginInstance().getHttpRequestService();
        } catch (RuntimeException e) {
            throw new IllegalStateException("TLSManager HTTP service is unavailable; install, enable and restart the extension");
        }
        if (service == null) throw new IllegalStateException("TLSManager HTTP service is not initialized");
        HttpRequestService.Response response = service.execute(method, normalized);
        Scriptable scope = ScriptRuntime.getTopCallScope(context);
        Scriptable result = context.newObject(scope);
        Scriptable headers = context.newObject(scope);
        response.headers().forEach((name, values) -> ScriptableObject.defineProperty(headers, name,
            context.newArray(scope, values.toArray()), ScriptableObject.EMPTY));
        ScriptableObject.putProperty(result, "status", response.status());
        ScriptableObject.putProperty(result, "headers", headers);
        ScriptableObject.putProperty(result, "body", response.body());
        return result;
    }
}
