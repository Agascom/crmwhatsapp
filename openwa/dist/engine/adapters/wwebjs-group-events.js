"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wwebjsGroupUpdateChanges = wwebjsGroupUpdateChanges;
exports.wwebjsGroupRecipientIds = wwebjsGroupRecipientIds;
function parseWwebjsOnOff(body) {
    const v = body.trim().toLowerCase();
    if (v === 'on' || v === 'true')
        return true;
    if (v === 'off' || v === 'false')
        return false;
    return undefined;
}
function wwebjsGroupUpdateChanges(notification) {
    const body = typeof notification.body === 'string' ? notification.body : '';
    switch (String(notification.type)) {
        case 'subject':
            return { subject: body };
        case 'description':
            return { description: body };
        case 'announce': {
            const on = parseWwebjsOnOff(body);
            return on === undefined ? {} : { announce: on };
        }
        case 'restrict':
        case 'locked': {
            const on = parseWwebjsOnOff(body);
            return on === undefined ? {} : { locked: on };
        }
        default:
            return {};
    }
}
function wwebjsGroupRecipientIds(notification) {
    const raw = notification.recipientIds;
    if (!Array.isArray(raw))
        return [];
    return raw
        .map(entry => {
        if (typeof entry === 'string')
            return entry;
        const wid = entry;
        return wid?._serialized ?? wid?.$1 ?? '';
    })
        .filter(id => id.length > 0);
}
//# sourceMappingURL=wwebjs-group-events.js.map