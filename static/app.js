// app.js - front end. All rule checking and solving is requested from Prolog.
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const s = { n: 4, towers: [[], [], []], moves: 0, min: 0, sel: null, t0: null,
            timer: null, gen: 0, auto: false, paused: false, running: 0, solution: [], i: 0 };

for (let k = 1; k <= 8; k++) $('disks').add(new Option(k, k, k === 4, k === 4));

function say(text, cls = '') { $('msg').textContent = text; $('msg').className = 'msg ' + cls; }
function flash(i) { const t = document.querySelector(`.tower[data-i="${i}"]`);
  t.classList.add('bad'); setTimeout(() => t.classList.remove('bad'), 400); }

function render() {
  document.querySelectorAll('.tower').forEach((el, i) => {
    const box = el.querySelector('.disks'); box.innerHTML = '';
    s.towers[i].forEach((d, k, a) => {
      const e = document.createElement('div');
      e.className = 'disk' + (s.sel === i && k === a.length - 1 ? ' lift' : '');
      e.style.width = (24 + d * (70 / s.n)) + '%';
      e.style.background = `hsl(${d * 300 / s.n + 10} 75% 55%)`;
      e.textContent = d; box.append(e);
    });
    el.classList.toggle('sel', s.sel === i);
  });
  $('moves').textContent = s.moves; $('min').textContent = s.min;
  $('pause').disabled = !s.auto; $('restart').disabled = !s.auto;
  $('pause').textContent = s.paused ? 'Resume' : 'Pause';
}

function startTimer() {
  s.t0 = Date.now();
  s.timer = setInterval(() => {
    const t = Math.floor((Date.now() - s.t0) / 1000);
    $('time').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  }, 200);
}

// Reset the game and ask Prolog for the optimal solution of the chosen size.
async function newGame() {
  s.gen++; clearInterval(s.timer);
  Object.assign(s, { n: +$('disks').value, moves: 0, sel: null, t0: null, auto: false, paused: false, i: 0 });
  s.towers = [Array.from({ length: s.n }, (_, k) => s.n - k), [], []];
  $('time').textContent = '0:00';
  try {
    const r = await (await fetch('/api/solve?n=' + s.n)).json();
    s.min = r.minMoves; s.solution = r.moves;
    say('Click a tower to pick up its top disk, then click where to drop it.');
  } catch { say('Cannot reach the Prolog server. Did you run ?- start. ?', 'bad'); }
  render();
}

// Ask Prolog whether the move is legal; apply it only if it is.
async function move(f, t) {
  let r;
  try {
    r = await (await fetch('/api/move', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ towers: s.towers, from: f, to: t }) })).json();
  } catch { say('Cannot reach the Prolog server.', 'bad'); return false; }
  if (!r.valid) { say(r.message, 'bad'); flash(t); return false; }
  if (!s.t0) startTimer();
  s.towers = r.towers; s.moves++; s.sel = null; render();
  say('Valid move.', 'ok');
  if (s.towers[2].length === s.n) {
    clearInterval(s.timer); s.auto = false; render();
    const sec = Math.round((Date.now() - s.t0) / 1000);
    say(`🎉 Congratulations! Solved in ${s.moves} moves (minimum ${s.min}) in ${sec}s.` +
        (s.moves === s.min ? ' Perfect!' : ''), 'ok');
  }
  return true;
}

document.querySelectorAll('.tower').forEach(el => el.addEventListener('click', async () => {
  if (s.auto || s.towers[2].length === s.n) return;
  const i = +el.dataset.i;
  if (s.sel === null) {
    if (!s.towers[i].length) { say('That tower has no disk to move.', 'bad'); flash(i); return; }
    s.sel = i; say('Now click the tower to drop it on.'); render();
  } else if (s.sel === i) { s.sel = null; say('Selection cancelled.'); render(); }
  else { const from = s.sel; if (!(await move(from, i))) { s.sel = null; render(); } }
}));

async function loop(gen) {                       // plays Prolog's move list
  if (s.running === gen) return; s.running = gen;
  while (gen === s.gen && !s.paused && s.i < s.solution.length) {
    const m = s.solution[s.i++];
    await move(m.from, m.to);
    await sleep(+$('speed').value);
  }
  if (s.running === gen) s.running = 0;
}
async function solve() { await newGame(); s.auto = true; render(); say('Solving with Prolog moves...'); loop(s.gen); }

$('reset').onclick = newGame;
$('disks').onchange = newGame;
$('solve').onclick = solve;
$('restart').onclick = solve;
$('pause').onclick = () => { s.paused = !s.paused; render(); if (!s.paused) loop(s.gen); };
newGame();
