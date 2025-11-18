// Supabase configuración mínima para este front-end
// NOTA: el ANON KEY es público en el cliente; asegúrate de configurar RLS/policies en Supabase.
const SUPABASE_URL = 'https://ghycowpawlhuyzzhonrq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoeWNvd3Bhd2xodXl6emhvbnJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzcwNzgsImV4cCI6MjA3OTAxMzA3OH0.wyfgw5_U0_EiNO-2B78l_DlECq02EWj0CuB3Mz7Khdk'; // anon key

// Indicador de si el SDK se inicializó (no usamos el SDK por ahora)
window._supabaseClientOk = false;
window._SUPABASE_URL = SUPABASE_URL;
window._SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

// Helper simple para llamar la REST API de Supabase (tablePath es p.e. 'services' o 'appointments')
window.supabaseRest = async function supabaseRest(tablePath, { method = 'GET', body = null, query = '' } = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${tablePath}${query}`;
  const headers = {
	apikey: SUPABASE_ANON_KEY,
	Authorization: `Bearer ${SUPABASE_ANON_KEY}`
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

// Export mínimos
window.supabase = null; // mantenemos para compatibilidad si algún script lo busca