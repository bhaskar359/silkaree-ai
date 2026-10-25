import { type ChangeEvent, type DragEvent, type FormEvent, useRef, useState } from 'react';
import type { HealthResponse, SareeItem } from '../types/saree';
import { SareeImage } from './SareeImage';

export interface SelectedPhotoPayload {
  file?: File;
  sampleId?: string;
  previewUrl: string;
  label: string;
}

interface HomeScreenProps {
  catalogue: SareeItem[];
  health: HealthResponse | null;
  savedIds: Set<string>;
  initialDockMode?: 'nlp' | 'visual';
  onSubmitTextSearch: (query: string) => void;
  onSubmitImageSearch: (payload: SelectedPhotoPayload) => void;
  onSelectSaree: (saree: SareeItem) => void;
  onToggleSave: (id: string) => void;
  onViewAllCatalogue: () => void;
}

const SAMPLE_SWATCHES = [
  {
    sampleId: 'sample-kanchipuram',
    label: 'Sample 1: Kanchipuram',
    subtitle: 'Peacock Temple Silk',
    previewUrl: '/assets/aistudio/Image_1_73f1d31a.jpeg',
  },
  {
    sampleId: 'sample-uppada',
    label: 'Sample 2: Uppada',
    subtitle: 'Magenta Jamdani',
    previewUrl: '/assets/aistudio/Image_2_dcd70d8a.jpeg',
  },
  {
    sampleId: 'sample-pochampally',
    label: 'Sample 3: Pochampally',
    subtitle: 'Crimson Double Ikat',
    previewUrl: '/assets/aistudio/Image_3_2b2a0e43.jpeg',
  },
  {
    sampleId: 'sample-mangalagiri',
    label: 'Sample 4: Mangalagiri',
    subtitle: 'Mustard Nizam Zari',
    previewUrl: '/assets/aistudio/Image_4_11f94a90.jpeg',
  },
];

const WEAVE_HIGHLIGHTS = [
  {
    title: 'Mangalagiri',
    tag: 'Andhra',
    desc: 'Crisp Nizam gold borders & fine cotton-silk.',
    meta: '80+ Warp Count',
    image: '/assets/aistudio/Image_4_11f94a90.jpeg',
    query: 'Mangalagiri cotton silk saree with gold border',
  },
  {
    title: 'Uppada Silk',
    tag: 'Jamdani',
    desc: 'Featherlight weave with floral zari buttas.',
    meta: 'Authentic GI Tag',
    image: '/assets/aistudio/Image_2_dcd70d8a.jpeg',
    query: 'Uppada Jamdani floral silk saree for festive wedding',
  },
  {
    title: 'Kanchipuram',
    tag: 'Tamil Nadu',
    desc: 'Heavy mulberry silk adorned with gold zari gopurams.',
    meta: 'Korvai Interlock',
    image: '/assets/aistudio/Image_1_73f1d31a.jpeg',
    query: 'Peacock green Kanchipuram temple border silk saree for wedding',
  },
  {
    title: 'Pochampally',
    tag: 'Telangana',
    desc: 'Double Ikat precision geometry tied & hand-dyed.',
    meta: 'Pagdu Bandhu',
    image: '/assets/aistudio/Image_3_2b2a0e43.jpeg',
    query: 'Pochampally double ikat geometric silk saree under ₹7,000',
  },
  {
    title: 'Banarasi Katan',
    tag: 'Varanasi',
    desc: 'Bridal red silk with intricate Kadwa floral jaal.',
    meta: 'Kadwa Brocade',
    image: '/assets/weaves/banarasi-sindoor.svg',
    query: 'Red Banarasi silk saree for bridal wedding',
  },
  {
    title: 'Chanderi Pattu',
    tag: 'Madhya Pradesh',
    desc: 'Gossamer ivory silk-cotton with ashrafi coin buttis.',
    meta: 'Daytime Drape',
    image: '/assets/weaves/chanderi-ivory.svg',
    query: 'Ivory Chanderi silk cotton saree under ₹6,000 for daytime wedding',
  },
];

const QUICK_CURATIONS = [
  {
    label: 'Traditional silk under ₹7,000',
    query: 'I want a traditional silk saree for a wedding under ₹7,000.',
  },
  {
    label: 'Dark Green Uppada Gold Motifs',
    query: 'Dark green Uppada silk saree with intricate gold motifs',
  },
  {
    label: 'Purple Paithani Peacock Pallu',
    query: 'Purple Paithani silk saree with peacock pallu for wedding',
  },
  {
    label: 'Andhra Pradesh Weaves',
    query: 'Traditional handloom sarees from Andhra Pradesh',
  },
];

export function HomeScreen({
  catalogue,
  health,
  savedIds,
  initialDockMode = 'nlp',
  onSubmitTextSearch,
  onSubmitImageSearch,
  onSelectSaree,
  onToggleSave,
  onViewAllCatalogue,
}: HomeScreenProps) {
  const [searchMode, setSearchMode] = useState<'nlp' | 'visual'>(initialDockMode);
  const [queryText, setQueryText] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedPhotoPayload | null>(null);
  const [uploadValidationError, setUploadValidationError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleTextFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = queryText.trim();
    if (!trimmed) return;
    onSubmitTextSearch(trimmed);
  };

  const handleFileChosen = (file: File) => {
    setUploadValidationError(null);
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadValidationError('Please select a JPEG, PNG, or WebP saree photograph.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadValidationError('Image must be 8 MB or smaller.');
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setSelectedPhoto({
      file,
      previewUrl,
      label: `${file.name} (${(file.size / 1024).toFixed(0)} KB)`,
    });
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileChosen(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileChosen(file);
    }
  };

  const handleSampleClick = (swatch: (typeof SAMPLE_SWATCHES)[number]) => {
    setUploadValidationError(null);
    setSelectedPhoto({
      sampleId: swatch.sampleId,
      previewUrl: swatch.previewUrl,
      label: `${swatch.label} — ${swatch.subtitle}`,
    });
  };

  const handleAnalyzeClick = () => {
    if (!selectedPhoto) {
      setUploadValidationError('Select or drop a saree photograph (or tap a sample swatch below) first.');
      return;
    }
    onSubmitImageSearch(selectedPhoto);
  };

  const featuredSarees = catalogue.slice(0, 8);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-2 pb-10 space-y-6">
      {/* Architecture & Engine Readiness Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container/40 text-on-secondary-fixed-variant shadow-sm">
          <span className="material-symbols-outlined text-[15px] text-secondary">memory</span>
          <span className="font-label-sm text-label-sm uppercase tracking-wider font-bold">
            Gemma 4 • Gemini API Multimodal Discovery
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-secondary font-label-md text-label-md">
          <span className="material-symbols-outlined text-[16px] text-primary">
            {health?.apiKeyConfigured === false ? 'warning' : 'check_circle'}
          </span>
          <span>
            {health
              ? health.apiKeyConfigured
                ? `Model: ${health.model}`
                : 'API Key Missing in .env'
              : 'Connecting to backend...'}
          </span>
        </div>
      </div>

      {/* Hero + Search Dock Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Editorial Hero Showcase */}
        <div className="lg:col-span-6 relative rounded-2xl overflow-hidden shadow-lg bg-surface-container-low min-h-[270px] sm:min-h-[320px]">
          <SareeImage
            src="/assets/aistudio/Image_1_73f1d31a.jpeg"
            alt="Kanchipuram Emerald Saree with Gold Temple Border"
            className="w-full h-full object-cover absolute inset-0"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/90 via-inverse-surface/45 to-black/10" />
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-surface-container-lowest/85 backdrop-blur-md flex items-center gap-1.5 shadow-sm">
            <span className="material-symbols-outlined text-[16px] text-primary">
              auto_fix_high
            </span>
            <span className="font-label-sm text-label-sm text-primary font-semibold">
              {catalogue.length} Curated GI Looms
            </span>
          </div>
          <div className="absolute bottom-0 inset-x-0 p-5 sm:p-6 text-inverse-on-surface">
            <span className="font-label-md text-label-md text-secondary-fixed-dim uppercase tracking-widest block mb-1">
              Handloom Heritage
            </span>
            <h1 className="font-headline-lg-mobile sm:text-headline-lg text-headline-lg-mobile font-semibold tracking-tight leading-tight text-surface-bright mb-2 text-balance">
              Every Saree Has a Story. Find Yours.
            </h1>
            <p className="font-body-sm text-body-sm text-surface-container-highest/95 max-w-md leading-relaxed">
              Upload any saree photograph to inspect colours, borders, and motifs with Gemma 4, or describe your occasion and budget in plain language.
            </p>
          </div>
        </div>

        {/* Dual AI Search Experience Dock */}
        <div className="lg:col-span-6 relative rounded-2xl p-4 sm:p-5 bg-surface-container-lowest/95 backdrop-blur-xl shadow-md border border-secondary/20 flex flex-col justify-between">
          <div>
            {/* Mode Toggle Switch */}
            <div className="flex p-1 rounded-xl bg-surface-container mb-4">
              <button
                type="button"
                onClick={() => setSearchMode('nlp')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-label-lg text-label-lg transition-all duration-150 cursor-pointer whitespace-nowrap ${
                  searchMode === 'nlp'
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  chat_bubble_outline
                </span>
                <span>Describe Saree</span>
              </button>
              <button
                type="button"
                onClick={() => setSearchMode('visual')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-label-lg text-label-lg transition-all duration-150 cursor-pointer whitespace-nowrap ${
                  searchMode === 'visual'
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  center_focus_strong
                </span>
                <span>Find Similar (Photo)</span>
              </button>
            </div>

            {/* Mode 1: Natural Language AI Search */}
            {searchMode === 'nlp' ? (
              <div className="space-y-4">
                <form onSubmit={handleTextFormSubmit} className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-3.5 text-secondary text-[20px]">
                    auto_awesome
                  </span>
                  <input
                    type="text"
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                    placeholder="e.g. Traditional silk saree for a wedding under ₹7,000..."
                    aria-label="Describe the saree you are looking for"
                    className="w-full h-12 pl-11 pr-24 rounded-xl bg-surface text-on-surface placeholder:text-on-surface-variant/60 font-body-md text-body-md border border-secondary/30 focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!queryText.trim()}
                    className="absolute right-1.5 top-1.5 h-9 px-3.5 rounded-lg bg-primary hover:bg-tertiary disabled:opacity-50 text-on-primary font-label-md text-label-md flex items-center gap-1 transition-colors shadow cursor-pointer"
                  >
                    <span>Ask</span>
                    <span className="material-symbols-outlined text-[16px]">
                      arrow_forward
                    </span>
                  </button>
                </form>

                {/* Quick AI Prompt Curations */}
                <div className="pt-1">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="material-symbols-outlined text-[14px] text-secondary">
                      flare
                    </span>
                    <span className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
                      Popular Curations (Live Gemma 4 Search)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_CURATIONS.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          setQueryText(item.query);
                          onSubmitTextSearch(item.query);
                        }}
                        className="px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant hover:text-primary hover:bg-secondary-container/40 font-label-md text-label-md transition-all text-left cursor-pointer"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Mode 2: Visual Multimodal Saree Upload & Preview */
              <div className="space-y-3.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleInputChange}
                  className="hidden"
                />

                {!selectedPhoto ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    className={`p-5 rounded-xl border-2 border-dashed text-center flex flex-col items-center justify-center cursor-pointer transition-colors ${
                      isDragging
                        ? 'border-primary bg-primary/10'
                        : 'border-secondary/40 bg-surface-container-low hover:bg-surface-container'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-full bg-secondary-container/60 flex items-center justify-center text-secondary mb-2">
                      <span className="material-symbols-outlined text-[24px]">
                        add_a_photo
                      </span>
                    </div>
                    <p className="font-label-lg text-label-lg text-primary font-semibold">
                      Drop your saree photo here or click to browse
                    </p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                      JPEG, PNG, or WebP up to 8 MB • Analyzed in-memory by Gemma 4
                    </p>
                  </div>
                ) : (
                  /* Selected Image Preview Card before/for submission */
                  <div className="p-3 rounded-xl bg-surface-container-low border border-secondary/40 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-surface-container shrink-0 shadow-sm">
                        <img
                          src={selectedPhoto.previewUrl}
                          alt="Selected saree preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold block">
                          Ready for Visual Analysis
                        </span>
                        <p className="font-label-md text-label-md text-on-surface truncate">
                          {selectedPhoto.label}
                        </p>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="font-body-sm text-xs text-primary underline hover:opacity-80 mt-0.5 cursor-pointer"
                        >
                          Choose different file
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPhoto(null)}
                      aria-label="Clear selected image"
                      className="w-9 h-9 rounded-full bg-surface-container-lowest text-on-surface-variant hover:text-error flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                )}

                {uploadValidationError && (
                  <p className="font-body-sm text-body-sm text-error bg-error-container/60 px-3 py-2 rounded-lg">
                    {uploadValidationError}
                  </p>
                )}

                {/* Quick Sample Swatches for Instant Real Gemma 4 Evaluation */}
                <div>
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary block mb-1.5 font-bold">
                    Or Tap a Sample Photo to Inspect with Gemma 4:
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {SAMPLE_SWATCHES.map((sw) => {
                      const active = selectedPhoto?.sampleId === sw.sampleId;
                      return (
                        <button
                          key={sw.sampleId}
                          type="button"
                          onClick={() => handleSampleClick(sw)}
                          className={`p-1.5 rounded-xl flex flex-col items-center gap-1 transition-all text-center cursor-pointer border ${
                            active
                              ? 'bg-secondary-container/40 border-primary shadow-sm'
                              : 'bg-surface border-transparent hover:bg-surface-container-high shadow-sm'
                          }`}
                        >
                          <img
                            src={sw.previewUrl}
                            alt={sw.label}
                            className="w-11 h-11 rounded-lg object-cover"
                          />
                          <span className="font-label-sm text-[10px] font-semibold text-on-surface leading-tight line-clamp-1">
                            {sw.label.replace('Sample ', '#')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAnalyzeClick}
                  className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-tertiary text-on-primary font-label-lg text-label-lg font-semibold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer min-h-[46px]"
                >
                  <span className="material-symbols-outlined text-[20px]">psychology</span>
                  <span>Analyze Saree Photo with Gemma 4</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Explore Indian Weaves (Carousel Style) */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">
              texture
            </span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              Explore Indian Weaves
            </h2>
          </div>
          <button
            type="button"
            onClick={onViewAllCatalogue}
            className="font-label-md text-label-md text-primary font-semibold hover:underline cursor-pointer"
          >
            View All ({catalogue.length})
          </button>
        </div>

        <div className="flex gap-3.5 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none snap-x">
          {WEAVE_HIGHLIGHTS.map((weave) => (
            <button
              key={weave.title}
              type="button"
              onClick={() => onSubmitTextSearch(weave.query)}
              className="snap-start shrink-0 w-44 sm:w-48 rounded-xl overflow-hidden bg-surface-container hover:bg-surface-container-high shadow-sm flex flex-col text-left transition-all cursor-pointer group"
            >
              <div className="h-28 w-full relative overflow-hidden">
                <SareeImage
                  src={weave.image}
                  alt={weave.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-surface/90 text-primary font-label-sm text-label-sm font-bold">
                  {weave.tag}
                </span>
              </div>
              <div className="p-2.5 flex flex-col justify-between flex-1">
                <div>
                  <p className="font-label-lg text-label-lg text-on-surface font-semibold">
                    {weave.title}
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mt-0.5">
                    {weave.desc}
                  </p>
                </div>
                <span className="text-secondary font-label-sm text-label-sm mt-2 font-medium">
                  {weave.meta} →
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Discover Popular Sarees Curated Grid */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              Discover Curated Handlooms
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Sample regional saree catalogue grounded with authentic weave metadata
            </p>
          </div>
          <span className="font-label-md text-label-md text-primary font-semibold shrink-0 tabular-nums">
            {catalogue.length} In Catalogue
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
          {featuredSarees.map((saree) => {
            const isSaved = savedIds.has(saree.id);
            return (
              <article
                key={saree.id}
                className="flex flex-col rounded-2xl overflow-hidden bg-surface-container-low shadow-sm hover:shadow-md transition-shadow border border-secondary/15"
              >
                <div
                  onClick={() => onSelectSaree(saree)}
                  className="relative h-44 sm:h-48 w-full cursor-pointer group overflow-hidden"
                >
                  <SareeImage
                    src={saree.image}
                    alt={saree.name}
                    accentHex={saree.accentHex}
                    secondaryHex={saree.secondaryHex}
                    fallbackLabel={saree.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-surface-container-lowest/90 font-label-sm text-label-sm text-primary font-bold">
                    {saree.state}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSave(saree.id);
                    }}
                    aria-label={isSaved ? 'Remove bookmark' : 'Bookmark saree'}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-surface-container-lowest/85 backdrop-blur-md flex items-center justify-center text-on-surface hover:text-primary cursor-pointer"
                  >
                    <span
                      className={`material-symbols-outlined text-[17px] ${
                        isSaved ? 'material-symbols-filled text-secondary' : ''
                      }`}
                    >
                      {isSaved ? 'bookmark' : 'bookmark_border'}
                    </span>
                  </button>
                </div>

                <div className="p-3 flex flex-col justify-between flex-1 space-y-2">
                  <div
                    onClick={() => onSelectSaree(saree)}
                    className="cursor-pointer"
                  >
                    <h3 className="font-headline-sm text-on-surface font-semibold text-base leading-snug line-clamp-1">
                      {saree.name}
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 line-clamp-1">
                      {saree.fabric} · {saree.occasion}
                    </p>
                  </div>
                  <div className="pt-1">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="font-headline-sm text-lg text-primary font-bold tabular-nums">
                        ₹{saree.price.toLocaleString('en-IN')}
                      </span>
                      <span className="font-label-sm text-[10px] text-secondary">
                        {saree.inStock === true ? 'In stock' : 'Availability unverified'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onSubmitTextSearch(
                          `Sarees similar to ${saree.colour} ${saree.fabric} for ${saree.occasion}`
                        )
                      }
                      className="w-full mt-2 py-2 px-2.5 rounded-xl bg-surface-container-highest/70 hover:bg-secondary-container/45 text-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px] text-secondary">
                        auto_awesome
                      </span>
                      <span>Find Similar</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Heritage Wedding Curation Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-primary to-tertiary text-on-primary shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-fixed-dim/30 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary-fixed text-[24px]">
              view_stream
            </span>
          </div>
          <div>
            <p className="font-label-lg text-label-lg font-bold">
              Curating for a Wedding or Muhurtham?
            </p>
            <p className="font-body-sm text-body-sm text-on-primary/85">
              Compare pure Kanchipuram, Banarasi, Narayanpet, and Gadwal silks across every budget.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            onSubmitTextSearch(
              'Show bridal and wedding silk sarees with gold zari temple or floral borders'
            )
          }
          className="px-4 py-2.5 rounded-xl bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md font-bold shrink-0 hover:bg-secondary-container transition-all cursor-pointer whitespace-nowrap"
        >
          Explore Bridal Silks
        </button>
      </div>
    </div>
  );
}
