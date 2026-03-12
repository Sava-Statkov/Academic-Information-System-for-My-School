import { addCollectionDoc, writeScheduleDoc } from './firebase.js';

// Client-side password gate for simple local admin access.
// Change this value before deploying to production.
const ADMIN_PASSWORD = 'admin123';

const bgDays = ['Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък'];

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

function setupLogin() {
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
      return;
    }

    setStatus(status, 'Невалидна парола.', 'error');
  });
}

function setupContentForm(formId, collectionName, payloadBuilder) {
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
  setupLogin();

  setupContentForm('events-form', 'events', form => {
    const title = trimValue(form.get('title'));
    const description = trimValue(form.get('description'));
    const date = trimValue(form.get('date'));

    if (!title || !description || !date) {
      throw new Error('Попълнете всички полета за събитие.');
    }

    return { title, description, date };
  });

  setupContentForm('achievements-form', 'achievements', form => {
    const title = trimValue(form.get('title'));
    const description = trimValue(form.get('description'));
    const image = trimValue(form.get('image'));

    if (!title || !description || !image) {
      throw new Error('Попълнете всички полета за постижение.');
    }

    return { title, description, image };
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
  });

  setupScheduleCsvUpload();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}
