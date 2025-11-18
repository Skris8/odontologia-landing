// Supabase client - ajusta las variables si prefieres leer desde variables de entorno en producción
const SUPABASE_URL = 'https://ghycowpawlhuyzzhonrq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoeWNvd3Bhd2xodXl6emhvbnJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzcwNzgsImV4cCI6MjA3OTAxMzA3OH0.wyfgw5_U0_EiNO-2B78l_DlECq02EWj0CuB3Mz7Khdk'; // anon key

// El bundle de Supabase expone la función `createClient` en el scope global cuando se carga
// desde el CDN. Usamos createClient() para inicializar el cliente.
// Si prefieres, en entornos de producción mueve estas claves a variables de entorno y
// no las mantengas en el cliente.
const supabase = (typeof createClient !== 'undefined')
	? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
	: (window.supabase && typeof window.supabase.createClient === 'function')
		? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
		: null;

if (!supabase) console.warn('Supabase client no pudo inicializarse. ¿Cargo la librería CDN antes de este script?');