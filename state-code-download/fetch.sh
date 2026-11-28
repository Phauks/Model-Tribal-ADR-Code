#!/usr/bin/env bash
# Test: can GitHub's runners reach the two sites? Saves a few pages and a status log.
set -u
cd "$(dirname "$0")"
mkdir -p test
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
: > test/status.txt
i=0
while read -r url; do
  [ -z "$url" ] && continue
  i=$((i+1))
  code=$(curl -s -L -A "$UA" -m 60 -o "test/$i.html" -w '%{http_code} %{url_effective} %{size_download}' "$url" 2>&1)
  echo "$i $url -> $code" >> test/status.txt
done <<'URLS'
https://gc.nh.gov/rsa/html/indexes/default.html
https://gc.nh.gov/rsa/html/NHTOC/NHTOC-I.htm
https://gc.nh.gov/rsa/html/NHTOC/NHTOC-I-1.htm
https://gc.nh.gov/rsa/html/I/1/1-mrg.htm
https://gc.nh.gov/rsa/html/I/1/1-1.htm
https://gc.nh.gov/rsa/html/NHTOC/NHTOC-XII-125-A.htm
https://code.wvlegislature.gov/
https://code.wvlegislature.gov/1/
https://code.wvlegislature.gov/1-1/
https://code.wvlegislature.gov/1-1-1/
https://www.wvlegislature.gov/wvcode/code.cfm
https://code.wvlegislature.gov/5-1/
URLS
cat test/status.txt
