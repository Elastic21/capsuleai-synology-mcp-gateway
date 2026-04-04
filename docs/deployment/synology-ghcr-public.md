# Deploiement Synology DSM via GHCR public

Cette cible evite le build local sur le NAS. L'image est construite par GitHub Actions puis poussee sur GitHub Container Registry (`ghcr.io`).

## Fichiers fournis

- `.github/workflows/publish-ghcr-public.yml`
- `compose.synology.ghcr.yml`
- `.env.synology.ghcr.example`
- `Dockerfile.prod`

## Principe

1. GitHub Actions build l'image a partir de `Dockerfile.prod`.
2. Le workflow pousse l'image vers `ghcr.io/<owner>/<repo>`.
3. Synology DSM tire cette image publique et ne fait plus de build local.

## Prerequis GitHub

- le depot doit etre heberge sur GitHub
- la branche par defaut doit etre `main` ou bien adaptez le workflow
- l'onglet `Actions` doit etre autorise

Le workflow utilise `GITHUB_TOKEN` avec `packages: write`, ce qui est le chemin recommande pour publier une image associee au depot.

## Premiere publication

1. pousser le fichier `.github/workflows/publish-ghcr-public.yml`
2. pousser sur `main` ou lancer le workflow manuellement
3. verifier dans `Actions` que le job a publie l'image
4. ouvrir la page du package GHCR et verifier sa visibilite

Point important:

- lors du premier publish GHCR, la visibilite du package est generalement privee par defaut
- pour permettre un pull anonyme par Synology, basculez le package en **public**

## Nom d'image

Par defaut, le workflow publie:

- `ghcr.io/<owner-lowercase>/<repo-lowercase>:latest` sur la branche par defaut
- `ghcr.io/<owner-lowercase>/<repo-lowercase>:vX.Y.Z` sur les tags Git `v*`

Exemple:

- `ghcr.io/cybergogne/cg-gateway-mcp-repo:latest`

## Configuration Synology

1. copier `.env.synology.ghcr.example` vers `.env.synology.ghcr`
2. renseigner:
   - `GHCR_IMAGE`
   - `POSTGRES_PASSWORD`
   - `DATABASE_URL`
   - `ATLASSIAN_BASE_URL`
   - vos identifiants Atlassian

Si Container Manager n'applique pas `GHCR_IMAGE` a la substitution Compose dans votre setup:

- editez directement la ligne `image:` dans `compose.synology.ghcr.yml`

## Import dans DSM

1. ouvrir `Container Manager`
2. aller dans `Project`
3. creer un nouveau projet dans le dossier partage contenant le depot
4. selectionner `compose.synology.ghcr.yml`
5. verifier que `.env.synology.ghcr` est present dans le meme dossier
6. lancer le projet

## Services

### `postgres`

- image `postgres:16-alpine`
- persistance dans `./data/postgres`
- healthcheck `pg_isready`

### `mcp-server`

- image tiree depuis GHCR public
- exposition HTTP sur `8787`
- migrations au demarrage via `MIGRATE_ON_BOOT=true`

## Avantages

- pas de build sur le Synology
- deploiement plus rapide
- artefact unique et reproductible
- meilleure base pour un flux CI/CD

## Limites

- dependance a GitHub pour la distribution
- premiere mise en public du package a verifier explicitement
- si vous changez de nom de repo GitHub, le nom d'image change aussi

## Mise a jour

1. merger sur `main`
2. attendre la publication GHCR
3. redeployer ou relancer le projet dans DSM pour tirer la nouvelle image

## Variante recommandee

Pour une meilleure stabilite de deploiement sur DSM, vous pouvez figer l'image par tag semantique plutot que `latest`, par exemple:

- `ghcr.io/<owner>/<repo>:v1.0.0`
