import { evaluate } from './filter.js';

// Every case below is a real job posting I read between 20 and 23 September 2026.
// Eight of them are leaks — postings an earlier version of this filter passed
// that it should have rejected. Each one became a test the moment I found it.
const CASES = [
  // --- aggregator location labels that turned out to be false -------------
  {
    name: 'Board says Worldwide, body excludes my region',
    expect: 'reject',
    title: 'Staff/Senior Full-Stack Rescue Engineer',
    locationLabel: 'Worldwide',
    body: `We are looking for a senior full-stack engineer to rescue stalled projects. You will work with React, TypeScript, Node.js and PostgreSQL across a portfolio of client codebases. This is a long-term contract engagement with flexible hours and no fixed schedule. The team is small and senior. Please note: this role is not open to candidates in Indonesia, Bangladesh or Pakistan due to client contractual restrictions. Compensation is 40 to 60 USD per hour depending on experience.`,
  },
  {
    name: 'Board says Everywhere, body says India',
    expect: 'reject',
    title: 'Full Stack Engineer',
    locationLabel: 'Everywhere',
    body: `Building the operating system for small manufacturers. Stack is React, Node.js, PostgreSQL and AWS. You will own features end to end and talk to customers directly. Location: India. Candidates must be based in India as the team meets in Bengaluru twice a month. Salary 15L to 28L INR.`,
  },

  // --- honest rejections: level and language ------------------------------
  {
    name: 'Eight year floor against four years',
    expect: 'reject',
    title: 'Frontier Senior Software Engineer',
    locationLabel: 'Everywhere',
    body: `Push our accounting platform forward with TypeScript, React and Node.js on PostgreSQL. You will pair with the founders. We need 8+ years of experience shipping production software, and you should be comfortable with ambiguity. Compensation 175000 to 225000 USD.`,
  },
  {
    name: 'Open everywhere, but the language is Java',
    expect: 'reject',
    title: 'Senior Software Engineer, Rules Engine & Parsing',
    locationLabel: 'Everywhere',
    body: `Hires remotely in Everywhere. Requirements: Strong Java, Maven and JUnit. You will build the rules engine and parsing layer that turns messy third party feeds into structured records. 5 years of experience. Must have deep error handling instincts. Salary 160000 to 200000 USD, no equity.`,
  },
  {
    name: 'Angular is a hard requirement',
    expect: 'reject',
    title: 'Lead Full-Stack Developer (Python and Angular)',
    locationLabel: 'Remote',
    body: `Requirements: Strong hands-on experience with Python. Professional experience with Angular is a must have. Docker, AWS EC2 ECS Lambda, and AI Agent frameworks such as LangChain or Strands Agents. 5-10 years experience. Salary 4000 to 6500 EUR gross per month.`,
  },

  // --- the ones that should pass, and did --------------------------------
  {
    name: 'Genuinely global, 2-5 year band (applied to this one)',
    expect: 'pass',
    title: 'Frontend Software Engineer - Remote (global)',
    locationLabel: 'Everywhere',
    postedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    body: `We turn a brief and a brand kit into on-brand product imagery. Customers use a node-based canvas instead of prompt engineering. Hires remotely in Everywhere, remote only. What you will do: own our core product surfaces in the browser, the node-based Canvas editor, the apps gallery and team workspaces. Build the front end of our developer surface as it grows: the REST API, the MCP server, and the integrations customers connect. What we look for: 2-5 years experience building serious browser applications with a modern component framework such as React or TypeScript. We are remote across time zones and decisions live in text. Salary 50000 to 90000 USD.`,
  },
  {
    name: 'Passes, but core hours land at 23:00-02:00 local (applied, flagged)',
    expect: 'pass',
    title: 'Full-Stack Software Engineer (Node.js)',
    locationLabel: 'Everywhere',
    postedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    body: `We build the point-of-sale platform independent retailers run on. Hires remotely in Everywhere. You will work on a microservices Node.js codebase with PostgreSQL and a React frontend. Requirements: strong proficiency in JavaScript and Node.js and building backend services. Comfortable with relational databases PostgreSQL and an ORM. Experience building or consuming REST APIs and integrating with third-party services such as payments, webhooks and OAuth. Solid front-end skills with a modern framework. Sound grasp of Git. 2+ years experience. Available during our core hours, 12:00 - 3:00 PM ET, every workday, otherwise flexible.`,
  },
  {
    name: 'Contract work on a matching stack (applied, employer replied)',
    expect: 'pass',
    title: 'Contract Implementer - Next.js/Supabase sites + AI Assistant',
    locationLabel: 'Remote',
    postedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    body: `We deploy Next.js and TypeScript sites for clients on Vercel with Supabase for Postgres, Auth, RLS and migrations. GitHub Actions runs the checks. You will also wire Twilio Voice, ElevenLabs Agents and Resend. This is contractor availability, not a fixed schedule. We accept W-8BEN for non-US contractors. Per install we pay 300 USD, and 95 USD per hour for support beyond the monthly cap. There is a paid screening task of 150 to 250 USD.`,
  },

  // --- LEAKS, ROUND ONE ---------------------------------------------------
  // All five scored 9/10 before the title gate existed. None is an
  // engineering job. They passed because the company boilerplate on every
  // posting mentions LLMs, agents and automation, and two generic word
  // matches were enough to clear the stack gate.
  {
    name: 'LEAK v1: Tax director at an AI company (scored 9)',
    expect: 'reject',
    title: 'Director, US International Tax',
    locationLabel: 'San Francisco, CA | New York City, NY',
    postedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    body: `We are an AI safety and research company. We build reliable, interpretable AI systems, and our flagship product is a large language model. About the role: lead US international tax planning, transfer pricing, and compliance. You will partner with finance and legal on cross-border structuring. Requirements: CPA or equivalent, deep knowledge of Subpart F, GILTI and BEAT. Experience with tax provision software. Familiarity with automation and SQL reporting is a plus. We work across time zones and our agents team ships quickly.`,
  },
  {
    name: 'LEAK v1: Second tax director (scored 9)',
    expect: 'reject',
    title: 'Tax Director, Provision & Compliance',
    locationLabel: 'San Francisco, CA',
    postedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    body: `Own the global tax provision under ASC 740 and manage external auditors. You will build automation for the quarterly close and work with SQL data extracts. We build LLM systems and AI agents; our finance team supports that work. Requirements: 10+ years in tax, Big Four background preferred.`,
  },
  {
    name: 'LEAK v1: Product manager for M&A (scored 9)',
    expect: 'reject',
    title: 'Sr. Product Manager, M&A Transactions and Valuations',
    locationLabel: 'Remote - United States',
    postedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    body: `We are a market intelligence platform powered by AI and LLM search. As Senior Product Manager you will own the M&A and valuations product area, define the roadmap, write specs, and work with engineering on API and SQL data pipelines. Requirements: 6+ years product management in fintech or financial data.`,
  },
  {
    name: 'LEAK v1: HR compensation manager (scored 9)',
    expect: 'reject',
    title: 'Sr. Total Rewards Manager',
    locationLabel: 'Remote',
    postedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    body: `We build all-in-one recruiting software. Our platform runs on a modern stack and our team is fully remote, anywhere in the world. You will own compensation bands, equity refresh cycles and benefits vendors. You will use SQL to analyze comp data and build automation for the review cycle. Requirements: 7+ years in compensation or total rewards.`,
  },
  {
    name: 'LEAK v1: Junior BI role (scored 9)',
    expect: 'reject',
    title: 'Junior Data Engineer (Power BI)',
    locationLabel: 'Remote worldwide',
    postedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    body: `We are looking for a junior data engineer to work anywhere in the world on Power BI dashboards, DAX measures and SQL data models for enterprise clients. You will support senior consultants. Requirements: 1+ year with Power BI, SQL and basic Python. Azure Data Factory is a plus.`,
  },
  {
    name: 'Real engineering role, but the ATS field locks the city',
    expect: 'reject',
    title: 'Senior Full-Stack Engineer',
    locationLabel: 'New York City, NY',
    postedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    body: `Build product surfaces in React and TypeScript on a Node.js and PostgreSQL backend. You will own features end to end, ship REST APIs, and work with Docker and Vercel deploys. 3+ years experience.`,
  },

  // --- LEAKS, ROUND TWO ---------------------------------------------------
  {
    name: 'LEAK v2: passed at 9, but requires right to work in UK/EU',
    expect: 'reject',
    title: 'Founding Staff Mobile Engineer',
    locationLabel: 'Remote',
    postedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    body: `We are the AI-powered operating system for restaurants. React Native is where you will spend most of your days, so deep experience with it is essential. The wider stack is Python, FastAPI, React, TypeScript, Node.js, AWS, Postgres and Docker. You will own projects independently and make architectural decisions from scratch. Right to work in the UK or EU without sponsorship is required for this role. We can't progress candidates who need visa sponsorship. Competitive salary depending on experience.`,
  },
  {
    name: 'LEAK v2: Java in the title, bought back by familiar words in the body',
    expect: 'reject',
    title: 'Java Engineer [client project]',
    locationLabel: 'Remote',
    postedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    body: `A digital product studio. You will write Java services backing a React and TypeScript front end, deployed with Docker on AWS, talking to PostgreSQL. We use REST APIs and modern tooling throughout, and our engineers work across Node.js and Python where needed. 3+ years experience.`,
  },
  {
    name: 'LEAK v2: same pattern with .NET',
    expect: 'reject',
    title: '.NET/C# Engineer [client project]',
    locationLabel: 'Remote',
    postedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    body: `Build .NET services in C# with a React and TypeScript front end, PostgreSQL storage, Docker containers and REST APIs. Node.js and Python appear elsewhere in our stack. 3+ years experience.`,
  },
  {
    name: 'Dead posting with an empty body',
    expect: 'reject',
    title: 'Senior Engineer',
    locationLabel: 'Worldwide',
    body: `Apply now to learn more.`,
  },
];

let passed = 0, failed = 0;
for (const c of CASES) {
  const r = evaluate(c);
  const got = r.pass ? 'pass' : 'reject';
  const ok = got === c.expect;
  ok ? passed++ : failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  [${c.expect} -> ${got}, score ${r.score}]  ${c.name}`);
  if (!r.pass) console.log(`        rejected for: ${r.rejectedFor.join(' ; ')}`);
  if (r.gates.timezone.warning) console.log(`        ${r.gates.timezone.reason}`);
  if (r.pass && r.gates.bodyLocation.confidence === 'low') console.log(`        CHECK BY HAND: ${r.gates.bodyLocation.reason}`);
}
console.log(`\n${passed} correct, ${failed} wrong, out of ${CASES.length} real postings.`);
process.exit(failed ? 1 : 0);
