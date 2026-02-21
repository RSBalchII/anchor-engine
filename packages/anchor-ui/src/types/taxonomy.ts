// Minimal taxonomy types
export interface TaxonomyRule {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export interface TaxonomyPreset {
  id: string;
  name: string;
  rules: TaxonomyRule[];
}
