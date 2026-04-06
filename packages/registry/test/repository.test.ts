import { describe, expect, it } from 'vitest';
import { normalizeNullableText } from '../src/repository.js';

describe('normalizeNullableText', () => {
  it('returns null for undefined, null, and blank strings', () => {
    expect(normalizeNullableText(undefined)).toBeNull();
    expect(normalizeNullableText(null)).toBeNull();
    expect(normalizeNullableText('')).toBeNull();
    expect(normalizeNullableText('   ')).toBeNull();
  });

  it('returns trimmed text for non-empty strings', () => {
    expect(normalizeNullableText('value')).toBe('value');
    expect(normalizeNullableText('  value  ')).toBe('value');
  });
});
