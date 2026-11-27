"""State adapters for the state statutes sweep: one module per state, each a `State` subclass named ADAPTER (see ../README.md)."""
import importlib

NAMES = {'OK': 'oklahoma', 'WA': 'washington', 'OR': 'oregon', 'MT': 'montana', 'NV': 'nevada'}


def load(state: str):
    code = state.upper()
    if code not in NAMES:
        raise SystemExit(f'no adapter for {state}; adapters: {", ".join(sorted(NAMES))}')
    return importlib.import_module(f'adapters.{NAMES[code]}').ADAPTER
