let servicesMap = {}; // service_id -> {name, price}
let appointmentDatesSet = new Set(); // fechas con citas
let appointmentCounts = {}; // fecha -> número de citas
let currentDate = new Date(); // mes mostrado
let selectedDateStr = null; // 'YYYY-MM-DD'

/* ---------- Helpers ---------- */
const toISODate = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDateLong = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const formatTime = (t) => t ? t.slice(0,5) : '—';

/* ---------- Auth & boot ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  // UI refs
  const loginBox = document.getElementById('loginBox');
  const appArea = document.getElementById('appArea');
  const loginTopBtn = document.getElementById('loginTopBtn');
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');

  // Bypass auth for local admin view (uses REST API). If later you add Supabase Auth SDK,
  // you can re-enable the login flow. For now, show the admin area immediately.
  try {
    loginBox.style.display = 'none';
    appArea.style.display = 'block';
    await bootApp();
  } catch (e) {
    console.error('Error iniciando admin app:', e);
    loginBox.style.display = 'block';
    appArea.style.display = 'none';
  }

  // top login button (en nav) - simple scroll to login box if still visible
  loginTopBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (document.getElementById('loginBox')) document.getElementById('loginBox').scrollIntoView({behavior:'smooth'});
  });
});

/* ---------- Boot / carga inicial ---------- */
async function bootApp(){
  await loadServices();
  await loadAppointmentDates();
  renderCalendar(); // dibuja calendario del mes currentDate
  attachMonthNav();
}

/* ---------- Services (para mostrar nombre del servicio) ---------- */
async function loadServices(){
  try {
    const resp = await window.supabaseRest('services', { query: '?select=*' });
    const data = resp.data || [];
    data.forEach(s => servicesMap[s.id] = s);
  } catch (err) {
    console.error('Error cargando services:', err);
  }
}

/* ---------- Cargar fechas con citas ---------- */
async function loadAppointmentDates(){
  // Traemos todas las appointment_date — si la tabla es grande puedes pedir un rango o agrupar en servidor
  try {
    const resp = await window.supabaseRest('appointments', { query: '?select=appointment_date' });
    const data = resp.data || [];
    appointmentDatesSet.clear();
    appointmentCounts = {};
    (data || []).forEach(r => {
      if (r && r.appointment_date) {
        appointmentDatesSet.add(r.appointment_date);
        appointmentCounts[r.appointment_date] = (appointmentCounts[r.appointment_date] || 0) + 1;
      }
    });
  } catch (err) {
    console.error('Error cargando fechas:', err);
  }
}

/* ---------- Render calendario ---------- */
function renderCalendar(){
  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';
  const monthLabel = document.getElementById('monthLabel');
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  monthLabel.textContent = currentDate.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  // Primer día del mes y días en mes
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  // Queremos que la semana empiece en lunes -> ajustar
  const startWeekday = (first.getDay() + 6) % 7; // 0=Mon ... 6=Sun
  const totalCells = startWeekday + last.getDate();

  for (let i=0; i<totalCells; i++){
    const cell = document.createElement('div');
    cell.classList.add('cal-cell');

    const dayNum = i - startWeekday + 1;
    if (i < startWeekday) {
      cell.classList.add('inactive');
      cell.innerHTML = '';
    } else {
      const dateObj = new Date(year, month, dayNum);
      const iso = toISODate(dateObj);
      cell.dataset.date = iso;

      const daynumEl = document.createElement('div');
      daynumEl.className = 'daynum';
      daynumEl.textContent = dayNum;
      cell.appendChild(daynumEl);

      // marcar si hay citas ese día y mostrar badge con contador
      const count = appointmentCounts[iso] || 0;
      if (count > 0) {
        cell.classList.add('has-appointments');
        const badge = document.createElement('div');
        badge.className = 'cal-badge';
        badge.textContent = String(count);
        cell.appendChild(badge);
      }

      // click handler
      cell.addEventListener('click', async () => {
        if (cell.classList.contains('inactive')) return;
        // marca visual
        document.querySelectorAll('.cal-cell').forEach(n => n.classList.remove('selected'));
        cell.classList.add('selected');
        selectedDateStr = iso;
        // mostrar label y cargar citas
        document.getElementById('selectedDayLabel').textContent = `Citas para ${formatDateLong(iso)}`;
        await loadAppointmentsFor(iso);
      });
    }
    grid.appendChild(cell);
  }
}

/* ---------- Month navigation ---------- */
function attachMonthNav(){
  document.getElementById('prevMonth').addEventListener('click', () => {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    renderCalendar();
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    renderCalendar();
  });
}

/* ---------- Load appointments for a date ---------- */
async function loadAppointmentsFor(dateIso){
  const list = document.getElementById('appointmentsList');
  list.innerHTML = '<div class="muted">Cargando citas…</div>';

  try {
    const q = `?select=*&appointment_date=eq.${dateIso}&order=appointment_time.asc`;
    const resp = await window.supabaseRest('appointments', { query: q });
    const data = resp.data || [];

    if (!data || data.length === 0) {
      list.innerHTML = `<div class="muted">No hay citas para ${dateIso}</div>`;
      return;
    }

    // render
    list.innerHTML = '';
    data.forEach(appt => {
      const div = document.createElement('div');
      div.className = 'appt-item';
      const left = document.createElement('div'); left.className = 'appt-left';
      const info = document.createElement('div');
      const name = document.createElement('div');
      name.innerHTML = `<strong>${appt.patient_name || '—'}</strong> <span class="muted">(${appt.patient_email||''})</span>`;
      const meta = document.createElement('div');
      const svc = servicesMap[appt.service_id] ? servicesMap[appt.service_id].name : `Servicio #${appt.service_id}`;
      meta.innerHTML = `<span class="muted">${svc}</span> • <span class="muted">${formatTime(appt.appointment_time)}</span>`;
      info.appendChild(name);
      info.appendChild(meta);
      left.appendChild(info);

      const right = document.createElement('div');
      right.style.display = 'flex';
      right.style.alignItems = 'center';

      const tag = document.createElement('span');
      tag.className = 'tag ' + (appt.status === 'completed' ? 'completed' : appt.status === 'cancelled' ? 'cancelled' : 'scheduled');
      tag.textContent = appt.status || 'scheduled';
      right.appendChild(tag);

      const actions = document.createElement('div');
      actions.className = 'appt-actions';
      const btnComplete = document.createElement('button');
      btnComplete.className = 'btn btn-primary';
      btnComplete.textContent = 'Marcar completada';
      btnComplete.addEventListener('click', () => updateAppointmentStatus(appt.id, 'completed', btnComplete, tag));

      const btnCancel = document.createElement('button');
      btnCancel.className = 'btn btn-secondary';
      btnCancel.textContent = 'Cancelar';
      btnCancel.addEventListener('click', () => updateAppointmentStatus(appt.id, 'cancelled', btnCancel, tag));

      actions.appendChild(btnComplete);
      actions.appendChild(btnCancel);
      right.appendChild(actions);

      div.appendChild(left);
      div.appendChild(right);
      list.appendChild(div);
    });
    return;
  } catch (err) {
    list.innerHTML = `<div class="muted">Error cargando citas: ${err.message || err}</div>`;
    console.error(err);
    return;
  }
}

/* ---------- Update appointment status ---------- */
async function updateAppointmentStatus(id, newStatus, buttonEl, tagEl){
  if (!confirm(`¿Marcar cita como "${newStatus}"?`)) return;
  buttonEl.disabled = true;
  try {
    const q = `?id=eq.${id}`;
    await window.supabaseRest('appointments', { method: 'PATCH', body: { status: newStatus }, query: q });
  } catch (err) {
    buttonEl.disabled = false;
    return alert('Error actualizando estado: ' + (err.message || err));
  }
  buttonEl.disabled = false;
  // actualizar UI: cambiar tag text + estilo
  tagEl.textContent = newStatus;
  tagEl.className = 'tag ' + (newStatus === 'completed' ? 'completed' : newStatus === 'cancelled' ? 'cancelled' : 'scheduled');
  // si se canceló y ya no hay citas para esa fecha, recargar appointmentDatesSet
  await loadAppointmentDates();
  renderCalendar();
}