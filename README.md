# Ponchister

> Experiencia musical para reuniones: configura el rango de canciones y deja que el modo automático haga el resto.

## Tabla rápida

- [Visión general](#visión-general)
- [Características principales](#características-principales)
- [Pila tecnológica](#pila-tecnológica)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Primeros pasos](#primeros-pasos)
- [Configuración de Neon](#configuración-de-neon)
- [Comandos habituales](#comandos-habituales)
- [Despliegue](#despliegue)
- [Resolución de problemas](#resolución-de-problemas)

## Visión general

Ponchister es una PWA construida con React, TypeScript y Vite. Ofrece una experiencia inmersiva optimizada para móviles y reproduce canciones de YouTube en modo automático. El catálogo y la administración viven en el mismo proyecto, con un backend propio sobre Neon y funciones serverless en Vercel.

## Características principales

- **Modo automático**: rotación continua con animaciones, portada y revelado de datos.
- **Panel administrativo**: login propio, gestión de canciones y estadísticas.
- **Usuarios administradores**: roles `superadmin` y `editor`.
- **Generador de tarjetas**: integrado para crear PDFs y plantillas.
- **Preparado para PWA**: `manifest.json`, `vite-plugin-pwa` y assets maskable.

## Pila tecnológica

- **Framework**: React 19 + Vite 7.
- **Lenguaje**: TypeScript 5.
- **UI**: MUI 7 + estilos personalizados.
- **Backend**: Neon Postgres + Drizzle ORM + Vercel Functions.
- **Reproductor**: `react-youtube`.

## Estructura del proyecto

```text
ponchister/
├─ api/                        # Endpoints serverless (Vercel)
├─ public/
├─ scripts/                    # Setup DB + crear admin
├─ src/
│  ├─ admin/                   # Panel y servicios administrativos
│  ├─ auto-game/               # UI y efectos del modo automático
│  ├─ db/                      # Schema Drizzle
│  ├─ services/                # Servicios de canciones (API)
│  ├─ App.tsx
│  └─ AutoGame.tsx
├─ README.md
├─ vite.config.ts
└─ tsconfig*.json
```

## Primeros pasos

### Requisitos

- Node.js 20 o superior.
- Base de datos en Neon.

### Instalación

```bash
npm install
```

### Variables de entorno

Crea `ponchister/.env.local`:

```ini
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require
ADMIN_JWT_SECRET=replace-with-long-random-string
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me
ADMIN_ROLE=superadmin
```

> `DATABASE_URL` y `ADMIN_JWT_SECRET` son obligatorias para la app. Las variables `ADMIN_*` solo se usan para crear el primer admin.

## Configuración de Neon

1) Crear el esquema:
```bash
npm run setup:neon
```

2) Crear el usuario superadmin inicial:
```bash
ADMIN_EMAIL="tu@email" ADMIN_PASSWORD="tu-password" npm run admin:create
```

## Comandos habituales

- `npm run dev` – levanta API (Vercel) + frontend con proxy.
- `npm run dev:api` – solo API en `http://127.0.0.1:3001`.
- `npm run dev:web` – solo frontend en `http://127.0.0.1:5173`.
- `npm run build` – compila TypeScript y genera `dist/`.
- `npm run preview` – sirve el build local.
- `npm run lint` – ejecuta ESLint.

## Despliegue

- Configura `DATABASE_URL` y `ADMIN_JWT_SECRET` en Vercel.
- Despliega con `vercel --prod` (o el proveedor que uses).

## Resolución de problemas

- **Error de BD**: confirma `DATABASE_URL` y que el esquema esté creado con `setup:neon`.
- **Login admin falla**: valida `ADMIN_JWT_SECRET` y que exista un usuario activo.
- **Lista vacía**: revisa el contenido de `songs` en Neon.
