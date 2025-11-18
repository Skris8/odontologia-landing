// Supabase client - ajusta las variables si prefieres leer desde variables de entorno en producción
const SUPABASE_URL = 'https://ghycowpawlhuyzzhonrq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoeWNvd3Bhd2xodXl6emhvbnJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzcwNzgsImV4cCI6MjA3OTAxMzA3OH0.wyfgw5_U0_EiNO-2B78l_DlECq02EWj0CuB3Mz7Khdk'; // anon key

// El bundle de Supabase expone la función `createClient` en el scope global cuando se carga
// desde el CDN. Usamos createClient() para inicializar el cliente.
// Si prefieres, en entornos de producción mueve estas claves a variables de entorno y
// no las mantengas en el cliente.
// Inicializa el cliente de Supabase, intentando cargar dinámicamente el bundle CDN si es necesario
let supabase = null;
(async function initSupabase() {
	function tryInit() {
		try {
			if (typeof createClient !== 'undefined') return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
			if (window.supabase && typeof window.supabase.createClient === 'function') return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
			if (window.createClient && typeof window.createClient === 'function') return window.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
		} catch (e) {
			console.error('Error durante tryInit supabase:', e);
		}
		return null;
	}

	supabase = tryInit();
	if (!supabase) {
		console.warn('createClient no disponible. Intentando cargar CDN de Supabase dinámicamente...');
		try {
			await new Promise((resolve, reject) => {
				// evitar cargar si ya existe un script con la misma URL
				const existing = Array.from(document.getElementsByTagName('script')).find(s => s.src && s.src.includes('@supabase/supabase-js'));
				if (existing) {
					if (existing.getAttribute('data-loaded') === 'true') return resolve();
					existing.addEventListener('load', () => resolve());
					existing.addEventListener('error', () => reject(new Error('Error cargando script existente')));
					return;
				}
				const s = document.createElement('script');
				s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/bundle.min.js';
				s.async = false;
				s.onload = () => { s.setAttribute('data-loaded', 'true'); resolve(); };
				s.onerror = () => reject(new Error('Error cargando CDN de Supabase'));
				document.head.appendChild(s);
			});
			// reintentar inicialización
			supabase = tryInit();
			if (!supabase) throw new Error('createClient no disponible después de cargar CDN');
			window._supabaseClientOk = true;
			console.log('Supabase client inicializado correctamente tras cargar CDN.');
		} catch (err) {
			console.error('No se pudo inicializar Supabase client:', err);
			// stub que lanza para llamadas claras
			supabase = {
				from() { throw new Error('Supabase no inicializado. Revisa que el CDN esté accesible y cargado. (' + (err && err.message) + ')'); },
				auth: {
					async signInWithPassword() { throw new Error('Supabase auth no disponible'); },
					async getSession() { return { data: { session: null } }; },
					async signOut() { return; }
				}
			};
			window._supabaseClientOk = false;
		}
	} else {
		window._supabaseClientOk = true;
		console.log('Supabase client inicializado correctamente.');
	}

	// Exponer la instancia para debugging rápido
	window.supabase = supabase;
		// Exponer URL y anon key para posibles fallbacks (fetch directo a REST)
		window._SUPABASE_URL = SUPABASE_URL;
		window._SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
})();