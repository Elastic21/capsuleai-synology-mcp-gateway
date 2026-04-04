# Deploiement Synology DSM (DS1522+)

Cette cible vise un deploiement sur Synology DSM 7.2+ via Container Manager en mode `HTTP MCP`.

Alternative disponible:

- [deploiement via image GHCR publique](./synology-ghcr-public.md)

## Hypotheses

- modele cible: DS1522+ (`linux/amd64`)
- DSM 7.2 ou plus recent
- package `Container Manager` installe
- le projet est deploye comme projet Compose depuis un dossier partage DSM

## Fichiers fournis

- `Dockerfile.prod`
- `compose.synology.yml`
- `.env.synology.example`
- `scripts/docker-entrypoint.sh`
- `scripts/migrate-prod.mjs`

## Structure recommandee sur le NAS

1. Creer un dossier partage, par exemple `docker/cg-gateway-mcp`.
2. Copier le depot dans ce dossier.
3. Copier `.env.synology.example` vers `.env.synology`.
4. Verifier que `./data/postgres` existe ou laisser Docker le creer.

## Configuration

Editer `.env.synology` au minimum:

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `ATLASSIAN_BASE_URL`
- un couple `ATLASSIAN_EMAIL` + `ATLASSIAN_API_TOKEN` si `ATLASSIAN_AUTH_MODE=basic`
- ou `ATLASSIAN_BEARER_TOKEN` si `ATLASSIAN_AUTH_MODE=bearer`

En production, eviter:

- `DEV_APPROVAL_BYPASS=true`
- `MCP_AUTH_MODE=none` si le service est expose hors LAN

## Import dans DSM

1. Ouvrir `Container Manager`.
2. Aller dans `Project`.
3. Choisir `Create`.
4. Pointer sur le dossier du depot.
5. Selectionner `compose.synology.yml`.
6. Verifier que `.env.synology` est present dans le meme dossier.
7. Lancer le projet.

Le premier build est effectue sur le NAS et peut prendre plusieurs minutes.

## Services crees

### `postgres`

- image `postgres:16-alpine`
- persistance dans `./data/postgres`
- healthcheck `pg_isready`

### `mcp-server`

- build local a partir de `Dockerfile.prod`
- exposition HTTP sur le port `8787`
- migrations lancees au demarrage si `MIGRATE_ON_BOOT=true`
- healthcheck HTTP sur `/`

## Flux de demarrage

1. `postgres` demarre.
2. `mcp-server` attend la sante de `postgres`.
3. l'entrypoint applique les migrations avec retries.
4. le serveur MCP demarre sur `http://<nas>:8787/mcp`.

## Verification

Une fois le projet demarre:

- `GET http://<nas>:8787/` doit retourner un texte simple
- `GET http://<nas>:8787/.well-known/oauth-protected-resource` doit repondre si le transport HTTP est actif
- `POST http://<nas>:8787/mcp` doit accepter un `initialize` MCP

## Reverse proxy DSM

Si vous exposez le service via HTTPS:

1. creer un reverse proxy DSM vers `http://127.0.0.1:8787`
2. conserver le chemin `/mcp`
3. transmettre les en-tetes standards, notamment `X-Forwarded-Proto`

Le serveur tient deja compte de `X-Forwarded-Proto` pour publier la metadata `oauth-protected-resource`.

## Mises a jour

Pour mettre a jour l'application:

1. remplacer le code du depot dans le dossier partage
2. reconstruire le projet Compose dans Container Manager
3. verifier les logs du service `mcp-server`

## Notes

- cette cible est volontairement pragmatique: image unique, build local sur le NAS, et runtime HTTP seulement
- pour une prod plus robuste, il est preferable d'utiliser un Postgres externe plutot que la base embarquee sur le meme NAS
