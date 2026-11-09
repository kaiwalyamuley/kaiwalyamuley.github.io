// Small shared helpers: escaping, money, toasts, modals and the tee mockup.

export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

export const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export const when = (iso) => new Date(iso).toLocaleString("en-IN", {
  day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
});

export function toast(message, kind = "ok") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = message;
  document.getElementById("toasts").append(el);
  setTimeout(() => el.remove(), 4200);
}

export function openModal(html, onReady) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true">
    <button class="modal-x" aria-label="Close" data-close>×</button>${html}</div></div>`;
  const close = () => { root.innerHTML = ""; document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  root.querySelector(".modal-back").addEventListener("mousedown", (e) => {
    if (e.target.classList.contains("modal-back")) close();
  });
  root.querySelector("[data-close]").addEventListener("click", close);
  onReady?.(root.querySelector(".modal"), close);
  return close;
}

export const STATUS = {
  pending: { label: "Awaiting confirmation", step: 0 },
  accepted: { label: "Accepted", step: 1 },
  printing: { label: "Printing", step: 2 },
  dispatched: { label: "Dispatched", step: 3 },
  delivered: { label: "Delivered", step: 4 },
  rejected: { label: "Declined", step: -1 },
  cancelled: { label: "Cancelled", step: -1 },
};

const SHAPE = "M205 58C236 92 364 92 395 58L470 86C512 118 556 164 590 212L512 288L466 244L470 660Q300 680 130 660L134 244L88 288L10 212C44 164 88 118 130 86Z";

function teeSvg(side) {
  const collar = side === "front"
    ? '<path d="M205 58C232 124 368 124 395 58" fill="none" stroke="#35353c" stroke-width="13"/><path d="M216 60C240 110 360 110 384 60C352 76 248 76 216 60Z" fill="#0b0b0d"/>'
    : '<path d="M205 58C236 86 364 86 395 58" fill="none" stroke="#35353c" stroke-width="13"/>';
  return `<svg class="tee-base" viewBox="0 0 600 700" aria-hidden="true">
    <defs>
      <linearGradient id="teeFill-${side}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#232329"/><stop offset=".55" stop-color="#17171b"/><stop offset="1" stop-color="#101013"/></linearGradient>
    </defs>
    <path d="${SHAPE}" fill="url(#teeFill-${side})" stroke="#2e2e35" stroke-width="2"/>
    <g fill="none" stroke="#fff" stroke-opacity=".035" stroke-width="10" stroke-linecap="round">
      <path d="M170 300C190 420 168 540 182 640"/><path d="M430 330C410 440 436 540 418 640"/><path d="M134 244C142 210 150 170 160 130"/><path d="M466 244C458 210 450 170 440 130"/>
    </g>
    ${collar}
  </svg>`;
}

/** A black tee with the print placed where it will sit on the real shirt. */
export function tee(product, side = "back") {
  const src = side === "front" ? product.print_front : product.print_back;
  const art = src ? `<img class="tee-print ${side}" src="${esc(src)}" alt="" loading="lazy">` : "";
  return `<div class="tee">${teeSvg(side)}${art}</div>`;
}
