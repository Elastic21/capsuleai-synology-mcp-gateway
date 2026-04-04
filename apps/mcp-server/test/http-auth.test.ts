import { describe, expect, it } from 'vitest';
import {
  authenticateHttpRequest,
  buildProtectedResourceMetadata,
  getProtectedResourceMetadataPath,
} from '../src/http-auth.js';

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    MCP_AUTH_MODE: 'bearer',
    MCP_AUTHORIZATION_SERVER_ISSUER: '',
    MCP_RESOURCE_NAME: 'Cybergogne MCP Gateway',
    mcpBearerTokens: ['token-a'],
    mcpRequiredScopes: ['mcp:tools'],
    ...overrides,
  } as any;
}

describe('http auth helpers', () => {
  it('builds the protected resource metadata path for MCP HTTP', () => {
    expect(getProtectedResourceMetadataPath('/mcp')).toBe('/.well-known/oauth-protected-resource/mcp');
  });

  it('authenticates configured bearer tokens', () => {
    const env = makeEnv({
      mcpBearerTokens: ['token-a', 'token-b'],
      mcpRequiredScopes: ['mcp:tools', 'mcp:write'],
    });

    expect(
      authenticateHttpRequest(
        { authorization: 'Bearer token-b' },
        env,
        'https://gateway.example/.well-known/oauth-protected-resource/mcp',
      ),
    ).toEqual({
      token: 'token-b',
      clientId: 'static-bearer',
      scopes: ['mcp:tools', 'mcp:write'],
      subject: 'static-bearer',
    });
  });

  it('includes authorization metadata in 401 errors', () => {
    const env = makeEnv({
      MCP_AUTHORIZATION_SERVER_ISSUER: 'https://issuer.example',
    });

    try {
      authenticateHttpRequest(
        {},
        env,
        'https://gateway.example/.well-known/oauth-protected-resource/mcp',
      );
      throw new Error('Expected authenticateHttpRequest to fail');
    } catch (error: any) {
      expect(error.code).toBe('AUTH_REQUIRED');
      expect(error.statusCode).toBe(401);
      expect(error.details.wwwAuthenticate).toContain('resource_metadata=');
      expect(error.details.wwwAuthenticate).toContain('scope="mcp:tools"');
    }
  });

  it('publishes protected resource metadata from env', () => {
    const env = makeEnv({
      MCP_AUTHORIZATION_SERVER_ISSUER: 'https://issuer.example',
      mcpRequiredScopes: ['mcp:tools', 'mcp:write'],
    });

    expect(buildProtectedResourceMetadata('https://gateway.example', '/mcp', env)).toEqual({
      resource: 'https://gateway.example/mcp',
      authorization_servers: ['https://issuer.example'],
      scopes_supported: ['mcp:tools', 'mcp:write'],
      resource_name: 'Cybergogne MCP Gateway',
    });
  });
});
