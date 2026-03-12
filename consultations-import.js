import { db } from './firebase.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';

function setStatus(message, type = '') {
  const status = document.getElementById('consultationsImportStatus');
  if (!status) return;
  status.textContent = message || '';
  status.classList.remove('error', 'success');
  if (type) status.classList.add(type);
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function sanitizeTeacherDocId(teacherName) {
  const base = String(teacherName || '')
    .trim()
    .toLowerCase()
    .replace(/\//g, '-')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9\u0400-\u04ff_-]/g, '');

  if (base) return base;

  return `teacher_${Date.now()}`;
}

function parseConsultationsCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const firstCols = parseCsvLine(lines[0]).map(col => col.toLowerCase());
  const hasHeader = firstCols[0] === 'teacher' && firstCols.includes('students_day');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map(parseCsvLine)
    .filter(cols => cols.length >= 6)
    .map(cols => ({
      teacher: cols[0],
      students_day: cols[1],
      students_time: cols[2],
      parents_day: cols[3],
      parents_time: cols[4],
      room: cols[5]
    }))
    .filter(item => item.teacher);
}

async function uploadConsultationsCsv() {
  const fileInput = document.getElementById('consultationsCsv');
  const button = document.getElementById('consultationsUploadBtn');

  const file = fileInput?.files?.[0];
  if (!file) {
    setStatus('Моля, изберете CSV файл.', 'error');
    return;
  }

  button.disabled = true;
  setStatus('Качване...');

  try {
    const text = await file.text();
    const rows = parseConsultationsCsv(text);

    if (!rows.length) {
      throw new Error('Няма валидни редове за качване.');
    }

    let uploaded = 0;

    for (const row of rows) {
      const docId = sanitizeTeacherDocId(row.teacher);
      await setDoc(doc(db, 'consultations', docId), {
        teacher: row.teacher,
        students_day: row.students_day,
        students_time: row.students_time,
        parents_day: row.parents_day,
        parents_time: row.parents_time,
        room: row.room
      });
      uploaded += 1;
    }

    setStatus(`Успешно качени ${uploaded} консултации.`, 'success');
  } catch (error) {
    console.error('consultations-import upload error', error);
    setStatus(`Грешка: ${error.message || 'неизвестна'}`, 'error');
  } finally {
    button.disabled = false;
  }
}

function initConsultationsImport() {
  const button = document.getElementById('consultationsUploadBtn');
  if (!button) return;

  button.addEventListener('click', uploadConsultationsCsv);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initConsultationsImport);
} else {
  initConsultationsImport();
}
