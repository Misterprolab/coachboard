# CoachBoard — Migrazione a DB Locale

## Obiettivo
Rimuovere server remoto + login. Ogni coach ha i dati localmente sul dispositivo (Expo SQLite + Drizzle).

## Status
- [x] expo-sqlite installato (v16.0.10)
- [x] drizzle-orm installato (v0.45.2)
- [x] Schema locale creato: lib/db/schema.ts
- [x] Client DB creato: lib/db/client.ts
- [x] Migrations SQL: lib/db/migrations.ts
- [ ] Seed esercizi di default: lib/db/seed.ts
- [ ] DB init hook: lib/db/useDb.ts
- [ ] _layout.tsx — rimuovi AuthGuard, aggiungi DB init
- [ ] login.tsx — elimina
- [ ] authStore.ts — elimina
- [ ] api.ts — elimina (o lascia vuoto per compatibilità)
- [ ] Ogni screen — migra da apiFetch → query Drizzle locali
  - [ ] roster.tsx (952 righe) — players CRUD + stats
  - [ ] calendar.tsx (634) — matches CRUD
  - [ ] match/[id].tsx (1628) — match detail, lineup, convocations, goals, subs, cards
  - [ ] sessions.tsx (183) — sessions list
  - [ ] session/[id].tsx (221) — session detail
  - [ ] library.tsx (611) — exercises list
  - [ ] exercise/[id].tsx (150) — exercise detail
  - [ ] generator.tsx (535) — AI generator (chiama Groq/OpenAI, rimane remote)
  - [ ] index.tsx (387) — home dashboard

## Architettura scelta
- Expo SQLite (expo-sqlite v16) con drizzle-orm/expo-sqlite
- DB aperto con openDatabaseSync("coachboard.db")
- Migrations manuali via execAsync al primo avvio
- Seed esercizi default al primo avvio (controlla count)
- Niente server, niente auth, niente token
- Profile coach (nome, squadra, logo) → tabella profile id=1

## File da creare/modificare
1. lib/db/schema.ts ✅
2. lib/db/client.ts ✅  
3. lib/db/migrations.ts ✅
4. lib/db/seed.ts — esercizi default (estrarre da packages/web/src/api/index.ts)
5. lib/db/index.ts — export tutto
6. lib/useDbInit.ts — hook che fa migrate+seed all'avvio
7. _layout.tsx — rimuovi AuthGuard, chiama useDbInit
8. Tutti gli screen

## Note
- generator.tsx usa AI (Groq/OpenAI) → rimane con fetch remoto per quella parte
- Le foto giocatori esistenti usano URL remoti → ok, expo-image-picker salva locali
- Drizzle expo-sqlite NON usa foreign keys references() → già rimosso dallo schema
