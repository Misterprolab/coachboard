import { View, Text, ScrollView, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Modal, Image, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "../../lib/themeStore";
import type { ThemeColors } from "../../lib/themeStore";
import { useI18n } from "../../lib/i18n";
import { Plus, Trash, PencilSimple, X, User, ArrowsDownUp, ChartBar } from "phosphor-react-native";
import {
  getPlayers, createPlayer, updatePlayer, deletePlayer as dbDeletePlayer, computePlayerStats,
} from "../../lib/db/queries";

// ─── Ruoli principali ────────────────────────────────────────────────────────
const ROLES = ["portiere", "difensore", "centrocampista", "attaccante"];
const ROLE_ORDER: Record<string, number> = { portiere: 0, difensore: 1, centrocampista: 2, attaccante: 3 };
const ROLE_COLORS: Record<string, string> = {
  portiere: "#1abc9c",
  difensore: "#3498db",
  centrocampista: "#f1c40f",
  attaccante: "#e74c3c",
};
const ROLE_LABELS: Record<string, { it: string; en: string }> = {
  portiere: { it: "Portiere", en: "Goalkeeper" },
  difensore: { it: "Difensore", en: "Defender" },
  centrocampista: { it: "Centrocampista", en: "Midfielder" },
  attaccante: { it: "Attaccante", en: "Forward" },
};

const SUB_ROLES: Record<string, { key: string; it: string; en: string }[]> = {
  portiere: [{ key: "POR", it: "Portiere", en: "Goalkeeper" }],
  difensore: [
    { key: "DC", it: "Difensore Centrale", en: "Centre-back" },
    { key: "DS", it: "Difensore Sinistro", en: "Left Back" },
    { key: "DD", it: "Difensore Destro", en: "Right Back" },
    { key: "LS", it: "Laterale Sinistro", en: "Left Wing-back" },
    { key: "LD", it: "Laterale Destro", en: "Right Wing-back" },
    { key: "LIB", it: "Libero", en: "Sweeper" },
  ],
  centrocampista: [
    { key: "CDC", it: "Centrodestra/Centrosinistra", en: "Centre Mid" },
    { key: "MCD", it: "Mediano/Davanti Difesa", en: "Defensive Mid" },
    { key: "MCO", it: "Trequartista", en: "Attacking Mid" },
    { key: "MEZ", it: "Mezzala", en: "Box-to-box Mid" },
    { key: "TC", it: "Tornante", en: "Wide Mid" },
    { key: "TT", it: "Terzino Aggiunto", en: "Auxiliary Back" },
  ],
  attaccante: [
    { key: "PC", it: "Prima Punta", en: "Striker" },
    { key: "SEC", it: "Seconda Punta", en: "Second Striker" },
    { key: "ALA-S", it: "Ala Sinistra", en: "Left Winger" },
    { key: "ALA-D", it: "Ala Destra", en: "Right Winger" },
    { key: "FA", it: "Falso 9", en: "False 9" },
    { key: "TRP", it: "Trequartista Avanzato", en: "Advanced Playmaker" },
  ],
};

type SortBy = "ruolo" | "nome" | "inserimento";
const SORT_OPTIONS: { key: SortBy; it: string; en: string }[] = [
  { key: "ruolo", it: "Ruolo", en: "Role" },
  { key: "nome", it: "Nome", en: "Name" },
  { key: "inserimento", it: "Recenti", en: "Recent" },
];

function calcAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

type Player = {
  id: string;
  name: string;
  number?: number | null;
  role: string;
  subRole?: string | null;
  secondaryRole?: string | null;
  secondarySubRole?: string | null;
  notes?: string | null;
  dateOfBirth?: string | null;
  foot?: string | null;
  photoUrl?: string | null;
  createdAt: number;
};

type PlayerStats = {
  convocazioni: number;
  titolare: number;
  presenze: number;
  goalsScored: number;
  yellowCards: number;
  redCards: number;
  wins: number;
  draws: number;
  losses: number;
  avgRating?: number | null;
  matchHistory: {
    matchId: string;
    opponent: string;
    date: string;
    competition: string | null;
    role: 'titolare' | 'subentrato' | 'panchina' | null;
    goalsFor: number | null;
    goalsAgainst: number | null;
    yellowCard: boolean;
    redCard: boolean;
    goalsScored: number;
  }[];
};

const emptyForm = () => ({
  name: "", role: "centrocampista",
  subRole: "", secondaryRole: "", secondarySubRole: "",
  notes: "", dateOfBirth: "", photoUrl: "", foot: "",
});

function sortPlayers(list: Player[], sortBy: SortBy): Player[] {
  const arr = [...list];
  switch (sortBy) {
    case "ruolo":
      return arr.sort((a, b) => {
        const ro = (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9);
        if (ro !== 0) return ro;
        return a.name.localeCompare(b.name);
      });
    case "nome": return arr.sort((a, b) => a.name.localeCompare(b.name));
    case "inserimento": return arr.sort((a, b) => b.createdAt - a.createdAt);
  }
}

// ─── SubRole picker inline ────────────────────────────────────────────────────
function SubRolePicker({
  role, value, onChange, lang, c,
}: { role: string; value: string; onChange: (v: string) => void; lang: string; c: ThemeColors }) {
  const subs = SUB_ROLES[role] ?? [];
  if (subs.length === 0) return null;
  const sr = useMemo(() => mkSubRoleStyles(c), [c]);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {subs.map(sub => {
          const active = value === sub.key;
          const color = ROLE_COLORS[role];
          return (
            <TouchableOpacity
              key={sub.key}
              style={[sr.chip, active && { backgroundColor: color + "25", borderColor: color }]}
              onPress={() => onChange(active ? "" : sub.key)}
              activeOpacity={0.75}
            >
              <Text style={[sr.chipKey, active && { color }]}>{sub.key}</Text>
              <Text style={[sr.chipLabel, active && { color }]} numberOfLines={1}>
                {lang === "it" ? sub.it : sub.en}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

function mkSubRoleStyles(c: ThemeColors) {
  return StyleSheet.create({
    chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.bg, minWidth: 60, alignItems: "center" },
    chipKey: { fontSize: 11, fontWeight: "800", color: c.textMuted },
    chipLabel: { fontSize: 9, color: c.textDim, marginTop: 1 },
  });
}

// ─── Stats Grid Cell ──────────────────────────────────────────────────────────
function StatCell({ emoji, value, label, color, s }: { emoji: string; value: string | number; label: string; color: string; s: ReturnType<typeof mkStyles> }) {
  return (
    <View style={s.statsGridCell}>
      <Text style={{ fontSize: 22, marginBottom: 2 }}>{emoji}</Text>
      <Text style={[s.statsGridValue, { color }]}>{value}</Text>
      <Text style={s.statsGridLabel}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function RosterScreen() {
  const c = useTheme((s) => s.colors);
  const s = useMemo(() => mkStyles(c), [c]);
  const { t, lang } = useI18n();
  const qc = useQueryClient();

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [activeRole, setActiveRole] = useState("tutti");
  const [photoErr, setPhotoErr] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("ruolo");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [statsPlayerId, setStatsPlayerId] = useState<string | null>(null);

  const players = useQuery<Player[]>({
    queryKey: ["players"],
    queryFn: () => getPlayers() as Promise<Player[]>,
  });

  const playerStats = useQuery<PlayerStats>({
    queryKey: ["player-stats", statsPlayerId],
    queryFn: () => computePlayerStats(statsPlayerId!) as Promise<PlayerStats>,
    enabled: !!statsPlayerId,
    staleTime: 0,
    gcTime: 0,
  });

  const deletePlayerMutation = useMutation({
    mutationFn: (id: string) => dbDeletePlayer(id),
    onSuccess: () => {
      setConfirmingId(null);
      qc.refetchQueries({ queryKey: ["players"] });
    },
  });

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setSaveError(null);
    setModal(true);
  };

  const openEdit = (p: Player) => {
    setEditing(p);
    setForm({
      name: p.name,
      role: p.role,
      subRole: p.subRole ?? "",
      secondaryRole: p.secondaryRole ?? "",
      secondarySubRole: p.secondarySubRole ?? "",
      notes: p.notes ?? "",
      dateOfBirth: p.dateOfBirth ?? "",
      photoUrl: p.photoUrl ?? "",
      foot: p.foot ?? "",
    });
    setSaveError(null);
    setModal(true);
  };

  const closeModal = () => {
    setModal(false);
    setEditing(null);
    setForm(emptyForm());
    setSaveError(null);
  };

  const save = async () => {
    if (!form.name.trim()) {
      setSaveError(t("Inserisci il nome", "Enter a name"));
      return;
    }
    if (form.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth)) {
      setSaveError(t("Formato data non valido (AAAA-MM-GG)", "Invalid date format (YYYY-MM-DD)"));
      return;
    }
    const data = {
      name: form.name.trim(),
      role: form.role,
      subRole: form.subRole.trim() || null,
      secondaryRole: form.secondaryRole.trim() || null,
      secondarySubRole: form.secondarySubRole.trim() || null,
      notes: form.notes.trim() || null,
      dateOfBirth: form.dateOfBirth.trim() || null,
      photoUrl: form.photoUrl.trim() || null,
      foot: form.foot.trim() || null,
    };
    setSaving(true);
    setSaveError(null);
    try {
      if (editing) {
        await updatePlayer(editing.id, data);
      } else {
        await createPlayer(data);
      }
      setModal(false);
      setEditing(null);
      setForm(emptyForm());
      setSaveError(null);
      await qc.refetchQueries({ queryKey: ["players"] });
    } catch (err: any) {
      setSaveError(err?.message ?? t("Errore sconosciuto", "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTap = (p: Player) => {
    if (confirmingId === p.id) {
      deletePlayerMutation.mutate(p.id);
    } else {
      setConfirmingId(p.id);
    }
  };

  const all = players.data ?? [];
  const filtered = activeRole === "tutti" ? all : all.filter(p => p.role === activeRole);
  const sorted = sortPlayers(filtered, sortBy);
  const byRole = ROLES.reduce((acc, role) => {
    acc[role] = all.filter(p => p.role === role);
    return acc;
  }, {} as Record<string, Player[]>);

  const roleLabel = (p: Player) => {
    const main = lang === "it" ? ROLE_LABELS[p.role]?.it : ROLE_LABELS[p.role]?.en;
    if (p.subRole) return p.subRole;
    return main ?? p.role;
  };

  const secondaryLabel = (p: Player) => {
    if (!p.secondaryRole) return null;
    const mainLbl = lang === "it" ? ROLE_LABELS[p.secondaryRole]?.it : ROLE_LABELS[p.secondaryRole]?.en;
    return p.secondarySubRole ? p.secondarySubRole : (mainLbl ?? p.secondaryRole);
  };

  const listHeader = (
    <>
      <View style={s.header}>
        <Text style={s.title}>{t("Rosa Giocatori", "Player Roster")}</Text>
        <TouchableOpacity style={s.addBtn} onPress={openAdd} activeOpacity={0.8}>
          <Plus color={c.bg} size={18} weight="bold" />
          <Text style={s.addBtnText}>{t("Aggiungi", "Add")}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow} style={s.filterScroll}>
        {["tutti", ...ROLES].map(role => {
          const isActive = activeRole === role;
          const color = role === "tutti" ? c.primary : ROLE_COLORS[role];
          return (
            <TouchableOpacity
              key={role}
              style={[s.chip, isActive && { backgroundColor: color + "25", borderColor: color }]}
              onPress={() => { setActiveRole(role); setConfirmingId(null); }}
              activeOpacity={0.75}
            >
              <Text style={[s.chipText, isActive && { color }]}>
                {role === "tutti" ? t("Tutti", "All") : lang === "it" ? ROLE_LABELS[role].it : ROLE_LABELS[role].en}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={s.statsRow}>
        {ROLES.map(role => (
          <View key={role} style={s.statBox}>
            <Text style={[s.statNum, { color: ROLE_COLORS[role] }]}>{byRole[role].length}</Text>
            <Text style={s.statLabel}>{lang === "it" ? ROLE_LABELS[role].it : ROLE_LABELS[role].en}</Text>
          </View>
        ))}
      </View>

      <View style={s.sortRow}>
        <ArrowsDownUp color={c.textDim} size={13} />
        {SORT_OPTIONS.map(opt => (
          <TouchableOpacity key={opt.key} style={[s.sortChip, sortBy === opt.key && s.sortChipActive]} onPress={() => setSortBy(opt.key)} activeOpacity={0.75}>
            <Text style={[s.sortChipText, sortBy === opt.key && s.sortChipTextActive]}>{lang === "it" ? opt.it : opt.en}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  const renderCard = ({ item: p }: { item: Player }) => {
    const age = calcAge(p.dateOfBirth);
    const showPhoto = !!p.photoUrl && !photoErr[p.id];
    const isConfirming = confirmingId === p.id;
    const isDeleting = deletePlayerMutation.isPending && deletePlayerMutation.variables === p.id;
    const secLbl = secondaryLabel(p);
    return (
      <View style={[s.card, isConfirming && s.cardConfirming]}>
        <View style={[s.avatar, { borderColor: ROLE_COLORS[p.role] + "70" }]}>
          {showPhoto ? (
            <Image source={{ uri: p.photoUrl! }} style={s.avatarImg} onError={() => setPhotoErr(e => ({ ...e, [p.id]: true }))} />
          ) : (
            <View style={[s.avatarFallback, { backgroundColor: ROLE_COLORS[p.role] + "22" }]}>
              <Text style={[s.avatarInitial, { color: ROLE_COLORS[p.role] }]}>
                {p.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <View style={s.cardInfo}>
          {isConfirming ? (
            <Text style={s.confirmText}>{t("Rimuovere?", "Remove?")}</Text>
          ) : (
            <>
              <Text style={s.playerName}>{p.name}</Text>
              <View style={s.cardMetaRow}>
                <Text style={[s.playerRole, { color: ROLE_COLORS[p.role] }]}>{roleLabel(p)}</Text>
                {secLbl && (
                  <>
                    <Text style={s.playerRoleSep}> / </Text>
                    <Text style={[s.playerRole, { color: ROLE_COLORS[p.secondaryRole!] || c.textDim }]}>{secLbl}</Text>
                  </>
                )}
                {age != null && <Text style={s.playerAge}> · {age} {t("anni", "yrs")}</Text>}
              </View>
              {(p.foot || p.notes) ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                  {p.foot ? (
                    <Text style={s.playerNotes}>
                      {lang === "it"
                        ? (p.foot === "destra" ? "⚡ Destro" : p.foot === "sinistra" ? "⚡ Mancino" : "⚡ Ambidestro")
                        : (p.foot === "destra" ? "⚡ Right" : p.foot === "sinistra" ? "⚡ Left" : "⚡ Both")}
                    </Text>
                  ) : null}
                  {p.notes ? <Text style={s.playerNotes} numberOfLines={1}>{p.notes}</Text> : null}
                </View>
              ) : null}
            </>
          )}
        </View>
        <View style={s.cardBtns}>
          {isConfirming ? (
            <>
              <TouchableOpacity style={[s.iconBtn, s.cancelBtn]} onPress={() => setConfirmingId(null)}>
                <X color={c.textMuted} size={16} weight="bold" />
              </TouchableOpacity>
              <TouchableOpacity style={[s.iconBtn, s.deleteConfirmBtn]} onPress={() => handleDeleteTap(p)} disabled={isDeleting}>
                {isDeleting ? <ActivityIndicator size="small" color="#fff" /> : <Trash color="#fff" size={16} weight="fill" />}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={() => { setStatsPlayerId(p.id); }} style={s.iconBtn}>
                <ChartBar color={c.primary} size={18} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEdit(p)} style={s.iconBtn}>
                <PencilSimple color={c.textMuted} size={18} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteTap(p)} style={s.iconBtn}>
                <Trash color={c.danger} size={18} weight="fill" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  // ─── Stats Modal Content ────────────────────────────────────────────────────
  const renderStatsModal = () => {
    if (!statsPlayerId) return null;
    const sp = (players.data ?? []).find(p => p.id === statsPlayerId);
    const st = playerStats.data;
    const color = sp ? ROLE_COLORS[sp.role] : c.primary;

    return (
      <View style={[s.modalBox, { paddingBottom: 0 }]}>
        <View style={s.modalHead}>
          <View>
            <Text style={s.modalTitle}>{sp?.name ?? "—"}</Text>
            <Text style={{ fontSize: 12, color: c.textDim, marginTop: 2 }}>
              {t("Statistiche stagione", "Season statistics")}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setStatsPlayerId(null)} style={{ padding: 8 }}>
            <X color={c.textMuted} size={24} />
          </TouchableOpacity>
        </View>

        {playerStats.isError ? (
          <Text style={{ color: c.danger, textAlign: "center", marginVertical: 20 }}>
            {t("Errore caricamento statistiche", "Stats load error")}
          </Text>
        ) : !st || playerStats.fetchStatus === "fetching" ? (
          <ActivityIndicator color={c.primary} style={{ marginVertical: 40 }} />
        ) : st ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={s.statsGrid}>
              <StatCell emoji="📋" value={st.convocazioni} label={t("CONVOCAZIONI", "CALL-UPS")} color={color} s={s} />
              <StatCell emoji="👟" value={st.presenze} label={t("PRESENZE", "APPEARANCES")} color={color} s={s} />
              <StatCell emoji="▶️" value={st.titolare} label={t("TITOLARE", "STARTER")} color={color} s={s} />
            </View>
            <View style={s.statsGrid}>
              <StatCell emoji="⚽" value={st.goalsScored} label={t("GOL", "GOALS")} color={color} s={s} />
              <StatCell emoji="🟨" value={st.yellowCards} label={t("AMMONIZIONI", "BOOKINGS")} color="#f1c40f" s={s} />
              <StatCell emoji="🟥" value={st.redCards} label={t("ESPULSIONI", "RED CARDS")} color="#e74c3c" s={s} />
            </View>
            {st.avgRating != null && (
              <View style={s.statsGrid}>
                <StatCell
                  emoji="⭐"
                  value={st.avgRating.toFixed(1)}
                  label={t("MEDIA VOTO", "AVG RATING")}
                  color={st.avgRating >= 7 ? "#2ecc71" : st.avgRating >= 5 ? "#f1c40f" : "#e74c3c"}
                  s={s}
                />
              </View>
            )}
            <View style={s.wdlRow}>
              <View style={[s.wdlCell, { borderColor: "#2ecc71" + "40" }]}>
                <Text style={{ fontSize: 18 }}>✅</Text>
                <Text style={[s.wdlNum, { color: "#2ecc71" }]}>{st.wins}</Text>
                <Text style={s.wdlLabel}>{t("VITTORIE", "WINS")}</Text>
              </View>
              <View style={[s.wdlCell, { borderColor: c.border }]}>
                <Text style={{ fontSize: 18 }}>—</Text>
                <Text style={[s.wdlNum, { color: c.textMuted }]}>{st.draws}</Text>
                <Text style={s.wdlLabel}>{t("PAREGGI", "DRAWS")}</Text>
              </View>
              <View style={[s.wdlCell, { borderColor: "#e74c3c" + "40" }]}>
                <Text style={{ fontSize: 18 }}>❌</Text>
                <Text style={[s.wdlNum, { color: "#e74c3c" }]}>{st.losses}</Text>
                <Text style={s.wdlLabel}>{t("SCONFITTE", "LOSSES")}</Text>
              </View>
            </View>

            {st.convocazioni === 0 && (
              <Text style={{ color: c.textDim, textAlign: "center", fontSize: 13, marginTop: 8 }}>
                {t("Nessuna partita registrata ancora", "No matches recorded yet")}
              </Text>
            )}

            {(() => {
              const history = st.matchHistory;
              if (history.length === 0) return null;
              return (
                <>
                  <Text style={s.historyTitle}>{t("STORICO PARTITE", "MATCH HISTORY")}</Text>
                  {history.map(m => {
                    const hasResult = m.goalsFor != null && m.goalsAgainst != null;
                    const resultColor = hasResult
                      ? m.goalsFor! > m.goalsAgainst! ? "#2ecc71"
                      : m.goalsFor === m.goalsAgainst ? c.textMuted
                      : "#e74c3c"
                      : c.textDim;

                    const roleLbl = m.role === 'titolare'
                      ? t("Titolare", "Starter")
                      : m.role === 'subentrato'
                      ? t("Subentrato", "Sub")
                      : t("Panchina", "Bench");

                    return (
                      <View key={m.matchId} style={s.historyRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.historyOpponent}>vs {m.opponent}</Text>
                          <Text style={s.historyMeta}>
                            {m.date}
                            {m.competition ? ` · ${m.competition}` : ""}
                            {m.role ? ` · ${roleLbl}` : ""}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          {m.goalsScored > 0 && <Text style={{ fontSize: 13 }}>⚽</Text>}
                          {m.yellowCard && <Text style={{ fontSize: 13 }}>🟨</Text>}
                          {m.redCard && <Text style={{ fontSize: 13 }}>🟥</Text>}
                          {hasResult && (
                            <Text style={[s.historyResult, { color: resultColor }]}>
                              {m.goalsFor}-{m.goalsAgainst}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </>
              );
            })()}
          </ScrollView>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      {players.isLoading ? (
        <>
          {listHeader}
          <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
        </>
      ) : players.isError ? (
        <>
          {listHeader}
          <View style={s.errorBox}>
            <Text style={s.errorText}>{t("Errore caricamento", "Load error")}</Text>
            <TouchableOpacity onPress={() => players.refetch()} style={s.retryBtn}>
              <Text style={s.retryText}>{t("Riprova", "Retry")}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={p => p.id}
          renderItem={renderCard}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View style={s.empty}>
              <User color={c.textDim} size={48} weight="thin" />
              <Text style={s.emptyText}>{t("Nessun giocatore", "No players yet")}</Text>
              <Text style={s.emptyHint}>{t("Premi Aggiungi per inserire il primo giocatore", "Tap Add to insert the first player")}</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 40 }} />}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => setConfirmingId(null)}
        />
      )}

      {/* Stats Modal */}
      <Modal visible={!!statsPlayerId} transparent animationType="slide" onRequestClose={() => setStatsPlayerId(null)}>
        <View style={s.overlay}>
          <TouchableOpacity style={s.overlayBg} activeOpacity={1} onPress={() => setStatsPlayerId(null)} />
          {renderStatsModal()}
        </View>
      </Modal>

      {/* Add/Edit Modal */}
      <Modal visible={modal} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={s.overlayBg} activeOpacity={1} onPress={closeModal} />
          <View style={s.modalBox}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={s.modalHead}>
                <Text style={s.modalTitle}>
                  {editing ? t("Modifica Giocatore", "Edit Player") : t("Nuovo Giocatore", "New Player")}
                </Text>
                <TouchableOpacity onPress={closeModal} style={{ padding: 8 }}>
                  <X color={c.textMuted} size={24} />
                </TouchableOpacity>
              </View>

              <Text style={s.fieldLabel}>{t("Nome e cognome *", "Full name *")}</Text>
              <TextInput style={s.input} placeholder={t("Es. Marco Rossi", "E.g. John Smith")} placeholderTextColor={c.textDim} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} autoCapitalize="words" />

              <Text style={s.fieldLabel}>{t("Data di nascita", "Date of birth")}</Text>
              <TextInput style={s.input} placeholder="2000-05-15" placeholderTextColor={c.textDim} value={form.dateOfBirth} onChangeText={v => setForm(f => ({ ...f, dateOfBirth: v }))} keyboardType="numbers-and-punctuation" maxLength={10} />

              <Text style={s.fieldLabel}>{t("Piede dominante", "Dominant foot")}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                {[
                  { key: "destra", it: "Destro", en: "Right" },
                  { key: "sinistra", it: "Mancino", en: "Left" },
                  { key: "entrambi", it: "Ambidestro", en: "Both" },
                ].map(f => {
                  const active = form.foot === f.key;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      style={[s.roleChipSm, active && { backgroundColor: c.primary + "25", borderColor: c.primary }]}
                      onPress={() => setForm(frm => ({ ...frm, foot: active ? "" : f.key }))}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.roleTextSm, active && { color: c.primary }]}>
                        {lang === "it" ? f.it : f.en}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.fieldLabel}>{t("URL foto", "Photo URL")}</Text>
              <TextInput style={s.input} placeholder="https://..." placeholderTextColor={c.textDim} value={form.photoUrl} onChangeText={v => setForm(f => ({ ...f, photoUrl: v }))} autoCapitalize="none" autoCorrect={false} keyboardType="url" />

              <Text style={s.fieldLabel}>{t("Ruolo principale", "Primary position")}</Text>
              <View style={s.roleGrid}>
                {ROLES.map(role => (
                  <TouchableOpacity
                    key={role}
                    style={[s.roleChip, form.role === role && { backgroundColor: ROLE_COLORS[role] + "30", borderColor: ROLE_COLORS[role] }]}
                    onPress={() => setForm(f => ({ ...f, role, subRole: "" }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.roleText, form.role === role && { color: ROLE_COLORS[role] }]}>
                      {lang === "it" ? ROLE_LABELS[role].it : ROLE_LABELS[role].en}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fieldLabel}>{t("Sottoruolo", "Sub-position")}</Text>
              <SubRolePicker role={form.role} value={form.subRole} onChange={v => setForm(f => ({ ...f, subRole: v }))} lang={lang} c={c} />

              <Text style={s.fieldLabel}>{t("Ruolo secondario (opzionale)", "Secondary position (optional)")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TouchableOpacity
                    style={[s.roleChipSm, !form.secondaryRole && { backgroundColor: c.border + "40", borderColor: c.border }]}
                    onPress={() => setForm(f => ({ ...f, secondaryRole: "", secondarySubRole: "" }))}
                  >
                    <Text style={[s.roleTextSm, !form.secondaryRole && { color: c.text }]}>{t("Nessuno", "None")}</Text>
                  </TouchableOpacity>
                  {ROLES.map(role => (
                    <TouchableOpacity
                      key={role}
                      style={[s.roleChipSm, form.secondaryRole === role && { backgroundColor: ROLE_COLORS[role] + "30", borderColor: ROLE_COLORS[role] }]}
                      onPress={() => setForm(f => ({ ...f, secondaryRole: role, secondarySubRole: "" }))}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.roleTextSm, form.secondaryRole === role && { color: ROLE_COLORS[role] }]}>
                        {lang === "it" ? ROLE_LABELS[role].it : ROLE_LABELS[role].en}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {!!form.secondaryRole && (
                <>
                  <Text style={s.fieldLabel}>{t("Sottoruolo secondario", "Secondary sub-position")}</Text>
                  <SubRolePicker role={form.secondaryRole} value={form.secondarySubRole} onChange={v => setForm(f => ({ ...f, secondarySubRole: v }))} lang={lang} c={c} />
                </>
              )}

              <Text style={s.fieldLabel}>{t("Note", "Notes")}</Text>
              <TextInput style={[s.input, { height: 60, textAlignVertical: "top" }]} placeholder={t("Note opzionali...", "Optional notes...")} placeholderTextColor={c.textDim} value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} multiline />

              {saveError ? (
                <View style={s.errorInline}>
                  <Text style={s.errorInlineText}>{saveError}</Text>
                </View>
              ) : null}

              <View style={{ height: 16 }} />
            </ScrollView>

            <View style={s.modalFooter}>
              <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.8}>
                {saving ? <ActivityIndicator color={c.bg} /> : (
                  <Text style={s.saveBtnText}>{editing ? t("Aggiorna", "Update") : t("Aggiungi Giocatore", "Add Player")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function mkStyles(c: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 12 },
    title: { fontSize: 24, fontWeight: "800", color: c.text },
    addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
    addBtnText: { fontSize: 13, fontWeight: "700", color: c.bg },
    filterScroll: { flexGrow: 0 },
    filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
    chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCard },
    chipText: { fontSize: 12, fontWeight: "600", color: c.textMuted },
    sortRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingBottom: 10 },
    sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: "transparent", backgroundColor: "transparent" },
    sortChipActive: { backgroundColor: c.bgCard, borderColor: c.border },
    sortChipText: { fontSize: 11, fontWeight: "600", color: c.textDim },
    sortChipTextActive: { color: c.text },
    statsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 12 },
    statBox: { flex: 1, backgroundColor: c.bgCard, borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, borderColor: c.border },
    statNum: { fontSize: 20, fontWeight: "800" },
    statLabel: { fontSize: 9, color: c.textDim, marginTop: 2, textAlign: "center" },
    list: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 0 },
    empty: { alignItems: "center", paddingTop: 60, gap: 8 },
    emptyText: { fontSize: 15, color: c.textMuted },
    emptyHint: { fontSize: 12, color: c.textDim, textAlign: "center", paddingHorizontal: 40 },
    errorBox: { alignItems: "center", paddingTop: 40, gap: 12 },
    errorText: { textAlign: "center", color: c.danger },
    retryBtn: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: c.bgCard, borderRadius: 10, borderWidth: 1, borderColor: c.border },
    retryText: { color: c.textMuted, fontSize: 13, fontWeight: "600" },
    card: { flexDirection: "row", alignItems: "center", backgroundColor: c.bgCard, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: c.border, gap: 12, marginBottom: 10 },
    cardConfirming: { borderColor: c.danger + "60", backgroundColor: c.danger + "0a" },
    avatar: { width: 48, height: 48, borderRadius: 12, borderWidth: 1.5, overflow: "hidden" },
    avatarImg: { width: "100%", height: "100%" },
    avatarFallback: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
    avatarInitial: { fontSize: 20, fontWeight: "800" },
    cardInfo: { flex: 1 },
    playerName: { fontSize: 14, fontWeight: "700", color: c.text },
    playerRole: { fontSize: 12, fontWeight: "600" },
    playerRoleSep: { fontSize: 12, color: c.textDim },
    playerAge: { fontSize: 11, color: c.textDim },
    playerNotes: { fontSize: 11, color: c.textDim, marginTop: 2 },
    cardMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 2, flexWrap: "wrap" },
    confirmText: { fontSize: 13, fontWeight: "700", color: c.danger },
    cardBtns: { flexDirection: "row", gap: 4 },
    iconBtn: { padding: 12, borderRadius: 10 },
    cancelBtn: { backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border },
    deleteConfirmBtn: { backgroundColor: c.danger, borderRadius: 10 },
    overlay: { flex: 1, backgroundColor: "#000000bb", justifyContent: "flex-end" },
    overlayBg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    modalBox: { backgroundColor: c.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%", paddingTop: 24, paddingHorizontal: 24 },
    modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    modalFooter: { paddingHorizontal: 0, paddingVertical: 16, backgroundColor: c.bgCard },
    modalTitle: { fontSize: 18, fontWeight: "800", color: c.text },
    fieldLabel: { fontSize: 12, fontWeight: "700", color: c.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
    input: { backgroundColor: c.bg, borderRadius: 12, padding: 14, color: c.text, borderWidth: 1, borderColor: c.border, marginBottom: 16, fontSize: 16 },
    roleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    roleChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.bg },
    roleText: { fontSize: 12, fontWeight: "600", color: c.textMuted },
    roleChipSm: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.bg },
    roleTextSm: { fontSize: 11, fontWeight: "600", color: c.textMuted },
    saveBtn: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 4 },
    saveBtnText: { fontSize: 15, fontWeight: "800", color: c.bg },
    errorInline: { backgroundColor: "#e74c3c22", borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#e74c3c55" },
    errorInlineText: { color: "#e74c3c", fontSize: 13, fontWeight: "600", textAlign: "center" },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
    statsGridCell: { flexBasis: "30%", flexGrow: 1, flexShrink: 0, backgroundColor: c.bg, borderRadius: 14, padding: 12, alignItems: "center", borderWidth: 1, borderColor: c.border },
    statsGridValue: { fontSize: 24, fontWeight: "800", marginBottom: 2 },
    statsGridLabel: { fontSize: 9, color: c.textDim, textAlign: "center", fontWeight: "700", letterSpacing: 0.5 },
    wdlRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
    wdlCell: { flex: 1, backgroundColor: c.bg, borderRadius: 14, padding: 12, alignItems: "center", borderWidth: 1 },
    wdlNum: { fontSize: 22, fontWeight: "800", marginTop: 2 },
    wdlLabel: { fontSize: 9, color: c.textDim, fontWeight: "700", letterSpacing: 0.5, marginTop: 2 },
    historyTitle: { fontSize: 11, fontWeight: "800", color: c.textMuted, letterSpacing: 1, marginBottom: 10 },
    historyRow: { flexDirection: "row", alignItems: "center", backgroundColor: c.bg, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: c.border },
    historyOpponent: { fontSize: 13, fontWeight: "700", color: c.text },
    historyMeta: { fontSize: 11, color: c.textDim, marginTop: 2 },
    historyResult: { fontSize: 14, fontWeight: "800" },
  });
}
