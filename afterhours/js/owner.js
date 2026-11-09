import { api } from "./api.js";
import { esc, money, when, toast, openModal, tee, STATUS } from "./ui.js";
import { countUp } from "./motion.js";

export async function pendingCount() {
  const orders = await api.allOrders();
  return orders.filter((o) => o.status === "pending").length;
}

const GROUPS = [
  ["new", "New", ["pending"]],
  ["production", "In production", ["accepted", "printing"]],
  ["shipped", "Shipped", ["dispatched"]],
  ["closed", "Closed", ["delivered", "rejected", "cancelled"]],
];
const NEXT = {
  pending: [["accepted", "Accept order", "primary"], ["rejected", "Decline", ""]],
  accepted: [["printing", "Send to print", "primary"], ["rejected", "Decline", ""]],
  printing: [["dispatched", "Mark dispatched", "primary"]],
  dispatched: [["delivered", "Mark delivered", "primary"]],
};

let orderTab = "new";

const fileLink = (href, label) => (href ? `<a class="file" href="${esc(href)}" download target="_blank" rel="noopener">${label}</a>` : "");

function orderCard(order) {
  const digits = order.phone.replace(/\D/g, "").slice(-10);
  return `<article class="panel order">
    <header class="row-between">
      <div><span class="mono">${esc(order.order_no)}</span><p class="muted small">${when(order.created_at)}</p></div>
      <span class="status ${order.status}">${STATUS[order.status].label}</span>
    </header>
    ${order.order_items.map((item) => `<div class="line slim">
      <div class="thumb">${tee(item, "back")}</div>
      <div class="grow"><h3>${esc(item.name)}</h3><p class="mono muted">Size ${esc(item.size)} × ${item.quantity}</p>
        <div class="files">${fileLink(item.print_file_back, "Back print")}${fileLink(item.print_file_front, "Front print")}</div></div>
      <span>${money(item.unit_price_inr * item.quantity)}</span>
    </div>`).join("")}
    <div class="ship">
      <p><strong>${esc(order.customer_name)}</strong><br>${esc(order.address_line)}<br>${esc(order.city)}, ${esc(order.state)} ${esc(order.pincode)}</p>
      <p class="contact"><a href="tel:+91${digits}">+91 ${digits}</a> <a href="https://wa.me/91${digits}" target="_blank" rel="noopener">WhatsApp</a></p>
      ${order.customer_note ? `<p class="muted">Note: ${esc(order.customer_note)}</p>` : ""}
      ${order.tracking_no ? `<p class="mono small">Tracking: ${esc(order.tracking_no)}</p>` : ""}
    </div>
    <p class="row-between total"><span>Cash on delivery</span><strong>${money(order.total_inr)}</strong></p>
    <div class="row">${(NEXT[order.status] || []).map(([status, label, kind]) => `<button class="btn small ${kind}" data-order="${esc(order.id)}" data-status="${status}">${label}</button>`).join("")}</div>
  </article>`;
}

function askTracking() {
  return new Promise((resolve) => {
    openModal(`<h2>Dispatch order</h2><form id="track" class="form">
      <label class="field"><span>Courier and tracking number (optional)</span><input name="tracking" maxlength="120"></label>
      <button class="btn primary wide">Mark dispatched</button></form>`, (modal, close) => {
      modal.querySelector("#track").addEventListener("submit", (event) => {
        event.preventDefault();
        const tracking = new FormData(event.target).get("tracking");
        close();
        resolve(tracking);
      });
    });
  });
}

function drawOrders(body, orders, ctx) {
  const group = GROUPS.find(([key]) => key === orderTab);
  const shown = orders.filter((o) => group[2].includes(o.status));
  body.innerHTML = `<div class="chips">${GROUPS.map(([key, label, statuses]) => {
    const count = orders.filter((o) => statuses.includes(o.status)).length;
    return `<button class="chip ${key === orderTab ? "on" : ""}" data-tab="${key}">${label} ${count}</button>`;
  }).join("")}<button class="chip" id="reload">Refresh</button></div>
  <div class="orders">${shown.map(orderCard).join("") || '<p class="muted">No orders here.</p>'}</div>`;
  body.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    orderTab = b.dataset.tab;
    drawOrders(body, orders, ctx);
  }));
  body.querySelector("#reload").addEventListener("click", ctx.redraw);
  body.querySelectorAll("[data-order]").forEach((b) => b.addEventListener("click", async () => {
    const status = b.dataset.status;
    if (status === "rejected" && !confirm("Decline this order? The customer will see it as declined.")) return;
    const tracking = status === "dispatched" ? await askTracking() : null;
    try {
      await api.updateOrder(b.dataset.order, status, tracking);
      toast(`Order ${STATUS[status].label.toLowerCase()}`);
      await ctx.refresh();
      await ctx.redraw();
    } catch (error) {
      toast(error.message, "bad");
    }
  }));
}

function stats(orders) {
  const counted = orders.filter((o) => !["rejected", "cancelled"].includes(o.status));
  const tiles = [
    ["Waiting", orders.filter((o) => o.status === "pending").length],
    ["In production", orders.filter((o) => ["accepted", "printing"].includes(o.status)).length],
    ["Orders", counted.length],
    ["Order value", counted.reduce((sum, o) => sum + o.total_inr, 0), true],
  ];
  return `<div class="stats">${tiles.map(([label, value, isMoney]) => `<div class="stat"><span class="mono muted">${label}</span><strong data-n="${value}" ${isMoney ? 'data-money="1"' : ""}>${isMoney ? money(value) : value}</strong></div>`).join("")}</div>`;
}

const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function productForm(product, ctx) {
  const p = product || { name: "", tagline: "", description: "", collection: "Drop 01", price_inr: 899, compare_at_inr: null, sizes: ["S", "M", "L", "XL", "XXL"], status: "live" };
  const upload = (name, label, current) => `<label class="field"><span>${label}${current ? " (replace)" : ""}</span><input type="file" name="${name}" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label>`;
  openModal(`<h2>${product ? "Edit product" : "New product"}</h2>
    <form id="product" class="form">
      <label class="field"><span>Name</span><input name="name" required maxlength="80" value="${esc(p.name)}"></label>
      <label class="field"><span>Tagline</span><input name="tagline" maxlength="120" value="${esc(p.tagline)}"></label>
      <label class="field"><span>Description</span><textarea name="description" rows="3" maxlength="600">${esc(p.description)}</textarea></label>
      <div class="cols">
        <label class="field"><span>Price (₹)</span><input name="price_inr" type="number" min="1" step="1" required value="${p.price_inr}"></label>
        <label class="field"><span>Was price (₹, optional)</span><input name="compare_at_inr" type="number" min="1" step="1" value="${p.compare_at_inr ?? ""}"></label>
      </div>
      <div class="cols">
        <label class="field"><span>Collection</span><input name="collection" required maxlength="40" value="${esc(p.collection)}"></label>
        <label class="field"><span>Visibility</span><select name="status">
          ${[["live", "Live"], ["coming_soon", "Coming soon"], ["hidden", "Hidden"]].map(([v, l]) => `<option value="${v}" ${p.status === v ? "selected" : ""}>${l}</option>`).join("")}
        </select></label>
      </div>
      <label class="field"><span>Sizes, separated by commas</span><input name="sizes" required value="${esc(p.sizes.join(", "))}"></label>
      ${upload("back", "Back graphic (transparent PNG works best)", p.print_back)}
      ${upload("front", "Front graphic", p.print_front)}
      ${upload("model", "Model photo", p.model_image)}
      <p class="error" id="product-error" hidden></p>
      <button class="btn primary wide" id="save">Save product</button>
    </form>`, (modal, close) => {
    modal.querySelector("#product").addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(event.target);
      const errorBox = modal.querySelector("#product-error");
      const button = modal.querySelector("#save");
      const price = Number(data.get("price_inr"));
      const compare = data.get("compare_at_inr") ? Number(data.get("compare_at_inr")) : null;
      const sizes = String(data.get("sizes")).split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      const fail = (message) => { errorBox.textContent = message; errorBox.hidden = false; };
      if (!Number.isInteger(price) || price < 1) return fail("Price must be a whole number of rupees.");
      if (!sizes.length) return fail("Add at least one size.");
      if (!product && !data.get("back").size) return fail("A new product needs a back graphic.");
      button.disabled = true;
      button.textContent = "Saving";
      try {
        const slug = p.slug || `${slugify(String(data.get("name")))}-${Date.now().toString(36)}`;
        const values = {
          name: String(data.get("name")).trim(), tagline: String(data.get("tagline")).trim(), description: String(data.get("description")).trim(),
          collection: String(data.get("collection")).trim(), price_inr: price, compare_at_inr: compare, status: data.get("status"), sizes, slug,
        };
        if (product) values.id = product.id;
        else values.sort = Math.max(0, ...ctx.store.products.map((x) => x.sort)) + 10;
        for (const side of ["back", "front"]) {
          const file = data.get(side);
          if (file.size) {
            const url = await api.upload(file, slug);
            values[`print_${side}`] = url;
            values[`print_file_${side}`] = url;
          }
        }
        if (data.get("model").size) values.model_image = await api.upload(data.get("model"), slug);
        await api.saveProduct(values);
        close();
        toast("Product saved");
        await ctx.refresh();
        await ctx.redraw();
      } catch (error) {
        fail(error.message);
        button.disabled = false;
        button.textContent = "Save product";
      }
    });
  });
}

function drawProducts(body, ctx) {
  const { products } = ctx.store;
  body.innerHTML = `<div class="row-between toolbar"><p class="muted">${products.length} products. Prices save as soon as you leave the box.</p><button class="btn small primary" id="new">Add product</button></div>
  <div class="ptable">${products.map((p) => `<div class="prow" data-id="${esc(p.id)}">
    <div class="thumb">${tee(p, "back")}</div>
    <div class="grow"><h3>${esc(p.name)}</h3><p class="mono muted">${esc(p.collection)}</p></div>
    <label class="inline"><span class="sr">Price of ${esc(p.name)}</span>₹<input class="price-input" type="number" min="1" step="1" value="${p.price_inr}"></label>
    <select class="status-input" aria-label="Visibility of ${esc(p.name)}">${[["live", "Live"], ["coming_soon", "Coming soon"], ["hidden", "Hidden"]].map(([v, l]) => `<option value="${v}" ${p.status === v ? "selected" : ""}>${l}</option>`).join("")}</select>
    <button class="btn small edit">Edit</button>
  </div>`).join("")}</div>`;
  body.querySelector("#new").addEventListener("click", () => productForm(null, ctx));
  body.querySelectorAll(".prow").forEach((row) => {
    const product = products.find((p) => p.id === row.dataset.id);
    const save = async (patch, message) => {
      try {
        await api.saveProduct({ id: product.id, ...patch });
        Object.assign(product, patch);
        toast(message);
      } catch (error) {
        toast(error.message, "bad");
      }
    };
    row.querySelector(".edit").addEventListener("click", () => productForm(product, ctx));
    row.querySelector(".price-input").addEventListener("change", (event) => {
      const price = Number(event.target.value);
      if (!Number.isInteger(price) || price < 1) {
        event.target.value = product.price_inr;
        return toast("Price must be a whole number of rupees", "bad");
      }
      save({ price_inr: price }, `${product.name} is now ${money(price)}`);
    });
    row.querySelector(".status-input").addEventListener("change", (event) => save({ status: event.target.value }, `${product.name} updated`));
  });
}

function drawSettings(body, ctx) {
  const { shipping_inr: fee, free_shipping_over: free } = ctx.store.settings;
  body.innerHTML = `<form id="settings" class="panel form narrow">
    <label class="field"><span>Shipping fee (₹)</span><input name="fee" type="number" min="0" step="1" required value="${fee}"></label>
    <label class="field"><span>Free shipping over (₹)</span><input name="free" type="number" min="0" step="1" required value="${free}"></label>
    <button class="btn primary wide">Save shipping</button></form>`;
  body.querySelector("#settings").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    try {
      await api.saveSettings({ shipping_inr: Number(data.get("fee")), free_shipping_over: Number(data.get("free")) });
      await ctx.refresh();
      toast("Shipping saved");
    } catch (error) {
      toast(error.message, "bad");
    }
  });
}

export async function renderOwner(app, tab, ctx) {
  const active = tab || "orders";
  const openedAt = location.hash;
  const orders = await api.allOrders();
  if (location.hash !== openedAt) return;
  const tabs =[["orders", "Orders"], ["products", "Products"], ["settings", "Shipping"]];
  app.innerHTML = `<section class="section first">
    <div class="head"><span class="mono kicker">Owner console</span><h2>Run the shop</h2></div>
    ${stats(orders)}
    <div class="tabs">${tabs.map(([key, label]) => `<a class="${key === active ? "on" : ""}" href="#/${key}">${label}</a>`).join("")}</div>
    <div id="owner-body"></div>
  </section>`;
  countUp(app);
  const body = document.getElementById("owner-body");
  if (active === "products") drawProducts(body, ctx);
  else if (active === "settings") drawSettings(body, ctx);
  else drawOrders(body, orders, ctx);
}
