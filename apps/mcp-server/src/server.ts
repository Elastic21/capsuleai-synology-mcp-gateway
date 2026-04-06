import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolRequestSchema, isInitializeRequest, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { AppError, toAppError } from '@cybergogne/common';
import { createAppContext } from './context.js';
import type { AppContext } from './context.js';
import {
  authenticateHttpRequest,
  buildProtectedResourceMetadata,
  getProtectedResourceMetadataPath,
  type HttpAuthInfo,
} from './http-auth.js';
import { registerResources } from './resources.js';
import { registerTools } from './tools.js';
import {
  buildWidgetOnlyToolDeniedResult,
  filterModelVisibleTools,
  isAuthorizedWidgetToolCall,
} from './tool-visibility.js';

const MCP_PATH = '/mcp';

interface AuthenticatedRequest extends IncomingMessage {
  auth?: HttpAuthInfo;
}

interface TransportEntry {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  context: AppContext;
}

function createMcpServer() {
  const context = createAppContext();
  const server = new McpServer({ name: 'cybergogne-gateway-mcp', version: '0.1.0' });
  registerResources(server, context.widgetPath);
  registerTools(server, context);
  installModelToolListFilter(server);
  installWidgetToolCallGuard(server);
  return { server, context };
}

function installModelToolListFilter(server: McpServer) {
  const protocolServer = server.server as any;
  const existingHandler = protocolServer._requestHandlers?.get('tools/list');
  if (!existingHandler) {
    return;
  }

  protocolServer.setRequestHandler(ListToolsRequestSchema, async (request: any, extra: any) => {
    const result = await existingHandler(request, extra);
    return filterModelVisibleTools(result);
  });
}

function installWidgetToolCallGuard(server: McpServer) {
  const protocolServer = server.server as any;
  const existingHandler = protocolServer._requestHandlers?.get('tools/call');
  if (!existingHandler) {
    return;
  }

  protocolServer.setRequestHandler(CallToolRequestSchema, async (request: any, extra: any) => {
    if (!isAuthorizedWidgetToolCall(request?.params)) {
      return buildWidgetOnlyToolDeniedResult(String(request?.params?.name ?? 'unknown'));
    }

    return existingHandler(request, extra);
  });
}

export async function runStdioServer() {
  const { server, context } = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  context.logger.info('Cybergogne MCP server started in stdio mode');
}

export async function runHttpServer(port: number) {
  const sessions = new Map<string, TransportEntry>();
  const appContext = createAppContext();

  function getRequestOrigin(req: IncomingMessage) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = typeof forwardedProto === 'string' ? forwardedProto : 'http';
    return `${protocol}://${req.headers.host ?? `localhost:${port}`}`;
  }

  function setCorsHeaders(res: ServerResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'authorization, content-type, last-event-id, mcp-protocol-version, mcp-session-id',
    );
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  }

  function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
    res.writeHead(statusCode, { 'content-type': 'application/json' }).end(JSON.stringify(body));
  }

  async function readJsonBody(req: IncomingMessage) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const raw = Buffer.concat(chunks).toString('utf8').trim();
    if (!raw) return undefined;

    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new AppError(
        'INVALID_JSON',
        error instanceof Error ? error.message : 'Request body is not valid JSON',
        400,
      );
    }
  }

  function handleHttpError(res: ServerResponse, error: unknown) {
    const appError = toAppError(error);
    if (typeof appError.details === 'object' && appError.details && 'wwwAuthenticate' in appError.details) {
      const header = (appError.details as { wwwAuthenticate?: string }).wwwAuthenticate;
      if (header) {
        res.setHeader('WWW-Authenticate', header);
      }
    }
    sendJson(res, appError.statusCode, {
      code: appError.code,
      message: appError.message,
      details: appError.details,
    });
  }

  async function createSessionTransport(req: AuthenticatedRequest) {
    const { server, context } = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        sessions.set(sessionId, { transport, server, context });
      },
      enableJsonResponse: true,
    });

    transport.onclose = () => {
      const sessionId = transport.sessionId;
      if (sessionId) {
        sessions.delete(sessionId);
      }
      void server.close();
    };

    await server.connect(transport);
    return { transport, server, context };
  }

  const httpServer = createServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(400).end('Missing URL');
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    const origin = getRequestOrigin(req);
    const resourceMetadata = buildProtectedResourceMetadata(origin, MCP_PATH, appContext.env);
    const resourceMetadataPath = getProtectedResourceMetadataPath(MCP_PATH);
    const authRequest = req as AuthenticatedRequest;

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('Cybergogne MCP server');
      return;
    }

    if (
      req.method === 'GET' &&
      (url.pathname === '/.well-known/oauth-protected-resource' || url.pathname === resourceMetadataPath)
    ) {
      setCorsHeaders(res);
      sendJson(res, 200, resourceMetadata);
      return;
    }

    if (req.method === 'OPTIONS' && url.pathname.startsWith(MCP_PATH)) {
      setCorsHeaders(res);
      res.writeHead(204);
      res.end();
      return;
    }

    if (url.pathname === MCP_PATH && req.method && new Set(['POST', 'GET', 'DELETE']).has(req.method)) {
      setCorsHeaders(res);
      try {
        const metadataUrl = `${origin}${resourceMetadataPath}`;
        authRequest.auth = authenticateHttpRequest(req.headers, appContext.env, metadataUrl);

        if (req.method === 'POST') {
          const parsedBody = await readJsonBody(req);
          const sessionId = req.headers['mcp-session-id'];
          const sessionKey = Array.isArray(sessionId) ? sessionId[0] : sessionId;

          if (sessionKey) {
            const entry = sessions.get(sessionKey);
            if (!entry) {
              throw new AppError('SESSION_NOT_FOUND', `Unknown MCP session ${sessionKey}`, 404);
            }
            await entry.transport.handleRequest(authRequest, res, parsedBody);
            return;
          }

          if (!isInitializeRequest(parsedBody)) {
            throw new AppError(
              'INITIALIZE_REQUIRED',
              'A POST request without Mcp-Session-Id must be an initialize request',
              400,
            );
          }

          const entry = await createSessionTransport(authRequest);
          await entry.transport.handleRequest(authRequest, res, parsedBody);
          return;
        }

        const sessionId = req.headers['mcp-session-id'];
        const sessionKey = Array.isArray(sessionId) ? sessionId[0] : sessionId;
        if (!sessionKey) {
          throw new AppError('SESSION_REQUIRED', 'Missing Mcp-Session-Id header', 400);
        }

        const entry = sessions.get(sessionKey);
        if (!entry) {
          throw new AppError('SESSION_NOT_FOUND', `Unknown MCP session ${sessionKey}`, 404);
        }

        await entry.transport.handleRequest(authRequest, res);
      } catch (error) {
        appContext.logger.error({ error }, 'Error handling MCP request');
        if (!res.headersSent) {
          handleHttpError(res, error);
        }
      }
      return;
    }

    if (url.pathname.startsWith('/.well-known/')) {
      res.writeHead(404).end('Not Found');
      return;
    }

    res.writeHead(404).end('Not Found');
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(port, () => resolve());
  });

  httpServer.on('close', () => {
    for (const entry of sessions.values()) {
      void entry.transport.close();
      void entry.server.close();
    }
    sessions.clear();
  });

  return httpServer;
}
