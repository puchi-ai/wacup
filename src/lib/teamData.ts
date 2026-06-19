/**
 * FIFA World Cup 2026 — Team Metadata
 *
 * Maps the team names used in openfootball/worldcup.json to our
 * internal Match format (short codes, ISO country codes, flag emojis).
 *
 * Covers all 48 qualified teams across 12 groups (A–L).
 */

export interface TeamInfo {
  short: string;
  countryCode: string;
  flag: string;
}

const teamMap: Record<string, TeamInfo> = {
  // Group A
  'Mexico':          { short: 'MEX', countryCode: 'mx', flag: '🇲🇽' },
  'South Africa':    { short: 'RSA', countryCode: 'za', flag: '🇿🇦' },
  'South Korea':     { short: 'KOR', countryCode: 'kr', flag: '🇰🇷' },
  'Czech Republic':  { short: 'CZE', countryCode: 'cz', flag: '🇨🇿' },

  // Group B
  'Canada':          { short: 'CAN', countryCode: 'ca', flag: '🇨🇦' },
  'Bosnia & Herzegovina': { short: 'BIH', countryCode: 'ba', flag: '🇧🇦' },
  'Qatar':           { short: 'QAT', countryCode: 'qa', flag: '🇶🇦' },
  'Switzerland':     { short: 'SUI', countryCode: 'ch', flag: '🇨🇭' },

  // Group C
  'Brazil':          { short: 'BRA', countryCode: 'br', flag: '🇧🇷' },
  'Morocco':         { short: 'MAR', countryCode: 'ma', flag: '🇲🇦' },
  'Haiti':           { short: 'HAI', countryCode: 'ht', flag: '🇭🇹' },
  'Scotland':        { short: 'SCO', countryCode: 'gb-sct', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },

  // Group D
  'USA':             { short: 'USA', countryCode: 'us', flag: '🇺🇸' },
  'Paraguay':        { short: 'PAR', countryCode: 'py', flag: '🇵🇾' },
  'Australia':       { short: 'AUS', countryCode: 'au', flag: '🇦🇺' },
  'Turkey':          { short: 'TUR', countryCode: 'tr', flag: '🇹🇷' },

  // Group E
  'Germany':         { short: 'GER', countryCode: 'de', flag: '🇩🇪' },
  'Curaçao':         { short: 'CUR', countryCode: 'cw', flag: '🇨🇼' },
  'Ivory Coast':     { short: 'CIV', countryCode: 'ci', flag: '🇨🇮' },
  'Ecuador':         { short: 'ECU', countryCode: 'ec', flag: '🇪🇨' },

  // Group F
  'Netherlands':     { short: 'NED', countryCode: 'nl', flag: '🇳🇱' },
  'Japan':           { short: 'JPN', countryCode: 'jp', flag: '🇯🇵' },
  'Sweden':          { short: 'SWE', countryCode: 'se', flag: '🇸🇪' },
  'Tunisia':         { short: 'TUN', countryCode: 'tn', flag: '🇹🇳' },

  // Group G
  'Belgium':         { short: 'BEL', countryCode: 'be', flag: '🇧🇪' },
  'Egypt':           { short: 'EGY', countryCode: 'eg', flag: '🇪🇬' },
  'Iran':            { short: 'IRN', countryCode: 'ir', flag: '🇮🇷' },
  'New Zealand':     { short: 'NZL', countryCode: 'nz', flag: '🇳🇿' },

  // Group H
  'Spain':           { short: 'ESP', countryCode: 'es', flag: '🇪🇸' },
  'Cape Verde':      { short: 'CPV', countryCode: 'cv', flag: '🇨🇻' },
  'Saudi Arabia':    { short: 'KSA', countryCode: 'sa', flag: '🇸🇦' },
  'Uruguay':         { short: 'URU', countryCode: 'uy', flag: '🇺🇾' },

  // Group I
  'France':          { short: 'FRA', countryCode: 'fr', flag: '🇫🇷' },
  'Senegal':         { short: 'SEN', countryCode: 'sn', flag: '🇸🇳' },
  'Iraq':            { short: 'IRQ', countryCode: 'iq', flag: '🇮🇶' },
  'Norway':          { short: 'NOR', countryCode: 'no', flag: '🇳🇴' },

  // Group J
  'Argentina':       { short: 'ARG', countryCode: 'ar', flag: '🇦🇷' },
  'Algeria':         { short: 'ALG', countryCode: 'dz', flag: '🇩🇿' },
  'Austria':         { short: 'AUT', countryCode: 'at', flag: '🇦🇹' },
  'Jordan':          { short: 'JOR', countryCode: 'jo', flag: '🇯🇴' },

  // Group K
  'Portugal':        { short: 'POR', countryCode: 'pt', flag: '🇵🇹' },
  'DR Congo':        { short: 'COD', countryCode: 'cd', flag: '🇨🇩' },
  'Uzbekistan':      { short: 'UZB', countryCode: 'uz', flag: '🇺🇿' },
  'Colombia':        { short: 'COL', countryCode: 'co', flag: '🇨🇴' },

  // Group L
  'England':         { short: 'ENG', countryCode: 'gb-eng', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  'Croatia':         { short: 'CRO', countryCode: 'hr', flag: '🇭🇷' },
  'Ghana':           { short: 'GHA', countryCode: 'gh', flag: '🇬🇭' },
  'Panama':          { short: 'PAN', countryCode: 'pa', flag: '🇵🇦' },
};

/**
 * Look up team metadata by team name.
 * Falls back to a best-effort guess based on the name.
 */
export function getTeamInfo(teamName: string): TeamInfo {
  const known = teamMap[teamName];
  if (known) return known;

  // Fallback: derive short code from name and return generic values
  const short = teamName.substring(0, 3).toUpperCase();
  return { short, countryCode: '', flag: '🏳️' };
}

/**
 * Get the full team map (for debugging / iteration).
 */
export function getAllTeamNames(): string[] {
  return Object.keys(teamMap);
}
