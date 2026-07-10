/**
 * Curated country list for the phone country-code picker (screen 7a).
 * Netherlands is the default (+31) per the build brief. The full E.164
 * guarantee comes from validation (^\+[1-9]\d{6,14}$), not this list.
 */

export interface Country {
  iso: string;
  name: string;
  /** Dial code including the leading plus, e.g. "+31". */
  dial: string;
  flag: string;
}

export const COUNTRIES: readonly Country[] = [
  { iso: "NL", name: "Netherlands", dial: "+31", flag: "🇳🇱" },
  { iso: "BE", name: "Belgium", dial: "+32", flag: "🇧🇪" },
  { iso: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { iso: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { iso: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { iso: "IE", name: "Ireland", dial: "+353", flag: "🇮🇪" },
  { iso: "ES", name: "Spain", dial: "+34", flag: "🇪🇸" },
  { iso: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹" },
  { iso: "IT", name: "Italy", dial: "+39", flag: "🇮🇹" },
  { iso: "AT", name: "Austria", dial: "+43", flag: "🇦🇹" },
  { iso: "CH", name: "Switzerland", dial: "+41", flag: "🇨🇭" },
  { iso: "DK", name: "Denmark", dial: "+45", flag: "🇩🇰" },
  { iso: "SE", name: "Sweden", dial: "+46", flag: "🇸🇪" },
  { iso: "NO", name: "Norway", dial: "+47", flag: "🇳🇴" },
  { iso: "FI", name: "Finland", dial: "+358", flag: "🇫🇮" },
  { iso: "PL", name: "Poland", dial: "+48", flag: "🇵🇱" },
  { iso: "CZ", name: "Czechia", dial: "+420", flag: "🇨🇿" },
  { iso: "GR", name: "Greece", dial: "+30", flag: "🇬🇷" },
  { iso: "TR", name: "Türkiye", dial: "+90", flag: "🇹🇷" },
  { iso: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { iso: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { iso: "MX", name: "Mexico", dial: "+52", flag: "🇲🇽" },
  { iso: "BR", name: "Brazil", dial: "+55", flag: "🇧🇷" },
  { iso: "AR", name: "Argentina", dial: "+54", flag: "🇦🇷" },
  { iso: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
  { iso: "NZ", name: "New Zealand", dial: "+64", flag: "🇳🇿" },
  { iso: "JP", name: "Japan", dial: "+81", flag: "🇯🇵" },
  { iso: "KR", name: "South Korea", dial: "+82", flag: "🇰🇷" },
  { iso: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬" },
  { iso: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { iso: "AE", name: "United Arab Emirates", dial: "+971", flag: "🇦🇪" },
  { iso: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦" },
  { iso: "ID", name: "Indonesia", dial: "+62", flag: "🇮🇩" },
  { iso: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭" },
  { iso: "SR", name: "Suriname", dial: "+597", flag: "🇸🇷" },
  { iso: "CW", name: "Curaçao", dial: "+599", flag: "🇨🇼" },
] as const;

export const DEFAULT_COUNTRY: Country = COUNTRIES[0] as Country; // Netherlands, +31
