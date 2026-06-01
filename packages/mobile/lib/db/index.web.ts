// Web stub — re-exports all stubs
export { db, getDb, isDbStub } from "./client.web";
export { seedDefaultExercises } from "./seed.web";
export { migrations } from "./migrations.web";
// schema is plain types, safe to export as-is
