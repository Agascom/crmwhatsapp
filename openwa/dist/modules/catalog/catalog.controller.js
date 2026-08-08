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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const catalog_service_1 = require("./catalog.service");
const send_product_dto_1 = require("./dto/send-product.dto");
const auth_decorators_1 = require("../auth/decorators/auth.decorators");
const api_key_entity_1 = require("../auth/entities/api-key.entity");
const catalog_response_dto_1 = require("./dto/catalog-response.dto");
const CATALOG_TIMEOUT_503 = 'WhatsApp did not answer the catalog query within the request budget — retry shortly.';
let CatalogController = class CatalogController {
    catalogService;
    constructor(catalogService) {
        this.catalogService = catalogService;
    }
    async getCatalog(sessionId) {
        return this.catalogService.getCatalog(sessionId);
    }
    async getProducts(sessionId, query) {
        return this.catalogService.getProducts(sessionId, query.page, query.limit);
    }
    async getProduct(sessionId, productId) {
        return this.catalogService.getProduct(sessionId, productId);
    }
    async sendProduct(sessionId, dto) {
        return this.catalogService.sendProduct(sessionId, dto.chatId, dto.productId, dto.body);
    }
    async sendCatalog(sessionId, dto) {
        return this.catalogService.sendCatalog(sessionId, dto.chatId, dto.body);
    }
};
exports.CatalogController = CatalogController;
__decorate([
    (0, common_1.Get)('catalog'),
    (0, swagger_1.ApiOperation)({ summary: 'Get business catalog info (Baileys engine only)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Catalog summary, or an empty body when the account has no collection to describe.',
        type: catalog_response_dto_1.CatalogDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 501,
        description: 'Not supported by the active engine: whatsapp-web.js has no catalog API.',
    }),
    (0, swagger_1.ApiResponse)({ status: 503, description: CATALOG_TIMEOUT_503 }),
    __param(0, (0, common_1.Param)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getCatalog", null);
__decorate([
    (0, common_1.Get)('catalog/products'),
    (0, swagger_1.ApiOperation)({ summary: 'List catalog products (Baileys engine only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'One page of catalog products', type: catalog_response_dto_1.PaginatedProductsDto }),
    (0, swagger_1.ApiResponse)({
        status: 501,
        description: 'Not supported by the active engine: whatsapp-web.js has no catalog API.',
    }),
    (0, swagger_1.ApiResponse)({ status: 503, description: CATALOG_TIMEOUT_503 }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, send_product_dto_1.ProductQueryDto]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getProducts", null);
__decorate([
    (0, common_1.Get)('catalog/products/:productId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a specific product (Baileys engine only)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'The product, or an empty body when no product in the catalog carries that id.',
        type: catalog_response_dto_1.ProductDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 501,
        description: 'Not supported by the active engine: whatsapp-web.js has no catalog API.',
    }),
    (0, swagger_1.ApiResponse)({ status: 503, description: CATALOG_TIMEOUT_503 }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getProduct", null);
__decorate([
    (0, common_1.Post)('messages/send-product'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Send a product message (Baileys engine only)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Product message accepted for sending', type: catalog_response_dto_1.ProductMessageResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Product id not found in the session catalog.' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Product has no image — a product card requires one.' }),
    (0, swagger_1.ApiResponse)({
        status: 501,
        description: 'Not supported by the active engine: whatsapp-web.js cannot send product messages.',
    }),
    (0, swagger_1.ApiResponse)({ status: 503, description: CATALOG_TIMEOUT_503 }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, send_product_dto_1.SendProductDto]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "sendProduct", null);
__decorate([
    (0, common_1.Post)('messages/send-catalog'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Send catalog link (not supported by any engine)' }),
    (0, swagger_1.ApiResponse)({ status: 501, description: 'Not supported by the active engine: no engine can send catalog links.' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, send_product_dto_1.SendCatalogDto]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "sendCatalog", null);
exports.CatalogController = CatalogController = __decorate([
    (0, swagger_1.ApiTags)('catalog'),
    (0, common_1.Controller)('sessions/:sessionId'),
    __metadata("design:paramtypes", [catalog_service_1.CatalogService])
], CatalogController);
//# sourceMappingURL=catalog.controller.js.map