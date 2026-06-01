// Re-export everything from themeStore for convenience
export { useTheme } from './themeStore';
export type { ThemeColors, ThemeId } from './themeStore';
export { PRESET_GREEN, PRESET_DARK, PRESET_LIGHT, buildCustomTheme } from './themeStore';

// Static default colors — used only for StyleSheet.create() calls that run
// outside React (at module level). These stay green-dark as baseline.
// All runtime colors must come from useTheme().colors inside components.
export const colors = {
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

export const categoryColors: Record<string, string> = {
  riscaldamento: '#e67e22',
  tecnica: '#3498db',
  tattica: '#9b59b6',
  atletico: '#e74c3c',
  partitella: '#2ecc71',
  calci_piazzati: '#f1c40f',
  portieri: '#1abc9c',
};

export const categoryLabels: Record<string, { it: string; en: string }> = {
  riscaldamento: { it: 'Riscaldamento', en: 'Warm-up' },
  tecnica: { it: 'Tecnica', en: 'Technique' },
  tattica: { it: 'Tattica', en: 'Tactics' },
  atletico: { it: 'Atletismo', en: 'Athletic' },
  partitella: { it: 'Partitella', en: 'Scrimmage' },
  calci_piazzati: { it: 'Calci Piazzati', en: 'Set Pieces' },
  portieri: { it: 'Portieri', en: 'Goalkeepers' },
};

export const intensityColors: Record<string, string> = {
  bassa: '#2ecc71',
  media: '#f1c40f',
  alta: '#e74c3c',
};

export const intensityLabels: Record<string, { it: string; en: string }> = {
  bassa: { it: 'Bassa', en: 'Low' },
  media: { it: 'Media', en: 'Medium' },
  alta: { it: 'Alta', en: 'High' },
};
