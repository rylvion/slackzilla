#!/bin/bash
set -euo pipefail

echo "setting up slackzilla server..."
sudo apt update
echo "installing dependencies..."
sudo apt install -y git curl ca-certificates nano openssl
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

echo "creating project directory..."
mkdir -p ~/projs
cd ~/projs

if [ ! -d slackzilla ]; then
	echo "cloning slackzilla repo..."
	git clone https://github.com/rylvion/slackzilla.git
else
	echo "slackzilla already exists, reusing the existing checkout..."
fi

cd slackzilla

echo "installing npm dependencies..."
npm ci

echo "setting up environment files..."
if [ ! -f src/.env ]; then
	cp src/.env.example src/.env
fi
if [ ! -f server/.env ]; then
	cp server/.env.example server/.env
fi

REPO_URL="$(git remote get-url origin)"
WEBHOOK_SECRET="$(openssl rand -hex 32)"

sed -i "s|^WEBHOOK_SECRET=.*|WEBHOOK_SECRET=$WEBHOOK_SECRET|" server/.env
sed -i "s|^PORT=.*|PORT=9000|" server/.env
sed -i "s|^PROJECT_DIR=.*|PROJECT_DIR=$PWD|" server/.env
sed -i "s|^SERVICE_NAME=.*|SERVICE_NAME=slackzilla|" server/.env
sed -i "s|^BRANCH=.*|BRANCH=main|" server/.env
sed -i "s|^REPO_URL=.*|REPO_URL=$REPO_URL|" server/.env

echo "setting up systemd services..."
sudo cp server/slackzilla.service /etc/systemd/system/slackzilla.service
sudo cp server/slackzilla-webhook.service /etc/systemd/system/slackzilla-webhook.service
sudo systemctl daemon-reload
sudo systemctl enable --now slackzilla.service slackzilla-webhook.service

echo "slackzilla server setup complete."
echo "edit src/.env for the bot tokens if needed, then set the github webhook secret and url."
echo "use journalctl -u slackzilla.service -f and journalctl -u slackzilla-webhook.service -f to view the logs."