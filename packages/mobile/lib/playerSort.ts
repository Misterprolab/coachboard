/**
 * Ordinamento giocatori per COGNOME.
 * Convenzione: i nomi sono inseriti come "Nome Cognome" (eventuali cognomi
 * composti — "Mario De Rossi" — mantengono tutte le parole dopo il nome).
 */

export function surnameOf(fullName: string | null | undefined): string {
  const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  return parts.slice(1).join(" ");
}

export function firstNameOf(fullName: string | null | undefined): string {
  const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length <= 1 ? "" : parts[0];
}

/** Comparatore: cognome, poi nome. Case/accent insensitive. */
export function compareBySurname(aName: string | null | undefined, bName: string | null | undefined): number {
  const opts: Intl.CollatorOptions = { sensitivity: "base" };
  const s = surnameOf(aName).localeCompare(surnameOf(bName), "it", opts);
  if (s !== 0) return s;
  return firstNameOf(aName).localeCompare(firstNameOf(bName), "it", opts);
}

/** Ordina (copia) una lista di oggetti con campo `name` per cognome. */
export function sortBySurname<T extends { name?: string | null }>(list: T[]): T[] {
  return [...list].sort((a, b) => compareBySurname(a.name, b.name));
}
