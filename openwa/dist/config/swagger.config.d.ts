import { OpenAPIObject } from '@nestjs/swagger';
export declare const API_KEY_SECURITY_SCHEME = "X-API-Key";
export declare const METRICS_BEARER_SCHEME = "metrics-bearer";
export declare const PUBLIC_PATHS: string[];
export declare function dropUnexpressibleOperations(document: OpenAPIObject): OpenAPIObject;
export declare function exemptPublicOperations(document: OpenAPIObject): OpenAPIObject;
export declare function createSwaggerConfig(): Omit<OpenAPIObject, 'paths'>;
