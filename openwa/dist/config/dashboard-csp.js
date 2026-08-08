"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DASHBOARD_CSP_NONCE_PLACEHOLDER = void 0;
exports.injectDashboardCspNonce = injectDashboardCspNonce;
exports.DASHBOARD_CSP_NONCE_PLACEHOLDER = '__OPENWA_CSP_NONCE__';
function injectDashboardCspNonce(html, nonce) {
    return html.replace(exports.DASHBOARD_CSP_NONCE_PLACEHOLDER, nonce);
}
//# sourceMappingURL=dashboard-csp.js.map