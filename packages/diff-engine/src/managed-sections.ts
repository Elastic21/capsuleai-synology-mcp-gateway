import { AppError } from '@cybergogne/common';

const START = '<!-- cg:managed:start ';
const END = '<!-- cg:managed:end ';

export interface ManagedSection {
  key: string;
  startIndex: number;
  endIndex: number;
  contentStart: number;
  contentEnd: number;
}

export function parseManagedSections(html: string): ManagedSection[] {
  const sections: ManagedSection[] = [];
  let cursor = 0;

  while (cursor < html.length) {
    const startIndex = html.indexOf(START, cursor);
    if (startIndex === -1) break;

    const keyStart = startIndex + START.length;
    const keyEnd = html.indexOf(' -->', keyStart);
    if (keyEnd === -1) {
      throw new AppError('MANAGED_SECTION_PARSE_ERROR', 'Missing managed section terminator');
    }

    const key = html.slice(keyStart, keyEnd).trim();
    const contentStart = keyEnd + 4;
    const endMarker = `${END}${key} -->`;
    const endIndex = html.indexOf(endMarker, contentStart);

    if (endIndex === -1) {
      throw new AppError('MANAGED_SECTION_PARSE_ERROR', `Missing end marker for section ${key}`);
    }

    sections.push({
      key,
      startIndex,
      endIndex: endIndex + endMarker.length,
      contentStart,
      contentEnd: endIndex,
    });

    cursor = endIndex + endMarker.length;
  }

  return sections;
}

export function replaceManagedSection(html: string, key: string, replacement: string): string {
  const section = parseManagedSections(html).find((item) => item.key === key);
  if (!section) {
    throw new AppError('MANAGED_SECTION_NOT_FOUND', `Managed section ${key} was not found`, 404);
  }

  return [
    html.slice(0, section.contentStart),
    `\n${replacement}\n`,
    html.slice(section.contentEnd),
  ].join('');
}
