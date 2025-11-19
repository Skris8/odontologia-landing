// Configuración mínima de Supabase para este front-end
// NOTA: la ANON KEY es pública en el cliente; asegúrate de configurar RLS/policies en Supabase para producción.
const SUPABASE_URL = 'https://ghycowpawlhuyzzhonrq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoeWNvd3Bhd2xodXl6emhvbnJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzcwNzgsImV4cCI6MjA3OTAxMzA3OH0.wyfgw5_U0_EiNO-2B78l_DlECq02EWj0CuB3Mz7Khdk'; // anon key

// Indicador de si el SDK se inicializó (no usamos el SDK por ahora)
window._supabaseClientOk = false;
window._SUPABASE_URL = SUPABASE_URL;
window._SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
window._sessionToken = null; // access_token cuando el usuario inicie sesión

// Helper simple para llamar a la API REST de Supabase (tablePath, p. ej. 'services' o 'appointments')
window.supabaseRest = async function supabaseRest(tablePath, { method = 'GET', body = null, query = '' } = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${tablePath}${query}`;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    // Use session token if available (logged-in user), otherwise fall back to anon key
    Authorization: window._sessionToken ? `Bearer ${window._sessionToken}` : `Bearer ${SUPABASE_ANON_KEY}`
  };
  if (method === 'POST' || method === 'PATCH') headers['Content-Type'] = 'application/json';
  if (method === 'POST') headers['Prefer'] = 'return=representation';

  const res = await fetch(url, {
	method,
	headers,
	body: body ? JSON.stringify(body) : null,
  });

  // Supabase devuelve 204 para algunas operaciones sin body
  if (res.status === 204) return { data: null, status: 204 };

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { /* ignore parse error */ }

  if (!res.ok) {
	const err = new Error(`HTTP ${res.status}` + (data && data.message ? `: ${data.message}` : ''));
	err.status = res.status;
	err.response = data;
	throw err;
  }

  return { data, status: res.status };
};

// Exportaciones mínimas
window.supabase = null; // mantenemos para compatibilidad si algún script lo busca

// ---- Helpers de autenticación expuestos globalmente ----
const SESSION_KEY = 'supabase_session';

window.loadSession = function() {
  try { const raw = localStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
};

window.saveSession = function(sess) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(sess)); } catch (e) {}
};

window.clearSession = function() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  window._sessionToken = null;
};

window.authSignIn = async function(email, password) {
  const url = `${window._SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const headers = {
    apikey: window._SUPABASE_ANON_KEY,
    Authorization: `Bearer ${window._SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  };
  const body = { email, password };
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data && data.error_description) ? data.error_description : (data && data.error) ? data.error : `HTTP ${res.status}`;
    throw new Error(err);
  }
  window._sessionToken = data.access_token;
  window.saveSession({ access_token: data.access_token, refresh_token: data.refresh_token, user: data.user, expires_at: Date.now() + (data.expires_in||0)*1000 });
  return data;
};

window.authSignOut = async function() {
  const sess = window.loadSession();
  const token = sess && sess.access_token ? sess.access_token : window._sessionToken;
  if (!token) { window.clearSession(); return; }
  const url = `${window._SUPABASE_URL}/auth/v1/logout`;
  const headers = { apikey: window._SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
  try { await fetch(url, { method: 'POST', headers }); } catch (e) { /* ignore */ }
  window.clearSession();
};

// Helper para obtener el usuario actual (si hay sesión almacenada)
window.getCurrentUser = function() {
  const s = window.loadSession();
  return s && s.user ? s.user : null;
};