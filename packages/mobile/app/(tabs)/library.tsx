import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { categoryColors, categoryLabels, intensityColors, intensityLabels } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { MagnifyingGlass, Plus, Star, Trash, X, Football } from "phosphor-react-native";
import { useTheme } from "../../lib/themeStore";
import type { ThemeColors } from "../../lib/themeStore";
import { getExercises, createExercise as dbCreateExercise, deleteExercise as dbDeleteExercise } from "../../lib/db/queries";
import { useDiagramStore } from "../../lib/diagramStore";
import { SvgXml } from "react-native-svg";

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
  diagramImage?: string | null;
};

type Tab = "all" | "favorites";

const CATEGORIES = [
  "tutti", "riscaldamento", "tecnica", "tattica",
  "atletico", "partitella", "calci_piazzati", "portieri",
];
const INTENSITIES = ["bassa", "media", "alta"];
const FAVORITES_KEY = "exercise_favorites_v1";

async function loadFavorites(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

async function saveFavorites(ids: Set<string>): Promise<void> {
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
}

export default function LibraryScreen() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();
  const c = useTheme((s) => s.colors);
  const s = useMemo(() => mkStyles(c), [c]);

  const pendingDiagram = useDiagramStore((s) => s.pendingDiagram);
  const setPendingDiagram = useDiagramStore((s) => s.setPendingDiagram);

  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [activeCategory, setActiveCategory] = useState("tutti");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);

  const [form, setForm] = useState({
    name: "", nameEn: "",
    category: "tecnica",
    description: "", descriptionEn: "",
    duration: "30",
    players: "",
    intensity: "media",
    materials: "",
    diagramImage: null as string | null,
  });

  useFocusEffect(
    useCallback(() => {
      loadFavorites().then(setFavorites);
      // When returning from tactical with a diagram (via Zustand store)
      if (pendingDiagram) {
        setForm(f => ({ ...f, diagramImage: pendingDiagram }));
        setPendingDiagram(null);
        setAddOpen(true);
      }
    }, [pendingDiagram])
  );

  const exercises = useQuery({
    queryKey: ["exercises"],
    queryFn: () => getExercises() as Promise<Exercise[]>,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      return dbCreateExercise({
        name: form.name.trim(),
        nameEn: form.nameEn.trim() || null,
        category: form.category,
        description: form.description.trim() || "—",
        descriptionEn: form.descriptionEn.trim() || null,
        duration: parseInt(form.duration) || 30,
        players: form.players ? parseInt(form.players) : null,
        intensity: form.intensity,
        materials: form.materials.trim() || null,
        isCustom: true,
        diagramImage: form.diagramImage || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercises"] });
      setAddOpen(false);
      resetForm();
    },
    onError: () => {
      Alert.alert(t("Errore", "Error"), t("Impossibile salvare l'esercizio.", "Could not save the exercise."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dbDeleteExercise(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercises"] });
      setDeleteTarget(null);
    },
    onError: () => {
      Alert.alert(t("Errore", "Error"), t("Impossibile eliminare l'esercizio.", "Could not delete the exercise."));
    },
  });

  const resetForm = () => setForm({
    name: "", nameEn: "",
    category: "tecnica",
    description: "", descriptionEn: "",
    duration: "30", players: "",
    intensity: "media", materials: "",
    diagramImage: null,
  });

  const toggleFavorite = useCallback(async (id: string, e: any) => {
    e?.stopPropagation?.();
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveFavorites(next);
      return next;
    });
  }, []);

  const all = exercises.data || [];
  const filtered = useMemo(() => {
    return all.filter(e => {
      if (activeTab === "favorites" && !favorites.has(e.id)) return false;
      if (activeTab === "all") {
        if (activeCategory !== "tutti" && e.category !== activeCategory) return false;
      }
      const name = lang === "it" ? e.name : (e.nameEn || e.name);
      if (search && !name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [all, activeTab, activeCategory, favorites, search, lang]);

  const favCount = useMemo(() => all.filter(e => favorites.has(e.id)).length, [all, favorites]);

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>

      {/* Delete confirm modal */}
      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t("Elimina esercitazione", "Delete exercise")}</Text>
            <Text style={{ color: c.text, marginBottom: 20 }}>
              {t("Eliminare", "Delete")} <Text style={{ fontWeight: "700" }}>"{deleteTarget?.name}"</Text>?{"\n"}
              {t("L'operazione non è reversibile.", "This cannot be undone.")}
            </Text>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setDeleteTarget(null)}>
                <Text style={s.btnCancelTxt}>{t("Annulla", "Cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnSave, { backgroundColor: c.danger }, deleteMutation.isPending && { opacity: 0.5 }]}
                onPress={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
              >
                <Text style={s.btnSaveTxt}>{t("Elimina", "Delete")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => { setAddOpen(false); resetForm(); }}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{t("Nuova esercitazione", "New exercise")}</Text>
              <TouchableOpacity onPress={() => { setAddOpen(false); resetForm(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={c.textMuted} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.fieldLabel}>{t("Nome *", "Name *")}</Text>
              <TextInput style={s.fieldInput} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder={t("Es. Pressing alto 4-3-3", "E.g. High press 4-3-3")} placeholderTextColor={c.textMuted} />

              <Text style={s.fieldLabel}>{t("Nome (inglese)", "Name (English)")}</Text>
              <TextInput style={s.fieldInput} value={form.nameEn} onChangeText={v => setForm(f => ({ ...f, nameEn: v }))} placeholder="E.g. High press 4-3-3" placeholderTextColor={c.textMuted} />

              <Text style={s.fieldLabel}>{t("Categoria *", "Category *")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                {CATEGORIES.filter(cat => cat !== "tutti").map(cat => {
                  const active = form.category === cat;
                  const col = categoryColors[cat];
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[s.chip, active && { backgroundColor: col + "25", borderColor: col }]}
                      onPress={() => setForm(f => ({ ...f, category: cat }))}
                    >
                      <Text style={[s.chipTxt, active && { color: col }]}>
                        {lang === "it" ? categoryLabels[cat].it : categoryLabels[cat].en}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={s.fieldLabel}>{t("Intensità *", "Intensity *")}</Text>
              <View style={s.chipRow}>
                {INTENSITIES.map(int => {
                  const active = form.intensity === int;
                  const col = intensityColors[int];
                  return (
                    <TouchableOpacity
                      key={int}
                      style={[s.chip, active && { backgroundColor: col + "25", borderColor: col }]}
                      onPress={() => setForm(f => ({ ...f, intensity: int }))}
                    >
                      <Text style={[s.chipTxt, active && { color: col }]}>
                        {lang === "it" ? intensityLabels[int]?.it : intensityLabels[int]?.en}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>{t("Durata (min) *", "Duration (min) *")}</Text>
                  <TextInput style={s.fieldInput} value={form.duration} onChangeText={v => setForm(f => ({ ...f, duration: v }))} keyboardType="number-pad" placeholder="30" placeholderTextColor={c.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>{t("Giocatori min.", "Min. players")}</Text>
                  <TextInput style={s.fieldInput} value={form.players} onChangeText={v => setForm(f => ({ ...f, players: v }))} keyboardType="number-pad" placeholder="8" placeholderTextColor={c.textMuted} />
                </View>
              </View>

              <Text style={s.fieldLabel}>{t("Descrizione", "Description")}</Text>
              <TextInput
                style={[s.fieldInput, s.fieldTextarea]}
                value={form.description}
                onChangeText={v => setForm(f => ({ ...f, description: v }))}
                placeholder={t("Descrivi l'esercitazione...", "Describe the exercise...")}
                placeholderTextColor={c.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text style={s.fieldLabel}>{t("Materiali", "Materials")}</Text>
              <TextInput style={s.fieldInput} value={form.materials} onChangeText={v => setForm(f => ({ ...f, materials: v }))} placeholder={t("Coni, palloni...", "Cones, balls...")} placeholderTextColor={c.textMuted} />

              <Text style={s.fieldLabel}>{t("Diagramma tattico", "Tactical Diagram")}</Text>
              {form.diagramImage ? (
                <View style={{ alignItems: "center", marginBottom: 4 }}>
                  <SvgXml xml={form.diagramImage} width={200} height={form.diagramImage.includes('height="210"') ? 140 : 200} style={{ borderRadius: 8 }} />
                  <TouchableOpacity
                    style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 4 }}
                    onPress={() => setForm(f => ({ ...f, diagramImage: null }))}
                  >
                    <X color={c.danger} size={14} />
                    <Text style={{ color: c.danger, fontSize: 12 }}>{t("Rimuovi diagramma", "Remove diagram")}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[s.fieldInput, { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" }]}
                  onPress={() => {
                    setAddOpen(false);
                    router.push({ pathname: "/tactical", params: { mode: "illustrate", from: "library" } } as any);
                  }}
                >
                  <Football color={c.primary} size={18} />
                  <Text style={{ color: c.primary, fontWeight: "700", fontSize: 14 }}>{t("Apri Campo Tattico", "Open Tactical Field")}</Text>
                </TouchableOpacity>
              )}

              <View style={s.modalBtns}>
                <TouchableOpacity style={s.btnCancel} onPress={() => { setAddOpen(false); resetForm(); }}>
                  <Text style={s.btnCancelTxt}>{t("Annulla", "Cancel")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.btnSave, (!form.name.trim() || addMutation.isPending) && { opacity: 0.4 }]}
                  onPress={() => addMutation.mutate()}
                  disabled={!form.name.trim() || addMutation.isPending}
                >
                  {addMutation.isPending
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.btnSaveTxt}>{t("Salva", "Save")}</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={s.header}>
        <View style={s.titleRow}>
          <Text style={s.title}>{t("Libreria Esercizi", "Exercise Library")}</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => setAddOpen(true)} activeOpacity={0.8}>
            <Plus color="#fff" size={15} weight="bold" />
            <Text style={s.addBtnTxt}>{t("Aggiungi", "Add")}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.searchBox}>
          <MagnifyingGlass color={c.textMuted} size={18} />
          <TextInput
            style={s.searchInput}
            placeholder={t("Cerca esercizi...", "Search exercises...")}
            placeholderTextColor={c.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <X color={c.textMuted} size={16} />
            </TouchableOpacity>
          )}
        </View>

        <View style={s.tabRow}>
          <TouchableOpacity style={[s.tab, activeTab === "all" && s.tabActive]} onPress={() => setActiveTab("all")} activeOpacity={0.8}>
            <Text style={[s.tabTxt, activeTab === "all" && s.tabTxtActive]}>
              {t("Tutti", "All")} {all.length > 0 ? `(${all.length})` : ""}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, activeTab === "favorites" && s.tabActiveFav]} onPress={() => setActiveTab("favorites")} activeOpacity={0.8}>
            <Star size={13} weight={activeTab === "favorites" ? "fill" : "regular"} color={activeTab === "favorites" ? "#f59e0b" : c.textMuted} />
            <Text style={[s.tabTxt, activeTab === "favorites" && s.tabTxtFav]}>
              {t("Preferiti", "Favourites")} {favCount > 0 ? `(${favCount})` : ""}
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "all" && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
            {CATEGORIES.map(cat => {
              const isActive = activeCategory === cat;
              const color = cat === "tutti" ? c.primary : categoryColors[cat];
              return (
                <TouchableOpacity
                  key={cat}
                  style={[s.filterChip, isActive && { backgroundColor: color + "25", borderColor: color }]}
                  onPress={() => setActiveCategory(cat)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.filterText, isActive && { color }]}>
                    {cat === "tutti" ? t("Tutti", "All") : lang === "it" ? categoryLabels[cat].it : categoryLabels[cat].en}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {exercises.isLoading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <View style={s.emptyWrap}>
              {activeTab === "favorites" ? (
                <>
                  <Star size={44} color={c.textMuted} weight="fill" />
                  <Text style={s.emptyTitle}>{t("Nessun preferito", "No favourites yet")}</Text>
                  <Text style={s.emptyBody}>{t("Tocca la ★ su un esercizio per aggiungerlo ai preferiti.", "Tap the ★ on any exercise to mark it as favourite.")}</Text>
                </>
              ) : (
                <Text style={s.emptyTxt}>{t("Nessun esercizio trovato", "No exercises found")}</Text>
              )}
            </View>
          ) : (
            filtered.map(ex => {
              const isFav = favorites.has(ex.id);
              const name = lang === "it" ? ex.name : (ex.nameEn || ex.name);
              return (
                <TouchableOpacity
                  key={ex.id}
                  style={[s.card, isFav && s.cardFav]}
                  onPress={() => router.push(`/exercise/${ex.id}` as any)}
                  activeOpacity={0.8}
                >
                  <View style={[s.catBar, { backgroundColor: categoryColors[ex.category] }]} />
                  <View style={s.cardBody}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                      <View style={{ flex: 1 }}>
                        <View style={s.cardTop}>
                          <Text style={s.cardName} numberOfLines={1}>{name}</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            {ex.isCustom && (
                              <TouchableOpacity
                                onPress={(e) => { e.stopPropagation?.(); setDeleteTarget(ex); }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Trash size={16} color={c.danger} />
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={(e) => toggleFavorite(ex.id, e)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.starBtn}>
                              <Star size={18} weight={isFav ? "fill" : "regular"} color={isFav ? "#f59e0b" : c.textMuted} />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <Text style={s.cardCat}>{lang === "it" ? categoryLabels[ex.category]?.it : categoryLabels[ex.category]?.en}</Text>
                        <View style={s.meta}>
                          <Text style={s.metaTxt}>⏱ {ex.duration} min</Text>
                          {ex.players && <Text style={s.metaTxt}>👥 {ex.players}+</Text>}
                          <View style={[s.intBadge, { borderColor: intensityColors[ex.intensity] }]}>
                            <Text style={[s.intTxt, { color: intensityColors[ex.intensity] }]}>
                              {lang === "it" ? intensityLabels[ex.intensity]?.it : intensityLabels[ex.intensity]?.en}
                            </Text>
                          </View>
                          {ex.isCustom && (
                            <View style={s.customBadge}>
                              <Text style={s.customBadgeTxt}>{t("Custom", "Custom")}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      {ex.diagramImage && (
                        <View style={s.diagramThumb}>
                          <SvgXml xml={ex.diagramImage} width={56} height={56} />
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function mkStyles(c: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: c.border },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    title: { fontSize: 22, fontWeight: "800", color: c.text },
    addBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: c.primary, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 12 },
    addBtnTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
    searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: c.bgCard, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: c.border, marginBottom: 10, gap: 8 },
    searchInput: { flex: 1, color: c.text, fontSize: 16 },
    tabRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
    tab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCard },
    tabActive: { backgroundColor: c.primary, borderColor: c.primary },
    tabActiveFav: { backgroundColor: "#f59e0b20", borderColor: "#f59e0b60" },
    tabTxt: { fontSize: 13, fontWeight: "600", color: c.textMuted },
    tabTxtActive: { color: "#fff" },
    tabTxtFav: { color: "#f59e0b" },
    filterRow: { flexDirection: "row", gap: 8, paddingBottom: 8 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCard },
    filterText: { fontSize: 12, fontWeight: "600", color: c.textMuted },
    scroll: { flex: 1 },
    list: { padding: 14, gap: 10 },
    card: { flexDirection: "row", backgroundColor: c.bgCard, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: c.border },
    cardFav: { borderColor: "#f59e0b60" },
    catBar: { width: 5 },
    cardBody: { flex: 1, padding: 12 },
    cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 2 },
    cardName: { flex: 1, fontSize: 14, fontWeight: "700", color: c.text, paddingRight: 8 },
    starBtn: { padding: 2 },
    cardCat: { fontSize: 11, color: c.textMuted, marginBottom: 6 },
    meta: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
    metaTxt: { fontSize: 11, color: c.textMuted },
    intBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    intTxt: { fontSize: 10, fontWeight: "700" },
    customBadge: { backgroundColor: c.primary + "25", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    customBadgeTxt: { fontSize: 10, color: c.primary, fontWeight: "700" },
    diagramThumb: { marginLeft: 8, borderRadius: 6, overflow: "hidden", borderWidth: 1, borderColor: c.border },
    emptyWrap: { alignItems: "center", paddingTop: 80, gap: 12, paddingHorizontal: 32 },
    emptyTitle: { fontSize: 17, fontWeight: "700", color: c.text, textAlign: "center" },
    emptyBody: { fontSize: 13, color: c.textMuted, textAlign: "center", lineHeight: 19 },
    emptyTxt: { color: c.textMuted, textAlign: "center", marginTop: 40, fontStyle: "italic" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
    modalCard: { backgroundColor: c.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, maxHeight: "92%", borderTopWidth: 1, borderColor: c.border },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: "700", color: c.text },
    fieldLabel: { fontSize: 12, fontWeight: "700", color: c.textMuted, marginBottom: 5, marginTop: 10 },
    fieldInput: { backgroundColor: c.bg, borderWidth: 1.5, borderColor: c.border, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, color: c.text },
    fieldTextarea: { minHeight: 80 },
    chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", paddingVertical: 4 },
    chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg },
    chipTxt: { fontSize: 12, fontWeight: "600", color: c.textMuted },
    row2: { flexDirection: "row", gap: 10 },
    modalBtns: { flexDirection: "row", gap: 10, marginTop: 20 },
    btnCancel: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 13, borderWidth: 1, borderColor: c.border },
    btnCancelTxt: { fontSize: 15, fontWeight: "600", color: c.textMuted },
    btnSave: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 13, backgroundColor: c.primary },
    btnSaveTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },
  });
}
