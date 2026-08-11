import type { LanguageModel } from 'ai';

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Registry ─────────────────────────────────────────────────────────────────

/**
 * Every model any AI-calling feature can be pointed at. This is the *only*
 * place a provider SDK (`@ai-sdk/groq`, `@ai-sdk/openai`, `@ai-sdk/anthropic`)
 * gets imported — a feature resolves a model through `resolveModel()` below,
 * never by importing a provider SDK itself. Swapping the default model is a
 * one-line change to DEFAULT_MODEL_KEY, not a code change to any caller.
 */
export const MODEL_REGISTRY = {
    // Free on Groq; text-only.
    'groq:compound-mini': {
        provider: 'groq',
        modelId: 'groq/compound-mini',
        supportsVision: false,
    },
    // Free on Groq; larger compound model when you need more reasoning.
    'groq:compound': {
        provider: 'groq',
        modelId: 'groq/compound',
        supportsVision: false,
    },
    // Groq vision model (paid).
    'groq:qwen3.6-27b': {
        provider: 'groq',
        modelId: 'qwen/qwen3.6-27b',
        supportsVision: true,
    },
    // OpenRouter free vision models (no credit card required).
    'openrouter:nemotron-nano-12b-v2-vl-free': {
        provider: 'openrouter',
        modelId: 'nvidia/nemotron-nano-12b-v2-vl:free',
        supportsVision: true,
    },
    'openrouter:gemma-4-26b-a4b-it-free': {
        provider: 'openrouter',
        modelId: 'google/gemma-4-26b-a4b-it:free',
        supportsVision: true,
    },
    // Paid alternatives.
    'openai:gpt-4o': {
        provider: 'openai',
        modelId: 'gpt-4o',
        supportsVision: true,
    },
    'anthropic:claude-3-5-sonnet': {
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet-20241022',
        supportsVision: true,
    },
} as const satisfies Record<string, ModelDescriptor>;

export type ModelKey = keyof typeof MODEL_REGISTRY;

/** The model used when nothing else is configured — free OpenRouter vision model. */
export const DEFAULT_MODEL_KEY: ModelKey = 'openrouter:nemotron-nano-12b-v2-vl-free';

export function getModelDescriptor(key: ModelKey): ModelDescriptor {
    return MODEL_REGISTRY[key];
}

/**
 * Resolves a registry key to an actual AI SDK LanguageModel instance.
 * Each provider reads its own API key from its own env var by default, so
 * adding a provider here never touches the other providers' configuration.
 *
 * Async and importing each provider SDK lazily (`await import(...)`) rather
 * than via a static top-level import is deliberate, not stylistic: as of
 * AI SDK v4, `@ai-sdk/groq`/`@ai-sdk/openai`/`@ai-sdk/anthropic` are
 * ESM-only (`"type": "module"`, no CJS build), but this backend compiles to
 * CommonJS (`apps/api/tsconfig.json`'s `module: "commonjs"`). A static
 * `import`/`require` of any of them would crash with `ERR_REQUIRE_ESM` the
 * moment anything loads this file — before `resolveModel` is ever called.
 * Dynamic `import()` is Node's supported interop path for CJS code
 * consuming an ESM-only package, and TypeScript's commonjs emit preserves
 * it as a real dynamic import rather than downleveling it to `require()`.
 *
 * @param apiKeyOverride - A user-supplied (BYOK) key, already decrypted by
 *   the caller, to use in place of the app's shared env-var key for this one
 *   call. Never logged, never persisted here — the caller owns that.
 */
export async function resolveModel(key: ModelKey, apiKeyOverride?: string): Promise<LanguageModel> {
    const descriptor = MODEL_REGISTRY[key];

    switch (descriptor.provider) {
        case 'groq': {
            const { createGroq } = await import('@ai-sdk/groq');
            return createGroq({ apiKey: apiKeyOverride ?? process.env.GROQ_API_KEY })(descriptor.modelId);
        }
        case 'openai': {
            const { createOpenAI } = await import('@ai-sdk/openai');
            return createOpenAI({ apiKey: apiKeyOverride ?? process.env.OPENAI_API_KEY })(descriptor.modelId);
        }
        case 'anthropic': {
            const { createAnthropic } = await import('@ai-sdk/anthropic');
            return createAnthropic({ apiKey: apiKeyOverride ?? process.env.ANTHROPIC_API_KEY })(descriptor.modelId);
        }
        case 'openrouter': {
            // .chat(...) forces the Chat Completions endpoint. Calling the provider
            // directly defaults to the Responses API, which OpenRouter supports far
            // less reliably (observed: free models hanging for minutes then
            // returning an empty/whitespace-only body instead of a completion).
            const { createOpenAI } = await import('@ai-sdk/openai');
            return createOpenAI({
                baseURL: 'https://openrouter.ai/api/v1',
                apiKey: apiKeyOverride ?? process.env.OPENROUTER_API_KEY,
            }).chat(descriptor.modelId);
        }
    }
}
