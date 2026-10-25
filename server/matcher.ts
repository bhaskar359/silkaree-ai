import type {
  CatalogueMatchQuality,
  MatchedSaree,
  SareeItem,
  TextSearchIntent,
  VisualAnalysis,
} from '../src/types/saree.ts';

const COLOR_SYNONYM_GROUPS: string[][] = [
  ['peacock green', 'peacock', 'emerald', 'teal', 'dark green', 'forest green', 'bottle green', 'sea green'],
  ['sage green', 'sage', 'olive', 'moss', 'pistachio', 'muted green'],
  ['green'],
  ['magenta', 'rani pink', 'rani', 'fuchsia', 'berry', 'plum', 'wine', 'purple', 'violet'],
  ['pink', 'rose', 'blush', 'peach', 'lotus'],
  ['red', 'crimson', 'sindoor', 'vermilion', 'scarlet', 'maroon', 'burgundy', 'brick', 'terracotta', 'rust'],
  ['mustard', 'yellow', 'ochre', 'turmeric', 'haldi', 'marigold', 'saffron', 'amber'],
  ['gold', 'golden', 'zari', 'antique gold', 'antique zari', 'champagne', 'bronze', 'copper', 'metallic'],
  ['silver', 'silver zari', 'platinum'],
  ['black', 'obsidian', 'charcoal', 'jet black', 'ebony'],
  ['ivory', 'cream', 'off-white', 'white', 'sandalwood', 'pearl', 'beige', 'honey', 'tan', 'tussar'],
  ['blue', 'indigo', 'sapphire', 'royal blue', 'navy', 'peacock blue', 'cobalt'],
];

const NAMED_WEAVE_TRADITIONS = [
  'kanchipuram',
  'kanjeevaram',
  'uppada',
  'jamdani',
  'pochampally',
  'ikat',
  'mangalagiri',
  'narayanpet',
  'mysore',
  'gadwal',
  'banarasi',
  'chanderi',
  'tussar',
  'bhagalpuri',
  'dharmavaram',
  'chettinad',
  'paithani',
  'patola',
  'bandhani',
  'sambalpuri',
  'baluchari',
  'tant',
  'kasavu',
  'muga',
  'eri',
  'organza',
  'georgette',
  'chiffon',
  'linen',
  'kalamkari',
];

const SOUTH_INDIA_STATES = ['tamil nadu', 'andhra pradesh', 'telangana', 'karnataka', 'kerala'];

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function expandColorTerms(terms: string[]): Set<string> {
  const expanded = new Set<string>();
  for (const raw of terms) {
    const norm = normalizeText(raw);
    if (!norm) continue;
    expanded.add(norm);
    for (const group of COLOR_SYNONYM_GROUPS) {
      if (group.some((syn) => norm.includes(syn) || syn.includes(norm))) {
        group.forEach((syn) => expanded.add(syn));
      }
    }
  }
  return expanded;
}

function formatINR(price: number): string {
  return `₹${price.toLocaleString('en-IN')}`;
}

export function rankByVisualAnalysis(
  analysis: VisualAnalysis,
  catalogue: SareeItem[]
): {
  results: MatchedSaree[];
  hasStrongMatch: boolean;
  matchSummaryNote: string;
} {
  const aiColorInputs = [
    ...analysis.colorKeywords,
    ...analysis.dominantColors.map((c) => c.name),
  ];
  const expandedAiColors = expandColorTerms(aiColorInputs);

  const metallicWords = new Set([
    'gold',
    'golden',
    'zari',
    'antique gold',
    'antique zari',
    'champagne',
    'silver',
    'silver zari',
    'bronze',
    'copper',
    'metallic',
  ]);

  const patternTokens = normalizeText(
    [...analysis.visiblePatterns, analysis.borderDetails].join(' ')
  )
    .split(' ')
    .filter(
      (w) =>
        w.length >= 4 &&
        !['with', 'border', 'saree', 'woven', 'pattern', 'motif', 'motifs', 'traditional', 'design'].includes(w)
    );

  const fabricText = normalizeText(
    [analysis.apparentFabric, ...analysis.fabricKeywords].join(' ')
  );

  const occasionText = normalizeText(
    [analysis.styleCharacteristics, ...analysis.occasionKeywords].join(' ')
  );

  const scored = catalogue.map((saree) => {
    let rawPoints = 0;
    const matchedColors: string[] = [];
    const matchedPatterns: string[] = [];
    let fabricMatched = false;
    let occasionMatched = false;

    let primaryColorScore = 0;
    let zariColorScore = 0;
    for (const sCol of saree.colours) {
      const normSCol = normalizeText(sCol);
      const isMetallic =
        metallicWords.has(normSCol) ||
        normSCol.includes('zari') ||
        normSCol.includes('gold') ||
        normSCol.includes('silver');
      const directHit = aiColorInputs.some((ac) => {
        const nac = normalizeText(ac);
        return nac && (nac.includes(normSCol) || normSCol.includes(nac));
      });
      const synonymHit = expandedAiColors.has(normSCol);

      if (directHit || synonymHit) {
        if (isMetallic) {
          zariColorScore = Math.max(zariColorScore, directHit ? 8 : 5);
        } else {
          primaryColorScore += directHit ? 22 : 13;
        }
        if (!matchedColors.includes(sCol)) matchedColors.push(sCol);
      }
    }
    rawPoints += Math.min(34, primaryColorScore) + zariColorScore;

    const sareeCorpus = normalizeText(
      [...saree.patterns, saree.shortDescription, saree.weaveSubtitle, saree.name].join(' ')
    );

    let patternScore = 0;
    for (const pat of saree.patterns) {
      const normPat = normalizeText(pat);
      const exactPhrase =
        analysis.visiblePatterns.some((vp) => {
          const nvp = normalizeText(vp);
          return nvp.includes(normPat) || normPat.includes(nvp);
        }) || normalizeText(analysis.borderDetails).includes(normPat);

      if (exactPhrase) {
        patternScore += 12;
        matchedPatterns.push(pat);
      } else {
        const patWords = normPat.split(' ').filter((w) => w.length >= 4);
        if (patWords.some((pw) => patternTokens.includes(pw))) {
          patternScore += 7;
          matchedPatterns.push(pat);
        }
      }
    }
    if (matchedPatterns.length === 0) {
      for (const tok of patternTokens) {
        if (sareeCorpus.includes(tok)) {
          patternScore += 5;
          matchedPatterns.push(tok);
        }
      }
    }
    rawPoints += Math.min(34, patternScore);

    const normSareeFabric = normalizeText(saree.fabric);
    const wantsCotton = fabricText.includes('cotton');
    const wantsSilk = fabricText.includes('silk') || fabricText.includes('brocade') || fabricText.includes('zari');
    const wantsIkat = fabricText.includes('ikat');
    const wantsTussar = fabricText.includes('tussar') || fabricText.includes('slub') || fabricText.includes('raw');
    const wantsSheer =
      fabricText.includes('sheer') ||
      fabricText.includes('chanderi') ||
      fabricText.includes('organza') ||
      fabricText.includes('jamdani') ||
      fabricText.includes('translucent');

    if (wantsIkat && (normSareeFabric.includes('ikat') || sareeCorpus.includes('ikat'))) {
      rawPoints += 16;
      fabricMatched = true;
    } else if (wantsTussar && normSareeFabric.includes('tussar')) {
      rawPoints += 16;
      fabricMatched = true;
    } else if (
      wantsSheer &&
      (normSareeFabric.includes('chanderi') || sareeCorpus.includes('jamdani') || sareeCorpus.includes('featherlight'))
    ) {
      rawPoints += 15;
      fabricMatched = true;
    } else if (wantsCotton && wantsSilk && normSareeFabric.includes('cotton') && normSareeFabric.includes('silk')) {
      rawPoints += 16;
      fabricMatched = true;
    } else if (wantsCotton && !wantsSilk && normSareeFabric.includes('cotton')) {
      rawPoints += 15;
      fabricMatched = true;
    } else if (wantsSilk && normSareeFabric.includes('silk')) {
      rawPoints += 13;
      fabricMatched = true;
    }

    for (const occ of saree.occasions) {
      if (occasionText.includes(normalizeText(occ))) {
        rawPoints += 8;
        occasionMatched = true;
        break;
      }
    }

    const clampedScore = Math.min(97, Math.max(38, Math.round(35 + rawPoints * 0.64)));

    const reasons: string[] = [];
    const matchedAttributes: string[] = [];

    const nonMetalMatched = matchedColors.filter((c) => !metallicWords.has(normalizeText(c)));
    if (nonMetalMatched.length > 0) {
      reasons.push(`matching ${nonMetalMatched.slice(0, 2).join(' & ')} colour palette`);
      matchedAttributes.push(`Colour: ${saree.colour}`);
    } else if (matchedColors.length > 0) {
      reasons.push(`complementary ${matchedColors[0]} metallic accents`);
    }

    if (matchedPatterns.length > 0) {
      const uniquePats = Array.from(new Set(matchedPatterns)).slice(0, 2);
      reasons.push(`shared ${uniquePats.join(' & ')} motif details`);
      matchedAttributes.push(`Motif: ${uniquePats[0]}`);
    }

    if (fabricMatched) {
      reasons.push(`comparable ${saree.fabric.toLowerCase()} weave texture`);
      matchedAttributes.push(saree.fabric);
    }

    if (occasionMatched) {
      reasons.push(`suited for ${saree.occasion.toLowerCase()}`);
    }

    let matchLabel = 'Closest Catalogue Weave';
    let whyThisMatches = '';

    if (rawPoints >= 58) {
      matchLabel = `${clampedScore}% Visual Match`;
      whyThisMatches = `Selected for ${reasons.join(', ')} in ${saree.region}.`;
    } else if (rawPoints >= 34) {
      matchLabel =
        nonMetalMatched.length > 0
          ? `${clampedScore}% Palette & Weave Match`
          : `${clampedScore}% Motif & Technique Match`;
      whyThisMatches = `Shares ${reasons.join(', ')}, offering a related handloom alternative at ${formatINR(saree.price)}.`;
    } else {
      matchLabel = 'Handloom Alternative';
      whyThisMatches =
        reasons.length > 0
          ? `Partial overlap via ${reasons.join(' and ')}; shown as a curated handloom option from our sample catalogue.`
          : `No close colour or motif twin in our 12-saree sample catalogue; shown as an authentic ${saree.fabric.toLowerCase()} option from ${saree.state}.`;
    }

    return {
      saree,
      rawPoints,
      matchScore: clampedScore,
      matchLabel,
      whyThisMatches,
      matchedAttributes,
    };
  });

  scored.sort((a, b) => b.rawPoints - a.rawPoints || a.saree.price - b.saree.price);

  const hasStrongMatch = scored.length > 0 && scored[0].rawPoints >= 32;
  const topSlice = scored.slice(0, 5).map(({ rawPoints: _rp, ...rest }) => rest);

  const matchSummaryNote = hasStrongMatch
    ? 'Ranked deterministically against our 12-item handloom catalogue using Gemma 4 visual estimates.'
    : 'No exact visual match exists in our small 12-saree sample catalogue. Showing the closest available handloom weaves with honest comparisons.';

  return {
    results: topSlice,
    hasStrongMatch,
    matchSummaryNote,
  };
}

export function rankByTextIntent(
  userQuery: string,
  intent: TextSearchIntent,
  catalogue: SareeItem[]
): {
  results: MatchedSaree[];
  hasStrongMatch: boolean;
  matchQuality: CatalogueMatchQuality;
  matchSummaryNote: string;
} {
  const fullQueryNorm = normalizeText(`${userQuery} ${intent.semanticQuery} ${intent.keywords.join(' ')}`);
  const expandedColors = intent.colour ? expandColorTerms([intent.colour]) : new Set<string>();
  const normFabric = intent.fabric ? normalizeText(intent.fabric) : '';
  const normOccasion = intent.occasion ? normalizeText(intent.occasion) : '';
  const normRegion = intent.region ? normalizeText(intent.region) : '';

  // Detect if customer requested a specific named weaving tradition (e.g. "Uppada", "Paithani", "Patola", "Organza")
  const requestedTraditions = NAMED_WEAVE_TRADITIONS.filter((trad) =>
    new RegExp(`\\b${trad}\\b`, 'i').test(`${userQuery} ${intent.region || ''} ${intent.fabric || ''}`)
  );

  const evaluateItem = (saree: SareeItem, enforceStrictPriceAndRegion: boolean) => {
    const sareeRegionCorpus = normalizeText(`${saree.region} ${saree.state} ${saree.name} ${saree.weaveSubtitle}`);
    const sareeFullCorpus = normalizeText(
      [
        saree.name,
        saree.fabric,
        saree.colour,
        ...saree.colours,
        saree.occasion,
        ...saree.occasions,
        saree.region,
        saree.state,
        ...saree.patterns,
        saree.shortDescription,
        saree.weaveSubtitle,
      ].join(' ')
    );

    const satisfiesPrice =
      (intent.maxPrice === null || saree.price <= intent.maxPrice) &&
      (intent.minPrice === null || saree.price >= intent.minPrice);

    let satisfiesRegion = true;
    if (normRegion) {
      const isSouthIndiaRequest =
        normRegion.includes('south india') &&
        SOUTH_INDIA_STATES.includes(normalizeText(saree.state));
      const regionWords = normRegion
        .split(' ')
        .filter((w) => w.length >= 4 && !['india', 'pradesh', 'state', 'weaves', 'region'].includes(w));
      satisfiesRegion =
        isSouthIndiaRequest ||
        sareeRegionCorpus.includes(normRegion) ||
        (regionWords.length > 0 && regionWords.some((rw) => sareeRegionCorpus.includes(rw)));
    }

    const satisfiesTradition =
      requestedTraditions.length === 0 ||
      requestedTraditions.some((trad) => {
        if (trad === 'kanjeevaram') return sareeFullCorpus.includes('kanchipuram');
        return sareeFullCorpus.includes(trad);
      });

    if (enforceStrictPriceAndRegion && (!satisfiesPrice || !satisfiesRegion)) {
      return null;
    }

    let points = 0;
    const reasons: string[] = [];
    const matchedAttributes: string[] = [];

    let matchedFabric = !normFabric;
    let matchedColor = !intent.colour;

    // Price fit
    if (intent.maxPrice !== null) {
      if (saree.price <= intent.maxPrice) {
        points += 28;
        reasons.push(`priced at ${formatINR(saree.price)} (within your ${formatINR(intent.maxPrice)} budget)`);
        matchedAttributes.push(`Under ${formatINR(intent.maxPrice)}`);
      } else {
        points -= 25;
      }
    }

    // Named tradition fit
    if (requestedTraditions.length > 0) {
      if (satisfiesTradition) {
        points += 30;
        reasons.push(`authentic ${requestedTraditions[0]} weave`);
      } else {
        points -= 10;
      }
    }

    // Fabric match
    if (normFabric) {
      const sareeFabNorm = normalizeText(saree.fabric);
      const isPureSilkItem =
        sareeFabNorm.includes('silk') &&
        !sareeFabNorm.includes('cotton') &&
        !sareeFabNorm.includes('sico');
      const wantsPureSilk = normFabric.includes('silk') && !normFabric.includes('cotton');

      if (wantsPureSilk && isPureSilkItem) {
        points += 32;
        matchedFabric = true;
        reasons.push(`pure ${saree.fabric.toLowerCase()} weave`);
        matchedAttributes.push(saree.fabric);
      } else if (sareeFabNorm.includes(normFabric) || normFabric.includes(sareeFabNorm)) {
        points += 25;
        matchedFabric = true;
        reasons.push(`${saree.fabric.toLowerCase()} weave`);
        matchedAttributes.push(saree.fabric);
      } else if (normFabric.includes('silk') && sareeFabNorm.includes('silk')) {
        points += 20;
        matchedFabric = true;
        reasons.push(`${saree.fabric.toLowerCase()}`);
        matchedAttributes.push(saree.fabric);
      } else if (normFabric.includes('cotton') && sareeFabNorm.includes('cotton')) {
        points += 25;
        matchedFabric = true;
        reasons.push(`${saree.fabric.toLowerCase()}`);
        matchedAttributes.push(saree.fabric);
      }
    }

    // Colour match
    if (intent.colour) {
      const hitColor = saree.colours.find((sc) => {
        const nsc = normalizeText(sc);
        return expandedColors.has(nsc) || nsc.includes(normalizeText(intent.colour!));
      });
      if (hitColor) {
        points += 28;
        matchedColor = true;
        reasons.push(`${saree.colour.toLowerCase()} palette`);
        matchedAttributes.push(saree.colour);
      }
    }

    // Occasion match
    if (normOccasion) {
      const hitOcc = saree.occasions.find((occ) => {
        const nocc = normalizeText(occ);
        return normOccasion.includes(nocc) || nocc.includes(normOccasion);
      });
      if (hitOcc || sareeFullCorpus.includes(normOccasion)) {
        points += 18;
        reasons.push(`curated for ${saree.occasion.toLowerCase()}`);
        matchedAttributes.push(saree.occasion);
      }
    }

    // Region match
    if (normRegion && satisfiesRegion) {
      points += 24;
      reasons.push(`from ${saree.region}`);
      matchedAttributes.push(saree.state);
    }

    // Semantic & keyword hits
    const queryTokens = Array.from(
      new Set(
        fullQueryNorm
          .split(' ')
          .filter(
            (w) =>
              w.length >= 4 &&
              !['want', 'saree', 'sarees', 'with', 'under', 'below', 'from', 'explore', 'show', 'find', 'need', 'looking', 'indian'].includes(w)
          )
      )
    );

    const keywordHits: string[] = [];
    for (const tok of queryTokens) {
      if (sareeFullCorpus.includes(tok)) {
        points += 6;
        keywordHits.push(tok);
      }
    }

    if (reasons.length === 0 && keywordHits.length > 0) {
      reasons.push(`shares ${keywordHits.slice(0, 3).join(', ')} details`);
    }

    const satisfiesAllCoreFacets =
      satisfiesPrice &&
      satisfiesRegion &&
      satisfiesTradition &&
      matchedFabric &&
      matchedColor;

    return {
      saree,
      points,
      reasons,
      matchedAttributes,
      satisfiesAllCoreFacets,
    };
  };

  let strictCandidates = catalogue
    .map((s) => evaluateItem(s, true))
    .filter((item): item is NonNullable<typeof item> => item !== null && item.points >= 18);

  strictCandidates.sort((a, b) => {
    if (a.satisfiesAllCoreFacets !== b.satisfiesAllCoreFacets) {
      return a.satisfiesAllCoreFacets ? -1 : 1;
    }
    return b.points - a.points || a.saree.price - b.saree.price;
  });

  const hasExactFacetMatch = strictCandidates.some((c) => c.satisfiesAllCoreFacets && c.points >= 24);

  let matchQuality: CatalogueMatchQuality = 'strong';
  let finalCandidates = strictCandidates;
  let matchSummaryNote =
    'Filtered and ranked deterministically from our curated Silkaree catalogue.';

  if (hasExactFacetMatch) {
    matchQuality = 'strong';
    finalCandidates = strictCandidates.slice(0, 6);
  } else if (strictCandidates.length > 0) {
    // Partial match within strict price/region (e.g. Uppada matched OR dark green matched, not both)
    matchQuality = 'partial';
    finalCandidates = strictCandidates.slice(0, 4);
    matchSummaryNote =
      'Our current 12-item catalogue has partial matches for your request. Explore related in-catalogue sarees below or browse external design inspiration.';
  } else {
    // Check relaxed partial overlaps (e.g. requested "dark green Uppada" where region="Uppada" filtered out dark green Kanchipuram, or requested "Paithani")
    const relaxedCandidates = catalogue
      .map((s) => evaluateItem(s, false))
      .filter((item): item is NonNullable<typeof item> => item !== null && item.points >= 22)
      .sort((a, b) => b.points - a.points || a.saree.price - b.saree.price)
      .slice(0, 3);

    if (relaxedCandidates.length > 0) {
      matchQuality = 'partial';
      finalCandidates = relaxedCandidates;
      matchSummaryNote =
        'No exact match in our current 12-item catalogue covers every detail of your request. Showing partial catalogue matches alongside external design inspiration below.';
    } else {
      matchQuality = 'none';
      finalCandidates = [];
      matchSummaryNote =
        'No matching sarees were found in our 12-item local catalogue for this style. Explore external saree design inspiration below.';
    }
  }

  const results: MatchedSaree[] = finalCandidates.map((c) => {
    const score = Math.min(98, Math.max(45, Math.round(50 + c.points * 0.45)));
    const matchLabel = c.satisfiesAllCoreFacets
      ? `${score}% Catalogue Match`
      : 'Partial Catalogue Match';

    const whyThisMatches =
      c.reasons.length > 0
        ? c.satisfiesAllCoreFacets
          ? `Matches via ${c.reasons.join(', ')}.`
          : `Partial overlap via ${c.reasons.join(', ')} (differs from some requested specifics).`
        : `${c.saree.fabric} handloom from ${c.saree.region} at ${formatINR(c.saree.price)}.`;

    return {
      saree: c.saree,
      matchScore: score,
      matchLabel,
      whyThisMatches,
      matchedAttributes: c.matchedAttributes,
    };
  });

  return {
    results,
    hasStrongMatch: matchQuality === 'strong',
    matchQuality,
    matchSummaryNote,
  };
}
