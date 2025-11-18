document.addEventListener('DOMContentLoaded', async () => {
	const form = document.getElementById('bookingForm');
	const serviceSelect = document.getElementById('service_id');
	const messageEl = document.getElementById('formMessage');

		// Cargar servicios
		const priceSummary = document.getElementById('priceSummary');
		const priceVal = document.getElementById('priceVal');
		const vatVal = document.getElementById('vatVal');
		const totalVal = document.getElementById('totalVal');

		serviceSelect.innerHTML = '<option value="">Cargando servicios…</option>';
		try {
			let data, error;
			if (window._supabaseClientOk) {
				({ data, error } = await supabase.from('services').select('*').order('id'));
			} else {
				// fallback directo a REST si el SDK no está disponible
				try {
					const res = await fetch(`${window._SUPABASE_URL}/rest/v1/services?select=*`, {
						headers: {
							apikey: window._SUPABASE_ANON_KEY,
							Authorization: `Bearer ${window._SUPABASE_ANON_KEY}`,
							"Content-Type": "application/json",
						}
					});
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					data = await res.json();
					error = null;
				} catch (e) {
					data = null; error = e;
				}
			}
			if (error) throw error;
			if (!data || data.length === 0) {
				serviceSelect.innerHTML = '<option value="">No hay servicios</option>';
			} else {
				// guardamos un mapa local para uso en cálculo de precio
				window._servicesCache = {};
				serviceSelect.innerHTML = '<option value="">Selecciona un servicio</option>' + data.map(s => {
					window._servicesCache[s.id] = s;
					return `<option value="${s.id}">${s.name} — $${Number(s.price).toFixed(2)}</option>`;
				}).join('');
			}
		} catch (err) {
			console.error('Error cargando servicios', err);
			serviceSelect.innerHTML = `<option value="">Error cargando servicios: ${err && err.message ? err.message : err}</option>`;
		}

		// Actualizar resumen de precio cuando cambie el servicio
		serviceSelect.addEventListener('change', () => {
			const sid = serviceSelect.value;
			if (!sid) {
				priceSummary.style.display = 'none';
				return;
			}
			const svc = window._servicesCache && window._servicesCache[sid];
			const price = svc ? Number(svc.price) : 0;
			const vat = +(price * 0.12).toFixed(2);
			const total = +(price + vat).toFixed(2);
			priceVal.textContent = `$${price.toFixed(2)}`;
			vatVal.textContent = `$${vat.toFixed(2)}`;
			totalVal.textContent = `$${total.toFixed(2)}`;
			priceSummary.style.display = '';
		});

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		messageEl.textContent = '';
		const name = document.getElementById('patient_name').value.trim();
		const email = document.getElementById('patient_email').value.trim();
		const phone = document.getElementById('patient_phone').value.trim();
		const serviceId = document.getElementById('service_id').value;
		const date = document.getElementById('appointment_date').value;
		const time = document.getElementById('appointment_time').value;

			if (!name || !serviceId || !date || !time) {
				messageEl.innerHTML = '<div class="muted">Por favor completa los campos obligatorios (nombre, servicio, fecha, hora).</div>';
				return;
			}

		const payload = {
			patient_name: name,
			patient_email: email || null,
			patient_phone: phone || null,
			service_id: serviceId ? parseInt(serviceId, 10) : null,
			appointment_date: date,
			appointment_time: time || null,
		};

			// Verificar conflictos: mismo día y misma hora (excluyendo citas canceladas)
			const submitBtn = form.querySelector('button[type="submit"]');
			submitBtn.disabled = true;
			try {
					let conflicts, errConf;
					if (window._supabaseClientOk) {
						({ data: conflicts, error: errConf } = await supabase
							.from('appointments')
							.select('id,status')
							.eq('appointment_date', date)
							.eq('appointment_time', time)
							.neq('status', 'cancelled')
							.limit(1));
					} else {
						try {
							const res = await fetch(`${window._SUPABASE_URL}/rest/v1/appointments?select=id,status&appointment_date=eq.${date}&appointment_time=eq.${time}&status=not.eq.cancelled`, {
								headers: {
									apikey: window._SUPABASE_ANON_KEY,
									Authorization: `Bearer ${window._SUPABASE_ANON_KEY}`,
								}
							});
							if (!res.ok) throw new Error(`HTTP ${res.status}`);
							conflicts = await res.json();
							errConf = null;
						} catch (e) {
							conflicts = null; errConf = e;
						}
					}
					if (errConf) throw errConf;
					if (conflicts && conflicts.length > 0) {
						messageEl.innerHTML = `<div class="muted">Lo siento, ya existe una cita en esa fecha y hora. Escoge otro horario.</div>`;
						submitBtn.disabled = false;
						return;
					}

					let insertResult, insertErr;
					if (window._supabaseClientOk) {
						({ data: insertResult, error: insertErr } = await supabase.from('appointments').insert([payload]));
					} else {
						try {
							const res = await fetch(`${window._SUPABASE_URL}/rest/v1/appointments`, {
								method: 'POST',
								headers: {
									apikey: window._SUPABASE_ANON_KEY,
									Authorization: `Bearer ${window._SUPABASE_ANON_KEY}`,
									"Content-Type": "application/json",
									"Prefer": "return=representation"
								},
								body: JSON.stringify(payload)
							});
							if (!res.ok) throw new Error(`HTTP ${res.status}`);
							insertResult = await res.json();
							insertErr = null;
						} catch (e) {
							insertResult = null; insertErr = e;
						}
					}
					if (insertErr) throw insertErr;
				messageEl.innerHTML = '<div style="color:green">Cita agendada correctamente. Te contactaremos pronto.</div>';
				form.reset();
				priceSummary.style.display = 'none';
			} catch (err) {
				console.error('Error creando cita', err);
				messageEl.innerHTML = `<div class="muted">Error al agendar: ${err.message || err}</div>`;
			} finally {
				submitBtn.disabled = false;
			}
	});
});
