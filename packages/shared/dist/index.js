"use strict";
/**
 * @opp/shared
 * Shared types, constants, and utilities consumed by both the frontend and backend.
 *
 * Add your shared code here (DTOs, Zod schemas, enums, helper functions, etc.)
 */
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// ─── Re-export everything below as you add modules ────────────────────────────
__exportStar(require("./schemas/invoice.schema"), exports);
__exportStar(require("./schemas/receipt.schema"), exports);
__exportStar(require("./schemas/resume.schema"), exports);
__exportStar(require("./schemas/document-response.schema"), exports);
