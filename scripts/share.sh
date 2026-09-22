#!/usr/bin/env bash
#
# share.sh — put the Lotus Peak site on the public URL so the client can look at it.
#
#   ./share.sh          start everything, print the link, hold it open
#   ./share.sh --build  rebuild the site first (do this after you change code)
#   ./share.sh stop     take the site back down
#
# Leave the script running for as long as the client needs the link.
# Ctrl+C takes the site down again.
#
set -uo pipefail

PORT=3050
TUNNEL_NAME=lotus-peak
TUNNEL_CONFIG="$HOME/.cloudflared/$TUNNEL_NAME.yml"
PUBLIC_URL="https://lotuspeak.abhishekprasadsah.com.np"

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${TMPDIR:-/tmp}/lotus-peak-share"
APP_LOG="$LOG_DIR/app.log"
TUNNEL_LOG="$LOG_DIR/tunnel.log"

# cloudflared ALWAYS reads ~/.cloudflared/config.yml unless --config is passed, and
# that file belongs to the propertykhoj tunnel. Every cloudflared call below passes
# --config for that reason; dropping it silently runs the wrong tunnel.
CFD=(cloudflared --config "$TUNNEL_CONFIG")

# Only the processes this run started get cleaned up, so an app or tunnel you had
# already going by hand survives Ctrl+C.
APP_PID=""
TUNNEL_PID=""

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
info() { printf '  %s\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
die()  { printf '\n  \033[31m✗ %s\033[0m\n\n' "$1" >&2; exit 1; }

app_is_up()    { lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; }
tunnel_is_up() { pgrep -f "tunnel run $TUNNEL_NAME" >/dev/null 2>&1; }

kill_port() {
  local pids
  pids=$(lsof -ti TCP:"$PORT" -sTCP:LISTEN 2>/dev/null)
  [[ -n "$pids" ]] && kill $pids 2>/dev/null
  return 0
}

# ---------------------------------------------------------------- stop

stop_everything() {
  bold "Taking the site down"
  if tunnel_is_up; then
    pkill -f "tunnel run $TUNNEL_NAME" && ok "tunnel stopped"
  else
    info "tunnel was not running"
  fi
  if app_is_up; then
    kill_port
    ok "site on port $PORT stopped"
  else
    info "nothing was running on port $PORT"
  fi
  echo
  info "$PUBLIC_URL is now offline."
  echo
}

if [[ "${1:-}" == "stop" ]]; then
  stop_everything
  exit 0
fi

REBUILD=0
[[ "${1:-}" == "--build" ]] && REBUILD=1

# ---------------------------------------------------------------- cleanup

cleanup() {
  trap - INT TERM EXIT
  echo
  bold "Shutting down"
  if [[ -n "$TUNNEL_PID" ]]; then
    kill "$TUNNEL_PID" 2>/dev/null && ok "tunnel stopped"
  elif tunnel_is_up; then
    info "tunnel left running (it was already up before this script)"
  fi
  if [[ -n "$APP_PID" ]]; then
    kill "$APP_PID" 2>/dev/null && ok "site stopped"
  elif app_is_up; then
    info "site left running (it was already up before this script)"
  fi
  echo
  info "$PUBLIC_URL is offline until you run this script again."
  echo
  exit 0
}
trap cleanup INT TERM

# ---------------------------------------------------------------- preflight

mkdir -p "$LOG_DIR"
cd "$APP_DIR" || die "cannot enter $APP_DIR"

echo
bold "Lotus Peak — client preview"
echo

command -v cloudflared >/dev/null 2>&1 || die "cloudflared is not installed. Run: brew install cloudflared"
command -v npm         >/dev/null 2>&1 || die "npm is not installed."
[[ -f "$TUNNEL_CONFIG" ]] || die "missing tunnel config: $TUNNEL_CONFIG"
[[ -f "$HOME/.cloudflared/3b362959-1548-42a6-8a81-9c7d39e67b2a.json" ]] \
  || warn "tunnel credentials file not found — cloudflared may fail to connect"

# ---------------------------------------------------------------- 1. the site

bold "1. Site on port $PORT"

if [[ $REBUILD -eq 1 ]]; then
  if app_is_up; then
    info "stopping the running site so the rebuild is what gets served"
    kill_port
    sleep 2
  fi
  info "building (this takes a minute)…"
  npm run build >"$APP_LOG" 2>&1 || { tail -30 "$APP_LOG"; die "build failed — full log: $APP_LOG"; }
  ok "build finished"
fi

if app_is_up; then
  ok "already running — leaving it alone"
else
  [[ -f .next/BUILD_ID ]] || {
    info "no build found, building first (this takes a minute)…"
    npm run build >"$APP_LOG" 2>&1 || { tail -30 "$APP_LOG"; die "build failed — full log: $APP_LOG"; }
    ok "build finished"
  }
  info "starting…"
  npx next start -p "$PORT" >>"$APP_LOG" 2>&1 &
  APP_PID=$!
  for _ in $(seq 1 30); do
    app_is_up && break
    kill -0 "$APP_PID" 2>/dev/null || { tail -30 "$APP_LOG"; die "the site exited on startup — full log: $APP_LOG"; }
    sleep 1
  done
  app_is_up || { tail -30 "$APP_LOG"; die "the site never came up on port $PORT — full log: $APP_LOG"; }
  ok "running (pid $APP_PID)"
fi

curl -sf -o /dev/null -m 10 "http://localhost:$PORT/" \
  || die "port $PORT is open but the site is not answering. Check $APP_LOG"
ok "answering on http://localhost:$PORT"

# ---------------------------------------------------------------- 2. the tunnel

echo
bold "2. Cloudflare tunnel"

if tunnel_is_up; then
  ok "already running — leaving it alone"
else
  info "connecting…"
  "${CFD[@]}" tunnel run "$TUNNEL_NAME" >"$TUNNEL_LOG" 2>&1 &
  TUNNEL_PID=$!
  for _ in $(seq 1 30); do
    grep -q "Registered tunnel connection" "$TUNNEL_LOG" 2>/dev/null && break
    kill -0 "$TUNNEL_PID" 2>/dev/null || { tail -30 "$TUNNEL_LOG"; die "cloudflared exited — full log: $TUNNEL_LOG"; }
    sleep 1
  done
  grep -q "Registered tunnel connection" "$TUNNEL_LOG" 2>/dev/null \
    || { tail -30 "$TUNNEL_LOG"; die "the tunnel never connected — full log: $TUNNEL_LOG"; }
  ok "connected (pid $TUNNEL_PID)"
fi

# ---------------------------------------------------------------- 3. the public url

echo
bold "3. Public URL"
info "checking (DNS can take up to a minute to catch up)…"

CODE=""
for _ in $(seq 1 20); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 15 "$PUBLIC_URL/" 2>/dev/null)
  [[ "$CODE" == "200" ]] && break
  sleep 5
done

if [[ "$CODE" != "200" ]]; then
  echo
  warn "the public URL answered $CODE instead of 200."
  if [[ "$CODE" == "404" ]]; then
    warn "a 404 with no content-type means the hostname is pointed at the wrong tunnel. Re-point it with:"
    warn "  cloudflared --config $TUNNEL_CONFIG tunnel route dns --overwrite-dns $TUNNEL_NAME lotuspeak.abhishekprasadsah.com.np"
  fi
  warn "tunnel log: $TUNNEL_LOG"
  echo
else
  ok "live"
fi

echo
printf '\033[1;32m  ────────────────────────────────────────────────\033[0m\n'
printf '\033[1m  Send the client:  \033[0m\033[1;36m%s\033[0m\n' "$PUBLIC_URL"
printf '\033[1;32m  ────────────────────────────────────────────────\033[0m\n'
echo
info "Leave this window open while they are looking."
info "Press Ctrl+C to take the site back down."
echo

# Hold open. If either process we started dies, fall into cleanup.
while true; do
  if [[ -n "$APP_PID" ]] && ! kill -0 "$APP_PID" 2>/dev/null; then
    warn "the site stopped unexpectedly — check $APP_LOG"; cleanup
  fi
  if [[ -n "$TUNNEL_PID" ]] && ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
    warn "the tunnel stopped unexpectedly — check $TUNNEL_LOG"; cleanup
  fi
  sleep 5
done
