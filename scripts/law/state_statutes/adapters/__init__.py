"""State adapters for the state statutes sweep: one module per state, each a `State` subclass named ADAPTER (see ../README.md)."""
import importlib

NAMES = {'CO': 'colorado', 'WY': 'wyoming', 'MI': 'michigan', 'WI': 'wisconsin', 'OK': 'oklahoma', 'WA': 'washington', 'OR': 'oregon', 'MT': 'montana', 'NV': 'nevada', 'DE': 'delaware', 'NC': 'north_carolina', 'RI': 'rhode_island', 'SC': 'south_carolina', 'VA': 'virginia', 'AK': 'alaska', 'AZ': 'arizona', 'SD': 'south_dakota', 'MN': 'minnesota', 'ND': 'north_dakota', 'ID': 'idaho', 'KS': 'kansas', 'NE': 'nebraska', 'UT': 'utah', 'ME': 'maine', 'FL': 'florida', 'CA': 'california', 'VT': 'vermont', 'NJ': 'new_jersey', 'PA': 'pennsylvania', 'CT': 'connecticut', 'IA': 'iowa', 'MA': 'massachusetts', 'MD': 'maryland', 'MO': 'missouri', 'OH': 'ohio', 'TX': 'texas'}


def load(state: str):
    code = state.upper()
    if code not in NAMES:
        raise SystemExit(f'no adapter for {state}; adapters: {", ".join(sorted(NAMES))}')
    return importlib.import_module(f'adapters.{NAMES[code]}').ADAPTER
