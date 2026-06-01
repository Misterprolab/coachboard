import { Slot } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { OneDollarStatsProvider } from "../lib/analytics";
import { useEffect } from "react";
import { initLang } from "../lib/i18n";
import { useTheme } from "../lib/themeStore";
import { useDbInit } from "../lib/useDbInit";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import { isDbStub } from "../lib/db/client";
import appJson from "../app.json";

// Hide web splash screen once React mounts
if (Platform.OS === "web" && typeof window !== "undefined") {
  (window as any).__splashHide?.();
}

const queryClient = new QueryClient();
const applicationId = appJson.expo.extra.applicationId ?? "";
const hostname = applicationId ? `${applicationId}-mobile` : "localhost";

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
    <View style={{ flex: 1 }}>
      {isDbStub() && (
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
