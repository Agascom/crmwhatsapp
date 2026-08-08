"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRestrictedSessionCount = setRestrictedSessionCount;
exports.getRestrictedSessionCount = getRestrictedSessionCount;
let restrictedSessions = 0;
function setRestrictedSessionCount(count) {
    restrictedSessions = count;
}
function getRestrictedSessionCount() {
    return restrictedSessions;
}
//# sourceMappingURL=session-restriction-metrics.js.map