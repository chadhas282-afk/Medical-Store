#!/bin/bash

# PharmaTrack Root Startup Script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/pharmacy-inventory" && exec ./start.sh
