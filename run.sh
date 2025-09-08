#!/usr/bin/env bash

# === Config: Project folder ===
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"   # the folder where run.sh lives

# Load Node (works with NVM or system PATH)
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    . "$HOME/.nvm/nvm.sh"
fi

check_node() {
    NODE_BIN=$(command -v node)
    if [ -z "$NODE_BIN" ]; then
        return 1
    fi

    NODE_VERSION=$($NODE_BIN -v | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)

    if [ "$NODE_MAJOR" -lt 22 ]; then
        return 2
    fi

    return 0
}

while true; do
    check_node
    STATUS=$?

    if [ $STATUS -eq 0 ]; then
        echo "✅ Node.js found: $($NODE_BIN -v)"
        break
    elif [ $STATUS -eq 1 ]; then
        echo "❌ Node.js not found!"
    else
        echo "❌ Node.js v22.x.x or newer required (found $($NODE_BIN -v))"
    fi

    echo
    echo "👉 Visit the official Node.js website: https://nodejs.org/"
    echo "👉 Or install via NVM (recommended):"
    echo "   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash"
    echo "   source \"\$HOME/.nvm/nvm.sh\""
    echo "   nvm install 22"
    echo "   nvm use 22"
    echo 
    echo "   Try Runing 'node -v' to check nodejs version "
    echo "Press Enter to retry once Node.js is installed, or Ctrl+C to exit."
    read -r _
done
# Detect terminal emulator
TERMINALS=("gnome-terminal" "xfce4-terminal" "mate-terminal" "konsole" "tilix" "x-terminal-emulator" "lxterminal" "terminator" "alacritty")
TERMINAL=""
for term in "${TERMINALS[@]}"; do
    if command -v "$term" >/dev/null 2>&1; then
        TERMINAL="$term"
        break
    fi
done
if [ -z "$TERMINAL" ]; then
    echo "❌ No supported terminal emulator found!"
    exit 1
fi
# === Build the run command ===
CMD="bash -c 'cd \"$PROJECT_DIR/SM1\" && $NODE_BIN kernel-launch; exec bash'"
case "$TERMINAL" in
    gnome-terminal|xfce4-terminal|mate-terminal|tilix)
        exec "$TERMINAL" --maximize --working-directory="$PROJECT_DIR" -e "$CMD"
        ;;
    konsole)
        exec "$TERMINAL" --fullscreen --workdir "$PROJECT_DIR" -e "$CMD"
        ;;
    lxterminal|x-terminal-emulator)
        exec "$TERMINAL" --working-directory="$PROJECT_DIR" -e "$CMD"
        ;;
    terminator|alacritty)
        exec "$TERMINAL" -e "$CMD"
        ;;
    *)
        exec "$TERMINAL" -e "$CMD"
        ;;
esac