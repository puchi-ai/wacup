/**
 * flagMap — Manual dictionary mapping ISO 3166-1 alpha-2 country codes to emoji flags.
 *
 * This ensures flags render reliably regardless of data source format.
 * Add more entries as needed for other countries.
 *
 * Country codes reference: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
 */

export const flagMap: Record<string, string> = {
  // Host nations
  us: '🇺🇸',  // United States
  mx: '🇲🇽',  // Mexico
  ca: '🇨🇦',  // Canada

  // CONMEBOL
  ar: '🇦🇷',  // Argentina
  br: '🇧🇷',  // Brazil
  co: '🇨🇴',  // Colombia
  ec: '🇪🇨',  // Ecuador
  py: '🇵🇾',  // Paraguay
  uy: '🇺🇾',  // Uruguay

  // UEFA
  gb: '🇬🇧',  // United Kingdom (generic)
  'gb-eng': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', // England
  'gb-sct': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', // Scotland
  fr: '🇫🇷',  // France
  de: '🇩🇪',  // Germany
  nl: '🇳🇱',  // Netherlands
  es: '🇪🇸',  // Spain
  pt: '🇵🇹',  // Portugal
  it: '🇮🇹',  // Italy
  ch: '🇨🇭',  // Switzerland
  se: '🇸🇪',  // Sweden
  no: '🇳🇴',  // Norway
  dk: '🇩🇰',  // Denmark
  be: '🇧🇪',  // Belgium
  at: '🇦🇹',  // Austria
  hr: '🇭🇷',  // Croatia
  cz: '🇨🇿',  // Czechia
  pl: '🇵🇱',  // Poland
  tr: '🇹🇷',  // Türkiye
  ba: '🇧🇦',  // Bosnia and Herzegovina

  // AFC
  jp: '🇯🇵',  // Japan
  kr: '🇰🇷',  // South Korea
  au: '🇦🇺',  // Australia
  ir: '🇮🇷',  // Iran
  sa: '🇸🇦',  // Saudi Arabia
  qa: '🇶🇦',  // Qatar
  uz: '🇺🇿',  // Uzbekistan
  iq: '🇮🇶',  // Iraq
  jo: '🇯🇴',  // Jordan

  // CAF
  ma: '🇲🇦',  // Morocco
  sn: '🇸🇳',  // Senegal
  eg: '🇪🇬',  // Egypt
  gh: '🇬🇭',  // Ghana
  tn: '🇹🇳',  // Tunisia
  dz: '🇩🇿',  // Algeria
  ci: '🇨🇮',  // Côte d'Ivoire
  cm: '🇨🇲',  // Cameroon
  ng: '🇳🇬',  // Nigeria
  za: '🇿🇦',  // South Africa
  cv: '🇨🇻',  // Cape Verde
  cd: '🇨🇩',  // DR Congo

  // CONCACAF (non-host)
  ht: '🇭🇹',  // Haiti
  pa: '🇵🇦',  // Panama
  cr: '🇨🇷',  // Costa Rica
  hn: '🇭🇳',  // Honduras
  sv: '🇸🇻',  // El Salvador
  jm: '🇯🇲',  // Jamaica
  tt: '🇹🇹',  // Trinidad and Tobago
  cu: '🇨🇺',  // Cuba
  cw: '🇨🇼',  // Curaçao

  // OFC
  nz: '🇳🇿',  // New Zealand
  pg: '🇵🇬',  // Papua New Guinea
  fj: '🇫🇯',  // Fiji
  sb: '🇸🇧',  // Solomon Islands
  nc: '🇳🇨',  // New Caledonia
  tah: '🇵🇫',  // Tahiti (French Polynesia)

  // Other common
  ru: '🇷🇺',  // Russia
  cn: '🇨🇳',  // China
  in: '🇮🇳',  // India
  gr: '🇬🇷',  // Greece
  ie: '🇮🇪',  // Ireland
  ro: '🇷🇴',  // Romania
  bg: '🇧🇬',  // Bulgaria
  sk: '🇸🇰',  // Slovakia
  si: '🇸🇮',  // Slovenia
  rs: '🇷🇸',  // Serbia
  ua: '🇺🇦',  // Ukraine
  hu: '🇭🇺',  // Hungary
  is: '🇮🇸',  // Iceland
};

/**
 * Get a flag emoji for a country code.
 * Falls back to a generic flag if the code is not found.
 */
export function getFlagEmoji(countryCode: string): string {
  return flagMap[countryCode] || '🏳️';
}
