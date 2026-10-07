"""Rebuild public/airports.json from the OurAirports dataset (public domain).

Download https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv
and https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/countries.csv, then run:
    python3 scripts/update-airports.py airports.csv countries.csv
Keeps airports with an IATA code and scheduled passenger flights.
Each entry is [code, name, city, country].
"""
import csv
import json
import sys
from pathlib import Path

airports_csv, countries_csv = sys.argv[1], sys.argv[2]
countries = {r["code"]: r["name"] for r in csv.DictReader(open(countries_csv, encoding="utf-8"))}
out = []
for r in csv.DictReader(open(airports_csv, encoding="utf-8")):
    code = (r["iata_code"] or "").strip().upper()
    if len(code) != 3 or not code.isalpha():
        continue
    if r["scheduled_service"] != "yes" or r["type"] not in ("large_airport", "medium_airport", "small_airport"):
        continue
    name = r["name"].replace(" International Airport", "").replace(" Airport", "").strip()
    out.append([code, name, r["municipality"] or "", countries.get(r["iso_country"], r["iso_country"])])
# Big airports first so they come up first in suggestions.
size = {"large_airport": 0, "medium_airport": 1, "small_airport": 2}
types = {r["iata_code"]: size.get(r["type"], 3) for r in csv.DictReader(open(airports_csv, encoding="utf-8"))}
out.sort(key=lambda a: (types.get(a[0], 3), a[0]))
seen, unique = set(), []
for a in out:
    if a[0] not in seen:
        seen.add(a[0])
        unique.append(a)
dest = Path(__file__).resolve().parent.parent / "public" / "airports.json"
dest.write_text(json.dumps(unique, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"wrote {len(unique)} airports to {dest}")
