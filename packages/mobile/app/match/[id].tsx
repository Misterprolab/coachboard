import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, Switch, Dimensions,
  PanResponder, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { useTheme } from "../../lib/themeStore";
import type { ThemeColors } from "../../lib/themeStore";
import { useI18n } from "../../lib/i18n";
import {
  ArrowLeft, Trash, X, Check, Plus, PencilSimple,
} from "phosphor-react-native";

import {
  getMatch, getPlayers, updateMatch as dbUpdateMatch, deleteMatch as dbDeleteMatch,
  setConvocations, setLineup as dbSetLineup, replaceGoals as dbReplaceGoals,
} from "../../lib/db/queries";

type Player = { id: string; name: string; number?: number; role: string };
type LineupPlayer = {
  playerId: string; positionRole: string; jerseyNumber: number | null;
  isCaptain: boolean; isViceCaptain: boolean; isFreekickTaker: boolean;
  isCornerTaker: boolean; isPenaltyTaker: boolean; isWallPlayer: boolean;
  posX?: number | null; posY?: number | null; player?: Player;
};
type Goal = { id?: string; playerId: string | null; minute: number | null; type: "goal" | "autogoal" | "rigore"; notes: string; player?: Player };
type Substitution = { playerOutId: string; playerInId: string; minute?: number | null };
type Match = {
  id: string; opponent: string; date: string; time?: string; venue?: string;
  homeAway: string; competition?: string; formation?: string; notes?: string;
  goalsFor?: number; goalsAgainst?: number;
  substitutions?: Substitution[];
  convocations: { playerId: string; jerseyNumber?: number | null; player?: Player }[];
  lineup: LineupPlayer[]; goals: Goal[];
  cards?: { playerId: string; type: "yellow" | "red" | "injury"; minute?: number | null; notes?: string }[];
};

const FORMATIONS = ["4-3-3","4-4-2","4-2-3-1","3-5-2","3-4-3","5-3-2","4-5-1","4-1-4-1","3-4-1-2"];
const POSITION_ROLES = ["POR","DC","DS","DD","TT","TS","MCD","CDC","MCO","TC","ALA-D","ALA-S","PC","SEC"];
const ROLE_COLORS: Record<string,string> = {
  portiere: "#1abc9c", difensore: "#3498db", centrocampista: "#f1c40f", attaccante: "#e74c3c",
};

type FieldPos = { x: number; y: number };

function spreadX(n: number, leftPad = 12, rightPad = 12): number[] {
  if (n === 1) return [50];
  const usable = 100 - leftPad - rightPad;
  return Array.from({ length: n }, (_, i) => leftPad + (i / (n - 1)) * usable);
}

function computeLineYs(numLines: number): number[] {
  const bands: Record<number, number[]> = { 1: [42], 2: [64, 26], 3: [66, 44, 22], 4: [68, 52, 36, 18] };
  return bands[numLines] ?? Array.from({ length: numLines }, (_, i) => 68 - (i / (numLines - 1)) * 50);
}

function getFormationPositions(formation: string): FieldPos[] {
  const lines = formation.split("-").map(Number);
  const positions: FieldPos[] = [{ x: 50, y: 88 }];
  const lineYs = computeLineYs(lines.length);
  lines.forEach((count, li) => {
    const y = lineYs[li];
    const pad = count >= 5 ? 8 : count === 4 ? 10 : count === 3 ? 14 : count === 2 ? 20 : 0;
    spreadX(count, pad, pad).forEach(x => positions.push({ x, y }));
  });
  return positions;
}

function posRoleToLineIdx(posRole: string, _formation: string): number {
  if (["POR"].includes(posRole)) return -1;
  if (["DC","DS","DD","TT","LD","LS","LIB"].includes(posRole)) return 0;
  if (["PC","SEC","ALA-D","ALA-S","FA"].includes(posRole)) return 2;
  return 1;
}

// ─── Pitch components — always green, no theme ───────────────────────────────
function PitchLines({ W, H }: { W: number; H: number }) {
  const lw = 1.5; const lc = "rgba(255,255,255,0.35)"; const stripes = 8; const stripeH = H / stripes;
  return (
    <View style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: stripes }).map((_, i) => (
        <View key={i} style={{ position: "absolute", left: 0, right: 0, top: i * stripeH, height: stripeH, backgroundColor: i % 2 === 0 ? "#1a472a" : "#1e5230" }} />
      ))}
      <View style={{ position: "absolute", top: 8, left: 8, right: 8, bottom: 8, borderWidth: lw, borderColor: lc, borderRadius: 4 }} />
      <View style={{ position: "absolute", left: 8, right: 8, top: H * 0.5 - lw / 2, height: lw, backgroundColor: lc }} />
      <View style={{ position: "absolute", width: W * 0.28, height: W * 0.28, borderRadius: W * 0.14, borderWidth: lw, borderColor: lc, left: W / 2 - W * 0.14, top: H / 2 - W * 0.14 }} />
      <View style={{ position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: lc, left: W / 2 - 3, top: H / 2 - 3 }} />
      <View style={{ position: "absolute", left: W * 0.22, right: W * 0.22, top: 8, height: H * 0.18, borderWidth: lw, borderColor: lc, borderTopWidth: 0 }} />
      <View style={{ position: "absolute", left: W * 0.36, right: W * 0.36, top: 8, height: H * 0.08, borderWidth: lw, borderColor: lc, borderTopWidth: 0 }} />
      <View style={{ position: "absolute", left: W * 0.22, right: W * 0.22, bottom: 8, height: H * 0.18, borderWidth: lw, borderColor: lc, borderBottomWidth: 0 }} />
      <View style={{ position: "absolute", left: W * 0.36, right: W * 0.36, bottom: 8, height: H * 0.08, borderWidth: lw, borderColor: lc, borderBottomWidth: 0 }} />
    </View>
  );
}

type Section = "info" | "convocati" | "formazione" | "specialisti" | "risultato" | "riepilogo";
const SECTIONS: { key: Section; it: string; en: string }[] = [
  { key: "info", it: "Info", en: "Info" },
  { key: "convocati", it: "Convocati", en: "Squad" },
  { key: "formazione", it: "Formazione", en: "Lineup" },
  { key: "specialisti", it: "Specialisti", en: "Roles" },
  { key: "riepilogo", it: "📋", en: "📋" },
  { key: "risultato", it: "Risultato", en: "Result" },
];

function formatDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MatchDetailScreen() {
  const c = useTheme((s) => s.colors);
  const s = useMemo(() => mkStyles(c), [c]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();
  const [section, setSection] = useState<Section>("info");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mainScrollRef = useRef<any>(null);

  const matchQ = useQuery<Match>({ queryKey: ["match", id], queryFn: () => getMatch(id!) as Promise<Match>, enabled: !!id });
  const allPlayersQ = useQuery<Player[]>({ queryKey: ["players"], queryFn: () => getPlayers() as Promise<Player[]> });
  const deleteMatch = useMutation({
    mutationFn: () => dbDeleteMatch(id!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["matches"] }); router.back(); },
  });

  if (matchQ.isLoading || allPlayersQ.isLoading) {
    return <SafeAreaView style={s.safe} edges={["top","left","right"]}><ActivityIndicator color={c.primary} style={{ marginTop: 40 }} /></SafeAreaView>;
  }
  const match = matchQ.data;
  if (!match || (match as any).error) {
    return <SafeAreaView style={s.safe} edges={["top","left","right"]}><Text style={s.errorTxt}>{t("Partita non trovata","Match not found")}</Text></SafeAreaView>;
  }

  const allPlayers = allPlayersQ.data || [];
  const haScore = match.goalsFor != null && match.goalsAgainst != null;
  const result = haScore ? (match.goalsFor! > match.goalsAgainst! ? "V" : match.goalsFor! < match.goalsAgainst! ? "S" : "P") : null;
  const resultColors: Record<string,string> = { V: c.primary, P: c.accent, S: c.danger };

  return (
    <SafeAreaView style={s.safe} edges={["top","left","right"]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><ArrowLeft color={c.text} size={24} /></TouchableOpacity>
        <View style={s.topTitle}>
          <Text style={s.topOpponent} numberOfLines={1}>vs {match.opponent}</Text>
          <Text style={s.topDate}>{formatDate(match.date)}{match.time ? ` · ${match.time}` : ""}</Text>
        </View>
        {confirmDelete ? (
          <View style={s.confirmRow}>
            <TouchableOpacity style={[s.iconBtn, s.cancelBtn]} onPress={() => setConfirmDelete(false)}><X color={c.textMuted} size={14} weight="bold" /></TouchableOpacity>
            <TouchableOpacity style={[s.iconBtn, s.delBtn]} onPress={() => deleteMatch.mutate()} disabled={deleteMatch.isPending}>
              {deleteMatch.isPending ? <ActivityIndicator size={12} color="#fff" /> : <Check color="#fff" size={14} weight="bold" />}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setConfirmDelete(true)} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
            <Trash color={c.danger} size={22} weight="fill" />
          </TouchableOpacity>
        )}
      </View>

      {confirmDelete && (
        <View style={s.confirmBanner}><Text style={s.confirmBannerTxt}>{t("Eliminare questa partita?","Delete this match?")}</Text></View>
      )}

      {haScore && section !== "riepilogo" && (
        <View style={[s.scorePill, { borderColor: resultColors[result!] + "60" }]}>
          <Text style={[s.scoreNum, { color: resultColors[result!] }]}>{match.goalsFor} – {match.goalsAgainst}</Text>
          <View style={[s.resultBadge, { backgroundColor: resultColors[result!] + "25" }]}>
            <Text style={[s.resultTxt, { color: resultColors[result!] }]}>{result}</Text>
          </View>
        </View>
      )}

      <View style={s.tabs}>
        {SECTIONS.map(sec => (
          <TouchableOpacity key={sec.key} style={[s.tab, section === sec.key && s.tabActive]} onPress={() => setSection(sec.key)}>
            <Text style={[s.tabTxt, section === sec.key && s.tabTxtActive]}>{t(sec.it, sec.en)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView ref={mainScrollRef} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {section === "info" && <InfoSection match={match} id={id} qc={qc} c={c} />}
        {section === "convocati" && <ConvocatiSection match={match} allPlayers={allPlayers} id={id} qc={qc} c={c} />}
        {section === "formazione" && <FormazioneSection match={match} allPlayers={allPlayers} id={id} qc={qc} c={c} scrollRef={mainScrollRef} />}
        {section === "specialisti" && <SpecialistiSection match={match} allPlayers={allPlayers} id={id} qc={qc} c={c} />}
        {section === "risultato" && <RisultatoSection match={match} allPlayers={allPlayers} id={id} qc={qc} c={c} />}
        {section === "riepilogo" && <RiepilogoSection match={match} allPlayers={allPlayers} id={id} qc={qc} c={c} />}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── INFO Section ─────────────────────────────────────────────────────────────
function InfoSection({ match, id, qc, c }: { match: Match; id: string; qc: any; c: ThemeColors }) {
  const s2 = useMemo(() => mkStyles2(c), [c]);
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    opponent: match.opponent, date: match.date, time: match.time ?? "",
    venue: match.venue ?? "", competition: match.competition ?? "",
    homeAway: match.homeAway, formation: match.formation ?? "", notes: match.notes ?? "",
  });
  const updateMatch = useMutation({
    mutationFn: (data: typeof form) => dbUpdateMatch(id, {
      opponent: data.opponent, date: data.date,
      time: data.time || null, venue: data.venue || null,
      competition: data.competition || null, homeAway: data.homeAway,
      formation: data.formation || null, notes: data.notes || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["match", id] }); setEditing(false); },
  });
  const HA_LABELS: Record<string,{it:string;en:string}> = {
    home:{it:"Casa",en:"Home"}, away:{it:"Trasferta",en:"Away"}, neutral:{it:"Neutro",en:"Neutral"},
  };

  if (!editing) {
    return (
      <View style={s2.infoCard}>
        {[
          { label: t("Avversario","Opponent"), val: match.opponent },
          { label: t("Data","Date"), val: `${formatDate(match.date)}${match.time ? ` · ${match.time}` : ""}` },
          match.venue ? { label: t("Campo","Venue"), val: match.venue } : null,
          match.competition ? { label: t("Competizione","Competition"), val: match.competition } : null,
          { label: t("Tipo","Type"), val: t(HA_LABELS[match.homeAway]?.it ?? match.homeAway, HA_LABELS[match.homeAway]?.en ?? match.homeAway) },
          match.formation ? { label: t("Modulo","Formation"), val: match.formation, primary: true } : null,
        ].filter(Boolean).map((row: any) => (
          <View key={row.label} style={s2.infoRow}>
            <Text style={s2.infoLabel}>{row.label}</Text>
            <Text style={[s2.infoVal, row.primary && { color: c.primary, fontWeight: "800" }]}>{row.val}</Text>
          </View>
        ))}
        {match.notes && (
          <View style={[s2.infoRow, { flexDirection: "column", alignItems: "flex-start" }]}>
            <Text style={s2.infoLabel}>{t("Note","Notes")}</Text>
            <Text style={[s2.infoVal, { marginLeft: 0, marginTop: 4 }]}>{match.notes}</Text>
          </View>
        )}
        <TouchableOpacity style={s2.editBtn} onPress={() => setEditing(true)}>
          <PencilSimple color={c.primary} size={16} />
          <Text style={s2.editBtnTxt}>{t("Modifica","Edit")}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View>
      {([
        { label: t("Avversario","Opponent"), key: "opponent" },
        { label: t("Data (YYYY-MM-DD)","Date (YYYY-MM-DD)"), key: "date" },
        { label: t("Orario","Time"), key: "time", placeholder: "15:00" },
        { label: t("Campo","Venue"), key: "venue" },
        { label: t("Competizione","Competition"), key: "competition" },
      ] as { label: string; key: keyof typeof form; placeholder?: string }[]).map(({ label, key, placeholder }) => (
        <View key={key}>
          <Text style={s2.label}>{label}</Text>
          <TextInput style={s2.input} value={form[key] as string} onChangeText={v => setForm(f => ({ ...f, [key]: v }))} placeholder={placeholder} placeholderTextColor={c.textDim} />
        </View>
      ))}
      <Text style={s2.label}>{t("Modulo","Formation")}</Text>
      <View style={s2.formChips}>
        {FORMATIONS.map(f => (
          <TouchableOpacity key={f} style={[s2.chip, form.formation === f && s2.chipActive]} onPress={() => setForm(ff => ({ ...ff, formation: f }))}>
            <Text style={[s2.chipTxt, form.formation === f && s2.chipTxtActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s2.label}>{t("Casa / Trasferta","Home / Away")}</Text>
      <View style={s2.segRow}>
        {(["home","away","neutral"] as const).map(opt => (
          <TouchableOpacity key={opt} style={[s2.seg, form.homeAway === opt && s2.segActive]} onPress={() => setForm(f => ({ ...f, homeAway: opt }))}>
            <Text style={[s2.segTxt, form.homeAway === opt && s2.segTxtActive]}>
              {opt === "home" ? t("Casa","Home") : opt === "away" ? t("Trasf.","Away") : t("Neutro","Neutral")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s2.label}>{t("Note","Notes")}</Text>
      <TextInput style={[s2.input, { height: 80, textAlignVertical: "top" }]} value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} multiline placeholderTextColor={c.textDim} />
      <View style={s2.btnRow}>
        <TouchableOpacity style={s2.cancelBtnFull} onPress={() => setEditing(false)}><Text style={s2.cancelBtnTxt}>{t("Annulla","Cancel")}</Text></TouchableOpacity>
        <TouchableOpacity style={s2.saveBtnFull} onPress={() => updateMatch.mutate(form)} disabled={updateMatch.isPending}>
          {updateMatch.isPending ? <ActivityIndicator color="#000" /> : <Text style={s2.saveBtnTxt}>{t("Salva","Save")}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── CONVOCATI Section ────────────────────────────────────────────────────────
function ConvocatiSection({ match, allPlayers, id, qc, c }: { match: Match; allPlayers: Player[]; id: string; qc: any; c: ThemeColors }) {
  const s2 = useMemo(() => mkStyles2(c), [c]);
  const { t } = useI18n();
  const convIds = new Set(match.convocations.map(cv => cv.playerId));
  const [selected, setSelected] = useState<Set<string>>(new Set(convIds));
  const [convJerseys, setConvJerseys] = useState<Record<string,string>>(() => {
    const m: Record<string,string> = {};
    // First load saved jersey numbers from convocations (set during previous save)
    match.convocations.forEach(cv => {
      if (cv.jerseyNumber != null) m[cv.playerId] = String(cv.jerseyNumber);
    });
    // Fallback: for players not in convocations, use their default number
    allPlayers.forEach(p => {
      if (m[p.id] == null && p.number != null) m[p.id] = String(p.number);
    });
    return m;
  });
  const saveMutation = useMutation({
    mutationFn: () => setConvocations(id, [...selectedRef.current].map(pid => ({
      playerId: pid,
      jerseyNumber: convJerseysRef.current[pid] ? parseInt(convJerseysRef.current[pid]) : null,
    }))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["match", id] }),
  });

  // Auto-save refs — keep latest state accessible without stale closures
  const selectedRef = useRef(selected);
  const convJerseysRef = useRef(convJerseys);
  selectedRef.current = selected;
  convJerseysRef.current = convJerseys;
  const [autoSaving, setAutoSaving] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutoSave = () => {
    setAutoSaving(true);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const sel = selectedRef.current;
      const jerseys = convJerseysRef.current;
      setConvocations(id, [...sel].map(pid => ({
        playerId: pid,
        jerseyNumber: jerseys[pid] ? parseInt(jerseys[pid]) : null,
      })))
        .then(() => { qc.invalidateQueries({ queryKey: ["match", id] }); setAutoSaving(false); })
        .catch(() => { setAutoSaving(false); });
    }, 800);
  };

  const toggle = (pid: string) => { setSelected(prev => { const n = new Set(prev); n.has(pid) ? n.delete(pid) : n.add(pid); return n; }); scheduleAutoSave(); };
  const sorted = [...allPlayers].sort((a, b) => { const ro = { portiere: 0, difensore: 1, centrocampista: 2, attaccante: 3 }; return (ro[a.role as keyof typeof ro] ?? 4) - (ro[b.role as keyof typeof ro] ?? 4); });
  const ROLE_LABELS: Record<string,string> = { portiere:"Portieri", difensore:"Difensori", centrocampista:"Centrocampisti", attaccante:"Attaccanti" };
  const groups: { role: string; players: Player[] }[] = [];
  sorted.forEach(p => { let g = groups.find(x => x.role === p.role); if (!g) { g = { role: p.role, players: [] }; groups.push(g); } g.players.push(p); });

  return (
    <View>
      <View style={s2.sectionHeader}>
        <Text style={s2.sectionTitle}>{t(`${selected.size} convocati`, `${selected.size} called up`)}</Text>
        <TouchableOpacity style={s2.saveSmall} onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending || autoSaving}>
          {(saveMutation.isPending || autoSaving) ? <ActivityIndicator size={14} color="#000" /> : <Text style={s2.saveSmallTxt}>{t("Salva","Save")}</Text>}
        </TouchableOpacity>
      </View>
      <Text style={{ fontSize: 11, color: c.textDim, marginBottom: 10, fontStyle: "italic" }}>
        {t("Tocca per selezionare · Modifica il numero maglia per questa partita","Tap to select · Edit jersey number for this match")}
      </Text>
      {allPlayers.length === 0 ? <Text style={s2.emptyTxt}>{t("Nessun giocatore in rosa","No players in roster")}</Text> : (
        groups.map(g => (
          <View key={g.role}>
            <Text style={s2.roleHeader}>{ROLE_LABELS[g.role] || g.role}</Text>
            {g.players.map(p => {
              const checked = selected.has(p.id);
              return (
                <View key={p.id} style={[s2.convRow, checked && s2.convRowActive]}>
                  <TouchableOpacity style={s2.convLeft} onPress={() => toggle(p.id)} activeOpacity={0.7}>
                    <View style={[s2.playerDot, { backgroundColor: ROLE_COLORS[p.role] || c.primary }]} />
                    <Text style={[s2.playerName, checked && { color: c.text }]}>{p.name}</Text>
                  </TouchableOpacity>
                  <TextInput style={[s2.convNumInput, !checked && s2.convNumInputDim]} value={convJerseys[p.id] ?? ""} onChangeText={v => { setConvJerseys(prev => ({ ...prev, [p.id]: v })); scheduleAutoSave(); }} keyboardType="number-pad" placeholder="#" placeholderTextColor={c.textDim} maxLength={3} editable={checked} />
                  <TouchableOpacity onPress={() => toggle(p.id)} style={[s2.checkbox, checked && s2.checkboxChecked]}>
                    {checked && <Check color="#000" size={12} weight="bold" />}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ))
      )}
    </View>
  );
}

// ─── Draggable Token ──────────────────────────────────────────────────────────
type DragTokenProps = {
  playerId: string; num: string; name: string; color: string;
  isCaptain: boolean; isViceCaptain: boolean;
  initX: number; initY: number; // pixel coords of token center
  W: number; H: number;
  onDragStart: () => void;
  onDragEnd: (xPct: number, yPct: number) => void;
  onTap: () => void;
  onLongPress: () => void;
};
function DraggableToken({ playerId, num, name, color, isCaptain, isViceCaptain, initX, initY, W, H, onDragStart, onDragEnd, onTap, onLongPress }: DragTokenProps) {
  const pan = useRef(new Animated.ValueXY({ x: initX, y: initY })).current;
  const lastPos = useRef({ x: initX, y: initY });
  const isDragging = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moved = useRef(false);
  // Keep callbacks fresh without recreating PanResponder
  const cbRef = useRef({ onDragStart, onDragEnd, onTap, onLongPress });
  cbRef.current = { onDragStart, onDragEnd, onTap, onLongPress };

  // sync when init position changes (e.g. formation change resets)
  useEffect(() => {
    pan.setValue({ x: initX, y: initY });
    lastPos.current = { x: initX, y: initY };
  }, [initX, initY]);

  const TOKEN_W = 48; const TOKEN_H = 52;
  const minX = 0; const minY = 0;
  const maxX = W - TOKEN_W; const maxY = H - TOKEN_H;

  const panResponder = useRef(
    PanResponder.create({
      // Capture phase — intercept BEFORE parent ScrollView can claim the gesture
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => isDragging.current,
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        moved.current = false;
        isDragging.current = false;
        // Block parent scroll immediately on touch-down
        cbRef.current.onDragStart();
        longPressTimer.current = setTimeout(() => {
          if (!moved.current) { cbRef.current.onLongPress(); }
        }, 500);
      },
      onPanResponderMove: (_, gs) => {
        if (Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4) {
          moved.current = true;
          isDragging.current = true;
          if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
        }
        // clamp the delta so token stays within pitch bounds
        const rawX = lastPos.current.x + gs.dx;
        const rawY = lastPos.current.y + gs.dy;
        const clampedX = Math.max(minX, Math.min(maxX, rawX));
        const clampedY = Math.max(minY, Math.min(maxY, rawY));
        pan.x.setValue(clampedX);
        pan.y.setValue(clampedY);
      },
      onPanResponderRelease: (_, gs) => {
        if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
        const rawX = lastPos.current.x + gs.dx;
        const rawY = lastPos.current.y + gs.dy;
        const nx = Math.max(minX, Math.min(maxX, rawX));
        const ny = Math.max(minY, Math.min(maxY, rawY));
        lastPos.current = { x: nx, y: ny };
        pan.x.setValue(nx);
        pan.y.setValue(ny);
        if (!moved.current || (Math.abs(gs.dx) < 5 && Math.abs(gs.dy) < 5)) {
          cbRef.current.onTap();
        } else {
          const centerX = nx + TOKEN_W / 2;
          const centerY = ny + TOKEN_H / 2;
          cbRef.current.onDragEnd((centerX / W) * 100, (centerY / H) * 100);
        }
        isDragging.current = false;
        moved.current = false;
      },
      onPanResponderTerminate: () => {
        if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
        // Always re-enable scroll on terminate (gesture stolen by system/other)
        cbRef.current.onDragEnd(
          ((lastPos.current.x + TOKEN_W / 2) / W) * 100,
          ((lastPos.current.y + TOKEN_H / 2) / H) * 100
        );
        isDragging.current = false;
        moved.current = false;
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{ position: "absolute", left: pan.x, top: pan.y, width: TOKEN_W, height: TOKEN_H, alignItems: "center", zIndex: 10 }}
    >
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: color, borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 3 }}>
        <Text style={{ fontSize: 10, fontWeight: "900", color: "#000" }}>{num}</Text>
      </View>
      {isCaptain && <View style={{ position: "absolute", top: -10, right: 2 }}><Text style={{ fontSize: 10 }}>👑</Text></View>}
      {isViceCaptain && <View style={{ position: "absolute", top: -10, left: 2 }}><Text style={{ fontSize: 10 }}>⭐</Text></View>}
      <View style={{ backgroundColor: "#00000088", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginTop: 3, maxWidth: 56 }}>
        <Text style={{ fontSize: 8, fontWeight: "700", color: "#fff" }} numberOfLines={1}>{name}</Text>
      </View>
      <Text style={{ fontSize: 7, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>✎</Text>
    </Animated.View>
  );
}

// ─── FORMAZIONE Section ───────────────────────────────────────────────────────
function FormazioneSection({ match, allPlayers, id, qc, c, scrollRef }: { match: Match; allPlayers: Player[]; id: string; qc: any; c: ThemeColors; scrollRef?: React.RefObject<any> }) {
  const s2 = useMemo(() => mkStyles2(c), [c]);
  const { t } = useI18n();
  type LP = { playerId: string; positionRole: string; jerseyNumber: string; isCaptain: boolean; isViceCaptain: boolean; isFreekickTaker: boolean; isCornerTaker: boolean; isPenaltyTaker: boolean; isWallPlayer: boolean };
  const toLP = (l: LineupPlayer): LP => ({ playerId: l.playerId, positionRole: l.positionRole || "", jerseyNumber: l.jerseyNumber != null ? String(l.jerseyNumber) : "", isCaptain: l.isCaptain, isViceCaptain: l.isViceCaptain, isFreekickTaker: l.isFreekickTaker, isCornerTaker: l.isCornerTaker, isPenaltyTaker: l.isPenaltyTaker, isWallPlayer: l.isWallPlayer });
  const [lineup, setLineup] = useState<LP[]>(match.lineup.map(toLP));
  const [benchNums, setBenchNums] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    // First: use saved jersey numbers from convocations (match-specific)
    match.convocations.forEach(cv => {
      if (cv.jerseyNumber != null) m[cv.playerId] = String(cv.jerseyNumber);
    });
    // Then: for players already in lineup with explicit number, override with lineup jersey
    match.lineup.forEach(l => { if (l.jerseyNumber != null) m[l.playerId] = String(l.jerseyNumber); });
    // Fallback: player.number for anyone without a conv number
    allPlayers.forEach(p => { if (m[p.id] == null && p.number != null) m[p.id] = String(p.number); });
    return m;
  });
  // Sync benchNums when convocations are updated from server (after save)
  useEffect(() => {
    setBenchNums(prev => {
      const m: Record<string, string> = { ...prev };
      match.convocations.forEach(cv => {
        if (cv.jerseyNumber != null) m[cv.playerId] = String(cv.jerseyNumber);
      });
      return m;
    });
  }, [match.convocations]);

  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  // Custom drag positions: key = playerId, value = {x,y} as percentage of pitch
  // Initialize from server posX/posY if available
  const [customPositions, setCustomPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    const m: Record<string, { x: number; y: number }> = {};
    match.lineup.forEach(l => {
      if (l.posX != null && l.posY != null) {
        m[l.playerId] = { x: l.posX, y: l.posY };
      }
    });
    return m;
  });
  // Pitch edit mode (fullscreen modal overlay)
  const [pitchEditMode, setPitchEditMode] = useState(false);

  const convIds = new Set(match.convocations.map(cv => cv.playerId));
  const eligible = allPlayers.filter(p => convIds.has(p.id));
  const inLineupIds = new Set(lineup.map(l => l.playerId));
  const bench = eligible.filter(p => !inLineupIds.has(p.id));

  const saveMutation = useMutation({
    mutationFn: () => dbSetLineup(id, lineup.map(l => ({
      playerId: l.playerId, positionRole: l.positionRole || null,
      jerseyNumber: l.jerseyNumber ? parseInt(l.jerseyNumber) : null,
      isCaptain: l.isCaptain, isViceCaptain: l.isViceCaptain,
      isFreekickTaker: l.isFreekickTaker, isCornerTaker: l.isCornerTaker,
      isPenaltyTaker: l.isPenaltyTaker, isWallPlayer: l.isWallPlayer,
      posX: customPositions[l.playerId]?.x ?? null,
      posY: customPositions[l.playerId]?.y ?? null,
    }))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["match", id] }),
  });

  // Auto-save refs for lineup
  const lineupRef = useRef(lineup);
  const customPositionsRef = useRef(customPositions);
  lineupRef.current = lineup;
  customPositionsRef.current = customPositions;
  const [lineupAutoSaving, setLineupAutoSaving] = useState(false);
  const lineupAutoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleLineupAutoSave = () => {
    setLineupAutoSaving(true);
    if (lineupAutoSaveTimer.current) clearTimeout(lineupAutoSaveTimer.current);
    lineupAutoSaveTimer.current = setTimeout(() => {
      const lu = lineupRef.current;
      const cp = customPositionsRef.current;
      dbSetLineup(id, lu.map(l => ({
        playerId: l.playerId, positionRole: l.positionRole || null,
        jerseyNumber: l.jerseyNumber ? parseInt(l.jerseyNumber) : null,
        isCaptain: l.isCaptain, isViceCaptain: l.isViceCaptain,
        isFreekickTaker: l.isFreekickTaker, isCornerTaker: l.isCornerTaker,
        isPenaltyTaker: l.isPenaltyTaker, isWallPlayer: l.isWallPlayer,
        posX: cp[l.playerId]?.x ?? null,
        posY: cp[l.playerId]?.y ?? null,
      })))
        .then(() => { qc.invalidateQueries({ queryKey: ["match", id] }); setLineupAutoSaving(false); })
        .catch(() => { setLineupAutoSaving(false); });
    }, 800);
  };

  const getPlayer = (pid: string) => allPlayers.find(p => p.id === pid);
  const updateLP = (idx: number, patch: Partial<LP>) => { setLineup(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l)); scheduleLineupAutoSave(); };
  const setOnlyOne = (idx: number, field: "isCaptain"|"isViceCaptain", val: boolean) => { setLineup(prev => prev.map((l, i) => ({ ...l, [field]: val ? i === idx : (i === idx ? false : l[field]) }))); scheduleLineupAutoSave(); };
  const addFromBench = (p: Player) => {
    // Max 11 starters
    if (lineup.length >= 11) return;
    setLineup(prev => [...prev, { playerId: p.id, positionRole: p.role === "portiere" ? "POR" : p.role === "difensore" ? "DC" : p.role === "centrocampista" ? "CDC" : "PC", jerseyNumber: benchNums[p.id] ?? (p.number != null ? String(p.number) : ""), isCaptain: false, isViceCaptain: false, isFreekickTaker: false, isCornerTaker: false, isPenaltyTaker: false, isWallPlayer: false }]);
    setShowAdd(false);
    scheduleLineupAutoSave();
  };
  const removeFromLineup = (idx: number) => {
    const pid = lineup[idx]?.playerId;
    setLineup(prev => prev.filter((_, i) => i !== idx));
    if (pid) setCustomPositions(prev => { const n = { ...prev }; delete n[pid]; return n; });
    setEditIdx(null);
    scheduleLineupAutoSave();
  };
  const handleBenchTap = (p: Player) => { addFromBench(p); };

  const editLP = editIdx != null ? lineup[editIdx] : null;
  const SCREEN_W = Dimensions.get("window").width;
  const SCREEN_H = Dimensions.get("window").height;
  const W = SCREEN_W - 32;
  const H = W * 1.42;
  // Pitch modal dimensions — use most of the screen
  const PW = SCREEN_W - 32;
  const PH = Math.min(PW * 1.42, SCREEN_H * 0.72);
  const TOKEN_W = 48; const TOKEN_H = 52;

  // Build default positions from formation
  const positions = match.formation ? getFormationPositions(match.formation) : [];
  const sortedWithIdx = lineup.map((lp, origIdx) => ({ lp, origIdx })).sort((a, b) => {
    const ai = a.lp.positionRole === "POR" ? -1 : posRoleToLineIdx(a.lp.positionRole, match.formation ?? "4-3-3");
    const bi = b.lp.positionRole === "POR" ? -1 : posRoleToLineIdx(b.lp.positionRole, match.formation ?? "4-3-3");
    return ai - bi;
  });

  // Reset custom positions when formation changes
  const prevFormation = useRef(match.formation);
  useEffect(() => {
    if (match.formation !== prevFormation.current) {
      prevFormation.current = match.formation;
      setCustomPositions({});
    }
  }, [match.formation]);

  // Compute pixel top-left for a token given a center-pct position
  const pctToPixel = (xPct: number, yPct: number) => ({
    x: (xPct / 100) * W - TOKEN_W / 2,
    y: (yPct / 100) * H - TOKEN_H / 2,
  });
  // Same for the modal pitch (PW x PH)
  const pctToPixelP = (xPct: number, yPct: number) => ({
    x: (xPct / 100) * PW - TOKEN_W / 2,
    y: (yPct / 100) * PH - TOKEN_H / 2,
  });

  return (
    <View>
      <View style={s2.sectionHeader}>
        <Text style={s2.sectionTitle}>{lineup.length}/11 {t("titolari","starters")}</Text>
        <TouchableOpacity style={s2.saveSmall} onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending || lineupAutoSaving}>
          {(saveMutation.isPending || lineupAutoSaving) ? <ActivityIndicator size={14} color="#000" /> : <Text style={s2.saveSmallTxt}>{t("Salva","Save")}</Text>}
        </TouchableOpacity>
      </View>
      <Text style={s2.label}>{t("Modulo","Formation")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {FORMATIONS.map(f => {
          const isCur = match.formation === f;
          return (
            <TouchableOpacity key={f} style={[s2.formChip, isCur && s2.formChipActive]} onPress={() => dbUpdateMatch(id, { formation: f }).then(() => qc.invalidateQueries({ queryKey: ["match", id] }))}>
              <Text style={[s2.formChipTxt, isCur && { color: c.primary, fontWeight: "800" }]}>{f}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {/* Pitch edit mode modal */}
      <Modal visible={pitchEditMode} transparent animationType="fade" onRequestClose={() => setPitchEditMode(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.88)", alignItems: "center", justifyContent: "center" }}>
          {/* Header bar */}
          <View style={{ width: PW + 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingHorizontal: 4 }}>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700", opacity: 0.7 }}>{t("Trascina i giocatori · Tieni premuto per modificare","Drag players · Long-press to edit")}</Text>
            <TouchableOpacity
              onPress={() => setPitchEditMode(false)}
              style={{ backgroundColor: c.primary, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 }}
            >
              <Text style={{ color: "#000", fontWeight: "800", fontSize: 14 }}>{t("Fine","Done")}</Text>
            </TouchableOpacity>
          </View>
          {/* Pitch */}
          <View style={{ width: PW, height: PH, borderRadius: 16, overflow: "hidden" }}>
            <View style={{ position: "absolute", inset: 0, backgroundColor: "#1a472a" }} />
            <PitchLines W={PW} H={PH} />
            {sortedWithIdx.map(({ lp, origIdx }, slotIdx) => {
              const defaultPos = positions.length > 0 ? positions[Math.min(slotIdx, positions.length - 1)] : { x: 50, y: 50 };
              const finalPct = customPositions[lp.playerId] ?? defaultPos ?? { x: 50, y: 50 };
              const { x: px, y: py } = pctToPixelP(finalPct.x, finalPct.y);
              const player = getPlayer(lp.playerId);
              const color = player ? (ROLE_COLORS[player.role] ?? "#888") : "#888";
              const num = benchNums[lp.playerId] || lp.jerseyNumber || player?.number?.toString() || "?";
              const name = player?.name?.split(" ").pop() ?? "?";
              return (
                <DraggableToken
                  key={`pitch-modal-${lp.playerId}-${slotIdx}`}
                  playerId={lp.playerId}
                  num={num}
                  name={name}
                  color={color}
                  isCaptain={lp.isCaptain}
                  isViceCaptain={lp.isViceCaptain}
                  initX={px}
                  initY={py}
                  W={PW}
                  H={PH}
                  onDragStart={() => {}}
                  onDragEnd={(xPct, yPct) => {
                    setCustomPositions(prev => ({ ...prev, [lp.playerId]: { x: xPct, y: yPct } }));
                    scheduleLineupAutoSave();
                  }}
                  onTap={() => setEditIdx(origIdx)}
                  onLongPress={() => setEditIdx(origIdx)}
                />
              );
            })}
          </View>
        </View>
      </Modal>

      {lineup.length > 0 && (
        <View style={[s2.swapHint, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
          <Text style={s2.swapHintTxt}>{t("Formazione","Formation")}</Text>
          {match.formation && (
            <TouchableOpacity
              onPress={() => setPitchEditMode(true)}
              style={{ backgroundColor: c.primary, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 }}
            >
              <Text style={{ color: "#000", fontWeight: "800", fontSize: 12 }}>✎ {t("Modifica posizioni","Edit positions")}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {/* Static pitch preview (not draggable) */}
      {lineup.length > 0 && match.formation ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setPitchEditMode(true)}
          style={{ width: W, height: H, borderRadius: 16, overflow: "hidden", marginBottom: 16, alignSelf: "center" }}
        >
          <View style={{ position: "absolute", inset: 0, backgroundColor: "#1a472a" }} />
          <PitchLines W={W} H={H} />
          {sortedWithIdx.map(({ lp, origIdx }, slotIdx) => {
            const defaultPos = positions.length > 0 ? positions[Math.min(slotIdx, positions.length - 1)] : { x: 50, y: 50 };
            const finalPct = customPositions[lp.playerId] ?? defaultPos ?? { x: 50, y: 50 };
            const { x: px, y: py } = pctToPixel(finalPct.x, finalPct.y);
            const player = getPlayer(lp.playerId);
            const color = player ? (ROLE_COLORS[player.role] ?? "#888") : "#888";
            const num = benchNums[lp.playerId] || lp.jerseyNumber || player?.number?.toString() || "?";
            const name = player?.name?.split(" ").pop() ?? "?";
            return (
              <View
                key={`preview-${lp.playerId}-${slotIdx}`}
                style={{ position: "absolute", left: px, top: py, width: 48, height: 52, alignItems: "center" }}
                pointerEvents="none"
              >
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: color, borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 3 }}>
                  <Text style={{ fontSize: 10, fontWeight: "900", color: "#000" }}>{num}</Text>
                </View>
                {lp.isCaptain && <View style={{ position: "absolute", top: -10, right: 2 }}><Text style={{ fontSize: 10 }}>👑</Text></View>}
                {lp.isViceCaptain && <View style={{ position: "absolute", top: -10, left: 2 }}><Text style={{ fontSize: 10 }}>⭐</Text></View>}
                <View style={{ backgroundColor: "#00000088", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginTop: 3, maxWidth: 56 }}>
                  <Text style={{ fontSize: 8, fontWeight: "700", color: "#fff" }} numberOfLines={1}>{name}</Text>
                </View>
              </View>
            );
          })}
          {/* Tap-to-edit overlay hint */}
          <View style={{ position: "absolute", bottom: 8, right: 10, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>✎ {t("Modifica","Edit")}</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <Text style={s2.emptyTxt}>{t("Nessun titolare. Aggiungi giocatori dalla panchina sotto.","No starters. Add players from bench below.")}</Text>
      )}
      <View style={s2.benchHeader}>
        <Text style={s2.benchTitle}>🪑 {t("Panchina","Bench")} ({bench.length})</Text>
        {bench.length > 0 && <TouchableOpacity style={s2.saveSmall} onPress={() => setShowAdd(true)}><Text style={s2.saveSmallTxt}>+ {t("Titolare","Starter")}</Text></TouchableOpacity>}
      </View>
      {eligible.length === 0 && <Text style={s2.emptyTxt}>{t("Prima convoca i giocatori nella sezione Convocati","Convoke players first in Convocati")}</Text>}
      {bench.map(p => (
        <TouchableOpacity key={p.id} style={s2.benchCard} onPress={() => handleBenchTap(p)} activeOpacity={0.75}>
          <View style={[s2.benchDot, { backgroundColor: ROLE_COLORS[p.role] || c.primary }]} />
          <Text style={s2.benchName}>{p.name}</Text>
          <TextInput style={s2.benchNumInput} value={benchNums[p.id] ?? (p.number != null ? String(p.number) : "")} onChangeText={v => setBenchNums(prev => ({ ...prev, [p.id]: v }))} keyboardType="number-pad" placeholder="#" placeholderTextColor={c.textDim} maxLength={3} />
        </TouchableOpacity>
      ))}
      {bench.length === 0 && eligible.length > 0 && <Text style={s2.emptyTxt}>{t("Tutti i convocati sono in campo","All convocated players are on the pitch")}</Text>}

      {/* Edit player modal */}
      <Modal visible={editIdx !== null} transparent animationType="slide" onRequestClose={() => setEditIdx(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s2.overlay}>
          <View style={s2.miniModal}>
            {editLP && (() => {
              const player = getPlayer(editLP.playerId);
              return (
                <>
                  <View style={s2.miniModalHeader}>
                    <Text style={s2.modalTitle}>{player?.name ?? "—"}</Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <TouchableOpacity onPress={() => { removeFromLineup(editIdx!); setEditIdx(null); }}><Trash color={c.danger} size={20} weight="fill" /></TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditIdx(null)}><X color={c.textMuted} size={20} /></TouchableOpacity>
                    </View>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <Text style={s2.label}>{t("Numero maglia","Jersey #")}</Text>
                    <TextInput style={s2.input} value={editLP.jerseyNumber} onChangeText={v => updateLP(editIdx!, { jerseyNumber: v })} keyboardType="number-pad" placeholder="—" placeholderTextColor={c.textDim} />
                    <Text style={s2.label}>{t("Ruolo in campo","Position")}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {POSITION_ROLES.map(r => (
                          <TouchableOpacity key={r} style={[s2.chip, editLP.positionRole === r && s2.chipActive]} onPress={() => updateLP(editIdx!, { positionRole: r })}>
                            <Text style={[s2.chipTxt, editLP.positionRole === r && s2.chipTxtActive]}>{r}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                    <Text style={s2.label}>{t("Ruolo speciale","Special role")}</Text>
                    {([{ field: "isCaptain" as const, label: t("Capitano","Captain"), emoji: "👑" }, { field: "isViceCaptain" as const, label: t("Vice-capitano","Vice-captain"), emoji: "⭐" }]).map(({ field, label, emoji }) => (
                      <View key={field} style={s2.toggleRow}>
                        <Text style={s2.toggleLabel}>{emoji} {label}</Text>
                        <Switch value={editLP[field]} onValueChange={v => setOnlyOne(editIdx!, field, v)} trackColor={{ false: c.border, true: c.primary + "80" }} thumbColor={editLP[field] ? c.primary : c.textDim} />
                      </View>
                    ))}
                    <TouchableOpacity style={[s2.saveBtnFull, { marginTop: 16 }]} onPress={() => setEditIdx(null)}><Text style={s2.saveBtnTxt}>{t("Fatto","Done")}</Text></TouchableOpacity>
                    <View style={{ height: 20 }} />
                  </ScrollView>
                </>
              );
            })()}
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Add starter modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={s2.overlay}>
          <View style={s2.miniModal}>
            <View style={s2.miniModalHeader}>
              <Text style={s2.modalTitle}>{t("Aggiungi titolare","Add starter")} ({lineup.length}/11)</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}><X color={c.textMuted} size={20} /></TouchableOpacity>
            </View>
            <ScrollView>
              {lineup.length >= 11 ? (
                <Text style={{ color: c.textDim, textAlign: "center", padding: 24, fontSize: 14 }}>
                  {t("Hai già 11 titolari. Rimuovi un giocatore prima di aggiungerne un altro.", "Already 11 starters. Remove a player before adding another.")}
                </Text>
              ) : bench.map(p => (
                <TouchableOpacity key={p.id} style={s2.playerRow} onPress={() => addFromBench(p)}>
                  <View style={[s2.playerDot, { backgroundColor: ROLE_COLORS[p.role] || c.primary }]} />
                  <Text style={s2.playerName}>{p.name}</Text>
                  {p.number != null && <Text style={s2.playerNum}>#{p.number}</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── SPECIALISTI Section ──────────────────────────────────────────────────────
function SpecialistiSection({ match, allPlayers, id, qc, c }: { match: Match; allPlayers: Player[]; id: string; qc: any; c: ThemeColors }) {
  const s2 = useMemo(() => mkStyles2(c), [c]);
  const { t } = useI18n();
  type LP = { playerId: string; positionRole: string; jerseyNumber: string; isCaptain: boolean; isViceCaptain: boolean; isFreekickTaker: boolean; isCornerTaker: boolean; isPenaltyTaker: boolean; isWallPlayer: boolean };
  const toLP = (l: LineupPlayer): LP => ({ playerId: l.playerId, positionRole: l.positionRole || "", jerseyNumber: l.jerseyNumber != null ? String(l.jerseyNumber) : "", isCaptain: l.isCaptain, isViceCaptain: l.isViceCaptain, isFreekickTaker: l.isFreekickTaker, isCornerTaker: l.isCornerTaker, isPenaltyTaker: l.isPenaltyTaker, isWallPlayer: l.isWallPlayer });
  const [lineup, setLineup] = useState<LP[]>(match.lineup.map(toLP));
  const saveMutation = useMutation({
    mutationFn: () => dbSetLineup(id, lineup.map(l => ({
      playerId: l.playerId, positionRole: l.positionRole || null,
      jerseyNumber: l.jerseyNumber ? parseInt(l.jerseyNumber) : null,
      isCaptain: l.isCaptain, isViceCaptain: l.isViceCaptain,
      isFreekickTaker: l.isFreekickTaker, isCornerTaker: l.isCornerTaker,
      isPenaltyTaker: l.isPenaltyTaker, isWallPlayer: l.isWallPlayer,
    }))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["match", id] }),
  });
  const getPlayer = (pid: string) => allPlayers.find(p => p.id === pid);
  const setExclusive = (field: "isCaptain"|"isViceCaptain", playerId: string | null) => setLineup(prev => prev.map(l => ({ ...l, [field]: l.playerId === playerId })));
  const toggleMulti = (field: "isFreekickTaker"|"isCornerTaker"|"isPenaltyTaker", playerId: string) => setLineup(prev => prev.map(l => l.playerId === playerId ? { ...l, [field]: !l[field] } : l));
  const benchNums = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    match.convocations.forEach(cv => { if (cv.jerseyNumber != null) m[cv.playerId] = String(cv.jerseyNumber); });
    match.lineup.forEach(l => { if (l.jerseyNumber != null) m[l.playerId] = String(l.jerseyNumber); });
    allPlayers.forEach(p => { if (m[p.id] == null && p.number != null) m[p.id] = String(p.number); });
    return m;
  }, [match]);
  const [wallOrder, setWallOrder] = useState<string[]>(() => lineup.filter(l => l.isWallPlayer).map(l => l.playerId));
  const toggleWall = (playerId: string) => setWallOrder(prev => {
    if (prev.includes(playerId)) { setLineup(ll => ll.map(l => l.playerId === playerId ? { ...l, isWallPlayer: false } : l)); return prev.filter(id => id !== playerId); }
    setLineup(ll => ll.map(l => l.playerId === playerId ? { ...l, isWallPlayer: true } : l)); return [...prev, playerId];
  });
  const getExclusive = (field: "isCaptain"|"isViceCaptain") => lineup.find(l => l[field])?.playerId ?? null;
  const getMulti = (field: "isFreekickTaker"|"isCornerTaker"|"isPenaltyTaker") => lineup.filter(l => l[field]).map(l => l.playerId);
  const getWall = () => wallOrder.filter(id => lineup.some(l => l.playerId === id));
  if (lineup.length === 0) return <Text style={s2.emptyTxt}>{t("Prima schiera i titolari nella sezione Formazione","Set starters in Formation first")}</Text>;

  type SpecRole = { kind: "exclusive"|"multi"; field: any; it: string; en: string; emoji: string; color: string };
  const SPEC_ROLES: SpecRole[] = [
    { kind: "exclusive", field: "isCaptain", it: "Capitano", en: "Captain", emoji: "👑", color: c.primary },
    { kind: "exclusive", field: "isViceCaptain", it: "Vice-capitano", en: "Vice-captain", emoji: "⭐", color: c.accent },
    { kind: "multi", field: "isCornerTaker", it: "Tiratori Corner", en: "Corner takers", emoji: "🚩", color: "#3498db" },
    { kind: "multi", field: "isFreekickTaker", it: "Battitori Punizioni", en: "Free kick takers", emoji: "🎯", color: "#9b59b6" },
    { kind: "multi", field: "isPenaltyTaker", it: "Rigoristi", en: "Penalty takers", emoji: "⚽", color: c.danger },
  ];

  return (
    <View>
      <View style={s2.sectionHeader}>
        <Text style={s2.sectionTitle}>{t("Ruoli speciali","Special roles")}</Text>
        <TouchableOpacity style={s2.saveSmall} onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <ActivityIndicator size={14} color="#000" /> : <Text style={s2.saveSmallTxt}>{t("Salva","Save")}</Text>}
        </TouchableOpacity>
      </View>
      {SPEC_ROLES.map(role => {
        const { field, it, en, emoji, color } = role;
        const currentId = role.kind === "exclusive" ? getExclusive(field) : null;
        const selectedIds = role.kind === "multi" ? getMulti(field) : [];
        const currentPlayer = currentId ? getPlayer(currentId) : null;
        return (
          <View key={field} style={s2.specCard}>
            <View style={s2.specCardHeader}>
              <Text style={s2.specEmoji}>{emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s2.specTitle, { color }]}>{t(it, en)}</Text>
                {role.kind === "exclusive" && currentPlayer && <Text style={s2.specCurrent}>{currentPlayer.name}</Text>}
                {role.kind === "multi" && selectedIds.length > 0 && <Text style={s2.specCurrent}>{selectedIds.map(i => getPlayer(i)?.name.split(" ").pop()).join(", ")}</Text>}
              </View>
              {(role.kind === "exclusive" ? !!currentId : selectedIds.length > 0) && (
                <TouchableOpacity onPress={() => role.kind === "exclusive" ? setExclusive(field, null) : setLineup(prev => prev.map(l => ({ ...l, [field]: false })))} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
                  <X color={c.textDim} size={16} />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s2.specScroll}>
              {lineup.map(lp => {
                const p = getPlayer(lp.playerId);
                if (!p) return null;
                const isSelected = role.kind === "exclusive" ? currentId === lp.playerId : selectedIds.includes(lp.playerId);
                const orderNum = role.kind === "multi" && isSelected ? selectedIds.indexOf(lp.playerId) + 1 : null;
                return (
                  <TouchableOpacity key={lp.playerId} style={[s2.specChip, isSelected && { backgroundColor: color + "25", borderColor: color }]} onPress={() => role.kind === "exclusive" ? setExclusive(field, isSelected ? null : lp.playerId) : toggleMulti(field, lp.playerId)} activeOpacity={0.75}>
                    <View style={[s2.specChipNum, { backgroundColor: isSelected ? color : ROLE_COLORS[p.role] + "60" }]}>
                      <Text style={{ fontSize: 9, fontWeight: "900", color: isSelected ? "#000" : c.textMuted }}>
                        {orderNum ? `${orderNum}°` : (benchNums[lp.playerId] || lp.jerseyNumber || (p.number != null ? String(p.number) : "?"))}
                      </Text>
                    </View>
                    <Text style={[s2.specChipName, isSelected && { color }]} numberOfLines={1}>{p.name.split(" ").pop()}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        );
      })}
      {/* Barriera */}
      <View style={s2.specCard}>
        <View style={s2.specCardHeader}>
          <Text style={s2.specEmoji}>🧱</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s2.specTitle, { color: c.textMuted }]}>{t("Barriera","Wall players")}</Text>
            <Text style={s2.specCurrent}>{getWall().length} {t("selezionati (in ordine)","selected (in order)")}</Text>
          </View>
          {getWall().length > 0 && <TouchableOpacity onPress={() => { setWallOrder([]); setLineup(prev => prev.map(l => ({ ...l, isWallPlayer: false }))); }} hitSlop={{ top:8,bottom:8,left:8,right:8 }}><X color={c.textDim} size={16} /></TouchableOpacity>}
        </View>
        <View style={s2.specWallGrid}>
          {lineup.map(lp => {
            const p = getPlayer(lp.playerId);
            if (!p) return null;
            const wallList = getWall(); const posInWall = wallList.indexOf(lp.playerId); const inWall = posInWall !== -1;
            return (
              <TouchableOpacity key={lp.playerId} style={[s2.specWallChip, inWall && s2.specWallChipActive]} onPress={() => toggleWall(lp.playerId)} activeOpacity={0.75}>
                <View style={[s2.specChipNum, { backgroundColor: inWall ? c.textMuted : ROLE_COLORS[p.role] + "40" }]}>
                  <Text style={{ fontSize: 9, fontWeight: "900", color: inWall ? "#fff" : c.textDim }}>{inWall ? `${posInWall + 1}°` : (benchNums[lp.playerId] || lp.jerseyNumber || (p.number != null ? String(p.number) : "?"))}</Text>
                </View>
                <Text style={[s2.specChipName, inWall && { color: c.text }]} numberOfLines={1}>{p.name.split(" ").pop()}</Text>
                {inWall && <View style={{ backgroundColor: c.primary, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}><Text style={{ fontSize: 8, fontWeight: "900", color: "#000" }}>#{posInWall+1}</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── RISULTATO Section ────────────────────────────────────────────────────────
function RisultatoSection({ match, allPlayers, id, qc, c }: { match: Match; allPlayers: Player[]; id: string; qc: any; c: ThemeColors }) {
  const s2 = useMemo(() => mkStyles2(c), [c]);
  const { t } = useI18n();
  type CardForm = { playerId: string; type: "yellow" | "red" | "injury"; minute: string; notes: string };
  const toCF = (cd: NonNullable<Match["cards"]>[0]): CardForm => ({ playerId: cd.playerId, type: cd.type, minute: cd.minute != null ? String(cd.minute) : "", notes: cd.notes ?? "" });
  const [cards, setCards] = useState<CardForm[]>((match.cards ?? []).map(toCF));
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState<CardForm>({ playerId: "", type: "yellow", minute: "", notes: "" });
  type GoalForm = { playerId: string; minute: string; type: "goal" | "autogoal" | "rigore"; notes: string };
  const toGF = (g: Goal): GoalForm => ({ playerId: g.playerId || "", minute: g.minute != null ? String(g.minute) : "", type: g.type as any, notes: g.notes || "" });
  const [goalsFor, setGoalsFor] = useState<string>(match.goalsFor != null ? String(match.goalsFor) : "");
  const [goalsAgainst, setGoalsAgainst] = useState<string>(match.goalsAgainst != null ? String(match.goalsAgainst) : "");
  const [goals, setGoals] = useState<GoalForm[]>(match.goals.map(toGF));
  type SubForm = { playerOutId: string; playerInId: string; minute: string };
  const toSF = (s: Substitution): SubForm => ({ playerOutId: s.playerOutId, playerInId: s.playerInId, minute: s.minute != null ? String(s.minute) : "" });
  const [subs, setSubs] = useState<SubForm[]>((match.substitutions ?? []).map(toSF));
  const [showAddSub, setShowAddSub] = useState(false);
  const [newSub, setNewSub] = useState<SubForm>({ playerOutId: "", playerInId: "", minute: "" });

  // Sync from server only after a successful save (not while user is typing)
  const [lastSaved, setLastSaved] = useState<{ gf: number|null; ga: number|null } | null>(null);
  useEffect(() => {
    if (lastSaved !== null) {
      setGoalsFor(match.goalsFor != null ? String(match.goalsFor) : "");
      setGoalsAgainst(match.goalsAgainst != null ? String(match.goalsAgainst) : "");
      setGoals(match.goals.map(toGF));
      setSubs((match.substitutions ?? []).map(toSF));
      setCards((match.cards ?? []).map(toCF));
    }
  }, [match.goalsFor, match.goalsAgainst, match.goals.length, match.substitutions?.length, match.cards?.length]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoal, setNewGoal] = useState<GoalForm>({ playerId: "", minute: "", type: "goal", notes: "" });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const gf = goalsFor !== "" ? parseInt(goalsFor) : null;
      const ga = goalsAgainst !== "" ? parseInt(goalsAgainst) : null;
      const subsList = subs.map(s => ({ playerOutId: s.playerOutId, playerInId: s.playerInId, minute: s.minute ? parseInt(s.minute) : null }));
      const cardsList = cards.map(cd => ({ playerId: cd.playerId, type: cd.type, minute: cd.minute ? parseInt(cd.minute) : null, notes: cd.notes || null }));
      // Atomic: replace all goals + update score in one call
      await dbReplaceGoals(
        id,
        goals.map(g => ({
          playerId: g.playerId || null,
          minute: g.minute ? parseInt(g.minute) : null,
          type: g.type,
          notes: g.notes || null,
        })),
        gf,
        ga
      );
      // Update subs + cards
      await dbUpdateMatch(id, {
        substitutions: JSON.stringify(subsList),
        cards: JSON.stringify(cardsList),
      });
    },
    onSuccess: () => {
      setLastSaved({ gf: goalsFor !== "" ? parseInt(goalsFor) : null, ga: goalsAgainst !== "" ? parseInt(goalsAgainst) : null });
      qc.invalidateQueries({ queryKey: ["match", id] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });

  const lineupPlayerIds = new Set(match.lineup.map(l => l.playerId));
  const convPlayerIds = new Set(match.convocations.map(cv => cv.playerId));
  const allConvocated = allPlayers.filter(p => lineupPlayerIds.has(p.id) || convPlayerIds.has(p.id));
  const scorerOptions = allConvocated;

  // Dynamically compute who is currently on the field / on the bench
  // based on lineup + substitutions already recorded
  const computeFieldState = () => {
    // Start: starters are on field, rest of convocated are on bench
    const onField = new Set<string>(lineupPlayerIds);
    const onBench = new Set<string>(
      allConvocated.filter(p => !lineupPlayerIds.has(p.id)).map(p => p.id)
    );
    // Apply each substitution in order
    for (const s of subs) {
      if (s.playerOutId && s.playerInId) {
        if (onField.has(s.playerOutId)) { onField.delete(s.playerOutId); onBench.add(s.playerOutId); }
        if (onBench.has(s.playerInId)) { onBench.delete(s.playerInId); onField.add(s.playerInId); }
      }
    }
    return { onField, onBench };
  };
  const { onField, onBench } = computeFieldState();
  const playersOnField = allConvocated.filter(p => onField.has(p.id));
  const playersOnBench = allConvocated.filter(p => onBench.has(p.id));
  const addCard = () => { if (!newCard.playerId) return; setCards(prev => [...prev, { ...newCard }]); setNewCard({ playerId: "", type: "yellow", minute: "", notes: "" }); setShowAddCard(false); };
  const addGoal = () => { setGoals(prev => [...prev, { ...newGoal }]); setNewGoal({ playerId: "", minute: "", type: "goal", notes: "" }); setShowAddGoal(false); };
  const addSub = () => {
    if (!newSub.playerOutId || !newSub.playerInId) return;
    setSubs(prev => [...prev, { ...newSub }]);
    setNewSub({ playerOutId: "", playerInId: "", minute: "" });
    setShowAddSub(false);
  };
  const GOAL_TYPE_LABELS: Record<string,{it:string;en:string}> = { goal:{it:"Gol",en:"Goal"}, autogoal:{it:"Autogol",en:"Own goal"}, rigore:{it:"Rigore",en:"Penalty"} };
  const GOAL_TYPE_COLORS: Record<string,string> = { goal: c.primary, autogoal: c.danger, rigore: c.accent };

  return (
    <View>
      <View style={s2.scoreRow}>
        <View style={s2.scoreBox}><Text style={s2.scoreLabel}>{t("Gol fatti","Goals for")}</Text><TextInput style={s2.scoreInput} value={goalsFor} onChangeText={setGoalsFor} keyboardType="number-pad" placeholder="0" placeholderTextColor={c.textDim} /></View>
        <Text style={s2.scoreDash}>–</Text>
        <View style={s2.scoreBox}><Text style={s2.scoreLabel}>{t("Gol subiti","Goals against")}</Text><TextInput style={s2.scoreInput} value={goalsAgainst} onChangeText={setGoalsAgainst} keyboardType="number-pad" placeholder="0" placeholderTextColor={c.textDim} /></View>
      </View>
      {/* Marcatori */}
      <View style={s2.sectionHeader}>
        <Text style={s2.sectionTitle}>{t("Marcatori","Scorers")}</Text>
        <TouchableOpacity style={s2.saveSmall} onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <ActivityIndicator size={14} color="#000" /> : <Text style={s2.saveSmallTxt}>{t("Salva","Save")}</Text>}
        </TouchableOpacity>
      </View>
      {goals.length === 0 && <Text style={s2.emptyTxt}>{t("Nessun marcatore","No scorers yet")}</Text>}
      {goals.map((g, idx) => {
        const scorer = allPlayers.find(p => p.id === g.playerId);
        return (
          <View key={idx} style={s2.goalCard}>
            <View style={[s2.goalDot, { backgroundColor: GOAL_TYPE_COLORS[g.type] }]} />
            <View style={s2.goalInfo}>
              <Text style={s2.goalPlayer}>{scorer ? scorer.name : t("Autore sconosciuto","Unknown scorer")}{g.minute ? <Text style={s2.goalMin}> {g.minute}'</Text> : null}</Text>
              <Text style={[s2.goalType, { color: GOAL_TYPE_COLORS[g.type] }]}>{t(GOAL_TYPE_LABELS[g.type].it, GOAL_TYPE_LABELS[g.type].en)}</Text>
              {g.notes ? <Text style={s2.goalNotes}>{g.notes}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => setGoals(prev => prev.filter((_, i) => i !== idx))} hitSlop={{ top:8,bottom:8,left:8,right:8 }}><X color={c.danger} size={16} /></TouchableOpacity>
          </View>
        );
      })}
      <TouchableOpacity style={s2.addPlayerBtn} onPress={() => setShowAddGoal(true)}>
        <Plus color={c.primary} size={18} weight="bold" /><Text style={s2.addPlayerTxt}>{t("Aggiungi marcatore","Add scorer")}</Text>
      </TouchableOpacity>

      {/* Sostituzioni */}
      <View style={[s2.sectionHeader, { marginTop: 16 }]}>
        <Text style={s2.sectionTitle}>{t("Sostituzioni","Substitutions")}</Text>
      </View>
      {subs.length === 0 && <Text style={s2.emptyTxt}>{t("Nessuna sostituzione","No substitutions yet")}</Text>}
      {subs.map((s, idx) => {
        const pOut = allPlayers.find(p => p.id === s.playerOutId);
        const pIn = allPlayers.find(p => p.id === s.playerInId);
        return (
          <View key={idx} style={s2.goalCard}>
            <Text style={{ fontSize: 18 }}>🔄</Text>
            <View style={s2.goalInfo}>
              <Text style={s2.goalPlayer}>
                <Text style={{ color: c.danger }}>↓ {pOut?.name?.split(" ").pop() ?? "?"}</Text>
                {"  "}
                <Text style={{ color: c.primary }}>↑ {pIn?.name?.split(" ").pop() ?? "?"}</Text>
                {s.minute ? <Text style={s2.goalMin}>  {s.minute}'</Text> : null}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSubs(prev => prev.filter((_, i) => i !== idx))} hitSlop={{ top:8,bottom:8,left:8,right:8 }}><X color={c.danger} size={16} /></TouchableOpacity>
          </View>
        );
      })}
      <TouchableOpacity style={s2.addPlayerBtn} onPress={() => setShowAddSub(true)}>
        <Plus color={c.primary} size={18} weight="bold" /><Text style={s2.addPlayerTxt}>{t("Aggiungi sostituzione","Add substitution")}</Text>
      </TouchableOpacity>

      {/* Cartellini / Infortuni */}
      <View style={[s2.sectionHeader, { marginTop: 16 }]}>
        <Text style={s2.sectionTitle}>{t("Cartellini / Infortuni","Cards / Injuries")}</Text>
      </View>
      {cards.length === 0 && <Text style={s2.emptyTxt}>{t("Nessun cartellino o infortunio","No cards or injuries")}</Text>}
      {cards.map((cd, idx) => {
        const player = allPlayers.find(p => p.id === cd.playerId);
        const CARD_COLORS: Record<string,string> = { yellow: "#f1c40f", red: c.danger, injury: c.accent };
        const CARD_ICONS: Record<string,string> = { yellow: "🟨", red: "🟥", injury: "🩹" };
        const CARD_LABELS: Record<string,{it:string;en:string}> = { yellow:{it:"Giallo",en:"Yellow"}, red:{it:"Rosso",en:"Red"}, injury:{it:"Infortunio",en:"Injury"} };
        return (
          <View key={idx} style={s2.goalCard}>
            <Text style={{ fontSize: 18 }}>{CARD_ICONS[cd.type]}</Text>
            <View style={s2.goalInfo}>
              <Text style={s2.goalPlayer}>
                {player?.name ?? t("Giocatore sconosciuto","Unknown player")}
                {cd.minute ? <Text style={s2.goalMin}> {cd.minute}'</Text> : null}
              </Text>
              <Text style={[s2.goalType, { color: CARD_COLORS[cd.type] }]}>{t(CARD_LABELS[cd.type].it, CARD_LABELS[cd.type].en)}</Text>
              {cd.notes ? <Text style={s2.goalNotes}>{cd.notes}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => setCards(prev => prev.filter((_, i) => i !== idx))} hitSlop={{ top:8,bottom:8,left:8,right:8 }}><X color={c.danger} size={16} /></TouchableOpacity>
          </View>
        );
      })}
      <TouchableOpacity style={s2.addPlayerBtn} onPress={() => setShowAddCard(true)}>
        <Plus color={c.primary} size={18} weight="bold" /><Text style={s2.addPlayerTxt}>{t("Aggiungi cartellino/infortunio","Add card/injury")}</Text>
      </TouchableOpacity>

      {/* Modal aggiunta gol */}
      <Modal visible={showAddGoal} transparent animationType="slide" onRequestClose={() => setShowAddGoal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s2.overlay}>
          <View style={s2.miniModal}>
            <View style={s2.miniModalHeader}>
              <Text style={s2.modalTitle}>{t("Nuovo gol","New goal")}</Text>
              <TouchableOpacity onPress={() => setShowAddGoal(false)}><X color={c.textMuted} size={20} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s2.label}>{t("Tipo","Type")}</Text>
              <View style={s2.segRow}>
                {(["goal","rigore","autogoal"] as const).map(type => (
                  <TouchableOpacity key={type} style={[s2.seg, newGoal.type === type && s2.segActive]} onPress={() => setNewGoal(g => ({ ...g, type }))}>
                    <Text style={[s2.segTxt, newGoal.type === type && s2.segTxtActive]}>{t(GOAL_TYPE_LABELS[type].it, GOAL_TYPE_LABELS[type].en)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s2.label}>{t("Marcatore","Scorer")}</Text>
              <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                <TouchableOpacity style={[s2.playerRow, !newGoal.playerId && s2.playerRowActive]} onPress={() => setNewGoal(g => ({ ...g, playerId: "" }))}><Text style={s2.playerName}>{t("— Sconosciuto —","— Unknown —")}</Text></TouchableOpacity>
                {scorerOptions.map(p => (
                  <TouchableOpacity key={p.id} style={[s2.playerRow, newGoal.playerId === p.id && s2.playerRowActive]} onPress={() => setNewGoal(g => ({ ...g, playerId: p.id }))}>
                    <View style={[s2.playerDot, { backgroundColor: ROLE_COLORS[p.role] || c.primary }]} />
                    <Text style={s2.playerName}>{p.name}</Text>
                    {p.number != null && <Text style={s2.playerNum}>#{p.number}</Text>}
                    {newGoal.playerId === p.id && <Check color={c.primary} size={16} weight="bold" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={s2.label}>{t("Minuto","Minute")}</Text>
              <TextInput style={s2.input} value={newGoal.minute} onChangeText={v => setNewGoal(g => ({ ...g, minute: v }))} keyboardType="number-pad" placeholder="es. 45" placeholderTextColor={c.textDim} />
              <Text style={s2.label}>{t("Note","Notes")}</Text>
              <TextInput style={s2.input} value={newGoal.notes} onChangeText={v => setNewGoal(g => ({ ...g, notes: v }))} placeholder={t("es. punizione da 25m","e.g. free kick from 25m")} placeholderTextColor={c.textDim} />
              <TouchableOpacity style={s2.saveBtnFull} onPress={addGoal}><Text style={s2.saveBtnTxt}>{t("Aggiungi","Add")}</Text></TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal aggiunta sostituzione */}
      <Modal visible={showAddSub} transparent animationType="slide" onRequestClose={() => setShowAddSub(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s2.overlay}>
          <View style={s2.miniModal}>
            <View style={s2.miniModalHeader}>
              <Text style={s2.modalTitle}>🔄 {t("Sostituzione","Substitution")}</Text>
              <TouchableOpacity onPress={() => setShowAddSub(false)}><X color={c.textMuted} size={20} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s2.label}>↓ {t("Esce","Out")} ({t("in campo","on field")})</Text>
              <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                {playersOnField.length === 0 && <Text style={s2.emptyTxt}>{t("Nessun giocatore in campo","No players on field")}</Text>}
                {playersOnField.map(p => (
                  <TouchableOpacity key={p.id} style={[s2.playerRow, newSub.playerOutId === p.id && s2.playerRowActive]} onPress={() => setNewSub(s => ({ ...s, playerOutId: p.id }))}>
                    <View style={[s2.playerDot, { backgroundColor: ROLE_COLORS[p.role] || c.primary }]} />
                    <Text style={s2.playerName}>{p.name}</Text>
                    {p.number != null && <Text style={s2.playerNum}>#{p.number}</Text>}
                    {newSub.playerOutId === p.id && <Check color={c.danger} size={16} weight="bold" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={[s2.label, { marginTop: 12 }]}>↑ {t("Entra","In")} ({t("in panchina","on bench")})</Text>
              <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                {playersOnBench.length === 0 && <Text style={s2.emptyTxt}>{t("Nessun giocatore in panchina","No players on bench")}</Text>}
                {playersOnBench.map(p => (
                  <TouchableOpacity key={p.id} style={[s2.playerRow, newSub.playerInId === p.id && s2.playerRowActive]} onPress={() => setNewSub(s => ({ ...s, playerInId: p.id }))}>
                    <View style={[s2.playerDot, { backgroundColor: ROLE_COLORS[p.role] || c.primary }]} />
                    <Text style={s2.playerName}>{p.name}</Text>
                    {p.number != null && <Text style={s2.playerNum}>#{p.number}</Text>}
                    {newSub.playerInId === p.id && <Check color={c.primary} size={16} weight="bold" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={[s2.label, { marginTop: 12 }]}>{t("Minuto","Minute")}</Text>
              <TextInput style={s2.input} value={newSub.minute} onChangeText={v => setNewSub(s => ({ ...s, minute: v }))} keyboardType="number-pad" placeholder="es. 65" placeholderTextColor={c.textDim} />
              <TouchableOpacity style={[s2.saveBtnFull, { opacity: (!newSub.playerOutId || !newSub.playerInId) ? 0.4 : 1 }]} onPress={addSub} disabled={!newSub.playerOutId || !newSub.playerInId}>
                <Text style={s2.saveBtnTxt}>{t("Aggiungi","Add")}</Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal aggiunta cartellino/infortunio */}
      <Modal visible={showAddCard} transparent animationType="slide" onRequestClose={() => setShowAddCard(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s2.overlay}>
          <View style={s2.miniModal}>
            <View style={s2.miniModalHeader}>
              <Text style={s2.modalTitle}>🟨 {t("Cartellino / Infortunio","Card / Injury")}</Text>
              <TouchableOpacity onPress={() => setShowAddCard(false)}><X color={c.textMuted} size={20} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s2.label}>{t("Tipo","Type")}</Text>
              <View style={s2.segRow}>
                {(["yellow","red","injury"] as const).map(type => {
                  const lbls: Record<string,{it:string;en:string}> = { yellow:{it:"Giallo",en:"Yellow"}, red:{it:"Rosso",en:"Red"}, injury:{it:"Infortunio",en:"Injury"} };
                  return (
                    <TouchableOpacity key={type} style={[s2.seg, newCard.type === type && s2.segActive]} onPress={() => setNewCard(c => ({ ...c, type }))}>
                      <Text style={[s2.segTxt, newCard.type === type && s2.segTxtActive]}>{t(lbls[type].it, lbls[type].en)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={s2.label}>{t("Giocatore","Player")}</Text>
              <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                {allConvocated.map(p => (
                  <TouchableOpacity key={p.id} style={[s2.playerRow, newCard.playerId === p.id && s2.playerRowActive]} onPress={() => setNewCard(c => ({ ...c, playerId: p.id }))}>
                    <View style={[s2.playerDot, { backgroundColor: ROLE_COLORS[p.role] || c.primary }]} />
                    <Text style={s2.playerName}>{p.name}</Text>
                    {p.number != null && <Text style={s2.playerNum}>#{p.number}</Text>}
                    {newCard.playerId === p.id && <Check color={c.primary} size={16} weight="bold" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={s2.label}>{t("Minuto","Minute")}</Text>
              <TextInput style={s2.input} value={newCard.minute} onChangeText={v => setNewCard(c => ({ ...c, minute: v }))} keyboardType="number-pad" placeholder="es. 34" placeholderTextColor={c.textDim} />
              <Text style={s2.label}>{t("Note","Notes")}</Text>
              <TextInput style={s2.input} value={newCard.notes} onChangeText={v => setNewCard(c => ({ ...c, notes: v }))} placeholder={t("es. fallo su attacco","e.g. foul on attacker")} placeholderTextColor={c.textDim} />
              <TouchableOpacity style={[s2.saveBtnFull, { opacity: !newCard.playerId ? 0.4 : 1, marginTop: 12 }]} onPress={addCard} disabled={!newCard.playerId}>
                <Text style={s2.saveBtnTxt}>{t("Aggiungi","Add")}</Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── RIEPILOGO Section ────────────────────────────────────────────────────────
function RiepilogoSection({ match, allPlayers, id: _id, qc: _qc, c }: { match: Match; allPlayers: Player[]; id: string; qc: any; c: ThemeColors }) {
  const s2 = useMemo(() => mkStyles2(c), [c]);
  const { lang } = useI18n();
  const W = Dimensions.get("window").width - 32;
  const PITCH_W = W * 0.72;
  const PITCH_H = PITCH_W * 1.08;

  const convIds = new Set(match.convocations.map(cv => cv.playerId));
  const convJerseyMap: Record<string, number | null> = {};
  match.convocations.forEach(cv => { convJerseyMap[cv.playerId] = cv.jerseyNumber ?? null; });
  const inLineupIds = new Set(match.lineup.map(l => l.playerId));
  const bench = allPlayers.filter(p => convIds.has(p.id) && !inLineupIds.has(p.id));
  const starters = match.lineup.map(l => ({ ...l, player: allPlayers.find(p => p.id === l.playerId) }));

  const captain = starters.find(l => l.isCaptain);
  const viceCaptain = starters.find(l => l.isViceCaptain);
  const cornerTakers = starters.filter(l => l.isCornerTaker);
  const freekickTakers = starters.filter(l => l.isFreekickTaker);
  const penaltyTakers = starters.filter(l => l.isPenaltyTaker);
  const wallPlayers = starters.filter(l => l.isWallPlayer);

  const formation = match.formation ?? "4-3-3";
  const positions = getFormationPositions(formation);
  const sortedStarters = [...starters].sort((a, b) => {
    const ai = a.positionRole === "POR" ? -1 : posRoleToLineIdx(a.positionRole, formation);
    const bi = b.positionRole === "POR" ? -1 : posRoleToLineIdx(b.positionRole, formation);
    return ai - bi;
  });

  const specName = (pl: typeof starters) =>
    pl.length === 0 ? "—" : pl.map(l => l.player?.name?.split(" ").pop() ?? "?").join(", ");

  const homeAwayLabel = match.homeAway === "home"
    ? (lang === "it" ? "CASA" : "HOME")
    : (lang === "it" ? "TRASFERTA" : "AWAY");

  // Pitch: leggermente più stretto per lasciare spazio agli altri elementi
  const PITCH_W2 = Math.floor(W * 0.88);
  const PITCH_H2 = Math.floor(PITCH_W2 * 0.72);

  return (
    <View style={s2.sheet}>

      {/* ── COMPACT HEADER ── */}
      <View style={s2.compactHeader}>
        {match.competition ? (
          <View style={s2.competitionBadge}>
            <Text style={s2.competitionBadgeTxt}>{match.competition.toUpperCase()}</Text>
          </View>
        ) : null}
        <Text style={s2.sheetVs} numberOfLines={1}>
          vs <Text style={s2.sheetOpponent}>{match.opponent}</Text>
        </Text>
        <Text style={s2.compactMeta}>{formatDate(match.date)}{match.time ? `  ${match.time}` : ""}</Text>
        {match.venue ? <Text style={s2.compactMeta} numberOfLines={1}>📍 {match.venue}</Text> : null}
        <View style={[s2.homeAwayBadge, match.homeAway === "home" ? s2.homeAwayHome : s2.homeAwayAway]}>
          <Text style={[s2.homeAwayTxt, match.homeAway === "home" ? s2.homeAwayHomeTxt : s2.homeAwayAwayTxt]}>{homeAwayLabel}</Text>
        </View>
        <View style={s2.formationBadge}>
          <Text style={s2.formationBadgeTxt}>{formation}</Text>
        </View>
      </View>

      {/* ── PITCH ── */}
      <View style={{ alignSelf: "center", width: PITCH_W2, height: PITCH_H2, borderRadius: 10, overflow: "hidden" }}>
        <PitchLines W={PITCH_W2} H={PITCH_H2} />
        {sortedStarters.map(({ player, jerseyNumber, isCaptain, isViceCaptain, posX, posY }, slotIdx) => {
          const defaultPos = positions.length > 0 ? positions[Math.min(slotIdx, positions.length - 1)] : { x: 50, y: 50 };
          const finalPos = (posX != null && posY != null) ? { x: posX, y: posY } : (defaultPos ?? { x: 50, y: 50 });
          const px = (finalPos.x / 100) * PITCH_W2;
          const py = (finalPos.y / 100) * PITCH_H2;
          const color = player ? (ROLE_COLORS[player.role] ?? "#888") : "#888";
          const num = convJerseyMap[player?.id ?? ""] != null ? String(convJerseyMap[player?.id ?? ""]) : jerseyNumber != null ? String(jerseyNumber) : (player?.number?.toString() ?? "?");
          const surname = player?.name?.split(" ").pop() ?? "?";
          return (
            <View key={slotIdx} style={{ position: "absolute", left: px - 14, top: py - 15, width: 28, alignItems: "center" }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: color, borderWidth: 1.5, borderColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 3 }}>
                <Text style={{ fontSize: 8, fontWeight: "900", color: "#fff" }}>{num}</Text>
              </View>
              {isCaptain && <View style={{ position: "absolute", top: -6, right: -2 }}><Text style={{ fontSize: 7 }}>©</Text></View>}
              {isViceCaptain && !isCaptain && <View style={{ position: "absolute", top: -6, right: -2 }}><Text style={{ fontSize: 6 }}>vc</Text></View>}
              <View style={{ backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 3, paddingHorizontal: 2, paddingVertical: 1, marginTop: 1, maxWidth: 36 }}>
                <Text style={{ fontSize: 6, fontWeight: "700", color: "#fff", textAlign: "center" }} numberOfLines={1}>{surname}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* ── PANCHINA ── */}
      {bench.length > 0 && (
        <View style={s2.benchRowWrap}>
          <Text style={s2.benchRowLabel}>{lang === "it" ? "PANCHINA" : "BENCH"}</Text>
          <View style={s2.benchChipRow}>
            {bench.map(p => (
              <View key={p.id} style={[s2.benchChip, { borderLeftColor: ROLE_COLORS[p.role] ?? "#888", borderLeftWidth: 3 }]}>
                <Text style={[s2.benchChipNum, { color: ROLE_COLORS[p.role] ?? "#888" }]}>{convJerseyMap[p.id] ?? p.number ?? "?"}</Text>
                <Text style={s2.benchChipName} numberOfLines={1}>{p.name ?? "?"}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── SPECIALISTI: griglia 2×2 + barriera full-width ── */}
      <View style={s2.specHorizTable}>
        {/* riga 1: Capitano | V.Capitano */}
        {[
          { icon: "👑", label: lang === "it" ? "Capitano" : "Captain",   val: specName(captain ? [captain] : []) },
          { icon: "⭐", label: lang === "it" ? "V.Cap" : "V.Cap",        val: specName(viceCaptain ? [viceCaptain] : []) },
        ].map(({ icon, label, val }, i) => (
          <View key={i} style={[
            s2.specHorizCellHalf,
            i === 0 ? s2.specHorizCellEven : {},
            i === 0 ? { borderRightWidth: 1, borderRightColor: "#00000020" } : {},
            { borderBottomWidth: 1, borderBottomColor: "#00000020" },
          ]}>
            <Text style={s2.specHorizIcon}>{icon} <Text style={s2.specHorizLabel}>{label}</Text></Text>
            <Text style={s2.specHorizVal} numberOfLines={2}>{val}</Text>
          </View>
        ))}
        {/* riga 2: Angoli | Punizioni */}
        {[
          { icon: "🚩", label: lang === "it" ? "Angoli" : "Corners",     val: specName(cornerTakers) },
          { icon: "🎯", label: lang === "it" ? "Punizioni" : "Freekick", val: specName(freekickTakers) },
        ].map(({ icon, label, val }, i) => (
          <View key={i + 2} style={[
            s2.specHorizCellHalf,
            i === 0 ? s2.specHorizCellEven : {},
            i === 0 ? { borderRightWidth: 1, borderRightColor: "#00000020" } : {},
            { borderBottomWidth: 1, borderBottomColor: "#00000020" },
          ]}>
            <Text style={s2.specHorizIcon}>{icon} <Text style={s2.specHorizLabel}>{label}</Text></Text>
            <Text style={s2.specHorizVal} numberOfLines={2}>{val}</Text>
          </View>
        ))}
        {/* riga 3: Rigori | (metà) */}
        <View style={[
          s2.specHorizCellHalf,
          s2.specHorizCellEven,
          { borderRightWidth: 1, borderRightColor: "#00000020", borderBottomWidth: 1, borderBottomColor: "#00000020" },
        ]}>
          <Text style={s2.specHorizIcon}>⚽ <Text style={s2.specHorizLabel}>{lang === "it" ? "Rigori" : "Penalties"}</Text></Text>
          <Text style={s2.specHorizVal} numberOfLines={2}>{specName(penaltyTakers)}</Text>
        </View>
        <View style={[s2.specHorizCellHalf, { borderBottomWidth: 1, borderBottomColor: "#00000020" }]} />
        {/* riga 4: Barriera full-width */}
        <View style={[s2.specHorizCellFull, s2.specHorizCellEven]}>
          <Text style={s2.specHorizIcon}>🧱 <Text style={s2.specHorizLabel}>{lang === "it" ? "Barriera" : "Wall"}</Text></Text>
          <Text style={[s2.specHorizVal, { fontSize: 12, flexWrap: "wrap" }]} numberOfLines={4}>
            {wallPlayers.length === 0 ? "—" : wallPlayers.map(l => l.player?.name?.split(" ").pop() ?? "?").join(", ")}
          </Text>
        </View>
      </View>

      {/* ── NOTE ── */}
      {match.notes ? (
        <View style={s2.notesSection}>
          <Text style={s2.notesLabel}>{lang === "it" ? "NOTE" : "NOTES"}</Text>
          <Text style={s2.notesText}>{match.notes}</Text>
        </View>
      ) : null}

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function mkStyles(c: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    topBar: { flexDirection: "row", alignItems: "center", padding: 20, paddingBottom: 10, gap: 12 },
    back: { padding: 4 },
    topTitle: { flex: 1 },
    topOpponent: { fontSize: 16, fontWeight: "800", color: c.text },
    topDate: { fontSize: 12, color: c.textDim, marginTop: 2 },
    confirmRow: { flexDirection: "row", gap: 8 },
    iconBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    cancelBtn: { backgroundColor: c.border },
    delBtn: { backgroundColor: c.danger },
    confirmBanner: { marginHorizontal: 20, marginBottom: 6, backgroundColor: c.danger + "15", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: c.danger + "40" },
    confirmBannerTxt: { fontSize: 13, fontWeight: "700", color: c.danger, textAlign: "center" },
    scorePill: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 8, marginBottom: 4, marginTop: 2 },
    scoreNum: { fontSize: 26, fontWeight: "900" },
    resultBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    resultTxt: { fontSize: 14, fontWeight: "800" },
    tabs: { flexDirection: "row", marginHorizontal: 16, marginBottom: 8, gap: 6 },
    tab: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: "center" },
    tabActive: { borderColor: c.primary, backgroundColor: c.primary + "18" },
    tabTxt: { fontSize: 12, fontWeight: "700", color: c.textDim },
    tabTxtActive: { color: c.primary },
    content: { paddingHorizontal: 16, paddingBottom: 80, paddingTop: 8 },
    errorTxt: { color: c.danger, textAlign: "center", marginTop: 40 },
  });
}

function mkStyles2(c: ThemeColors) {
  return StyleSheet.create({
    infoCard: { backgroundColor: c.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border },
    infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border + "60" },
    infoLabel: { fontSize: 12, fontWeight: "700", color: c.textDim, width: 110 },
    infoVal: { flex: 1, fontSize: 14, color: c.text, marginLeft: 8 },
    editBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16, alignSelf: "flex-end" },
    editBtnTxt: { fontSize: 14, color: c.primary, fontWeight: "700" },
    label: { fontSize: 11, fontWeight: "700", color: c.textDim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6, marginTop: 14 },
    input: { backgroundColor: c.bg, borderRadius: 10, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, paddingVertical: 10, color: c.text, fontSize: 16 },
    segRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
    seg: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: "center" },
    segActive: { borderColor: c.primary, backgroundColor: c.primary + "18" },
    segTxt: { fontSize: 12, color: c.textDim, fontWeight: "600" },
    segTxtActive: { color: c.primary },
    formChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: c.border },
    chipActive: { borderColor: c.primary, backgroundColor: c.primary + "18" },
    chipTxt: { fontSize: 12, color: c.textDim, fontWeight: "600" },
    chipTxtActive: { color: c.primary },
    btnRow: { flexDirection: "row", gap: 10, marginTop: 20 },
    cancelBtnFull: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: c.border },
    cancelBtnTxt: { fontSize: 14, fontWeight: "700", color: c.textMuted },
    saveBtnFull: { flex: 1, backgroundColor: c.primary, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
    saveBtnTxt: { fontSize: 14, fontWeight: "800", color: "#000" },
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: c.textMuted },
    saveSmall: { backgroundColor: c.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
    saveSmallTxt: { fontSize: 12, fontWeight: "800", color: "#000" },
    emptyTxt: { fontSize: 13, color: c.textDim, textAlign: "center", paddingVertical: 24, fontStyle: "italic" },
    roleHeader: { fontSize: 11, fontWeight: "800", color: c.textDim, textTransform: "uppercase", letterSpacing: 1, marginTop: 14, marginBottom: 6 },
    playerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: c.border, marginBottom: 6, backgroundColor: c.bgCard },
    playerRowActive: { borderColor: c.primary + "60", backgroundColor: c.primary + "10" },
    playerDot: { width: 10, height: 10, borderRadius: 5 },
    playerName: { flex: 1, fontSize: 14, fontWeight: "600", color: c.textMuted },
    playerNum: { fontSize: 12, color: c.textDim, fontWeight: "700" },
    checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    checkboxChecked: { backgroundColor: c.primary, borderColor: c.primary },
    formChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: c.border, marginRight: 6 },
    formChipActive: { borderColor: c.primary, backgroundColor: c.primary + "15" },
    formChipTxt: { fontSize: 13, color: c.textDim, fontWeight: "600" },
    toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border + "40" },
    toggleLabel: { fontSize: 14, color: c.text, fontWeight: "600" },
    swapHint: { backgroundColor: c.primary + "15", borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: c.primary + "30" },
    swapHintTxt: { fontSize: 12, color: c.primary, fontWeight: "600", textAlign: "center" },
    benchHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 8 },
    benchTitle: { fontSize: 13, fontWeight: "700", color: c.textMuted },
    benchCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.bgCard, borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: c.border },
    benchCardHighlight: { borderColor: c.primary + "60", backgroundColor: c.primary + "08" },
    benchDot: { width: 10, height: 10, borderRadius: 5 },
    benchName: { flex: 1, fontSize: 13, fontWeight: "600", color: c.text },
    benchNumInput: { width: 44, backgroundColor: c.bg, borderRadius: 8, borderWidth: 1, borderColor: c.border, textAlign: "center", padding: 6, color: c.text, fontSize: 16, fontWeight: "700" },
    swapBadge: { backgroundColor: c.primary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    swapBadgeTxt: { fontSize: 10, fontWeight: "800", color: "#000" },
    specCard: { backgroundColor: c.bgCard, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: c.border },
    specCardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
    specEmoji: { fontSize: 22 },
    specTitle: { fontSize: 14, fontWeight: "800" },
    specCurrent: { fontSize: 12, color: c.textDim, marginTop: 2 },
    specScroll: { marginBottom: 4 },
    specChip: { alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.bg, marginRight: 8, minWidth: 56 },
    specChipNum: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    specChipName: { fontSize: 9, fontWeight: "700", color: c.textMuted, textAlign: "center" },
    specWallGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    specWallChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.bg },
    specWallChipActive: { borderColor: c.primary + "60", backgroundColor: c.primary + "10" },
    convRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: c.border, marginBottom: 6, backgroundColor: c.bgCard },
    convRowActive: { borderColor: c.primary + "60", backgroundColor: c.primary + "10" },
    convLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
    convNumInput: { width: 48, backgroundColor: c.bg, borderRadius: 8, borderWidth: 1, borderColor: c.border, textAlign: "center", padding: 6, color: c.text, fontSize: 16, fontWeight: "700" },
    convNumInputDim: { opacity: 0.35 },
    scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 20, backgroundColor: c.bgCard, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: c.border },
    scoreBox: { alignItems: "center", gap: 8 },
    scoreLabel: { fontSize: 11, fontWeight: "700", color: c.textDim, textTransform: "uppercase" },
    scoreInput: { width: 70, textAlign: "center", fontSize: 32, fontWeight: "900", color: c.text, backgroundColor: c.bg, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingVertical: 8 },
    scoreDash: { fontSize: 28, fontWeight: "800", color: c.textDim },
    goalCard: { flexDirection: "row", alignItems: "center", backgroundColor: c.bgCard, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: c.border, gap: 12 },
    goalDot: { width: 10, height: 10, borderRadius: 5, marginTop: 2 },
    goalInfo: { flex: 1 },
    goalPlayer: { fontSize: 14, fontWeight: "700", color: c.text },
    goalMin: { fontSize: 13, color: c.accent, fontWeight: "800" },
    goalType: { fontSize: 11, fontWeight: "700", marginTop: 2 },
    goalNotes: { fontSize: 11, color: c.textDim, marginTop: 2, fontStyle: "italic" },
    addPlayerBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.primary + "40", borderStyle: "dashed", justifyContent: "center", marginTop: 8 },
    addPlayerTxt: { fontSize: 14, color: c.primary, fontWeight: "700" },
    overlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
    miniModal: { backgroundColor: c.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "80%" },
    miniModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    modalTitle: { fontSize: 17, fontWeight: "800", color: c.text },
    // ── Riepilogo sheet ──────────────────────────────────────────────────────
    sheet: { gap: 0 },
    sheetHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, backgroundColor: c.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border },
    sheetHeaderLeft: { flex: 1, gap: 6 },
    competitionBadge: { alignSelf: "flex-start", backgroundColor: c.primary + "20", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: c.primary + "40" },
    competitionBadgeTxt: { fontSize: 10, fontWeight: "900", color: c.primary, letterSpacing: 0.8 },
    sheetVs: { fontSize: 13, fontWeight: "600", color: c.textDim },
    sheetOpponent: { fontSize: 18, fontWeight: "900", color: c.text },
    sheetMetaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
    sheetMetaItem: { fontSize: 11, color: c.textDim },
    homeAwayBadge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
    homeAwayHome: { backgroundColor: c.primary + "20", borderColor: c.primary + "50" },
    homeAwayAway: { backgroundColor: c.accent + "20", borderColor: c.accent + "50" },
    homeAwayTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
    homeAwayHomeTxt: { color: c.primary },
    homeAwayAwayTxt: { color: c.accent },
    scoreBlock: { alignItems: "center", borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, minWidth: 80 },
    scoreMain: { fontSize: 26, fontWeight: "900", lineHeight: 30 },
    scoreResult: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 },
    formationBlock: { alignItems: "center", backgroundColor: c.primary + "15", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: c.primary + "30", minWidth: 72 },
    formationBig: { fontSize: 20, fontWeight: "900", color: c.primary },
    formationLbl: { fontSize: 9, fontWeight: "800", color: c.primary, letterSpacing: 1, marginTop: 2 },
    divider: { height: 1, backgroundColor: c.border + "60", marginVertical: 10 },
    pitchSection: { gap: 10 },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
    sectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary },
    formationTagInline: { backgroundColor: c.primary + "18", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: c.primary + "30" },
    formationTagTxt: { fontSize: 11, fontWeight: "800", color: c.primary },
    startersList: { gap: 4, marginTop: 6 },
    starterRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: c.bgCard, borderRadius: 9, borderWidth: 1, borderColor: c.border },
    starterNumBubble: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
    starterNumTxt: { fontSize: 11, fontWeight: "900", color: "#fff" },
    starterName: { flex: 1, fontSize: 13, fontWeight: "700", color: c.text },
    starterRole: { fontSize: 10, fontWeight: "700", color: c.textMuted, backgroundColor: c.bg, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: c.border },
    benchSection: { gap: 6 },
    benchGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    benchPlayer: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: c.bgCard, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: c.border, width: "47%" },
    benchNumBubble: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    benchNumTxt: { fontSize: 10, fontWeight: "900", color: "#fff" },
    benchPlayerName: { flex: 1, fontSize: 11, fontWeight: "600", color: c.text },
    specialistiSection: { gap: 6 },
    specTable: { borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: c.border },
    specRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: c.bg },
    specRowEven: { backgroundColor: c.bgCard },
    specIcon: { fontSize: 15, width: 22, textAlign: "center" },
    specLabel: { fontSize: 12, fontWeight: "700", color: c.textDim, width: 100 },
    specVal: { flex: 1, fontSize: 12, fontWeight: "600", color: c.text },
    eventsSection: { gap: 6 },
    eventsGroup: { gap: 4 },
    eventRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: c.bgCard, borderRadius: 9, borderWidth: 1, borderColor: c.border },
    eventIcon: { fontSize: 14 },
    eventMinute: { fontSize: 12, fontWeight: "900", color: c.accent, width: 28 },
    eventName: { flex: 1, fontSize: 13, fontWeight: "700", color: c.text },
    eventTypeBadge: { backgroundColor: c.primary + "20", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: c.primary + "40" },
    eventTypeTxt: { fontSize: 10, fontWeight: "800", color: c.primary },
    eventSubOut: { fontSize: 12, fontWeight: "600", color: c.danger },
    eventSubIn: { fontSize: 12, fontWeight: "600", color: c.primary },
    notesSection: { marginTop: 6, gap: 3 },
    notesLabel: { fontSize: 9, fontWeight: "800", color: c.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 },
    notesText: { fontSize: 12, color: c.text, lineHeight: 18, backgroundColor: c.bgCard, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: c.border },
    // ── Compact Riepilogo ────────────────────────────────────────────────────
    compactHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5, backgroundColor: c.bgCard, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: c.border, marginBottom: 6 },
    compactMeta: { fontSize: 10, color: c.textDim },
    formationBadge: { backgroundColor: c.primary + "20", borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: c.primary + "40" },
    formationBadgeTxt: { fontSize: 12, fontWeight: "900", color: c.primary, letterSpacing: 0.5 },
    // specialisti griglia: 2 col per le prime righe + barriera full-width
    specHorizTable: { flexDirection: "row", flexWrap: "wrap", borderRadius: 8, borderWidth: 1, borderColor: c.border, overflow: "hidden", marginTop: 6 },
    specHorizCell: { width: "33.33%", padding: 6, backgroundColor: c.bg },
    specHorizCellHalf: { width: "50%", padding: 7, backgroundColor: c.bg },
    specHorizCellFull: { width: "100%", padding: 8, backgroundColor: c.bg },
    specHorizCellEven: { backgroundColor: c.bgCard },
    specHorizIcon: { fontSize: 11 },
    specHorizLabel: { fontSize: 8, fontWeight: "800", color: c.textDim, textTransform: "uppercase", letterSpacing: 0.5 },
    specHorizVal: { fontSize: 11, fontWeight: "700", color: c.text, marginTop: 1 },
    // panchina
    benchRowWrap: { marginTop: 6, gap: 4 },
    benchRowLabel: { fontSize: 9, fontWeight: "800", color: c.textDim, textTransform: "uppercase", letterSpacing: 0.8 },
    benchChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
    benchChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border },
    benchChipNum: { fontSize: 11, fontWeight: "900" },
    benchChipName: { fontSize: 11, fontWeight: "600", color: c.text, maxWidth: 100 },
  });
}
