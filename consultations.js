import { db } from './firebase.js';
import { collection, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';

let teacherIndex = [];
let activeSuggestions = [];
let highlightedIndex = -1;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .trim();
}

function setStatus(message, isError = false) {
  const statusEl = document.getElementById('consultations-status');
  if (!statusEl) return;
  statusEl.textContent = message || '';
  statusEl.classList.toggle('consultations-status--error', Boolean(isError));
}

function clearSuggestions() {
  const list = document.getElementById('consultations-suggestions');
  if (!list) return;
  list.innerHTML = '';
  list.classList.remove('is-open');
  activeSuggestions = [];
  highlightedIndex = -1;
}

function renderConsultationCard(data) {
  const root = document.getElementById('consultation-card-root');
  if (!root) return;

  if (!data) {
    root.innerHTML = '';
    return;
  }

  root.innerHTML = `
    <article class="consultation-card">
      <h3 class="consultation-card-title">${escapeHtml(data.teacher || 'Без име')}</h3>

      <section class="consultation-card-block">
        <h4>Ученици</h4>
        <p>${escapeHtml(data.students_day || '-')}</p>
        <p>${escapeHtml(data.students_time || '-')}</p>
      </section>

      <section class="consultation-card-block">
        <h4>Родители</h4>
        <p>${escapeHtml(data.parents_day || '-')}</p>
        <p>${escapeHtml(data.parents_time || '-')}</p>
      </section>

      <section class="consultation-card-block">
        <h4>Кабинет</h4>
        <p>${escapeHtml(data.room || '-')}</p>
      </section>
    </article>
  `;
}

function renderSuggestions(items) {
  const list = document.getElementById('consultations-suggestions');
  if (!list) return;

  if (!items.length) {
    list.innerHTML = '<li class="consultations-suggestion consultations-suggestion--empty">Няма съвпадения</li>';
    list.classList.add('is-open');
    activeSuggestions = [];
    highlightedIndex = -1;
    return;
  }

  activeSuggestions = items;
  highlightedIndex = -1;

  list.innerHTML = items.map((item, index) => `
    <li
      class="consultations-suggestion"
      role="option"
      data-index="${index}"
      data-doc-id="${escapeHtml(item.docId)}"
    >${escapeHtml(item.teacher)}</li>
  `).join('');

  list.classList.add('is-open');
}

function setHighlightedSuggestion(index) {
  const list = document.getElementById('consultations-suggestions');
  if (!list) return;

  const options = Array.from(list.querySelectorAll('.consultations-suggestion[data-index]'));
  options.forEach(el => el.classList.remove('is-active'));

  if (index >= 0 && options[index]) {
    options[index].classList.add('is-active');
    options[index].scrollIntoView({ block: 'nearest' });
    highlightedIndex = index;
  }
}

function findSuggestions(query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];

  return teacherIndex
    .filter(item => item.searchKey.includes(normalizedQuery))
    .slice(0, 8);
}

async function selectTeacher(item) {
  if (!item?.docId) return;

  const input = document.getElementById('consultations-search');
  if (input) input.value = item.teacher;

  clearSuggestions();
  setStatus('Зареждане...');

  try {
    const teacherRef = doc(db, 'consultations', item.docId);
    const snap = await getDoc(teacherRef);

    if (!snap.exists()) {
      renderConsultationCard(null);
      setStatus('Учителят не е намерен.', true);
      return;
    }

    renderConsultationCard(snap.data());
    setStatus('');
  } catch (error) {
    console.error('consultations.selectTeacher error', error);
    renderConsultationCard(null);
    setStatus('Грешка при зареждане на консултацията.', true);
  }
}

function setupSearchInteractions() {
  const input = document.getElementById('consultations-search');
  const list = document.getElementById('consultations-suggestions');
  if (!input || !list) return;

  input.addEventListener('input', () => {
    const query = input.value;
    if (!query.trim()) {
      clearSuggestions();
      return;
    }

    const suggestions = findSuggestions(query);
    renderSuggestions(suggestions);
  });

  input.addEventListener('keydown', event => {
    if (!list.classList.contains('is-open')) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!activeSuggestions.length) return;
      const next = highlightedIndex + 1 >= activeSuggestions.length ? 0 : highlightedIndex + 1;
      setHighlightedSuggestion(next);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!activeSuggestions.length) return;
      const prev = highlightedIndex - 1 < 0 ? activeSuggestions.length - 1 : highlightedIndex - 1;
      setHighlightedSuggestion(prev);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();

      if (highlightedIndex >= 0 && activeSuggestions[highlightedIndex]) {
        selectTeacher(activeSuggestions[highlightedIndex]);
        return;
      }

      const typed = normalizeText(input.value);
      if (!typed) return;

      const exact = teacherIndex.find(item => item.searchKey === typed);
      if (exact) {
        selectTeacher(exact);
        return;
      }

      if (activeSuggestions[0]) {
        selectTeacher(activeSuggestions[0]);
      }
      return;
    }

    if (event.key === 'Escape') {
      clearSuggestions();
    }
  });

  list.addEventListener('click', event => {
    const target = event.target.closest('.consultations-suggestion[data-index]');
    if (!target) return;

    const idx = Number(target.getAttribute('data-index'));
    const selected = activeSuggestions[idx];
    if (selected) selectTeacher(selected);
  });

  document.addEventListener('click', event => {
    if (event.target === input || list.contains(event.target)) return;
    clearSuggestions();
  });
}

async function loadTeachersOnce() {
  setStatus('Зареждане на учители...');

  try {
    const snap = await getDocs(collection(db, 'consultations'));

    teacherIndex = snap.docs
      .map(documentSnap => {
        const data = documentSnap.data();
        const teacher = String(data.teacher || '').trim();

        if (!teacher) return null;

        return {
          docId: documentSnap.id,
          teacher,
          searchKey: normalizeText(teacher)
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.teacher.localeCompare(b.teacher, 'bg'));

    if (!teacherIndex.length) {
      setStatus('Все още няма добавени консултации.');
      return;
    }

    setStatus('');
  } catch (error) {
    console.error('consultations.loadTeachersOnce error', error);
    setStatus('Грешка при зареждане на списъка с учители.', true);
  }
}

async function initConsultations() {
  const input = document.getElementById('consultations-search');
  if (!input) return;

  setupSearchInteractions();
  renderConsultationCard(null);
  await loadTeachersOnce();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initConsultations);
} else {
  initConsultations();
}
