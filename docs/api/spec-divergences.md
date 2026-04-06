# Divergences de spec / API

Valide le 2026-04-03 contre les dependances presentes dans ce depot:

- `@modelcontextprotocol/sdk@1.29.0`
- `@modelcontextprotocol/ext-apps@1.5.0`

## 1. Typage Apps SDK

La spec V1 suppose seulement que les render tools exposent une ressource UI. Avec `ext-apps@1.5.0`, `registerAppTool()` exige un `_meta.ui` non optionnel.

Decision appliquee:

- les data tools restent en `server.registerTool(...)`
- les render tools utilisent `registerAppTool(...)`
- les outils widget-only declarent `_meta.ui.visibility = ["app"]`

Note pratique:

- `McpUiToolMeta` n'est pas re-exporte a la racine du package installe
- le code utilise donc un type local minimal cale sur la forme runtime attendue

## 2. Auth MCP HTTP

La mission demandait un durcissement OAuth 2.1 cote MCP. La V1 executable de ce depot implemente:

- `GET /.well-known/oauth-protected-resource`
- `401` avec `WWW-Authenticate`
- `securitySchemes` sur les outils
- validation de bearer tokens statiques via `MCP_BEARER_TOKENS`

Divergence restante:

- il n'y a pas d'authorization server OAuth complet embarque dans le repo
- la production doit pointer `MCP_AUTHORIZATION_SERVER_ISSUER` vers un issuer externe

## 3. UX de validation

La spec UX mentionne un bouton `Envoyer a validation`. Le catalogue d'outils V1, lui, ne definit pas de tool dedie pour cette transition.

Decision appliquee:

- le workflow reste `proposal -> approval -> publish`
- le premier accord humain fait office d'entree en revue
- si le quorum n'est pas atteint, le statut passe a `pending_approval`

Impact:

- divergence de wording UX, pas de divergence sur le controle de scope ni sur la separation approbation/publication

## 4. Bridge du widget

Le widget est conforme au modele MCP Apps sur les points suivants:

- ressource UI en `ui://...`
- render tools Apps SDK
- tools sensibles widget-only

Divergence d'implementation:

- l'iframe utilise un pont JSON-RPC `postMessage` minimal plutot que d'embarquer le runtime client `ext-apps`

Raison:

- garder un widget statique, simple a servir et host-agnostic dans ce squelette V1

## 5. Endpoint de recherche Confluence

La V1 utilisait initialement `GET /wiki/rest/api/search` pour les recherches CQL.
Sur certains tenants Confluence Cloud, ce endpoint peut repondre `404` alors que
`GET /wiki/rest/api/content/search` reste disponible pour les recherches de pages.

Decision appliquee:

- `search_knowledge` tente d'abord `GET /wiki/rest/api/content/search`
- en cas de `404`, le client bascule automatiquement sur `GET /wiki/rest/api/search`

Impact:

- comportement plus robuste entre tenants Cloud
- pas de changement sur le controle de scope ni sur le format de sortie MCP

## 6. Widget-only et `tools/list`

La V1 supposait que `_meta.ui.visibility = ["app"]` suffirait a masquer les outils
sensibles au modele. Avec `@modelcontextprotocol/sdk@1.29.0` et `ext-apps@1.5.0`,
le handler standard `tools/list` retourne pourtant tous les outils enregistres.

Decision appliquee:

- la gateway remplace explicitement le handler `tools/list`
- les outils `approve_proposal`, `reject_proposal`, `publish_approved_proposal`
  et `rollback_publication` sont filtres du catalogue expose au modele
- le widget continue de pouvoir les appeler explicitement par `tools/call`

Impact:

- le catalogue modele respecte la contrainte `widget-only`
- divergence de comportement du SDK documentee et neutralisee cote serveur
