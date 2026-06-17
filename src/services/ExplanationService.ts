import { ProductMatch, MatchReason, MatchGap, MatchExplanation } from '../types/index.js';
import { ChatMessage, FeatherlessClient } from './llm/FeatherlessClient.js';

/**
 * Turns a ProductMatch into a plain-language explanation a farmer can act on,
 * in Swahili or English (see docs/PRD.md §6, FR4, FR11).
 *
 * Grounding (the judge-facing trust story): the model is given ONLY the facts
 * from the graph and is instructed never to invent numbers, rates, or rules.
 * If the LLM is unavailable — no API key, network error, timeout — we fall back
 * to a deterministic template built from the same facts, so the product never
 * fails to explain a match (PRD non-functional requirement: graceful fallback).
 */
export class ExplanationService {
  constructor(private llm: FeatherlessClient | null) {}

  async explainMatch(match: ProductMatch, language = 'en'): Promise<MatchExplanation> {
    const lang = normaliseLang(language);

    if (this.llm) {
      try {
        const text = await this.llm.chat(buildMessages(match, lang), { temperature: 0.3 });
        return { text, language: lang, generatedBy: `featherless:${this.llm.model}` };
      } catch (err) {
        // Fall through to the template; the demo must never break on LLM errors.
        console.warn('Explanation LLM failed, using template fallback:', (err as Error).message);
      }
    }

    return { text: templateExplanation(match, lang), language: lang, generatedBy: 'template' };
  }
}

function normaliseLang(language: string): 'sw' | 'en' {
  return language?.toLowerCase().startsWith('sw') ? 'sw' : 'en';
}

// --- LLM prompt (strictly grounded in the supplied facts) -------------------

function buildMessages(match: ProductMatch, lang: 'sw' | 'en'): ChatMessage[] {
  const langName = lang === 'sw' ? 'Swahili (Kiswahili)' : 'English';
  const system =
    `You are Kilimo AI, a warm, plain-spoken assistant for Kenyan smallholder farmers. ` +
    `Explain this loan match in simple ${langName}, in 2–4 short sentences. ` +
    `Use ONLY the facts provided. NEVER invent or alter any amount, interest rate, ` +
    `repayment term, lender name, or eligibility rule. Do not mention any fact that is ` +
    `not given. If the farmer does not yet qualify, clearly say so and state what they ` +
    `would need to change. Do not give financial advice beyond these facts.`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: factSheet(match) },
  ];
}

/** A compact, unambiguous fact sheet the model must stay within. */
function factSheet(m: ProductMatch): string {
  const lines = [
    `Product: ${m.product.name}`,
    `Lender: ${m.lender.name} (${m.lender.type})`,
    `Amount: KES ${m.product.minAmount}–${m.product.maxAmount}`,
    `Interest: ${m.product.interestRate}% per year`,
    `Repayment term: ${m.product.term} months`,
    `Eligibility notes: ${m.product.eligibilityNotes}`,
    `Farmer qualifies now: ${m.qualifies ? 'yes' : 'no'}`,
  ];
  if (m.reasons.length) {
    lines.push(`Why it fits: ${m.reasons.map((r) => `${r.dimension}=${r.matched.join(', ')}`).join('; ')}`);
  }
  if (m.gaps.length) {
    lines.push(`Still needed to qualify: ${m.gaps.map((g) => `${g.dimension} one of [${g.required.join(', ')}]`).join('; ')}`);
  }
  if (m.hasRepaymentHistory) lines.push('Signal: farmer has repaid a previous loan.');
  if (m.lenderInRegion) lines.push("Signal: lender operates in the farmer's region.");
  return lines.join('\n');
}

// --- Deterministic fallback (graph-grounded, no model) ----------------------

function templateExplanation(m: ProductMatch, lang: 'sw' | 'en'): string {
  const min = fmtKes(m.product.minAmount);
  const max = fmtKes(m.product.maxAmount);
  const rate = m.product.interestRate;
  const term = m.product.term;
  const lenderType = m.lender.type;

  if (lang === 'sw') {
    if (m.qualifies) {
      const reasons = m.reasons.map((r) => reasonPhrase(r, 'sw')).join('; ');
      const notes = [
        m.hasRepaymentHistory ? 'Rekodi yako nzuri ya kulipa inaimarisha ombi hili.' : '',
        m.lenderInRegion ? 'Mkopeshaji huyu anahudumu eneo lako.' : '',
      ].filter(Boolean).join(' ');
      return (
        `${m.lender.name} (${lenderType}) inatoa ${m.product.name}. ` +
        `Unastahili kwa sababu ${reasons}. ` +
        `Mkopo huu ni KES ${min}–${max}, riba ${rate}% kwa mwaka, kulipwa kwa miezi ${term}.` +
        (notes ? ` ${notes}` : '')
      );
    }
    const gaps = m.gaps.map((g) => gapPhrase(g, 'sw')).join('; ');
    return (
      `Bado hustahili ${m.product.name} kutoka ${m.lender.name} kikamilifu. ` +
      `Ili ustahili, unahitaji ${gaps}. ` +
      `(Kwa marejeo: KES ${min}–${max}, riba ${rate}% kwa mwaka, miezi ${term}.)`
    );
  }

  // English
  if (m.qualifies) {
    const reasons = m.reasons.map((r) => reasonPhrase(r, 'en')).join('; ');
    const notes = [
      m.hasRepaymentHistory ? 'Your good repayment record strengthens this application.' : '',
      m.lenderInRegion ? 'This lender operates in your area.' : '',
    ].filter(Boolean).join(' ');
    return (
      `${m.lender.name} (${lenderType}) offers ${m.product.name}. ` +
      `You qualify because ${reasons}. ` +
      `It provides KES ${min}–${max} at ${rate}% per year, repaid over ${term} months.` +
      (notes ? ` ${notes}` : '')
    );
  }
  const gaps = m.gaps.map((g) => gapPhrase(g, 'en')).join('; ');
  return (
    `You don't fully qualify for ${m.product.name} from ${m.lender.name} yet. ` +
    `To qualify, you would need to ${gaps}. ` +
    `(For reference: KES ${min}–${max} at ${rate}% per year over ${term} months.)`
  );
}

function reasonPhrase(r: MatchReason, lang: 'sw' | 'en'): string {
  const v = r.matched.join(', ');
  if (lang === 'sw') {
    if (r.dimension === 'crop') return `unalima ${v}`;
    if (r.dimension === 'region') return `uko ${v}`;
    if (r.dimension === 'season') return `unavuna msimu wa ${v}`;
    return v;
  }
  if (r.dimension === 'crop') return `you grow ${v}`;
  if (r.dimension === 'region') return `you are in ${v}`;
  if (r.dimension === 'season') return `you harvest in the ${v} season`;
  return v;
}

function gapPhrase(g: MatchGap, lang: 'sw' | 'en'): string {
  const v = g.required.join(', ');
  if (lang === 'sw') {
    if (g.dimension === 'crop') return `kulima mojawapo ya: ${v}`;
    if (g.dimension === 'region') return `kuwa katika: ${v}`;
    if (g.dimension === 'season') return `kuvuna msimu wa: ${v}`;
    return v;
  }
  if (g.dimension === 'crop') return `grow one of: ${v}`;
  if (g.dimension === 'region') return `be located in: ${v}`;
  if (g.dimension === 'season') return `harvest in: ${v}`;
  return v;
}

/** Formats a KES amount with thousands separators. */
function fmtKes(amount: number): string {
  return Math.round(amount).toLocaleString('en-KE');
}
