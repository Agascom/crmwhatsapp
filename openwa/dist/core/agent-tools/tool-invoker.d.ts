import type { AuthService } from '../../modules/auth/auth.service';
import type { AnyToolDescriptor } from './tool-descriptor';
export declare function invokeTool(tool: AnyToolDescriptor, rawInput: unknown, rawKey: string | undefined, authService: AuthService, onAuthenticated?: (apiKeyId: string) => void, onAuthFailure?: (error: unknown) => void): Promise<unknown>;
