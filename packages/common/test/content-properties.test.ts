import { describe, expect, it } from 'vitest';
import { normalizeContentProperties } from '../src/content-properties.js';

describe('normalizeContentProperties', () => {
  it('maps legacy keys to canonical cg keys', () => {
    expect(
      normalizeContentProperties({
        proposal_id: 'prop-1',
        scope_id: 'scope-1',
        source: 'chatgpt',
      }),
    ).toEqual({
      'cg.proposalId': 'prop-1',
      'cg.scopeId': 'scope-1',
      source: 'chatgpt',
    });
  });

  it('rejects secret-like keys, including nested ones', () => {
    try {
      normalizeContentProperties({
        'cg.scopeId': 'scope-1',
        'cg.payload': {
          apiToken: 'secret',
        },
      });
      throw new Error('Expected normalizeContentProperties to reject secret-like keys');
    } catch (error: any) {
      expect(error.code).toBe('CONTENT_PROPERTY_FORBIDDEN');
      expect(error.statusCode).toBe(400);
    }
  });
});
