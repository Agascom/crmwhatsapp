"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogService = void 0;
const common_1 = require("@nestjs/common");
const engine_registry_service_1 = require("../../engine/engine-registry.service");
const send_pacing_service_1 = require("../message/send-pacing.service");
let CatalogService = class CatalogService {
    engines;
    pacing;
    constructor(engines, pacing) {
        this.engines = engines;
        this.pacing = pacing;
    }
    async getCatalog(sessionId) {
        const engine = this.engines.require(sessionId, () => new common_1.NotFoundException(`Session ${sessionId} not found or not connected`));
        return engine.getCatalog();
    }
    async getProducts(sessionId, page = 1, limit = 20) {
        const engine = this.engines.require(sessionId, () => new common_1.NotFoundException(`Session ${sessionId} not found or not connected`));
        return engine.getProducts({ page, limit });
    }
    async getProduct(sessionId, productId) {
        const engine = this.engines.require(sessionId, () => new common_1.NotFoundException(`Session ${sessionId} not found or not connected`));
        return engine.getProduct(productId);
    }
    async sendProduct(sessionId, chatId, productId, body) {
        await this.pacing.assertSendAllowed(sessionId, chatId);
        const engine = this.engines.require(sessionId, () => new common_1.NotFoundException(`Session ${sessionId} not found or not connected`));
        return engine.sendProduct(chatId, productId, body);
    }
    async sendCatalog(sessionId, chatId, body) {
        await this.pacing.assertSendAllowed(sessionId, chatId);
        const engine = this.engines.require(sessionId, () => new common_1.NotFoundException(`Session ${sessionId} not found or not connected`));
        return engine.sendCatalog(chatId, body);
    }
};
exports.CatalogService = CatalogService;
exports.CatalogService = CatalogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [engine_registry_service_1.EngineRegistry,
        send_pacing_service_1.SendPacingService])
], CatalogService);
//# sourceMappingURL=catalog.service.js.map