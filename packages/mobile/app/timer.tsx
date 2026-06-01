import { View, Text, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useRef, useMemo } from "react";
import { useI18n } from "../lib/i18n";
import { Play, Pause, ArrowCounterClockwise, ArrowLeft } from "phosphor-react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../lib/themeStore";
import type { ThemeColors } from "../lib/themeStore";

export default function TimerScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const c = useTheme((s) => s.colors);
  const s = useMemo(() => mkStyles(c), [c]);

  const [totalSeconds, setTotalSeconds] = useState(600);
  const [remaining, setRemaining] = useState(600);
  const [running, setRunning] = useState(false);
  const [inputMin, setInputMin] = useState('10');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const displayMin = Math.floor(remaining / 60);
  const displaySec = remaining % 60;
  const progress = totalSeconds > 0 ? remaining / totalSeconds : 1;

  const setTimer = () => {
    const mins = parseInt(inputMin) || 0;
    const total = mins * 60;
    setTotalSeconds(total);
    setRemaining(total);
    setRunning(false);
  };

  const reset = () => {
    setRunning(false);
    setRemaining(totalSeconds);
  };

  const done = remaining === 0;

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <ArrowLeft color={c.text} size={24} />
        </TouchableOpacity>
        <Text style={s.pageTitle}>{t('Timer Allenamento', 'Training Timer')}</Text>
      </View>

      <View style={s.content}>
        <View style={s.clockWrapper}>
          <View style={s.clockFace}>
            <Text style={[s.time, done && { color: c.accent }]}>
              {String(displayMin).padStart(2, '0')}:{String(displaySec).padStart(2, '0')}
            </Text>
            <Text style={s.timeLabel}>
              {done ? t('⏰ Terminato!', '⏰ Done!') : running ? t('In corso...', 'Running...') : t('In pausa', 'Paused')}
            </Text>
          </View>
        </View>

        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${progress * 100}%`, backgroundColor: done ? c.accent : c.primary }]} />
        </View>

        <View style={s.controls}>
          <TouchableOpacity style={s.resetBtn} onPress={reset} activeOpacity={0.8}>
            <ArrowCounterClockwise color={c.textMuted} size={28} weight="bold" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.playBtn, done && { backgroundColor: c.accent }]}
            onPress={() => !done && setRunning(r => !r)}
            activeOpacity={0.8}
          >
            {running
              ? <Pause color={c.bg} size={36} weight="fill" />
              : <Play color={c.bg} size={36} weight="fill" />}
          </TouchableOpacity>
          <View style={{ width: 56 }} />
        </View>

        <View style={s.setRow}>
          <Text style={s.setLabel}>{t('Imposta minuti:', 'Set minutes:')}</Text>
          <TextInput
            style={s.setInput}
            value={inputMin}
            onChangeText={setInputMin}
            keyboardType="numeric"
            selectTextOnFocus
          />
          <TouchableOpacity style={s.setBtn} onPress={setTimer} activeOpacity={0.8}>
            <Text style={s.setBtnText}>{t('OK', 'OK')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.presetLabel}>{t('Preimpostazioni rapide', 'Quick presets')}</Text>
        <View style={s.presets}>
          {[5, 10, 15, 20, 25, 30].map(m => (
            <TouchableOpacity
              key={m}
              style={s.preset}
              onPress={() => { setInputMin(String(m)); const t2 = m * 60; setTotalSeconds(t2); setRemaining(t2); setRunning(false); }}
              activeOpacity={0.75}
            >
              <Text style={s.presetText}>{m}'</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

function mkStyles(c: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    topBar: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 10, gap: 12 },
    back: { padding: 4 },
    pageTitle: { fontSize: 18, fontWeight: '700', color: c.text },
    content: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 20 },
    clockWrapper: { width: 240, height: 240, borderRadius: 120, backgroundColor: c.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.border, marginBottom: 24, shadowColor: c.primary, shadowRadius: 30, shadowOpacity: 0.2 },
    clockFace: { alignItems: 'center' },
    time: { fontSize: 60, fontWeight: '900', color: c.primary, letterSpacing: -2, fontVariant: ['tabular-nums'] },
    timeLabel: { fontSize: 14, color: c.textMuted, marginTop: 4 },
    progressBar: { width: '100%', height: 8, backgroundColor: c.bgCard, borderRadius: 4, overflow: 'hidden', marginBottom: 32, borderWidth: 1, borderColor: c.border },
    progressFill: { height: '100%', borderRadius: 4 },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 40 },
    resetBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border },
    playBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    setRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
    setLabel: { fontSize: 14, color: c.textMuted },
    setInput: { backgroundColor: c.bgCard, color: c.text, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, fontWeight: '700', borderWidth: 1, borderColor: c.border, width: 60, textAlign: 'center' },
    setBtn: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
    setBtnText: { color: c.bg, fontWeight: '700', fontSize: 14 },
    presetLabel: { fontSize: 13, color: c.textDim, marginBottom: 12 },
    presets: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
    preset: { backgroundColor: c.bgCard, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, borderWidth: 1, borderColor: c.border },
    presetText: { color: c.text, fontWeight: '700', fontSize: 14 },
  });
}
