"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUncaughtExceptionMonitor = registerUncaughtExceptionMonitor;
exports.registerUnhandledRejectionHandler = registerUnhandledRejectionHandler;
const PAGE_CONTEXT_LOST_REJECTION = /execution context was destroyed|window\.require is not a function/i;
function registerUncaughtExceptionMonitor(logger) {
    process.on('uncaughtExceptionMonitor', (err, origin) => {
        try {
            logger.error(`Uncaught exception (${origin}) — process will exit`, err instanceof Error ? err.stack : String(err));
        }
        catch {
        }
    });
}
function registerUnhandledRejectionHandler(logger) {
    process.on('unhandledRejection', (reason) => {
        const message = reason instanceof Error ? reason.message : String(reason);
        const detail = reason instanceof Error ? reason.stack : String(reason);
        if (PAGE_CONTEXT_LOST_REJECTION.test(message)) {
            logger.warn('Puppeteer rejection after the page it was evaluating went away (navigation or engine ' +
                "teardown) — expected; the session recovers on its own. Check the session's own " +
                'disconnect/failure logs for the outcome.', { reason: detail, action: 'page_context_lost_rejection' });
            return;
        }
        logger.error('Unhandled promise rejection', detail);
    });
}
//# sourceMappingURL=process-error-monitor.js.map