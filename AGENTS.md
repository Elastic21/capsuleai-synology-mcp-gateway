# AGENTS.md — Cybergogne Gateway MCP

## Mission

Construire la Gateway MCP Cybergogne décrite dans `cg_gateway_mcp_codex_spec_v1.md`.

Cette base sert à connecter ChatGPT/Codex à des espaces Confluence **strictement bornés par scope** avec lecture, proposition, validation humaine, publication contrôlée et audit.

## Règles durables

1. Le **registre de scope** est la source de vérité. Ne jamais contourner `cg_scope_registry`.
2. **Deny by default** : si un scope n’est pas résolu sans ambiguïté, l’appel échoue.
3. Tous les appels de recherche doivent être bornés par `read_cql_guard`.
4. Aucune publication finale sans workflow `proposal -> approval -> publish`.
5. Les outils d’approbation, de publication et de rollback doivent être **cachés au modèle** et exposés **au widget uniquement**.
6. En V1, ne jamais implémenter d’édition full-page libre.
7. Ne jamais stocker de secrets, de données personnelles sensibles ou de configuration de sécurité dans les content properties Confluence.
8. Toute intégration Confluence passe par le package client central. Pas d’appels REST sauvages dispersés dans le code.
9. Tous les outils MCP doivent avoir des annotations correctes (`readOnlyHint`, `openWorldHint`, `destructiveHint`).
10. Toute action importante doit laisser une trace dans `cg_audit_log`.

## Priorités techniques

- TypeScript strict
- schémas d’entrée/sortie partagés
- sécurité serveur avant UX
- tests de contrat MCP
- logs structurés
- documentation des commandes de bootstrap

## Références de travail

- Spécification principale : `cg_gateway_mcp_codex_spec_v1.md`
- Plan d’exécution : `PLANS.md`
- Registre initial : `cg_scope_registry_v1.sql` et `cg_scope_registry_v1_examples.yaml`

## OpenAI docs MCP

Toujours utiliser le serveur MCP de documentation OpenAI si tu as besoin de vérifier le comportement des Apps SDK, de MCP, de Codex, d’AGENTS.md ou des widgets :

```json
{
  "servers": {
    "openaiDeveloperDocs": {
      "type": "http",
      "url": "https://developers.openai.com/mcp"
    }
  }
}
```

## Commandes standard attendues

Le dépôt final doit exposer au minimum :

- `pnpm install`
- `pnpm dev`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:integration`
- `pnpm seed:registry`
- `pnpm bootstrap:discover --manifest <path>`
- `pnpm bootstrap:validate --scope <scope_id>`
- `pnpm bootstrap:apply --source <path>`

## Manière de travailler

- Commencer par sécuriser les types, les schémas et la base.
- Avancer par milestones courtes et vérifiables.
- Mettre à jour `PLANS.md` si le plan réel diverge.
- Quand une hypothèse métier est incertaine, l’encoder comme configuration explicite, jamais comme comportement implicite.

