export function buildStorageDiff(beforeBody: string | null, afterBody: string) {
  const beforeLength = beforeBody?.length ?? 0;
  const afterLength = afterBody.length;
  const delta = afterLength - beforeLength;
  const riskFlags: string[] = [];

  if (!beforeBody) riskFlags.push('new_content');
  if (Math.abs(delta) > 5000) riskFlags.push('large_diff');

  return {
    summary: {
      beforeLength,
      afterLength,
      delta,
    },
    diffText: [
      '--- BEFORE ---',
      beforeBody ?? '',
      '',
      '--- AFTER ---',
      afterBody,
    ].join('\n'),
    riskFlags,
  };
}
