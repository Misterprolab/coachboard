import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert, Image,
} from "react-native";
import { useRouter } from "expo-router";
import { setAuth } from "../lib/authStore";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "../lib/themeStore";

type Mode = "login" | "register";

export default function LoginScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const loadTheme = useTheme((s) => s.load);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Email e password obbligatorie");
      return;
    }
    if (mode === "register" && !inviteCode.trim()) {
      setError("Codice invito obbligatorio per registrarsi");
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body: any = { email: email.trim().toLowerCase(), password };
      if (mode === "register") body.inviteCode = inviteCode.trim();

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Errore sconosciuto");
        return;
      }

      setAuth(data.token, data.role, email.trim().toLowerCase(), {
        subscriptionExpired: data.subscriptionExpired ?? false,
        subscriptionExpiry: data.subscriptionExpiry ?? null,
        subscriptionStatus: data.subscriptionStatus ?? "trial",
      });
      qc.clear();
      await loadTheme();
      if (Platform.OS === "web") {
        window.scrollTo(0, 0);
        window.location.href = "/";
      } else {
        router.replace("/");
      }
    } catch (e: any) {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo/Brand */}
        <View style={styles.brand}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.appName}>CoachBoard</Text>
          <Text style={styles.tagline}>La tua piattaforma di allenamento</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, mode === "login" && styles.tabActive]}
              onPress={() => { setMode("login"); setError(null); }}
            >
              <Text style={[styles.tabText, mode === "login" && styles.tabTextActive]}>Accedi</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === "register" && styles.tabActive]}
              onPress={() => { setMode("register"); setError(null); }}
            >
              <Text style={[styles.tabText, mode === "register" && styles.tabTextActive]}>Registrati</Text>
            </TouchableOpacity>
          </View>

          {/* Fields */}
          <View style={styles.fields}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="coach@esempio.com"
              placeholderTextColor="#4a5e4f"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={mode === "register" ? "Min. 8 caratteri" : "Password"}
              placeholderTextColor="#4a5e4f"
              secureTextEntry
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />

            {mode === "register" && (
              <>
                <Text style={styles.label}>Codice Invito</Text>
                <TextInput
                  style={styles.input}
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  placeholder="Es: A3F2B8C1"
                  placeholderTextColor="#4a5e4f"
                  autoCapitalize="characters"
                />
                <Text style={styles.hint}>Hai bisogno di un codice invito per registrarti.</Text>
              </>
            )}
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>
                {mode === "login" ? "Accedi" : "Crea Account"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d1f13",
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  brand: {
    alignItems: "center",
    marginBottom: 36,
  },
  logoImage: {
    width: 100,
    height: 100,
    marginBottom: 12,
  },
  appName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#e8f5e9",
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: "#6a9b72",
    marginTop: 4,
  },
  card: {
    backgroundColor: "#132a1a",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: "#1e4029",
  },
  tabs: {
    flexDirection: "row",
    marginBottom: 24,
    backgroundColor: "#0d1f13",
    borderRadius: 8,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: "#2ecc71",
  },
  tabText: {
    color: "#6a9b72",
    fontWeight: "600",
    fontSize: 14,
  },
  tabTextActive: {
    color: "#0d1f13",
  },
  fields: {
    gap: 8,
    marginBottom: 16,
  },
  label: {
    color: "#8db893",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 2,
  },
  input: {
    backgroundColor: "#0d1f13",
    borderWidth: 1,
    borderColor: "#1e4029",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#e8f5e9",
    fontSize: 15,
  },
  hint: {
    color: "#4a5e4f",
    fontSize: 12,
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: "#3a1515",
    borderWidth: 1,
    borderColor: "#7a2222",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 13,
    textAlign: "center",
  },
  btn: {
    backgroundColor: "#2ecc71",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: "#0d1f13",
    fontWeight: "700",
    fontSize: 16,
  },
});
