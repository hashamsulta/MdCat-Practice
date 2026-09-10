/* ============================================================
   MDCAT Practice — app.js
   Vanilla JS, no build step. Reads data/manifest.json, then the
   per-year question file(s) it points to.

   To add a new year later:
     1. Add data/questions-2024.json in the same shape as
        data/questions-2025.json (array of question objects).
     2. In data/manifest.json, find the 2024 entry and set
        "available": true.
   No other code changes needed.
   ============================================================ */

const state = {
  manifest: null,
  currentYear: null,
  questionsByYear: {},   // cache: year -> array of questions
  currentQuestions: [],  // questions for the selected year
  filters: { paper: "all", subject: "all" },
  mode: null,            // "random" | "practice"
  randomCount: null,

  quizSet: [],
  quizIndex: 0,
  answers: [],           // { q, chosenKey, correct }
  locked: false
};

const el = (id) => document.getElementById(id);

/* ---------------- boot ---------------- */

init();

async function init() {
  try {
    const res = await fetch('data/manifest.json');
    state.manifest = await res.json();
  } catch (e) {
    el('masthead-tag').textContent = 'could not load data';
    el('setup-notice').innerHTML =
      '<p class="notice">Could not load data/manifest.json. If you just uploaded this to GitHub Pages, give it a minute and refresh — otherwise check the file exists at that path.</p>';
    return;
  }

  renderYearChips();

  const firstAvailable = state.manifest.years.find(y => y.available);
  if (!firstAvailable) {
    el('setup-notice').innerHTML = '<p class="notice">No question sets are available yet.</p>';
    return;
  }
  await selectYear(firstAvailable.year);

  wireModeCards();
  el('start-btn').addEventListener('click', startQuiz);
  el('next-btn').addEventListener('click', nextQuestion);
  el('retry-btn').addEventListener('click', retrySet);
  el('newquiz-btn').addEventListener('click', newQuiz);
  document.addEventListener('keydown', handleKey);
}

/* ---------------- year / data loading ---------------- */

function renderYearChips() {
  const wrap = el('year-chips');
  wrap.innerHTML = '';
  state.manifest.years.forEach(y => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = y.available ? y.label : `${y.label} (coming soon)`;
    chip.dataset.active = String(y.year === state.currentYear);
    if (!y.available) {
      chip.dataset.disabled = 'true';
    } else {
      chip.addEventListener('click', () => selectYear(y.year));
    }
    wrap.appendChild(chip);
  });
}

async function selectYear(year) {
  state.currentYear = year;
  renderYearChips();

  if (!state.questionsByYear[year]) {
    const entry = state.manifest.years.find(y => y.year === year);
    const res = await fetch(entry.file);
    state.questionsByYear[year] = await res.json();
  }
  state.currentQuestions = state.questionsByYear[year];
  el('masthead-tag').textContent = `${state.currentQuestions.length} questions loaded`;

  state.filters = { paper: "all", subject: "all" };
  renderPaperChips();
  renderSubjectChips();
  updateAvailability();
}

/* ---------------- paper / subject chips ---------------- */

function renderPaperChips() {
  const counts = {};
  state.currentQuestions.forEach(q => { counts[q.paper] = (counts[q.paper] || 0) + 1; });
  const papers = Object.keys(counts).sort();

  const items = [{ value: 'all', label: 'All papers', count: state.currentQuestions.length }]
    .concat(papers.map(p => ({ value: p, label: shortPaperLabel(p), count: counts[p] })));

  renderChips('paper-chips', items, state.filters.paper, (val) => {
    state.filters.paper = val;
    renderPaperChips();
    renderSubjectChips();
    updateAvailability();
  });
}

function renderSubjectChips() {
  const inPaper = state.currentQuestions.filter(q => state.filters.paper === 'all' || q.paper === state.filters.paper);
  const counts = {};
  inPaper.forEach(q => { counts[q.subject] = (counts[q.subject] || 0) + 1; });
  const subjects = Object.keys(counts).sort();

  const items = [{ value: 'all', label: 'All subjects', count: inPaper.length }]
    .concat(subjects.map(s => ({ value: s, label: s, count: counts[s] })));

  renderChips('subject-chips', items, state.filters.subject, (val) => {
    state.filters.subject = val;
    renderSubjectChips();
    updateAvailability();
  });
}

function renderChips(containerId, items, selectedValue, onSelect) {
  const wrap = el(containerId);
  wrap.innerHTML = '';
  items.forEach(item => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.dataset.active = String(item.value === selectedValue);
    chip.innerHTML = `${escapeHtml(item.label)}<span class="count">${item.count}</span>`;
    chip.addEventListener('click', () => onSelect(item.value));
    wrap.appendChild(chip);
  });
}

function shortPaperLabel(paper) {
  // Give the long official paper names a compact chip label.
  const map = {
    'MDCAT-2025 (BUMHS) Chemistry Blue': 'BUMHS',
    'SINDH MDCAT-25-Version-B': 'Sindh',
    'SZABMU MDCAT-2025 Paper CODE-3': 'SZABMU',
    'KMU-MDCAT 25 CODE-D': 'KMU',
    'Paper ID-C': 'Paper C'
  };
  return map[paper] || paper;
}

/* ---------------- filtering ---------------- */

function getFiltered() {
  return state.currentQuestions.filter(q =>
    (state.filters.paper === 'all' || q.paper === state.filters.paper) &&
    (state.filters.subject === 'all' || q.subject === state.filters.subject)
  );
}

function updateAvailability() {
  const n = getFiltered().length;
  el('avail-text').innerHTML = `<b>${n}</b> question${n === 1 ? '' : 's'} match`;

  if (state.mode === 'random') renderCountChips();
  updateStartEnabled();
}

/* ---------------- mode selection ---------------- */

function wireModeCards() {
  document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => selectMode(card.dataset.mode));
  });
}

function selectMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode-card').forEach(card => {
    card.dataset.active = String(card.dataset.mode === mode);
  });

  const countSection = el('count-section');
  if (mode === 'random') {
    countSection.style.display = '';
    state.randomCount = null;
    renderCountChips();
  } else {
    countSection.style.display = 'none';
  }
  updateStartEnabled();
}

function renderCountChips() {
  const total = getFiltered().length;
  const candidates = [10, 20, 50, 100].filter(n => n < total);
  const items = candidates.map(n => ({ value: n, label: String(n) }));
  items.push({ value: total, label: `All (${total})` });

  const wrap = el('count-chips');
  wrap.innerHTML = '';
  items.forEach(item => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = item.label;
    chip.dataset.active = String(item.value === state.randomCount);
    chip.addEventListener('click', () => {
      state.randomCount = item.value;
      renderCountChips();
      updateStartEnabled();
    });
    wrap.appendChild(chip);
  });

  // keep a valid selection if the available total shrank below the old pick
  if (state.randomCount && state.randomCount > total) state.randomCount = null;
}

function updateStartEnabled() {
  const n = getFiltered().length;
  let ok = state.mode !== null && n > 0;
  if (state.mode === 'random') ok = ok && !!state.randomCount;
  el('start-btn').disabled = !ok;
}

/* ---------------- starting a quiz ---------------- */

function startQuiz() {
  const filtered = getFiltered();
  let set;
  if (state.mode === 'random') {
    set = shuffle(filtered.slice()).slice(0, state.randomCount);
  } else {
    set = filtered.slice().sort((a, b) => {
      if (a.paper !== b.paper) return a.paper < b.paper ? -1 : 1;
      return (a.no || 0) - (b.no || 0);
    });
  }

  state.quizSet = set;
  state.quizIndex = 0;
  state.answers = [];
  showScreen('quiz');
  renderQuestion();
}

function retrySet() {
  state.quizIndex = 0;
  state.answers = [];
  showScreen('quiz');
  renderQuestion();
}

function newQuiz() {
  state.mode = null;
  document.querySelectorAll('.mode-card').forEach(card => card.dataset.active = 'false');
  el('count-section').style.display = 'none';
  state.randomCount = null;
  updateStartEnabled();
  showScreen('setup');
}

/* ---------------- quiz rendering ---------------- */

function renderQuestion() {
  state.locked = false;
  const q = state.quizSet[state.quizIndex];
  const total = state.quizSet.length;

  el('quiz-paper-label').textContent = `${shortPaperLabel(q.paper)} (Q${q.no})`;
  el('quiz-progress-label').textContent = `${state.quizIndex + 1} / ${total}`;

  const track = el('progress-track');
  track.innerHTML = '';
  state.quizSet.forEach((_, i) => {
    const seg = document.createElement('span');
    seg.className = 'progress-seg';
    if (i < state.quizIndex) seg.dataset.done = 'true';
    if (i === state.quizIndex) seg.dataset.current = 'true';
    track.appendChild(seg);
  });

  el('q-num').textContent = q.subject;
  el('q-text').textContent = q.q;

  const optWrap = el('q-options');
  optWrap.innerHTML = '';
  Object.keys(q.options).sort().forEach(key => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'option';
    row.dataset.key = key;
    row.innerHTML = `<span class="bubble">${key}</span><span class="option-text"></span>`;
    row.querySelector('.option-text').textContent = q.options[key];
    row.addEventListener('click', () => selectOption(key));
    optWrap.appendChild(row);
  });

  el('feedback-line').textContent = '';
  el('feedback-line').dataset.kind = '';
  el('next-btn').disabled = true;
  el('next-btn').textContent = (state.quizIndex === total - 1) ? 'See results' : 'Answer to continue';
}

function selectOption(key) {
  if (state.locked) return;
  state.locked = true;

  const q = state.quizSet[state.quizIndex];
  const correctKey = q.answer;
  const isCorrect = key === correctKey;

  document.querySelectorAll('#q-options .option').forEach(row => {
    row.dataset.locked = 'true';
    const rowKey = row.dataset.key;
    if (rowKey === key) row.dataset.state = isCorrect ? 'correct' : 'selected';
    if (rowKey === correctKey) row.dataset.state = 'correct';
    if (rowKey === key && !isCorrect) row.dataset.state = 'incorrect';
  });

  const fb = el('feedback-line');
  if (isCorrect) {
    fb.textContent = 'Correct.';
    fb.dataset.kind = 'correct';
  } else {
    fb.textContent = `Incorrect — correct answer is ${correctKey}.`;
    fb.dataset.kind = 'incorrect';
  }

  state.answers.push({ q, chosenKey: key, correct: isCorrect });
  el('next-btn').disabled = false;
}

function nextQuestion() {
  if (!state.locked) return;
  if (state.quizIndex < state.quizSet.length - 1) {
    state.quizIndex++;
    renderQuestion();
  } else {
    finishQuiz();
  }
}

/* ---------------- results ---------------- */

function finishQuiz() {
  const total = state.answers.length;
  const correct = state.answers.filter(a => a.correct).length;
  const pct = total ? Math.round((correct / total) * 100) : 0;

  el('score-big').textContent = `${correct}/${total}`;
  el('score-sub').textContent = `${pct}% correct`;

  const bySubject = {};
  state.answers.forEach(a => {
    const s = a.q.subject;
    if (!bySubject[s]) bySubject[s] = { correct: 0, total: 0 };
    bySubject[s].total++;
    if (a.correct) bySubject[s].correct++;
  });

  const bWrap = el('breakdown');
  bWrap.innerHTML = '';
  Object.keys(bySubject).sort().forEach(s => {
    const { correct: c, total: t } = bySubject[s];
    const row = document.createElement('div');
    row.className = 'breakdown-row';
    row.innerHTML = `
      <span class="name"></span>
      <span class="bar-track"><span class="bar-fill" style="width:${t ? (c / t) * 100 : 0}%"></span></span>
      <span class="frac">${c}/${t}</span>`;
    row.querySelector('.name').textContent = s;
    bWrap.appendChild(row);
  });

  const missed = state.answers.filter(a => !a.correct);
  const reviewSection = el('review-section');
  const rWrap = el('review-list');
  rWrap.innerHTML = '';
  if (missed.length === 0) {
    reviewSection.style.display = 'none';
  } else {
    reviewSection.style.display = '';
    missed.forEach(a => {
      const item = document.createElement('div');
      item.className = 'review-item';
      item.innerHTML = `
        <p class="q-num"></p>
        <p class="q-text"></p>
        <p class="review-line your"><span class="tag">your answer</span><span class="your-text"></span></p>
        <p class="review-line correct"><span class="tag">correct</span><span class="correct-text"></span></p>`;
      item.querySelector('.q-num').textContent = `${shortPaperLabel(a.q.paper)} (Q${a.q.no})`;
      item.querySelector('.q-text').textContent = a.q.q;
      item.querySelector('.your-text').textContent = `${a.chosenKey}. ${a.q.options[a.chosenKey]}`;
      item.querySelector('.correct-text').textContent = `${a.q.answer}. ${a.q.options[a.q.answer]}`;
      rWrap.appendChild(item);
    });
  }

  showScreen('results');
}

/* ---------------- keyboard shortcuts ---------------- */

function handleKey(e) {
  const quizVisible = el('screen-quiz').style.display !== 'none';
  if (!quizVisible) return;

  const key = e.key.toUpperCase();
  if (['A', 'B', 'C', 'D'].includes(key) && !state.locked) {
    const row = document.querySelector(`#q-options .option[data-key="${key}"]`);
    if (row) row.click();
  }
  if ((e.key === 'Enter' || e.key === ' ') && state.locked) {
    e.preventDefault();
    nextQuestion();
  }
}

/* ---------------- utilities ---------------- */

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function showScreen(name) {
  el('screen-setup').style.display = name === 'setup' ? '' : 'none';
  el('screen-quiz').style.display = name === 'quiz' ? '' : 'none';
  el('screen-results').style.display = name === 'results' ? '' : 'none';
  window.scrollTo(0, 0);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
