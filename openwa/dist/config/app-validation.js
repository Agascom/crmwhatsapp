"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyGlobalValidation = applyGlobalValidation;
const common_1 = require("@nestjs/common");
const bootstrap_security_1 = require("./bootstrap-security");
function applyGlobalValidation(app) {
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        disableErrorMessages: !(0, bootstrap_security_1.isValidationErrorDetailEnabled)(process.env.VALIDATION_ERROR_DETAIL, process.env.NODE_ENV),
    }));
}
//# sourceMappingURL=app-validation.js.map