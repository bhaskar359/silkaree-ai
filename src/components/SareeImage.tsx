import { useState } from 'react';

interface SareeImageProps {
  src: string;
  alt: string;
  accentHex?: string;
  secondaryHex?: string;
  fallbackLabel?: string;
  className?: string;
}

export function SareeImage({
  src,
  alt,
  accentHex = '#00534F',
  secondaryHex = '#D9B879',
  fallbackLabel,
  className = 'w-full h-full object-cover',
}: SareeImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-4 text-center select-none bg-gradient-to-br from-primary to-tertiary text-on-primary ${className}`}
        aria-label={alt}
      >
        <span className="material-symbols-outlined text-[32px] text-secondary-fixed mb-1.5">
          texture
        </span>
        <span className="font-headline-sm text-sm font-medium text-surface-bright line-clamp-2">
          {fallbackLabel || alt}
        </span>
        <span className="font-label-sm text-[10px] uppercase tracking-widest text-secondary-fixed/90 mt-1">
          Handloom Weave Swatch
        </span>
        <span className="sr-only">
          Palette {accentHex} and {secondaryHex}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
