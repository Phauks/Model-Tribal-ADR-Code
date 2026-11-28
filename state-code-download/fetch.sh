#!/usr/bin/env bash
# Temporary: runs the New Hampshire adapter's download on GitHub and packs it; probes West Virginia's sites.
set -u
cd "$(dirname "$0")/.."
pip install -q pyyaml
python3 scripts/law/state_statutes/run.py fetch NH --work /tmp/state-statutes 2>&1 | tail -30
tar -C /tmp/state-statutes/nh -czf state-code-download/nh-raw.tar.gz raw
ls -la state-code-download
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
{
  for host in code.wvlegislature.gov www.wvlegislature.gov wvlegislature.gov; do
    echo "== $host"; getent ahosts "$host" | head -4
    curl -sv -A "$UA" -m 30 -o /dev/null "https://$host/" 2>&1 | grep -E '^\*|^< HTTP' | head -15
    curl -s -A "$UA" -m 30 -o /dev/null -w 'http: %{http_code} %{redirect_url}\n' "http://$host/" 2>&1
    curl -s -4 --http1.1 -A "$UA" -m 30 -o /dev/null -w 'https v4 http1.1: %{http_code}\n' "https://$host/" 2>&1
    timeout 20 openssl s_client -connect "$host:443" -servername "$host" </dev/null 2>&1 | head -5
  done
} > state-code-download/wv-probe.txt 2>&1
cat state-code-download/wv-probe.txt
