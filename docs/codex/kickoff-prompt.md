# Prompt d’accompagnement Codex

Lis d’abord `AGENTS.md`, puis `PLANS.md`, puis `cg_gateway_mcp_codex_spec_v1.md`.

Contexte :
- le dépôt contient le squelette V1 de la Gateway MCP Cybergogne ;
- le registre de scope est la source de vérité ;
- le flux d’écriture est `proposal -> approval -> publish` ;
- les outils sensibles doivent rester widget-only ;
- aucun secret ne doit être stocké dans les content properties Confluence.

Mission :
1. valider la cohérence globale du dépôt ;
2. exécuter une première passe de build / typecheck / tests ;
3. corriger les écarts de compilation ou d’API MCP/Apps SDK ;
4. finaliser l’adapter Confluence et le transport HTTP/stdio ;
5. renforcer l’authentification et l’autorisation ;
6. conserver les contrats des outils et la politique deny-by-default.

Contraintes :
- ne pas affaiblir le contrôle de scope ;
- ne jamais exposer un outil de publication sensible au modèle ;
- pas d’édition libre full-page ;
- conserver la structure monorepo pnpm ;
- documenter clairement toute divergence avec la spec si une API a évolué.

Ordre recommandé :
M1 base de données
M2 scope resolver / authz
M3 client Confluence
M4 outils Knowledge
M5 propositions / widget
M6 approbation / publication / rollback
M7 bootstrap de résolution
M8 auth / observabilité / docs
