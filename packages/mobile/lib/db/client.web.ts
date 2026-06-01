// Web — usiamo localStorage store (queries.web.ts), non SQLite
export const db: any = null;
export function getDb() { return null; }
export function isDbStub() { return false; } // web ha il suo store, non è uno stub
