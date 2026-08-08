"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionRestrictionStore = void 0;
const common_1 = require("@nestjs/common");
const session_restriction_metrics_1 = require("../../common/metrics/session-restriction-metrics");
let SessionRestrictionStore = class SessionRestrictionStore {
    restrictions = new Map();
    set(sessionId, restriction) {
        const previous = this.restrictions.get(sessionId);
        this.restrictions.set(sessionId, restriction);
        this.publishCount();
        return previous?.kind !== restriction.kind || previous?.code !== restriction.code;
    }
    publishCount() {
        let inForce = 0;
        for (const sessionId of this.restrictions.keys()) {
            if (this.inForce(sessionId))
                inForce++;
        }
        (0, session_restriction_metrics_1.setRestrictedSessionCount)(inForce);
    }
    get(sessionId) {
        return this.inForce(sessionId);
    }
    inForce(sessionId) {
        const restriction = this.restrictions.get(sessionId);
        if (!restriction)
            return undefined;
        if (restriction.expiresAt != null && restriction.expiresAt <= Date.now())
            return undefined;
        return restriction;
    }
    clear(sessionId) {
        const previous = this.restrictions.get(sessionId);
        this.restrictions.delete(sessionId);
        this.publishCount();
        return previous;
    }
    clearIfDisprovedByReady(sessionId) {
        const previous = this.restrictions.get(sessionId);
        if (!previous || previous.kind === 'reachout_timelock')
            return undefined;
        return this.clear(sessionId);
    }
    size() {
        let inForce = 0;
        for (const sessionId of this.restrictions.keys()) {
            if (this.inForce(sessionId))
                inForce++;
        }
        return inForce;
    }
    attachTo(session) {
        session.restriction = this.inForce(session.id) ?? null;
        return session;
    }
};
exports.SessionRestrictionStore = SessionRestrictionStore;
exports.SessionRestrictionStore = SessionRestrictionStore = __decorate([
    (0, common_1.Injectable)()
], SessionRestrictionStore);
//# sourceMappingURL=session-restriction-store.service.js.map