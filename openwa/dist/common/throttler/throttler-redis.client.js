"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.THROTTLER_REDIS_COMMAND_TIMEOUT_MS = void 0;
exports.buildThrottlerRedisOptions = buildThrottlerRedisOptions;
exports.createThrottlerRedisClient = createThrottlerRedisClient;
const ioredis_1 = __importDefault(require("ioredis"));
exports.THROTTLER_REDIS_COMMAND_TIMEOUT_MS = 2000;
function buildThrottlerRedisOptions(configService) {
    return {
        host: configService.get('redis.host', 'localhost'),
        port: configService.get('redis.port', 6379),
        username: configService.get('redis.username'),
        password: configService.get('redis.password'),
        connectTimeout: configService.get('redis.connectTimeoutMs', 5000),
        enableOfflineQueue: false,
        autoResendUnfulfilledCommands: false,
        commandTimeout: exports.THROTTLER_REDIS_COMMAND_TIMEOUT_MS,
        maxRetriesPerRequest: null,
    };
}
function createThrottlerRedisClient(configService) {
    return new ioredis_1.default(buildThrottlerRedisOptions(configService));
}
//# sourceMappingURL=throttler-redis.client.js.map