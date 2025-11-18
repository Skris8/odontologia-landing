-- Schema para la aplicación (appointments y services)
create table public.services (
	id serial not null,
	code text not null,
	name text not null,
	price numeric(10, 2) not null,
	constraint services_pkey primary key (id),
	constraint services_code_key unique (code)
) TABLESPACE pg_default;

create table public.appointments (
	id serial not null,
	patient_name text not null,
	patient_email text null,
	patient_phone text null,
	service_id integer null,
	appointment_date date not null,
	appointment_time time without time zone null,
	status text null default 'programada'::text,
	created_at timestamp with time zone null default now(),
	constraint appointments_pkey primary key (id),
	constraint appointments_service_id_fkey foreign KEY (service_id) references services (id)
) TABLESPACE pg_default;

-- Nota: ejecuta este SQL en el editor SQL de Supabase para crear las tablas.
