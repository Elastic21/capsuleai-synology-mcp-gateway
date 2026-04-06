import { describe, expect, it } from 'vitest';
import { filterModelVisibleTools } from '../src/tool-visibility.js';

describe('tool visibility', () => {
  it('filters widget-only tools from the model-facing catalog', () => {
    const result = filterModelVisibleTools({
      tools: [
        { name: 'search_knowledge' },
        { name: 'approve_proposal' },
        { name: 'preview_proposal' },
        { name: 'publish_approved_proposal' },
      ],
    });

    expect(result.tools).toEqual([
      { name: 'search_knowledge' },
      { name: 'preview_proposal' },
    ]);
  });
});
