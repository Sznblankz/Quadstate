import { PartLibrary } from "./library.js";
import { BUNDLE_VERSION, importBundle, type PartBundle } from "./bundle.js";

/**
 * Community registry API contract (V1). The server is out of scope for
 * V1 (plan, M6) — this module pins the wire format so the app, future
 * server, and third parties agree:
 *
 *   POST /v1/parts            body: PartBundle            -> PublishResponse
 *   GET  /v1/parts/{id}       (id = "sha256:<hex>")       -> PartBundle | 404
 *   GET  /v1/parts?q=&limit=                              -> RegistryPartSummary[]
 *
 * Bundles are self-contained (transitive deps included), so `fetch` is a
 * single round trip. Publishing is idempotent: the id IS the content.
 */

export interface RegistryPartSummary {
  id: string;
  name: string;
  version: string;
  publishedAt: string; // ISO 8601
}

export interface PublishResponse {
  id: string;
  /** False when the id already existed (idempotent re-publish). */
  created: boolean;
}

export interface RegistryClient {
  publish(bundle: PartBundle): Promise<PublishResponse>;
  fetchBundle(id: string): Promise<PartBundle | null>;
  search(query: string, limit?: number): Promise<RegistryPartSummary[]>;
}

/**
 * Reference implementation of the contract, used by tests and as the
 * specification of server-side validation: a registry MUST reject
 * bundles that do not import cleanly into an empty library.
 */
export class MemoryRegistry implements RegistryClient {
  private bundles = new Map<string, { bundle: PartBundle; summary: RegistryPartSummary }>();
  private clock = 0;

  async publish(bundle: PartBundle): Promise<PublishResponse> {
    const lib = new PartLibrary();
    // Server-side validation; mainName is the bundle's display name.
    const { main, mainName } = importBundle(JSON.stringify(bundle), lib);
    if (this.bundles.has(main)) return { id: main, created: false };
    const def = lib.get(main)!;
    this.bundles.set(main, {
      bundle,
      summary: {
        id: main,
        name: mainName,
        version: def.version,
        publishedAt: new Date(1893456000000 + this.clock++ * 1000).toISOString(),
      },
    });
    return { id: main, created: true };
  }

  async fetchBundle(id: string): Promise<PartBundle | null> {
    return this.bundles.get(id)?.bundle ?? null;
  }

  async search(query: string, limit = 20): Promise<RegistryPartSummary[]> {
    const q = query.toLowerCase();
    return [...this.bundles.values()]
      .map((e) => e.summary)
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, limit);
  }
}

/** Thin HTTP client over the contract; `fetchImpl` injected for tests. */
export class HttpRegistryClient implements RegistryClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async publish(bundle: PartBundle): Promise<PublishResponse> {
    if (bundle.bundleVersion !== BUNDLE_VERSION) {
      throw new Error(`unsupported bundle version ${bundle.bundleVersion}`);
    }
    const res = await this.fetchImpl(`${this.baseUrl}/v1/parts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(bundle),
    });
    if (!res.ok) throw new Error(`registry publish failed: ${res.status}`);
    return res.json() as Promise<PublishResponse>;
  }

  async fetchBundle(id: string): Promise<PartBundle | null> {
    const res = await this.fetchImpl(`${this.baseUrl}/v1/parts/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`registry fetch failed: ${res.status}`);
    return res.json() as Promise<PartBundle>;
  }

  async search(query: string, limit = 20): Promise<RegistryPartSummary[]> {
    const url = `${this.baseUrl}/v1/parts?q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await this.fetchImpl(url);
    if (!res.ok) throw new Error(`registry search failed: ${res.status}`);
    return res.json() as Promise<RegistryPartSummary[]>;
  }
}
