const VOTES_KEY = 'genderReveal_votes';

function getVotes() {
  const raw = localStorage.getItem(VOTES_KEY);
  return raw ? JSON.parse(raw) : { papa1: 0, papa2: 0 };
}
function saveVotes(v) {
  localStorage.setItem(VOTES_KEY, JSON.stringify(v));
}
function showScreen(name) {
  document.getElementById('vote-screen').classList.toggle('active', name === 'vote');
  document.getElementById('race-screen').classList.toggle('active', name === 'race');
}

/* ---------- Voting ---------- */

function castVote(team) {
  const v = getVotes();
  v[team]++;
  saveVotes(v);
  const overlay = document.getElementById('thanks-overlay');
  overlay.classList.remove('hidden');
  setTimeout(() => overlay.classList.add('hidden'), 1400);
}

document.getElementById('vote-papa1').addEventListener('click', () => castVote('papa1'));
document.getElementById('vote-papa2').addEventListener('click', () => castVote('papa2'));

document.getElementById('reset-votes-btn').addEventListener('click', () => {
  if (confirm('¿Reiniciar el conteo de votos a 0?')) {
    saveVotes({ papa1: 0, papa2: 0 });
  }
});

/* ---------- Secret screen switch (tap 3x) ---------- */

function makeTripleTap(btn, onTriple) {
  let count = 0;
  let timer = null;
  btn.addEventListener('click', () => {
    count++;
    clearTimeout(timer);
    timer = setTimeout(() => { count = 0; }, 1200);
    if (count >= 3) { count = 0; onTriple(); }
  });
}
makeTripleTap(document.getElementById('goto-race-btn'), () => showScreen('race'));
makeTripleTap(document.getElementById('back-to-vote-btn'), () => showScreen('vote'));

/* ---------- Race ---------- */

// The race happens in "world" coordinates (0-100, how far a baby has actually
// crawled). That world position is then projected onto the screen in three
// phases, like a side-scroller camera:
//   A) world <= CENTER          -> screen == world (walking in from the left)
//   B) CENTER < world <= CAMERA_MAX -> screen stays pinned at CENTER while the
//      background pans (the camera scrolls, the baby doesn't visually move)
//   C) world > CAMERA_MAX       -> the background has run out of room to pan,
//      so the baby visually walks the rest of the way to the goal on the right
const WORLD_START = 4;
const WORLD_FINISH = 100;
const CENTER_SCREEN = 50;
const FINISH_SCREEN = 64; // % — where the racers meet the "papás" circles (leaves
// room for the face overlay, which sits further right the bigger --frame is)
const CAMERA_MAX_OFFSET = WORLD_FINISH - FINISH_SCREEN;
const SECRET_PHASE_MS = 5000; // "a cinco segundos de la meta, el resultado secreto controla la llegada"

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setPos(el, percent, durationMs, easing) {
  el.style.transition = `left ${durationMs}ms ${easing}`;
  el.style.left = percent + '%';
}

function cameraOffsetFor(leadWorldPos) {
  return Math.min(Math.max(leadWorldPos - CENTER_SCREEN, 0), CAMERA_MAX_OFFSET);
}

const FONDO2_ASPECT = 2230 / 705; // assets/fondo2.png native size
const BG_HEIGHT_START = 110; // % of track-wrap height — less zoom shows more scenery
const BG_HEIGHT_END = 130;   // and shortens the pan distance, so it scrolls slower too

function updateCamera(t, durationMs, easing) {
  const bgLayer = document.querySelector('.bg-layer');
  const bgImg = document.querySelector('.bg-img');
  const heightPct = BG_HEIGHT_START + t * (BG_HEIGHT_END - BG_HEIGHT_START);
  const imgWidth = bgLayer.clientHeight * (heightPct / 100) * FONDO2_ASPECT;
  const maxShift = Math.max(imgWidth - bgLayer.clientWidth, 0);
  bgImg.style.transition = `transform ${durationMs}ms ${easing}, height ${durationMs}ms ${easing}`;
  bgImg.style.height = heightPct + '%';
  bgImg.style.transform = `translateX(${-t * maxShift}px)`;
}

// --- Sprite stride matching -------------------------------------------------
// The leg-cycle sprite (12 frames, steps()) loops on a fixed duration that is
// unrelated to how far `left` actually travels. Left uncorrected, a baby can
// visually glide with barely-moving legs, or shuffle in place while its legs
// cycle at "sprint" speed. STRIDE_DISTANCE says "one full 12-frame gait
// should cover this many screen-% of travel"; we size the loop duration to
// whatever distance/duration a given phase is about to cover, so the legs
// always look like they correspond to the actual speed on screen.
const STRIDE_DISTANCE = 6; // % of screen width per full walk-cycle
const MIN_STRIDE_S = 0.35;
const MAX_STRIDE_S = 2.0;

function currentLeftPct(el) {
  const v = parseFloat(el.style.left);
  return Number.isFinite(v) ? v : WORLD_START;
}

// Forces a CSS animation to restart from frame 0 instead of jumping frames.
// (Changing animation-duration on an already-running infinite animation
// keeps its elapsed time, so `elapsed / newDuration` lands on a different,
// discontinuous frame — this is the actual cause of the leg "jump".)
function restartAnimation(el) {
  el.style.animation = 'none';
  void el.offsetWidth; // force reflow
  el.style.animation = '';
}

// Recomputes the walk-cycle speed for one racer's upcoming move and restarts
// it cleanly. Skipped while distracted (idle pose ignores stride entirely).
function applyStride(el, newScreenLeft, durationMs) {
  if (el.classList.contains('distracted')) return;
  const distance = Math.abs(newScreenLeft - currentLeftPct(el));
  const speed = durationMs > 0 ? distance / (durationMs / 1000) : 0; // %/s
  const strideS = speed > 0.01
    ? Math.min(Math.max(STRIDE_DISTANCE / speed, MIN_STRIDE_S), MAX_STRIDE_S)
    : MAX_STRIDE_S;
  el.style.setProperty('--stride', strideS.toFixed(2) + 's');
  restartAnimation(el.querySelector('.crawl-img')); // leg cycle
}

// Moves both racers to their world positions, driving the shared camera off
// of whichever one is in the lead. `easing` should be a timing-function that
// matches the neighboring phases' speed (default: linear, so consecutive
// phases don't force velocity to zero at every boundary).
function positionRacers(winnerEl, loserEl, winnerWorld, loserWorld, durationMs, easing = 'linear') {
  const leadWorld = Math.max(winnerWorld, loserWorld);
  const offset = cameraOffsetFor(leadWorld);
  const winnerScreen = winnerWorld - offset;
  const loserScreen = loserWorld - offset;

  applyStride(winnerEl, winnerScreen, durationMs);
  applyStride(loserEl, loserScreen, durationMs);

  setPos(winnerEl, winnerScreen, durationMs, easing);
  setPos(loserEl, loserScreen, durationMs, easing);
  updateCamera(offset / CAMERA_MAX_OFFSET, durationMs, easing);
}

function resetRacePositions() {
  ['racer1', 'racer2'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('celebrating', 'crying', 'crawling', 'distracted');
    el.style.removeProperty('--stride');
    el.style.transition = 'none';
    el.style.left = WORLD_START + '%';
    el.querySelector('.crawl-img').classList.remove('hidden');
    el.querySelector('.cry-img').classList.add('hidden');
    el.querySelector('.sonaja').classList.remove('shaking');
  });
  const bgImg = document.querySelector('.bg-img');
  bgImg.style.transition = 'none';
  bgImg.style.height = BG_HEIGHT_START + '%';
  bgImg.style.transform = 'translateX(0px)';
  document.getElementById('start-race-btn').classList.remove('hidden');
  document.getElementById('countdown-overlay').classList.add('hidden');
  document.getElementById('result-overlay').classList.add('hidden');
}

async function showCountdown() {
  const overlay = document.getElementById('countdown-overlay');
  const numEl = document.getElementById('countdown-number');
  overlay.classList.remove('hidden');
  const steps = [['3', 850], ['2', 850], ['1', 850], ['¡Ya!', 650]];
  for (const [label, holdMs] of steps) {
    numEl.textContent = label;
    numEl.style.animation = 'none';
    void numEl.offsetWidth; // restart the pop animation on each tick
    numEl.style.animation = '';
    await sleep(holdMs);
  }
  overlay.classList.add('hidden');
}

async function startRace() {
  document.getElementById('start-race-btn').classList.add('hidden');
  await showCountdown();

  const v = getVotes();
  const racer1 = document.getElementById('racer1');
  const racer2 = document.getElementById('racer2');
  racer1.classList.add('crawling');
  racer2.classList.add('crawling');

  // "El más votado obtiene ventaja inicial" — decided now, but only revealed
  // for real in the last stretch of the race.
  let winnerTeam;
  if (v.papa1 === v.papa2) {
    winnerTeam = Math.random() < 0.5 ? 'papa1' : 'papa2';
  } else {
    winnerTeam = v.papa1 > v.papa2 ? 'papa1' : 'papa2';
  }
  const loserTeam = winnerTeam === 'papa1' ? 'papa2' : 'papa1';

  const winnerEl = document.getElementById(winnerTeam === 'papa1' ? 'racer1' : 'racer2');
  const loserEl = document.getElementById(loserTeam === 'papa1' ? 'racer1' : 'racer2');
  const winnerSonaja = winnerEl.querySelector('.sonaja');

  requestAnimationFrame(() => runRacePhases(v, winnerTeam, winnerEl, loserEl, winnerSonaja));
}

async function runRacePhases(v, winnerTeam, winnerEl, loserEl, winnerSonaja) {
  // 1) Los dos bebés arrancan juntos desde el reposo: aceleran (ease-in).
  let winnerPos = 22, loserPos = 22;
  positionRacers(winnerEl, loserEl, winnerPos, loserPos, 1100, 'ease-in');
  await sleep(1100);

  // 2) El más votado obtiene ventaja inicial.
  winnerPos = 34; loserPos = 26;
  positionRacers(winnerEl, loserEl, winnerPos, loserPos, 1300);
  await sleep(1300);

  // 3) Uno se distrae con una sonaja / el otro gatea rápidamente y toma la
  //    delantera (su ritmo de piernas se acelera solo, según cuánto avanza).
  winnerEl.classList.add('distracted');
  winnerSonaja.classList.add('shaking');
  winnerPos = 37; loserPos = 60;
  positionRacers(winnerEl, loserEl, winnerPos, loserPos, 2200);
  await sleep(2200);

  // 4) Se recupera y cambia de posición (aquí la cámara llega a su límite y
  //    empieza a "soltar" el escenario para que el bebé avance).
  winnerEl.classList.remove('distracted');
  winnerSonaja.classList.remove('shaking');
  winnerPos = 70; loserPos = 64;
  positionRacers(winnerEl, loserEl, winnerPos, loserPos, 1800);
  await sleep(1800);

  // 5) Cambia de posición otra vez, ya en la recta final.
  winnerPos = 74; loserPos = 84;
  positionRacers(winnerEl, loserEl, winnerPos, loserPos, 1600);
  await sleep(1600);

  // 6) A cinco segundos de la meta, el resultado secreto controla la
  //    llegada; frena suavemente (ease-out) al cruzar la meta.
  const winnerVotes = Math.max(v[winnerTeam], 1);
  const loserVotes = Math.max(v[winnerTeam === 'papa1' ? 'papa2' : 'papa1'], 1);
  const loserFraction = Math.min(loserVotes / winnerVotes, 0.97);
  const loserFinal = loserPos + (WORLD_FINISH - loserPos) * loserFraction;

  positionRacers(winnerEl, loserEl, WORLD_FINISH, loserFinal, SECRET_PHASE_MS, 'ease-out');
  await sleep(SECRET_PHASE_MS + 200);

  finishRace(winnerEl, loserEl, v);
}

function finishRace(winnerEl, loserEl, v) {
  winnerEl.classList.remove('crawling');
  winnerEl.classList.add('celebrating');

  loserEl.classList.remove('crawling');
  loserEl.classList.add('crying');
  loserEl.querySelector('.crawl-img').classList.add('hidden');
  loserEl.querySelector('.cry-img').classList.remove('hidden');

  document.getElementById('score1').textContent = v.papa1;
  document.getElementById('score2').textContent = v.papa2;
  document.getElementById('result-overlay').classList.remove('hidden');
}

document.getElementById('start-race-btn').addEventListener('click', startRace);
document.getElementById('reset-btn').addEventListener('click', () => {
  resetRacePositions();
  showScreen('vote');
});

resetRacePositions();
