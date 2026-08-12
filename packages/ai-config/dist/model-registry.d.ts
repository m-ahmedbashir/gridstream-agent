import type { LanguageModel } from 'ai';
export type ModelProviderName = 'groq' | 'openai' | 'anthropic' | 'openrouter';
export interface ModelDescriptor {
    provider: ModelProviderName;
    modelId: string;
    /**
     * Whether this model accepts image content parts. Plenty of text-only
     * models exist — any caller sending an image (e.g. a photo attached to a
     * fault report) must check this first, never assume every model can see.
     */
    supportsVision: boolean;
}
/**
 * Every model any AI-calling feature — in either app — can be pointed at.
 * This is the *only* place a provider SDK (`@ai-sdk/groq`, `@ai-sdk/openai`,
 * `@ai-sdk/anthropic`) gets imported — a feature resolves a model through
 * `resolveModel()` below, never by importing a provider SDK itself. Swapping
 * the default model is a one-line change to DEFAULT_MODEL_KEY, not a code
 * change to any caller.
 */
export declare const MODEL_REGISTRY: {
    readonly 'groq:compound-mini': {
        readonly provider: "groq";
        readonly modelId: "groq/compound-mini";
        readonly supportsVision: false;
    };
    readonly 'groq:compound': {
        readonly provider: "groq";
        readonly modelId: "groq/compound";
        readonly supportsVision: false;
    };
    readonly 'groq:qwen3.6-27b': {
        readonly provider: "groq";
        readonly modelId: "qwen/qwen3.6-27b";
        readonly supportsVision: true;
    };
    readonly 'openrouter:nemotron-nano-12b-v2-vl-free': {
        readonly provider: "openrouter";
        readonly modelId: "nvidia/nemotron-nano-12b-v2-vl:free";
        readonly supportsVision: true;
    };
    readonly 'openrouter:gemma-4-26b-a4b-it-free': {
        readonly provider: "openrouter";
        readonly modelId: "google/gemma-4-26b-a4b-it:free";
        readonly supportsVision: true;
    };
    readonly 'openai:gpt-4o': {
        readonly provider: "openai";
        readonly modelId: "gpt-4o";
        readonly supportsVision: true;
    };
    readonly 'anthropic:claude-3-5-sonnet': {
        readonly provider: "anthropic";
        readonly modelId: "claude-3-5-sonnet-20241022";
        readonly supportsVision: true;
    };
};
export type ModelKey = keyof typeof MODEL_REGISTRY;
/** The model used when nothing else is configured — free OpenRouter vision model. */
export declare const DEFAULT_MODEL_KEY: ModelKey;
export declare function getModelDescriptor(key: ModelKey): ModelDescriptor;
/**
 * Resolves a registry key to an actual AI SDK LanguageModel instance.
 * Each provider reads its own API key from its own env var by default, so
 * adding a provider here never touches the other providers' configuration.
 *
 * Async and importing each provider SDK lazily (`await import(...)`) rather
 * than via a static top-level import is deliberate, not stylistic: as of
 * AI SDK v4, `@ai-sdk/groq`/`@ai-sdk/openai`/`@ai-sdk/anthropic` are
 * ESM-only (`"type": "module"`, no CJS build). This package itself compiles
 * to CommonJS (see tsconfig.json), and both current consumers (`apps/api`'s
 * NestJS backend and `apps/web`'s Next.js Route Handlers) run under Node's
 * CommonJS module system too — a static `import`/`require` of any of these
 * provider packages would crash with `ERR_REQUIRE_ESM` the moment anything
 * loads this file, before `resolveModel` is ever called. Dynamic `import()`
 * is Node's supported interop path for CJS code consuming an ESM-only
 * package, and TypeScript's commonjs emit preserves it as a real dynamic
 * import rather than downleveling it to `require()`.
 *
 * @param apiKeyOverride - A user-supplied (BYOK) key, already decrypted by
 *   the caller, to use in place of the app's shared env-var key for this one
 *   call. Never logged, never persisted here — the caller owns that.
 */
export declare function resolveModel(key: ModelKey, apiKeyOverride?: string): Promise<LanguageModel>;
