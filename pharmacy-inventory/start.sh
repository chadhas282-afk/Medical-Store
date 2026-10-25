#!/bin/bash

# PharmaTrack Startup Script (Configured for All IP Addresses: 0.0.0.0)

echo "Starting PharmaTrack Pharmacy Inventory System..."

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "Warning: MongoDB doesn't appear to be running."
    echo "Please start MongoDB before running this script."
    echo "  macOS: brew services start mongodb-community"
    echo "  Linux: sudo systemctl start mongod"
    echo ""
fi

# Detect Local IP address
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)

# Start backend (bound to 0.0.0.0:5001)
echo "Starting backend server on port 5001 (listening on 0.0.0.0)..."
node server.js &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend (bound to 0.0.0.0:3000)
echo "Starting frontend on port 3000 (listening on 0.0.0.0)..."
cd frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================="
echo "PharmaTrack is running on ALL IP addresses!"
echo "========================================="
echo "Local Access:     http://localhost:3000"
if [ -n "$LOCAL_IP" ]; then
echo "Network Access:   http://$LOCAL_IP:3000 (access from mobile/other devices)"
echo "Backend API:      http://$LOCAL_IP:5001"
echo "API Health:       http://$LOCAL_IP:5001/api/health"
else
echo "Backend API:      http://localhost:5001"
echo "API Health:       http://localhost:5001/api/health"
fi
echo ""
echo "Press Ctrl+C to stop both servers"
echo "========================================="

# Handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# Wait for processes
wait $BACKEND_PID $FRONTEND_PID