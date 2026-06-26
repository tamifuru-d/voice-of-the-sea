/**
 * Voice of the Sea — app.js
 * Pure vanilla JS, no dependencies.
 */

'use strict';

/* ===== State ===== */
let manifest = null;
let currentTrack = null;   // { code, title, file, series:'track'|'compass' }
let currentInput = '';     // '' | 'C' | digit(s) building up

/* ===== Audio element (single, persistent) ===== */
const audio = new Audio();
audio.preload = 'none';

/* ===== DOM refs ===== */
const dom = {
  mapView:           document.getElementById('map-view'),
  guideView:         document.getElementById('guide-view'),
  tabMap:            document.getElementById('tab-map'),
  tabGuide:          document.getElementById('tab-guide'),
  mapLeaflet:        document.getElementById('map-leaflet'),
  displayText:       document.getElementById('display-text'),
  displayPlaceholder:document.getElementById('display-placeholder'),
  keypadDisplay:     document.getElementById('keypad-display'),
  errorMsg:          document.getElementById('error-msg'),
  currentLabel:      document.getElementById('current-track-label'),
  miniPlayer:        document.getElementById('mini-player'),
  playerTrackName:   document.getElementById('player-track-name'),
  btnPlayPause:      document.getElementById('btn-play-pause'),
  btnPrev:           document.getElementById('btn-prev'),
  btnNext:           document.getElementById('btn-next'),
  seekBar:           document.getElementById('seek-bar'),
  seekCurrent:       document.getElementById('seek-time-current'),
  seekTotal:         document.getElementById('seek-time-total'),
  btnAbout:          document.getElementById('btn-about'),
  modalOverlay:      document.getElementById('modal-overlay'),
  btnCloseModal:     document.getElementById('btn-close-modal'),
  btnGeo:            document.getElementById('btn-geo'),
  nearbyBanner:      document.getElementById('nearby-banner'),
  nearbyTrack:       document.getElementById('nearby-track'),
  btnPlayNearby:     document.getElementById('btn-play-nearby'),
};

/* ===== Utility ===== */
function fmt(sec) {
  if (isNaN(sec) || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ===== Track resolution ===== */
function findTrack(code) {
  // code is normalised string e.g. "07", "C3"
  if (!manifest) return null;
  if (code.startsWith('C')) {
    const c = manifest.compass.find(t => t.code.toUpperCase() === code.toUpperCase());
    return c ? { ...c, series: 'compass' } : null;
  }
  const t = manifest.tracks.find(t => t.code === code);
  return t ? { ...t, series: 'track' } : null;
}

/* Track ordering for prev/next */
function getTrackList(series) {
  if (!manifest) return [];
  if (series === 'compass') return manifest.compass.map(t => ({ ...t, series: 'compass' }));
  return manifest.tracks.map(t => ({ ...t, series: 'track' }));
}

function prevNextTrack(direction) {
  if (!currentTrack) return null;
  const list = getTrackList(currentTrack.series);
  const idx = list.findIndex(t => t.code === currentTrack.code);
  if (idx === -1) return null;
  const next = (idx + direction + list.length) % list.length;
  return list[next];
}

/* ===== Load & Play ===== */
function loadTrack(track, autoplay) {
  currentTrack = track;
  audio.src = track.file;
  audio.load();
  if (autoplay !== false) {
    audio.play().catch(() => {
      // Autoplay blocked — update UI to show paused state
      updatePlayPauseBtn();
    });
  }
  updatePlayerUI();
  updateMediaSession();
  dom.miniPlayer.classList.add('visible');
  document.body.classList.add('has-player');
  if (leafletMap) refreshPlayingMarker();
}

function updatePlayerUI() {
  if (!currentTrack) return;
  const label = currentTrack.series === 'compass'
    ? `${currentTrack.code} ${currentTrack.title}`
    : `${currentTrack.code} ${currentTrack.title}`;
  dom.playerTrackName.textContent = label;
  dom.currentLabel.innerHTML = `再生中: <span>${label}</span>`;
}

function updatePlayPauseBtn() {
  dom.btnPlayPause.textContent = audio.paused ? '▶' : '⏸';
  dom.btnPlayPause.setAttribute('aria-label', audio.paused ? '再生' : '一時停止');
}

/* ===== Media Session API ===== */
function updateMediaSession() {
  if (!('mediaSession' in navigator) || !currentTrack) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: `${currentTrack.code} ${currentTrack.title}`,
    artist: 'Voice of the Sea',
    album: '東京ディズニーシー 非公式音声ガイド',
  });
  navigator.mediaSession.setActionHandler('play', () => { audio.play(); });
  navigator.mediaSession.setActionHandler('pause', () => { audio.pause(); });
  navigator.mediaSession.setActionHandler('previoustrack', () => {
    const t = prevNextTrack(-1);
    if (t) loadTrack(t, true);
  });
  navigator.mediaSession.setActionHandler('nexttrack', () => {
    const t = prevNextTrack(1);
    if (t) loadTrack(t, true);
  });
}

/* ===== Audio events ===== */
audio.addEventListener('play', updatePlayPauseBtn);
audio.addEventListener('pause', updatePlayPauseBtn);
audio.addEventListener('ended', updatePlayPauseBtn);

audio.addEventListener('timeupdate', () => {
  if (!audio.duration) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  dom.seekBar.value = pct;
  dom.seekBar.style.setProperty('--seek-pct', pct + '%');
  dom.seekCurrent.textContent = fmt(audio.currentTime);
});

audio.addEventListener('durationchange', () => {
  dom.seekTotal.textContent = fmt(audio.duration);
});

audio.addEventListener('loadedmetadata', () => {
  dom.seekTotal.textContent = fmt(audio.duration);
  dom.seekCurrent.textContent = '0:00';
  dom.seekBar.value = 0;
  dom.seekBar.style.setProperty('--seek-pct', '0%');
});

/* ===== Player controls ===== */
dom.btnPlayPause.addEventListener('click', () => {
  if (!currentTrack) return;
  if (audio.paused) { audio.play().catch(() => {}); }
  else { audio.pause(); }
});

dom.btnPrev.addEventListener('click', () => {
  const t = prevNextTrack(-1);
  if (t) loadTrack(t, !audio.paused);
});

dom.btnNext.addEventListener('click', () => {
  const t = prevNextTrack(1);
  if (t) loadTrack(t, !audio.paused);
});

let isSeeking = false;
dom.seekBar.addEventListener('mousedown', () => { isSeeking = true; });
dom.seekBar.addEventListener('touchstart', () => { isSeeking = true; }, { passive: true });
dom.seekBar.addEventListener('input', () => {
  if (audio.duration) {
    const pct = parseFloat(dom.seekBar.value);
    dom.seekBar.style.setProperty('--seek-pct', pct + '%');
    dom.seekCurrent.textContent = fmt((pct / 100) * audio.duration);
  }
});
dom.seekBar.addEventListener('change', () => {
  if (audio.duration) {
    audio.currentTime = (parseFloat(dom.seekBar.value) / 100) * audio.duration;
  }
  isSeeking = false;
});

/* ===== Keypad logic ===== */
let errorTimer = null;

function setDisplay(text) {
  if (text === '') {
    dom.displayText.style.display = 'none';
    dom.displayPlaceholder.style.display = '';
    dom.keypadDisplay.classList.remove('has-input', 'error-shake');
  } else {
    dom.displayText.textContent = text;
    dom.displayText.style.display = '';
    dom.displayPlaceholder.style.display = 'none';
    dom.keypadDisplay.classList.add('has-input');
  }
}

function clearInput() {
  currentInput = '';
  setDisplay('');
}

function showError(msg) {
  dom.keypadDisplay.classList.add('error-shake');
  dom.errorMsg.textContent = msg;
  dom.errorMsg.classList.add('visible');
  if (errorTimer) clearTimeout(errorTimer);
  errorTimer = setTimeout(() => {
    errorTimer = null;
    dom.errorMsg.classList.remove('visible');
    dom.keypadDisplay.classList.remove('error-shake');
    clearInput();
  }, 1500);
}

function tryLoadByInput(code) {
  const track = findTrack(code);
  if (track) {
    clearInput();
    loadTrack(track, true);
  } else {
    showError('該当する音声がありません');
  }
}

function handleKey(key) {
  if (errorTimer) {
    // Ignore input while error is showing
    return;
  }

  if (key === 'DEL') {
    if (currentInput.length > 0) {
      currentInput = currentInput.slice(0, -1);
      setDisplay(currentInput || '');
    }
    return;
  }

  if (key === 'C') {
    if (currentInput === '') {
      currentInput = 'C';
      setDisplay('C');
    }
    // C is only valid at the start — ignore if already started
    return;
  }

  // Digit key
  if (!/^[0-9]$/.test(key)) return;

  if (currentInput === '') {
    // Starting with a digit → numeric track (2-digit mode)
    currentInput = key;
    setDisplay(currentInput);
    return;
  }

  if (currentInput === 'C') {
    // C + one digit → Compass track
    const code = 'C' + key;
    currentInput = code;
    setDisplay(code);
    tryLoadByInput(code);
    return;
  }

  if (currentInput.length === 1 && /^[0-9]$/.test(currentInput)) {
    // Second digit of numeric track
    const code = currentInput + key;
    currentInput = code;
    setDisplay(code);
    tryLoadByInput(code);
    return;
  }

  // Already completed — ignore extra digits
}

document.querySelectorAll('.key-btn').forEach(btn => {
  const key = btn.dataset.key;

  // Touch events for visual feedback
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    btn.classList.add('pressed');
    handleKey(key);
  }, { passive: false });
  btn.addEventListener('touchend', () => { btn.classList.remove('pressed'); }, { passive: true });

  // Mouse click (desktop)
  btn.addEventListener('click', () => { handleKey(key); });
});

// Physical keyboard support
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key >= '0' && e.key <= '9') { handleKey(e.key); return; }
  if (e.key === 'c' || e.key === 'C') { handleKey('C'); return; }
  if (e.key === 'Backspace' || e.key === 'Delete') { handleKey('DEL'); return; }
});

/* ===== Map Tab (Leaflet) ===== */
let leafletMap = null;
let spotMarkers = {};        // code -> L.Marker
let userMarker = null;       // L.Marker for current position

function makeSpotIcon(code, isPlaying) {
  return L.divIcon({
    className: 'spot-marker',
    html: `<div class="spot-pin${isPlaying ? ' playing' : ''}">${code}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
}

function makeUserIcon() {
  return L.divIcon({
    className: 'user-marker',
    html: '<div class="user-dot"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function initLeaflet() {
  if (leafletMap || !manifest) return;
  const pts = manifest.tracks.filter(t => typeof t.lat === 'number');
  if (pts.length === 0) return;

  leafletMap = L.map('map-leaflet', { zoomControl: true, attributionControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    maxZoom: 19,
    minZoom: 15,
  }).addTo(leafletMap);

  const bounds = L.latLngBounds(pts.map(t => [t.lat, t.lng]));
  leafletMap.fitBounds(bounds, { padding: [30, 30] });

  for (const t of pts) {
    const marker = L.marker([t.lat, t.lng], { icon: makeSpotIcon(t.code, false), title: `${t.code} ${t.title}` }).addTo(leafletMap);
    const enLine = t.en ? `<span class="popup-en">${t.en}</span>` : '';
    marker.bindPopup(
      `<span class="popup-title">${t.code} ${t.title}</span>${enLine}<button class="popup-play" data-code="${t.code}">▶ 再生</button>`,
      { closeButton: false }
    );
    marker.on('popupopen', (e) => {
      const btn = e.popup.getElement().querySelector('.popup-play');
      if (btn) btn.addEventListener('click', () => {
        const track = findTrack(t.code);
        if (track) { loadTrack(track, true); leafletMap.closePopup(); }
      });
    });
    spotMarkers[t.code] = marker;
  }
}

function refreshPlayingMarker() {
  for (const code in spotMarkers) {
    const isPlaying = currentTrack && currentTrack.series === 'track' && currentTrack.code === code;
    spotMarkers[code].setIcon(makeSpotIcon(code, isPlaying));
  }
}

function setUserPosition(lat, lng) {
  if (!leafletMap) return;
  if (!userMarker) {
    userMarker = L.marker([lat, lng], { icon: makeUserIcon(), zIndexOffset: 1000, interactive: false }).addTo(leafletMap);
  } else {
    userMarker.setLatLng([lat, lng]);
  }
}

function clearUserPosition() {
  if (userMarker && leafletMap) { leafletMap.removeLayer(userMarker); userMarker = null; }
}

/* ===== Tab switching ===== */
function switchTab(tab) {
  const isMap = tab === 'map';
  dom.mapView.classList.toggle('active', isMap);
  dom.guideView.classList.toggle('active', !isMap);
  dom.tabMap.classList.toggle('active', isMap);
  dom.tabMap.setAttribute('aria-selected', isMap);
  dom.tabGuide.classList.toggle('active', !isMap);
  dom.tabGuide.setAttribute('aria-selected', !isMap);

  // Sync hash without scroll jump
  const target = '#' + (isMap ? 'map' : 'guide');
  if (location.hash !== target) {
    history.replaceState(null, '', target);
  }

  if (isMap) {
    // Lazy-init map on first reveal so it has a real size
    initLeaflet();
    if (leafletMap) setTimeout(() => leafletMap.invalidateSize(), 0);
  }
}

dom.tabMap.addEventListener('click', () => switchTab('map'));
dom.tabGuide.addEventListener('click', () => switchTab('guide'));

/* ===== Hash-based tab restore ===== */
function restoreTabFromHash() {
  const hash = location.hash;
  if (hash === '#map') {
    switchTab('map');
  } else {
    switchTab('guide');
    if (hash !== '#guide') {
      history.replaceState(null, '', '#guide');
    }
  }
}

window.addEventListener('hashchange', () => {
  restoreTabFromHash();
});

/* ===== About Modal ===== */
dom.btnAbout.addEventListener('click', () => {
  dom.modalOverlay.classList.add('visible');
  dom.btnCloseModal.focus();
});

function closeModal() {
  dom.modalOverlay.classList.remove('visible');
  dom.btnAbout.focus();
}

dom.btnCloseModal.addEventListener('click', closeModal);
dom.modalOverlay.addEventListener('click', (e) => {
  if (e.target === dom.modalOverlay) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && dom.modalOverlay.classList.contains('visible')) {
    closeModal();
  }
});

/* ===== Geolocation: nearest spot ===== */
let geoWatchId = null;
let nearbyTrack = null;       // last reported nearest track
const NEARBY_MAX_M = 500;     // beyond this, hide banner

function haversine(la1, lo1, la2, lo2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(la2 - la1);
  const dLon = toRad(lo2 - lo1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function findNearest(lat, lng) {
  if (!manifest) return null;
  let best = null;
  for (const t of manifest.tracks) {
    if (typeof t.lat !== 'number') continue;
    const d = haversine(lat, lng, t.lat, t.lng);
    if (!best || d < best.dist) best = { track: { ...t, series: 'track' }, dist: d };
  }
  return best;
}

function fmtDist(m) {
  if (m < 100) return `約${Math.round(m / 5) * 5}m`;
  if (m < 1000) return `約${Math.round(m / 10) * 10}m`;
  return `約${(m / 1000).toFixed(1)}km`;
}

function updateNearby(pos) {
  const { latitude, longitude } = pos.coords;
  setUserPosition(latitude, longitude);
  const best = findNearest(latitude, longitude);
  dom.btnGeo.classList.remove('locating');

  if (!best || best.dist > NEARBY_MAX_M) {
    nearbyTrack = null;
    dom.nearbyTrack.textContent = 'パーク内のスポットを検出していません';
    dom.btnPlayNearby.disabled = true;
    dom.nearbyBanner.classList.add('visible');
    document.body.classList.add('nearby-active');
    return;
  }

  const changed = !nearbyTrack || nearbyTrack.code !== best.track.code;
  nearbyTrack = best.track;
  dom.nearbyTrack.textContent = `${best.track.code} ${best.track.title} (${fmtDist(best.dist)})`;
  dom.btnPlayNearby.disabled = false;
  dom.nearbyBanner.classList.add('visible');
  document.body.classList.add('nearby-active');
  if (changed) {
    dom.nearbyBanner.classList.remove('changed');
    void dom.nearbyBanner.offsetWidth;
    dom.nearbyBanner.classList.add('changed');
  }
}

function geoError(err) {
  dom.btnGeo.classList.remove('locating');
  nearbyTrack = null;
  dom.btnPlayNearby.disabled = true;
  const msg = err.code === err.PERMISSION_DENIED
    ? '位置情報の利用が許可されていません'
    : '位置情報を取得できません';
  dom.nearbyTrack.textContent = msg;
  dom.nearbyBanner.classList.add('visible');
  document.body.classList.add('nearby-active');
}

function startGeo() {
  if (!('geolocation' in navigator)) {
    alert('このブラウザは位置情報に対応していません');
    return;
  }
  dom.btnGeo.setAttribute('aria-pressed', 'true');
  dom.btnGeo.classList.add('locating');
  try { localStorage.setItem('vots-geo-enabled', '1'); } catch (_) {}
  geoWatchId = navigator.geolocation.watchPosition(updateNearby, geoError, {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 30000,
  });
}

function stopGeo() {
  if (geoWatchId !== null) {
    navigator.geolocation.clearWatch(geoWatchId);
    geoWatchId = null;
  }
  dom.btnGeo.setAttribute('aria-pressed', 'false');
  dom.btnGeo.classList.remove('locating');
  dom.nearbyBanner.classList.remove('visible', 'changed');
  document.body.classList.remove('nearby-active');
  nearbyTrack = null;
  clearUserPosition();
  try { localStorage.setItem('vots-geo-enabled', '0'); } catch (_) {}
}

dom.btnGeo.addEventListener('click', () => {
  if (geoWatchId === null) startGeo(); else stopGeo();
});

dom.btnPlayNearby.addEventListener('click', () => {
  if (nearbyTrack) loadTrack(nearbyTrack, true);
});

/* ===== Service Worker registration ===== */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}

/* ===== Init ===== */
async function init() {
  try {
    const res = await fetch('data/manifest.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('manifest fetch failed');
    manifest = await res.json();
  } catch (e) {
    console.error('Failed to load manifest:', e);
    dom.errorMsg.textContent = 'データの読み込みに失敗しました。';
    dom.errorMsg.classList.add('visible');
    return;
  }

  // Restore tab from URL hash (initLeaflet is triggered if map tab becomes active)
  restoreTabFromHash();

  // Restore geolocation toggle
  try {
    if (localStorage.getItem('vots-geo-enabled') === '1') startGeo();
  } catch (_) {}
}

init();
