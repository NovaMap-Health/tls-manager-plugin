/*
 * SPDX-License-Identifier: MPL-2.0
 * Copyright (c) 2025 NovaMap Health Limited <https://novamap.health>
 */

package org.openintegrationengine.tlsmanager.server.io;

import org.openintegrationengine.tlsmanager.shared.models.ClientAuthMode;
import org.openintegrationengine.tlsmanager.shared.models.WeirdIntermediaryListenerContextContainer;

import javax.net.ssl.SSLServerSocket;
import javax.net.ssl.SSLSocket;
import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;

public class StateAwareTLSServerSocket extends ServerSocket {

    private final WeirdIntermediaryListenerContextContainer contextContainer;
    private final SSLServerSocket delegate;

    public StateAwareTLSServerSocket(
        int port,
        int backlog,
        InetAddress bindAddr,
        WeirdIntermediaryListenerContextContainer contextContainer
    ) throws IOException {
        super();
        this.contextContainer = contextContainer;
        this.delegate = createSSLServerSocket(port, backlog, bindAddr);
    }

    private SSLServerSocket createSSLServerSocket(int port, int backlog, InetAddress bindAddr) throws IOException {
        var sslContext = contextContainer.sslContext();
        var socketFactory = sslContext.getServerSocketFactory();
        var sslServerSocket = (SSLServerSocket) socketFactory.createServerSocket(port, backlog, bindAddr);

        sslServerSocket.setEnabledProtocols(contextContainer.protocols());
        sslServerSocket.setEnabledCipherSuites(contextContainer.ciphers());

        if (ClientAuthMode.REQUESTED == contextContainer.clientAuthMode()) {
            sslServerSocket.setWantClientAuth(true);
        } else if (ClientAuthMode.REQUIRED == contextContainer.clientAuthMode()) {
            sslServerSocket.setNeedClientAuth(true);
        }

        return sslServerSocket;
    }

    @Override
    public Socket accept() throws IOException {
        if (isClosed()) {
            throw new SocketException("Socket is closed");
        }
        if (!isBound()) {
            throw new SocketException("Socket is not bound yet");
        }

        var sslSocket = (SSLSocket) delegate.accept();
        var oldTimeout = sslSocket.getSoTimeout();

        try {
            sslSocket.setSoTimeout(10000);
            sslSocket.startHandshake();
            return sslSocket;
        } catch (IOException e) {
            try {
                sslSocket.close();
            } catch (IOException ignored) {
            }
            throw e;
        } finally {
            sslSocket.setSoTimeout(oldTimeout);
        }
    }

    @Override
    public void close() throws IOException {
        if (delegate != null) {
            delegate.close();
        }
        super.close();
    }

    @Override
    public boolean isBound() {
        return delegate != null && delegate.isBound();
    }

    @Override
    public boolean isClosed() {
        return delegate == null || delegate.isClosed();
    }

    @Override
    public int getLocalPort() {
        return delegate != null ? delegate.getLocalPort() : -1;
    }
}
