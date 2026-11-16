import { z } from "zod";
import { GRANTABLE, VOCABULARY } from "./permissions";
import { isValidAmount } from "./money";
import { expiryToMillis } from "./time";

export const amountString = z
  .string()
  .refine(isValidAmount, "must be a non-negative integer string in the smallest unit (shannons)");

export const expiryString = z
  .string()
  .min(1)
  .refine((value) => Number.isFinite(expiryToMillis(value)), "must be epoch milliseconds or an ISO-8601 date");

export const grantablePermission = z.enum(GRANTABLE);
export const vocabularyPermission = z.enum(VOCABULARY);

export const rateLimitSchema = z.object({
  maxPayments: z.number().int().positive(),
  windowSeconds: z.number().int().positive(),
});
export type RateLimit = z.infer<typeof rateLimitSchema>;

export const sessionRulesSchema = z.object({
  approvalThreshold: amountString.optional(),
  rateLimit: rateLimitSchema.optional(),
});
export type SessionRules = z.infer<typeof sessionRulesSchema>;

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
  expiresAt: expiryString,
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
  expiresAt: expiryString,
  appPubKey: z.string().min(1),
  ownerPubKey: z.string().min(1).optional(),
  approvalThreshold: amountString.optional(),
  rateLimit: rateLimitSchema.optional(),
});
export type SessionFacts = z.infer<typeof sessionFactsSchema>;

export const sessionApprovalSchema = z.object({
  version: z.literal("1"),
  approvalId: z.string().min(1),
  origin: z.string().min(1),
  permissions: z.array(grantablePermission),
  asset: z.string().min(1),
  maxSinglePayment: amountString,
  maxSessionSpend: amountString,
  expiresAt: expiryString,
  appPubKey: z.string().min(1),
  approvalThreshold: amountString.optional(),
  rateLimit: rateLimitSchema.optional(),
  ownerPubKey: z.string().min(1),
  walletPubKey: z.string().min(1),
  timestamp: z.number().int(),
  signature: z.string().min(1),
});
export type SessionApproval = z.infer<typeof sessionApprovalSchema>;

export const PAYMENT_DECISIONS = ["approve", "deny"] as const;
export type PaymentDecisionKind = (typeof PAYMENT_DECISIONS)[number];

export const paymentDecisionSchema = z.object({
  version: z.literal("1"),
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  amount: amountString,
  invoice: z.string().min(1),
  walletPubKey: z.string().min(1),
  decision: z.enum(PAYMENT_DECISIONS),
  timestamp: z.number().int(),
  signature: z.string().min(1),
});
export type PaymentDecision = z.infer<typeof paymentDecisionSchema>;

export const REVOKERS = ["app", "owner"] as const;

export const revokeRequestSchema = z.object({
  version: z.literal("1"),
  sessionId: z.string().min(1),
  by: z.enum(REVOKERS),
  timestamp: z.number().int(),
  signature: z.string().min(1),
});
export type RevokeRequest = z.infer<typeof revokeRequestSchema>;

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
  expiresAt: expiryString,
  approvalThreshold: amountString.optional(),
  rateLimit: rateLimitSchema.optional(),
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

export const HOLD_STATUSES = ["pending", "approving", "settled", "denied", "expired", "cancelled", "failed"] as const;
export type HoldStatus = (typeof HOLD_STATUSES)[number];

export interface HoldView {
  requestId: string;
  sessionId: string;
  amount: string;
  asset: string;
  invoice: string;
  purpose?: string;
  status: HoldStatus;
  createdAt: string;
  expiresAt: string;
  result?: OperationResult;
}
