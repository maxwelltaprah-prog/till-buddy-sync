import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ROLES = ["admin", "branch_supervisor", "stock_manager", "cashier"];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Not signed in" }, 401);

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const fullName = String(body.fullName ?? "").trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Invalid email" }, 400);
    if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);
    if (fullName.length < 2) return json({ error: "Full name is required" }, 400);

    const { data: caller } = await admin.from("profiles").select("store_id").eq("user_id", user.id).maybeSingle();
    const { data: callerRoles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (callerRoles ?? []).some((r) => r.role === "admin");
    const { data: owner } = await admin.from("platform_owners").select("user_id").eq("user_id", user.id).maybeSingle();

    let storeId: string;
    let role: string;
    let branchId: string | null = null;

    if (body.action === "create_store") {
      if (!owner) return json({ error: "Only the platform owner can create stores" }, 403);
      const storeName = String(body.storeName ?? "").trim();
      if (storeName.length < 2) return json({ error: "Store name is required" }, 400);
      const { data: store, error } = await admin.from("stores")
        .insert({ name: storeName, phone, email }).select("id").single();
      if (error) throw error;
      storeId = store.id;
      const { data: branch, error: bErr } = await admin.from("branches")
        .insert({ name: "Main Branch", code: "MAIN", store_id: storeId, location_type: "sales_point" })
        .select("id").single();
      if (bErr) throw bErr;
      branchId = branch.id;
      await admin.from("tax_components").insert([
        { name: "VAT", code: "VAT", rate: 15, sort_order: 1, store_id: storeId },
        { name: "NHIL", code: "NHIL", rate: 2.5, sort_order: 2, store_id: storeId },
        { name: "GETFund Levy", code: "GETFUND", rate: 2.5, sort_order: 3, store_id: storeId },
      ]);
      await admin.from("system_settings").insert([
        { key: "shop_settings", value: { shop_name: storeName, currency_symbol: "GH₵", currency_code: "GHS", phone, email }, store_id: storeId },
        { key: "expiry_ageing", value: { t1: 3, t2: 4, t3: 6 }, store_id: storeId },
      ]);
      role = "admin";
    } else if (body.action === "create_user") {
      if (!isAdmin || !caller?.store_id) return json({ error: "Only store administrators can add users" }, 403);
      storeId = caller.store_id;
      role = String(body.role);
      if (!ROLES.includes(role)) return json({ error: "Invalid role" }, 400);
      if (body.branchId) {
        const { data: b } = await admin.from("branches").select("id").eq("id", body.branchId).eq("store_id", storeId).maybeSingle();
        if (!b) return json({ error: "Branch not in your store" }, 400);
        branchId = b.id;
      }
    } else {
      return json({ error: "Unknown action" }, 400);
    }

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: fullName },
    });
    if (cErr) {
      if (body.action === "create_store") await admin.from("stores").delete().eq("id", storeId);
      return json({ error: cErr.message }, 400);
    }
    const uid = created.user.id;
    await admin.from("profiles").update({ store_id: storeId, branch_id: branchId, full_name: fullName, phone }).eq("user_id", uid);
    await admin.from("user_roles").insert({ user_id: uid, role });
    return json({ ok: true, user_id: uid, store_id: storeId });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
