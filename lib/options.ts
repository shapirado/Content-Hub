/**
 * Controlled vocabularies for the UI. `season` and `usable` map a simplified set of
 * Hebrew labels onto the real Airtable option values — the field still holds the
 * literal Airtable value (so writes stay compatible with the 95 existing tagged
 * clips); the app just narrows which options it *offers* going forward.
 * Legacy season values (סתיו/מעבר/חגים) still display correctly on old records,
 * they're just not offered as choices for new tagging.
 */
export const OPTIONS = {
  pillar: [
    "Body & Sensation",
    "Consciousness Reframes",
    "Professional Identity",
    "Testimonial/Carousel",
  ],
  season: [
    { value: "קיץ", label: "קיץ", icon: "☀️" },
    { value: "חורף", label: "חורף", icon: "❄️" },
    { value: "מעבר", label: "מעבר", icon: "🍂" },
  ],
  usable: [
    { value: "Yes", label: "שמיש" },
    { value: "No", label: "לא לשימוש" },
    { value: "Not Usable", label: "דורש עריכה" },
  ],
  contentInventoryStatus: ["Drafted", "Reviewed", "Posted"],
  contentType: ["TikTok", "Instagram Reel", "Instagram Carousel"],
  platforms: [
    "TikTok",
    "Instagram",
    "WhatsApp – הכל בתדר",
    "WhatsApp – המרחב להגשמה",
  ],
  copyPlatform: [
    "TikTok",
    "Instagram Reel",
    "Instagram Carousel",
    "WhatsApp – הכל בתדר",
    "WhatsApp – המרחב להגשמה",
    "Newsletter",
    "Facebook",
  ],
  /** Distinct values already in use on Raw Clip Library's Scarf/Wardrobe field. גבס excluded — it's a tag, not a color. */
  wardrobe: [
    { value: "בלי", label: "בלי", colorHex: null, image: null },
    { value: "סגול", label: "סגול", colorHex: "#5E4680", image: null },
    { value: "סגול בהיר", label: "סגול בהיר", colorHex: "#c9ceff", image: null },
    { value: "תורכיז", label: "תורכיז", colorHex: "#23A6DA", image: null },
    { value: "כתום בהיר", label: "כתום בהיר", colorHex: "#FDBA74", image: null },
    { value: "כתום כהה", label: "כתום כהה", colorHex: "#FF884E", image: null },
    { value: "תכלת בהיר", label: "תכלת בהיר", colorHex: "#97E0FF", image: null },
    { value: "תכלת מקושקשת", label: "תכלת מקושקשת", colorHex: null, image: "/תכלת מקושקש.png" },
    { value: "צהוב זרחני", label: "צהוב זרחני", colorHex: "#EFFF79", image: null },
    { value: "צבעוני", label: "צבעוני", colorHex: null, image: "/צבעוני.png" },
    { value: "דוגמא שחור על חום", label: "דוגמא שחור על חום", colorHex: null, image: "/דוגמא שחור על חום.png" },
    { value: "לבן עם דוגמא", label: "לבן עם דוגמא", colorHex: null, image: "/לבן עם דוגמא.png" },
  ],
  taskStatus: [
    { value: "Not Started", label: "טרם החל" },
    { value: "In Review", label: "בבדיקה" },
    { value: "Approved", label: "אושר" },
    { value: "Cancelled", label: "בוטל" },
    { value: "Posted/Sent", label: "פורסם" },
  ],
} as const;
