import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  PanResponder, GestureResponderEvent, PanResponderGestureState, Dimensions,
  Modal, TextInput, Alert, LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getEmail } from "../lib/authStore";
import { useTheme } from "../lib/themeStore";
import type { ThemeColors } from "../lib/themeStore";
import { useI18n } from "../lib/i18n";
import { ArrowLeft, Eraser, ArrowCounterClockwise, ArrowRight, Minus, Cursor, FloppyDisk, FolderOpen } from "phosphor-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import Svg, { Circle, Line, Rect, Path, G } from "react-native-svg";

// ─── Storage helpers ──────────────────────────────────────────────────────────
function getTacticalStorageKey(): string {
  const email = getEmail();
  const userKey = email ? email.replace(/[^a-zA-Z0-9]/g, "_") : "anon";
  return `tactical_boards_v1_${userKey}`;
}

export type TacticBoard = {
  id: string;
  name: string;
  formation: string;
  fieldType: FieldType;
  players: PlayerToken[];
  lines: DrawnLine[];
  savedAt: number;
};

async function loadAllBoards(): Promise<TacticBoard[]> {
  try {
    const raw = await AsyncStorage.getItem(getTacticalStorageKey());
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveBoardToStorage(board: TacticBoard): Promise<void> {
  const all = await loadAllBoards();
  const idx = all.findIndex(b => b.id === board.id);
  if (idx >= 0) all[idx] = board; else all.unshift(board);
  await AsyncStorage.setItem(getTacticalStorageKey(), JSON.stringify(all));
}

// ─── Dimensions ───────────────────────────────────────────────────────────────
const SCREEN_W = Dimensions.get("window").width;
const FW = SCREEN_W - 32;

type FieldType = "full" | "half" | "threequarter";
type DrawMode = "move" | "arrow" | "line";
type TeamType = "home" | "away" | "ball";

interface PlayerToken {
  id: number;
  x: number;
  y: number;
  label: string;
  color: string;
  team: TeamType;
}

interface DrawnLine {
  id: number;
  x1: number; y1: number;
  x2: number; y2: number;
  type: "arrow" | "line";
}

const FH_MAP: Record<FieldType, number> = {
  full: FW * 1.55,
  half: FW * 0.85,
  threequarter: FW * 1.18,
};

// ─── Formations ───────────────────────────────────────────────────────────────
const FORMATIONS: Record<string, { label: string; positions: { x: number; y: number; label: string; color: string }[] }> = {
  "4-3-3": {
    label: "4-3-3",
    positions: [
      { x: 0.50, y: 0.91, label: "POR", color: "#1abc9c" },
      { x: 0.15, y: 0.76, label: "TD",  color: "#3498db" },
      { x: 0.38, y: 0.76, label: "DC",  color: "#3498db" },
      { x: 0.62, y: 0.76, label: "DC",  color: "#3498db" },
      { x: 0.85, y: 0.76, label: "TS",  color: "#3498db" },
      { x: 0.25, y: 0.55, label: "MCB", color: "#f1c40f" },
      { x: 0.50, y: 0.50, label: "MC",  color: "#f1c40f" },
      { x: 0.75, y: 0.55, label: "MCO", color: "#f1c40f" },
      { x: 0.18, y: 0.26, label: "ES",  color: "#e74c3c" },
      { x: 0.50, y: 0.20, label: "AC",  color: "#e74c3c" },
      { x: 0.82, y: 0.26, label: "ED",  color: "#e74c3c" },
    ],
  },
  "4-4-2": {
    label: "4-4-2",
    positions: [
      { x: 0.50, y: 0.91, label: "POR", color: "#1abc9c" },
      { x: 0.15, y: 0.76, label: "TD",  color: "#3498db" },
      { x: 0.38, y: 0.76, label: "DC",  color: "#3498db" },
      { x: 0.62, y: 0.76, label: "DC",  color: "#3498db" },
      { x: 0.85, y: 0.76, label: "TS",  color: "#3498db" },
      { x: 0.12, y: 0.53, label: "ED",  color: "#f1c40f" },
      { x: 0.38, y: 0.53, label: "MCB", color: "#f1c40f" },
      { x: 0.62, y: 0.53, label: "MC",  color: "#f1c40f" },
      { x: 0.88, y: 0.53, label: "ES",  color: "#f1c40f" },
      { x: 0.35, y: 0.24, label: "AT",  color: "#e74c3c" },
      { x: 0.65, y: 0.24, label: "AT",  color: "#e74c3c" },
    ],
  },
  "4-2-3-1": {
    label: "4-2-3-1",
    positions: [
      { x: 0.50, y: 0.91, label: "POR", color: "#1abc9c" },
      { x: 0.15, y: 0.76, label: "TD",  color: "#3498db" },
      { x: 0.38, y: 0.76, label: "DC",  color: "#3498db" },
      { x: 0.62, y: 0.76, label: "DC",  color: "#3498db" },
      { x: 0.85, y: 0.76, label: "TS",  color: "#3498db" },
      { x: 0.35, y: 0.60, label: "MCB", color: "#f1c40f" },
      { x: 0.65, y: 0.60, label: "MCB", color: "#f1c40f" },
      { x: 0.15, y: 0.40, label: "ED",  color: "#e67e22" },
      { x: 0.50, y: 0.38, label: "TRQ", color: "#e67e22" },
      { x: 0.85, y: 0.40, label: "ES",  color: "#e67e22" },
      { x: 0.50, y: 0.19, label: "AC",  color: "#e74c3c" },
    ],
  },
  "3-5-2": {
    label: "3-5-2",
    positions: [
      { x: 0.50, y: 0.91, label: "POR", color: "#1abc9c" },
      { x: 0.25, y: 0.76, label: "DC",  color: "#3498db" },
      { x: 0.50, y: 0.79, label: "DC",  color: "#3498db" },
      { x: 0.75, y: 0.76, label: "DC",  color: "#3498db" },
      { x: 0.08, y: 0.55, label: "CE",  color: "#f1c40f" },
      { x: 0.30, y: 0.52, label: "MCB", color: "#f1c40f" },
      { x: 0.50, y: 0.50, label: "MC",  color: "#f1c40f" },
      { x: 0.70, y: 0.52, label: "MCO", color: "#f1c40f" },
      { x: 0.92, y: 0.55, label: "CE",  color: "#f1c40f" },
      { x: 0.35, y: 0.24, label: "AT",  color: "#e74c3c" },
      { x: 0.65, y: 0.24, label: "AT",  color: "#e74c3c" },
    ],
  },
  "3-4-3": {
    label: "3-4-3",
    positions: [
      { x: 0.50, y: 0.91, label: "POR", color: "#1abc9c" },
      { x: 0.25, y: 0.76, label: "DC",  color: "#3498db" },
      { x: 0.50, y: 0.79, label: "DC",  color: "#3498db" },
      { x: 0.75, y: 0.76, label: "DC",  color: "#3498db" },
      { x: 0.08, y: 0.55, label: "CE",  color: "#f1c40f" },
      { x: 0.38, y: 0.53, label: "MCB", color: "#f1c40f" },
      { x: 0.62, y: 0.53, label: "MCO", color: "#f1c40f" },
      { x: 0.92, y: 0.55, label: "CE",  color: "#f1c40f" },
      { x: 0.18, y: 0.24, label: "ES",  color: "#e74c3c" },
      { x: 0.50, y: 0.19, label: "AC",  color: "#e74c3c" },
      { x: 0.82, y: 0.24, label: "ED",  color: "#e74c3c" },
    ],
  },
  "4-1-4-1": {
    label: "4-1-4-1",
    positions: [
      { x: 0.50, y: 0.91, label: "POR", color: "#1abc9c" },
      { x: 0.15, y: 0.77, label: "TD",  color: "#3498db" },
      { x: 0.38, y: 0.77, label: "DC",  color: "#3498db" },
      { x: 0.62, y: 0.77, label: "DC",  color: "#3498db" },
      { x: 0.85, y: 0.77, label: "TS",  color: "#3498db" },
      { x: 0.50, y: 0.64, label: "MED", color: "#9b59b6" },
      { x: 0.10, y: 0.46, label: "ED",  color: "#f1c40f" },
      { x: 0.36, y: 0.44, label: "MC",  color: "#f1c40f" },
      { x: 0.64, y: 0.44, label: "MCO", color: "#f1c40f" },
      { x: 0.90, y: 0.46, label: "ES",  color: "#f1c40f" },
      { x: 0.50, y: 0.21, label: "AC",  color: "#e74c3c" },
    ],
  },
  "5-3-2": {
    label: "5-3-2",
    positions: [
      { x: 0.50, y: 0.91, label: "POR", color: "#1abc9c" },
      { x: 0.08, y: 0.73, label: "CE",  color: "#3498db" },
      { x: 0.28, y: 0.77, label: "DC",  color: "#3498db" },
      { x: 0.50, y: 0.79, label: "DC",  color: "#3498db" },
      { x: 0.72, y: 0.77, label: "DC",  color: "#3498db" },
      { x: 0.92, y: 0.73, label: "CE",  color: "#3498db" },
      { x: 0.25, y: 0.52, label: "MCB", color: "#f1c40f" },
      { x: 0.50, y: 0.50, label: "MC",  color: "#f1c40f" },
      { x: 0.75, y: 0.52, label: "MCO", color: "#f1c40f" },
      { x: 0.35, y: 0.24, label: "AT",  color: "#e74c3c" },
      { x: 0.65, y: 0.24, label: "AT",  color: "#e74c3c" },
    ],
  },
};

function calcArrowHead(x1: number, y1: number, x2: number, y2: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const L = 14;
  const spread = 0.42;
  return {
    ax: x2 - L * Math.cos(angle - spread),
    ay: y2 - L * Math.sin(angle - spread),
    bx: x2 - L * Math.cos(angle + spread),
    by: y2 - L * Math.sin(angle + spread),
  };
}

function buildPlayers(formKey: string, fh: number): PlayerToken[] {
  return FORMATIONS[formKey].positions.map((p, i) => ({
    id: i,
    x: p.x * FW,
    y: p.y * fh,
    label: p.label,
    color: p.color,
    team: "home" as TeamType,
  }));
}

// ─── Field SVG components — always green, hardcoded ──────────────────────────
function FieldFull({ fh }: { fh: number }) {
  const W = FW; const H = fh; const pad = 12;
  return (
    <>
      <Rect x="0" y="0" width={W} height={H} fill="#1a4a22" rx="12" />
      {[0,1,2,3,4,5,6,7,8,9].map(i => (
        <Rect key={i} x="0" y={i * H / 10} width={W} height={H / 20} fill="#1e5428" opacity="0.4" />
      ))}
      <Rect x={pad} y={pad} width={W - pad * 2} height={H - pad * 2} fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.65" />
      <Line x1={pad} y1={H / 2} x2={W - pad} y2={H / 2} stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
      <Circle cx={W / 2} cy={H / 2} r={W * 0.155} fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
      <Circle cx={W / 2} cy={H / 2} r="4" fill="white" opacity="0.6" />
      <Rect x={W * 0.21} y={pad} width={W * 0.58} height={H * 0.16} fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.55" />
      <Rect x={W * 0.21} y={H - H * 0.16 - pad} width={W * 0.58} height={H * 0.16} fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.55" />
      <Rect x={W * 0.34} y={pad} width={W * 0.32} height={H * 0.07} fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
      <Rect x={W * 0.34} y={H - H * 0.07 - pad} width={W * 0.32} height={H * 0.07} fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
      <Rect x={W * 0.38} y={2} width={W * 0.24} height={pad} fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.85" />
      <Rect x={W * 0.38} y={H - pad - 2} width={W * 0.24} height={pad} fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.85" />
      <Circle cx={W / 2} cy={H * 0.115 + pad} r="3" fill="white" opacity="0.6" />
      <Circle cx={W / 2} cy={H - H * 0.115 - pad} r="3" fill="white" opacity="0.6" />
    </>
  );
}

function FieldHalf({ fh }: { fh: number }) {
  const W = FW; const H = fh; const pad = 12;
  return (
    <>
      <Rect x="0" y="0" width={W} height={H} fill="#1a4a22" rx="12" />
      {[0,1,2,3,4,5].map(i => (
        <Rect key={i} x="0" y={i * H / 6} width={W} height={H / 12} fill="#1e5428" opacity="0.4" />
      ))}
      <Rect x={pad} y={pad} width={W - pad * 2} height={H - pad * 2} fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.65" />
      <Rect x={W * 0.38} y={2} width={W * 0.24} height={pad} fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.85" />
      <Rect x={W * 0.34} y={pad} width={W * 0.32} height={H * 0.14} fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
      <Rect x={W * 0.21} y={pad} width={W * 0.58} height={H * 0.33} fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.55" />
      <Circle cx={W / 2} cy={pad + H * 0.22} r="3" fill="white" opacity="0.6" />
      <Line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="white" strokeWidth="2.5" strokeOpacity="0.8" />
      <Circle cx={W / 2} cy={H - pad} r="4" fill="white" opacity="0.6" />
      <Path d={`M ${pad} ${pad + 18} A 18 18 0 0 1 ${pad + 18} ${pad}`} fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.55" />
      <Path d={`M ${W - pad - 18} ${pad} A 18 18 0 0 1 ${W - pad} ${pad + 18}`} fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.55" />
    </>
  );
}

function FieldThreeQuarter({ fh }: { fh: number }) {
  const W = FW; const H = fh; const pad = 12;
  const midY = H * 0.70;
  return (
    <>
      <Rect x="0" y="0" width={W} height={H} fill="#1a4a22" rx="12" />
      {[0,1,2,3,4,5,6,7].map(i => (
        <Rect key={i} x="0" y={i * H / 8} width={W} height={H / 16} fill="#1e5428" opacity="0.4" />
      ))}
      <Rect x={pad} y={pad} width={W - pad * 2} height={H - pad * 2} fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.65" />
      <Rect x={W * 0.38} y={2} width={W * 0.24} height={pad} fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.85" />
      <Rect x={W * 0.34} y={pad} width={W * 0.32} height={H * 0.11} fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
      <Rect x={W * 0.21} y={pad} width={W * 0.58} height={H * 0.24} fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.55" />
      <Circle cx={W / 2} cy={pad + H * 0.16} r="3" fill="white" opacity="0.6" />
      <Line x1={pad} y1={midY} x2={W - pad} y2={midY} stroke="white" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="8,5" />
      <Circle cx={W / 2} cy={midY} r="4" fill="white" opacity="0.5" />
      <Path d={`M ${pad} ${pad + 18} A 18 18 0 0 1 ${pad + 18} ${pad}`} fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.55" />
      <Path d={`M ${W - pad - 18} ${pad} A 18 18 0 0 1 ${W - pad} ${pad + 18}`} fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.55" />
    </>
  );
}

interface SingleLineProps {
  line: { x1: number; y1: number; x2: number; y2: number; type: "arrow" | "line" };
  opacity?: number;
}
function SingleLine({ line, opacity = 0.95 }: SingleLineProps) {
  const color = line.type === "arrow" ? "#ff6b6b" : "#f1c40f";
  const ah = calcArrowHead(line.x1, line.y1, line.x2, line.y2);
  const d = `M ${line.x2} ${line.y2} L ${ah.ax} ${ah.ay} L ${ah.bx} ${ah.by} Z`;
  return (
    <G>
      <Line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke={color} strokeWidth="2.8" strokeOpacity={opacity} strokeDasharray={line.type === "line" ? "7,5" : undefined} />
      {line.type === "arrow" && <Path d={d} fill={color} opacity={opacity} />}
    </G>
  );
}

interface DrawnLinesProps {
  lines: DrawnLine[];
  preview: { x1: number; y1: number; x2: number; y2: number; type: "arrow" | "line" } | null;
}
function DrawnLines({ lines, preview }: DrawnLinesProps) {
  return (
    <>
      {preview !== null && <SingleLine line={preview} opacity={0.55} />}
      {lines.map(a => <SingleLine key={a.id} line={a} opacity={0.95} />)}
    </>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function TacticalScreen() {
  const c = useTheme((s) => s.colors);
  const s = useMemo(() => mkStyles(c), [c]);
  const { t } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ boardId?: string; boardData?: string }>();

  const [fieldType, setFieldType] = useState<FieldType>("full");
  const [formation, setFormation] = useState("4-3-3");
  const [players, setPlayers] = useState<PlayerToken[]>([]);
  const [lines, setLines] = useState<DrawnLine[]>([]);
  const [drawMode, setDrawMode] = useState<DrawMode>("move");
  const [preview, setPreview] = useState<{ x1: number; y1: number; x2: number; y2: number; type: "arrow" | "line" } | null>(null);
  const [draggingIdState, setDraggingIdState] = useState<number | null>(null);
  // Available height for the field area (measured at runtime)
  const [fieldAreaHeight, setFieldAreaHeight] = useState(0);

  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [currentBoardName, setCurrentBoardName] = useState<string>("");

  const fhNatural = FH_MAP[fieldType];
  // Scale field to fit the available area without scrolling
  const scale = fieldAreaHeight > 0 && fhNatural > fieldAreaHeight
    ? fieldAreaHeight / fhNatural
    : 1;
  const fh = fhNatural; // keep native coords, apply CSS scale on container

  const drawModeRef = useRef<DrawMode>("move");
  const playersRef = useRef(players);
  const linesRef = useRef(lines);
  const fhRef = useRef(fh);
  const lineCounter = useRef(1000);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragStart = useRef({ ox: 0, oy: 0 });
  // Absolute position of the field view on screen (for pageX/Y → local coord conversion)
  const fieldViewRef = useRef<View>(null);
  const fieldOrigin = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const draggingId = useRef<number | null>(null);
  const playerPRs = useRef<Record<number, ReturnType<typeof PanResponder.create>>>({});

  type Snapshot = { players: PlayerToken[]; lines: DrawnLine[] };
  const undoStack = useRef<Snapshot[]>([]);

  const pushUndo = useCallback((snap: Snapshot) => {
    undoStack.current = [...undoStack.current.slice(-49), snap];
  }, []);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current[undoStack.current.length - 1];
    undoStack.current = undoStack.current.slice(0, -1);
    setPlayers(prev.players);
    setLines(prev.lines);
    playerPRs.current = {};
  }, []);

  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { linesRef.current = lines; }, [lines]);
  useEffect(() => { fhRef.current = fh; }, [fh]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  // Re-measure field origin whenever scale changes (transform shifts visual position)
  useEffect(() => {
    fieldViewRef.current?.measure((_x, _y, _w, _h, px, py) => {
      fieldOrigin.current = { x: px, y: py };
    });
  }, [scale]);

  useEffect(() => {
    if (params.boardData) {
      try {
        const board: TacticBoard = JSON.parse(decodeURIComponent(params.boardData as string));
        setFieldType(board.fieldType);
        setFormation(board.formation);
        setPlayers(board.players);
        setLines(board.lines);
        setCurrentBoardId(board.id);
        setCurrentBoardName(board.name);
        playerPRs.current = {};
        undoStack.current = [];
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeFormation = (f: string) => {
    undoStack.current = [];
    setFormation(f);
    setPlayers(buildPlayers(f, fh));
    setLines([]);
    setPreview(null);
    playerPRs.current = {};
  };

  const changeField = (ft: FieldType) => {
    undoStack.current = [];
    const oldFH = FH_MAP[fieldType];
    const newFH = FH_MAP[ft];
    setFieldType(ft);
    // Rescale existing player Y coords proportionally to new field height
    setPlayers(prev => prev.map(p => ({ ...p, y: (p.y / oldFH) * newFH })));
    setLines([]);
    setPreview(null);
    playerPRs.current = {};
  };

  const addHomePlayer = () => {
    pushUndo({ players: playersRef.current, lines: linesRef.current });
    const homeCount = playersRef.current.filter(p => p.team === "home").length;
    const newId = Date.now();
    const col = homeCount % 5;
    const row = Math.floor(homeCount / 5);
    setPlayers(prev => [...prev, {
      id: newId,
      x: FW * (0.15 + col * 0.175),
      y: fhRef.current * (0.75 - row * 0.18),
      label: "",
      color: "#3498db",
      team: "home",
    }]);
  };

  const addAwayPlayer = () => {
    pushUndo({ players: playersRef.current, lines: linesRef.current });
    const awayCount = playersRef.current.filter(p => p.team === "away").length;
    const newId = Date.now();
    const col = awayCount % 5;
    const row = Math.floor(awayCount / 5);
    setPlayers(prev => [...prev, {
      id: newId,
      x: FW * (0.15 + col * 0.175),
      y: fhRef.current * (0.28 - row * 0.18),
      label: "",
      color: "#e74c3c",
      team: "away",
    }]);
  };

  const addBall = () => {
    pushUndo({ players: playersRef.current, lines: linesRef.current });
    const newId = Date.now() + 1;
    setPlayers(prev => [...prev, { id: newId, x: FW / 2, y: fhRef.current * 0.50, label: "⚽", color: "#ffffff", team: "ball" }]);
  };

  const getPlayerPR = useCallback((pid: number) => {
    if (!playerPRs.current[pid]) {
      playerPRs.current[pid] = PanResponder.create({
        onStartShouldSetPanResponder: () => drawModeRef.current === "move",
        onMoveShouldSetPanResponder: () => drawModeRef.current === "move",
        onStartShouldSetPanResponderCapture: () => drawModeRef.current === "move",
        onPanResponderGrant: () => {
          draggingId.current = pid;
          setDraggingIdState(pid);
          const pl = playersRef.current.find(p => p.id === pid);
          if (pl) {
            dragStart.current = { ox: pl.x, oy: pl.y };
            pushUndo({ players: playersRef.current, lines: linesRef.current });
          }
        },
        onPanResponderMove: (_: GestureResponderEvent, g: PanResponderGestureState) => {
          const maxY = fhRef.current - 18;
          const nx = Math.max(18, Math.min(FW - 18, dragStart.current.ox + g.dx));
          const ny = Math.max(18, Math.min(maxY, dragStart.current.oy + g.dy));
          setPlayers(prev => prev.map(p => p.id === pid ? { ...p, x: nx, y: ny } : p));
        },
        onPanResponderRelease: () => { draggingId.current = null; setDraggingIdState(null); },
        onPanResponderTerminate: () => { draggingId.current = null; setDraggingIdState(null); },
      });
    }
    return playerPRs.current[pid];
  }, []);

  // Convert a raw touch event to field-local coordinates, accounting for scale transform.
  // pageX/Y are absolute screen coords; fieldOrigin is the unscaled top-left of the field view.
  // Because we apply CSS scale from the center, the visual origin is shifted:
  //   visualOriginX = fieldOrigin.x - (FW * (1 - s) / 2)
  //   localX = (pageX - visualOriginX) / s
  const toFieldCoords = useCallback((pageX: number, pageY: number): { x: number; y: number } => {
    const s = scaleRef.current;
    const ox = fieldOrigin.current.x - (FW * (1 - s)) / 2;
    const oy = fieldOrigin.current.y - (fhRef.current * (1 - s)) / 2;
    return {
      x: Math.max(0, Math.min(FW, (pageX - ox) / s)),
      y: Math.max(0, Math.min(fhRef.current, (pageY - oy) / s)),
    };
  }, []);

  const fieldPR = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => drawModeRef.current !== "move",
      onMoveShouldSetPanResponder: () => drawModeRef.current !== "move",
      onStartShouldSetPanResponderCapture: () => drawModeRef.current !== "move",
      onMoveShouldSetPanResponderCapture: () => drawModeRef.current !== "move",
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const { pageX, pageY } = e.nativeEvent;
        const { x, y } = toFieldCoords(pageX, pageY);
        drawStartRef.current = { x, y };
        const mode = drawModeRef.current as "arrow" | "line";
        setPreview({ x1: x, y1: y, x2: x, y2: y, type: mode });
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        if (!drawStartRef.current) return;
        const { pageX, pageY } = e.nativeEvent;
        const { x: x2, y: y2 } = toFieldCoords(pageX, pageY);
        const mode = drawModeRef.current as "arrow" | "line";
        setPreview({ x1: drawStartRef.current.x, y1: drawStartRef.current.y, x2, y2, type: mode });
      },
      onPanResponderRelease: (e: GestureResponderEvent) => {
        if (!drawStartRef.current) return;
        const { pageX, pageY } = e.nativeEvent;
        const { x: x2, y: y2 } = toFieldCoords(pageX, pageY);
        const dx = x2 - drawStartRef.current.x;
        const dy = y2 - drawStartRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 8) {
          const mode = drawModeRef.current as "arrow" | "line";
          const { x: x1, y: y1 } = drawStartRef.current;
          pushUndo({ players: playersRef.current, lines: linesRef.current });
          setLines(prev => [...prev, { id: lineCounter.current++, x1, y1, x2, y2, type: mode }]);
        }
        drawStartRef.current = null;
        setPreview(null);
      },
      onPanResponderTerminate: () => {
        drawStartRef.current = null;
        setPreview(null);
      },
    })
  ).current;

  const renderField = () => {
    if (fieldType === "full") return <FieldFull fh={fh} />;
    if (fieldType === "half") return <FieldHalf fh={fh} />;
    return <FieldThreeQuarter fh={fh} />;
  };

  const handleSave = async (name: string) => {
    const board: TacticBoard = {
      id: currentBoardId ?? `board_${Date.now()}`,
      name: name.trim() || t("Schema senza nome", "Untitled scheme"),
      formation,
      fieldType,
      players,
      lines,
      savedAt: Date.now(),
    };
    await saveBoardToStorage(board);
    setCurrentBoardId(board.id);
    setCurrentBoardName(board.name);
    setSaveModalVisible(false);
    Alert.alert(t("Salvato!", "Saved!"), `"${board.name}"`);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      {/* Save modal */}
      <Modal visible={saveModalVisible} transparent animationType="fade" onRequestClose={() => setSaveModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t("Salva schema", "Save scheme")}</Text>
            <TextInput
              style={s.modalInput}
              value={saveName}
              onChangeText={setSaveName}
              placeholder={t("Nome schema...", "Scheme name...")}
              placeholderTextColor={c.textMuted}
              autoFocus
              onSubmitEditing={() => handleSave(saveName)}
            />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setSaveModalVisible(false)}>
                <Text style={s.modalBtnCancelTxt}>{t("Annulla", "Cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnSave} onPress={() => handleSave(saveName)}>
                <Text style={s.modalBtnSaveTxt}>{t("Salva", "Save")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={s.back} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft color={c.text} size={22} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{currentBoardName || t("Campo Tattico", "Tactical Board")}</Text>
        </View>
        <View style={s.topActions}>
          <TouchableOpacity style={s.iconBtn} onPress={undo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowCounterClockwise color={c.textMuted} size={18} />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={() => { pushUndo({ players: playersRef.current, lines: linesRef.current }); setLines([]); setPlayers([]); playerPRs.current = {}; }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Eraser color={c.textMuted} size={18} />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.replace("/tactical-library")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FolderOpen color={c.textMuted} size={18} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: c.primary, borderColor: c.primary }]} onPress={() => { setSaveName(currentBoardName || ""); setSaveModalVisible(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FloppyDisk color="#fff" size={18} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Field type selector */}
      <View style={s.fieldTypeRow}>
        {(["full", "half", "threequarter"] as FieldType[]).map(ft => (
          <TouchableOpacity key={ft} style={[s.ftChip, fieldType === ft && s.ftChipActive]} onPress={() => changeField(ft)} activeOpacity={0.8}>
            <Text style={[s.ftText, fieldType === ft && s.ftTextActive]}>
              {ft === "full" ? t("Intero", "Full") : ft === "half" ? t("Metà", "Half") : t("¾ Campo", "¾ Field")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Formation selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.formRow} style={s.formScroll}>
        {Object.keys(FORMATIONS).map(f => (
          <TouchableOpacity key={f} style={[s.formChip, formation === f && s.formChipActive]} onPress={() => changeFormation(f)} activeOpacity={0.8}>
            <Text style={[s.formText, formation === f && s.formTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Toolbar */}
      <View style={s.toolbar}>
        <TouchableOpacity style={[s.toolBtn, drawMode === "move" && s.toolBtnMove]} onPress={() => setDrawMode("move")} activeOpacity={0.8}>
          <Cursor color={drawMode === "move" ? "#fff" : c.textMuted} size={13} />
          <Text style={[s.toolTxt, drawMode === "move" && { color: "#fff" }]}>{t("Muovi", "Move")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.toolBtn, drawMode === "arrow" && s.toolBtnArrow]} onPress={() => setDrawMode(drawMode === "arrow" ? "move" : "arrow")} activeOpacity={0.8}>
          <ArrowRight color={drawMode === "arrow" ? "#fff" : c.textMuted} size={13} />
          <Text style={[s.toolTxt, drawMode === "arrow" && { color: "#fff" }]}>{t("Freccia", "Arrow")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.toolBtn, drawMode === "line" && s.toolBtnLine]} onPress={() => setDrawMode(drawMode === "line" ? "move" : "line")} activeOpacity={0.8}>
          <Minus color={drawMode === "line" ? "#fff" : c.textMuted} size={13} />
          <Text style={[s.toolTxt, drawMode === "line" && { color: "#fff" }]}>{t("Linea", "Line")}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={[s.toolBtn, { borderColor: "#ffffff66" }]} onPress={addBall} activeOpacity={0.8}>
          <Text style={[s.toolTxt, { fontSize: 13 }]}>⚽</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.toolBtn, { borderColor: "#3498db" }]} onPress={addHomePlayer} activeOpacity={0.8}>
          <Text style={[s.toolTxt, { color: "#3498db", fontSize: 11 }]}>+{t("Casa", "Home")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.toolBtn, { borderColor: "#e74c3c" }]} onPress={addAwayPlayer} activeOpacity={0.8}>
          <Text style={[s.toolTxt, { color: "#e74c3c", fontSize: 11 }]}>+{t("AV", "OPP")}</Text>
        </TouchableOpacity>
      </View>

      {/* Field — fixed, no scroll, scales to fit available height */}
      <View
        style={s.fieldArea}
        onLayout={(e: LayoutChangeEvent) => setFieldAreaHeight(e.nativeEvent.layout.height)}
      >
        {fieldAreaHeight > 0 && (
          <View style={[
            s.fieldScaler,
            {
              width: FW,
              height: fh,
              transform: [{ scale }],
              marginTop: scale < 1 ? -(fh * (1 - scale)) / 2 : 0,
            },
          ]}>
            <View
              ref={fieldViewRef}
              style={[s.field, { width: FW, height: fh }]}
              onLayout={() => {
                fieldViewRef.current?.measure((_x, _y, _w, _h, px, py) => {
                  fieldOrigin.current = { x: px, y: py };
                });
              }}
              {...(drawMode !== "move" ? fieldPR.panHandlers : {})}
            >
              <Svg width={FW} height={fh} style={StyleSheet.absoluteFill} pointerEvents="none">
                {renderField()}
                <DrawnLines lines={lines} preview={preview} />
              </Svg>
              {players.map(p => {
                const pr = getPlayerPR(p.id);
                const isDragging = draggingIdState === p.id;
                const isBall = p.team === "ball";
                const isAway = p.team === "away";
                return (
                  <View
                    key={p.id}
                    style={[
                      s.token,
                      isBall && s.tokenBall,
                      {
                        left: p.x - 20,
                        top: p.y - 20,
                        backgroundColor: isBall ? "rgba(255,255,255,0.15)" : p.color,
                        borderColor: isDragging ? "#fff" : isBall ? "rgba(255,255,255,0.8)" : isAway ? "rgba(255,150,150,0.7)" : "rgba(255,255,255,0.55)",
                        borderWidth: isDragging ? 2.5 : isBall ? 2 : 1.5,
                        borderStyle: isAway ? "dashed" : "solid",
                        zIndex: isDragging ? 999 : isBall ? 50 : 10,
                        opacity: isDragging ? 0.85 : 1,
                        transform: [{ scale: isDragging ? 1.12 : 1 }],
                      },
                    ]}
                    {...pr.panHandlers}
                  >
                    {(p.label !== "") && (
                      <Text style={[s.tokenLabel, isBall && { fontSize: 18 }]}>{p.label}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* Legend */}
      <View style={s.legend}>
        {[
          { color: "#3498db", label: t("Casa", "Home"), dashed: false },
          { color: "#e74c3c", label: t("Avversario", "Away"), dashed: true },
        ].map((item, i) => (
          <View key={i} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: item.color }, item.dashed ? { borderWidth: 1, borderColor: "rgba(255,150,150,0.8)", borderStyle: "dashed" } : {}]} />
            <Text style={s.legendTxt}>{item.label}</Text>
          </View>
        ))}
        <Text style={[s.legendTxt, { color: c.textMuted, marginLeft: 8 }]}>{t("· seleziona modulo per ruoli", "· select formation for roles")}</Text>
      </View>
    </SafeAreaView>
  );
}

function mkStyles(c: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 10 },
    back: { padding: 4 },
    title: { flex: 1, fontSize: 17, fontWeight: "700", color: c.text },
    topActions: { flexDirection: "row", gap: 8 },
    iconBtn: { padding: 8, backgroundColor: c.bgCard, borderRadius: 10, borderWidth: 1, borderColor: c.border },

    fieldTypeRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
    ftChip: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCard },
    // Field chip active keeps hardcoded green — it's a pitch color not a UI theme color
    ftChipActive: { backgroundColor: "#2d6a4f", borderColor: "#52b788" },
    ftText: { fontSize: 11, fontWeight: "600", color: c.textMuted },
    ftTextActive: { color: "#b7e4c7" },

    formScroll: { flexGrow: 0 },
    formRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
    formChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCard },
    formChipActive: { backgroundColor: c.primary + "25", borderColor: c.primary },
    formText: { fontSize: 12, fontWeight: "600", color: c.textMuted },
    formTextActive: { color: c.primary },

    toolbar: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
    toolBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCard },
    toolBtnMove: { backgroundColor: c.primary, borderColor: c.primary },
    toolBtnArrow: { backgroundColor: "#c0392b", borderColor: "#c0392b" },
    toolBtnLine: { backgroundColor: "#b7950b", borderColor: "#b7950b" },
    toolTxt: { fontSize: 12, color: c.textMuted, fontWeight: "600" },

    fieldArea: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    fieldScaler: { alignSelf: "center" },
    field: { position: "relative", borderRadius: 12, overflow: "hidden" },

    token: {
      position: "absolute", width: 40, height: 40, borderRadius: 20,
      alignItems: "center", justifyContent: "center",
      elevation: 6,
      shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.5, shadowRadius: 4,
    },
    tokenBall: { width: 36, height: 36, borderRadius: 18 },
    tokenLabel: { fontSize: 7, fontWeight: "900", color: "white", textAlign: "center" },

    legend: { flexDirection: "row", justifyContent: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 8, flexWrap: "wrap" },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 3 },
    legendDot: { width: 9, height: 9, borderRadius: 5 },
    legendTxt: { fontSize: 10, color: c.textMuted, fontWeight: "600" },

    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 32 },
    modalCard: { width: "100%", backgroundColor: c.bgCard, borderRadius: 18, padding: 24, borderWidth: 1, borderColor: c.border },
    modalTitle: { fontSize: 18, fontWeight: "700", color: c.text, marginBottom: 16 },
    modalInput: { backgroundColor: c.bg, borderWidth: 1.5, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: c.text, marginBottom: 20 },
    modalBtns: { flexDirection: "row", gap: 10 },
    modalBtnCancel: { flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: c.border },
    modalBtnCancelTxt: { fontSize: 15, fontWeight: "600", color: c.textMuted },
    modalBtnSave: { flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 12, backgroundColor: c.primary },
    modalBtnSaveTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },
  });
}
