import type { IncomingHttpHeaders } from 'node:http';
import type { AppEnv } from '@cybergogne/common';
import { AppError } from '@cybergogne/common';

export interface HttpAuthInfo {
  token: string;
  clientId: string;
  scopes: string[];
  subject: string;
}

export function getProtectedResourceMetadataPath(resourcePath: string) {
  const normalizedPath = resourcePath === '/' ? '' : resourcePath;
  return `/.well-known/oauth-protected-resource${normalizedPath}`;
}

export function buildProtectedResourceMetadata(origin: string, resourcePath: string, env: AppEnv) {
  return {
    resource: `${origin}${resourcePath}`,
    authorization_servers: env.MCP_AUTHORIZATION_SERVER_ISSUER
      ? [env.MCP_AUTHORIZATION_SERVER_ISSUER]
      : [],
    scopes_supported: env.mcpRequiredScopes,
    resource_name: env.MCP_RESOURCE_NAME,
  };
}

export function buildWwwAuthenticateHeader(metadataUrl: string, scopes: string[], error: string, description: string) {
  const parts = [`Bearer error="${error}"`, `error_description="${description}"`];
  if (scopes.length > 0) {
    parts.push(`scope="${scopes.join(' ')}"`);
  }
  parts.push(`resource_metadata="${metadataUrl}"`);
  return parts.join(', ');
}

export function authenticateHttpRequest(
  headers: IncomingHttpHeaders,
  env: AppEnv,
  resourceMetadataUrl: string,
): HttpAuthInfo | undefined {
  if (env.MCP_AUTH_MODE !== 'bearer') {
    return undefined;
  }

  if (env.mcpBearerTokens.length === 0) {
    throw new AppError(
      'AUTH_CONFIGURATION_INVALID',
      'MCP auth mode is bearer but no MCP_BEARER_TOKENS are configured',
      500,
    );
  }

  const authHeader = headers.authorization;
  if (!authHeader) {
    throw new AppError('AUTH_REQUIRED', 'Missing Authorization header', 401, {
      wwwAuthenticate: buildWwwAuthenticateHeader(
        resourceMetadataUrl,
        env.mcpRequiredScopes,
        'invalid_token',
        'Missing Authorization header',
      ),
    });
  }

  const [scheme, token] = authHeader.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new AppError('AUTH_INVALID', 'Authorization header must be Bearer <token>', 401, {
      wwwAuthenticate: buildWwwAuthenticateHeader(
        resourceMetadataUrl,
        env.mcpRequiredScopes,
        'invalid_token',
        'Authorization header must be Bearer <token>',
      ),
    });
  }

  if (!env.mcpBearerTokens.includes(token)) {
    throw new AppError('AUTH_INVALID', 'Bearer token is invalid', 401, {
      wwwAuthenticate: buildWwwAuthenticateHeader(
        resourceMetadataUrl,
        env.mcpRequiredScopes,
        'invalid_token',
        'Bearer token is invalid',
      ),
    });
  }

  return {
    token,
    clientId: 'static-bearer',
    scopes: env.mcpRequiredScopes,
    subject: 'static-bearer',
  };
}
