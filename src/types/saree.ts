export interface SareeSpecs {
  fabricBase: string;
  zariType: string;
  length: string;
  weight: string;
}

export interface SareeItem {
  id: string;
  name: string;
  price: number;
  fabric: string;
  colour: string;
  colours: string[];
  occasion: string;
  occasions: string[];
  region: string;
  state: string;
  badge: string;
  weaveSubtitle: string;
  patterns: string[];
  shortDescription: string;
  weaverStory: string;
  specs: SareeSpecs;
  image: string;
  accentHex: string;
  secondaryHex: string;
  inStock?: boolean;
}

export interface DominantColorTone {
  name: string;
  hex: string;
  percentage: number;
}

export interface VisualAnalysis {
  summaryHeadline: string;
  dominantColors: DominantColorTone[];
  colorKeywords: string[];
  visiblePatterns: string[];
  borderDetails: string;
  apparentFabric: string;
  fabricKeywords: string[];
  styleCharacteristics: string;
  occasionKeywords: string[];
}

export interface TextSearchIntent {
  semanticQuery: string;
  fabric: string | null;
  colour: string | null;
  occasion: string | null;
  maxPrice: number | null;
  minPrice: number | null;
  region: string | null;
  keywords: string[];
  interpretationSummary: string;
}

export interface MatchedSaree {
  saree: SareeItem;
  matchScore: number;
  matchLabel: string;
  whyThisMatches: string;
  matchedAttributes: string[];
}

export type CatalogueMatchQuality = 'strong' | 'partial' | 'none';

export interface ImageSearchResponse {
  mode: 'image';
  model: string;
  analysis: VisualAnalysis;
  results: MatchedSaree[];
  hasStrongMatch: boolean;
  matchSummaryNote: string;
}

export interface TextSearchResponse {
  mode: 'text';
  model: string;
  query: string;
  intent: TextSearchIntent;
  results: MatchedSaree[];
  hasStrongMatch: boolean;
  matchQuality: CatalogueMatchQuality;
  matchSummaryNote: string;
}

// Separate data types for External Saree Inspiration (never mixed with purchasable SareeItem)
export interface InspirationSearchIntent {
  sareeTypeOrWeave: string | null;
  colour: string | null;
  fabric: string | null;
  visiblePatternsAndMotifs: string[];
  occasion: string | null;
  primarySearchQuery: string;
  alternativeSearchTerms: string[];
}

export interface GroundingWebSource {
  title: string;
  uri: string;
}

export type InspirationProviderId =
  | 'google-cse'
  | 'wikimedia-commons'
  | 'sample-fallback';

export interface ExternalInspirationProviderInfo {
  id: InspirationProviderId;
  label: string;
  isLiveSearch: boolean;
  notice: string;
}

export interface ExternalInspirationItem {
  id: string;
  sourceClassification: 'external_inspiration';
  availabilityLabel: 'Not in current catalogue';
  title: string;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  sourceUrl: string;
  sourcePublisher: string | null;
  relevanceExplanation: string;
}

export interface InspirationSearchResponse {
  mode: 'inspiration';
  model: string;
  originalQuery: string;
  searchQueryUsed: string;
  inspirationIntent: InspirationSearchIntent;
  provider: ExternalInspirationProviderInfo;
  groundingSources: GroundingWebSource[];
  results: ExternalInspirationItem[];
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  apiKeyConfigured: boolean;
  googleCseConfigured?: boolean;
  model: string;
  supportedGemmaModels: string[];
  catalogueCount: number;
}
