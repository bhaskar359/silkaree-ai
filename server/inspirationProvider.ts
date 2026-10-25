import type {
  ExternalInspirationItem,
  ExternalInspirationProviderInfo,
  InspirationSearchIntent,
} from '../src/types/saree.ts';

const VALID_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VALID_IMAGE_EXT_REGEX = /\.(jpe?g|png|webp)(\?.*)?$/i;
const EXCLUDED_TITLE_WORDS = /\b(logo|icon|map|diagram|chart|flag|stamp|signature|coat_of_arms|locator)\b/i;

function isValidHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function stripHtmlTags(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function buildRelevanceExplanation(
  title: string,
  intent: InspirationSearchIntent,
  originalQuery: string
): string {
  const normTitle = title.toLowerCase();
  const matchedParts: string[] = [];

  if (intent.sareeTypeOrWeave && normTitle.includes(intent.sareeTypeOrWeave.toLowerCase())) {
    matchedParts.push(`${intent.sareeTypeOrWeave} style`);
  }
  if (intent.colour) {
    const colWords = intent.colour.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
    if (colWords.some((cw) => normTitle.includes(cw))) {
      matchedParts.push(`${intent.colour.toLowerCase()} colour tone`);
    }
  }
  if (intent.fabric && normTitle.includes(intent.fabric.toLowerCase())) {
    matchedParts.push(`${intent.fabric.toLowerCase()} drape`);
  }
  for (const motif of intent.visiblePatternsAndMotifs) {
    const mWords = motif.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
    if (mWords.some((mw) => normTitle.includes(mw))) {
      matchedParts.push(`${motif.toLowerCase()} detailing`);
      break;
    }
  }

  if (matchedParts.length > 0) {
    return `External design reference aligned with your request for ${matchedParts.join(', ')}.`;
  }

  const targetSummary = [
    intent.colour,
    intent.sareeTypeOrWeave,
    intent.fabric ? `${intent.fabric} saree` : 'saree',
  ]
    .filter(Boolean)
    .join(' ');

  return `External saree design reference retrieved for “${targetSummary || originalQuery.trim()}”.`;
}

export interface ProviderSearchResult {
  searchQueryUsed: string;
  provider: ExternalInspirationProviderInfo;
  results: ExternalInspirationItem[];
}

/**
 * Provider 1: Google Programmable Search Engine (Custom Search JSON API — searchType=image)
 * Used automatically when GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX are configured on the server.
 */
async function searchViaGoogleCse(
  intent: InspirationSearchIntent,
  originalQuery: string
): Promise<ProviderSearchResult | null> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY?.trim();
  const cx = process.env.GOOGLE_CSE_CX?.trim();
  if (!apiKey || !cx) return null;

  const queryUsed = intent.primarySearchQuery;
  const endpoint = new URL('https://www.googleapis.com/customsearch/v1');
  endpoint.searchParams.set('key', apiKey);
  endpoint.searchParams.set('cx', cx);
  endpoint.searchParams.set('q', queryUsed);
  endpoint.searchParams.set('searchType', 'image');
  endpoint.searchParams.set('safe', 'active');
  endpoint.searchParams.set('num', '6');

  const response = await fetch(endpoint.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    console.warn(`[Silkaree AI] Google CSE image search returned HTTP ${response.status}`);
    return null;
  }

  const data = (await response.json()) as {
    items?: Array<{
      title?: string;
      link?: string;
      displayLink?: string;
      mime?: string;
      image?: {
        contextLink?: string;
        thumbnailLink?: string;
      };
    }>;
  };

  const rawItems = Array.isArray(data.items) ? data.items : [];
  const results: ExternalInspirationItem[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    const sourceUrl = item.image?.contextLink || '';
    const imageUrl = item.link || null;
    const thumbnailUrl = item.image?.thumbnailLink || imageUrl;

    if (!isValidHttpUrl(sourceUrl)) continue;
    if (thumbnailUrl && !isValidHttpUrl(thumbnailUrl)) continue;
    if (item.mime && !VALID_IMAGE_MIMES.has(item.mime.toLowerCase())) {
      if (!imageUrl || !VALID_IMAGE_EXT_REGEX.test(imageUrl)) continue;
    }

    const cleanTitle = item.title ? stripHtmlTags(item.title) : 'External Saree Design Reference';
    results.push({
      id: `gcse-${i}-${Buffer.from(sourceUrl).toString('base64url').slice(0, 10)}`,
      sourceClassification: 'external_inspiration',
      availabilityLabel: 'Not in current catalogue',
      title: cleanTitle,
      thumbnailUrl: thumbnailUrl && isValidHttpUrl(thumbnailUrl) ? thumbnailUrl : null,
      imageUrl: imageUrl && isValidHttpUrl(imageUrl) ? imageUrl : null,
      sourceUrl,
      sourcePublisher: item.displayLink || new URL(sourceUrl).hostname.replace(/^www\./, ''),
      relevanceExplanation: buildRelevanceExplanation(cleanTitle, intent, originalQuery),
    });
  }

  return {
    searchQueryUsed: queryUsed,
    provider: {
      id: 'google-cse',
      label: 'Google Programmable Image Search',
      isLiveSearch: true,
      notice:
        'External web images retrieved via Google Programmable Image Search. Silkaree does not claim ownership or commercial stock availability.',
    },
    results,
  };
}

/**
 * Provider 2: Wikimedia Commons Official MediaWiki API
 * Documented open media search API requiring no proprietary API key.
 */
async function searchViaWikimediaCommons(
  intent: InspirationSearchIntent,
  originalQuery: string
): Promise<ProviderSearchResult | null> {
  // Build candidate queries from specific to broader saree terms
  const candidateQueries: string[] = [
    intent.primarySearchQuery,
    ...intent.alternativeSearchTerms,
  ];

  if (intent.colour && intent.fabric) {
    candidateQueries.push(`${intent.colour} ${intent.fabric} saree`);
  }
  if (intent.sareeTypeOrWeave) {
    candidateQueries.push(`${intent.sareeTypeOrWeave} saree`);
  }
  if (intent.colour) {
    candidateQueries.push(`${intent.colour} silk saree`);
  }
  candidateQueries.push('Indian handloom silk saree');

  const uniqueQueries = Array.from(
    new Set(candidateQueries.map((q) => q.trim()).filter(Boolean))
  ).slice(0, 5);

  const collected = new Map<number, ExternalInspirationItem>();
  let effectiveQueryUsed = intent.primarySearchQuery;

  for (const q of uniqueQueries) {
    if (collected.size >= 6) break;

    const apiUrl = new URL('https://commons.wikimedia.org/w/api.php');
    apiUrl.searchParams.set('action', 'query');
    apiUrl.searchParams.set('generator', 'search');
    apiUrl.searchParams.set('gsrnamespace', '6'); // File namespace
    apiUrl.searchParams.set('gsrsearch', q);
    apiUrl.searchParams.set('gsrlimit', '8');
    apiUrl.searchParams.set('prop', 'imageinfo');
    apiUrl.searchParams.set('iiprop', 'url|extmetadata|mime');
    apiUrl.searchParams.set('iiurlwidth', '640');
    apiUrl.searchParams.set('format', 'json');

    try {
      const res = await fetch(apiUrl.toString(), {
        headers: {
          'User-Agent': 'SilkareeAI-HacktoberfestDemo/1.0 (https://ai.google.dev)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(6500),
      });

      if (!res.ok) continue;

      const body = (await res.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              pageid: number;
              title: string;
              imageinfo?: Array<{
                thumburl?: string;
                url?: string;
                descriptionurl?: string;
                mime?: string;
                extmetadata?: {
                  Artist?: { value?: string };
                  Credit?: { value?: string };
                  ImageDescription?: { value?: string };
                };
              }>;
            }
          >;
        };
      };

      const pages = Object.values(body.query?.pages || {});
      for (const page of pages) {
        if (collected.size >= 6) break;
        if (collected.has(page.pageid)) continue;

        const cleanFileTitle = page.title.replace(/^File:/i, '').replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ').trim();
        if (EXCLUDED_TITLE_WORDS.test(cleanFileTitle)) continue;
        // Ensure result relates to saree/sari/handloom/silk/weave
        const descValue = page.imageinfo?.[0]?.extmetadata?.ImageDescription?.value || '';
        const combinedText = `${cleanFileTitle} ${stripHtmlTags(descValue)}`.toLowerCase();
        if (!/\b(saree|sari|sarees|saris|kanchipuram|kanjeevaram|banarasi|paithani|pochampally|ikat|jamdani|uppada|chanderi|patola|tant|handloom|pattu)\b/.test(combinedText)) {
          continue;
        }

        const info = page.imageinfo?.[0];
        if (!info) continue;

        const mime = (info.mime || '').toLowerCase();
        if (!VALID_IMAGE_MIMES.has(mime)) continue;

        const sourceUrl = info.descriptionurl || '';
        const thumbUrl = info.thumburl || info.url || null;
        if (!isValidHttpUrl(sourceUrl)) continue;
        if (thumbUrl && !isValidHttpUrl(thumbUrl)) continue;

        if (collected.size === 0) {
          effectiveQueryUsed = q;
        }

        const artistRaw = info.extmetadata?.Artist?.value
          ? stripHtmlTags(info.extmetadata.Artist.value)
          : '';
        const publisher = artistRaw
          ? `Wikimedia Commons · ${artistRaw.slice(0, 42)}`
          : 'Wikimedia Commons';

        collected.set(page.pageid, {
          id: `wiki-${page.pageid}`,
          sourceClassification: 'external_inspiration',
          availabilityLabel: 'Not in current catalogue',
          title: cleanFileTitle,
          thumbnailUrl: thumbUrl,
          imageUrl: info.url && isValidHttpUrl(info.url) ? info.url : thumbUrl,
          sourceUrl,
          sourcePublisher: publisher,
          relevanceExplanation: buildRelevanceExplanation(
            `${cleanFileTitle} ${stripHtmlTags(descValue)}`,
            intent,
            originalQuery
          ),
        });
      }
    } catch (err: unknown) {
      console.warn(
        `[Silkaree AI] Wikimedia Commons query "${q}" failed:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  if (collected.size === 0) return null;

  return {
    searchQueryUsed: effectiveQueryUsed,
    provider: {
      id: 'wikimedia-commons',
      label: 'Wikimedia Commons Open Media API',
      isLiveSearch: true,
      notice:
        'Google Programmable Image Search credentials (GOOGLE_CSE_API_KEY / GOOGLE_CSE_CX) are not configured; showing live open-licensed saree photographs from Wikimedia Commons with full source attribution.',
    },
    results: Array.from(collected.values()),
  };
}

/**
 * Provider 3: Curated Sample Inspiration Fallback
 * Clearly labelled non-live fallback used only when no external image-search API credentials
 * or live Wikimedia results are reachable. Never presented as live Google Search results.
 */
const CURATED_SAMPLE_INSPIRATIONS: Array<{
  id: string;
  title: string;
  tags: string[];
  thumbnailUrl: string;
  sourceUrl: string;
  sourcePublisher: string;
  summary: string;
}> = [
  {
    id: 'sample-insp-dark-green-zari',
    title: 'Traditional Dark Green Silk Saree with Gold Zari Motifs',
    tags: ['dark green', 'green', 'emerald', 'silk', 'gold', 'zari', 'uppada', 'kanchipuram', 'wedding'],
    thumbnailUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Silk_saree_on_the_making_at_Kanchipuram_%287642281054%29.jpg/640px-Silk_saree_on_the_making_at_Kanchipuram_%287642281054%29.jpg',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Silk_saree_on_the_making_at_Kanchipuram_(7642281054).jpg',
    sourcePublisher: 'Sample Archive · Wikimedia Commons Reference',
    summary: 'Deep jewel-toned silk warp with woven gold zari motif work.',
  },
  {
    id: 'sample-insp-paithani-peacock',
    title: 'Peacock & Parrot Border Paithani Silk Drape Reference',
    tags: ['paithani', 'purple', 'green', 'peacock', 'silk', 'maharashtra', 'bridal', 'gold'],
    thumbnailUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Traditional_Bridal_Silk_Saree_%E2%80%93_Kanchipuram_Style.jpg/640px-Traditional_Bridal_Silk_Saree_%E2%80%93_Kanchipuram_Style.jpg',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Traditional_Bridal_Silk_Saree_%E2%80%93_Kanchipuram_Style.jpg',
    sourcePublisher: 'Sample Archive · Wikimedia Commons Reference',
    summary: 'Rich bridal silk pallu inspiration featuring classic woven zari borders.',
  },
  {
    id: 'sample-insp-bridal-brocade',
    title: 'Timeless Handwoven Zari Brocade Saree Reference',
    tags: ['banarasi', 'red', 'gold', 'brocade', 'floral', 'organza', 'patola', 'festive', 'silk'],
    thumbnailUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Traditional_Silk_Sarees_%E2%80%93_Timeless_Kanchipuram_Elegance.jpg/640px-Traditional_Silk_Sarees_%E2%80%93_Timeless_Kanchipuram_Elegance.jpg',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Traditional_Silk_Sarees_%E2%80%93_Timeless_Kanchipuram_Elegance.jpg',
    sourcePublisher: 'Sample Archive · Wikimedia Commons Reference',
    summary: 'Intricate metallic zari motif composition suitable for custom-weave inspiration.',
  },
];

function getSampleFallbackInspiration(
  intent: InspirationSearchIntent,
  originalQuery: string
): ProviderSearchResult {
  const queryNorm = `${originalQuery} ${intent.primarySearchQuery}`.toLowerCase();

  const ranked = [...CURATED_SAMPLE_INSPIRATIONS].sort((a, b) => {
    const scoreA = a.tags.filter((t) => queryNorm.includes(t)).length;
    const scoreB = b.tags.filter((t) => queryNorm.includes(t)).length;
    return scoreB - scoreA;
  });

  return {
    searchQueryUsed: intent.primarySearchQuery,
    provider: {
      id: 'sample-fallback',
      label: 'Demo Sample Inspiration Fallback (Not Live Google Search)',
      isLiveSearch: false,
      notice:
        'Live Google Image Search API credentials (GOOGLE_CSE_API_KEY & GOOGLE_CSE_CX) are not configured. Displaying clearly labelled sample inspiration references for demo evaluation.',
    },
    results: ranked.map((item) => ({
      id: item.id,
      sourceClassification: 'external_inspiration',
      availabilityLabel: 'Not in current catalogue',
      title: item.title,
      thumbnailUrl: item.thumbnailUrl,
      imageUrl: item.thumbnailUrl,
      sourceUrl: item.sourceUrl,
      sourcePublisher: item.sourcePublisher,
      relevanceExplanation: `${item.summary} Shown as a sample inspiration reference for “${intent.primarySearchQuery}”.`,
    })),
  };
}

export async function searchExternalInspiration(
  intent: InspirationSearchIntent,
  originalQuery: string
): Promise<ProviderSearchResult> {
  const preferredMode = (process.env.INSPIRATION_PROVIDER || 'auto').trim().toLowerCase();

  if (preferredMode === 'sample' || preferredMode === 'sample-fallback') {
    return getSampleFallbackInspiration(intent, originalQuery);
  }

  if (preferredMode === 'google-cse' || preferredMode === 'auto') {
    try {
      const cseResult = await searchViaGoogleCse(intent, originalQuery);
      if (cseResult && cseResult.results.length > 0) {
        return cseResult;
      }
    } catch (err: unknown) {
      console.warn(
        '[Silkaree AI] Google CSE provider failed, falling back:',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  if (preferredMode === 'wikimedia' || preferredMode === 'wikimedia-commons' || preferredMode === 'auto') {
    try {
      const wikiResult = await searchViaWikimediaCommons(intent, originalQuery);
      if (wikiResult && wikiResult.results.length > 0) {
        return wikiResult;
      }
    } catch (err: unknown) {
      console.warn(
        '[Silkaree AI] Wikimedia Commons provider failed, using sample fallback:',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  return getSampleFallbackInspiration(intent, originalQuery);
}
