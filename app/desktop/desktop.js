const stations = [
  { name: "Coast FM", frequency: 88.1, band: "FM", streamUrl: "https://ice1.somafm.com/groovesalad-128-mp3" },
  { name: "City Pop FM", frequency: 92.3, band: "FM", streamUrl: "https://ice2.somafm.com/indiepop-128-mp3" },
  { name: "News AM", frequency: 720, band: "AM", streamUrl: "https://live.amperwave.net/direct/bonneville-ktaram-aac-imc" },
  { name: "Talk 1010", frequency: 1010, band: "AM", streamUrl: "https://stream.revma.ihrhls.com/zc4997" },
  { name: "Jazz HD1", frequency: 101.1, band: "HD", hdSub: "HD1", streamUrl: "https://ice4.somafm.com/u80s-128-mp3" },
  { name: "Electro HD2", frequency: 101.1, band: "HD", hdSub: "HD2", streamUrl: "https://ice2.somafm.com/beatblender-128-mp3" },
  { name: "Classic FM", frequency: 98.7, band: "FM", streamUrl: "https://ice1.somafm.com/dronezone-128-mp3" }
];

const modeConfig = { FM: { min: 87.5, max: 108.0, step: 0.1 }, AM: { min: 530, max: 1710, step: 10 }, HD: { min: 87.5, max: 108.0, step: 0.1 } };
const el = id => document.getElementById(id);
const player = el("player");
const grid = el("channelGrid");
const searchInput = el("search");
const slider = el("tunerSlider");
let hls;

const state = {
  mode: "FM",
  frequency: 98.7,
  favorites: JSON.parse(localStorage.getItem("radioFavorites") || "[]"),
  lastPlayed: JSON.parse(localStorage.getItem("lastPlayedStation") || "null"),
  scanning: null
};

function fmtFreq(freq, mode = state.mode) {
  if (mode === "AM") return `${Math.round(freq)} AM`;
  return `${Number(freq).toFixed(1)} ${mode}`;
}
function setMode(mode) { state.mode = mode; updateSliderBounds(); updateModeButtons(); tuneTo(state.frequency); renderCategories(); renderGrid(); }
function updateSliderBounds() { const c = modeConfig[state.mode]; slider.min = c.min; slider.max = c.max; slider.step = c.step; slider.value = state.frequency; }
function updateModeButtons() { ["FM","AM","HD"].forEach(m=>el(`mode${m}`).classList.toggle("active", m===state.mode)); el("currentMode").textContent = state.mode; }
function findStationByTuning(freq = state.frequency, mode = state.mode) { return stations.find(s => s.band === mode && Math.abs(Number(s.frequency) - Number(freq)) < 0.051); }

function playStation(station) {
  if (hls) { hls.destroy(); hls = null; }
  const isHls = /\.m3u8($|\?)/.test(station.streamUrl);
  if (isHls && window.Hls?.isSupported()) {
    hls = new Hls(); hls.loadSource(station.streamUrl); hls.attachMedia(player);
  } else {
    player.src = station.streamUrl;
  }
  player.play().catch(()=>{});
  state.lastPlayed = station;
  localStorage.setItem("lastPlayedStation", JSON.stringify(station));
  updateLastPlayed();
}

function updateSignal(strength = 0) {
  const bars = el("signalBars"); bars.innerHTML = "";
  for (let i=1;i<=5;i++) { const b=document.createElement("span"); b.style.height=`${6+i*4}px`; b.style.background=i<=strength?"#00cc66":"#2c2c2c"; bars.appendChild(b); }
}

function tuneTo(freq) {
  const c = modeConfig[state.mode];
  const clamped = Math.min(c.max, Math.max(c.min, freq));
  state.frequency = state.mode === "AM" ? Math.round(clamped / c.step) * c.step : Number(clamped.toFixed(1));
  slider.value = state.frequency;
  el("frequencyDisplay").textContent = fmtFreq(state.frequency);
  const station = findStationByTuning();
  if (station) {
    el("currentStationName").textContent = station.name + (station.hdSub ? ` ${station.hdSub}` : "");
    updateSignal(5);
    playStation(station);
  } else {
    el("currentStationName").textContent = "Static / No station";
    updateSignal(1);
    player.pause(); player.removeAttribute("src"); player.load();
  }
}

function stepTune(direction) { const { step } = modeConfig[state.mode]; tuneTo(state.frequency + direction * step); }
function scan(direction) {
  if (state.scanning) clearInterval(state.scanning);
  state.scanning = setInterval(() => {
    const { min, max, step } = modeConfig[state.mode];
    let next = state.frequency + direction * step;
    if (next > max) next = min;
    if (next < min) next = max;
    tuneTo(next);
    if (findStationByTuning()) { clearInterval(state.scanning); state.scanning = null; }
  }, 140);
}

function renderGrid(list = stations.filter(s => s.band === state.mode)) {
  grid.innerHTML = "";
  if (!list.length) { grid.innerHTML = `<p style='grid-column:1/-1;color:#aaa'>No station found — try tuning manually</p>`; return; }
  list.forEach(station => {
    const card = document.createElement("div"); card.className = "channelCard";
    const isFav = state.favorites.some(f => f.name === station.name && f.frequency === station.frequency && f.band === station.band);
    card.innerHTML = `<div class='favBtn'>${isFav ? "★" : "☆"}</div><div class='channelName'>${station.name}</div><div class='channelFreq'>${fmtFreq(station.frequency, station.band)} ${station.hdSub || ""}</div>`;
    card.querySelector(".favBtn").onclick = (e) => { e.stopPropagation(); toggleFavorite(station); };
    card.onclick = () => { if (state.mode !== station.band) setMode(station.band); tuneTo(station.frequency); };
    grid.appendChild(card);
  });
}

function toggleFavorite(station) {
  const key = s => `${s.name}|${s.frequency}|${s.band}|${s.hdSub || ""}`;
  const existing = state.favorites.findIndex(f => key(f) === key(station));
  if (existing >= 0) state.favorites.splice(existing, 1); else state.favorites.push(station);
  localStorage.setItem("radioFavorites", JSON.stringify(state.favorites));
  renderFavorites(); renderGrid();
}
function renderFavorites() {
  const ul = el("favorites"); ul.innerHTML = "";
  state.favorites.forEach(st => { const li = document.createElement("li"); li.textContent = `${st.name} (${fmtFreq(st.frequency, st.band)})`; li.onclick = () => { setMode(st.band); tuneTo(st.frequency); }; ul.appendChild(li); });
}
function renderCategories() {
  const ul = el("categories"); ul.innerHTML = "";
  ["FM","AM","HD"].forEach(mode => { const li = document.createElement("li"); li.textContent = mode; li.onclick = () => setMode(mode); ul.appendChild(li); });
}
function updateLastPlayed() {
  const c = el("lastWatchedContainer");
  if (!state.lastPlayed) { c.innerHTML = `<div class='last-watched-empty'>No station played yet</div>`; return; }
  c.innerHTML = `<div class='last-watched-card'><img alt='Radio' src='data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="56" height="40"><rect width="56" height="40" fill="black"/><text x="8" y="24" fill="%2300ccff" font-size="14">RADIO</text></svg>' /><div><div class='last-watched-name'>${state.lastPlayed.name}</div><div class='last-watched-name'>${fmtFreq(state.lastPlayed.frequency, state.lastPlayed.band)}</div></div></div>`;
  c.firstElementChild.onclick = () => { setMode(state.lastPlayed.band); tuneTo(state.lastPlayed.frequency); };
}

el("menuBtn").onclick = () => { el("sidebar").classList.toggle("active"); el("main").classList.toggle("shift"); };
searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = stations.filter(s => `${s.name} ${s.frequency} ${s.band}`.toLowerCase().includes(q) && s.band === state.mode);
  renderGrid(filtered);
});
slider.addEventListener("input", () => tuneTo(Number(slider.value)));
el("tuneUp").onclick = () => stepTune(1); el("tuneDown").onclick = () => stepTune(-1);
el("scanUp").onclick = () => scan(1); el("scanDown").onclick = () => scan(-1);
el("modeFM").onclick = () => setMode("FM"); el("modeAM").onclick = () => setMode("AM"); el("modeHD").onclick = () => setMode("HD");
player.addEventListener("error", () => { el("currentStationName").textContent = "Station unavailable"; updateSignal(1); });

updateModeButtons(); updateSliderBounds(); renderCategories(); renderFavorites(); updateLastPlayed(); tuneTo(state.frequency); renderGrid();
