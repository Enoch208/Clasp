export const SAFE_READS = ["node:read", "channels:read", "payments:read", "invoices:read"] as const;

export const USER_WRITES = ["invoices:create", "payments:request", "payments:auto"] as const;

export const HIGH_RISK = ["channels:open", "channels:close", "peers:connect", "node:backup"] as const;

export const NEVER_EXPOSED = ["raw-rpc", "private-key:export", "admin:unrestricted"] as const;

export const GRANTABLE = [...SAFE_READS, ...USER_WRITES] as const;

export const VOCABULARY = [...SAFE_READS, ...USER_WRITES, ...HIGH_RISK] as const;

export type GrantablePermission = (typeof GRANTABLE)[number];
export type Permission = (typeof VOCABULARY)[number];

export function isGrantable(permission: string): permission is GrantablePermission {
  return (GRANTABLE as readonly string[]).includes(permission);
}

export function isHighRisk(permission: string): boolean {
  return (HIGH_RISK as readonly string[]).includes(permission);
}

export function isNeverExposed(permission: string): boolean {
  return (NEVER_EXPOSED as readonly string[]).includes(permission);
}

export function inVocabulary(permission: string): permission is Permission {
  return (VOCABULARY as readonly string[]).includes(permission);
}
