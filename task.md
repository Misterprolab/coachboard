# Feature batch

## 1. Note partita ✅ già esiste `notes` in `matches` — è già in InfoSection
   → La sezione "info" ha già note. Skip — già implementato.

## 2. Valutazione giocatori post-partita
   - Aggiungere colonna `rating` (real, nullable) a `matchConvocations`
   - Migration Turso
   - UI in RisultatoSection o nuova tab "Valutazioni": slider/stelle 1-10 per ogni convocato
   - API PUT /matches/:id/ratings
   - Stats giocatore in roster: media voti

## 3. Statistiche giocatori
   - Nessuna colonna nuova — calcolo a runtime dalla query
   - Endpoint GET /players/:id/stats → presenze, gol, cartellini, media voto
   - UI già presente in roster.tsx (statsGrid/wdlRow) — bisogna popolarla con dati reali
   - Attualmente cosa mostra? Verificare

## 4. Notifiche scadenza licenza (email)
   - Endpoint POST /admin/notify-expiring → trova utenti con scadenza entro X giorni, manda email
   - Oppure: all'apertura del panel admin, mostra banner utenti in scadenza entro 30gg
   - Soluzione senza email: badge/alert nel panel "Utenti & Licenze" con utenti in scadenza
   - NON serve SMTP esterno → banner visivo nel panel admin

## 5. Calendario
   - Vista mensile con partite + sedute
   - Nuova tab in (tabs) oppure modal dal header
   - Usa dati già presenti

## Ordine esecuzione
1. Schema migration (rating in matchConvocations)
2. API stats + ratings
3. UI valutazioni (in match/[id].tsx RisultatoSection)
4. UI statistiche (in roster.tsx — già ha la struttura)
5. Alert scadenze nel panel admin (no email)
6. Calendario tab
