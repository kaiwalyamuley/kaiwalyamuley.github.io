/* SupeRR Pressure Selector: web dashboard. Data comes from tools/09_export_web.py. */
const C = { navy: "#0b1b4d", royal: "#254aa5", pink: "#e21982", gold: "#d6ae3c", teal: "#0e9f8e", rose: "#d94b62", ord: "#c7d0e6", muted: "#5a6684", grid: "#e8ecf5" };
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v, d = 1) => (v == null || isNaN(v) ? "–" : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
const sign = (v, d = 1) => (v == null ? "–" : (v > 0 ? "+" : "") + num(v, d));
const ini = (n) => { const p = n.replace(/\(.*\)/, "").trim().split(/\s+/); return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase(); };
const av = (name, disc, cls = "") => `<span class="av ${disc === "bowling" || disc === "Bowling" || disc === "Bowler" ? "bowl" : ""} ${cls}">${esc(ini(name))}</span>`;
let D, charts = {}, rendered = {}, state = { disc: "batting", sort: { k: "Rank", dir: 1 }, scout: null, matchCache: {} };

Chart.defaults.font.family = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';
Chart.defaults.font.size = 12.5;
Chart.defaults.color = C.muted;
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.maintainAspectRatio = false;
function chart(id, cfg) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart(document.getElementById(id), cfg); }
const gridOpts = (extra = {}) => ({ grid: { color: C.grid }, border: { display: false }, ...extra });

fetch("data/core.json").then((r) => r.json()).then((d) => { D = d; $("#loading").remove(); route(); addEventListener("hashchange", route); })
  .catch(() => { $("#loading").textContent = "The data could not be loaded. Please refresh the page."; });

/* ---------- routing ---------- */
const VIEWS = { overview: overview, rankings: rankings, scout: scout, compare: compare, replay: replay, method: method, glossary: glossary };
function route() {
  const id = (location.hash.slice(1) || "overview").split("/")[0];
  const v = VIEWS[id] ? id : "overview";
  document.querySelectorAll(".view").forEach((s) => s.classList.toggle("on", s.id === v));
  document.querySelectorAll("#tabs a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + v));
  if (!rendered[v] || v === "scout") { VIEWS[v](); rendered[v] = true; }
  if (document.activeElement && document.activeElement.closest && document.activeElement.closest("#tabs")) scrollTo({ top: 0 });
}

/* ---------- overview ---------- */
function overview() {
  const k = D.kpi;
  $("#kpis").innerHTML = [[num(k.matches, 0), "matches analysed"], [num(k.deliveries, 0), "deliveries rated"], [k.batters, "batters rated"], [k.bowlers, "bowlers rated"]]
    .map(([b, s]) => `<div class="kpi"><b>${b}</b><span>${s}</span></div>`).join("");
  const list = (rows, disc, rateKey) => rows.map((r) => {
    const max = 50, lo = (r["Rank Low"] - 1) / (max - 1) * 100, hi = (Math.min(r["Rank High"], max) - 1) / (max - 1) * 100, at = (r.Rank - 1) / (max - 1) * 100;
    return `<div class="rrow ${disc}"><span class="n">${r.Rank}</span>${av(r.Player, disc)}<span class="nm"><b>${esc(r.Player)}</b><small>${esc(r.Role)} &middot; ${rateKey(r)}</small></span>
      <span class="range" title="90% rank range: ${r["Rank Low"]} to ${r["Rank High"]}"><i style="left:${lo}%;width:${Math.max(hi - lo, 1.5)}%"></i><em style="left:${at}%"></em></span><span class="rt">${num(r.Rating)}</span></div>`;
  }).join("");
  $("#ub").innerHTML = list(D.unstop_batters, "bat", (r) => `SR ${num(r["Pressure SR"])} under pressure`);
  $("#uw").innerHTML = list(D.unstop_bowlers, "bowl", (r) => `economy ${num(r["Pressure Economy"], 2)} under pressure`);
  const fin = D.shortlist.filter((s) => s.Decision === "Final Top 10").sort((a, b) => a["Final Rank"] - b["Final Rank"]);
  $("#final").innerHTML = `<thead><tr><th>#</th><th>Player</th><th>Role</th><th>Nation</th><th>Last IPL team</th><th class="num">Pressure</th><th class="num">Potential</th><th class="num">RR fit</th><th class="num">Final</th><th class="num">Rank range</th></tr></thead><tbody>` +
    fin.map((s) => `<tr data-k="${s.PlayerKey}"><td>${s["Final Rank"]}</td><td><span class="who">${av(s.Player, s.Discipline)}<b>${esc(s.Player)}</b></span></td><td>${esc(s.Role)}</td><td>${esc(s.Nation)}</td><td>${esc(s["Last IPL Team"])}</td>
      <td class="num">${num(s["Pressure Rating"])}</td><td class="num">${num(s["Potential Score"])}</td><td class="num">${num(s["RR Fit"])}</td><td class="num"><b>${num(s["Final Score"])}</b></td><td class="num">${esc(s["Rank Range"])}</td></tr>`).join("") + "</tbody>";
  $("#final").onclick = (e) => { const tr = e.target.closest("tr[data-k]"); if (tr) { state.scout = +tr.dataset.k; location.hash = "#scout"; } };
  const b = D.bands.filter((x) => x.Discipline === "Batting"), sw = b.find((x) => x["Pressure Band"] === "Extreme")["Win Prob Swing"] / b.find((x) => x["Pressure Band"] === "Ordinary")["Win Prob Swing"];
  const gap = D.rr_gaps.find((x) => x.Discipline === "Bowling" && x.Phase === "Death 17-20" && x.Pressure === "Pressure");
  const rel = (d) => D.reliability.find((x) => x.Discipline === d && x.Metric === "Overall rating").Reliability;
  $("#f1").textContent = `An Extreme-pressure ball moves the result ${num(sw)} times as much as an ordinary ball. That is why the ratings weigh these balls most.`;
  $("#f2").textContent = `Death bowling under pressure: RR conceded ${num(gap["RR rate"], 2)} an over in 2025-26, against ${num(gap["IPL rate"], 2)} for the rest of the IPL. Josh Hazlewood tops both the bowling list and the RR list.`;
  $("#f3").textContent = `Read ranks as bands, not exact places. Rating reliability is moderate (${num(rel("Batting"), 2)} for batters, ${num(rel("Bowling"), 2)} for bowlers), so a rank range is shown for every player.`;
}

/* ---------- rankings ---------- */
const RK = {
  batting: [["Rank", "#", 0], ["Player", "Player"], ["Role", "Role"], ["Rating", "Rating", 1], ["Pressure Value", "Value under pressure", 1, true], ["Ordinary Value", "Value ordinary", 1, true], ["Uplift", "Uplift", 1, true], ["Pressure Balls", "Pressure balls", 0], ["Pressure SR", "SR pressure", 1], ["Ordinary SR", "SR ordinary", 1], ["P Top 10", "Top-10 chance %", 0], ["Rank Low", "Rank range"]],
  bowling: [["Rank", "#", 0], ["Player", "Player"], ["Role", "Role"], ["Rating", "Rating", 1], ["Pressure Value", "Value under pressure", 1, true], ["Ordinary Value", "Value ordinary", 1, true], ["Uplift", "Uplift", 1, true], ["Pressure Balls", "Pressure balls", 0], ["Pressure Economy", "Econ pressure", 2], ["Ordinary Economy", "Econ ordinary", 2], ["Pressure Wickets per 100", "Wkts per 100", 1], ["P Top 10", "Top-10 chance %", 0], ["Rank Low", "Rank range"]],
};
function rankings() {
  const seg = $("#discSeg");
  seg.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; state.disc = b.dataset.d; state.sort = { k: "Rank", dir: 1 }; seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); fillRoles(); drawRank(); };
  $("#rkSearch").oninput = drawRank; $("#rkRole").onchange = drawRank;
  fillRoles(); drawRank();
}
function fillRoles() { const roles = [...new Set(D[state.disc].map((r) => r.Role))].sort(); $("#rkRole").innerHTML = `<option value="">All roles</option>` + roles.map((r) => `<option>${esc(r)}</option>`).join(""); }
function drawRank() {
  const cols = RK[state.disc], q = $("#rkSearch").value.trim().toLowerCase(), role = $("#rkRole").value, { k, dir } = state.sort;
  const rows = D[state.disc].filter((r) => (!q || r.Player.toLowerCase().includes(q)) && (!role || r.Role === role))
    .sort((a, b) => (typeof a[k] === "string" ? a[k].localeCompare(b[k]) : a[k] - b[k]) * dir);
  const t = $("#rk"); t.className = "tbl sortable " + state.disc;
  t.innerHTML = `<thead><tr>${cols.map(([c, l, d]) => `<th data-k="${c}" class="${d !== undefined ? "num" : ""} ${c === k ? (dir > 0 ? "asc" : "desc") : ""}">${l}</th>`).join("")}</tr></thead><tbody>` +
    rows.map((r) => `<tr class="${r.Rank <= 10 ? "top10" : ""}">${cols.map(([c, , d, sg]) => {
      if (c === "Player") return `<td><span class="who">${av(r.Player, state.disc)}<b>${esc(r.Player)}</b></span></td>`;
      if (c === "Rating") return `<td class="num"><span class="pc"><span class="bar"><i style="width:${r.Rating}%"></i></span><b>${num(r.Rating)}</b></span></td>`;
      if (c === "Rank Low") return `<td class="num">${r["Rank Low"]} to ${r["Rank High"]}</td>`;
      if (d === undefined) return `<td>${esc(r[c])}</td>`;
      return `<td class="num">${sg ? sign(r[c], d) : num(r[c], d)}</td>`;
    }).join("")}</tr>`).join("") + `</tbody>`;
  if (!rows.length) t.innerHTML += `<tbody><tr><td colspan="${cols.length}" class="muted">No player matches that search.</td></tr></tbody>`;
  t.querySelector("thead").onclick = (e) => { const th = e.target.closest("th"); if (!th) return; const nk = th.dataset.k; state.sort = { k: nk, dir: nk === state.sort.k ? -state.sort.dir : (["Rank", "Player", "Role", "Rank Low", "Pressure Economy", "Ordinary Economy"].includes(nk) ? 1 : -1) }; drawRank(); };
}

/* ---------- scouting ---------- */
function scout() {
  const sl = [...D.shortlist].sort((a, b) => a["Shortlist Rank"] - b["Shortlist Rank"]);
  if (!state.scout) state.scout = sl[0].PlayerKey;
  $("#scoutPills").innerHTML = sl.map((s) => `<button data-k="${s.PlayerKey}" class="${s.Decision === "Final Top 10" ? "final" : ""} ${s.PlayerKey === state.scout ? "on" : ""}">${s["Shortlist Rank"]}. ${esc(s.Player)}</button>`).join("");
  $("#scoutPills").onclick = (e) => { const b = e.target.closest("button"); if (b) { state.scout = +b.dataset.k; scout(); } };
  const s = sl.find((x) => x.PlayerKey === state.scout), n = s.Discipline === "Bowler" ? D.kpi.bowlers : D.kpi.batters;
  const tag = s.Decision === "Final Top 10" ? `<span class="tag top">RR Final Top 10 &middot; #${s["Final Rank"]}</span>` : `<span class="tag">${esc(s.Decision)}</span>`;
  $("#scoutHead").innerHTML = `${av(s.Player, s.Discipline, "lg")}<div><h1 style="font-size:28px">${esc(s.Player)} ${tag}</h1><p class="meta">${esc(s.Role)} &middot; ${esc(s.Nation)} &middot; Most recent IPL team: ${esc(s["Last IPL Team"])}</p>
    <div class="tiles">${[["Pressure rating", num(s["Pressure Rating"])], ["Rank", `${s["Discipline Rank"]} of ${n}`], ["Under pressure", esc(s["Rate Under Pressure"])], ["Ordinary", esc(s["Rate Ordinary"])], ["Potential", num(s["Potential Score"])], ["RR fit", num(s["RR Fit"])], ["Final score", num(s["Final Score"])], ["Rank range", esc(s["Rank Range"])]]
      .map(([a, b]) => `<div class="tile"><span>${a}</span><b>${b}</b></div>`).join("")}</div></div>`;
  $("#scoutText").innerHTML = ["Player Profile", "Key Statistical Evidence", "Strengths", "Weaknesses", "Tactical Role", "Why RR Should Invest"].map((c) => `<article class="card textcard"><h3>${c}</h3><p>${esc(s[c])}</p></article>`).join("");
  waterfall("cWater", D.breakdown[s.Label] || []);
  const sk = D.skills[s.Label] || [];
  chart("cSkill", { type: "bar", data: { labels: sk.map((x) => x[0]), datasets: [{ data: sk.map((x) => x[1]), backgroundColor: s.Discipline === "Bowler" ? C.pink : C.royal, borderRadius: 4 }] },
    options: { indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `Beats ${num(c.raw)}% of rated players` } } }, scales: { x: gridOpts({ min: 0, max: 100 }), y: { grid: { display: false } } } } });
  const comp = [["Pressure", "Pressure Component", C.pink], ["Quality", "Quality Component", C.royal], ["Recent form", "Recent Form Component", C.teal], ["Trend", "Trajectory Component", C.gold], ["Versatility", "Versatility Component", "#7a35a0"], ["Availability", "Availability Component", "#8d99ae"], ["All-round", "All-Round Bonus", C.rose]];
  chart("cPot", { type: "bar", data: { labels: comp.map((c) => c[0]), datasets: [{ data: comp.map((c) => s[c[1]]), backgroundColor: comp.map((c) => c[2]), borderRadius: 4 }] },
    options: { indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${num(c.raw)} points` } } }, scales: { x: gridOpts({ min: 0 }), y: { grid: { display: false } } } } });
}
function waterfall(id, parts) {
  let run = 0; const lab = [], val = [], col = [];
  parts.forEach(([c, p], i) => { if (i === 0) { val.push([0, p]); col.push(C.royal); run = p; } else { val.push([run, run + p]); col.push(p >= 0 ? C.teal : C.rose); run += p; } lab.push(c === "Average player" ? "Start (average)" : c); });
  lab.push("Rating"); val.push([0, run]); col.push(C.navy);
  chart(id, { type: "bar", data: { labels: lab, datasets: [{ data: val, backgroundColor: col, borderRadius: 3 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => { const [a, b] = c.raw; return c.dataIndex === 0 || c.dataIndex === lab.length - 1 ? num(b) : sign(b - a); } } } },
      scales: { y: gridOpts({ min: 0, max: 100 }), x: { grid: { display: false }, ticks: { maxRotation: 50, minRotation: 30, font: { size: 11 } } } } } });
}

/* ---------- compare ---------- */
function compare() {
  $("#plist").innerHTML = D.players.map((p) => `<option value="${esc(p.label)}">`).join("");
  const a = $("#cmpA"), b = $("#cmpB");
  a.value = "Heinrich Klaasen (Batting)"; b.value = "Suryakumar Yadav (Batting)";
  const go = () => drawCompare(); a.onchange = go; b.onchange = go; a.oninput = () => D.players.some((p) => p.label === a.value) && go(); b.oninput = () => D.players.some((p) => p.label === b.value) && go();
  [a, b].forEach((el) => el.onfocus = () => el.select());
  drawCompare();
}
function drawCompare() {
  const A = D.players.find((p) => p.label === $("#cmpA").value), B = D.players.find((p) => p.label === $("#cmpB").value);
  if (!A || !B) return;
  const n = (p) => (p.disc === "Bowling" ? D.kpi.bowlers : D.kpi.batters), d = (p) => (p.keyname === "economy" ? 2 : 1);
  const rows = [["Discipline", A.disc, B.disc], ["Role", A.role, B.role], ["Pressure rating", num(A.rating), num(B.rating)], ["Rank", `${A.rank} of ${n(A)}`, `${B.rank} of ${n(B)}`], ["Pressure balls", num(A.balls, 0), num(B.balls, 0)],
    ["Under pressure", `${num(A.press, d(A))} ${A.keyname}`, `${num(B.press, d(B))} ${B.keyname}`], ["Ordinary", `${num(A.ord, d(A))} ${A.keyname}`, `${num(B.ord, d(B))} ${B.keyname}`], ["Trust in pressure record", num(A.trust) + "%", num(B.trust) + "%"]];
  $("#cmpT").innerHTML = `<thead><tr><th></th><th><span class="who">${av(A.player, A.disc)}${esc(A.player)}</span></th><th><span class="who">${av(B.player, B.disc)}${esc(B.player)}</span></th></tr></thead><tbody>` +
    rows.map((r) => `<tr><td class="muted">${r[0]}</td><td><b>${esc(r[1])}</b></td><td><b>${esc(r[2])}</b></td></tr>`).join("") + "</tbody>";
  const sa = D.skills[A.label] || [], sb = Object.fromEntries(D.skills[B.label] || []);
  chart("cCmp", { type: "bar", data: { labels: sa.map((x) => x[0]), datasets: [{ label: A.player, data: sa.map((x) => x[1]), backgroundColor: C.royal, borderRadius: 3 }, { label: B.player, data: sa.map((x) => sb[x[0]] ?? null), backgroundColor: C.pink, borderRadius: 3 }] },
    options: { indexAxis: "y", plugins: { legend: { position: "top", align: "start" } }, scales: { x: gridOpts({ min: 0, max: 100 }), y: { grid: { display: false } } } } });
}

/* ---------- replay ---------- */
function replay() {
  const sel = $("#mSel"), wk = D.matches.find((m) => m[1] === D.worked.match);
  const fill = () => {
    const q = $("#mSearch").value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = D.matches.filter((m) => q.every((w) => m[1].toLowerCase().includes(w)));
    const cur = +sel.value;
    sel.innerHTML = list.length ? list.map((m) => `<option value="${m[0]}">${esc(m[1])}</option>`).join("") : `<option value="">No match found</option>`;
    if (list.some((m) => m[0] === cur)) sel.value = cur; else if (list.length) { sel.value = list[0][0]; loadMatch(list[0][0]); }
  };
  $("#mSearch").oninput = fill; sel.onchange = () => sel.value && loadMatch(+sel.value);
  fill(); if (wk) { sel.value = wk[0]; loadMatch(wk[0]); }
}
async function loadMatch(key) {
  const m = D.matches.find((x) => x[0] === key); if (!m) return;
  let d = state.matchCache[key];
  if (!d) { try { d = await (await fetch(`data/m/${key}.json`)).json(); state.matchCache[key] = d; } catch { $("#mKpi").innerHTML = `<div class="kpi"><b>Could not load this match</b></div>`; return; } }
  if (+$("#mSel").value !== key) return;
  $("#mKpi").innerHTML = [[esc(m[2]), "Result"], [num(m[3]), "Peak pressure"], [m[5], "Pressure balls"], [m[4], "Extreme balls"]].map(([b, s]) => `<div class="kpi"><b>${b}</b><span>${s}</span></div>`).join("");
  $("#mTitle").textContent = `Win chance of ${m[6]}, ball by ball (%)`;
  const balls = d.b.map((x) => x[0]);
  chart("cWin", { type: "line", data: { labels: balls, datasets: [{ data: d.b.map((x) => x[2]), borderColor: C.royal, borderWidth: 2.5, pointRadius: 0, tension: 0.15, fill: { target: { value: 50 }, above: "rgba(37,74,165,.08)", below: "rgba(226,25,130,.08)" } }] },
    options: { interaction: { mode: "index", intersect: false }, plugins: { legend: { display: false }, tooltip: { callbacks: { title: (c) => `Ball ${c[0].label} (${d.b[c[0].dataIndex][1] === 1 ? "first innings" : "chase"})`, label: (c) => `${m[6]} win chance ${num(c.raw)}%` } } },
      scales: { y: gridOpts({ min: 0, max: 100 }), x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } } } } });
  const bc = [C.ord, C.gold, C.pink], bn = ["Ordinary", "High", "Extreme"];
  chart("cPress", { type: "bar", data: { labels: balls, datasets: [{ data: d.b.map((x) => x[3]), backgroundColor: d.b.map((x) => bc[x[4]]), barPercentage: 1, categoryPercentage: 1 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { title: (c) => `Ball ${c[0].label}`, label: (c) => `Pressure ${num(c.raw)} (${bn[d.b[c.dataIndex][4]]})` } } },
      scales: { y: gridOpts({ min: 0, max: 100 }), x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } } } } });
  $("#mTurn").innerHTML = d.t.length ? d.t.map((t) => `<li><span class="ov">${num(t[0])}</span><span>${esc(t[2])}<small>${esc(t[1])} &middot; Pressure ${num(t[4], 0)}</small></span><span class="sw">${num(t[3])}</span></li>`).join("") : `<li><span></span><span class="muted">No large swings in this match.</span><span></span></li>`;
}

/* ---------- method ---------- */
function method() {
  const w = D.worked;
  $("#wkBall").innerHTML = `<h2>A real ball</h2><p class="sub">${esc(w.match.split(" | ").slice(1).join(" | "))}</p>
    <p>${esc(w.chasing)} were chasing ${w.target}: ${w.score} for ${w.wkts}, ${w.need} needed from ${w.balls_left} balls (required rate ${num(w.rrr, 2)}).</p>
    <p>${esc(w.bowler)} bowling to ${esc(w.striker)}. Win chance before the ball: <b>${num(w.wp)}%</b>.</p>
    <p class="big">${num(w.pi)} <span class="tag top">${esc(w.band)}</span></p><p class="muted">Pressure Index for this ball. In batting, ${w.lo} or more is High and ${w.hi} or more is Extreme.</p>`;
  $("#wkSub").textContent = `Change in ${w.chasing}'s win chance (percentage points) for each possible outcome. Leverage measures this spread.`;
  const o = D.worked_outcomes;
  chart("cOut", { type: "bar", data: { labels: o.map((x) => x.Outcome), datasets: [{ data: o.map((x) => x.Change), backgroundColor: o.map((x) => (x.Change >= 0 ? C.teal : C.rose)), borderRadius: 3 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${sign(c.raw)} points (chance of this outcome ${num(o[c.dataIndex].Chance)}%)` } } }, scales: { y: gridOpts(), x: { grid: { display: false } } } } });
  $("#wkTot").textContent = `Reading x weight = points. Total ${num(w.pi)}, so ${w.band} pressure.`;
  $("#wkIdx").innerHTML = `<thead><tr><th>Ingredient</th><th class="num">Reading</th><th class="num">Weight</th><th class="num">Points</th></tr></thead><tbody>` +
    D.worked_index.map((x) => `<tr><td>${esc(x.Ingredient)}</td><td class="num">${num(x.Reading)}</td><td class="num">${num(x.Weight, 2)}</td><td class="num"><b>${num(x.Points, 2)}</b></td></tr>`).join("") +
    `<tr><td><b>Pressure Index</b></td><td></td><td></td><td class="num"><b>${num(w.pi)}</b></td></tr></tbody>`;
  const bandsOrder = ["Ordinary", "High", "Extreme"], bd = (disc) => bandsOrder.map((b) => D.bands.find((x) => x.Discipline === disc && x["Pressure Band"] === b)["Win Prob Swing"]);
  chart("cSwing", { type: "bar", data: { labels: bandsOrder, datasets: [{ label: "Batting", data: bd("Batting"), backgroundColor: C.royal, borderRadius: 3 }, { label: "Bowling", data: bd("Bowling"), backgroundColor: C.gold, borderRadius: 3 }] },
    options: { plugins: { legend: { position: "top", align: "start" } }, scales: { y: gridOpts({ min: 0 }), x: { grid: { display: false } } } } });
  const ph = [...new Set(D.phase.sort((a, b) => a["Phase Order"] - b["Phase Order"]).map((x) => x.Phase))];
  const phName = { Powerplay: "Powerplay (1-6)", "Middle 7-11": "Overs 7-11", "Middle 12-16": "Overs 12-16", "Death 17-20": "Death (17-20)" };
  chart("cPhase", { type: "bar", data: { labels: ph.map((p) => phName[p] || p), datasets: bandsOrder.map((b, i) => ({ label: b, data: ph.map((p) => (D.phase.find((x) => x.Phase === p && x["Pressure Band"] === b)?.Share || 0) * 100), backgroundColor: [C.ord, C.gold, C.pink][i] })) },
    options: { indexAxis: "y", plugins: { legend: { position: "top", align: "start" }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${num(c.raw)}%` } } }, scales: { x: gridOpts({ stacked: true, min: 0, max: 100, ticks: { callback: (v) => v + "%" } }), y: { stacked: true, grid: { display: false } } } } });
  const gp = D.rr_gaps.filter((x) => x.Pressure === "Pressure"), gph = [...new Set(gp.sort((a, b) => a["Phase Order"] - b["Phase Order"]).map((x) => x.Phase))];
  chart("cGap", { type: "bar", data: { labels: gph, datasets: ["Batting", "Bowling"].map((dd, i) => ({ label: dd, data: gph.map((p) => gp.find((x) => x.Phase === p && x.Discipline === dd)?.["Gap to IPL"]), backgroundColor: i ? C.gold : C.royal, borderRadius: 3 })) },
    options: { plugins: { legend: { position: "top", align: "start" }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${sign(c.raw)}` } } }, scales: { y: gridOpts(), x: { grid: { display: false } } } } });
  const rm = [...new Set(D.reliability.map((x) => x.Metric))];
  chart("cRel", { type: "bar", data: { labels: rm, datasets: ["Batting", "Bowling"].map((dd, i) => ({ label: dd, data: rm.map((m) => D.reliability.find((x) => x.Metric === m && x.Discipline === dd)?.Reliability), backgroundColor: i ? C.gold : C.royal, borderRadius: 3 })) },
    options: { indexAxis: "y", plugins: { legend: { position: "top", align: "start" } }, scales: { x: gridOpts({ min: 0, max: 1 }), y: { grid: { display: false } } } } });
  $("#scen").innerHTML = `<thead><tr><th>Discipline</th><th>Scenario</th><th class="num">Players rated</th><th class="num">Top 10 kept</th><th class="num">Rank correlation</th></tr></thead><tbody>` +
    D.scenarios.map((x) => `<tr><td>${esc(x.Discipline)}</td><td>${esc(x.Scenario)}</td><td class="num">${x.Eligible}</td><td class="num"><b>${x["Top 10 Retained"]}</b> of ${x["Still Eligible"]}</td><td class="num">${num(x["Rank Correlation"], 2)}</td></tr>`).join("") + "</tbody>";
  $("#dq").innerHTML = `<thead><tr><th>Issue</th><th class="num">Records</th><th>Treatment</th></tr></thead><tbody>` +
    D.quality.map((x) => `<tr><td>${esc(x.Issue)}</td><td class="num">${num(x.Records, 0)}</td><td>${esc(x.Treatment)}</td></tr>`).join("") + "</tbody>";
}

/* ---------- glossary ---------- */
function glossary() {
  const groups = [...new Set(D.dictionary.map((x) => x.Group))];
  $("#gGroup").innerHTML = `<option value="">All topics</option>` + groups.map((g) => `<option>${esc(g)}</option>`).join("");
  const draw = () => {
    const q = $("#gSearch").value.trim().toLowerCase(), g = $("#gGroup").value;
    const list = D.dictionary.filter((x) => (!g || x.Group === g) && (!q || (x.Term + " " + x["Plain English"]).toLowerCase().includes(q)));
    $("#gList").innerHTML = list.length ? list.map((x) => `<article class="card"><span class="grp">${esc(x.Group)}</span><h3>${esc(x.Term)}</h3><p>${esc(x["Plain English"])}</p><code>${esc(x.Formula)}</code><p class="ex">Example: ${esc(x["Worked Example"])}</p></article>`).join("") : `<p class="muted">No term matches that search.</p>`;
  };
  $("#gSearch").oninput = draw; $("#gGroup").onchange = draw; draw();
}
