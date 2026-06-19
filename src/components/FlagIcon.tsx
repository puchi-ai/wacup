/**
 * FlagIcon — Renders a country flag as SVG image with emoji fallback.
 *
 * Uses circle-flags SVG CDN for reliable cross-platform rendering (Windows, Mac, Linux all work).
 * Falls back to emoji from flagMap if the SVG fails to load or countryCode is missing.
 */

import { useState } from 'react';
import { getFlagEmoji } from '../lib/flagMap';

interface FlagIconProps {
  countryCode?: string; // ISO 3166-1 alpha-2 (e.g. 'ar', 'us', 'gb-eng')
  emoji?: string;        // Optional explicit emoji override
  size?: number;         // Width/height in px (default 28)
  className?: string;
}

export function FlagIcon({ countryCode, emoji, size = 28, className = '' }: FlagIconProps) {
  const [imgError, setImgError] = useState(false);

  const fallbackEmoji = emoji || (countryCode ? getFlagEmoji(countryCode) : '🏳️');

  if (!countryCode || imgError) {
    // Fallback: first try emoji, if that fails show a colored dot
    return (
      <span
        className={`inline-flex items-center justify-center flex-shrink-0 leading-none rounded-full bg-white/10 border border-white/10 ${className}`}
        style={{ width: size, height: size, minWidth: size, fontSize: Math.max(size - 4, 10), lineHeight: `${size}px` }}
        role="img"
        title={fallbackEmoji}
      >
        {fallbackEmoji}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center flex-shrink-0 ${className}`}
      role="img"
    >
      <img
        src={`https://hatscripts.github.io/circle-flags/flags/${countryCode}.svg`}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size, minWidth: size }}
        onError={() => setImgError(true)}
        loading="lazy"
      />
    </span>
  );
}
