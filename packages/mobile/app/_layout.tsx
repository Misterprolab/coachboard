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
import { isLoggedIn, getRole, clearAuth } from "../lib/authStore";
import appJson from "../app.json";

// Hide web splash screen once React mounts
if (Platform.OS === "web" && typeof window !== "undefined") {
  (window as any).__splashHide?.();
}

const queryClient = new QueryClient();
const applicationId = appJson.expo.extra.applicationId ?? "";
const hostname = applicationId ? `${applicationId}-mobile` : "localhost";

// Verifica server-side se la subscription è scaduta
async function checkSubscriptionServer(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${localStorage.getItem("cb_auth_token")}`, "Content-Type": "application/json" },
    });
    if (res.status === 401 || res.status === 403) return true; // token non valido → tratta come expired
    if (!res.ok) return false; // errore di rete → non fare nulla
    const data = await res.json();
    return data.subscriptionExpired === true;
  } catch {
    return false; // errore di rete → non bloccare
  }
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [checked, setChecked] = useState(false);
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);

  // Check server-side: chiama /api/auth/me e verifica subscriptionExpired
  const checkExpiry = useCallback(async () => {
    if (Platform.OS !== "web") return;
    if (!isLoggedIn()) return;
    if (getRole() === "admin") return;
    const expired = await checkSubscriptionServer();
    if (expired) {
      clearAuth();
      routerRef.current.replace("/login");
    }
  }, []);

  // Timer: ogni 5 minuti controlla server-side
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const timer = setInterval(checkExpiry, 5 * 60_000);
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

    // Ad ogni navigazione: check server-side se loggato e non admin
    if (loggedIn && getRole() !== "admin") {
      checkSubscriptionServer().then((expired) => {
        if (expired) {
          clearAuth();
          router.replace("/login");
        }
        setChecked(true);
      });
      return;
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
