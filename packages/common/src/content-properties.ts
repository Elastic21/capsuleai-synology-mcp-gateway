import { AppError } from './errors.js';

const FORBIDDEN_KEY_PATTERN =
  /(secret|token|password|authorization|auth|cookie|session|credential|private[_-]?key|api[_-]?key)/i;

const LEGACY_KEY_MAP: Record<string, string> = {
  proposal_id: 'cg.proposalId',
  scope_id: 'cg.scopeId',
  doc_type: 'cg.docType',
  source_app: 'cg.sourceApp',
  publication_policy: 'cg.publicationPolicy',
  approved_by: 'cg.approvedBy',
  published_at: 'cg.publishedAt',
};

function assertKeyAllowed(key: string, path: string) {
  if (FORBIDDEN_KEY_PATTERN.test(key)) {
    throw new AppError(
      'CONTENT_PROPERTY_FORBIDDEN',
      `Content property ${path} appears to contain a secret or security-sensitive key`,
      400,
    );
  }
}

function normalizeKey(key: string) {
  const trimmed = key.trim();
  assertKeyAllowed(trimmed, trimmed);

  if (trimmed === 'source' || trimmed.startsWith('cg.')) {
    return trimmed;
  }

  const mapped = LEGACY_KEY_MAP[trimmed];
  if (mapped) {
    return mapped;
  }

  throw new AppError(
    'CONTENT_PROPERTY_NOT_ALLOWED',
    `Content property ${trimmed} is not allowed in Confluence content properties`,
    400,
  );
}

function validateValue(path: string, value: unknown): void {
  if (value === undefined) {
    return;
  }

  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => validateValue(`${path}[${index}]`, item));
    return;
  }

  if (typeof value === 'object') {
    for (const [key, nestedValue] of Object.entries(value)) {
      assertKeyAllowed(key, `${path}.${key}`);
      validateValue(`${path}.${key}`, nestedValue);
    }
    return;
  }

  throw new AppError(
    'CONTENT_PROPERTY_INVALID',
    `Content property ${path} contains a non-serializable value`,
    400,
  );
}

export function normalizeContentProperties(input: Record<string, unknown> | null | undefined) {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input ?? {})) {
    if (value === undefined) continue;
    const normalizedKey = normalizeKey(key);
    validateValue(normalizedKey, value);
    normalized[normalizedKey] = value;
  }

  return normalized;
}
