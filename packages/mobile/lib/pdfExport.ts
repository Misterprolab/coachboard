/**
 * PDF Export — web-only via print dialog
 * On iOS Safari: Share → "Salva come PDF"
 * On desktop: direct PDF print
 */

export interface PdfHeader {
  teamName: string;
  logoUrl?: string | null;
  title: string;
  subtitle?: string;
}

function logoHtml(logoUrl?: string | null, teamName?: string) {
  if (!logoUrl) return `<div class="logo-placeholder">${(teamName ?? "").charAt(0).toUpperCase()}</div>`;
  return `<img src="${logoUrl}" class="logo-img" alt="logo" />`;
}

function headerHtml(h: PdfHeader) {
  return `
  <div class="pdf-header">
    <div class="header-left">
      ${logoHtml(h.logoUrl, h.teamName)}
      <div class="header-text">
        <div class="team-name">${h.teamName || "MisterProLab"}</div>
        <div class="doc-title">${h.title}</div>
        ${h.subtitle ? `<div class="doc-subtitle">${h.subtitle}</div>` : ""}
      </div>
    </div>
    <div class="header-brand">
      <img src="https://app.misterprolab.it/logo.png" class="brand-logo" alt="MisterProLab" onerror="this.style.display='none'" />
    </div>
  </div>
  <hr class="header-divider" />`;
}

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #fff; color: #1a1a1a; font-size: 13px; padding: 20px 24px; }
  
  .pdf-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .header-left { display: flex; align-items: center; gap: 12px; }
  .logo-placeholder { width: 44px; height: 44px; border-radius: 22px; background: #0E5A3C; color: #D4AF37; font-size: 22px; font-weight: 900; display: flex; align-items: center; justify-content: center; }
  .logo-img { width: 44px; height: 44px; border-radius: 8px; object-fit: contain; }
  .header-text .team-name { font-size: 16px; font-weight: 800; color: #0E5A3C; }
  .header-text .doc-title { font-size: 12px; font-weight: 600; color: #666; margin-top: 1px; }
  .header-text .doc-subtitle { font-size: 11px; color: #999; margin-top: 1px; }
  .brand-logo { height: 28px; opacity: 0.5; }
  .header-divider { border: none; border-top: 2px solid #0E5A3C; margin-bottom: 14px; }

  /* Match riepilogo */
  .match-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; align-items: center; }
  .badge { border-radius: 6px; padding: 3px 10px; font-size: 11px; font-weight: 700; display: inline-block; }
  .badge-comp { background: #0E5A3C15; color: #0E5A3C; border: 1px solid #0E5A3C40; }
  .badge-home { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
  .badge-away { background: #fff3cd; color: #856404; border: 1px solid #ffeeba; }
  .badge-form { background: #e8f4f8; color: #0c5460; border: 1px solid #bee5eb; }
  .vs-title { font-size: 18px; font-weight: 900; color: #1a1a1a; }
  .vs-opp { color: #0E5A3C; }
  .meta-detail { font-size: 12px; color: #666; }

  /* Pitch SVG */
  .pitch-wrap { display: flex; justify-content: center; margin: 10px 0; }
  
  /* Tabella giocatori */
  .players-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 8px 0; }
  .player-row { display: flex; align-items: center; gap: 7px; padding: 4px 8px; border-radius: 6px; background: #f8f8f8; }
  .player-num { width: 22px; height: 22px; border-radius: 11px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 900; color: #fff; flex-shrink: 0; }
  .player-name { font-size: 11px; font-weight: 600; color: #333; }
  .player-role { font-size: 9px; color: #888; margin-left: 2px; }
  .captain-badge { font-size: 9px; background: #D4AF37; color: #fff; border-radius: 3px; padding: 0 3px; margin-left: 3px; }

  /* Panchina */
  .section-label { font-size: 10px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.8px; margin: 10px 0 5px; }
  .bench-grid { display: flex; flex-wrap: wrap; gap: 4px; }
  .bench-chip { display: flex; align-items: center; gap: 5px; padding: 3px 8px; background: #f0f0f0; border-radius: 12px; font-size: 11px; }
  .bench-num { font-weight: 800; color: #0E5A3C; }

  /* Specialisti */
  .spec-table { width: 100%; border-collapse: collapse; margin: 8px 0; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
  .spec-table td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; font-size: 12px; vertical-align: middle; }
  .spec-table tr:last-child td { border-bottom: none; }
  .spec-label { font-weight: 700; color: #555; width: 35%; }
  .spec-val { color: #1a1a1a; font-weight: 600; }
  .spec-table tr:nth-child(even) td { background: #fafafa; }

  /* Note */
  .notes-box { background: #f9f9f9; border-left: 3px solid #0E5A3C; border-radius: 0 6px 6px 0; padding: 8px 12px; margin-top: 10px; font-size: 12px; color: #444; line-height: 1.5; }
  .notes-label { font-size: 10px; font-weight: 700; color: #888; text-transform: uppercase; margin-bottom: 4px; }

  /* Seduta */
  .session-title { font-size: 20px; font-weight: 900; margin-bottom: 6px; }
  .session-meta { display: flex; gap: 16px; margin-bottom: 12px; font-size: 12px; color: #666; }
  .ex-card { display: flex; gap: 10px; padding: 8px 10px; border: 1px solid #e8e8e8; border-radius: 8px; margin-bottom: 6px; }
  .ex-num-circle { width: 28px; height: 28px; border-radius: 14px; background: #0E5A3C20; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: #0E5A3C; flex-shrink: 0; }
  .ex-name { font-size: 13px; font-weight: 700; margin-bottom: 3px; }
  .ex-cat { display: inline-block; font-size: 10px; font-weight: 700; border: 1px solid; border-radius: 5px; padding: 1px 7px; margin-bottom: 4px; }
  .ex-meta { font-size: 11px; color: #888; }
  .ex-notes { font-size: 11px; color: #999; font-style: italic; margin-top: 2px; }
  .total-bar { display: flex; align-items: center; gap: 8px; background: #f0f7f3; border: 1px solid #0E5A3C30; border-radius: 8px; padding: 10px 14px; margin-top: 10px; font-size: 13px; color: #555; }
  .total-bar strong { color: #0E5A3C; }

  /* Convocazione */
  .conv-section { margin-bottom: 12px; }
  .conv-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }

  /* Campo tattico */
  .tactical-img { width: 100%; max-width: 500px; display: block; margin: 0 auto 12px; border-radius: 10px; }

  @media print {
    body { padding: 10px 16px; }
    @page { margin: 10mm; size: A4 portrait; }
  }
`;

// ─── Riepilogo partita ────────────────────────────────────────────────────────
export interface MatchPdfData {
  opponent: string;
  date: string;
  time?: string;
  venue?: string;
  homeAway: "home" | "away";
  competition?: string;
  formation: string;
  starters: Array<{
    name: string;
    number: number | string;
    role: string;
    posRole: string;
    isCaptain?: boolean;
    isViceCaptain?: boolean;
  }>;
  bench: Array<{ name: string; number: number | string; role: string }>;
  captain?: string;
  viceCaptain?: string;
  cornerTakers?: string[];
  freekickTakers?: string[];
  penaltyTakers?: string[];
  wallPlayers?: string[];
  notes?: string;
}

const ROLE_COLORS: Record<string, string> = {
  portiere: "#1abc9c", difensore: "#3498db", centrocampista: "#f1c40f", attaccante: "#e74c3c",
};

function pitchSvg(starters: MatchPdfData["starters"], formation: string): string {
  const W = 260; const H = 360;
  const lines = formation.split("-").map(Number);

  function spreadX(n: number): number[] {
    if (n === 1) return [50];
    const pad = n >= 5 ? 8 : n === 4 ? 10 : n === 3 ? 14 : 20;
    return Array.from({ length: n }, (_, i) => pad + (i / (n - 1)) * (100 - pad * 2));
  }
  function lineYs(numLines: number): number[] {
    const bands: Record<number, number[]> = { 1: [42], 2: [64, 26], 3: [66, 44, 22], 4: [68, 52, 36, 18] };
    return bands[numLines] ?? Array.from({ length: numLines }, (_, i) => 68 - (i / (numLines - 1)) * 50);
  }

  const positions: Array<{ x: number; y: number }> = [{ x: 50, y: 88 }];
  const ys = lineYs(lines.length);
  lines.forEach((count, li) => {
    spreadX(count).forEach(x => positions.push({ x, y: ys[li] }));
  });

  const stripes = Array.from({ length: 8 }, (_, i) =>
    `<rect x="0" y="${i * H / 8}" width="${W}" height="${H / 8}" fill="${i % 2 === 0 ? "#1a472a" : "#1e5230"}" />`
  ).join("");
  const lc = "rgba(255,255,255,0.4)";
  const fieldLines = `
    <rect x="8" y="8" width="${W - 16}" height="${H - 16}" fill="none" stroke="${lc}" stroke-width="1.5" rx="3"/>
    <line x1="8" y1="${H / 2}" x2="${W - 8}" y2="${H / 2}" stroke="${lc}" stroke-width="1.2"/>
    <circle cx="${W / 2}" cy="${H / 2}" r="${W * 0.13}" fill="none" stroke="${lc}" stroke-width="1.2"/>
    <rect x="${W * 0.22}" y="8" width="${W * 0.56}" height="${H * 0.18}" fill="none" stroke="${lc}" stroke-width="1.2"/>
    <rect x="${W * 0.36}" y="8" width="${W * 0.28}" height="${H * 0.08}" fill="none" stroke="${lc}" stroke-width="1.2"/>
    <rect x="${W * 0.22}" y="${H - 8 - H * 0.18}" width="${W * 0.56}" height="${H * 0.18}" fill="none" stroke="${lc}" stroke-width="1.2"/>
    <rect x="${W * 0.36}" y="${H - 8 - H * 0.08}" width="${W * 0.28}" height="${H * 0.08}" fill="none" stroke="${lc}" stroke-width="1.2"/>
  `;

  const tokens = starters.map((p, i) => {
    const pos = positions[i] ?? { x: 50, y: 50 };
    const px = (pos.x / 100) * W;
    const py = (pos.y / 100) * H;
    const color = ROLE_COLORS[p.role] ?? "#888";
    const surname = p.name?.split(" ").pop() ?? "?";
    const capMark = p.isCaptain ? `<text x="${px + 9}" y="${py - 10}" font-size="8" fill="#D4AF37" font-weight="900">C</text>` : "";
    return `
      <circle cx="${px}" cy="${py}" r="11" fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <text x="${px}" y="${py + 3.5}" text-anchor="middle" font-size="7.5" font-weight="900" fill="#fff">${p.number}</text>
      <rect x="${px - 14}" y="${py + 13}" width="28" height="10" rx="2" fill="rgba(0,0,0,0.7)"/>
      <text x="${px}" y="${py + 21}" text-anchor="middle" font-size="6" font-weight="700" fill="#fff">${surname.substring(0, 8)}</text>
      ${capMark}
    `;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="border-radius:8px;overflow:hidden;display:block">
    ${stripes}${fieldLines}${tokens}
  </svg>`;
}

export function exportMatchPdf(header: PdfHeader, match: MatchPdfData) {
  const fmtDate = (d: string) => {
    const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`;
  };
  const homeAwayLabel = match.homeAway === "home" ? "CASA" : "TRASFERTA";
  const homeAwayClass = match.homeAway === "home" ? "badge-home" : "badge-away";

  const startersHtml = match.starters.map(p => `
    <div class="player-row">
      <div class="player-num" style="background:${ROLE_COLORS[p.role] ?? "#888"}">${p.number}</div>
      <div>
        <span class="player-name">${p.name}</span>
        <span class="player-role">${p.posRole}</span>
        ${p.isCaptain ? `<span class="captain-badge">C</span>` : ""}
        ${p.isViceCaptain ? `<span class="captain-badge" style="background:#aaa">VC</span>` : ""}
      </div>
    </div>`).join("");

  const benchHtml = match.bench.map(p => `
    <div class="bench-chip">
      <span class="bench-num">${p.number}</span>
      <span>${p.name?.split(" ").pop()}</span>
    </div>`).join("");

  const specRows = [
    ["👑 Capitano", match.captain || "—"],
    ["⭐ V.Capitano", match.viceCaptain || "—"],
    ["🚩 Angoli", match.cornerTakers?.join(", ") || "—"],
    ["🎯 Punizioni", match.freekickTakers?.join(", ") || "—"],
    ["⚽ Rigori", match.penaltyTakers?.join(", ") || "—"],
    ["🧱 Barriera", match.wallPlayers?.join(", ") || "—"],
  ];

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Foglio Partita</title><style>${BASE_CSS}</style></head><body>
    ${headerHtml(header)}
    <div class="match-meta">
      ${match.competition ? `<span class="badge badge-comp">${match.competition.toUpperCase()}</span>` : ""}
      <span class="vs-title">vs <span class="vs-opp">${match.opponent}</span></span>
      <span class="meta-detail">${fmtDate(match.date)}${match.time ? `  ${match.time}` : ""}</span>
      ${match.venue ? `<span class="meta-detail">📍 ${match.venue}</span>` : ""}
      <span class="badge ${homeAwayClass}">${homeAwayLabel}</span>
      <span class="badge badge-form">${match.formation}</span>
    </div>

    <div style="display:flex;gap:16px;align-items:flex-start">
      <div style="flex-shrink:0">
        <div class="pitch-wrap">${pitchSvg(match.starters, match.formation)}</div>
      </div>
      <div style="flex:1;min-width:0">
        <div class="section-label">Titolari</div>
        <div class="players-grid">${startersHtml}</div>
        ${match.bench.length > 0 ? `<div class="section-label">Panchina</div><div class="bench-grid">${benchHtml}</div>` : ""}
      </div>
    </div>

    <div class="section-label">Specialisti</div>
    <table class="spec-table">
      ${specRows.map(([l, v]) => `<tr><td class="spec-label">${l}</td><td class="spec-val">${v}</td></tr>`).join("")}
    </table>

    ${match.notes ? `<div class="notes-label">Note</div><div class="notes-box">${match.notes}</div>` : ""}
  </body></html>`;

  _printHtml(html);
}

// ─── Seduta di allenamento ────────────────────────────────────────────────────
export interface SessionPdfData {
  title: string;
  date: string;
  duration: number;
  notes?: string;
  exercises: Array<{
    order: number;
    name: string;
    category: string;
    categoryLabel: string;
    categoryColor: string;
    duration: number;
    notes?: string;
  }>;
}

export function exportSessionPdf(header: PdfHeader, session: SessionPdfData) {
  const exercisesHtml = session.exercises
    .sort((a, b) => a.order - b.order)
    .map((ex, i) => `
      <div class="ex-card">
        <div class="ex-num-circle">${i + 1}</div>
        <div style="flex:1">
          <div class="ex-name">${ex.name}</div>
          <span class="ex-cat" style="color:${ex.categoryColor};border-color:${ex.categoryColor}">${ex.categoryLabel}</span>
          <div class="ex-meta">⏱ ${ex.duration} min${ex.notes ? ` · <span class="ex-notes">${ex.notes}</span>` : ""}</div>
        </div>
      </div>`).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Seduta di Allenamento</title><style>${BASE_CSS}</style></head><body>
    ${headerHtml(header)}
    <div class="session-title">${session.title}</div>
    <div class="session-meta">
      <span>📅 ${session.date}</span>
      <span>⏱ ${session.duration} min</span>
      <span>📋 ${session.exercises.length} esercizi</span>
    </div>
    ${session.notes ? `<div class="notes-box" style="margin-bottom:12px">${session.notes}</div>` : ""}
    <div class="section-label">Programma</div>
    ${exercisesHtml}
    <div class="total-bar">⏱ Durata totale: <strong>${session.duration} min</strong></div>
  </body></html>`;

  _printHtml(html);
}

// ─── Convocazione ─────────────────────────────────────────────────────────────
export interface ConvocationPdfData {
  opponent: string;
  date: string;
  time?: string;
  venue?: string;
  homeAway: "home" | "away";
  competition?: string;
  players: Array<{ name: string; number: number | string; role: string; jerseyNumber?: number | string | null }>;
  notes?: string;
}

export function exportConvocationPdf(header: PdfHeader, data: ConvocationPdfData) {
  const fmtDate = (d: string) => { const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };

  const playersHtml = data.players.map(p => `
    <div class="player-row">
      <div class="player-num" style="background:${ROLE_COLORS[p.role] ?? "#888"}">${p.jerseyNumber ?? p.number}</div>
      <span class="player-name">${p.name}</span>
    </div>`).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Convocazione</title><style>${BASE_CSS}</style></head><body>
    ${headerHtml(header)}
    <div class="match-meta">
      ${data.competition ? `<span class="badge badge-comp">${data.competition.toUpperCase()}</span>` : ""}
      <span class="vs-title">vs <span class="vs-opp">${data.opponent}</span></span>
      <span class="meta-detail">${fmtDate(data.date)}${data.time ? `  ${data.time}` : ""}</span>
      ${data.venue ? `<span class="meta-detail">📍 ${data.venue}</span>` : ""}
      <span class="badge ${data.homeAway === "home" ? "badge-home" : "badge-away"}">${data.homeAway === "home" ? "CASA" : "TRASFERTA"}</span>
    </div>
    <div class="section-label">Convocati (${data.players.length})</div>
    <div class="players-grid">${playersHtml}</div>
    ${data.notes ? `<div class="notes-label">Note</div><div class="notes-box">${data.notes}</div>` : ""}
  </body></html>`;

  _printHtml(html);
}

// ─── Campo tattico ─────────────────────────────────────────────────────────────
export interface TacticalPdfData {
  boardName?: string;
  svgContent: string; // SVG string del campo
}

export function exportTacticalPdf(header: PdfHeader, data: TacticalPdfData) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Campo Tattico</title><style>${BASE_CSS}</style></head><body>
    ${headerHtml({ ...header, title: data.boardName || "Campo Tattico" })}
    <div class="pitch-wrap" style="margin:0 auto">${data.svgContent}</div>
  </body></html>`;
  _printHtml(html);
}

// ─── Core print ───────────────────────────────────────────────────────────────
function _printHtml(html: string) {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) {
    // fallback: iframe
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);
    iframe.contentDocument?.open();
    iframe.contentDocument?.write(html);
    iframe.contentDocument?.close();
    setTimeout(() => { iframe.contentWindow?.print(); document.body.removeChild(iframe); }, 500);
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
  // fallback se onload non scatta
  setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 800);
}
