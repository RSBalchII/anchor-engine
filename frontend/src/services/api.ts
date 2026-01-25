
interface SearchParams {
    query: string;
    max_chars: number;
    token_budget: number;
    provenance: 'internal' | 'all';
}

interface SearchResult {
    id: string;
    content: string;
    source: string;
    provenance: string;
    score: number;
    [key: string]: any;
}

interface SearchResponse {
    results: SearchResult[];
    context: string;
    metadata: any;
    split_queries?: string[];
}

export const api = {
    getBuckets: () => fetch('/v1/buckets').then(r => r.json()),
    getTags: () => fetch('/v1/tags').then(r => r.json()),

    search: (params: SearchParams): Promise<SearchResponse> =>
        fetch('/v1/memory/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        }).then(r => r.json()),

    quarantineAtom: (atomId: string) =>
        fetch(`/v1/atoms/${atomId}/quarantine`, { method: 'POST' }),

    backup: () => fetch('/v1/backup', { method: 'POST' }).then(r => r.json()),

    getQuarantined: () => fetch('/v1/atoms/quarantined').then(r => r.json()),

    cureAtom: (atomId: string) => fetch(`/v1/atoms/${atomId}/restore`, { method: 'POST' }).then(r => r.json()),

    dream: () => fetch('/v1/dream', { method: 'POST' }).then(r => r.json()),

    research: (query: string) =>
        fetch(`/v1/research/web-search?q=${encodeURIComponent(query)}`).then(r => r.json()),

    scrape: (url: string, category: string = 'article') =>
        fetch('/v1/research/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, category })
        }).then(r => r.json())
} as const;

// Define the type for the api object
export type ApiType = typeof api;
