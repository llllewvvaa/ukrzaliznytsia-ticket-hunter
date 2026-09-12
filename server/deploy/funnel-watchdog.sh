#!/usr/bin/env bash
set -u

HOST="${UZ_FUNNEL_HOST:-dell-server.taild26259.ts.net}"
ENV_FILE="${UZ_ENV_FILE:-/opt/uz-watch/server/.env}"
STATE="${UZ_FUNNEL_STATE:-/run/uz-funnel-fails}"
LIMIT="${UZ_FUNNEL_LIMIT:-3}"

code=$(curl --doh-url https://1.1.1.1/dns-query -s -o /dev/null -m 25 -w '%{http_code}' "https://$HOST/" || true)

if [ "$code" != "000" ] && [ -n "$code" ]; then
  echo 0 > "$STATE"
  echo "funnel ok: $code"
  exit 0
fi

fails=$(( $(cat "$STATE" 2>/dev/null || echo 0) + 1 ))
echo "$fails" > "$STATE"
echo "funnel unreachable from outside (attempt $fails/$LIMIT)"
[ "$fails" -lt "$LIMIT" ] && exit 0

echo 0 > "$STATE"
systemctl restart tailscaled
sleep 20
after=$(curl --doh-url https://1.1.1.1/dns-query -s -o /dev/null -m 25 -w '%{http_code}' "https://$HOST/" || true)
echo "restarted tailscaled; funnel now: $after"

token=$(grep '^UZ_BOT_TOKEN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
chat=$(grep '^UZ_ALLOWED_CHATS=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | cut -d, -f1 || true)
if [ -z "$token" ] || [ -z "$chat" ]; then
  exit 0
fi

if [ "$after" = "000" ] || [ -z "$after" ]; then
  text="Адреса сторожа не відповідала ззовні. Перезапустив тунель Tailscale — не допомогло, потрібні руки."
else
  text="Адреса сторожа не відповідала ззовні. Перезапустив тунель Tailscale — застосунок знову відкривається."
fi
curl -s -o /dev/null -m 15 "https://api.telegram.org/bot$token/sendMessage" \
  --data-urlencode "chat_id=$chat" --data-urlencode "text=$text"
