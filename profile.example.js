// Copy this to profile.js and edit. profile.js is gitignored.
// Everything the radar decides with lives here, in one place.
export const PROFILE = {
  yearsExperience: 4,
  yearsGapTolerance: 2,        // a floor above years+tolerance is a reject
  utcOffset: 7,                // your timezone, for core-hours math
  sleepingHours: [1, 7],       // local hours. Core hours landing here get flagged.
  hourlyFloorUsd: 25,
  annualFloorUsd: 25000,

  // Words in a TITLE that mark a genuinely technical role.
  // No match here and the posting is rejected, however many buzzwords the body has.
  technicalTitles: [
    'engineer','engineering','developer','dev\\b','programmer','architect',
    'full[- ]?stack','fullstack','front[- ]?end','back[- ]?end','backend','frontend',
    'software','web developer','mobile developer','sre','devops','platform',
    'technical lead','tech lead','automation','integration','implementer',
    'data engineer','ml engineer','ai engineer','machine learning engineer'
  ],

  // Words in a TITLE that reject outright. Without this list a Tax Director
  // at an AI company scores 9, because the boilerplate mentions LLMs and agents.
  excludedTitles: [
    'tax','accountant','accounting','controller','payroll','bookkeep',
    'recruiter','recruiting','talent acquisition','total rewards','compensation',
    'people operations','hr\\b','human resources','benefits',
    'sales','account executive','business development','bdr\\b','sdr\\b','quota',
    'marketing','brand','content writer','copywriter','seo specialist',
    'customer success','customer support','account manager','solutions consultant',
    'legal','counsel','paralegal','compliance officer','auditor',
    'product manager','product owner','program manager','project manager',
    'chief of staff','executive assistant','office manager','facilities',
    'designer','ux researcher','illustrator',
    'director','vp\\b','vice president','head of','chief','president',
    'intern\\b','internship','apprentice','junior','graduate'
  ],

  // Specific technologies you actually ship. These count as evidence.
  coreStack: [
    'typescript','javascript','react','next.js','nextjs','react native','expo',
    'node','node.js','supabase','postgres','postgresql','python','fastapi',
    'n8n','rest api','webhook','tailwind','vercel','docker',
    'rag','openai','langchain','huggingface'
  ],

  // Generic words. Helpful context, never evidence on their own.
  // These are what let unrelated roles through in the first version.
  weakStack: ['sql','git','api','llm','ai\\b','agent','automation','cloud','linux','saas'],

  // Languages and platforms you do not work in. If one of these is in the
  // TITLE, that is the job's core and the posting is rejected outright.
  notYourStack: [
    'java','ruby on rails','ruby','golang','go lang','angular','kubernetes',
    'rust','swift','kotlin','c++','.net','c#','php','laravel','drupal',
    'salesforce apex','scala','elixir','terraform','flutter','dart'
  ]
};
