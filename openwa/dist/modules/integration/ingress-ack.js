"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderAck = renderAck;
function renderAck(spec, ctx) {
    if (!spec)
        return { status: 202, body: 'accepted' };
    const result = { status: spec.status ?? 202 };
    if (spec.body !== undefined) {
        result.body = substitute(spec.body, ctx);
    }
    if (spec.headers)
        result.headers = { ...spec.headers };
    return result;
}
function substitute(template, ctx) {
    return template
        .split('{rawBody}')
        .join(ctx.rawBody)
        .split('{timestamp}')
        .join(ctx.timestamp)
        .split('{id}')
        .join(ctx.id);
}
//# sourceMappingURL=ingress-ack.js.map