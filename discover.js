// Step 1: find which ATS boards actually exist for a list of company names.
// Nothing is guessed — every slug is probed against the real endpoint and the
// dead ones are dropped.
//
//   node discover.js --limit=50 --shuffle    try 50 companies first (~5 min)
//   node discover.js                         try the whole list (1-2 hours)
//
// Safe to stop with Ctrl+C and run again: tested names are cached and skipped.
import { BOARDS } from './boards.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const arg = (name, fallback) => {
  const a = process.argv.find((s) => s.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : fallback;
};

const slugify = (name) => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '').slice(0, 40);

const variants = (name) => {
  const plain = slugify(name);
  const withoutSuffix = slugify(name.replace(/\b(inc|llc|ltd|limited|gmbh|bv|ab|corp|co|technologies|labs?)\b\.?/gi, ''));
  const hyphenated = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return [...new Set([plain, withoutSuffix, hyphenated].filter((s) => s && s.length >= 3))];
};

const CACHE_FILE = 'tested.json';
const RESULT_FILE = 'live-boards.json';

export async function discover(companyNames, { delayMs = 150 } = {}) {
  const tested = existsSync(CACHE_FILE) ? new Set(JSON.parse(readFileSync(CACHE_FILE, 'utf8'))) : new Set();
  const live = existsSync(RESULT_FILE) ? JSON.parse(readFileSync(RESULT_FILE, 'utf8')) : [];
  const save = () => {
    writeFileSync(CACHE_FILE, JSON.stringify([...tested]));
    writeFileSync(RESULT_FILE, JSON.stringify(live, null, 2));
  };
  process.on('SIGINT', () => { save(); console.log('\nStopped. Progress saved — run again to continue.'); process.exit(0); });

  const todo = companyNames.filter((n) => !tested.has(n));
  console.log(`${todo.length} companies left to test (${tested.size} done, ${live.length} live boards so far).\n`);

  let n = 0;
  for (const name of todo) {
    for (const slug of variants(name)) {
      for (const [board, def] of Object.entries(BOARDS)) {
        try {
          const r = await fetch(def.probe(slug), { headers: { 'user-agent': 'ats-job-radar/1.0' }, signal: AbortSignal.timeout(8000) });
          if (r.ok) {
            const body = await r.text();
            if (body.length > 50 && !/not found/i.test(body.slice(0, 200))) {
              if (!live.some((h) => h.slug === slug && h.board === board)) {
                live.push({ name, slug, board });
                console.log(`  LIVE  ${board.padEnd(12)} ${slug}  (${name})`);
              }
            }
          }
        } catch { /* dead or timed out, move on */ }
        await sleep(board === 'workable' ? 1200 : delayMs);
      }
    }
    tested.add(name);
    if (++n % 10 === 0) { save(); process.stdout.write(`  ...${n}/${todo.length} tested, ${live.length} live boards\r`); }
  }
  save();
  return live;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = arg('file', 'companies.txt');
  const limit = parseInt(arg('limit', '0'), 10);
  let names;
  try {
    names = readFileSync(file, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    console.error(`\n${file} not found.\n\nPut one company name per line in ${file}, or write your own source\nand feed the names to discover().\n`);
    process.exit(1);
  }
  if (process.argv.includes('--shuffle')) {
    for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
    console.log('Shuffled — otherwise a limited sample is all companies starting with A.');
  }
  if (limit > 0) { names = names.slice(0, limit); console.log(`Limited to ${limit} companies.`); }
  const live = await discover(names);
  console.log(`\n\nDone. ${live.length} live boards -> ${RESULT_FILE}`);
}
