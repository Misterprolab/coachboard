import { Hono } from 'hono';
import { cors } from "hono/cors";
import { db } from './database';
import { exercises, players, sessions, sessionExercises, matches, matchConvocations, matchLineup, matchGoals, users, inviteCodes } from './database/schema';
import { eq, inArray, and, isNull, or } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';

// ─── Safe JSON parse (handles null, double-encoded strings) ───────────────────
function safeParseJSON(val: any, fallback: any = []): any {
  if (val == null) return fallback;
  try {
    const parsed = JSON.parse(val);
    // Handle double-encoded: if result is still a string, parse again
    if (typeof parsed === 'string') {
      try { return JSON.parse(parsed); } catch { return fallback; }
    }
    return parsed;
  } catch { return fallback; }
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────
const getJwtSecret = () => new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'coachboard_fallback_secret_change_me'
);

type JwtPayload = { userId: string; email: string; role: string };

async function makeToken(payload: JwtPayload): Promise<string> {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(getJwtSecret());
}

async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as JwtPayload;
  } catch { return null; }
}

function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

// ─── Middleware types ─────────────────────────────────────────────────────────
type AuthEnv = { Variables: { userId: string; userRole: string } };

const authMiddleware = async (c: any, next: any) => {
  const token = extractToken(c.req.header('Authorization'));
  if (!token) return c.json({ error: 'Non autenticato' }, 401);
  const payload = await verifyToken(token);
  if (!payload) return c.json({ error: 'Token non valido' }, 401);
  c.set('userId', payload.userId);
  c.set('userRole', payload.role);
  await next();
};

const adminMiddleware = async (c: any, next: any) => {
  if (c.get('userRole') !== 'admin') return c.json({ error: 'Accesso negato' }, 403);
  await next();
};

const app = new Hono()
  .basePath('api')
  .use(cors({ origin: (origin) => origin ?? "*", credentials: true, exposeHeaders: ["set-auth-token"] }))
  .get('/ping', (c) => c.json({ message: `Pong! ${Date.now()}` }, 200))
  .get('/health', (c) => c.json({ status: 'ok' }, 200))

  // ─── AUTH ──────────────────────────────────────────────────────────────────
  .post('/auth/login', async (c) => {
    const { email, password } = await c.req.json();
    if (!email || !password) return c.json({ error: 'Email e password richiesti' }, 400);
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    if (!user) return c.json({ error: 'Credenziali non valide' }, 401);
    const valid = await Bun.password.verify(password, user.passwordHash);
    if (!valid) return c.json({ error: 'Credenziali non valide' }, 401);
    // Verifica scadenza licenza (admin è sempre attivo)
    const now = Date.now();
    let subStatus = user.subscriptionStatus ?? 'trial';
    let subExpiry = user.subscriptionExpiry ?? null;
    if (user.role !== 'admin') {
      if (subExpiry && now > subExpiry) {
        // Auto-aggiorna status a expired se non già
        if (subStatus !== 'expired') {
          await db.update(users).set({ subscriptionStatus: 'expired' }).where(eq(users.id, user.id));
          subStatus = 'expired';
        }
      }
    }
    const token = await makeToken({ userId: user.id, email: user.email, role: user.role });
    const subscriptionExpired = user.role !== 'admin' && !!subExpiry && now > subExpiry;
    return c.json({
      token,
      role: user.role,
      subscriptionStatus: subStatus,
      subscriptionExpiry: subExpiry,
      subscriptionExpired,
    }, 200);
  })
  .post('/auth/register', async (c) => {
    const { email, password, inviteCode } = await c.req.json();
    if (!email || !password || !inviteCode) return c.json({ error: 'Tutti i campi sono obbligatori' }, 400);
    if (password.length < 8) return c.json({ error: 'Password minimo 8 caratteri' }, 400);
    // Check invite code
    const [invite] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, inviteCode.trim()));
    if (!invite || invite.usedBy != null) return c.json({ error: 'Codice invito non valido o già usato' }, 400);
    // Check email not taken
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase().trim()));
    if (existing.length > 0) return c.json({ error: 'Email già registrata' }, 409);
    const adminEmail = (process.env.ADMIN_EMAIL ?? '').toLowerCase();
    const isAdmin = email.toLowerCase().trim() === adminEmail;
    // Use 'system-admin' as id for the first admin so they see existing data
    const userId = isAdmin ? 'system-admin' : randomUUID();
    const hash = await Bun.password.hash(password);
    const now = Date.now();
    // Trial di 15 giorni per i nuovi utenti coach; admin non ha scadenza
    const trialExpiry = isAdmin ? null : now + 15 * 24 * 60 * 60 * 1000;
    const user = {
      id: userId,
      email: email.toLowerCase().trim(),
      passwordHash: hash,
      role: isAdmin ? 'admin' : 'coach',
      createdAt: now,
      subscriptionStatus: isAdmin ? 'active' : 'trial',
      subscriptionExpiry: trialExpiry,
    };
    await db.insert(users).values(user);
    // Mark invite as used
    await db.update(inviteCodes).set({ usedBy: userId, usedAt: now }).where(eq(inviteCodes.code, inviteCode.trim()));
    const token = await makeToken({ userId: user.id, email: user.email, role: user.role });
    return c.json({ token, role: user.role }, 201);
  })
  .get('/auth/me', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const [user] = await db.select({ id: users.id, email: users.email, role: users.role }).from(users).where(eq(users.id, userId));
    if (!user) return c.json({ error: 'Utente non trovato' }, 404);
    return c.json(user, 200);
  })
  .post('/auth/verify', async (c) => {
    const { token } = await c.req.json();
    const payload = await verifyToken(token ?? '');
    return c.json({ valid: !!payload }, payload ? 200 : 401);
  })

  // ─── BOOTSTRAP: generate first invite code (only works when no users exist) ─
  .post('/auth/bootstrap', async (c) => {
    const existing = await db.select({ id: users.id }).from(users).limit(1);
    if (existing.length > 0) return c.json({ error: 'Bootstrap non disponibile: utenti già esistenti' }, 403);
    const code = randomUUID().split('-')[0].toUpperCase();
    const invite = { id: randomUUID(), code, createdBy: 'bootstrap', usedBy: null, usedAt: null, createdAt: Date.now() };
    await db.insert(inviteCodes).values(invite);
    return c.json({ code }, 201);
  })

  // ─── PROFILE ──────────────────────────────────────────────────────────────
  .get('/profile', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const [user] = await db.select({
      id: users.id, email: users.email, role: users.role,
      name: users.name, teamName: users.teamName, logoUrl: users.logoUrl,
    }).from(users).where(eq(users.id, userId));
    if (!user) return c.json({ error: 'not found' }, 404);
    return c.json({ name: user.name ?? '', teamName: user.teamName ?? '', logoUrl: user.logoUrl ?? null }, 200);
  })
  .put('/profile', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();
    await db.update(users).set({
      name: body.name ?? null,
      teamName: body.teamName ?? null,
      logoUrl: body.logoUrl ?? null,
    }).where(eq(users.id, userId));
    return c.json({ success: true }, 200);
  })

  // ─── SEASON RESET ─────────────────────────────────────────────────────────
  .delete('/season', authMiddleware, async (c) => {
    const userId = c.get('userId');
    // Delete all matches (cascades: convocations, lineup, goals)
    const userMatches = await db.select({ id: matches.id }).from(matches).where(eq(matches.userId, userId));
    for (const m of userMatches) {
      await db.delete(matchGoals).where(eq(matchGoals.matchId, m.id));
      await db.delete(matchLineup).where(eq(matchLineup.matchId, m.id));
      await db.delete(matchConvocations).where(eq(matchConvocations.matchId, m.id));
    }
    await db.delete(matches).where(eq(matches.userId, userId));
    // Delete all players
    await db.delete(players).where(eq(players.userId, userId));
    // Delete all sessions (cascades: sessionExercises)
    const userSessions = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));
    for (const s of userSessions) {
      await db.delete(sessionExercises).where(eq(sessionExercises.sessionId, s.id));
    }
    await db.delete(sessions).where(eq(sessions.userId, userId));
    // Delete custom exercises
    await db.delete(exercises).where(and(eq(exercises.userId, userId), eq(exercises.isCustom, true)));
    return c.json({ success: true }, 200);
  })

  // ─── ADMIN: INVITE CODES ───────────────────────────────────────────────────
  .post('/admin/invite-codes', authMiddleware, adminMiddleware, async (c) => {
    const userId = c.get('userId');
    const code = randomUUID().split('-')[0].toUpperCase(); // e.g. A3F2B8C1
    const invite = { id: randomUUID(), code, createdBy: userId, usedBy: null, usedAt: null, createdAt: Date.now() };
    await db.insert(inviteCodes).values(invite);
    return c.json({ code }, 201);
  })
  .get('/admin/invite-codes', authMiddleware, adminMiddleware, async (c) => {
    const all = await db.select().from(inviteCodes).where(eq(inviteCodes.createdBy, c.get('userId')));
    return c.json(all, 200);
  })

  // ─── ADMIN: USERS (licenze) ────────────────────────────────────────────────
  .get('/admin/users', authMiddleware, adminMiddleware, async (c) => {
    const all = await db.select({
      id: users.id, email: users.email, role: users.role,
      name: users.name, teamName: users.teamName,
      createdAt: users.createdAt,
      subscriptionStatus: users.subscriptionStatus,
      subscriptionExpiry: users.subscriptionExpiry,
    }).from(users);
    // Auto-calcola expired runtime
    const now = Date.now();
    const result = all.map(u => ({
      ...u,
      subscriptionExpired: u.role !== 'admin' && !!u.subscriptionExpiry && now > u.subscriptionExpiry,
    }));
    return c.json(result, 200);
  })
  .put('/admin/users/:id/subscription', authMiddleware, adminMiddleware, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json(); // { status: 'active'|'trial'|'expired', expiry: ISO string | null }
    const patch: Record<string, any> = {};
    if ('status' in body) patch.subscriptionStatus = body.status;
    if ('expiry' in body) {
      patch.subscriptionExpiry = body.expiry ? new Date(body.expiry).getTime() : null;
    }
    if (Object.keys(patch).length === 0) return c.json({ error: 'Nessun dato' }, 400);
    await db.update(users).set(patch).where(eq(users.id, id));
    return c.json({ success: true }, 200);
  })
  .delete('/admin/users/:id', authMiddleware, adminMiddleware, async (c) => {
    const id = c.req.param('id');
    const requesterId = c.get('userId');
    if (id === requesterId) return c.json({ error: 'Non puoi eliminare te stesso' }, 400);

    try {
      // 1. Nullifica invite_codes.used_by (FK senza cascade)
      await db.update(inviteCodes).set({ usedBy: null }).where(eq(inviteCodes.usedBy, id));

      // 2. Matches → cascade DB elimina convocations, lineup, goals
      await db.delete(matches).where(eq(matches.userId, id));

      // 3. Players (dopo matches — playerId nei match già eliminati)
      await db.delete(players).where(eq(players.userId, id));

      // 4. sessionExercises delle sessioni utente (FK senza cascade sull'exerciseId)
      const userSessions = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, id));
      if (userSessions.length > 0) {
        await db.delete(sessionExercises).where(inArray(sessionExercises.sessionId, userSessions.map(s => s.id)));
      }
      await db.delete(sessions).where(eq(sessions.userId, id));

      // 5. Esercizi custom dell'utente
      const userExercises = await db.select({ id: exercises.id }).from(exercises).where(and(eq(exercises.userId, id), eq(exercises.isCustom, true)));
      if (userExercises.length > 0) {
        await db.delete(sessionExercises).where(inArray(sessionExercises.exerciseId, userExercises.map(e => e.id)));
        await db.delete(exercises).where(and(eq(exercises.userId, id), eq(exercises.isCustom, true)));
      }

      // 6. Invite codes creati dall'utente
      await db.delete(inviteCodes).where(eq(inviteCodes.createdBy, id));

      // 7. User
      await db.delete(users).where(eq(users.id, id));

      return c.json({ success: true }, 200);
    } catch (err: any) {
      console.error('[DELETE /admin/users/:id]', err);
      return c.json({ error: err?.message ?? 'Errore interno' }, 500);
    }
  })

  // ─── SEED default exercises ───────────────────────────────────────────────
  .post('/seed', authMiddleware, async (c) => {
    // Find all non-custom exercise IDs, remove any sessionExercises references, then delete
    const nonCustom = await db.select({ id: exercises.id }).from(exercises).where(eq(exercises.isCustom, false));
    if (nonCustom.length > 0) {
      const ids = nonCustom.map(e => e.id);
      await db.delete(sessionExercises).where(inArray(sessionExercises.exerciseId, ids));
      await db.delete(exercises).where(eq(exercises.isCustom, false));
    }

    const now = Date.now();
    const defaultExercises = [
      // ── RISCALDAMENTO ──────────────────────────────────────────────────────
      {
        id: randomUUID(), name: 'Rondo 5vs2 con transizione', nameEn: 'Rondo 5v2 with transition',
        category: 'riscaldamento',
        description: 'Quadrato 10x10m. 5 giocatori in possesso contro 2 pressatori centrali. Al recupero palla i 2 diventano possessori e 2 dei 5 entrano al centro. Cambio automatico al terzo tocco sbagliato o intercetto. Vincolo: massimo 2 tocchi. Atleti in costante attivazione neuromuscolare e cognitiva.',
        descriptionEn: 'Square 10x10m. 5 players in possession vs 2 central pressers. On recovery the 2 become possessors and 2 of the 5 enter center. Auto-switch on 3rd error or interception. Constraint: max 2 touches. Continuous neuromuscular and cognitive activation.',
        primaryObjective: 'Attivazione tecnica e cognitiva pre-allenamento tramite mantenimento del possesso sotto pressione',
        secondaryObjectives: JSON.stringify(['Pressing coordinato in coppia', 'Velocità di pensiero 1-2 tocchi', 'Comunicazione e posizionamento senza palla', 'Scalamento difensivo automatico']),
        duration: 12, players: 7, intensity: 'media', materials: 'palla, coni (quadrato 10x10)', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Attivazione neuromotoria con palla', nameEn: 'Neuromotor activation with ball',
        category: 'riscaldamento',
        description: 'Coppie a 8m. Sequenza: palleggio sinistro-destro alternato → controllo orientato a destra → dribbling 3 coni → passaggio a rimbalzo → colpo di testa. 4 ripetizioni per coppia invertendo ruoli. Progressione: aumentare ritmo ogni giro. Attivazione tobillo, ginocchio, anca.',
        descriptionEn: 'Pairs 8m apart. Sequence: left-right alternate juggle → oriented control right → dribble 3 cones → bounce pass → header. 4 reps per pair switching roles. Progression: increase pace each round.',
        primaryObjective: 'Attivare le catene cinetiche del calciatore attraverso gesti tecnici progressivi',
        secondaryObjectives: JSON.stringify(['Coordinazione oculo-podalica', 'Controllo orientato in movimento', 'Colpo di testa tecnica base', 'Riscaldamento articolare completo']),
        duration: 14, players: 2, intensity: 'bassa', materials: 'palle, coni', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Possesso 4vs4 + portieri', nameEn: 'Possession 4v4 + goalkeepers',
        category: 'riscaldamento',
        description: 'Campo 25x30m. 4v4 con portieri inclusi nella circolazione. I portieri giocano come jolly neutrali (sempre con la squadra in possesso). Regola: il punto si segna toccando il portiere avversario con la palla. Max 3 tocchi. Obiettivo: attivare ricezione, orientamento e pressing a media intensità.',
        descriptionEn: '25x30m field. 4v4 with keepers as neutral jokers. Point scored by touching opponent keeper. Max 3 touches.',
        primaryObjective: 'Attivazione collettiva in possesso-non possesso con coinvolgimento attivo dei portieri',
        secondaryObjectives: JSON.stringify(['Orientamento alla ricezione', 'Pressing coordinato 2-3 uomini', 'Portieri integrati nel gioco', 'Transizioni rapide']),
        duration: 15, players: 10, intensity: 'media', materials: 'palle, coni, porte piccole', isCustom: false, createdAt: now
      },

      // ── TECNICA ────────────────────────────────────────────────────────────
      {
        id: randomUUID(), name: 'Combinazione 1-2 con terzo uomo', nameEn: 'One-two combination with third man',
        category: 'tecnica',
        description: 'Triangolo coni 8m lato. A passa a B → B restituisce di prima → A conduce e serve C in profondità → C controlla e calcia in porta. 3 varianti: (1) palla a terra, (2) palla in aria, (3) inserimento con taglio del terzo. 5 min per variante. Obiettivo qualità tocco: il passaggio deve essere sempre nel piede corretto del ricevitore.',
        descriptionEn: 'Cone triangle 8m side. A passes B → B returns first-time → A drives and serves C deep → C controls and shoots. 3 variants: ground, aerial, diagonal run.',
        primaryObjective: 'Sviluppare automatismi di combinazione a velocità elevata con soluzione finale',
        secondaryObjectives: JSON.stringify(['Passaggio preciso nel piede corretto', 'Controllo orientato verso la porta', 'Timing dell\'inserimento del terzo uomo', 'Tiro dopo ricezione in movimento']),
        duration: 18, players: 3, intensity: 'media', materials: 'palle, coni, porta', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Controllo orientato e conduzione', nameEn: 'Oriented control and dribbling',
        category: 'tecnica',
        description: 'Griglia 6x6m. Giocatore al centro riceve palla da 4 angoli in rotazione. Ogni ricezione: controllo orientato a 90° verso il cono successivo, conduzione 4 tocchi, passaggio al prossimo cono. Progressione 1: inserire avversario passivo. Progressione 2: avversario semiattivo. Enfasi: primo tocco lontano dal pressing, protezione palla.',
        descriptionEn: '6x6m grid. Player at center receives from 4 corners in rotation. Each reception: oriented control 90° toward next cone, dribble 4 touches, pass to next cone.',
        primaryObjective: 'Perfezionare il primo tocco orientato come fondamentale per uscire dalla pressione',
        secondaryObjectives: JSON.stringify(['Visione periferica pre-ricezione', 'Protezione del corpo sulla palla', 'Cambio direzione a velocità elevata', 'Scelta del piede di controllo']),
        duration: 16, players: 1, intensity: 'media', materials: 'palle, coni', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Finishing: cross e attacco al secondo palo', nameEn: 'Finishing: cross and far post attack',
        category: 'tecnica',
        description: 'Fascia destra e sinistra attive in alternanza. Crossatore conduce 10m, serve cross basso-teso / cross morbido / cross a rimbalzo. In area: attaccante sul primo palo + attaccante sul secondo + mezzapunta in arrivo. Portiere in porta. 6 cross per lato. Variante tattica: attaccante anticipa di tre passi su cross basso.',
        descriptionEn: 'Alternating left/right wings. Crosser drives 10m, serves low/soft/bouncing cross. In box: near post + far post + arriving playmaker. Goalkeeper active.',
        primaryObjective: 'Sincronizzare i movimenti degli attaccanti sui cross per creare superiorità numerica in area',
        secondaryObjectives: JSON.stringify(['Timing dell\'attacco al palo', 'Qualità del cross su 3 tipologie', 'Colpo di testa e tiro di prima', 'Lettura della traiettoria del pallone']),
        duration: 20, players: 5, intensity: 'media', materials: 'palle, porta, coni', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Duello 1vs1 in zona', nameEn: '1v1 duel in zone',
        category: 'tecnica',
        description: 'Corridoio 6x15m. Attaccante riceve spalle alla porta, si gira e affronta il difensore. Obiettivo attaccante: superare e concludere. Obiettivo difensore: non concedere tiro. 8 duelli a coppia, alternare ruoli. Variante: difensore parte da 2m di vantaggio (situazione di pressing), poi da 0m (duello di potenza).',
        descriptionEn: '6x15m corridor. Attacker receives back to goal, turns and faces defender. Goal: beat and shoot. Defender: no shot conceded. 8 duels per pair.',
        primaryObjective: 'Sviluppare la capacità di superamento in 1vs1 con decisione e variazione di ritmo',
        secondaryObjectives: JSON.stringify(['Protezione palla prima del turno', 'Finta e cambia passo', 'Attacco alla profondità post-superamento', 'Postura difensiva e recupero']),
        duration: 20, players: 2, intensity: 'alta', materials: 'palle, coni, porta piccola', isCustom: false, createdAt: now
      },

      // ── TATTICA ────────────────────────────────────────────────────────────
      {
        id: randomUUID(), name: 'Pressing alto coordinato (3-2-5 vs 4-3-3)', nameEn: 'Coordinated high press (3-2-5 vs 4-3-3)',
        category: 'tattica',
        description: 'Campo diviso in 3 terzi. Fase non possesso: tridente offensivo copre le linee di passaggio sui difensori avversari → pressing trigger = passaggio al terzino → tutta la linea scala di 10m → MCD chiude l\'interno. Regola: se la palla arriva al portiere avversario si resetta. Obiettivo: recupero entro 5 secondi nella metà campo avversaria.',
        descriptionEn: 'Field divided in 3 thirds. Non-possession phase: front 3 cover passing lanes on defenders → trigger = pass to fullback → whole line drops 10m → CDM closes inside. Goal: recovery within 5 seconds in opponent half.',
        primaryObjective: 'Automatizzare il pressing alto coordinato come meccanismo collettivo di recupero immediato',
        secondaryObjectives: JSON.stringify(['Trigger recognition per scatenare il pressing', 'Scalamento a catena dei reparti', 'Trappola del fuorigioco integrata nel pressing', 'Transizione offensiva immediata post-recupero']),
        duration: 25, players: 11, intensity: 'alta', materials: 'palle, coni, porte', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Costruzione bassa 3-2 vs pressing 4-4', nameEn: 'Low build-up 3-2 vs 4-4 press',
        category: 'tattica',
        description: 'Portiere + 3 difensori + 2 mediani costruiscono contro 4+4 avversari. Obiettivo: uscire puliti dalla pressione e arrivare alla linea dei centrocampisti. Varianti: (1) portiere incluso nel gioco, (2) terzini a piede invertito si alzano, (3) mediano abbassa tra i difensori. Ripetizione: 10 costruzioni, pause di 30" per analisi.',
        descriptionEn: 'GK + 3 defenders + 2 midfielders build vs 4+4 pressers. Goal: clean exit through pressure to midfield line.',
        primaryObjective: 'Sviluppare meccanismi fluidi di costruzione bassa per uscire dall\'alta pressione avversaria',
        secondaryObjectives: JSON.stringify(['Posizionamento del portiere come terzo difensore', 'Terzo uomo libero tra le linee', 'Larghezza dei terzini per allargare il pressing', 'Comunicazione verbale durante la costruzione']),
        duration: 25, players: 11, intensity: 'media', materials: 'palle, coni, porte', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Transizioni 6vs6: attacco e difesa', nameEn: '6v6 transitions: attack and defense',
        category: 'tattica',
        description: 'Campo 40x35m. Due squadre da 6. Quando cambia il possesso: entro 3 secondi la squadra che perde palla deve essere in blocco difensivo, quella che recupera palla deve avere uomini in avanti. Regola bonus: se la transizione porta al tiro entro 4 secondi, vale doppio. Analisi: film tattico post-esercizio.',
        descriptionEn: '40x35m field. Two teams of 6. On turnover: within 3 seconds losing team in defensive block, recovering team attacks. Bonus: transition shot within 4 seconds = double point.',
        primaryObjective: 'Allenare la velocità e l\'organizzazione nelle fasi di transizione positiva e negativa',
        secondaryObjectives: JSON.stringify(['Counterpressing nei 3 secondi post-perdita', 'Transizione offensiva verticale', 'Supporto al portatore in ripartenza', 'Rientro difensivo organizzato']),
        duration: 25, players: 12, intensity: 'alta', materials: 'palle, coni, porte', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Blocco difensivo 4-4-2 (bassa intensità)', nameEn: '4-4-2 defensive block (low block)',
        category: 'tattica',
        description: 'La squadra si organizza in 4-4-2 basso. L\'avversario (6 uomini) circolano palla cercando varchi. Regola: la squadra difende mantenendo blocco compatto, distanza tra linee max 12m. Trigger per uscita: palla al terzino avversario → terzino sale, ala stringe, MCD copre. 15 minuti di lavoro continuato. Debriefing video.',
        descriptionEn: 'Team organizes in low 4-4-2. Opponent (6) circulates seeking openings. Rule: compact block maintained, max 12m between lines. Trigger: ball to fullback → fullback pushes, winger narrows.',
        primaryObjective: 'Consolidare il blocco difensivo basso con corretti trigger di uscita su portatore laterale',
        secondaryObjectives: JSON.stringify(['Distanze inter-reparto (max 12m)', 'Copertura della zona centrale', 'Chiusura degli spazi alle spalle della linea difensiva', 'Comunicazione difensiva (chiamate verbali)']),
        duration: 20, players: 11, intensity: 'media', materials: 'palle, coni, porte', isCustom: false, createdAt: now
      },

      // ── ATLETICO ───────────────────────────────────────────────────────────
      {
        id: randomUUID(), name: 'Sprint ripetuti con cambio di direzione (COD)', nameEn: 'Repeated sprints with change of direction',
        category: 'atletico',
        description: 'Percorso a T: 10m dritto + 5m dx + ritorno centro + 5m sx + ritorno inizio. 8 ripetizioni con 40" recupero passivo. Cronometro ogni rep. Obiettivo: mantienere max -5% tra rep1 e rep8. Progressione: aggiungere palla nel secondo blocco. Monitorare frequenza cardiaca: rientro sotto 140bpm prima della ripetuta successiva.',
        descriptionEn: 'T-drill: 10m straight + 5m right + return center + 5m left + return start. 8 reps with 40s passive recovery. Goal: maintain max -5% between rep1 and rep8.',
        primaryObjective: 'Sviluppare la potenza e la resistenza alla velocità con cambio di direzione specifico per il calcio',
        secondaryObjectives: JSON.stringify(['Accelerazione esplosiva dai blocchi', 'Tecnica di pianta del piede nel COD', 'Resistenza alla velocità (rep quality)', 'Monitoraggio FC per gestione carico']),
        duration: 18, players: 1, intensity: 'alta', materials: 'coni, cronometro', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'HIT integrato con palla (5-3-2)', nameEn: 'Ball-integrated HIIT (5-3-2)',
        category: 'atletico',
        description: 'Protocollo 5-3-2: 5" sprint massimale → 3" pausa attiva (conduzione lenta) → 2" pausa assoluta. Ripetuto 10 volte = 1 serie. 3 serie totali con 3 min recupero. Ogni sprint include un gesto tecnico: dribbling su cono, passaggio al volo, colpo di testa. Carico cardiovascolare: zona 4-5 (85-95% FCmax).',
        descriptionEn: '5-3-2 protocol: 5s max sprint → 3s active recovery (slow dribble) → 2s full rest. Repeated 10 times = 1 set. 3 sets total with 3min recovery. Each sprint includes: cone dribble, volley, header.',
        primaryObjective: 'Aumentare la capacità di lavoro ad alta intensità mantenendo qualità tecnica sotto fatica',
        secondaryObjectives: JSON.stringify(['Zona cardiovascolare 4-5 (85-95% FCmax)', 'Qualità tecnica in stato di affaticamento', 'Recupero attivo efficiente', 'Adattamento metabolico anaerobico lattacido']),
        duration: 22, players: 1, intensity: 'alta', materials: 'palle, coni, cardiofrequenzimetro', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Forza funzionale calciatore (circuito)', nameEn: 'Footballer functional strength circuit',
        category: 'atletico',
        description: 'Circuito 6 stazioni / 45" lavoro / 15" transizione / 3 giri:\n1. Squat monopodalico con palla medicinale\n2. Nordic curl (forza eccentrica ischio)\n3. Salti pliometrici su scala agilità\n4. Plank laterale con rotazione\n5. Hip thrust con banda elastica\n6. Salto squat + atterraggio morbido\nRecupero 2 min tra giri. Specifico prevenzione infortuni.',
        descriptionEn: '6-station circuit / 45s work / 15s transition / 3 rounds: single-leg squat, Nordic curl, plyometric ladder, side plank rotation, banded hip thrust, squat jump landing.',
        primaryObjective: 'Sviluppare forza funzionale specifica per il calcio con focus sulla prevenzione infortuni (ischio e ginocchio)',
        secondaryObjectives: JSON.stringify(['Forza eccentrica degli ischio-crurali (Nordic curl)', 'Stabilità monopodalica', 'Potenza esplosiva degli arti inferiori', 'Stabilità del core in rotazione']),
        duration: 25, players: 1, intensity: 'media', materials: 'palla medicinale, scala agilità, bande elastiche', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Resistenza aerobica con palla (SSG)', nameEn: 'Aerobic endurance with ball (SSG)',
        category: 'atletico',
        description: 'Small Sided Game 4v4 su campo 35x25m. Durata: 4 blocchi da 5 minuti con 90" recupero. Regola: portiere ha max 3 secondi per rimettere in gioco. Bonus: gol su transizione diretta = 2 punti. Target FC: 75-85% FCmax per tutta la durata del blocco. Monitoraggio GPS/cardio se disponibile.',
        descriptionEn: '4v4 SSG on 35x25m field. 4 blocks of 5 minutes with 90s recovery. GK has max 3 seconds to restart. Bonus: direct transition goal = 2 points. Target HR: 75-85% HRmax.',
        primaryObjective: 'Sviluppare la resistenza aerobica specifica al calcio mantenendo impegno tattico e tecnico',
        secondaryObjectives: JSON.stringify(['Mantenimento FC 75-85% per 20 min complessivi', 'Applicazione tattica in stato di fatica', 'Volume di corsa ad alta intensità', 'Recupero attivo nei blocchi di pausa']),
        duration: 30, players: 8, intensity: 'media', materials: 'palle, coni, porte piccole, cardiofrequenzimetri', isCustom: false, createdAt: now
      },

      // ── PARTITELLA ─────────────────────────────────────────────────────────
      {
        id: randomUUID(), name: 'Partitella a tema: gestione del vantaggio', nameEn: 'Themed match: managing the lead',
        category: 'partitella',
        description: 'Campo 60x40m. 8v8 + portieri. La squadra A parte con 1-0 di vantaggio. Obiettivo A: gestire il vantaggio con circolazione e pressing block. Obiettivo B: trovare il pareggio attraverso gioco verticale. Timer: 15 min. Analisi post-partita: percentuale di possesso, numero di palloni recuperati sotto pressione, errori tecnici da stanchezza.',
        descriptionEn: '60x40m field. 8v8 + GKs. Team A starts with 1-0 lead. Goal A: manage lead through circulation and pressing block. Goal B: equalize through vertical play. 15 minutes.',
        primaryObjective: 'Allenare la gestione del vantaggio come fase di gioco specifica con comportamenti collettivi definiti',
        secondaryObjectives: JSON.stringify(['Circolazione palla per consumare tempo', 'Pressing block organizzato', 'Verticalizzazione rapida in situazione di svantaggio', 'Decision making sotto pressione situazionale']),
        duration: 25, players: 18, intensity: 'alta', materials: 'palle, porte, coni', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Partitella con porte multiple (5v5)', nameEn: 'Multi-goal match (5v5)',
        category: 'partitella',
        description: 'Campo 30x25m. 4 porte piccole (2 per squadra) posizionate sui lati opposti. Ogni squadra difende 2 porte e attacca 2. Obiettivo: favorire verticalità, ampiezza e ricerca costante del varco. Regola: non si può segnare 2 volte consecutive nella stessa porta. Sviluppa visione periferica e occupazione degli spazi.',
        descriptionEn: '30x25m field. 4 small goals (2 per team) on opposite sides. Each team defends 2 goals, attacks 2. Rule: cannot score twice in same goal consecutively.',
        primaryObjective: 'Sviluppare visione del campo, ampiezza di gioco e occupazione degli spazi attraverso la varietà delle soluzioni di gol',
        secondaryObjectives: JSON.stringify(['Visione periferica e scan del campo', 'Ampiezza e verticalità simultanee', 'Pressing orientato su 2 bersagli', 'Creatività nella scelta della soluzione']),
        duration: 20, players: 10, intensity: 'alta', materials: 'palle, 4 porte piccole, coni', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Possesso con zone proibite', nameEn: 'Possession with forbidden zones',
        category: 'partitella',
        description: 'Campo 35x30m diviso in 9 zone (3x3). 5v5. Regola: non si può restare nella propria zona per più di 2 secondi con la palla. Zone centrali hanno valore doppio (passaggio che le attraversa = 2 tocchi conteggiati). Team che arriva a 20 passaggi consecutivi vince il round. Sviluppa circolazione veloce e utilizzo del centro.',
        descriptionEn: '35x30m field divided in 9 zones. 5v5. Rule: cannot stay in own zone more than 2 seconds with ball. Central zones double value. Team reaching 20 consecutive passes wins round.',
        primaryObjective: 'Sviluppare la circolazione rapida attraverso il centro del campo evitando il gioco perimetrale sterile',
        secondaryObjectives: JSON.stringify(['Utilizzo delle zone centrali', 'Velocità di circolazione 1-2 tocchi', 'Supporto al portatore da angoli diversi', 'Pressing zonale coordinato']),
        duration: 20, players: 10, intensity: 'alta', materials: 'palle, coni', isCustom: false, createdAt: now
      },

      // ── CALCI PIAZZATI ─────────────────────────────────────────────────────
      {
        id: randomUUID(), name: 'Schema corner: blocco + taglio incrociato', nameEn: 'Corner scheme: block + cross-cut',
        category: 'calci_piazzati',
        description: 'Schema A: attaccante X fa blocco sul difensore di Y → Y taglia sul primo palo basso → calciatore Z attacca il secondo palo. Schema B: finta corta → cross lungo diretto su 6° metro. 10 ripetizioni per schema. Difesa passiva nelle prime 5, semi-attiva nelle successive. Analisi: timing del taglio va anticipato di 2 passi rispetto al calcio.',
        descriptionEn: 'Scheme A: attacker X blocks defender of Y → Y cuts near post low → Z attacks far post. Scheme B: short feint → long cross to 6th meter. 10 reps per scheme.',
        primaryObjective: 'Automatizzare schemi di attacco su calcio d\'angolo con soluzioni multiple per sorprendere qualsiasi marcatura',
        secondaryObjectives: JSON.stringify(['Timing preciso del taglio incrociato', 'Qualità del cross (3 tipologie)', 'Blocco tecnico conforme alle regole', 'Lettura della marcatura avversaria']),
        duration: 20, players: 11, intensity: 'bassa', materials: 'palle, porta, coni', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Punizione diretta da 20-25m', nameEn: 'Direct free kick from 20-25m',
        category: 'calci_piazzati',
        description: 'Postazioni a 20m, 22m, 25m dal centro porta (5 angolazioni diverse). Tiratori in rotazione: 3 calci a posizione. Tecnica: piazzamento del piede, contatto sul pallone (collo piede / interno con effetto). Portiere in porta. Barriera con 3-4 giocatori. Variante: tiratore finta e serve l\'altro. Analisi video della traiettoria.',
        descriptionEn: 'Stations at 20m, 22m, 25m in 5 angles. Rotating shooters: 3 kicks per position. Technique: foot placement, ball contact (instep/inside with spin). Goalkeeper active. 3-4 man wall.',
        primaryObjective: 'Ottimizzare la tecnica di calcio su punizione diretta da media distanza con precisione e potenza',
        secondaryObjectives: JSON.stringify(['Tecnica del piazzamento (approccio al pallone)', 'Effetto curva / tiro potente', 'Simulazione barriera realistica', 'Coordinazione tra tiratore e appoggio']),
        duration: 20, players: 6, intensity: 'bassa', materials: 'palle, porta, coni per barriera', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Rimessa laterale in zona offensiva', nameEn: 'Throw-in in offensive third',
        category: 'calci_piazzati',
        description: 'Schema da rimessa a 30m dalla porta avversaria: Schema 1: rimettitore → appoggio corto → terzo uomo in profondità. Schema 2: finta corta → lungo sul secondo palo con inserimento. Schema 3: rimessa lunga sul taglio del terzino. 8 ripetizioni per schema. Focus su tecnica della rimessa (piedi a terra, palla dietro la testa).',
        descriptionEn: 'Throw-in schemes 30m from goal. Scheme 1: short support → third man deep. Scheme 2: fake short → long far post run. Scheme 3: long throw to fullback cut.',
        primaryObjective: 'Sfruttare la rimessa laterale in zona offensiva come veicolo di creazione del pericolo',
        secondaryObjectives: JSON.stringify(['Tecnica regolamentare della rimessa', 'Lettura dello spazio per il terzo uomo', 'Sincronizzazione dei movimenti senza palla', 'Velocità di esecuzione dello schema']),
        duration: 15, players: 6, intensity: 'bassa', materials: 'palle, coni', isCustom: false, createdAt: now
      },

      // ── PORTIERI ───────────────────────────────────────────────────────────
      {
        id: randomUUID(), name: 'Riflessi e posizionamento ravvicinato', nameEn: 'Reflexes and short-range positioning',
        category: 'portieri',
        description: 'Portiere sulla linea dei 6m. Tiratore a 8m. Sequenza: (1) tiro basso angolo destro → (2) rimbalzo tiro di sinistro → (3) colpo di testa rasoterra → (4) tiro potente al centro. 4 tiri in sequenza = 1 serie. 6 serie con 45" recupero. Portiere NON si resetta completamente tra i tiri: allena la riapertura rapida. Progressione: accorciare i tempi tra i tiri.',
        descriptionEn: 'GK on 6m line. Shooter at 8m. Sequence: (1) low right → (2) rebound left → (3) headed grounded → (4) power center. 4 shots = 1 set. 6 sets with 45s recovery.',
        primaryObjective: 'Sviluppare i riflessi del portiere e la capacità di riapertura rapida tra tiri ravvicinati in sequenza',
        secondaryObjectives: JSON.stringify(['Riapertura rapida (recovery position)', 'Presa bassa vs deviazione', 'Gestione del rimbalzo post-parata', 'Timing del salto su tiro alto']),
        duration: 18, players: 2, intensity: 'alta', materials: 'palle, porta', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Uscita alta: timing e presa in volo', nameEn: 'High ball exit: timing and aerial catch',
        category: 'portieri',
        description: 'Portiere al centro area. Cross da destra e sinistra alternati (3m, 6m, 9m di profondità). Portiere valuta: uscire o stare? Se esce: staccare al punto più alto, presa con 2 mani sopra la testa, atterraggio controllato. Se rimane: posizionamento sul secondo palo. 15 cross per serie, 3 serie. Progressione: aggiungere attaccante che disturba.',
        descriptionEn: 'GK at center of box. Alternating crosses from left/right (3m, 6m, 9m depth). Decision: come out or stay? If out: jump at highest point, 2-hand catch, controlled landing. 15 crosses/set, 3 sets.',
        primaryObjective: 'Ottimizzare il processo decisionale e la tecnica di uscita aerea del portiere su cross',
        secondaryObjectives: JSON.stringify(['Decision making uscita/non uscita', 'Tecnica di stacco e presa in volo', 'Posizionamento sul secondo palo', 'Comunicazione con la difesa (\"MIEI!\")']),
        duration: 20, players: 3, intensity: 'media', materials: 'palle, porta, coni', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Portiere: costruzione e pressione', nameEn: 'Goalkeeper: build-up under pressure',
        category: 'portieri',
        description: 'Portiere + 2 difensori + 1 terzino vs 2 pressatori avversari. Il portiere deve gestire il pressing e distribuire ai propri giocatori. Vincolo: 3 secondi per prendere decisione. Soluzioni: (1) rilancio lungo calibrato, (2) passaggio corto difensore, (3) lancio lungo terzino aperto. 20 situazioni. Portiere con piedi: analisi della qualità dei lanci.',
        descriptionEn: 'GK + 2 defenders + 1 fullback vs 2 pressers. GK manages press and distributes. Constraint: 3 seconds to decide. Solutions: long ball, short pass, long throw to fullback.',
        primaryObjective: 'Sviluppare la capacità del portiere di giocare con i piedi sotto pressione come primo uomo della costruzione',
        secondaryObjectives: JSON.stringify(['Qualità del rilancio lungo (calibrazione)', 'Passaggio corto preciso sotto pressione', 'Lettura del pressing avversario', 'Comunicazione pre-ricezione con i difensori']),
        duration: 20, players: 6, intensity: 'media', materials: 'palle, coni, porta', isCustom: false, createdAt: now
      },

      // ════════════════════════════ MEGA LIBRARY ════════════════════════════
      // RISCALDAMENTO (10)
      {
        id: randomUUID(), name: 'Psicocinesi con variazioni cromatiche', nameEn: 'Psychokinetic warmup with colour cues',
        category: 'riscaldamento',
        description: 'Griglia 20x20m con 4 zone colorate (coni colorati agli angoli). Giocatori si muovono liberamente palleggiando. Allenatore chiama un colore: tutti devono raggiungere la zona corrispondente entro 3 secondi mantenendo il controllo della palla. Progressione: doppia chiamata (zona+azione es. "rosso+colpo di testa"), poi chiamata inversa ("NON blu" = vanno ovunque tranne blu). Sviluppa orientamento spaziale, attenzione selettiva e coordinazione in movimento.',
        descriptionEn: 'Grid 20x20m with 4 colour zones. Players move freely juggling. Coach calls a colour: all must reach that zone within 3s keeping ball control. Progression: double call (zone+action), then inverse call.',
        primaryObjective: 'Sviluppare attenzione selettiva e orientamento spaziale sotto carico cognitivo durante il riscaldamento',
        secondaryObjectives: JSON.stringify(['Coordinazione oculo-podalica in movimento', 'Reattività agli stimoli visivi', 'Controllo palla in condizioni di pressione temporale', 'Comunicazione non verbale tra compagni']),
        duration: 12, players: 12, intensity: 'media', materials: 'palle (1 per giocatore), coni colorati (4 colori)', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Circuito mobilità articolare con palla', nameEn: 'Articular mobility circuit with ball',
        category: 'riscaldamento',
        description: 'Percorso lineare 30m con 6 stazioni: (1) skip basso con palleggio piede-coscia alternato; (2) corsa laterale con tocchi laterali della palla; (3) affondi frontali con palla tenuta sopra la testa; (4) rotazione busto 90° con passaggio a specchio contro tabellone; (5) mobilità anca "gate opener" poi sprint su 5m; (6) stretching dinamico ischio-crurali con palla tra le mani. 3 giri con pausa 90". Lavoro complementare a qualsiasi sessione.',
        descriptionEn: '30m linear course, 6 stations: skip-juggle, lateral run with ball touches, lunges with ball overhead, torso rotation passes, hip gate openers+sprint, dynamic hamstring stretch.',
        primaryObjective: 'Preparare le catene muscolari del calciatore attraverso mobilità articolare progressiva con la palla',
        secondaryObjectives: JSON.stringify(['Prevenzione infortuni muscolari', 'Attivazione propriocettiva', 'Coordinazione segmentaria', 'Riscaldamento specifico per il calcio']),
        duration: 18, players: 16, intensity: 'bassa', materials: 'palle, coni, tabellone rimbalzo (opzionale)', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Rondo 4+2vs2 a tema uscita', nameEn: 'Rondo 4+2vs2 with exit theme',
        category: 'riscaldamento',
        description: 'Quadrato 12x12m. 4 giocatori esterni + 2 jolly centrali vs 2 pressatori. Il possesso vale 1 punto; se i 2 jolly ricevono e si girano superando la linea opposta = 2 punti (simulazione uscita dalla pressione). Turni da 3 minuti, rotazione pressatori. Vincolo progressivo: prima libero, poi massimo 2 tocchi per esterni e tocco singolo per jolly. Esercitazione usata dal Barcellona B e dal Bayer Leverkusen come attivazione tattico-tecnica.',
        descriptionEn: '12x12m square. 4 outer players + 2 jokers vs 2 pressers. Possession = 1pt; jokers turn and cross line = 2pts. 3-min rounds. Constraint progression: free → max 2 touches → 1 touch jokers.',
        primaryObjective: 'Attivare meccanismi di possesso e uscita dalla pressione in forma giocata durante il riscaldamento',
        secondaryObjectives: JSON.stringify(['Velocità di gioco 1-2 tocchi', 'Orientamento del corpo per giocare in avanti', 'Pressing coordinato in coppia', 'Transizione da difesa ad attacco']),
        duration: 15, players: 8, intensity: 'media', materials: 'palla, coni (quadrato 12x12)', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Activación dinámica FIFA 11+', nameEn: 'FIFA 11+ Dynamic Activation Protocol',
        category: 'riscaldamento',
        description: 'Protocollo FIFA 11+ adattato al calcio di campo: (1) corsa lenta 8 minuti con variazioni (laterale, incrociato, salto, sprint); (2) 6 esercizi di forza e stabilità: piegamenti nordici, Copenhagen plank laterale, squat monopodalico su 3 serie; (3) corsa con accelerazioni progressive 60-80-100%. Ogni fase ha indicatori di qualità esecutiva da monitorare. Riduce del 30-50% il rischio infortuni se eseguito sistematicamente (studi FIFA/UEFA 2014-2022).',
        descriptionEn: 'FIFA 11+ protocol adapted for field football: slow run with variations, 6 strength/stability exercises (Nordic curls, Copenhagen plank, single-leg squat), progressive acceleration runs.',
        primaryObjective: 'Ridurre il rischio di infortuni muscolari e legamentosi attraverso il protocollo scientifico FIFA 11+',
        secondaryObjectives: JSON.stringify(['Attivazione muscoli stabilizzatori', 'Forza eccentrica ischio-crurali', 'Propriocezione caviglia e ginocchio', 'Cultura della prevenzione nel gruppo']),
        duration: 20, players: 16, intensity: 'bassa', materials: 'palle, coni, ostacoli bassi', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Futebol de esquema — riscaldamento brasiliano', nameEn: 'Brazilian scheme football warmup',
        category: 'riscaldamento',
        description: 'Metodo di riscaldamento ispirato alla Seleção Brasileira: coppie a 10m si scambiano la palla in sequenze codificate. Schema A: interno-esterno-tacco-colpo di testa. Schema B: triangolo con terzo uomo in movimento. Schema C: dai e vai con finta nel mezzo. Ogni schema dura 3 minuti. Nessuna pausa tra schemi, solo cambio ritmo. Finalità: attivazione tecnica profonda, riscaldamento mentale e senso del ritmo collettivo.',
        descriptionEn: 'Pairs at 10m exchanging ball in coded sequences. Scheme A: inside-outside-heel-header. Scheme B: triangle with moving third man. Scheme C: give-and-go with feint. 3 min each scheme.',
        primaryObjective: 'Attivare tecnica individuale e senso del ritmo collettivo attraverso sequenze codificate brasiliane',
        secondaryObjectives: JSON.stringify(['Tocco di prima intenzione', 'Temporizzazione del movimento senza palla', 'Colpo di testa tecnico', 'Senso del ritmo collettivo']),
        duration: 12, players: 14, intensity: 'media', materials: 'palle (1 ogni 2 giocatori), coni', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Labirinto cognitivo con numerazione', nameEn: 'Cognitive labyrinth with numbering',
        category: 'riscaldamento',
        description: 'Griglia 15x15m con 8 coni numerati disposti casualmente. Giocatori in palleggio individuale devono toccare i coni in ordine crescente (1→8) poi decrescente. Progressione 1: toccano con piede destro i dispari e sinistro i pari. Progressione 2: allenatore chiama "+2" e devono sommare (es. partono da 3, vanno a 5, poi 7). Progressione 3: con un compagno, uno tocca pari e l\'altro dispari, comunicandosi la sequenza. Esercizio ispirato al metodo cognitivo di Marcelo Bielsa.',
        descriptionEn: 'Grid with 8 numbered cones. Players juggle and touch cones in ascending/descending order. Progressions: foot-number pairing, mental arithmetic, partner coordination.',
        primaryObjective: 'Attivare le funzioni cognitive superiori (calcolo, memoria di lavoro, attenzione divisa) durante il riscaldamento',
        secondaryObjectives: JSON.stringify(['Controllo palla automatizzato', 'Orientamento spaziale', 'Comunicazione tra compagni', 'Doppio compito motorio-cognitivo']),
        duration: 10, players: 12, intensity: 'bassa', materials: 'palle (1 per giocatore), coni numerati 1-8', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Riscaldamento differenziato per ruolo', nameEn: 'Role-specific differentiated warmup',
        category: 'riscaldamento',
        description: 'Tre stazioni simultanee specializzate per ruolo: DIFENSORI (coni 1-6): scivolate laterali + marcatura sull\'uomo + colpi di testa difensivi in coppia. CENTROCAMPISTI (coni 7-12): ricezione con orientamento + passaggio filtrante + transizione. ATTACCANTI (coni 13-18): controllo-tiro + stop-e-gira + 1vs1 contro portiere. Rotazione ogni 6 minuti. Ultimo blocco (5 min): assembramento con palla in gioco libero. Massimizza specificità del riscaldamento per posizione.',
        descriptionEn: 'Three simultaneous role-specific stations. Defenders: lateral slides, marking, defensive headers. Midfielders: oriented reception, through balls, transition. Attackers: control-shot, turn, 1v1.',
        primaryObjective: 'Preparare ogni ruolo con gesti tecnico-tattici specifici per massimizzare la qualità dell\'allenamento successivo',
        secondaryObjectives: JSON.stringify(['Specificità del riscaldamento per ruolo', 'Efficienza del tempo di sessione', 'Attivazione mentale contestuale', 'Interazione GK-difensori-attaccanti']),
        duration: 22, players: 16, intensity: 'media', materials: 'palle multiple, coni, porte piccole', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Passing square a 4 con incrocio', nameEn: 'Passing square of 4 with crossing runs',
        category: 'riscaldamento',
        description: 'Quadrato 10x10m, un giocatore per angolo + una riserva per lato. Sequenza fissa: A passa a B, A va in diagonale al posto di C, C parte al posto di B, B passa a D appena A ha incrociato. Movimento continuo senza stop. 4 varianti: (1) di prima; (2) con controllo orientato; (3) con finta prima del passaggio; (4) con sovrapposizione esterna. Usato dal Valencia CF e dal Benfica come attivatore tecnico pre-sessione.',
        descriptionEn: '10x10m square. Fixed sequence: pass and diagonal run crossing with teammates. 4 variants: first touch, oriented control, feint before pass, overlap.',
        primaryObjective: 'Attivare meccanismi di movimento senza palla sincronizzati con il passaggio attraverso schemi codificati',
        secondaryObjectives: JSON.stringify(['Timing del movimento', 'Passaggio preciso in movimento', 'Comunicazione non verbale', 'Automatismi combinativi']),
        duration: 10, players: 8, intensity: 'media', materials: 'palle, coni (quadrato 10x10)', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Obstacle course con palla al piede', nameEn: 'Ball at feet obstacle course',
        category: 'riscaldamento',
        description: 'Percorso 25m: (1) dribbling slalom 6 coni stretti (passo); (2) tunnel sotto birilli alti con la palla; (3) saltelli laterali su linea mantenendo palla incollata al piede; (4) stop su segnale visivo (allenatore alza cartellino colorato); (5) passaggio a bersaglio (cerchio a terra 3m). Eseguito a coppie in competizione cronometrata. Il perso fa 10 flessioni. Gamification del riscaldamento: aumenta motivazione e intensità nella fase di attivazione.',
        descriptionEn: '25m course: slalom dribble, low tunnel, lateral hops with ball, visual stop signal, target pass. Done in timed pairs. Loser does 10 push-ups. Gamified warmup.',
        primaryObjective: 'Elevare l\'intensità motivazionale del riscaldamento attraverso competizione cronometrata con la palla al piede',
        secondaryObjectives: JSON.stringify(['Dribbling in velocità', 'Reattività agli stimoli visivi', 'Controllo palla ad alta intensità', 'Spirito competitivo']),
        duration: 14, players: 16, intensity: 'media', materials: 'palle, coni, birilli, cartellini colorati', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Tic-tac-toe umano con palla', nameEn: 'Human tic-tac-toe with ball',
        category: 'riscaldamento',
        description: 'Griglia 3x3 di cerchi a terra (o coni) distanziati 3m l\'uno dall\'altro. Due squadre di 4 (uno in panchina). A turno un giocatore prende una palla, esegue 5 palleggi e poi occupa un cerchio. Vince chi fa tris. Regola: non si può stare fermo — chi è in campo deve sempre muoversi sul posto. Chi sbaglia il palleggio (palla a terra) deve tornare in fondo e rimandare il compagno. Sviluppa attenzione tattica, palleggio sotto pressione e spirito di squadra.',
        descriptionEn: '3x3 grid of circles. Teams alternate: player does 5 juggles then occupies a circle. First to get three in a row wins. Players in field must keep moving. Drop ball = restart.',
        primaryObjective: 'Sviluppare attenzione tattica e palleggio sotto pressione in forma ludico-competitiva',
        secondaryObjectives: JSON.stringify(['Palleggio controllato', 'Pensiero strategico', 'Comunicazione tra compagni', 'Spirito di squadra']),
        duration: 10, players: 8, intensity: 'bassa', materials: 'palle, coni o cerchi a terra (9)', isCustom: false, createdAt: now
      },

      // TECNICA (12)
      {
        id: randomUUID(), name: 'Controllo orientato Coerver avanzato', nameEn: 'Advanced Coerver oriented control',
        category: 'tecnica',
        description: 'Metodologia Coerver applicata al controllo orientato. Coppie a 15m con 2 coni separati 2m davanti ad ogni giocatore (porta di controllo). A calcia verso B — B deve controllare passando attraverso uno dei due coni (scelta in base al colore che A indica con la mano al momento del passaggio). Progressioni: (1) controllo + passaggio di prima verso terzo uomo; (2) controllo + dribbling verso porta piccola; (3) controllo + finta Cruyff + tiro. L\'orientamento del corpo prima di ricevere è il focus principale.',
        descriptionEn: 'Coerver method for oriented control. Pairs at 15m with 2-cone gate. A passes to B — B controls through one cone based on A\'s hand signal. Progressions: control+layoff, control+dribble to mini-goal, control+Cruyff turn+shot.',
        primaryObjective: 'Automatizzare il controllo orientato con scelta pre-cognitiva del lato, fondamentale per il gioco rapido',
        secondaryObjectives: JSON.stringify(['Postura del corpo in ricezione', 'Lettura del segnale visivo ante-ricezione', 'Transizione controllo-azione', 'Velocità di decisione']),
        duration: 20, players: 10, intensity: 'media', materials: 'palle, coni (porte 2m), porte piccole', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Wall passing a specchio — 1000 tocchi', nameEn: 'Mirror wall passing — 1000 touches',
        category: 'tecnica',
        description: 'Esercitazione individuale con tabellone rimbalzo (o muro). Protocollo: (1) passaggi interni 30 secondi dx; (2) passaggi interni 30s sx; (3) interni alternati; (4) esterni dx; (5) esterni sx; (6) alternati dx-sx; (7) punta del piede; (8) tacco; (9) ginocchio; (10) testa. 3 serie complete. Obiettivo: ~1000 tocchi per sessione. Usato da Ronaldo (Fenomeno) e ribattezzato nel calcio moderno come "paredes" dai tecnici spagnoli. Sviluppa sensibilità del tocco e automatismo del gesto.',
        descriptionEn: 'Individual wall-passing protocol: 10 surfaces (inside R/L, alternate, outside R/L, alternate, toe, heel, knee, head). 30s each, 3 sets. Target ~1000 touches per session.',
        primaryObjective: 'Costruire automatismo e sensibilità del tocco su tutte le superfici del piede attraverso volume di ripetizioni',
        secondaryObjectives: JSON.stringify(['Tecnica del passaggio con interni', 'Coordinazione bilaterale piede debole', 'Controllo anticipato', 'Disciplina e concentrazione individuale']),
        duration: 25, players: 1, intensity: 'media', materials: 'palla, tabellone rimbalzo o muro', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Dribbling 1vs1 con porta laterale', nameEn: '1v1 dribbling with lateral mini-goal',
        category: 'tecnica',
        description: 'Corridoio 10x5m. Attaccante parte con palla dal lato corto, difensore affronta in posizione difensiva. Due porte piccole (1.5m) sui lati lunghi. L\'attaccante deve dribblare e segnare in una delle porte laterali; il difensore deve indirizzare verso il lato sbagliato e recuperare. Rotazione ogni 2 minuti. Progressione: attaccante deve toccare il cono centrale prima di attaccare la porta; poi divieto di usare la mano debole (forza l\'uso del piede non dominante).',
        descriptionEn: '10x5m corridor. Attacker starts with ball vs defender. Two mini-goals on long sides. Attacker dribbles to score on either side. Progression: touch center cone first; then weak-foot only.',
        primaryObjective: 'Sviluppare la capacità di superare l\'uomo in spazi stretti con cambi di direzione esplosivi e lettura del difensore',
        secondaryObjectives: JSON.stringify(['Cambio di direzione con palla', 'Lettura del centro di gravità del difensore', 'Accelerazione post-dribbling', 'Piede debole in conduzione']),
        duration: 18, players: 2, intensity: 'alta', materials: 'palla, coni, 2 porte piccole 1.5m', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Passaggio filtrante in corsa — linee spezzate', nameEn: 'Through pass in motion — broken lines',
        category: 'tecnica',
        description: 'Tre linee parallele di coni a 10m l\'una dall\'altra. Giocatore A è sulla linea 1, B sulla linea 2 (di lato), C sulla linea 3 (di fronte). A passa filtrante a C che scatta tra due coni della linea 2 (corridoio 3m); B deve aver già liberato il corridoio con finta verso l\'esterno. C controlla, gira e passa a B che è entrato in corsa. B finalizza. Sequenza rotante ogni 3 azioni. Sviluppa timing del passaggio filtrante, movimento senza palla e finalizzazione.',
        descriptionEn: 'Three parallel cone lines 10m apart. A plays through ball to C cutting between line-2 cones (B clears with decoy run). C controls, turns, passes to B running in. B finishes.',
        primaryObjective: 'Affinare il passaggio filtrante temporizzato con movimento senza palla coordinato e finalizzazione',
        secondaryObjectives: JSON.stringify(['Qualità del filtrante in corsa', 'Timing del taglio', 'Finta per liberare corridoio', 'Finalizzazione dopo ricezione in corsa']),
        duration: 20, players: 9, intensity: 'media', materials: 'palle, coni, porta', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Colpo di testa — circuito a 5 stazioni', nameEn: 'Heading circuit — 5 stations',
        category: 'tecnica',
        description: 'Circuito 5 stazioni (2 min ciascuna, riposo 30"): (1) testa a rimbalzo contro muro a 3m — continuità ritmica; (2) cross basso → salto di anticipo → testata verso porta; (3) colpo di testa difensivo di allontanamento da pallone alzato da compagno; (4) duello aereo 1vs1 su cross del mister; (5) gioco di testa a coppie in spazio 5x5m (no piedi). Focus tecnico: uso del collo, apertura occhi, timing del salto, rotazione del busto.',
        descriptionEn: '5-station heading circuit (2 min each, 30" rest): wall-bounce continuity, cross-jump-header to goal, defensive clearance header, aerial 1v1 on cross, head-only 5v5.',
        primaryObjective: 'Sviluppare la tecnica del colpo di testa in tutte le sue varianti: offensivo, difensivo, di deviazione e duello aereo',
        secondaryObjectives: JSON.stringify(['Timing del salto', 'Uso corretto del collo', 'Colpo di testa difensivo di allontanamento', 'Duello aereo 1vs1']),
        duration: 20, players: 14, intensity: 'alta', materials: 'palle, coni, porta, muro/tabellone', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Tiro in caduta — volée e rovesciata tecnica', nameEn: 'Falling shot — volley and bicycle kick technique',
        category: 'tecnica',
        description: 'Esercitazione progressiva per finalizzatori: (1) tiro di volée frontale su pallone alzato dal compagno a 1m — focus su piede di appoggio e superficie di contatto; (2) volée di mezza altezza con approccio laterale; (3) volée di esterno con aggancio sulla linea d\'area; (4) rovesciata tecnica su pallone alzato lentamente a 1.5m dal petto (solo tecnica, nessun rischio fisico). Materassino protettivo per rovesciate. Ogni giocatore 5 tentativi per variante.',
        descriptionEn: 'Progressive finishing: frontal volley on raised ball, half-volley from side, outside-foot volley, bicycle kick on slow-raised ball. Mat for bicycle kicks. 5 attempts per variant.',
        primaryObjective: 'Sviluppare il tiro di prima intenzione su palla alta nelle sue varianti tecniche avanzate',
        secondaryObjectives: JSON.stringify(['Tecnica della volée frontale', 'Coordinazione con appoggio', 'Coraggio tecnico', 'Rovesciata tecnica in sicurezza']),
        duration: 22, players: 8, intensity: 'media', materials: 'palle, porta, materassino, allenatore alzatore', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Triangolo tecnico con terzo uomo', nameEn: 'Technical triangle with third man run',
        category: 'tecnica',
        description: 'Tre giocatori in triangolo isoscele (10-8-8m). A passa a B, A parte in diagonale verso il vertice opposto. B controlla orientato verso C, passa a C. C vede A in corsa e gioca filtrante per A che finalizza. Rotazione: B diventa A, C diventa B, A (finita corsa) diventa C. 4 varianti: (1) tutto di prima; (2) B finta + gioca; (3) doppio passaggio A-B prima del triangolo; (4) con pressatore sul terzo uomo.',
        descriptionEn: 'Triangle 10-8-8m. A passes to B, A runs diagonal. B controls-turns, passes to C. C sees A running and plays through ball for A to finish. 4 variants: first touch, feint, double pass, with presser.',
        primaryObjective: 'Automatizzare i meccanismi del triangolo con corsa del terzo uomo e filtrante temporizzato',
        secondaryObjectives: JSON.stringify(['Controllo orientato in ricezione', 'Timing della corsa del terzo uomo', 'Passaggio filtrante preciso', 'Finalizzazione in corsa']),
        duration: 18, players: 9, intensity: 'media', materials: 'palle, coni, porta', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Cross e finalizzazione 3 zone', nameEn: 'Crossing and finishing — 3 zone attack',
        category: 'tecnica',
        description: 'Mezza campo con 3 attaccanti posizionati in zona (primo palo, punto di rigore, secondo palo). Crossatore parte dalla fascia, sceglie cross rasoterra, teso o alto. I tre attaccanti interpretano la traiettoria e uno attacca il pallone. Gli altri due devono comunque muoversi per non essere marcabili. Progressione: aggiunta di 2 difensori passivi → semi-attivi → attivi. Variante: crossatore può anche accentrarsi e tirare (intenzione doppia).',
        descriptionEn: 'Half-field. 3 attackers in zones (near post, penalty spot, far post). Crosser chooses type of cross (ground, driven, high). Attackers read trajectory. Progression: 0 → 2 passive → active defenders.',
        primaryObjective: 'Sviluppare la tecnica del cross e la lettura delle traiettorie aeree da parte dei finalizzatori',
        secondaryObjectives: JSON.stringify(['Tecnica del cross (3 varianti)', 'Lettura della traiettoria aerea', 'Attacco al primo e secondo palo', 'Movimento degli attaccanti sul cross']),
        duration: 20, players: 7, intensity: 'alta', materials: 'palle multiple, porta, coni di zona', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Stop e tiro da fuori area — tecnica del destro e sinistro', nameEn: 'Control and shoot from outside — both feet',
        category: 'tecnica',
        description: 'Mezzaluna fuori area. Giocatore riceve da centrocampista a 20m, controlla con piede debole e tira con piede forte (o viceversa). Progressione: (1) palla ferma; (2) palla in movimento trasversale; (3) palla in movimento frontale; (4) con pressatore alle spalle. Tecnica del tiro: inclinazione del busto, piede d\'appoggio, impatto sul pallone, follow-through. Variante del mister Guardiola: dopo il tiro il giocatore sprinta verso l\'area per il rebound. 8 tentativi per piede.',
        descriptionEn: 'Outside area crescent. Player receives, controls weak foot, shoots strong foot (or reverse). Progressions: static ball, lateral movement, frontal movement, presser behind. 8 attempts per foot.',
        primaryObjective: 'Sviluppare il tiro da fuori area con entrambi i piedi preceduto da controllo orientato sotto pressione',
        secondaryObjectives: JSON.stringify(['Tecnica del tiro in corsa', 'Controllo con piede debole', 'Piede d\'appoggio e inclinazione busto', 'Rebound e seconda palla']),
        duration: 25, players: 12, intensity: 'alta', materials: 'palle multiple, porta, coni mezzaluna', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Conduzione di velocità e cambio di passo', nameEn: 'Speed dribbling and change of pace',
        category: 'tecnica',
        description: 'Corridoio 40m con 3 zone: zona A (0-15m) conduzione veloce a piede aperto verso esterno; zona B (15-25m) finta e cambio di direzione a 90°; zona C (25-40m) accelerazione esplosiva con palla al piede verso porta. Confronto cronometrato in coppia. Focus tecnico: (1) tocchi lunghi in velocità (non corti); (2) punto di attacco nella finta — spostamento peso prima del cambio; (3) accelerazione post-cambio: primo tocco allungato.',
        descriptionEn: '40m corridor in 3 zones: fast open-foot dribble, feint + 90° direction change, explosive acceleration to goal. Timed in pairs. Technical focus: long touches at speed, weight shift in feint, lengthened first touch post-change.',
        primaryObjective: 'Sviluppare la conduzione di velocità con cambio di passo e cambio di direzione in contesto di accelerazione',
        secondaryObjectives: JSON.stringify(['Conduzione a piede aperto in velocità', 'Tecnica della finta con cambio di peso', 'Accelerazione esplosiva post-cambio', 'Coordinazione in velocità massima']),
        duration: 20, players: 14, intensity: 'alta', materials: 'palle, coni, birilli, porta', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Palla lunga e controllo — lancio del portiere', nameEn: 'Long ball and control — goalkeeper distribution',
        category: 'tecnica',
        description: 'Il portiere lancia lungo (rilancio con le mani o calcio di rinvio) verso l\'attaccante di riferimento posizionato a 40-50m. L\'attaccante deve: (1) orientarsi prima del lancio; (2) ricevere con petto/coscia per abbassare; (3) controllare con il piede e proteggere; (4) giocare in profondità per il compagno che taglia. Variante difensiva: aggiunta di un difensore che va in anticipo. Focus: la tecnica dell\'attaccante nel gioco aereo lungo — spesso trascurata negli allenamenti moderni.',
        descriptionEn: 'GK launches long ball to striker at 40-50m. Striker: orient before launch, receive with chest/thigh, control with foot, play forward for cutting teammate. Defensive variant: add one anticipating defender.',
        primaryObjective: 'Sviluppare la tecnica dell\'attaccante nel ricevere palla lunga: ricezione aerea, protezione e giocata successiva',
        secondaryObjectives: JSON.stringify(['Controllo del petto/coscia su palla alta', 'Protezione della palla sotto pressione', 'Orientamento prima della ricezione', 'Giocata rapida post-controllo']),
        duration: 18, players: 6, intensity: 'media', materials: 'palle, coni, porta, portiere', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Tecnica del pressing individuale — chiusura dello spazio', nameEn: 'Individual pressing technique — space closure',
        category: 'tecnica',
        description: 'Corridoio 15x8m. Un difensore, un attaccante con palla. Il difensore deve avvicinarsi al portatore entro 3 secondi (trigger: palla ricevuta) con corsa orientata — non frontale ma diagonale per chiudere il lato forte. Tecnica del recupero: (1) corsa di avvicinamento rapida ma con rallentamento negli ultimi 3m; (2) baricentro basso; (3) piede di punta verso la palla; (4) spostamento laterale reattivo. L\'attaccante può muoversi solo nel corridoio.',
        descriptionEn: '15x8m corridor. Defender must close attacker within 3s using diagonal approach run (not frontal). Technique: fast approach, slow last 3m, low center of gravity, toe toward ball, reactive lateral shuffle.',
        primaryObjective: 'Insegnare la tecnica corretta del pressing individuale: approccio diagonale, distanza di sicurezza e baricentro',
        secondaryObjectives: JSON.stringify(['Approccio diagonale al portatore', 'Rallentamento di controllo negli ultimi metri', 'Baricentro basso e piede di punta', 'Lettura del peso dell\'attaccante']),
        duration: 16, players: 8, intensity: 'alta', materials: 'palle, coni (corridoio 15x8)', isCustom: false, createdAt: now
      },

      // TATTICA (12)
      {
        id: randomUUID(), name: 'Costruzione bassa dal portiere 3+GK vs 2', nameEn: 'Low build-up from GK 3+GK vs 2',
        category: 'tattica',
        description: 'Metà campo difensiva. GK + 3 difensori (linea a tre) vs 2 pressatori alti. Obiettivo: uscire dalla pressione e raggiungere la linea di centrocampo (coni) con almeno 5 passaggi. I difensori devono aprirsi largo, il GK decide quando e se entrare nel giro palla. Trigger del pressing avversario: lancio del mister ai 2 pressatori. Progressione: aggiunta di un centrocampista d\'appoggio (4+GK vs 2+1 centrocampista avversario).',
        descriptionEn: 'Half defensive field. GK + 3 defenders vs 2 high pressers. Objective: exit pressure and reach midfield line with 5+ passes. GK decides when to join circulation. Progression: add a supporting midfielder.',
        primaryObjective: 'Sviluppare la costruzione bassa dal portiere con linea a tre contro pressing alto a due',
        secondaryObjectives: JSON.stringify(['Posizionamento dei difensori in ampiezza', 'Ruolo del portiere nel giro palla', 'Uscita dalla pressione con passaggio preciso', 'Lettura del trigger di pressing avversario']),
        duration: 20, players: 8, intensity: 'media', materials: 'palle, coni, porta, portiere', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Transizione offensiva 5vs5+2 jolly', nameEn: 'Offensive transition 5v5+2 jokers',
        category: 'tattica',
        description: 'Campo 40x30m diviso in due metà. Fase difensiva in una metà (5vs5). Al recupero palla scatta la transizione offensiva: la squadra che recupera ha 6 secondi per varcare la linea di metà campo. Entrati nell\'altra metà si attivano 2 jolly neutrali per i possessori. Obiettivo: finalizzare entro 10 secondi dal recupero. Squadra che perde palla deve difendere con i 5 (senza jolly). Conta il tempo di transizione: bonus se gol in meno di 7 secondi.',
        descriptionEn: '40x30m field split in halves. 5v5 in defensive half. On recovery, attacking team has 6s to cross halfway. Past midfield: 2 neutral jokers activate. Score within 10s of recovery. Timed bonus.',
        primaryObjective: 'Sviluppare la velocità e la verticalità della transizione offensiva: da difesa ad attacco entro 10 secondi',
        secondaryObjectives: JSON.stringify(['Reazione immediata al recupero palla', 'Verticalità nella transizione', 'Uso del jolly per creare superiorità numerica', 'Finalizzazione rapida']),
        duration: 25, players: 12, intensity: 'alta', materials: 'palle, coni, 2 porte', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Pressing a zona — trigger e compattezza', nameEn: 'Zonal pressing — trigger and compactness',
        category: 'tattica',
        description: 'Campo 60x40m. 6vs6 con 2 portieri. Si stabilisce 1 trigger di pressing (es. retropassaggio al portiere avversario o ricevuta in fascia dal terzino in posizione chiusa). Al trigger, tutta la squadra avanza di 10-15m in blocco compatto. Obiettivo: recupero entro 6 secondi nel 1/3 campo avversario o allontanamento della palla. Se avversario supera il pressing: tutti rientrano velocemente. Basato sulla metodologia del Napoli di Sarri 2017-18.',
        descriptionEn: '60x40m, 6v6+GKs. One pre-defined pressing trigger (e.g. backpass to GK or tight flank receive). On trigger: whole team advances 10-15m in compact block. Goal: win ball in 6s or clear. Debrief: who saw trigger?',
        primaryObjective: 'Sviluppare il pressing coordinato a zona con trigger definito, mantenendo la compattezza del blocco squadra',
        secondaryObjectives: JSON.stringify(['Riconoscimento del trigger di pressing', 'Avanzamento in blocco compatto', 'Pressing ultra-offensivo nel terzo campo avversario', 'Comunicazione e scalamento difensivo']),
        duration: 25, players: 14, intensity: 'alta', materials: 'palle, coni, 2 porte, portieri', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Superiorità numerica in zona: 3vs2+1', nameEn: 'Numerical superiority in zone: 3v2+1',
        category: 'tattica',
        description: 'Zona 20x15m. Tre attaccanti vs 2 difensori + 1 centrocampista difensivo. Gli attaccanti devono creare e sfruttare la superiorità numerica (3vs2) prima che il centrocampista li raggiunga (tempo massimo 5 secondi). Principi: (1) riconoscere chi è libero tra i 3; (2) giocare sulla difesa più lontana dal centrocampista; (3) muovere velocemente per non dare tempo al recupero. Progressione: 4vs3, poi 4vs3+1.',
        descriptionEn: '20x15m zone. 3 attackers vs 2 defenders + 1 covering midfielder. Attackers must exploit 3v2 before midfielder arrives (max 5s). Principles: identify free man, play away from cover, quick movement.',
        primaryObjective: 'Allenare il riconoscimento e lo sfruttamento della superiorità numerica in zona prima che il coperturista intervenga',
        secondaryObjectives: JSON.stringify(['Lettura della superiorità numerica', 'Velocità di circolazione palla', 'Movimento senza palla per liberare spazi', 'Decisione rapida del portatore']),
        duration: 18, players: 9, intensity: 'alta', materials: 'palle, coni (zona 20x15), porte piccole', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Difesa della profondità — linea alta e offside', nameEn: 'Depth defence — high line and offside trap',
        category: 'tattica',
        description: 'Campo 60x40m. Linea difensiva a 4 vs 3 attaccanti + centrocampista di supporto. La difesa lavora ad una linea alta (a 40m dalla propria porta). Allenatore lancia palla lunga per l\'attaccante di punta: la linea deve avanzare compatta al momento del lancio (non prima, non dopo) per intrappolare in fuorigioco. Trigger: momento del backswing del piede del lanciatore. Progressione: aggiunta di attaccante che parte in corsa; poi con terzini che possono scappare.',
        descriptionEn: '60x40m. 4-man defensive line vs 3 attackers + support. Line is set high (40m from own goal). Coach plays long ball: line must advance in sync at kick moment to trap offside. Progression: runner, then escaping fullbacks.',
        primaryObjective: 'Sviluppare la gestione della linea difensiva alta con trappola del fuorigioco sincronizzata al momento del lancio',
        secondaryObjectives: JSON.stringify(['Sincronizzazione della linea difensiva', 'Lettura del momento di avanzamento', 'Comunicazione tra i 4 difensori', 'Gestione dello spazio alle spalle']),
        duration: 20, players: 10, intensity: 'media', materials: 'palle, coni, porta, portiere', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Possesso con cambio di fronte obbligatorio', nameEn: 'Possession with mandatory switch of play',
        category: 'tattica',
        description: 'Campo 40x30m. 7vs5 con 2 portieri di rimessa sui lati. Regola: prima di poter segnare nella porta piccola, la squadra in possesso deve aver completato almeno 1 cambio di fronte (passaggio orizzontale di almeno 20m). I 5 difensori devono spostarsi lateralmente seguendo la palla. Se lo spostamento non è simultaneo al cambio = punti bonus per l\'attacco. Allena: ampiezza offensiva, cambio di fronte come principio, pressione laterale difensiva.',
        descriptionEn: '40x30m, 7v5+2 side GKs. Rule: must complete 1 switch of play (20m+ horizontal pass) before scoring. Defenders must shift laterally with ball. Simultaneous shift failure = bonus point for attack.',
        primaryObjective: 'Automatizzare il cambio di fronte come strumento per spostare il blocco difensivo e creare spazi sul lato debole',
        secondaryObjectives: JSON.stringify(['Ampiezza offensiva', 'Cambio di fronte preciso su distanza', 'Spostamento laterale del blocco difensivo', 'Riconoscimento del lato debole']),
        duration: 22, players: 12, intensity: 'alta', materials: 'palle, coni, 4 porte piccole', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Mezzala in proiezione offensiva — inserimento sul 3-5-2', nameEn: 'Mezzala in offensive projection — 3-5-2 insertion',
        category: 'tattica',
        description: 'Mezza campo. Schieramento 3-5-2 in fase offensiva. La mezzala (uno dei due centrocampisti laterali) deve inserirsi tra terzino e centrale avversario quando il terzino alto sale sulla fascia. Meccanismo: (1) terzino alto verticalizza o crossa; (2) la mezzala parte in corsa al momento del passaggio al terzino alto; (3) arriva in area sull\'eventuale respinta. Timing fondamentale: troppo presto = offside; troppo tardi = fuori dall\'azione. Ripetuto 15 volte per lato.',
        descriptionEn: '3-5-2 offensive setup. Mezzala inserts between fullback and CB when high wingback overlaps. Mechanism: wingback plays forward, mezzala runs on the pass, arrives in area on clearance. Timing drill × 15 each side.',
        primaryObjective: 'Automatizzare l\'inserimento della mezzala in proiezione offensiva nel 3-5-2 con timing corretto rispetto al terzino alto',
        secondaryObjectives: JSON.stringify(['Timing dell\'inserimento', 'Lettura del movimento del terzino alto', 'Arrivo in area sull\'eventuale respinta', 'Collaborazione mezzala-terzino alto']),
        duration: 20, players: 11, intensity: 'alta', materials: 'palle, coni, porta, portiere', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Pressing coordinato in 4-4-2 — blocco mediano', nameEn: 'Coordinated pressing in 4-4-2 — medium block',
        category: 'tattica',
        description: 'Campo intero. Il 4-4-2 difende a blocco medio (tra le due linee di metà campo e area). Principi: (1) le due punte pressano i centrali difensivi avversari quando ricevono; (2) i centrocampisti scalano sul lato della palla; (3) i terzini salgono sul terzino avversario solo se la palla è sulla loro fascia. Trigger di compressione: retropassaggio al centrale avversario. Allenatore distribuisce palla agli avversari in schemi predefiniti, il 4-4-2 deve adattarsi.',
        descriptionEn: 'Full field. 4-4-2 medium block. Principles: 2 strikers press CBs on receive, midfielders shift ball-side, fullbacks step up only on their flank. Trigger: backpass to opponent CB. Coach distributes in set patterns.',
        primaryObjective: 'Sviluppare il pressing coordinato del 4-4-2 a blocco medio con scalamenti corretti delle due linee',
        secondaryObjectives: JSON.stringify(['Scalamento della linea di centrocampo', 'Compressione laterale', 'Trigger di pressing sulle retropassaggi', 'Compattezza verticale tra le due linee']),
        duration: 25, players: 14, intensity: 'alta', materials: 'palle, coni, 2 porte, portieri', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Fase offensiva 4-3-3 — attacco alla profondità della seconda punta', nameEn: '4-3-3 offensive phase — second striker depth attack',
        category: 'tattica',
        description: 'Mezza campo offensiva. Il 4-3-3 costruisce dal basso con terzini alti. Il centravanti fissa i centrali avversari. Il trequartista/seconda punta (ala dentro) deve inserirsi in profondità tra terzino e centrale avversario nel momento in cui la mezzala esterna riceve in spazio. Meccanismo codificato: (1) mezzala riceve con campo aperto; (2) seconda punta taglia in profondità diagonale; (3) mezzala serve in profondità o triangola col centravanti. Ripetuto 10 volte per lato.',
        descriptionEn: '4-3-3 half-field attack. CF pins CBs. Second striker (inside winger) runs in depth between fullback and CB when wide midfielder receives in space. Mechanism × 10 each side. Key Ajax/Ten Hag mechanism.',
        primaryObjective: 'Automatizzare il taglio in profondità della seconda punta nel 4-3-3 sfruttando la ricezione della mezzala esterna',
        secondaryObjectives: JSON.stringify(['Timing del taglio diagonale', 'Lettura della ricezione della mezzala', 'Triangolo CF-seconda punta-mezzala', 'Finalizzazione in profondità']),
        duration: 20, players: 11, intensity: 'alta', materials: 'palle, coni, porta, portiere', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Zona mista 4-2-3-1 — transizione difensiva organizzata', nameEn: '4-2-3-1 mixed zone — organized defensive transition',
        category: 'tattica',
        description: 'Campo intero. Il 4-2-3-1 perde palla in fase offensiva (simulato dal mister). Trigger: fischio. La squadra deve organizzarsi in 4 secondi in un blocco di 8 (trequartista + ala lontana + 2 mediani + 4 difensori) coprendo il centro. Chi è più alto (punta + ala vicina) inizia il ripiegamento ma non deve sprecare energia: deve bloccare linee di passaggio. Principio: non inseguire ma bloccare. Dopo 4 secondi: pressing attivo.',
        descriptionEn: 'Full field. 4-2-3-1 loses ball (simulated). Trigger: whistle. Team must organize in 4s into 8-man block covering center. High players block passing lanes, don\'t chase. After 4s: active pressing.',
        primaryObjective: 'Sviluppare la transizione difensiva organizzata del 4-2-3-1: dalla perdita di palla al blocco difensivo in 4 secondi',
        secondaryObjectives: JSON.stringify(['Reazione immediata alla perdita di palla', 'Blocco delle linee di passaggio', 'Compattezza del blocco centrale', 'Coordinamento di squadra in transizione']),
        duration: 22, players: 14, intensity: 'alta', materials: 'palle, coni, 2 porte, portieri', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Gestione del vantaggio — rallentamento con possesso', nameEn: 'Lead management — slowdown through possession',
        category: 'tattica',
        description: 'Campo 40x30m. Squadra A con 1 gol di vantaggio, ultimi 15 minuti. Compito: mantenere il possesso senza rischiare. Principi tattici: (1) allargare il campo usando i terzini; (2) cercare sempre la superiorità numerica locale prima di passare; (3) non fare passaggi verticali rischiosi — solo orizzontali e indietro; (4) forzare l\'avversario ad inseguire e stancarsi. Squadra B deve recuperare con pressing alto urgente. Se A perde palla, -1 punto.',
        descriptionEn: 'Small-sided game simulating final 15 min with 1-goal lead. Team A must keep possession safely: widen field, seek local superiority, no risky vertical passes, force opponents to chase.',
        primaryObjective: 'Sviluppare la mentalità e i principi tattici per gestire un vantaggio attraverso il possesso palla sicuro',
        secondaryObjectives: JSON.stringify(['Allargamento del campo in gestione', 'Superiorità numerica locale obbligatoria', 'Passaggi sicuri orizzontali', 'Mentalità di gestione del risultato']),
        duration: 20, players: 12, intensity: 'media', materials: 'palle, coni, 2 porte', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Calcio d\'angolo difensivo — zona vs uomo', nameEn: 'Defensive corner kick — zone vs man marking',
        category: 'tattica',
        description: 'Ripetizione sistematica del calcio d\'angolo difensivo in doppio sistema: (A) ZONA — 4 difensori sulla linea del piccolo area, 2 sui pali, 2 sul limite area; trigger: palla calciata, tutti avanzano verso il punto di atterraggio. (B) UOMO — ogni difensore assegnato a marcatura specifica, più 1 libero. Confronto dei due sistemi sulla stessa squadra attaccante. 8 ripetizioni per sistema.',
        descriptionEn: 'Systematic defensive corner repetition in two systems. ZONE: 4 on small-area line + 2 on posts + 2 on edge, advance on kick. MAN: assigned marking + 1 free. Compare systems vs same attacking team. 8 reps each.',
        primaryObjective: 'Sviluppare e confrontare i due sistemi difensivi sui calci d\'angolo: zona pura vs marcatura a uomo',
        secondaryObjectives: JSON.stringify(['Posizionamento nel sistema a zona', 'Marcatura a uomo rigorosa', 'Gestione del secondo pallone', 'Analisi e confronto dei due sistemi']),
        duration: 25, players: 14, intensity: 'media', materials: 'palle, porta, portiere, coni di posizione', isCustom: false, createdAt: now
      },

      // ATLETICO (10)
      {
        id: randomUUID(), name: 'Sprint ripetuti RSA 30-15 con palla', nameEn: 'Repeated Sprint Ability 30-15 with ball',
        category: 'atletico',
        description: 'Protocollo RSA (Repeated Sprint Ability) adattato al calcio: 6 sprint da 30m con recupero 15 secondi passivi. 3 serie con 3 minuti di recupero tra serie. Ogni sprint: partenza da fermo, sprint puro 30m. Nella seconda serie: sprint con palla (conduzione rapida). Nella terza serie: sprint + passaggio terminale a compagno. Monitoraggio: confronto dei tempi di ogni sprint per misurare il decadimento prestativo.',
        descriptionEn: 'RSA protocol: 6×30m sprints with 15s passive recovery, 3 sets, 3 min between sets. Set 1: pure sprint. Set 2: sprint with ball. Set 3: sprint + terminal pass. Monitor time decay: if 4th sprint >6% slower than 1st, reduce volume.',
        primaryObjective: 'Sviluppare la capacità di sprint ripetuti (RSA) mantenendo alta la qualità del gesto ad ogni ripetizione',
        secondaryObjectives: JSON.stringify(['Velocità massimale', 'Recupero metabolico tra sprint', 'RSA con e senza palla', 'Monitoraggio del decadimento prestativo']),
        duration: 25, players: 16, intensity: 'massima', materials: 'coni 30m, cronometro, palle', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Forza esplosiva: salti pliometrici a circuito', nameEn: 'Explosive power: plyometric jump circuit',
        category: 'atletico',
        description: 'Circuito 6 stazioni pliometriche (45 secondi lavoro, 30 secondi recupero): (1) squat jump con massima elevazione; (2) box jump su plinto 40cm; (3) depth jump da plinto 30cm → countermovement jump; (4) lateral bounds (salti laterali monopodalici); (5) hurdle hop su 5 ostacoli bassi; (6) bounding progressivo su 20m. 2-3 circuiti completi. Indicazioni: atterraggio elastico (non rigido), massima potenza su ogni ripetizione.',
        descriptionEn: '6-station plyometric circuit (45s work, 30s rest): squat jump, box jump 40cm, depth jump, lateral bounds, hurdle hops, bounding 20m. 2-3 rounds. Elastic landing cue. Max 1×/week in-season.',
        primaryObjective: 'Sviluppare la forza esplosiva e la potenza del salto attraverso esercitazioni pliometriche progressive',
        secondaryObjectives: JSON.stringify(['Potenza del salto verticale', 'Stiffness tendinea', 'Forza reattiva del piede', 'Elasticità e rigidità muscolare']),
        duration: 25, players: 16, intensity: 'alta', materials: 'plinto 40cm e 30cm, 5 ostacoli bassi, coni', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Interval training Yo-Yo Test simulato', nameEn: 'Yo-Yo Intermittent Recovery Test simulation',
        category: 'atletico',
        description: 'Protocollo Yo-Yo Level 1 (Bangsbo): coppie di coni a 20m. Giocatori corrono avanti-indietro sui 20m seguendo segnale acustico progressivamente più veloce. 10 secondi di recupero attivo dopo ogni coppia di shuttle. Inizia a 10 km/h, accelera ogni livello (3 shuttle per livello). Fine del test: quando il giocatore non raggiunge il cono al segnale per 2 volte consecutive. Registra il livello raggiunto — baseline per monitorare la condizione aerobica stagionale.',
        descriptionEn: 'Yo-Yo Intermittent Recovery Level 1 (Bangsbo). 20m shuttle with progressive audio signal. 10s active recovery after each pair. Starts at 10 km/h. Test ends on 2 consecutive failures. Record level as seasonal aerobic baseline.',
        primaryObjective: 'Misurare e sviluppare la capacità aerobica intermittente specifica del calciatore attraverso il protocollo Yo-Yo',
        secondaryObjectives: JSON.stringify(['VO2max specifico del calcio', 'Resistenza intermittente', 'Baseline condizionale', 'Monitoraggio stagionale']),
        duration: 20, players: 16, intensity: 'massima', materials: 'coni 20m, segnale acustico Yo-Yo, cronometro', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Core stability calcistico — plank progressivo', nameEn: 'Football core stability — progressive plank',
        category: 'atletico',
        description: 'Circuito core specifico per il calcio: (1) plank frontale 45" con palleggio palla tra compagni; (2) plank laterale 30" per lato con sollevamento gamba superiore; (3) dead bug 10 ripetizioni; (4) Russian twist con palla da calcio 3×15; (5) roll-out con pallone sotto l\'addome (rotolamento avanti-indietro); (6) hollow hold 30". 2 giri. Focus: stabilità del core durante movimenti calcistici.',
        descriptionEn: 'Football-specific core circuit: plank with pass juggling, side plank with leg raise, dead bug, Russian twist with football, ab wheel rollout, hollow hold. 2 rounds.',
        primaryObjective: 'Sviluppare la stabilità del core nei pattern di movimento specifici del calcio per prevenzione infortuni e efficienza tecnica',
        secondaryObjectives: JSON.stringify(['Stabilità lombare sotto carico', 'Forza del core in posizione di gioco', 'Prevenzione lombalgia', 'Trasmissione di forza anca-tronco']),
        duration: 15, players: 16, intensity: 'media', materials: 'tappetini, compagni come ancora', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Agilità percettiva con stimolo visivo (Reactive Agility)', nameEn: 'Perceptual agility with visual stimulus (Reactive Agility)',
        category: 'atletico',
        description: 'Griglia 10x10m. Giocatore al centro. Allenatore (o compagno) a 5m tiene cartellini direzionali (freccia destra/sinistra/avanti/indietro). Al segnale visivo il giocatore sprinta nella direzione indicata e tocca il cono corrispondente. Variante 1: stimolo anticipato (allenatore si muove e il giocatore replica il suo primo passo). Variante 2: stimolo con doppia scelta (due allenatori, uno è il segnale corretto). Differenza vs COD: reazione a stimolo esterno non prevedibile.',
        descriptionEn: '10x10m grid. Player at center. Coach 5m away shows directional cards. Player sprints to corresponding cone. Variant 1: anticipation (replicate coach\'s first step). Variant 2: two coaches, one correct. True reactive agility, not programmed COD.',
        primaryObjective: 'Sviluppare l\'agility reattiva in risposta a stimoli visivi imprevedibili, distinta dalla semplice velocità di cambio di direzione',
        secondaryObjectives: JSON.stringify(['Tempo di reazione visivo-motoria', 'Agilità reattiva vs programmata', 'Lettura dei movimenti avversari', 'Velocità di first step']),
        duration: 18, players: 12, intensity: 'alta', materials: 'coni, cartellini direzionali o tablet', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Forza funzionale calcistica — circuito 6 stazioni', nameEn: 'Football functional strength — 6-station circuit',
        category: 'atletico',
        description: 'Circuito forza funzionale (40s lavoro, 20s recupero): (1) squat monopodalico con palla medica; (2) affondi laterali con palla in rotazione; (3) step-up su panchina con ginocchio alto e sprint 3m; (4) Copenhagen plank 30" per lato; (5) hip thrust con spalle su panchina; (6) salto su scatola + sprint 5m con palla. 3 giri completi. Obiettivo: forza dei glutei, stabilità del ginocchio, potenza monopodalica.',
        descriptionEn: '6-station functional strength circuit (40s work, 20s rest): single-leg squat + med ball, lateral lunge with rotation, step-up + high knee + 3m sprint, Copenhagen plank, hip thrust, box jump + sprint + ball. 3 rounds.',
        primaryObjective: 'Sviluppare la forza funzionale negli schemi motori specifici del calcio: monopodalico, laterale e rotazionale',
        secondaryObjectives: JSON.stringify(['Forza dei glutei', 'Stabilità del ginocchio in monopodalico', 'Potenza dell\'anca', 'Integrazione forza-gesto tecnico']),
        duration: 28, players: 16, intensity: 'alta', materials: 'palla medica, panchina, scatola 40cm, coni', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Fartlek calcistico — variazioni di ritmo simulate', nameEn: 'Football fartlek — simulated pace variations',
        category: 'atletico',
        description: 'Fartlek (gioco di velocità svedese) adattato al calcio su campo intero: 20 minuti continui con variazioni di ritmo simulate da schede: (1) trot 1 min; (2) corsa media 90s; (3) sprint 10s; (4) cammino recupero 30s; (5) corsa laterale 20s; (6) sprint massimale 6s; (7) trot 1 min. Ripetuto 3-4 cicli. Con palla: ogni sprint è un dribbling; ogni cambio di ritmo include un tocco di palla.',
        descriptionEn: '20-min continuous football fartlek: 1min trot, 90s medium run, 10s sprint, 30s walk, 20s lateral run, 6s maximal sprint. 3-4 cycles. With ball variant: each sprint is dribble, each pace change includes ball touch.',
        primaryObjective: 'Sviluppare i sistemi energetici nei pattern di sforzo reali del calcio attraverso variazioni di ritmo simulate',
        secondaryObjectives: JSON.stringify(['Resistenza aerobica-anaerobica mista', 'Recupero tra sforzi massimali', 'Adattamento ai cambi di ritmo di gara', 'Resistenza specifiche del calcio']),
        duration: 25, players: 16, intensity: 'alta', materials: 'palle, cronometro, schede ritmo', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Mobilità degli arti inferiori — protocollo FMS', nameEn: 'Lower limb mobility — FMS protocol',
        category: 'atletico',
        description: 'Functional Movement Screen applicato al calcio: 7 test di mobilità e stabilità: (1) deep squat (punteggio 0-3); (2) hurdle step; (3) lunge in linea; (4) shoulder mobility; (5) active straight leg raise; (6) trunk stability push-up; (7) rotational stability. Ogni test ha standard tecnici precisi. Punteggio totale < 14 = rischio infortuni aumentato. Protocollo di correzione: per ogni asimmetria, 3 esercizi correttivi specifici. Ideale inizio preseason e mid-season.',
        descriptionEn: 'Functional Movement Screen for football: 7 mobility/stability tests scored 0-3. Total <14 = elevated injury risk. Correction protocol: for each asymmetry, 3 specific corrective exercises. Ideal start of pre-season and mid-season.',
        primaryObjective: 'Identificare deficit di mobilità e asimmetrie funzionali attraverso il protocollo FMS per prevenire infortuni',
        secondaryObjectives: JSON.stringify(['Screening pre-stagionale', 'Identificazione asimmetrie', 'Programma correttivo individuale', 'Prevenzione infortuni evidence-based']),
        duration: 30, players: 16, intensity: 'bassa', materials: 'tappetini, asticella FMS, schede di valutazione', isCustom: false, createdAt: now
      },

      // PARTITELLA (8)
      {
        id: randomUUID(), name: 'Partitella a tema: pressing e transizione', nameEn: 'Themed small-sided game: pressing and transition',
        category: 'partitella',
        description: 'Campo 50x35m, 7vs7 con portieri. Tema doppio: (1) pressing ultra-offensivo — squadra che attacca deve riconquistare entro 6 secondi dalla perdita palla; (2) transizione rapida — dopo ogni recupero palla obbligo di superare metà campo entro 4 secondi. Punti bonus: +1 per ogni pressing riuscito in meno di 6 secondi; +2 per ogni gol segnato entro 5 secondi dal recupero.',
        descriptionEn: '50x35m, 7v7+GKs. Double theme: ultra-offensive pressing (win ball back within 6s) + rapid transition (must cross halfway within 4s of recovery). Bonus points for fast pressing and quick goals. Tactical debrief.',
        primaryObjective: 'Applicare in forma giocata i principi di pressing coordinato e transizione offensiva rapida con incentivi concreti',
        secondaryObjectives: JSON.stringify(['Pressing collettivo immediato', 'Velocità di transizione', 'Mentalità offensiva nella transizione', 'Riconoscimento del momento della perdita di palla']),
        duration: 30, players: 16, intensity: 'massima', materials: 'palle, coni, 2 porte, portieri', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Rondo 8vs2 in doppia griglia', nameEn: 'Rondo 8v2 double grid',
        category: 'partitella',
        description: 'Due quadrati 10x10m adiacenti separati da corridoio 3m. 8 possessori (4 per quadrato) vs 2 pressatori che si muovono tra le due griglie. Regola: il passaggio tra le due griglie vale 2 punti; i tocchi all\'interno valgono 0. I pressatori devono decidere quale griglia pressare. Al recupero palla: i pressatori diventano possessori nella griglia dove hanno recuperato; 2 dei 4 possessori diventano pressatori.',
        descriptionEn: 'Two 10x10m squares with 3m corridor. 8 possessors (4 per grid) vs 2 pressers moving between grids. Pass between grids = 2pts. Pressers choose which grid to press. Recovery: pressers become possessors, 2 possessors become pressers.',
        primaryObjective: 'Sviluppare il cambio di fronte e la visione periferica nel possesso palla con pressatori che gestiscono due griglie',
        secondaryObjectives: JSON.stringify(['Cambio di fronte come vantaggio tattico', 'Visione periferica a campo largo', 'Decisione del pressatore', 'Velocità di circolazione inter-griglia']),
        duration: 20, players: 10, intensity: 'alta', materials: 'palle, coni (2 quadrati 10x10)', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Partitella con regola del gol da fuori', nameEn: 'Small-sided game with outside goal rule',
        category: 'partitella',
        description: 'Campo 40x30m. 6vs6 con portieri. Regola speciale: un gol segnato da fuori area vale 3 punti; un gol segnato su azione di almeno 5 passaggi consecutivi vale 2 punti; gol normale vale 1 punto. I difensori devono coprire lo spazio esterno area più del normale. Sviluppa: (1) il tiro da fuori area come strumento tattico; (2) il possesso paziente per arrivare a 5 passaggi; (3) la difesa compatta dell\'area esterna.',
        descriptionEn: '40x30m, 6v6+GKs. Special rule: outside-area goal = 3pts, goal after 5+ consecutive passes = 2pts, normal goal = 1pt. Forces: long-range shooting as tactical tool, patient possession, compact defending outside box.',
        primaryObjective: 'Incentivare il tiro da fuori area e il possesso paziente attraverso un sistema di punteggio differenziato',
        secondaryObjectives: JSON.stringify(['Tiro da fuori area', 'Possesso paziente a 5 passaggi', 'Difesa compatta zona esterna area', 'Creatività tattica nel punteggio']),
        duration: 25, players: 14, intensity: 'alta', materials: 'palle, coni, 2 porte, portieri', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Partitella con jolly di fascia', nameEn: 'Small-sided game with wide jokers',
        category: 'partitella',
        description: 'Campo 45x35m. 5vs5 + 2 jolly neutrali sulle fasce (fuori dal campo, possono ricevere ma non entrare). I jolly giocano sempre con la squadra in possesso. Regola: prima di segnare, almeno 1 passaggio deve essere transitato per il jolly di fascia. Sviluppa: (1) larghezza offensiva come principio; (2) uso della fascia per spostare il blocco difensivo; (3) giocata del terzino nella realtà del gioco. I jolly rotano ogni 5 minuti.',
        descriptionEn: '45x35m. 5v5 + 2 neutral wide jokers (outside field, can receive but not enter). Jokers always play for possessing team. Rule: at least 1 pass through a wide joker before scoring. Jokers rotate every 5 min.',
        primaryObjective: 'Sviluppare la larghezza offensiva come principio attraverso l\'uso obbligatorio dei jolly di fascia prima della finalizzazione',
        secondaryObjectives: JSON.stringify(['Larghezza offensiva', 'Uso della fascia per spostare il blocco', 'Giocata di fascia in velocità', 'Cambio di fronte via jolly']),
        duration: 25, players: 12, intensity: 'alta', materials: 'palle, coni, 2 porte', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Partitella 9vs9 con regola del tocco', nameEn: '9v9 with touch constraint rule',
        category: 'partitella',
        description: 'Campo 60x45m. 9vs9 con portieri. Progressione tattile in 4 periodi da 8 minuti: (1) tocchi liberi; (2) massimo 3 tocchi; (3) massimo 2 tocchi; (4) 1 tocco obbligatorio in zona centrale, 2 in zona esterna. Obiettivo: nel periodo a 1 tocco i giocatori devono orientarsi prima di ricevere. Monitorare: quanto cambia la velocità di gioco? Chi si adatta e chi fatica?',
        descriptionEn: '60x45m, 9v9+GKs. 4 periods of 8 min with touch progression: free touches, max 3, max 2, 1-touch in central zone + 2 in wide zone. Monitor pace change and adaptation. Discussion: touch constraint as anticipation mindset tool.',
        primaryObjective: 'Sviluppare la velocità di gioco e l\'orientamento anticipato attraverso la progressione dei vincoli di tocco',
        secondaryObjectives: JSON.stringify(['Orientamento prima della ricezione', 'Velocità di circolazione palla', 'Adattamento al gioco a 1 tocco', 'Mentalità di anticipazione']),
        duration: 35, players: 20, intensity: 'alta', materials: 'palle, coni, 2 porte, portieri', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Partitella per reparto: difensori vs attaccanti', nameEn: 'Department game: defenders vs attackers',
        category: 'partitella',
        description: 'Mezza campo. 4 difensori + portiere vs 4 attaccanti. Gli attaccanti devono segnare in 60 secondi dal calcio d\'inizio; se non segnano = punto alla difesa. I difensori non possono andare oltre metà campo. 10 round, 45 secondi di recupero. Statistiche: quante volte la difesa ha tenuto? Quante volte è stato segnato? In quanto tempo medio? Variante: 5 difensori vs 3 attaccanti poi 3 difensori vs 5.',
        descriptionEn: 'Half field. 4 defenders + GK vs 4 attackers. Attackers must score in 60s; if not = defensive point. Defenders cannot cross halfway. 10 rounds, 45s recovery. Track stats. Variants: 5v3 defense, 3v5 attack.',
        primaryObjective: 'Simulare situazioni di pressione reale per difensori e attaccanti con obiettivi cronometrati e statistiche',
        secondaryObjectives: JSON.stringify(['Difesa organizzata a 4 in inferiorità', 'Attacco rapido vs difesa organizzata', 'Pressione psicologica del tempo', 'Mentalità competitiva']),
        duration: 25, players: 9, intensity: 'massima', materials: 'palle, coni, porta, portiere, cronometro', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Partitella con porte multiple a colori', nameEn: 'Multi-goal coloured small-sided game',
        category: 'partitella',
        description: 'Campo 35x25m. 5vs5 senza portieri. 6 porte piccole (2 per colore: rosso, blu, giallo) disposte casualmente ai bordi. Prima del kick-off l\'allenatore chiama un colore — si può segnare solo in quelle porte per 2 minuti, poi nuovo colore. Sviluppa: orientamento spaziale continuo, pressing contestuale, capacità di riorganizzarsi rapidamente. Alta intensità cognitiva. Ispirato al metodo olandese di Wiel Coerver.',
        descriptionEn: '35x25m, 5v5 no GKs. 6 mini-goals (2 each colour: red, blue, yellow). Coach calls a colour before each 2-min period — only that colour counts. Forces: continuous spatial orientation, contextual pressing, rapid reorganisation.',
        primaryObjective: 'Sviluppare orientamento spaziale dinamico e pressing contestuale attraverso obiettivi che cambiano continuamente',
        secondaryObjectives: JSON.stringify(['Orientamento spaziale dinamico', 'Pressing contestuale', 'Riorganizzazione rapida', 'Intelligenza tattica collettiva']),
        duration: 20, players: 10, intensity: 'alta', materials: 'palle, 6 porte piccole (2 rosso, 2 blu, 2 giallo)', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Partitella con possesso obbligatorio nella metà campo difensiva', nameEn: 'Game with mandatory possession in defensive half',
        category: 'partitella',
        description: 'Campo 55x40m. 8vs8 con portieri. Regola: prima di attaccare, ogni azione deve iniziare con almeno 3 passaggi consecutivi nella propria metà campo. Se si attacca senza i 3 passaggi = punizione indiretta all\'avversario. Sviluppa: costruzione dal basso obbligatoria, pazienza offensiva, pressing alto strutturato. Progressione: aumentare a 5 passaggi nella metà campo; poi 3 passaggi ma con almeno 1 deve toccare il portiere.',
        descriptionEn: '55x40m, 8v8+GKs. Rule: every attack must start with 3+ consecutive passes in own half. Attacking without 3 passes = free kick for opponents. Develops: mandatory build-up, offensive patience, structured high press.',
        primaryObjective: 'Obbligare la costruzione bassa dal basso come principio automatico attraverso una regola che penalizza la verticalità immediata',
        secondaryObjectives: JSON.stringify(['Costruzione dal basso obbligatoria', 'Pazienza offensiva', 'Pressing alto strutturato', 'Ruolo del portiere nel gioco']),
        duration: 28, players: 18, intensity: 'alta', materials: 'palle, coni, 2 porte, portieri', isCustom: false, createdAt: now
      },

      // CALCI PIAZZATI (10)
      {
        id: randomUUID(), name: 'Calcio d\'angolo offensivo a zona — schema Liverpool', nameEn: 'Offensive corner — zonal attacking scheme Liverpool',
        category: 'calci_piazzati',
        description: 'Schema da calcio d\'angolo ispirato al Liverpool di Klopp: battitore a sinistra calcia teso al secondo palo. 6 giocatori in area posizionati: 2 sul primo palo (blocco), 2 sul punto del rigore (stacco di testa), 1 al limite area (secondo pallone), 1 sul palo lontano (rimbalzo). Movimento codificato: al momento del calcio, i 2 del primo palo fanno blocco sui difensori, 1 dei 2 al punto del rigore fa corsa verso primo palo. Ripetuto 10 volte.',
        descriptionEn: 'Liverpool-inspired corner scheme. Taker crosses driven to far post. 6 players in area: 2 near-post (block), 2 penalty spot (header), 1 edge of area (second ball), 1 far post (rebound). Coded movement: near-post pair blocks, one penalty-spot player runs to near post.',
        primaryObjective: 'Sviluppare uno schema da calcio d\'angolo offensivo con blocchi coordinati e movimenti codificati per creare superiorità aerea',
        secondaryObjectives: JSON.stringify(['Blocco difensore sul primo palo', 'Attacco aereo al secondo palo', 'Gestione del secondo pallone', 'Conversione del calcio d\'angolo']),
        duration: 20, players: 14, intensity: 'media', materials: 'palle, porta, portiere, coni posizione', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Punizione diretta: tecnica della barriera e del tiro', nameEn: 'Direct free kick: wall technique and shooting',
        category: 'calci_piazzati',
        description: 'Due stazioni simultanee: STAZIONE TIRO — tecnica: (1) run-up angolato 45°; (2) piede d\'appoggio 15cm dalla palla; (3) contatto con zona interna del piede (effetto) o collo (potenza); (4) follow-through verso l\'obiettivo. 5 tiri da ogni posizione (25, 20, 18m; centrale e angolata). STAZIONE BARRIERA — 3 giocatori imparano il salto coordinato: segnale = fischio, salto simultaneo. Portiere lavora sul posizionamento. Al termine: simulazione completa con barriera reale.',
        descriptionEn: 'Two simultaneous stations. SHOOTING: 45° run-up, 15cm support foot, inside contact (curve) or instep (power), follow-through. 5 shots each position (25/20/18m, central/angled). WALL: synchronized jump on whistle. GK positioning.',
        primaryObjective: 'Sviluppare la tecnica della punizione diretta e della barriera difensiva attraverso lavoro simultaneo dei due reparti',
        secondaryObjectives: JSON.stringify(['Tecnica del tiro a effetto', 'Tecnica del tiro di potenza', 'Salto coordinato della barriera', 'Posizionamento portiere su punizione']),
        duration: 25, players: 12, intensity: 'media', materials: 'palle multiple, porta, portiere, spray', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Schema punizione laterale: doppio movimento', nameEn: 'Lateral free kick scheme: double movement',
        category: 'calci_piazzati',
        description: 'Punizione laterale a 25m dalla porta, posizione 3/4. Schema a doppio movimento: giocatore A finge di calciare e si ferma; giocatore B (a 2m) finge di prendere il pallone e si sposta; giocatore C (nascosto dietro la barriera) riceve il vero passaggio di A in spazio liberato da B. C ha campo aperto per il tiro. Alternativa: A calcia direttamente sul primo palo se la barriera si apre. Ripetizione 8 volte con portiere reale.',
        descriptionEn: 'Lateral free kick 25m from goal. Double-movement scheme: A fakes shot and stops; B (2m away) fakes receiving and moves; C (hidden behind wall) receives A\'s pass in freed space. C shoots. Alternative: A shoots direct if wall opens.',
        primaryObjective: 'Sviluppare lo schema a doppio movimento su punizione laterale per creare confusione nella barriera avversaria',
        secondaryObjectives: JSON.stringify(['Coordinazione del doppio movimento', 'Timing di A-B-C', 'Tiro in movimento dopo ricezione', 'Lettura della reazione della barriera']),
        duration: 18, players: 8, intensity: 'bassa', materials: 'palle, porta, portiere, coni barriera', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Rimessa laterale lunga — schema di attivazione', nameEn: 'Long throw-in activation scheme',
        category: 'calci_piazzati',
        description: 'Per squadre con lanciatore di rimessa lunga. Schema: A lancia lungo verso B che fa blocco su difensore avversario; C (attaccante) si inserisce dalla parte opposta del blocco di B per ricevere pulito; D è sul secondo pallone a 12m. Progressione: (1) senza difensori; (2) difensori passivi; (3) difensori attivi. Tecnica del lancio: apertura piedi pari, presa della palla con pollici opposti, arco del corpo, estensione completa.',
        descriptionEn: 'For teams with a long throw specialist. A throws long to B (who screens defender); C attacks from opposite side of B\'s screen; D waits for second ball at 12m. Progressions: no defenders, passive, active. Technique: balanced stance, thumb grip, body arch, full extension.',
        primaryObjective: 'Sviluppare la rimessa laterale lunga come arma offensiva sistematica con schema codificato blocco-taglio',
        secondaryObjectives: JSON.stringify(['Tecnica del lancio lungo', 'Schema blocco-taglio', 'Gestione del secondo pallone', 'Rimessa come calcio piazzato alternativo']),
        duration: 20, players: 10, intensity: 'media', materials: 'palle, coni, porta, portiere', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Calcio di rigore: protocollo mentale e tecnico', nameEn: 'Penalty kick: mental and technical protocol',
        category: 'calci_piazzati',
        description: 'Protocollo completo rigore per tutti i giocatori della rosa: TECNICA — (1) scegliere angolo prima di avvicinarsi; (2) rincorsa di 3-5 passi; (3) piede d\'appoggio 20cm dalla palla; (4) non guardare il portiere dopo la scelta. MENTALE — respirazione diaframmatica 3 secondi prima; visualizzazione del gol; frase di attivazione personale. Ogni giocatore batte 5 rigori con portiere attivo. Statististica: % conversione per giocatore.',
        descriptionEn: 'Complete penalty protocol: TECHNIQUE — choose angle before approaching, 3-5 step run-up, support foot 20cm from ball. MENTAL — diaphragmatic breathing, visualization, activation phrase. 5 kicks each vs active GK. Track individual conversion %.',
        primaryObjective: 'Sviluppare la tecnica e la routine mentale del calcio di rigore per ogni giocatore della rosa in condizioni simulate di pressione',
        secondaryObjectives: JSON.stringify(['Tecnica del tiro dal dischetto', 'Routine pre-rigore', 'Gestione della pressione', 'Statistica individuale di conversione']),
        duration: 25, players: 16, intensity: 'media', materials: 'palle, porta, portiere, dischetto', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Schema calcio d\'angolo corto — triangolo veloce', nameEn: 'Short corner scheme — fast triangle',
        category: 'calci_piazzati',
        description: 'Schema su calcio d\'angolo corto: A batte corto verso B a 5m; B di prima scarica su C che è venuto in appoggio da fuori area; C verticalizza per D che taglia sul secondo palo sul cross basso di C oppure scarica al limite per il tiro di E. Schema prevede 5 movimenti: A, B, C, D, E. Alternativa: A batte, B la protegge e si gira verso D che ha fatto corsa sul secondo palo. Ripetuto 8 volte per lato.',
        descriptionEn: 'Short corner scheme: A plays short to B; B first-touch to C coming from outside area; C plays through for D cutting far post or lays off for E\'s shot. 5-player movement. Alternative: A plays, B protects-turns for D far post. 8 reps each side.',
        primaryObjective: 'Sviluppare lo schema da calcio d\'angolo corto per creare situazioni di tiro da fuori area o cross puliti sul secondo palo',
        secondaryObjectives: JSON.stringify(['Calcio d\'angolo corto come alternativa tattica', 'Triangolo veloce in zona corner', 'Cross basso sul secondo palo', 'Tiro da fuori area dopo schema']),
        duration: 18, players: 10, intensity: 'media', materials: 'palle, porta, portiere, coni schema', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Punizione nella propria metà campo — costruzione', nameEn: 'Own-half free kick — build-up scheme',
        category: 'calci_piazzati',
        description: 'Spesso trascurate: le punizioni nella propria metà campo. Schema: il battitore ha 3 scelte pre-definite in base alla posizione degli avversari: (1) palla corta al terzino libero; (2) palla media per il centrocampista che scappa; (3) lancio lungo per l\'attaccante in profondità. Il portiere comunica la scelta con un segnale da 2m dietro la palla. 8 ripetizioni per schema.',
        descriptionEn: 'Often neglected: own-half free kicks. Taker has 3 pre-defined choices based on opponent position: (1) short to free fullback; (2) medium pass to escaping midfielder; (3) long to striker in depth. GK signals choice from 2m behind ball. 8 reps each.',
        primaryObjective: 'Sviluppare la costruzione dal basso dai calci piazzati difensivi con comunicazione portiere-battitore e lettura della pressione avversaria',
        secondaryObjectives: JSON.stringify(['Lettura della pressione avversaria', 'Comunicazione GK-battitore', 'Tre opzioni di uscita predefinite', 'Uscita costruita da calci piazzati difensivi']),
        duration: 18, players: 10, intensity: 'bassa', materials: 'palle, portiere, coni', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Schema punizione in fascia: cross al secondo palo', nameEn: 'Wide free kick scheme: cross to far post',
        category: 'calci_piazzati',
        description: 'Punizione in fascia a 30-35m. Due battitori: A e B. Finta: A fa gesto di battere, B taglia verso la palla; il difensore pensa a uomo ma B non calcia — devia con il tacco verso C che arriva in corsa; C crossa basso teso verso il secondo palo dove D ha fatto corsa d\'attacco. Variante semplice senza tacco: A batte direttamente cross teso. Analisi: primo palo vs secondo palo. 8 ripetizioni complete dello schema.',
        descriptionEn: 'Wide free kick 30-35m. A fakes kick, B cuts toward ball — B heel-deflects to C arriving in stride; C crosses low to far post where D makes attacking run. Simple variant: A crosses direct. Analysis: near vs far post danger.',
        primaryObjective: 'Sviluppare lo schema su punizione in fascia con deviazione di tacco per liberare il crossatore in corsa verso il secondo palo',
        secondaryObjectives: JSON.stringify(['Deviazione di tacco su punizione', 'Cross in corsa basso e teso', 'Attacco al secondo palo', 'Timing della corsa del finalizzatore']),
        duration: 20, players: 10, intensity: 'media', materials: 'palle, porta, portiere, coni schema', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Calcio di punizione ad effetto — curva a cadere', nameEn: 'Free kick with effect — dropping curve',
        category: 'calci_piazzati',
        description: 'Tecnica avanzata: la punizione con effetto a scendere (top-spin) che supera la barriera e cade sotto la traversa. Tecnica: (1) rincorsa dritta; (2) piede d\'appoggio 25cm a lato; (3) contatto sulla parte alta-centrale della palla con collo piede; (4) gamba che segue verso il basso (follow-through discendente). 10 tiri da 20-22m con barriera reale. L\'allenatore posiziona un cono a 50cm sotto la traversa per dare un riferimento visivo.',
        descriptionEn: 'Advanced technique: top-spin dipping free kick over wall. Technique: straight run-up, support foot 25cm to side, contact top-center of ball with instep, downward follow-through. 10 shots from 20-22m with real wall. Cone 50cm under crossbar as target.',
        primaryObjective: 'Sviluppare la tecnica del tiro a scendere con top-spin per superare la barriera e battere il portiere sulla posizione',
        secondaryObjectives: JSON.stringify(['Top-spin calcistico', 'Follow-through discendente', 'Controllo dell\'effetto', 'Tiro specialistico su punizione']),
        duration: 22, players: 6, intensity: 'media', materials: 'palle, porta, portiere, barriera, spray', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Ripartenza veloce da calcio d\'angolo — contropiede schematizzato', nameEn: 'Fast restart from corner — schematic counter',
        category: 'calci_piazzati',
        description: 'Scenario: l\'avversario ha appena battuto un calcio d\'angolo e la difesa rinvia. Schema di ripartenza rapida pre-definito: (1) portiere lancia lungo su A che è rimasto alto; (2) B (centrocampista) parte in diagonale appena calciato il corner; (3) A protegge e aspetta B in triangolo; (4) A-B-C (terzo uomo in inserimento) sviluppano 3vs2 in contropiede. Trigger: il corner viene calciato. Ripetuto 8 volte.',
        descriptionEn: 'Scenario: opponent has just taken corner, defense clears. Pre-defined quick restart: GK launches long to A (stayed high), B (MF) runs diagonal as corner is kicked, A protects + waits for B, A-B-C develop 3v2 counter. Trigger: corner kick.',
        primaryObjective: 'Sviluppare una ripartenza veloce schematizzata dal calcio d\'angolo difensivo convertendo la situazione in contropiede 3vs2',
        secondaryObjectives: JSON.stringify(['Schema pre-definito di ripartenza', 'Lancio preciso del portiere', 'Triangolo offensivo in contropiede', 'Vantaggio dal corner difensivo']),
        duration: 18, players: 9, intensity: 'alta', materials: 'palle, coni, porta, portiere', isCustom: false, createdAt: now
      },

      // PORTIERI (10)
      {
        id: randomUUID(), name: 'Tuffo laterale — tecnica del diving progressiva', nameEn: 'Lateral dive — progressive diving technique',
        category: 'portieri',
        description: 'Protocollo tecnico tuffo laterale in 4 fasi: FASE 1 (da inginocchiato): palla calciata piano a lato, tuffo morbido con atterraggio su fianco; focus su mani (a coppa), polso di sostegno, testa alzata. FASE 2 (da accovacciato): stessa dinamica ma partendo accovacciati. FASE 3 (da in piedi): palla calciata a lato-basso, tuffo completo. FASE 4 (con cross): tuffo su cross rasoterra degli ultimi 2m di traiettoria. 8 ripetizioni per lato per fase. Focus: non cadere — tuffarsi.',
        descriptionEn: 'Technical diving protocol in 4 phases: kneeling (soft roll, hands, wrist), crouched, standing (full dive on low ball), with cross (dive on last 2m). 8 reps per side per phase. 30s rest. Focus: don\'t fall — dive.',
        primaryObjective: 'Costruire la tecnica corretta del tuffo laterale dal basso verso l\'alto con progressione di complessità e altezza',
        secondaryObjectives: JSON.stringify(['Tecnica delle mani a coppa', 'Polso di sostegno nell\'atterraggio', 'Tuffo su palla bassa', 'Transizione tuffo-recupero']),
        duration: 25, players: 2, intensity: 'media', materials: 'palle, materassino, porta', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Uscita alta sul cross — tecnica della presa aerea', nameEn: 'High exit on cross — aerial catch technique',
        category: 'portieri',
        description: 'Tecnica dell\'uscita alta: (1) posizione di partenza al secondo palo (non al centro); (2) al cross, leggere la traiettoria dal primo tocco del crossatore; (3) partire con decisione (non attendismo); (4) salto con ginocchio sollevato come protezione; (5) presa a mani aperte con pollici opposti; (6) atterraggio su un piede per mantenere equilibrio. 10 cross da destra + 10 da sinistra con crossatori reali. Progressione: aggiunta di attaccante che disturba; poi duello reale. Standard di valutazione: 8/10 prese pulite = ottimo.',
        descriptionEn: 'High exit technique: start at far post, read trajectory from crosser\'s first touch, decisive exit, raised knee for protection, open hands with opposing thumbs, one-foot landing. 10 crosses each side. Add attacker distraction, then real aerial contest.',
        primaryObjective: 'Sviluppare la tecnica dell\'uscita alta sul cross con lettura anticipata, decisione e presa sicura in contesto di disturbo',
        secondaryObjectives: JSON.stringify(['Posizionamento pre-cross', 'Lettura anticipata della traiettoria', 'Presa a mani aperte', 'Uscita in contesto di disturbo']),
        duration: 25, players: 4, intensity: 'alta', materials: 'palle, porta, crossatori', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Distribuzione del portiere — 4 tipi di rilancio', nameEn: 'Goalkeeper distribution — 4 types of release',
        category: 'portieri',
        description: 'Sessione specialistica sulla distribuzione: (1) ROLLATA — rotolamento a terra preciso verso terzino a 15m; (2) LANCIO DI PRECISIONE — lancio a rimbalzo verso centrocampista a 30m; (3) RINVIO CON PIEDE — calcio dal basso a giro verso fascia (40-50m); (4) LANCIO LUNGO — da mani per attaccante spalle a porta a 50m. 10 ripetizioni per tipo. Simulazione delle 4 situazioni di partita. Analisi: % di passaggi arrivati al bersaglio per tipo.',
        descriptionEn: 'Distribution specialization: (1) rolling pass to fullback 15m; (2) precision overarm to midfielder 30m; (3) half-volley swinging to flank 40-50m; (4) long throw to striker 50m. 10 reps each. Simulate 4 match situations. Track % to target.',
        primaryObjective: 'Sviluppare la tecnica delle 4 tipologie di distribuzione del portiere adattandola alle distanze e situazioni di partita reali',
        secondaryObjectives: JSON.stringify(['Rollata precisa a terra', 'Lancio di precisione a media distanza', 'Rinvio a giro sulla fascia', 'Lancio lungo per l\'attaccante di punta']),
        duration: 25, players: 3, intensity: 'media', materials: 'palle multiple, coni bersaglio, porta', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Reazione su tiro ravvicinato — riflessi e posizione', nameEn: 'Close-range reaction save — reflexes and positioning',
        category: 'portieri',
        description: 'Esercizio ad alta intensità per riflessi: portiere in piedi a 5m dalla porta senza rete. 2 tiratori alternati a 7m con palle a cadenza rapida (ogni 5 secondi). Il portiere deve respingere (non trattenere obbligatoriamente). Variante 1: tiro piazzato basso-angolo; variante 2: tiro forte centrale; variante 3: palla alzata sul palo. 3 serie da 8 tiri. Recupero 2 minuti. Allena riflessi puri e posizionamento proattivo.',
        descriptionEn: 'High-intensity reflex drill: GK stands 5m from goal. 2 alternating shooters at 7m, ball every 5s. GK must react (not necessarily catch). Variants: low-angle placed, powerful central, ball flicked to post. 3 sets of 8 shots. 2 min rest.',
        primaryObjective: 'Sviluppare i riflessi puri del portiere su tiri ravvicinati e la capacità di recupero rapido tra parate consecutive',
        secondaryObjectives: JSON.stringify(['Riflessi su tiro ravvicinato', 'Recupero posizionale rapido', 'Risposta a tiri consecutivi', 'Posizionamento proattivo']),
        duration: 20, players: 3, intensity: 'alta', materials: 'palle multiple, porta, 2 tiratori', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Portiere in costruzione — ruolo nel 3-4-3', nameEn: 'GK in build-up — role in 3-4-3',
        category: 'portieri',
        description: 'Il portiere come decimo giocatore di campo: in un 3-4-3 che costruisce basso, il portiere deve posizionarsi tra i 3 difensori (stopper) quando uno esce a pressare. Meccanismo: (1) difensore centrale viene pressato → si gira e cerca portiere; (2) portiere è già nella posizione corretta (3-4m dietro la linea difensiva, non sulla linea di porta); (3) portiere riceve, controlla, gioca sul lato libero. Progressione: con 2 pressatori; poi con pressing alto organizzato a 3.',
        descriptionEn: 'GK as 10th outfield player in 3-4-3 build-up. When a CB is pressed, GK positions between the three CBs. Mechanism: CB turns back to GK → GK already positioned 3-4m behind defensive line → GK receives, controls, plays to free side. Add 2 then 3 pressers.',
        primaryObjective: 'Sviluppare il portiere come giocatore attivo nella costruzione bassa del 3-4-3 con posizionamento proattivo tra i difensori',
        secondaryObjectives: JSON.stringify(['Posizionamento del portiere tra i difensori', 'Controllo orientato del portiere', 'Lettura della pressione avversaria', 'Uscita coraggiosa dal portiere']),
        duration: 20, players: 8, intensity: 'media', materials: 'palle, coni, porta', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Parata del tiro a giro — tecnica del palo vicino', nameEn: 'Curling shot save — near post technique',
        category: 'portieri',
        description: 'Tipologia di tiro più difficile da parare: il tiro a giro dall\'interno dell\'area che entra sul primo palo. Esercizio: tiratori calciando da 18-22m con effetto interno sul primo palo. Il portiere deve: (1) non tagliare troppo l\'angolo (errore comune); (2) mantenere 1/3 del corpo sul palo; (3) tuffarsi in avanti-laterale, non solo laterale (il pallone entra curva). 10 tiri per tipologia. Progressione: tiro con ostacolo umano a 3m.',
        descriptionEn: 'Hardest shot to save: curling shot entering near post. Shooters from 18-22m with inside curl. GK must: not cut too much angle, keep 1/3 of body on post, dive forward-lateral (not just lateral — ball curves in). 10 shots each type. Progression: human obstacle at 3m.',
        primaryObjective: 'Sviluppare la tecnica specifica per parare il tiro a giro sul primo palo: angolo corretto, tuffo in avanti-laterale',
        secondaryObjectives: JSON.stringify(['Posizionamento sul palo vicino', 'Tuffo in avanti-laterale', 'Lettura della traiettoria a effetto', 'Angolo corretto vs tiro a giro']),
        duration: 22, players: 3, intensity: 'alta', materials: 'palle, porta, 2-3 tiratori', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Uscita in profondità 1vs1 — postura e chiusura dell\'angolo', nameEn: '1v1 depth exit — posture and angle closure',
        category: 'portieri',
        description: 'Situazione più frequente e temuta: attaccante solo davanti al portiere. Tecnica: (1) uscire rapidamente ma fermarsi a 3-4m dall\'attaccante; (2) baricentro basso, piedi alla larghezza delle spalle; (3) espandersi lateralmente (non alzarsi); (4) aspettare il tiro senza buttarsi; (5) se l\'attaccante dribbling → restare in piedi e chiudere la porta. 8 ripetizioni con attaccanti diversi (velocità diversa, conclusione diversa).',
        descriptionEn: '1v1 depth exit. Technique: exit fast then stop 3-4m from attacker, low center of gravity feet shoulder-width, spread laterally (not upward), wait for shot without diving prematurely, if attacker dribbles stay up and track. 8 reps with different attacker types.',
        primaryObjective: 'Sviluppare la tecnica del 1vs1 in uscita: distanza corretta, postura espansa, attesa del tiro senza anticipare',
        secondaryObjectives: JSON.stringify(['Distanza di sicurezza nel 1vs1', 'Postura espansa lateralmente', 'Attesa del tiro', 'Gestione del dribbling dell\'attaccante']),
        duration: 20, players: 4, intensity: 'alta', materials: 'palle, porta, attaccanti variabili', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Coordinazione portiere — circuito atletico specifico', nameEn: 'GK coordination — sport-specific athletic circuit',
        category: 'portieri',
        description: 'Circuito atletico specifico per portieri (3 giri da 6 stazioni): (1) scala agilità laterale × 5m poi tuffo su palla; (2) box jump 30cm + parata immediata su cross; (3) skip avanti + arresto + tuffo; (4) salto verticale con presa palla alzata dal compagno; (5) plank 30" + sprint 5m + presa; (6) esercizio di reazione con palla da rimbalzo su muro. Recupero 1 minuto tra giri. Allena gli attributi fisici specifici del portiere.',
        descriptionEn: 'GK-specific athletic circuit (3 rounds, 6 stations): lateral ladder + dive on ball, box jump + immediate cross save, skip + stop + dive, vertical jump + catch raised ball, plank + sprint + catch, wall-bounce reaction ball. 1 min rest between rounds.',
        primaryObjective: 'Sviluppare gli attributi fisici specifici del portiere: agilità laterale, potenza del salto, reattività e forza del core',
        secondaryObjectives: JSON.stringify(['Agilità laterale specifica portiere', 'Potenza del salto verticale', 'Reattività su rimbalzo imprevedibile', 'Integrazione atletismo-tecnica']),
        duration: 28, players: 2, intensity: 'alta', materials: 'scala agilità, box 30cm, palle, muro', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Comunicazione con la difesa — organizzazione sui cross', nameEn: 'Communication with defense — organization on crosses',
        category: 'portieri',
        description: 'Esercizio fondamentale spesso trascurato: il portiere deve guidare verbalmente i difensori sui cross. Simulazione: 4 difensori + portiere vs 3 attaccanti + crossatore. Il portiere deve: (1) chiamare "MIEI!" se esce; (2) chiamare il numero del difensore che deve marcare l\'attaccante libero; (3) chiamare "PORTA!" se non esce e il difensore deve difendere il palo. 8 cross da destra + 8 da sinistra. Feedback: qualità della comunicazione valutata dall\'allenatore.',
        descriptionEn: '4 defenders + GK vs 3 attackers + crosser. GK must: call "MINE!" if exiting, call defender\'s number to mark free attacker, call "POST!" if staying. 8 crosses each side. Coach evaluates communication quality (0-3 for clarity, timing, impact).',
        primaryObjective: 'Sviluppare la leadership vocale del portiere nell\'organizzazione difensiva sui cross con comunicazione tempestiva e chiara',
        secondaryObjectives: JSON.stringify(['Leadership vocale del portiere', 'Comunicazione portiere-difensori', 'Decisione uscita vs resta', 'Organizzazione difensiva sui cross']),
        duration: 22, players: 8, intensity: 'media', materials: 'palle, porta, coni di zona', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Tiro in tuffo su secondo palo — tecnica avanzata', nameEn: 'Diving save far post — advanced technique',
        category: 'portieri',
        description: 'Situazione tecnica avanzata: tiro che cambia direzione sul secondo palo dopo deviazione o cross rasoterra che taglia tutta l\'area. Il portiere deve: (1) partire a sinistra (primo palo); (2) il tiro devia a destra (secondo palo); (3) recupero immediato e tuffo inverso. Tecnica del recupero rapido: pivot su piede di appoggio, spinta esplosiva verso il secondo palo. 10 ripetizioni con tiratori che scelgono casualmente primo o secondo palo.',
        descriptionEn: 'Advanced save: shot diverts to far post after deflection. GK starts near post, ball diverts far post. Technique: pivot on support foot, explosive push to far post. 10 reps, shooters choose near/far at random. Variant: ground cross across area. Pure reactivity.',
        primaryObjective: 'Sviluppare la capacità di recupero rapido e tuffo inverso sul secondo palo in situazioni di deviazione imprevedibile',
        secondaryObjectives: JSON.stringify(['Pivot e spinta esplosiva', 'Tuffo inverso sul secondo palo', 'Reattività su palla deviata', 'Lettura del cross rasoterra nell\'area']),
        duration: 22, players: 3, intensity: 'alta', materials: 'palle, porta, 2 tiratori', isCustom: false, createdAt: now
      },
    ];

    const extraExercises = [
      // ── TECNICA ──
      {
        id: randomUUID(), name: 'Controllo di petto e scarico rapido', nameEn: 'Chest control and quick release',
        category: 'tecnica',
        description: 'In coppia a 8m: il server alza la palla, il ricevente la controlla di petto e scarica di prima al server. 3 serie da 10 per lato. Variante: controllo orientato verso l\'esterno per simulare uscita dalla pressione.',
        descriptionEn: 'In pairs at 8m: server lofts ball, receiver chest-controls and plays first-time back. 3 sets of 10 each side. Variant: orient control outward to simulate escape from pressure.',
        primaryObjective: 'Migliorare il controllo di petto e la qualità del primo tocco sotto pressione',
        secondaryObjectives: JSON.stringify(['Orientamento del corpo', 'Velocità di gioco', 'Controllo aereo']),
        duration: 15, players: 2, intensity: 'media', materials: '1 pallone per coppia', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Giocoleria con obiettivi: sequenze miste', nameEn: 'Juggling with targets: mixed sequences',
        category: 'tecnica',
        description: 'Individuale: sequenze prefissate (dx-sx-testa-dx, coscia-piede-coscia, ecc.). L\'allenatore chiama la sequenza successiva mentre il giocatore è in giocoleria. 5 minuti continui. Sviluppa coordinazione, concentrazione e padronanza della palla.',
        descriptionEn: 'Solo: preset juggling sequences (R-L-head-R, thigh-foot-thigh etc.). Coach calls next sequence while player juggles. 5 continuous minutes. Builds coordination, focus and ball mastery.',
        primaryObjective: 'Aumentare la padronanza della palla e la coordinazione segmentaria',
        secondaryObjectives: JSON.stringify(['Concentrazione sotto stimolo', 'Varietà dei tocchi', 'Senso del ritmo']),
        duration: 10, players: 1, intensity: 'bassa', materials: '1 pallone a testa', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Passaggio di prima intenzione in movimento — quadrato a 6', nameEn: 'First-time passing in movement — 6-man square',
        category: 'tecnica',
        description: '6 giocatori sugli angoli di un quadrato 12x12m + 2 al centro. Il giocatore centrale riceve, scarica di prima e si scambia col passante. Rotazione continua per 4 minuti, poi cambio. Enfasi sul piede debole ogni 2 minuti.',
        descriptionEn: '6 players on corners of 12x12m square + 2 central. Central receives, first-time release, swaps with passer. Continuous rotation 4 min then switch. Emphasis on weak foot every 2 min.',
        primaryObjective: 'Migliorare la velocità e la qualità del passaggio di prima in contesti di movimento continuo',
        secondaryObjectives: JSON.stringify(['Coordinazione di gruppo', 'Piede debole', 'Lettura della traiettoria']),
        duration: 18, players: 6, intensity: 'media', materials: '2 palloni, coni per il quadrato', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Finta e doppio passo — circuito a coni', nameEn: 'Feint and double step — cone circuit',
        category: 'tecnica',
        description: 'Percorso a 8 coni con finte programmate (doppio passo, elastico, cut inverso) a ogni cono. 6 ripetizioni a velocità crescente. Recupero 45s tra i giri. Cronometrato dalla 3a rep in poi per misurare progressione.',
        descriptionEn: '8-cone circuit with assigned moves (double step, elastico, reverse cut) at each cone. 6 reps at increasing speed. 45s recovery between runs. Timed from rep 3 to measure progress.',
        primaryObjective: 'Automatizzare finte specifiche in conduzione ad alta velocità',
        secondaryObjectives: JSON.stringify(['Esplosività', 'Cambio di direzione', 'Confidenza col pallone']),
        duration: 20, players: 4, intensity: 'alta', materials: '8 coni, palloni', isCustom: false, createdAt: now
      },
      // ── TATTICA ──
      {
        id: randomUUID(), name: 'Difesa del blocco basso: 4-1-4-1 compatto', nameEn: 'Low block defense: compact 4-1-4-1',
        category: 'tattica',
        description: '10 difensori (4-1-4-1) vs 8 attaccanti con possesso. I difensori mantengono distanze inter-linea max 15m, scalano sul portatore e coprono le linee di passaggio centrali. Trigger di pressing: portiere palla lunga. 4 serie da 5 minuti.',
        descriptionEn: '10 defenders (4-1-4-1) vs 8 attackers with possession. Defenders keep inter-line gap max 15m, press ball carrier, block central passing lanes. Pressing trigger: long GK pass. 4×5 min.',
        primaryObjective: 'Consolidare il blocco difensivo basso e la disciplina posizionale',
        secondaryObjectives: JSON.stringify(['Compattezza verticale', 'Comunicazione difensiva', 'Trigger del pressing']),
        duration: 25, players: 14, intensity: 'media', materials: 'Campo 40x35m, 2 porte', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Sovraccarico laterale: 3vs2 sulle fasce', nameEn: 'Wide overload: 3v2 on the flanks',
        category: 'tattica',
        description: 'Metà campo divisa in 3 corsie. Nelle corsie laterali: 3 attaccanti vs 2 difensori. Centro neutro. L\'attacco deve sfruttare la superiorità numerica per crossare in area. 3 minuti per corsia, poi rotazione. Focus: quando e come sfruttare l\'1-2 in fascia.',
        descriptionEn: 'Half-pitch split into 3 corridors. Wide corridors: 3 attackers vs 2 defenders. Neutral center. Attack must exploit overload to deliver cross. 3 min per corridor, rotate. Focus: when and how to play the 1-2 on the flank.',
        primaryObjective: 'Sfruttare la superiorità numerica sulle fasce per creare occasioni da cross',
        secondaryObjectives: JSON.stringify(['Timing del cross', 'Movimento senza palla in area', 'Difesa 1vs2 in corsia']),
        duration: 22, players: 12, intensity: 'media', materials: 'Coni per corsie, 2 porte', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Uscita dalla pressione: rombo centrocampo', nameEn: 'Escape the press: midfield diamond',
        category: 'tattica',
        description: '4 centrocampisti in rombo (MC alto, basso, 2 mezzali) contro 3 pressatori. Obiettivo: far girare palla per uscire dalla pressione senza perdere il possesso per 8 passaggi. Se i pressatori recuperano, si riparte. 10 round da 90s.',
        descriptionEn: '4 midfielders in diamond (high CM, low CM, 2 halfbacks) vs 3 pressers. Goal: circulate ball to escape press without losing it for 8 passes. If pressers win it, restart. 10×90s rounds.',
        primaryObjective: 'Sviluppare capacità di uscita dalla pressione con geometrie di centrocampo',
        secondaryObjectives: JSON.stringify(['Posizionamento tra le linee', 'Velocità di decisione', 'Comunicazione in pressione']),
        duration: 20, players: 7, intensity: 'alta', materials: 'Coni, 2 palloni', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Attacco posizionale: principio del terzo uomo', nameEn: 'Positional attack: third-man principle',
        category: 'tattica',
        description: '7vs5 in 30x25m. La squadra in possesso deve coinvolgere almeno 3 giocatori prima del tiro (1° riceve, 2° smista, 3° finalizza o fa l\'ultimo passaggio). Punto solo se rispettato il principio. 3 serie da 6 minuti.',
        descriptionEn: '7v5 in 30x25m. Possessing team must involve at least 3 players before shooting (1st receives, 2nd plays on, 3rd finishes). Goal only valid if principle followed. 3×6 min.',
        primaryObjective: 'Automatizzare il principio del terzo uomo nello sviluppo dell\'azione offensiva',
        secondaryObjectives: JSON.stringify(['Movimento senza palla', 'Timing degli inserimenti', 'Costruzione del gioco fluida']),
        duration: 25, players: 12, intensity: 'media', materials: '2 porte, campo 30x25m', isCustom: false, createdAt: now
      },
      // ── ATLETICO ──
      {
        id: randomUUID(), name: 'Circuito SAQ: scala, coni, ostacoli', nameEn: 'SAQ circuit: ladder, cones, hurdles',
        category: 'atletico',
        description: '5 stazioni da 40s ciascuna: (1) scala agility 2 piedi; (2) slalom 6 coni; (3) ostacoli bassi alternati; (4) T-drill; (5) recupero attivo. 3 giri totali, recupero 90s tra i giri. Registrare i tempi al T-drill per monitorare la progressione.',
        descriptionEn: '5 stations ×40s: (1) 2-foot ladder; (2) 6-cone slalom; (3) alternating low hurdles; (4) T-drill; (5) active recovery. 3 total rounds, 90s rest between rounds. Record T-drill time to track progress.',
        primaryObjective: 'Migliorare velocità, agilità e rapidità (SAQ) in forma integrata',
        secondaryObjectives: JSON.stringify(['Reattività dei piedi', 'Cambio di direzione', 'Resistenza alla velocità']),
        duration: 25, players: 6, intensity: 'alta', materials: 'Scala agility, 6 coni, ostacoli bassi, cronometro', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Forza esplosiva: squat jump + accelerazione', nameEn: 'Explosive strength: squat jump + acceleration',
        category: 'atletico',
        description: '3 serie: 5 squat jump → sprint 15m → recupero camminando. Recupero completo tra le serie (3 minuti). Focus sulla qualità del salto (massima altezza) e sull\'uscita esplosiva dallo squat. Misurare distanza sprint dopo il salto.',
        descriptionEn: '3 sets: 5 squat jumps → 15m sprint → walk back recovery. Full rest between sets (3 min). Focus on jump quality (max height) and explosive exit. Measure sprint distance after jump.',
        primaryObjective: 'Sviluppare la potenza degli arti inferiori in connessione con l\'accelerazione',
        secondaryObjectives: JSON.stringify(['Potenza esplosiva', 'Coordinazione salto-sprint', 'Forza reattiva']),
        duration: 18, players: 4, intensity: 'alta', materials: 'Coni per marcature sprint', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Resistenza specifica: 8x200m con palla', nameEn: 'Specific endurance: 8×200m with ball',
        category: 'atletico',
        description: '8 ripetizioni da 200m in conduzione palla a ritmo 75-80% della velocità max. Recupero 90s tra le rep (passaggi in coppia). Simula la resistenza aerobica specifica del calciatore integrando il gesto tecnico.',
        descriptionEn: '8×200m ball dribbling at 75-80% max speed. 90s recovery between reps (pair passing). Simulates footballer-specific aerobic endurance integrating technical action.',
        primaryObjective: 'Sviluppare la resistenza aerobica specifica con palla integrata',
        secondaryObjectives: JSON.stringify(['Ritmo di corsa', 'Tecnica in conduzione a media velocità', 'Gestione dello sforzo']),
        duration: 30, players: 2, intensity: 'media', materials: 'Palloni, coni per tracciare 200m', isCustom: false, createdAt: now
      },
      // ── RISCALDAMENTO ──
      {
        id: randomUUID(), name: 'Riscaldamento in possesso 3 tocchi max', nameEn: 'Possession warm-up 3 touches max',
        category: 'riscaldamento',
        description: 'Quadrato 20x20m, 8-10 giocatori, 2 pressatori. Possesso con max 3 tocchi, nessun tocco indietro verso chi ha passato. Intensità bassa per 5 min poi media per 3 min. Perfetto per attivare mente e muscoli insieme prima dell\'allenamento principale.',
        descriptionEn: '20x20m square, 8-10 players, 2 chasers. Possession max 3 touches, no back-pass to the player who passed. Low intensity 5 min then medium 3 min. Great to activate mind and muscles before main session.',
        primaryObjective: 'Attivare la muscolatura e i meccanismi cognitivi in forma progressiva',
        secondaryObjectives: JSON.stringify(['Comunicazione', 'Tecnica di ricezione', 'Visione periferica']),
        duration: 12, players: 8, intensity: 'bassa', materials: 'Coni 20x20m, 1-2 palloni', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Attivazione dinamica con elastici e sprint', nameEn: 'Dynamic activation with bands and sprints',
        category: 'riscaldamento',
        description: 'Serie di esercizi con elastico: (1) camminata laterale 10m x2; (2) kick forward 10 per gamba; (3) hip circle 10 per lato; (4) squat con elastico x10; poi 3 sprint progressivi 20-30-40m. Ideale per attivare anche i piccoli stabilizzatori prima di lavori esplosivi.',
        descriptionEn: 'Band exercises: (1) lateral walk 10m ×2; (2) kick forward 10 per leg; (3) hip circle 10 per side; (4) band squat ×10; then 3 progressive sprints 20-30-40m. Ideal to activate small stabilisers before explosive work.',
        primaryObjective: 'Attivare la muscolatura stabilizzatrice e preparare il sistema neuromuscolare agli sforzi esplosivi',
        secondaryObjectives: JSON.stringify(['Stabilità dell\'anca', 'Prevenzione infortuni', 'Preparazione allo sprint']),
        duration: 12, players: 1, intensity: 'bassa', materials: 'Elastici mini-band, coni', isCustom: false, createdAt: now
      },
      // ── PARTITELLA ──
      {
        id: randomUUID(), name: 'Partitella 7vs7 su campo stretto — verticalità', nameEn: '7v7 small-sided game — verticality',
        category: 'partitella',
        description: 'Campo 35x28m, 7vs7 + portieri. Regola: gol vale doppio se segnato entro 5 secondi da un recupero palla. Stimola le transizioni rapide e la verticalità nel gioco. Nessuna regola sul numero di tocchi. 2 tempi da 8 minuti.',
        descriptionEn: '35x28m pitch, 7v7 + GKs. Rule: goal counts double if scored within 5 seconds of winning the ball. Stimulates fast transitions and vertical play. No touch limit. 2×8 min halves.',
        primaryObjective: 'Sviluppare la mentalità verticale e la rapidità di transizione offensiva',
        secondaryObjectives: JSON.stringify(['Transizione offensiva', 'Decisione rapida', 'Pressing post perdita']),
        duration: 22, players: 16, intensity: 'alta', materials: '2 porte, palloni extra', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Partitella con jolly centrale fisso', nameEn: 'Small-sided game with fixed central joker',
        category: 'partitella',
        description: '4vs4 + 1 jolly sempre con la squadra in possesso (5vs4). Il jolly gioca solo di prima e non può segnare. Campo 25x20m. Sviluppa il movimento senza palla per appoggiarsi al jolly e il pressing strutturato quando si difende.',
        descriptionEn: '4v4 + 1 joker always on the possessing side (5v4). Joker plays first-time only, cannot score. 25x20m. Develops off-ball movement to use the joker and structured pressing when defending.',
        primaryObjective: 'Migliorare il movimento senza palla e l\'uso del giocatore di raccordo',
        secondaryObjectives: JSON.stringify(['Appoggio al jolly', 'Posizionamento offensivo', 'Pressing 4vs5']),
        duration: 20, players: 9, intensity: 'media', materials: '2 porte piccole, coni', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Partitella a zone con bonus possesso', nameEn: 'Zoned match with possession bonus',
        category: 'partitella',
        description: 'Campo diviso in 3 zone orizzontali. Bonus: 1 punto extra per ogni 5 passaggi consecutivi nella zona avversaria. Gol normale vale 2 punti. Incentiva il possesso qualificato in zona avanzata e la fluidità di circolazione.',
        descriptionEn: 'Field split into 3 horizontal zones. Bonus: 1 extra point for every 5 consecutive passes in the opponent\'s zone. Normal goal = 2 points. Incentivises qualified possession in the final third.',
        primaryObjective: 'Allenare il possesso palla funzionale nella zona avanzata con pressione sul risultato',
        secondaryObjectives: JSON.stringify(['Circolazione veloce', 'Mantenimento sotto pressione', 'Finalizzazione']),
        duration: 25, players: 14, intensity: 'media', materials: 'Coni per zone, 2 porte', isCustom: false, createdAt: now
      },
      // ── CALCI PIAZZATI ──
      {
        id: randomUUID(), name: 'Calcio d\'angolo corto: 2-1 con cross arretrato', nameEn: 'Short corner: 2-1 with cutback cross',
        category: 'calci_piazzati',
        description: 'Schema: battitore + 1 appoggio corto, l\'appoggio scarica indietro per cross rasoterra sul secondo palo. In area: 2 bloccatori + 2 tagliatori. Timing: il cross parte quando il secondo tagliatore entra in area. 15 ripetizioni con variante a cross alto sul primo palo.',
        descriptionEn: 'Pattern: kicker + 1 short support, support plays back for low cutback to far post. In box: 2 blockers + 2 cutters. Timing: cross when second cutter enters box. 15 reps with variant: high cross near post.',
        primaryObjective: 'Automatizzare lo schema del corner corto con cross arretrato e movimenti in area',
        secondaryObjectives: JSON.stringify(['Timing dei tagliatori', 'Tecnica del cross rasoterra', 'Blocchi in area']),
        duration: 20, players: 8, intensity: 'bassa', materials: 'Porta, palloni, coni', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Punizione laterale: scarico e tiro dalla trequarti', nameEn: 'Wide free kick: lay-off and shot from the edge',
        category: 'calci_piazzati',
        description: 'Punizione da posizione laterale (zona mezzala). Schema: finta del battitore, scarico al limite per tiro a giro sul secondo palo. Variante B: passaggio filtrante per la sovrapposizione del terzino. 20 ripetizioni alternando i due schemi.',
        descriptionEn: 'Free kick from wide halfback position. Pattern: kicker dummy run, lay-off to edge of box for curling shot far post. Variant B: through ball for overlapping fullback. 20 reps alternating both patterns.',
        primaryObjective: 'Costruire automatismi su punizione laterale con due soluzioni distinte',
        secondaryObjectives: JSON.stringify(['Qualità del cross/tiro a giro', 'Coordinazione dello schema', 'Lettura difensiva avversaria']),
        duration: 18, players: 6, intensity: 'bassa', materials: 'Porta, palloni, coni per muro fittizio', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Rimessa dal fondo: costruzione GK + uscita', nameEn: 'Goal kick: GK build-up and press escape',
        category: 'calci_piazzati',
        description: 'Schema di rimessa dal fondo con pressing avversario simulato. GK distribuisce corto al difensore, 2-3 tocchi per uscire dalla pressione verso le fasce o passaggio filtrante in mezzo. 3 varianti: (A) lato dx, (B) lato sx, (C) filtrante centrale. 5 ripetizioni per variante.',
        descriptionEn: 'Goal kick scheme vs simulated press. GK distributes short to defender, 2-3 touches to escape pressure wide or central through ball. 3 variants: (A) right side, (B) left side, (C) central through. 5 reps per variant.',
        primaryObjective: 'Costruire automatismi di uscita dal fondo contro il pressing avversario',
        secondaryObjectives: JSON.stringify(['Costruzione dal basso', 'Posizionamento dei difensori', 'Lettura del pressing']),
        duration: 20, players: 8, intensity: 'bassa', materials: 'Porta, palloni, coni per simulare pressing', isCustom: false, createdAt: now
      },
      // ── PORTIERI ──
      {
        id: randomUUID(), name: 'Portiere: piede — distribuzione corta e lunga', nameEn: 'Goalkeeper: feet — short and long distribution',
        category: 'portieri',
        description: 'Serie di rilanci: 5 passaggi corti rasoterra ai difensori (max 20m), 5 lanci medi (20-35m) con buona traiettoria, 5 calci lunghi (35m+) orientati sulle fasce. Feedback su traiettoria, precisione e velocità di esecuzione. Poi ripetere sotto pressione simulata (pressing a 30m).',
        descriptionEn: '5 short ground rolls to defenders (max 20m), 5 medium throws (20-35m), 5 long kicks (35m+) targeted wide. Feedback on trajectory, accuracy, execution speed. Repeat under simulated press (presser at 30m).',
        primaryObjective: 'Migliorare la qualità e la varietà della distribuzione col piede del portiere',
        secondaryObjectives: JSON.stringify(['Precisione del lancio', 'Scelta della soluzione', 'Velocità di decisione sotto pressione']),
        duration: 20, players: 2, intensity: 'media', materials: 'Porta, palloni, coni', isCustom: false, createdAt: now
      },
      {
        id: randomUUID(), name: 'Portiere: 1vs1 uscita bassa — tecnica del piede', nameEn: 'Goalkeeper: 1v1 low exit — foot technique',
        category: 'portieri',
        description: 'Attaccante avanzato 1vs1 da diverse angolazioni (centro, destra, sinistra). Il portiere deve scegliere il timing dell\'uscita (non troppo presto, non troppo tardi). Focus: tecnica del piede (blocco con piede avanzato, corpo largo). 15 situazioni, 3 per angolazione.',
        descriptionEn: 'Attacker 1v1 from different angles (center, right, left). GK must choose correct exit timing. Focus: foot technique (block with leading foot, wide body). 15 situations, 3 per angle.',
        primaryObjective: 'Perfezionare la tecnica e il timing dell\'uscita bassa in situazioni di 1vs1',
        secondaryObjectives: JSON.stringify(['Posizionamento del corpo', 'Coraggio nell\'uscita', 'Lettura della traiettoria']),
        duration: 20, players: 3, intensity: 'media', materials: 'Porta, palloni, coni', isCustom: false, createdAt: now
      },
    ];

    await db.insert(exercises).values([...defaultExercises, ...extraExercises]);
    return c.json({ message: 'seeded', count: defaultExercises.length + extraExercises.length }, 200);
  })

  // ─── EXERCISES ─────────────────────────────────────────────────────────────
  .get('/exercises', authMiddleware, async (c) => {
    const category = c.req.query('category');
    const userId = c.get('userId');
    // Return default exercises (userId='system-admin' or isCustom=false) + user's own custom exercises
    let all;
    if (category && category !== 'tutti') {
      all = await db.select().from(exercises).where(
        and(eq(exercises.category, category))
      );
    } else {
      all = await db.select().from(exercises);
    }
    // Filter: show non-custom (global) + custom belonging to this user
    all = all.filter(e => !e.isCustom || e.userId === userId || e.userId === 'system-admin');
    return c.json(all, 200);
  })
  .post('/exercises', authMiddleware, async (c) => {
    const body = await c.req.json();
    const userId = c.get('userId');
    const ex = {
      id: randomUUID(),
      userId,
      name: body.name,
      nameEn: body.nameEn ?? null,
      category: body.category,
      description: body.description,
      descriptionEn: body.descriptionEn ?? null,
      duration: body.duration,
      players: body.players ?? null,
      intensity: body.intensity,
      materials: body.materials ?? null,
      primaryObjective: body.primaryObjective ?? null,
      secondaryObjectives: body.secondaryObjectives ?? null,
      isCustom: true,
      createdAt: Date.now(),
    };
    await db.insert(exercises).values(ex);
    return c.json(ex, 201);
  })
  .delete('/exercises/:id', authMiddleware, async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    // Only allow deleting own custom exercises (or admin can delete any)
    const [ex] = await db.select().from(exercises).where(eq(exercises.id, id));
    if (!ex) return c.json({ error: 'not found' }, 404);
    if (ex.isCustom && ex.userId !== userId && c.get('userRole') !== 'admin') {
      return c.json({ error: 'Non autorizzato' }, 403);
    }
    await db.delete(exercises).where(eq(exercises.id, id));
    return c.json({ success: true }, 200);
  })

  // ─── PLAYERS ───────────────────────────────────────────────────────────────
  .get('/players', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const all = await db.select().from(players).where(eq(players.userId, userId));
    return c.json(all, 200);
  })
  .post('/players', authMiddleware, async (c) => {
    const body = await c.req.json();
    const userId = c.get('userId');
    const player = {
      id: randomUUID(),
      userId,
      name: body.name,
      number: body.number ?? null,
      role: body.role,
      subRole: body.subRole ?? null,
      secondaryRole: body.secondaryRole ?? null,
      secondarySubRole: body.secondarySubRole ?? null,
      dateOfBirth: body.dateOfBirth ?? null,
      foot: body.foot ?? null,
      photoUrl: body.photoUrl ?? null,
      notes: body.notes ?? null,
      createdAt: Date.now(),
    };
    await db.insert(players).values(player);
    return c.json(player, 201);
  })
  .put('/players/:id', authMiddleware, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    await db.update(players).set({
      name: body.name,
      number: body.number,
      role: body.role,
      subRole: body.subRole ?? null,
      secondaryRole: body.secondaryRole ?? null,
      secondarySubRole: body.secondarySubRole ?? null,
      dateOfBirth: body.dateOfBirth ?? null,
      foot: body.foot ?? null,
      photoUrl: body.photoUrl ?? null,
      notes: body.notes,
    }).where(eq(players.id, id));
    return c.json({ success: true }, 200);
  })
  .get('/players/:id/stats', authMiddleware, async (c) => {
    const playerId = c.req.param('id');
    const userId = c.get('userId');
    // Fetch all matches for this user
    const allMatches = await db.select().from(matches).where(eq(matches.userId, userId));
    // Fetch convocations for this player
    const convocationEntries = await db.select().from(matchConvocations).where(eq(matchConvocations.playerId, playerId));
    // Fetch lineup entries for this player
    const lineupEntries = await db.select().from(matchLineup).where(eq(matchLineup.playerId, playerId));
    // Fetch goals for this player
    const goalEntries = await db.select().from(matchGoals).where(eq(matchGoals.playerId, playerId));

    const convocatedMatchIds = new Set(convocationEntries.map(c => c.matchId));
    const lineupByMatch = new Map(lineupEntries.map(l => [l.matchId, l]));

    let convocazioni = convocatedMatchIds.size;
    let titolare = 0;
    let presenze = 0; // titolari + subentrati
    let minutesTotal = 0;
    let goalsScored = 0;
    let yellowCards = 0;
    let redCards = 0;
    let injuries = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;

    // Match history entries
    const matchHistory: { matchId: string; opponent: string; date: string; competition: string | null; role: 'titolare' | 'subentrato' | 'panchina' | null; goalsFor: number | null; goalsAgainst: number | null; yellowCard: boolean; redCard: boolean; goalsScored: number }[] = [];

    for (const match of allMatches) {
      const inLineup = lineupByMatch.has(match.id);
      const inConvocation = convocatedMatchIds.has(match.id);
      const substitutions: any[] = safeParseJSON(match.substitutions);
      const cards: any[] = safeParseJSON(match.cards);

      const subOut = substitutions.find((s: any) => s.playerOutId === playerId);
      const subIn = substitutions.find((s: any) => s.playerInId === playerId);

      let minutesPlayed = 0;
      let role: 'titolare' | 'subentrato' | 'panchina' | null = null;

      if (inLineup) {
        titolare++;
        presenze++;
        role = 'titolare';
        if (subOut) {
          minutesPlayed = subOut.minute ?? 90;
        } else {
          minutesPlayed = 90;
        }
      } else if (subIn) {
        presenze++;
        role = 'subentrato';
        const minuteIn = subIn.minute ?? 60;
        const minuteOut = subOut?.minute ?? 90;
        minutesPlayed = minuteOut - minuteIn;
      } else if (inConvocation) {
        role = 'panchina';
      }

      minutesTotal += minutesPlayed;

      // Cards for this match
      let matchYellow = false;
      let matchRed = false;
      for (const card of cards) {
        if (card.playerId === playerId) {
          if (card.type === 'yellow') { yellowCards++; matchYellow = true; }
          else if (card.type === 'red') { redCards++; matchRed = true; }
          else if (card.type === 'injury') injuries++;
        }
      }

      // Goals in this match
      const matchGoalsScored = goalEntries.filter(g => g.matchId === match.id && g.type !== 'autogoal').length;

      // Win/draw/loss (only if player played)
      if ((inLineup || subIn) && match.goalsFor != null && match.goalsAgainst != null) {
        if (match.goalsFor > match.goalsAgainst) wins++;
        else if (match.goalsFor === match.goalsAgainst) draws++;
        else losses++;
      }

      if (inLineup || subIn || inConvocation) {
        matchHistory.push({
          matchId: match.id,
          opponent: match.opponent,
          date: match.date,
          competition: match.competition ?? null,
          role,
          goalsFor: match.goalsFor ?? null,
          goalsAgainst: match.goalsAgainst ?? null,
          yellowCard: matchYellow,
          redCard: matchRed,
          goalsScored: matchGoalsScored,
        });
      }
    }

    // Goals (only non-autogoal)
    goalsScored = goalEntries.filter(g => g.type !== 'autogoal').length;

    // Sort history by date desc
    matchHistory.sort((a, b) => b.date.localeCompare(a.date));

    return c.json({
      convocazioni,
      titolare,
      presenze,
      minutesTotal,
      goalsScored,
      yellowCards,
      redCards,
      injuries,
      wins,
      draws,
      losses,
      matchHistory,
    }, 200);
  })
  .delete('/players/:id', authMiddleware, async (c) => {
    const id = c.req.param('id');
    await db.delete(players).where(eq(players.id, id));
    return c.json({ success: true }, 200);
  })

  // ─── SESSIONS ──────────────────────────────────────────────────────────────
  .get('/sessions', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const all = await db.select().from(sessions).where(eq(sessions.userId, userId));
    return c.json(all, 200);
  })
  .get('/sessions/:id', authMiddleware, async (c) => {
    const id = c.req.param('id');
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    if (!session) return c.json({ error: 'not found' }, 404);
    const exs = await db
      .select()
      .from(sessionExercises)
      .where(eq(sessionExercises.sessionId, id));
    const exerciseIds = exs.map(e => e.exerciseId);
    let exerciseDetails: any[] = [];
    if (exerciseIds.length > 0) {
      exerciseDetails = await db.select().from(exercises).where(inArray(exercises.id, exerciseIds));
    }
    const items = exs.map(e => ({
      ...e,
      exercise: exerciseDetails.find(ex => ex.id === e.exerciseId),
    }));
    return c.json({ ...session, exercises: items }, 200);
  })
  .post('/sessions', authMiddleware, async (c) => {
    const body = await c.req.json();
    const userId = c.get('userId');
    const session = {
      id: randomUUID(),
      userId,
      title: body.title,
      date: body.date,
      duration: body.duration ?? null,
      notes: body.notes ?? null,
      createdAt: Date.now(),
    };
    await db.insert(sessions).values(session);
    if (body.exercises && Array.isArray(body.exercises)) {
      const items = body.exercises.map((e: any, i: number) => ({
        id: randomUUID(),
        sessionId: session.id,
        exerciseId: e.exerciseId,
        order: i,
        customDuration: e.customDuration ?? null,
        notes: e.notes ?? null,
      }));
      if (items.length > 0) await db.insert(sessionExercises).values(items);
    }
    return c.json(session, 201);
  })
  .post('/sessions/:id/exercises', authMiddleware, async (c) => {
    const sessionId = c.req.param('id');
    const body = await c.req.json(); // { exerciseId, order, customDuration?, notes? }
    const item = {
      id: randomUUID(),
      sessionId,
      exerciseId: body.exerciseId,
      order: body.order ?? 0,
      customDuration: body.customDuration ?? null,
      notes: body.notes ?? null,
    };
    await db.insert(sessionExercises).values(item);
    return c.json(item, 201);
  })
  .delete('/sessions/:id', authMiddleware, async (c) => {
    const id = c.req.param('id');
    await db.delete(sessions).where(eq(sessions.id, id));
    return c.json({ success: true }, 200);
  })

  // ─── MATCHES ───────────────────────────────────────────────────────────────
  .get('/matches', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const all = await db.select().from(matches).where(eq(matches.userId, userId));
    all.sort((a, b) => (a.date < b.date ? 1 : -1));
    return c.json(all, 200);
  })
  .get('/matches/:id', authMiddleware, async (c) => {
    const id = c.req.param('id');
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    if (!match) return c.json({ error: 'not found' }, 404);

    const convocations = await db.select().from(matchConvocations).where(eq(matchConvocations.matchId, id));
    const lineup = await db.select().from(matchLineup).where(eq(matchLineup.matchId, id));
    const goals = await db.select().from(matchGoals).where(eq(matchGoals.matchId, id));

    const allPlayerIds = [...new Set([
      ...convocations.map(c => c.playerId),
      ...lineup.map(l => l.playerId),
      ...goals.map(g => g.playerId).filter(Boolean),
    ])] as string[];

    let playerDetails: any[] = [];
    if (allPlayerIds.length > 0) {
      playerDetails = await db.select().from(players).where(inArray(players.id, allPlayerIds));
    }

    return c.json({
      ...match,
      substitutions: safeParseJSON(match.substitutions),
      cards: safeParseJSON(match.cards),
      convocations: convocations.map(cv => ({
        ...cv,
        player: playerDetails.find(p => p.id === cv.playerId),
      })),
      lineup: lineup.map(l => ({
        ...l,
        player: playerDetails.find(p => p.id === l.playerId),
      })),
      goals: goals.map(g => ({
        ...g,
        player: g.playerId ? playerDetails.find(p => p.id === g.playerId) : null,
      })),
    }, 200);
  })
  .post('/matches', authMiddleware, async (c) => {
    const body = await c.req.json();
    const userId = c.get('userId');
    const match = {
      id: randomUUID(),
      userId,
      opponent: body.opponent,
      date: body.date,
      time: body.time ?? null,
      venue: body.venue ?? null,
      homeAway: body.homeAway ?? 'home',
      competition: body.competition ?? null,
      formation: body.formation ?? null,
      notes: body.notes ?? null,
      goalsFor: body.goalsFor ?? null,
      goalsAgainst: body.goalsAgainst ?? null,
      createdAt: Date.now(),
    };
    await db.insert(matches).values(match);
    return c.json(match, 201);
  })
  .put('/matches/:id', authMiddleware, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    // Only update fields explicitly provided in body (PATCH semantics)
    const patch: Record<string, any> = {};
    if ('opponent' in body) patch.opponent = body.opponent;
    if ('date' in body) patch.date = body.date;
    if ('time' in body) patch.time = body.time ?? null;
    if ('venue' in body) patch.venue = body.venue ?? null;
    if ('homeAway' in body) patch.homeAway = body.homeAway ?? 'home';
    if ('competition' in body) patch.competition = body.competition ?? null;
    if ('formation' in body) patch.formation = body.formation ?? null;
    if ('notes' in body) patch.notes = body.notes ?? null;
    if ('goalsFor' in body) patch.goalsFor = body.goalsFor ?? null;
    if ('goalsAgainst' in body) patch.goalsAgainst = body.goalsAgainst ?? null;
    if ('substitutions' in body) patch.substitutions = body.substitutions != null ? JSON.stringify(body.substitutions) : null;
    if (Object.keys(patch).length > 0) {
      await db.update(matches).set(patch).where(eq(matches.id, id));
    }
    return c.json({ success: true }, 200);
  })
  .delete('/matches/:id', authMiddleware, async (c) => {
    const id = c.req.param('id');
    await db.delete(matches).where(eq(matches.id, id));
    return c.json({ success: true }, 200);
  })

  // Convocations
  .put('/matches/:id/convocations', authMiddleware, async (c) => {
    const matchId = c.req.param('id');
    const body = await c.req.json(); // { playerIds: string[], jerseyNumbers?: Record<string,string> }
    const jerseyNumbers: Record<string, string> = body.jerseyNumbers ?? {};
    await db.delete(matchConvocations).where(eq(matchConvocations.matchId, matchId));
    if (body.playerIds && body.playerIds.length > 0) {
      await db.insert(matchConvocations).values(
        body.playerIds.map((pid: string) => ({
          id: randomUUID(),
          matchId,
          playerId: pid,
          jerseyNumber: jerseyNumbers[pid] ? parseInt(jerseyNumbers[pid]) : null,
        }))
      );
    }
    return c.json({ success: true }, 200);
  })

  // Lineup
  .put('/matches/:id/lineup', authMiddleware, async (c) => {
    const matchId = c.req.param('id');
    const body = await c.req.json(); // { players: LineupPlayer[] }
    await db.delete(matchLineup).where(eq(matchLineup.matchId, matchId));
    if (body.players && body.players.length > 0) {
      await db.insert(matchLineup).values(
        body.players.map((p: any, i: number) => ({
          id: randomUUID(),
          matchId,
          playerId: p.playerId,
          positionRole: p.positionRole ?? null,
          jerseyNumber: p.jerseyNumber ?? null,
          isCaptain: p.isCaptain ?? false,
          isViceCaptain: p.isViceCaptain ?? false,
          isFreekickTaker: p.isFreekickTaker ?? false,
          isCornerTaker: p.isCornerTaker ?? false,
          isPenaltyTaker: p.isPenaltyTaker ?? false,
          isWallPlayer: p.isWallPlayer ?? false,
          posX: p.posX ?? null,
          posY: p.posY ?? null,
          order: i,
        }))
      );
    }
    return c.json({ success: true }, 200);
  })

  // Goals
  .put('/matches/:id/goals', authMiddleware, async (c) => {
    const matchId = c.req.param('id');
    const body = await c.req.json(); // { goals: Goal[] }
    await db.delete(matchGoals).where(eq(matchGoals.matchId, matchId));
    if (body.goals && body.goals.length > 0) {
      await db.insert(matchGoals).values(
        body.goals.map((g: any) => ({
          id: randomUUID(),
          matchId,
          playerId: g.playerId ?? null,
          minute: g.minute ?? null,
          type: g.type ?? 'goal',
          notes: g.notes ?? null,
        }))
      );
    }
    // Update score on match
    const autoGoalCount = body.goals.filter((g: any) => g.type === 'autogoal').length;
    const ownGoalCount = body.goals.filter((g: any) => g.type !== 'autogoal').length;
    const computedFor = ownGoalCount;
    const finalGoalsFor = body.goalsFor != null ? Number(body.goalsFor) : computedFor;
    const finalGoalsAgainst = body.goalsAgainst != null ? Number(body.goalsAgainst) : null;
    await db.update(matches).set({
      goalsFor: finalGoalsFor,
      goalsAgainst: finalGoalsAgainst,
    }).where(eq(matches.id, matchId));
    return c.json({ success: true }, 200);
  })

  .delete('/matches/:matchId/goals/:goalId', authMiddleware, async (c) => {
    const { matchId, goalId } = c.req.param();
    await db.delete(matchGoals).where(
      and(eq(matchGoals.id, goalId), eq(matchGoals.matchId, matchId))
    );
    return c.json({ success: true }, 200);
  })
  .delete('/goals/:goalId', authMiddleware, async (c) => {
    const goalId = c.req.param('goalId');
    await db.delete(matchGoals).where(eq(matchGoals.id, goalId));
    return c.json({ success: true }, 200);
  })

  // Substitutions
  .put('/matches/:id/substitutions', authMiddleware, async (c) => {
    const matchId = c.req.param('id');
    const body = await c.req.json(); // { substitutions: [{playerOutId,playerInId,minute}] }
    await db.update(matches).set({
      substitutions: JSON.stringify(body.substitutions ?? []),
    }).where(eq(matches.id, matchId));
    return c.json({ success: true }, 200);
  })
  // Cards / Injuries
  .put('/matches/:id/cards', authMiddleware, async (c) => {
    const matchId = c.req.param('id');
    const body = await c.req.json(); // { cards: [{playerId,type,minute,notes}] }
    await db.update(matches).set({
      cards: JSON.stringify(body.cards ?? []),
    }).where(eq(matches.id, matchId));
    return c.json({ success: true }, 200);
  });

export type AppType = typeof app;
export default app;
