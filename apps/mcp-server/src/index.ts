import { loadEnv } from '@cybergogne/common';
import { runHttpServer, runStdioServer } from './server.js';

const env = loadEnv();
const forceStdio = process.argv.includes('--stdio') || env.MCP_TRANSPORT === 'stdio';

if (forceStdio) {
  await runStdioServer();
} else {
  const server = await runHttpServer(env.PORT);
  console.log(`Cybergogne MCP server listening on http://localhost:${env.PORT}/mcp`);
  process.on('SIGINT', () => server.close(() => process.exit(0)));
}
