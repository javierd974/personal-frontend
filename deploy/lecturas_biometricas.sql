-- Logging de lecturas biometricas para calibrar el umbral de matching.
-- Objetivo: dejar de elegir UMBRAL_MATCHING / MARGEN_MINIMO a ojo y fijarlos
-- con la distribucion real de scores de los locales.
--
-- APLICADA EN PRODUCCION (migracion "lecturas_biometricas_logging").
-- Este archivo queda como referencia del esquema.

create table if not exists public.lecturas_biometricas (
  id           bigserial primary key,
  creado_en    timestamptz not null default now(),
  local_id     uuid references public.locales(id) on delete set null,
  empleado_id  uuid references public.empleados(id) on delete set null,
  score        integer,      -- score del mejor candidato
  margen       integer,      -- diferencia contra el segundo mejor
  motivo       text,         -- ok | score_bajo | ambiguo | sin_lecturas
  candidatos   integer       -- cuantas huellas se compararon
);

create index if not exists lecturas_biometricas_creado_en_idx
  on public.lecturas_biometricas (creado_en desc);
create index if not exists lecturas_biometricas_motivo_idx
  on public.lecturas_biometricas (motivo);

alter table public.lecturas_biometricas enable row level security;

-- El kiosco escribe con la anon key: solo INSERT, nunca lectura.
create policy "kiosco inserta lecturas"
  on public.lecturas_biometricas for insert
  to anon with check (true);

-- ---------------------------------------------------------------------------
-- Consultas para calibrar (correr despues de 1-2 semanas de datos):
--
-- Distribucion de scores de los fichajes aceptados:
--   select width_bucket(score, 0, 200, 20) * 10 as rango, count(*)
--   from lecturas_biometricas where motivo = 'ok' group by 1 order by 1;
--
-- Cuantas lecturas se rechazan y por que:
--   select motivo, count(*), avg(score)::int, avg(margen)::int
--   from lecturas_biometricas group by 1 order by 2 desc;
--
-- Casos ambiguos (los que antes producian fichajes cruzados):
--   select creado_en, score, margen, candidatos
--   from lecturas_biometricas where motivo = 'ambiguo' order by creado_en desc;
-- ---------------------------------------------------------------------------
