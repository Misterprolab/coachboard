import { db } from "./client";
import { exercises } from "./schema";
import { getDefaultExercises } from "./exercises-data";

export async function seedDefaultExercises() {
  const existing = await db.select({ id: exercises.id }).from(exercises);
  if (existing.length > 0) return; // Already seeded

  const now = Date.now();
  const items = getDefaultExercises(now);
  // Insert in batches of 20 to avoid SQLite limits
  for (let i = 0; i < items.length; i += 20) {
    await db.insert(exercises).values(items.slice(i, i + 20));
  }
}
