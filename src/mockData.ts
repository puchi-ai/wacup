import { Match } from './types';

/**
 * FIFA World Cup 2026 — Realistic Group Stage Fixtures
 *
 * 48 teams, 12 groups of 4. Each team plays 3 group matches.
 * Hosts: USA, Canada, Mexico.
 * Tournament runs June 11 – July 19, 2026.
 */
export const mockMatches: Match[] = [
  // ===== COMPLETED MATCHES =====

  // Group A — Mexico vs South Korea (Opening Match)
  {
    id: 'm4',
    homeTeam: 'Mexico',
    homeShort: 'MEX',
    homeFlag: '🇲🇽',
    countryCode: 'mx',
    awayTeam: 'South Korea',
    awayShort: 'KOR',
    awayFlag: '🇰🇷',
    awayCountryCode: 'kr',
    kickoffTime: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(), // 30 hours ago
    competition: 'FIFA World Cup 2026 (Group A)',
    status: 'completed',
    homeScore: 3,
    awayScore: 1,
    venue: 'Estadio Azteca, Mexico City',
    odds: { home: 1.80, draw: 3.40, away: 4.50 },
    details: 'A historic opening match at the legendary Azteca! Mexico delighted the home crowd with a dominant display, taking control early through a superb team goal. South Korea fought back with a well-taken strike but the second-half introduction of Lozano sealed the win with two clinical finishes.'
  },

  // Group D — USA vs Paraguay
  {
    id: 'm5',
    homeTeam: 'USA',
    homeShort: 'USA',
    homeFlag: '🇺🇸',
    countryCode: 'us',
    awayTeam: 'Paraguay',
    awayShort: 'PAR',
    awayFlag: '🇵🇾',
    awayCountryCode: 'py',
    kickoffTime: new Date(Date.now() - 1000 * 60 * 60 * 54).toISOString(), // 54 hours ago
    competition: 'FIFA World Cup 2026 (Group D)',
    status: 'completed',
    homeScore: 2,
    awayScore: 1,
    venue: 'SoFi Stadium, Los Angeles',
    odds: { home: 1.65, draw: 3.60, away: 5.50 },
    details: 'An absolute thriller in Los Angeles! The USMNT started brightly with an early goal from Pulisic, but Paraguay responded with a stunning equalizer before half-time. A late Christian Pulisic free-kick proved to be the difference, earning a vital 3 points for the Stars and Stripes in their group opener.'
  },

  // Group C — Brazil vs Morocco
  {
    id: 'm6',
    homeTeam: 'Brazil',
    homeShort: 'BRA',
    homeFlag: '🇧🇷',
    countryCode: 'br',
    awayTeam: 'Morocco',
    awayShort: 'MAR',
    awayFlag: '🇲🇦',
    awayCountryCode: 'ma',
    kickoffTime: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(), // 96 hours ago
    competition: 'FIFA World Cup 2026 (Group C)',
    status: 'completed',
    homeScore: 2,
    awayScore: 0,
    venue: 'Mercedes-Benz Stadium, Atlanta',
    odds: { home: 1.40, draw: 4.50, away: 7.00 },
    details: 'Vinicius Jr. scored a brilliant individual goal to open the scoring, dancing past three defenders before slotting home. Richarlison added a second-half header from a Raphinha cross as Brazil controlled proceedings against a stubborn Moroccan side that defended resolutely but lacked cutting edge in attack.'
  },

  // ===== UPCOMING MATCHES =====

  // Group J — Argentina vs Austria (Marquee match, next up)
  {
    id: 'm1',
    homeTeam: 'Argentina',
    homeShort: 'ARG',
    homeFlag: '🇦🇷',
    countryCode: 'ar',
    awayTeam: 'Austria',
    awayShort: 'AUT',
    awayFlag: '🇦🇹',
    awayCountryCode: 'at',
    kickoffTime: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(), // 4 hours from now
    competition: 'FIFA World Cup 2026 (Group J)',
    status: 'upcoming',
    venue: 'MetLife Stadium, East Rutherford',
    odds: { home: 1.30, draw: 5.00, away: 9.00 },
    details: 'Lionel Messi leads defending champions Argentina against a well-organized Austrian side in their Group J opener. Austria, led by David Alaba, will look to frustrate the Albiceleste with a compact defensive block and quick transitions. Can Messi add to his World Cup legacy?'
  },

  // Group L — England vs Croatia (Classic rivalry renewed)
  {
    id: 'm2',
    homeTeam: 'England',
    homeShort: 'ENG',
    homeFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    countryCode: 'gb-eng',
    awayTeam: 'Croatia',
    awayShort: 'CRO',
    awayFlag: '🇭🇷',
    awayCountryCode: 'hr',
    kickoffTime: new Date(Date.now() + 1000 * 60 * 60 * 25).toISOString(), // 25 hours from now
    competition: 'FIFA World Cup 2026 (Group L)',
    status: 'upcoming',
    venue: 'Wembley Stadium, London (Neutral)',
    odds: { home: 1.60, draw: 3.75, away: 5.50 },
    details: 'A rematch of the 2018 semi-final and 2020 Euro final! England face a familiar foe in Luka Modric-led Croatia. The Three Lions boast incredible attacking depth with Kane, Bellingham, and Saka, while Croatia relies on midfield mastery to control the tempo. Expect a tactical chess match in this Group L blockbuster.'
  },

  // Group I — France vs Senegal
  {
    id: 'm3',
    homeTeam: 'France',
    homeShort: 'FRA',
    homeFlag: '🇫🇷',
    countryCode: 'fr',
    awayTeam: 'Senegal',
    awayShort: 'SEN',
    awayFlag: '🇸🇳',
    awayCountryCode: 'sn',
    kickoffTime: new Date(Date.now() + 1000 * 60 * 60 * 49).toISOString(), // 49 hours from now
    competition: 'FIFA World Cup 2026 (Group I)',
    status: 'upcoming',
    venue: 'Hard Rock Stadium, Miami Gardens',
    odds: { home: 1.45, draw: 4.20, away: 7.00 },
    details: 'France kick off their campaign against a dangerous Senegal side led by Sadio Mané. Les Bleus boast incredible depth with Mbappé, Griezmann, and Tchouaméni, but Senegal\'s pace on the counter could cause problems. France will need to be wary of the African Champions\' set-piece threat.'
  },

  // Group E — Germany vs Ivory Coast
  {
    id: 'm7',
    homeTeam: 'Germany',
    homeShort: 'GER',
    homeFlag: '🇩🇪',
    countryCode: 'de',
    awayTeam: 'Ivory Coast',
    awayShort: 'CIV',
    awayFlag: '🇨🇮',
    awayCountryCode: 'ci',
    kickoffTime: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(), // 72 hours from now
    competition: 'FIFA World Cup 2026 (Group E)',
    status: 'upcoming',
    venue: 'AT&T Stadium, Arlington',
    odds: { home: 1.50, draw: 4.00, away: 6.50 },
    details: 'Germany face a physically imposing Ivory Coast side in a fascinating Group E clash. Die Mannschaft are rebuilding under Nagelsmann with a young, dynamic squad featuring Wirtz and Musiala. The Ivorians will rely on their powerful midfield and the experience of Sébastien Haller to trouble the German backline.'
  },

  // Group F — Netherlands vs Japan
  {
    id: 'm8',
    homeTeam: 'Netherlands',
    homeShort: 'NED',
    homeFlag: '🇳🇱',
    countryCode: 'nl',
    awayTeam: 'Japan',
    awayShort: 'JPN',
    awayFlag: '🇯🇵',
    awayCountryCode: 'jp',
    kickoffTime: new Date(Date.now() + 1000 * 60 * 60 * 96).toISOString(), // 96 hours from now
    competition: 'FIFA World Cup 2026 (Group F)',
    status: 'upcoming',
    venue: 'BC Place, Vancouver',
    odds: { home: 1.55, draw: 3.80, away: 6.00 },
    details: 'The Dutch face a fascinating test against Japan\'s technically gifted squad. Netherlands\' back-three system under Koeman will be tested by Japan\'s quick one-touch passing and movement. A crucial match in a tight Group F that also includes Sweden and Tunisia.'
  },
];
