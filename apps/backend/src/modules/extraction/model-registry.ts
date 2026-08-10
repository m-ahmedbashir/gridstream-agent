import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';

// ── Types ────────────────────────────────────────────────────────────────────

export type ModelProviderName = 'groq' | 'openai' | 'anthropic' | 'openrouter';

export interface ModelDescriptor {
    provider: ModelProviderName;
    modelId: string;
    /**
     * Whether this model accepts image content parts. Plenty of text-only
     * models exist — the extraction pipeline must check this before sending
     * an image, not assume every model can see.
     */
    supportsVision: boolean;
}

// ── Registry ─────────────────────────────────────────────────────────────────

/**
 * Every model the extraction pipeline can be pointed at. Swapping the default
 * model is a one-line change to DEFAULT_MODEL_KEY below, not a code change to
 * ExtractionService — that's the entire point of this file.
 */
export const MODEL_REGISTRY = {
    // Free on Groq; text-only, so images/scanned PDFs must go through local OCR.
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
 * @param apiKeyOverride - A user-supplied (BYOK) key, already decrypted by
 *   the caller, to use in place of the app's shared env-var key for this one
 *   call. Never logged, never persisted here — the caller owns that.
 */
export function resolveModel(key: ModelKey, apiKeyOverride?: string): LanguageModel {
    const descriptor = MODEL_REGISTRY[key];

    switch (descriptor.provider) {
        case 'groq':
            return createGroq({ apiKey: apiKeyOverride ?? process.env.GROQ_API_KEY })(descriptor.modelId);
        case 'openai':
            return createOpenAI({ apiKey: apiKeyOverride ?? process.env.OPENAI_API_KEY })(descriptor.modelId);
        case 'anthropic':
            return createAnthropic({ apiKey: apiKeyOverride ?? process.env.ANTHROPIC_API_KEY })(descriptor.modelId);
        case 'openrouter':
            // .chat(...) forces the Chat Completions endpoint. Calling the provider
            // directly defaults to the Responses API, which OpenRouter supports far
            // less reliably (observed: free models hanging for minutes then
            // returning an empty/whitespace-only body instead of a completion).
            return createOpenAI({
                baseURL: 'https://openrouter.ai/api/v1',
                apiKey: apiKeyOverride ?? process.env.OPENROUTER_API_KEY,
            }).chat(descriptor.modelId);
    }
}

// ── Processing mode ──────────────────────────────────────────────────────────

/**
 * How images and scanned PDF pages get read:
 *  - 'vision': sent as image content parts to a vision-capable model.
 *    Better on messy/handwritten/angled scans; default because the default
 *    OpenRouter model is vision-capable and free.
 *  - 'local-ocr': read locally via Tesseract before anything leaves the
 *    server, so the resulting text goes through the same PII-masking
 *    pipeline that already protects typed/pasted text. Use this to switch
 *    to a free text-only Groq model (compound / compound-mini).
 */
export type ProcessingMode = 'vision' | 'local-ocr';

export const PROCESSING_MODES: readonly ProcessingMode[] = ['vision', 'local-ocr'];

export const DEFAULT_PROCESSING_MODE: ProcessingMode = 'vision';

export function isProcessingMode(value: unknown): value is ProcessingMode {
    return typeof value === 'string' && (PROCESSING_MODES as readonly string[]).includes(value);
}
