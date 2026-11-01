import './style.css';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};
const SLOT_HEIGHT = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slot'));
const KEY = 'my-weekly-planner-v1';
const weekdays = ['월', '화', '수', '목', '금', '토', '일'];
const COLORS = ['#C8553D', '#3D6B8C', '#5B7F4E', '#C9963A', '#7A5C8E', '#171714'];
const COLOR_NAMES = ['벽돌', '파랑', '초록', '머스터드', '자주', '먹'];
const DAY = 86400000;

const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const next = new Date(d); next.setDate(next.getDate() + n); return next; };
const monday = (d) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -(d.getDay() + 6) % 7);
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / DAY);
const time = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const shortDate = (s) => { const d = parseDate(s); return `${d.getMonth() + 1}.${d.getDate()}`; };
const uid = () => crypto.randomUUID();

/* ---------- 저장 ---------- */
let data = { name: '', notionUrl: '', categories: [], goals: [], weeks: {} };
let storageAvailable = true;
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (typeof parsed.name !== 'string' || !parsed.weeks || typeof parsed.weeks !== 'object') throw Error();
    data = { ...data, ...parsed };
  }
} catch {
  storageAvailable = false;
  $('save-status').textContent = '저장 데이터를 읽을 수 없습니다. 브라우저 설정을 확인하세요.';
}
if (!Array.isArray(data.categories)) data.categories = [];
if (!Array.isArray(data.goals)) data.goals = [];

// 이전 버전의 할 일(항목 없음)은 기본 항목 '할 일'로 옮긴다.
function migrateLegacyTodos() {
  let fallback = null;
  for (const w of Object.values(data.weeks)) {
    for (const t of w.todos ?? []) {
      if (t.categoryId && data.categories.some((c) => c.id === t.categoryId)) continue;
      fallback ??= data.categories[0] ?? null;
      if (!fallback) { fallback = { id: uid(), name: '할 일', color: COLORS[5], notionUrl: '' }; data.categories.push(fallback); }
      t.categoryId = fallback.id;
    }
  }
}
migrateLegacyTodos();

function save() {
  if (!storageAvailable) return;
  try { localStorage.setItem(KEY, JSON.stringify(data)); $('save-status').textContent = '이 브라우저에 저장됨'; }
  catch { $('save-status').textContent = '저장 공간이 부족하거나 저장이 차단되었습니다.'; }
}

let current = monday(new Date());
let viewMonth = monthOfWeek(current);
let editing = null;
const week = () => data.weeks[dateKey(current)] ??= { todos: [], notes: '', events: [] };
// 오늘이 포함된 주면 오늘의 달, 아니면 그 주 목요일이 속한 달을 보여준다.
function monthOfWeek(mon) {
  const today = new Date();
  const ref = dateKey(monday(today)) === dateKey(mon) ? today : addDays(mon, 3);
  return new Date(ref.getFullYear(), ref.getMonth(), 1);
}

// 노션 등 외부 링크는 http(s) 주소만 허용한다.
function safeUrl(value) {
  let s = value.trim();
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  try { const u = new URL(s); return ['http:', 'https:'].includes(u.protocol) && u.hostname.includes('.') ? u.href : null; }
  catch { return null; }
}
function notionLink(url, label) {
  const a = el('a', { className: 'notion-link', href: url, target: '_blank', rel: 'noopener noreferrer', textContent: 'N↗', title: '노션에서 열기' });
  a.setAttribute('aria-label', label);
  return a;
}

for (const btn of document.querySelectorAll('.dialog-close')) btn.onclick = () => btn.closest('dialog').close();

$('name').value = data.name;
$('name').addEventListener('input', (e) => { data.name = e.target.value; save(); });
$('notes').addEventListener('input', (e) => { week().notes = e.target.value; save(); });

/* ---------- 노션 연결 ---------- */
function renderNotion() {
  const open = $('notion-open');
  open.hidden = !data.notionUrl;
  if (data.notionUrl) open.href = data.notionUrl;
  $('notion-settings-label').textContent = data.notionUrl ? '설정' : '노션 연결';
  $('notion-settings').setAttribute('aria-label', data.notionUrl ? '노션 연결 설정' : '노션 연결');
  $('notion-settings').classList.toggle('compact', !!data.notionUrl);
}
$('notion-settings').onclick = () => {
  $('notion-url').value = data.notionUrl; $('notion-error').textContent = '';
  $('notion-clear').hidden = !data.notionUrl;
  $('notion-dialog').showModal(); $('notion-url').focus();
};
$('notion-form').onsubmit = (e) => {
  e.preventDefault();
  const url = safeUrl($('notion-url').value);
  if (!url) { $('notion-error').textContent = '노션 페이지 주소(https://…)를 입력해주세요.'; return; }
  data.notionUrl = url; save(); renderNotion(); $('notion-dialog').close();
};
$('notion-clear').onclick = () => { data.notionUrl = ''; save(); renderNotion(); $('notion-dialog').close(); };

/* ---------- 한 달 해야 할 일 ---------- */
function monthRange(m) {
  const start = dateKey(m);
  const end = dateKey(new Date(m.getFullYear(), m.getMonth() + 1, 0));
  return { start, end, days: daysBetween(start, end) + 1 };
}
function goalStatus(g) {
  if (g.done) return { text: '완료', tone: 'done' };
  const today = dateKey(new Date());
  if (today < g.start) return { text: `${daysBetween(today, g.start)}일 후 시작`, tone: 'before' };
  if (today > g.end) return { text: '기한 지남', tone: 'late' };
  const left = daysBetween(today, g.end);
  return { text: left === 0 ? 'D-day' : `D-${left}`, tone: left <= 3 ? 'urgent' : 'active' };
}
const sortGoals = (list) => [...list].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));

function renderGoals() {
  const range = monthRange(viewMonth);
  $('month-label').textContent = `${viewMonth.getFullYear()}년 ${viewMonth.getMonth() + 1}월`;
  const pos = (s) => (daysBetween(range.start, s) / range.days) * 100;

  const today = dateKey(new Date());
  const inMonth = today >= range.start && today <= range.end;
  const todayNum = inMonth ? parseDate(today).getDate() : -99;
  const ticks = [1, 8, 15, 22, 29].filter((d) => d <= range.days && Math.abs(d - todayNum) > 2)
    .map((d) => el('li', { textContent: d, style: `left:${((d - 1) / range.days) * 100}%` }));
  if (inMonth) ticks.push(el('li', { className: `today-tick${todayNum <= 2 ? ' at-start' : ''}`, textContent: `오늘 ${todayNum}`, style: `left:${pos(today)}%` }));
  $('month-scale').replaceChildren(...ticks);

  const goals = sortGoals(data.goals.filter((g) => g.start <= range.end && g.end >= range.start));
  $('goals-empty').hidden = goals.length > 0;
  $('goals').replaceChildren(...goals.map((g) => {
    const status = goalStatus(g);
    const check = el('input', { type: 'checkbox', checked: g.done });
    check.setAttribute('aria-label', `${g.title} 완료`);
    check.onchange = () => { g.done = check.checked; save(); renderGoals(); renderWeekGoals(); };
    const main = el('button', { type: 'button', className: 'goal-main' },
      el('span', { className: 'goal-title', textContent: g.title }),
      el('span', { className: 'goal-meta' }, `${shortDate(g.start)} – ${shortDate(g.end)}`, el('em', { className: `badge ${status.tone}`, textContent: status.text })));
    main.setAttribute('aria-label', `${g.title} 수정`);
    main.onclick = () => openGoal(g);
    const from = Math.max(0, pos(g.start));
    const to = Math.min(100, pos(g.end) + 100 / range.days);
    const track = el('div', { className: 'goal-track' }, el('span', { className: `goal-bar ${status.tone}`, style: `left:${from}%;width:${to - from}%` }));
    const top = el('div', { className: 'goal-top' }, check, main);
    if (g.notionUrl) top.append(notionLink(g.notionUrl, `${g.title} 노션 열기`));
    return el('li', { className: `goal-row${g.done ? ' done' : ''}` }, top, track);
  }));
}

function openGoal(goal = null) {
  editing = { goalId: goal?.id };
  $('goal-dialog-title').textContent = goal ? '한 달 할 일 수정' : '한 달 할 일 추가';
  const { start, end } = monthRange(viewMonth);
  const today = dateKey(new Date());
  const defaultStart = today >= start && today <= end ? today : start;
  $('goal-title').value = goal?.title ?? '';
  $('goal-start').value = goal?.start ?? defaultStart;
  $('goal-end').value = goal?.end ?? end;
  $('goal-notion').value = goal?.notionUrl ?? '';
  $('goal-error').textContent = '';
  $('delete-goal').hidden = !goal;
  $('goal-dialog').showModal(); $('goal-title').focus();
}
$('add-goal').onclick = () => openGoal();
$('goal-form').onsubmit = (e) => {
  e.preventDefault();
  const title = $('goal-title').value.trim(), start = $('goal-start').value, end = $('goal-end').value;
  const notionUrl = safeUrl($('goal-notion').value);
  if (!title) return void ($('goal-error').textContent = '할 일을 입력해주세요.');
  if (!start || !end) return void ($('goal-error').textContent = '시작일과 마감일을 모두 선택해주세요.');
  if (end < start) return void ($('goal-error').textContent = '마감일은 시작일과 같거나 늦어야 합니다.');
  if (notionUrl === null) return void ($('goal-error').textContent = '노션 주소 형식이 올바르지 않습니다.');
  const existing = data.goals.find((g) => g.id === editing.goalId);
  if (existing) Object.assign(existing, { title, start, end, notionUrl });
  else data.goals.push({ id: uid(), title, start, end, notionUrl, done: false });
  save(); renderGoals(); renderWeekGoals(); $('goal-dialog').close();
};
$('delete-goal').onclick = () => {
  data.goals = data.goals.filter((g) => g.id !== editing.goalId);
  save(); renderGoals(); renderWeekGoals(); $('goal-dialog').close();
};
$('month-prev').onclick = () => { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1); renderGoals(); };
$('month-next').onclick = () => { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1); renderGoals(); };

// 주간 시간표 위에 이번 주에 걸친 한 달 할 일을 막대로 보여준다.
function renderWeekGoals() {
  const start = dateKey(current), end = dateKey(addDays(current, 6));
  const goals = sortGoals(data.goals.filter((g) => g.start <= end && g.end >= start));
  const strip = $('week-goals');
  strip.hidden = goals.length === 0;
  strip.replaceChildren(...goals.map((g, row) => {
    const from = Math.max(0, daysBetween(start, g.start)), to = Math.min(6, daysBetween(start, g.end));
    const status = goalStatus(g);
    const bar = el('button', { type: 'button', className: `week-goal ${status.tone}${g.done ? ' done' : ''}`, title: `${g.title} · ${shortDate(g.start)}–${shortDate(g.end)}` },
      g.start < start ? '‹ ' : '', g.title, g.end > end ? ' ›' : '');
    bar.style.gridColumn = `${from + 2} / ${to + 3}`;
    bar.style.gridRow = row + 1;
    bar.setAttribute('aria-label', `${g.title} 기간 ${shortDate(g.start)}부터 ${shortDate(g.end)}까지`);
    bar.onclick = () => { const d = parseDate(g.start < start ? start : g.start); viewMonth = new Date(d.getFullYear(), d.getMonth(), 1); renderGoals(); openGoal(g); };
    return bar;
  }));
}

/* ---------- 일주일 해야 할 일 (항목별) ---------- */
let addingTo = null; // 할 일 입력칸이 열린 항목 id

function renderTodos() {
  const items = week().todos;
  $('todo-count').textContent = `${items.filter((t) => t.done).length} / ${items.length}`;
  if (!data.categories.length) {
    $('categories').replaceChildren(el('p', { className: 'empty', textContent: '먼저 ‘과제’, ‘프로젝트’ 같은 항목을 추가해보세요.' }));
    return;
  }
  $('categories').replaceChildren(...data.categories.map((cat) => {
    const todos = items.filter((t) => t.categoryId === cat.id);
    const chip = el('button', { type: 'button', className: 'category-chip' }, el('i', { className: 'dot' }), cat.name);
    chip.setAttribute('aria-label', `${cat.name} 항목 편집`);
    chip.onclick = () => openCategory(cat);
    const count = el('span', { className: 'category-count', textContent: todos.length ? `${todos.filter((t) => t.done).length}/${todos.length}` : '' });
    const plus = el('button', { type: 'button', className: 'category-add', textContent: '+' });
    plus.setAttribute('aria-label', `${cat.name}에 할 일 추가`);
    plus.onclick = () => { addingTo = cat.id; renderTodos(); };
    const head = el('div', { className: 'category-head' }, chip, count);
    if (cat.notionUrl) head.append(notionLink(cat.notionUrl, `${cat.name} 노션 열기`));
    head.append(plus);

    const list = el('ul', { className: 'todo-list' }, ...todos.map((t) => {
      const check = el('input', { type: 'checkbox', checked: t.done });
      check.setAttribute('aria-label', `${t.title} 완료`);
      check.onchange = () => { t.done = check.checked; save(); renderTodos(); };
      const text = el('input', { className: 'todo-text', value: t.title, maxLength: 200 });
      text.setAttribute('aria-label', '할 일 수정');
      text.oninput = () => { t.title = text.value; check.setAttribute('aria-label', `${t.title} 완료`); del.setAttribute('aria-label', `${t.title} 삭제`); save(); };
      const del = el('button', { type: 'button', className: 'todo-del', textContent: '삭제' });
      del.setAttribute('aria-label', `${t.title} 삭제`);
      del.onclick = () => { week().todos = week().todos.filter((x) => x.id !== t.id); save(); renderTodos(); };
      return el('li', { className: `todo-row${t.done ? ' done' : ''}` }, check, text, del);
    }));

    const box = el('section', { className: 'category' }, head, list);
    box.style.setProperty('--c', cat.color);
    if (addingTo === cat.id) {
      const input = el('input', { className: 'new-todo', maxLength: 200, placeholder: '할 일 입력 후 Enter' });
      input.setAttribute('aria-label', `${cat.name} 새 할 일`);
      const form = el('form', { className: 'todo-form' }, input, el('button', { type: 'submit', textContent: '추가' }));
      form.onsubmit = (e) => {
        e.preventDefault();
        const title = input.value.trim(); if (!title) return;
        week().todos.push({ id: uid(), title, done: false, categoryId: cat.id });
        save(); renderTodos();
      };
      input.onkeydown = (e) => { if (e.key === 'Escape') { addingTo = null; renderTodos(); } };
      box.append(form);
      queueMicrotask(() => input.focus());
    }
    return box;
  }));
}

function openCategory(cat = null) {
  editing = { categoryId: cat?.id };
  $('category-dialog-title').textContent = cat ? '항목 편집' : '항목 추가';
  $('category-name').value = cat?.name ?? '';
  $('category-notion').value = cat?.notionUrl ?? '';
  $('category-error').textContent = '';
  $('delete-category').hidden = !cat;
  const chosen = cat?.color ?? COLORS[data.categories.length % COLORS.length];
  $('category-colors').replaceChildren(...COLORS.map((c, i) => {
    const radio = el('input', { type: 'radio', name: 'category-color', value: c, checked: c === chosen });
    radio.setAttribute('aria-label', COLOR_NAMES[i]);
    const label = el('label', { className: 'swatch' }, radio, el('span'));
    label.style.setProperty('--c', c);
    return label;
  }));
  $('category-dialog').showModal(); $('category-name').focus();
}
$('add-category').onclick = () => openCategory();
$('category-form').onsubmit = (e) => {
  e.preventDefault();
  const name = $('category-name').value.trim();
  const color = document.querySelector('input[name=category-color]:checked')?.value ?? COLORS[0];
  const notionUrl = safeUrl($('category-notion').value);
  if (!name) return void ($('category-error').textContent = '항목 이름을 입력해주세요.');
  if (notionUrl === null) return void ($('category-error').textContent = '노션 주소 형식이 올바르지 않습니다.');
  const existing = data.categories.find((c) => c.id === editing.categoryId);
  if (existing) Object.assign(existing, { name, color, notionUrl });
  else { const cat = { id: uid(), name, color, notionUrl }; data.categories.push(cat); addingTo = cat.id; }
  save(); renderTodos(); $('category-dialog').close();
};
$('delete-category').onclick = () => {
  const id = editing.categoryId;
  const total = Object.values(data.weeks).reduce((n, w) => n + (w.todos ?? []).filter((t) => t.categoryId === id).length, 0);
  if (total && !confirm(`이 항목의 할 일 ${total}개(모든 주)가 함께 삭제됩니다. 삭제할까요?`)) return;
  data.categories = data.categories.filter((c) => c.id !== id);
  for (const w of Object.values(data.weeks)) w.todos = (w.todos ?? []).filter((t) => t.categoryId !== id);
  if (addingTo === id) addingTo = null;
  save(); renderTodos(); $('category-dialog').close();
};

/* ---------- 주간 시간표 ---------- */
function openEvent(day, start, event = null) {
  editing = { day, id: event?.id };
  $('dialog-title').textContent = event ? '일정 수정' : '일정 추가';
  const d = addDays(current, day);
  $('event-date').textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 ${weekdays[day]}요일`;
  $('event-title').value = event?.title ?? ''; $('start-time').value = event?.start ?? start; $('end-time').value = event?.end ?? Math.min(start + 60, 1440);
  $('event-error').textContent = ''; $('delete-event').hidden = !event; $('event-dialog').showModal(); $('event-title').focus();
}
for (let m = 420; m <= 1440; m += 30) { if (m < 1440) $('start-time').add(new Option(time(m), m)); if (m > 420) $('end-time').add(new Option(time(m), m)); }
for (const id of ['close-dialog', 'cancel-event']) $(id).onclick = () => $('event-dialog').close();
$('event-form').onsubmit = (e) => {
  e.preventDefault();
  const title = $('event-title').value.trim(), start = Number($('start-time').value), end = Number($('end-time').value);
  if (!title) { $('event-error').textContent = '일정 제목을 입력해주세요.'; return; }
  if (end <= start) { $('event-error').textContent = '종료 시간은 시작 시간보다 늦어야 합니다.'; return; }
  const existing = week().events.find((x) => x.id === editing.id);
  if (existing) Object.assign(existing, { title, start, end });
  else week().events.push({ id: uid(), day: editing.day, title, start, end, done: false });
  save(); renderCalendar(); $('event-dialog').close();
};
$('delete-event').onclick = () => { week().events = week().events.filter((x) => x.id !== editing.id); save(); renderCalendar(); $('event-dialog').close(); };

// Assign overlapping appointments to separate lanes so every event stays accessible.
function layout(events) {
  const sorted = [...events].sort((a, b) => a.start - b.start || a.end - b.end);
  let group = [], end = 0; const result = [];
  function flush() { const lanes = []; for (const event of group) { let lane = lanes.findIndex((x) => x <= event.start); if (lane < 0) lane = lanes.length; lanes[lane] = event.end; result.push({ event, lane, group }); } group.count = lanes.length; }
  for (const event of sorted) { if (group.length && event.start >= end) { flush(); group = []; end = 0; } group.push(event); end = Math.max(end, event.end); }
  if (group.length) flush();
  return result;
}
function renderCalendar() {
  const last = addDays(current, 6);
  const fmt = (d) => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  $('week-range').textContent = `${fmt(current)} — ${fmt(last)}`;
  $('day-headings').replaceChildren(document.createElement('div')); $('days').replaceChildren();
  weekdays.forEach((day, i) => {
    const d = addDays(current, i);
    const heading = el('div', { className: 'day-heading' + (dateKey(d) === dateKey(new Date()) ? ' is-today' : ''), textContent: day });
    heading.append(el('span', { textContent: `${d.getMonth() + 1}.${d.getDate()}` }));
    $('day-headings').append(heading);
    const col = el('div', { className: 'day-column' });
    for (let m = 420; m < 1440; m += 30) { const slot = el('button', { className: 'slot' }); slot.setAttribute('aria-label', `${day}요일 ${time(m)} 일정 추가`); slot.onclick = () => openEvent(i, m); col.append(slot); }
    for (const { event, lane, group } of layout(week().events.filter((e) => e.day === i))) {
      const box = el('div', { className: 'event' + (event.done ? ' done' : '') + (event.end - event.start === 30 ? ' short' : '') });
      box.style.cssText = `top:${(event.start - 420) / 30 * SLOT_HEIGHT + 1}px;height:${(event.end - event.start) / 30 * SLOT_HEIGHT - 2}px;left:calc(${lane / group.count * 100}% + 3px);width:calc(${100 / group.count}% - 6px)`;
      const check = el('input', { type: 'checkbox', checked: event.done }); check.setAttribute('aria-label', `${event.title} 완료`);
      check.onchange = () => { event.done = check.checked; box.classList.toggle('done', event.done); save(); };
      const edit = el('button', { className: 'event-edit' }, el('span', { className: 'event-title', textContent: event.title }), el('span', { className: 'event-time', textContent: `${time(event.start)}–${time(event.end)}` }));
      edit.title = `${event.title} · ${time(event.start)}–${time(event.end)}`; edit.setAttribute('aria-label', `${event.title} 수정`); edit.onclick = () => openEvent(i, event.start, event);
      box.append(check, edit); col.append(box);
    }
    $('days').append(col);
  });
  renderWeekGoals();
}
for (let h = 7; h <= 24; h++) { const label = el('span', { className: 'time-label', textContent: `${pad(h)}:00` }); label.style.top = `${(h - 7) * 2 * SLOT_HEIGHT}px`; $('time-axis').append(label); }

function render() { addingTo = null; viewMonth = monthOfWeek(current); renderTodos(); $('notes').value = week().notes; renderCalendar(); renderGoals(); }
$('prev').onclick = () => { current = addDays(current, -7); render(); };
$('next').onclick = () => { current = addDays(current, 7); render(); };
$('today').onclick = () => { current = monday(new Date()); render(); };
renderNotion();
render();
