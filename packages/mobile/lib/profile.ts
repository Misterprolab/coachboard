import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface TeamProfile {
  id: string;
  name: string;
  season: string;
  logoUri: string | null;
}

export interface CoachProfile {
  firstName: string;
  lastName: string;
  nickname: string;
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

  displayName: () => string;
  activeTeam: () => TeamProfile | null;

  load: () => Promise<void>;
  save: () => Promise<void>;
}

const BASE_KEY = 'misterprolab_profile_v2';

function storageKey(): string {
  // Per-user key — uses email stored by authStore
  try {
    const email = localStorage.getItem('cb_auth_email') ?? 'default';
    return `${BASE_KEY}_${email}`;
  } catch { return BASE_KEY; }
}

function toApiProfile(coach: CoachProfile, teams: TeamProfile[], activeTeamId: string | null) {
  const name = coach.nickname?.trim() || [coach.firstName, coach.lastName].filter(Boolean).join(' ');
  const activeTeam = teams.find(t => t.id === activeTeamId);
  const teamName = activeTeam?.name ?? (teams[0]?.name ?? '');
  return { name, teamName, logoUrl: activeTeam?.logoUri ?? null };
}

async function webLoad() {
  try {
    const { apiGet } = await import('./authStore');
    // Load from server first (source of truth for name/teamName)
    const serverData = await apiGet('/profile');

    // Load local structure (teams list) from per-user key
    const key = storageKey();
    const localRaw = localStorage.getItem(key);
    const local = localRaw ? JSON.parse(localRaw) : null;

    let coach: CoachProfile = local?.coach ?? { firstName: '', lastName: '', nickname: '' };
    let teams: TeamProfile[] = local?.teams ?? [];
    let activeTeamId: string | null = local?.activeTeamId ?? null;

    // If server has data AND no local data → populate from server
    if (serverData?.name && !local) {
      coach = { firstName: '', lastName: '', nickname: serverData.name };
    }
    if (serverData?.teamName && teams.length === 0 && serverData.teamName !== '') {
      const t: TeamProfile = { id: 'default', name: serverData.teamName, season: '', logoUri: serverData.logoUrl ?? null };
      teams = [t];
      activeTeamId = 'default';
    }

    return { coach, teams, activeTeamId };
  } catch { return null; }
}

async function webSave(coach: CoachProfile, teams: TeamProfile[], activeTeamId: string | null) {
  try {
    const key = storageKey();
    localStorage.setItem(key, JSON.stringify({ coach, teams, activeTeamId }));
  } catch {}
  try {
    const { apiPut } = await import('./authStore');
    await apiPut('/profile', toApiProfile(coach, teams, activeTeamId));
  } catch {}
}

export const useProfile = create<ProfileStore>((set, get) => ({
  coach: { firstName: '', lastName: '', nickname: '' },
  teams: [],
  activeTeamId: null,

  setCoach: (c) => { set((s) => ({ coach: { ...s.coach, ...c } })); get().save(); },
  addTeam: (t) => { set((s) => ({ teams: [...s.teams, t], activeTeamId: s.activeTeamId ?? t.id })); get().save(); },
  updateTeam: (id, t) => { set((s) => ({ teams: s.teams.map((tm) => (tm.id === id ? { ...tm, ...t } : tm)) })); get().save(); },
  removeTeam: (id) => {
    set((s) => {
      const teams = s.teams.filter((t) => t.id !== id);
      return { teams, activeTeamId: s.activeTeamId === id ? (teams[0]?.id ?? null) : s.activeTeamId };
    });
    get().save();
  },
  setActiveTeam: (id) => { set({ activeTeamId: id }); get().save(); },

  displayName: () => {
    const { coach } = get();
    if (coach.nickname?.trim()) return coach.nickname.trim();
    return [coach.firstName, coach.lastName].filter(Boolean).join(' ') || '';
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
        const raw = await AsyncStorage.getItem(BASE_KEY);
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
        await AsyncStorage.setItem(BASE_KEY, JSON.stringify({ coach, teams, activeTeamId }));
      }
    } catch (_) {}
  },
}));
