import { ConfigService } from '@nestjs/config';
import type { ConvertMediaDto } from './dto/convert-media.dto';
export interface ConvertedMedia {
    base64: string;
    mimetype: string;
    bytes: number;
}
export declare class MediaConversionService {
    private readonly configService;
    private readonly logger;
    private binaryAvailable?;
    private readonly ffmpegGate;
    constructor(configService: ConfigService);
    convertToVoice(dto: ConvertMediaDto): Promise<ConvertedMedia>;
    convertToVideo(dto: ConvertMediaDto): Promise<ConvertedMedia>;
    isAvailable(): Promise<boolean>;
    private convert;
    private resolveInput;
    private assertAvailable;
    private probeOnce;
}
