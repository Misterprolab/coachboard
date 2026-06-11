import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useTheme } from "../lib/themeStore";
import type { ThemeColors } from "../lib/themeStore";
import { useI18n } from "../lib/i18n";
import { getEmail } from "../lib/authStore";
import {
  ArrowLeft, Trash, PencilSimple, Plus, FolderOpen,
  Star,
} from "phosphor-react-native";
import Svg, { Rect, Circle, Line as SvgLine, Path } from "react-native-svg";

type FieldType = "full" | "half" | "threequarter";

interface PlayerToken {
  id: number; x: number; y: number;
  label: string; color: string; team: string;
}
interface DrawnLine {
  id: number; x1: number; y1: number; x2: number; y2: number;
  type: "arrow" | "line";
}
interface TacticBoard {
  id: string; name: string; formation: string; fieldType: FieldType;
  players: PlayerToken[]; lines: DrawnLine[]; savedAt: number;
  favorite?: boolean;
  category?: string;
  isCustom?: boolean;
}

function getStorageKey(): string {
  const email = getEmail();
  const userKey = email ? email.replace(/[^a-zA-Z0-9]/g, "_") : "anon";
  return `tactical_boards_v1_${userKey}`;
}

async function loadAllBoards(): Promise<TacticBoard[]> {
  try {
    const raw = await AsyncStorage.getItem(getStorageKey());
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveAllBoards(boards: TacticBoard[]): Promise<void> {
  await AsyncStorage.setItem(getStorageKey(), JSON.stringify(boards));
}

async function deleteBoardFromStorage(id: string): Promise<void> {
  const all = await loadAllBoards();
  await saveAllBoards(all.filter(b => b.id !== id));
}

async function renameBoardInStorage(id: string, name: string): Promise<void> {
  const all = await loadAllBoards();
  const b = all.find(b => b.id === id);
  if (b) { b.name = name; await saveAllBoards(all); }
}

async function toggleFavoriteInStorage(id: string): Promise<boolean> {
  const all = await loadAllBoards();
  const b = all.find(b => b.id === id);
  if (b) {
    b.favorite = !b.favorite;
    await saveAllBoards(all);
    return !!b.favorite;
  }
  return false;
}

async function addCustomBoard(name: string, category: string): Promise<TacticBoard> {
  const all = await loadAllBoards();
  const newBoard: TacticBoard = {
    id: `custom_${Date.now()}`,
    name: name.trim(),
    formation: "—",
    fieldType: "full",
    players: [],
    lines: [],
    savedAt: Date.now(),
    favorite: false,
    category: category.trim() || undefined,
    isCustom: true,
  };
  await saveAllBoards([newBoard, ...all]);
  return newBoard;
}

function formatDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString("it-IT", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Mini field thumbnail ─────────────────────────────────────────────────────
const TW = 100;
const TH = TW * 1.3;

function calcArrowHead(x1: number, y1: number, x2: number, y2: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const L = 6; const spread = 0.42;
  return {
    ax: x2 - L * Math.cos(angle - spread),
    ay: y2 - L * Math.sin(angle - spread),
    bx: x2 - L * Math.cos(angle + spread),
    by: y2 - L * Math.sin(angle + spread),
  };
}

function BoardThumbnail({
  board, originalW, originalH,
}: {
  board: TacticBoard; originalW: number; originalH: number;
}) {
  const scaleX = TW / originalW;
  const scaleY = TH / originalH;
  return (
    <Svg width={TW} height={TH}>
      <Rect x="0" y="0" width={TW} height={TH} fill="#1a4a22" rx="6" />
      {[0, 1, 2, 3, 4].map(i => (
        <Rect
          key={i} x="0" y={i * TH / 5}
          width={TW} height={TH / 10}
          fill="#1e5428" opacity="0.5"
        />
      ))}
      <Rect x="2" y="2" width={TW - 4} height={TH - 4}
        fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.5" rx="4" />
      <SvgLine x1="2" y1={TH / 2} x2={TW - 2} y2={TH / 2}
        stroke="white" strokeWidth="0.8" strokeOpacity="0.4" />
      <Circle cx={TW / 2} cy={TH / 2} r={TW * 0.14}
        fill="none" stroke="white" strokeWidth="0.8" strokeOpacity="0.35" />
      <Rect x={TW * 0.25} y="2" width={TW * 0.5} height={TH * 0.15}
        fill="none" stroke="white" strokeWidth="0.8" strokeOpacity="0.35" />
      <Rect x={TW * 0.25} y={TH - TH * 0.15 - 2} width={TW * 0.5} height={TH * 0.15}
        fill="none" stroke="white" strokeWidth="0.8" strokeOpacity="0.35" />
      {board.lines.map(line => {
        const x1 = line.x1 * scaleX; const y1 = line.y1 * scaleY;
        const x2 = line.x2 * scaleX; const y2 = line.y2 * scaleY;
        const color = line.type === "arrow" ? "#ff6b6b" : "#f1c40f";
        const ah = calcArrowHead(x1, y1, x2, y2);
        const d = `M ${x2} ${y2} L ${ah.ax} ${ah.ay} L ${ah.bx} ${ah.by} Z`;
        return (
          <React.Fragment key={line.id}>
            <SvgLine x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color} strokeWidth="1.2"
              strokeDasharray={line.type === "line" ? "3,2" : undefined}
            />
            {line.type === "arrow" && <Path d={d} fill={color} />}
          </React.Fragment>
        );
      })}
      {board.players.map(p => (
        <Circle
          key={p.id}
          cx={p.x * scaleX} cy={p.y * scaleY}
          r="4" fill={p.color}
          stroke="white" strokeWidth="0.8" strokeOpacity="0.8"
        />
      ))}
    </Svg>
  );
}

// ─── Category pill ────────────────────────────────────────────────────────────
function CategoryPill({ label, c }: { label: string; c: ThemeColors }) {
  return (
    <View style={{
      backgroundColor: c.primary + "15",
      borderRadius: 6,
      paddingHorizontal: 8, paddingVertical: 2,
      borderWidth: 1, borderColor: c.primary + "40",
    }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: c.primary }}>{label}</Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
type Tab = "all" | "favorites";

export default function TacticalLibraryScreen() {
  const c = useTheme((s) => s.colors);
  const s = useMemo(() => mkStyles(c), [c]);
  const { t } = useI18n();
  const router = useRouter();

  const [boards, setBoards] = useState<TacticBoard[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("all");

  // rename state
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTxt, setRenameTxt] = useState("");

  // add custom state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");

  // delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<TacticBoard | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadAllBoards().then(setBoards);
    }, [])
  );

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filteredBoards = useMemo(() => {
    if (activeTab === "favorites") return boards.filter(b => b.favorite);
    return boards;
  }, [boards, activeTab]);

  const favCount = useMemo(() => boards.filter(b => b.favorite).length, [boards]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleDelete = (board: TacticBoard) => {
    setDeleteTarget(board);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteBoardFromStorage(deleteTarget.id);
    setBoards(prev => prev.filter(b => b.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const handleRename = async () => {
    if (!renameId || !renameTxt.trim()) return;
    await renameBoardInStorage(renameId, renameTxt.trim());
    setBoards(prev =>
      prev.map(b => b.id === renameId ? { ...b, name: renameTxt.trim() } : b)
    );
    setRenameId(null);
  };

  const handleToggleFavorite = async (id: string) => {
    const newVal = await toggleFavoriteInStorage(id);
    setBoards(prev =>
      prev.map(b => b.id === id ? { ...b, favorite: newVal } : b)
    );
  };

  const handleAddCustom = async () => {
    if (!newName.trim()) return;
    const board = await addCustomBoard(newName, newCategory);
    setBoards(prev => [board, ...prev]);
    setNewName("");
    setNewCategory("");
    setAddModalOpen(false);
    // open the tactical board for this new entry
    router.push({ pathname: "/tactical", params: { boardData: encodeURIComponent(JSON.stringify(board)), from: "tactical-library" } } as any);
  };

  const openBoard = (board: TacticBoard) => {
    router.push({
      pathname: "/tactical",
      params: { boardData: encodeURIComponent(JSON.stringify(board)) },
    } as any);
  };

  const newBoard = () => router.push({ pathname: "/tactical", params: { from: "tactical-library" } } as any);

  const SCREEN_W = 375;
  const FW_REF = SCREEN_W - 32;
  const FH_MAP: Record<FieldType, number> = {
    full: FW_REF * 1.55,
    half: FW_REF * 0.85,
    threequarter: FW_REF * 1.18,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>

      {/* ── Rename modal ───────────────────────────────────────────────── */}
      <Modal
        visible={!!renameId}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameId(null)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t("Rinomina schema", "Rename scheme")}</Text>
            <TextInput
              style={s.modalInput}
              value={renameTxt}
              onChangeText={setRenameTxt}
              placeholder={t("Nuovo nome...", "New name...")}
              placeholderTextColor={c.textMuted}
              autoFocus
              onSubmitEditing={handleRename}
            />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setRenameId(null)}>
                <Text style={s.modalBtnCancelTxt}>{t("Annulla", "Cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnSave} onPress={handleRename}>
                <Text style={s.modalBtnSaveTxt}>{t("Salva", "Save")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Delete confirm modal ───────────────────────────────────────── */}
      <Modal
        visible={!!deleteTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t("Elimina schema", "Delete scheme")}</Text>
            <Text style={[s.modalLabel, { color: c.text, marginBottom: 20 }]}>
              {t("Eliminare", "Delete")} <Text style={{ fontWeight: "700" }}>"{deleteTarget?.name}"</Text>?{"\n"}
              {t("L'operazione non è reversibile.", "This cannot be undone.")}
            </Text>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setDeleteTarget(null)}>
                <Text style={s.modalBtnCancelTxt}>{t("Annulla", "Cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtnSave, { backgroundColor: c.danger }]} onPress={confirmDelete}>
                <Text style={s.modalBtnSaveTxt}>{t("Elimina", "Delete")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add custom exercise modal ───────────────────────────────────── */}
      <Modal
        visible={addModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>
              {t("Nuova esercitazione", "New exercise")}
            </Text>
            <Text style={s.modalLabel}>{t("Nome esercitazione", "Exercise name")}</Text>
            <TextInput
              style={s.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder={t("Es. Pressing alto 4-3-3", "E.g. High press 4-3-3")}
              placeholderTextColor={c.textMuted}
              autoFocus
              returnKeyType="next"
            />
            <Text style={s.modalLabel}>{t("Categoria (opzionale)", "Category (optional)")}</Text>
            <TextInput
              style={s.modalInput}
              value={newCategory}
              onChangeText={setNewCategory}
              placeholder={t("Es. Pressing, Ripartenza, Calcio piazzato...", "E.g. Pressing, Transition...")}
              placeholderTextColor={c.textMuted}
              returnKeyType="done"
              onSubmitEditing={handleAddCustom}
            />
            <View style={s.modalBtns}>
              <TouchableOpacity
                style={s.modalBtnCancel}
                onPress={() => { setAddModalOpen(false); setNewName(""); setNewCategory(""); }}
              >
                <Text style={s.modalBtnCancelTxt}>{t("Annulla", "Cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtnSave, !newName.trim() && { opacity: 0.4 }]}
                onPress={handleAddCustom}
                disabled={!newName.trim()}
              >
                <Text style={s.modalBtnSaveTxt}>{t("Crea e apri", "Create & open")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <View style={s.topBar}>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)' as any)}
          style={s.back}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft color={c.text} size={22} />
        </TouchableOpacity>
        <Text style={s.title}>{t("Libreria Schemi", "Scheme Library")}</Text>
        <View style={s.topActions}>
          <TouchableOpacity
            style={s.addBtn}
            onPress={() => setAddModalOpen(true)}
            activeOpacity={0.8}
          >
            <Plus color="#fff" size={16} weight="bold" />
            <Text style={s.addBtnTxt}>{t("Aggiungi", "Add")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.newBtn} onPress={newBoard} activeOpacity={0.8}>
            <Text style={s.newBtnTxt}>{t("Nuovo", "New")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <View style={s.tabRow}>
        <TouchableOpacity
          style={[s.tab, activeTab === "all" && s.tabActive]}
          onPress={() => setActiveTab("all")}
          activeOpacity={0.8}
        >
          <Text style={[s.tabTxt, activeTab === "all" && s.tabTxtActive]}>
            {t("Tutti", "All")} {boards.length > 0 ? `(${boards.length})` : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === "favorites" && s.tabActive]}
          onPress={() => setActiveTab("favorites")}
          activeOpacity={0.8}
        >
          <Star
            size={13}
            weight={activeTab === "favorites" ? "fill" : "regular"}
            color={activeTab === "favorites" ? "#f59e0b" : c.textMuted}
          />
          <Text style={[s.tabTxt, activeTab === "favorites" && s.tabTxtFav]}>
            {t("Preferiti", "Favourites")} {favCount > 0 ? `(${favCount})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── List ───────────────────────────────────────────────────────── */}
      <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
        {filteredBoards.length === 0 ? (
          activeTab === "favorites" ? (
            <View style={s.empty}>
              <Star size={48} color={c.textMuted} weight="fill" />
              <Text style={s.emptyTitle}>
                {t("Nessun preferito", "No favourites yet")}
              </Text>
              <Text style={s.emptyBody}>
                {t(
                  "Tocca la stella ★ su uno schema per aggiungerlo ai preferiti.",
                  "Tap the ★ on any scheme to mark it as favourite."
                )}
              </Text>
            </View>
          ) : (
            <View style={s.empty}>
              <FolderOpen size={48} color={c.textMuted} />
              <Text style={s.emptyTitle}>
                {t("Nessuno schema salvato", "No saved schemes")}
              </Text>
              <Text style={s.emptyBody}>
                {t(
                  "Crea uno schema dal campo tattico oppure aggiungi un'esercitazione.",
                  "Create a scheme from the tactical board or add a new exercise."
                )}
              </Text>
              <View style={s.emptyBtns}>
                <TouchableOpacity style={s.emptyBtn} onPress={newBoard}>
                  <Text style={s.emptyBtnTxt}>{t("Apri campo", "Open board")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.emptyBtn, { backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border }]}
                  onPress={() => setAddModalOpen(true)}
                >
                  <Text style={[s.emptyBtnTxt, { color: c.text }]}>
                    {t("Aggiungi esercitazione", "Add exercise")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        ) : (
          filteredBoards.map(board => {
            const fh = FH_MAP[board.fieldType] ?? FW_REF * 1.55;
            const isFav = !!board.favorite;
            return (
              <TouchableOpacity
                key={board.id}
                style={[s.card, isFav && s.cardFav]}
                onPress={() => openBoard(board)}
                activeOpacity={0.85}
              >
                {/* Thumbnail */}
                <View style={s.thumb}>
                  <BoardThumbnail board={board} originalW={FW_REF} originalH={fh} />
                  {/* custom badge overlay */}
                  {board.isCustom && (
                    <View style={s.customBadge}>
                      <Text style={s.customBadgeTxt}>{t("Custom", "Custom")}</Text>
                    </View>
                  )}
                </View>

                {/* Info */}
                <View style={s.info}>
                  <Text style={s.cardName} numberOfLines={2}>{board.name}</Text>
                  <View style={s.cardMeta}>
                    {board.formation !== "—" && (
                      <View style={s.badge}>
                        <Text style={s.badgeTxt}>{board.formation}</Text>
                      </View>
                    )}
                    {board.fieldType !== "full" && (
                      <View style={s.badge}>
                        <Text style={s.badgeTxt}>
                          {board.fieldType === "half"
                            ? t("Metà", "Half")
                            : "¾"}
                        </Text>
                      </View>
                    )}
                    {board.category ? (
                      <CategoryPill label={board.category} c={c} />
                    ) : null}
                  </View>
                  <Text style={s.cardDate}>{formatDate(board.savedAt)}</Text>
                  <Text style={s.cardStats}>
                    {board.players.length} {t("gioc", "players")} ·{" "}
                    {board.lines.length} {t("frecce", "arrows")}
                  </Text>
                </View>

                {/* Actions */}
                <View style={s.actions}>
                  {/* Favourite star */}
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={() => handleToggleFavorite(board.id)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    {isFav
                      ? <Star color="#f59e0b" size={20} weight="fill" />
                      : <Star color={c.textMuted} size={20} />
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={() => { setRenameId(board.id); setRenameTxt(board.name); }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <PencilSimple color={c.textMuted} size={18} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={() => handleDelete(board)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Trash color={c.danger} size={18} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* ── Add exercise floating CTA at bottom ─────────────────────── */}
        {filteredBoards.length > 0 && (
          <TouchableOpacity style={s.addCta} onPress={() => setAddModalOpen(true)} activeOpacity={0.85}>
            <Plus color={c.primary} size={18} weight="bold" />
            <Text style={s.addCtaTxt}>{t("Aggiungi esercitazione", "Add exercise")}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function mkStyles(c: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },

    // top bar
    topBar: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, gap: 10,
    },
    back: { padding: 4 },
    title: { flex: 1, fontSize: 17, fontWeight: "700", color: c.text },
    topActions: { flexDirection: "row", gap: 8, alignItems: "center" },
    addBtn: {
      flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: c.primary + "cc",
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12,
    },
    addBtnTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
    newBtn: {
      alignItems: "center",
      backgroundColor: c.primary,
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12,
    },
    newBtnTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },

    // tabs
    tabRow: {
      flexDirection: "row", gap: 8,
      paddingHorizontal: 16, paddingBottom: 10,
    },
    tab: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1, borderColor: c.border,
      backgroundColor: c.bgCard,
    },
    tabActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    tabTxt: { fontSize: 13, fontWeight: "600", color: c.textMuted },
    tabTxtActive: { color: "#fff" },
    tabTxtFav: { color: "#f59e0b" },

    // list
    list: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },

    // card
    card: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: c.bgCard,
      borderRadius: 14, borderWidth: 1, borderColor: c.border,
      padding: 12,
    },
    cardFav: {
      borderColor: "#f59e0b" + "60",
      backgroundColor: c.bgCard,
    },
    thumb: { borderRadius: 8, overflow: "hidden", position: "relative" },
    customBadge: {
      position: "absolute", bottom: 4, left: 4,
      backgroundColor: c.primary,
      borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
    },
    customBadgeTxt: { fontSize: 9, fontWeight: "800", color: "#fff" },
    info: { flex: 1, gap: 4 },
    cardName: { fontSize: 15, fontWeight: "700", color: c.text },
    cardMeta: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    badge: {
      backgroundColor: c.primary + "20", borderRadius: 6,
      paddingHorizontal: 8, paddingVertical: 2,
    },
    badgeTxt: { fontSize: 11, fontWeight: "700", color: c.primary },
    cardDate: { fontSize: 11, color: c.textMuted },
    cardStats: { fontSize: 11, color: c.textMuted },
    actions: { gap: 6, justifyContent: "center", alignItems: "center" },
    actionBtn: { padding: 6 },

    // empty
    empty: {
      alignItems: "center", paddingTop: 80, gap: 12, paddingHorizontal: 32,
    },
    emptyTitle: { fontSize: 18, fontWeight: "700", color: c.text, textAlign: "center" },
    emptyBody: { fontSize: 14, color: c.textMuted, textAlign: "center", lineHeight: 20 },
    emptyBtns: { flexDirection: "row", gap: 10, marginTop: 8, flexWrap: "wrap", justifyContent: "center" },
    emptyBtn: {
      backgroundColor: c.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14,
    },
    emptyBtnTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },

    // add cta
    addCta: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, marginTop: 4,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1.5, borderColor: c.primary + "50",
      borderStyle: "dashed",
    },
    addCtaTxt: { fontSize: 14, fontWeight: "700", color: c.primary },

    // modals
    modalOverlay: {
      flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center", alignItems: "center", padding: 32,
    },
    modalCard: {
      width: "100%", backgroundColor: c.bgCard,
      borderRadius: 18, padding: 24,
      borderWidth: 1, borderColor: c.border,
    },
    modalTitle: { fontSize: 18, fontWeight: "700", color: c.text, marginBottom: 16 },
    modalLabel: { fontSize: 13, fontWeight: "600", color: c.textMuted, marginBottom: 6 },
    modalInput: {
      backgroundColor: c.bg, borderWidth: 1.5, borderColor: c.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 16, color: c.text, marginBottom: 14,
    },
    modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
    modalBtnCancel: {
      flex: 1, alignItems: "center", paddingVertical: 13,
      borderRadius: 12, borderWidth: 1, borderColor: c.border,
    },
    modalBtnCancelTxt: { fontSize: 15, fontWeight: "600", color: c.textMuted },
    modalBtnSave: {
      flex: 1, alignItems: "center", paddingVertical: 13,
      borderRadius: 12, backgroundColor: c.primary,
    },
    modalBtnSaveTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },
  });
}
