#!/usr/bin/env python3
"""India-aware drug interaction pipeline (brand + generic + risk logic).

Functions requested:
1) normalize_drug_name(name, brand_map)
2) expand_combination_drugs(drugs)
3) generate_combinations(drugs)
4) check_interactions(drug_pairs, interaction_db)
"""

from __future__ import annotations

import itertools
import json
import re
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path(__file__).resolve().parents[1]
BRAND_MAP_PATH = ROOT / "data" / "india" / "brand_to_generic_india.json"
INTERACTION_DB_PATH = ROOT / "data" / "india" / "interaction_db_india.json"

FALLBACK_MSG = "⚠️ No known interaction found in current database. This does not guarantee safety."

SEVERITY_RANK = {"LOW": 1, "MEDIUM": 2, "HIGH": 3}

HIGH_KEYWORDS = (
    "life-threatening",
    "severe",
    "bleeding",
    "respiratory depression",
    "fatal",
    "contraindicated",
)
MEDIUM_KEYWORDS = (
    "monitor",
    "caution",
    "moderate",
    "requires monitoring",
)
LOW_KEYWORDS = ("safe", "minor", "generally safe")


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text).strip().lower())


def _strip_dosage(text: str) -> str:
    return re.sub(r"\b\d+(?:\.\d+)?\s*(mg|mcg|g|ml|iu|units?)\b", "", text, flags=re.IGNORECASE).strip()


def _canonical_pair(a: str, b: str) -> str:
    x, y = _normalize_text(a), _normalize_text(b)
    return " + ".join(sorted([x, y]))


def _infer_level(reason: str) -> str:
    r = _normalize_text(reason)
    if any(k in r for k in HIGH_KEYWORDS):
        return "HIGH"
    if any(k in r for k in MEDIUM_KEYWORDS):
        return "MEDIUM"
    if any(k in r for k in LOW_KEYWORDS):
        return "LOW"
    return "MEDIUM"


def load_datasets(
    brand_map_path: Path = BRAND_MAP_PATH,
    interaction_db_path: Path = INTERACTION_DB_PATH,
) -> Tuple[Dict[str, List[str]], Dict[str, Dict[str, str]]]:
    with brand_map_path.open("r", encoding="utf-8") as f:
        brand_map = json.load(f)

    with interaction_db_path.open("r", encoding="utf-8") as f:
        interaction_db = json.load(f)

    return brand_map, interaction_db


def normalize_drug_name(name: str, brand_map: Dict[str, List[str]]) -> List[str]:
    """Convert input medicine to generic list using India brand mapping.

    Examples:
    - dolo 650 -> ["paracetamol"]
    - combiflam -> ["ibuprofen", "paracetamol"]
    """
    key = _normalize_text(name)
    if key in brand_map:
        return [_normalize_text(x) for x in brand_map[key]]

    # If already generic/combo text, split by '+' and normalize.
    if "+" in key:
        return [_normalize_text(part) for part in key.split("+") if _normalize_text(part)]

    return [_normalize_text(key)]


def expand_combination_drugs(drugs: List[str], brand_map: Dict[str, List[str]]) -> List[str]:
    """Expand brands/combo entries into unique generic components."""
    expanded: List[str] = []
    seen = set()

    for drug in drugs:
        generic_parts = normalize_drug_name(drug, brand_map)
        for part in generic_parts:
            clean = _normalize_text(_strip_dosage(part))
            if clean and clean not in seen:
                seen.add(clean)
                expanded.append(clean)

    return expanded


def generate_combinations(drugs: List[str]) -> List[Tuple[str, str]]:
    """Generate all unique drug pairs: n(n-1)/2."""
    unique = []
    seen = set()
    for d in drugs:
        n = _normalize_text(d)
        if n and n not in seen:
            seen.add(n)
            unique.append(n)

    return list(itertools.combinations(unique, 2))


def check_interactions(
    drug_pairs: List[Tuple[str, str]], interaction_db: Dict[str, Dict[str, str]]
) -> List[Dict[str, str]]:
    """Check each pair against interaction DB with bidirectional matching."""
    results: List[Dict[str, str]] = []

    for a, b in drug_pairs:
        key = _canonical_pair(a, b)
        hit = interaction_db.get(key)
        if not hit:
            continue

        reason = hit.get("reason", "Potential interaction detected.")
        level = hit.get("level", "").upper() or _infer_level(reason)
        if level not in SEVERITY_RANK:
            level = _infer_level(reason)

        advice = hit.get("advice")
        if not advice:
            advice = {
                "HIGH": "Avoid combination and consult doctor immediately.",
                "MEDIUM": "Use with caution and monitor symptoms.",
                "LOW": "Generally safe in recommended doses.",
            }[level]

        results.append(
            {
                "drugA": a,
                "drugB": b,
                "level": level,
                "reason": reason,
                "advice": advice,
            }
        )

    results.sort(key=lambda x: SEVERITY_RANK.get(x["level"], 2), reverse=True)
    return results


def extract_drug_names_from_text(text: str, brand_map: Dict[str, List[str]]) -> List[str]:
    """Simple extractor for free text/OCR output using known brand tokens."""
    normalized = _normalize_text(text)
    found: List[str] = []

    # Longest brands first to avoid partial overlaps.
    for brand in sorted(brand_map.keys(), key=len, reverse=True):
        if brand in normalized:
            found.append(brand)

    # Also catch plus-separated generics typed directly.
    # Example: "paracetamol + ibuprofen"
    generic_chunks = re.findall(r"[a-zA-Z][a-zA-Z\s+]{2,}", text)
    for chunk in generic_chunks:
        chunk_norm = _normalize_text(chunk)
        if "+" in chunk_norm:
            found.extend([_normalize_text(x) for x in chunk_norm.split("+") if _normalize_text(x)])

    # Deduplicate preserving order.
    out: List[str] = []
    seen = set()
    for item in found:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def analyze_input(user_input: str) -> Dict[str, object]:
    """Full pipeline:
    input -> extraction -> normalization -> expansion -> pairing -> interaction lookup.
    """
    brand_map, interaction_db = load_datasets()

    extracted = extract_drug_names_from_text(user_input, brand_map)
    expanded = expand_combination_drugs(extracted, brand_map)
    pairs = generate_combinations(expanded)
    interactions = check_interactions(pairs, interaction_db)

    if not interactions:
        return {
            "extracted_drugs": extracted,
            "normalized_drugs": expanded,
            "interactions": [],
            "message": FALLBACK_MSG,
        }

    return {
        "extracted_drugs": extracted,
        "normalized_drugs": expanded,
        "interactions": interactions,
    }


if __name__ == "__main__":
    sample = "Patient meds: Combiflam, Dolo 650, and Ecosprin"
    result = analyze_input(sample)
    print(json.dumps(result, indent=2))
