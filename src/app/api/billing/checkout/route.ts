import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN, TEAM_SIZES, priceFor } from "@/lib/plans";
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
        ...(trialDaysLeft > 1 && !org.stripe_subscription_id ? { trial_period_days: trialDaysLeft } : {}),
      },
      allow_promotion_codes: true,
      success_url: `${siteUrl()}/subscription?checkout=success`,
      cancel_url: `${siteUrl()}/subscription?checkout=cancelled`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not start checkout." }, { status: 500 });
  }
}
