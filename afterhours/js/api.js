// One data interface for the app. Live mode talks to Supabase; ?demo=1 on
// localhost uses a browser-only copy so the flows can be tried without Google.
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

async function demoApi() {
  const KEY = "afterhours-demo-v1";
  let state = JSON.parse(localStorage.getItem(KEY) || "null");
  if (!state) {
    const seed = await (await fetch("data/products.json")).json();
    state = {
      products: seed.map((p, i) => ({ ...p, id: `demo-${i}` })),
      settings: { shipping_inr: 79, free_shipping_over: 1499 },
      orders: [],
      user: null,
      next: 1001,
    };
  }
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const people = {
    customer: { id: "demo-customer", email: "customer@demo.local", full_name: "Demo Customer", role: "customer" },
    owner: { id: "demo-owner", email: "owner@demo.local", full_name: "Demo Owner", role: "owner" },
  };
  let authHandler = () => {};
  const flow = { pending: ["accepted", "rejected"], accepted: ["printing", "rejected"], printing: ["dispatched"], dispatched: ["delivered"] };

  return {
    currentProfile: async () => (state.user ? people[state.user] : null),
    onAuthChange: (handler) => { authHandler = handler; },
    async signIn(role = "customer") { state.user = role; save(); authHandler(); },
    async signOut() { state.user = null; save(); authHandler(); },
    products: async () => [...state.products].sort((a, b) => a.sort - b.sort),
    settings: async () => state.settings,
    async saveSettings(values) { Object.assign(state.settings, values); save(); },
    async placeOrder(items, address, note) {
      const lines = items.map((item) => {
        const p = state.products.find((x) => x.id === item.product_id);
        if (!p || p.status !== "live") throw new Error("An item in your bag is no longer available");
        return { id: crypto.randomUUID(), product_id: p.id, name: p.name, size: item.size, quantity: item.quantity, unit_price_inr: p.price_inr,
          print_front: p.print_front, print_back: p.print_back, print_file_front: p.print_file_front, print_file_back: p.print_file_back };
      });
      const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_price_inr, 0);
      const shipping = subtotal >= state.settings.free_shipping_over ? 0 : state.settings.shipping_inr;
      const order = { id: crypto.randomUUID(), order_no: `AH-${state.next++}`, user_id: state.user === "owner" ? people.owner.id : people.customer.id,
        status: "pending", customer_name: address.name, phone: address.phone, address_line: address.line, city: address.city, state: address.state,
        pincode: address.pincode, customer_note: note, owner_note: "", tracking_no: "", payment_method: "cod", subtotal_inr: subtotal, shipping_inr: shipping,
        total_inr: subtotal + shipping, created_at: new Date().toISOString(), order_items: lines };
      state.orders.unshift(order);
      save();
      return { order_id: order.id, order_no: order.order_no, total_inr: order.total_inr };
    },
    myOrders: async (userId) => state.orders.filter((o) => o.user_id === userId),
    async cancelOrder(id) {
      const order = state.orders.find((o) => o.id === id);
      if (order?.status !== "pending") throw new Error("This order can no longer be cancelled");
      order.status = "cancelled";
      save();
    },
    allOrders: async () => state.orders,
    async updateOrder(id, status, tracking, note) {
      const order = state.orders.find((o) => o.id === id);
      if (!flow[order.status]?.includes(status)) throw new Error(`An order that is ${order.status} cannot move to ${status}`);
      order.status = status;
      if (tracking) order.tracking_no = tracking;
      if (note != null) order.owner_note = note;
      save();
    },
    async saveProduct(product) {
      if (product.id) Object.assign(state.products.find((p) => p.id === product.id), product);
      else state.products.push({ ...product, id: crypto.randomUUID() });
      save();
    },
    upload: (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read that file"));
      reader.readAsDataURL(file);
    }),
  };
}

export const api = DEMO ? await demoApi() : await liveApi();
