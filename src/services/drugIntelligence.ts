import brandToGeneric from "@/data/brandToGeneric.json";
import fdcComposition from "@/data/fdcComposition.json";

export type SuggestionType = "Brand" | "Generic" | "Combination";

export interface DrugSuggestion {
  id: string;
  label: string;
  type: SuggestionType;
  subtitle: string;
  matchIndex: number;
}

type FdcEntry = { composition: string[] };

type BrandMap = Record<string, string>;
type FdcMap = Record<string, FdcEntry>;

const brandMap = brandToGeneric as BrandMap;
const fdcMap = fdcComposition as FdcMap;

const normalize = (value: string) => value.toLowerCase().trim().replace(/\s+/g, " ");

const splitPlus = (value: string) =>
  value
    .split("+")
    .map((v) => v.trim())
    .filter(Boolean);

const stripDosage = (value: string) =>
  value
    .replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

const genericIngredientsFromFdc = (composition: string[]) => composition.map(stripDosage).filter(Boolean);

interface CatalogEntry {
  id: string;
  label: string;
  type: SuggestionType;
  subtitle: string;
  resolveEntries: () => string[];
}

const buildCatalog = () => {
  const entries: CatalogEntry[] = [];
  const genericSet = new Set<string>();

  for (const [brand, generic] of Object.entries(brandMap)) {
    const key = normalize(brand);
    const hasFdc = Boolean(fdcMap[key]);
    const composition = hasFdc ? fdcMap[key].composition : null;

    splitPlus(generic).forEach((item) => genericSet.add(normalize(item)));
    if (composition) genericIngredientsFromFdc(composition).forEach((item) => genericSet.add(normalize(item)));

    entries.push({
      id: `brand:${key}`,
      label: brand,
      type: composition ? "Combination" : "Brand",
      subtitle: composition ? composition.join(" + ") : generic,
      resolveEntries: () => (composition ? composition : splitPlus(generic)),
    });
  }

  for (const [brand, data] of Object.entries(fdcMap)) {
    const key = normalize(brand);
    if (!brandMap[key]) {
      genericIngredientsFromFdc(data.composition).forEach((item) => genericSet.add(normalize(item)));
      entries.push({
        id: `combo:${key}`,
        label: brand,
        type: "Combination",
        subtitle: data.composition.join(" + "),
        resolveEntries: () => data.composition,
      });
    }
  }

  for (const generic of genericSet) {
    entries.push({
      id: `generic:${generic}`,
      label: generic,
      type: "Generic",
      subtitle: "generic drug",
      resolveEntries: () => [generic],
    });
  }

  return entries;
};

const catalog = buildCatalog();
const lookup = new Map(catalog.map((item) => [item.id, item]));
const labelToEntry = new Map(catalog.map((item) => [normalize(item.label), item]));

const rankType = (type: SuggestionType) => {
  if (type === "Combination") return 3;
  if (type === "Brand") return 2;
  return 1;
};

const wouldBeDuplicate = (selected: string[], entriesToAdd: string[]) => {
  const normalizedSelected = new Set(selected.map(normalize));
  return entriesToAdd.every((entry) => normalizedSelected.has(normalize(entry)));
};

export const searchDrugSuggestions = (query: string, selected: string[]): DrugSuggestion[] => {
  const q = normalize(query);
  if (q.length < 1) return [];

  return catalog
    .map((entry) => ({ entry, matchIndex: normalize(entry.label).indexOf(q) }))
    .filter(({ entry, matchIndex }) => {
      if (matchIndex < 0) return false;
      return !wouldBeDuplicate(selected, entry.resolveEntries());
    })
    .sort((a, b) => {
      if (a.matchIndex !== b.matchIndex) return a.matchIndex - b.matchIndex;
      const typeDelta = rankType(b.entry.type) - rankType(a.entry.type);
      if (typeDelta !== 0) return typeDelta;
      return a.entry.label.localeCompare(b.entry.label);
    })
    .slice(0, 10)
    .map(({ entry, matchIndex }) => ({
      id: entry.id,
      label: entry.label,
      type: entry.type,
      subtitle: entry.subtitle,
      matchIndex,
    }));
};

export const resolveSuggestionEntries = (id: string): string[] => {
  const entry = lookup.get(id);
  if (!entry) return [];
  return entry.resolveEntries();
};

export const parsePrescriptionText = (input: string): string[] => {
  const cleaned = input
    .replace(/\n/g, ",")
    .replace(/[;|]/g, ",")
    .trim();

  if (!cleaned) return [];

  const pieces = cleaned
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const out: string[] = [];

  for (const piece of pieces) {
    const exact = labelToEntry.get(normalize(piece));
    if (exact) {
      out.push(...exact.resolveEntries());
      continue;
    }

    if (piece.includes("+")) {
      out.push(
        ...piece
          .split("+")
          .map((s) => s.trim())
          .filter(Boolean)
      );
      continue;
    }

    out.push(piece);
  }

  return out;
};

export const extractKnownDrugsFromText = (text: string): string[] => {
  const normalizedText = normalize(text);
  if (!normalizedText) return [];

  const matched: string[] = [];
  const seen = new Set<string>();

  const ordered = [...catalog].sort((a, b) => b.label.length - a.label.length);
  for (const item of ordered) {
    const labelNorm = normalize(item.label);
    if (!labelNorm || !normalizedText.includes(labelNorm)) continue;
    const entries = item.resolveEntries();
    for (const entry of entries) {
      const key = normalize(entry);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      matched.push(entry);
    }
  }

  return matched;
};

const brandToGenericNormalized = new Map(
  Object.entries(brandMap).map(([brand, generic]) => [normalize(brand), generic])
);

const normalizeSingleEntry = (entry: string) => {
  const normalizedEntry = normalize(entry);

  const directBrand = brandToGenericNormalized.get(normalizedEntry);
  const expanded = directBrand ?? normalizedEntry;

  const parts = splitPlus(expanded).length > 0 ? splitPlus(expanded) : [expanded];

  return parts
    .map((part) => stripDosage(part))
    .map((part) => normalize(part))
    .filter(Boolean);
};

export const normalizeSelectedForInteractionCheck = (selectedEntries: string[]) => {
  const unique = new Set<string>();

  for (const entry of selectedEntries) {
    const parts = normalizeSingleEntry(entry);
    for (const part of parts) unique.add(part);
  }

  return [...unique];
};

export const appendUniqueEntries = (current: string[], incoming: string[]) => {
  const exists = new Set(current.map(normalize));
  const next = [...current];

  for (const item of incoming) {
    const key = normalize(item);
    if (!key || exists.has(key)) continue;
    exists.add(key);
    next.push(item.trim());
  }

  return next;
};

export const formatSelectedSummary = (selectedEntries: string[]) => selectedEntries.join(" + ");
