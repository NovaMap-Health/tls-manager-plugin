/* SPDX-License-Identifier: MPL-2.0 */
package org.openintegrationengine.tlsmanager.server;

import org.mozilla.javascript.ConsString;
import org.mozilla.javascript.NativeArray;
import org.mozilla.javascript.NativeObject;
import org.mozilla.javascript.Scriptable;
import org.mozilla.javascript.Undefined;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Copies script arguments into request-owned Java values; no script objects are retained. */
public record HttpRequestOptions(URI uri, String body, Map<String, List<String>> headers,
                                 String clientCertificateAlias, boolean trustSystemTruststore,
                                 Set<String> trustedServerCertificates, int connectTimeoutMs, int readTimeoutMs) {
    public static final int DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
    public static final int DEFAULT_READ_TIMEOUT_MS = 30_000;
    public static final int MAX_TIMEOUT_MS = 300_000;
    private static final Set<String> OPTIONS = Set.of("headers", "mtls", "clientCertificateAlias",
        "connectTimeoutMs", "readTimeoutMs", "trustSystemTruststore", "trustedServerCertificates");
    private static final Set<String> RESERVED_HEADERS = Set.of("host", "content-length", "transfer-encoding", "connection");

    public static HttpRequestOptions parse(String url, Object body, Object options) {
        URI uri;
        try {
            uri = new URI(url == null ? "" : url);
        } catch (URISyntaxException e) {
            throw invalid("url must be an absolute HTTP or HTTPS URL");
        }
        boolean https = "https".equalsIgnoreCase(uri.getScheme());
        if ((!https && !"http".equalsIgnoreCase(uri.getScheme())) || uri.getHost() == null
            || uri.getRawUserInfo() != null || uri.getRawFragment() != null
            || uri.getPort() < -1 || uri.getPort() == 0 || uri.getPort() > 65535) {
            throw invalid("url must be an absolute HTTP or HTTPS URL without credentials or a fragment");
        }
        // Rhino 1.7.13 LiveConnect coerces a top-level undefined Object argument to
        // the Java string "undefined" before invocation. Only the options argument
        // recognizes that sentinel; body/header strings remain literal strings.
        NativeObject obj = absent(options) || "undefined".equals(options) ? null : object(options, "options");
        if (obj != null) {
            for (Object key : obj.getIds()) {
                if (!(key instanceof String) || !OPTIONS.contains(key)) {
                    throw invalid("options contains an unsupported property");
                }
            }
        }
        boolean mtls = bool(get(obj, "mtls"), false, "mtls");
        Object aliasValue = get(obj, "clientCertificateAlias");
        String alias = absent(aliasValue) ? null : string(aliasValue, "clientCertificateAlias");
        if (!mtls && alias != null) {
            throw invalid("clientCertificateAlias requires mtls: true");
        }
        if (mtls && (alias == null || alias.isBlank())) {
            throw invalid("mtls requires a nonempty clientCertificateAlias");
        }
        if (!https && mtls) {
            throw invalid("mTLS requires an HTTPS URL");
        }
        boolean system = bool(get(obj, "trustSystemTruststore"), true, "trustSystemTruststore");
        Object selected = get(obj, "trustedServerCertificates");
        Set<String> trusted = null;
        if (!absent(selected)) {
            trusted = new LinkedHashSet<>(strings(selected, "trustedServerCertificates"));
            if (trusted.stream().anyMatch(String::isBlank)) {
                throw invalid("trustedServerCertificates must contain nonempty aliases");
            }
            trusted = Set.copyOf(trusted);
        }
        return new HttpRequestOptions(uri, absent(body) ? "" : string(body, "body (use JSON.stringify for objects)"),
            headers(get(obj, "headers")), alias, system, trusted,
            timeout(get(obj, "connectTimeoutMs"), DEFAULT_CONNECT_TIMEOUT_MS, "connectTimeoutMs"),
            timeout(get(obj, "readTimeoutMs"), DEFAULT_READ_TIMEOUT_MS, "readTimeoutMs"));
    }

    private static Map<String, List<String>> headers(Object value) {
        if (absent(value)) return Map.of();
        NativeObject obj = object(value, "headers");
        Map<String, List<String>> result = new LinkedHashMap<>();
        for (Object id : obj.getIds()) {
            String name = String.valueOf(id);
            if (!name.matches("[!#$%&'*+.^_`|~0-9A-Za-z-]+")
                || RESERVED_HEADERS.contains(name.toLowerCase(Locale.ROOT))) {
                throw invalid("headers contains an invalid or reserved header name");
            }
            Object entry = id instanceof Number ? obj.get(((Number) id).intValue(), obj) : obj.get(name, obj);
            List<String> values = entry instanceof NativeArray ? strings(entry, "header values")
                : List.of(string(entry, "header value"));
            for (String text : values) {
                for (int i = 0; i < text.length(); i++) {
                    char ch = text.charAt(i);
                    if ((ch < 32 && ch != '\t') || ch == 127 || ch > 255) {
                        throw invalid("header values must contain HTTP text without control characters");
                    }
                }
            }
            result.computeIfAbsent(name.toLowerCase(Locale.ROOT), ignored -> new ArrayList<>()).addAll(values);
        }
        result.replaceAll((name, values) -> List.copyOf(values));
        return Map.copyOf(result);
    }

    private static List<String> strings(Object value, String field) {
        if (!(value instanceof NativeArray array) || array.getLength() > Integer.MAX_VALUE) {
            throw invalid(field + " must be an array of strings");
        }
        List<String> result = new ArrayList<>();
        for (int i = 0; i < array.getLength(); i++) result.add(string(array.get(i, array), field));
        return result;
    }

    private static int timeout(Object value, int fallback, String field) {
        if (absent(value)) return fallback;
        if (!(value instanceof Number number)) throw invalid(field + " must be an integer from 1 to 300000");
        double d = number.doubleValue();
        if (!Double.isFinite(d) || d < 1 || d > MAX_TIMEOUT_MS || d != Math.rint(d)) {
            throw invalid(field + " must be an integer from 1 to 300000");
        }
        return (int) d;
    }

    private static boolean bool(Object value, boolean fallback, String field) {
        if (absent(value)) return fallback;
        if (!(value instanceof Boolean flag)) throw invalid(field + " must be a boolean");
        return flag;
    }

    private static String string(Object value, String field) {
        if (value instanceof String || value instanceof ConsString) return value.toString();
        throw invalid(field + " must be a string");
    }

    private static NativeObject object(Object value, String field) {
        if (!(value instanceof NativeObject obj)) throw invalid(field + " must be a JavaScript object");
        return obj;
    }

    private static Object get(NativeObject obj, String key) {
        return obj == null ? null : obj.get(key, obj);
    }

    private static boolean absent(Object value) {
        return value == null || Undefined.isUndefined(value) || value == Scriptable.NOT_FOUND;
    }

    private static IllegalArgumentException invalid(String message) {
        return new IllegalArgumentException("TLSManager: " + message);
    }
}
