const CREDENTIAL_LIKE_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bBearer\s+[A-Za-z0-9._~+/-]{12,}/i,
  /\b(?:sk-[A-Za-z0-9_-]{16,}|xox[baprs]-[A-Za-z0-9-]{16,}|gh[pousr]_[A-Za-z0-9]{20,})\b/i,
  /\bpostgres(?:ql)?:\/\/[^/\s:@]+:[^@\s/]+@/i,
  /\b(?:api[_-]?key|password|passwd|secret|token|credential|private[_-]?key|database[_-]?url)\s*[:=]\s*['"]?[A-Za-z0-9_./+=:-]{8,}/i,
  /\beyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
];

export class CredentialLikePayloadError extends Error {
  readonly code = "credential_like_payload_blocked";

  constructor() {
    super("Replication skipped a row containing credential-like text.");
    this.name = "CredentialLikePayloadError";
  }
}

export function containsCredentialLikeText(value: unknown): boolean {
  if (typeof value === "string") {
    return CREDENTIAL_LIKE_PATTERNS.some((pattern) => pattern.test(value));
  }
  if (Array.isArray(value)) return value.some(containsCredentialLikeText);
  if (value && typeof value === "object") {
    return Object.values(value).some(containsCredentialLikeText);
  }
  return false;
}

export function assertReplicaPayloadSafe(payload: Record<string, unknown>): void {
  if (containsCredentialLikeText(payload)) throw new CredentialLikePayloadError();
}

export function normalizeDatabaseErrorCode(error: unknown): string {
  if (error instanceof CredentialLikePayloadError) return error.code;
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "replica_error";
  return /^[A-Za-z0-9_-]{1,64}$/.test(code) ? code : "replica_error";
}
