#!/bin/bash
set -e

export FORCE_COLOR=1
export npm_config_color=true
export npm_config_foreground_scripts=true

export GIT_CONFIG_COUNT=1
export GIT_CONFIG_KEY_0=color.ui
export GIT_CONFIG_VALUE_0=always

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
RESET='\033[0m'

info() { echo -e "${BLUE}[>] $*${RESET}"; }
success() { echo -e "${GREEN}[✓] $*${RESET}"; }
warning() { echo -e "${YELLOW}[!] $*${RESET}"; }
error() { echo -e "${RED}[✗] $*${RESET}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/.env"

BRANCH="${BRANCH:-main}"
SERVICE_NAME="${SERVICE_NAME:-slackzilla}"
WEBHOOK_SERVICE_NAME="${WEBHOOK_SERVICE_NAME:-slackzilla-webhook}"

echo -e "${CYAN}====Slackzilla :: Remote Deployment Initialised====${RESET}"
echo -e "${CYAN}[*] Timestamp      : $(date)${RESET}"
echo -e "${CYAN}[*] Target         : $PROJECT_DIR${RESET}"
echo -e "${CYAN}[*] Branch         : $BRANCH${RESET}"
echo

cd "$PROJECT_DIR"

info "Verifying repository..."

git remote set-url origin "$REPO_URL"

info "Fetching latest commits..."
git fetch origin "$BRANCH"

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

echo -e "${CYAN}[*] Local  : ${LOCAL:0:7}${RESET}"
echo -e "${CYAN}[*] Remote : ${REMOTE:0:7}${RESET}"

if [ "$LOCAL" = "$REMOTE" ]; then
    echo
    warning "No changes detected."
    success "Deployment skipped."
    exit 0
fi

echo
info "Syncing repository..."
git reset --hard "origin/$BRANCH"

echo
info "Installing dependencies..."
npm ci

echo
info "Building React client..."
npm run build

echo
info "Restarting service..."
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl restart nginx

echo
info "Scheduling webhook restart..."
if command -v systemd-run >/dev/null 2>&1; then
    systemd_output=$(systemd-run --unit="slackzilla-webhook-restart-$(date +%s)" --on-active=2s /bin/systemctl restart "$WEBHOOK_SERVICE_NAME")
    echo -e "${GREEN}${systemd_output}${RESET}"
else
    warning "systemd-run is required to restart $WEBHOOK_SERVICE_NAME safely"
    exit 1
fi

echo
success "Deployment successful."
success "Slackzilla is now running commit ${REMOTE:0:7}"