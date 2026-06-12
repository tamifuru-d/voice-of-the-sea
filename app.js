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
  mapChips:          document.getElementById('map-chips'),
  mapImg:            document.getElementById('map-img'),
  mapPlaceholder:    document.getElementById('map-placeholder'),
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

/* ===== Map Tab ===== */
function buildMapChips() {
  dom.mapChips.innerHTML = '';
  manifest.maps.forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'map-chip';
    btn.setAttribute('role', 'listitem');
    btn.textContent = `${m.id} ${m.title}`;
    btn.dataset.mapId = m.id;
    btn.addEventListener('click', () => selectMap(m.id));
    dom.mapChips.appendChild(btn);
  });
}

function selectMap(id) {
  const m = manifest.maps.find(x => x.id === id);
  if (!m) return;

  // Update chip selection
  document.querySelectorAll('.map-chip').forEach(c => {
    c.classList.toggle('selected', c.dataset.mapId === id);
  });

  // Update image
  dom.mapImg.src = m.file;
  dom.mapImg.alt = `マップ ${m.id}: ${m.title}`;
  dom.mapImg.style.display = 'block';
  dom.mapPlaceholder.style.display = 'none';

  // Persist
  try { localStorage.setItem('vots-last-map', id); } catch (_) {}
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
    const res = await fetch('data/manifest.json');
    if (!res.ok) throw new Error('manifest fetch failed');
    manifest = await res.json();
  } catch (e) {
    console.error('Failed to load manifest:', e);
    dom.errorMsg.textContent = 'データの読み込みに失敗しました。';
    dom.errorMsg.classList.add('visible');
    return;
  }

  buildMapChips();

  // Restore last map from localStorage
  try {
    const lastMap = localStorage.getItem('vots-last-map');
    if (lastMap && manifest.maps.find(m => m.id === lastMap)) {
      selectMap(lastMap);
    }
  } catch (_) {}

  // Restore tab from URL hash
  restoreTabFromHash();
}

init();
