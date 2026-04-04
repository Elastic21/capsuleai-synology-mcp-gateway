# Cybergogne Gateway MCP V1

Ce depot fournit un squelette TypeScript + pnpm workspace pour la Gateway MCP Cybergogne decrite dans `cg_gateway_mcp_codex_spec_v1.md`.

## Ce que contient le depot

- registre de scope PostgreSQL
- resolveur de scope deny-by-default
- client Confluence centralise
- workflow `proposal -> approval -> publish`
- outils MCP Knowledge + Publisher
- widget MCP Apps de revue humaine
- scripts de bootstrap pour resoudre `space_key`, `root_page_id`, `default_parent_page_id`, `ai_inbox_page_id` et groupes approbateurs
- journal d'audit et rollback

## Structure

```text
apps/
  mcp-server/
  widget/

packages/
  common/
  schemas/
  registry/
  scope-resolver/
  confluence/
  diff-engine/
  proposals/
  approvals/
  publishing/
  audit/

scripts/
db/
config/
docs/
```

## Installation

```bash
pnpm install
cp .env.example .env
pnpm migrate
pnpm seed:registry
pnpm build
```

## Variables d'environnement

### MCP

- `MCP_TRANSPORT=http|stdio`
- `MCP_AUTH_MODE=none|bearer`
- `MCP_BEARER_TOKENS`
- `MCP_REQUIRED_SCOPES`
- `MCP_AUTHORIZATION_SERVER_ISSUER`
- `MCP_RESOURCE_NAME`

### Atlassian

- `ATLASSIAN_AUTH_MODE=basic|bearer`
- `ATLASSIAN_BASE_URL`
- `ATLASSIAN_EMAIL`
- `ATLASSIAN_API_TOKEN`
- `ATLASSIAN_BEARER_TOKEN`

## Lancement local

### HTTP MCP

```bash
pnpm dev
```

### stdio

```bash
pnpm dev -- --stdio
```

### Bootstrap de resolution

```bash
pnpm bootstrap:discover --manifest ./config/registry/resolution.yaml
pnpm bootstrap:validate --scope client-smdm-prod
pnpm bootstrap:apply --source ./out/resolved-registry.yaml
pnpm bootstrap:report --source ./out/resolved-registry.yaml
```

## Notes techniques

- Le transport HTTP utilise `StreamableHTTPServerTransport` avec sessions MCP et `/.well-known/oauth-protected-resource`.
- Les outils sensibles restent widget-only via `_meta.ui.visibility = ["app"]`.
- Le widget est servi comme ressource Apps et utilise un pont JSON-RPC minimal pour rester host-agnostic.
- Les content properties Confluence sont normalisees et refusees si elles ressemblent a des secrets.
- Le registre de scope reste la source de verite; aucun write hors scope n'est autorise.

## Documentation utile

- [Catalogue d'outils](./docs/api/tool-catalog.md)
- [Divergences de spec / API](./docs/api/spec-divergences.md)
- [Deploiement Synology DSM](./docs/deployment/synology-dsm.md)
- [Deploiement Synology via GHCR public](./docs/deployment/synology-ghcr-public.md)
- [Prompt de demarrage Codex](./docs/codex/kickoff-prompt.md)
