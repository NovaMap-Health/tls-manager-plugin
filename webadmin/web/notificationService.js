/*
 * SPDX-License-Identifier: MPL-2.0
 * Copyright (c) 2026 NovaMap Health Limited <https://novamap.health>
 *
 * Shim: the certificate utils ported from the standalone SPA expect a
 * `notificationService`. Map it onto the web administrator's toast so the
 * parsing/verification code can be reused verbatim.
 */
import { toast } from '@oie/web-ui';

export const notificationService = {
    showError: (m) => toast(String(m), 'error'),
    showSuccess: (m) => toast(String(m), 'success'),
    showInfo: (m) => toast(String(m)),
    showWarning: (m) => toast(String(m), 'warn')
};
