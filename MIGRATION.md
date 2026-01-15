# Configuracion de Neon

## Variables necesarias
- `DATABASE_URL` (Neon)
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

2) Crear el usuario superadmin inicial:
```bash
ADMIN_EMAIL="tu@email" ADMIN_PASSWORD="tu-password" node scripts/create-admin-user.mjs
```

## Notas
- `ADMIN_JWT_SECRET` debe ser un string largo y seguro.
