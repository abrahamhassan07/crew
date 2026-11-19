/**
 * Store rules: a free companion app for a paid web service mustn't push people to buy outside the app. So inside the
 * phone app, sentences that point at plans or upgrading are dropped from messages; the website keeps them.
 */

const UPSELL = /\b(upgrade|see plans|under subscription|included with the|team plan|business plans?|choose a plan)\b/i;
export const NOT_IN_PLAN = "This isn't part of your current plan.";

export function stripUpsell(message: string): string {
  const kept = message.split(/(?<=[.!?])\s+/).filter((s) => !UPSELL.test(s));
  return kept.length ? kept.join(" ") : NOT_IN_PLAN;
}
