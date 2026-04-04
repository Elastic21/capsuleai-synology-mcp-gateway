# PLANS.md — Plan d’implémentation Codex

## Statut

- [ ] M0 — Initialisation dépôt
- [ ] M1 — Base de données et registre
- [ ] M2 — Scope resolver et authz
- [ ] M3 — Client Confluence
- [ ] M4 — App Knowledge
- [ ] M5 — Proposals + diff
- [ ] M6 — Widget Publisher
- [ ] M7 — Approval + publish + rollback
- [ ] M8 — Bootstrap de résolution
- [ ] M9 — Observabilité + hardening
- [ ] M10 — Documentation et recette

## M0 — Initialisation dépôt

### Tâches
- créer le monorepo pnpm
- configurer TS strict
- configurer lint, format, tests
- ajouter `AGENTS.md` et la spec principale

### Acceptation
- `pnpm install`
- `pnpm lint`
- `pnpm typecheck`
- dépôt exécutable localement

## M1 — Base de données et registre

### Tâches
- intégrer `cg_scope_registry_v1.sql`
- créer migrations pour tables runtime : proposals, approvals, publications, snapshots, audit
- créer seed minimal depuis `cg_scope_registry_v1_examples.yaml`
- ajouter export/import YAML

### Acceptation
- DB migrée sans erreur
- seed idempotent
- tests unitaires OK

## M2 — Scope resolver et authz

### Tâches
- implémenter résolution par `scope_id`, `app_slug`, `project_slug`
- implémenter validation `enabled`, `environment`, policy, labels, doc types
- implémenter refus explicites et codes d’erreur

### Acceptation
- un scope valide est résolu correctement
- les collisions échouent explicitement
- un appel hors scope est refusé

## M3 — Client Confluence

### Tâches
- client REST centralisé
- endpoints search, spaces, pages, labels, properties, versions
- retries et backoff
- redaction des logs

### Acceptation
- faux client testable en unitaires
- client réel testable en intégration sur sandbox

## M4 — App Knowledge

### Tâches
- implémenter `search_knowledge`
- implémenter `fetch_page`
- implémenter `render_search_results_widget`
- contract tests MCP

### Acceptation
- recherche bornée par `read_cql_guard`
- fetch page fonctionnel
- widget de résultats minimal

## M5 — Proposals + diff

### Tâches
- implémenter `propose_create_page`
- implémenter `propose_update_page`
- implémenter snapshots
- implémenter diff engine
- implémenter `preview_proposal`

### Acceptation
- une proposition crée un enregistrement DB complet
- le diff est disponible et lisible
- les risques sont signalés

## M6 — Widget Publisher

### Tâches
- widget de revue de proposition
- affichage scope / cible / labels / diff / statut
- états widget-only
- outils cachés au modèle

### Acceptation
- le widget sait approuver/rejeter via `tools/call`
- aucune commande sensible n’est visible du modèle

## M7 — Approval + publish + rollback

### Tâches
- moteur de quorum
- `approve_proposal`
- `reject_proposal`
- `publish_approved_proposal`
- `rollback_publication`
- audit complet

### Acceptation
- publication append-only OK
- publication managed-sections OK
- rollback OK
- toutes les actions sont auditables

## M8 — Bootstrap de résolution

### Tâches
- parser le manifest de résolution
- découvrir espaces et pages
- valider la hiérarchie `root -> default_parent / ai_inbox`
- résoudre groupes approbateurs
- produire un YAML résolu
- appliquer le YAML résolu en base

### Acceptation
- au moins un scope factice peut être remplacé par des IDs réels
- ambiguïtés signalées sans auto-choix silencieux

## M9 — Observabilité + hardening

### Tâches
- logs JSON structurés
- `trace_id`
- métriques minimales
- rate limiting/backoff
- tests de charge basiques

### Acceptation
- logs exploitables
- erreurs Confluence correctement typées
- retries bornés

## M10 — Documentation et recette

### Tâches
- README projet
- runbook bootstrap
- runbook publication
- catalogue des outils MCP
- checklist de mise en production

### Acceptation
- un nouvel ingénieur peut installer, configurer et lancer la V1 sans assistance orale

