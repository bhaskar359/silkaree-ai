/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { CustomWeaveModal } from './components/CustomWeaveModal';
import { HomeScreen, type SelectedPhotoPayload } from './components/HomeScreen';
import { ProductDetailModal } from './components/ProductDetailModal';
import {
  type InspirationStatus,
  SearchResultsScreen,
  type SearchStatus,
} from './components/SearchResultsScreen';
import type {
  ExternalInspirationItem,
  HealthResponse,
  ImageSearchResponse,
  InspirationSearchResponse,
  SareeItem,
  TextSearchIntent,
  TextSearchResponse,
} from './types/saree';

type ScreenView = 'home' | 'results';
type ActiveSearchMode = 'image' | 'text' | 'catalogue' | 'saved';

type LastRequest =
  | { type: 'text'; query: string }
  | { type: 'image'; payload: SelectedPhotoPayload }
  | null;

export default function App() {
  const [screen, setScreen] = useState<ScreenView>('home');
  const [homeDockMode, setHomeDockMode] = useState<'nlp' | 'visual'>('nlp');
  const [catalogue, setCatalogue] = useState<SareeItem[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);

  const [searchStatus, setSearchStatus] = useState<SearchStatus>('browse');
  const [activeMode, setActiveMode] = useState<ActiveSearchMode>('catalogue');
  const [queryText, setQueryText] = useState('');
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [uploadedLabel, setUploadedLabel] = useState<string | null>(null);
  const [imageResponse, setImageResponse] = useState<ImageSearchResponse | null>(null);
  const [textResponse, setTextResponse] = useState<TextSearchResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // External Inspiration Search state (Section B)
  const [inspirationStatus, setInspirationStatus] = useState<InspirationStatus>('idle');
  const [inspirationResponse, setInspirationResponse] =
    useState<InspirationSearchResponse | null>(null);
  const [inspirationError, setInspirationError] = useState<string | null>(null);
  const [selectedInspirationItem, setSelectedInspirationItem] =
    useState<ExternalInspirationItem | null>(null);

  const [selectedSaree, setSelectedSaree] = useState<SareeItem | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(
    () => new Set(['kanchipuram-peacock-01'])
  );

  const lastRequestRef = useRef<LastRequest>(null);
  const activeRequestIdRef = useRef(0);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: HealthResponse | null) => {
        if (data) setHealth(data);
      })
      .catch(() => {});

    fetch('/api/catalogue')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { sarees?: SareeItem[] } | null) => {
        if (data?.sarees) setCatalogue(data.sarees);
      })
      .catch(() => {});
  }, []);

  const toggleSave = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const fetchInspiration = useCallback(
    async (query: string, intent?: TextSearchIntent, parentReqId?: number) => {
      const targetReqId = parentReqId ?? activeRequestIdRef.current;
      setInspirationStatus('loading');
      setInspirationError(null);

      try {
        const res = await fetch('/api/search/inspiration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, intent }),
        });

        const body = await res.json().catch(() => ({}));
        if (targetReqId !== activeRequestIdRef.current) return;

        if (!res.ok) {
          throw new Error(
            body?.error || `Inspiration search failed with status ${res.status}.`
          );
        }

        setInspirationResponse(body as InspirationSearchResponse);
        setInspirationStatus('success');
      } catch (err: unknown) {
        if (targetReqId !== activeRequestIdRef.current) return;
        setInspirationError(
          err instanceof Error
            ? err.message
            : 'Failed to retrieve external saree inspiration.'
        );
        setInspirationStatus('error');
      }
    },
    []
  );

  const runTextSearch = useCallback(
    async (query: string) => {
      const reqId = ++activeRequestIdRef.current;
      lastRequestRef.current = { type: 'text', query };

      // Reset previous search and inspiration state cleanly
      setScreen('results');
      setActiveMode('text');
      setSearchStatus('loading');
      setQueryText(query);
      setUploadedPreviewUrl(null);
      setUploadedLabel(null);
      setImageResponse(null);
      setTextResponse(null);
      setErrorMessage(null);
      setInspirationStatus('idle');
      setInspirationResponse(null);
      setInspirationError(null);
      setSelectedInspirationItem(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      try {
        const res = await fetch('/api/search/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });

        const body = await res.json().catch(() => ({}));
        if (reqId !== activeRequestIdRef.current) return;

        if (!res.ok) {
          throw new Error(body?.error || `Search failed with status ${res.status}.`);
        }

        const typedBody = body as TextSearchResponse;
        setTextResponse(typedBody);
        setSearchStatus('success');

        // Automatically trigger Section B (External Saree Inspiration) when catalogue has no or partial matches
        if (typedBody.matchQuality !== 'strong') {
          void fetchInspiration(query, typedBody.intent, reqId);
        }
      } catch (err: unknown) {
        if (reqId !== activeRequestIdRef.current) return;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Failed to reach the Gemma 4 text search service.'
        );
        setSearchStatus('error');
      }
    },
    [fetchInspiration]
  );

  const runImageSearch = useCallback(async (payload: SelectedPhotoPayload) => {
    const reqId = ++activeRequestIdRef.current;
    lastRequestRef.current = { type: 'image', payload };

    setScreen('results');
    setActiveMode('image');
    setSearchStatus('loading');
    setQueryText('');
    setUploadedPreviewUrl(payload.previewUrl);
    setUploadedLabel(payload.label);
    setImageResponse(null);
    setTextResponse(null);
    setErrorMessage(null);
    setInspirationStatus('idle');
    setInspirationResponse(null);
    setInspirationError(null);
    setSelectedInspirationItem(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const formData = new FormData();
      if (payload.file) {
        formData.append('image', payload.file);
      } else if (payload.sampleId) {
        formData.append('sampleId', payload.sampleId);
      }

      const res = await fetch('/api/search/image', {
        method: 'POST',
        body: formData,
      });

      const body = await res.json().catch(() => ({}));
      if (reqId !== activeRequestIdRef.current) return;

      if (!res.ok) {
        throw new Error(
          body?.error || `Image analysis failed with status ${res.status}.`
        );
      }

      setImageResponse(body as ImageSearchResponse);
      setSearchStatus('success');
    } catch (err: unknown) {
      if (reqId !== activeRequestIdRef.current) return;
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to reach the Gemma 4 visual analysis service.'
      );
      setSearchStatus('error');
    }
  }, []);

  const handleManualInspirationLoad = useCallback(() => {
    if (!queryText.trim()) return;
    void fetchInspiration(queryText, textResponse?.intent);
  }, [fetchInspiration, queryText, textResponse]);

  const handleRetry = useCallback(() => {
    const last = lastRequestRef.current;
    if (!last) {
      setScreen('home');
      return;
    }
    if (last.type === 'text') {
      void runTextSearch(last.query);
    } else {
      void runImageSearch(last.payload);
    }
  }, [runImageSearch, runTextSearch]);

  const handleResetToHome = useCallback((dockMode: 'nlp' | 'visual' = 'nlp') => {
    activeRequestIdRef.current++;
    setHomeDockMode(dockMode);
    setScreen('home');
    setErrorMessage(null);
    setSelectedInspirationItem(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openCatalogueView = useCallback((mode: 'catalogue' | 'saved') => {
    activeRequestIdRef.current++;
    setScreen('results');
    setActiveMode(mode);
    setSearchStatus('browse');
    setErrorMessage(null);
    setInspirationStatus('idle');
    setInspirationResponse(null);
    setSelectedInspirationItem(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const navActiveTab =
    screen === 'home'
      ? 'home'
      : activeMode === 'catalogue'
        ? 'catalog'
        : activeMode === 'saved'
          ? 'saved'
          : 'ai-search';

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface flex flex-col min-h-screen">
      {/* Stitch Top Glassmorphic Header */}
      <header className="fixed top-0 w-full z-40 pt-safe bg-surface-container-low/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.05)] border-b border-secondary/15">
        <div className="max-w-5xl mx-auto h-16 sm:h-20 px-4 sm:px-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => handleResetToHome('nlp')}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-primary text-secondary-fixed flex items-center justify-center shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[20px]">filter_vintage</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-headline-sm text-headline-sm text-primary tracking-tight truncate">
                Silkaree AI
              </span>
              <span className="font-label-sm text-label-sm text-secondary truncate">
                {screen === 'home' ? 'Heritage Saree Discovery' : 'AI Visual & Text Search'}
              </span>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-6 font-label-lg text-label-lg text-on-surface-variant">
            <button
              type="button"
              onClick={() => handleResetToHome('nlp')}
              className={`hover:text-primary transition-colors cursor-pointer whitespace-nowrap ${
                navActiveTab === 'home' ? 'text-primary font-bold' : ''
              }`}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => handleResetToHome('visual')}
              className={`hover:text-primary transition-colors cursor-pointer whitespace-nowrap ${
                navActiveTab === 'ai-search' ? 'text-primary font-bold' : ''
              }`}
            >
              Visual Search
            </button>
            <button
              type="button"
              onClick={() => openCatalogueView('catalogue')}
              className={`hover:text-primary transition-colors cursor-pointer whitespace-nowrap ${
                navActiveTab === 'catalog' ? 'text-primary font-bold' : ''
              }`}
            >
              Catalogue ({catalogue.length})
            </button>
            <button
              type="button"
              onClick={() => openCatalogueView('saved')}
              className={`hover:text-primary transition-colors cursor-pointer whitespace-nowrap ${
                navActiveTab === 'saved' ? 'text-primary font-bold' : ''
              }`}
            >
              Saved ({savedIds.size})
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleResetToHome('visual')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-primary hover:bg-tertiary text-on-primary transition-colors min-h-[40px] shadow-sm cursor-pointer whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[18px] text-secondary-fixed">
                photo_camera
              </span>
              <span className="font-label-md text-label-md">Photo Match</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full pt-20 sm:pt-24 pb-20 md:pb-8">
        {screen === 'home' ? (
          <HomeScreen
            key={homeDockMode}
            catalogue={catalogue}
            health={health}
            savedIds={savedIds}
            initialDockMode={homeDockMode}
            onSubmitTextSearch={runTextSearch}
            onSubmitImageSearch={runImageSearch}
            onSelectSaree={setSelectedSaree}
            onToggleSave={toggleSave}
            onViewAllCatalogue={() => openCatalogueView('catalogue')}
          />
        ) : (
          <SearchResultsScreen
            status={searchStatus}
            activeMode={activeMode}
            queryText={queryText}
            uploadedPreviewUrl={uploadedPreviewUrl}
            uploadedLabel={uploadedLabel}
            imageResponse={imageResponse}
            textResponse={textResponse}
            inspirationStatus={inspirationStatus}
            inspirationResponse={inspirationResponse}
            inspirationError={inspirationError}
            browseSarees={catalogue}
            errorMessage={errorMessage}
            savedIds={savedIds}
            onResetToHome={() => handleResetToHome('nlp')}
            onRetry={handleRetry}
            onLoadInspiration={handleManualInspirationLoad}
            onRequestInspirationStyle={setSelectedInspirationItem}
            onNewTextSearch={runTextSearch}
            onNewImageSearch={runImageSearch}
            onSelectSaree={setSelectedSaree}
            onToggleSave={toggleSave}
          />
        )}
      </main>

      {/* Catalogue Product Detail Modal */}
      <ProductDetailModal
        saree={selectedSaree}
        isSaved={selectedSaree ? savedIds.has(selectedSaree.id) : false}
        onToggleSave={toggleSave}
        onClose={() => setSelectedSaree(null)}
        onFindSimilarStyle={(saree) =>
          runTextSearch(
            `${saree.colour} ${saree.fabric} saree with ${saree.patterns.slice(0, 2).join(' ')} for ${saree.occasion}`
          )
        }
      />

      {/* Custom-Weaving Enquiry Modal (for External Inspiration items) */}
      <CustomWeaveModal
        item={selectedInspirationItem}
        originalQuery={queryText}
        inspirationIntent={inspirationResponse?.inspirationIntent || null}
        onClose={() => setSelectedInspirationItem(null)}
      />

      {/* Stitch Mobile Bottom Tab Navigation */}
      <nav
        aria-label="Primary Bottom Navigation"
        className="md:hidden fixed bottom-0 w-full z-40 pb-safe bg-surface-container-low/95 backdrop-blur-xl shadow-[0_-2px_12px_rgba(16,47,48,0.06)] border-t border-secondary/15"
      >
        <div className="flex justify-around items-center h-16 px-2">
          <button
            type="button"
            onClick={() => handleResetToHome('nlp')}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] transition-colors cursor-pointer ${
              navActiveTab === 'home'
                ? 'text-primary font-bold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">home</span>
            <span className="font-label-md text-label-md">Home</span>
          </button>

          <button
            type="button"
            onClick={() => handleResetToHome('visual')}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] transition-colors cursor-pointer ${
              navActiveTab === 'ai-search'
                ? 'text-primary font-bold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">photo_camera</span>
            <span className="font-label-md text-label-md">AI Search</span>
          </button>

          <button
            type="button"
            onClick={() => openCatalogueView('catalogue')}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] transition-colors cursor-pointer ${
              navActiveTab === 'catalog'
                ? 'text-primary font-bold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">grid_view</span>
            <span className="font-label-md text-label-md">Catalog</span>
          </button>

          <button
            type="button"
            onClick={() => openCatalogueView('saved')}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] transition-colors cursor-pointer ${
              navActiveTab === 'saved'
                ? 'text-primary font-bold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">bookmark</span>
            <span className="font-label-md text-label-md">Saved</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
