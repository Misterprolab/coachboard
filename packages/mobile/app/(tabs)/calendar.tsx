import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useI18n } from "../../lib/i18n";
import {
  Plus, CalendarBlank, X, Trash, Check, CaretRight,
  SortAscending, SortDescending,
} from "phosphor-react-native";
import { useTheme } from "../../lib/themeStore";
import type { ThemeColors } from "../../lib/themeStore";
import { getMatches, createMatch as dbCreateMatch, deleteMatch as dbDeleteMatch } from "../../lib/db/queries";

type Match = {
  id: string;
  opponent: string;
  date: string;
  time?: string | null;
  venue?: string | null;
  homeAway: string;
  competition?: string | null;
  formation?: string | null;
  goalsFor?: number | null;
  goalsAgainst?: number | null;
  createdAt: number;
};

const HOME_AWAY_LABELS: Record<string, { it: string; en: string }> = {
  home: { it: "Casa", en: "Home" },
  away: { it: "Trasferta", en: "Away" },
  neutral: { it: "Neutro", en: "Neutral" },
};

type CompType = "all" | "campionato" | "coppa" | "amichevole";

const COMP_KEYWORDS: Record<Exclude<CompType, "all">, string[]> = {
  campionato: ["campionato", "serie", "league", "liga", "lega", "premier", "bundesliga", "ligue"],
  coppa: ["coppa", "cup", "trofeo", "trophy", "fa cup", "coupe", "pokal"],
  amichevole: ["amichevole", "friendly", "test", "preparazione", "preseason", "pre-season"],
};

function detectCompType(competition?: string | null): Exclude<CompType, "all"> {
  if (!competition) return "amichevole";
  const lower = competition.toLowerCase();
  for (const [type, keywords] of Object.entries(COMP_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return type as Exclude<CompType, "all">;
  }
  return "campionato";
}

function matchResult(m: Match) {
  if (m.goalsFor == null && m.goalsAgainst == null) return null;
  const gf = m.goalsFor ?? 0;
  const ga = m.goalsAgainst ?? 0;
  if (gf > ga) return "W";
  if (gf < ga) return "L";
  return "D";
}

const FILTER_TABS: { key: CompType; it: string; en: string }[] = [
  { key: "all", it: "Tutte", en: "All" },
  { key: "campionato", it: "Campionato", en: "League" },
  { key: "coppa", it: "Coppa", en: "Cup" },
  { key: "amichevole", it: "Amichevole", en: "Friendly" },
];

export default function CalendarScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();
  const c = useTheme((s) => s.colors);
  const s = useMemo(() => mkStyles(c), [c]);

  const HOME_AWAY_COLORS: Record<string, string> = {
    home: c.primary,
    away: c.accent,
    neutral: c.textMuted,
  };

  const RESULT_COLORS: Record<string, string> = {
    W: c.primary,
    D: c.accent,
    L: c.danger,
  };

  const [showModal, setShowModal] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<CompType>("all");
  const [sortBy, setSortBy] = useState<"date" | "type">("date");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const [form, setForm] = useState({
    opponent: "",
    date: new Date().toISOString().slice(0, 10),
    time: "",
    venue: "",
    homeAway: "home" as "home" | "away" | "neutral",
    competition: "",
  });

  const matchesQ = useQuery<Match[]>({
    queryKey: ["matches"],
    queryFn: () => getMatches() as Promise<Match[]>,
  });

  const createMatchMutation = useMutation({
    mutationFn: (data: typeof form) => dbCreateMatch({
      opponent: data.opponent,
      date: data.date,
      time: data.time || null,
      venue: data.venue || null,
      homeAway: data.homeAway,
      competition: data.competition || null,
    }) as Promise<any>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      setShowModal(false);
      setForm({ opponent: "", date: new Date().toISOString().slice(0, 10), time: "", venue: "", homeAway: "home", competition: "" });
    },
  });

  const deleteMatchMutation = useMutation({
    mutationFn: (id: string) => dbDeleteMatch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      setConfirmingId(null);
    },
  });

  const allMatches = matchesQ.data || [];

  const filtered = useMemo(() => {
    if (activeFilter === "all") return allMatches;
    return allMatches.filter(m => detectCompType(m.competition) === activeFilter);
  }, [allMatches, activeFilter]);

  const sortedMatches = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === "date") {
      arr.sort((a, b) => sortDir === "desc"
        ? (a.date < b.date ? 1 : -1)
        : (a.date > b.date ? 1 : -1));
    } else {
      const order: Record<string, number> = { campionato: 0, coppa: 1, amichevole: 2 };
      arr.sort((a, b) => {
        const ta = order[detectCompType(a.competition)] ?? 3;
        const tb = order[detectCompType(b.competition)] ?? 3;
        if (ta !== tb) return sortDir === "asc" ? ta - tb : tb - ta;
        return a.date < b.date ? 1 : -1;
      });
    }
    return arr;
  }, [filtered, sortBy, sortDir]);

  const groups = useMemo(() => {
    if (sortBy === "type") {
      const typeLabels: Record<string, { it: string; en: string }> = {
        campionato: { it: "Campionato", en: "League" },
        coppa: { it: "Coppa", en: "Cup" },
        amichevole: { it: "Amichevole", en: "Friendly" },
      };
      const result: { key: string; label: string; items: Match[] }[] = [];
      sortedMatches.forEach(m => {
        const key = detectCompType(m.competition);
        const lbl = typeLabels[key];
        let g = result.find(x => x.key === key);
        if (!g) { g = { key, label: t(lbl.it, lbl.en), items: [] }; result.push(g); }
        g.items.push(m);
      });
      return result;
    }

    const months = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
    const result: { key: string; label: string; items: Match[] }[] = [];
    sortedMatches.forEach(m => {
      const [y, mo] = m.date.split("-");
      const key = `${y}-${mo}`;
      const label = `${months[parseInt(mo) - 1]} ${y}`;
      let g = result.find(x => x.key === key);
      if (!g) { g = { key, label, items: [] }; result.push(g); }
      g.items.push(m);
    });
    return result;
  }, [sortedMatches, sortBy]);

  const counts = useMemo(() => {
    const ct: Record<CompType, number> = { all: allMatches.length, campionato: 0, coppa: 0, amichevole: 0 };
    allMatches.forEach(m => { ct[detectCompType(m.competition)]++; });
    return ct;
  }, [allMatches]);

  const COMP_TYPE_COLORS: Record<Exclude<CompType, "all">, string> = {
    campionato: c.primary,
    coppa: "#f59e0b",
    amichevole: c.accent,
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>{t("Calendario", "Calendar")}</Text>
          <Text style={s.count}>{sortedMatches.length} {t("partite", "matches")}</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowModal(true)}>
          <Plus color={c.bg} size={20} weight="bold" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll} contentContainerStyle={s.tabsContent}>
        {FILTER_TABS.map(tab => {
          const isActive = activeFilter === tab.key;
          const color = tab.key === "all" ? c.text : COMP_TYPE_COLORS[tab.key as Exclude<CompType,"all">];
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.tab, isActive && { borderColor: color, backgroundColor: color + "18" }]}
              onPress={() => setActiveFilter(tab.key)}
              activeOpacity={0.75}
            >
              <Text style={[s.tabTxt, isActive && { color }]}>{t(tab.it, tab.en)}</Text>
              {counts[tab.key] > 0 && (
                <View style={[s.tabBadge, isActive && { backgroundColor: color }]}>
                  <Text style={[s.tabBadgeTxt, isActive && { color: "#fff" }]}>{counts[tab.key]}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={s.sortBar}>
        <TouchableOpacity
          style={[s.sortBtn, sortBy === "date" && s.sortBtnActive]}
          onPress={() => {
            if (sortBy === "date") setSortDir(d => d === "desc" ? "asc" : "desc");
            else setSortBy("date");
          }}
        >
          {sortDir === "desc" && sortBy === "date"
            ? <SortDescending color={sortBy === "date" ? c.primary : c.textDim} size={14} weight="bold" />
            : <SortAscending color={sortBy === "date" ? c.primary : c.textDim} size={14} weight="bold" />
          }
          <Text style={[s.sortTxt, sortBy === "date" && { color: c.primary }]}>{t("Data", "Date")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.sortBtn, sortBy === "type" && s.sortBtnActive]}
          onPress={() => {
            if (sortBy === "type") setSortDir(d => d === "desc" ? "asc" : "desc");
            else setSortBy("type");
          }}
        >
          {sortDir === "desc" && sortBy === "type"
            ? <SortDescending color={sortBy === "type" ? c.primary : c.textDim} size={14} weight="bold" />
            : <SortAscending color={sortBy === "type" ? c.primary : c.textDim} size={14} weight="bold" />
          }
          <Text style={[s.sortTxt, sortBy === "type" && { color: c.primary }]}>{t("Tipo", "Type")}</Text>
        </TouchableOpacity>
      </View>

      {matchesQ.isLoading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {sortedMatches.length === 0 ? (
            <View style={s.empty}>
              <CalendarBlank color={c.textDim} size={48} weight="thin" />
              <Text style={s.emptyText}>
                {activeFilter === "all"
                  ? t("Nessuna partita ancora", "No matches yet")
                  : t("Nessuna partita in questa categoria", "No matches in this category")}
              </Text>
              <Text style={s.emptySub}>{t("Tocca + per aggiungere", "Tap + to add")}</Text>
            </View>
          ) : (
            groups.map(g => (
              <View key={g.key}>
                <View style={s.groupHeader}>
                  <Text style={s.monthLabel}>{g.label}</Text>
                  {sortBy === "type" && g.key !== "all" && (
                    <View style={[s.typeIndicator, { backgroundColor: COMP_TYPE_COLORS[g.key as Exclude<CompType,"all">] + "22", borderColor: COMP_TYPE_COLORS[g.key as Exclude<CompType,"all">] + "55" }]}>
                      <Text style={[s.typeIndicatorTxt, { color: COMP_TYPE_COLORS[g.key as Exclude<CompType,"all">] }]}>{g.items.length}</Text>
                    </View>
                  )}
                </View>
                {g.items.map(match => {
                  const isConf = confirmingId === match.id;
                  const result = matchResult(match);
                  const haScore = match.goalsFor != null && match.goalsAgainst != null;
                  const compType = detectCompType(match.competition);
                  return (
                    <TouchableOpacity
                      key={match.id}
                      style={[s.card, isConf && s.cardConf]}
                      onPress={() => {
                        if (isConf) setConfirmingId(null);
                        else router.push(`/match/${match.id}?from=calendar` as any);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={s.cardLeft}>
                        <View style={s.dateBox}>
                          <Text style={s.dateDay}>{match.date.split("-")[2]}</Text>
                          <Text style={s.dateMon}>
                            {["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"][parseInt(match.date.split("-")[1]) - 1]}
                          </Text>
                        </View>
                        <View style={s.info}>
                          <View style={s.opponentRow}>
                            <Text style={s.opponent} numberOfLines={1}>{t("vs", "vs")} {match.opponent}</Text>
                            {result && (
                              <View style={[s.resultBadge, { backgroundColor: RESULT_COLORS[result] + "25", borderColor: RESULT_COLORS[result] + "60" }]}>
                                <Text style={[s.resultText, { color: RESULT_COLORS[result] }]}>{result}</Text>
                              </View>
                            )}
                          </View>
                          <View style={s.metaRow}>
                            <View style={[s.haBadge, { borderColor: HOME_AWAY_COLORS[match.homeAway] + "60" }]}>
                              <Text style={[s.haText, { color: HOME_AWAY_COLORS[match.homeAway] }]}>
                                {t(HOME_AWAY_LABELS[match.homeAway].it, HOME_AWAY_LABELS[match.homeAway].en)}
                              </Text>
                            </View>
                            {match.competition ? (
                              <View style={[s.compBadge, { borderColor: COMP_TYPE_COLORS[compType as Exclude<CompType,"all">] + "55" }]}>
                                <Text style={[s.compBadgeTxt, { color: COMP_TYPE_COLORS[compType as Exclude<CompType,"all">] }]} numberOfLines={1}>
                                  {match.competition}
                                </Text>
                              </View>
                            ) : (
                              <View style={[s.compBadge, { borderColor: c.border }]}>
                                <Text style={[s.compBadgeTxt, { color: c.textDim }]}>{t("Amichevole", "Friendly")}</Text>
                              </View>
                            )}
                            {match.time && <Text style={s.timeText}>{match.time}</Text>}
                          </View>
                          {haScore && (
                            <Text style={s.score}>{match.goalsFor} – {match.goalsAgainst}</Text>
                          )}
                        </View>
                      </View>
                      <View style={s.cardRight}>
                        {isConf ? (
                          <View style={s.confirmBtns}>
                            <TouchableOpacity style={[s.iconBtn, s.cancelBtn]} onPress={() => setConfirmingId(null)}>
                              <X color={c.textMuted} size={14} weight="bold" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[s.iconBtn, s.delBtn]}
                              onPress={() => deleteMatchMutation.mutate(match.id)}
                              disabled={deleteMatchMutation.isPending}
                            >
                              {deleteMatchMutation.isPending && deleteMatchMutation.variables === match.id
                                ? <ActivityIndicator size={12} color="#fff" />
                                : <Check color="#fff" size={14} weight="bold" />}
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={s.cardActions}>
                            <TouchableOpacity onPress={(e) => { e.stopPropagation(); setConfirmingId(match.id); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Trash color={c.danger} size={18} weight="fill" />
                            </TouchableOpacity>
                            <CaretRight color={c.textDim} size={16} />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{t("Nuova Partita", "New Match")}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X color={c.textMuted} size={22} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>{t("Avversario *", "Opponent *")}</Text>
              <TextInput style={s.input} placeholder={t("es. Juventus", "e.g. Juventus")} placeholderTextColor={c.textDim} value={form.opponent} onChangeText={v => setForm(f => ({ ...f, opponent: v }))} />

              <Text style={s.label}>{t("Data *", "Date *")}</Text>
              <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor={c.textDim} value={form.date} onChangeText={v => setForm(f => ({ ...f, date: v }))} />

              <Text style={s.label}>{t("Orario", "Time")}</Text>
              <TextInput style={s.input} placeholder="15:00" placeholderTextColor={c.textDim} value={form.time} onChangeText={v => setForm(f => ({ ...f, time: v }))} />

              <Text style={s.label}>{t("Campo / Stadio", "Venue")}</Text>
              <TextInput style={s.input} placeholder={t("es. Stadio Comunale", "e.g. City Stadium")} placeholderTextColor={c.textDim} value={form.venue} onChangeText={v => setForm(f => ({ ...f, venue: v }))} />

              <Text style={s.label}>{t("Competizione", "Competition")}</Text>
              <TextInput style={s.input} placeholder={t("es. Serie A, Coppa Italia...", "e.g. League, Cup...")} placeholderTextColor={c.textDim} value={form.competition} onChangeText={v => setForm(f => ({ ...f, competition: v }))} />

              <View style={s.quickComps}>
                {[
                  { label: t("Campionato", "League"), val: "Campionato" },
                  { label: t("Coppa", "Cup"), val: "Coppa" },
                  { label: t("Amichevole", "Friendly"), val: "Amichevole" },
                ].map(q => (
                  <TouchableOpacity
                    key={q.val}
                    style={[s.quickPill, form.competition === q.val && s.quickPillActive]}
                    onPress={() => setForm(f => ({ ...f, competition: f.competition === q.val ? "" : q.val }))}
                  >
                    <Text style={[s.quickPillTxt, form.competition === q.val && { color: c.primary }]}>{q.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>{t("Casa / Trasferta", "Home / Away")}</Text>
              <View style={s.segRow}>
                {(["home", "away", "neutral"] as const).map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[s.seg, form.homeAway === opt && s.segActive]}
                    onPress={() => setForm(f => ({ ...f, homeAway: opt }))}
                  >
                    <Text style={[s.segTxt, form.homeAway === opt && s.segTxtActive]}>
                      {t(HOME_AWAY_LABELS[opt].it, HOME_AWAY_LABELS[opt].en)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[s.saveBtn, (!form.opponent || !form.date) && s.saveBtnDis]}
                onPress={() => createMatchMutation.mutate(form)}
                disabled={!form.opponent || !form.date || createMatchMutation.isPending}
              >
                {createMatchMutation.isPending
                  ? <ActivityIndicator color={c.bg} />
                  : <Text style={s.saveTxt}>{t("Crea Partita", "Create Match")}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function mkStyles(c: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingBottom: 10 },
    title: { fontSize: 24, fontWeight: "800", color: c.text },
    count: { fontSize: 12, color: c.textDim, marginTop: 2 },
    addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" },
    tabsScroll: { flexGrow: 0 },
    tabsContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: "row" },
    tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.bgCard },
    tabTxt: { fontSize: 13, fontWeight: "700", color: c.textDim },
    tabBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
    tabBadgeTxt: { fontSize: 10, fontWeight: "800", color: c.textDim },
    sortBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
    sortBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: c.border },
    sortBtnActive: { borderColor: c.primary + "60", backgroundColor: c.primary + "10" },
    sortTxt: { fontSize: 12, fontWeight: "700", color: c.textDim },
    list: { paddingHorizontal: 16, paddingBottom: 20 },
    empty: { alignItems: "center", paddingTop: 80, gap: 12 },
    emptyText: { fontSize: 16, fontWeight: "700", color: c.textMuted },
    emptySub: { fontSize: 13, color: c.textDim },
    groupHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, marginBottom: 8, marginLeft: 4 },
    monthLabel: { fontSize: 11, fontWeight: "800", color: c.textDim, textTransform: "uppercase", letterSpacing: 1.2 },
    typeIndicator: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    typeIndicatorTxt: { fontSize: 10, fontWeight: "800" },
    card: { flexDirection: "row", alignItems: "center", backgroundColor: c.bgCard, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
    cardConf: { borderColor: c.danger + "60", backgroundColor: c.danger + "08" },
    cardLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
    dateBox: { width: 42, alignItems: "center", backgroundColor: c.border, borderRadius: 10, paddingVertical: 6 },
    dateDay: { fontSize: 18, fontWeight: "800", color: c.text },
    dateMon: { fontSize: 10, fontWeight: "600", color: c.textDim, textTransform: "uppercase" },
    info: { flex: 1 },
    opponentRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
    opponent: { fontSize: 15, fontWeight: "700", color: c.text, flex: 1 },
    resultBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    resultText: { fontSize: 10, fontWeight: "800" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    haBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    haText: { fontSize: 10, fontWeight: "700" },
    compBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, maxWidth: 110 },
    compBadgeTxt: { fontSize: 10, fontWeight: "700" },
    timeText: { fontSize: 11, color: c.textMuted },
    score: { marginTop: 4, fontSize: 16, fontWeight: "800", color: c.accent },
    cardRight: { paddingRight: 12 },
    cardActions: { flexDirection: "row", alignItems: "center", gap: 12 },
    confirmBtns: { flexDirection: "row", gap: 8 },
    iconBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    cancelBtn: { backgroundColor: c.border },
    delBtn: { backgroundColor: c.danger },
    overlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
    modalBox: { backgroundColor: c.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "90%" },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: "800", color: c.text },
    label: { fontSize: 12, fontWeight: "700", color: c.textDim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6, marginTop: 14 },
    input: { backgroundColor: c.bg, borderRadius: 10, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, paddingVertical: 10, color: c.text, fontSize: 16 },
    quickComps: { flexDirection: "row", gap: 8, marginTop: 8 },
    quickPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: c.border },
    quickPillActive: { borderColor: c.primary, backgroundColor: c.primary + "18" },
    quickPillTxt: { fontSize: 12, fontWeight: "700", color: c.textDim },
    segRow: { flexDirection: "row", gap: 8 },
    seg: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: "center" },
    segActive: { borderColor: c.primary, backgroundColor: c.primary + "18" },
    segTxt: { fontSize: 13, color: c.textDim, fontWeight: "600" },
    segTxtActive: { color: c.primary },
    saveBtn: { marginTop: 24, backgroundColor: c.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 8 },
    saveBtnDis: { opacity: 0.4 },
    saveTxt: { fontSize: 15, fontWeight: "800", color: c.bg },
  });
}
