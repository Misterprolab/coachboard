# Auth Implementation Plan

## Obiettivo
- Login/registrazione con email + password
- Invite codes (solo chi ha codice può registrarsi)
- Ogni utente vede solo i propri dati
- Logout da impostazioni, sempre loggato se non fai logout
- Dati attuali → assegnati all'admin (userId = 'admin')

## Struttura DB da aggiungere
1. Tabella `users` (id, email, passwordHash, role, inviteCode, createdAt)
2. Tabella `invite_codes` (id, code, createdBy, usedBy, usedAt, createdAt)
3. Aggiungere `userId` a: players, exercises (custom), sessions, matches

## API da aggiungere/modificare
- POST /api/auth/register (email, password, inviteCode)
- POST /api/auth/login (email, password) → JWT
- POST /api/auth/logout
- GET /api/auth/me
- GET /api/admin/invite-codes (solo admin)
- POST /api/admin/invite-codes (genera codice, solo admin)

## Middleware
- authMiddleware: verifica JWT, injetta userId nel contesto
- adminMiddleware: verifica ruolo admin

## Frontend
- Schermata Login/Register (route /login)
- Redirect automatico se non loggato
- Settings: mostra email utente + logout + (se admin) genera codice invito
- Token salvato in localStorage, inviato come Bearer header

## Migrazione dati
- Script: imposta userId = 'system-admin' su tutti i record esistenti
- Il primo account creato (o quello con ADMIN_EMAIL) = admin

## Deploy
- Branch: feature/auth
- Test locale → merge → push → Render redeploy automatico
