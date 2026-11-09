// One data interface for the app, backed by Supabase. Local testing can load
// practice data with ?demo=1, and that code is left out of the published site.
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
const wantsDemo = new URLSearchParams(location.search).get("demo") === "1";
export const DEMO = isLocal && wantsDemo;

const unwrap = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

async function liveApi() {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm");
  const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
  });

  const profile = async (user) => {
    if (!user) return null;
    const row = unwrap(await db.from("profiles").select("*").eq("id", user.id).maybeSingle());
    return row || { id: user.id, email: user.email, full_name: user.user_metadata?.full_name, role: "customer" };
  };
  const orderSelect = "*, order_items(*)";

  return {
    async currentProfile() {
      const { data } = await db.auth.getSession();
      return profile(data.session?.user);
    },
    onAuthChange(handler) {
      db.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT") handler();
      });
    },
    async signIn() {
      const settings = await (await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } })).json();
      if (!settings.external?.google) throw new Error("Google sign-in is not switched on yet.");
      unwrap(await db.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: location.origin + location.pathname },
      }));
    },
    async signOut() {
      await db.auth.signOut();
    },
    async products() {
      return unwrap(await db.from("products").select("*").order("sort"));
    },
    async settings() {
      return unwrap(await db.from("store_settings").select("*").eq("id", 1).single());
    },
    async saveSettings(values) {
      unwrap(await db.from("store_settings").update({ ...values, updated_at: new Date().toISOString() }).eq("id", 1));
    },
    async placeOrder(items, address, note) {
      const rows = unwrap(await db.rpc("place_order", { p_items: items, p_address: address, p_note: note }));
      return rows[0];
    },
    async myOrders(userId) {
      return unwrap(await db.from("orders").select(orderSelect).eq("user_id", userId).order("created_at", { ascending: false }));
    },
    async cancelOrder(id) {
      unwrap(await db.rpc("cancel_my_order", { p_order_id: id }));
    },
    async allOrders() {
      return unwrap(await db.from("orders").select(orderSelect).order("created_at", { ascending: false }).limit(300));
    },
    async updateOrder(id, status, tracking, note) {
      unwrap(await db.rpc("owner_update_order", { p_order_id: id, p_status: status, p_tracking: tracking ?? null, p_note: note ?? null }));
    },
    async saveProduct({ id, ...values }) {
      values.updated_at = new Date().toISOString();
      if (id) unwrap(await db.from("products").update(values).eq("id", id));
      else unwrap(await db.from("products").insert(values));
    },
    async upload(file, slug) {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${slug}/${crypto.randomUUID()}.${ext}`;
      unwrap(await db.storage.from("product-media").upload(path, file, { contentType: file.type }));
      return db.storage.from("product-media").getPublicUrl(path).data.publicUrl;
    },
  };
}

export const api = DEMO ? await (await import("./demo.js")).demoApi() : await liveApi();
