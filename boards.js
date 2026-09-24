// Public ATS job board APIs. No login, no scraping, no browser automation.
// Greenhouse and Lever verified live 22 September 2026.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One queue per host. Two requests to the same host never overlap, and there
// is always a gap between them. Without this you get 429s within a minute.
const queues = new Map();
const HOST_DELAY = { 'apply.workable.com': 1500, 'api.ashbyhq.com': 600, default: 400 };

async function queued(host, task) {
  const gap = HOST_DELAY[host] ?? HOST_DELAY.default;
  const previous = queues.get(host) || Promise.resolve();
  const current = previous.then(async () => { await sleep(gap); return task(); });
  queues.set(host, current.catch(() => {}));
  return current;
}

// Cap on how long we will wait. If a server asks for longer we do NOT comply —
// the board is skipped. Waiting 23 hours inside a script is not patience, it is
// a hang. One board asked for exactly that.
const MAX_WAIT_MS = 60_000;
const blocked = new Map();

// Retry-After is either delta-seconds or an HTTP date. parseInt on a date
// returns garbage, which is its own small bug worth not having.
const readRetryAfter = (value) => {
  if (!value) return null;
  const seconds = Number(value.trim());
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const when = Date.parse(value);
  return Number.isFinite(when) ? Math.max(0, when - Date.now()) : null;
};

const get = async (url, { attempts = 3 } = {}) => {
  const host = new URL(url).host;
  const until = blocked.get(host);
  if (until && Date.now() < until) {
    throw new Error(`${host} is rate limiting us, retry in about ${Math.ceil((until - Date.now()) / 60000)} minutes`);
  }
  return queued(host, async () => {
    let backoff = 3000;
    for (let i = 1; i <= attempts; i++) {
      const r = await fetch(url, {
        headers: { 'user-agent': 'ats-job-radar/1.0' },
        signal: AbortSignal.timeout(20000),
      });
      if (r.ok) return r.json();
      if (r.status === 429 || r.status >= 500) {
        const asked = readRetryAfter(r.headers.get('retry-after'));
        if (asked !== null && asked > MAX_WAIT_MS) {
          blocked.set(host, Date.now() + asked);
          throw new Error(`${r.status}, server asked for ${(asked / 3600000).toFixed(1)}h — too long, skipping this board`);
        }
        if (i === attempts) throw new Error(`HTTP ${r.status} after ${attempts} attempts`);
        const wait = Math.min(asked ?? backoff, MAX_WAIT_MS);
        process.stdout.write(`      ${r.status}, waiting ${Math.round(wait / 1000)}s then retrying (${i}/${attempts})   \r`);
        await sleep(wait);
        backoff = Math.min(backoff * 2, MAX_WAIT_MS);
        continue;
      }
      throw new Error(`HTTP ${r.status}`);   // 404 and friends: retrying is pointless
    }
  });
};

const text = (h) => (h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();

export const BOARDS = {
  greenhouse: {
    probe: (slug) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
    async fetchAll(slug) {
      const d = await get(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
      return (d.jobs || []).map((j) => ({
        boardId: String(j.id),
        title: j.title,
        company: slug,
        locationLabel: j.location?.name || '',
        body: text(j.content),
        url: j.absolute_url,
        postedAt: j.updated_at || j.first_published || null,
        board: 'greenhouse',
      }));
    },
  },
  lever: {
    probe: (slug) => `https://api.lever.co/v0/postings/${slug}?mode=json&limit=1`,
    async fetchAll(slug) {
      const d = await get(`https://api.lever.co/v0/postings/${slug}?mode=json`);
      return (Array.isArray(d) ? d : []).map((j) => ({
        boardId: j.id,
        title: j.text,
        company: slug,
        locationLabel: j.categories?.location || '',
        body: `${text(j.descriptionPlain || j.description)} ${(j.lists || []).map((l) => `${l.text}: ${text(l.content)}`).join(' ')}`,
        url: j.hostedUrl,
        postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
        board: 'lever',
      }));
    },
  },
  ashby: {
    probe: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
    async fetchAll(slug) {
      const d = await get(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`);
      return (d.jobs || []).map((j) => ({
        boardId: j.id,
        title: j.title,
        company: slug,
        locationLabel: j.location || '',
        body: text(j.descriptionHtml || j.descriptionPlain),
        url: j.jobUrl || j.applyUrl,
        postedAt: j.publishedAt || null,
        board: 'ashby',
      }));
    },
  },
  workable: {
    probe: (slug) => `https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`,
    async fetchAll(slug) {
      const d = await get(`https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`);
      return (d.jobs || []).map((j) => ({
        boardId: j.shortcode,
        title: j.title,
        company: slug,
        locationLabel: [j.city, j.country].filter(Boolean).join(', '),
        body: text(`${j.description || ''} ${j.requirements || ''}`),
        url: j.url || j.application_url,
        postedAt: j.published_on || null,
        board: 'workable',
      }));
    },
  },
  recruitee: {
    probe: (slug) => `https://${slug}.recruitee.com/api/offers/`,
    async fetchAll(slug) {
      const d = await get(`https://${slug}.recruitee.com/api/offers/`);
      return (d.offers || []).map((j) => ({
        boardId: String(j.id),
        title: j.title,
        company: slug,
        locationLabel: [j.city, j.country].filter(Boolean).join(', '),
        body: text(`${j.description || ''} ${j.requirements || ''}`),
        url: j.careers_url || j.careers_apply_url,
        postedAt: j.published_at || null,
        board: 'recruitee',
      }));
    },
  },
};
