import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN, TEAM_SIZES, priceFor } from "@/lib/plans";
import { getStripe } from "@/lib/stripe";

// Moves an existing subscription to a different team size (and price), prorated.
export async function POST(req: Request) {
  const viewer = await requireAdmin();
  const body = (await req.json().catch(() => null)) as { team?: string } | null;
  const team = TEAM_SIZES.find((t) => t.k === body?.team);
  if (!team) return NextResponse.json({ error: "Choose a team size." }, { status: 400 });

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("*").eq("id", viewer.orgId).single();
  if (!org?.stripe_subscription_id) return NextResponse.json({ error: "No active subscription to change." }, { status: 400 });

  // Don't let a business shrink below the people it already has.
  const { count } = await supabase.from("staff").select("id", { count: "exact", head: true }).eq("active", true);
  if ((count ?? 0) > team.users) {
    return NextResponse.json({ error: `You have ${count} active users. Deactivate some in Crews & Staff before choosing a smaller team size.` }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
    const item = sub.items.data[0];
    const interval = item?.price?.recurring?.interval;
    const product = typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id;
    if (!item || !product || (interval !== "month" && interval !== "year")) {
      return NextResponse.json({ error: "Couldn't read your current subscription." }, { status: 500 });
    }

    const perMonth = priceFor(team, interval === "year").now;
    await stripe.subscriptions.update(sub.id, {
      items: [{ id: item.id, price_data: { currency: "aud", product, recurring: { interval }, unit_amount: perMonth * (interval === "year" ? 12 : 1) * 100 } }],
      proration_behavior: "create_prorations",
      metadata: { ...sub.metadata, plan: PLAN.k, team_size: team.k },
    });
    await createAdminClient().from("organizations").update({ team_size: team.k }).eq("id", org.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not change your team size." }, { status: 500 });
  }
}
