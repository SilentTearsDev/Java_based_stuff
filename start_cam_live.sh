#!/bin/bash

set -e

REPO_URL="git@github.com:SilentTearsDev/Java_based_stuff.git"
REPO_DIR="Java_based_stuff"
PROJECT_DIR="cam_live"

echo "=== cam_live starter ==="

# Clone repo if it doesn't exist yet
if [ ! -d "$REPO_DIR" ]; then
    echo "Cloning repo..."
    git clone "$REPO_URL"
else
    echo "Repo already exists, skipping clone."
fi

cd "$REPO_DIR"

# Pull latest changes if it's already cloned
echo "Updating repo..."
git pull || true

# Make sure project folder exists
if [ ! -d "$PROJECT_DIR" ]; then
    echo "ERROR: '$PROJECT_DIR' folder does not exist inside the repo."
    exit 1
fi

cd "$PROJECT_DIR"

# Install npm dependencies if package.json exists
if [ -f "package.json" ]; then
    echo "Installing npm dependencies..."
    npm install
else
    echo "ERROR: package.json not found in $PROJECT_DIR"
    exit 1
fi

echo "Starting cam_live server..."
npm start