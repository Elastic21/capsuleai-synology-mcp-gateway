# Plan de recette fonctionnelle V1

## Objet

Ce document transforme la matrice de couverture fonctionnelle en plan de recette executable
pour la Gateway MCP Cybergogne V1, avec le deploiement Synology DSM et le tenant
Confluence actuellement configures.

Le plan couvre :

- le socle technique
- le registre et la resolution de scope
- la lecture Confluence
- le workflow `proposal -> approval -> publish`
- la securite et le deny-by-default
- l'audit et l'exploitation

## Portee et hypotheses

- Environnement cible : Synology DSM avec `Container Manager`
- Projet Compose : `capsuleai-mcp-gateway`
- Conteneurs :
  - `cg-gateway-mcp`
  - `cg-gateway-postgres`
- Endpoint MCP HTTP : `http://192.168.1.132:8787/mcp`
- Auth MCP : bearer statique
- Tenant Atlassian : `https://cybergogne-team.atlassian.net`
- Scope reel disponible : `internal-commercial-prod`

## Pre-requis

- le projet Synology est demarre et stable
- le registre a ete seed avec `cg_scope_registry_v1_examples.yaml`
- le scope `internal-commercial-prod` pointe vers l'espace reel `Commercial`
- le bearer MCP est connu
- l'acces SSH au NAS est disponible
- l'acces Confluence du compte de service est valide

## Variables de recette

### Variables PowerShell

Executer une fois au debut de la recette :

```powershell
$baseUrl = "http://192.168.1.132:8787/mcp"
$token = "REMPLACER_PAR_VOTRE_TOKEN_MCP"
$outOfScopePageId = "98405"
$testTitle = "Recette MCP Commercial " + (Get-Date -Format "yyyyMMdd-HHmmss")

$headers = @{
  Authorization = "Bearer $token"
  "Content-Type" = "application/json"
  Accept = "application/json, text/event-stream"
}

$initBody = @{
  jsonrpc = "2.0"
  id = "init-1"
  method = "initialize"
  params = @{
    protocolVersion = "2025-03-26"
    capabilities = @{}
    clientInfo = @{
      name = "powershell-functional-test"
      version = "1.0.0"
    }
  }
} | ConvertTo-Json -Depth 10

$initResponse = Invoke-WebRequest -Uri $baseUrl -Method Post -Headers $headers -Body $initBody
$sessionId = ($initResponse.Headers["Mcp-Session-Id"] | Select-Object -First 1)

$sessionHeaders = @{
  Authorization = "Bearer $token"
  "Content-Type" = "application/json"
  Accept = "application/json, text/event-stream"
  "Mcp-Session-Id" = $sessionId
}

$initializedBody = @{
  jsonrpc = "2.0"
  method = "notifications/initialized"
  params = @{}
} | ConvertTo-Json -Depth 10

Invoke-WebRequest -Uri $baseUrl -Method Post -Headers $sessionHeaders -Body $initializedBody | Out-Null
```

### Variables SSH / SQL

```sh
MCP_CONTAINER=cg-gateway-mcp
PG_CONTAINER=cg-gateway-postgres
PG_DB=cg_gateway
PG_USER=postgres
```

## Convention de statut

- `[ ]` a executer
- `[x]` valide
- `[~]` valide partiellement / observation
- `[N/A]` non applicable

---

## T01 - Socle : conteneurs et endpoint HTTP

Statut : `[ ]`

Objectif :
- verifier que le deploiement Synology est sain

Commandes :

```sh
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
curl -i http://192.168.1.132:8787/
```

Resultat attendu :
- `cg-gateway-mcp` et `cg-gateway-postgres` sont `Up`
- `http://192.168.1.132:8787/` repond `200`
- le body contient `Cybergogne MCP server`

---

## T02 - Auth MCP : refus sans bearer

Statut : `[ ]`

Objectif :
- verifier que `/mcp` est protege

Commande :

```powershell
Invoke-WebRequest -Uri "http://192.168.1.132:8787/mcp" -Method Post -ContentType "application/json" -Body '{"jsonrpc":"2.0","id":"x","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"unauth","version":"1.0.0"}}}'
```

Resultat attendu :
- echec `401`
- presence de `WWW-Authenticate`
- `resource_metadata` pointe vers `/.well-known/oauth-protected-resource/mcp`

---

## T03 - Protected resource metadata

Statut : `[ ]`

Objectif :
- verifier la publication des metadata OAuth protected resource

Commande :

```powershell
Invoke-RestMethod -Uri "http://192.168.1.132:8787/.well-known/oauth-protected-resource/mcp"
```

Resultat attendu :
- `resource = http://192.168.1.132:8787/mcp`
- `scopes_supported` contient `mcp:tools`

---

## T04 - Initialisation MCP et catalogue d'outils

Statut : `[ ]`

Objectif :
- verifier la session MCP
- verifier que les outils sensibles ne sont pas visibles du modele

Commande :

```powershell
$toolsListBody = @{
  jsonrpc = "2.0"
  id = "tools-1"
  method = "tools/list"
  params = @{}
} | ConvertTo-Json -Depth 10

$toolsListResponse = Invoke-RestMethod -Uri $baseUrl -Method Post -Headers $sessionHeaders -Body $toolsListBody
$toolsListResponse.result.tools | Format-Table name, description -AutoSize
```

Resultat attendu :
- presence de `search_knowledge`, `fetch_page`, `propose_create_page`, `propose_update_page`, `preview_proposal`
- presence de `render_search_results_widget`, `render_proposal_widget`
- absence de `approve_proposal`, `reject_proposal`, `publish_approved_proposal`, `rollback_publication`

---

## T05 - Seed du registre et verification SQL

Statut : `[ ]`

Objectif :
- verifier que le registre est charge et coherent

Commandes :

```sh
docker exec -it $MCP_CONTAINER node scripts/seed-registry-prod.mjs /app/cg_scope_registry_v1_examples.yaml

docker exec -it $PG_CONTAINER psql -U $PG_USER -d $PG_DB -c "select scope_id, environment, enabled, confluence_space_key from cg_scope_registry order by scope_id;"
```

Resultat attendu :
- au moins `internal-commercial-prod`, `internal-finance-prod`, `client-smdm-prod`, `program-auxois-morvan-prod`

---

## T06 - Scope reel commercial

Statut : `[ ]`

Objectif :
- verifier que le scope `internal-commercial-prod` est aligne sur l'espace reel

Commande :

```sh
docker exec -it $PG_CONTAINER psql -U $PG_USER -d $PG_DB -c "select scope_id, confluence_space_key, confluence_space_id, root_page_id, default_parent_page_id, ai_inbox_page_id, read_cql_guard from cg_scope_registry where scope_id = 'internal-commercial-prod';"
```

Resultat attendu :
- `confluence_space_key = Commercial`
- `confluence_space_id = 11763716`
- `root_page_id = 11763965`
- `default_parent_page_id = 11763965`
- `ai_inbox_page_id = 11763965`
- `read_cql_guard = space = "Commercial" AND ancestor = 11763965`

---

## T07 - Lecture Confluence directe

Statut : `[ ]`

Objectif :
- verifier la connectivite et l'auth Atlassian en dehors du pipeline MCP

Commande :

```sh
docker exec -it $MCP_CONTAINER node --input-type=module -e 'const base=(process.env.ATLASSIAN_BASE_URL||"").replace(/\/$/,""); const auth=process.env.ATLASSIAN_AUTH_MODE==="bearer" ? "Bearer "+process.env.ATLASSIAN_BEARER_TOKEN : "Basic "+Buffer.from(`${process.env.ATLASSIAN_EMAIL}:${process.env.ATLASSIAN_API_TOKEN}`,"utf8").toString("base64"); for (const path of ["/wiki/rest/api/space?limit=1","/wiki/rest/api/content/search?cql=type%20%3D%20page&limit=1"]) { const res=await fetch(base+path,{headers:{Authorization:auth,Accept:"application/json"}}); console.log("\nPATH", path); console.log("STATUS", res.status, res.statusText); console.log((await res.text()).slice(0,300)); }'
```

Resultat attendu :
- `200 OK` sur les 2 endpoints

---

## T08 - search_knowledge positif

Statut : `[ ]`

Objectif :
- verifier qu'une recherche bornee par scope remonte des pages reelles

Commande :

```powershell
$searchBody = @{
  jsonrpc = "2.0"
  id = "search-1"
  method = "tools/call"
  params = @{
    name = "search_knowledge"
    arguments = @{
      scope_id = "internal-commercial-prod"
      query = "commerciale"
      limit = 10
    }
  }
} | ConvertTo-Json -Depth 20

$searchResponse = Invoke-RestMethod -Uri $baseUrl -Method Post -Headers $sessionHeaders -Body $searchBody
$searchResponse | ConvertTo-Json -Depth 20
$searchResponse.result.structuredContent.results | Format-Table page_id, title, version, web_url -AutoSize
```

Resultat attendu :
- `isError` absent
- `structuredContent.scope.scope_id = internal-commercial-prod`
- au moins 1 resultat, par exemple `Strategie d'approche commerciale`

---

## T09 - fetch_page positif dans le scope

Statut : `[ ]`

Objectif :
- verifier qu'une page sous la racine est lisible

Pre-requis :
- reutiliser le premier `page_id` de `T08`

Commande :

```powershell
$pageId = $searchResponse.result.structuredContent.results[0].page_id

$fetchBody = @{
  jsonrpc = "2.0"
  id = "fetch-1"
  method = "tools/call"
  params = @{
    name = "fetch_page"
    arguments = @{
      scope_id = "internal-commercial-prod"
      page_id = $pageId
      include_body = $true
      body_format = "storage"
    }
  }
} | ConvertTo-Json -Depth 20

$fetchResponse = Invoke-RestMethod -Uri $baseUrl -Method Post -Headers $sessionHeaders -Body $fetchBody
$fetchResponse | ConvertTo-Json -Depth 20
```

Resultat attendu :
- page retournee avec `page_id`, `title`, `version`, `ancestor_ids`, `web_url`
- `body_format = storage`

---

## T10 - fetch_page negatif hors scope

Statut : `[ ]`

Objectif :
- verifier le deny-by-default sur une page hors racine

Commande :

```powershell
$fetchOutOfScopeBody = @{
  jsonrpc = "2.0"
  id = "fetch-2"
  method = "tools/call"
  params = @{
    name = "fetch_page"
    arguments = @{
      scope_id = "internal-commercial-prod"
      page_id = $outOfScopePageId
      include_body = $false
      body_format = "storage"
    }
  }
} | ConvertTo-Json -Depth 20

Invoke-RestMethod -Uri $baseUrl -Method Post -Headers $sessionHeaders -Body $fetchOutOfScopeBody
```

Resultat attendu :
- echec explicite du type `PAGE_OUT_OF_SCOPE`

Note :
- `98405` est un exemple de page hors espace `Commercial`
- si cette page n'est pas accessible sur votre tenant, remplacer par une page d'un autre espace

---

## T11 - search_knowledge negatif sans scope resolu

Statut : `[ ]`

Objectif :
- verifier le deny-by-default si le scope n'est pas resolu

Commande :

```powershell
$searchUnknownBody = @{
  jsonrpc = "2.0"
  id = "search-unknown"
  method = "tools/call"
  params = @{
    name = "search_knowledge"
    arguments = @{
      scope_id = "unknown-scope"
      query = "commerciale"
      limit = 5
    }
  }
} | ConvertTo-Json -Depth 20

Invoke-RestMethod -Uri $baseUrl -Method Post -Headers $sessionHeaders -Body $searchUnknownBody
```

Resultat attendu :
- erreur `SCOPE_NOT_RESOLVED`

---

## T12 - propose_create_page positif

Statut : `[ ]`

Objectif :
- verifier la creation d'une proposition locale complete

Commande :

```powershell
$proposeBody = @{
  jsonrpc = "2.0"
  id = "proposal-1"
  method = "tools/call"
  params = @{
    name = "propose_create_page"
    arguments = @{
      scope_id = "internal-commercial-prod"
      doc_type = "synthese"
      title = $testTitle
      content_markdown = "# Recette`n`nCeci est une proposition de test."
      labels = @("cg-recette")
      content_properties = @{
        "cg.scopeId" = "internal-commercial-prod"
      }
    }
  }
} | ConvertTo-Json -Depth 20

$proposalResponse = Invoke-RestMethod -Uri $baseUrl -Method Post -Headers $sessionHeaders -Body $proposeBody
$proposalResponse | ConvertTo-Json -Depth 20
$proposalId = $proposalResponse.result.structuredContent.proposal.proposal_id
$proposalId
```

Resultat attendu :
- une `proposal_id` UUID est retournee
- le statut initial est `draft`
- un diff est present

---

## T13 - preview_proposal et traces DB

Statut : `[ ]`

Objectif :
- verifier la persistance complete de la proposition

Commandes :

```powershell
$previewBody = @{
  jsonrpc = "2.0"
  id = "preview-1"
  method = "tools/call"
  params = @{
    name = "preview_proposal"
    arguments = @{
      proposal_id = $proposalId
      scope_id = "internal-commercial-prod"
    }
  }
} | ConvertTo-Json -Depth 20

$previewResponse = Invoke-RestMethod -Uri $baseUrl -Method Post -Headers $sessionHeaders -Body $previewBody
$previewResponse | ConvertTo-Json -Depth 20
```

```sh
docker exec -it $PG_CONTAINER psql -U $PG_USER -d $PG_DB -c "select proposal_id, scope_id, proposal_type, status, title from cg_proposal where proposal_id = '<PROPOSAL_ID>';"
docker exec -it $PG_CONTAINER psql -U $PG_USER -d $PG_DB -c "select proposal_id, generated_at from cg_proposal_diff where proposal_id = '<PROPOSAL_ID>';"
docker exec -it $PG_CONTAINER psql -U $PG_USER -d $PG_DB -c "select action, resource_type, resource_ref, actor_type from cg_audit_log where proposal_id = '<PROPOSAL_ID>' order by created_at;"
```

Resultat attendu :
- une ligne dans `cg_proposal`
- une ligne dans `cg_proposal_diff`
- au moins une ligne d'audit `propose_create_page`

Note :
- remplacer `<PROPOSAL_ID>` par la valeur de `$proposalId`

---

## T14 - Rejet des content properties sensibles

Statut : `[ ]`

Objectif :
- verifier qu'aucun secret n'est accepte en content properties

Commande :

```powershell
$secretProposalBody = @{
  jsonrpc = "2.0"
  id = "proposal-secret"
  method = "tools/call"
  params = @{
    name = "propose_create_page"
    arguments = @{
      scope_id = "internal-commercial-prod"
      doc_type = "synthese"
      title = $testTitle + " secret"
      content_markdown = "Test"
      content_properties = @{
        apiToken = "secret"
      }
    }
  }
} | ConvertTo-Json -Depth 20

Invoke-RestMethod -Uri $baseUrl -Method Post -Headers $sessionHeaders -Body $secretProposalBody
```

Resultat attendu :
- erreur `CONTENT_PROPERTY_FORBIDDEN`

---

## T15 - Outils sensibles widget-only

Statut : `[ ]`

Objectif :
- verifier la separation modele / widget

Commandes :

```powershell
$toolsListResponse.result.tools.name
```

Verification manuelle :
- ouvrir un host Apps / widget compatible
- afficher `render_proposal_widget` pour la `proposal_id`
- verifier la presence des actions `approve`, `reject`, `publish`, `rollback` dans le widget

Resultat attendu :
- outils sensibles absents du `tools/list` modele
- actions sensibles visibles et operables dans le widget

---

## T16 - Approval -> publish -> rollback

Statut : `[ ]`

Objectif :
- verifier le workflow humain complet

Pre-requis :
- disposer d'un host Apps / widget compatible
- reutiliser la `proposal_id` creee en `T12`

Etapes :
- approuver la proposition depuis le widget
- publier la proposition depuis le widget
- verifier dans Confluence que la page a ete creee sous `Commercial`
- relever le `publication_id`
- lancer le rollback depuis le widget

Verifications SQL :

```sh
docker exec -it $PG_CONTAINER psql -U $PG_USER -d $PG_DB -c "select proposal_id, status from cg_proposal where proposal_id = '<PROPOSAL_ID>';"
docker exec -it $PG_CONTAINER psql -U $PG_USER -d $PG_DB -c "select publication_id, action, page_id, published_by, rollback_of_publication_id from cg_publication where proposal_id = '<PROPOSAL_ID>' order by published_at;"
docker exec -it $PG_CONTAINER psql -U $PG_USER -d $PG_DB -c "select action, actor_type, resource_type, resource_ref from cg_audit_log where proposal_id = '<PROPOSAL_ID>' order by created_at;"
```

Resultat attendu :
- la proposition passe par `approved` puis `published`
- une ligne `cg_publication` est creee pour la publication
- une ligne `cg_publication` supplementaire est creee pour le rollback
- l'audit contient `approve_proposal`, `publish_approved_proposal`, `rollback_publication`

---

## T17 - Managed sections

Statut : `[ ]`

Objectif :
- verifier `propose_update_page` et la mise a jour limitee aux sections balisees

Pre-requis :
- disposer d'une page de test dans `Commercial` contenant :

```html
<!-- cg:managed:start actions -->
<p>Ancien contenu</p>
<!-- cg:managed:end actions -->
```

Commande :

```powershell
$managedBody = @{
  jsonrpc = "2.0"
  id = "proposal-update-1"
  method = "tools/call"
  params = @{
    name = "propose_update_page"
    arguments = @{
      scope_id = "internal-commercial-prod"
      target_page_id = "REMPLACER_PAR_LA_PAGE_DE_TEST"
      update_mode = "managed_sections"
      managed_section_key = "actions"
      content_markdown = "Nouveau contenu de recette"
      labels = @("cg-recette")
    }
  }
} | ConvertTo-Json -Depth 20

$managedResponse = Invoke-RestMethod -Uri $baseUrl -Method Post -Headers $sessionHeaders -Body $managedBody
$managedResponse | ConvertTo-Json -Depth 20
```

Resultat attendu :
- proposition creee
- diff present
- seule la section `actions` est modifiee
- aucune edition libre de page complete n'est possible

---

## T18 - Redeploiement sans perte du registre

Statut : `[ ]`

Objectif :
- verifier l'exploitabilite du deploiement GHCR sur Synology

Commandes :

```sh
cd /volume1/Private/Cybergogne/Développements/cg-gateway-mcp-repo/deployment/synology-ghcr
sudo docker compose -p capsuleai-mcp-gateway up -d --no-deps --force-recreate mcp-server
docker exec -it $PG_CONTAINER psql -U $PG_USER -d $PG_DB -c "select count(*) from cg_scope_registry;"
```

Resultat attendu :
- `mcp-server` redemarre
- le nombre de scopes en base reste stable

---

## T19 - Journal d'audit minimal

Statut : `[ ]`

Objectif :
- verifier que les actions importantes laissent une trace

Commande :

```sh
docker exec -it $PG_CONTAINER psql -U $PG_USER -d $PG_DB -c "select action, actor_type, resource_type, resource_ref, created_at from cg_audit_log order by created_at desc limit 20;"
```

Resultat attendu :
- au moins des traces pour `search_knowledge`, `fetch_page`, `propose_create_page`
- si widget teste : traces pour `approve_proposal`, `publish_approved_proposal`, `rollback_publication`

---

## T20 - Gaps de couverture a traiter ulterieurement

Statut : `[ ]`

Objectif :
- noter les exigences encore peu ou pas automatisees

Points a documenter en sortie de recette :
- absence actuelle de script `pnpm test:integration`
- absence actuelle de tests widget automatises
- absence actuelle de recette automatisee `proposal -> approval -> publish -> rollback`
- absence actuelle de tests de charge basiques

Resultat attendu :
- ces gaps sont traces explicitement dans le PV de recette

