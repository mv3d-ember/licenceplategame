// All 50 US states plus Washington D.C.
const STATES = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
  ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["DC","District of Columbia"],["FL","Florida"],
  ["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],
  ["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],
  ["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],
  ["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],
  ["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],
  ["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],
  ["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],
  ["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],
  ["WY","Wyoming"],
].map(([code, name]) => ({ code, name }));

const RANKS = [
  [0, "Rookie Spotter"], [5, "Road Tripper"], [15, "Highway Hunter"],
  [25, "Interstate Expert"], [40, "Plate Master"], [51, "LEGENDARY Collector"],
];

const SAVE_KEY = "plateHunter.collected";
let collected = load();          // { "TX": "2026-11-08T...", ... }
let view = "collected";
let activeIndex = 0;
let currentMatches = [];

const $ = (id) => document.getElementById(id);
const search = $("search"), suggestions = $("suggestions"), message = $("message");

function load() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; }
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(collected)); } catch {}
}

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

function addState(state) {
  if (!state) { showMessage("Hmm, no state matches that. Check the spelling?", "err"); return; }
  if (collected[state.code]) {
    showMessage(`You already have ${state.name}! 👍`, "warn");
  } else {
    collected[state.code] = new Date().toISOString();
    save();
    showMessage(`✅ Added ${state.name}! Nice spot!`, "ok");
    if (Object.keys(collected).length === STATES.length) $("celebrate").classList.remove("hidden");
  }
  search.value = "";
  renderSuggestions();
  render();
  search.focus();
}

function removeState(code) {
  delete collected[code];
  save();
  const s = STATES.find(s => s.code === code);
  showMessage(`Removed ${s.name}.`, "warn");
  render();
}

function renderSuggestions() {
  currentMatches = findMatches(search.value);
  activeIndex = 0;
  suggestions.innerHTML = "";
  currentMatches.forEach((s, i) => {
    const li = document.createElement("li");
    li.role = "option";
    if (i === activeIndex) li.classList.add("active");
    li.innerHTML = `<span><span class="abbr">${s.code}</span>${s.name}</span>` +
      (collected[s.code] ? `<span class="have">✔ collected</span>` : "");
    li.addEventListener("mousedown", (e) => { e.preventDefault(); addState(s); });
    suggestions.appendChild(li);
  });
}

function highlight() {
  [...suggestions.children].forEach((li, i) => li.classList.toggle("active", i === activeIndex));
}

function render() {
  const count = Object.keys(collected).length;
  $("count").textContent = count;
  $("total").textContent = STATES.length;
  $("bar-fill").style.width = (count / STATES.length * 100) + "%";
  $("rank").textContent = "Rank: " + RANKS.filter(([n]) => count >= n).pop()[1];

  const plates = $("plates");
  plates.innerHTML = "";
  let list;
  if (view === "collected") {
    // newest first
    list = STATES.filter(s => collected[s.code])
      .sort((a, b) => collected[b.code].localeCompare(collected[a.code]));
    $("empty").textContent = "No plates yet. Go look out the window! 👀";
  } else {
    list = STATES.filter(s => !collected[s.code]);
    $("empty").textContent = "Nothing missing — you got them all! 🏆";
  }
  $("empty").style.display = list.length ? "none" : "block";

  list.forEach(s => {
    const div = document.createElement("div");
    div.className = "plate" + (view === "missing" ? " missing" : "");
    if (view === "collected") {
      const d = new Date(collected[s.code]);
      div.innerHTML = `<div class="state-name">${s.name}</div>
        <div class="code">${s.code}</div>
        <div class="date">spotted ${d.toLocaleDateString()}</div>
        <button class="remove" title="Remove ${s.name}" aria-label="Remove ${s.name}">✕</button>`;
      div.querySelector(".remove").addEventListener("click", () => removeState(s.code));
    } else {
      div.title = `Click to add ${s.name}`;
      div.innerHTML = `<div class="state-name">${s.name}</div><div class="code">${s.code}</div>`;
      div.addEventListener("click", () => addState(s));
    }
    plates.appendChild(div);
  });
}

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

document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  view = btn.dataset.view;
  render();
}));

$("reset-btn").addEventListener("click", () => {
  if (confirm("Reset your whole collection? This can't be undone.")) {
    collected = {}; save(); render(); showMessage("Collection reset. Fresh start!", "warn");
  }
});
$("close-celebrate").addEventListener("click", () => $("celebrate").classList.add("hidden"));

render();
search.focus();
