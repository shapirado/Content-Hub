import type { CSSProperties } from "react";

type IconProps = { className?: string; title?: string; style?: CSSProperties };

/** Small brand-resembling glyphs (outline style, currentColor) — not official logos, but recognizable shapes. */

export function YouTubeIcon({ className, title, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      {title && <title>{title}</title>}
      <rect x="2" y="5" width="20" height="14" rx="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.5 9.2v5.6l5-2.8-5-2.8z" fill="currentColor" />
    </svg>
  );
}

export function InstagramIcon({ className, title, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      {title && <title>{title}</title>}
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function TikTokIcon({ className, title, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      {title && <title>{title}</title>}
      <path
        d="M16.5 3c.4 2.2 1.9 3.7 4 4v3c-1.5 0-2.9-.4-4-1.2v6.4a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v3.1a2.7 2.7 0 1 0 1.9 2.6V3h2.9z"
        fill="currentColor"
      />
    </svg>
  );
}

export function WhatsAppIcon({ className, title, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      {title && <title>{title}</title>}
      <path
        d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M8.5 8.5c-.3.6-.5 1.3.3 2.6 1 1.6 2.1 2.7 3.7 3.6 1.3.7 1.9.5 2.5.2.5-.2.9-.9 1-1.2.1-.3 0-.5-.2-.6l-1.8-.9c-.2-.1-.4-.1-.5.1l-.5.7c-.1.2-.3.2-.5.1-.7-.3-1.8-1.1-2.4-2.1-.1-.2-.1-.4.1-.5l.6-.6c.1-.1.2-.3.1-.5l-.8-1.8c-.1-.2-.4-.3-.6-.1z"
        fill="currentColor"
      />
    </svg>
  );
}

export function GoogleDriveIcon({ className, title, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      {title && <title>{title}</title>}
      <path
        d="M9 3h6l7 12-3 5H5l-3-5 7-12z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9 3l7 12M15 3L5 20" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
