import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
export declare const THROTTLER_REDIS_COMMAND_TIMEOUT_MS = 2000;
export declare function buildThrottlerRedisOptions(configService: ConfigService): RedisOptions;
export declare function createThrottlerRedisClient(configService: ConfigService): Redis;
