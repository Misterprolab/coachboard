import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { categoryColors, categoryLabels } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { ArrowLeft, Timer, CalendarBlank, Note, Trash, X, Check, FilePdf } from "phosphor-react-native";
import { useState, useMemo } from "react";
import { useTheme } from "../../lib/themeStore";
import type { ThemeColors } from "../../lib/themeStore";
import { getSessionWithExercises, deleteSession as dbDeleteSession } from "../../lib/db/queries";
import { exportSessionPdf } from "../../lib/pdfExport";
import { useProfile } from "../../lib/profile";

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const c = useTheme((s) => s.colors);
  const s = useMemo(() => mkStyles(c), [c]);
  const profile = useProfile();

  const session = useQuery({
    queryKey: ["session", id],
    queryFn: () => getSessionWithExercises(id!) as Promise<any>,
    enabled: !!id,
  });

  const deleteSession = useMutation({
    mutationFn: () => dbDeleteSession(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      router.replace('/(tabs)' as any);
    },
  });

  if (session.isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
        <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const data = session.data as any;
  if (!data) {
    return (
      <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
        <Text style={s.error}>{t('Seduta non trovata', 'Session not found')}</Text>
      </SafeAreaView>
    );
  }

  const exercises: any[] = data.exercises || [];
  const totalDuration = exercises.reduce((sum: number, e: any) => sum + ((e.customDuration || e.exercise?.duration) || 0), 0);

  const handleExportPdf = () => {
    const team = profile.activeTeam?.();
    exportSessionPdf(
      {
        teamName: team?.name || "MisterProLab",
        logoUrl: team?.logoUri,
        title: "Seduta di Allenamento",
        subtitle: data.title,
      },
      {
        title: data.title,
        date: data.date,
        duration: data.duration || totalDuration,
        notes: data.notes,
        exercises: exercises
          .sort((a: any, b: any) => a.order - b.order)
          .map((e: any) => ({
            order: e.order,
            name: lang === "it" ? e.exercise.name : (e.exercise.nameEn || e.exercise.name),
            category: e.exercise.category,
            categoryLabel: (categoryLabels[e.exercise.category]?.it || e.exercise.category),
            categoryColor: (categoryColors[e.exercise.category] || "#0E5A3C"),
            duration: e.customDuration || e.exercise.duration,
            notes: e.notes,
          })),
      }
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)' as any)} style={s.back}>
          <ArrowLeft color={c.text} size={24} />
        </TouchableOpacity>
        <Text numberOfLines={1} style={s.pageTitle}>{t('Dettaglio Seduta', 'Session Detail')}</Text>

        {!confirmDelete && (
          <TouchableOpacity onPress={handleExportPdf} style={s.pdfBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FilePdf color="#D4AF37" size={22} weight="fill" />
          </TouchableOpacity>
        )}
        {confirmDelete ? (
          <View style={s.confirmRow}>
            <TouchableOpacity onPress={() => setConfirmDelete(false)} style={[s.actionBtn, s.cancelBtn]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color={c.textMuted} size={15} weight="bold" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => deleteSession.mutate()}
              style={[s.actionBtn, s.confirmBtn]}
              disabled={deleteSession.isPending}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {deleteSession.isPending
                ? <ActivityIndicator size={12} color="#fff" />
                : <Check color="#fff" size={15} weight="bold" />}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setConfirmDelete(true)} style={s.trashBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Trash color={c.danger} size={22} weight="fill" />
          </TouchableOpacity>
        )}
      </View>

      {confirmDelete && (
        <View style={s.confirmBanner}>
          <Text style={s.confirmBannerText}>{t('Eliminare questa seduta?', 'Delete this session?')}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>{data.title}</Text>

        <View style={s.metaRow}>
          <View style={s.metaItem}>
            <CalendarBlank color={c.textDim} size={15} />
            <Text style={s.metaText}>{data.date}</Text>
          </View>
          <View style={s.metaItem}>
            <Timer color={c.primary} size={15} />
            <Text style={s.metaText}>{data.duration || totalDuration} min</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaText}>{exercises.length} {t('esercizi', 'exercises')}</Text>
          </View>
        </View>

        {data.notes && (
          <View style={s.notesCard}>
            <Note color={c.accent} size={16} />
            <Text style={s.notesText}>{data.notes}</Text>
          </View>
        )}

        <Text style={s.sectionTitle}>{t('Programma', 'Programme')}</Text>

        {exercises.length === 0 ? (
          <Text style={s.empty}>{t('Nessun esercizio in questa seduta', 'No exercises in this session')}</Text>
        ) : (
          exercises
            .sort((a: any, b: any) => a.order - b.order)
            .map((item: any, idx: number) => {
              const ex = item.exercise;
              if (!ex) return null;
              const catColor = categoryColors[ex.category] || c.primary;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={s.exCard}
                  onPress={() => router.push(`/exercise/${ex.id}` as any)}
                  activeOpacity={0.8}
                >
                  <View style={s.exNum}>
                    <Text style={s.exNumText}>{idx + 1}</Text>
                  </View>
                  <View style={s.exBody}>
                    <View style={s.exTop}>
                      <Text style={s.exName}>{lang === 'it' ? ex.name : (ex.nameEn || ex.name)}</Text>
                    </View>
                    <View style={[s.catBadge, { borderColor: catColor }]}>
                      <Text style={[s.catText, { color: catColor }]}>
                        {lang === 'it' ? categoryLabels[ex.category]?.it : categoryLabels[ex.category]?.en}
                      </Text>
                    </View>
                    <View style={s.exMeta}>
                      <Text style={s.exMetaText}>⏱ {item.customDuration || ex.duration} min</Text>
                      {item.notes && <Text style={s.exNotes} numberOfLines={1}>{item.notes}</Text>}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
        )}

        {exercises.length > 0 && (
          <View style={s.totalCard}>
            <Timer color={c.primary} size={20} weight="fill" />
            <Text style={s.totalText}>
              {t('Durata totale seduta: ', 'Total session duration: ')}
              <Text style={s.totalBold}>{data.duration || totalDuration} min</Text>
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function mkStyles(c: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    topBar: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 10, gap: 12 },
    back: { padding: 4 },
    pageTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: c.textMuted },
    trashBtn: { padding: 4 },
    pdfBtn: { padding: 4 },
    confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    actionBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    cancelBtn: { backgroundColor: c.border },
    confirmBtn: { backgroundColor: c.danger },
    confirmBanner: { marginHorizontal: 20, marginBottom: 4, backgroundColor: c.danger + '15', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: c.danger + '40' },
    confirmBannerText: { fontSize: 13, fontWeight: '700', color: c.danger, textAlign: 'center' },
    content: { padding: 20, paddingBottom: 60 },
    title: { fontSize: 24, fontWeight: '800', color: c.text, marginBottom: 12 },
    metaRow: { flexDirection: 'row', gap: 16, marginBottom: 16, flexWrap: 'wrap' },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { fontSize: 13, color: c.textMuted },
    notesCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: c.bgCard, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: c.accent + '30' },
    notesText: { flex: 1, fontSize: 13, color: c.textMuted, lineHeight: 18 },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: c.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },
    empty: { color: c.textDim, fontStyle: 'italic' },
    exCard: { flexDirection: 'row', backgroundColor: c.bgCard, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: c.border, gap: 12 },
    exNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.primary + '20', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.primary + '40' },
    exNumText: { fontSize: 13, fontWeight: '800', color: c.primary },
    exBody: { flex: 1 },
    exTop: { marginBottom: 6 },
    exName: { fontSize: 14, fontWeight: '700', color: c.text },
    catBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6 },
    catText: { fontSize: 10, fontWeight: '700' },
    exMeta: { flexDirection: 'row', gap: 10 },
    exMetaText: { fontSize: 11, color: c.textDim },
    exNotes: { fontSize: 11, color: c.textMuted, fontStyle: 'italic' },
    totalCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.bgCard, borderRadius: 14, padding: 16, marginTop: 8, borderWidth: 1, borderColor: c.primary + '30' },
    totalText: { fontSize: 14, color: c.textMuted },
    totalBold: { color: c.primary, fontWeight: '800' },
    error: { color: c.danger, textAlign: 'center', marginTop: 40 },
  });
}
