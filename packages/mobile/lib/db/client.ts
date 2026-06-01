import * as schema from "./schema";
import { Platform } from "react-native";

// expo-sqlite is only available in native development builds, not Expo Go or web.
// We create a stub on unsupported platforms so the app doesn't crash.

type DrizzleDb = any;

let _db: DrizzleDb | null = null;
let _isStub = false;

function createStubDb(): DrizzleDb {
  _isStub = true;
  // Return an object that silently no-ops all queries and returns empty arrays
  const noOp = () => ({
    from: () => noOp(),
    where: () => noOp(),
    orderBy: () => noOp(),
    limit: () => noOp(),
    offset: () => noOp(),
    values: () => Promise.resolve([]),
    set: () => noOp(),
    then: (resolve: (v: any[]) => any) => Promise.resolve([]).then(resolve),
    catch: (reject: (e: any) => any) => Promise.resolve([]),
    execute: () => Promise.resolve([]),
  });
  return {
    select: () => noOp(),
    insert: () => ({ values: () => Promise.resolve() }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    delete: () => ({ where: () => Promise.resolve() }),
    query: {},
  };
}

export function getDb(): DrizzleDb {
  if (_db) return _db;

  if (Platform.OS === "web") {
    console.warn("[CoachBoard] expo-sqlite not supported on web — using in-memory stub");
    _db = createStubDb();
    return _db;
  }

  try {
    const { drizzle } = require("drizzle-orm/expo-sqlite");
    const { openDatabaseSync } = require("expo-sqlite");
    const expo = openDatabaseSync("coachboard.db", { enableChangeListener: true });
    _db = drizzle(expo, { schema });
  } catch (e) {
    console.warn("[CoachBoard] expo-sqlite unavailable (Expo Go?) — using in-memory stub:", e);
    _db = createStubDb();
  }
  return _db;
}

export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

export function isDbStub() {
  getDb(); // ensure initialized
  return _isStub;
}
