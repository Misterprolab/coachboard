import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Image, Alert, Platform, Linking, Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, User, UsersThree, Translate, PencilSimple, Trash, Plus, Check, CaretRight, Palette, Info, SignOut, Key, Crown } from 'phosphor-react-native';
import { useTheme, PRESET_GREEN, PRESET_DARK, PRESET_LIGHT } from '../lib/themeStore';
import type { ThemeColors, ThemeId } from '../lib/themeStore';
import { useI18n } from '../lib/i18n';
import { useProfile, TeamProfile } from '../lib/profile';
import { clearAuth, getEmail, getRole, authHeaders } from '../lib/authStore';
import { resetSeason } from '../lib/db/queries.web';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
type Section = 'menu' | 'profile' | 'team' | 'language' | 'team-edit' | 'theme' | 'info' | 'invite' | 'users';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsModal({ visible, onClose }: Props) {
  const c = useTheme((s) => s.colors);
  const s = useMemo(() => mkStyles(c), [c]);
  const themeId = useTheme((s) => s.themeId);
  const customPrimary = useTheme((s) => s.customPrimary);
  const customAccent = useTheme((s) => s.customAccent);
  const setTheme = useTheme((s) => s.setTheme);
  const setCustomColors = useTheme((s) => s.setCustomColors);

  const { t, lang, setLang } = useI18n();
  const { coach, teams, activeTeamId, setCoach, addTeam, updateTeam, removeTeam, setActiveTeam } = useProfile();
  const router = useRouter();
  const qc = useQueryClient();

  // Auth state (web only)
  const userEmail = Platform.OS === 'web' ? getEmail() : null;
  const userRole = Platform.OS === 'web' ? getRole() : null;
  const isAdmin = userRole === 'admin';

  const handleLogout = () => {
    clearAuth();
    onClose();
    router.replace('/login');
  };

  const [resetLoading, setResetLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const handleResetSeason = () => setShowResetConfirm(true);

  const doResetSeason = async () => {
    setResetLoading(true);
    try {
      await resetSeason();
      qc.clear();
      setShowResetConfirm(false);
      setResetDone(true);
    } catch (e) {
      setShowResetConfirm(false);
      Alert.alert('Errore', 'Impossibile reimpostare la stagione.');
    } finally {
      setResetLoading(false);
    }
  };

  const [section, setSection] = useState<Section>('menu');

  // Profile form
  const [firstName, setFirstName] = useState(coach.firstName);
  const [lastName, setLastName] = useState(coach.lastName);
  const [nickname, setNickname] = useState(coach.nickname);

  // Team edit form
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamSeason, setTeamSeason] = useState('');
  const [teamLogoUri, setTeamLogoUri] = useState<string | null>(null);

  // Theme custom color pickers
  const [customPrimaryInput, setCustomPrimaryInput] = useState(customPrimary);
  const [customAccentInput, setCustomAccentInput] = useState(customAccent);

  // Invite codes state
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [existingCodes, setExistingCodes] = useState<any[]>([]);

  // Users/licenze state (admin)
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editExpiryInput, setEditExpiryInput] = useState(''); // YYYY-MM-DD
  const [editStatusInput, setEditStatusInput] = useState('active');
  const [savingLicense, setSavingLicense] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/admin/users', { headers: authHeaders() });
      if (res.ok) setUsersList(await res.json());
    } catch {} finally { setUsersLoading(false); }
  };

  const saveLicense = async (userId: string) => {
    setSavingLicense(true);
    try {
      // Converti YYYY-MM-DD → ISO string per la API
      const expiryIso = editExpiryInput ? `${editExpiryInput}T23:59:59.000Z` : null;
      const res = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ status: editStatusInput, expiry: expiryIso }),
      });
      if (res.ok) {
        setEditingUserId(null);
        loadUsers();
      } else {
        Alert.alert('Errore', 'Salvataggio fallito');
      }
    } catch { Alert.alert('Errore', 'Errore di rete'); }
    finally { setSavingLicense(false); }
  };

  const confirmDeleteUser = (u: any) => {
    const name = u.name || u.email;
    const msg = t(
      `Vuoi eliminare "${name}"?\n\nTutti i suoi dati (giocatori, partite, sedute) verranno cancellati definitivamente.`,
      `Delete "${name}"?\n\nAll their data (players, matches, sessions) will be permanently deleted.`
    );
    const doDelete = async () => {
      setDeletingUserId(u.id);
      try {
        const res = await fetch(`/api/admin/users/${u.id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (res.ok) {
          loadUsers();
        } else {
          const err = await res.json().catch(() => ({}));
          const errMsg = err.error || 'Eliminazione fallita';
          if (Platform.OS === 'web') { window.alert(errMsg); } else { Alert.alert('Errore', errMsg); }
        }
      } catch {
        if (Platform.OS === 'web') { window.alert('Errore di rete'); } else { Alert.alert('Errore', 'Errore di rete'); }
      } finally { setDeletingUserId(null); }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doDelete();
    } else {
      Alert.alert(t('Elimina utente', 'Delete user'), msg, [
        { text: t('Annulla', 'Cancel'), style: 'cancel' },
        { text: t('Elimina', 'Delete'), style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const generateInviteCode = async () => {
    setGeneratingCode(true);
    try {
      const res = await fetch('/api/admin/invite-codes', {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedCode(data.code);
        loadInviteCodes();
      } else {
        Alert.alert('Errore', data.error ?? 'Impossibile generare il codice');
      }
    } catch { Alert.alert('Errore', 'Errore di rete'); }
    finally { setGeneratingCode(false); }
  };

  const loadInviteCodes = async () => {
    try {
      const res = await fetch('/api/admin/invite-codes', { headers: authHeaders() });
      if (res.ok) setExistingCodes(await res.json());
    } catch {}
  };

  useEffect(() => {
    if (visible) {
      setSection('menu');
      setFirstName(coach.firstName);
      setLastName(coach.lastName);
      setNickname(coach.nickname);
      setCustomPrimaryInput(customPrimary);
      setCustomAccentInput(customAccent);
    }
  }, [visible]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const openNewTeam = () => { setEditingTeamId(null); setTeamName(''); setTeamSeason(''); setTeamLogoUri(null); setSection('team-edit'); };
  const openEditTeam = (team: TeamProfile) => { setEditingTeamId(team.id); setTeamName(team.name); setTeamSeason(team.season); setTeamLogoUri(team.logoUri); setSection('team-edit'); };
  const fileInputRef = useRef<any>(null);

  const pickLogo = async () => {
    if (Platform.OS === 'web') { fileInputRef.current?.click(); return; }
    try {
      const IP = await import('expo-image-picker');
      const result = await IP.launchImageLibraryAsync({ mediaTypes: IP.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0]) setTeamLogoUri(result.assets[0].uri);
    } catch (_) {}
  };

  const onWebFileChange = (e: any) => {
    const file = e.target?.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setTeamLogoUri(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const saveProfile = () => { setCoach({ firstName: firstName.trim(), lastName: lastName.trim(), nickname: nickname.trim() }); setSection('menu'); };
  const saveTeam = () => {
    if (!teamName.trim()) return;
    if (editingTeamId) { updateTeam(editingTeamId, { name: teamName.trim(), season: teamSeason.trim(), logoUri: teamLogoUri }); }
    else { const id = Date.now().toString(); addTeam({ id, name: teamName.trim(), season: teamSeason.trim(), logoUri: teamLogoUri }); }
    setSection('team');
  };
  const confirmDeleteTeam = (id: string) => {
    Alert.alert(t('Elimina squadra', 'Delete team'), t('Sei sicuro?', 'Are you sure?'), [
      { text: t('Annulla', 'Cancel'), style: 'cancel' },
      { text: t('Elimina', 'Delete'), style: 'destructive', onPress: () => removeTeam(id) },
    ]);
  };

  const themeLabel = () => {
    switch (themeId) {
      case 'green': return t('Verde scuro', 'Dark green');
      case 'dark': return t('Nero', 'Black');
      case 'light': return t('Bianco', 'White');
      case 'custom': return t('Personalizzato', 'Custom');
      default: return '';
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const renderMenu = () => (
    <View style={s.menuList}>
      <TouchableOpacity style={s.menuItem} onPress={() => setSection('profile')}>
        <View style={s.menuIcon}><User color={c.primary} size={20} weight="fill" /></View>
        <View style={s.menuText}>
          <Text style={s.menuTitle}>{t('Profilo', 'Profile')}</Text>
          <Text style={s.menuSub}>{t('Nome e dati allenatore', 'Coach info')}</Text>
        </View>
        <CaretRight color={c.textDim} size={16} />
      </TouchableOpacity>

      <TouchableOpacity style={s.menuItem} onPress={() => setSection('team')}>
        <View style={s.menuIcon}><UsersThree color={c.accent} size={20} weight="fill" /></View>
        <View style={s.menuText}>
          <Text style={s.menuTitle}>{t('Squadra', 'Team')}</Text>
          <Text style={s.menuSub}>{t('Logo, nome e stagione', 'Logo, name & season')}</Text>
        </View>
        <CaretRight color={c.textDim} size={16} />
      </TouchableOpacity>

      <TouchableOpacity style={s.menuItem} onPress={() => setSection('language')}>
        <View style={s.menuIcon}><Translate color="#3498db" size={20} weight="bold" /></View>
        <View style={s.menuText}>
          <Text style={s.menuTitle}>{t('Lingua', 'Language')}</Text>
          <Text style={s.menuSub}>{lang === 'it' ? 'Italiano' : 'English'}</Text>
        </View>
        <CaretRight color={c.textDim} size={16} />
      </TouchableOpacity>

      <TouchableOpacity style={s.menuItem} onPress={() => setSection('theme')}>
        <View style={s.menuIcon}><Palette color="#9b59b6" size={20} weight="fill" /></View>
        <View style={s.menuText}>
          <Text style={s.menuTitle}>{t('Tema', 'Theme')}</Text>
          <Text style={s.menuSub}>{themeLabel()}</Text>
        </View>
        <CaretRight color={c.textDim} size={16} />
      </TouchableOpacity>

      <TouchableOpacity style={s.menuItem} onPress={() => setSection('info')}>
        <View style={s.menuIcon}><Info color="#3498db" size={20} weight="fill" /></View>
        <View style={s.menuText}>
          <Text style={s.menuTitle}>{t('Informazioni', 'About')}</Text>
          <Text style={s.menuSub}>{t('Versione, privacy, contatti', 'Version, privacy, contact')}</Text>
        </View>
        <CaretRight color={c.textDim} size={16} />
      </TouchableOpacity>

      {Platform.OS === 'web' && isAdmin && (
        <TouchableOpacity style={s.menuItem} onPress={() => { setGeneratedCode(null); loadInviteCodes(); setSection('invite'); }}>
          <View style={s.menuIcon}><Key color="#f39c12" size={20} weight="fill" /></View>
          <View style={s.menuText}>
            <Text style={s.menuTitle}>{t('Codici Invito', 'Invite Codes')}</Text>
            <Text style={s.menuSub}>{t('Genera codici per nuovi utenti', 'Generate codes for new users')}</Text>
          </View>
          <CaretRight color={c.textDim} size={16} />
        </TouchableOpacity>
      )}

      {Platform.OS === 'web' && isAdmin && (
        <TouchableOpacity style={s.menuItem} onPress={() => { loadUsers(); setEditingUserId(null); setSection('users'); }}>
          <View style={s.menuIcon}><Crown color="#9b59b6" size={20} weight="fill" /></View>
          <View style={s.menuText}>
            <Text style={s.menuTitle}>{t('Utenti & Licenze', 'Users & Licenses')}</Text>
            <Text style={s.menuSub}>{t('Gestisci scadenze licenze', 'Manage license expiry')}</Text>
          </View>
          <CaretRight color={c.textDim} size={16} />
        </TouchableOpacity>
      )}

      {Platform.OS === 'web' && userEmail && (
        <TouchableOpacity
          style={[s.menuItem, { marginTop: 8, borderTopWidth: 1, borderTopColor: c.border, opacity: resetLoading ? 0.5 : 1 }]}
          onPress={handleResetSeason}
          disabled={resetLoading}
        >
          <View style={s.menuIcon}><Trash color="#e67e22" size={20} weight="fill" /></View>
          <View style={s.menuText}>
            <Text style={[s.menuTitle, { color: '#e67e22' }]}>{t('Nuova stagione', 'New season')}</Text>
            <Text style={s.menuSub}>{t('Azzera partite, rosa e sedute', 'Reset matches, squad & sessions')}</Text>
          </View>
        </TouchableOpacity>
      )}

      {Platform.OS === 'web' && userEmail && (
        <TouchableOpacity style={[s.menuItem, { borderTopWidth: 1, borderTopColor: c.border }]} onPress={handleLogout}>
          <View style={s.menuIcon}><SignOut color="#e74c3c" size={20} weight="fill" /></View>
          <View style={s.menuText}>
            <Text style={[s.menuTitle, { color: '#e74c3c' }]}>{t('Esci', 'Log out')}</Text>
            <Text style={s.menuSub}>{userEmail}</Text>
          </View>
        </TouchableOpacity>
      )}

    </View>
  );

  const renderProfile = () => (
    <ScrollView style={s.form} keyboardShouldPersistTaps="handled">
      <Text style={s.fieldLabel}>{t('Nome', 'First name')}</Text>
      <TextInput style={s.input} value={firstName} onChangeText={setFirstName} placeholder={t('Mario', 'Mario')} placeholderTextColor={c.textDim} />
      <Text style={s.fieldLabel}>{t('Cognome', 'Last name')}</Text>
      <TextInput style={s.input} value={lastName} onChangeText={setLastName} placeholder={t('Rossi', 'Rossi')} placeholderTextColor={c.textDim} />
      <Text style={s.fieldLabel}>{t('Soprannome (facoltativo)', 'Nickname (optional)')}</Text>
      <TextInput style={s.input} value={nickname} onChangeText={setNickname} placeholder={t('Il Mister', 'The Coach')} placeholderTextColor={c.textDim} />
      <Text style={s.hint}>{t('Se inserito, il soprannome viene mostrato al posto di nome e cognome.', 'If set, nickname is shown instead of full name.')}</Text>
      <TouchableOpacity style={s.saveBtn} onPress={saveProfile}>
        <Check color={c.bg} size={18} weight="bold" />
        <Text style={s.saveBtnText}>{t('Salva', 'Save')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderTeams = () => (
    <ScrollView style={s.form}>
      {teams.length === 0 && <Text style={s.emptyText}>{t('Nessuna squadra aggiunta', 'No teams added yet')}</Text>}
      {teams.map((team) => (
        <View key={team.id} style={s.teamRow}>
          {team.logoUri ? (
            <Image source={{ uri: team.logoUri }} style={s.teamLogo} />
          ) : (
            <View style={[s.teamLogo, s.teamLogoEmpty]}>
              <UsersThree color={c.textDim} size={18} />
            </View>
          )}
          <View style={s.teamInfo}>
            <Text style={s.teamName}>{team.name}</Text>
            <Text style={s.teamSeason}>{team.season || '—'}</Text>
          </View>
          <View style={s.teamActions}>
            {activeTeamId !== team.id && (
              <TouchableOpacity style={s.teamActionBtn} onPress={() => setActiveTeam(team.id)}>
                <Check color={c.primary} size={16} />
              </TouchableOpacity>
            )}
            {activeTeamId === team.id && (
              <View style={s.activeIndicator}><Text style={s.activeText}>{t('Attiva', 'Active')}</Text></View>
            )}
            <TouchableOpacity style={s.teamActionBtn} onPress={() => openEditTeam(team)}>
              <PencilSimple color={c.textMuted} size={16} />
            </TouchableOpacity>
            <TouchableOpacity style={s.teamActionBtn} onPress={() => confirmDeleteTeam(team.id)}>
              <Trash color={c.danger} size={16} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
      <TouchableOpacity style={s.addBtn} onPress={openNewTeam}>
        <Plus color={c.bg} size={18} weight="bold" />
        <Text style={s.addBtnText}>{t('Aggiungi squadra', 'Add team')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderTeamEdit = () => (
    <ScrollView style={s.form} keyboardShouldPersistTaps="handled">
      <Text style={s.fieldLabel}>{t('Nome squadra', 'Team name')}</Text>
      <TextInput style={s.input} value={teamName} onChangeText={setTeamName} placeholder="FC Juventus" placeholderTextColor={c.textDim} />
      <Text style={s.fieldLabel}>{t('Stagione', 'Season')}</Text>
      <TextInput style={s.input} value={teamSeason} onChangeText={setTeamSeason} placeholder="2024/25" placeholderTextColor={c.textDim} />
      <Text style={s.fieldLabel}>{t('Logo squadra (facoltativo)', 'Team logo (optional)')}</Text>
      {Platform.OS === 'web' && <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onWebFileChange} />}
      <TouchableOpacity style={s.logoPicker} onPress={pickLogo}>
        {teamLogoUri ? (
          <Image source={{ uri: teamLogoUri }} style={s.logoPreview} />
        ) : (
          <View style={s.logoEmpty}><Plus color={c.textDim} size={24} /><Text style={s.logoEmptyText}>{t('Carica logo', 'Upload logo')}</Text></View>
        )}
      </TouchableOpacity>
      {teamLogoUri && <TouchableOpacity onPress={() => setTeamLogoUri(null)} style={s.removeLogoBtn}><Text style={s.removeLogoText}>{t('Rimuovi logo', 'Remove logo')}</Text></TouchableOpacity>}
      <TouchableOpacity style={[s.saveBtn, !teamName.trim() && s.saveBtnDisabled]} onPress={saveTeam} disabled={!teamName.trim()}>
        <Check color={c.bg} size={18} weight="bold" />
        <Text style={s.saveBtnText}>{t('Salva squadra', 'Save team')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderLanguage = () => (
    <View style={s.langList}>
      <TouchableOpacity style={[s.langOption, lang === 'it' && s.langActive]} onPress={() => setLang('it')}>
        <Text style={s.langFlag}>🇮🇹</Text>
        <Text style={[s.langLabel, lang === 'it' && s.langLabelActive]}>Italiano</Text>
        {lang === 'it' && <Check color={c.primary} size={18} weight="bold" />}
      </TouchableOpacity>
      <TouchableOpacity style={[s.langOption, lang === 'en' && s.langActive]} onPress={() => setLang('en')}>
        <Text style={s.langFlag}>🇬🇧</Text>
        <Text style={[s.langLabel, lang === 'en' && s.langLabelActive]}>English</Text>
        {lang === 'en' && <Check color={c.primary} size={18} weight="bold" />}
      </TouchableOpacity>
    </View>
  );

  // Preset theme definitions with real colors
  const PRESETS: { id: ThemeId; labelIt: string; labelEn: string; bg: string; primary: string; accent: string }[] = [
    { id: 'green',  labelIt: 'Verde scuro', labelEn: 'Dark green', bg: PRESET_GREEN.bg,   primary: PRESET_GREEN.primary,   accent: PRESET_GREEN.accent },
    { id: 'dark',   labelIt: 'Nero',        labelEn: 'Black',      bg: PRESET_DARK.bg,    primary: PRESET_DARK.primary,    accent: PRESET_DARK.accent },
    { id: 'light',  labelIt: 'Bianco',      labelEn: 'White',      bg: PRESET_LIGHT.bg,   primary: PRESET_LIGHT.primary,   accent: PRESET_LIGHT.accent },
    { id: 'custom', labelIt: 'Personalizzato', labelEn: 'Custom',  bg: '#1a1a2e',         primary: customPrimaryInput,     accent: customAccentInput },
  ];

  // Palette for custom color picking
  const PRIMARY_PALETTE = [
    '#e63946', '#e74c3c', '#e67e22', '#f39c12',
    '#f1c40f', '#2ecc71', '#1abc9c', '#3498db',
    '#2980b9', '#9b59b6', '#8e44ad', '#e91e63',
    '#ff5722', '#00bcd4', '#4caf50', '#ffffff',
  ];
  const ACCENT_PALETTE = [
    '#f1c40f', '#ffd700', '#ff9800', '#ff5722',
    '#e91e63', '#9c27b0', '#3f51b5', '#2196f3',
    '#00bcd4', '#4caf50', '#8bc34a', '#cddc39',
    '#ff6b6b', '#a29bfe', '#fd79a8', '#ffffff',
  ];

  const renderTheme = () => (
    <ScrollView style={s.form} keyboardShouldPersistTaps="handled">
      <Text style={s.sectionLabel}>{t('Tema colore', 'Color theme')}</Text>

      <View style={s.themeGrid}>
        {PRESETS.map(preset => {
          const active = themeId === preset.id;
          return (
            <TouchableOpacity
              key={preset.id}
              style={[s.themeCard, active && s.themeCardActive]}
              onPress={() => {
                setTheme(preset.id);
                if (preset.id === 'custom') {
                  setCustomPrimaryInput(customPrimary);
                  setCustomAccentInput(customAccent);
                }
              }}
              activeOpacity={0.8}
            >
              {/* Mini preview: bg + two color dots */}
              <View style={[s.themePreviewBox, { backgroundColor: preset.bg }]}>
                <View style={[s.themePreviewDot, { backgroundColor: preset.primary }]} />
                <View style={[s.themePreviewDot, { backgroundColor: preset.accent }]} />
              </View>
              <Text style={[s.themeCardLabel, active && { color: c.text, fontWeight: '700' }]}>
                {lang === 'it' ? preset.labelIt : preset.labelEn}
              </Text>
              {active && <Check color={c.primary} size={16} weight="bold" />}
            </TouchableOpacity>
          );
        })}
      </View>

      {themeId === 'custom' && (
        <View style={s.customSection}>
          <Text style={s.sectionLabel}>{t('Colore primario', 'Primary color')}</Text>
          <View style={s.paletteGrid}>
            {PRIMARY_PALETTE.map(color => (
              <TouchableOpacity
                key={color}
                style={[s.paletteCell, { backgroundColor: color }, customPrimaryInput === color && s.paletteCellActive]}
                onPress={() => { setCustomPrimaryInput(color); setCustomColors(color, customAccentInput); }}
                activeOpacity={0.75}
              >
                {customPrimaryInput === color && <Check color={color === '#ffffff' ? '#000' : '#fff'} size={14} weight="bold" />}
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.sectionLabel, { marginTop: 20 }]}>{t('Colore accento', 'Accent color')}</Text>
          <View style={s.paletteGrid}>
            {ACCENT_PALETTE.map(color => (
              <TouchableOpacity
                key={color}
                style={[s.paletteCell, { backgroundColor: color }, customAccentInput === color && s.paletteCellActive]}
                onPress={() => { setCustomAccentInput(color); setCustomColors(customPrimaryInput, color); }}
                activeOpacity={0.75}
              >
                {customAccentInput === color && <Check color={color === '#ffffff' ? '#000' : '#fff'} size={14} weight="bold" />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Live preview strip */}
          <View style={[s.previewStrip, { backgroundColor: customPrimaryInput }]}>
            <View style={[s.previewStripAccent, { backgroundColor: customAccentInput }]} />
            <Text style={[s.previewStripText, { color: '#fff' }]}>{t('Anteprima', 'Preview')}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const renderInfo = () => (
    <ScrollView style={s.form}>
      {/* App info */}
      <View style={s.infoBlock}>
        <Text style={s.infoLabel}>{t('Applicazione', 'Application')}</Text>
        <View style={s.infoRow}>
          <Text style={s.infoKey}>{t('Nome', 'Name')}</Text>
          <Text style={s.infoValue}>CoachBoard</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoKey}>{t('Versione', 'Version')}</Text>
          <Text style={s.infoValue}>{appVersion}</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoKey}>{t('Sviluppatore', 'Developer')}</Text>
          <Text style={s.infoValue}>MisterProLab</Text>
        </View>
      </View>

      {/* Contact */}
      <View style={s.infoBlock}>
        <Text style={s.infoLabel}>{t('Contatti', 'Contact')}</Text>
        <TouchableOpacity style={s.infoLinkRow} onPress={() => Linking.openURL('mailto:misterprolab@outlook.com')}>
          <Text style={s.infoLink}>misterprolab@outlook.com</Text>
        </TouchableOpacity>
      </View>

      {/* Legal */}
      <View style={s.infoBlock}>
        <Text style={s.infoLabel}>{t('Legale', 'Legal')}</Text>
        <TouchableOpacity style={s.infoLinkRow} onPress={() => Linking.openURL('https://misterprolab.github.io/legal/')}>
          <Text style={s.infoLink}>{t('Privacy Policy', 'Privacy Policy')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.infoLinkRow} onPress={() => Linking.openURL('https://misterprolab.github.io/legal/#terms')}>
          <Text style={s.infoLink}>{t('Termini di servizio', 'Terms of Service')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderInvite = () => (
    <ScrollView style={s.form}>
      <Text style={s.hint}>{t('Genera codici monouso per invitare nuovi utenti. Ogni codice può essere usato una sola volta.', 'Generate one-time codes to invite new users. Each code can be used once.')}</Text>
      <TouchableOpacity style={[s.saveBtn, { marginTop: 16 }]} onPress={generateInviteCode} disabled={generatingCode}>
        <Key color={c.bg} size={18} weight="bold" />
        <Text style={s.saveBtnText}>{generatingCode ? t('Generando...', 'Generating...') : t('Genera Codice', 'Generate Code')}</Text>
      </TouchableOpacity>
      {generatedCode && (
        <View style={{ backgroundColor: c.card, borderRadius: 10, padding: 16, marginTop: 16, alignItems: 'center' }}>
          <Text style={{ color: c.textDim, fontSize: 12, marginBottom: 6 }}>{t('Nuovo codice generato:', 'New code generated:')}</Text>
          <Text style={{ color: c.primary, fontSize: 24, fontWeight: '800', letterSpacing: 3 }}>{generatedCode}</Text>
          <TouchableOpacity onPress={() => { try { (Clipboard as any).setString(generatedCode); } catch {} }} style={{ marginTop: 8 }}>
            <Text style={{ color: c.textDim, fontSize: 12 }}>{t('Tocca per copiare', 'Tap to copy')}</Text>
          </TouchableOpacity>
        </View>
      )}
      {existingCodes.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <Text style={s.sectionLabel}>{t('Codici generati', 'Generated codes')}</Text>
          {existingCodes.map((code: any) => (
            <View key={code.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <Text style={{ color: code.usedBy ? c.textDim : c.text, fontWeight: '700', fontFamily: 'monospace' }}>{code.code}</Text>
              <Text style={{ color: code.usedBy ? '#e74c3c' : c.primary, fontSize: 12 }}>{code.usedBy ? t('Usato', 'Used') : t('Disponibile', 'Available')}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderUsers = () => (
    <ScrollView style={s.form}>
      <Text style={s.hint}>{t('Gestisci lo stato della licenza di ogni utente. Imposta data di scadenza e stato.', 'Manage each user\'s license. Set expiry date and status.')}</Text>
      {usersLoading && <Text style={{ color: c.textDim, textAlign: 'center', marginTop: 20 }}>{t('Caricamento...', 'Loading...')}</Text>}
      {usersList.filter(u => u.role !== 'admin').map((u: any) => {
        const isEditing = editingUserId === u.id;
        const expired = u.subscriptionExpired;
        const expiryDate = u.subscriptionExpiry ? new Date(u.subscriptionExpiry).toLocaleDateString('it-IT') : '—';
        const statusColor = u.subscriptionStatus === 'active' ? c.primary : u.subscriptionStatus === 'trial' ? '#f39c12' : '#e74c3c';
        return (
          <View key={u.id} style={{ backgroundColor: c.bgCard, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: expired ? '#e74c3c44' : c.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{u.name || u.email}</Text>
                {u.name && <Text style={{ color: c.textDim, fontSize: 11, marginTop: 1 }}>{u.email}</Text>}
                {u.teamName && <Text style={{ color: c.textDim, fontSize: 11 }}>{u.teamName}</Text>}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <View style={{ backgroundColor: statusColor + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: statusColor, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>{u.subscriptionStatus}</Text>
                  </View>
                  <Text style={{ color: expired ? '#e74c3c' : c.textDim, fontSize: 11 }}>
                    {expired ? '⚠ ' : ''}{t('Scade', 'Expires')}: {expiryDate}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  onPress={() => {
                    if (isEditing) { setEditingUserId(null); return; }
                    setEditingUserId(u.id);
                    setEditStatusInput(u.subscriptionStatus ?? 'active');
                    if (u.subscriptionExpiry) {
                      const d = new Date(u.subscriptionExpiry);
                      const yyyy = d.getFullYear();
                      const mm = String(d.getMonth() + 1).padStart(2, '0');
                      const dd = String(d.getDate()).padStart(2, '0');
                      setEditExpiryInput(`${yyyy}-${mm}-${dd}`);
                    } else {
                      setEditExpiryInput('');
                    }
                  }}
                  style={{ backgroundColor: isEditing ? c.border : c.primary + '22', borderRadius: 8, padding: 8 }}
                >
                  <Text style={{ color: isEditing ? c.textMuted : c.primary, fontSize: 12, fontWeight: '700' }}>
                    {isEditing ? t('Annulla', 'Cancel') : t('Modifica', 'Edit')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDeleteUser(u)}
                  disabled={deletingUserId === u.id}
                  style={{ backgroundColor: '#e74c3c18', borderRadius: 8, padding: 8, opacity: deletingUserId === u.id ? 0.5 : 1 }}
                >
                  <Trash color="#e74c3c" size={16} weight="bold" />
                </TouchableOpacity>
              </View>
            </View>

            {isEditing && (
              <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 }}>
                <Text style={s.sectionLabel}>{t('Stato licenza', 'License status')}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {(['trial', 'active', 'expired'] as const).map(st => (
                    <TouchableOpacity
                      key={st}
                      onPress={() => setEditStatusInput(st)}
                      style={{
                        flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
                        backgroundColor: editStatusInput === st ? (st === 'active' ? c.primary : st === 'trial' ? '#f39c12' : '#e74c3c') : c.bgCard,
                        borderWidth: 1, borderColor: editStatusInput === st ? 'transparent' : c.border,
                      }}
                    >
                      <Text style={{ color: editStatusInput === st ? '#000' : c.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>{st}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={s.sectionLabel}>{t('Scadenza (YYYY-MM-DD)', 'Expiry (YYYY-MM-DD)')}</Text>
                <TextInput
                  style={[s.input, { marginBottom: 12 }]}
                  value={editExpiryInput}
                  onChangeText={setEditExpiryInput}
                  placeholder="2026-08-31"
                  placeholderTextColor={c.textDim}
                  keyboardType="numbers-and-punctuation"
                />
                <TouchableOpacity
                  style={[s.saveBtn, { opacity: savingLicense ? 0.6 : 1 }]}
                  onPress={() => saveLicense(u.id)}
                  disabled={savingLicense}
                >
                  <Check color={c.bg} size={16} weight="bold" />
                  <Text style={s.saveBtnText}>{savingLicense ? t('Salvataggio...', 'Saving...') : t('Salva licenza', 'Save license')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
      {!usersLoading && usersList.filter(u => u.role !== 'admin').length === 0 && (
        <Text style={{ color: c.textDim, textAlign: 'center', marginTop: 32 }}>{t('Nessun utente registrato', 'No users registered')}</Text>
      )}
    </ScrollView>
  );

  const sectionTitle = () => {
    switch (section) {
      case 'profile':   return t('Profilo', 'Profile');
      case 'team':      return t('Squadra', 'Team');
      case 'team-edit': return editingTeamId ? t('Modifica squadra', 'Edit team') : t('Nuova squadra', 'New team');
      case 'language':  return t('Lingua', 'Language');
      case 'theme':     return t('Tema', 'Theme');
      case 'info':      return t('Informazioni', 'About');
      case 'invite':    return t('Codici Invito', 'Invite Codes');
      case 'users':     return t('Utenti & Licenze', 'Users & Licenses');
      default:          return t('Impostazioni', 'Settings');
    }
  };

  const canGoBack = section !== 'menu';
  const goBack = () => { if (section === 'team-edit') setSection('team'); else setSection('menu'); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
        <View style={s.header}>
          {canGoBack ? (
            <TouchableOpacity style={s.backBtn} onPress={goBack}>
              <Text style={s.backText}>← {t('Indietro', 'Back')}</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 80 }} />}
          <Text style={s.title}>{sectionTitle()}</Text>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <X color={c.textMuted} size={20} weight="bold" />
          </TouchableOpacity>
        </View>

        <View style={s.body}>
          {section === 'menu'      && renderMenu()}
          {section === 'profile'   && renderProfile()}
          {section === 'team'      && renderTeams()}
          {section === 'team-edit' && renderTeamEdit()}
          {section === 'language'  && renderLanguage()}
          {section === 'theme'     && renderTheme()}
          {section === 'info'      && renderInfo()}
          {section === 'invite'    && renderInvite()}
          {section === 'users'     && renderUsers()}
        </View>
      </SafeAreaView>

      {/* Reset Season confirm overlay */}
      {showResetConfirm && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <View style={{ backgroundColor: c.bgCard, borderRadius: 16, padding: 24, margin: 24, maxWidth: 360, width: '90%' }}>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '700', marginBottom: 10 }}>
              {t('Nuova stagione', 'New season')}
            </Text>
            <Text style={{ color: c.textDim, fontSize: 14, lineHeight: 20, marginBottom: 24 }}>
              {t(
                'Questa operazione eliminerà definitivamente tutte le partite, i giocatori e le sedute. Le esercitazioni di default rimarranno. Continuare?',
                'This will permanently delete all matches, players and sessions. Default exercises will remain. Continue?'
              )}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: c.bgInput, alignItems: 'center' }}
                onPress={() => setShowResetConfirm(false)}
                disabled={resetLoading}
              >
                <Text style={{ color: c.text, fontWeight: '600' }}>{t('Annulla', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#e74c3c', alignItems: 'center', opacity: resetLoading ? 0.6 : 1 }}
                onPress={doResetSeason}
                disabled={resetLoading}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {resetLoading ? t('Attendi...', 'Wait...') : t('Reimposta', 'Reset')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Reset done overlay */}
      {resetDone && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <View style={{ backgroundColor: c.bgCard, borderRadius: 16, padding: 24, margin: 24, maxWidth: 360, width: '90%', alignItems: 'center' }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>✅</Text>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
              {t('Stagione reimpostata', 'Season reset')}
            </Text>
            <Text style={{ color: c.textDim, fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
              {t('Puoi ricominciare da capo con una nuova stagione.', 'You can start fresh with a new season.')}
            </Text>
            <TouchableOpacity
              style={{ paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8, backgroundColor: c.primary }}
              onPress={() => { setResetDone(false); onClose(); router.replace('/'); }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{t('Ok', 'Ok')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Modal>
  );
}

function mkStyles(c: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    title: { fontSize: 17, fontWeight: '700', color: c.text },
    backBtn: { minWidth: 80 },
    backText: { color: c.primary, fontSize: 14, fontWeight: '600' },
    closeBtn: { minWidth: 80, alignItems: 'flex-end' },
    body: { flex: 1 },

    menuList: { paddingTop: 8 },
    menuItem: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 20, paddingVertical: 18,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    menuIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: c.bgCard, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    menuText: { flex: 1 },
    menuTitle: { fontSize: 15, fontWeight: '600', color: c.text },
    menuSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },

    form: { flex: 1, padding: 20 },
    sectionLabel: { fontSize: 11, fontWeight: '800', color: c.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, marginTop: 4 },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: c.textMuted, marginBottom: 6, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 14, color: c.text, fontSize: 16 },
    hint: { fontSize: 12, color: c.textDim, marginTop: 8, lineHeight: 17 },
    saveBtn: { marginTop: 28, backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    saveBtnDisabled: { opacity: 0.4 },
    saveBtnText: { color: c.bg, fontWeight: '700', fontSize: 16 },
    emptyText: { color: c.textMuted, textAlign: 'center', marginTop: 30, fontSize: 14 },

    teamRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bgCard, borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: c.border },
    teamLogo: { width: 44, height: 44, borderRadius: 10, marginRight: 12 },
    teamLogoEmpty: { backgroundColor: c.bgCardAlt, alignItems: 'center', justifyContent: 'center' },
    teamInfo: { flex: 1 },
    teamName: { fontSize: 14, fontWeight: '700', color: c.text },
    teamSeason: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    teamActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    teamActionBtn: { padding: 6 },
    activeIndicator: { backgroundColor: c.primary + '20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    activeText: { color: c.primary, fontSize: 11, fontWeight: '700' },
    addBtn: { marginTop: 4, backgroundColor: c.primaryDark, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    addBtnText: { color: c.bg, fontWeight: '700', fontSize: 16 },

    logoPicker: { marginTop: 4, height: 100, backgroundColor: c.bgCard, borderRadius: 14, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
    logoPreview: { width: 80, height: 80, borderRadius: 10 },
    logoEmpty: { alignItems: 'center', gap: 6 },
    logoEmptyText: { color: c.textDim, fontSize: 13 },
    removeLogoBtn: { marginTop: 8, alignSelf: 'center' },
    removeLogoText: { color: c.danger, fontSize: 13 },

    langList: { padding: 20, gap: 10 },
    langOption: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border },
    langActive: { borderColor: c.primary },
    langFlag: { fontSize: 24 },
    langLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: c.textMuted },
    langLabelActive: { color: c.text },

    // Theme section
    themeGrid: { gap: 10 },
    themeCard: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: c.bgCard, borderRadius: 14, padding: 14,
      borderWidth: 1.5, borderColor: c.border,
    },
    themeCardActive: { borderColor: c.primary, backgroundColor: c.primary + '18' },
    themePreviewBox: {
      width: 44, height: 28, borderRadius: 8,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 4, paddingHorizontal: 6,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    },
    themePreviewDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)' },
    themeCardLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: c.textMuted },
    customSection: { marginTop: 24 },
    paletteGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    },
    paletteCell: {
      width: 38, height: 38, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: 'transparent',
    },
    paletteCellActive: { borderColor: c.text, transform: [{ scale: 1.15 }] },
    previewStrip: {
      marginTop: 20, borderRadius: 12, height: 48,
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12,
      overflow: 'hidden',
    },
    previewStripAccent: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)' },
    previewStripText: { fontSize: 14, fontWeight: '700' },

    // Info section
    infoBlock: { marginBottom: 24 },
    infoLabel: { fontSize: 11, fontWeight: '800', color: c.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
    infoKey: { fontSize: 14, color: c.textMuted },
    infoValue: { fontSize: 14, fontWeight: '600', color: c.text },
    infoLinkRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
    infoLink: { fontSize: 14, color: '#3498db', fontWeight: '600' },
  });
}
