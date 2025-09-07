#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# open a terminal in this folder and run node kernel-launch
x-terminal-emulator --working-directory="$SCRIPT_DIR" -e "bash -c 'node kernel-launch; exec bash'"
