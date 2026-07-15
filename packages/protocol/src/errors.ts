export const ERROR_CODES = [
  "session_not_found",
  "session_revoked",
  "session_expired",
  "invalid_signature",
  "permission_denied",
  "origin_mismatch",
  "replay_detected",
  "stale_timestamp",
  "nonce_out_of_order",
  "invoice_amount_mismatch",
  "asset_not_allowed",
  "single_payment_limit_exceeded",
  "session_spending_limit_exceeded",
  "gateway_failure",
  "attenuation_violation",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ClaspError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  nextAction: string;
  [key: string]: unknown;
}

const DEFAULTS: Record<ErrorCode, { message: string; retryable: boolean; nextAction: string }> = {
  session_not_found: { message: "No such session.", retryable: false, nextAction: "pair_again" },
  session_revoked: { message: "This wallet session has been revoked.", retryable: false, nextAction: "pair_again" },
  session_expired: { message: "This wallet session has expired.", retryable: false, nextAction: "pair_again" },
  invalid_signature: { message: "Request signature is invalid.", retryable: false, nextAction: "abort" },
  permission_denied: { message: "The session does not grant this operation.", retryable: false, nextAction: "abort" },
  origin_mismatch: { message: "Request origin does not match the session origin.", retryable: false, nextAction: "abort" },
  replay_detected: { message: "This request has already been processed.", retryable: false, nextAction: "abort" },
  stale_timestamp: { message: "Request timestamp is outside the freshness window.", retryable: true, nextAction: "resign_and_retry" },
  nonce_out_of_order: { message: "Nonce is not strictly increasing.", retryable: true, nextAction: "resync_nonce" },
  invoice_amount_mismatch: { message: "Invoice amount does not match the declared amount.", retryable: false, nextAction: "abort" },
  asset_not_allowed: { message: "Asset is not permitted by this session.", retryable: false, nextAction: "abort" },
  single_payment_limit_exceeded: { message: "Amount exceeds the per-payment limit.", retryable: false, nextAction: "reduce_amount" },
  session_spending_limit_exceeded: { message: "Amount exceeds the remaining session allowance.", retryable: false, nextAction: "reduce_amount" },
  gateway_failure: { message: "The payment could not be settled by the network.", retryable: true, nextAction: "retry" },
  attenuation_violation: { message: "A delegated token cannot widen its parent's authority.", retryable: false, nextAction: "abort" },
};

export function claspError(code: ErrorCode, fields: Record<string, unknown> = {}): ClaspError {
  const base = DEFAULTS[code];
  return { code, message: base.message, retryable: base.retryable, nextAction: base.nextAction, ...fields };
}

export class ClaspErrorException extends Error {
  readonly error: ClaspError;
  constructor(error: ClaspError) {
    super(`${error.code}: ${error.message}`);
    this.name = "ClaspErrorException";
    this.error = error;
  }
}

export function isClaspError(value: unknown): value is ClaspError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    (ERROR_CODES as readonly string[]).includes((value as { code: string }).code)
  );
}
