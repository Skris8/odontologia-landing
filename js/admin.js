let servicesMap = {}; // service_id -> {name, price}
let appointmentDatesSet = new Set(); // fechas con citas
let appointmentCounts = {}; // fecha -> número de citas
let currentDate = new Date(); // mes mostrado
let selectedDateStr = null; // 'YYYY-MM-DD'

/* ---------- Utilidades ---------- */
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

/* ---------- Autenticación y arranque ---------- */
// Los helpers de auth se exponen globalmente en `js/supabaseClient.js` (window.authSignIn, authSignOut, loadSession, etc.)
const ADMIN_EMAIL = 'admin@tuclinicadominio.com';

// --- Arranque y manejo UI con autenticación ---------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  const loginBox = document.getElementById('loginBox');
  const appArea = document.getElementById('appArea');
  const loginTopBtn = document.getElementById('loginTopBtn');
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');

  function showLogin() {
    if (loginBox) loginBox.style.display = 'block';
    if (appArea) appArea.style.display = 'none';
  }
  function showApp() {
    if (loginBox) loginBox.style.display = 'none';
    if (appArea) appArea.style.display = 'block';
  }

  // Nota: el comportamiento del botón de login superior y la visibilidad del nav admin se gestionan desde `auth-ui.js`.

  // Try restore session
  const sess = window.loadSession ? window.loadSession() : null;
  if (sess && sess.access_token) {
    // only restore if stored user is the admin account
    if (!sess.user || String((sess.user.email||'')).toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      if (window.clearSession) window.clearSession();
      showLogin();
      return;
    }
    window._sessionToken = sess.access_token;
    try {
      // try boot app — if any protected call fails, fall back to login
      await bootApp();
      showApp();
      if (window.updateAuthUI) window.updateAuthUI();
    } catch (err) {
      console.warn('Session restore failed:', err);
      if (window.clearSession) window.clearSession();
      showLogin();
      if (window.updateAuthUI) window.updateAuthUI();
    }
  } else {
    showLogin();
    if (window.updateAuthUI) window.updateAuthUI();
  }

  // Manejador del botón de login
  if (btnLogin) {
    btnLogin.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('admEmail') || {}).value || '';
      const password = (document.getElementById('admPass') || {}).value || '';
      btnLogin.disabled = true;
        try {
        // usar authSignIn global
        const data = await (window.authSignIn ? window.authSignIn(email.trim(), password) : Promise.reject(new Error('Auth no disponible')));
        // ensure admin user
        if (!data || !data.user || String((data.user.email||'')).toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
          if (window.authSignOut) await window.authSignOut();
          throw new Error('Usuario no autorizado para acceder al panel.');
        }
        // arrancar la aplicación ahora que tenemos token
        await bootApp();
        showApp();
        if (window.updateAuthUI) window.updateAuthUI();
      } catch (err) {
        console.error('Login error', err);
        alert('Error iniciando sesión: ' + (err.message || err));
        showLogin();
        if (window.updateAuthUI) window.updateAuthUI();
      } finally {
        btnLogin.disabled = false;
      }
    });
  }
});

/* ---------- Arranque / carga inicial ---------- */
async function bootApp(){
  await loadServices();
  await loadAppointmentDates();
  renderCalendar(); // dibuja calendario del mes currentDate
  attachMonthNav();
}

/* ---------- Servicios (para mostrar nombre del servicio) ---------- */
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

/* ---------- Renderizar calendario ---------- */
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

      // manejador de click
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

/* ---------- Navegación de mes ---------- */
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

/* ---------- Cargar citas para una fecha ---------- */
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

    // renderizar
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
        // Normalize status -> class
  const status = appt.status || 'programada';
  const tagClass = (status === 'realizada' || status === 'completed') ? 'completed' : status === 'cancelled' ? 'cancelled' : 'scheduled';
  tag.className = 'tag ' + tagClass;
  tag.textContent = status;
  tag.dataset.status = status; // keep status in dataset so toggle reads fresh value
      right.appendChild(tag);

        const actions = document.createElement('div');
        actions.className = 'appt-actions';

    // Check button (toggle realizada/programada)
    const btnCheck = document.createElement('button');
    btnCheck.className = 'btn btn-check';
    btnCheck.setAttribute('aria-label', 'Marcar como realizada');
    btnCheck.title = 'Marcar como realizada';
    btnCheck.innerHTML = '✓';
  btnCheck.addEventListener('click', () => toggleAppointmentStatus(appt.id, btnCheck, tag));

    // Delete button
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn btn-delete';
    btnDelete.setAttribute('aria-label', 'Eliminar cita');
    btnDelete.title = 'Eliminar cita';
    btnDelete.innerHTML = '🗑️';
    btnDelete.addEventListener('click', () => deleteAppointment(appt.id, div));

    actions.appendChild(btnCheck);
    actions.appendChild(btnDelete);
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

/* ---------- Actualizar estado de cita ---------- */
async function updateAppointmentStatus(id, newStatus, buttonEl, tagEl){
  // generic updater used when explicit status change is needed
  buttonEl.disabled = true;
  try {
    const q = `?id=eq.${id}`;
    await window.supabaseRest('appointments', { method: 'PATCH', body: { status: newStatus }, query: q });
  } catch (err) {
    buttonEl.disabled = false;
    return alert('Error actualizando estado: ' + (err.message || err));
  }
  buttonEl.disabled = false;
  // actualizar UI: cambiar texto de etiqueta y estilo
  tagEl.textContent = newStatus;
  tagEl.dataset.status = newStatus;
  const tagClass = (newStatus === 'realizada' || newStatus === 'completed') ? 'completed' : newStatus === 'cancelled' ? 'cancelled' : 'scheduled';
  tagEl.className = 'tag ' + tagClass;
  // recargar fechas y calendario
  await loadAppointmentDates();
  renderCalendar();
}

// Alternar estado realizada <-> programada (sin confirmación para agilizar UX)
// Nota: la firma es (id, buttonEl, tagEl) — los llamantes deben pasar el botón de check y después el elemento tag.
async function toggleAppointmentStatus(id, buttonEl, tagEl){
  // read freshest status from the tag dataset (keeps UI in sync if re-rendered)
  const current = (tagEl && tagEl.dataset && tagEl.dataset.status) ? tagEl.dataset.status : (tagEl && tagEl.textContent) || 'programada';
  const normalized = current.toString().toLowerCase();
  const newStatus = (normalized === 'realizada' || normalized === 'completed') ? 'programada' : 'realizada';

  // actualización optimista de la UI
  const prevText = tagEl ? tagEl.textContent : '';
  const prevClass = tagEl ? tagEl.className : '';
  if (tagEl) {
    tagEl.textContent = newStatus;
    tagEl.dataset.status = newStatus;
    tagEl.className = 'tag ' + ((newStatus === 'realizada' || newStatus === 'completed') ? 'completed' : 'scheduled');
  }
  if (buttonEl) buttonEl.disabled = true;

  try {
    const q = `?id=eq.${id}`;
    await window.supabaseRest('appointments', { method: 'PATCH', body: { status: newStatus }, query: q });
    // successful, refresh counts and calendar badges
    await loadAppointmentDates();
    renderCalendar();
  } catch (err) {
    // revertir UI en caso de error
    if (tagEl) {
      tagEl.textContent = prevText;
      tagEl.className = prevClass;
      tagEl.dataset.status = prevText;
    }
    console.error('Error toggling status:', err);
    alert('Error actualizando estado: ' + (err.message || err));
  } finally {
    if (buttonEl) buttonEl.disabled = false;
  }
}

/* ---------- Eliminar cita ---------- */
async function deleteAppointment(id, domEl){
  if (!confirm('¿Eliminar esta cita de la base de datos? Esta acción es irreversible.')) return;
  try {
    const q = `?id=eq.${id}`;
    await window.supabaseRest('appointments', { method: 'DELETE', query: q });
    // remover del DOM
    if (domEl && domEl.parentNode) domEl.parentNode.removeChild(domEl);
    // recargar fechas y calendario
    await loadAppointmentDates();
    renderCalendar();
  } catch (err) {
    console.error('Error eliminando cita:', err);
    alert('Error eliminando cita: ' + (err.message || err));
  }
}