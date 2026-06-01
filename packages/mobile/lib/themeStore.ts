import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeId = 'green' | 'dark' | 'light' | 'custom';

export interface ThemeColors {
  bg: string;
  bgCard: string;
  bgCardAlt: string;
  primary: string;
  primaryDark: string;
  accent: string;
  accentDark: string;
  white: string;
  text: string;
  textMuted: string;
  textDim: string;
  border: string;
  danger: string;
  dangerLight: string;
  // category colors — fixed
  riscaldamento: string;
  tecnica: string;
  tattica: string;
  atletico: string;
  partitella: string;
  calci_piazzati: string;
  portieri: string;
}

// ── Palette presets ──────────────────────────────────────────────────────────

export const PRESET_GREEN: ThemeColors = {
  bg: '#0d1f13',
  bgCard: '#1a2e1e',
  bgCardAlt: '#1f3a24',
  primary: '#2ecc71',
  primaryDark: '#27ae60',
  accent: '#f1c40f',
  accentDark: '#d4ac0d',
  white: '#ffffff',
  text: '#e8f5e9',
  textMuted: '#8fbc8f',
  textDim: '#5a8a5a',
  border: '#2d4a32',
  danger: '#e74c3c',
  dangerLight: '#ff6b6b',
  riscaldamento: '#e67e22',
  tecnica: '#3498db',
  tattica: '#9b59b6',
  atletico: '#e74c3c',
  partitella: '#2ecc71',
  calci_piazzati: '#f1c40f',
  portieri: '#1abc9c',
};

export const PRESET_DARK: ThemeColors = {
  bg: '#0a0a0a',
  bgCard: '#1a1a1a',
  bgCardAlt: '#222222',
  primary: '#e0e0e0',
  primaryDark: '#bdbdbd',
  accent: '#f1c40f',
  accentDark: '#d4ac0d',
  white: '#ffffff',
  text: '#f0f0f0',
  textMuted: '#888888',
  textDim: '#555555',
  border: '#2a2a2a',
  danger: '#e74c3c',
  dangerLight: '#ff6b6b',
  riscaldamento: '#e67e22',
  tecnica: '#3498db',
  tattica: '#9b59b6',
  atletico: '#e74c3c',
  partitella: '#2ecc71',
  calci_piazzati: '#f1c40f',
  portieri: '#1abc9c',
};

export const PRESET_LIGHT: ThemeColors = {
  bg: '#f4f6f8',
  bgCard: '#ffffff',
  bgCardAlt: '#eef1f4',
  primary: '#1a8a4a',
  primaryDark: '#136e3a',
  accent: '#d4a017',
  accentDark: '#b8870e',
  white: '#ffffff',
  text: '#1a1a1a',
  textMuted: '#555555',
  textDim: '#999999',
  border: '#dde1e7',
  danger: '#c0392b',
  dangerLight: '#e74c3c',
  riscaldamento: '#e67e22',
  tecnica: '#2980b9',
  tattica: '#8e44ad',
  atletico: '#c0392b',
  partitella: '#27ae60',
  calci_piazzati: '#d4a017',
  portieri: '#16a085',
};

// Build a custom theme from two brand colors
export function buildCustomTheme(primary: string, accent: string): ThemeColors {
  // Derive bg/card from primary (darkened)
  const bg = blendWithBlack(primary, 0.85);
  const bgCard = blendWithBlack(primary, 0.75);
  const bgCardAlt = blendWithBlack(primary, 0.70);
  const border = blendWithBlack(primary, 0.55);
  const text = isLight(bg) ? '#1a1a1a' : '#f0f0f0';
  const textMuted = isLight(bg) ? '#555555' : '#aaaaaa';
  const textDim = isLight(bg) ? '#999999' : '#666666';
  const primaryDark = blendWithBlack(primary, 0.15);
  const accentDark = blendWithBlack(accent, 0.15);

  return {
    bg, bgCard, bgCardAlt,
    primary, primaryDark,
    accent, accentDark,
    white: '#ffffff',
    text, textMuted, textDim, border,
    danger: '#e74c3c',
    dangerLight: '#ff6b6b',
    riscaldamento: '#e67e22',
    tecnica: '#3498db',
    tattica: '#9b59b6',
    atletico: '#e74c3c',
    partitella: primary,
    calci_piazzati: accent,
    portieri: '#1abc9c',
  };
}

// ── Color math helpers ───────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

function blendWithBlack(hex: string, darkness: number): string {
  try {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(r * (1 - darkness), g * (1 - darkness), b * (1 - darkness));
  } catch { return '#111111'; }
}

function isLight(hex: string): boolean {
  try {
    const [r, g, b] = hexToRgb(hex);
    return (r * 299 + g * 587 + b * 114) / 1000 > 128;
  } catch { return false; }
}

// ── Store ────────────────────────────────────────────────────────────────────

interface ThemeStore {
  themeId: ThemeId;
  customPrimary: string;
  customAccent: string;
  colors: ThemeColors;

  setTheme: (id: ThemeId) => void;
  setCustomColors: (primary: string, accent: string) => void;

  load: () => Promise<void>;
  _persist: () => Promise<void>;
}

const STORAGE_KEY = 'misterprolab_theme_v1';

function resolveColors(id: ThemeId, customPrimary: string, customAccent: string): ThemeColors {
  switch (id) {
    case 'dark': return PRESET_DARK;
    case 'light': return PRESET_LIGHT;
    case 'custom': return buildCustomTheme(customPrimary, customAccent);
    default: return PRESET_GREEN;
  }
}

export const useTheme = create<ThemeStore>((set, get) => ({
  themeId: 'green',
  customPrimary: '#e63946',
  customAccent: '#f1c40f',
  colors: PRESET_GREEN,

  setTheme: (id) => {
    const { customPrimary, customAccent } = get();
    set({ themeId: id, colors: resolveColors(id, customPrimary, customAccent) });
    get()._persist();
  },

  setCustomColors: (primary, accent) => {
    set({ customPrimary: primary, customAccent: accent, colors: buildCustomTheme(primary, accent) });
    get()._persist();
  },

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const id: ThemeId = data.themeId ?? 'green';
        const cp = data.customPrimary ?? '#e63946';
        const ca = data.customAccent ?? '#f1c40f';
        set({ themeId: id, customPrimary: cp, customAccent: ca, colors: resolveColors(id, cp, ca) });
      }
    } catch (_) {}
  },

  _persist: async () => {
    try {
      const { themeId, customPrimary, customAccent } = get();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ themeId, customPrimary, customAccent }));
    } catch (_) {}
  },
}));
