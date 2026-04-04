# Catalogue d'outils MCP

## Knowledge
- `search_knowledge`
  Retourne un payload normalise avec `scope`, `results[]` et `next_cursor`.
- `fetch_page`
  Retourne `page_id`, `version`, `web_url`, `ancestor_ids` et, si demande, le body canonique.
- `render_search_results_widget`
  Outil de rendu Apps avec ressource UI attachee.

## Publisher
- `propose_create_page`
  Cree une proposition locale apres resolution stricte du scope et validation de la politique.
- `propose_update_page`
  Prepare un diff `managed_sections` dans le scope autorise.
- `preview_proposal`
  Retourne `proposal`, `diff`, `scope`, `approvals`, `publication_policy` et `latest_publication`.
- `render_proposal_widget`
  Outil de rendu Apps pour la revue humaine.
- `approve_proposal` *(widget-only)*
- `reject_proposal` *(widget-only)*
- `publish_approved_proposal` *(widget-only)*
- `rollback_publication` *(widget-only)*

## Regles
- Separation explicite entre data tools et render tools.
- Les outils sensibles restent caches au modele via `_meta.ui.visibility = ["app"]`.
- En lecture: `readOnlyHint=true`.
- En ecriture: scope resolu, labels normalises, politique validee et audit obligatoire.
- En mode HTTP protege: les outils exposent `securitySchemes` et le serveur publie `/.well-known/oauth-protected-resource`.
