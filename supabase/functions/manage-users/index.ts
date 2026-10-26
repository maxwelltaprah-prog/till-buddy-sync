import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { storeActionError } from './storeRules.ts';

const ROLES = ["admin", "branch_supervisor", "stock_manager", "cashier"];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ error: 'Service unavailable' }, 500);
    const admin = createClient(url, serviceKey);
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Not signed in" }, 401);

    const body = await req.json();
    if (!body || typeof body !== 'object') return json({ error: 'Invalid request' }, 400);
    const { data: caller, error: callerError } = await admin.from("profiles").select("store_id").eq("user_id", user.id).maybeSingle();
    const { data: callerRoles, error: roleError } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const { data: owner, error: ownerError } = await admin.from("platform_owners").select("user_id").eq("user_id", user.id).maybeSingle();
    if (callerError || roleError || ownerError) throw callerError || roleError || ownerError;
    const isAdmin = (callerRoles ?? []).some((r) => r.role === "admin");

    if (['list_store_admins', 'reset_store_password', 'set_store_status', 'archive_store'].includes(body.action)) {
      if (!owner) return json({ error: 'Only the platform owner can manage stores' }, 403);
      const targetStoreId = String(body.storeId ?? '');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetStoreId)) return json({ error: 'Invalid store' }, 400);
      const { data: target, error: targetError } = await admin.from('stores').select('id, name, archived_at').eq('id', targetStoreId).single();
      if (targetError || !target) return json({ error: 'Store not found' }, 404);
      if (body.action === 'set_store_status' && typeof body.active !== 'boolean') return json({ error: 'Choose an active or inactive status' }, 400);
      const ruleError = storeActionError({ owner: Boolean(owner), action: body.action, currentStoreId: caller?.store_id || null, targetStoreId, archived: Boolean(target.archived_at), active: body.active });
      if (ruleError) return json({ error: ruleError }, 400);

      if (body.action === 'list_store_admins' || body.action === 'reset_store_password') {
        const { data: profiles, error: profilesError } = await admin.from('profiles').select('user_id, full_name, email').eq('store_id', targetStoreId);
        if (profilesError) throw profilesError;
        const ids = (profiles || []).map(p => p.user_id);
        const { data: adminRoles, error: adminRolesError } = ids.length ? await admin.from('user_roles').select('user_id').eq('role', 'admin').in('user_id', ids) : { data: [], error: null };
        const { data: owners, error: ownersError } = await admin.from('platform_owners').select('user_id');
        if (adminRolesError || ownersError) throw adminRolesError || ownersError;
        const adminIds = new Set((adminRoles || []).map(r => r.user_id));
        const ownerIds = new Set((owners || []).map(r => r.user_id));
        const admins = (profiles || []).filter(p => adminIds.has(p.user_id) && !ownerIds.has(p.user_id));
        if (body.action === 'list_store_admins') return json({ admins });
        if (!admins.some(p => p.user_id === body.userId)) return json({ error: 'Select a store administrator, not a platform owner' }, 400);
        if (typeof body.password !== 'string' || body.password.length < 6 || body.password.length > 128) return json({ error: 'Password must be between 6 and 128 characters' }, 400);
        const { error: passwordError } = await admin.auth.admin.updateUserById(body.userId, { password: body.password });
        if (passwordError) return json({ error: passwordError.message }, 400);
        return json({ ok: true });
      }

      if (body.action === 'archive_store' && body.confirmName !== target.name) return json({ error: 'Type the store name to confirm archiving' }, 400);
      const { error: updateError } = await admin.from('stores').update(body.action === 'archive_store' ? { is_active: false, archived_at: new Date().toISOString() } : { is_active: body.active }).eq('id', targetStoreId).is('archived_at', null);
      if (updateError) throw updateError;
      return json({ ok: true });
    }
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const fullName = String(body.fullName ?? "").trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Invalid email" }, 400);
    if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);
    if (fullName.length < 2) return json({ error: "Full name is required" }, 400);

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
      const { data: activeStore } = await admin.from('stores').select('is_active, archived_at').eq('id', caller.store_id).single();
      if (!activeStore?.is_active || activeStore.archived_at) return json({ error: 'This store is inactive or archived' }, 403);
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

    const IN_USE = "This email has already been used or assigned to another outlet or shop. Please use a different email.";
    const { data: existing } = await admin.from("profiles").select("user_id").ilike("email", email).limit(1);
    if (existing && existing.length) {
      if (body.action === "create_store") await admin.from("stores").delete().eq("id", storeId);
      return json({ error: IN_USE }, 409);
    }
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: fullName },
    });
    if (cErr) {
      if (body.action === "create_store") await admin.from("stores").delete().eq("id", storeId);
      const dup = /already|registered|exists/i.test(cErr.message);
      return json({ error: dup ? IN_USE : cErr.message }, dup ? 409 : 400);
    }
    const uid = created.user.id;
    await admin.from("profiles").update({ store_id: storeId, branch_id: branchId, full_name: fullName, phone }).eq("user_id", uid);
    await admin.from("user_roles").insert({ user_id: uid, role });
    return json({ ok: true, user_id: uid, store_id: storeId });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
