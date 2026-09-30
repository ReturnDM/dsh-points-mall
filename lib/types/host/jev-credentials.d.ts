import { type CredentialProvider } from '@deepseek-ai/dsh-credentials';
type Provider = Pick<CredentialProvider, 'resolve' | 'describe' | 'set' | 'unset'>;
/** Expose metadata only, never the stored value or provider errors. */
export declare function createJevCredentials(provider: Provider): {
    resolveKey(): Promise<string | undefined>;
    fetch(request: Request): Promise<Response>;
};
export {};
