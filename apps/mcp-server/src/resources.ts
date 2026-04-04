import { readFileSync, existsSync } from 'node:fs';
import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';

export const WIDGET_URI = 'ui://widget/cg-console-widget.html';

function fallbackHtml(): string {
  return `<!doctype html><html><body><div>Widget build missing.</div></body></html>`;
}

export function registerResources(server: any, widgetPath: string) {
  registerAppResource(
    server,
    'cg-console-widget',
    WIDGET_URI,
    {},
    async () => ({
      contents: [
        {
          uri: WIDGET_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: existsSync(widgetPath) ? readFileSync(widgetPath, 'utf8') : fallbackHtml(),
        },
      ],
    }),
  );
}
