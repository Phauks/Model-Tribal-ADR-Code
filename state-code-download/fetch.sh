#!/usr/bin/env bash
# Temporary: runs the New Hampshire adapter's download on GitHub in 40-minute rounds, resuming from the last pack, and commits the pack after each round.
set -u
cd "$(dirname "$0")/.."
pip install -q pyyaml
git config user.name "github-actions[bot]"
git config user.email "41898699+github-actions[bot]@users.noreply.github.com"
mkdir -p /tmp/state-statutes/nh
[ -f state-code-download/nh-raw.tar.gz ] && tar -C /tmp/state-statutes/nh -xzf state-code-download/nh-raw.tar.gz
for round in 1 2 3 4 5 6 7; do
  start=$(date +%s)
  timeout 40m python3 -u scripts/law/state_statutes/run.py fetch NH --work /tmp/state-statutes > state-code-download/nh-log.txt 2>&1
  status=$?
  echo "round $round: exit $status after $(( $(date +%s) - start )) s" >> state-code-download/nh-log.txt
  echo "chapters on disk: $(ls /tmp/state-statutes/nh/raw/chapters 2>/dev/null | wc -l)" >> state-code-download/nh-log.txt
  tar -C /tmp/state-statutes/nh -czf state-code-download/nh-raw.tar.gz raw
  [ $status -eq 0 ] && echo "done" >> state-code-download/nh-log.txt
  git add state-code-download
  git commit -q -m "chore: state code download ($(head -1 state-code-download/request.txt), round $round)" || true
  for i in 1 2 3 4; do git pull --rebase -q origin "$GITHUB_REF_NAME" && git push -q origin HEAD:"$GITHUB_REF_NAME" && break; sleep 5; done
  [ $status -eq 0 ] && break
done
