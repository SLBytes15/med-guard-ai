#!/usr/bin/env python3
"""Process Kaggle drug interactions CSV into normalized JSON lookup.

Usage:
  python3 scripts/process_kaggle_interactions.py \
    --input /path/to/db_drug_interactions.csv \
    --output data/drug_interactions.json \
    --public-output public/data/drug_interactions.json
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from typing import Dict, Iterable, Tuple

try:
    import pandas as pd  # type: ignore
except ImportError:  # pragma: no cover
    pd = None


KEYWORD_HIGH = (
    "fatal",
    "life-threatening",
    "severe",
    "major",
    "anaphylaxis",
    "bleeding",
    "hemorrhage",
    "toxicity",
    "serotonin syndrome",
    "respiratory depression",
    "torsades",
    "arrhythmia",
    "contraindicated",
)

KEYWORD_MEDIUM = (
    "caution",
    "monitor",
    "moderate",
    "dose adjustment",
    "may increase",
    "may decrease",
    "reduced",
    "decrease",
    "increase",
    "risk",
)

KEYWORD_LOW = (
    "minor",
    "generally safe",
    "safe",
)

SEVERITY_ORDER = {"LOW": 1, "MEDIUM": 2, "HIGH": 3}


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value)).strip().lower()


def canonical_pair(a: str, b: str) -> Tuple[str, str]:
    left = normalize_text(a)
    right = normalize_text(b)
    return tuple(sorted((left, right)))


def normalize_level(raw_level: str | None, description: str) -> str:
    if raw_level:
        value = normalize_text(raw_level)
        if value in {"high", "severe", "major"}:
            return "HIGH"
        if value in {"medium", "moderate"}:
            return "MEDIUM"
        if value in {"low", "minor"}:
            return "LOW"

    text = normalize_text(description)
    if any(k in text for k in KEYWORD_HIGH):
        return "HIGH"
    if any(k in text for k in KEYWORD_MEDIUM):
        return "MEDIUM"
    if any(k in text for k in KEYWORD_LOW):
        return "LOW"
    return "MEDIUM"


def first_present(row: Dict[str, str], candidates: Tuple[str, ...]) -> str:
    for col in candidates:
        if col in row:
            return str(row.get(col, ""))
    return ""


def upsert_interaction(
    interaction_map: Dict[str, Dict[str, str]],
    drug_1: str,
    drug_2: str,
    description: str,
    severity_raw: str | None,
) -> None:
    if not drug_1 or not drug_2 or not description:
        return

    if normalize_text(drug_1) == "nan" or normalize_text(drug_2) == "nan" or normalize_text(description) == "nan":
        return

    left, right = canonical_pair(drug_1, drug_2)
    key = f"{left} + {right}"

    level = normalize_level(severity_raw, description)
    reason = re.sub(r"\s+", " ", str(description)).strip()

    current = interaction_map.get(key)
    if current is None:
        interaction_map[key] = {"level": level, "reason": reason}
        return

    if SEVERITY_ORDER[level] > SEVERITY_ORDER[current["level"]]:
        interaction_map[key] = {"level": level, "reason": reason}


def iter_rows(input_path: Path) -> Iterable[Dict[str, str]]:
    if pd is not None:
        df = pd.read_csv(input_path)
        df.columns = [normalize_text(c).replace(" ", "_") for c in df.columns]
        for _, row in df.iterrows():
            yield {k: str(v) for k, v in row.to_dict().items()}
        return

    with input_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            return

        normalized_fieldnames = [normalize_text(c).replace(" ", "_") for c in reader.fieldnames]
        for raw in reader:
            normalized = {}
            for original, normalized_name in zip(reader.fieldnames, normalized_fieldnames):
                normalized[normalized_name] = str(raw.get(original, ""))
            yield normalized


def process_csv(input_path: Path) -> Dict[str, Dict[str, str]]:
    interaction_map: Dict[str, Dict[str, str]] = {}

    for row in iter_rows(input_path):
        drug_1 = first_present(row, ("drug_1", "drug1", "drug_a", "drug"))
        drug_2 = first_present(row, ("drug_2", "drug2", "drug_b", "interacts_with"))
        description = first_present(row, ("interaction_description", "description", "interaction"))
        severity_raw = first_present(row, ("severity", "interaction_severity", "level"))
        upsert_interaction(interaction_map, drug_1, drug_2, description, severity_raw)

    return interaction_map


def write_json(data: Dict[str, Dict[str, str]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(dict(sorted(data.items())), f, indent=2, ensure_ascii=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Process drug interactions CSV to JSON map")
    parser.add_argument("--input", required=True, help="Path to input CSV")
    parser.add_argument("--output", default="data/drug_interactions.json", help="Primary output JSON path")
    parser.add_argument(
        "--public-output",
        default="public/data/drug_interactions.json",
        help="Optional mirrored output for frontend runtime fetch",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    public_output_path = Path(args.public_output)

    if not input_path.exists():
        raise FileNotFoundError(f"Input CSV not found: {input_path}")

    result = process_csv(input_path)
    write_json(result, output_path)
    write_json(result, public_output_path)

    print(f"Processed pairs: {len(result)}")
    print(f"Saved: {output_path}")
    print(f"Saved: {public_output_path}")


if __name__ == "__main__":
    main()
