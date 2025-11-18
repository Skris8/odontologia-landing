document.addEventListener('DOMContentLoaded', async () => {
	// Set date min to tomorrow (no bookings for today or past dates)
	const dateInput = document.getElementById('appointment_date');
	if (dateInput) {
		const today = new Date();
		const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
		const yyyy = tomorrow.getFullYear();
		const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
		const dd = String(tomorrow.getDate()).padStart(2, '0');
		dateInput.min = `${yyyy}-${mm}-${dd}`;
	}

	// Ensure time input exists. If it's a <select>, populate hours 6-12 as fallback.
	const timeInput = document.getElementById('appointment_time');
	if (timeInput) {
		if (timeInput.tagName === 'SELECT') {
			// If markup didn't include options, populate them (defensive)
			if (timeInput.options.length <= 1) {
				const hours = [6,7,8,9,10,11,12];
				hours.forEach(h => {
					const opt = document.createElement('option');
					opt.value = String(h);
					opt.textContent = String(h);
					timeInput.appendChild(opt);
				});
			}
		} else {
			// input type=time fallback
			timeInput.min = '06:00';
			timeInput.max = '12:00';
			timeInput.step = 3600; // seconds
		}
	}
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
			// Usar helper REST centralizado
			const resp = await window.supabaseRest('services', { query: '?select=*' });
			const data = resp.data;
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

			// Fecha: no permitir hoy ni fechas pasadas (doble verificación en JS además del min del input)
			const selectedDate = new Date(date + 'T00:00:00');
			const today = new Date();
			today.setHours(0,0,0,0);
			if (selectedDate <= today) {
				messageEl.innerHTML = '<div class="muted">La fecha debe ser a partir de mañana. Por favor elige una fecha futura.</div>';
				return;
			}

			// Hora: aceptamos dos formatos:
			// - selecciones numéricas (6..12) desde el nuevo <select>
			// - o input type=time que devuelva HH:MM (compatibilidad)
			let normalizedTime = null; // result as HH:MM
			if (/^\d+$/.test(time)) {
				const hourNum = parseInt(time, 10);
				if (isNaN(hourNum) || hourNum < 6 || hourNum > 12) {
					messageEl.innerHTML = '<div class="muted">Elige una hora válida entre 6 y 12.</div>';
					return;
				}
				const hh = String(hourNum).padStart(2, '0');
				normalizedTime = `${hh}:00`;
			} else {
				const timeMatch = /^([0-2]\d):([0-5]\d)$/.exec(time);
				if (!timeMatch) {
					messageEl.innerHTML = '<div class="muted">Formato de hora inválido. Usa HH:MM (ej. 07:00) o selecciona la hora.</div>';
					return;
				}
				const hour = parseInt(timeMatch[1], 10);
				const minute = parseInt(timeMatch[2], 10);
				if (minute !== 0 || hour < 6 || hour > 12) {
					messageEl.innerHTML = '<div class="muted">La hora debe ser en punto (00 minutos) y entre 06:00 y 12:00.</div>';
					return;
				}
				normalizedTime = `${String(hour).padStart(2,'0')}:00`;
			}

		const payload = {
			patient_name: name,
			patient_email: email || null,
			patient_phone: phone || null,
			service_id: serviceId ? parseInt(serviceId, 10) : null,
			appointment_date: date,
			appointment_time: normalizedTime,
		};

			// Verificar conflictos: mismo día y misma hora (excluyendo citas canceladas)
			const submitBtn = form.querySelector('button[type="submit"]');
			submitBtn.disabled = true;
			try {

					// comprobar conflictos por fecha y hora
					const q = `?select=id,status&appointment_date=eq.${date}&appointment_time=eq.${normalizedTime}&status=not.eq.cancelled`;
					const respConf = await window.supabaseRest('appointments', { query: q });
					const conflicts = respConf.data;
					if (conflicts && conflicts.length > 0) {
						messageEl.innerHTML = `<div class="muted">Lo siento, ya existe una cita en esa fecha y hora. Escoge otro horario.</div>`;
						submitBtn.disabled = false;
						return;
					}
					// insertar la cita
					const respIns = await window.supabaseRest('appointments', { method: 'POST', body: payload });
					const insertResult = respIns.data;
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
