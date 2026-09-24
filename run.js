// Step 2: pull every posting from the live boards, run the gates, report.
//
//   node run.js            write results.json
//   node run.js --verbose  also print every rejection reason
import { BOARDS } from './boards.js';
import { evaluate } from './filter.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const VERBOSE = process.argv.includes('--verbose');

if (!existsSync('live-boards.json')) {
  console.error('\nlive-boards.json not found.\n\nRun this first:  node discover.js --limit=50 --shuffle\n');
  process.exit(1);
}
const liveBoards = JSON.parse(readFileSync('live-boards.json', 'utf8'));
console.log(`Pulling from ${liveBoards.length} live boards...\n`);

const all = [];
const rateLimited = [], otherFailures = [];
for (const { slug, board, name } of liveBoards) {
  try {
    const postings = await BOARDS[board].fetchAll(slug);
    all.push(...postings.map((p) => ({ ...p, companyName: name })));
    console.log(`  ${board.padEnd(12)} ${slug.padEnd(28)} ${postings.length} postings`);
  } catch (e) {
    (/(rate limiting|too long|429)/.test(e.message) ? rateLimited : otherFailures).push(`${board}/${slug}`);
    console.log(`  ${board.padEnd(12)} ${slug.padEnd(28)} FAILED: ${e.message}`);
  }
}

if (rateLimited.length) {
  console.log(`\n${rateLimited.length} boards RATE LIMITED: ${rateLimited.slice(0, 8).join(', ')}${rateLimited.length > 8 ? ', ...' : ''}`);
  console.log('   Not broken — we asked too often today. Try again tomorrow.');
}
if (otherFailures.length) console.log(`${otherFailures.length} boards failed for other reasons: ${otherFailures.slice(0, 8).join(', ')}`);

console.log(`\n${all.length} raw postings. Running the gates...\n`);

const clear = [], checkByHand = [], rejected = [];
const seen = new Set();   // the same job is often posted under several ids
let duplicates = 0;
for (const p of all) {
  const v = evaluate(p);
  if (!v.pass) { rejected.push({ p, v }); continue; }
  if (seen.has(v.key)) { duplicates++; continue; }
  seen.add(v.key);
  (v.gates.bodyLocation.confidence === 'low' ? checkByHand : clear).push({ p, v });
}

const line = (x) => `${x.p.title} — ${x.p.companyName} — score ${x.v.score} — ${x.p.url}`;
console.log(`CLEAR (body proves the role is open globally): ${clear.length}`);
clear.sort((a, b) => b.v.score - a.v.score).forEach((x) => console.log('  ' + line(x)));
console.log(`\nCHECK BY HAND (no restriction stated, but no global promise either): ${checkByHand.length}`);
checkByHand.sort((a, b) => b.v.score - a.v.score).slice(0, 25).forEach((x) => console.log('  ' + line(x)));
console.log(`\nDUPLICATES DROPPED: ${duplicates}`);
console.log(`\nREJECTED: ${rejected.length}`);
const why = {};
rejected.forEach((x) => x.v.rejectedFor.forEach((r) => { const k = r.split(':')[0]; why[k] = (why[k] || 0) + 1; }));
Object.entries(why).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${k}: ${n}`));
if (VERBOSE) rejected.slice(0, 60).forEach((x) => console.log(`  - ${x.p.title} (${x.p.companyName}): ${x.v.rejectedFor.join(' ; ')}`));

// Per-company summary: which companies are worth watching, which waste the run.
const byCompany = {};
for (const p of all) {
  const v = evaluate(p);
  const k = p.companyName || p.company;
  byCompany[k] ??= { total: 0, technical: 0, locationOpen: 0, clear: 0 };
  const c = byCompany[k];
  c.total++;
  if (v.gates.title.pass) c.technical++;
  if (v.gates.atsLocation.pass) c.locationOpen++;
  if (v.pass) c.clear++;
}
const worthWatching = Object.entries(byCompany).filter(([, c]) => c.technical > 0 && c.locationOpen > 0);
const notWorthIt = Object.entries(byCompany).filter(([, c]) => c.technical === 0 || c.locationOpen === 0);
console.log(`\nWORTH WATCHING (${worthWatching.length}):`);
worthWatching.sort((a, b) => b[1].clear - a[1].clear).forEach(([k, c]) =>
  console.log(`  ${k.padEnd(22)} ${String(c.total).padStart(4)} postings | ${String(c.technical).padStart(3)} technical | ${String(c.locationOpen).padStart(3)} location-open | ${c.clear} clear`));
console.log(`\nNOT WORTH IT (${notWorthIt.length}) — no technical roles, or every location locked:`);
console.log('  ' + notWorthIt.map(([k]) => k).join(', '));

writeFileSync('results.json', JSON.stringify({ clear, checkByHand, byCompany, rejected: rejected.slice(0, 200) }, null, 2));
console.log('\nFull detail in results.json');
