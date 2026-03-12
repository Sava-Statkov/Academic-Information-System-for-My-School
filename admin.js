import { addCollectionDoc, writeScheduleDoc, fetchCollectionDocs, db } from './firebase.js';
import { doc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';

// Client-side password gate for simple local admin access.
// Change this value before deploying to production.
const ADMIN_PASSWORD = 'admin123';

const bgDays = ['Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък'];
const bgMonthsShort = ['ЯНУ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ЮНИ', 'ЮЛИ', 'АВГ', 'СЕП', 'ОКТ', 'НОЕ', 'ДЕК'];

function setStatus(element, message, state = '') {
  if (!element) return;
  element.textContent = message;
  element.classList.remove('error', 'success');
  if (state) element.classList.add(state);
}

function mapImporterClassToFirestoreId(cls) {
  if (!cls) return '';
  const s = String(cls).trim().toLowerCase();
  const m = s.match(/^(\d+)\s*([а-яё]+)$/i);
  if (!m) return String(cls).trim().toUpperCase();
  const num = m[1];
  const letter = m[2][0];
  const map = {
    'а': 'A',
    'б': 'B',
    'в': 'C',
    'г': 'D',
    'д': 'E',
    'е': 'F',
    'ж': 'G'
  };
  const mapped = map[letter] || letter.toUpperCase();
  return (num + mapped).toUpperCase();
}

function trimValue(value) {
  return String(value || '').trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseDateValue(value) {
  if (!value) return null;
  const s = String(value).trim();
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateBg(value) {
  const date = parseDateValue(value);
  if (!date) return 'Без дата';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatDayMonth(value) {
  const date = parseDateValue(value);
  if (!date) return { day: '--', month: '--' };
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: bgMonthsShort[date.getMonth()] || '--'
  };
}

function sortByDateField(items, fieldName) {
  return [...items].sort((a, b) => {
    const aDate = parseDateValue(a?.[fieldName]);
    const bDate = parseDateValue(b?.[fieldName]);
    if (aDate && bDate) return aDate - bDate;
    if (aDate) return -1;
    if (bDate) return 1;
    return 0;
  });
}

function getAdminSectionRefs(collectionName) {
  const map = {
    events: {
      listId: 'admin-events-list',
      statusId: 'admin-events-status',
      emptyText: 'Няма събития за показване.',
      loadingText: 'Зареждане на събития...',
      loadErrorText: 'Грешка при зареждане на събитията.',
      deleteConfirmText: 'Сигурни ли сте, че искате да изтриете това събитие?',
      deleteSuccessText: 'Събитието е изтрито.'
    },
    achievements: {
      listId: 'admin-achievements-list',
      statusId: 'admin-achievements-status',
      emptyText: 'Няма постижения за показване.',
      loadingText: 'Зареждане на постижения...',
      loadErrorText: 'Грешка при зареждане на постиженията.',
      deleteConfirmText: 'Сигурни ли сте, че искате да изтриете това постижение?',
      deleteSuccessText: 'Постижението е изтрито.'
    },
    charity: {
      listId: 'admin-charity-list',
      statusId: 'admin-charity-status',
      emptyText: 'Няма инициативи за показване.',
      loadingText: 'Зареждане на инициативи...',
      loadErrorText: 'Грешка при зареждане на инициативите.',
      deleteConfirmText: 'Сигурни ли сте, че искате да изтриете тази инициатива?',
      deleteSuccessText: 'Инициативата е изтрита.'
    }
  };

  const config = map[collectionName];
  if (!config) return null;

  const listEl = document.getElementById(config.listId);
  const statusEl = document.getElementById(config.statusId);
  if (!listEl || !statusEl) return null;

  return { ...config, listEl, statusEl };
}

function buildDeleteButton() {
  return '<button type="button" class="admin-delete-event">Delete</button>';
}

function renderAdminEvents(items) {
  const refs = getAdminSectionRefs('events');
  if (!refs) return;

  if (!Array.isArray(items)) {
    refs.listEl.innerHTML = '<div class="section-message section-message--error">Събитията не могат да бъдат заредени.</div>';
    setStatus(refs.statusEl, refs.loadErrorText, 'error');
    return;
  }

  if (!items.length) {
    refs.listEl.innerHTML = `<div class="section-message">${refs.emptyText}</div>`;
    setStatus(refs.statusEl, '');
    return;
  }

  const sorted = sortByDateField(items, 'date');
  refs.listEl.innerHTML = sorted.map(item => {
    const { day, month } = formatDayMonth(item.date);
    const title = escapeHtml(item.title || 'Без заглавие');
    const description = escapeHtml(item.description || '');
    const dateText = escapeHtml(formatDateBg(item.date));
    const docId = escapeHtml(item.id || '');

    return `
      <article class="event-card admin-event-card admin-manage-card" data-id="${docId}" data-collection="events">
        ${buildDeleteButton()}
        <div class="event-date">
          <span class="day">${day}</span>
          <span class="month">${month}</span>
        </div>
        <div class="event-body">
          <h3>${title}</h3>
          <p class="event-card-date">${dateText}</p>
          <p>${description}</p>
        </div>
      </article>
    `;
  }).join('');

  setStatus(refs.statusEl, '');
}

function renderAdminAchievements(items) {
  const refs = getAdminSectionRefs('achievements');
  if (!refs) return;

  if (!Array.isArray(items)) {
    refs.listEl.innerHTML = '<div class="section-message section-message--error">Постиженията не могат да бъдат заредени.</div>';
    setStatus(refs.statusEl, refs.loadErrorText, 'error');
    return;
  }

  if (!items.length) {
    refs.listEl.innerHTML = `<div class="section-message">${refs.emptyText}</div>`;
    setStatus(refs.statusEl, '');
    return;
  }

  refs.listEl.innerHTML = items.map(item => {
    const docId = escapeHtml(item.id || '');
    const title = escapeHtml(item.title || 'Без заглавие');
    const description = escapeHtml(item.description || '');
    const image = escapeHtml(item.image || '');

    return `
      <article class="admin-manage-card" data-id="${docId}" data-collection="achievements">
        ${buildDeleteButton()}
        <h4 class="admin-manage-title">${title}</h4>
        <p class="admin-manage-text">${description}</p>
        ${image ? `<img class="admin-achievement-image" src="${image}" alt="Постижение">` : ''}
      </article>
    `;
  }).join('');

  setStatus(refs.statusEl, '');
}

function renderAdminCharity(items) {
  const refs = getAdminSectionRefs('charity');
  if (!refs) return;

  if (!Array.isArray(items)) {
    refs.listEl.innerHTML = '<div class="section-message section-message--error">Инициативите не могат да бъдат заредени.</div>';
    setStatus(refs.statusEl, refs.loadErrorText, 'error');
    return;
  }

  if (!items.length) {
    refs.listEl.innerHTML = `<div class="section-message">${refs.emptyText}</div>`;
    setStatus(refs.statusEl, '');
    return;
  }

  const sorted = [...items].sort((a, b) => {
    const aYear = Number(a?.year);
    const bYear = Number(b?.year);
    const aNum = Number.isFinite(aYear);
    const bNum = Number.isFinite(bYear);
    if (aNum && bNum) return bYear - aYear;
    return String(b?.year || '').localeCompare(String(a?.year || ''), 'bg');
  });

  refs.listEl.innerHTML = sorted.map(item => {
    const docId = escapeHtml(item.id || '');
    const year = escapeHtml(item.year || 'Без година');
    const title = escapeHtml(item.title || 'Без заглавие');
    const description = escapeHtml(item.description || '');

    return `
      <article class="admin-manage-card" data-id="${docId}" data-collection="charity">
        ${buildDeleteButton()}
        <h4 class="admin-manage-title">${title}</h4>
        <p class="admin-manage-meta">${year}</p>
        <p class="admin-manage-text">${description}</p>
      </article>
    `;
  }).join('');

  setStatus(refs.statusEl, '');
}

async function loadAdminCollection(collectionName, renderer) {
  const refs = getAdminSectionRefs(collectionName);
  if (!refs) return;
  setStatus(refs.statusEl, refs.loadingText);

  try {
    const items = await fetchCollectionDocs(collectionName);
    renderer(items);
  } catch (error) {
    console.error(`admin.loadAdminCollection(${collectionName}) error`, error);
    renderer(null);
  }
}

async function loadAdminEvents() {
  await loadAdminCollection('events', renderAdminEvents);
}

async function loadAdminAchievements() {
  await loadAdminCollection('achievements', renderAdminAchievements);
}

async function loadAdminCharity() {
  await loadAdminCollection('charity', renderAdminCharity);
}

async function loadAllAdminCards() {
  await Promise.all([
    loadAdminEvents(),
    loadAdminAchievements(),
    loadAdminCharity()
  ]);
}

function setupAdminDeleteHandlers() {
  const dashboard = document.getElementById('admin-dashboard');
  if (!dashboard) return;

  dashboard.addEventListener('click', async event => {
    const btn = event.target.closest('.admin-delete-event');
    if (!btn) return;

    const card = btn.closest('[data-id][data-collection]');
    const docId = card?.getAttribute('data-id');
    const collectionName = card?.getAttribute('data-collection');
    if (!card || !docId || !collectionName) return;

    const refs = getAdminSectionRefs(collectionName);
    if (!refs) return;

    const shouldDelete = window.confirm(refs.deleteConfirmText);
    if (!shouldDelete) return;

    btn.disabled = true;
    setStatus(refs.statusEl, 'Изтриване...');

    try {
      await deleteDoc(doc(db, collectionName, docId));
      card.remove();

      if (!refs.listEl.querySelector(`[data-collection="${collectionName}"]`)) {
        refs.listEl.innerHTML = `<div class="section-message">${refs.emptyText}</div>`;
      }

      setStatus(refs.statusEl, refs.deleteSuccessText, 'success');
    } catch (error) {
      console.error(`admin.deleteItem(${collectionName}) error`, error);
      setStatus(refs.statusEl, `Грешка при изтриване: ${error.message || 'неизвестна'}`, 'error');
      btn.disabled = false;
    }
  });
}

function setupLogin(onUnlock) {
  const loginSection = document.getElementById('admin-login');
  const dashboard = document.getElementById('admin-dashboard');
  const form = document.getElementById('admin-login-form');
  const input = document.getElementById('admin-password');
  const status = document.getElementById('admin-login-status');

  if (!form || !input || !loginSection || !dashboard) return;

  form.addEventListener('submit', event => {
    event.preventDefault();
    const entered = input.value;

    if (entered === ADMIN_PASSWORD) {
      loginSection.hidden = true;
      dashboard.hidden = false;
      setStatus(status, '');
      if (typeof onUnlock === 'function') onUnlock();
      return;
    }

    setStatus(status, 'Невалидна парола.', 'error');
  });
}

function setupContentForm(formId, collectionName, payloadBuilder, onSuccess) {
  const form = document.getElementById(formId);
  const status = document.querySelector(`[data-status-for="${collectionName}"]`);
  if (!form || !status) return;

  form.addEventListener('submit', async event => {
    event.preventDefault();

    let payload;
    try {
      payload = payloadBuilder(new FormData(form));
    } catch (error) {
      setStatus(status, error.message || 'Невалидни данни.', 'error');
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    setStatus(status, 'Записване...');

    try {
      await addCollectionDoc(collectionName, payload);
      form.reset();
      setStatus(status, 'Записано успешно.', 'success');
      if (typeof onSuccess === 'function') {
        try {
          await onSuccess(payload);
        } catch (error) {
          console.error(`onSuccess error for ${collectionName}`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to save in ${collectionName}`, error);
      setStatus(status, `Грешка при запис: ${error.message || 'неизвестна'}`, 'error');
    } finally {
      if (button) button.disabled = false;
    }
  });
}

function setupScheduleCsvUpload() {
  const uploadBtn = document.getElementById('uploadBtn');
  const fileInput = document.getElementById('csvFile');
  const status = document.getElementById('schedule-upload-status');

  if (!uploadBtn || !fileInput || !status) return;

  uploadBtn.addEventListener('click', async () => {
    const file = fileInput.files?.[0];

    if (!file) {
      setStatus(status, 'Моля, изберете CSV файл.', 'error');
      return;
    }

    uploadBtn.disabled = true;
    setStatus(status, 'Обработка на CSV файла...');

    try {
      const text = await file.text();
      const rows = text.split('\n').map(row => row.trim()).filter(row => row.length);

      if (rows.length < 2) {
        throw new Error('CSV файлът няма достатъчно данни.');
      }

      rows.shift(); // header

      const data = {};

      rows.forEach(row => {
        const columns = row.split(',').map(cell => cell.trim());
        if (columns.length < 5) return;

        const [cls, dayBg, periodStr, subject, room, teacher] = columns;

        if (!bgDays.includes(dayBg)) return;

        const period = parseInt(periodStr, 10) - 1;
        if (Number.isNaN(period) || period < 0 || period > 6) return;

        const normalizedClass = mapImporterClassToFirestoreId(cls || '');
        if (!data[normalizedClass]) {
          data[normalizedClass] = {};
          bgDays.forEach(day => {
            data[normalizedClass][day] = Array.from({ length: 7 }, () => ({ subject: '', room: '', teacher: '' }));
          });
        }

        data[normalizedClass][dayBg][period] = {
          subject: subject || '',
          room: room || '',
          teacher: teacher || ''
        };
      });

      const classIds = Object.keys(data);
      if (!classIds.length) {
        throw new Error('Няма валидни редове за качване.');
      }

      let uploaded = 0;
      let failed = 0;

      for (const classId of classIds) {
        try {
          await writeScheduleDoc(classId, data[classId]);
          uploaded += 1;
        } catch (error) {
          failed += 1;
          console.error('Failed to upload class:', classId, error);
        }
      }

      if (failed > 0) {
        setStatus(status, `Качени: ${uploaded}, грешки: ${failed}.`, 'error');
      } else {
        setStatus(status, `Качени успешно програми за ${uploaded} класа.`, 'success');
      }
    } catch (error) {
      console.error('CSV upload error', error);
      setStatus(status, `Грешка: ${error.message || 'неизвестна'}`, 'error');
    } finally {
      uploadBtn.disabled = false;
    }
  });
}

function initAdmin() {
  setupLogin(() => {
    loadAllAdminCards();
  });

  setupAdminDeleteHandlers();

  setupContentForm('events-form', 'events', form => {
    const title = trimValue(form.get('title'));
    const description = trimValue(form.get('description'));
    const date = trimValue(form.get('date'));

    if (!title || !description || !date) {
      throw new Error('Попълнете всички полета за събитие.');
    }

    return { title, description, date };
  }, async () => {
    await loadAdminEvents();
  });

  setupContentForm('achievements-form', 'achievements', form => {
    const title = trimValue(form.get('title'));
    const description = trimValue(form.get('description'));
    const image = trimValue(form.get('image'));

    if (!title || !description || !image) {
      throw new Error('Попълнете всички полета за постижение.');
    }

    return { title, description, image };
  }, async () => {
    await loadAdminAchievements();
  });

  setupContentForm('consultations-form', 'consultations', form => {
    const date = trimValue(form.get('date'));
    const subject = trimValue(form.get('subject'));
    const teacher = trimValue(form.get('teacher'));
    const room = trimValue(form.get('room'));

    if (!date || !subject || !teacher || !room) {
      throw new Error('Попълнете всички полета за консултация.');
    }

    return { date, subject, teacher, room };
  });

  setupContentForm('charity-form', 'charity', form => {
    const year = trimValue(form.get('year'));
    const title = trimValue(form.get('title'));
    const description = trimValue(form.get('description'));

    if (!year || !title || !description) {
      throw new Error('Попълнете всички полета за инициатива.');
    }

    return { year, title, description };
  }, async () => {
    await loadAdminCharity();
  });

  setupScheduleCsvUpload();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}
