#!/usr/bin/env bash
# Temporary: runs the New Hampshire adapter's download on GitHub and packs it; probes West Virginia's sites.
set -u
cd "$(dirname "$0")/.."
pip install -q pyyaml
python3 scripts/law/state_statutes/run.py fetch NH --work /tmp/state-statutes 2>&1 | tail -30
tar -C /tmp/state-statutes/nh -czf state-code-download/nh-raw.tar.gz raw
ls -la state-code-download
cp /tmp/state-statutes/nh/raw/index.html state-code-download/nh-index.html 2>/dev/null || true
