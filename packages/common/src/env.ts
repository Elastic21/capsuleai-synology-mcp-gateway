import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CG_ENVIRONMENT: z.enum(['dev', 'staging', 'prod']).default('prod'),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: z.string().min(1),
  MCP_TRANSPORT: z.enum(['stdio', 'http']).default('http'),
  PORT: z.coerce.number().int().positive().default(8787),
  HOST: z.string().default('0.0.0.0'),
  MCP_AUTH_MODE: z.enum(['none', 'bearer']).default('none'),
  MCP_BEARER_TOKENS: z.string().default(''),
  MCP_REQUIRED_SCOPES: z.string().default('mcp:tools'),
  MCP_AUTHORIZATION_SERVER_ISSUER: z.string().default(''),
  MCP_RESOURCE_NAME: z.string().default('Cybergogne MCP Gateway'),
  ATLASSIAN_BASE_URL: z.string().url().default('https://example.atlassian.net'),
  ATLASSIAN_AUTH_MODE: z.enum(['basic', 'bearer']).default('basic'),
  ATLASSIAN_EMAIL: z.string().default(''),
  ATLASSIAN_API_TOKEN: z.string().default(''),
  ATLASSIAN_BEARER_TOKEN: z.string().default(''),
  DEFAULT_WIDGET_ACTOR_REF: z.string().default('widget-user@local'),
  DEV_APPROVAL_BYPASS: z.string().default('false'),
});

function toBoolean(value: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function splitList(value: string) {
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.parse(source);
  return {
    ...parsed,
    devApprovalBypass: toBoolean(parsed.DEV_APPROVAL_BYPASS),
    mcpBearerTokens: splitList(parsed.MCP_BEARER_TOKENS),
    mcpRequiredScopes: splitList(parsed.MCP_REQUIRED_SCOPES),
  };
}

export type AppEnv = ReturnType<typeof loadEnv>;
