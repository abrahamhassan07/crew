import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStripe, siteUrl } from "@/lib/stripe";

export async function POST() {
  const viewer = await requireAdmin();
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("stripe_customer_id").eq("id", viewer.orgId).single();
  if (!org?.stripe_customer_id) return NextResponse.json({ error: "No billing account yet — choose a plan first." }, { status: 400 });

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${siteUrl()}/subscription`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not open the billing portal." }, { status: 500 });
  }
}
