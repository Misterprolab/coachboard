import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LockSimple, CalendarX, ArrowCounterClockwise } from "phosphor-react-native";
import { useTheme } from "../lib/themeStore";
import { useI18n } from "../lib/i18n";
import { getSubscriptionExpiry, getSubscriptionStatus, clearAuth } from "../lib/authStore";
import { useRouter } from "expo-router";

function formatDate(ts: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

export default function SubscriptionExpiredScreen() {
  const c = useTheme((s) => s.colors);
  const { t } = useI18n();
  const router = useRouter();
  const expiry = getSubscriptionExpiry();
  const status = getSubscriptionStatus();
  const isTrial = status === "trial";

  const s = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
    iconWrap: {
      width: 88, height: 88, borderRadius: 44,
      backgroundColor: c.danger + "18",
      alignItems: "center", justifyContent: "center",
      marginBottom: 28,
    },
    title: { fontSize: 24, fontWeight: "800", color: c.text, textAlign: "center", marginBottom: 12 },
    subtitle: { fontSize: 15, color: c.textMuted, textAlign: "center", lineHeight: 22, marginBottom: 8 },
    expiryRow: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: c.bgCard, borderRadius: 12,
      paddingHorizontal: 20, paddingVertical: 14,
      marginTop: 24, marginBottom: 32,
      borderWidth: 1, borderColor: c.border,
    },
    expiryLabel: { fontSize: 13, color: c.textDim },
    expiryDate: { fontSize: 15, fontWeight: "700", color: c.danger },
    contactBox: {
      backgroundColor: c.bgCard, borderRadius: 16,
      padding: 20, width: "100%",
      borderWidth: 1, borderColor: c.border,
      marginBottom: 32,
    },
    contactTitle: { fontSize: 13, fontWeight: "700", color: c.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
    contactText: { fontSize: 14, color: c.text, lineHeight: 20 },
    logoutBtn: {
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingVertical: 12, paddingHorizontal: 24,
      borderRadius: 12, borderWidth: 1, borderColor: c.border,
    },
    logoutTxt: { fontSize: 14, color: c.textMuted, fontWeight: "600" },
  }), [c]);

  const handleLogout = () => {
    clearAuth();
    router.replace("/login");
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={s.container}>
        <View style={s.iconWrap}>
          <LockSimple color={c.danger} size={44} weight="fill" />
        </View>

        <Text style={s.title}>
          {isTrial
            ? t("Trial scaduto", "Trial expired")
            : t("Licenza scaduta", "License expired")}
        </Text>

        <Text style={s.subtitle}>
          {isTrial
            ? t(
                "Il tuo periodo di prova è terminato. I tuoi dati sono al sicuro e li ritroverai al rinnovo. Contatta l'amministratore per attivare la licenza.",
                "Your trial period has ended. Your data is safe and will be restored upon renewal. Contact the administrator to activate your license."
              )
            : t(
                "La tua licenza annuale è scaduta. I tuoi dati sono al sicuro. Contatta l'amministratore per rinnovare.",
                "Your annual license has expired. Your data is safe. Contact the administrator to renew."
              )}
        </Text>

        {expiry && (
          <View style={s.expiryRow}>
            <CalendarX color={c.danger} size={20} weight="fill" />
            <Text style={s.expiryLabel}>{t("Scaduta il", "Expired on")}</Text>
            <Text style={s.expiryDate}>{formatDate(expiry)}</Text>
          </View>
        )}

        <View style={s.contactBox}>
          <Text style={s.contactTitle}>{t("Come rinnovare", "How to renew")}</Text>
          <Text style={s.contactText}>
            {t(
              "Contatta l'amministratore per richiedere il rinnovo della licenza. I tuoi dati rimarranno intatti.",
              "Contact the administrator to request license renewal. Your data will remain intact."
            )}
          </Text>
        </View>

        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <ArrowCounterClockwise color={c.textMuted} size={16} weight="bold" />
          <Text style={s.logoutTxt}>{t("Esci e accedi con altro account", "Sign out")}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
