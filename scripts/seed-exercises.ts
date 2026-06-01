/**
 * MEGA SEED — Libreria esercitazioni CoachBoard
 * Esegui con: bun run scripts/seed-exercises.ts
 * Inserisce direttamente nel DB Turso senza passare dall'API
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { exercises } from './schema-ref';
import { randomUUID } from 'crypto';

// Carica env dalla root
import { config } from 'dotenv';
config({ path: '/home/user/coachboard/.env' });

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN!,
});
const db = drizzle(client);

const now = Date.now();
const r = () => randomUUID();

const newExercises = [

  // ════════════════════════════════════════════════════════════════
  // RISCALDAMENTO (10 esercizi)
  // ════════════════════════════════════════════════════════════════
  {
    id: r(), name: 'Psicocinesi con variazioni cromatiche', nameEn: 'Psychokinetic warmup with colour cues',
    category: 'riscaldamento',
    description: 'Griglia 20x20m con 4 zone colorate (coni colorati agli angoli). Giocatori si muovono liberamente palleggiando. Allenatore chiama un colore: tutti devono raggiungere la zona corrispondente entro 3 secondi mantenendo il controllo della palla. Progressione: doppia chiamata (zona+azione es. "rosso+colpo di testa"), poi chiamata inversa ("NON blu" = vanno ovunque tranne blu). Sviluppa orientamento spaziale, attenzione selettiva e coordinazione in movimento.',
    descriptionEn: 'Grid 20x20m with 4 colour zones. Players move freely juggling. Coach calls a colour: all must reach that zone within 3s keeping ball control. Progression: double call (zone+action), then inverse call.',
    primaryObjective: 'Sviluppare attenzione selettiva e orientamento spaziale sotto carico cognitivo durante il riscaldamento',
    secondaryObjectives: JSON.stringify(['Coordinazione oculo-podalica in movimento', 'Reattività agli stimoli visivi', 'Controllo palla in condizioni di pressione temporale', 'Comunicazione non verbale tra compagni']),
    duration: 12, players: 12, intensity: 'media', materials: 'palle (1 per giocatore), coni colorati (4 colori)', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Circuito mobilità articolare con palla', nameEn: 'Articular mobility circuit with ball',
    category: 'riscaldamento',
    description: 'Percorso lineare 30m con 6 stazioni: (1) skip basso con palleggio piede-coscia alternato; (2) corsa laterale con tocchi laterali della palla; (3) affondi frontali con palla tenuta sopra la testa; (4) rotazione busto 90° con passaggio a specchio contro tabellone; (5) mobilità anca "gate opener" poi sprint su 5m; (6) stretching dinamico ischio-crurali con palla tra le mani. 3 giri con pausa 90". Lavoro complementare a qualsiasi sessione.',
    descriptionEn: '30m linear course, 6 stations: skip-juggle, lateral run with ball touches, lunges with ball overhead, torso rotation passes, hip gate openers+sprint, dynamic hamstring stretch.',
    primaryObjective: 'Preparare le catene muscolari del calciatore attraverso mobilità articolare progressiva con la palla',
    secondaryObjectives: JSON.stringify(['Prevenzione infortuni muscolari', 'Attivazione propriocettiva', 'Coordinazione segmentaria', 'Riscaldamento specifico per il calcio']),
    duration: 18, players: 16, intensity: 'bassa', materials: 'palle, coni, tabellone rimbalzo (opzionale)', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Rondo 4+2vs2 a tema uscita', nameEn: 'Rondo 4+2vs2 with exit theme',
    category: 'riscaldamento',
    description: 'Quadrato 12x12m. 4 giocatori esterni + 2 jolly centrali vs 2 pressatori. Il possesso vale 1 punto; se i 2 jolly ricevono e si girano superando la linea opposta = 2 punti (simulazione uscita dalla pressione). Turni da 3 minuti, rotazione pressatori. Vincolo progressivo: prima libero, poi massimo 2 tocchi per esterni e tocco singolo per jolly. Esercitazione usata dal Barcellona B e dal Bayer Leverkusen come attivazione tattico-tecnica.',
    descriptionEn: '12x12m square. 4 outer players + 2 jokers vs 2 pressers. Possession = 1pt; jokers turn and cross line = 2pts. 3-min rounds. Constraint progression: free → max 2 touches → 1 touch jokers.',
    primaryObjective: 'Attivare meccanismi di possesso e uscita dalla pressione in forma giocata durante il riscaldamento',
    secondaryObjectives: JSON.stringify(['Velocità di gioco 1-2 tocchi', 'Orientamento del corpo per giocare in avanti', 'Pressing coordinato in coppia', 'Transizione da difesa ad attacco']),
    duration: 15, players: 8, intensity: 'media', materials: 'palla, coni (quadrato 12x12)', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Activación dinámica FIFA 11+', nameEn: 'FIFA 11+ Dynamic Activation Protocol',
    category: 'riscaldamento',
    description: 'Protocollo FIFA 11+ adattato al calcio di campo: (1) corsa lenta 8 minuti con variazioni (laterale, incrociato, salto, sprint); (2) 6 esercizi di forza e stabilità: piegamenti nordici, Copenhagen plank laterale, squat monopodalico su 3 serie; (3) corsa con accelerazioni progressive 60-80-100%. Ogni fase ha indicatori di qualità esecutiva da monitorare. Riduce del 30-50% il rischio infortuni se eseguito sistematicamente (studi FIFA/UEFA 2014-2022).',
    descriptionEn: 'FIFA 11+ protocol adapted for field football: slow run with variations, 6 strength/stability exercises (Nordic curls, Copenhagen plank, single-leg squat), progressive acceleration runs.',
    primaryObjective: 'Ridurre il rischio di infortuni muscolari e legamentosi attraverso il protocollo scientifico FIFA 11+',
    secondaryObjectives: JSON.stringify(['Attivazione muscoli stabilizzatori', 'Forza eccentrica ischio-crurali', 'Propriocezione caviglia e ginocchio', 'Cultura della prevenzione nel gruppo']),
    duration: 20, players: 16, intensity: 'bassa', materials: 'palle, coni, ostacoli bassi', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Futebol de esquema — riscaldamento brasiliano', nameEn: 'Brazilian scheme football warmup',
    category: 'riscaldamento',
    description: 'Metodo di riscaldamento ispirato alla Seleção Brasileira: coppie a 10m si scambiano la palla in sequenze codificate. Schema A: interno-esterno-tacco-colpo di testa. Schema B: triangolo con terzo uomo in movimento. Schema C: dai e vai con finta nel mezzo. Ogni schema dura 3 minuti. Nessuna pausa tra schemi, solo cambio ritmo. Finalità: attivazione tecnica profonda, riscaldamento mentale e senso del ritmo collettivo.',
    descriptionEn: 'Pairs at 10m exchanging ball in coded sequences. Scheme A: inside-outside-heel-header. Scheme B: triangle with moving third man. Scheme C: give-and-go with feint. 3 min each scheme.',
    primaryObjective: 'Attivare tecnica individuale e senso del ritmo collettivo attraverso sequenze codificate brasiliane',
    secondaryObjectives: JSON.stringify(['Tocco di prima intenzione', 'Temporizzazione del movimento senza palla', 'Colpo di testa tecnico', 'Senso del ritmo collettivo']),
    duration: 12, players: 14, intensity: 'media', materials: 'palle (1 ogni 2 giocatori), coni', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Labirinto cognitivo con numerazione', nameEn: 'Cognitive labyrinth with numbering',
    category: 'riscaldamento',
    description: 'Griglia 15x15m con 8 coni numerati disposti casualmente. Giocatori in palleggio individuale devono toccare i coni in ordine crescente (1→8) poi decrescente. Progressione 1: toccano con piede destro i dispari e sinistro i pari. Progressione 2: allenatore chiama "+2" e devono sommare (es. partono da 3, vanno a 5, poi 7). Progressione 3: con un compagno, uno tocca pari e l'altro dispari, comunicandosi la sequenza. Esercizio ispirato al metodo cognitivo di Marcelo Bielsa.',
    descriptionEn: 'Grid with 8 numbered cones. Players juggle and touch cones in ascending/descending order. Progressions: foot-number pairing, mental arithmetic, partner coordination.',
    primaryObjective: 'Attivare le funzioni cognitive superiori (calcolo, memoria di lavoro, attenzione divisa) durante il riscaldamento',
    secondaryObjectives: JSON.stringify(['Controllo palla automatizzato', 'Orientamento spaziale', 'Comunicazione tra compagni', 'Doppio compito motorio-cognitivo']),
    duration: 10, players: 12, intensity: 'bassa', materials: 'palle (1 per giocatore), coni numerati 1-8', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Riscaldamento differenziato per ruolo', nameEn: 'Role-specific differentiated warmup',
    category: 'riscaldamento',
    description: 'Tre stazioni simultanee specializzate per ruolo: DIFENSORI (coni 1-6): scivolate laterali + marcatura sull\'uomo + colpi di testa difensivi in coppia. CENTROCAMPISTI (coni 7-12): ricezione con orientamento + passaggio filtrante + transizione. ATTACCANTI (coni 13-18): controllo-tiro + stop-e-gira + 1vs1 contro portiere. Rotazione ogni 6 minuti. Ultimo blocco (5 min): assembramento con palla in gioco libero. Massimizza specificità del riscaldamento per posizione.',
    descriptionEn: 'Three simultaneous role-specific stations. Defenders: lateral slides, marking, defensive headers. Midfielders: oriented reception, through balls, transition. Attackers: control-shot, turn, 1v1.',
    primaryObjective: 'Preparare ogni ruolo con gesti tecnico-tattici specifici per massimizzare la qualità dell\'allenamento successivo',
    secondaryObjectives: JSON.stringify(['Specificità del riscaldamento per ruolo', 'Efficienza del tempo di sessione', 'Attivazione mentale contestuale', 'Interazione GK-difensori-attaccanti']),
    duration: 22, players: 16, intensity: 'media', materials: 'palle multiple, coni, porte piccole', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Passing square a 4 con incrocio', nameEn: 'Passing square of 4 with crossing runs',
    category: 'riscaldamento',
    description: 'Quadrato 10x10m, un giocatore per angolo + una riserva per lato. Sequenza fissa: A passa a B, A va in diagonale al posto di C, C parte al posto di B, B passa a D appena A ha incrociato. Movimento continuo senza stop. 4 varianti: (1) di prima; (2) con controllo orientato; (3) con finta prima del passaggio; (4) con sovrapposizione esterna. Usato dal Valencia CF e dal Benfica come attivatore tecnico pre-sessione. Richiede concentrazione costante sulla posizione dei compagni.',
    descriptionEn: '10x10m square. Fixed sequence: pass and diagonal run crossing with teammates. 4 variants: first touch, oriented control, feint before pass, overlap.',
    primaryObjective: 'Attivare meccanismi di movimento senza palla sincronizzati con il passaggio attraverso schemi codificati',
    secondaryObjectives: JSON.stringify(['Timing del movimento', 'Passaggio preciso in movimento', 'Comunicazione non verbale', 'Automatismi combinativi']),
    duration: 10, players: 8, intensity: 'media', materials: 'palle, coni (quadrato 10x10)', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Obstacle course con palla al piede', nameEn: 'Ball at feet obstacle course',
    category: 'riscaldamento',
    description: 'Percorso 25m: (1) dribbling slalom 6 coni stretti (passo); (2) tunnel sotto birilli alti con la palla; (3) saltelli laterali su linea mantenendo palla incollata al piede; (4) stop su segnale visivo (allenatore alza cartellino colorato); (5) passaggio a bersaglio (cerchio a terra 3m). Eseguito a coppie in competizione cronometrata. Il perso fa 10 flessioni. Gamification del riscaldamento: aumenta motivazione e intensità nella fase di attivazione.',
    descriptionEn: '25m course: slalom dribble, low tunnel, lateral hops with ball, visual stop signal, target pass. Done in timed pairs. Loser does 10 push-ups. Gamified warmup.',
    primaryObjective: 'Elevare l\'intensità motivazionale del riscaldamento attraverso competizione cronometrata con la palla al piede',
    secondaryObjectives: JSON.stringify(['Dribbling in velocità', 'Reattività agli stimoli visivi', 'Controllo palla ad alta intensità', 'Spirito competitivo']),
    duration: 14, players: 16, intensity: 'media', materials: 'palle, coni, birilli, cartellini colorati', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Tic-tac-toe umano con palla', nameEn: 'Human tic-tac-toe with ball',
    category: 'riscaldamento',
    description: 'Griglia 3x3 di cerchi a terra (o coni) distanziati 3m l\'uno dall\'altro. Due squadre di 4 (uno in panchina). A turno un giocatore prende una palla, esegue 5 palleggi e poi occupa un cerchio. Vince chi fa tris. Regola: non si può stare fermo — chi è in campo deve sempre muoversi sul posto. Chi sbaglia il palleggio (palla a terra) deve tornare in fondo e rimandare il compagno. Sviluppa attenzione tattica, palleggio sotto pressione e spirito di squadra.',
    descriptionEn: '3x3 grid of circles. Teams alternate: player does 5 juggles then occupies a circle. First to get three in a row wins. Players in field must keep moving. Drop ball = restart.',
    primaryObjective: 'Sviluppare attenzione tattica e palleggio sotto pressione in forma ludico-competitiva',
    secondaryObjectives: JSON.stringify(['Palleggio controllato', 'Pensiero strategico', 'Comunicazione tra compagni', 'Spirito di squadra']),
    duration: 10, players: 8, intensity: 'bassa', materials: 'palle, coni o cerchi a terra (9)', isCustom: false, createdAt: now,
  },

  // ════════════════════════════════════════════════════════════════
  // TECNICA (12 esercizi)
  // ════════════════════════════════════════════════════════════════
  {
    id: r(), name: 'Controllo orientato Coerver avanzato', nameEn: 'Advanced Coerver oriented control',
    category: 'tecnica',
    description: 'Metodologia Coerver applicata al controllo orientato. Coppie a 15m con 2 coni separati 2m davanti ad ogni giocatore (porta di controllo). A calcia verso B — B deve controllare passando attraverso uno dei due coni (scelta in base al colore che A indica con la mano al momento del passaggio). Progressioni: (1) controllo + passaggio di prima verso terzo uomo; (2) controllo + dribbling verso porta piccola; (3) controllo + finta Cruyff + tiro. L\'orientamento del corpo prima di ricevere è il focus principale.',
    descriptionEn: 'Coerver method for oriented control. Pairs at 15m with 2-cone gate. A passes to B — B controls through one cone based on A\'s hand signal. Progressions: control+layoff, control+dribble to mini-goal, control+Cruyff turn+shot.',
    primaryObjective: 'Automatizzare il controllo orientato con scelta pre-cognitiva del lato, fondamentale per il gioco rapido',
    secondaryObjectives: JSON.stringify(['Postura del corpo in ricezione', 'Lettura del segnale visivo ante-ricezione', 'Transizione controllo-azione', 'Velocità di decisione']),
    duration: 20, players: 10, intensity: 'media', materials: 'palle, coni (porte 2m), porte piccole', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Wall passing a specchio — 1000 tocchi', nameEn: 'Mirror wall passing — 1000 touches',
    category: 'tecnica',
    description: 'Esercitazione individuale con tabellone rimbalzo (o muro). Protocollo: (1) passaggi interni 30 secondi dx; (2) passaggi interni 30s sx; (3) interni alternati; (4) esterni dx; (5) esterni sx; (6) alternati dx-sx; (7) punta del piede; (8) tacco; (9) ginocchio; (10) testa. 3 serie complete. Obiettivo: ~1000 tocchi per sessione. Usato da Ronaldo (Fenomeno) e ribattezzato nel calcio moderno come "paredes" dai tecnici spagnoli. Sviluppa sensibilità del tocco e automatismo del gesto.',
    descriptionEn: 'Individual wall-passing protocol: 10 surfaces (inside R/L, alternate, outside R/L, alternate, toe, heel, knee, head). 30s each, 3 sets. Target ~1000 touches per session.',
    primaryObjective: 'Costruire automatismo e sensibilità del tocco su tutte le superfici del piede attraverso volume di ripetizioni',
    secondaryObjectives: JSON.stringify(['Tecnica del passaggio con interni', 'Coordinazione bilaterale piede debole', 'Controllo anticipato', 'Disciplina e concentrazione individuale']),
    duration: 25, players: 1, intensity: 'media', materials: 'palla, tabellone rimbalzo o muro', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Dribbling 1vs1 con porta laterale', nameEn: '1v1 dribbling with lateral mini-goal',
    category: 'tecnica',
    description: 'Corridoio 10x5m. Attaccante parte con palla dal lato corto, difensore affronta in posizione difensiva. Due porte piccole (1.5m) sui lati lunghi. L\'attaccante deve dribblare e segnare in una delle porte laterali; il difensore deve indirizzare verso il lato sbagliato e recuperare. Rotazione ogni 2 minuti. Progressione: attaccante deve toccare il cono centrale prima di attaccare la porta; poi divieto di usare la mano debole (forza l\'uso del piede non dominante). Sviluppa il 1vs1 in spazi stretti.',
    descriptionEn: '10x5m corridor. Attacker starts with ball vs defender. Two mini-goals on long sides. Attacker dribbles to score on either side. Progression: touch center cone first; then weak-foot only.',
    primaryObjective: 'Sviluppare la capacità di superare l\'uomo in spazi stretti con cambi di direzione esplosivi e lettura del difensore',
    secondaryObjectives: JSON.stringify(['Cambio di direzione con palla', 'Lettura del centro di gravità del difensore', 'Accelerazione post-dribbling', 'Piede debole in conduzione']),
    duration: 18, players: 2, intensity: 'alta', materials: 'palla, coni, 2 porte piccole 1.5m', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Passaggio filtrante in corsa — linee spezzate', nameEn: 'Through pass in motion — broken lines',
    category: 'tecnica',
    description: 'Tre linee parallele di coni a 10m l\'una dall\'altra. Giocatore A è sulla linea 1, B sulla linea 2 (di lato), C sulla linea 3 (di fronte). A passa filtrante a C che scatta tra due coni della linea 2 (corridoio 3m); B deve aver già liberato il corridoio con finta verso l\'esterno. C controlla, gira e passa a B che è entrato in corsa. B finalizza. Sequenza rotante ogni 3 azioni. Sviluppa timing del passaggio filtrante, movimento senza palla e finalizzazione.',
    descriptionEn: 'Three parallel cone lines 10m apart. A plays through ball to C cutting between line-2 cones (B clears with decoy run). C controls, turns, passes to B running in. B finishes.',
    primaryObjective: 'Affinare il passaggio filtrante temporizzato con movimento senza palla coordinato e finalizzazione',
    secondaryObjectives: JSON.stringify(['Qualità del filtrante in corsa', 'Timing del taglio', 'Finta per liberare corridoio', 'Finalizzazione dopo ricezione in corsa']),
    duration: 20, players: 9, intensity: 'media', materials: 'palle, coni, porta', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Colpo di testa — circuito a 5 stazioni', nameEn: 'Heading circuit — 5 stations',
    category: 'tecnica',
    description: 'Circuito 5 stazioni (2 min ciascuna, riposo 30"): (1) testa a rimbalzo contro muro a 3m — continuità ritmica; (2) cross basso → salto di anticipo → testata verso porta; (3) colpo di testa difensivo di allontanamento da pallone alzato da compagno; (4) duello aereo 1vs1 su cross del mister; (5) gioco di testa a coppie in spazio 5x5m (no piedi). Focus tecnico: uso del collo, apertura occhi, timing del salto, rotazione del busto. Progressione: testata con deviazione angolata.',
    descriptionEn: '5-station heading circuit (2 min each, 30" rest): wall-bounce continuity, cross-jump-header to goal, defensive clearance header, aerial 1v1 on cross, head-only 5v5.',
    primaryObjective: 'Sviluppare la tecnica del colpo di testa in tutte le sue varianti: offensivo, difensivo, di deviazione e duello aereo',
    secondaryObjectives: JSON.stringify(['Timing del salto', 'Uso corretto del collo', 'Colpo di testa difensivo di allontanamento', 'Duello aereo 1vs1']),
    duration: 20, players: 14, intensity: 'alta', materials: 'palle, coni, porta, muro/tabellone', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Tiro in caduta — volée e rovesciata tecnica', nameEn: 'Falling shot — volley and bicycle kick technique',
    category: 'tecnica',
    description: 'Esercitazione progressiva per finalizzatori: (1) tiro di volée frontale su pallone alzato dal compagno a 1m — focus su piede di appoggio e superficie di contatto; (2) volée di mezza altezza con approccio laterale; (3) volée di esterno con aggancio sulla linea d\'area; (4) rovesciata tecnica su pallone alzato lentamente a 1.5m dal petto (solo tecnica, nessun rischio fisico). Materassino protettivo per rovesciate. Ogni giocatore 5 tentativi per variante. Progressione: esecuzione con difensore passivo → semi-attivo.',
    descriptionEn: 'Progressive finishing: frontal volley on raised ball, half-volley from side, outside-foot volley, bicycle kick on slow-raised ball. Mat for bicycle kicks. 5 attempts per variant.',
    primaryObjective: 'Sviluppare il tiro di prima intenzione su palla alta nelle sue varianti tecniche avanzate',
    secondaryObjectives: JSON.stringify(['Tecnica della volée frontale', 'Coordinazione con appoggio', 'Coraggio tecnico', 'Rovesciata tecnica in sicurezza']),
    duration: 22, players: 8, intensity: 'media', materials: 'palle, porta, materassino, allenatore alzatore', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Triangolo tecnico con terzo uomo', nameEn: 'Technical triangle with third man run',
    category: 'tecnica',
    description: 'Tre giocatori in triangolo isoscele (10-8-8m). A passa a B, A parte in diagonale verso il vertice opposto. B controlla orientato verso C, passa a C. C vede A in corsa e gioca filtrante per A che finalizza. Rotazione: B diventa A, C diventa B, A (finita corsa) diventa C. 4 varianti: (1) tutto di prima; (2) B finta + gioca; (3) doppio passaggio A-B prima del triangolo; (4) con pressatore sul terzo uomo. Sviluppa i meccanismi del triangolo — base del gioco associativo.',
    descriptionEn: 'Triangle 10-8-8m. A passes to B, A runs diagonal. B controls-turns, passes to C. C sees A running and plays through ball for A to finish. 4 variants: first touch, feint, double pass, with presser.',
    primaryObjective: 'Automatizzare i meccanismi del triangolo con corsa del terzo uomo e filtrante temporizzato',
    secondaryObjectives: JSON.stringify(['Controllo orientato in ricezione', 'Timing della corsa del terzo uomo', 'Passaggio filtrante preciso', 'Finalizzazione in corsa']),
    duration: 18, players: 9, intensity: 'media', materials: 'palle, coni, porta', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Cross e finalizzazione 3 zone', nameEn: 'Crossing and finishing — 3 zone attack',
    category: 'tecnica',
    description: 'Mezza campo con 3 attaccanti posizionati in zona (primo palo, punto di rigore, secondo palo). Crossatore parte dalla fascia, sceglie cross rasoterra, teso o alto. I tre attaccanti interpretano la traiettoria e uno attacca il pallone. Gli altri due devono comunque muoversi per non essere marcabili. Progressione: aggiunta di 2 difensori passivi → semi-attivi → attivi. Variante: crossatore può anche accentrarsi e tirare (intenzione doppia). Tecnica del cross: rincorsa, piede d\'appoggio, superficie, timing.',
    descriptionEn: 'Half-field. 3 attackers in zones (near post, penalty spot, far post). Crosser chooses type of cross (ground, driven, high). Attackers read trajectory. Progression: 0 → 2 passive → active defenders.',
    primaryObjective: 'Sviluppare la tecnica del cross e la lettura delle traiettorie aeree da parte dei finalizzatori',
    secondaryObjectives: JSON.stringify(['Tecnica del cross (3 varianti)', 'Lettura della traiettoria aerea', 'Attacco al primo e secondo palo', 'Movimento degli attaccanti sul cross']),
    duration: 20, players: 7, intensity: 'alta', materials: 'palle multiple, porta, coni di zona', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Stop e tiro da fuori area — tecnica del destro e sinistro', nameEn: 'Control and shoot from outside — both feet',
    category: 'tecnica',
    description: 'Mezzaluna fuori area. Giocatore riceve da centrocampista a 20m, controlla con piede debole e tira con piede forte (o viceversa). Progressione: (1) palla ferma; (2) palla in movimento trasversale; (3) palla in movimento frontale; (4) con pressatore alle spalle. Tecnica del tiro: inclinazione del busto, piede d\'appoggio, impatto sul pallone, follow-through. Variante del mister Guardiola: dopo il tiro il giocatore sprinta verso l\'area per il rebound. 8 tentativi per piede.',
    descriptionEn: 'Outside area crescent. Player receives, controls weak foot, shoots strong foot (or reverse). Progressions: static ball, lateral movement, frontal movement, presser behind. 8 attempts per foot.',
    primaryObjective: 'Sviluppare il tiro da fuori area con entrambi i piedi preceduto da controllo orientato sotto pressione',
    secondaryObjectives: JSON.stringify(['Tecnica del tiro in corsa', 'Controllo con piede debole', 'Piede d\'appoggio e inclinazione busto', 'Rebound e seconda palla']),
    duration: 25, players: 12, intensity: 'alta', materials: 'palle multiple, porta, coni mezzaluna', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Conduzione di velocità e cambio di passo', nameEn: 'Speed dribbling and change of pace',
    category: 'tecnica',
    description: 'Corridoio 40m con 3 zone: zona A (0-15m) conduzione veloce a piede aperto verso esterno; zona B (15-25m) finta e cambio di direzione a 90°; zona C (25-40m) accelerazione esplosiva con palla al piede verso porta. Confronto cronometrato in coppia. Focus tecnico: (1) tocchi lunghi in velocità (non corti); (2) punto di attacco nella finta — spostamento peso prima del cambio; (3) accelerazione post-cambio: primo tocco allungato. Variante: aggiunta di birilli per dribbling slalom nella zona B.',
    descriptionEn: '40m corridor in 3 zones: fast open-foot dribble, feint + 90° direction change, explosive acceleration to goal. Timed in pairs. Technical focus: long touches at speed, weight shift in feint, lengthened first touch post-change.',
    primaryObjective: 'Sviluppare la conduzione di velocità con cambio di passo e cambio di direzione in contesto di accelerazione',
    secondaryObjectives: JSON.stringify(['Conduzione a piede aperto in velocità', 'Tecnica della finta con cambio di peso', 'Accelerazione esplosiva post-cambio', 'Coordinazione in velocità massima']),
    duration: 20, players: 14, intensity: 'alta', materials: 'palle, coni, birilli, porta', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Palla lunga e controllo — lancio del portiere', nameEn: 'Long ball and control — goalkeeper distribution',
    category: 'tecnica',
    description: 'Il portiere lancia lungo (rilancio con le mani o calcio di rinvio) verso l\'attaccante di riferimento posizionato a 40-50m. L\'attaccante deve: (1) orientarsi prima del lancio; (2) ricevere con petto/coscia per abbassare; (3) controllare con il piede e proteggere; (4) giocare in profondità per il compagno che taglia. Variante difensiva: aggiunta di un difensore che va in anticipo. Focus: la tecnica dell\'attaccante nel gioco aereo lungo — spesso trascurata negli allenamenti moderni. Derivato dalla metodologia del Leeds United di Bielsa.',
    descriptionEn: 'GK launches long ball to striker at 40-50m. Striker: orient before launch, receive with chest/thigh, control with foot, play forward for cutting teammate. Defensive variant: add one anticipating defender.',
    primaryObjective: 'Sviluppare la tecnica dell\'attaccante nel ricevere palla lunga: ricezione aerea, protezione e giocata successiva',
    secondaryObjectives: JSON.stringify(['Controllo del petto/coscia su palla alta', 'Protezione della palla sotto pressione', 'Orientamento prima della ricezione', 'Giocata rapida post-controllo']),
    duration: 18, players: 6, intensity: 'media', materials: 'palle, coni, porta, portiere', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Tecnica del pressing individuale — chiusura dello spazio', nameEn: 'Individual pressing technique — space closure',
    category: 'tecnica',
    description: 'Corridoio 15x8m. Un difensore, un attaccante con palla. Il difensore deve avvicinarsi al portatore entro 3 secondi (trigger: palla ricevuta) con corsa orientata — non frontale ma diagonale per chiudere il lato forte. Tecnica del recupero: (1) corsa di avvicinamento rapida ma con rallentamento negli ultimi 3m; (2) baricentro basso; (3) piede di punta verso la palla; (4) spostamento laterale reattivo. L\'attaccante può muoversi solo nel corridoio. Progressione: attaccante ha palla libera; poi può passare a seconda punta oltre la linea.',
    descriptionEn: '15x8m corridor. Defender must close attacker within 3s using diagonal approach run (not frontal). Technique: fast approach, slow last 3m, low center of gravity, toe toward ball, reactive lateral shuffle.',
    primaryObjective: 'Insegnare la tecnica corretta del pressing individuale: approccio diagonale, distanza di sicurezza e baricentro',
    secondaryObjectives: JSON.stringify(['Approccio diagonale al portatore', 'Rallentamento di controllo negli ultimi metri', 'Baricentro basso e piede di punta', 'Lettura del peso dell\'attaccante']),
    duration: 16, players: 8, intensity: 'alta', materials: 'palle, coni (corridoio 15x8)', isCustom: false, createdAt: now,
  },

  // ════════════════════════════════════════════════════════════════
  // TATTICA (12 esercizi)
  // ════════════════════════════════════════════════════════════════
  {
    id: r(), name: 'Costruzione bassa dal portiere 3+GK vs 2', nameEn: 'Low build-up from GK 3+GK vs 2',
    category: 'tattica',
    description: 'Metà campo difensiva. GK + 3 difensori (linea a tre) vs 2 pressatori alti. Obiettivo: uscire dalla pressione e raggiungere la linea di centrocampo (coni) con almeno 5 passaggi. I difensori devono aprirsi largo, il GK decide quando e se entrare nel giro palla. Trigger del pressing avversario: lancio del mister ai 2 pressatori. Progressione: aggiunta di un centrocampista d\'appoggio (4+GK vs 2+1 centrocampista avversario). Metodo derivato dal processo di build-up del Manchester City di Guardiola.',
    descriptionEn: 'Half defensive field. GK + 3 defenders vs 2 high pressers. Objective: exit pressure and reach midfield line with 5+ passes. GK decides when to join circulation. Progression: add a supporting midfielder.',
    primaryObjective: 'Sviluppare la costruzione bassa dal portiere con linea a tre contro pressing alto a due',
    secondaryObjectives: JSON.stringify(['Posizionamento dei difensori in ampiezza', 'Ruolo del portiere nel giro palla', 'Uscita dalla pressione con passaggio preciso', 'Lettura del trigger di pressing avversario']),
    duration: 20, players: 8, intensity: 'media', materials: 'palle, coni, porta, portiere', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Transizione offensiva 5vs5+2 jolly', nameEn: 'Offensive transition 5v5+2 jokers',
    category: 'tattica',
    description: 'Campo 40x30m diviso in due metà. Fase difensiva in una metà (5vs5). Al recupero palla scatta la transizione offensiva: la squadra che recupera ha 6 secondi per varcare la linea di metà campo. Entrati nell\'altra metà si attivano 2 jolly neutrali per i possessori. Obiettivo: finalizzare entro 10 secondi dal recupero. Squadra che perde palla deve difendere con i 5 (senza jolly). Conta il tempo di transizione: bonus se gol in meno di 7 secondi. Sviluppa verticalità e velocità di transizione offensiva.',
    descriptionEn: '40x30m field split in halves. 5v5 in defensive half. On recovery, attacking team has 6s to cross halfway. Past midfield: 2 neutral jokers activate. Score within 10s of recovery. Timed bonus.',
    primaryObjective: 'Sviluppare la velocità e la verticalità della transizione offensiva: da difesa ad attacco entro 10 secondi',
    secondaryObjectives: JSON.stringify(['Reazione immediata al recupero palla', 'Verticalità nella transizione', 'Uso del jolly per creare superiorità numerica', 'Finalizzazione rapida']),
    duration: 25, players: 12, intensity: 'alta', materials: 'palle, coni, 2 porte', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Pressing a zona — trigger e compattezza', nameEn: 'Zonal pressing — trigger and compactness',
    category: 'tattica',
    description: 'Campo 60x40m. 6vs6 con 2 portieri. Si stabilisce 1 trigger di pressing (es. retropassaggio al portiere avversario o ricevuta in fascia dal terzino in posizione chiusa). Al trigger, tutta la squadra avanza di 10-15m in blocco compatto. Obiettivo: recupero entro 6 secondi nel 1/3 campo avversario o allontanamento della palla. Se avversario supera il pressing: tutti rientrano velocemente. Discussione post-esercizio: chi ha visto il trigger? Chi ha reagito correttamente? Basato sulla metodologia del Napoli di Sarri 2017-18.',
    descriptionEn: '60x40m, 6v6+GKs. One pre-defined pressing trigger (e.g. backpass to GK or tight flank receive). On trigger: whole team advances 10-15m in compact block. Goal: win ball in 6s or clear. Debrief: who saw trigger?',
    primaryObjective: 'Sviluppare il pressing coordinato a zona con trigger definito, mantenendo la compattezza del blocco squadra',
    secondaryObjectives: JSON.stringify(['Riconoscimento del trigger di pressing', 'Avanzamento in blocco compatto', 'Pressing ultra-offensivo nel terzo campo avversario', 'Comunicazione e scalamento difensivo']),
    duration: 25, players: 14, intensity: 'alta', materials: 'palle, coni, 2 porte, portieri', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Superiorità numerica in zona: 3vs2+1', nameEn: 'Numerical superiority in zone: 3v2+1',
    category: 'tattica',
    description: 'Zona 20x15m. Tre attaccanti vs 2 difensori + 1 centrocampista difensivo. Gli attaccanti devono creare e sfruttare la superiorità numerica (3vs2) prima che il centrocampista li raggiunga (tempo massimo 5 secondi). Principi: (1) riconoscere chi è libero tra i 3; (2) giocare sulla difesa più lontana dal centrocampista; (3) muovere velocemente per non dare tempo al recupero. Progressione: 4vs3, poi 4vs3+1. Fondamentale per allenare il riconoscimento della superiorità in zona.',
    descriptionEn: '20x15m zone. 3 attackers vs 2 defenders + 1 covering midfielder. Attackers must exploit 3v2 before midfielder arrives (max 5s). Principles: identify free man, play away from cover, quick movement.',
    primaryObjective: 'Allenare il riconoscimento e lo sfruttamento della superiorità numerica in zona prima che il coperturista intervenga',
    secondaryObjectives: JSON.stringify(['Lettura della superiorità numerica', 'Velocità di circolazione palla', 'Movimento senza palla per liberare spazi', 'Decisione rapida del portatore']),
    duration: 18, players: 9, intensity: 'alta', materials: 'palle, coni (zona 20x15), porte piccole', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Difesa della profondità — linea alta e offside', nameEn: 'Depth defence — high line and offside trap',
    category: 'tattica',
    description: 'Campo 60x40m. Linea difensiva a 4 vs 3 attaccanti + centrocampista di supporto. La difesa lavora ad una linea alta (a 40m dalla propria porta). Allenatore lancia palla lunga per l\'attaccante di punta: la linea deve avanzare compatta al momento del lancio (non prima, non dopo) per intrappolare in fuorigioco. Trigger: momento del backswing del piede del lanciatore. Progressione: aggiunta di attaccante che parte in corsa; poi con terzini che possono scappare. Basato sullo studio video del Liverpool di Klopp.',
    descriptionEn: '60x40m. 4-man defensive line vs 3 attackers + support. Line is set high (40m from own goal). Coach plays long ball: line must advance in sync at kick moment to trap offside. Progression: runner, then escaping fullbacks.',
    primaryObjective: 'Sviluppare la gestione della linea difensiva alta con trappola del fuorigioco sincronizzata al momento del lancio',
    secondaryObjectives: JSON.stringify(['Sincronizzazione della linea difensiva', 'Lettura del momento di avanzamento', 'Comunicazione tra i 4 difensori', 'Gestione dello spazio alle spalle']),
    duration: 20, players: 10, intensity: 'media', materials: 'palle, coni, porta, portiere', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Possesso con cambio di fronte obbligatorio', nameEn: 'Possession with mandatory switch of play',
    category: 'tattica',
    description: 'Campo 40x30m. 7vs5 con 2 portieri di rimessa sui lati. Regola: prima di poter segnare nella porta piccola, la squadra in possesso deve aver completato almeno 1 cambio di fronte (passaggio orizzontale di almeno 20m). I 5 difensori devono spostarsi lateralmente seguendo la palla. Se lo spostamento non è simultaneo al cambio = punti bonus per l\'attacco. Allena: ampiezza offensiva, cambio di fronte come principio, pressione laterale difensiva.',
    descriptionEn: '40x30m, 7v5+2 side GKs. Rule: must complete 1 switch of play (20m+ horizontal pass) before scoring. Defenders must shift laterally with ball. Simultaneous shift failure = bonus point for attack.',
    primaryObjective: 'Automatizzare il cambio di fronte come strumento per spostare il blocco difensivo e creare spazi sul lato debole',
    secondaryObjectives: JSON.stringify(['Ampiezza offensiva', 'Cambio di fronte preciso su distanza', 'Spostamento laterale del blocco difensivo', 'Riconoscimento del lato debole']),
    duration: 22, players: 12, intensity: 'alta', materials: 'palle, coni, 4 porte piccole', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Mezzala in proiezione offensiva — inserimento sul 3-5-2', nameEn: 'Mezzala in offensive projection — 3-5-2 insertion',
    category: 'tattica',
    description: 'Mezza campo. Schieramento 3-5-2 in fase offensiva. La mezzala (uno dei due centrocampisti laterali) deve inserirsi tra terzino e centrale avversario quando il terzino alto sale sulla fascia. Meccanismo: (1) terzino alto verticalizza o crossa; (2) la mezzala parte in corsa al momento del passaggio al terzino alto; (3) arriva in area sull\'eventuale respinta. Timing fondamentale: troppo presto = offside; troppo tardi = fuori dall\'azione. Ripetuto 15 volte per lato. Ispirato alla mezzala di Juric/Inter 2023.',
    descriptionEn: '3-5-2 offensive setup. Mezzala inserts between fullback and CB when high wingback overlaps. Mechanism: wingback plays forward, mezzala runs on the pass, arrives in area on clearance. Timing drill × 15 each side.',
    primaryObjective: 'Automatizzare l\'inserimento della mezzala in proiezione offensiva nel 3-5-2 con timing corretto rispetto al terzino alto',
    secondaryObjectives: JSON.stringify(['Timing dell\'inserimento', 'Lettura del movimento del terzino alto', 'Arrivo in area sull\'eventuale respinta', 'Collaborazione mezzala-terzino alto']),
    duration: 20, players: 11, intensity: 'alta', materials: 'palle, coni, porta, portiere', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Pressing coordinato in 4-4-2 — blocco mediano', nameEn: 'Coordinated pressing in 4-4-2 — medium block',
    category: 'tattica',
    description: 'Campo intero. Il 4-4-2 difende a blocco medio (tra le due linee di metà campo e area). Principi: (1) le due punte pressano i centrali difensivi avversari quando ricevono; (2) i centrocampisti scalano sul lato della palla; (3) i terzini salgono sul terzino avversario solo se la palla è sulla loro fascia. Trigger di compressione: retropassaggio al centrale avversario. Allenatore distribuisce palla agli avversari in schemi predefiniti, il 4-4-2 deve adattarsi. Progressione: avversari con jolly laterale.',
    descriptionEn: 'Full field. 4-4-2 medium block. Principles: 2 strikers press CBs on receive, midfielders shift ball-side, fullbacks step up only on their flank. Trigger: backpass to opponent CB. Coach distributes in set patterns.',
    primaryObjective: 'Sviluppare il pressing coordinato del 4-4-2 a blocco medio con scalamenti corretti delle due linee',
    secondaryObjectives: JSON.stringify(['Scalamento della linea di centrocampo', 'Compressione laterale', 'Trigger di pressing sulle retropassaggi', 'Compattezza verticale tra le due linee']),
    duration: 25, players: 14, intensity: 'alta', materials: 'palle, coni, 2 porte, portieri', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Fase offensiva 4-3-3 — attacco alla profondità della seconda punta', nameEn: '4-3-3 offensive phase — second striker depth attack',
    category: 'tattica',
    description: 'Mezza campo offensiva. Il 4-3-3 costruisce dal basso con terzini alti. Il centravanti fissa i centrali avversari. Il trequartista/seconda punta (ala dentro) deve inserirsi in profondità tra terzino e centrale avversario nel momento in cui la mezzala esterna riceve in spazio. Meccanismo codificato: (1) mezzala riceve con campo aperto; (2) seconda punta taglia in profondità diagonale; (3) mezzala serve in profondità o triangola col centravanti. Ripetuto 10 volte per lato. Meccanismo centrale dell\'Ajax di Ten Hag.',
    descriptionEn: '4-3-3 half-field attack. CF pins CBs. Second striker (inside winger) runs in depth between fullback and CB when wide midfielder receives in space. Mechanism × 10 each side. Key Ajax/Ten Hag mechanism.',
    primaryObjective: 'Automatizzare il taglio in profondità della seconda punta nel 4-3-3 sfruttando la ricezione della mezzala esterna',
    secondaryObjectives: JSON.stringify(['Timing del taglio diagonale', 'Lettura della ricezione della mezzala', 'Triangolo CF-seconda punta-mezzala', 'Finalizzazione in profondità']),
    duration: 20, players: 11, intensity: 'alta', materials: 'palle, coni, porta, portiere', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Zona mista 4-2-3-1 — transizione difensiva organizzata', nameEn: '4-2-3-1 mixed zone — organized defensive transition',
    category: 'tattica',
    description: 'Campo intero. Il 4-2-3-1 perde palla in fase offensiva (simulato dal mister). Trigger: fischio. La squadra deve organizzarsi in 4 secondi in un blocco di 8 (trequartista + ala lontana + 2 mediani + 4 difensori) coprendo il centro. Chi è più alto (punta + ala vicina) inizia il ripiegamento ma non deve sprecare energia: deve bloccare linee di passaggio. Principio: non inseguire ma bloccare. Dopo 4 secondi: pressing attivo. Derivato dalla metodologia del Lione di Garcia 2019.',
    descriptionEn: 'Full field. 4-2-3-1 loses ball (simulated). Trigger: whistle. Team must organize in 4s into 8-man block (attacking 3 minus 1 + 2 DMs + 4 defenders) covering center. High players block passing lanes, don\'t chase.',
    primaryObjective: 'Sviluppare la transizione difensiva organizzata del 4-2-3-1: dalla perdita di palla al blocco difensivo in 4 secondi',
    secondaryObjectives: JSON.stringify(['Reazione immediata alla perdita di palla', 'Blocco delle linee di passaggio', 'Compattezza del blocco centrale', 'Coordinamento di squadra in transizione']),
    duration: 22, players: 14, intensity: 'alta', materials: 'palle, coni, 2 porte, portieri', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Gestione del vantaggio — rallentamento con possesso', nameEn: 'Lead management — slowdown through possession',
    category: 'tattica',
    description: 'Campo 40x30m. Squadra A con 1 gol di vantaggio, ultimi 15 minuti. Compito: mantenere il possesso senza rischiare. Principi tattici: (1) allargare il campo usando i terzini; (2) cercare sempre la superiorità numerica locale prima di passare; (3) non fare passaggi verticali rischiosi — solo orizzontali e indietro; (4) forzare l\'avversario ad inseguire e stancarsi. Squadra B deve recuperare con pressing alto urgente. Se A perde palla, -1 punto. Allena la mentalità di gestione del risultato.',
    descriptionEn: 'Small-sided game simulating final 15 min with 1-goal lead. Team A must keep possession safely: widen field, seek local superiority, no risky vertical passes, force opponents to chase.',
    primaryObjective: 'Sviluppare la mentalità e i principi tattici per gestire un vantaggio attraverso il possesso palla sicuro',
    secondaryObjectives: JSON.stringify(['Allargamento del campo in gestione', 'Superiorità numerica locale obbligatoria', 'Passaggi sicuri orizzontali', 'Mentalità di gestione del risultato']),
    duration: 20, players: 12, intensity: 'media', materials: 'palle, coni, 2 porte', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Calcio d\'angolo difensivo — zona vs uomo', nameEn: 'Defensive corner kick — zone vs man marking',
    category: 'tattica',
    description: 'Ripetizione sistematica del calcio d\'angolo difensivo in doppio sistema: (A) ZONA — 4 difensori sulla linea del piccolo area, 2 sui pali, 2 sul limite area; trigger: palla calciata, tutti avanzano verso il punto di atterraggio. (B) UOMO — ogni difensore assegnato a marcatura specifica, più 1 libero. Confronto dei due sistemi sulla stessa squadra attaccante. 8 ripetizioni per sistema. Analisi video post-esercizio se disponibile. Standard dei top club europei nella preseason.',
    descriptionEn: 'Systematic defensive corner repetition in two systems. ZONE: 4 on small-area line + 2 on posts + 2 on edge, advance on kick. MAN: assigned marking + 1 free. Compare systems vs same attacking team. 8 reps each.',
    primaryObjective: 'Sviluppare e confrontare i due sistemi difensivi sui calci d\'angolo: zona pura vs marcatura a uomo',
    secondaryObjectives: JSON.stringify(['Posizionamento nel sistema a zona', 'Marcatura a uomo rigorosa', 'Gestione del secondo pallone', 'Analisi e confronto dei due sistemi']),
    duration: 25, players: 14, intensity: 'media', materials: 'palle, porta, portiere, coni di posizione', isCustom: false, createdAt: now,
  },

  // ════════════════════════════════════════════════════════════════
  // ATLETICO (10 esercizi)
  // ════════════════════════════════════════════════════════════════
  {
    id: r(), name: 'Sprint ripetuti RSA 30-15 con palla', nameEn: 'Repeated Sprint Ability 30-15 with ball',
    category: 'atletico',
    description: 'Protocollo RSA (Repeated Sprint Ability) adattato al calcio: 6 sprint da 30m con recupero 15 secondi passivi. 3 serie con 3 minuti di recupero tra serie. Ogni sprint: partenza da fermo, sprint puro 30m. Nella seconda serie: sprint con palla (conduzione rapida). Nella terza serie: sprint + passaggio terminale a compagno. Monitoraggio: confronto dei tempi di ogni sprint per misurare il decadimento prestativo. Soglia: se 4° sprint > 6% più lento del primo, ridurre il volume.',
    descriptionEn: 'RSA protocol: 6×30m sprints with 15s passive recovery, 3 sets, 3 min between sets. Set 1: pure sprint. Set 2: sprint with ball. Set 3: sprint + terminal pass. Monitor time decay: if 4th sprint >6% slower than 1st, reduce volume.',
    primaryObjective: 'Sviluppare la capacità di sprint ripetuti (RSA) mantenendo alta la qualità del gesto ad ogni ripetizione',
    secondaryObjectives: JSON.stringify(['Velocità massimale', 'Recupero metabolico tra sprint', 'RSA con e senza palla', 'Monitoraggio del decadimento prestativo']),
    duration: 25, players: 16, intensity: 'massima', materials: 'coni 30m, cronometro, palle', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Forza esplosiva: salti pliometrici a circuito', nameEn: 'Explosive power: plyometric jump circuit',
    category: 'atletico',
    description: 'Circuito 6 stazioni pliometriche (45 secondi lavoro, 30 secondi recupero): (1) squat jump con massima elevazione; (2) box jump su plinto 40cm; (3) depth jump da plinto 30cm → countermovement jump; (4) lateral bounds (salti laterali monopodalici); (5) hurdle hop su 5 ostacoli bassi; (6) bounding progressivo su 20m. 2-3 circuiti completi. Indicazioni: atterraggio elastico (non rigido), massima potenza su ogni ripetizione. Pre-stagionale e in stagione (max 1 volta a settimana). Basato sui protocolli Verkhoshansky.',
    descriptionEn: '6-station plyometric circuit (45s work, 30s rest): squat jump, box jump 40cm, depth jump, lateral bounds, hurdle hops, bounding 20m. 2-3 rounds. Elastic landing cue. Max 1×/week in-season.',
    primaryObjective: 'Sviluppare la forza esplosiva e la potenza del salto attraverso esercitazioni pliometriche progressive',
    secondaryObjectives: JSON.stringify(['Potenza del salto verticale', 'Stiffness tendinea', 'Forza reattiva del piede', 'Elasticità e rigidità muscolare']),
    duration: 25, players: 16, intensity: 'alta', materials: 'plinto 40cm e 30cm, 5 ostacoli bassi, coni', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Interval training Yo-Yo Test simulato', nameEn: 'Yo-Yo Intermittent Recovery Test simulation',
    category: 'atletico',
    description: 'Protocollo Yo-Yo Level 1 (Bangsbo): coppie di coni a 20m. Giocatori corrono avanti-indietro sui 20m seguendo segnale acustico progressivamente più veloce. 10 secondi di recupero attivo dopo ogni coppia di shuttle. Inizia a 10 km/h, accelera ogni livello (3 shuttle per livello). Fine del test: quando il giocatore non raggiunge il cono al segnale per 2 volte consecutive. Registra il livello raggiunto — baseline per monitorare la condizione aerobica stagionale. Standard UEFA ProLicense.',
    descriptionEn: 'Yo-Yo Intermittent Recovery Level 1 (Bangsbo). 20m shuttle with progressive audio signal. 10s active recovery after each pair. Starts at 10 km/h. Test ends on 2 consecutive failures. Record level as seasonal aerobic baseline.',
    primaryObjective: 'Misurare e sviluppare la capacità aerobica intermittente specifica del calciatore attraverso il protocollo Yo-Yo',
    secondaryObjectives: JSON.stringify(['VO2max specifico del calcio', 'Resistenza intermittente', 'Baseline condizionale', 'Monitoraggio stagionale']),
    duration: 20, players: 16, intensity: 'massima', materials: 'coni 20m, segnale acustico Yo-Yo, cronometro', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Core stability calcistico — plank progressivo', nameEn: 'Football core stability — progressive plank',
    category: 'atletico',
    description: 'Circuito core specifico per il calcio: (1) plank frontale 45" con palleggio palla tra compagni; (2) plank laterale 30" per lato con sollevamento gamba superiore; (3) dead bug 10 ripetizioni; (4) Russian twist con palla da calcio 3×15; (5) roll-out con pallone sotto l\'addome (rotolamento avanti-indietro); (6) hollow hold 30". 2 giri. Focus: stabilità del core durante movimenti calcistici — fondamentale per prevenzione lombalgia e efficienza tecnica.',
    descriptionEn: 'Football-specific core circuit: plank with pass juggling, side plank with leg raise, dead bug, Russian twist with football, ab wheel rollout, hollow hold. 2 rounds. Emphasize stability during sport-specific movement.',
    primaryObjective: 'Sviluppare la stabilità del core nei pattern di movimento specifici del calcio per prevenzione infortuni e efficienza tecnica',
    secondaryObjectives: JSON.stringify(['Stabilità lombare', 'Forza isometrica del core', 'Resistenza del core in condizioni specifiche', 'Prevenzione lombalgia']),
    duration: 22, players: 16, intensity: 'media', materials: 'palle, tappetini, peso palla da calcio', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Cambio di direzione COD — Pro-Agility 5-10-5', nameEn: 'Change of direction COD — Pro-Agility 5-10-5',
    category: 'atletico',
    description: 'Test e allenamento Pro-Agility (5-10-5): 3 coni in linea a 5m l\'uno dall\'altro. Partenza dal centro, sprint verso destra 5m (tocca cono), sprint verso sinistra 10m (tocca cono), sprint finale 5m verso il centro. Cronometrato. Baseline: <4.3 secondi per un giocatore elite. Variante allenamento: 6 ripetizioni con recupero 45 secondi; poi variante con palla (conduzione nei 5m). Allena: prima accelerazione, frenata eccentrica, cambio di direzione, seconda accelerazione. Lavoro bilaterale: partenza da destra e da sinistra.',
    descriptionEn: '3 cones in line 5m apart. Start center, sprint right 5m, sprint left 10m, sprint right 5m. Timed. Elite baseline: <4.3s. Training variant: 6 reps, 45s recovery, then with ball. Bilateral: start both directions.',
    primaryObjective: 'Sviluppare la capacità di cambio di direzione con frenata eccentrica e riaccelerazione explosiva attraverso il protocollo Pro-Agility',
    secondaryObjectives: JSON.stringify(['Prima accelerazione laterale', 'Frenata eccentrica', 'Cambio di direzione con passo incrociato', 'Bilateralità del COD']),
    duration: 18, players: 14, intensity: 'massima', materials: '3 coni per corsia, cronometro, palle', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Nordic Hamstring Curl — protocollo progressivo 4 settimane', nameEn: 'Nordic Hamstring Curl — 4-week progressive protocol',
    category: 'atletico',
    description: 'Protocollo NHE (Nordic Hamstring Exercise) basato su Mjøsund et al. (2021): SETTIMANA 1: 2×5; SETTIMANA 2: 3×6; SETTIMANA 3: 3×8; SETTIMANA 4: 3×10. Esecuzione: compagno tiene caviglie a terra, giocatore scende controllando la caduta con contrazione eccentrica ischio-crurali, si rialza spingendo con le mani. Riduce fino al 51% le lesioni al bicipite femorale (meta-analisi van Dyk 2019). Integrazione: fine sessione o giorno di recovery. Non eseguire il giorno prima di una partita.',
    descriptionEn: 'NHE progressive 4-week protocol (Mjøsund 2021): W1 2×5, W2 3×6, W3 3×8, W4 3×10. Partner holds ankles, player lowers eccentrically. 51% hamstring injury reduction (van Dyk 2019 meta-analysis). End of session. Not the day before a match.',
    primaryObjective: 'Ridurre il rischio di lesioni al bicipite femorale attraverso il protocollo progressivo Nordic Hamstring Evidence-based',
    secondaryObjectives: JSON.stringify(['Forza eccentrica ischio-crurali', 'Prevenzione lesioni muscolari coscia', 'Forza del ginocchio in flessione eccentrica', 'Cultura della prevenzione']),
    duration: 15, players: 16, intensity: 'media', materials: 'tappetini, compagni come ancora', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Agilità percettiva con stimolo visivo (Reactive Agility)', nameEn: 'Perceptual agility with visual stimulus (Reactive Agility)',
    category: 'atletico',
    description: 'Griglia 10x10m. Giocatore al centro. Allenatore (o compagno) a 5m tiene cartellini direzionali (freccia destra/sinistra/avanti/indietro). Al segnale visivo il giocatore sprinta nella direzione indicata e tocca il cono corrispondente. Variante 1: stimolo anticipato (allenatore si muove e il giocatore replica il suo primo passo). Variante 2: stimolo con doppia scelta (due allenatori, uno è il segnale corretto). Differenza vs COD: reazione a stimolo esterno non prevedibile — allena l\'agility vera, non solo la velocità di cambio di direzione.',
    descriptionEn: '10x10m grid. Player at center. Coach 5m away shows directional cards. Player sprints to corresponding cone. Variant 1: anticipation (replicate coach\'s first step). Variant 2: two coaches, one correct. True reactive agility, not programmed COD.',
    primaryObjective: 'Sviluppare l\'agility reattiva in risposta a stimoli visivi imprevedibili, distinta dalla semplice velocità di cambio di direzione',
    secondaryObjectives: JSON.stringify(['Tempo di reazione visivo-motoria', 'Agilità reattiva vs programmata', 'Lettura dei movimenti avversari', 'Velocità di first step']),
    duration: 18, players: 12, intensity: 'alta', materials: 'coni, cartellini direzionali o tablet', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Forza funzionale calcistica — circuito 6 stazioni', nameEn: 'Football functional strength — 6-station circuit',
    category: 'atletico',
    description: 'Circuito forza funzionale (40s lavoro, 20s recupero): (1) squat monopodalico con palla medica; (2) affondi laterali con palla in rotazione; (3) step-up su panchina con ginocchio alto e sprint 3m; (4) Copenhagen plank 30" per lato; (5) hip thrust con spalle su panchina; (6) salto su scatola + sprint 5m con palla. 3 giri completi. Obiettivo: forza dei glutei, stabilità del ginocchio, potenza monopodalica. Stazione specifica calcio: ogni esercizio termina con un gesto tecnico.',
    descriptionEn: '6-station functional strength circuit (40s work, 20s rest): single-leg squat + med ball, lateral lunge with rotation, step-up + high knee + 3m sprint, Copenhagen plank, hip thrust, box jump + sprint + ball. 3 rounds.',
    primaryObjective: 'Sviluppare la forza funzionale negli schemi motori specifici del calcio: monopodalico, laterale e rotazionale',
    secondaryObjectives: JSON.stringify(['Forza dei glutei', 'Stabilità del ginocchio in monopodalico', 'Potenza dell\'anca', 'Integrazione forza-gesto tecnico']),
    duration: 28, players: 16, intensity: 'alta', materials: 'palla medica, panchina, scatola 40cm, coni', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Fartlek calcistico — variazioni di ritmo simulate', nameEn: 'Football fartlek — simulated pace variations',
    category: 'atletico',
    description: 'Fartlek (gioco di velocità svedese) adattato al calcio su campo intero: 20 minuti continui con variazioni di ritmo simulate da schede: (1) trot 1 min; (2) corsa media 90s; (3) sprint 10s; (4) cammino recupero 30s; (5) corsa laterale 20s; (6) sprint massimale 6s; (7) trot 1 min. Ripetuto 3-4 cicli. Con palla: ogni sprint è un dribbling; ogni cambio di ritmo include un tocco di palla. Allena i sistemi energetici nei pattern di sforzo reali del calcio (10-12 sprint partita).',
    descriptionEn: '20-min continuous football fartlek: 1min trot, 90s medium run, 10s sprint, 30s walk, 20s lateral run, 6s maximal sprint. 3-4 cycles. With ball variant: each sprint is dribble, each pace change includes ball touch.',
    primaryObjective: 'Sviluppare i sistemi energetici nei pattern di sforzo reali del calcio attraverso variazioni di ritmo simulate',
    secondaryObjectives: JSON.stringify(['Resistenza aerobica-anaerobica mista', 'Recupero tra sforzi massimali', 'Adattamento ai cambi di ritmo di gara', 'Resistenza specifiche del calcio']),
    duration: 25, players: 16, intensity: 'alta', materials: 'palle, cronometro, schede ritmo', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Mobilità degli arti inferiori — protocollo FMS', nameEn: 'Lower limb mobility — FMS protocol',
    category: 'atletico',
    description: 'Functional Movement Screen applicato al calcio: 7 test di mobilità e stabilità: (1) deep squat (punteggio 0-3); (2) hurdle step; (3) lunge in linea; (4) shoulder mobility; (5) active straight leg raise; (6) trunk stability push-up; (7) rotational stability. Ogni test ha standard tecnici precisi. Punteggio totale < 14 = rischio infortuni aumentato. Protocollo di correzione: per ogni asimmetria (es. ASLR destra > sinistra di 1 punto), 3 esercizi correttivi specifici. Ideale inizio preseason e mid-season.',
    descriptionEn: 'Functional Movement Screen for football: 7 mobility/stability tests scored 0-3. Total <14 = elevated injury risk. Correction protocol: for each asymmetry, 3 specific corrective exercises. Ideal start of pre-season and mid-season.',
    primaryObjective: 'Identificare deficit di mobilità e asimmetrie funzionali attraverso il protocollo FMS per prevenire infortuni',
    secondaryObjectives: JSON.stringify(['Screening pre-stagionale', 'Identificazione asimmetrie', 'Programma correttivo individuale', 'Prevenzione infortuni evidence-based']),
    duration: 30, players: 16, intensity: 'bassa', materials: 'tappetini, asticella FMS, schede di valutazione', isCustom: false, createdAt: now,
  },

  // ════════════════════════════════════════════════════════════════
  // PARTITELLA (8 esercizi)
  // ════════════════════════════════════════════════════════════════
  {
    id: r(), name: 'Partitella a tema: pressing e transizione', nameEn: 'Themed small-sided game: pressing and transition',
    category: 'partitella',
    description: 'Campo 50x35m, 7vs7 con portieri. Tema doppio: (1) pressing ultra-offensivo — squadra che attacca deve riconquistare entro 6 secondi dalla perdita palla; (2) transizione rapida — dopo ogni recupero palla obbligo di superare metà campo entro 4 secondi. Punti bonus: +1 per ogni pressing riuscito in meno di 6 secondi; +2 per ogni gol segnato entro 5 secondi dal recupero. Allenatore funge da osservatore e fischia le infrazioni dei temi. Debriefing tattico da 5 minuti a fine partitella.',
    descriptionEn: '50x35m, 7v7+GKs. Double theme: ultra-offensive pressing (win ball back within 6s) + rapid transition (must cross halfway within 4s of recovery). Bonus points for fast pressing and quick goals. Tactical debrief.',
    primaryObjective: 'Applicare in forma giocata i principi di pressing coordinato e transizione offensiva rapida con incentivi concreti',
    secondaryObjectives: JSON.stringify(['Pressing collettivo immediato', 'Velocità di transizione', 'Mentalità offensiva nella transizione', 'Riconoscimento del momento della perdita di palla']),
    duration: 30, players: 16, intensity: 'massima', materials: 'palle, coni, 2 porte, portieri', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Rondo 8vs2 in doppia griglia', nameEn: 'Rondo 8v2 double grid',
    category: 'partitella',
    description: 'Due quadrati 10x10m adiacenti separati da corridoio 3m. 8 possessori (4 per quadrato) vs 2 pressatori che si muovono tra le due griglie. Regola: il passaggio tra le due griglie vale 2 punti; i tocchi all\'interno valgono 0. I pressatori devono decidere quale griglia pressare. Al recupero palla: i pressatori diventano possessori nella griglia dove hanno recuperato; 2 dei 4 possessori diventano pressatori. Allena: cambio di fronte, visione periferica, decisione sotto pressione.',
    descriptionEn: 'Two 10x10m squares with 3m corridor. 8 possessors (4 per grid) vs 2 pressers moving between grids. Pass between grids = 2pts. Pressers choose which grid to press. Recovery: pressers become possessors, 2 possessors become pressers.',
    primaryObjective: 'Sviluppare il cambio di fronte e la visione periferica nel possesso palla con pressatori che gestiscono due griglie',
    secondaryObjectives: JSON.stringify(['Cambio di fronte come vantaggio tattico', 'Visione periferica a campo largo', 'Decisione del pressatore', 'Velocità di circolazione inter-griglia']),
    duration: 20, players: 10, intensity: 'alta', materials: 'palle, coni (2 quadrati 10x10)', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Partitella con regola del gol da fuori', nameEn: 'Small-sided game with outside goal rule',
    category: 'partitella',
    description: 'Campo 40x30m. 6vs6 con portieri. Regola speciale: un gol segnato da fuori area vale 3 punti; un gol segnato su azione di almeno 5 passaggi consecutivi vale 2 punti; gol normale vale 1 punto. I difensori devono coprire lo spazio esterno area più del normale. Sviluppa: (1) il tiro da fuori area come strumento tattico; (2) il possesso paziente per arrivare a 5 passaggi; (3) la difesa compatta dell\'area esterna. Regola derivata dalla metodologia del Valencia di Marcelino.',
    descriptionEn: '40x30m, 6v6+GKs. Special rule: outside-area goal = 3pts, goal after 5+ consecutive passes = 2pts, normal goal = 1pt. Forces: long-range shooting as tactical tool, patient possession, compact defending outside box.',
    primaryObjective: 'Incentivare il tiro da fuori area e il possesso paziente attraverso un sistema di punteggio differenziato',
    secondaryObjectives: JSON.stringify(['Tiro da fuori area', 'Possesso paziente a 5 passaggi', 'Difesa compatta zona esterna area', 'Creatività tattica nel punteggio']),
    duration: 25, players: 14, intensity: 'alta', materials: 'palle, coni, 2 porte, portieri', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Partitella con jolly di fascia', nameEn: 'Small-sided game with wide jokers',
    category: 'partitella',
    description: 'Campo 45x35m. 5vs5 + 2 jolly neutrali sulle fasce (fuori dal campo, possono ricevere ma non entrare). I jolly giocano sempre con la squadra in possesso. Regola: prima di segnare, almeno 1 passaggio deve essere transitato per il jolly di fascia. Sviluppa: (1) larghezza offensiva come principio; (2) uso della fascia per spostare il blocco difensivo; (3) giocata del terzino nella realtà del gioco. I jolly rotano ogni 5 minuti. Variante: jolly non possono toccare la palla più di 2 volte.',
    descriptionEn: '45x35m. 5v5 + 2 neutral wide jokers (outside field, can receive but not enter). Jokers always play for possessing team. Rule: at least 1 pass through a wide joker before scoring. Jokers rotate every 5 min.',
    primaryObjective: 'Sviluppare la larghezza offensiva come principio attraverso l\'uso obbligatorio dei jolly di fascia prima della finalizzazione',
    secondaryObjectives: JSON.stringify(['Larghezza offensiva', 'Uso della fascia per spostare il blocco', 'Giocata di fascia in velocità', 'Cambio di fronte via jolly']),
    duration: 25, players: 12, intensity: 'alta', materials: 'palle, coni, 2 porte', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Partitella 9vs9 con regola del tocco', nameEn: '9v9 with touch constraint rule',
    category: 'partitella',
    description: 'Campo 60x45m. 9vs9 con portieri. Progressione tattile in 4 periodi da 8 minuti: (1) tocchi liberi; (2) massimo 3 tocchi; (3) massimo 2 tocchi; (4) 1 tocco obbligatorio in zona centrale, 2 in zona esterna. Obiettivo: nel periodo a 1 tocco i giocatori devono orientarsi prima di ricevere. Monitorare: quanto cambia la velocità di gioco? Chi si adatta e chi fatica? Discussione: il vincolo dei tocchi non è fine a sé stesso — è strumento per sviluppare mentalità di anticipazione.',
    descriptionEn: '60x45m, 9v9+GKs. 4 periods of 8 min with touch progression: free touches, max 3, max 2, 1-touch in central zone + 2 in wide zone. Monitor pace change and adaptation. Discussion: touch constraint as anticipation mindset tool.',
    primaryObjective: 'Sviluppare la velocità di gioco e l\'orientamento anticipato attraverso la progressione dei vincoli di tocco',
    secondaryObjectives: JSON.stringify(['Orientamento prima della ricezione', 'Velocità di circolazione palla', 'Adattamento al gioco a 1 tocco', 'Mentalità di anticipazione']),
    duration: 35, players: 20, intensity: 'alta', materials: 'palle, coni, 2 porte, portieri', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Partitella per reparto: difensori vs attaccanti', nameEn: 'Department game: defenders vs attackers',
    category: 'partitella',
    description: 'Mezza campo. 4 difensori + portiere vs 4 attaccanti. Gli attaccanti devono segnare in 60 secondi dal calcio d\'inizio; se non segnano = punto alla difesa. I difensori non possono andare oltre metà campo. 10 round, 45 secondi di recupero. Statistiche: quante volte la difesa ha tenuto? Quante volte è stato segnato? In quanto tempo medio? Intensità altissima per entrambi i reparti. Variante: 5 difensori vs 3 attaccanti (difesa in sovrannumero) poi 3 difensori vs 5 (attacco in sovrannumero).',
    descriptionEn: 'Half field. 4 defenders + GK vs 4 attackers. Attackers must score in 60s; if not = defensive point. Defenders cannot cross halfway. 10 rounds, 45s recovery. Track stats. Variants: 5v3 defense, 3v5 attack.',
    primaryObjective: 'Simulare situazioni di pressione reale per difensori e attaccanti con obiettivi cronometrati e statistiche',
    secondaryObjectives: JSON.stringify(['Difesa organizzata a 4 in inferiorità', 'Attacco rapido vs difesa organizzata', 'Pressione psicologica del tempo', 'Mentalità competitiva']),
    duration: 25, players: 9, intensity: 'massima', materials: 'palle, coni, porta, portiere, cronometro', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Partitella con porte multiple a colori', nameEn: 'Multi-goal coloured small-sided game',
    category: 'partitella',
    description: 'Campo 35x25m. 5vs5 senza portieri. 6 porte piccole (2 per colore: rosso, blu, giallo) disposte casualmente ai bordi. Prima del kick-off l\'allenatore chiama un colore — si può segnare solo in quelle porte per 2 minuti, poi nuovo colore. Sviluppa: orientamento spaziale continuo, pressing contestuale (non so dove devo attaccare = non so dove devo difendere), capacità di riorganizzarsi rapidamente. Alta intensità cognitiva. Ispirato al metodo olandese di Wiel Coerver.',
    descriptionEn: '35x25m, 5v5 no GKs. 6 mini-goals (2 each colour: red, blue, yellow). Coach calls a colour before each 2-min period — only that colour counts. Forces: continuous spatial orientation, contextual pressing, rapid reorganisation.',
    primaryObjective: 'Sviluppare orientamento spaziale dinamico e pressing contestuale attraverso obiettivi che cambiano continuamente',
    secondaryObjectives: JSON.stringify(['Orientamento spaziale dinamico', 'Pressing contestuale', 'Riorganizzazione rapida', 'Intelligenza tattica collettiva']),
    duration: 20, players: 10, intensity: 'alta', materials: 'palle, 6 porte piccole (2 rosso, 2 blu, 2 giallo)', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Partitella con possesso obbligatorio nella metà campo difensiva', nameEn: 'Game with mandatory possession in defensive half',
    category: 'partitella',
    description: 'Campo 55x40m. 8vs8 con portieri. Regola: prima di attaccare, ogni azione deve iniziare con almeno 3 passaggi consecutivi nella propria metà campo. Se si attacca senza i 3 passaggi = punizione indiretta all\'avversario. Sviluppa: costruzione dal basso obbligatoria, pazienza offensiva, pressing alto strutturato (l\'avversario sa che la palla tornerà indietro). Progressione: aumentare a 5 passaggi nella metà campo; poi 3 passaggi ma con almeno 1 deve toccare il portiere. Metodo dei top club tedeschi.',
    descriptionEn: '55x40m, 8v8+GKs. Rule: every attack must start with 3+ consecutive passes in own half. Attacking without 3 passes = free kick for opponents. Develops: mandatory build-up, offensive patience, structured high press.',
    primaryObjective: 'Obbligare la costruzione bassa dal basso come principio automatico attraverso una regola che penalizza la verticalità immediata',
    secondaryObjectives: JSON.stringify(['Costruzione dal basso obbligatoria', 'Pazienza offensiva', 'Pressing alto strutturato', 'Ruolo del portiere nel gioco']),
    duration: 28, players: 18, intensity: 'alta', materials: 'palle, coni, 2 porte, portieri', isCustom: false, createdAt: now,
  },

  // ════════════════════════════════════════════════════════════════
  // CALCI PIAZZATI (10 esercizi)
  // ════════════════════════════════════════════════════════════════
  {
    id: r(), name: 'Calcio d\'angolo offensivo a zona — schema Liverpool', nameEn: 'Offensive corner — zonal attacking scheme Liverpool',
    category: 'calci_piazzati',
    description: 'Schema da calcio d\'angolo ispirato al Liverpool di Klopp: battitore a sinistra calcia teso al secondo palo. 6 giocatori in area posizionati: 2 sul primo palo (blocco), 2 sul punto del rigore (stacco di testa), 1 al limite area (secondo pallone), 1 sul palo lontano (rimbalzo). Movimento codificato: al momento del calcio, i 2 del primo palo fanno blocco sui difensori, 1 dei 2 al punto del rigore fa corsa verso primo palo. Ripetuto 10 volte. Analisi del tasso di conversione.',
    descriptionEn: 'Liverpool-inspired corner scheme. Taker crosses driven to far post. 6 players in area: 2 near-post (block), 2 penalty spot (header), 1 edge of area (second ball), 1 far post (rebound). Coded movement: near-post pair blocks, one penalty-spot player runs to near post.',
    primaryObjective: 'Sviluppare uno schema da calcio d\'angolo offensivo con blocchi coordinati e movimenti codificati per creare superiorità aerea',
    secondaryObjectives: JSON.stringify(['Blocco difensore sul primo palo', 'Attacco aereo al secondo palo', 'Gestione del secondo pallone', 'Conversione del calcio d\'angolo']),
    duration: 20, players: 14, intensity: 'media', materials: 'palle, porta, portiere, coni posizione', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Punizione diretta: tecnica della barriera e del tiro', nameEn: 'Direct free kick: wall technique and shooting',
    category: 'calci_piazzati',
    description: 'Due stazioni simultanee: STAZIONE TIRO — tiratore lavora sulla tecnica: (1) run-up angolato 45°; (2) piede d\'appoggio 15cm dalla palla; (3) contatto con zona interna del piede (effetto) o collo (potenza); (4) follow-through verso l\'obiettivo. 5 tiri da ogni posizione (25, 20, 18m; centrale e angolata). STAZIONE BARRIERA — 3 giocatori imparano il salto coordinato: segnale = fischio, salto simultaneo. Portiere lavora sul posizionamento. Al termine: simulazione completa con barriera reale.',
    descriptionEn: 'Two simultaneous stations. SHOOTING: 45° run-up, 15cm support foot, inside contact (curve) or instep (power), follow-through. 5 shots each position (25/20/18m, central/angled). WALL: synchronized jump on whistle. GK positioning.',
    primaryObjective: 'Sviluppare la tecnica della punizione diretta e della barriera difensiva attraverso lavoro simultaneo dei due reparti',
    secondaryObjectives: JSON.stringify(['Tecnica del tiro a effetto', 'Tecnica del tiro di potenza', 'Salto coordinato della barriera', 'Posizionamento portiere su punizione']),
    duration: 25, players: 12, intensity: 'media', materials: 'palle multiple, porta, portiere, spray', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Schema punizione laterale: doppio movimento', nameEn: 'Lateral free kick scheme: double movement',
    category: 'calci_piazzati',
    description: 'Punizione laterale a 25m dalla porta, posizione 3/4. Schema a doppio movimento: giocatore A finge di calciare e si ferma; giocatore B (a 2m) finge di prendere il pallone e si sposta; giocatore C (nascosto dietro la barriera) riceve il vero passaggio di A in spazio liberato da B. C ha campo aperto per il tiro. Alternativa: A calcia direttamente sul primo palo se la barriera si apre. Ripetizione 8 volte con portiere reale. La sincronizzazione è fondamentale.',
    descriptionEn: 'Lateral free kick 25m from goal. Double-movement scheme: A fakes shot and stops; B (2m away) fakes receiving and moves; C (hidden behind wall) receives A\'s pass in freed space. C shoots. Alternative: A shoots direct if wall opens.',
    primaryObjective: 'Sviluppare lo schema a doppio movimento su punizione laterale per creare confusione nella barriera avversaria',
    secondaryObjectives: JSON.stringify(['Coordinazione del doppio movimento', 'Timing di A-B-C', 'Tiro in movimento dopo ricezione', 'Lettura della reazione della barriera']),
    duration: 18, players: 8, intensity: 'bassa', materials: 'palle, porta, portiere, coni barriera', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Rimessa laterale lunga — schema di attivazione', nameEn: 'Long throw-in activation scheme',
    category: 'calci_piazzati',
    description: 'Per squadre con lanciatore di rimessa lunga. Schema: A lancia lungo verso B che fa blocco su difensore avversario; C (attaccante) si inserisce dalla parte opposta del blocco di B per ricevere pulito; D è sul secondo pallone a 12m. Progressione: (1) senza difensori; (2) difensori passivi; (3) difensori attivi. Tecnica del lancio: apertura piedi pari, presa della palla con pollici opposti, arco del corpo, estensione completa. Il lancio deve superare i 25m per essere efficace. Usato dal Stoke City e dal Brentford.',
    descriptionEn: 'For teams with a long throw specialist. A throws long to B (who screens defender); C attacks from opposite side of B\'s screen; D waits for second ball at 12m. Progressions: no defenders, passive, active. Technique: balanced stance, thumb grip, body arch, full extension.',
    primaryObjective: 'Sviluppare la rimessa laterale lunga come arma offensiva sistematica con schema codificato blocco-taglio',
    secondaryObjectives: JSON.stringify(['Tecnica del lancio lungo', 'Schema blocco-taglio', 'Gestione del secondo pallone', 'Rimessa come calcio piazzato alternativo']),
    duration: 20, players: 10, intensity: 'media', materials: 'palle, coni, porta, portiere', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Calcio di rigore: protocollo mentale e tecnico', nameEn: 'Penalty kick: mental and technical protocol',
    category: 'calci_piazzati',
    description: 'Protocollo completo rigore per tutti i giocatori della rosa: TECNICA — (1) scegliere angolo prima di avvicinarsi; (2) rincorsa di 3-5 passi; (3) piede d\'appoggio 20cm dalla palla; (4) non guardare il portiere dopo la scelta (o guardarlo e giocare sul suo movimento). MENTALE — respirazione diaframmatica 3 secondi prima; visualizzazione del gol; frase di attivazione personale. Ogni giocatore batte 5 rigori con portiere attivo. Statististica: % conversione per giocatore = indicatore di affidabilità in partita.',
    descriptionEn: 'Complete penalty protocol: TECHNIQUE — choose angle before approaching, 3-5 step run-up, support foot 20cm from ball, don\'t look at GK after choosing (or use GK-dependent approach). MENTAL — diaphragmatic breathing, visualization, activation phrase. 5 kicks each vs active GK.',
    primaryObjective: 'Sviluppare la tecnica e la routine mentale del calcio di rigore per ogni giocatore della rosa in condizioni simulate di pressione',
    secondaryObjectives: JSON.stringify(['Tecnica del tiro dal dischetto', 'Routine pre-rigore', 'Gestione della pressione', 'Statistica individuale di conversione']),
    duration: 25, players: 16, intensity: 'media', materials: 'palle, porta, portiere, dischetto', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Schema calcio d\'angolo corto — triangolo veloce', nameEn: 'Short corner scheme — fast triangle',
    category: 'calci_piazzati',
    description: 'Schema su calcio d\'angolo corto: A batte corto verso B a 5m; B di prima scarica su C che è venuto in appoggio da fuori area; C verticalizza per D che taglia sul secondo palo sul cross basso di C oppure scarica al limite per il tiro di E. Schema prevede 5 movimenti: A, B, C, D, E. Alternativa: A batte, B la protegge e si gira verso D che ha fatto corsa sul secondo palo. Ripetuto 8 volte per lato. Sviluppa sorpresa rispetto al calcio d\'angolo classico.',
    descriptionEn: 'Short corner scheme: A plays short to B; B first-touch to C coming from outside area; C plays through for D cutting far post or lays off for E\'s shot. 5-player movement. Alternative: A plays, B protects-turns for D far post. 8 reps each side.',
    primaryObjective: 'Sviluppare lo schema da calcio d\'angolo corto per creare situazioni di tiro da fuori area o cross puliti sul secondo palo',
    secondaryObjectives: JSON.stringify(['Calcio d\'angolo corto come alternativa tattica', 'Triangolo veloce in zona corner', 'Cross basso sul secondo palo', 'Tiro da fuori area dopo schema']),
    duration: 18, players: 10, intensity: 'media', materials: 'palle, porta, portiere, coni schema', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Punizione nella propria metà campo — costruzione', nameEn: 'Own-half free kick — build-up scheme',
    category: 'calci_piazzati',
    description: 'Spesso trascurate: le punizioni nella propria metà campo. Schema: il battitore ha 3 scelte pre-definite in base alla posizione degli avversari: (1) palla corta al terzino libero; (2) palla media per il centrocampista che scappa; (3) lancio lungo per l\'attaccante in profondità. Il portiere comunica la scelta con un segnale da 2m dietro la palla. 8 ripetizioni per schema. Sviluppa: uscita costruita dai calci piazzati difensivi, comunicazione portiere-battitore, lettura della posizione avversaria.',
    descriptionEn: 'Often neglected: own-half free kicks. Taker has 3 pre-defined choices based on opponent position: (1) short to free fullback; (2) medium pass to escaping midfielder; (3) long to striker in depth. GK signals choice from 2m behind ball. 8 reps each.',
    primaryObjective: 'Sviluppare la costruzione dal basso dai calci piazzati difensivi con comunicazione portiere-battitore e lettura della pressione avversaria',
    secondaryObjectives: JSON.stringify(['Lettura della pressione avversaria', 'Comunicazione GK-battitore', 'Tre opzioni di uscita predefinite', 'Uscita costruita da calci piazzati difensivi']),
    duration: 18, players: 10, intensity: 'bassa', materials: 'palle, portiere, coni', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Schema punizione in fascia: cross al secondo palo', nameEn: 'Wide free kick scheme: cross to far post',
    category: 'calci_piazzati',
    description: 'Punizione in fascia a 30-35m. Due battitori: A e B. Finta: A fa gesto di battere, B taglia verso la palla; il difensore pensa a uomo ma B non calcia — devia con il tacco verso C che arriva in corsa; C crossa basso teso verso il secondo palo dove D ha fatto corsa d\'attacco. Variante semplice senza tacco: A batte direttamente cross teso. Analisi: primo palo vs secondo palo — dove si generano più pericoli. 8 ripetizioni complete dello schema.',
    descriptionEn: 'Wide free kick 30-35m. A fakes kick, B cuts toward ball — B heel-deflects to C arriving in stride; C crosses low to far post where D makes attacking run. Simple variant: A crosses direct. Analysis: near vs far post danger.',
    primaryObjective: 'Sviluppare lo schema su punizione in fascia con deviazione di tacco per liberare il crossatore in corsa verso il secondo palo',
    secondaryObjectives: JSON.stringify(['Deviazione di tacco su punizione', 'Cross in corsa basso e teso', 'Attacco al secondo palo', 'Timing della corsa del finalizzatore']),
    duration: 20, players: 10, intensity: 'media', materials: 'palle, porta, portiere, coni schema', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Calcio di punizione ad effetto — curva a cadere', nameEn: 'Free kick with effect — dropping curve',
    category: 'calci_piazzati',
    description: 'Tecnica avanzata: la punizione con effetto a scendere (top-spin) che supera la barriera e cade sotto la traversa. Tecnica: (1) rincorsa dritta; (2) piede d\'appoggio 25cm a lato; (3) contatto sulla parte alta-centrale della palla con collo piede; (4) gamba che segue verso il basso (follow-through discendente). 10 tiri da 20-22m con barriera reale. L\'allenatore posiziona un cono a 50cm sotto la traversa per dare un riferimento visivo al tiro. Tiratori specialisti: 20 ripetizioni; non specialisti: 5 solo per apprendimento.',
    descriptionEn: 'Advanced technique: top-spin dipping free kick over wall. Technique: straight run-up, support foot 25cm to side, contact top-center of ball with instep, downward follow-through. 10 shots from 20-22m with real wall. Cone 50cm under crossbar as target.',
    primaryObjective: 'Sviluppare la tecnica del tiro a scendere con top-spin per superare la barriera e battere il portiere sulla posizione',
    secondaryObjectives: JSON.stringify(['Top-spin calcistico', 'Follow-through discendente', 'Controllo dell\'effetto', 'Tiro specialistico su punizione']),
    duration: 22, players: 6, intensity: 'media', materials: 'palle, porta, portiere, barriera, spray', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Ripartenza veloce da calcio d\'angolo — contropiede schematizzato', nameEn: 'Fast restart from corner — schematic counter',
    category: 'calci_piazzati',
    description: 'Scenario: l\'avversario ha appena battuto un calcio d\'angolo e la difesa rinvia. Schema di ripartenza rapida pre-definito: (1) portiere lancia lungo su A che è rimasto alto; (2) B (centrocampista) parte in diagonale appena calciato il corner; (3) A protegge e aspetta B in triangolo; (4) A-B-C (terzo uomo in inserimento) sviluppano 3vs2 in contropiede. Trigger: il corner viene calciato. Ripetuto 8 volte. Trasforma una situazione difensiva in un vantaggio offensivo sistematico.',
    descriptionEn: 'Scenario: opponent has just taken corner, defense clears. Pre-defined quick restart: GK launches long to A (stayed high), B (MF) runs diagonal as corner is kicked, A protects + waits for B, A-B-C develop 3v2 counter. Trigger: corner kick.',
    primaryObjective: 'Sviluppare una ripartenza veloce schematizzata dal calcio d\'angolo difensivo convertendo la situazione in contropiede 3vs2',
    secondaryObjectives: JSON.stringify(['Schema pre-definito di ripartenza', 'Lancio preciso del portiere', 'Triangolo offensivo in contropiede', 'Vantaggio dal corner difensivo']),
    duration: 18, players: 9, intensity: 'alta', materials: 'palle, coni, porta, portiere', isCustom: false, createdAt: now,
  },

  // ════════════════════════════════════════════════════════════════
  // PORTIERI (10 esercizi)
  // ════════════════════════════════════════════════════════════════
  {
    id: r(), name: 'Tuffo laterale — tecnica del diving progressiva', nameEn: 'Lateral dive — progressive diving technique',
    category: 'portieri',
    description: 'Protocollo tecnico tuffo laterale in 4 fasi: FASE 1 (da inginocchiato): palla calciata piano a lato, tuffo morbido con atterraggio su fianco; focus su mani (a coppa), polso di sostegno, testa alzata. FASE 2 (da accovacciato): stessa dinamica ma partendo accovacciati. FASE 3 (da in piedi): palla calciata a lato-basso, tuffo completo. FASE 4 (con cross): tuffo su cross rasoterra degli ultimi 2m di traiettoria. 8 ripetizioni per lato per fase. Riposo 30 secondi tra ripetizioni. Focus: non cadere — tuffarsi.',
    descriptionEn: 'Technical diving protocol in 4 phases: kneeling (soft roll, hands, wrist), crouched, standing (full dive on low ball), with cross (dive on last 2m). 8 reps per side per phase. 30s rest. Focus: don\'t fall — dive.',
    primaryObjective: 'Costruire la tecnica corretta del tuffo laterale dal basso verso l\'alto con progressione di complessità e altezza',
    secondaryObjectives: JSON.stringify(['Tecnica delle mani a coppa', 'Polso di sostegno nell\'atterraggio', 'Tuffo su palla bassa', 'Transizione tuffo-recupero']),
    duration: 25, players: 2, intensity: 'media', materials: 'palle, materassino, porta', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Uscita alta sul cross — tecnica della presa aerea', nameEn: 'High exit on cross — aerial catch technique',
    category: 'portieri',
    description: 'Tecnica dell\'uscita alta: (1) posizione di partenza al secondo palo (non al centro); (2) al cross, leggere la traiettoria dal primo tocco del crossatore; (3) partire con decisione (non attendismo); (4) salto con ginocchio sollevato come protezione; (5) presa a mani aperte con pollici opposti; (6) atterraggio su un piede per mantenere equilibrio. 10 cross da destra + 10 da sinistra con crossatori reali. Progressione: aggiunta di attaccante che disturba; poi duello reale. Standard di valutazione: 8/10 prese pulite = ottimo.',
    descriptionEn: 'High exit technique: start at far post, read trajectory from crosser\'s first touch, decisive exit, raised knee for protection, open hands with opposing thumbs, one-foot landing. 10 crosses each side. Add attacker distraction, then real aerial contest.',
    primaryObjective: 'Sviluppare la tecnica dell\'uscita alta sul cross con lettura anticipata, decisione e presa sicura in contesto di disturbo',
    secondaryObjectives: JSON.stringify(['Posizionamento pre-cross', 'Lettura anticipata della traiettoria', 'Presa a mani aperte', 'Uscita in contesto di disturbo']),
    duration: 25, players: 4, intensity: 'alta', materials: 'palle, porta, crossatori', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Distribuzione del portiere — 4 tipi di rilancio', nameEn: 'Goalkeeper distribution — 4 types of release',
    category: 'portieri',
    description: 'Sessione specialistica sulla distribuzione: (1) ROLLATA — rotolamento a terra preciso verso terzino a 15m (tecnica: fianco verso il bersaglio, rilascio con presa a mano singola); (2) LANCIO DI PRECISIONE — lancio a rimbalzo verso centrocampista a 30m; (3) RINVIO CON PIEDE — calcio dal basso a giro verso fascia (40-50m); (4) LANCIO LUNGO — da mani per attaccante spalle a porta a 50m. 10 ripetizioni per tipo. Simulazione delle 4 situazioni di partita. Analisi: % di passaggi arrivati al bersaglio per tipo.',
    descriptionEn: 'Distribution specialization: (1) rolling pass to fullback 15m; (2) precision overarm to midfielder 30m; (3) half-volley swinging to flank 40-50m; (4) long throw to striker 50m. 10 reps each. Simulate 4 match situations. Track % to target.',
    primaryObjective: 'Sviluppare la tecnica delle 4 tipologie di distribuzione del portiere adattandola alle distanze e situazioni di partita reali',
    secondaryObjectives: JSON.stringify(['Rollata precisa a terra', 'Lancio di precisione a media distanza', 'Rinvio a giro sulla fascia', 'Lancio lungo per l\'attaccante di punta']),
    duration: 25, players: 3, intensity: 'media', materials: 'palle multiple, coni bersaglio, porta', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Reazione su tiro ravvicinato — riflessi e posizione', nameEn: 'Close-range reaction save — reflexes and positioning',
    category: 'portieri',
    description: 'Esercizio ad alta intensità per riflessi: portiere in piedi a 5m dalla porta senza rete. 2 tiratori alternati a 7m con palle a cadenza rapida (ogni 5 secondi). Il portiere deve respingere (non trattenere obbligatoriamente). Variante 1: tiro piazzato basso-angolo; variante 2: tiro forte centrale (portiere deve spostarsi per lasciare segnare... o parare?); variante 3: palla alzata sul palo, portiere deve staccarsi dal palo. 3 serie da 8 tiri. Recupero 2 minuti. Allena riflessi puri e posizionamento proattivo.',
    descriptionEn: 'High-intensity reflex drill: GK stands 5m from goal. 2 alternating shooters at 7m, ball every 5s. GK must react (not necessarily catch). Variants: low-angle placed, powerful central, ball flicked to post. 3 sets of 8 shots. 2 min rest.',
    primaryObjective: 'Sviluppare i riflessi puri del portiere su tiri ravvicinati e la capacità di recupero rapido tra parate consecutive',
    secondaryObjectives: JSON.stringify(['Riflessi su tiro ravvicinato', 'Recupero posizionale rapido', 'Risposta a tiri consecutivi', 'Posizionamento proattivo']),
    duration: 20, players: 3, intensity: 'alta', materials: 'palle multiple, porta, 2 tiratori', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Portiere in costruzione — ruolo nel 3-4-3', nameEn: 'GK in build-up — role in 3-4-3',
    category: 'portieri',
    description: 'Il portiere come decimo giocatore di campo: in un 3-4-3 che costruisce basso, il portiere deve posizionarsi tra i 3 difensori (stopper) quando uno esce a pressare. Meccanismo: (1) difensore centrale viene pressato → si gira e cerca portiere; (2) portiere è già nella posizione corretta (3-4m dietro la linea difensiva, non sulla linea di porta); (3) portiere riceve, controlla, gioca sul lato libero. Progressione: con 2 pressatori; poi con pressing alto organizzato a 3. Standard del calcio moderno.',
    descriptionEn: 'GK as 10th outfield player in 3-4-3 build-up. When a CB is pressed, GK positions between the three CBs. Mechanism: CB turns back to GK → GK already positioned 3-4m behind defensive line → GK receives, controls, plays to free side. Add 2 then 3 pressers.',
    primaryObjective: 'Sviluppare il portiere come giocatore attivo nella costruzione bassa del 3-4-3 con posizionamento proattivo tra i difensori',
    secondaryObjectives: JSON.stringify(['Posizionamento del portiere tra i difensori', 'Controllo orientato del portiere', 'Lettura della pressione avversaria', 'Uscita coraggiosa dal portiere']),
    duration: 20, players: 8, intensity: 'media', materials: 'palle, coni, porta', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Parata del tiro a giro — tecnica del palo vicino', nameEn: 'Curling shot save — near post technique',
    category: 'portieri',
    description: 'Tipologia di tiro più difficile da parare: il tiro a giro dall\'interno dell\'area che entra sul primo palo. Esercizio: tiratori calciando da 18-22m con effetto interno sul primo palo. Il portiere deve: (1) non tagliare troppo l\'angolo (errore comune); (2) mantenere 1/3 del corpo sul palo; (3) tuffarsi in avanti-laterale, non solo laterale (il pallone entra curva). 10 tiri per tipologia. Progressione: tiro con ostacolo umano a 3m (portiere non vede bene la palla). Analisi con video se disponibile.',
    descriptionEn: 'Hardest shot to save: curling shot entering near post. Shooters from 18-22m with inside curl. GK must: not cut too much angle, keep 1/3 of body on post, dive forward-lateral (not just lateral — ball curves in). 10 shots each type. Progression: human obstacle at 3m.',
    primaryObjective: 'Sviluppare la tecnica specifica per parare il tiro a giro sul primo palo: angolo corretto, tuffo in avanti-laterale',
    secondaryObjectives: JSON.stringify(['Posizionamento sul palo vicino', 'Tuffo in avanti-laterale', 'Lettura della traiettoria a effetto', 'Angolo corretto vs tiro a giro']),
    duration: 22, players: 3, intensity: 'alta', materials: 'palle, porta, 2-3 tiratori', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Uscita in profondità 1vs1 — postura e chiusura dell\'angolo', nameEn: '1v1 depth exit — posture and angle closure',
    category: 'portieri',
    description: 'Situazione più frequente e temuta: attaccante solo davanti al portiere. Tecnica: (1) uscire rapidamente ma fermarsi a 3-4m dall\'attaccante; (2) baricentro basso, piedi alla larghezza delle spalle; (3) espandersi lateralmente (non alzarsi); (4) aspettare il tiro senza buttarsi; (5) se l\'attaccante dribbling → restare in piedi e chiudere la porta. 8 ripetizioni con attaccanti diversi (velocità diversa, conclusione diversa). Progressione: attaccante con due opzioni (tiro o assist).',
    descriptionEn: '1v1 depth exit. Technique: exit fast then stop 3-4m from attacker, low center of gravity feet shoulder-width, spread laterally (not upward), wait for shot without diving prematurely, if attacker dribbles stay up and track. 8 reps with different attacker types.',
    primaryObjective: 'Sviluppare la tecnica del 1vs1 in uscita: distanza corretta, postura espansa, attesa del tiro senza anticipare',
    secondaryObjectives: JSON.stringify(['Distanza di sicurezza nel 1vs1', 'Postura espansa lateralmente', 'Attesa del tiro', 'Gestione del dribbling dell\'attaccante']),
    duration: 20, players: 4, intensity: 'alta', materials: 'palle, porta, attaccanti variabili', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Coordinazione portiere — circuito atletico specifico', nameEn: 'GK coordination — sport-specific athletic circuit',
    category: 'portieri',
    description: 'Circuito atletico specifico per portieri (3 giri da 6 stazioni): (1) scala agilità laterale × 5m poi tuffo su palla; (2) box jump 30cm + parata immediata su cross; (3) skip avanti + arresto + tuffo; (4) salto verticale con presa palla alzata dal compagno; (5) plank 30" + sprint 5m + presa; (6) esercizio di reazione con palla da rimbalzo su muro. Recupero 1 minuto tra giri. Allena gli attributi fisici specifici del portiere: agilità, potenza del salto, reattività.',
    descriptionEn: 'GK-specific athletic circuit (3 rounds, 6 stations): lateral ladder + dive on ball, box jump + immediate cross save, skip + stop + dive, vertical jump + catch raised ball, plank + sprint + catch, wall-bounce reaction ball. 1 min rest between rounds.',
    primaryObjective: 'Sviluppare gli attributi fisici specifici del portiere: agilità laterale, potenza del salto, reattività e forza del core',
    secondaryObjectives: JSON.stringify(['Agilità laterale specifica portiere', 'Potenza del salto verticale', 'Reattività su rimbalzo imprevedibile', 'Integrazione atletismo-tecnica']),
    duration: 28, players: 2, intensity: 'alta', materials: 'scala agilità, box 30cm, palle, muro', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Comunicazione con la difesa — organizzazione sui cross', nameEn: 'Communication with defense — organization on crosses',
    category: 'portieri',
    description: 'Esercizio fondamentale spesso trascurato: il portiere deve guidare verbalmente i difensori sui cross. Simulazione: 4 difensori + portiere vs 3 attaccanti + crossatore. Il portiere deve: (1) chiamare "MIEI!" se esce; (2) chiamare il numero del difensore che deve marcare l\'attaccante libero; (3) chiamare "PORTA!" se non esce e il difensore deve difendere il palo. 8 cross da destra + 8 da sinistra. Feedback: qualità della comunicazione valutata dall\'allenatore (0-3 per chiarezza, tempismo, impatto).',
    descriptionEn: '4 defenders + GK vs 3 attackers + crosser. GK must: call "MINE!" if exiting, call defender\'s number to mark free attacker, call "POST!" if staying. 8 crosses each side. Coach evaluates communication quality (0-3 for clarity, timing, impact).',
    primaryObjective: 'Sviluppare la leadership vocale del portiere nell\'organizzazione difensiva sui cross con comunicazione tempestiva e chiara',
    secondaryObjectives: JSON.stringify(['Leadership vocale del portiere', 'Comunicazione portiere-difensori', 'Decisione uscita vs resta', 'Organizzazione difensiva sui cross']),
    duration: 22, players: 8, intensity: 'media', materials: 'palle, porta, coni di zona', isCustom: false, createdAt: now,
  },
  {
    id: r(), name: 'Tiro in tuffo su secondo palo — tecnica avanzata', nameEn: 'Diving save far post — advanced technique',
    category: 'portieri',
    description: 'Situazione tecnica avanzata: tiro che cambia direzione sul secondo palo dopo deviazione o cross rasoterra che taglia tutta l\'area. Il portiere deve: (1) partire a sinistra (primo palo); (2) il tiro devia a destra (secondo palo); (3) recupero immediato e tuffo inverso. Tecnica del recupero rapido: pivot su piede di appoggio, spinta esplosiva verso il secondo palo. 10 ripetizioni con tiratori che scelgono casualmente primo o secondo palo. Poi variante cross rasoterra nell\'area. Il portiere non sa dove va la palla: pura reattività.',
    descriptionEn: 'Advanced save: shot diverts to far post after deflection. GK starts near post, ball diverts far post. Technique: pivot on support foot, explosive push to far post. 10 reps, shooters choose near/far at random. Variant: ground cross across area. Pure reactivity.',
    primaryObjective: 'Sviluppare la capacità di recupero rapido e tuffo inverso sul secondo palo in situazioni di deviazione imprevedibile',
    secondaryObjectives: JSON.stringify(['Pivot e spinta esplosiva', 'Tuffo inverso sul secondo palo', 'Reattività su palla deviata', 'Lettura del cross rasoterra nell\'area']),
    duration: 22, players: 3, intensity: 'alta', materials: 'palle, porta, 2 tiratori', isCustom: false, createdAt: now,
  },
];

console.log(`\n📚 Inserimento ${newExercises.length} esercizi nel database...\n`);

// Insert in batches of 10
const BATCH = 10;
let inserted = 0;
for (let i = 0; i < newExercises.length; i += BATCH) {
  const batch = newExercises.slice(i, i + BATCH);
  await db.insert(exercises).values(batch);
  inserted += batch.length;
  console.log(`✅ ${inserted}/${newExercises.length} inseriti...`);
}

console.log(`\n🎉 COMPLETATO! ${inserted} nuove esercitazioni aggiunte alla libreria.\n`);
console.log('Categorie aggiornate:');
const categories = [...new Set(newExercises.map(e => e.category))];
categories.forEach(cat => {
  const count = newExercises.filter(e => e.category === cat).length;
  console.log(`  • ${cat}: +${count} esercizi`);
});

client.close();
