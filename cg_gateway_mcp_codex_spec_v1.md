# Cybergogne Gateway MCP V1 — Spécification de développement pour Codex

## 1. Objet

Ce document définit **la V1 exécutable** de la Gateway MCP Cybergogne destinée à connecter des projets ChatGPT/Codex à des espaces Confluence **bornés par scope**, avec lecture, proposition de mise à jour, validation humaine, publication contrôlée et audit.

La V1 doit être pensée pour deux usages :

1. **usage interne Cybergogne** par domaine (`Gestion Commerciale`, `Gestion Financière`, `Projet Client`, `Programme territorial`) ;
2. **industrialisation ultérieure** comme offre client, sans réécrire le cœur technique.

La V1 doit partir du registre déjà formalisé dans :

- `cg_scope_registry_v1.sql`
- `cg_scope_registry_v1_examples.yaml`
- `cg_scope_registry_v1_template.xlsx`

Le présent document ajoute :

- l’architecture logicielle détaillée ;
- le contrat des outils MCP ;
- le modèle de données runtime ;
- le workflow `proposal -> approval -> publish` ;
- le **bootstrap de résolution** permettant de remplacer les IDs Confluence factices par les vrais `space_key`, `root_page_id`, `default_parent_page_id`, `ai_inbox_page_id` et de figer les groupes approbateurs.

## 2. Réalité opérationnelle à intégrer dès la V1

### 2.1 Valeurs encore inconnues aujourd’hui

À la date de rédaction, **les vrais IDs Confluence et les vrais groupes approbateurs ne sont pas disponibles dans ce dépôt**. La V1 doit donc inclure **un mécanisme de découverte et de validation** qui permet, une fois un accès Atlassian configuré, de :

- retrouver les vrais `space_key` ou `space_id` ;
- retrouver les vrais `root_page_id`, `default_parent_page_id`, `ai_inbox_page_id` à partir de titres ou d’ancres connues ;
- figer les `principal_ref` des groupes approbateurs ;
- écrire le résultat dans le registre PostgreSQL et/ou dans un YAML canonique versionné.

### 2.2 Principe cardinal

Le **registre de scope** est la **source de vérité applicative**. Le prompt, le slug de projet ChatGPT, le nom de l’app et les libellés Confluence ne sont que des indices. **Aucune lecture/écriture ne doit être exécutée sans résolution déterministe d’un scope actif**.

## 3. Contraintes de plateforme à respecter

### 3.1 Côté OpenAI / ChatGPT / Codex

La Gateway doit être conçue pour exposer **deux apps par périmètre** :

- `Knowledge` : app lecture seule, éligible aux usages `search/fetch` ;
- `Publisher` : app orientée proposition/validation/publication.

Le code backend reste unique ; seules les instances d’app changent par scope.

Le design doit respecter les contraintes suivantes :

- les apps utilisées comme source de connaissance doivent exposer des capacités de type `search/fetch` en lecture seule ;
- l’UI ChatGPT repose sur un widget MCP Apps dans une iframe ;
- certains outils doivent être **visibles du widget mais cachés au modèle** ;
- les annotations MCP (`readOnlyHint`, `openWorldHint`, `destructiveHint`) doivent être correctes et systématiques ;
- Codex doit pouvoir lire un `AGENTS.md` et, pour les tâches longues, s’appuyer sur un `PLANS.md`.

### 3.2 Côté Atlassian / Confluence

Le système doit traiter **Confluence REST comme vérité documentaire** et **Rovo comme option**, pas comme cœur de la solution.

Le design doit intégrer :

- permissions globales / d’espace / restrictions de contenu ;
- recherche CQL bornée par `space` + `ancestor` ;
- CRUD de pages via REST ;
- labels ;
- content properties non sensibles ;
- restauration de version ;
- événements/automation en option ;
- contraintes de rate limiting.

## 4. Périmètre V1

### 4.1 Inclus

- résolution d’un scope par `chatgpt_project_slug`, `knowledge_app_slug`, `publisher_app_slug` ;
- lecture bornée Confluence (`search`, `fetch`) ;
- proposition de création de page ;
- proposition de mise à jour de page **append-only** ou **managed-sections only** ;
- diff avant publication ;
- validation humaine ;
- publication Confluence selon politique ;
- journal d’audit ;
- rollback ;
- bootstrap de découverte des vraies valeurs Confluence.

### 4.2 Exclu de la V1

- multi-source retrieval complexe (SharePoint, Google Drive, Slack, etc.) ;
- index vectoriel propriétaire obligatoire ;
- édition libre de page complète par le modèle ;
- auto-approbation ;
- publication sans garde-fou ;
- orchestration Forge complexe obligatoire.

Forge et Automation peuvent être ajoutés, mais **le backend MCP doit rester autonome**.

## 5. Architecture cible

```text
[Projet ChatGPT/Codex]
   ├─ Instructions de projet
   ├─ App Knowledge  (search/fetch)
   └─ App Publisher  (proposal/review/publish)

                 │
                 ▼

         [Cybergogne MCP Gateway]
   ├─ MCP Server (tools + resources)
   ├─ Widget host / UI bundle registry
   ├─ Scope Resolver
   ├─ AuthN / AuthZ
   ├─ Confluence Client
   ├─ Proposal Service
   ├─ Diff Engine
   ├─ Approval Service
   ├─ Publish Service
   ├─ Rollback Service
   ├─ Bootstrap Discovery Service
   ├─ Audit Log Service
   └─ Observability

                 │
                 ▼

            [PostgreSQL]
   ├─ scope registry
   ├─ publication policies
   ├─ approver groups
   ├─ proposals
   ├─ approvals
   ├─ publications
   ├─ snapshots
   └─ audit logs

                 │
                 ▼

          [Confluence Cloud REST]
   ├─ spaces
   ├─ pages
   ├─ versions
   ├─ labels
   ├─ content properties
   └─ search/CQL
```

## 6. Stack recommandée

### 6.1 Langage / runtime

- **TypeScript** strict
- **Node.js 22 LTS**
- **pnpm workspace**

### 6.2 Backend

- `@modelcontextprotocol/sdk`
- `@modelcontextprotocol/ext-apps`
- `fastify`
- `zod`
- `pino`
- `undici` ou `fetch` natif
- `postgres` ou `pg`
- `drizzle-orm` (préféré) ou `prisma`

### 6.3 Frontend widget

- React + Vite **ou** HTML/TS minimaliste si l’UI reste légère
- design très simple, sans dépendance lourde inutile

### 6.4 Qualité

- `vitest`
- `eslint`
- `typescript-eslint`
- `prettier`
- `playwright` pour tests widget si nécessaire

### 6.5 Infra minimale

- conteneur Docker
- reverse proxy TLS
- Postgres managé ou conteneurisé
- secrets via vault / env chiffré / secret manager

## 7. Structure de dépôt attendue

```text
.
├─ AGENTS.md
├─ PLANS.md
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ apps/
│  ├─ mcp-server/
│  │  ├─ src/
│  │  │  ├─ server.ts
│  │  │  ├─ tools/
│  │  │  ├─ resources/
│  │  │  ├─ auth/
│  │  │  ├─ middleware/
│  │  │  └─ config/
│  │  └─ test/
│  └─ widget/
│     ├─ src/
│     └─ test/
├─ packages/
│  ├─ schemas/
│  ├─ registry/
│  ├─ confluence/
│  ├─ scope-resolver/
│  ├─ proposals/
│  ├─ approvals/
│  ├─ publishing/
│  ├─ diff-engine/
│  ├─ audit/
│  └─ common/
├─ db/
│  ├─ migrations/
│  ├─ seeds/
│  └─ queries/
├─ config/
│  ├─ registry/
│  │  ├─ dev.yaml
│  │  ├─ staging.yaml
│  │  └─ prod.yaml
│  └─ policies/
├─ scripts/
│  ├─ bootstrap-discover.ts
│  ├─ bootstrap-validate.ts
│  ├─ seed-registry.ts
│  └─ export-registry.ts
└─ docs/
   ├─ architecture/
   ├─ runbooks/
   └─ api/
```

## 8. Modèle de données

### 8.1 Tables déjà définies

Conserver les tables déjà produites :

- `cg_approver_group`
- `cg_publication_policy`
- `cg_scope_registry`

Elles ne doivent pas être cassées par la V1.

### 8.2 Tables runtime à ajouter

#### `cg_scope_resolution`
Historise la résolution réelle d’un scope lors du bootstrap.

Champs minimaux :

- `resolution_id uuid pk`
- `scope_id text fk`
- `resolved_space_key text`
- `resolved_space_id text null`
- `resolved_root_page_id text`
- `resolved_default_parent_page_id text`
- `resolved_ai_inbox_page_id text`
- `resolved_approver_principal_ref text`
- `resolution_source jsonb`
- `resolved_by text`
- `resolved_at timestamptz`
- `is_current boolean`

#### `cg_proposal`
Objet métier central.

Champs minimaux :

- `proposal_id uuid pk`
- `scope_id text fk`
- `proposal_type text check ('create_page','update_page')`
- `doc_type text`
- `template_id text null`
- `target_page_id text null`
- `target_parent_page_id text null`
- `title text`
- `body_input jsonb`
- `body_rendered jsonb`
- `labels jsonb`
- `content_properties jsonb`
- `write_mode text check ('append_only','managed_sections')`
- `status text check ('draft','pending_approval','approved','rejected','published','failed','rolled_back')`
- `created_by text`
- `created_at timestamptz`
- `updated_at timestamptz`

#### `cg_proposal_diff`
- `proposal_id uuid pk fk`
- `base_snapshot_id uuid null`
- `before_body jsonb null`
- `after_body jsonb not null`
- `diff_summary jsonb`
- `diff_text text`
- `risk_flags jsonb`
- `generated_at timestamptz`

#### `cg_page_snapshot`
- `snapshot_id uuid pk`
- `scope_id text fk`
- `page_id text`
- `version_number int`
- `title text`
- `body_storage jsonb null`
- `body_atlas_doc_format jsonb null`
- `labels jsonb`
- `content_properties jsonb`
- `captured_at timestamptz`

#### `cg_approval`
- `approval_id uuid pk`
- `proposal_id uuid fk`
- `approver_group_key text fk`
- `actor_ref text`
- `decision text check ('approved','rejected')`
- `comment text null`
- `decided_at timestamptz`

#### `cg_publication`
- `publication_id uuid pk`
- `proposal_id uuid fk`
- `scope_id text fk`
- `action text check ('create','update_managed_sections','create_draft','restore_version')`
- `page_id text`
- `version_number int null`
- `confluence_response jsonb`
- `published_by text`
- `published_at timestamptz`
- `rollback_of_publication_id uuid null`

#### `cg_audit_log`
- `audit_id uuid pk`
- `scope_id text null`
- `proposal_id uuid null`
- `actor_type text check ('model','widget','user','system','script')`
- `actor_ref text null`
- `action text`
- `resource_type text`
- `resource_ref text`
- `request_payload_redacted jsonb`
- `result_payload_redacted jsonb`
- `created_at timestamptz`
- `trace_id text null`

## 9. Résolution de scope

### 9.1 Ordre de résolution

Le resolver doit appliquer **cet ordre strict** :

1. `scope_id` explicite si fourni en entrée ;
2. `publisher_app_slug` si l’outil appartient à l’app Publisher ;
3. `knowledge_app_slug` si l’outil appartient à l’app Knowledge ;
4. `chatgpt_project_slug` ;
5. échec explicite `SCOPE_NOT_RESOLVED`.

### 9.2 Règles de sécurité

- si plusieurs scopes matchent : **échec**, jamais de choix implicite ;
- si `enabled = false` : échec ;
- si `environment` ne correspond pas à l’environnement courant : échec ;
- si le scope n’a pas de `publication_policy_key` valide : échec en écriture ;
- si un appel de recherche n’est pas borné par `read_cql_guard` : échec.

## 10. Contrat des outils MCP

## 10.1 App Knowledge

### `search_knowledge`

**But** : recherche bornée dans le scope.

Entrée :

```json
{
  "query": "string",
  "doc_types": ["decision", "compte-rendu"],
  "labels": ["cg-scope-finance"],
  "limit": 10,
  "cursor": null
}
```

Sortie :

```json
{
  "scope": {
    "scope_id": "internal-finance-prod",
    "space_key": "CYBFIN",
    "root_page_id": "123"
  },
  "results": [
    {
      "page_id": "456",
      "title": "CR comité finance 2026-04",
      "excerpt": "...",
      "labels": ["cg-origin-chatgpt"],
      "version": 7,
      "web_url": "..."
    }
  ],
  "next_cursor": null
}
```

Annotations :

- `readOnlyHint: true`
- pas de `openWorldHint`
- pas de `destructiveHint`

### `fetch_page`

**But** : récupérer une page précise et ses métadonnées utiles au modèle.

Entrée :

```json
{
  "page_id": "456",
  "include_body": true,
  "body_format": "storage"
}
```

Annotations :

- `readOnlyHint: true`

### `render_search_results_widget`

**But** : rendre les résultats dans le widget.

Annotations :

- `readOnlyHint: true`
- ressource UI attachée

## 10.2 App Publisher

### `propose_create_page`

**But** : créer une proposition de nouvelle page, sans publier dans Confluence.

Entrée :

```json
{
  "doc_type": "decision",
  "template_id": "tpl-decision",
  "title": "Décision - Validation budget sécurité",
  "target_parent_page_id": null,
  "content_markdown": "...",
  "labels": ["cg-origin-chatgpt"],
  "content_properties": {
    "source": "chatgpt"
  }
}
```

Effet : écrit uniquement en base locale (`cg_proposal`).

Annotations :

- `readOnlyHint: false`
- `openWorldHint: false`
- `destructiveHint: false`

### `propose_update_page`

**But** : préparer une mise à jour d’une page existante selon la politique de scope.

Entrée :

```json
{
  "target_page_id": "456",
  "update_mode": "managed_sections",
  "managed_section_key": "actions",
  "content_markdown": "...",
  "labels": ["cg-origin-chatgpt"]
}
```

Annotations :

- `readOnlyHint: false`
- `openWorldHint: false`
- `destructiveHint: false`

### `preview_proposal`

**But** : produire le diff et le contexte de validation.

Annotations :

- `readOnlyHint: true`

### `render_proposal_widget`

**But** : afficher le diff, les labels, le statut, la cible, les boutons d’action.

Annotations :

- `readOnlyHint: true`
- UI attachée

### `approve_proposal`

**But** : enregistrer une décision humaine dans la base.

**Important** : l’outil doit être **widget-only**.

Annotations :

- `readOnlyHint: false`
- `openWorldHint: false`
- `destructiveHint: false`
- `_meta.ui.visibility = ["app"]`

### `reject_proposal`

Même logique que `approve_proposal`.

### `publish_approved_proposal`

**But** : exécuter réellement l’écriture Confluence.

**Important** : l’outil doit être **widget-only**.

Annotations :

- `readOnlyHint: false`
- `openWorldHint: false`
- `destructiveHint: false` pour `create` et `managed_sections`
- `_meta.ui.visibility = ["app"]`

### `rollback_publication`

**But** : restaurer une version précédente si la politique l’autorise.

Annotations :

- `readOnlyHint: false`
- `openWorldHint: false`
- `destructiveHint: true`
- `_meta.ui.visibility = ["app"]`

## 11. Règle de séparation data tools / render tools

Le code doit séparer explicitement :

- **data tools** : recherche, fetch, proposition, diff, publication ;
- **render tools** : rendu widget.

Le widget ne doit pas être remounté inutilement à chaque étape de calcul. Les outils de rendu doivent être focalisés sur la présentation.

## 12. Workflow métier V1

### 12.1 Recherche

1. résolution du scope ;
2. application du `read_cql_guard` ;
3. recherche CQL ;
4. fetch des pages retenues ;
5. réponse structurée.

### 12.2 Proposition de création

1. résolution du scope ;
2. validation `doc_type`, `template_id`, labels, parent ;
3. rendu Confluence canonical body ;
4. création `cg_proposal` ;
5. génération diff ;
6. rendu widget ;
7. approbation humaine ;
8. publication selon `publication_policy_key`.

### 12.3 Proposition de mise à jour

1. résolution du scope ;
2. fetch page cible ;
3. contrôle que la page est bien sous `root_page_id` ;
4. contrôle des restrictions locales ;
5. création snapshot ;
6. calcul de la mise à jour autorisée (`append_only` ou `managed_sections`) ;
7. création `cg_proposal` ;
8. diff ;
9. validation humaine ;
10. publication ;
11. audit ;
12. rollback possible.

## 13. Stratégies d’écriture autorisées

### 13.1 `append_only`

Cas d’usage : comptes-rendus, décisions, synthèses, diagnostics.

Règle :

- **création d’une nouvelle page** uniquement ;
- jamais d’update de page existante.

### 13.2 `managed_sections`

Cas d’usage : pages vivantes, feuilles d’action, runbooks, pilotage.

Règle : seules les sections encadrées sont modifiables.

Format canonique V1 :

```html
<!-- cg:managed:start actions -->
... contenu géré ...
<!-- cg:managed:end actions -->
```

Le parser doit :

- détecter toutes les zones gérées ;
- refuser si la section demandée n’existe pas ;
- ne jamais modifier hors bornes.

### 13.3 `draft_only`

Cas d’usage : clients sensibles.

Règle :

- la Gateway crée un brouillon ou une page en `AI Inbox` ;
- la publication finale est effectuée manuellement dans Confluence.

## 14. Confluence adapter

## 14.1 Règles générales

- utiliser **REST Confluence** comme vérité ;
- utiliser **v2** pour pages/spaces quand c’est pertinent ;
- utiliser **v1** pour certains endpoints encore pratiques (`content/search`, versions, labels si nécessaire) ;
- centraliser les appels dans un package unique `packages/confluence`.

## 14.2 Fonctions minimales à implémenter

### Search

- `searchContentByCql(scope, query, limit, cursor)`
- ne pas utiliser `expand=body.storage.value` dans la phase de recherche large ;
- faire un fetch séparé sur les pages retenues.

### Space

- `listSpaces()`
- `getSpaceByKey(key)`
- `findSpacesByNameHint(nameHint)`

### Page

- `getPage(pageId, bodyFormat)`
- `createPage(spaceId|spaceKey, parentId, title, body, status)`
- `updatePageManagedSections(pageId, version, body)`
- `createDraftInAiInbox(...)`

### Labels

- `getLabels(pageId)`
- `addLabels(pageId, labels)`

### Properties

- `getContentProperties(pageId)`
- `setContentProperty(pageId, key, value)`

### Versions

- `getPageVersions(pageId)`
- `restoreVersion(pageId, versionNumber)`

## 15. Format de contenu

La Gateway doit normaliser le contenu selon un format pivot interne :

```ts
interface CanonicalDoc {
  title: string;
  docType: string;
  sections: Array<{
    key: string;
    title?: string;
    contentMarkdown: string;
    managed?: boolean;
  }>;
  metadata: Record<string, unknown>;
}
```

Le moteur de rendu convertit ensuite vers le format attendu par Confluence.

### 15.1 Règle V1

- le **pivot interne** peut être Markdown structuré ;
- la **sortie Confluence** doit être compatible avec le flux de création/mise à jour choisi ;
- si une conversion est nécessaire entre `storage` et `atlas_doc_format`, elle doit être encapsulée.

## 16. Content properties : règles strictes

Les content properties ne doivent contenir **aucune donnée sensible**. V1 : uniquement des métadonnées de pilotage non sensibles.

Clés recommandées :

- `cg.proposalId`
- `cg.scopeId`
- `cg.docType`
- `cg.sourceApp`
- `cg.publicationPolicy`
- `cg.approvedBy`
- `cg.publishedAt`

## 17. Widget UX V1

Le widget Publisher doit afficher :

- scope courant ;
- espace Confluence cible ;
- page cible ou parent cible ;
- politique de publication ;
- diff avant/après ;
- labels à appliquer ;
- indicateurs de risque ;
- statut (`draft`, `pending_approval`, `approved`, etc.) ;
- boutons :
  - `Envoyer à validation`
  - `Approuver`
  - `Rejeter`
  - `Publier`
  - `Rollback` si éligible

L’UI doit rester **host-agnostic** autant que possible.

## 18. Authentification et autorisation

### 18.1 Côté MCP

Implémenter :

- `GET /.well-known/oauth-protected-resource`
- `401` avec `WWW-Authenticate` conforme si non authentifié
- `securitySchemes` par outil

### 18.2 Côté Atlassian

Supporter deux modes :

#### `managed_scope`
Compte technique cantonné à un scope.

#### `user_context`
L’utilisateur agit avec ses permissions Confluence.

### 18.3 Autorisation applicative

Le serveur doit vérifier **à chaque appel** :

- scope résolu ;
- outil autorisé pour ce scope ;
- politique de publication ;
- labels autorisés ;
- type documentaire autorisé ;
- page cible sous la racine ;
- groupe approbateur valide pour l’approbation.

## 19. Bootstrap de résolution des vraies valeurs

### 19.1 Objectif

Remplacer automatiquement ou semi-automatiquement :

- `confluence_space_key`
- `confluence_space_id`
- `root_page_id`
- `default_parent_page_id`
- `ai_inbox_page_id`
- `approver_group_key.principal_ref`

### 19.2 Entrée attendue

Un manifest d’entrée de type :

```yaml
scopes:
  - scope_id: client-smdm-prod
    atlassian_site: cybergogne.atlassian.net
    space_hint:
      key: CLSMDM
      name: Saint-Martin-de-la-Mer
    page_hints:
      root:
        title: "Projet Client - Saint-Martin-de-la-Mer"
      default_parent:
        title: "20 Comptes-rendus"
      ai_inbox:
        title: "90 AI Inbox"
    approver_hint:
      principal_type: email_list
      candidates:
        - "mairie@saintmartindelamer.fr"
```

### 19.3 Commandes à fournir

- `pnpm bootstrap:discover --manifest ./config/registry/resolution.yaml`
- `pnpm bootstrap:validate --scope client-smdm-prod`
- `pnpm bootstrap:apply --source ./out/resolved-registry.yaml`
- `pnpm bootstrap:report --scope client-smdm-prod`

### 19.4 Algorithme

Pour chaque scope :

1. vérifier l’accès Atlassian ;
2. résoudre le space par `key` si fourni ;
3. sinon proposer les espaces candidats ;
4. résoudre `root_page_id` par titre exact d’abord ;
5. si ambiguïté, résoudre par CQL + espace + titre ;
6. résoudre `default_parent_page_id` et `ai_inbox_page_id` ;
7. vérifier que `default_parent_page_id` et `ai_inbox_page_id` sont descendants de `root_page_id` ;
8. recalculer `read_cql_guard` ;
9. résoudre le groupe approbateur selon `principal_type` :
   - `atlassian_group` -> lookup groupe Atlassian ;
   - `external_directory_group` -> lookup via source externe configurée ;
   - `email_list` -> valider structure et dédupliquer ;
10. produire un rapport humain lisible ;
11. écrire un YAML résolu ;
12. écrire en base après validation explicite.

### 19.5 Cas d’ambiguïté

En cas de plusieurs résultats :

- ne jamais choisir silencieusement ;
- sortir un rapport avec les candidats et leur URL ;
- marquer le scope `bootstrap_status = requires_manual_choice`.

## 20. Politique d’approbation

### 20.1 Règle V1

Aucune écriture Confluence finale sans :

- proposition existante ;
- diff calculé ;
- approbation conforme au `quorum_rule`.

### 20.2 Moteur de quorum

Support minimal :

- `one_of`
- `all_of`
- `n_of_m`

### 20.3 Qui peut approuver ?

Le moteur d’approbation doit être découplé de Confluence. Un approbateur peut être :

- un groupe Atlassian ;
- un groupe externe (Google Workspace / Azure AD / autre) ;
- une liste email nominative.

V1 :

- priorité au modèle `email_list` ou `external_directory_group` si la gouvernance réelle n’est pas encore stabilisée ;
- ne pas lier la sécurité de publication à une hypothèse implicite sur les rôles humains.

## 21. Logging, audit, conformité

Journaliser au minimum :

- résolution de scope ;
- recherche CQL exécutée ;
- fetch de page ;
- création de proposition ;
- génération de diff ;
- décision d’approbation ;
- publication ;
- rollback ;
- erreurs Confluence ;
- refus d’autorisation.

Le log doit être **redacted** :

- pas de secrets ;
- pas de données personnelles inutiles ;
- pas de body complet si non nécessaire.

## 22. Observabilité

Exiger :

- `trace_id` par requête MCP ;
- `proposal_id` dans tous les logs métier ;
- logs structurés JSON ;
- métriques minimales :
  - nombre de recherches ;
  - nombre de propositions ;
  - temps moyen diff ;
  - temps moyen publication ;
  - taux d’erreur Confluence ;
  - taux de refus d’autorisation.

## 23. Gestion du rate limiting

Le client Confluence doit inclure :

- retry exponentiel borné ;
- respect des en-têtes de rate limit quand présents ;
- file d’attente interne pour publications ;
- découplage lecture / publication.

V1 : ne pas lancer de polling massif. Préférer une stratégie `search minimal -> fetch ciblé`.

## 24. Tests attendus

### 24.1 Unitaires

- résolution de scope ;
- validation politique de publication ;
- validation labels/doc types ;
- parser managed sections ;
- diff engine ;
- quorum engine.

### 24.2 Intégration

- recherche CQL bornée ;
- fetch page ;
- création de proposition ;
- publication `append_only` ;
- publication `managed_sections` ;
- rollback.

### 24.3 Contrats MCP

- snapshot des schémas d’entrée/sortie ;
- annotations obligatoires présentes ;
- outils app-only non visibles du modèle.

### 24.4 E2E

Scénario 1 :

- projet `gc-finance`
- recherche d’un compte-rendu
- proposition d’ajout d’une décision
- approbation widget
- publication Confluence
- audit complet

Scénario 2 :

- scope `client-smdm-prod`
- politique `draft_only`
- création dans `AI Inbox`
- pas de publication finale automatique.

## 25. Définition de terminé

La V1 est terminée quand :

1. le dépôt se build et passe `lint`, `typecheck`, `test` ;
2. le registre SQL est appliqué et seedé ;
3. un scope peut être résolu sans ambiguïté ;
4. les outils Knowledge fonctionnent en lecture bornée ;
5. les outils Publisher créent une proposition, un diff et une trace d’audit ;
6. l’approbation widget-only fonctionne ;
7. la publication respecte la politique de scope ;
8. le rollback fonctionne ;
9. le bootstrap permet de remplacer au moins un scope factice par des IDs réels ;
10. aucun write direct hors workflow d’approbation n’est possible.

## 26. Livrables que Codex doit produire

### 26.1 Code

- backend MCP complet
- widget minimal fonctionnel
- scripts bootstrap
- migrations SQL
- tests

### 26.2 Configuration

- `.env.example`
- `config/registry/*.yaml`
- seed SQL ou YAML

### 26.3 Documentation

- `README.md`
- `docs/runbooks/bootstrap.md`
- `docs/runbooks/publish.md`
- `docs/api/tool-catalog.md`
- `docs/architecture/sequence-diagrams.md`

## 27. Ordre d’implémentation recommandé pour Codex

1. monorepo + quality gates ;
2. schémas + types partagés ;
3. DB + migrations + seeds ;
4. scope resolver ;
5. confluence client ;
6. knowledge tools ;
7. proposal model + diff ;
8. publisher widget ;
9. approval engine ;
10. publish engine ;
11. rollback ;
12. bootstrap discovery ;
13. observabilité ;
14. documentation finale.

## 28. Décisions d’architecture à ne pas contourner

1. **Le registre de scope est l’autorité**.
2. **Confluence REST est la vérité documentaire**.
3. **Aucune publication finale sans validation humaine**.
4. **Aucun write tool sensible exposé directement au modèle**.
5. **Aucune mise à jour full-page libre en V1**.
6. **Aucune donnée sensible dans les content properties**.
7. **Tout appel de recherche doit être borné par `space + ancestor`**.
8. **Les IDs réels doivent être découverts/validés, jamais supposés**.

## 29. Extension post-V1 déjà anticipée

Prévoir sans implémenter entièrement :

- intégration Forge pour événements/validation native ;
- multi-tenant plus riche ;
- index hybride ;
- portail d’administration ;
- synchronisation API/OpenAI Responses ;
- empaquetage plugin Codex/ChatGPT pour partage d’équipe.

