import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "../../lib/themeStore";
import { useI18n } from "../../lib/i18n";
import { useProfile } from "../../lib/profile";
import { Lightning, Users, BookOpen, Timer, Clipboard, GearSix, CalendarBlank, CaretRight } from "phosphor-react-native";
import { StatusBar } from "expo-status-bar";
import SettingsModal from "../../components/SettingsModal";
import type { ThemeColors } from "../../lib/themeStore";
import { getPlayers, getSessions, getExercises, getMatches } from "../../lib/db/queries";

type Match = {
  id: string;
  opponent: string;
  date: string;
  time?: string | null;
  venue?: string | null;
  homeAway: string;
  competition?: string | null;
  goalsFor?: number | null;
  goalsAgainst?: number | null;
};

const HOME_AWAY_LABELS: Record<string, { it: string; en: string }> = {
  home: { it: "Casa", en: "Home" },
  away: { it: "Trasferta", en: "Away" },
  neutral: { it: "Neutro", en: "Neutral" },
};

function matchResult(m: Match) {
  if (m.goalsFor == null && m.goalsAgainst == null) return null;
  const gf = m.goalsFor ?? 0;
  const ga = m.goalsAgainst ?? 0;
  if (gf > ga) return "W";
  if (gf < ga) return "L";
  return "D";
}

function matchScore(m: Match) {
  if (m.goalsFor == null && m.goalsAgainst == null) return null;
  const gf = m.goalsFor != null ? m.goalsFor : "–";
  const ga = m.goalsAgainst != null ? m.goalsAgainst : "–";
  return `${gf} – ${ga}`;
}

const MONTHS_IT = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

function formatDate(date: string) {
  const [, mo, dd] = date.split("-");
  return `${parseInt(dd)} ${MONTHS_IT[parseInt(mo) - 1]}`;
}

function isToday(date: string) {
  return date === new Date().toISOString().slice(0, 10);
}

export default function HomeScreen() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const profile = useProfile();
  const c = useTheme((s) => s.colors);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const s = useMemo(() => mkStyles(c), [c]);

  const HOME_AWAY_COLORS: Record<string, string> = {
    home: c.primary,
    away: c.accent,
    neutral: c.textMuted,
  };
  const RESULT_COLORS: Record<string, string> = { W: c.primary, D: c.accent, L: c.danger };

  useEffect(() => { profile.load(); }, []);

  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => getSessions() });
  const players = useQuery({ queryKey: ["players"], queryFn: () => getPlayers() });
  const exercises = useQuery({ queryKey: ["exercises"], queryFn: () => getExercises() });
  const matchesQ = useQuery<Match[]>({ queryKey: ["matches"], queryFn: () => getMatches() as Promise<Match[]> });

  const today = new Date().toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const recentSessions = (sessions.data as any[] || []).slice(0, 3);
  const activeTeam = profile.activeTeam();
  const coachName = profile.displayName();

  const allMatches = matchesQ.data || [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingMatches = allMatches.filter(m => m.date >= todayStr).sort((a, b) => a.date > b.date ? 1 : -1);
  const pastMatches = allMatches.filter(m => m.date < todayStr).sort((a, b) => a.date < b.date ? 1 : -1);
  const nextMatch = upcomingMatches[0] ?? null;
  const lastMatch = pastMatches[0] ?? null;

  const record = pastMatches.reduce(
    (acc, m) => {
      const r = matchResult(m);
      if (r === "W") acc.w++;
      else if (r === "D") acc.d++;
      else if (r === "L") acc.l++;
      return acc;
    },
    { w: 0, d: 0, l: 0 }
  );

  const quickActions = [
    { icon: <Lightning color={c.accent} size={28} weight="fill" />, label: t('Genera Seduta', 'Generate'), onPress: () => router.push('/(tabs)/generator') },
    { icon: <BookOpen color={c.primary} size={28} weight="fill" />, label: t('Libreria', 'Library'), onPress: () => router.push('/(tabs)/library') },
    { icon: <Users color={c.tecnica} size={28} weight="fill" />, label: t('Rosa', 'Roster'), onPress: () => router.push('/(tabs)/roster') },
    { icon: <Timer color={c.riscaldamento} size={28} weight="fill" />, label: t('Timer', 'Timer'), onPress: () => router.push('/timer') },
  ];

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <StatusBar style="auto" />
      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            {activeTeam?.logoUri
              ? <Image source={{ uri: activeTeam.logoUri }} style={s.teamLogo} />
              : <Image source={require('../../assets/logo.png')} style={s.appLogo} resizeMode="contain" />}
            <View style={s.headerTexts}>
              {activeTeam && <Text style={s.teamName} numberOfLines={1}>{activeTeam.name}{activeTeam.season ? ` · ${activeTeam.season}` : ''}</Text>}
              {coachName ? <Text style={s.coachName}>Mister {coachName}</Text> : null}
              <Text style={s.date}>{today}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.settingsBtn} onPress={() => setSettingsOpen(true)}>
            <GearSix color={c.textMuted} size={22} weight="bold" />
          </TouchableOpacity>
        </View>

        <View style={s.statsRow}>
          {[
            { num: (players.data as any[] || []).length, label: t('Giocatori', 'Players') },
            { num: (exercises.data as any[] || []).length, label: t('Esercizi', 'Exercises') },
            { num: (sessions.data as any[] || []).length, label: t('Sedute', 'Sessions') },
            { num: allMatches.length, label: t('Partite', 'Matches') },
          ].map((item, i) => (
            <View key={i} style={s.statCard}>
              <Text style={s.statNum}>{item.num}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Matches card */}
        <TouchableOpacity style={s.matchesCard} onPress={() => router.push('/(tabs)/calendar')} activeOpacity={0.8}>
          <View style={s.matchesCardHeader}>
            <View style={s.matchesCardTitleRow}>
              <CalendarBlank color={c.primary} size={20} weight="fill" />
              <Text style={s.matchesCardTitle}>{t('Partite', 'Matches')}</Text>
            </View>
            <View style={s.matchesCardRight}>
              {allMatches.length > 0 && (
                <View style={s.recordRow}>
                  <Text style={[s.recordItem, { color: c.primary }]}>{record.w}V</Text>
                  <Text style={[s.recordDot, { color: c.textDim }]}> · </Text>
                  <Text style={[s.recordItem, { color: c.accent }]}>{record.d}P</Text>
                  <Text style={[s.recordDot, { color: c.textDim }]}> · </Text>
                  <Text style={[s.recordItem, { color: c.danger }]}>{record.l}S</Text>
                </View>
              )}
              <CaretRight color={c.textDim} size={16} />
            </View>
          </View>

          {allMatches.length === 0 ? (
            <View style={s.matchesEmpty}>
              <Text style={s.matchesEmptyTxt}>{t('Nessuna partita programmata', 'No matches scheduled')}</Text>
            </View>
          ) : (
            <View style={s.matchesSplit}>
              <View style={[s.matchHalf, { borderRightWidth: 1, borderRightColor: c.border }]}>
                <Text style={s.matchHalfLabel}>{t('Prossima', 'Next')}</Text>
                {nextMatch ? (
                  <View style={s.matchInfo}>
                    <Text style={s.matchDate}>
                      {isToday(nextMatch.date) ? t('Oggi', 'Today') : formatDate(nextMatch.date)}
                    </Text>
                    <Text style={s.matchOpponent} numberOfLines={1}>vs {nextMatch.opponent}</Text>
                    <View style={s.matchMeta}>
                      <View style={[s.haBadge, { borderColor: HOME_AWAY_COLORS[nextMatch.homeAway] + "55" }]}>
                        <Text style={[s.haText, { color: HOME_AWAY_COLORS[nextMatch.homeAway] }]}>
                          {t(HOME_AWAY_LABELS[nextMatch.homeAway].it, HOME_AWAY_LABELS[nextMatch.homeAway].en)}
                        </Text>
                      </View>
                      {nextMatch.time && <Text style={s.matchTime}>{nextMatch.time}</Text>}
                    </View>
                    {nextMatch.competition && (
                      <Text style={s.matchComp} numberOfLines={1}>{nextMatch.competition}</Text>
                    )}
                  </View>
                ) : (
                  <Text style={s.matchNone}>{t('Nessuna', 'None')}</Text>
                )}
              </View>

              <View style={s.matchHalf}>
                <Text style={s.matchHalfLabel}>{t('Ultima', 'Last')}</Text>
                {lastMatch ? (
                  <View style={s.matchInfo}>
                    <Text style={s.matchDate}>{formatDate(lastMatch.date)}</Text>
                    <Text style={s.matchOpponent} numberOfLines={1}>vs {lastMatch.opponent}</Text>
                    {matchScore(lastMatch) ? (
                      <View style={s.scoreRow}>
                        {matchResult(lastMatch) && (
                          <View style={[s.resultBadge, { backgroundColor: RESULT_COLORS[matchResult(lastMatch)!] + "20", borderColor: RESULT_COLORS[matchResult(lastMatch)!] + "55" }]}>
                            <Text style={[s.resultTxt, { color: RESULT_COLORS[matchResult(lastMatch)!] }]}>{matchResult(lastMatch)}</Text>
                          </View>
                        )}
                        <Text style={s.scoreText}>{matchScore(lastMatch)}</Text>
                      </View>
                    ) : (
                      <Text style={s.matchNone}>{t('Senza risultato', 'No result')}</Text>
                    )}
                    {lastMatch.competition && (
                      <Text style={s.matchComp} numberOfLines={1}>{lastMatch.competition}</Text>
                    )}
                  </View>
                ) : (
                  <Text style={s.matchNone}>{t('Nessuna', 'None')}</Text>
                )}
              </View>
            </View>
          )}

          {upcomingMatches.length > 1 && (
            <View style={s.upcomingStrip}>
              <Text style={s.upcomingTxt}>+{upcomingMatches.length - 1} {t('partite in programma', 'upcoming matches')}</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={s.sectionTitle}>{t('Azioni Rapide', 'Quick Actions')}</Text>
        <View style={s.actionsGrid}>
          {quickActions.map((a, i) => (
            <TouchableOpacity key={i} style={s.actionBtn} onPress={a.onPress} activeOpacity={0.7}>
              {a.icon}
              <Text style={s.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={s.fieldCard} onPress={() => router.push({ pathname: '/tactical', params: { from: 'home' } } as any)} activeOpacity={0.8}>
          <View style={s.fieldInner}>
            <Clipboard color={c.accent} size={32} weight="fill" />
            <View style={{ marginLeft: 14 }}>
              <Text style={s.fieldTitle}>{t('Campo Tattico', 'Tactical Board')}</Text>
              <Text style={s.fieldSub}>{t('Disegna schemi e movimenti', 'Draw formations and movements')}</Text>
            </View>
          </View>
        </TouchableOpacity>

        <Text style={s.sectionTitle}>{t('Sedute Recenti', 'Recent Sessions')}</Text>
        {sessions.isLoading ? <ActivityIndicator color={c.primary} /> : recentSessions.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>{t('Nessuna seduta salvata', 'No saved sessions')}</Text>
            <Text style={s.emptySub}>{t('Genera la tua prima seduta!', 'Generate your first session!')}</Text>
          </View>
        ) : recentSessions.map((sess: any) => (
          <TouchableOpacity key={sess.id} style={s.sessionCard} onPress={() => router.push(`/session/${sess.id}` as any)} activeOpacity={0.8}>
            <Text style={s.sessionTitle}>{sess.title}</Text>
            <Text style={s.sessionDate}>{sess.date} · {sess.duration ? `${sess.duration} min` : ''}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function mkStyles(c: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    scroll: { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 14 },
    appLogo: { width: 52, height: 52, borderRadius: 12 },
    teamLogo: { width: 52, height: 52, borderRadius: 12, borderWidth: 1, borderColor: c.border },
    headerTexts: { flex: 1, justifyContent: 'center' },
    teamName: { fontSize: 13, fontWeight: '700', color: c.primary, marginBottom: 1 },
    coachName: { fontSize: 15, fontWeight: '800', color: c.text, marginBottom: 2 },
    date: { fontSize: 12, color: c.textMuted, textTransform: 'capitalize' },
    settingsBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    statCard: { flex: 1, backgroundColor: c.bgCard, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: c.border },
    statNum: { fontSize: 22, fontWeight: '800', color: c.primary },
    statLabel: { fontSize: 10, color: c.textMuted, marginTop: 2, textAlign: 'center' },
    matchesCard: { backgroundColor: c.bgCard, borderRadius: 18, marginBottom: 24, borderWidth: 1, borderColor: c.primary + "30", overflow: "hidden" },
    matchesCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: c.border },
    matchesCardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    matchesCardTitle: { fontSize: 15, fontWeight: "800", color: c.text },
    matchesCardRight: { flexDirection: "row", alignItems: "center", gap: 10 },
    recordRow: { flexDirection: "row", alignItems: "center" },
    recordItem: { fontSize: 12, fontWeight: "800" },
    recordDot: { fontSize: 12 },
    matchesEmpty: { padding: 20, alignItems: "center" },
    matchesEmptyTxt: { fontSize: 13, color: c.textDim },
    matchesSplit: { flexDirection: "row" },
    matchHalf: { flex: 1, padding: 14 },
    matchHalfLabel: { fontSize: 10, fontWeight: "800", color: c.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
    matchInfo: { gap: 4 },
    matchDate: { fontSize: 13, fontWeight: "800", color: c.primary },
    matchOpponent: { fontSize: 14, fontWeight: "700", color: c.text },
    matchMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
    haBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    haText: { fontSize: 10, fontWeight: "700" },
    matchTime: { fontSize: 11, color: c.textDim },
    matchComp: { fontSize: 11, color: c.textDim },
    matchNone: { fontSize: 12, color: c.textDim, marginTop: 4 },
    scoreRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    resultBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    resultTxt: { fontSize: 11, fontWeight: "800" },
    scoreText: { fontSize: 16, fontWeight: "800", color: c.accent },
    upcomingStrip: { backgroundColor: c.primary + "12", borderTopWidth: 1, borderTopColor: c.primary + "25", paddingVertical: 8, paddingHorizontal: 16 },
    upcomingTxt: { fontSize: 12, fontWeight: "700", color: c.primary, textAlign: "center" },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 12, letterSpacing: 0.2 },
    actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
    actionBtn: { width: '47%', borderRadius: 16, padding: 18, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCardAlt },
    actionLabel: { fontSize: 13, fontWeight: '600', color: c.text, textAlign: 'center' },
    fieldCard: { backgroundColor: c.bgCard, borderRadius: 16, padding: 20, marginBottom: 28, borderWidth: 1, borderColor: c.accent + '40' },
    fieldInner: { flexDirection: 'row', alignItems: 'center' },
    fieldTitle: { fontSize: 16, fontWeight: '700', color: c.text },
    fieldSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    emptyCard: { backgroundColor: c.bgCard, borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: c.border },
    emptyText: { fontSize: 15, color: c.textMuted, fontWeight: '600' },
    emptySub: { fontSize: 12, color: c.textDim, marginTop: 4 },
    sessionCard: { backgroundColor: c.bgCard, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: c.border },
    sessionTitle: { fontSize: 15, fontWeight: '700', color: c.text },
    sessionDate: { fontSize: 12, color: c.textMuted, marginTop: 4 },
  });
}
