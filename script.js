// ========== EVENTS CALENDAR DATA ========== //
const events = {
  "2026-02-16": {
    title: "Национална олимпиада по математика",
    description: "Регионален кръг."
  },
  "2026-02-21": {
    title: "Олимпиада по английски език",
    description: "Областен кръг."
  },
  "2026-01-18": {
    title: "Ден на отворените врати",
    description: "Посещение на родители и ученици."
  }
};

// ========== CALENDAR COMPONENT ========== //
(function initCalendar() {
  const calendarRoot = document.getElementById('calendar-root');
  const eventDetailsRoot = document.getElementById('calendar-event-details');
  if (!calendarRoot) return;

  // Bulgarian month and weekday names
  const MONTHS = [
    'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
    'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'
  ];
  const WEEKDAYS = ['Пон', 'Вт', 'Ср', 'Чет', 'Пет', 'Съб', 'Нед'];

  let today = new Date();
  let currentMonth = today.getMonth();
  let currentYear = today.getFullYear();
  let selectedDate = null;

  function pad(n) { return n < 10 ? '0' + n : n; }

  function getEventKey(year, month, day) {
    return `${year}-${pad(month + 1)}-${pad(day)}`;
  }

  function renderCalendar(year, month, animate = true) {
    // Remove old calendar
    calendarRoot.innerHTML = '';
    if (animate) calendarRoot.classList.add('calendar-fade');
    setTimeout(() => calendarRoot.classList.remove('calendar-fade'), 400);

    // Header
    const header = document.createElement('div');
    header.className = 'calendar-header';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'calendar-nav-btn';
    prevBtn.innerHTML = '&#8592;';
    prevBtn.onclick = () => { changeMonth(-1); };
    const nextBtn = document.createElement('button');
    nextBtn.className = 'calendar-nav-btn';
    nextBtn.innerHTML = '&#8594;';
    nextBtn.onclick = () => { changeMonth(1); };
    const monthLabel = document.createElement('span');
    monthLabel.className = 'calendar-month';
    monthLabel.textContent = `${MONTHS[month]} ${year}`;
    header.appendChild(prevBtn);
    header.appendChild(monthLabel);
    header.appendChild(nextBtn);
    calendarRoot.appendChild(header);

    // Days of week
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';
    WEEKDAYS.forEach(day => {
      const d = document.createElement('div');
      d.className = 'calendar-day';
      d.textContent = day;
      grid.appendChild(d);
    });

    // Dates
    const firstDay = new Date(year, month, 1);
    let startDay = firstDay.getDay();
    // JS: 0=Sunday, 1=Monday... We want Monday=0
    startDay = (startDay + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Leading empty cells
    for (let i = 0; i < startDay; i++) {
      const empty = document.createElement('div');
      empty.className = 'calendar-date calendar-date--inactive';
      grid.appendChild(empty);
    }

    // Dates of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = getEventKey(year, month, day);
      const hasEvent = !!events[dateKey];
      const dateDiv = document.createElement('div');
      dateDiv.className = 'calendar-date';
      if (hasEvent) dateDiv.classList.add('calendar-date--event');
      if (
        day === today.getDate() &&
        month === today.getMonth() &&
        year === today.getFullYear()
      ) {
        dateDiv.classList.add('calendar-date--today');
      }
      dateDiv.textContent = day;
      if (hasEvent) {
        dateDiv.tabIndex = 0;
        dateDiv.setAttribute('role', 'button');
        dateDiv.setAttribute('aria-label', events[dateKey].title);
        dateDiv.onclick = () => showEvent(dateKey);
        dateDiv.onkeydown = e => {
          if (e.key === 'Enter' || e.key === ' ') showEvent(dateKey);
        };
      }
      grid.appendChild(dateDiv);
    }

    // Trailing empty cells
    const totalCells = startDay + daysInMonth;
    for (let i = totalCells; i < 7 * Math.ceil(totalCells / 7); i++) {
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
    if (!selectedDate || !events[selectedDate]) {
      eventDetailsRoot.innerHTML = '';
      return;
    }
    const ev = events[selectedDate];
    eventDetailsRoot.innerHTML =
      `<div class="calendar-event-details">
        <div class="calendar-event-title">${ev.title}</div>
        <div class="calendar-event-desc">${ev.description}</div>
      </div>`;
  }

  function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    } else if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    selectedDate = null;
    renderCalendar(currentYear, currentMonth);
    renderEventDetails();
  }

  // Initial render
  renderCalendar(currentYear, currentMonth, false);
})();
/**
 * Втора Английска Гимназия - Уебсайт
 * Основни интеракции: sticky навигация, мобилно меню, плавен scroll, reveal анимации
 */

import { fetchScheduleDoc, mapClassToFirestoreId } from './firebase.js';

const HEADER = document.querySelector('.header-top');
const NAV_MENU = document.getElementById('nav-menu');
const NAV_TOGGLE = document.querySelector('.nav-toggle');
const REVEAL_ELEMENTS = document.querySelectorAll('.reveal');

// Firebase config (copied from your inline script)
const firebaseConfig = {
  apiKey: "AIzaSyD9IxgAmVQlALIbE8ZfKWDBethT4GlnruU",
  authDomain: "school-display-system.firebaseapp.com",
  projectId: "school-display-system",
  storageBucket: "school-display-system.firebasestorage.app",
  messagingSenderId: "180580597326",
  appId: "1:180580597326:web:63908a06072e927641cd1f"
};

// Firebase is initialized in firebase.js; use fetchScheduleDoc and writeScheduleDoc.

// Normalize different possible Firestore shapes into a canonical
// { monday: [ {subject, room}, ...7 ], tuesday: [...], ... }
function normalizeSchedule(data) {
  // Canonical Bulgarian day names (as stored in Firestore)
  const bgDays = ['Понеделник','Вторник','Сряда','Четвъртък','Петък'];
  const result = {};
  if (!data || typeof data !== 'object') {
    bgDays.forEach(d => result[d] = Array.from({ length: 7 }, () => ({ subject: '', room: '', teacher: '' })));
    return result;
  }

  // map English -> Bulgarian names to support both input shapes
  const enToBg = {
    'monday': 'Понеделник',
    'tuesday': 'Вторник',
    'wednesday': 'Сряда',
    'thursday': 'Четвъртък',
    'friday': 'Петък'
  };

  function normalizeEntry(e) {
    if (!e) return { subject: '', room: '', teacher: '' };
    if (typeof e === 'string') return { subject: e, room: '', teacher: '' };
    if (typeof e === 'object') {
      const subject = e.subject || e.name || e.period || e.title || Object.values(e).find(v => typeof v === 'string') || '';
      const room = e.room || e.class || e.roomNumber || '';
      const teacher = e.teacher || e.teacherName || e.teacher_full || e.teacher_fullname || e.instructor || '';
      return { subject: String(subject), room: String(room), teacher: String(teacher) };
    }
    return { subject: String(e), room: '', teacher: '' };
  }

  // Find data key for a given Bulgarian day name; accept either BG or English keys in source
  function findKeyForBgDay(bgDay) {
    const bgLower = bgDay.toLowerCase();
    for (const k of Object.keys(data)) {
      const kl = String(k).toLowerCase();
      if (kl === bgLower) return k; // exact Bulgarian match
      // English match
      if (enToBg[kl] && enToBg[kl] === bgDay) return k;
    }
    // try prefix matches
    for (const k of Object.keys(data)) {
      const kl = String(k).toLowerCase();
      if (kl.startsWith(bgLower.slice(0,3))) return k;
      const mapped = enToBg[kl];
      if (mapped && mapped.toLowerCase().startsWith(bgLower.slice(0,3))) return k;
    }
    return null;
  }

  bgDays.forEach(function (bgDay) {
    const key = findKeyForBgDay(bgDay);
    const raw = key ? data[key] : undefined;
    let arr = [];

    if (Array.isArray(raw)) {
      arr = raw.map(normalizeEntry).slice(0,7);
      while (arr.length < 7) arr.push({ subject: '', room: '', teacher: '' });
    } else if (raw && typeof raw === 'object') {
      for (let i = 1; i <= 7; i++) {
        let entry = undefined;
        const keysToTry = [`period${i}`, `Period${i}`, `${i}`, `p${i}`];
        for (const k of keysToTry) {
          if (k in raw) { entry = raw[k]; break; }
        }
        if (!entry) {
          const possible = Object.keys(raw).find(k => k.match(/\d+/) && Number(k) === i);
          if (possible) entry = raw[possible];
        }
        arr.push(normalizeEntry(entry));
      }
    } else {
      arr = Array.from({ length: 7 }, () => ({ subject: '', room: '', teacher: '' }));
    }

    result[bgDay] = arr;
  });

  return result;
}

  /**
   * Sticky header – при scroll над определена височина добавяме клас за визуален акцент
   */
  function initStickyHeader() {
    if (!HEADER) return;

    const scrollThreshold = 80;

    function onScroll() {
      if (window.scrollY > scrollThreshold) {
        HEADER.classList.add('scrolled');
      } else {
        HEADER.classList.remove('scrolled');
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // първоначална проверка
  }

  // Transform static table cells on the page to the new structure:
  // ROOM - SUBJECT on first line, TEACHER on second line (if present)
  function normalizeStaticTableCells() {
    const tds = document.querySelectorAll('.schedule-table td');
    tds.forEach(td => {
      // skip hour cells (first column) which have .hour-num
      if (td.querySelector('.hour-num')) return;
      // if already transformed, skip
      if (td.querySelector('.cell-main')) return;

      const subjEl = td.querySelector('.cell-subject');
      const roomEl = td.querySelector('.cell-room');
      const teacherEl = td.querySelector('.cell-teacher');
      if (!subjEl) return;

      const subj = (subjEl.textContent || '').trim();
      const room = roomEl ? (roomEl.textContent || '').trim() : '';
      const teacher = teacherEl ? (teacherEl.textContent || '').trim() : '';

      if (!subj) {
        td.innerHTML = '';
        return;
      }

      const mainLine = room ? `${subj} - ${room}` : `${subj}`;
      if (teacher) {
        td.innerHTML = `<div class="cell-main">${mainLine}</div><div class="cell-teacher">${teacher}</div>`;
      } else {
        td.innerHTML = `<div class="cell-main">${mainLine}</div>`;
      }
      // enforce inline sizing to overcome cached or specific CSS
      td.style.fontSize = '12px';
      td.style.lineHeight = '1.2';
    });
  }

  /**
   * Мобилно меню – отваряне/затваряне при клик върху бутона
   */
  function initMobileMenu() {
    if (!NAV_TOGGLE || !NAV_MENU) return;

    function toggleMenu() {
      const isOpen = NAV_MENU.classList.toggle('is-open');
      NAV_TOGGLE.setAttribute('aria-expanded', isOpen);
    }

    function closeMenu() {
      NAV_MENU.classList.remove('is-open');
      NAV_TOGGLE.setAttribute('aria-expanded', 'false');
    }

    NAV_TOGGLE.addEventListener('click', toggleMenu);

    // Затваряне при клик извън менюто или при избор на линк
    document.addEventListener('click', function (e) {
      if (!NAV_MENU.classList.contains('is-open')) return;
      if (NAV_MENU.contains(e.target) || NAV_TOGGLE.contains(e.target)) return;
      closeMenu();
    });

    NAV_MENU.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });
  }

  /**
   * Седмична програма – показване на таблица според избран клас/паралелка
   * Поддържа няколко падащи менюта (по едно за всеки випуск),
   * които споделят една и съща логика.
   */
  function initScheduleByGrade() {
    const selects = document.querySelectorAll('.schedule-select');
    const tables = document.querySelectorAll('.schedule-table-grade');

    if (!selects.length || !tables.length) return;

    const hourTimes = { 1: '7:30–8:10', 2: '8:20–9:00', 3: '9:10–9:50', 4: '10:10–10:50', 5: '11:00–11:40', 6: '11:50–12:30', 7: '12:40–13:20' };

    function buildRowsFromSchedule(schedule) {
      // schedule: { Понеделник: [...], ... } — render ROOM - SUBJECT on first line, teacher below
      const rows = [];
      for (let hour = 1; hour <= 7; hour += 1) {
        const cells = [];
        const time = hourTimes[hour] || '';
        const firstCell = `<td style="font-size:16px;line-height:1.2"><span class="hour-num">${hour}</span><span class="hour-time">${time}</span></td>`;
        cells.push(firstCell);

        const days = ['Понеделник','Вторник','Сряда','Четвъртък','Петък'];
        days.forEach(function (day) {
          const entry = schedule && schedule[day] && schedule[day][hour - 1] ? schedule[day][hour - 1] : { subject: '', room: '', teacher: '' };
          const subj = (entry.subject || '').toString().trim();
          const room = (entry.room || '').toString().trim();
          const teacher = (entry.teacher || '').toString().trim();

          // If subject is empty, render an empty cell
          if (!subj) {
            cells.push(`<td></td>`);
            return;
          }

          // Build main line: subject first, then room if present
          const mainLine = room ? `${subj} - ${room}` : `${subj}`;

          if (teacher) {
            cells.push(`<td style="font-size:14px;line-height:1.2"><div class="cell-main">${mainLine}</div><div class="cell-teacher">${teacher}</div></td>`);
          } else {
            cells.push(`<td style="font-size:14px;line-height:1.2"><div class="cell-main">${mainLine}</div></td>`);
          }
        });

        rows.push(`<tr>${cells.join('')}</tr>`);
      }
      return rows.join('');
    }

    // Ensure each table has 7 rows (fills with empty cells if shorter)
    function ensureSevenRows() {
      tables.forEach(function (block) {
        const tbody = block.querySelector('tbody');
        if (!tbody) return;
        const current = tbody.querySelectorAll('tr').length;
        for (let hour = current + 1; hour <= 7; hour += 1) {
          const cells = [];
          const time = hourTimes[hour] || '';
          cells.push(`<td style="font-size:16px;line-height:1.2"><span class="hour-num">${hour}</span><span class="hour-time">${time}</span></td>`);
          for (let i = 0; i < 5; i += 1) {
            cells.push(`<td style="font-size:14px;line-height:1.2"><div class="cell-top"><span class="cell-subject"></span> - <span class="cell-room"></span></div><div class="cell-teacher"></div></td>`);
          }
          const tr = document.createElement('tr');
          tr.innerHTML = cells.join('');
          tbody.appendChild(tr);
        }
      });
    }

    async function fetchAndRender(grade) {
      if (!grade) return;
      const docId = mapClassToFirestoreId(String(grade));
      const block = document.querySelector(`.schedule-table-grade[data-grade="${grade}"]`);
      if (!block) return;

      try {
        const snap = await fetchScheduleDoc(docId);
        if (snap.exists()) {
          const data = snap.data();
          const normalized = normalizeSchedule(data);
          const tbody = block.querySelector('tbody');
          if (tbody) {
            tbody.innerHTML = buildRowsFromSchedule(normalized);
          }
          setScheduleStatus(`Заредена програма: ${docId}`, false);
        } else {
          console.warn('No schedule document for', docId);
          setScheduleStatus(`Документът ${docId} не е намерен в Firestore.`, true);
        }
      } catch (err) {
        console.error('Failed to fetch schedule:', err);
        setScheduleStatus('Грешка при зареждане: ' + err.message, true);
      }
    }

    function showGrade(grade) {
      tables.forEach(function (block) {
        const isActive = block.getAttribute('data-grade') === String(grade);
        block.classList.toggle('active', isActive);
        block.setAttribute('aria-hidden', !isActive);
      });
    }

    function resetOtherSelects(activeSelect) {
      selects.forEach(function (sel) {
        if (!activeSelect || sel !== activeSelect) sel.value = '';
      });
    }

    selects.forEach(function (select) {
      select.addEventListener('change', function () {
        const value = select.value;
        if (!value) {
          resetOtherSelects(null);
          return;
        }
        resetOtherSelects(select);
        showGrade(value);
        fetchAndRender(value);
      });
    });

    // On load, fetch for any initially active block
    const activeBlock = document.querySelector('.schedule-table-grade.active');
    if (activeBlock) {
      const g = activeBlock.getAttribute('data-grade');
      fetchAndRender(g);
    }

    // Make sure static tables show 7 periods even before any Firestore data is loaded
    ensureSevenRows();

    // Expose admin write helper for the admin panel
    return { fetchAndRender };
  }

  // Simple on-page status area for schedule fetch messages
  function setScheduleStatus(msg, isError) {
    const container = document.querySelector('.section-schedule .container');
    if (!container) return;
    let el = container.querySelector('.schedule-status');
    if (!el) {
      el = document.createElement('div');
      el.className = 'schedule-status';
      Object.assign(el.style, { marginTop: '8px', padding: '8px', borderRadius: '6px', fontSize: '0.95em' });
      container.insertBefore(el, container.querySelector('.schedule-tables'));
    }
    el.textContent = msg;
    el.style.background = isError ? '#fdecea' : '#eef7ea';
    el.style.color = isError ? '#611a15' : '#164d17';
    el.style.border = isError ? '1px solid #f5c6cb' : '1px solid #c6e6c6';
  }

  /**
   * Плавен scroll при клик на навигационни линкове (anchor)
   */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      const href = anchor.getAttribute('href');
      if (href === '#') return;

      anchor.addEventListener('click', function (e) {
        const targetId = href.slice(1);
        const target = document.getElementById(targetId);
        if (!target) return;

        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /**
   * Reveal анимации – елементите се показват с fade-in при влизане в viewport
   */
  function initReveal() {
    if (!REVEAL_ELEMENTS.length) return;

    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -50px 0px', // малко преди да влезе напълно
      threshold: 0.1
    };

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-visible');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    REVEAL_ELEMENTS.forEach(function (el) {
      observer.observe(el);
    });
  }

  /**
   * Подкаст – опционално свързване на бутоните за епизоди с главния audio (placeholder)
   * При наличие на реални аудио URL-и може да се разшири
   */
  function initPodcastButtons() {
    const mainAudio = document.getElementById('main-audio');
    const episodeButtons = document.querySelectorAll('.episode-play');

    if (!mainAudio || !episodeButtons.length) return;

    episodeButtons.forEach(function (btn, index) {
      btn.addEventListener('click', function () {
        // Тук може да се сменя src на mainAudio според епизода
        mainAudio.play();
      });
    });
  }

  /* Admin panel removed */

  // Стартиране на всички модули при зареждане на DOM
  function init() {
    initStickyHeader();
    initMobileMenu();
    // transform existing static table cells so new styles apply immediately
    normalizeStaticTableCells();
    const scheduleApi = initScheduleByGrade();
    initSmoothScroll();
    initReveal();
    initPodcastButtons();
  }
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
