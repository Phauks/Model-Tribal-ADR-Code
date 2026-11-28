#!/usr/bin/env bash
# Temporary: runs the New Hampshire adapter's download on GitHub for at most 40 minutes, resuming from the last pack, and packs what it has.
set -u
cd "$(dirname "$0")/.."
pip install -q pyyaml
mkdir -p /tmp/state-statutes/nh
[ -f state-code-download/nh-raw.tar.gz ] && tar -C /tmp/state-statutes/nh -xzf state-code-download/nh-raw.tar.gz
start=$(date +%s)
timeout 40m python3 -u scripts/law/state_statutes/run.py fetch NH --work /tmp/state-statutes > state-code-download/nh-log.txt 2>&1
echo "exit $? after $(( $(date +%s) - start )) s" >> state-code-download/nh-log.txt
echo "chapters on disk: $(ls /tmp/state-statutes/nh/raw/chapters 2>/dev/null | wc -l)" >> state-code-download/nh-log.txt
tar -C /tmp/state-statutes/nh -czf state-code-download/nh-raw.tar.gz raw
tail -40 state-code-download/nh-log.txt
