/**
 * @opp/shared
 * Shared types, constants, and utilities consumed by both the frontend and backend.
 *
 * Add your shared code here (DTOs, Zod schemas, enums, helper functions, etc.)
 */

// ─── Example: shared API response envelope ───────────────────────────────────

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

// ─── Re-export everything below as you add modules ────────────────────────────
// export * from './types/user';
// export * from './schemas/auth';
