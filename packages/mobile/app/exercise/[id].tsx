import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { categoryColors, categoryLabels, intensityColors, intensityLabels } from "../../lib/theme";
import { useTheme } from "../../lib/themeStore";
import type { ThemeColors } from "../../lib/themeStore";
import { useI18n } from "../../lib/i18n";
import { ArrowLeft, Timer, Users, Barbell, Tag } from "phosphor-react-native";
import { getExercises } from "../../lib/db/queries";

type Exercise = {
  id: string;
  name: string;
  nameEn?: string | null;
  category: string;
  description: string;
  descriptionEn?: string | null;
  duration: number;
  players?: number | null;
  intensity: string;
  materials?: string | null;
  isCustom?: boolean | null;
};

export default function ExerciseDetailScreen() {
  const c = useTheme((s) => s.colors);
  const s = useMemo(() => mkStyles(c), [c]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useI18n();
  const router = useRouter();

  const exercises = useQuery({
    queryKey: ["exercises"],
    queryFn: () => getExercises() as Promise<Exercise[]>,
  });

  const exercise = (exercises.data || []).find(e => e.id === id);

  if (exercises.isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
        <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!exercise) {
    return (
      <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
        <Text style={s.error}>{t('Esercizio non trovato', 'Exercise not found')}</Text>
      </SafeAreaView>
    );
  }

  const catColor = categoryColors[exercise.category] || c.primary;
  const intColor = intensityColors[exercise.intensity] || c.primary;

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <ArrowLeft color={c.text} size={24} />
        </TouchableOpacity>
        <Text style={s.pageTitle}>{t('Dettaglio Esercizio', 'Exercise Detail')}</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={[s.catBadge, { backgroundColor: catColor + '20', borderColor: catColor }]}>
          <Text style={[s.catBadgeText, { color: catColor }]}>
            {lang === 'it' ? categoryLabels[exercise.category]?.it : categoryLabels[exercise.category]?.en}
          </Text>
        </View>

        <Text style={s.title}>{lang === 'it' ? exercise.name : (exercise.nameEn || exercise.name)}</Text>

        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Timer color={c.primary} size={22} weight="fill" />
            <Text style={s.statVal}>{exercise.duration}</Text>
            <Text style={s.statUnit}>{t('min', 'min')}</Text>
          </View>
          {exercise.players && (
            <View style={s.statBox}>
              <Users color="#3498db" size={22} weight="fill" />
              <Text style={s.statVal}>{exercise.players}+</Text>
              <Text style={s.statUnit}>{t('gioc.', 'players')}</Text>
            </View>
          )}
          <View style={s.statBox}>
            <Barbell color={intColor} size={22} weight="fill" />
            <Text style={[s.statVal, { color: intColor }]}>
              {lang === 'it' ? intensityLabels[exercise.intensity]?.it : intensityLabels[exercise.intensity]?.en}
            </Text>
            <Text style={s.statUnit}>{t('intensità', 'intensity')}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('Descrizione', 'Description')}</Text>
          <Text style={s.desc}>
            {lang === 'it' ? exercise.description : (exercise.descriptionEn || exercise.description)}
          </Text>
        </View>

        {exercise.materials && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('Materiali', 'Materials')}</Text>
            <View style={s.materialRow}>
              <Tag color={c.accent} size={16} />
              <Text style={s.materialText}>{exercise.materials}</Text>
            </View>
          </View>
        )}

        {exercise.isCustom && (
          <View style={s.customBanner}>
            <Text style={s.customBannerText}>{t('Esercizio personalizzato', 'Custom exercise')}</Text>
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
    pageTitle: { fontSize: 16, fontWeight: '700', color: c.textMuted },
    content: { padding: 20, paddingBottom: 60 },
    catBadge: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginBottom: 14 },
    catBadgeText: { fontSize: 12, fontWeight: '700' },
    title: { fontSize: 24, fontWeight: '800', color: c.text, marginBottom: 20, lineHeight: 30 },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
    statBox: { flex: 1, backgroundColor: c.bgCard, borderRadius: 16, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: c.border },
    statVal: { fontSize: 18, fontWeight: '800', color: c.text },
    statUnit: { fontSize: 10, color: c.textDim, textAlign: 'center' },
    section: { backgroundColor: c.bgCard, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: c.border },
    sectionTitle: { fontSize: 12, fontWeight: '700', color: c.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
    desc: { fontSize: 15, color: c.text, lineHeight: 22 },
    materialRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    materialText: { fontSize: 14, color: c.textMuted },
    customBanner: { backgroundColor: c.accent + '20', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: c.accent + '40' },
    customBannerText: { color: c.accent, fontWeight: '600', fontSize: 13 },
    error: { color: c.danger, textAlign: 'center', marginTop: 40 },
  });
}
