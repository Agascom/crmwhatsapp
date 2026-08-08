export type CapabilityStatus = 'supported' | 'not-available';
export type RootCause = 'adapter-gap' | 'library-limitation' | 'uncertain';
export interface AdapterCapability {
    status: CapabilityStatus;
    rootCause?: RootCause;
}
export interface MethodCapability {
    wwjs: AdapterCapability;
    baileys: AdapterCapability;
    evidence?: string;
}
export declare const ENGINE_CAPABILITY_MATRIX: Record<string, MethodCapability>;
