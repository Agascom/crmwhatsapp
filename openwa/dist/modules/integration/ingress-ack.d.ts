import type { IngressResponseContract } from '../../core/plugins/plugin.interfaces';
export interface AckRenderCtx {
    rawBody: string;
    timestamp: string;
    id: string;
}
export type AckResult = {
    status: number;
    body?: string;
    headers?: Record<string, string>;
};
export declare function renderAck(spec: IngressResponseContract['ack'] | undefined, ctx: AckRenderCtx): AckResult;
