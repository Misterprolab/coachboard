import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { categoryColors, categoryLabels, intensityColors, intensityLabels } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { CheckCircle, CircleIcon, Lightning, FloppyDisk, X, WarningCircle, Star, PlusCircle, Trash } from "phosphor-react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../lib/themeStore";
import type { ThemeColors } from "../../lib/themeStore";
import { getExercises, createSession as dbCreateSession, addExerciseToSession } from "../../lib/db/queries";

const CATEGORIES = ['riscaldamento', 'tecnica', 'tattica', 'atletico', 'partitella', 'calci_piazzati', 'portieri'];
const FAV_KEY = 'exercise_favorites_v1';

type Exercise = {
  id: string;
  name: string;
  nameEn?: string | null;
  category: string;
  description: string;
  descriptionEn?: string | null;
  primaryObjective?: string | null;
  secondaryObjectives?: string | null;
  duration: number;
  players?: number | null;
  intensity: string;
  materials?: string | null;
};

type Tab = 'genera' | 'preferiti';

export default function GeneratorScreen() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();
  const c = useTheme((s) => s.colors);
  const s = useMemo(() => mkStyles(c), [c]);

  const [activeTab, setActiveTab] = useState<Tab>('genera');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [currentExs, setCurrentExs] = useState<Exercise[]>([]);
  const [sessionExercises, setSessionExercises] = useState<Exercise[]>([]);
  const [saveModal, setSaveModal] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [sessionNotes, setSessionNotes] = useState('');
  const [saveError, setSaveError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(FAV_KEY).then(raw => {
        if (raw) {
          try { setFavorites(new Set(JSON.parse(raw))); } catch { setFavorites(new Set()); }
        } else {
          setFavorites(new Set());
        }
      });
    }, [])
  );

  const exercises = useQuery({
    queryKey: ["exercises"],
    queryFn: () => getExercises() as Promise<Exercise[]>,
  });

  const clearAll = () => {
    setCurrentExs([]);
    setSessionExercises([]);
    setSelectedCategories([]);
    setFormError('');
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const generate = () => {
    if (selectedCategories.length === 0) {
      setFormError(t('Seleziona almeno una categoria', 'Select at least one category'));
      return;
    }
    setFormError('');
    const allExs = exercises.data ?? [];
    const sessionIds = new Set(sessionExercises.map(e => e.id));
    const pool = allExs.filter(e =>
      selectedCategories.includes(e.category) && !sessionIds.has(e.id)
    );
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setCurrentExs(shuffled);
  };

  const addToSession = (ex: Exercise) => {
    setSessionExercises(prev => [...prev, ex]);
    setCurrentExs(prev => prev.filter(e => e.id !== ex.id));
  };

  const removeFromSession = (ex: Exercise) => {
    setSessionExercises(prev => prev.filter(e => e.id !== ex.id));
    if (selectedCategories.includes(ex.category)) {
      setCurrentExs(prev => [...prev, ex]);
    }
  };

  const totalDuration = sessionExercises.reduce((sum, ex) => sum + (ex.duration || 0), 0);
  const totalPicked = sessionExercises.length;

  const handleSave = () => {
    if (totalPicked === 0) {
      setFormError(t('Seleziona almeno un esercizio', 'Select at least one exercise'));
      return;
    }
    setFormError('');
    setSessionTitle(t('Seduta del ', 'Session ') + new Date().toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-US'));
    setSaveModal(true);
  };

  const confirmSave = async () => {
    if (!sessionTitle.trim()) {
      setSaveError(t('Inserisci un titolo', 'Enter a title'));
      return;
    }
    setSaveError('');
    setIsSaving(true);
    try {
      const session = await dbCreateSession({
        title: sessionTitle,
        date: sessionDate,
        duration: totalDuration,
        notes: sessionNotes || null,
      });
      if (session) {
        for (let i = 0; i < sessionExercises.length; i++) {
          await addExerciseToSession(session.id, sessionExercises[i].id, i);
        }
      }
      qc.invalidateQueries({ queryKey: ["sessions"] });
      setSaveModal(false);
      setSaveError('');
      clearAll();
      router.push('/(tabs)/sessions');
    } catch (err: any) {
      setSaveError(t('Errore durante il salvataggio. Riprova.', 'Error saving session. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = exercises.isLoading;
  const hasError = exercises.isError;
  const favoriteExercises = (exercises.data ?? []).filter((ex: Exercise) =>
    favorites.has(ex.id) && !sessionExercises.find(s => s.id === ex.id)
  );

  const renderCurrentCard = (ex: Exercise) => {
    const secObjs = (() => { try { return JSON.parse(ex.secondaryObjectives ?? '[]'); } catch { return []; } })();
    return (
      <View key={ex.id} style={s.exCard}>
        <View style={s.exCardTop}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={s.exName}>{lang === 'it' ? ex.name : (ex.nameEn || ex.name)}</Text>
            <View style={[s.catPill, { backgroundColor: categoryColors[ex.category] + '25', borderColor: categoryColors[ex.category] + '60' }]}>
              <Text style={[s.catPillText, { color: categoryColors[ex.category] }]}>
                {lang === 'it' ? categoryLabels[ex.category]?.it : categoryLabels[ex.category]?.en}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <View style={[s.badge, { backgroundColor: intensityColors[ex.intensity] + '30', borderColor: intensityColors[ex.intensity] }]}>
              <Text style={[s.badgeText, { color: intensityColors[ex.intensity] }]}>
                {lang === 'it' ? intensityLabels[ex.intensity]?.it : intensityLabels[ex.intensity]?.en}
              </Text>
            </View>
            <TouchableOpacity style={s.addBtn} onPress={() => addToSession(ex)} activeOpacity={0.75}>
              <PlusCircle color={c.primary} size={26} weight="fill" />
            </TouchableOpacity>
          </View>
        </View>

        {ex.primaryObjective && (
          <View style={s.objPrimary}>
            <Text style={s.objPrimaryLabel}>{t('🎯 Obiettivo primario', '🎯 Primary objective')}</Text>
            <Text style={s.objPrimaryText}>{ex.primaryObjective}</Text>
          </View>
        )}

        <Text style={s.exDesc}>{lang === 'it' ? ex.description : (ex.descriptionEn || ex.description)}</Text>

        {secObjs.length > 0 && (
          <View style={s.objSec}>
            <Text style={s.objSecLabel}>{t('Obiettivi secondari:', 'Secondary objectives:')}</Text>
            {secObjs.slice(0, 3).map((o: string, i: number) => (
              <Text key={i} style={s.objSecItem}>· {o}</Text>
            ))}
          </View>
        )}

        <View style={s.exMeta}>
          <Text style={s.exMetaText}>⏱ {ex.duration} min</Text>
          {ex.players && <Text style={s.exMetaText}>👥 {ex.players}+</Text>}
          {ex.materials && <Text style={s.exMetaText}>⚙️ {ex.materials}</Text>}
        </View>
      </View>
    );
  };

  const renderSessionChip = (ex: Exercise) => (
    <View key={ex.id} style={s.sessionChip}>
      <View style={[s.sessionChipDot, { backgroundColor: categoryColors[ex.category] }]} />
      <Text style={s.sessionChipName} numberOfLines={1}>
        {lang === 'it' ? ex.name : (ex.nameEn || ex.name)}
      </Text>
      <Text style={s.sessionChipMeta}>{ex.duration}min</Text>
      <TouchableOpacity onPress={() => removeFromSession(ex)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <X color={c.textDim} size={14} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>{t('Generatore Seduta', 'Session Generator')}</Text>
        <Text style={s.subtitle}>{t('Seleziona le categorie e genera una seduta professionale', 'Select categories and generate a pro-level session')}</Text>

        <View style={s.tabBar}>
          <TouchableOpacity style={[s.tabBtn, activeTab === 'genera' && s.tabBtnActive]} onPress={() => setActiveTab('genera')} activeOpacity={0.75}>
            <Lightning color={activeTab === 'genera' ? c.bg : c.textMuted} size={15} weight="fill" />
            <Text style={[s.tabBtnText, activeTab === 'genera' && s.tabBtnTextActive]}>{t('Genera', 'Generate')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tabBtn, activeTab === 'preferiti' && s.tabBtnActive]} onPress={() => setActiveTab('preferiti')} activeOpacity={0.75}>
            <Star color={activeTab === 'preferiti' ? c.bg : c.textMuted} size={15} weight={activeTab === 'preferiti' ? 'fill' : 'regular'} />
            <Text style={[s.tabBtnText, activeTab === 'preferiti' && s.tabBtnTextActive]}>
              {t('Preferiti', 'Favorites')}{favorites.size > 0 && ` (${favorites.size})`}
            </Text>
          </TouchableOpacity>
        </View>

        {sessionExercises.length > 0 && (
          <View style={s.sessionBox}>
            <View style={s.sessionBoxHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <CheckCircle color={c.primary} size={16} weight="fill" />
                <Text style={s.sessionBoxTitle}>
                  {t('Seduta in costruzione', 'Session in progress')} · {totalPicked} {t('es.', 'ex.')} · {totalDuration} min
                </Text>
              </View>
              <TouchableOpacity onPress={clearAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Trash color={c.danger} size={16} />
              </TouchableOpacity>
            </View>
            <View style={s.sessionChips}>{sessionExercises.map(renderSessionChip)}</View>
            <TouchableOpacity style={s.saveBarBtn} onPress={handleSave} activeOpacity={0.8}>
              <FloppyDisk color={c.bg} size={16} weight="fill" />
              <Text style={s.saveBarBtnText}>{t('Salva Seduta', 'Save Session')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {isLoading && (
          <View style={s.statusBox}>
            <ActivityIndicator color={c.primary} size="small" />
            <Text style={s.statusText}>{t('Caricamento esercizi...', 'Loading exercises...')}</Text>
          </View>
        )}
        {hasError && (
          <View style={[s.statusBox, { borderColor: c.danger }]}>
            <WarningCircle color={c.danger} size={18} />
            <Text style={[s.statusText, { color: c.danger }]}>{t('Errore caricamento esercizi', 'Failed to load exercises')}</Text>
          </View>
        )}

        {!!formError && (
          <View style={s.errorBox}>
            <WarningCircle color={c.danger} size={15} />
            <Text style={s.errorText}>{formError}</Text>
          </View>
        )}

        {activeTab === 'genera' && (
          <>
            <Text style={s.sectionLabel}>{t('Scegli le categorie', 'Choose categories')}</Text>
            <View style={s.catGrid}>
              {CATEGORIES.map(cat => {
                const selected = selectedCategories.includes(cat);
                const color = categoryColors[cat];
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[s.catChip, { borderColor: color, backgroundColor: selected ? color + '30' : c.bgCard }]}
                    onPress={() => toggleCategory(cat)}
                    activeOpacity={0.75}
                  >
                    {selected ? <CheckCircle color={color} size={18} weight="fill" /> : <CircleIcon color={color} size={18} />}
                    <Text style={[s.catLabel, { color: selected ? color : c.textMuted }]}>
                      {lang === 'it' ? categoryLabels[cat].it : categoryLabels[cat].en}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[s.genBtn, (isLoading || selectedCategories.length === 0) && { opacity: 0.5 }]}
              onPress={generate}
              activeOpacity={0.8}
              disabled={isLoading || selectedCategories.length === 0}
            >
              <Lightning color={c.bg} size={20} weight="fill" />
              <Text style={s.genBtnText}>{t('Genera Esercizi', 'Generate Exercises')}</Text>
            </TouchableOpacity>

            {currentExs.length > 0 && (
              <View style={s.catSection}>
                <Text style={s.catHint}>{t('Tocca + per aggiungere un esercizio alla seduta', 'Tap + to add an exercise to your session')}</Text>
                {currentExs.map(ex => renderCurrentCard(ex))}
              </View>
            )}

            {currentExs.length === 0 && selectedCategories.length > 0 && !isLoading && (
              <View style={s.statusBox}>
                <CheckCircle color={c.primary} size={16} weight="fill" />
                <Text style={s.statusText}>{t('Tutti gli esercizi di questa categoria sono già in seduta', 'All exercises from this category are already in your session')}</Text>
              </View>
            )}
          </>
        )}

        {activeTab === 'preferiti' && (
          <>
            {favorites.size === 0 ? (
              <View style={s.emptyFav}>
                <Star color={c.textDim} size={40} />
                <Text style={s.emptyFavTitle}>{t('Nessun preferito', 'No favorites yet')}</Text>
                <Text style={s.emptyFavSub}>{t('Aggiungi esercizi ai preferiti dalla Libreria per trovarli qui', 'Star exercises in the Library to find them here')}</Text>
              </View>
            ) : (
              <>
                <Text style={s.sectionLabel}>{favoriteExercises.length} {t('esercizi preferiti', 'favorite exercises')}</Text>
                <Text style={s.catHint}>{t('Tocca + per aggiungere un esercizio alla seduta', 'Tap + to add an exercise to your session')}</Text>
                {isLoading ? <ActivityIndicator color={c.primary} style={{ marginTop: 20 }} /> : favoriteExercises.map(ex => renderCurrentCard(ex))}
                {!isLoading && favoriteExercises.length === 0 && favorites.size > 0 && (
                  <View style={s.statusBox}>
                    <CheckCircle color={c.primary} size={16} weight="fill" />
                    <Text style={s.statusText}>{t('Tutti i preferiti sono già in seduta', 'All favorites are already in your session')}</Text>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={saveModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{t('Salva Seduta', 'Save Session')}</Text>
              <TouchableOpacity onPress={() => { setSaveModal(false); setSaveError(''); }}>
                <X color={c.textMuted} size={24} />
              </TouchableOpacity>
            </View>

            <Text style={s.modalSummary}>{totalPicked} {t('esercizi', 'exercises')} · {totalDuration} min</Text>

            <TextInput style={s.input} placeholder={t('Titolo seduta', 'Session title')} placeholderTextColor={c.textDim} value={sessionTitle} onChangeText={setSessionTitle} />
            <TextInput style={s.input} placeholder={t('Data (YYYY-MM-DD)', 'Date (YYYY-MM-DD)')} placeholderTextColor={c.textDim} value={sessionDate} onChangeText={setSessionDate} />
            <TextInput style={[s.input, s.inputMulti]} placeholder={t('Note opzionali...', 'Optional notes...')} placeholderTextColor={c.textDim} value={sessionNotes} onChangeText={setSessionNotes} multiline />

            {!!saveError && (
              <View style={s.errorBox}>
                <WarningCircle color={c.danger} size={15} />
                <Text style={s.errorText}>{saveError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.saveBtn2, isSaving && { opacity: 0.6 }]}
              onPress={confirmSave}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              {isSaving
                ? <ActivityIndicator color={c.bg} />
                : <Text style={s.saveBtnText2}>{t('Salva Seduta', 'Save Session')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function mkStyles(c: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    scroll: { flex: 1 },
    content: { padding: 20, paddingBottom: 60 },
    title: { fontSize: 24, fontWeight: '800', color: c.text, marginBottom: 4 },
    subtitle: { fontSize: 13, color: c.textMuted, marginBottom: 16 },
    tabBar: { flexDirection: 'row', backgroundColor: c.bgCard, borderRadius: 14, padding: 4, marginBottom: 16, gap: 4, borderWidth: 1, borderColor: c.border },
    tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10 },
    tabBtnActive: { backgroundColor: c.primary },
    tabBtnText: { fontSize: 13, fontWeight: '700', color: c.textMuted },
    tabBtnTextActive: { color: c.bg },
    sessionBox: { backgroundColor: c.bgCard, borderRadius: 16, padding: 14, marginBottom: 20, borderWidth: 1.5, borderColor: c.primary + '50' },
    sessionBoxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    sessionBoxTitle: { fontSize: 12, fontWeight: '700', color: c.primary },
    sessionChips: { flexDirection: 'column', gap: 6, marginBottom: 12 },
    sessionChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: c.border },
    sessionChipDot: { width: 8, height: 8, borderRadius: 4 },
    sessionChipName: { flex: 1, fontSize: 13, fontWeight: '600', color: c.text },
    sessionChipMeta: { fontSize: 11, color: c.textMuted },
    saveBarBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.primary, borderRadius: 10, paddingVertical: 10 },
    saveBarBtnText: { fontSize: 13, fontWeight: '700', color: c.bg },
    statusBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.bgCard, borderRadius: 10, padding: 10, marginBottom: 16, borderWidth: 1, borderColor: c.border },
    statusText: { fontSize: 13, color: c.textMuted, flex: 1 },
    errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.danger + '15', borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: c.danger + '40' },
    errorText: { fontSize: 13, color: c.danger, flex: 1 },
    sectionLabel: { fontSize: 12, fontWeight: '700', color: c.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
    catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24, borderWidth: 1.5 },
    catLabel: { fontSize: 13, fontWeight: '600' },
    genBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.primary, borderRadius: 14, paddingVertical: 15, marginBottom: 20 },
    genBtnText: { fontSize: 15, fontWeight: '800', color: c.bg },
    catSection: { marginBottom: 24 },
    catHint: { fontSize: 11, color: c.textDim, marginBottom: 12, fontStyle: 'italic' },
    exCard: { backgroundColor: c.bgCard, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: c.border },
    exCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    exName: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 4 },
    catPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
    catPillText: { fontSize: 10, fontWeight: '700' },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
    badgeText: { fontSize: 10, fontWeight: '700' },
    addBtn: { marginTop: 2 },
    objPrimary: { backgroundColor: c.accent + '15', borderRadius: 8, padding: 10, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: c.accent },
    objPrimaryLabel: { fontSize: 10, fontWeight: '700', color: c.accent, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
    objPrimaryText: { fontSize: 12, color: c.text, lineHeight: 17 },
    exDesc: { fontSize: 12, color: c.textMuted, lineHeight: 17, marginBottom: 8 },
    objSec: { marginBottom: 8 },
    objSecLabel: { fontSize: 10, fontWeight: '700', color: c.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    objSecItem: { fontSize: 11, color: c.textDim, lineHeight: 16 },
    exMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 4 },
    exMetaText: { fontSize: 11, color: c.textDim },
    emptyFav: { alignItems: 'center', paddingVertical: 48, gap: 12 },
    emptyFavTitle: { fontSize: 18, fontWeight: '700', color: c.text },
    emptyFavSub: { fontSize: 13, color: c.textMuted, textAlign: 'center', paddingHorizontal: 20, lineHeight: 19 },
    modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
    modalBox: { backgroundColor: c.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    modalTitle: { fontSize: 18, fontWeight: '800', color: c.text },
    modalSummary: { fontSize: 13, color: c.textMuted, marginBottom: 16 },
    input: { backgroundColor: c.bg, borderRadius: 12, padding: 14, color: c.text, borderWidth: 1, borderColor: c.border, marginBottom: 12, fontSize: 16 },
    inputMulti: { height: 80, textAlignVertical: 'top' },
    saveBtn2: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    saveBtnText2: { fontSize: 15, fontWeight: '800', color: c.bg },
  });
}
