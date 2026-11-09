// The owner console page. Only an owner account can load its data;
// the database enforces that, and this gate explains it.
import { api, DEMO } from "./api.js";
import { esc, toast, GOOGLE_ICON } from "./ui.js";
import { renderOwner, pendingCount } from "./owner.js";
import { pageSwap, markLogin, consumeLogin, playLogin } from "./motion.js";

const app = document.getElementById("app");
const nav = document.getElementById("nav");
const store = { profile: null, products: [], settings: { shipping_inr: 79, free_shipping_over: 1499 }, ownerPending: 0 };
let polling;

async function refresh() {
  [store.products, store.settings, store.ownerPending] = await Promise.all([api.products(), api.settings(), pendingCount()]);
}

function drawNav() {
  nav.innerHTML = `<nav class="nav">
    <a class="brand" href="#/orders" aria-label="Owner console"><img src="assets/brand/logo-small.webp" alt="AfterHours"></a>
    <div class="links">
      <span class="mono owner-chip">Owner${store.ownerPending ? `<b class="pill">${store.ownerPending}</b>` : ""}</span>
      <a href="index.html" target="_blank" rel="noopener">View store</a>
      <button class="link" id="sign-out">Sign out</button>
    </div>
  </nav>`;
  document.getElementById("sign-out").addEventListener("click", () => api.signOut());
}

function gate() {
  nav.innerHTML = "";
  clearInterval(polling);
  app.innerHTML = `<section class="gate">
    <div class="gate-grid" aria-hidden="true"></div>
    <div class="gate-card">
      <img class="gate-logo" src="assets/brand/logo.webp" alt="AfterHours">
      <div class="boot mono" aria-hidden="true"><p style="--i:0">AH//CONTROL</p><p style="--i:1">Owner sign-in required</p></div>
      <h1>Owners only</h1>
      <button class="btn google wide" id="owner-signin">${DEMO ? "Enter practice console" : `${GOOGLE_ICON} Continue with Google`}</button>
      <p class="error" id="gate-error" hidden></p>
      <a class="gate-back" href="index.html">Back to the store</a>
    </div>
  </section>`;
  const button = document.getElementById("owner-signin");
  button.addEventListener("click", async () => {
    markLogin();
    button.disabled = true;
    button.classList.add("working");
    try {
      await api.signIn("owner");
    } catch (error) {
      consumeLogin();
      const box = document.getElementById("gate-error");
      box.textContent = error.message;
      box.hidden = false;
      button.disabled = false;
      button.classList.remove("working");
    }
  });
}

function denied() {
  nav.innerHTML = "";
  clearInterval(polling);
  app.innerHTML = `<section class="gate">
    <div class="gate-grid red" aria-hidden="true"></div>
    <div class="gate-card shake">
      <img class="gate-logo" src="assets/brand/logo.webp" alt="AfterHours">
      <h1>Access denied</h1>
      <p class="muted">${esc(store.profile.email)} is not an owner account.</p>
      <button class="btn wide" id="switch">Use a different account</button>
      <a class="gate-back" href="index.html">Back to the store</a>
    </div>
  </section>`;
  document.getElementById("switch").addEventListener("click", () => api.signOut());
}

async function route() {
  const tab = (location.hash || "#/orders").split("/")[1] || "orders";
  await pageSwap(app, async () => {
    window.scrollTo({ top: 0, behavior: "instant" });
    try {
      await renderOwner(app, tab, { store, refresh, redraw: route });
    } catch (error) {
      app.innerHTML = `<section class="section first empty"><h2>The console could not load.</h2><p class="muted">${esc(error.message)}</p></section>`;
    }
  });
  drawNav();
}

function watchOrders() {
  clearInterval(polling);
  polling = setInterval(async () => {
    if (document.hidden || document.querySelector(".modal")) return;
    try {
      const before = store.ownerPending;
      store.ownerPending = await pendingCount();
      if (store.ownerPending > before) {
        toast("New order received");
        await refresh();
        await route();
      } else if (store.ownerPending !== before) {
        drawNav();
      }
    } catch { /* the next check will try again */ }
  }, 20000);
}

let started = false;

async function show() {
  const justSignedIn = consumeLogin();
  store.profile = await api.currentProfile();
  if (!store.profile) {
    started = false;
    return gate();
  }
  if (store.profile.role !== "owner") {
    started = false;
    return denied();
  }
  if (justSignedIn) playLogin({ name: store.profile.full_name || store.profile.email, owner: true });
  if (started) return;
  started = true;
  await refresh();
  await route();
  watchOrders();
}

document.getElementById("demo-bar").hidden = !DEMO;
window.addEventListener("hashchange", () => { if (started) route(); });
api.onAuthChange(show);
show().catch((error) => {
  app.innerHTML = `<section class="section first empty"><h2>The console could not load.</h2><p class="muted">${esc(error.message)}</p></section>`;
});
