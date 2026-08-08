"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applySendingGate = applySendingGate;
const common_1 = require("@nestjs/common");
async function applySendingGate(hookManager, sessionId, type, input, source) {
    const { continue: shouldContinue, data: hookData } = await hookManager.execute('message:sending', { sessionId, input, type }, { sessionId, source });
    if (!shouldContinue) {
        throw new common_1.BadRequestException('Message sending blocked by plugin');
    }
    return hookData.input;
}
//# sourceMappingURL=sending-gate.js.map