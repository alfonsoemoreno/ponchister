# Migracion a Neon

## Variables necesarias
- `DATABASE_URL` (Neon)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_JWT_SECRET`

Opcional para crear el primer admin:
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_ROLE` (default: superadmin)

## Pasos sugeridos
1) Crear el esquema en Neon:
```bash
node scripts/setup-neon.mjs
```

2) Migrar canciones desde Supabase:
```bash
node scripts/migrate-supabase-to-neon.mjs
```

3) Crear el usuario superadmin inicial:
```bash
ADMIN_EMAIL="tu@email" ADMIN_PASSWORD="tu-password" node scripts/create-admin-user.mjs
```

## Notas
- El script de migracion conserva los IDs originales de `songs`.
- `ADMIN_JWT_SECRET` debe ser un string largo y seguro.
