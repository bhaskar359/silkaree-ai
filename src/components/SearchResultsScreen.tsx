import { type ChangeEvent, type FormEvent, useRef, useState } from 'react';
import type {
  ExternalInspirationItem,
  ImageSearchResponse,
  InspirationSearchResponse,
  MatchedSaree,
  SareeItem,
  TextSearchResponse,
} from '../types/saree';
import type { SelectedPhotoPayload } from './HomeScreen';
import { SareeImage } from './SareeImage';

export type SearchStatus = 'loading' | 'success' | 'error' | 'browse';
export type InspirationStatus = 'idle' | 'loading' | 'success' | 'error';

interface SearchResultsScreenProps {
  status: SearchStatus;
  activeMode: 'image' | 'text' | 'catalogue' | 'saved';
  queryText: string;
  uploadedPreviewUrl: string | null;
  uploadedLabel: string | null;
  imageResponse: ImageSearchResponse | null;
  textResponse: TextSearchResponse | null;
  inspirationStatus: InspirationStatus;
  inspirationResponse: InspirationSearchResponse | null;
  inspirationError: string | null;
  browseSarees: SareeItem[];
  errorMessage: string | null;
  savedIds: Set<string>;
  onResetToHome: () => void;
  onRetry: () => void;
  onLoadInspiration: () => void;
  onRequestInspirationStyle: (item: ExternalInspirationItem) => void;
  onNewTextSearch: (query: string) => void;
  onNewImageSearch: (payload: SelectedPhotoPayload) => void;
  onSelectSaree: (saree: SareeItem) => void;
  onToggleSave: (id: string) => void;
}

type ClientFilter = 'all' | 'under7k' | 'silk' | 'southIndia' | 'saved';

const SOUTH_STATES = new Set([
  'Tamil Nadu',
  'Andhra Pradesh',
  'Telangana',
  'Karnataka',
]);

function getAvailabilityBadgeText(saree: SareeItem): string {
  if (saree.inStock === true) return 'In stock';
  if (saree.inStock === false) return 'Out of stock';
  return 'Availability unverified';
}

export function SearchResultsScreen({
  status,
  activeMode,
  queryText,
  uploadedPreviewUrl,
  uploadedLabel,
  imageResponse,
  textResponse,
  inspirationStatus,
  inspirationResponse,
  inspirationError,
  browseSarees,
  errorMessage,
  savedIds,
  onResetToHome,
  onRetry,
  onLoadInspiration,
  onRequestInspirationStyle,
  onNewTextSearch,
  onNewImageSearch,
  onSelectSaree,
  onToggleSave,
}: SearchResultsScreenProps) {
  const [clientFilter, setClientFilter] = useState<ClientFilter>('all');
  const [inlineQuery, setInlineQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inlineFileRef = useRef<HTMLInputElement | null>(null);

  const handleInlineTextSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = inlineQuery.trim();
    if (!trimmed) return;
    setClientFilter('all');
    setInlineQuery('');
    onNewTextSearch(trimmed);
  };

  const handleInlinePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setClientFilter('all');
    const previewUrl = URL.createObjectURL(file);
    onNewImageSearch({
      file,
      previewUrl,
      label: `${file.name} (${(file.size / 1024).toFixed(0)} KB)`,
    });
  };

  const handleShare = (saree: SareeItem) => {
    const shareText = `${saree.name} — ₹${saree.price.toLocaleString('en-IN')} (${saree.region}) on Silkaree AI`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareText).catch(() => {});
    }
    setCopiedId(saree.id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === saree.id ? null : prev));
    }, 1800);
  };

  let rawMatches: MatchedSaree[] = [];
  if (status === 'success') {
    if (activeMode === 'image' && imageResponse) {
      rawMatches = imageResponse.results;
    } else if (activeMode === 'text' && textResponse) {
      rawMatches = textResponse.results;
    }
  } else if (status === 'browse') {
    const baseList =
      activeMode === 'saved'
        ? browseSarees.filter((s) => savedIds.has(s.id))
        : browseSarees;
    rawMatches = baseList.map((saree) => ({
      saree,
      matchScore: 100,
      matchLabel: saree.badge,
      whyThisMatches: `${saree.fabric} woven in ${saree.region} — suited for ${saree.occasion.toLowerCase()}.`,
      matchedAttributes: [saree.fabric, saree.state],
    }));
  }

  const filteredMatches = rawMatches.filter(({ saree }) => {
    if (clientFilter === 'under7k') return saree.price <= 7000;
    if (clientFilter === 'silk') return saree.fabric.toLowerCase().includes('silk');
    if (clientFilter === 'southIndia') return SOUTH_STATES.has(saree.state);
    if (clientFilter === 'saved') return savedIds.has(saree.id);
    return true;
  });

  const activeModelName =
    imageResponse?.model || textResponse?.model || 'gemma-4-26b-a4b-it';

  const bannerKicker =
    activeMode === 'image'
      ? 'Multimodal Visual Match'
      : activeMode === 'text'
        ? 'Natural Language Search'
        : activeMode === 'saved'
          ? 'Saved Bookmarks'
          : 'Complete Handloom Catalogue';

  const bannerHeadline =
    activeMode === 'image'
      ? status === 'loading'
        ? 'Inspecting uploaded saree photograph...'
        : imageResponse?.analysis.summaryHeadline || 'Finding sarees with a similar look'
      : activeMode === 'text'
        ? `“${queryText}”`
        : activeMode === 'saved'
          ? 'Your Saved Sarees'
          : 'All GI & Regional Indian Weaves';

  const showSectionB =
    activeMode === 'text' &&
    status === 'success' &&
    (textResponse?.matchQuality !== 'strong' || inspirationStatus !== 'idle');

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-2 pb-12 flex flex-col gap-5">
      {/* Active Query & Upload Banner */}
      <div className="rounded-2xl p-4 bg-surface-container-high/85 shadow-md backdrop-blur-md border border-secondary/20 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {activeMode === 'image' && uploadedPreviewUrl ? (
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shadow-sm shrink-0 bg-surface-container border border-secondary/30">
                <img
                  src={uploadedPreviewUrl}
                  alt="Uploaded query saree"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-[24px]">
                  {activeMode === 'saved'
                    ? 'bookmark'
                    : activeMode === 'catalogue'
                      ? 'grid_view'
                      : 'auto_awesome'}
                </span>
              </div>
            )}

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold">
                  {bannerKicker}
                </span>
                {status === 'success' && (
                  <span className="material-symbols-outlined text-[14px] text-secondary">
                    verified
                  </span>
                )}
              </div>
              <h1 className="font-headline-sm text-headline-sm text-primary tracking-tight truncate">
                {bannerHeadline}
              </h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                {activeMode === 'image' && uploadedLabel
                  ? `${uploadedLabel} · Model: ${activeModelName}`
                  : status === 'success'
                    ? `Evaluated via ${activeModelName} against ${browseSarees.length} catalogue handlooms`
                    : `${browseSarees.length} authentic handlooms in sample catalogue`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onResetToHome}
            className="shrink-0 px-3.5 py-2 rounded-xl bg-surface-container-lowest text-primary hover:bg-secondary-container/40 transition-all shadow-sm flex items-center gap-1.5 min-h-[44px] cursor-pointer whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span className="font-label-md text-label-md">Reset</span>
          </button>
        </div>

        {/* Quick Start-Another-Search Bar */}
        <div className="pt-2 border-t border-outline-variant/40 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <form onSubmit={handleInlineTextSubmit} className="relative flex-1">
            <input
              type="text"
              value={inlineQuery}
              onChange={(e) => setInlineQuery(e.target.value)}
              placeholder="Start another search (e.g. dark green Uppada silk saree with gold motifs)..."
              className="w-full h-10 pl-3.5 pr-20 rounded-xl bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/60 font-body-sm text-body-sm border border-secondary/25 focus:outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={!inlineQuery.trim() || status === 'loading'}
              className="absolute right-1 top-1 h-8 px-3 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm uppercase tracking-wider disabled:opacity-40 cursor-pointer"
            >
              Search
            </button>
          </form>

          <input
            ref={inlineFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleInlinePhotoChange}
            className="hidden"
          />
          <button
            type="button"
            disabled={status === 'loading'}
            onClick={() => inlineFileRef.current?.click()}
            className="h-10 px-3.5 rounded-xl bg-surface-container-lowest hover:bg-secondary-container/35 text-primary border border-secondary/30 font-label-md text-label-md flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[18px] text-secondary">
              add_a_photo
            </span>
            <span>Upload Photo</span>
          </button>
        </div>
      </div>

      {/* STATE 1: Live AI Analyzing Loader */}
      {status === 'loading' && (
        <section className="py-14 px-4 rounded-2xl bg-surface-container-low border border-secondary/20 flex flex-col items-center justify-center text-center">
          <div className="relative w-20 h-20 mb-4 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-secondary-container border-t-primary animate-spin" />
            <span className="material-symbols-outlined text-primary text-[28px]">
              auto_awesome
            </span>
          </div>
          <h2 className="font-headline-sm text-headline-sm text-primary mb-1">
            {activeMode === 'image'
              ? 'Gemma 4 Multimodal Visual Extraction...'
              : 'Gemma 4 Extracting Saree Preferences...'}
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
            {activeMode === 'image'
              ? 'Inspecting dominant chromas, border motifs, and apparent fabric texture via the hosted Gemini API, then ranking matching catalogue weaves.'
              : 'Parsing fabric, colour, occasion, region, and INR budget preferences via Gemma 4 to rank our handloom catalogue.'}
          </p>
        </section>
      )}

      {/* STATE 2: Error State with Retry */}
      {status === 'error' && (
        <section className="py-8 px-4">
          <div className="rounded-2xl p-6 bg-error-container text-on-error-container text-center flex flex-col items-center max-w-lg mx-auto shadow-sm">
            <span className="material-symbols-outlined text-[36px] mb-2 text-error">
              cloud_off
            </span>
            <h2 className="font-headline-sm text-headline-sm font-semibold mb-1.5">
              Gemma 4 Search Interrupted
            </h2>
            <p className="font-body-sm text-body-sm mb-5 max-w-md">
              {errorMessage ||
                'Unable to complete AI analysis right now. Please check your connection or retry.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={onRetry}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-tertiary text-on-primary font-label-md text-label-md shadow-sm flex items-center gap-1.5 cursor-pointer min-h-[44px]"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                <span>Retry Request</span>
              </button>
              <button
                type="button"
                onClick={onResetToHome}
                className="px-4 py-2.5 rounded-xl bg-surface-container-lowest text-on-surface font-label-md text-label-md shadow-sm cursor-pointer min-h-[44px]"
              >
                Back to Home
              </button>
            </div>
          </div>
        </section>
      )}

      {/* STATE 3A: Live Gemma 4 Image Extraction Panel */}
      {status === 'success' && activeMode === 'image' && imageResponse && (
        <section id="aiAnalysisContainer">
          <div className="rounded-2xl bg-tertiary text-on-tertiary p-4 sm:p-5 shadow-xl relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-primary-container/40 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-start justify-between gap-2 mb-3.5 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-surface-container-low/15 backdrop-blur-md flex items-center justify-center text-secondary-fixed shrink-0">
                  <span className="material-symbols-outlined text-[20px]">
                    auto_awesome
                  </span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-label-lg text-label-lg font-bold text-on-tertiary tracking-wide">
                      AI Visual Extraction
                    </span>
                    <span className="font-label-sm text-label-sm text-on-tertiary-container">
                      · {imageResponse.model}
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-tertiary-container/85">
                    Observable colour, border &amp; weave breakdown
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-secondary/40 text-secondary-fixed font-label-sm text-label-sm uppercase tracking-wider shrink-0">
                Visual Estimates
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1 relative z-10">
              <div className="md:col-span-2 p-3 rounded-xl bg-surface-container-low/10 backdrop-blur-sm flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-on-tertiary-container uppercase tracking-wider font-semibold">
                    Detected Dominant Tones
                  </span>
                  <span className="font-label-sm text-label-sm text-secondary-fixed tabular-nums">
                    {imageResponse.analysis.dominantColors.length} Chromas extracted
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {imageResponse.analysis.dominantColors.map((tone, idx) => (
                    <div
                      key={`${tone.name}-${idx}`}
                      className="flex items-center gap-1.5 bg-surface-container-low/15 px-2.5 py-1 rounded-lg"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        className="shrink-0 rounded-full ring-1 ring-white/40"
                        aria-hidden="true"
                      >
                        <circle cx="7" cy="7" r="7" fill={tone.hex} />
                      </svg>
                      <span className="font-label-sm text-label-sm text-on-tertiary tabular-nums">
                        {tone.name} ({tone.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low/10 backdrop-blur-sm flex items-start gap-2.5">
                <span className="material-symbols-outlined text-secondary-fixed text-[20px] mt-0.5 shrink-0">
                  texture
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-sm text-label-sm text-on-tertiary-container uppercase tracking-wider font-semibold">
                    Apparent Fabric &amp; Texture
                  </span>
                  <p className="font-body-sm text-body-sm text-on-tertiary pt-0.5">
                    {imageResponse.analysis.apparentFabric}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low/10 backdrop-blur-sm flex items-start gap-2.5">
                <span className="material-symbols-outlined text-secondary-fixed text-[20px] mt-0.5 shrink-0">
                  temple_hindu
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-sm text-label-sm text-on-tertiary-container uppercase tracking-wider font-semibold">
                    Visible Motifs &amp; Border Details
                  </span>
                  <p className="font-body-sm text-body-sm text-on-tertiary pt-0.5">
                    {imageResponse.analysis.visiblePatterns.length > 0
                      ? `${imageResponse.analysis.visiblePatterns.join(', ')} — ${imageResponse.analysis.borderDetails}`
                      : imageResponse.analysis.borderDetails}
                  </p>
                </div>
              </div>

              <div className="md:col-span-2 p-3 rounded-xl bg-surface-container-low/10 backdrop-blur-sm flex items-start gap-2.5">
                <span className="material-symbols-outlined text-secondary-fixed text-[20px] mt-0.5 shrink-0">
                  event_available
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-sm text-label-sm text-on-tertiary-container uppercase tracking-wider font-semibold">
                    Style Characteristics for Visual Matching
                  </span>
                  <p className="font-body-sm text-body-sm text-on-tertiary pt-0.5">
                    {imageResponse.analysis.styleCharacteristics}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 text-center relative z-10">
              <p className="font-body-sm text-body-sm text-on-tertiary-container italic">
                “{imageResponse.matchSummaryNote}”
              </p>
            </div>
          </div>
        </section>
      )}

      {/* STATE 3B: Live Gemma 4 Natural-Language Intent Panel */}
      {status === 'success' && activeMode === 'text' && textResponse && (
        <section>
          <div className="rounded-2xl bg-tertiary text-on-tertiary p-4 sm:p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-surface-container-low/15 flex items-center justify-center text-secondary-fixed shrink-0">
                  <span className="material-symbols-outlined text-[20px]">
                    manage_search
                  </span>
                </div>
                <div>
                  <span className="font-label-lg text-label-lg font-bold text-on-tertiary">
                    Gemma 4 Extracted Preferences
                  </span>
                  <p className="font-body-sm text-body-sm text-on-tertiary-container/90">
                    {textResponse.intent.interpretationSummary}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-secondary/40 text-secondary-fixed font-label-sm text-label-sm uppercase tracking-wider shrink-0">
                Structured Intent
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-surface-container-low/10">
                <span className="font-label-sm text-label-sm text-on-tertiary-container uppercase block">
                  Fabric
                </span>
                <span className="font-label-md text-label-md text-on-tertiary font-semibold">
                  {textResponse.intent.fabric || 'Any Weave'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container-low/10">
                <span className="font-label-sm text-label-sm text-on-tertiary-container uppercase block">
                  Colour
                </span>
                <span className="font-label-md text-label-md text-on-tertiary font-semibold">
                  {textResponse.intent.colour || 'Any Palette'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container-low/10">
                <span className="font-label-sm text-label-sm text-on-tertiary-container uppercase block">
                  Occasion
                </span>
                <span className="font-label-md text-label-md text-on-tertiary font-semibold">
                  {textResponse.intent.occasion || 'All Occasions'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container-low/10">
                <span className="font-label-sm text-label-sm text-on-tertiary-container uppercase block">
                  Max Budget
                </span>
                <span className="font-label-md text-label-md text-secondary-fixed font-semibold tabular-nums">
                  {textResponse.intent.maxPrice
                    ? `≤ ₹${textResponse.intent.maxPrice.toLocaleString('en-IN')}`
                    : 'No Limit'}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-surface-container-low/10">
                <span className="font-label-sm text-label-sm text-on-tertiary-container uppercase block">
                  Region / Weave
                </span>
                <span className="font-label-md text-label-md text-on-tertiary font-semibold">
                  {textResponse.intent.region || 'Pan-India'}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* SECTION A: AVAILABLE IN SILKAREE (Local JSON Catalogue Products)  */}
      {/* ================================================================= */}
      {(status === 'success' || status === 'browse') && (
        <section className="flex flex-col gap-3.5" id="sectionAvailableInSilkaree">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pt-1">
            <div>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold block">
                {activeMode === 'text' ? 'Section A · Curated Catalogue' : 'Silkaree Catalogue'}
              </span>
              <h2 className="font-headline-md text-headline-md text-primary">
                Available in Silkaree
              </h2>
              {activeMode === 'text' && textResponse && (
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  {textResponse.matchSummaryNote}
                </p>
              )}
            </div>

            {rawMatches.length > 0 && (
              <span className="font-label-md text-label-md text-primary font-semibold tabular-nums shrink-0">
                {filteredMatches.length}{' '}
                {filteredMatches.length === 1 ? 'Catalogue Saree' : 'Catalogue Sarees'}
              </span>
            )}
          </div>

          {/* Filter Refinement Bar (shown when there are catalogue items) */}
          {rawMatches.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              {(
                [
                  { id: 'all', label: `All (${rawMatches.length})` },
                  { id: 'under7k', label: 'Under ₹7,000' },
                  { id: 'silk', label: 'Silk Weaves' },
                  { id: 'southIndia', label: 'South India' },
                  { id: 'saved', label: `Saved (${savedIds.size})` },
                ] as const
              ).map((tab) => {
                const isSelected = clientFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setClientFilter(tab.id)}
                    className={`px-3.5 py-1.5 rounded-full font-label-md text-label-md shrink-0 min-h-[38px] transition-colors cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface-container-highest/80 text-on-surface hover:bg-surface-container-highest'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty Section A State vs Catalogue Product Cards */}
          {filteredMatches.length === 0 ? (
            <div className="rounded-2xl p-6 bg-surface-container-low border border-secondary/20 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-secondary-container/50 flex items-center justify-center text-secondary mb-2.5">
                <span className="material-symbols-outlined text-[24px]">
                  inventory_2
                </span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-1">
                {rawMatches.length === 0
                  ? 'No direct matches in the current Silkaree catalogue'
                  : 'No catalogue items match this filter'}
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
                {rawMatches.length === 0
                  ? 'This style is not currently represented in our 12-item in-memory catalogue. Browse external design inspiration below or request a custom weave.'
                  : 'Reset the quick filter above to view all matching catalogue sarees.'}
              </p>
              {clientFilter !== 'all' && rawMatches.length > 0 && (
                <button
                  type="button"
                  onClick={() => setClientFilter('all')}
                  className="mt-3 py-2 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md cursor-pointer"
                >
                  Show All {rawMatches.length} Catalogue Results
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMatches.map(({ saree, matchLabel, whyThisMatches }, index) => {
                const isSaved = savedIds.has(saree.id);
                const isTopResult = index === 0 && status === 'success' && textResponse?.matchQuality !== 'partial';
                const stockLabel = getAvailabilityBadgeText(saree);

                return (
                  <article
                    key={saree.id}
                    className="rounded-2xl bg-surface-container-lowest p-3.5 shadow-sm hover:shadow-md transition-shadow border border-secondary/20 flex flex-col justify-between gap-3"
                  >
                    <div className="flex flex-col gap-3">
                      <div
                        onClick={() => onSelectSaree(saree)}
                        className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-surface-container cursor-pointer group"
                      >
                        <SareeImage
                          src={saree.image}
                          alt={saree.name}
                          accentHex={saree.accentHex}
                          secondaryHex={saree.secondaryHex}
                          fallbackLabel={saree.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <span
                          className={`absolute top-3 left-3 px-2.5 py-1 rounded-md backdrop-blur-md font-label-sm text-label-sm font-bold shadow-sm tabular-nums ${
                            isTopResult
                              ? 'bg-primary/95 text-on-primary'
                              : 'bg-secondary/95 text-on-secondary'
                          }`}
                        >
                          {matchLabel}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSave(saree.id);
                          }}
                          aria-label={isSaved ? 'Remove bookmark' : 'Save saree'}
                          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-surface-container-lowest/85 backdrop-blur-md text-primary flex items-center justify-center shadow-sm cursor-pointer"
                        >
                          <span
                            className={`material-symbols-outlined text-[18px] ${
                              isSaved ? 'material-symbols-filled text-secondary' : ''
                            }`}
                          >
                            {isSaved ? 'bookmark' : 'bookmark_border'}
                          </span>
                        </button>

                        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/65 backdrop-blur-sm text-white font-label-sm text-label-sm">
                          {saree.region}
                        </div>
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                            {saree.name}
                          </h3>
                          <p className="font-body-sm text-body-sm text-on-surface-variant">
                            {saree.weaveSubtitle} · {saree.badge}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-headline-sm text-headline-sm font-bold text-primary tabular-nums">
                            ₹{saree.price.toLocaleString('en-IN')}
                          </span>
                          <p
                            className={`font-label-sm text-label-sm font-semibold ${
                              saree.inStock === true
                                ? 'text-primary'
                                : 'text-on-surface-variant'
                            }`}
                          >
                            {stockLabel}
                          </p>
                        </div>
                      </div>

                      {/* Data-Grounded Match Explanation */}
                      <div className="p-2.5 rounded-xl bg-surface-container-low flex items-start gap-2">
                        <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">
                          auto_awesome
                        </span>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          <strong className="text-primary font-semibold">
                            Why this matches:
                          </strong>{' '}
                          {whyThisMatches}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onSelectSaree(saree)}
                        className={`flex-1 py-2.5 rounded-xl font-label-md text-label-md font-semibold text-center transition-colors min-h-[44px] flex items-center justify-center gap-1.5 cursor-pointer ${
                          isTopResult
                            ? 'bg-primary hover:bg-tertiary text-on-primary shadow-sm'
                            : 'bg-surface-container-high hover:bg-secondary-container/45 text-primary'
                        }`}
                      >
                        <span>View Details &amp; Swatch</span>
                        <span className="material-symbols-outlined text-[18px]">
                          {isTopResult ? 'arrow_forward' : 'visibility'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleShare(saree)}
                        aria-label="Copy saree summary"
                        title="Copy saree details"
                        className="px-3 h-11 rounded-xl bg-surface-container-highest/60 hover:bg-surface-container-highest text-primary flex items-center justify-center gap-1 transition-colors shrink-0 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[19px]">
                          {copiedId === saree.id ? 'check' : 'share'}
                        </span>
                        {copiedId === saree.id && (
                          <span className="font-label-sm text-label-sm">Copied</span>
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Optional CTA to explore web inspiration even when strong catalogue matches exist */}
          {activeMode === 'text' &&
            status === 'success' &&
            textResponse?.matchQuality === 'strong' &&
            inspirationStatus === 'idle' && (
              <div className="p-4 rounded-2xl bg-surface-container-low border border-secondary/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
                <div>
                  <p className="font-label-lg text-label-lg text-on-surface font-semibold">
                    Looking for additional motif or weave variations beyond our catalogue?
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Use Gemma 4 to search external saree design references for custom-weave inspiration.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onLoadInspiration}
                  className="px-4 py-2.5 rounded-xl bg-surface-container-lowest hover:bg-secondary-container/40 text-primary border border-secondary/40 font-label-md text-label-md font-semibold shrink-0 cursor-pointer whitespace-nowrap min-h-[42px]"
                >
                  Discover External Designs
                </button>
              </div>
            )}
        </section>
      )}

      {/* ================================================================= */}
      {/* SECTION B: DISCOVER MORE DESIGNS (External Inspiration Search)    */}
      {/* ================================================================= */}
      {showSectionB && (
        <section
          className="pt-5 border-t border-secondary/25 flex flex-col gap-4"
          id="sectionDiscoverMoreDesigns"
        >
          {/* Required Section B Heading & Supporting Text */}
          <div className="space-y-1">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold block">
              Section B · External Design References
            </span>
            <h2 className="font-headline-md text-headline-md text-primary">
              Couldn&apos;t find your exact style? Discover more designs.
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
              Explore similar designs from across the web. Found something you love? Ask us about a custom weave.
            </p>
          </div>

          {/* Section B Loading State */}
          {inspirationStatus === 'loading' && (
            <div className="p-8 rounded-2xl bg-surface-container-low border border-secondary/20 flex flex-col items-center justify-center text-center">
              <div className="relative w-14 h-14 mb-3 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-secondary-container border-t-primary animate-spin" />
                <span className="material-symbols-outlined text-primary text-[22px]">
                  travel_explore
                </span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-primary mb-1">
                Finding External Saree Design References...
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
                Gemma 4 is formulating focused saree search terms and retrieving external design inspiration.
              </p>
            </div>
          )}

          {/* Section B Error State */}
          {inspirationStatus === 'error' && (
            <div className="p-5 rounded-2xl bg-error-container text-on-error-container flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-label-lg text-label-lg font-bold">
                  External Inspiration Search Unavailable
                </h3>
                <p className="font-body-sm text-body-sm mt-0.5">
                  {inspirationError ||
                    'Could not load external saree references right now.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onLoadInspiration}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-md text-label-md shrink-0 cursor-pointer min-h-[42px]"
              >
                Retry Inspiration Search
              </button>
            </div>
          )}

          {/* Section B Loaded Results */}
          {inspirationStatus === 'success' && inspirationResponse && (
            <div className="space-y-4">
              {/* Transparent Provider & Search Query Disclosure */}
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-secondary/25 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[18px]">
                      {inspirationResponse.provider.isLiveSearch ? 'public' : 'info'}
                    </span>
                    <span className="font-label-md text-label-md text-on-surface font-semibold">
                      Source: {inspirationResponse.provider.label}
                    </span>
                  </div>
                  <span className="font-body-sm text-xs text-on-surface-variant">
                    Search query used: <strong className="text-on-surface">“{inspirationResponse.searchQueryUsed}”</strong>
                  </span>
                </div>
                <p className="font-body-sm text-xs text-on-surface-variant">
                  {inspirationResponse.provider.notice}
                </p>

                {/* Gemma 4 Google Search Grounding Web Citations (when available) */}
                {inspirationResponse.groundingSources.length > 0 && (
                  <div className="pt-2 border-t border-outline-variant/35 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="font-label-sm text-[10px] uppercase tracking-wider text-secondary font-bold">
                      Gemma 4 Grounded Web References:
                    </span>
                    {inspirationResponse.groundingSources.map((src, idx) => (
                      <a
                        key={`${src.uri}-${idx}`}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-body-sm text-xs text-primary hover:underline"
                      >
                        <span>{src.title}</span>
                        <span className="material-symbols-outlined text-[13px]">
                          open_in_new
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Inspiration Empty vs Grid */}
              {inspirationResponse.results.length === 0 ? (
                <div className="p-6 rounded-2xl bg-surface-container-low text-center">
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    No external saree images were found for “{inspirationResponse.searchQueryUsed}”. Try refining your colour or weave description.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inspirationResponse.results.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl bg-surface-container-lowest p-3.5 shadow-sm border border-secondary/25 flex flex-col justify-between gap-3"
                    >
                      <div className="flex flex-col gap-2.5">
                        {/* Thumbnail with prominent non-catalogue classification */}
                        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-surface-container">
                          <SareeImage
                            src={item.thumbnailUrl || item.imageUrl || ''}
                            alt={item.title}
                            fallbackLabel={item.title}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-inverse-surface/90 text-secondary-fixed backdrop-blur-md font-label-sm text-label-sm font-bold shadow-sm">
                            Inspiration · {item.availabilityLabel}
                          </span>
                        </div>

                        {/* Title, Publisher & Source Link */}
                        <div className="space-y-1">
                          <h3 className="font-headline-sm text-base text-on-surface font-semibold line-clamp-2">
                            {item.title}
                          </h3>
                          <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-on-surface-variant">
                            <span className="truncate max-w-[65%]">
                              {item.sourcePublisher || 'External Web Publisher'}
                            </span>
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-primary font-semibold hover:underline shrink-0"
                            >
                              <span>Source Page</span>
                              <span className="material-symbols-outlined text-[14px]">
                                open_in_new
                              </span>
                            </a>
                          </div>
                        </div>

                        {/* Short Relevance Explanation */}
                        <p className="font-body-sm text-body-sm text-on-surface-variant bg-surface-container-low p-2.5 rounded-xl">
                          {item.relevanceExplanation}
                        </p>
                      </div>

                      {/* Request This Style Action (Not a purchase CTA) */}
                      <button
                        type="button"
                        onClick={() => onRequestInspirationStyle(item)}
                        className="w-full py-2.5 px-3.5 rounded-xl bg-surface-container-high hover:bg-primary hover:text-on-primary text-primary border border-secondary/35 font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          edit_note
                        </span>
                        <span>Request This Style</span>
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
