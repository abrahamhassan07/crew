import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

// Stripe -> app. The signature check is what makes this endpoint safe to leave public.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Webhook not configured", { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const db = createAdminClient();

  async function syncSubscription(sub: Stripe.Subscription) {
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const item = sub.items.data[0];
    // Newer API versions keep the billing period on the item, older ones on the subscription.
    const periodEnd = (item as unknown as { current_period_end?: number })?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
    const interval: string | undefined = item?.price?.recurring?.interval;
    const orgId = sub.metadata?.org_id;
    const patch = {
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      plan: sub.metadata?.plan ?? null,
      team_size: sub.metadata?.team_size ?? null,
      billing_interval: interval === "year" ? ("year" as const) : interval === "month" ? ("month" as const) : null,
    };
    const query = db.from("organizations").update(patch);
    const { error } = orgId ? await query.eq("id", orgId) : await query.eq("stripe_customer_id", customerId);
    if (error) throw new Error(error.message);
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          await syncSubscription(await getStripe().subscriptions.retrieve(id));
        }
        break;
      }
    }
  } catch (e) {
    // A 500 makes Stripe retry, which is what we want for transient DB errors.
    return new Response(e instanceof Error ? e.message : "Webhook handler failed", { status: 500 });
  }
  return new Response("ok");
}
