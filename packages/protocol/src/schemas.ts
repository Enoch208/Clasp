import { z } from "zod";
import { GRANTABLE, VOCABULARY } from "./permissions";
import { isValidAmount } from "./money";

export const amountString = z
  .string()
  .refine(isValidAmount, "must be a non-negative integer string in the smallest unit (shannons)");

export const grantablePermission = z.enum(GRANTABLE);
export const vocabularyPermission = z.enum(VOCABULARY);

export const limitsSchema = z.object({
  asset: z.string().min(1),
  maxSinglePayment: amountString,
  maxSessionSpend: amountString,
});
export type Limits = z.infer<typeof limitsSchema>;

export const pairingRequestSchema = z.object({
  version: z.literal("1"),
  pairingId: z.string().min(1),
  app: z.object({
    name: z.string().min(1),
    origin: z.string().min(1),
    icon: z.string().optional(),
  }),
  requestedPermissions: z.array(vocabularyPermission),
  requestedLimits: limitsSchema,
  expiresAt: z.string().min(1),
  nonce: z.string().min(1),
  appPubKey: z.string().min(1),
});
export type PairingRequest = z.infer<typeof pairingRequestSchema>;

export const sessionFactsSchema = z.object({
  sessionId: z.string().min(1),
  origin: z.string().min(1),
  permissions: z.array(grantablePermission),
  asset: z.string().min(1),
  maxSinglePayment: amountString,
  maxSessionSpend: amountString,
  expiresAt: z.string().min(1),
  appPubKey: z.string().min(1),
});
export type SessionFacts = z.infer<typeof sessionFactsSchema>;

export const paymentParamsSchema = z.object({
  invoice: z.string().min(1),
  amount: amountString,
  asset: z.string().min(1),
  purpose: z.string().optional(),
});
export type PaymentParams = z.infer<typeof paymentParamsSchema>;

export const operationRequestSchema = z.object({
  version: z.literal("1"),
  sessionId: z.string().min(1),
  requestId: z.string().min(1),
  operation: vocabularyPermission,
  parameters: z.record(z.string(), z.unknown()).default({}),
  nonce: z.number().int().nonnegative(),
  timestamp: z.number().int(),
  signature: z.string().min(1),
});
export type OperationRequest = z.infer<typeof operationRequestSchema>;

export const delegationRequestSchema = z.object({
  version: z.literal("1"),
  parentSessionId: z.string().min(1),
  delegationId: z.string().min(1),
  childAppPubKey: z.string().min(1),
  permissions: z.array(grantablePermission),
  asset: z.string().min(1),
  maxSinglePayment: amountString,
  maxSessionSpend: amountString,
  expiresAt: z.string().min(1),
  timestamp: z.number().int(),
  signature: z.string().min(1),
});
export type DelegationRequest = z.infer<typeof delegationRequestSchema>;

export const sessionStatementSchema = z.object({
  version: z.literal("1"),
  sessionId: z.string().min(1),
  origin: z.string().min(1),
  asset: z.string().min(1),
  maxSessionSpend: amountString,
  spent: amountString,
  sessionRemaining: amountString,
  paymentCount: z.number().int().nonnegative(),
  state: z.string().min(1),
  expiresAt: z.string().min(1),
  issuedAt: z.string().min(1),
  signature: z.string().min(1),
});
export type SessionStatement = z.infer<typeof sessionStatementSchema>;

export const operationResultSchema = z.object({
  requestId: z.string().min(1),
  status: z.enum(["succeeded", "failed"]),
  paymentHash: z.string().optional(),
  amount: amountString.optional(),
  asset: z.string().optional(),
  settledAt: z.string().optional(),
  sessionRemaining: amountString,
  signature: z.string().min(1),
});
export type OperationResult = z.infer<typeof operationResultSchema>;
