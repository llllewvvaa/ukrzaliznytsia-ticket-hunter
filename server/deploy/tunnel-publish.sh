#!/usr/bin/env bash
# Reads the hostname a cloudflared quick tunnel was given, stores it as
# UZ_MINIAPP_URL and points the bot's menu button at it. Quick tunnels get a new
# hostname on every restart, so this runs after the tunnel starts.
set -euo pipefail

ENV_FILE="${UZ_ENV_FILE:-/opt/uz-watch/server/.env}"
UNIT="${UZ_TUNNEL_UNIT:-uz-tunnel}"
TRIES="${UZ_TUNNEL_TRIES:-30}"

# Search from the moment the tunnel unit last started, so a manual run hours
# later still finds the hostname the running tunnel was given.
since=$(systemctl show -p ActiveEnterTimestamp --value "$UNIT" 2>/dev/null || true)
[ -z "$since" ] && since="-5 min"

url=""
for _ in $(seq 1 "$TRIES"); do
  url=$(journalctl -u "$UNIT" --since "$since" --no-pager 2>/dev/null |
    grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1 || true)
  [ -n "$url" ] && break
  sleep 2
done

if [ -z "$url" ]; then
  echo "tunnel url not found in journal of $UNIT" >&2
  exit 1
fi

echo "tunnel url: $url"

# The app is served only under a secret path; the bare tunnel root answers 404,
# so the address alone is not enough to reach even the empty shell.
secret=$(grep '^UZ_APP_SECRET=' "$ENV_FILE" | cut -d= -f2- || true)
app_url="$url/"
if [ -n "$secret" ]; then
  app_url="$url/$secret/"
fi

tmp=$(mktemp)
grep -v '^UZ_MINIAPP_URL=' "$ENV_FILE" > "$tmp" || true
echo "UZ_MINIAPP_URL=$app_url" >> "$tmp"
install -m 600 "$tmp" "$ENV_FILE"
rm -f "$tmp"

token=$(grep '^UZ_BOT_TOKEN=' "$ENV_FILE" | cut -d= -f2-)
if [ -n "$token" ]; then
  payload=$(printf '{"menu_button":{"type":"web_app","text":"Сторож квитків","web_app":{"url":"%s"}}}' "$app_url")
  curl -s -m 15 -X POST "https://api.telegram.org/bot$token/setChatMenuButton" \
    -H 'content-type: application/json' -d "$payload" | head -c 200
  echo

  commands='{"commands":[
    {"command":"ways","description":"знайти спосіб доїхати"},
    {"command":"watch","description":"почати стежити за напрямком"},
    {"command":"list","description":"мої стеження"},
    {"command":"cheapest","description":"найдешевше зараз"},
    {"command":"fav","description":"додати або зняти улюблене"},
    {"command":"pause","description":"пауза стеження"},
    {"command":"resume","description":"продовжити стеження"},
    {"command":"forecast","description":"чи варто чекати квиток"},
    {"command":"stats","description":"скільки запитів витрачено"}
  ]}'
  curl -s -m 15 -X POST "https://api.telegram.org/bot$token/setMyCommands" \
    -H 'content-type: application/json' -d "$commands" | head -c 120
  echo
fi

systemctl restart uz-watch || true
