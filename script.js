import { fetchScheduleDoc, mapClassToFirestoreId, fetchCollectionDocs } from './firebase.js';

const BG_MONTHS_FULL = [
  'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
  'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'
];

const BG_MONTHS_SHORT = ['ЯНУ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ЮНИ', 'ЮЛИ', 'АВГ', 'СЕП', 'ОКТ', 'НОЕ', 'ДЕК'];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toDateObject(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'object' && typeof value.seconds === 'number') {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const isoDateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDateOnly) {
      const year = Number(isoDateOnly[1]);
      const month = Number(isoDateOnly[2]) - 1;
      const day = Number(isoDateOnly[3]);
      const date = new Date(year, month, day);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function dateToKey(value) {
  const date = toDateObject(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateBG(value) {
  const date = toDateObject(value);
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatDayMonth(value) {
  const date = toDateObject(value);
  if (!date) return { day: '--', month: '--' };
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: BG_MONTHS_SHORT[date.getMonth()] || '--'
  };
}

function compareByDate(a, b, field) {
  const aDate = toDateObject(a?.[field]);
  const bDate = toDateObject(b?.[field]);

  if (aDate && bDate) return aDate - bDate;
  if (aDate) return -1;
  if (bDate) return 1;
  return 0;
}

function setBlockMessage(container, message, isError = false) {
  if (!container) return;
  container.innerHTML = `<div class="section-message${isError ? ' section-message--error' : ''}">${escapeHtml(message)}</div>`;
}

function buildCalendarEventsMap(eventsItems) {
  const map = {};
  eventsItems.forEach(item => {
    const key = dateToKey(item.date);
    if (!key) return;
    map[key] = {
      title: String(item.title || 'Без заглавие'),
      description: String(item.description || ''),
      dateText: formatDateBG(item.date)
    };
  });
  return map;
}

function renderEventsCards(eventsItems) {
  const cardsRoot = document.getElementById('events-cards');
  if (!cardsRoot) return;

  if (!Array.isArray(eventsItems)) {
    setBlockMessage(cardsRoot, 'Събитията не могат да бъдат заредени в момента.', true);
    return;
  }

  if (!eventsItems.length) {
    setBlockMessage(cardsRoot, 'Все още няма публикувани събития.');
    return;
  }

  const sorted = [...eventsItems].sort((a, b) => compareByDate(a, b, 'date'));

  cardsRoot.innerHTML = sorted.map(item => {
    const { day, month } = formatDayMonth(item.date);
    const title = escapeHtml(item.title || 'Без заглавие');
    const description = escapeHtml(item.description || '');
    const dateLabel = escapeHtml(formatDateBG(item.date) || 'Без дата');

    return `
      <article class="event-card">
        <div class="event-date">
          <span class="day">${day}</span>
          <span class="month">${month}</span>
        </div>
        <div class="event-body">
          <h3>${title}</h3>
          <p class="event-card-date">${dateLabel}</p>
          <p>${description}</p>
        </div>
      </article>
    `;
  }).join('');
}

function renderAchievements(achievementsItems) {
  const grid = document.getElementById('achievements-grid');
  if (!grid) return;

  if (!Array.isArray(achievementsItems)) {
    setBlockMessage(grid, 'Постиженията не могат да бъдат заредени в момента.', true);
    return;
  }

  if (!achievementsItems.length) {
    setBlockMessage(grid, 'Все още няма публикувани постижения.');
    return;
  }

  grid.innerHTML = achievementsItems.map((item, index) => {
    const directionClass = index % 2 === 0 ? 'achievement-card--left' : 'achievement-card--right';
    const title = escapeHtml(item.title || 'Без заглавие');
    const description = escapeHtml(item.description || '');
    const image = escapeHtml(item.image || 'images/logo.png');
    const altText = `Снимка към постижение: ${title}`;

    return `
      <article class="achievement-card ${directionClass} reveal">
        <div class="achievement-image">
          <img src="${image}" alt="${escapeHtml(altText)}">
        </div>
        <div class="achievement-content">
          <h3>${title}</h3>
          <p>${description}</p>
        </div>
      </article>
    `;
  }).join('');
}

function renderConsultations(consultationsItems) {
  const tbody = document.getElementById('consultations-body');
  if (!tbody) return;

  if (!Array.isArray(consultationsItems)) {
    tbody.innerHTML = '<tr><td colspan="4" class="consultation-empty consultation-empty--error">Консултациите не могат да бъдат заредени в момента.</td></tr>';
    return;
  }

  if (!consultationsItems.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="consultation-empty">Все още няма публикувани консултации.</td></tr>';
    return;
  }

  const sorted = [...consultationsItems].sort((a, b) => compareByDate(a, b, 'date'));

  tbody.innerHTML = sorted.map(item => `
    <tr>
      <td>${escapeHtml(formatDateBG(item.date) || '-')}</td>
      <td>${escapeHtml(item.subject || '-')}</td>
      <td>${escapeHtml(item.teacher || '-')}</td>
      <td>${escapeHtml(item.room || '-')}</td>
    </tr>
  `).join('');
}

function renderCharity(charityItems) {
  const timeline = document.getElementById('charity-timeline');
  if (!timeline) return;

  if (!Array.isArray(charityItems)) {
    setBlockMessage(timeline, 'Инициативите не могат да бъдат заредени в момента.', true);
    return;
  }

  if (!charityItems.length) {
    setBlockMessage(timeline, 'Все още няма публикувани благотворителни инициативи.');
    return;
  }

  const groups = new Map();
  charityItems.forEach(item => {
    const year = String(item.year || 'Без година').trim() || 'Без година';
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(item);
  });

  const years = [...groups.keys()].sort((a, b) => {
    const aNum = Number(a);
    const bNum = Number(b);
    const aIsNum = Number.isFinite(aNum);
    const bIsNum = Number.isFinite(bNum);
    if (aIsNum && bIsNum) return bNum - aNum;
    return b.localeCompare(a, 'bg');
  });

  const html = years.map(year => {
    const items = groups.get(year) || [];
    const cards = items.map(item => `
      <article class="timeline-item reveal">
        <div class="timeline-marker"></div>
        <div class="timeline-content">
          <time class="timeline-date">${escapeHtml(year)}</time>
          <h3>${escapeHtml(item.title || 'Без заглавие')}</h3>
          <p>${escapeHtml(item.description || '')}</p>
        </div>
      </article>
    `).join('');

    return `<h3 class="charity-year-title">${escapeHtml(year)}</h3>${cards}`;
  }).join('');

  timeline.innerHTML = html;
}

async function fetchCollectionSafe(name) {
  try {
    return await fetchCollectionDocs(name);
  } catch (error) {
    console.error(`Failed to fetch ${name}`, error);
    return null;
  }
}

async function loadDynamicSections() {
  const [eventsItems, achievementsItems, charityItems] = await Promise.all([
    fetchCollectionSafe('events'),
    fetchCollectionSafe('achievements'),
    fetchCollectionSafe('charity')
  ]);

  renderEventsCards(eventsItems);
  renderAchievements(achievementsItems);
  renderCharity(charityItems);

  return buildCalendarEventsMap(Array.isArray(eventsItems) ? eventsItems : []);
}

function initCalendar(eventsByDate = {}) {
  const calendarRoot = document.getElementById('calendar-root');
  const eventDetailsRoot = document.getElementById('calendar-event-details');
  if (!calendarRoot) return;

  const WEEKDAYS = ['Пон', 'Вт', 'Ср', 'Чет', 'Пет', 'Съб', 'Нед'];

  const today = new Date();
  let currentMonth = today.getMonth();
  let currentYear = today.getFullYear();
  let selectedDate = null;

  function pad(value) {
    return value < 10 ? `0${value}` : `${value}`;
  }

  function getEventKey(year, month, day) {
    return `${year}-${pad(month + 1)}-${pad(day)}`;
  }

  function renderCalendar(year, month, animate = true) {
    calendarRoot.innerHTML = '';
    if (animate) {
      calendarRoot.classList.add('calendar-fade');
      setTimeout(() => calendarRoot.classList.remove('calendar-fade'), 400);
    }

    const header = document.createElement('div');
    header.className = 'calendar-header';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'calendar-nav-btn';
    prevBtn.innerHTML = '&#8592;';
    prevBtn.type = 'button';
    prevBtn.addEventListener('click', () => changeMonth(-1));

    const nextBtn = document.createElement('button');
    nextBtn.className = 'calendar-nav-btn';
    nextBtn.innerHTML = '&#8594;';
    nextBtn.type = 'button';
    nextBtn.addEventListener('click', () => changeMonth(1));

    const monthLabel = document.createElement('span');
    monthLabel.className = 'calendar-month';
    monthLabel.textContent = `${BG_MONTHS_FULL[month]} ${year}`;

    header.append(prevBtn, monthLabel, nextBtn);
    calendarRoot.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    WEEKDAYS.forEach(day => {
      const cell = document.createElement('div');
      cell.className = 'calendar-day';
      cell.textContent = day;
      grid.appendChild(cell);
    });

    const firstDay = new Date(year, month, 1);
    let startDay = firstDay.getDay();
    startDay = (startDay + 6) % 7;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = startDay + daysInMonth;

    for (let i = 0; i < startDay; i += 1) {
      const empty = document.createElement('div');
      empty.className = 'calendar-date calendar-date--inactive';
      grid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = getEventKey(year, month, day);
      const hasEvent = Boolean(eventsByDate[dateKey]);

      const dateEl = document.createElement('div');
      dateEl.className = 'calendar-date';

      if (hasEvent) dateEl.classList.add('calendar-date--event');
      if (day === today.getDate() && year === today.getFullYear() && month === today.getMonth()) {
        dateEl.classList.add('calendar-date--today');
      }

      dateEl.textContent = day;

      if (hasEvent) {
        dateEl.setAttribute('role', 'button');
        dateEl.tabIndex = 0;
        dateEl.addEventListener('click', () => showEvent(dateKey));
        dateEl.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            showEvent(dateKey);
          }
        });
      }

      grid.appendChild(dateEl);
    }

    const gridRows = Math.ceil(totalCells / 7);
    for (let i = totalCells; i < gridRows * 7; i += 1) {
      const empty = document.createElement('div');
      empty.className = 'calendar-date calendar-date--inactive';
      grid.appendChild(empty);
    }

    calendarRoot.appendChild(grid);
  }

  function showEvent(dateKey) {
    selectedDate = dateKey;
    renderEventDetails();
  }

  function renderEventDetails() {
    if (!eventDetailsRoot) return;

    if (!selectedDate || !eventsByDate[selectedDate]) {
      eventDetailsRoot.innerHTML = '';
      return;
    }

    const event = eventsByDate[selectedDate];
    const safeTitle = escapeHtml(event.title || 'Без заглавие');
    const safeDescription = escapeHtml(event.description || '');
    const safeDate = escapeHtml(event.dateText || '');

    eventDetailsRoot.innerHTML = `
      <div class="calendar-event-details">
        <div class="calendar-event-title">${safeTitle}</div>
        <div class="calendar-event-desc">${safeDate}${safeDescription ? ` - ${safeDescription}` : ''}</div>
      </div>`;
  }

  function changeMonth(delta) {
    currentMonth += delta;

    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear += 1;
    } else if (currentMonth < 0) {
      currentMonth = 11;
      currentYear -= 1;
    }

    selectedDate = null;
    renderCalendar(currentYear, currentMonth);
    renderEventDetails();
  }

  renderCalendar(currentYear, currentMonth, false);
  renderEventDetails();
}

function normalizeSchedule(data) {
  const bgDays = ['Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък'];
  const result = {};
  if (!data || typeof data !== 'object') {
    bgDays.forEach(day => {
      result[day] = Array.from({ length: 7 }, () => ({ subject: '', room: '', teacher: '' }));
    });
    return result;
  }

  const enToBg = {
    monday: 'Понеделник',
    tuesday: 'Вторник',
    wednesday: 'Сряда',
    thursday: 'Четвъртък',
    friday: 'Петък'
  };

  function normalizeEntry(entry) {
    if (!entry) return { subject: '', room: '', teacher: '' };
    if (typeof entry === 'string') {
      return { subject: entry, room: '', teacher: '' };
    }
    if (typeof entry === 'object') {
      const subject = entry.subject || entry.name || entry.period || entry.title || Object.values(entry).find(val => typeof val === 'string') || '';
      const room = entry.room || entry.class || entry.roomNumber || '';
      const teacher = entry.teacher || entry.teacherName || entry.teacher_full || entry.teacher_fullname || entry.instructor || '';
      return { subject: String(subject), room: String(room), teacher: String(teacher) };
    }
    return { subject: String(entry), room: '', teacher: '' };
  }

  function findKeyForBgDay(bgDay) {
    const lowerBgDay = bgDay.toLowerCase();
    for (const key of Object.keys(data)) {
      const lowerKey = String(key).toLowerCase();
      if (lowerKey === lowerBgDay) return key;
      if (enToBg[lowerKey] && enToBg[lowerKey] === bgDay) return key;
    }
    for (const key of Object.keys(data)) {
      const lowerKey = String(key).toLowerCase();
      if (lowerKey.startsWith(lowerBgDay.slice(0, 3))) return key;
      if (enToBg[lowerKey] && enToBg[lowerKey].toLowerCase().startsWith(lowerBgDay.slice(0, 3))) {
        return key;
      }
    }
    return null;
  }

  bgDays.forEach(day => {
    const key = findKeyForBgDay(day);
    const raw = key ? data[key] : undefined;
    let entries = [];

    if (Array.isArray(raw)) {
      entries = raw.map(normalizeEntry).slice(0, 7);
      while (entries.length < 7) entries.push({ subject: '', room: '', teacher: '' });
    } else if (raw && typeof raw === 'object') {
      for (let period = 1; period <= 7; period += 1) {
        let cell = null;
        const candidates = [`period${period}`, `Period${period}`, `${period}`, `p${period}`];
        for (const candidate of candidates) {
          if (candidate in raw) {
            cell = raw[candidate];
            break;
          }
        }
        if (!cell) {
          const numeric = Object.keys(raw).find(k => /\b\d+\b/.test(k) && Number(k) === period);
          if (numeric) cell = raw[numeric];
        }
        entries.push(normalizeEntry(cell));
      }
    } else {
      entries = Array.from({ length: 7 }, () => ({ subject: '', room: '', teacher: '' }));
    }

    result[day] = entries;
  });

  return result;
}

function initStickyHeader() {
  const headerTop = document.querySelector('.header-top');
  if (!headerTop) return;
  const threshold = 80;

  function handleScroll() {
    if (window.scrollY > threshold) {
      headerTop.classList.add('scrolled');
    } else {
      headerTop.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();
}

function normalizeStaticTableCells() {
  const cells = document.querySelectorAll('.schedule-table td');
  cells.forEach(td => {
    if (td.querySelector('.cell-main')) return;
    const subjectEl = td.querySelector('.cell-subject');
    if (!subjectEl) return;
    const roomEl = td.querySelector('.cell-room');
    const teacherEl = td.querySelector('.cell-teacher');
    const subject = (subjectEl.textContent || '').trim();
    const room = roomEl ? (roomEl.textContent || '').trim() : '';
    const teacher = teacherEl ? (teacherEl.textContent || '').trim() : '';
    if (!subject) {
      td.textContent = '';
      return;
    }
    const mainLine = room ? `${subject} - ${room}` : subject;
    td.innerHTML = `<div class="cell-main">${mainLine}</div>${teacher ? `<div class="cell-teacher">${teacher}</div>` : ''}`;
  });
}

function initMobileMenu() {
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.getElementById('nav-menu');
  if (!toggle || !menu) return;

  function toggleMenu() {
    const isOpen = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', isOpen);
  }

  function closeMenu() {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', toggleMenu);

  document.addEventListener('click', event => {
    if (!menu.classList.contains('is-open')) return;
    if (menu.contains(event.target) || toggle.contains(event.target)) return;
    closeMenu();
  });

  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
}

function initScheduleByGrade() {
  const selects = document.querySelectorAll('.schedule-select');
  const tables = document.querySelectorAll('.schedule-table-grade');
  if (!selects.length || !tables.length) return;

  const hourTimes = { 1: '7:30–8:10', 2: '8:20–9:00', 3: '9:10–9:50', 4: '10:10–10:50', 5: '11:00–11:40', 6: '11:50–12:30', 7: '12:40–13:20' };

  function buildRows(schedule) {
    const rows = [];
    for (let hour = 1; hour <= 7; hour += 1) {
      const cells = [];
      const time = hourTimes[hour] || '';
      cells.push(`<td><span class="hour-num">${hour}</span><span class="hour-time">${time}</span></td>`);
      ['Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък'].forEach(day => {
        const entry = schedule?.[day]?.[hour - 1] || { subject: '', room: '', teacher: '' };
        const subject = (entry.subject || '').trim();
        const room = (entry.room || '').trim();
        const teacher = (entry.teacher || '').trim();
        if (!subject) {
          cells.push('<td></td>');
          return;
        }
        const mainLine = room ? `${subject} - ${room}` : subject;
        cells.push(`<td><div class="cell-main">${mainLine}</div>${teacher ? `<div class="cell-teacher">${teacher}</div>` : ''}</td>`);
      });
      rows.push(`<tr>${cells.join('')}</tr>`);
    }
    return rows.join('');
  }

  function ensureSevenRows() {
    tables.forEach(table => {
      const tbody = table.querySelector('tbody');
      if (!tbody) return;
      const currentRows = tbody.querySelectorAll('tr').length;
      for (let i = currentRows + 1; i <= 7; i += 1) {
        const cells = [];
        const time = hourTimes[i] || '';
        cells.push(`<td><span class="hour-num">${i}</span><span class="hour-time">${time}</span></td>`);
        for (let j = 0; j < 5; j += 1) {
          cells.push('<td></td>');
        }
        tbody.insertAdjacentHTML('beforeend', `<tr>${cells.join('')}</tr>`);
      }
    });
  }

  async function fetchAndRender(grade) {
    if (!grade) return;
    const tableBlock = document.querySelector(`.schedule-table-grade[data-grade="${grade}"]`);
    if (!tableBlock) return;
    try {
      const docId = mapClassToFirestoreId(String(grade));
      const snap = await fetchScheduleDoc(docId);
      if (snap.exists()) {
        const normalized = normalizeSchedule(snap.data());
        const tbody = tableBlock.querySelector('tbody');
        if (tbody) {
          tbody.innerHTML = buildRows(normalized);
        }
        setScheduleStatus(`Заредена програма: ${docId}`, false);
      } else {
        setScheduleStatus(`Документът ${docId} не е намерен в Firestore.`, true);
      }
    } catch (error) {
      console.error('schedule fetch error', error);
      setScheduleStatus(`Грешка при зареждане: ${error.message || 'неизвестна'}`, true);
    }
  }

  function showGrade(grade) {
    tables.forEach(table => {
      const isActive = table.getAttribute('data-grade') === grade;
      table.classList.toggle('active', isActive);
      table.setAttribute('aria-hidden', (!isActive).toString());
    });
  }

  function resetSelects(except) {
    selects.forEach(select => {
      if (select !== except) select.value = '';
    });
  }

  selects.forEach(select => {
    select.addEventListener('change', () => {
      const value = select.value;
      if (!value) {
        resetSelects(null);
        return;
      }
      resetSelects(select);
      showGrade(value);
      fetchAndRender(value);
    });
  });

  const activeBlock = document.querySelector('.schedule-table-grade.active');
  if (activeBlock) {
    const grade = activeBlock.getAttribute('data-grade');
    fetchAndRender(grade);
  }

  ensureSevenRows();
}

function setScheduleStatus(message, isError) {
  const section = document.querySelector('.section-schedule .container');
  if (!section) return;
  let status = section.querySelector('.schedule-status');
  if (!status) {
    status = document.createElement('div');
    status.className = 'schedule-status';
    section.insertBefore(status, section.querySelector('.schedule-tables'));
  }
  status.textContent = message;
  status.style.background = isError ? '#fdecec' : '#eef7ea';
  status.style.borderColor = isError ? '#f5c6cb' : '#c6e6c6';
  status.style.color = isError ? '#611a15' : '#164d17';
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    const href = anchor.getAttribute('href');
    if (href === '#') return;
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    anchor.addEventListener('click', event => {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function initReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -60px 0px'
  });
  elements.forEach(el => observer.observe(el));
}

function initPodcastButtons() {
  const audio = document.getElementById('main-audio');
  const buttons = document.querySelectorAll('.episode-play');
  if (!audio || !buttons.length) return;
  buttons.forEach(button => button.addEventListener('click', () => {
    audio.play();
  }));
}

async function init() {
  initStickyHeader();
  initMobileMenu();
  normalizeStaticTableCells();
  initScheduleByGrade();
  initSmoothScroll();
  initPodcastButtons();

  const eventsByDate = await loadDynamicSections();
  initCalendar(eventsByDate);
  initReveal();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
