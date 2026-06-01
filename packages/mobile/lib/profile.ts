import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({
          coach: data.coach ?? { firstName: '', lastName: '', nickname: '' },
          teams: data.teams ?? [],
          activeTeamId: data.activeTeamId ?? null,
        });
      }
    } catch (_) {}
  },

  save: async () => {
    try {
      const { coach, teams, activeTeamId } = get();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ coach, teams, activeTeamId }));
    } catch (_) {}
  },
}));
