export const WIDGET_ONLY_TOOL_NAMES = new Set([
  'approve_proposal',
  'reject_proposal',
  'publish_approved_proposal',
  'rollback_publication',
]);

export const WIDGET_CALL_META_KEY = 'io.cybergogne/widget-call';

export function filterModelVisibleTools(result: { tools?: Array<{ name?: string }> }) {
  return {
    ...result,
    tools: Array.isArray(result.tools)
      ? result.tools.filter((tool) => !WIDGET_ONLY_TOOL_NAMES.has(String(tool?.name ?? '')))
      : [],
  };
}

export function isWidgetOnlyToolName(name: unknown) {
  return WIDGET_ONLY_TOOL_NAMES.has(String(name ?? ''));
}

export function isAuthorizedWidgetToolCall(params: { name?: unknown; _meta?: Record<string, unknown> } | undefined) {
  if (!isWidgetOnlyToolName(params?.name)) {
    return true;
  }

  return params?._meta?.[WIDGET_CALL_META_KEY] === true;
}

export function buildWidgetOnlyToolDeniedResult(toolName: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text: `Tool ${toolName} is widget-only and unavailable via direct model tool calls.`,
      },
    ],
    isError: true,
  };
}
