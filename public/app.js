/* ═══════════════════════════════════════════════════════════════════════════
   DENTAL CLINIC — MAIN JS (Booking Table + Modals)
   ══════════════════════════════════════════════════════════════════════════ */

let API = ''; 
if (window.location.protocol === 'file:') {
  API = 'http://localhost:3000';
}
const TIMES = ['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
const PROCEDURES = ['Удаление зуба','Пломбирование','Чистка зубов','Установка коронки','Лечение канала','Отбеливание зубов','Консультация'];

let currentWeekOffset = 0;
let bookedSlots = []; 
let myBookings = JSON.parse(localStorage.getItem('myBookings') || '[]');
let selectedDate = null;
let selectedTime = null;
let selectedProc = null;

// ─── Week Navigation ──────────────────────────────────────────────────────────
function getWeekDates(offset = 0) {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday + offset * 7);

  const dates = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function formatDateRu(d) {
  const days = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

function changeWeek(dir) {
  currentWeekOffset += dir;
  if (currentWeekOffset < 0) currentWeekOffset = 0; // don't go to the past
  loadBookingTable();
}

async function loadBookingTable() {
  const dates = getWeekDates(currentWeekOffset);
  const startDate = formatDate(dates[0]);
  const endDate = formatDate(dates[dates.length - 1]);

  // Update label
  const label = document.getElementById('weekLabel');
  label.textContent = `${formatDateRu(dates[0])} — ${formatDateRu(dates[dates.length - 1])}`;

  // Disable prev button if on current week
  document.getElementById('prevWeek').disabled = currentWeekOffset === 0;

  // Fetch booked slots
  try {
    const res = await fetch(`${API}/api/slots?startDate=${startDate}&endDate=${endDate}`, {
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('Bad response');
    bookedSlots = await res.json();
  } catch {
    bookedSlots = [];
  }

  renderTable(dates);
}

function isBooked(date, time) {
  return bookedSlots.some(s => s.date === date && s.time === time);
}

function isMine(date, time) {
  return myBookings.some(b => b.date === date && b.time === time);
}

function isPast(date, time) {
  const now = new Date();
  const slotDate = new Date(`${date}T${time}:00`);
  return slotDate <= now;
}

function renderTable(dates) {
  const table = document.getElementById('bookingTable');
  const cols = dates.length + 1; // +1 for time column
  table.style.gridTemplateColumns = `70px repeat(${dates.length}, 1fr)`;

  let html = '';

  // Header row
  html += `<div class="table-cell table-cell--header table-cell--time">Время</div>`;
  for (const d of dates) {
    html += `<div class="table-cell table-cell--header">${formatDateRu(d)}</div>`;
  }

  // Time rows
  for (const time of TIMES) {
    html += `<div class="table-cell table-cell--time">${time}</div>`;
    for (const d of dates) {
      const dateStr = formatDate(d);
      const past = isPast(dateStr, time);
      const mine = isMine(dateStr, time);
      const booked = isBooked(dateStr, time);

      if (past && !mine) {
        html += `<div class="table-cell table-cell--past" title="Время прошло">—</div>`;
      } else if (mine) {
        const b = myBookings.find(b => b.date === dateStr && b.time === time);
        html += `<div class="table-cell table-cell--mine" title="Ваша запись: ${b?.procedure || ''}">✅ Вы</div>`;
      } else if (booked) {
        html += `<div class="table-cell table-cell--busy" title="К сожалению, это время уже занято">⛔ Занято</div>`;
      } else {
        html += `<div class="table-cell table-cell--free" onclick="openBookingModal('${dateStr}','${time}')" title="Нажмите, чтобы записаться на ${dateStr} в ${time}">Свободно</div>`;
      }
    }
  }

  table.innerHTML = html;
}

// ─── Modal Logic ──────────────────────────────────────────────────────────────
function openBookingModal(date, time) {
  selectedDate = date;
  selectedTime = time;
  selectedProc = null;

  // Reset proc buttons
  document.querySelectorAll('.proc-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('selectedProcedure').value = '';
  document.getElementById('clientName').value = '';
  document.getElementById('clientPhone').value = '';
  document.getElementById('formError').style.display = 'none';

  // Set modal info
  const dateObj = new Date(date + 'T12:00:00');
  document.getElementById('modalTitle').textContent = 'Запись на приём';
  document.getElementById('modalSubtitle').textContent = `${formatDateRu(dateObj)} в ${time}`;

  document.getElementById('bookingModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function openBookingFor(proc) {
  // Find next available slot
  const dates = getWeekDates(currentWeekOffset);
  for (const d of dates) {
    const dateStr = formatDate(d);
    for (const time of TIMES) {
      if (!isBooked(dateStr, time) && !isMine(dateStr, time) && !isPast(dateStr, time)) {
        openBookingModal(dateStr, time);
        // Pre-select procedure
        setTimeout(() => {
          const btn = document.querySelector(`.proc-btn[data-value="${proc}"]`);
          if (btn) selectProcedure(btn);
        }, 100);
        return;
      }
    }
  }
  alert('На этой неделе нет свободных мест. Попробуйте перейти на следующую неделю.');
}

function selectProcedure(btn) {
  document.querySelectorAll('.proc-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedProc = btn.dataset.value;
  document.getElementById('selectedProcedure').value = selectedProc;
}

function closeModal() {
  document.getElementById('bookingModal').classList.remove('active');
  document.body.style.overflow = '';
}

function closeSuccess() {
  document.getElementById('successModal').classList.remove('active');
  document.body.style.overflow = '';
}

// Click outside to close
document.getElementById('bookingModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});
document.getElementById('successModal').addEventListener('click', function(e) {
  if (e.target === this) closeSuccess();
});

// ─── Submit Booking ────────────────────────────────────────────────────────────
async function submitBooking(e) {
  e.preventDefault();

  const name = document.getElementById('clientName').value.trim();
  const phone = document.getElementById('clientPhone').value.trim();
  const proc = document.getElementById('selectedProcedure').value;
  const errEl = document.getElementById('formError');

  // Validate
  if (!proc) {
    showError('Пожалуйста, выберите процедуру'); return;
  }
  if (!name || name.length < 2) {
    showError('Введите ваше имя (минимум 2 символа)'); return;
  }
  if (!/^\d{9}$/.test(phone)) {
    showError('Номер телефона должен содержать ровно 9 цифр после +992'); return;
  }

  const fullPhone = '+992' + phone;
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ Отправка...';

  try {
    const res = await fetch(`${API}/api/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: selectedDate,
        time: selectedTime,
        client_name: name,
        client_phone: fullPhone,
        procedure: proc
      })
    });

    let data;
    try {
      data = await res.json();
    } catch (e) {
      showError('Глобальная ошибка: Бэкенд не найден. Если вы на Netlify, вам нужно развернуть серверную часть.');
      return;
    }

    if (!res.ok) {
      showError(data.error || 'Ошибка записи');
      return;
    }

    // Save to localStorage
    myBookings.push({ date: selectedDate, time: selectedTime, procedure: proc, name, phone: fullPhone });
    localStorage.setItem('myBookings', JSON.stringify(myBookings));

    // Close booking modal, show success
    closeModal();
    const dateObj = new Date(selectedDate + 'T12:00:00');
    document.getElementById('successText').innerHTML = 
      `Вы записаны на <strong>${formatDateRu(dateObj)} в ${selectedTime}</strong><br/>Процедура: <strong>${proc}</strong><br/>Мы свяжемся с вами по номеру <strong>${fullPhone}</strong>`;
    document.getElementById('successModal').classList.add('active');

    // Reload table
    await loadBookingTable();

  } catch (err) {
    showError('Ошибка: ' + err.message + '. Убедитесь, что ваш сервер запущен (npm start) или бэкенд верно указан.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '✅ Подтвердить запись';
  }
}

function showError(msg) {
  const el = document.getElementById('formError');
  el.textContent = msg;
  el.style.display = 'block';
}

// ─── Phone input — digits only ────────────────────────────────────────────────
document.getElementById('clientPhone').addEventListener('input', function() {
  this.value = this.value.replace(/\D/g, '').slice(0, 9);
});

// ─── Mobile Burger ────────────────────────────────────────────────────────────
document.getElementById('burgerBtn').addEventListener('click', () => {
  document.getElementById('mobileNav').classList.toggle('active');
});
function closeMobileNav() {
  document.getElementById('mobileNav').classList.remove('active');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
loadBookingTable();

// Auto-refresh every 30s to get new bookings
setInterval(loadBookingTable, 30000);
