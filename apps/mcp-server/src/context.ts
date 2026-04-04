import path from 'node:path';
import { loadEnv, createLogger } from '@cybergogne/common';
import type { Logger } from '@cybergogne/common';
import { AuditService } from '@cybergogne/audit';
import { ApproverDirectory, ApprovalService } from '@cybergogne/approvals';
import { ConfluenceClient } from '@cybergogne/confluence';
import { PublishingService } from '@cybergogne/publishing';
import { ProposalService } from '@cybergogne/proposals';
import { createSqlClient, RegistryRepository } from '@cybergogne/registry';
import { ScopeResolver } from '@cybergogne/scope-resolver';

export interface AppContext {
  env: ReturnType<typeof loadEnv>;
  logger: Logger;
  registry: RegistryRepository;
  resolver: ScopeResolver;
  confluence: ConfluenceClient;
  audit: AuditService;
  proposals: ProposalService;
  approvals: ApprovalService;
  publishing: PublishingService;
  widgetPath: string;
}

export function createAppContext(): AppContext {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);
  const sql = createSqlClient(env.DATABASE_URL);
  const registry = new RegistryRepository(sql);
  const resolver = new ScopeResolver(registry, env.CG_ENVIRONMENT);
  const confluence = new ConfluenceClient({
    baseUrl: env.ATLASSIAN_BASE_URL,
    authMode: env.ATLASSIAN_AUTH_MODE,
    email: env.ATLASSIAN_EMAIL,
    apiToken: env.ATLASSIAN_API_TOKEN,
    bearerToken: env.ATLASSIAN_BEARER_TOKEN,
  });
  const audit = new AuditService(registry);
  const proposals = new ProposalService(registry, resolver, confluence, audit);
  const approvals = new ApprovalService(
    registry,
    audit,
    new ApproverDirectory(env.devApprovalBypass),
    env.DEFAULT_WIDGET_ACTOR_REF,
  );
  const publishing = new PublishingService(
    registry,
    confluence,
    audit,
    env.DEFAULT_WIDGET_ACTOR_REF,
  );

  return {
    env,
    logger,
    registry,
    resolver,
    confluence,
    audit,
    proposals,
    approvals,
    publishing,
    widgetPath: path.resolve(process.cwd(), 'apps/widget/dist/cg-console-widget.html'),
  };
}
