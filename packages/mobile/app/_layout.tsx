import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { OneDollarStatsProvider } from "../lib/analytics";
import { useEffect, useState, useRef, useCallback } from "react";
import { initLang } from "../lib/i18n";
import { useTheme } from "../lib/themeStore";
import { useDbInit } from "../lib/useDbInit";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import { isDbStub } from "../lib/db/client";
import { isLoggedIn, isSubscriptionExpired, getSubscriptionExpiry, getRole, clearAuth } from "../lib/authStore";
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
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);

  // Legge il timestamp direttamente dal localStorage ogni volta — nessuna closure stale
  const checkExpiry = useCallback(() => {
    if (Platform.OS !== "web") return;
    if (getRole() === "admin") return;
    if (!isLoggedIn()) return;
    const expiry = getSubscriptionExpiry();
    const expired = (expiry != null && Date.now() > expiry) || isSubscriptionExpired();
    if (expired) {
      clearAuth();
      routerRef.current.replace("/login");
    }
  }, []);

  // Timer: ogni 60s controlla se la licenza è scaduta a sessione aperta
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const timer = setInterval(checkExpiry, 60_000);
    return () => clearInterval(timer);
  }, [checkExpiry]);

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
    // Controlla scadenza ad ogni navigazione
    const role = getRole();
    if (role !== "admin") {
      const expiry = getSubscriptionExpiry();
      const expired = (expiry != null && Date.now() > expiry) || isSubscriptionExpired();
      if (expired) {
        clearAuth();
        router.replace("/login");
        setChecked(true);
        return;
      }
    }
    setChecked(true);
  }, [segments]);

  if (!checked) return null;
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
