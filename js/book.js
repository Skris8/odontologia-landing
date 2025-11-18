document.addEventListener('DOMContentLoaded', async () => {
	const form = document.getElementById('bookingForm');
	const serviceSelect = document.getElementById('service_id');
	const messageEl = document.getElementById('formMessage');

	// Cargar servicios
	serviceSelect.innerHTML = '<option value="">Cargando servicios…</option>';
	try {
		const { data, error } = await supabase.from('services').select('*').order('id');
		if (error) throw error;
		if (!data || data.length === 0) {
			serviceSelect.innerHTML = '<option value="">No hay servicios</option>';
		} else {
			serviceSelect.innerHTML = '<option value="">Selecciona un servicio</option>' + data.map(s => `<option value="${s.id}">${s.name} — $${Number(s.price).toFixed(2)}</option>`).join('');
		}
	} catch (err) {
		console.error('Error cargando servicios', err);
		serviceSelect.innerHTML = '<option value="">Error cargando servicios</option>';
	}

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		messageEl.textContent = '';
		const name = document.getElementById('patient_name').value.trim();
		const email = document.getElementById('patient_email').value.trim();
		const phone = document.getElementById('patient_phone').value.trim();
		const serviceId = document.getElementById('service_id').value;
		const date = document.getElementById('appointment_date').value;
		const time = document.getElementById('appointment_time').value;

		if (!name || !serviceId || !date) {
			messageEl.innerHTML = '<div class="muted">Por favor completa los campos obligatorios (nombre, servicio, fecha).</div>';
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

		const submitBtn = form.querySelector('button[type="submit"]');
		submitBtn.disabled = true;
		try {
			const { data, error } = await supabase.from('appointments').insert([payload]);
			if (error) throw error;
			messageEl.innerHTML = '<div class="" style="color:green">Cita agendada correctamente. Te contactaremos pronto.</div>';
			form.reset();
		} catch (err) {
			console.error('Error creando cita', err);
			messageEl.innerHTML = `<div class="muted">Error al agendar: ${err.message || err}</div>`;
		} finally {
			submitBtn.disabled = false;
		}
	});
});
