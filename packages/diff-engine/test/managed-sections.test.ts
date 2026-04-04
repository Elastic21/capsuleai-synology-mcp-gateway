import { describe, expect, it } from 'vitest';
import { parseManagedSections, replaceManagedSection } from '../src/index.js';

describe('managed sections', () => {
  it('replaces only the requested section', () => {
    const input = [
      '<p>before</p>',
      '<!-- cg:managed:start actions -->',
      '<p>old</p>',
      '<!-- cg:managed:end actions -->',
      '<p>after</p>',
    ].join('\n');

    const output = replaceManagedSection(input, 'actions', '<p>new</p>');
    expect(output).toContain('<p>new</p>');
    expect(output).not.toContain('<p>old</p>');
    expect(parseManagedSections(output)).toHaveLength(1);
  });
});
