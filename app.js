// All 50 US states plus Washington D.C., with their spot on the tile map [row, col].
const STATES = [
  ["AL","Alabama",6,7],["AK","Alaska",0,0],["AZ","Arizona",5,2],["AR","Arkansas",5,5],
  ["CA","California",4,1],["CO","Colorado",4,3],["CT","Connecticut",3,10],["DE","Delaware",4,10],
  ["DC","District of Columbia",5,9],["FL","Florida",7,9],["GA","Georgia",6,8],["HI","Hawaii",7,0],
  ["ID","Idaho",2,2],["IL","Illinois",2,6],["IN","Indiana",3,6],["IA","Iowa",3,5],
  ["KS","Kansas",5,4],["KY","Kentucky",4,6],["LA","Louisiana",6,5],["ME","Maine",0,11],
  ["MD","Maryland",4,9],["MA","Massachusetts",2,10],["MI","Michigan",2,7],["MN","Minnesota",2,5],
  ["MS","Mississippi",6,6],["MO","Missouri",4,5],["MT","Montana",2,3],["NE","Nebraska",4,4],
  ["NV","Nevada",3,2],["NH","New Hampshire",1,11],["NJ","New Jersey",3,9],["NM","New Mexico",5,3],
  ["NY","New York",2,9],["NC","North Carolina",5,7],["ND","North Dakota",2,4],["OH","Ohio",3,7],
  ["OK","Oklahoma",6,4],["OR","Oregon",3,1],["PA","Pennsylvania",3,8],["RI","Rhode Island",3,11],
  ["SC","South Carolina",5,8],["SD","South Dakota",3,4],["TN","Tennessee",5,6],["TX","Texas",7,4],
  ["UT","Utah",4,2],["VT","Vermont",1,10],["VA","Virginia",4,8],["WA","Washington",2,1],
  ["WV","West Virginia",4,7],["WI","Wisconsin",1,6],["WY","Wyoming",3,3],
].map(([code, name, row, col]) => ({ code, name, row, col }));

const RANKS = [
  [0, "Rookie Spotter"], [5, "Road Tripper"], [15, "Highway Hunter"],
  [25, "Interstate Expert"], [40, "Plate Master"], [51, "LEGENDARY Collector"],
];
const PLAYER_COLORS = ["var(--p1)", "var(--p2)"];
const SOLO_COLOR = "var(--good)";

const byCode = Object.fromEntries(STATES.map(s => [s.code, s]));

const SAVE_KEY = "plateHunter.collected";
const SETTINGS_KEY = "plateHunter.settings";

let collected = loadCollected();   // { TX: { at: "2026-...", by: 0 }, ... }
let settings = loadSettings();     // { mode: 1|2, players: [name, name], active: 0|1 }
let view = "collected";
let activeIndex = 0;
let currentMatches = [];
let lastAdded = null;

const $ = (id) => document.getElementById(id);
const search = $("search"), suggestions = $("suggestions"), message = $("message");

// ---------- saving ----------
function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function loadCollected() {
  const raw = readJSON(SAVE_KEY) || {};
  const out = {};
  for (const [code, v] of Object.entries(raw)) {
    if (!byCode[code]) continue;
    // older saves stored just the date string
    out[code] = typeof v === "string" ? { at: v, by: 0 } : { at: v.at, by: v.by === 1 ? 1 : 0 };
  }
  return out;
}
function loadSettings() {
  const s = readJSON(SETTINGS_KEY) || {};
  const players = Array.isArray(s.players) ? s.players.slice(0, 2) : [];
  return {
    mode: s.mode === 2 ? 2 : 1,
    players: [players[0] || "Player 1", players[1] || "Player 2"],
    active: s.active === 1 ? 1 : 0,
  };
}
const saveCollected = () => writeJSON(SAVE_KEY, collected);
const saveSettings = () => writeJSON(SETTINGS_KEY, settings);

// ---------- helpers ----------
const twoPlayer = () => settings.mode === 2;
const playerName = (i) => settings.players[i].trim() || `Player ${i + 1}`;
const colorFor = (entry) => twoPlayer() ? PLAYER_COLORS[entry.by] : SOLO_COLOR;
const scoreOf = (i) => Object.values(collected).filter(e => e.by === i).length;

function findMatches(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const exactCode = STATES.filter(s => s.code.toLowerCase() === q);
  const starts = STATES.filter(s => s.name.toLowerCase().startsWith(q) && !exactCode.includes(s));
  const contains = STATES.filter(s =>
    s.name.toLowerCase().includes(q) && !starts.includes(s) && !exactCode.includes(s));
  return [...exactCode, ...starts, ...contains].slice(0, 6);
}

function showMessage(text, kind) {
  message.textContent = text;
  message.className = "message " + kind;
}

// ---------- actions ----------
function addState(state) {
  if (!state) { showMessage("Hmm, no state matches that. Check the spelling?", "err"); return; }
  const existing = collected[state.code];
  if (existing) {
    showMessage(twoPlayer()
      ? `${state.name} was already spotted by ${playerName(existing.by)}!`
      : `You already have ${state.name}! 👍`, "warn");
  } else {
    const by = twoPlayer() ? settings.active : 0;
    collected[state.code] = { at: new Date().toISOString(), by };
    lastAdded = state.code;
    saveCollected();
    showMessage(twoPlayer()
      ? `✅ ${playerName(by)} spotted ${state.name}! +1`
      : `✅ Added ${state.name}! Nice spot!`, "ok");
    if (Object.keys(collected).length === STATES.length) celebrate();
  }
  search.value = "";
  renderSuggestions();
  render();
}

function removeState(code) {
  delete collected[code];
  saveCollected();
  showMessage(`Removed ${byCode[code].name}.`, "warn");
  render();
}

function celebrate() {
  let text = "Every state plus D.C. Legendary spotter status unlocked.";
  if (twoPlayer()) {
    const a = scoreOf(0), b = scoreOf(1);
    text = a === b ? `It's a tie, ${a} to ${b}! You're both legends.`
      : `${playerName(a > b ? 0 : 1)} wins ${Math.max(a, b)} to ${Math.min(a, b)}! 🎉`;
  }
  $("celebrate-text").textContent = text;
  $("celebrate").classList.remove("hidden");
}

// ---------- rendering ----------
function renderSuggestions() {
  currentMatches = findMatches(search.value);
  activeIndex = 0;
  suggestions.innerHTML = "";
  currentMatches.forEach((s, i) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    if (i === activeIndex) li.classList.add("active");
    const left = document.createElement("span");
    left.innerHTML = `<span class="abbr">${s.code}</span>${s.name}`;
    li.appendChild(left);
    const entry = collected[s.code];
    if (entry) {
      const have = document.createElement("span");
      have.className = "have";
      have.textContent = twoPlayer() ? `✔ ${playerName(entry.by)}` : "✔ collected";
      li.appendChild(have);
    }
    li.addEventListener("mousedown", (e) => { e.preventDefault(); addState(s); });
    suggestions.appendChild(li);
  });
}

function highlight() {
  [...suggestions.children].forEach((li, i) => li.classList.toggle("active", i === activeIndex));
}

function renderPlayers() {
  document.querySelectorAll("#mode-toggle .tab").forEach(b =>
    b.classList.toggle("active", Number(b.dataset.mode) === settings.mode));
  $("players-area").classList.toggle("hidden", !twoPlayer());
  if (!twoPlayer()) return;

  const scores = [scoreOf(0), scoreOf(1)];
  const box = $("players");
  // build once, then just update (so typing a name doesn't lose focus)
  if (!box.children.length) {
    [0, 1].forEach(i => {
      const div = document.createElement("div");
      div.className = "player";
      div.style.setProperty("--pc", PLAYER_COLORS[i]);
      div.innerHTML = `<input type="text" maxlength="16" aria-label="Player ${i + 1} name">
        <div class="score"></div><div class="spotting">👀 Spotting now</div>`;
      const input = div.querySelector("input");
      input.value = settings.players[i];
      input.addEventListener("input", () => {
        settings.players[i] = input.value; saveSettings(); render();
      });
      div.addEventListener("click", () => {
        if (settings.active !== i) { settings.active = i; saveSettings(); render(); }
      });
      box.appendChild(div);
    });
  }
  [...box.children].forEach((div, i) => {
    div.classList.toggle("active", settings.active === i);
    div.classList.toggle("leader", scores[i] > scores[1 - i]);
    div.querySelector(".score").innerHTML = `${scores[i]} <small>plates</small>`;
  });
}

function renderMap() {
  const map = $("map");
  if (!map.children.length) {
    STATES.forEach(s => {
      const t = document.createElement("button");
      t.type = "button";
      t.className = "tile";
      t.dataset.code = s.code;
      t.textContent = s.code;
      t.style.gridRow = s.row + 1;
      t.style.gridColumn = s.col + 1;
      t.addEventListener("click", () => { if (!collected[s.code]) addState(s); });
      map.appendChild(t);
    });
  }
  [...map.children].forEach(t => {
    const s = byCode[t.dataset.code], entry = collected[s.code];
    t.classList.toggle("got", !!entry);
    t.style.setProperty("--tc", entry ? colorFor(entry) : "");
    t.title = entry
      ? `${s.name} — ${twoPlayer() ? "spotted by " + playerName(entry.by) : "collected"}`
      : `${s.name} — not yet (tap to add)`;
    if (s.code === lastAdded) {
      t.classList.remove("flash"); void t.offsetWidth; t.classList.add("flash");
    }
  });

  const legend = $("legend");
  legend.innerHTML = "";
  const items = twoPlayer()
    ? [[playerName(0), PLAYER_COLORS[0]], [playerName(1), PLAYER_COLORS[1]], ["Not yet", "#334155"]]
    : [["Collected", SOLO_COLOR], ["Not yet", "#334155"]];
  items.forEach(([label, color]) => {
    const span = document.createElement("span");
    span.textContent = label;
    span.style.setProperty("--lc", color);
    legend.appendChild(span);
  });
}

function renderPlates() {
  const plates = $("plates");
  plates.innerHTML = "";
  let list;
  if (view === "collected") {
    list = STATES.filter(s => collected[s.code])
      .sort((a, b) => collected[b.code].at.localeCompare(collected[a.code].at)); // newest first
    $("empty").textContent = "No plates yet. Go look out the window! 👀";
  } else {
    list = STATES.filter(s => !collected[s.code]);
    $("empty").textContent = "Nothing missing — you got them all! 🏆";
  }
  $("empty").style.display = list.length ? "none" : "block";

  list.forEach(s => {
    const div = document.createElement("div");
    div.className = "plate";
    if (view === "collected") {
      const entry = collected[s.code];
      div.innerHTML = `<div class="state-name">${s.name}</div>
        <div class="code">${s.code}</div>
        <div class="date">spotted ${new Date(entry.at).toLocaleDateString()}</div>
        <button class="remove" title="Remove ${s.name}" aria-label="Remove ${s.name}">✕</button>`;
      if (twoPlayer()) {
        div.classList.add("owned");
        div.style.setProperty("--pc", PLAYER_COLORS[entry.by]);
        const by = document.createElement("div");
        by.className = "by";
        by.textContent = "by " + playerName(entry.by);
        div.insertBefore(by, div.querySelector(".remove"));
      }
      div.querySelector(".remove").addEventListener("click", () => removeState(s.code));
    } else {
      div.classList.add("missing");
      div.title = `Click to add ${s.name}`;
      div.innerHTML = `<div class="state-name">${s.name}</div><div class="code">${s.code}</div>`;
      div.addEventListener("click", () => addState(s));
    }
    plates.appendChild(div);
  });
}

function render() {
  const count = Object.keys(collected).length;
  $("count").textContent = count;
  $("total").textContent = STATES.length;
  $("bar-fill").style.width = (count / STATES.length * 100) + "%";
  $("rank").textContent = (twoPlayer() ? "Team rank: " : "Rank: ") +
    RANKS.filter(([n]) => count >= n).pop()[1];
  renderPlayers();
  renderMap();
  renderPlates();
  lastAdded = null;
}

// ---------- events ----------
search.addEventListener("input", renderSuggestions);
search.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" && currentMatches.length) {
    activeIndex = (activeIndex + 1) % currentMatches.length; highlight(); e.preventDefault();
  } else if (e.key === "ArrowUp" && currentMatches.length) {
    activeIndex = (activeIndex - 1 + currentMatches.length) % currentMatches.length; highlight(); e.preventDefault();
  } else if (e.key === "Enter") {
    if (search.value.trim()) addState(currentMatches[activeIndex]);
  } else if (e.key === "Escape") {
    search.value = ""; renderSuggestions();
  }
});
$("add-btn").addEventListener("click", () => {
  if (search.value.trim()) addState(currentMatches[activeIndex]);
  else search.focus();
});

document.querySelectorAll("#mode-toggle .tab").forEach(btn => btn.addEventListener("click", () => {
  settings.mode = Number(btn.dataset.mode);
  saveSettings();
  renderSuggestions();
  render();
}));

document.querySelectorAll(".tabs .tab[data-view]").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".tabs .tab[data-view]").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  view = btn.dataset.view;
  render();
}));

$("reset-btn").addEventListener("click", () => {
  if (confirm("Reset the whole collection? This can't be undone.")) {
    collected = {}; saveCollected(); render(); showMessage("Collection reset. Fresh start!", "warn");
  }
});
$("close-celebrate").addEventListener("click", () => $("celebrate").classList.add("hidden"));

render();
search.focus();
