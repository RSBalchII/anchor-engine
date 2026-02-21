
interface SearchParams {
    query: string;
    max_chars: number;
    token_budget: number;
    provenance: 'internal' | 'all';
    buckets?: string[];
    tags?: string[];
    include_code?: boolean;
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

// Get base API URL from environment or default to engine on port 3160
const getBaseUrl = () => {
    // In development, we proxy to the engine server
    // In production, this could be configured differently
    return import.meta.env.VITE_API_BASE_URL || '';
};

export const api = {
    getBuckets: () => fetch(`${getBaseUrl()}/v1/buckets`).then(r => r.json()),
    getTags: (buckets?: string[]) => {
        const query = buckets && buckets.length > 0 ? `?buckets=${buckets.join(',')}` : '';
        return fetch(`${getBaseUrl()}/v1/tags${query}`).then(r => r.json());
    },

    search: (params: SearchParams): Promise<SearchResponse> =>
        fetch(`${getBaseUrl()}/v1/memory/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        }).then(r => r.json()),

    quarantineAtom: (atomId: string) =>
        fetch(`${getBaseUrl()}/v1/atoms/${atomId}/quarantine`, { method: 'POST' }),

    backup: () => fetch(`${getBaseUrl()}/v1/backup`, { method: 'POST' }).then(r => r.json()),

    getQuarantined: () => fetch(`${getBaseUrl()}/v1/atoms/quarantined`).then(r => r.json()),

    cureAtom: (atomId: string) => fetch(`${getBaseUrl()}/v1/atoms/${atomId}/restore`, { method: 'POST' }).then(r => r.json()),

    dream: () => fetch(`${getBaseUrl()}/v1/dream`, { method: 'POST' }).then(r => r.json()),

    research: (query: string) =>
        fetch(`${getBaseUrl()}/v1/research/web-search?q=${encodeURIComponent(query)}`).then(r => r.json()),

    scrape: (url: string, category: string = 'article') =>
        fetch(`${getBaseUrl()}/v1/research/scrape`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, category })
        }).then(r => r.json()),

    uploadRaw: (content: string, filename: string) =>
        fetch(`${getBaseUrl()}/v1/research/upload-raw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, filename })
        }).then(r => r.json()),

    getModels: () => fetch(`${getBaseUrl()}/v1/models`).then(r => r.json()),

    loadModel: (model: string, options?: any) =>
        fetch(`${getBaseUrl()}/v1/inference/load`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, options })
        }).then(r => r.json()),

    getModelStatus: () => fetch(`${getBaseUrl()}/v1/model/status`).then(r => r.json()),

    getGraphData: (query: string, limit: number = 20) =>
        fetch(`${getBaseUrl()}/v1/graph/data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, limit })
        }).then(r => r.json()),

    getPaths: () => fetch(`${getBaseUrl()}/v1/system/paths`).then(r => r.json()),

    addPath: (path: string) => fetch(`${getBaseUrl()}/v1/system/paths`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
    }).then(r => r.json()),

    removePath: (path: string) => fetch(`${getBaseUrl()}/v1/system/paths`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
    }).then(r => r.json())
} as const;

// Define the type for the api object
export type ApiType = typeof api;
