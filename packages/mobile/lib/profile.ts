import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface TeamProfile {
  id: string;
  name: string;
  season: string;      // es. "2024/25"
  logoUri: string | null;
}

export interface CoachProfile {
  firstName: string;
  lastName: string;
  nickname: string;    // soprannome — se presente sovrascrive nome+cognome nella home
}

interface ProfileStore {
  coach: CoachProfile;
  teams: TeamProfile[];
  activeTeamId: string | null;

  setCoach: (c: Partial<CoachProfile>) => void;
  addTeam: (t: TeamProfile) => void;
  updateTeam: (id: string, t: Partial<TeamProfile>) => void;
  removeTeam: (id: string) => void;
  setActiveTeam: (id: string | null) => void;

  // computed
  displayName: () => string;
  activeTeam: () => TeamProfile | null;

  // persistence
  load: () => Promise<void>;
  save: () => Promise<void>;
}

const STORAGE_KEY = 'misterprolab_profile_v1';

// ─── Web-only: serialize coach+teams into name/teamName for the API ───────────
function toApiProfile(coach: CoachProfile, teams: TeamProfile[], activeTeamId: string | null) {
  const name = coach.nickname?.trim() || [coach.firstName, coach.lastName].filter(Boolean).join(' ');
  const activeTeam = teams.find(t => t.id === activeTeamId);
  const teamName = activeTeam?.name ?? (teams[0]?.name ?? '');
  // Store full state as JSON inside logoUrl field is not ideal — use a special key
  // We store teams/activeTeamId as JSON in a dedicated way via a separate localStorage key
  // but sync name/teamName/logoUrl to the server
  return { name, teamName, logoUrl: activeTeam?.logoUri ?? null };
}

async function webLoad() {
  try {
    const { apiGet } = await import('./authStore');
    const data = await apiGet('/profile');
    if (!data) return null;
    // Also load full local state from localStorage (teams list etc.)
    const localRaw = localStorage.getItem(STORAGE_KEY);
    const local = localRaw ? JSON.parse(localRaw) : null;
    // Merge: server wins for name/teamName, local wins for teams structure
    let coach: CoachProfile = local?.coach ?? { firstName: '', lastName: '', nickname: '' };
    let teams: TeamProfile[] = local?.teams ?? [];
    let activeTeamId: string | null = local?.activeTeamId ?? null;
    // If server has a name and we have no local coach data, populate from server
    if (data.name && !coach.firstName && !coach.nickname) {
      coach = { ...coach, nickname: data.name };
    }
    // If server has teamName and no local teams, create one
    if (data.teamName && teams.length === 0) {
      const t: TeamProfile = { id: 'default', name: data.teamName, season: '', logoUri: data.logoUrl ?? null };
      teams = [t];
      activeTeamId = 'default';
    } else if (data.teamName && activeTeamId) {
      // Sync active team name from server
      teams = teams.map(t => t.id === activeTeamId ? { ...t, name: data.teamName, logoUri: data.logoUrl ?? t.logoUri } : t);
    }
    return { coach, teams, activeTeamId };
  } catch { return null; }
}

async function webSave(coach: CoachProfile, teams: TeamProfile[], activeTeamId: string | null) {
  // Save full state locally
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ coach, teams, activeTeamId }));
  // Sync name/teamName/logoUrl to server
  try {
    const { apiPut } = await import('./authStore');
    await apiPut('/profile', toApiProfile(coach, teams, activeTeamId));
  } catch {}
}

export const useProfile = create<ProfileStore>((set, get) => ({
  coach: { firstName: '', lastName: '', nickname: '' },
  teams: [],
  activeTeamId: null,

  setCoach: (c) => {
    set((s) => ({ coach: { ...s.coach, ...c } }));
    get().save();
  },

  addTeam: (t) => {
    set((s) => ({
      teams: [...s.teams, t],
      activeTeamId: s.activeTeamId ?? t.id,
    }));
    get().save();
  },

  updateTeam: (id, t) => {
    set((s) => ({
      teams: s.teams.map((tm) => (tm.id === id ? { ...tm, ...t } : tm)),
    }));
    get().save();
  },

  removeTeam: (id) => {
    set((s) => {
      const teams = s.teams.filter((t) => t.id !== id);
      const activeTeamId =
        s.activeTeamId === id ? (teams[0]?.id ?? null) : s.activeTeamId;
      return { teams, activeTeamId };
    });
    get().save();
  },

  setActiveTeam: (id) => {
    set({ activeTeamId: id });
    get().save();
  },

  displayName: () => {
    const { coach } = get();
    if (coach.nickname?.trim()) return coach.nickname.trim();
    const full = [coach.firstName, coach.lastName].filter(Boolean).join(' ');
    return full || '';
  },

  activeTeam: () => {
    const { teams, activeTeamId } = get();
    return teams.find((t) => t.id === activeTeamId) ?? null;
  },

  load: async () => {
    try {
      if (Platform.OS === 'web') {
        const data = await webLoad();
        if (data) set(data);
      } else {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          set({
            coach: data.coach ?? { firstName: '', lastName: '', nickname: '' },
            teams: data.teams ?? [],
            activeTeamId: data.activeTeamId ?? null,
          });
        }
      }
    } catch (_) {}
  },

  save: async () => {
    try {
      if (Platform.OS === 'web') {
        const { coach, teams, activeTeamId } = get();
        await webSave(coach, teams, activeTeamId);
      } else {
        const { coach, teams, activeTeamId } = get();
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ coach, teams, activeTeamId }));
      }
    } catch (_) {}
  },
}));
