import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { loadEnv, parseArgs, requiredArg } from '@cybergogne/common';
import { ConfluenceClient } from '@cybergogne/confluence';
import { bootstrapManifestSchema } from '@cybergogne/schemas';
import YAML from 'yaml';
import { writeYaml } from './_registry-utils.js';

const args = parseArgs(process.argv.slice(2));
const manifestPath = path.resolve(process.cwd(), requiredArg(args, 'manifest'));
const env = loadEnv();

const manifestRaw = await readFile(manifestPath, 'utf8');
const manifest = bootstrapManifestSchema.parse(YAML.parse(manifestRaw));

const client = new ConfluenceClient({
  baseUrl: env.ATLASSIAN_BASE_URL,
  email: env.ATLASSIAN_EMAIL,
  apiToken: env.ATLASSIAN_API_TOKEN,
});

async function resolveSpace(hint: any) {
  if (hint.key) {
    try {
      const space = await client.getSpaceByKey(hint.key);
      return { status: 'resolved', space };
    } catch {}
  }

  if (hint.name) {
    const candidates = await client.findSpacesByNameHint(hint.name);
    if (candidates.length === 1) return { status: 'resolved', space: candidates[0] };
    if (candidates.length > 1) return { status: 'requires_manual_choice', candidates };
  }

  return { status: 'unresolved', candidates: [] };
}

const out: any = {
  schema_version: 'v1',
  generated_at: new Date().toISOString(),
  scopes: [],
};

for (const scope of manifest.scopes) {
  const notes: string[] = [];
  const spaceResolution = await resolveSpace(scope.space_hint);

  if (spaceResolution.status !== 'resolved') {
    out.scopes.push({
      scope_id: scope.scope_id,
      status: spaceResolution.status,
      candidates: spaceResolution.candidates ?? [],
      notes,
    });
    continue;
  }

  const spaceKey = String(spaceResolution.space.key);
  const exactRoot = await client.searchPagesByTitleExact(spaceKey, scope.page_hints.root.title);
  const exactParent = await client.searchPagesByTitleExact(spaceKey, scope.page_hints.default_parent.title);
  const exactInbox = await client.searchPagesByTitleExact(spaceKey, scope.page_hints.ai_inbox.title);

  const rootResult = exactRoot.results?.[0];
  const parentResult = exactParent.results?.[0];
  const inboxResult = exactInbox.results?.[0];

  let status = 'resolved';
  if (!rootResult || !parentResult || !inboxResult) {
    status = 'requires_manual_choice';
    if (!rootResult) notes.push('root_page_id unresolved');
    if (!parentResult) notes.push('default_parent_page_id unresolved');
    if (!inboxResult) notes.push('ai_inbox_page_id unresolved');
  }

  out.scopes.push({
    scope_id: scope.scope_id,
    status,
    resolved_space_key: spaceKey,
    resolved_space_id: String(spaceResolution.space.id ?? ''),
    resolved_root_page_id: rootResult?.pageId ?? null,
    resolved_default_parent_page_id: parentResult?.pageId ?? null,
    resolved_ai_inbox_page_id: inboxResult?.pageId ?? null,
    resolved_approver_principal_ref: scope.approver_hint?.candidates?.[0] ?? null,
    candidates: [
      ...(rootResult ? [] : exactRoot.results ?? []),
      ...(parentResult ? [] : exactParent.results ?? []),
      ...(inboxResult ? [] : exactInbox.results ?? []),
    ],
    notes,
  });
}

await mkdir(path.resolve(process.cwd(), 'out'), { recursive: true });
await writeYaml(path.resolve(process.cwd(), 'out/resolved-registry.yaml'), out);
await writeFile(path.resolve(process.cwd(), 'out/bootstrap-report.json'), JSON.stringify(out, null, 2), 'utf8');

console.log('Bootstrap discovery completed: out/resolved-registry.yaml');
