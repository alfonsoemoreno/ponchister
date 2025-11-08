<<<<<<< HEAD
<<<<<<< HEAD
# ponchister
Juego para los amigos
=======
# React + TypeScript + Vite
=======
# Ponchister
>>>>>>> 7c13a7c (feat: Implement Ponchister game with QR and automatic modes)

Aplicación React + Vite para el juego musical Ponchister. Ofrece dos modos:

- **Modo QR**: escanea un código para reproducir una pista de YouTube.
- **Modo automático**: solicita canciones aleatorias desde Supabase, permite saltar pistas, revelar la información y continuar jugando.

## Requerimientos

- Node.js 18+
- pnpm (recomendado) o npm/yarn
- Proyecto Supabase (plan gratuito) con la tabla `songs`

## Instalación

```bash
pnpm install
```

## Variables de entorno (`ponchister/.env.local`)

```
<<<<<<< HEAD
>>>>>>> 64543a8 (Primer avance Ponchister)
=======
VITE_SUPABASE_URL=tu-url.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon
```

## Configuración de Supabase

1. Crea un nuevo proyecto en Supabase (plan gratuito).
2. En **SQL Editor** ejecuta:

```sql
create table if not exists public.songs (
  id bigserial primary key,
  artist text not null,
  title text not null,
  year integer,
  youtube_url text not null,
  created_at timestamptz default timezone('utc', now())
);

create unique index if not exists songs_youtube_url_key
  on public.songs (youtube_url);

alter table public.songs enable row level security;

create policy "Allow read for anon"
  on public.songs
  for select
  to anon
  using (true);
```

3. Guarda la URL del proyecto y la anon key en `.env.local` y en las variables de entorno de Vercel.
4. Copia la **Service Role Key** (Settings → API) para usarla en el script de seed.

## Poblar la base con el Excel

El proyecto hermano `ponchocards` incluye un script que lee `public/plantilla.xlsx` y sincroniza todas las canciones.

1. Crea `ponchocards/.env.local` con:

```
SUPABASE_URL=tu-url.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

2. Desde la carpeta `ponchocards` ejecuta:

```bash
pnpm install
pnpm seed:songs
```

> El script realiza `upsert` usando `youtube_url`, por lo que puedes ejecutarlo cada vez que actualices el Excel.

## Desarrollo local

```bash
pnpm dev
```

La aplicación queda disponible en `http://localhost:5173/`.

## Despliegue

- Define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Vercel.
- Haz un build de prueba con `pnpm build` antes de desplegar.
>>>>>>> 7c13a7c (feat: Implement Ponchister game with QR and automatic modes)
