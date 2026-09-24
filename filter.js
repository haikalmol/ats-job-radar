import { PROFILE } from './profile.js';

const norm = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const hasWord = (t, k) => new RegExp(`(^|[^a-z0-9+#.])${k.replace(/[.+*?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9+#]|$)`, 'i').test(t);
const findPattern = (t, list) => list.find((k) => new RegExp(`(^|[^a-z0-9])${k}`, 'i').test(t));

// ---------------------------------------------------------------------------
// GATE 1 — TITLE. Cheapest gate, and the one I forgot to write first.
// Without it, a "Director, US International Tax" posting at an AI company
// scored 9/10, because the company boilerplate on every posting mentions
// LLMs and agents, and that was enough to clear the stack gate.
// ---------------------------------------------------------------------------
export function titleGate(title) {
  const t = (title || '').trim();
  if (!t) return { pass: false, reason: 'Empty title' };
  const banned = findPattern(t, PROFILE.excludedTitles);
  if (banned) return { pass: false, reason: `Title contains "${banned.replace(/\\b/g, '')}" — not a role I apply for` };
  const technical = findPattern(t, PROFILE.technicalTitles);
  if (!technical) return { pass: false, reason: 'Title names no technical role (engineer, developer, and so on)' };
  return { pass: true, reason: `Technical title, matched on "${technical.replace(/\\b/g, '')}"` };
}

// ---------------------------------------------------------------------------
// GATE 2 — THE ATS LOCATION FIELD.
// An aggregator's location label is a guess and lies often. The location field
// on a company's own Greenhouse, Lever or Ashby board is the employer's own
// data. Those are not the same thing, and only the second one binds.
// ---------------------------------------------------------------------------
const LOCKED_CITY = /(new york|san francisco|los angeles|seattle|austin|boston|chicago|denver|atlanta|toronto|vancouver|london|dublin|berlin|munich|paris|amsterdam|madrid|barcelona|warsaw|krakow|lisbon|bucharest|kyiv|tel aviv|bangalore|bengaluru|mumbai|delhi|hyderabad|pune|chennai|singapore|sydney|melbourne|tokyo|seoul|shanghai|beijing|sao paulo|buenos aires|mexico city|bogota|lagos|nairobi|cairo|dubai|riyadh)/i;
const LOCKED_COUNTRY = /(united states|usa|u\.s\.|canada|united kingdom|\buk\b|ireland|germany|france|spain|portugal|poland|romania|ukraine|netherlands|israel|india|brazil|argentina|mexico|colombia|australia|japan|korea|china|nigeria|kenya|egypt|uae|saudi)/i;

export function atsLocationGate(label) {
  const l = (label || '').trim();
  if (!l) return { pass: true, reason: 'ATS left the location blank' };
  if (/(remote|anywhere|worldwide|global|distributed)/i.test(l) && !LOCKED_COUNTRY.test(l) && !LOCKED_CITY.test(l)) {
    return { pass: true, strong: true, reason: `ATS location is "${l}" — open` };
  }
  const hit = l.match(LOCKED_CITY) || l.match(LOCKED_COUNTRY);
  if (hit) return { pass: false, reason: `ATS location is "${l}" — locked to ${hit[0]}. This is the employer's own field, not an aggregator label, so it binds` };
  return { pass: true, reason: `ATS location "${l}" does not clearly lock a region` };
}

// ---------------------------------------------------------------------------
// GATE 3 — THE BODY TEXT.
// The sentence in the posting is what binds. Seven times an aggregator said
// "Worldwide" while the body said otherwise, so the label is never evidence.
// ---------------------------------------------------------------------------
const COUNTRIES = '(United States|the US|U\\.S\\.|USA|Canada|United Kingdom|the UK|Ireland|Europe|the EU|EEA|India|Pakistan|Brazil|Argentina|Mexico|Colombia|LatAm|Latin America|Australia|New Zealand|Germany|France|Spain|Portugal|Poland|Romania|Ukraine|Philippines|Vietnam|South Africa|Nigeria|Kenya|Egypt|Jordan|Israel|Singapore|Japan|China|Korea)';

const BLOCKERS = [
  { re: new RegExp(`not open to (candidates|applicants)[^.]{0,40}(Indonesia|Southeast Asia|Asia)`, 'i'), reason: 'Posting excludes my region outright' },
  { re: new RegExp(`(must|need to|required to|should)\\s+(be\\s+)?(based|located|residing|reside|living|live|situated)\\b[^.]{0,80}\\b(in|within|from)\\b[^.]{0,60}${COUNTRIES}`, 'i'), reason: 'Residency in a specific region required' },
  { re: new RegExp(`\\b${COUNTRIES}[\\s-]*(based|only)\\b[^.]{0,30}(candidates|applicants|residents|required|only)`, 'i'), reason: 'Restricted to candidates from one region' },
  { re: /authoriz(ed|ation) to work in\b/i, reason: 'Requires work authorization in the employer country' },
  { re: /right to work in\b/i, reason: 'Requires right to work in the employer region' },
  { re: /(cannot|can'?t|unable to) (progress|consider|sponsor|support)[^.]{0,60}(sponsorship|visa)/i, reason: 'States it cannot sponsor a visa' },
  { re: /(no|without) (visa )?sponsorship (is )?(available|offered|provided)/i, reason: 'No visa sponsorship' },
  { re: /must (already )?(be )?(eligible|permitted|legally able) to work/i, reason: 'Must already be eligible to work in their region' },
  { re: /(work|employment) (authorization|eligibility) (in|for)\b/i, reason: 'Requires local work status' },
  { re: /\b(only|exclusively)\b[^.]{0,40}\b(citizens|permanent residents|green card)\b/i, reason: 'Restricted to citizens or permanent residents' },
  { re: /\b(W-?2|C2C|corp[- ]to[- ]corp)\b/i, reason: 'US-specific employment structure (W-2 / C2C)' },
];

const ALLOWERS = [
  /anywhere in the world/i,
  /\bworldwide\b/i,
  /(work|hire|remote)[^.]{0,30}from anywhere/i,
  /any\s+time\s?zone/i,
  /hires? remotely[^.]{0,20}everywhere/i,
  /globally distributed/i,
  /remote\s*[-(]?\s*global/i,
];

export function bodyLocationGate(body, boardLabel = '') {
  const t = norm(body);
  if (!t || t.length < 200) {
    return { pass: false, confidence: 'low', reason: 'Body too short to verify — do not apply blind' };
  }
  for (const b of BLOCKERS) {
    const m = t.match(b.re);
    if (m) return { pass: false, confidence: 'high', reason: b.reason, quote: m[0].slice(0, 160) };
  }
  const allowed = ALLOWERS.find((r) => r.test(t));
  if (allowed) return { pass: true, confidence: 'high', reason: 'Body states the role is open globally', quote: (t.match(allowed) || [''])[0] };
  return { pass: true, confidence: 'low', reason: `No regional restriction in the body, but no global statement either. The board label ("${boardLabel}") does not count as evidence — check by hand before sending` };
}

// ---------------------------------------------------------------------------
// GATE 4 — YEARS
// ---------------------------------------------------------------------------
export function yearsGate(body) {
  const t = norm(body);
  const re = /(\d{1,2})\s*(?:\+|plus)?\s*(?:-|–|to)?\s*(\d{1,2})?\s*\+?\s*years?[^.]{0,40}?(experience|exp\b)/gi;
  let floor = null, quote = null, m;
  while ((m = re.exec(t)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > 0 && n <= 25 && (floor === null || n < floor)) { floor = n; quote = m[0].slice(0, 120); }
  }
  if (floor === null) return { pass: true, floor: null, reason: 'No years floor stated' };
  const ceiling = PROFILE.yearsExperience + PROFILE.yearsGapTolerance;
  if (floor > ceiling) {
    return { pass: false, floor, quote, reason: `Asks for ${floor} years against ${PROFILE.yearsExperience} — a ${(floor - PROFILE.yearsExperience).toFixed(1)} year gap, beyond the ${PROFILE.yearsGapTolerance} year tolerance` };
  }
  return { pass: true, floor, quote, reason: `Asks for ${floor} years against ${PROFILE.yearsExperience} — within range` };
}

// ---------------------------------------------------------------------------
// GATE 5 — STACK
// ---------------------------------------------------------------------------
export function stackGate(title, body) {
  const t = norm(`${title} ${body}`);
  const strong = PROFILE.coreStack.filter((k) => hasWord(t, k));
  const weak = PROFILE.weakStack.filter((k) => new RegExp(`(^|[^a-z0-9])${k}`, 'i').test(t));
  const required = (t.match(/(requirements?|must have|you (will )?(have|bring)|qualifications|what you)[\s\S]{0,1500}/i) || [t])[0];
  const inTitle = PROFILE.notYourStack.filter((k) => hasWord(title, k));
  const clash = PROFILE.notYourStack.filter((k) => hasWord(title, k) || hasWord(required, k));

  // A language I do not work in, in the TITLE, is the job's core. No amount of
  // familiar technology mentioned elsewhere in the body buys that back.
  // "Java Engineer" is a Java job even when the body also says React and Docker.
  if (inTitle.length) {
    return { pass: false, matched: strong, clash, reason: `The title itself names ${inTitle.join(', ')} — that is the job's core, and I do not work in it` };
  }
  if (clash.length && strong.length < 4) {
    return { pass: false, matched: strong, clash, reason: `Core requirement is outside my stack: ${clash.join(', ')}. Applying would be claiming a skill I do not have` };
  }
  // Three specific technologies minimum. Generic words like SQL, API and AI are
  // not evidence — those are what let unrelated roles through in version one.
  if (strong.length < 3) {
    return { pass: false, matched: strong, weak, clash, reason: `Only ${strong.length} specific technologies match${strong.length ? ` (${strong.join(', ')})` : ''}, need 3. Generic terms like ${weak.slice(0, 3).join(', ') || 'AI/SQL/API'} do not count` };
  }
  return { pass: true, matched: strong, weak, clash, reason: `${strong.length} technologies match: ${strong.slice(0, 8).join(', ')}${clash.length ? ` | would need to learn: ${clash.join(', ')}` : ''}` };
}

// ---------------------------------------------------------------------------
// GATE 6 — TIMEZONE. Converts stated core hours into local time.
// Never rejects. Flags — because that is a decision for a person, and it must
// not be quietly promised away in a cover letter.
// ---------------------------------------------------------------------------
const OFFSETS = { ET: -4, EST: -5, EDT: -4, PT: -7, PST: -8, PDT: -7, CT: -5, MT: -6, CET: 2, CEST: 2, GMT: 0, BST: 1, UTC: 0 };

export function timezoneGate(body) {
  const t = norm(body);
  const m = t.match(/(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to|until)\s*(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)?\s*(ET|EST|EDT|PT|PST|PDT|CT|MT|CET|CEST|GMT|BST|UTC)\b/i);
  if (!m) return { pass: true, reason: 'No fixed core hours' };
  const zone = m[7].toUpperCase();
  const off = OFFSETS[zone] ?? 0;
  const to24 = (h, ap) => { let n = parseInt(h, 10) % 12; if (/pm/i.test(ap || '')) n += 12; return n; };
  const start = to24(m[1], m[3] || m[6]);
  const end = to24(m[4], m[6]);
  const local = (h) => ((h - off + PROFILE.utcOffset) % 24 + 24) % 24;
  const a = local(start), b = local(end);
  const [s1, s2] = PROFILE.sleepingHours;
  const clashes = (a >= s1 && a < s2) || (b > s1 && b <= s2) || (a > b);
  const label = `${m[0]} = ${String(a).padStart(2, '0')}:00–${String(b).padStart(2, '0')}:00 local`;
  return clashes
    ? { pass: true, warning: true, reason: `CORE HOURS WARNING: ${label}. That lands in sleeping hours — a human decides this, it does not get promised quietly`, quote: m[0] }
    : { pass: true, warning: false, reason: `Core hours ${label} — workable`, quote: m[0] };
}

// ---------------------------------------------------------------------------
// GATE 7 — AGE
// ---------------------------------------------------------------------------
export function ageGate(postedAt, maxDays = 14) {
  if (!postedAt) return { pass: true, days: null, reason: 'Posting date unknown' };
  const days = Math.floor((Date.now() - new Date(postedAt).getTime()) / 86400000);
  return days > maxDays
    ? { pass: false, days, reason: `Posted ${days} days ago, past the ${maxDays} day limit` }
    : { pass: true, days, reason: `Posted ${days} days ago — live` };
}

// ---------------------------------------------------------------------------
// VERDICT
// ---------------------------------------------------------------------------
export function evaluate(posting) {
  const { title = '', body = '', locationLabel = '', postedAt = null } = posting;
  const g = {
    title: titleGate(title),
    atsLocation: atsLocationGate(locationLabel),
    bodyLocation: bodyLocationGate(body, locationLabel),
    years: yearsGate(body),
    stack: stackGate(title, body),
    timezone: timezoneGate(body),
    age: ageGate(postedAt),
  };
  const failed = Object.entries(g).filter(([, v]) => !v.pass);

  // A score is only useful if it spreads. The first version pinned everything
  // at 9 or 10, which made it useless for ranking.
  let score = 3;
  if (g.atsLocation.strong) score += 2;
  if (g.bodyLocation.pass && g.bodyLocation.confidence === 'high') score += 2;
  const n = g.stack.matched?.length || 0;
  score += n >= 8 ? 3 : n >= 6 ? 2 : n >= 4 ? 1 : 0;
  if (g.years.floor !== null && g.years.floor <= PROFILE.yearsExperience) score += 1;
  if (g.years.floor === null) score -= 1;
  if (g.timezone.warning) score -= 2;
  if (g.age.days !== null && g.age.days <= 7) score += 1;
  score = Math.max(1, Math.min(10, score));

  return {
    pass: failed.length === 0,
    score,
    key: `${(posting.companyName || posting.company || '').toLowerCase().trim()}::${title.toLowerCase().replace(/\s+/g, ' ').trim()}`,
    rejectedFor: failed.map(([k, v]) => `${k}: ${v.reason}`),
    notes: Object.entries(g).map(([k, v]) => `${k}: ${v.reason}`).join(' | '),
    gates: g,
  };
}
