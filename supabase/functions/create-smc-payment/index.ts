import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// TODO: Replace these with your actual Stripe Price IDs after creating products in Stripe Dashboard
const PRICE_IDS: Record<string, string> = {
  crew_assessment: "price_REPLACE_WITH_CREW_ASSESSMENT_PRICE_ID",
  manager_assessment: "price_REPLACE_WITH_MANAGER_ASSESSMENT_PRICE_ID",
  pack_10: "price_REPLACE_WITH_PACK_10_PRICE_ID",
  pack_25: "price_REPLACE_WITH_PACK_25_PRICE_ID",
  pack_50: "price_REPLACE_WITH_PACK_50_PRICE_ID",
};

const AMOUNTS: Record<string, number> = {
  crew_assessment: 2900,
  manager_assessment: 4900,
  pack_10: 39900,
  pack_25: 84900,
  pack_50: 149900,
};

const PAYMENT_TYPES: Record<string, string> = {
  crew_assessment: "crew",
  manager_assessment: "manager",
  pack_10: "bulk",
  pack_25: "bulk",
  pack_50: "bulk",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { product_key, crew_profile_id } = await req.json();

    if (!product_key || !PRICE_IDS[product_key]) {
      throw new Error("Invalid product_key. Valid keys: " + Object.keys(PRICE_IDS).join(", "));
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Try to get authenticated user (optional for this flow)
    let userEmail: string | undefined;
    let userId: string | undefined;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabaseClient.auth.getUser(token);
      userEmail = data.user?.email ?? undefined;
      userId = data.user?.id ?? undefined;
    }

    // Check for existing Stripe customer
    let customerId: string | undefined;
    if (userEmail) {
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      line_items: [{ price: PRICE_IDS[product_key], quantity: 1 }],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/`,
      metadata: {
        product_key,
        crew_profile_id: crew_profile_id || "",
        payment_type: PAYMENT_TYPES[product_key],
      },
    });

    // Create pending payment record
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    await serviceClient.from("smc_payments").insert({
      user_id: userId || null,
      payment_type: PAYMENT_TYPES[product_key],
      stripe_session_id: session.id,
      amount_paid: AMOUNTS[product_key],
      status: "pending",
      assessment_unlocked: false,
      crew_profile_id: crew_profile_id || null,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
