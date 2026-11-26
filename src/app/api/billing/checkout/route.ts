import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LAUNCH_OFFER, PLAN, TEAM_SIZES, launchPriceFor, priceFor } from "@/lib/plans";
import { getStripe, siteUrl } from "@/lib/stripe";

export async function POST(req: Request) {
  const viewer = await requireAdmin();
  const body = (await req.json().catch(() => null)) as { team?: string; annual?: boolean } | null;
  const team = TEAM_SIZES.find((t) => t.k === body?.team);
  if (!team) return NextResponse.json({ error: "Choose a team size." }, { status: 400 });

  try {
    const stripe = getStripe();
    const annual = !!body?.annual;
    const { now: perMonth } = priceFor(team, annual);

    const supabase = await createClient();
    const { data: org } = await supabase.from("organizations").select("*").eq("id", viewer.orgId).single();
    if (!org) return NextResponse.json({ error: "Organisation not found." }, { status: 404 });

    let customerId = org.stripe_customer_id;
    // The launch offer is for a business's first subscription only.
    let firstSubscription = !org.stripe_subscription_id;
    if (firstSubscription && customerId) {
      const past = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 1 });
      firstSubscription = past.data.length === 0;
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        email: viewer.email,
        metadata: { org_id: org.id },
      });
      customerId = customer.id;
      await createAdminClient().from("organizations").update({ stripe_customer_id: customerId }).eq("id", org.id);
    }

    const metadata = { org_id: org.id, plan: PLAN.k, team_size: team.k, interval: annual ? "year" : "month" };
    const trialDaysLeft = Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / 864e5);
    const trialDays = trialDaysLeft > 1 && !org.stripe_subscription_id ? trialDaysLeft : 0;

    // Launch offer: an amount off the normal price for the first months of paid billing. Stripe counts a coupon's
    // months from when the subscription starts, trial included, so the free trial's months are added on top.
    const launch = firstSubscription ? launchPriceFor(team, annual) : null;
    let couponId: string | null = null;
    if (launch !== null) {
      const months = LAUNCH_OFFER.months + Math.ceil(trialDays / 30);
      const amountOff = Math.round((team.price - launch) * 100);
      couponId = `launch-${team.k === "1" ? "solo" : team.k}-${Math.round(launch * 100)}-${months}m`;
      try {
        await stripe.coupons.retrieve(couponId);
      } catch {
        await stripe.coupons.create({
          id: couponId,
          name: `Launch offer: $${launch}/mo for ${LAUNCH_OFFER.months} months`,
          amount_off: amountOff,
          currency: "aud",
          duration: "repeating",
          duration_in_months: months,
        });
      }
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: org.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "aud",
            unit_amount: perMonth * (annual ? 12 : 1) * 100,
            recurring: { interval: annual ? "year" : "month" },
            product_data: { name: `${PLAN.name} ${team.name} (${team.label})` },
          },
        },
      ],
      subscription_data: {
        metadata,
        ...(trialDays ? { trial_period_days: trialDays } : {}),
      },
      // Stripe allows either a set discount or a box for promo codes, not both.
      ...(couponId ? { discounts: [{ coupon: couponId }] } : { allow_promotion_codes: true }),
      success_url: `${siteUrl()}/subscription?checkout=success`,
      cancel_url: `${siteUrl()}/subscription?checkout=cancelled`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not start checkout." }, { status: 500 });
  }
}
