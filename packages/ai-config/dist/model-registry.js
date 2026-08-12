"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MODEL_KEY = exports.MODEL_REGISTRY = void 0;
exports.getModelDescriptor = getModelDescriptor;
exports.resolveModel = resolveModel;
// ── Registry ─────────────────────────────────────────────────────────────────
/**
 * Every model any AI-calling feature — in either app — can be pointed at.
 * This is the *only* place a provider SDK (`@ai-sdk/groq`, `@ai-sdk/openai`,
 * `@ai-sdk/anthropic`) gets imported — a feature resolves a model through
 * `resolveModel()` below, never by importing a provider SDK itself. Swapping
 * the default model is a one-line change to DEFAULT_MODEL_KEY, not a code
 * change to any caller.
 */
exports.MODEL_REGISTRY = {
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
};
/** The model used when nothing else is configured — free OpenRouter vision model. */
exports.DEFAULT_MODEL_KEY = 'openrouter:nemotron-nano-12b-v2-vl-free';
function getModelDescriptor(key) {
    return exports.MODEL_REGISTRY[key];
}
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
async function resolveModel(key, apiKeyOverride) {
    const descriptor = exports.MODEL_REGISTRY[key];
    switch (descriptor.provider) {
        case 'groq': {
            const { createGroq } = await Promise.resolve().then(() => __importStar(require('@ai-sdk/groq')));
            return createGroq({ apiKey: apiKeyOverride ?? process.env.GROQ_API_KEY })(descriptor.modelId);
        }
        case 'openai': {
            const { createOpenAI } = await Promise.resolve().then(() => __importStar(require('@ai-sdk/openai')));
            return createOpenAI({ apiKey: apiKeyOverride ?? process.env.OPENAI_API_KEY })(descriptor.modelId);
        }
        case 'anthropic': {
            const { createAnthropic } = await Promise.resolve().then(() => __importStar(require('@ai-sdk/anthropic')));
            return createAnthropic({ apiKey: apiKeyOverride ?? process.env.ANTHROPIC_API_KEY })(descriptor.modelId);
        }
        case 'openrouter': {
            // .chat(...) forces the Chat Completions endpoint. Calling the provider
            // directly defaults to the Responses API, which OpenRouter supports far
            // less reliably (observed: free models hanging for minutes then
            // returning an empty/whitespace-only body instead of a completion).
            const { createOpenAI } = await Promise.resolve().then(() => __importStar(require('@ai-sdk/openai')));
            return createOpenAI({
                baseURL: 'https://openrouter.ai/api/v1',
                apiKey: apiKeyOverride ?? process.env.OPENROUTER_API_KEY,
            }).chat(descriptor.modelId);
        }
    }
}
