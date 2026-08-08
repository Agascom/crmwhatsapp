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
exports.MediaConversionService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const logger_service_1 = require("../../common/services/logger.service");
const load_remote_media_1 = require("../../common/media/load-remote-media");
const ssrf_guard_1 = require("../../common/security/ssrf-guard");
const concurrency_limiter_1 = require("../../common/utils/concurrency-limiter");
const media_cap_util_1 = require("../message/media-cap.util");
const ffmpeg_1 = require("./ffmpeg");
let MediaConversionService = class MediaConversionService {
    configService;
    logger = (0, logger_service_1.createLogger)('MediaConversionService');
    binaryAvailable;
    ffmpegGate;
    constructor(configService) {
        this.configService = configService;
        const concurrency = this.configService.get('mediaConversion.concurrency', 2);
        this.ffmpegGate = new concurrency_limiter_1.ConcurrencyLimiter(concurrency, concurrency * 4);
    }
    async convertToVoice(dto) {
        return this.convert(dto, 'ogg', (0, ffmpeg_1.voiceEncodeArgs)(), 'audio/ogg; codecs=opus');
    }
    async convertToVideo(dto) {
        return this.convert(dto, 'mp4', (0, ffmpeg_1.videoEncodeArgs)(), 'video/mp4');
    }
    async isAvailable() {
        if (!this.configService.get('mediaConversion.enabled', false))
            return false;
        return this.probeOnce();
    }
    async convert(dto, outputExtension, encodeArgs, outputMimetype) {
        await this.assertAvailable();
        const input = await this.resolveInput(dto);
        try {
            const output = await this.ffmpegGate.run(() => (0, ffmpeg_1.runFfmpeg)(input, 'bin', outputExtension, encodeArgs, {
                ffmpegPath: this.configService.get('mediaConversion.ffmpegPath', 'ffmpeg'),
                timeoutMs: this.configService.get('mediaConversion.timeoutMs', 60_000),
                maxOutputBytes: this.configService.get('mediaConversion.maxOutputBytes', 50 * 1024 * 1024),
            }));
            this.logger.log('Media converted', { inputBytes: input.length, outputBytes: output.length, outputMimetype });
            return { base64: output.toString('base64'), mimetype: outputMimetype, bytes: output.length };
        }
        catch (error) {
            if (error instanceof Error && error.message === 'ConcurrencyLimiter queue full') {
                throw new common_1.ServiceUnavailableException('Media conversion is busy — retry shortly');
            }
            if (error instanceof ffmpeg_1.FfmpegConversionError) {
                this.logger.warn('Media conversion failed', { reason: error.message, detail: error.detail });
                throw new common_1.BadRequestException(error.detail ? `${error.message}: ${error.detail}` : error.message);
            }
            throw error;
        }
    }
    async resolveInput(dto) {
        if (dto.base64) {
            (0, media_cap_util_1.assertBase64WithinMediaCap)(dto.base64);
            const data = Buffer.from((0, media_cap_util_1.stripBase64DataUri)(dto.base64) ?? '', 'base64');
            if (data.length === 0)
                throw new common_1.BadRequestException('base64 did not decode to any bytes');
            return data;
        }
        if (dto.url) {
            try {
                const { data } = await (0, load_remote_media_1.loadRemoteMediaBuffer)(dto.url);
                return data;
            }
            catch (error) {
                if (error instanceof ssrf_guard_1.SsrfBlockedError) {
                    throw new common_1.BadRequestException(ssrf_guard_1.SSRF_BLOCKED_CLIENT_MESSAGE);
                }
                if (error instanceof common_1.HttpException)
                    throw error;
                throw new common_1.BadRequestException(error instanceof Error ? error.message : String(error));
            }
        }
        throw new common_1.BadRequestException('Either url or base64 must be provided');
    }
    async assertAvailable() {
        if (!this.configService.get('mediaConversion.enabled', false)) {
            throw new common_1.ServiceUnavailableException('Media conversion is disabled. Set MEDIA_CONVERSION_ENABLED=true to enable it.');
        }
        if (!(await this.probeOnce())) {
            throw new common_1.ServiceUnavailableException('Media conversion is enabled but the ffmpeg binary could not be run. Install ffmpeg, or set FFMPEG_PATH.');
        }
    }
    probeOnce() {
        this.binaryAvailable ??= (0, ffmpeg_1.probeFfmpeg)(this.configService.get('mediaConversion.ffmpegPath', 'ffmpeg')).then(available => {
            if (!available)
                this.logger.warn('Media conversion is enabled but ffmpeg could not be run');
            return available;
        });
        return this.binaryAvailable;
    }
};
exports.MediaConversionService = MediaConversionService;
exports.MediaConversionService = MediaConversionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MediaConversionService);
//# sourceMappingURL=media-conversion.service.js.map