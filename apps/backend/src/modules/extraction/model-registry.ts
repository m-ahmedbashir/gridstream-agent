import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';

// ── Types ────────────────────────────────────────────────────────────────────

export type ModelProviderName = 'groq' | 'openai' | 'anthropic';

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
    'groq:llama-4-scout': {
        provider: 'groq',
        modelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
        supportsVision: true,
    },
    'groq:llama-3.3-70b': {
        provider: 'groq',
        modelId: 'llama-3.3-70b-versatile',
        supportsVision: false,
    },
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

/** The model used when nothing else is configured — today's behavior, unchanged. */
export const DEFAULT_MODEL_KEY: ModelKey = 'groq:llama-4-scout';

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
    }
}

// ── Processing mode ──────────────────────────────────────────────────────────

/**
 * How images and scanned PDF pages get read:
 *  - 'vision': sent as image content parts to a vision-capable model (the
 *    original behavior). Better on messy/handwritten/angled scans.
 *  - 'local-ocr': read locally via Tesseract before anything leaves the
 *    server, so the resulting text goes through the same PII-masking
 *    pipeline that already protects typed/pasted text. More private, weaker
 *    on messy scans — see OcrService and roadmap/phase4.md.
 */
export type ProcessingMode = 'vision' | 'local-ocr';

export const PROCESSING_MODES: readonly ProcessingMode[] = ['vision', 'local-ocr'];

export const DEFAULT_PROCESSING_MODE: ProcessingMode = 'vision';

export function isProcessingMode(value: unknown): value is ProcessingMode {
    return typeof value === 'string' && (PROCESSING_MODES as readonly string[]).includes(value);
}
