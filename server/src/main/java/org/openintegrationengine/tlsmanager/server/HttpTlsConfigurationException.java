/* SPDX-License-Identifier: MPL-2.0 */
package org.openintegrationengine.tlsmanager.server;

/** A controlled HTTP-helper configuration error whose message contains no credential details. */
public final class HttpTlsConfigurationException extends IllegalStateException {
    HttpTlsConfigurationException(String message) { super(message); }
}
