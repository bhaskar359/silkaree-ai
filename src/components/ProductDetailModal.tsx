import type { SareeItem } from '../types/saree';
import { SareeImage } from './SareeImage';

interface ProductDetailModalProps {
  saree: SareeItem | null;
  isSaved: boolean;
  onToggleSave: (id: string) => void;
  onClose: () => void;
  onFindSimilarStyle: (saree: SareeItem) => void;
}

export function ProductDetailModal({
  saree,
  isSaved,
  onToggleSave,
  onClose,
  onFindSimilarStyle,
}: ProductDetailModalProps) {
  if (!saree) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-saree-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl border border-secondary/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header Bar */}
        <div className="sticky top-0 z-20 bg-surface-container-lowest/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-outline-variant/30">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 text-primary font-label-md text-label-md p-1 min-h-[44px] cursor-pointer hover:opacity-80"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            <span>Back</span>
          </button>
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold">
            {saree.badge} Handloom
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggleSave(saree.id)}
              aria-label={isSaved ? 'Remove from saved sarees' : 'Save saree'}
              className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-primary hover:bg-secondary-container/40 cursor-pointer"
            >
              <span
                className={`material-symbols-outlined text-[18px] ${
                  isSaved ? 'material-symbols-filled text-secondary' : ''
                }`}
              >
                {isSaved ? 'bookmark' : 'bookmark_border'}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close product details"
              className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* High-res Image Preview */}
        <div className="relative w-full aspect-[4/3] bg-surface-container shrink-0">
          <SareeImage
            src={saree.image}
            alt={saree.name}
            accentHex={saree.accentHex}
            secondaryHex={saree.secondaryHex}
            fallbackLabel={saree.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white font-label-sm text-label-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">
              {saree.inStock === true ? 'verified' : 'help_outline'}
            </span>
            <span>
              {saree.inStock === true
                ? 'In stock'
                : saree.inStock === false
                  ? 'Out of stock'
                  : 'Availability unverified'}
            </span>
          </div>
        </div>

        {/* Details Content */}
        <div className="p-5 flex flex-col gap-3.5">
          <div>
            <div className="flex items-center gap-2 mb-1 text-on-surface-variant font-label-sm text-label-sm">
              <span className="text-secondary font-bold uppercase tracking-wider">
                {saree.occasion}
              </span>
              <span aria-hidden="true">·</span>
              <span>{saree.region}</span>
            </div>
            <h3
              id="modal-saree-title"
              className="font-headline-md text-headline-md text-primary"
            >
              {saree.name}
            </h3>
            <div className="flex items-baseline gap-2 pt-1">
              <p className="font-headline-sm text-headline-sm font-bold text-on-surface tabular-nums">
                ₹{saree.price.toLocaleString('en-IN')}
              </p>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {saree.colour}
              </span>
            </div>
          </div>

          <p className="font-body-md text-body-md text-on-surface-variant">
            {saree.shortDescription}
          </p>

          {/* Weaver Story Card */}
          <div className="p-3.5 rounded-xl bg-surface-container-low flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">
                workspace_premium
              </span>
              <span className="font-label-md text-label-md text-on-surface font-bold">
                Artisan Heritage &amp; Provenance
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {saree.weaverStory}
            </p>
          </div>

          {/* Specifications Breakdown */}
          <div className="grid grid-cols-2 gap-2 text-left">
            <div className="p-2.5 rounded-lg bg-surface-container">
              <span className="font-label-sm text-label-sm text-on-surface-variant block uppercase">
                Fabric Base
              </span>
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                {saree.specs.fabricBase}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-container">
              <span className="font-label-sm text-label-sm text-on-surface-variant block uppercase">
                Zari &amp; Border
              </span>
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                {saree.specs.zariType}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-container">
              <span className="font-label-sm text-label-sm text-on-surface-variant block uppercase">
                Total Length
              </span>
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                {saree.specs.length}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-container">
              <span className="font-label-sm text-label-sm text-on-surface-variant block uppercase">
                Weave Weight
              </span>
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                {saree.specs.weight}
              </span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                onFindSimilarStyle(saree);
                onClose();
              }}
              className="w-full py-3 rounded-xl bg-primary hover:bg-tertiary text-on-primary font-label-lg text-label-lg font-semibold shadow-md flex items-center justify-center gap-2 min-h-[44px] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">filter_vintage</span>
              <span>Find Sarees with Similar Weave &amp; Palette</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-primary font-label-md text-label-md font-semibold min-h-[44px] transition-colors cursor-pointer"
            >
              Close Window
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
