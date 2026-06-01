import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../lib/i18n";
import { Trash, CaretRight, CalendarBlank, Timer, FileText, X, Check } from "phosphor-react-native";
import { useRouter } from "expo-router";
import { useState, useMemo } from "react";
import { useTheme } from "../../lib/themeStore";
import type { ThemeColors } from "../../lib/themeStore";
import { getSessions, deleteSession as dbDeleteSession } from "../../lib/db/queries";

type Session = {
  id: string;
  title: string;
  date: string;
  duration?: number | null;
  notes?: string | null;
  createdAt: number;
};

export default function SessionsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const c = useTheme((s) => s.colors);
  const s = useMemo(() => mkStyles(c), [c]);

  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: () => getSessions() as Promise<Session[]>,
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (id: string) => dbDeleteSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      setConfirmingId(null);
    },
  });

  const handleDeleteTap = (id: string) => {
    if (confirmingId === id) {
      deleteSessionMutation.mutate(id);
    } else {
      setConfirmingId(id);
    }
  };

  const sorted = [...(sessions.data || [])].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <Text style={s.title}>{t('Le mie Sedute', 'My Sessions')}</Text>
        <Text style={s.count}>{sorted.length} {t('sedute', 'sessions')}</Text>
      </View>

      {sessions.isLoading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {sorted.length === 0 ? (
            <View style={s.empty}>
              <FileText color={c.textDim} size={48} weight="thin" />
              <Text style={s.emptyText}>{t('Nessuna seduta ancora', 'No sessions yet')}</Text>
              <Text style={s.emptySub}>{t('Usa il generatore per creare la prima!', 'Use the generator to create your first!')}</Text>
            </View>
          ) : (
            sorted.map(session => {
              const isConfirming = confirmingId === session.id;
              const isDeleting = deleteSessionMutation.isPending && deleteSessionMutation.variables === session.id;

              return (
                <TouchableOpacity
                  key={session.id}
                  style={[s.card, isConfirming && s.cardConfirming]}
                  onPress={() => {
                    if (isConfirming) {
                      setConfirmingId(null);
                    } else {
                      router.push(`/session/${session.id}` as any);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <View style={s.cardContent}>
                    {isConfirming ? (
                      <Text style={s.confirmText}>{t('Eliminare questa seduta?', 'Delete this session?')}</Text>
                    ) : (
                      <>
                        <Text style={s.cardTitle}>{session.title}</Text>
                        <View style={s.cardMeta}>
                          <View style={s.metaItem}>
                            <CalendarBlank color={c.textDim} size={13} />
                            <Text style={s.metaText}>{session.date}</Text>
                          </View>
                          {session.duration ? (
                            <View style={s.metaItem}>
                              <Timer color={c.textDim} size={13} />
                              <Text style={s.metaText}>{session.duration} min</Text>
                            </View>
                          ) : null}
                        </View>
                        {session.notes ? <Text style={s.cardNotes} numberOfLines={1}>{session.notes}</Text> : null}
                      </>
                    )}
                  </View>

                  <View style={s.cardActions}>
                    {isConfirming ? (
                      <>
                        <TouchableOpacity
                          onPress={() => setConfirmingId(null)}
                          style={[s.actionBtn, s.cancelBtn]}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <X color={c.textMuted} size={16} weight="bold" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => deleteSessionMutation.mutate(session.id)}
                          style={[s.actionBtn, s.confirmBtn]}
                          disabled={isDeleting}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          {isDeleting
                            ? <ActivityIndicator size={14} color="#fff" />
                            : <Check color="#fff" size={16} weight="bold" />}
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          onPress={() => handleDeleteTap(session.id)}
                          style={s.deleteBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash color={c.danger} size={18} weight="fill" />
                        </TouchableOpacity>
                        <CaretRight color={c.textDim} size={20} />
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function mkStyles(c: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border },
    title: { fontSize: 24, fontWeight: '800', color: c.text },
    count: { fontSize: 13, color: c.textDim, fontWeight: '600' },
    list: { padding: 16, gap: 10 },
    empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
    emptyText: { fontSize: 16, fontWeight: '700', color: c.textMuted },
    emptySub: { fontSize: 13, color: c.textDim, textAlign: 'center' },
    card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.border },
    cardConfirming: { borderColor: c.danger, backgroundColor: c.danger + '10' },
    cardContent: { flex: 1, marginRight: 8 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 6 },
    cardMeta: { flexDirection: 'row', gap: 14, marginBottom: 4 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, color: c.textDim },
    cardNotes: { fontSize: 12, color: c.textMuted, fontStyle: 'italic' },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    deleteBtn: { padding: 4 },
    confirmText: { fontSize: 13, fontWeight: '700', color: c.danger },
    actionBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    cancelBtn: { backgroundColor: c.border },
    confirmBtn: { backgroundColor: c.danger },
  });
}
