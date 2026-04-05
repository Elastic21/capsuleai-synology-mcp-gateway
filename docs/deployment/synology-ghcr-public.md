# Deploiement Synology DSM via GHCR public

Cette cible evite le build local sur le NAS. L'image est construite par GitHub Actions puis poussee sur GitHub Container Registry (`ghcr.io`).

## Fichiers fournis

- `.github/workflows/publish-ghcr-public.yml`
- `compose.synology.ghcr.yml`
- `.env.synology.ghcr.example`
- `Dockerfile.prod`
- `deployment/synology-ghcr/docker-compose.yml`
- `deployment/synology-ghcr/.env.synology.ghcr.example`

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
- selon les ecrans `Container Manager`, Synology peut proposer un mapping de port pour PostgreSQL
- refusez ou supprimez tout `5432:5432` sur le service `postgres`
- seul `mcp-server` doit publier un port hote, ici `8787:8787`

## Nom d'image

Par defaut, le workflow publie:

- `ghcr.io/<owner-lowercase>/<repo-lowercase>:latest` sur la branche par defaut
- `ghcr.io/<owner-lowercase>/<repo-lowercase>:vX.Y.Z` sur les tags Git `v*`

Exemple:

- `ghcr.io/elastic21/capsuleai-synology-mcp-gateway:latest`

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

Si `Container Manager` ne vous laisse pas choisir un fichier autre que `docker-compose.yml`
dans un dossier qui contient deja un fichier compose:

- utilisez de preference le dossier `deployment/synology-ghcr`
- ce dossier contient deja un `docker-compose.yml` dedie au deploiement DSM
- copiez `deployment/synology-ghcr/.env.synology.ghcr.example` vers `deployment/synology-ghcr/.env.synology.ghcr`
- pointez ensuite le projet DSM vers ce dossier dedie, et non vers la racine du depot

## Import dans DSM

1. ouvrir `Container Manager`
2. aller dans `Project`
3. creer un nouveau projet dans le dossier partage contenant le compose retenu
4. si DSM impose `docker-compose.yml`, choisir `deployment/synology-ghcr`
5. sinon vous pouvez aussi utiliser `compose.synology.ghcr.yml` a la racine
6. verifier que `.env.synology.ghcr` est present dans le meme dossier que le compose retenu
7. lancer le projet

## Services

### `postgres`

- image `postgres:16-alpine`
- persistance via le volume Docker nomme `postgres-data`
- acces inter-conteneurs uniquement via le reseau Compose interne
- aucun port hote ne doit etre publie pour `5432`
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
