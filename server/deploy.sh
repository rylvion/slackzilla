#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/.env"

BRANCH="${BRANCH:-main}"
SERVICE_NAME="${SERVICE_NAME:-slackzilla}"
WEBHOOK_SERVICE_NAME="${WEBHOOK_SERVICE_NAME:-slackzilla-webhook}"

echo "====Slackzilla :: Remote Deployment Initialised===="
echo "[*] Timestamp      : $(date)"
echo "[*] Target         : $PROJECT_DIR"
echo "[*] Branch         : $BRANCH"
echo

cd "$PROJECT_DIR"

echo "[>] Verifying repository..."

git remote set-url origin "$REPO_URL"

echo "[>] Fetching latest commits..."
git fetch origin "$BRANCH"

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

echo "[*] Local  : ${LOCAL:0:7}"
echo "[*] Remote : ${REMOTE:0:7}"

if [ "$LOCAL" = "$REMOTE" ]; then
    echo
    echo "[✓] No changes detected."
    echo "[✓] Deployment skipped."
    exit 0
fi

echo
echo "[>] Syncing repository..."
git reset --hard "origin/$BRANCH"

echo
echo "[>] Installing dependencies..."
npm ci

echo
echo "[>] Building React client..."
npm run build

echo
echo "[>] Restarting service..."
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl restart nginx

echo
echo "[>] Scheduling webhook restart..."
if command -v systemd-run >/dev/null 2>&1; then
    systemd-run --unit="slackzilla-webhook-restart-$(date +%s)" --on-active=2s /bin/systemctl restart "$WEBHOOK_SERVICE_NAME" >/dev/null
else
    echo "[!] systemd-run is required to restart $WEBHOOK_SERVICE_NAME safely"
    exit 1
fi

echo
echo "[✓] Deployment successful."
echo "[✓] Slackzilla is now running commit ${REMOTE:0:7}"
echo "=============================================="
