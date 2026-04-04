import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@cybergogne/common';
import { ScopeResolver } from '../src/index.js';

describe('scope resolver', () => {
  it('normalizes labels with required labels', () => {
    const resolver = new ScopeResolver({} as any, 'prod');
    const labels = resolver.normalizeLabels(
      { required_labels: ['a'], forbidden_labels: ['x'] },
      ['b'],
    );
    expect(labels).toEqual(['a', 'b']);
  });

  it('resolves publisher_app_slug before other slug hints', async () => {
    const scope = { scope_id: 'scope-1', enabled: true };
    const registry = {
      findScopeById: vi.fn().mockResolvedValue(null),
      findScopeByPublisherAppSlug: vi.fn().mockResolvedValue(scope),
      findScopeByKnowledgeAppSlug: vi.fn(),
      findScopeByProjectSlug: vi.fn(),
    };

    const resolver = new ScopeResolver(registry as any, 'prod');
    const resolved = await resolver.resolve({
      publisher_app_slug: 'publisher-a',
      knowledge_app_slug: 'knowledge-a',
      chatgpt_project_slug: 'project-a',
    });

    expect(resolved).toBe(scope);
    expect(registry.findScopeByPublisherAppSlug).toHaveBeenCalledWith('publisher-a', 'prod');
    expect(registry.findScopeByKnowledgeAppSlug).not.toHaveBeenCalled();
    expect(registry.findScopeByProjectSlug).not.toHaveBeenCalled();
  });

  it('rejects search when read_cql_guard is missing', () => {
    const resolver = new ScopeResolver({} as any, 'prod');
    expect(() => resolver.assertSearchAllowed({ scope_id: 'scope-1', read_cql_guard: '   ' })).toThrowError(
      AppError,
    );
  });

  it('rejects writes when publication policy cannot be resolved', async () => {
    const registry = {
      findPublicationPolicy: vi.fn().mockResolvedValue(null),
    };

    const resolver = new ScopeResolver(registry as any, 'prod');

    await expect(
      resolver.assertWriteAuthorized({ scope_id: 'scope-1', publication_policy_key: 'missing-policy' }),
    ).rejects.toMatchObject({
      code: 'PUBLICATION_POLICY_INVALID',
      statusCode: 403,
    });
  });
});
