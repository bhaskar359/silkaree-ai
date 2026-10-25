import { type FormEvent, useEffect, useState } from 'react';
import type { ExternalInspirationItem, InspirationSearchIntent } from '../types/saree';
import { SareeImage } from './SareeImage';

interface CustomWeaveModalProps {
  item: ExternalInspirationItem | null;
  originalQuery: string;
  inspirationIntent: InspirationSearchIntent | null;
  onClose: () => void;
}

export function CustomWeaveModal({
  item,
  originalQuery,
  inspirationIntent,
  onClose,
}: CustomWeaveModalProps) {
  const [styleDescription, setStyleDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [preparedSummary, setPreparedSummary] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!item) return;

    const parts: string[] = [];
    if (originalQuery.trim()) {
      parts.push(`Looking for a custom weave inspired by my search for "${originalQuery.trim()}".`);
    }
    const intentDetails = [
      inspirationIntent?.sareeTypeOrWeave ? `Weave style: ${inspirationIntent.sareeTypeOrWeave}` : null,
      inspirationIntent?.colour ? `Colour palette: ${inspirationIntent.colour}` : null,
      inspirationIntent?.fabric ? `Preferred fabric: ${inspirationIntent.fabric}` : null,
      inspirationIntent?.visiblePatternsAndMotifs?.length
        ? `Motifs/border details: ${inspirationIntent.visiblePatternsAndMotifs.join(', ')}`
        : null,
      inspirationIntent?.occasion ? `Occasion: ${inspirationIntent.occasion}` : null,
    ].filter(Boolean);

    if (intentDetails.length > 0) {
      parts.push(intentDetails.join(' · ') + '.');
    }

    setStyleDescription(
      parts.join(' ') || `Interested in exploring a custom-woven saree inspired by "${item.title}".`
    );
    setBudget('');
    setPreparedSummary(null);
    setCopied(false);
  }, [item, originalQuery, inspirationIntent]);

  if (!item) return null;

  const handlePrepareEnquiry = (e: FormEvent) => {
    e.preventDefault();
    const cleanedDesc = styleDescription.trim() || `Style inspired by "${item.title}"`;
    const cleanedBudget = budget.trim();

    const lines = [
      'Silkaree Custom-Weaving Enquiry Draft',
      `Requested Design: ${cleanedDesc}`,
      cleanedBudget ? `Target Budget: ${cleanedBudget}` : 'Target Budget: Open / Flexible',
      `Visual Inspiration Reference: ${item.title}`,
      `Original Source URL: ${item.sourceUrl}`,
      'Note: Reference image is external inspiration (not an in-stock Silkaree product).',
    ];

    setPreparedSummary(lines.join('\n'));
    setCopied(false);
  };

  const handleCopySummary = () => {
    if (!preparedSummary) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(preparedSummary).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-weave-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl border border-secondary/25"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-20 bg-surface-container-lowest/95 backdrop-blur-md px-5 py-3.5 flex items-center justify-between border-b border-outline-variant/30">
          <div>
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold block">
              Custom-Weaving Enquiry
            </span>
            <h2
              id="custom-weave-modal-title"
              className="font-headline-sm text-headline-sm text-primary"
            >
              Request a Custom Weave Style
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close custom weave modal"
            className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Inspiration Reference Preview & Source Attribution */}
          <div className="p-3 rounded-2xl bg-surface-container-low border border-secondary/20 flex items-start gap-3.5">
            <div className="w-24 h-24 rounded-xl overflow-hidden bg-surface-container shrink-0">
              <SareeImage
                src={item.thumbnailUrl || item.imageUrl || ''}
                alt={item.title}
                fallbackLabel="External Inspiration"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <span className="inline-block font-label-sm text-[10px] uppercase tracking-wider text-secondary font-bold">
                Inspiration · {item.availabilityLabel}
              </span>
              <p className="font-label-lg text-label-lg text-on-surface font-semibold line-clamp-2">
                {item.title}
              </p>
              {item.sourcePublisher && (
                <p className="font-body-sm text-xs text-on-surface-variant truncate">
                  Source: {item.sourcePublisher}
                </p>
              )}
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-label-md text-xs text-primary hover:underline pt-0.5"
              >
                <span>View original source page</span>
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>
            </div>
          </div>

          {/* Enquiry Form */}
          <form onSubmit={handlePrepareEnquiry} className="space-y-3.5">
            <div>
              <label
                htmlFor="custom-style-description"
                className="block font-label-md text-label-md text-on-surface mb-1"
              >
                Describe Your Desired Saree Style
              </label>
              <textarea
                id="custom-style-description"
                rows={4}
                value={styleDescription}
                onChange={(e) => setStyleDescription(e.target.value)}
                required
                className="w-full p-3 rounded-xl bg-surface text-on-surface font-body-sm text-body-sm border border-secondary/35 focus:outline-none focus:border-primary focus:bg-surface-container-lowest"
                placeholder="Describe preferred colours, fabric, motifs, border details, or occasion..."
              />
            </div>

            <div>
              <label
                htmlFor="custom-style-budget"
                className="block font-label-md text-label-md text-on-surface mb-1"
              >
                Approximate Budget <span className="text-on-surface-variant font-normal">(Optional)</span>
              </label>
              <input
                id="custom-style-budget"
                type="text"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. ₹8,000 – ₹12,000"
                className="w-full h-11 px-3.5 rounded-xl bg-surface text-on-surface font-body-sm text-body-sm border border-secondary/35 focus:outline-none focus:border-primary focus:bg-surface-container-lowest"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 py-3 px-4 rounded-xl bg-primary hover:bg-tertiary text-on-primary font-label-lg text-label-lg font-semibold shadow-sm transition-colors cursor-pointer min-h-[44px]"
              >
                Prepare Enquiry
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-4 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md transition-colors cursor-pointer min-h-[44px]"
              >
                Close
              </button>
            </div>
          </form>

          {/* Prepared Confirmation Summary */}
          {preparedSummary && (
            <div className="p-4 rounded-2xl bg-tertiary text-on-tertiary space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-secondary-fixed">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span className="font-label-md text-label-md font-bold uppercase tracking-wider">
                    Enquiry Summary Prepared
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="px-2.5 py-1 rounded-lg bg-surface-container-low/15 hover:bg-surface-container-low/25 text-on-tertiary font-label-sm text-label-sm flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copied ? 'check' : 'content_copy'}
                  </span>
                  <span>{copied ? 'Copied' : 'Copy Text'}</span>
                </button>
              </div>

              <pre className="whitespace-pre-wrap font-body-sm text-xs text-on-tertiary/95 bg-black/20 p-3 rounded-xl leading-relaxed">
                {preparedSummary}
              </pre>

              <p className="font-body-sm text-xs text-on-tertiary-container">
                Demo note: This summary has been prepared locally for you to review or copy. No enquiry has been sent to an external weaver or seller, and custom-weaving feasibility is subject to artisan review.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
