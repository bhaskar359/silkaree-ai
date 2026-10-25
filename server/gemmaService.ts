import { GoogleGenAI, Type } from '@google/genai';
import type {
  DominantColorTone,
  GroundingWebSource,
  InspirationSearchIntent,
  TextSearchIntent,
  VisualAnalysis,
} from '../src/types/saree.ts';

export const DEFAULT_GEMMA_MODEL = 'gemma-4-26b-a4b-it';
export const SUPPORTED_GEMMA_MODELS = [
  'gemma-4-26b-a4b-it',
  'gemma-4-31b-it',
];

export class AIServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 500, code = 'AI_SERVICE_ERROR') {
    super(message);
    this.name = 'AIServiceError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function getConfiguredGemmaModel(): string {
  const raw = (process.env.GEMMA_MODEL || DEFAULT_GEMMA_MODEL).trim();
  const normalized = raw.replace(/^models\//, '');

  if (normalized.includes(':')) {
    throw new AIServiceError(
      `Invalid GEMMA_MODEL "${raw}". Ollama model tags (such as gemma4:e2b) are not valid hosted Gemini API model IDs. Set GEMMA_MODEL to one of: ${SUPPORTED_GEMMA_MODELS.join(', ')}.`,
      400,
      'UNSUPPORTED_MODEL_ID'
    );
  }

  if (!normalized.startsWith('gemma-4-')) {
    throw new AIServiceError(
      `Unsupported GEMMA_MODEL "${raw}". Silkaree AI is configured to use Gemma 4 via the Gemini API (${SUPPORTED_GEMMA_MODELS.join(', ')}).`,
      400,
      'UNSUPPORTED_MODEL_ID'
    );
  }

  return normalized;
}

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey === 'MY_GEMINI_API_KEY') {
    throw new AIServiceError(
      'GEMINI_API_KEY is not configured on the server. Add a valid Gemini API key in environment secrets to enable live Gemma 4 analysis.',
      503,
      'MISSING_API_KEY'
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function stripJsonFences(rawText: string): string {
  const trimmed = rawText.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function normalizeHex(hex: unknown, fallback = '#00534F'): string {
  if (typeof hex !== 'string') return fallback;
  const cleaned = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) return cleaned.toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) return `#${cleaned.toUpperCase()}`;
  return fallback;
}

function toStringArray(val: unknown, maxLen = 8): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
    .slice(0, maxLen);
}

const normalizeNullableStr = (val: unknown): string | null => {
  if (typeof val !== 'string') return null;
  const cleaned = val.trim();
  if (!cleaned || /^(null|none|any|n\/a|unspecified)$/i.test(cleaned)) return null;
  return cleaned;
};

export async function analyzeSareeImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<{ model: string; analysis: VisualAnalysis }> {
  const model = getConfiguredGemmaModel();
  const ai = getGenAIClient();
  const base64Data = imageBuffer.toString('base64');

  const prompt = `You are a textile visual analysis assistant for Indian handloom and silk sarees.
Carefully inspect the uploaded photograph and identify ONLY observable visual characteristics as visual estimates.
CRITICAL RULES:
- Treat every observation as a visual estimate, NOT a verified product fact.
- Do NOT invent product names, catalogue IDs, prices, stock status, or unverified GI certifications.
- Describe dominant colours (including metallic zari tones like gold, silver, antique bronze if visible), visible patterns/motifs (e.g., temple gopuram, floral butta, jamdani, ikat geometry, checks, paisley, stripes), border/pallu decorative details, apparent fabric/texture/sheen (e.g., heavy silk brocade, crisp cotton-silk, sheer silk-cotton, slub tussar, ikat silk), and style/occasion characteristics relevant to visual matching.
- Return valid JSON matching the requested schema.`;

  const visualSchema = {
    type: Type.OBJECT,
    properties: {
      summaryHeadline: {
        type: Type.STRING,
        description: 'Concise 5 to 9 word visual description of the saree in the photo.',
      },
      dominantColors: {
        type: Type.ARRAY,
        description: 'Top 2 to 4 visible colours with approximate hex code and visual share percentage.',
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            hex: { type: Type.STRING },
            percentage: { type: Type.NUMBER },
          },
          required: ['name', 'hex', 'percentage'],
        },
      },
      colorKeywords: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Normalized colour words for catalogue matching, e.g. peacock green, emerald, magenta, crimson, mustard, ivory, gold.',
      },
      visiblePatterns: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Visible motifs and weave patterns, e.g. temple gopuram, floral butta, double ikat, geometric diamond, checks, paisley.',
      },
      borderDetails: {
        type: Type.STRING,
        description: 'Observable border, selvedge, and pallu decorative details.',
      },
      apparentFabric: {
        type: Type.STRING,
        description: 'Visual estimate of apparent fabric, weave density, and sheen/luster.',
      },
      fabricKeywords: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Fabric terms for matching, e.g. mulberry silk, cotton silk, ikat silk, tussar, crepe, cotton.',
      },
      styleCharacteristics: {
        type: Type.STRING,
        description: 'Inferred drape style and occasion suitability based on visual richness.',
      },
      occasionKeywords: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Occasion keywords such as wedding, bridal, festive, daytime, puja, casual.',
      },
    },
    required: [
      'summaryHeadline',
      'dominantColors',
      'colorKeywords',
      'visiblePatterns',
      'borderDetails',
      'apparentFabric',
      'fabricKeywords',
      'styleCharacteristics',
      'occasionKeywords',
    ],
  };

  let rawText: string | undefined;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        { text: prompt },
      ],
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: visualSchema,
      },
    });
    rawText = response.text;
  } catch (primaryErr: unknown) {
    try {
      const fallbackResponse = await ai.models.generateContent({
        model,
        contents: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: `${prompt}\nRespond ONLY with a JSON object containing keys: summaryHeadline (string), dominantColors (array of {name, hex, percentage}), colorKeywords (string[]), visiblePatterns (string[]), borderDetails (string), apparentFabric (string), fabricKeywords (string[]), styleCharacteristics (string), occasionKeywords (string[]).`,
          },
        ],
        config: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      });
      rawText = fallbackResponse.text;
    } catch {
      throw mapProviderError(primaryErr, model);
    }
  }

  if (!rawText) {
    throw new AIServiceError('Gemma 4 returned an empty response during image analysis.', 502, 'EMPTY_AI_RESPONSE');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripJsonFences(rawText));
  } catch {
    throw new AIServiceError('Gemma 4 returned malformed JSON during image analysis. Please retry.', 502, 'INVALID_AI_JSON');
  }

  const fallbackHexes = ['#00534F', '#D9B879', '#314E4F'];
  const rawDominant = Array.isArray(parsed.dominantColors) ? parsed.dominantColors : [];
  const dominantColors: DominantColorTone[] = rawDominant
    .slice(0, 4)
    .map((entry: unknown, idx: number) => {
      const obj = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
      const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : `Tone ${idx + 1}`;
      const pct = typeof obj.percentage === 'number' && Number.isFinite(obj.percentage)
        ? Math.max(1, Math.min(100, Math.round(obj.percentage)))
        : Math.max(10, 50 - idx * 15);
      return {
        name,
        hex: normalizeHex(obj.hex, fallbackHexes[idx % fallbackHexes.length]),
        percentage: pct,
      };
    });

  const colorKeywords = toStringArray(parsed.colorKeywords);
  if (colorKeywords.length === 0 && dominantColors.length > 0) {
    dominantColors.forEach((c) => colorKeywords.push(c.name.toLowerCase()));
  }

  const analysis: VisualAnalysis = {
    summaryHeadline:
      typeof parsed.summaryHeadline === 'string' && parsed.summaryHeadline.trim()
        ? parsed.summaryHeadline.trim()
        : 'Visual handloom & motif analysis complete',
    dominantColors:
      dominantColors.length > 0
        ? dominantColors
        : [{ name: 'Detected Tone', hex: '#00534F', percentage: 100 }],
    colorKeywords,
    visiblePatterns: toStringArray(parsed.visiblePatterns),
    borderDetails:
      typeof parsed.borderDetails === 'string' && parsed.borderDetails.trim()
        ? parsed.borderDetails.trim()
        : 'Traditional woven border details observed.',
    apparentFabric:
      typeof parsed.apparentFabric === 'string' && parsed.apparentFabric.trim()
        ? parsed.apparentFabric.trim()
        : 'Woven drape textile (visual estimate).',
    fabricKeywords: toStringArray(parsed.fabricKeywords),
    styleCharacteristics:
      typeof parsed.styleCharacteristics === 'string' && parsed.styleCharacteristics.trim()
        ? parsed.styleCharacteristics.trim()
        : 'Traditional Indian saree styling.',
    occasionKeywords: toStringArray(parsed.occasionKeywords),
  };

  return { model, analysis };
}

export async function extractTextSearchIntent(
  userQuery: string
): Promise<{ model: string; intent: TextSearchIntent }> {
  const model = getConfiguredGemmaModel();
  const ai = getGenAIClient();

  const prompt = `You are a search intent parser for Silkaree AI, an Indian saree discovery application.
Extract structured shopping preferences from the customer's natural-language request below.
CRITICAL RULES:
- Do NOT invent product names, prices, or database queries.
- Only populate maxPrice or minPrice (in INR numbers, e.g. 7000 for "₹7,000" or "7k") when the customer specifies a price/budget constraint; otherwise use null.
- Only populate region when the customer explicitly mentions a region, state, or regional weave (e.g. "Andhra Pradesh", "Tamil Nadu", "Telangana", "Kanchipuram", "Banarasi", "Uppada", "Mangalagiri", "Pochampally", "Paithani", "Patola", "Bandhani", "Sambalpuri", "South India"); otherwise use null.
- Populate fabric, colour, and occasion with concise normalized strings if mentioned or clearly implied, otherwise null.
- Include useful weave, motif, weight, or style words in keywords (array of strings).

Customer request: "${userQuery}"`;

  const intentSchema = {
    type: Type.OBJECT,
    properties: {
      semanticQuery: {
        type: Type.STRING,
        description: 'Clean normalized summary of what saree style the customer is looking for.',
      },
      fabric: {
        type: Type.STRING,
        nullable: true,
        description: 'Requested fabric such as silk, cotton silk, cotton, tussar, crepe, chanderi, organza, or null.',
      },
      colour: {
        type: Type.STRING,
        nullable: true,
        description: 'Requested colour such as peacock green, dark green, red, maroon, magenta, mustard, ivory, purple, or null.',
      },
      occasion: {
        type: Type.STRING,
        nullable: true,
        description: 'Requested occasion such as wedding, bridal, festive, puja, party, office, daytime, or null.',
      },
      maxPrice: {
        type: Type.NUMBER,
        nullable: true,
        description: 'Maximum budget in INR if requested (e.g. 7000), or null if no upper price limit was stated.',
      },
      minPrice: {
        type: Type.NUMBER,
        nullable: true,
        description: 'Minimum price in INR if requested, or null.',
      },
      region: {
        type: Type.STRING,
        nullable: true,
        description: 'Explicitly requested Indian region, state, or regional weaving tradition, or null.',
      },
      keywords: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Additional search keywords (motifs, weave names, border types, weight).',
      },
      interpretationSummary: {
        type: Type.STRING,
        description: 'One friendly, concise sentence explaining the extracted preferences.',
      },
    },
    required: [
      'semanticQuery',
      'fabric',
      'colour',
      'occasion',
      'maxPrice',
      'minPrice',
      'region',
      'keywords',
      'interpretationSummary',
    ],
  };

  let rawText: string | undefined;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: intentSchema,
      },
    });
    rawText = response.text;
  } catch (primaryErr: unknown) {
    try {
      const fallbackResponse = await ai.models.generateContent({
        model,
        contents: `${prompt}\nRespond ONLY with valid JSON containing keys: semanticQuery, fabric, colour, occasion, maxPrice, minPrice, region, keywords, interpretationSummary.`,
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });
      rawText = fallbackResponse.text;
    } catch {
      throw mapProviderError(primaryErr, model);
    }
  }

  if (!rawText) {
    throw new AIServiceError('Gemma 4 returned an empty response while parsing search query.', 502, 'EMPTY_AI_RESPONSE');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripJsonFences(rawText));
  } catch {
    throw new AIServiceError('Gemma 4 returned invalid JSON while parsing search intent. Please retry.', 502, 'INVALID_AI_JSON');
  }

  const normalizeNullablePrice = (val: unknown): number | null => {
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      return Math.round(val);
    }
    if (typeof val === 'string') {
      const num = Number(val.replace(/[^0-9.]/g, ''));
      if (Number.isFinite(num && num > 0 ? num : NaN)) return Math.round(num);
    }
    return null;
  };

  let maxPrice = normalizeNullablePrice(parsed.maxPrice);
  const explicitUnderMatch = userQuery.match(
    /(?:under|below|less than|within|max|up to|budget(?:\s+of)?)\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(k)?/i
  );
  if (explicitUnderMatch) {
    const rawNum = Number(explicitUnderMatch[1].replace(/,/g, ''));
    if (Number.isFinite(rawNum) && rawNum > 0) {
      maxPrice = explicitUnderMatch[2] ? Math.round(rawNum * 1000) : Math.round(rawNum);
    }
  }

  const intent: TextSearchIntent = {
    semanticQuery: normalizeNullableStr(parsed.semanticQuery) || userQuery.trim(),
    fabric: normalizeNullableStr(parsed.fabric),
    colour: normalizeNullableStr(parsed.colour),
    occasion: normalizeNullableStr(parsed.occasion),
    maxPrice,
    minPrice: normalizeNullablePrice(parsed.minPrice),
    region: normalizeNullableStr(parsed.region),
    keywords: toStringArray(parsed.keywords, 10),
    interpretationSummary:
      normalizeNullableStr(parsed.interpretationSummary) ||
      `Matched catalogue weaves against "${userQuery.trim()}".`,
  };

  return { model, intent };
}

export async function extractInspirationIntentAndGrounding(
  userQuery: string,
  existingIntent?: Partial<TextSearchIntent>
): Promise<{
  model: string;
  inspirationIntent: InspirationSearchIntent;
  groundingSources: GroundingWebSource[];
}> {
  const model = getConfiguredGemmaModel();
  const ai = getGenAIClient();

  const existingHint = existingIntent
    ? `\nKnown preference hints: fabric=${existingIntent.fabric || 'unspecified'}, colour=${existingIntent.colour || 'unspecified'}, region/weave=${existingIntent.region || 'unspecified'}, occasion=${existingIntent.occasion || 'unspecified'}.`
    : '';

  const structuredPrompt = `You are an Indian saree search query specialist for Silkaree AI.
Convert the customer's saree request into a focused external image-search intent so we can find visually relevant saree design references on the web.
CRITICAL RULES:
- Keep queries strictly focused on Indian sarees (always include "saree" or "sari").
- Do NOT invent URLs, brand names, or prices.
- primarySearchQuery: a focused 4 to 7 word saree image search query capturing weave/type, colour, fabric, and motifs (e.g. "dark green Uppada silk saree gold motifs").
- alternativeSearchTerms: 3 progressively broader 2 to 4 word saree search phrases suitable for media archives (e.g. ["Uppada silk saree", "dark green silk saree zari", "green bridal silk saree"]).${existingHint}

Customer request: "${userQuery}"`;

  const inspirationSchema = {
    type: Type.OBJECT,
    properties: {
      sareeTypeOrWeave: {
        type: Type.STRING,
        nullable: true,
        description: 'Specific saree type or weaving tradition (e.g. Uppada, Paithani, Kanchipuram, Banarasi, Patola, Organza), or null.',
      },
      colour: {
        type: Type.STRING,
        nullable: true,
        description: 'Requested saree colour or palette, or null.',
      },
      fabric: {
        type: Type.STRING,
        nullable: true,
        description: 'Requested saree fabric (e.g. silk, organza, linen, cotton, georgette), or null.',
      },
      visiblePatternsAndMotifs: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Visible motifs, borders, or decorative details mentioned (e.g. gold motifs, peacock pallu, floral zari, ikat).',
      },
      occasion: {
        type: Type.STRING,
        nullable: true,
        description: 'Occasion if mentioned (e.g. wedding, bridal, festive, reception), or null.',
      },
      primarySearchQuery: {
        type: Type.STRING,
        description: 'Focused external saree image search query.',
      },
      alternativeSearchTerms: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: '2 to 4 concise 2-4 word alternative saree search queries.',
      },
    },
    required: [
      'sareeTypeOrWeave',
      'colour',
      'fabric',
      'visiblePatternsAndMotifs',
      'occasion',
      'primarySearchQuery',
      'alternativeSearchTerms',
    ],
  };

  // Run structured query generation and optional Google Search grounding concurrently
  const structuredPromise = (async (): Promise<InspirationSearchIntent> => {
    let rawText: string | undefined;
    try {
      const res = await ai.models.generateContent({
        model,
        contents: structuredPrompt,
        config: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: inspirationSchema,
        },
      });
      rawText = res.text;
    } catch (primaryErr: unknown) {
      try {
        const fallbackRes = await ai.models.generateContent({
          model,
          contents: `${structuredPrompt}\nRespond ONLY with valid JSON containing keys: sareeTypeOrWeave, colour, fabric, visiblePatternsAndMotifs, occasion, primarySearchQuery, alternativeSearchTerms.`,
          config: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        });
        rawText = fallbackRes.text;
      } catch {
        throw mapProviderError(primaryErr, model);
      }
    }

    if (!rawText) {
      throw new AIServiceError(
        'Gemma 4 returned an empty response while preparing external saree search terms.',
        502,
        'EMPTY_AI_RESPONSE'
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(stripJsonFences(rawText));
    } catch {
      throw new AIServiceError(
        'Gemma 4 returned invalid JSON while preparing external saree search terms.',
        502,
        'INVALID_AI_JSON'
      );
    }

    const rawPrimary = normalizeNullableStr(parsed.primarySearchQuery) || `${userQuery.trim()} saree`;
    const primaryWithSaree = /\bsar(ee|i)s?\b/i.test(rawPrimary)
      ? rawPrimary
      : `${rawPrimary} saree`;

    const altTerms = toStringArray(parsed.alternativeSearchTerms, 4).map((t) =>
      /\bsar(ee|i)s?\b/i.test(t) ? t : `${t} saree`
    );

    return {
      sareeTypeOrWeave: normalizeNullableStr(parsed.sareeTypeOrWeave),
      colour: normalizeNullableStr(parsed.colour),
      fabric: normalizeNullableStr(parsed.fabric),
      visiblePatternsAndMotifs: toStringArray(parsed.visiblePatternsAndMotifs, 6),
      occasion: normalizeNullableStr(parsed.occasion),
      primarySearchQuery: primaryWithSaree,
      alternativeSearchTerms: altTerms,
    };
  })();

  // Use Gemma 4's Google Search grounding capability to discover relevant web references when supported
  const groundingPromise = (async (): Promise<GroundingWebSource[]> => {
    try {
      const groundingRes = await ai.models.generateContent({
        model,
        contents: `Find traditional textile references and design examples on the web for: ${userQuery} Indian saree.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const chunks =
        groundingRes.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const seenUris = new Set<string>();
      const sources: GroundingWebSource[] = [];

      for (const chunk of chunks) {
        const uri = chunk.web?.uri?.trim();
        const title = chunk.web?.title?.trim();
        if (uri && /^https?:\/\//i.test(uri) && !seenUris.has(uri)) {
          seenUris.add(uri);
          sources.push({
            title: title || extractHostname(uri),
            uri,
          });
        }
        if (sources.length >= 4) break;
      }

      return sources;
    } catch (groundingErr: unknown) {
      // Non-fatal: e.g. gemma-4-31b-it or restricted environments may not return grounding chunks
      console.warn(
        `[Silkaree AI] Google Search grounding unavailable on model ${model}:`,
        groundingErr instanceof Error ? groundingErr.message : String(groundingErr)
      );
      return [];
    }
  })();

  const [inspirationIntent, groundingSources] = await Promise.all([
    structuredPromise,
    groundingPromise,
  ]);

  return {
    model,
    inspirationIntent,
    groundingSources,
  };
}

function extractHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, '');
  } catch {
    return 'External Web Source';
  }
}

function mapProviderError(err: unknown, model: string): AIServiceError {
  const rawMsg = err instanceof Error ? err.message : String(err);
  console.error(`[Silkaree AI] Gemma API error (model=${model}):`, rawMsg);

  if (/API_KEY_INVALID|invalid api key|PERMISSION_DENIED|401|403/i.test(rawMsg)) {
    return new AIServiceError(
      'The Gemini API rejected the configured credentials or access to the requested model.',
      403,
      'API_AUTH_ERROR'
    );
  }
  if (/not found|404|NOT_FOUND/i.test(rawMsg)) {
    return new AIServiceError(
      `Hosted Gemma model "${model}" was not found on the Gemini API. Supported Gemma 4 IDs: ${SUPPORTED_GEMMA_MODELS.join(', ')}.`,
      400,
      'UNSUPPORTED_MODEL_ID'
    );
  }
  if (/RESOURCE_EXHAUSTED|429|quota/i.test(rawMsg)) {
    return new AIServiceError(
      'Gemma 4 API rate limit reached. Please wait a few seconds and click Retry.',
      429,
      'RATE_LIMITED'
    );
  }

  return new AIServiceError(
    `Gemma 4 inference encountered an upstream API error (${model}). Please retry.`,
    502,
    'UPSTREAM_AI_ERROR'
  );
}
