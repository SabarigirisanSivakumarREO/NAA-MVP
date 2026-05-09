/**
 * T105 Cialdini pack commit helper — merges 5 Cialdini drafts + ai_review.
 * One-shot script. Same shape as commit-t103-wave2.mjs / commit-t104-nielsen.mjs.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const VERIFIED_BY = 'Sabari (engineering lead)';
const VERIFIED_DATE = '2026-05-09T20:05:00Z';
const REVIEWED_AT = '2026-05-09T20:00:00Z';
const REVIEWER_PERSONA =
  'neural-heuristic-reviewer v1.0 (top-1% senior CRO consultant; 20yr; multi-vertical D2C/SaaS/marketplace/B2B/lead-gen/fintech/media)';

const dim = (dimension, confidence, finding) => ({ dimension, confidence, finding });
const HIGH_ALL_CLEAN = (notes) => [
  dim('source', 'HIGH', notes.source),
  dim('citation', 'HIGH', notes.citation),
  dim('fit', 'HIGH', notes.fit),
  dim('banned_phrase', 'HIGH', 'no conversion-rate predictions; descriptive principle-level phrasing only (drafter self-check confirmed regex-clean)'),
  dim('benchmark', 'HIGH', notes.benchmark),
  dim('actionability', 'HIGH', notes.actionability),
];

const SHARED_SOURCE = 'https://www.influenceatwork.com/7-principles-of-persuasion/ (Cialdini company site — authoritative; HTTP 200 verified)';

const REVIEWS = {
  'CIALDINI-SOCIALPROOF-001': {
    why_generated:
      "Drafter targeted Cialdini's Principle 4 (Social Proof) — peer-action signals and bestseller badges near primary CTA; one of the most-cited Cialdini applications in e-commerce.",
    how_reviewed:
      `${SHARED_SOURCE}; "especially when uncertain, people will look to the actions and behaviors of others" verbatim from source; canonical Cialdini Principle 4.`,
    findings_notes: {
      source: SHARED_SOURCE,
      citation: 'Verbatim Cialdini-attributed framing of social-proof under uncertainty',
      fit: '6-archetype universal scope; page_type [homepage/pdp/landing/pricing] appropriate (social-proof primary on product surfaces)',
      benchmark: 'qualitative standard_text paraphrases Cialdini guidance on aggregated peer signals + similarity cues',
      actionability: 'review-count + similarity-cued bestseller badges near CTA; quick_win effort calibration accurate',
    },
  },
  'CIALDINI-SCARCITY-001': {
    why_generated:
      "Drafter targeted Cialdini's Principle 5 (Scarcity) — loss-framing via low-stock counts, countdown timers, waitlists; the highest-misuse-risk Cialdini principle in e-commerce (artificial-scarcity ethics).",
    how_reviewed:
      `${SHARED_SOURCE}; Concorde example verbatim from source; page_type extended to [cart/checkout] for urgency-timer placement (correct — checkout is natural scarcity surface).`,
    findings_notes: {
      source: SHARED_SOURCE,
      citation: 'Concorde example verbatim; canonical Cialdini Principle 5 framing',
      fit: '6-archetype universal; page_type extended to cart/checkout — appropriate for countdown-timer placement',
      benchmark: 'qualitative standard_text emphasizes factual-grounding (anti-artificial-scarcity); methodologically defensible',
      actionability: 'low-stock/countdown/waitlist signals near CTA; incremental effort; ethical-use guidance built into recommendation',
    },
  },
  'CIALDINI-AUTHORITY-001': {
    why_generated:
      "Drafter targeted Cialdini's Principle 6 (Authority) — verifiable expert credentials + trust badges + third-party endorsements near payment-form / commitment surfaces.",
    how_reviewed:
      `${SHARED_SOURCE}; physiotherapist + real-estate-agent examples verbatim from source; canonical Cialdini Principle 6; "third-party-introduced expertise" pattern explicitly named.`,
    findings_notes: {
      source: SHARED_SOURCE,
      citation: 'Physiotherapist + real-estate-agent examples verbatim — both Cialdini-attributed',
      fit: '6-archetype universal scope; page_type [homepage/pdp/checkout/pricing/landing] appropriate for credential-bearing surfaces',
      benchmark: 'qualitative standard_text emphasizes verifiability (anti-fake-badge); methodologically clean',
      actionability: 'certifications + named credentials near payment + third-party introduction; incremental effort',
    },
  },
  'CIALDINI-RECIPROCITY-001': {
    why_generated:
      "Drafter targeted Cialdini's Principle 1 (Reciprocity) — give-first positioning before commitment ask; free trials, free shipping, sample products, educational content.",
    how_reviewed:
      `${SHARED_SOURCE}; mint-on-receipt study verbatim from source; canonical Cialdini Principle 1 application; effort=strategic appropriate (give-first funnel architecture is funnel-redesign work, not copy tweak).`,
    findings_notes: {
      source: SHARED_SOURCE,
      citation: 'Mint-on-receipt restaurant study verbatim — Cialdini-canonical reciprocity research',
      fit: '6-archetype universal; page_type [homepage/pricing/landing] appropriate for give-first surfaces',
      benchmark: 'qualitative standard_text emphasizes personalized-or-unexpected vs generic; defensible',
      actionability: 'free-trial + give-first content patterns; strategic effort calibration accurate (funnel-architecture work)',
    },
  },
  'CIALDINI-LIKING-001': {
    why_generated:
      "Drafter targeted Cialdini's Principle 3 (Liking) — human photography + similarity-cued copy + shared values + community signals; subtle but high-leverage brand-positioning work.",
    how_reviewed:
      `${SHARED_SOURCE}; MBA negotiation study verbatim from source; canonical Cialdini Principle 3 framing; effort=strategic appropriate (brand-voice + photography are positioning-level, not surface tweaks).`,
    findings_notes: {
      source: SHARED_SOURCE,
      citation: 'MBA negotiation similarity study verbatim — Cialdini-canonical liking research',
      fit: '6-archetype universal; page_type [homepage/pdp/landing] appropriate for brand-positioning surfaces',
      benchmark: 'qualitative standard_text emphasizes target-customer language + shared-values framing',
      actionability: 'human imagery + similarity-cued copy + founder/team presence; strategic effort calibration accurate',
    },
  },
};

const ALL_IDS = Object.keys(REVIEWS);

await mkdir('heuristics-repo/cialdini', { recursive: true });

let merged = 0;
let failed = 0;

for (const id of ALL_IDS) {
  const draftPath = join('.heuristic-drafts', 'cialdini', `${id}.json`);
  const outPath = join('heuristics-repo', 'cialdini', `${id}.json`);

  try {
    const draftRaw = await readFile(draftPath, 'utf-8');
    const draft = JSON.parse(draftRaw);

    draft.provenance.verified_by = VERIFIED_BY;
    draft.provenance.verified_date = VERIFIED_DATE;

    const review = REVIEWS[id];
    draft.ai_review = {
      reviewer_persona: REVIEWER_PERSONA,
      reviewed_at: REVIEWED_AT,
      why_generated: review.why_generated,
      how_reviewed: review.how_reviewed,
      dimension_findings: HIGH_ALL_CLEAN(review.findings_notes),
      disposition: 'APPROVE',
      flagged_concerns: [],
    };

    await writeFile(outPath, JSON.stringify(draft, null, 2) + '\n', 'utf-8');
    process.stdout.write(`OK  ${id}\n`);
    merged++;
  } catch (err) {
    process.stderr.write(`FAIL ${id}: ${err.message}\n`);
    failed++;
  }
}

process.stdout.write(`\nMerged ${merged}/${ALL_IDS.length} (${failed} failed)\n`);
process.exit(failed === 0 ? 0 : 1);
