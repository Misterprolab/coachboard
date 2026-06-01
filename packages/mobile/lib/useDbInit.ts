import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { seedDefaultExercises } from "./db";
import { migrations } from "./db/migrations";

let initialized = false;

export function useDbInit() {
  const [ready, setReady] = useState(initialized);

  useEffect(() => {
    if (initialized) { setReady(true); return; }
    (async () => {
      try {
        if (Platform.OS !== "web") {
          // Only attempt SQLite on native
          const { openDatabaseSync } = require("expo-sqlite");
          const expo = openDatabaseSync("coachboard.db");
          const stmts = migrations
            .split(";")
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0);
          for (const stmt of stmts) {
            expo.execSync(stmt + ";");
          }
          await seedDefaultExercises();
        }
      } catch (e) {
        console.error("[CoachBoard] DB init error:", e);
      } finally {
        initialized = true;
        setReady(true);
      }
    })();
  }, []);

  return ready;
}
