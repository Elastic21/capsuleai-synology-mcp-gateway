export const WIDGET_ONLY_TOOL_NAMES = new Set([
  'approve_proposal',
  'reject_proposal',
  'publish_approved_proposal',
  'rollback_publication',
]);

export function filterModelVisibleTools(result: { tools?: Array<{ name?: string }> }) {
  return {
    ...result,
    tools: Array.isArray(result.tools)
      ? result.tools.filter((tool) => !WIDGET_ONLY_TOOL_NAMES.has(String(tool?.name ?? '')))
      : [],
  };
}
