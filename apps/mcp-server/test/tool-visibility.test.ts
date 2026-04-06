import { describe, expect, it } from 'vitest';
import {
  buildWidgetOnlyToolDeniedResult,
  filterModelVisibleTools,
  isAuthorizedWidgetToolCall,
  WIDGET_CALL_META_KEY,
} from '../src/tool-visibility.js';

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

  it('rejects widget-only tool calls without the widget call marker', () => {
    expect(isAuthorizedWidgetToolCall({ name: 'approve_proposal' })).toBe(false);
    expect(
      isAuthorizedWidgetToolCall({
        name: 'approve_proposal',
        _meta: { [WIDGET_CALL_META_KEY]: false },
      }),
    ).toBe(false);
  });

  it('accepts widget-only tool calls with the widget call marker', () => {
    expect(
      isAuthorizedWidgetToolCall({
        name: 'approve_proposal',
        _meta: { [WIDGET_CALL_META_KEY]: true },
      }),
    ).toBe(true);
  });

  it('builds an explicit denial result for direct model calls', () => {
    expect(buildWidgetOnlyToolDeniedResult('approve_proposal')).toEqual({
      content: [
        {
          type: 'text',
          text: 'Tool approve_proposal is widget-only and unavailable via direct model tool calls.',
        },
      ],
      isError: true,
    });
  });
});
