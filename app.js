const VOTES_KEY = 'genderReveal_votes';
const FINISH_LEFT = 84; // % — where the racers meet the "papás" circles

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

const START_LEFT = 2;
const SECRET_PHASE_MS = 5000; // "a cinco segundos de la meta, el resultado secreto controla la llegada"

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setPos(el, percent, durationMs) {
  el.style.transition = `left ${durationMs}ms linear`;
  el.style.left = percent + '%';
}

const FONDO2_ASPECT = 2230 / 705; // assets/fondo2.png native size
const BG_HEIGHT_START = 150; // % of track-wrap height
const BG_HEIGHT_END = 200;

function updateCamera(frontPercent, durationMs) {
  const bgLayer = document.querySelector('.bg-layer');
  const bgImg = document.querySelector('.bg-img');
  const t = Math.min(Math.max((frontPercent - START_LEFT) / (FINISH_LEFT - START_LEFT), 0), 1);
  const heightPct = BG_HEIGHT_START + t * (BG_HEIGHT_END - BG_HEIGHT_START);
  const imgWidth = bgLayer.clientHeight * (heightPct / 100) * FONDO2_ASPECT;
  const maxShift = Math.max(imgWidth - bgLayer.clientWidth, 0);
  bgImg.style.transition = `transform ${durationMs}ms linear, height ${durationMs}ms linear`;
  bgImg.style.height = heightPct + '%';
  bgImg.style.transform = `translateX(${-t * maxShift}px)`;
}

function resetRacePositions() {
  ['racer1', 'racer2'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('celebrating', 'crying', 'crawling', 'distracted', 'fast-crawl');
    el.style.transition = 'none';
    el.style.left = START_LEFT + '%';
    el.querySelector('.crawl-img').classList.remove('hidden');
    el.querySelector('.cry-img').classList.add('hidden');
    el.querySelector('.sonaja').classList.remove('shaking');
  });
  const bgImg = document.querySelector('.bg-img');
  bgImg.style.transition = 'none';
  bgImg.style.height = BG_HEIGHT_START + '%';
  bgImg.style.transform = 'translateX(0px)';
  document.getElementById('start-race-btn').classList.remove('hidden');
  document.getElementById('result-overlay').classList.add('hidden');
}

async function startRace() {
  const v = getVotes();
  document.getElementById('start-race-btn').classList.add('hidden');

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
  // 1) Los dos bebés comienzan juntos.
  let winnerPos = 15, loserPos = 15;
  setPos(winnerEl, winnerPos, 1000);
  setPos(loserEl, loserPos, 1000);
  updateCamera(Math.max(winnerPos, loserPos), 1000);
  await sleep(1000);

  // 2) El más votado obtiene ventaja inicial.
  winnerPos = 26; loserPos = 19;
  setPos(winnerEl, winnerPos, 1300);
  setPos(loserEl, loserPos, 1300);
  updateCamera(Math.max(winnerPos, loserPos), 1300);
  await sleep(1300);

  // 3) Uno se distrae con una sonaja / el otro gatea rápidamente.
  winnerEl.classList.add('distracted');
  winnerSonaja.classList.add('shaking');
  loserEl.classList.add('fast-crawl');
  winnerPos = 28; loserPos = 40;
  setPos(winnerEl, winnerPos, 2200);
  setPos(loserEl, loserPos, 2200);
  updateCamera(Math.max(winnerPos, loserPos), 2200);
  await sleep(2200);

  // 4) Se recupera y cambia de posición.
  winnerEl.classList.remove('distracted');
  winnerSonaja.classList.remove('shaking');
  loserEl.classList.remove('fast-crawl');
  winnerEl.classList.add('fast-crawl');
  winnerPos = 48; loserPos = 45;
  setPos(winnerEl, winnerPos, 1800);
  setPos(loserEl, loserPos, 1800);
  updateCamera(Math.max(winnerPos, loserPos), 1800);
  await sleep(1800);

  // 5) Cambia de posición otra vez.
  winnerEl.classList.remove('fast-crawl');
  loserEl.classList.add('fast-crawl');
  winnerPos = 52; loserPos = 57;
  setPos(winnerEl, winnerPos, 1600);
  setPos(loserEl, loserPos, 1600);
  updateCamera(Math.max(winnerPos, loserPos), 1600);
  await sleep(1600);
  loserEl.classList.remove('fast-crawl');

  // 6) A cinco segundos de la meta, el resultado secreto controla la llegada.
  const winnerVotes = Math.max(v[winnerTeam], 1);
  const loserVotes = Math.max(v[winnerTeam === 'papa1' ? 'papa2' : 'papa1'], 1);
  const loserFraction = Math.min(loserVotes / winnerVotes, 0.97);
  const loserFinal = loserPos + (FINISH_LEFT - loserPos) * loserFraction;

  winnerEl.classList.add('fast-crawl');
  setPos(winnerEl, FINISH_LEFT, SECRET_PHASE_MS);
  setPos(loserEl, loserFinal, SECRET_PHASE_MS);
  updateCamera(FINISH_LEFT, SECRET_PHASE_MS);
  await sleep(SECRET_PHASE_MS + 200);

  finishRace(winnerEl, loserEl, v);
}

function finishRace(winnerEl, loserEl, v) {
  winnerEl.classList.remove('crawling', 'fast-crawl');
  winnerEl.classList.add('celebrating');

  loserEl.classList.remove('crawling', 'fast-crawl');
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
