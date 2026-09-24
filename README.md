# ats-job-radar

Reads job postings straight from companies' own ATS APIs, then rejects the ones you cannot actually apply for — before you waste an evening writing a cover letter for them.

No scraping. No browser automation. No dependencies. Node 18+ and nothing else.

```
npm test          # 18 real postings, must be 18/18 before you trust it
npm run discover:sample
npm run run
```

## Why this exists

I applied to 31 remote engineering roles in a week. Most of the effort went into postings I was never eligible for, and I only found that out after reading the full description.

The reason is that aggregator location labels are wrong often enough to be useless. Seven cases from one week:

| The board said | The posting said |
|---|---|
| "Worldwide" | "Not open to candidates in Indonesia" |
| "Worldwide" | UK or CET timezone only |
| "Everywhere" | "Location: India" |
| "Everywhere" | CET only |
| "Hires remotely: South East Asia" | send blocked on timezone grounds |
| "Worldwide" | an 8-month-old US-only role |
| listed as active | the underlying ATS link returned 404 |

So this tool skips the aggregator. It reads the company's own Greenhouse, Lever, Ashby, Workable or Recruitee board, takes the full description, and decides from the sentences in the posting rather than a label somebody else typed.

## The rule that matters

**A board label is a guess. A sentence in the body is a commitment. An ATS location field is the employer's own data.**

Those three are treated differently:

- **Body text** is authoritative. `right to work in the UK or EU`, `must be based in`, `no visa sponsorship`, `W-2` — all hard rejects.
- **The ATS location field** binds, because the employer filled it in themselves. `Remote - United States` is a reject.
- **An aggregator label** is never evidence. If the body neither restricts nor promises, the posting goes to a separate *check by hand* pile instead of being quietly passed.

## Seven gates

| Gate | Rejects when |
|---|---|
| Title | not a technical role, or an excluded one (tax, sales, PM, director, junior) |
| ATS location | the employer's own field names a locked city or country |
| Body location | the description restricts region, work authorization or visa status |
| Years | the stated floor exceeds your experience plus tolerance |
| Stack | the core language is one you do not work in, or fewer than 3 specific technologies match |
| Timezone | never rejects — converts stated core hours to your local time and **flags** them |
| Age | posted longer ago than your cutoff |

The timezone gate is deliberately a flag, not a reject. `12:00–3:00 PM ET` is `23:00–02:00` in UTC+7. That is a real cost, and it is a person's decision — not something to promise quietly in a cover letter because the filter stayed silent.

## What the tests are actually for

`filter.test.js` holds 18 real postings. Eight of them are **leaks** — postings an earlier version passed that it should have rejected. Every one became a regression test the moment I found it.

The first version scored 9/10 on:

- *Director, US International Tax* at an AI research company
- *Tax Director, Provision & Compliance* at the same company
- *Sr. Product Manager, M&A Transactions and Valuations*
- *Sr. Total Rewards Manager*
- *Junior Data Engineer (Power BI)*

None is an engineering job. They passed because there was no title gate at all, and because generic words carried weight: the company boilerplate on every posting mentioned LLMs, agents and automation, and two matches cleared the stack gate.

Two things were wrong, and both are worth naming:

1. **No title gate.** The cheapest possible check, and it was missing.
2. **Generic words counted as evidence.** `SQL`, `API`, `AI`, `agent`, `automation` now live in a separate `weakStack` list that provides context and never counts toward the match threshold.

A second round leaked two more:

- A *Founding Staff Mobile Engineer* on a perfectly matching stack — the body said `Right to work in the UK or EU without sponsorship is required`. My blocker matched `authorization to work in` but not `right to work in`.
- A *Java Engineer* posting, passed because the body also mentioned React, TypeScript, Docker and PostgreSQL. A language you do not work in, in the **title**, is the job's core. No amount of familiar technology elsewhere buys that back.

The honest lesson: my first test suite passed 9/9 because all nine fixtures were engineering jobs. I tested what I imagined would arrive, not what the world actually sends. Roughly 63% of postings on a real company board are not engineering roles at all.

## Honest results

Three runs, about 2,300 postings scanned, **zero applicable roles found.**

That is a finding about the market, not a bug. Companies that simultaneously (a) run a public ATS, (b) genuinely hire across borders with no local work-authorization requirement, (c) accept mid-level experience, and (d) use this stack are rare.

There is also a sampling flaw worth stating plainly: the company list came from a ledger that aggregators had filled, so switching the *source* to ATS APIs improved data quality without changing *which companies* were being read. Better plumbing, same pipe.

The per-company summary is what survived as genuinely useful. From 50 randomly sampled companies it separated 14 worth watching from 5 that were pure overhead — measured by how many of their postings were technical at all, and how many had an open location.

## Setup

```bash
cp profile.example.js profile.js     # edit: your years, stack, timezone, floors
cp companies.example.txt companies.txt
npm test                             # 18/18 or do not proceed
npm run discover:sample              # probes 50 random companies, ~5 minutes
npm run run
```

`discover.js` probes every name against every board and keeps only what returns a real response — no slug is guessed. It caches progress, so Ctrl+C and rerun is safe. Run it monthly; boards rarely change.

Optionally set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` to write results to a Postgres table. Keys are read from the environment and never stored in the repo.

## Rate limiting

Each host gets its own queue with a delay, and 429s are retried with backoff. If a server asks us to wait longer than 60 seconds, the board is **skipped** rather than waited on — one board replied `Retry-After: 82808`, which is 23 hours. Complying with that is not patience, it is a hang.

## What it deliberately does not do

- No LinkedIn scraping. That breaks their terms and risks the account you are job hunting with — and connection data can be exported officially in ten minutes anyway.
- No auto-apply. This stops at a shortlist. Cover letters are written per posting, by a person, with the gaps stated plainly.
- No deletes. Append and amend only.

## License

MIT
