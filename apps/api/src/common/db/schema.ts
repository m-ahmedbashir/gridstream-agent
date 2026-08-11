import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  clerkId: text('clerk_id').notNull().unique(),
  planApprovalMode: text('plan_approval_mode').notNull().default('MANUAL_REVIEW'), // "AUTO_APPROVE" | "MANUAL_REVIEW"
  modelKey: text('model_key').notNull().default('groq:llama-4-scout'), // key into MODEL_REGISTRY (apps/api/src/common/ai/model-registry.ts)
  encryptedApiKey: text('encrypted_api_key'), // AES-256-GCM ciphertext (see common/crypto/) — NEVER the plaintext key. Null = use the app's shared key.
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
