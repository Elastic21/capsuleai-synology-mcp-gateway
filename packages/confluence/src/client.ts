import { AppError } from '@cybergogne/common';

export interface ConfluenceClientOptions {
  baseUrl: string;
  authMode?: 'basic' | 'bearer';
  email: string;
  apiToken: string;
  bearerToken?: string;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function escapeCql(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\\"');
}

function mapSearchResult(baseUrl: string, result: any) {
  const content = result.content ?? result;
  return {
    page_id: String(content.id ?? result.id ?? ''),
    title: result.title ?? content.title ?? '',
    excerpt: result.excerpt ?? content.excerpt ?? '',
    version: content.version?.number ?? null,
    labels:
      content.metadata?.labels?.results?.map((item: any) => item.name).filter(Boolean) ?? [],
    web_url: content._links?.webui
      ? `${baseUrl}${content._links.webui}`
      : null,
    ancestor_ids:
      content.ancestors?.map((item: any) => String(item.id)) ?? [],
  };
}

export class ConfluenceClient {
  private readonly baseUrl: string;

  constructor(private readonly options: ConfluenceClientOptions) {
    this.baseUrl = stripTrailingSlash(options.baseUrl);
  }

  private get authorizationHeader() {
    if (this.options.authMode === 'bearer') {
      if (!this.options.bearerToken) {
        throw new AppError('CONFLUENCE_AUTH_MISSING', 'Missing Confluence bearer token', 500);
      }
      return `Bearer ${this.options.bearerToken}`;
    }

    if (!this.options.email || !this.options.apiToken) {
      throw new AppError('CONFLUENCE_AUTH_MISSING', 'Missing Confluence email or API token', 500);
    }

    const raw = `${this.options.email}:${this.options.apiToken}`;
    return `Basic ${Buffer.from(raw, 'utf8').toString('base64')}`;
  }

  private async sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getRetryDelay(response: Response, attempt: number) {
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds >= 0) {
        return seconds * 1000;
      }
    }
    return 250 * 2 ** attempt;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      let response: Response;

      try {
        response = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          headers: {
            Authorization: this.authorizationHeader,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
          },
        });
      } catch (error) {
        if (attempt < maxAttempts - 1) {
          await this.sleep(250 * 2 ** attempt);
          continue;
        }

        throw new AppError(
          'CONFLUENCE_REQUEST_FAILED',
          'Confluence request failed before receiving a response',
          502,
          { path, error: error instanceof Error ? error.message : String(error) },
        );
      }

      if (response.ok) {
        if (response.status === 204) {
          return undefined as T;
        }

        return (await response.json()) as T;
      }

      if ((response.status === 429 || response.status >= 500) && attempt < maxAttempts - 1) {
        await this.sleep(this.getRetryDelay(response, attempt));
        continue;
      }

      const text = await response.text();
      throw new AppError(
        'CONFLUENCE_REQUEST_FAILED',
        `Confluence request failed: ${response.status} ${response.statusText}`,
        response.status,
        { path, body: text.slice(0, 512) },
      );
    }

    throw new AppError('CONFLUENCE_REQUEST_FAILED', 'Confluence request failed after retries', 502, { path });
  }

  async listSpaces(limit = 100) {
    return this.request<any>(`/wiki/rest/api/space?limit=${limit}`);
  }

  async getSpaceByKey(key: string) {
    return this.request<any>(`/wiki/rest/api/space/${encodeURIComponent(key)}`);
  }

  async findSpacesByNameHint(nameHint: string) {
    const data = await this.listSpaces(250);
    const normalized = nameHint.toLowerCase();
    return (data.results ?? []).filter((space: any) =>
      String(space.name ?? '').toLowerCase().includes(normalized),
    );
  }

  async searchContentByCql(scope: any, query: string, limit = 10, cursor?: string | null) {
    if (!String(scope.read_cql_guard ?? '').trim()) {
      throw new AppError('READ_GUARD_MISSING', `Scope ${scope.scope_id} has no read_cql_guard`, 403);
    }

    const clauses = [scope.read_cql_guard, `type = page`, `(title ~ "${escapeCql(query)}" OR text ~ "${escapeCql(query)}")`];
    const cql = clauses.join(' AND ');
    return this.searchByCqlRaw(cql, limit, cursor);
  }

  async searchByCqlRaw(cql: string, limit = 10, cursor?: string | null) {
    const qs = new URLSearchParams({ cql, limit: String(limit) });
    if (cursor) qs.set('cursor', cursor);
    let data: any;

    try {
      data = await this.request<any>(`/wiki/rest/api/content/search?${qs.toString()}`);
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode !== 404) {
        throw error;
      }

      data = await this.request<any>(`/wiki/rest/api/search?${qs.toString()}`);
    }

    return {
      results: (data.results ?? []).map((result: any) => mapSearchResult(this.baseUrl, result)),
      nextCursor: data._links?.next ?? null,
    };
  }

  async searchPagesByTitleExact(spaceKey: string, title: string) {
    const cql = `space = "${escapeCql(spaceKey)}" AND type = page AND title = "${escapeCql(title)}"`;
    return this.searchByCqlRaw(cql, 25);
  }

  async getPage(pageId: string, bodyFormat: 'storage' | 'atlas_doc_format' = 'storage') {
    const expand = [
      'version',
      'space',
      'ancestors',
      'metadata.labels',
      'body.storage',
      'body.atlas_doc_format',
    ].join(',');
    const data = await this.request<any>(`/wiki/rest/api/content/${encodeURIComponent(pageId)}?expand=${expand}`);
    const bodyStorage = data.body?.storage?.value ?? '';
    return {
      id: String(data.id),
      title: data.title,
      status: data.status ?? 'current',
      versionNumber: Number(data.version?.number ?? 1),
      spaceKey: data.space?.key ?? null,
      ancestors: (data.ancestors ?? []).map((item: any) => String(item.id)),
      labels: (data.metadata?.labels?.results ?? []).map((item: any) => item.name).filter(Boolean),
      bodyStorage,
      bodyAtlasDocFormat: data.body?.atlas_doc_format?.value ?? null,
      webUrl: data._links?.webui ? `${this.baseUrl}${data._links.webui}` : null,
    };
  }

  async createPage(input: {
    spaceKey: string;
    parentId?: string | null;
    title: string;
    bodyStorage: string;
  }) {
    const payload: any = {
      type: 'page',
      title: input.title,
      space: { key: input.spaceKey },
      body: {
        storage: {
          representation: 'storage',
          value: input.bodyStorage,
        },
      },
    };
    if (input.parentId) {
      payload.ancestors = [{ id: input.parentId }];
    }
    return this.request<any>(`/wiki/rest/api/content`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updatePageManagedSections(input: {
    pageId: string;
    title: string;
    spaceKey: string;
    versionNumber: number;
    bodyStorage: string;
  }) {
    return this.request<any>(`/wiki/rest/api/content/${encodeURIComponent(input.pageId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        id: input.pageId,
        type: 'page',
        title: input.title,
        space: { key: input.spaceKey },
        version: { number: input.versionNumber + 1 },
        body: {
          storage: {
            representation: 'storage',
            value: input.bodyStorage,
          },
        },
      }),
    });
  }

  async createDraftInAiInbox(input: {
    spaceKey: string;
    aiInboxPageId: string;
    title: string;
    bodyStorage: string;
  }) {
    return this.createPage({
      spaceKey: input.spaceKey,
      parentId: input.aiInboxPageId,
      title: input.title,
      bodyStorage: input.bodyStorage,
    });
  }

  async getLabels(pageId: string) {
    return this.request<any>(`/wiki/rest/api/content/${encodeURIComponent(pageId)}/label`);
  }

  async addLabels(pageId: string, labels: string[]) {
    if (labels.length === 0) return { results: [] };
    return this.request<any>(`/wiki/rest/api/content/${encodeURIComponent(pageId)}/label`, {
      method: 'POST',
      body: JSON.stringify(labels.map((name) => ({ prefix: 'global', name }))),
    });
  }

  async getContentProperties(pageId: string) {
    return this.request<any>(`/wiki/rest/api/content/${encodeURIComponent(pageId)}/property`);
  }

  async setContentProperty(pageId: string, key: string, value: unknown) {
    try {
      return await this.request<any>(`/wiki/rest/api/content/${encodeURIComponent(pageId)}/property/${encodeURIComponent(key)}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      });
    } catch {
      return this.request<any>(`/wiki/rest/api/content/${encodeURIComponent(pageId)}/property`, {
        method: 'POST',
        body: JSON.stringify({ key, value }),
      });
    }
  }

  async getPageVersions(pageId: string) {
    return this.request<any>(`/wiki/rest/api/content/${encodeURIComponent(pageId)}/version`);
  }

  async restoreVersion(pageId: string, versionNumber: number) {
    return this.request<any>(`/wiki/rest/api/content/${encodeURIComponent(pageId)}/version`, {
      method: 'POST',
      body: JSON.stringify({
        operationKey: 'restore',
        params: { versionNumber },
      }),
    });
  }
}
