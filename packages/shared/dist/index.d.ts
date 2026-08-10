/**
 * @maintain/shared
 * Shared types, constants, and utilities consumed by both the frontend and backend.
 *
 * Add your shared code here (DTOs, Zod schemas, enums, helper functions, etc.)
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}
export * from './schemas/document-response.schema';
export * from './schemas/maintenance.schema';
