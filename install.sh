#!/usr/bin/env bash
# ============================================================
# Google Tasks Desklet - Installer for Linux Mint Cinnamon
# ============================================================

set -euo pipefail

DESKLET_UUID="google-tasks@desklet"
DESKLET_DIR="$(cd "$(dirname "$0")" && pwd)/${DESKLET_UUID}/files/${DESKLET_UUID}"
INSTALL_DIR="${HOME}/.local/share/cinnamon/desklets/${DESKLET_UUID}"
CONFIG_DIR="${HOME}/.config/google-tasks-desklet"

echo ""
echo "============================================"
echo "  Google Tasks Desklet Installer"
echo "============================================"
echo ""

# --- Check Python3 ---
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] Python3 is required but not installed."
    echo "        Install it with: sudo apt install python3"
    exit 1
fi
echo "[OK] Python3 found: $(python3 --version)"

# --- Check Python dependencies ---
echo "[..] Checking Python dependencies..."
MISSING_DEPS=()

python3 -c "import urllib.request, urllib.parse, http.server, webbrowser, json, threading" 2>/dev/null || \
    MISSING_DEPS+=("urllib/http (standard library - should be present)")

if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
    echo "[WARN] Some dependencies may be missing:"
    for dep in "${MISSING_DEPS[@]}"; do
        echo "       - $dep"
    done
fi

# --- Create install directory ---
echo "[..] Installing desklet to: ${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}"

# --- Copy desklet files ---
cp -r "${DESKLET_DIR}/." "${INSTALL_DIR}/"
chmod +x "${INSTALL_DIR}/google_tasks_api.py"

echo "[OK] Desklet files installed."

# --- Create config directory ---
mkdir -p "${CONFIG_DIR}"
echo "[OK] Config directory ready: ${CONFIG_DIR}"

# --- Note regarding Google OAuth2 credentials ---
echo "[OK] Using default bundled Google API credentials."

# --- Reload Cinnamon desklets (if running) ---
if command -v dbus-send &>/dev/null; then
    echo "[..] Reloading Cinnamon desklets..."
    dbus-send --session --dest=org.Cinnamon --type=method_call \
        /org/Cinnamon org.Cinnamon.ReloadDesklets 2>/dev/null || true
fi

echo ""
echo "============================================"
echo "  Installation Complete!"
echo "============================================"
echo ""
echo "  To add the desklet to your desktop:"
echo "  1. Right-click the desktop"
echo "  2. Select 'Add Desklets'"
echo "  3. Find 'Google Tasks' and click 'Add to Desktop'"
echo ""
echo "  After adding, click 'Sign in with Google'"
echo "  to authenticate and view your tasks."
echo ""
