"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineRegistry = void 0;
const common_1 = require("@nestjs/common");
let EngineRegistry = class EngineRegistry {
    engines = new Map();
    initializing = new Set();
    get(id) {
        return this.engines.get(id);
    }
    set(id, engine) {
        this.engines.set(id, engine);
    }
    has(id) {
        return this.engines.has(id);
    }
    delete(id) {
        return this.engines.delete(id);
    }
    clear() {
        this.engines.clear();
    }
    get size() {
        return this.engines.size;
    }
    keys() {
        return this.engines.keys();
    }
    entries() {
        return [...this.engines];
    }
    [Symbol.iterator]() {
        return this.entries()[Symbol.iterator]();
    }
    isLive(id, engine) {
        return this.engines.get(id) === engine;
    }
    deleteIfLive(id, engine) {
        if (!this.isLive(id, engine)) {
            return false;
        }
        return this.engines.delete(id);
    }
    require(id, onMissing = () => new common_1.BadRequestException('Session is not started')) {
        const engine = this.engines.get(id);
        if (!engine) {
            throw onMissing();
        }
        return engine;
    }
    activeIds() {
        return [...new Set([...this.engines.keys(), ...this.initializing])];
    }
};
exports.EngineRegistry = EngineRegistry;
exports.EngineRegistry = EngineRegistry = __decorate([
    (0, common_1.Injectable)()
], EngineRegistry);
//# sourceMappingURL=engine-registry.service.js.map