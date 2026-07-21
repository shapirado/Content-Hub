import { GoogleDriveIcon, InstagramIcon, TikTokIcon, WhatsAppIcon, YouTubeIcon } from "@/components/icons";

/**
 * Nirit always posts to both WhatsApp groups simultaneously, so the UI treats
 * "WhatsApp – הכל בתדר" and "WhatsApp – המרחב להגשמה" (the two real Airtable
 * platform values) as a single WhatsApp status rather than showing them separately.
 */
export const PLATFORM_DISPLAY = [
  { key: "YouTube", label: "YouTube", Icon: YouTubeIcon, color: "#FF0000", match: (p: string[]) => p.includes("YouTube") },
  { key: "Instagram", label: "Instagram", Icon: InstagramIcon, color: "#E4405F", match: (p: string[]) => p.includes("Instagram") },
  { key: "TikTok", label: "TikTok", Icon: TikTokIcon, color: "#000000", match: (p: string[]) => p.includes("TikTok") },
  {
    key: "WhatsApp",
    label: "WhatsApp",
    Icon: WhatsAppIcon,
    color: "#25D366",
    match: (p: string[]) => p.some((x) => x.startsWith("WhatsApp")),
  },
  {
    key: "GoogleDrive",
    label: "Google Drive",
    Icon: GoogleDriveIcon,
    color: "#00AC47",
    match: (p: string[]) => p.includes("GoogleDrive"),
  },
] as const;

export type PlatformFilterKey = (typeof PLATFORM_DISPLAY)[number]["key"];
