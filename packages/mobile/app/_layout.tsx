import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { OneDollarStatsProvider } from "../lib/analytics";
import { useEffect, useState } from "react";
import { initLang } from "../lib/i18n";
import { useTheme } from "../lib/themeStore";
import { useDbInit } from "../lib/useDbInit";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import { isDbStub } from "../lib/db/client";
import { isLoggedIn, isSubscriptionExpired, getSubscriptionExpiry, getRole, clearAuth } from "../lib/authStore";
import SubscriptionExpiredScreen from "../components/SubscriptionExpiredScreen";
import appJson from "../app.json";

// Hide web splash screen once React mounts
if (Platform.OS === "web" && typeof window !== "undefined") {
  (window as any).__splashHide?.();
}

const queryClient = new QueryClient();
const applicationId = appJson.expo.extra.applicationId ?? "";
const hostname = applicationId ? `${applicationId}-mobile` : "localhost";

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [checked, setChecked] = useState(false);
  const [subExpired, setSubExpired] = useState(false);

  // Controlla scadenza: usato sia al cambio navigazione sia dal timer periodico
  const checkExpiry = (redirectIfExpired = false) => {
    if (Platform.OS !== "web") return false;
    const role = getRole();
    if (role === 'admin') return false;
    if (!isLoggedIn()) return false;
    const expiry = getSubscriptionExpiry();
    const expiredByTime = expiry != null && Date.now() > expiry;
    if (expiredByTime || isSubscriptionExpired()) {
      if (redirectIfExpired) {
        clearAuth();
        router.replace("/login");
      } else {
        setSubExpired(true);
      }
      return true;
    }
    return false;
  };

  // Timer: controlla ogni 60 secondi se la licenza è scaduta a sessione aperta
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const timer = setInterval(() => { checkExpiry(true); }, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") { setChecked(true); return; }
    const loggedIn = isLoggedIn();
    const inLoginPage = segments[0] === "login";
    if (!loggedIn && !inLoginPage) {
      router.replace("/login");
      setChecked(true);
      return;
    } else if (loggedIn && inLoginPage) {
      router.replace("/");
      setChecked(true);
      return;
    }
    checkExpiry(false);
    setChecked(true);
  }, [segments]);

  if (!checked) return null;
  if (subExpired) return <SubscriptionExpiredScreen />;
  return <>{children}</>;
}

function AppWithDb() {
  const dbReady = useDbInit();
  const loadTheme = useTheme((s) => s.load);

  useEffect(() => {
    initLang();
    loadTheme();
  }, []);

  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0d1f13" }}>
        <ActivityIndicator color="#2ecc71" size="large" />
      </View>
    );
  }

  return (
    <AuthGate>
      <View style={{ flex: 1 }}>
        {isDbStub() && Platform.OS !== "web" && (
          <View style={{
            backgroundColor: "#e67e22",
            paddingVertical: 8,
            paddingHorizontal: 16,
            alignItems: "center",
          }}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700", textAlign: "center" }}>
              ⚠️ Expo Go non supporta SQLite — usa un Development Build per il DB locale
            </Text>
          </View>
        )}
        <Slot />
      </View>
    </AuthGate>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <OneDollarStatsProvider
        config={{
          hostname,
          collectorUrl: "https://r.lilstts.com/events",
          devmode: true,
        }}
      >
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AppWithDb />
          </QueryClientProvider>
        </SafeAreaProvider>
      </OneDollarStatsProvider>
    </ErrorBoundary>
  );
}
