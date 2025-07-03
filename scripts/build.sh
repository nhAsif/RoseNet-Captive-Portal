#!/bin/sh

# This script cross-compiles the Go application for OpenWRT on ARM.
# Adjust GOARCH based on your router's architecture (e.g., arm, arm64, mipsle).
export CGO_ENABLED=0
export GOOS=linux
export GOARCH=arm

echo "Building Go backend for OpenWRT..."
go build -o ../voucher_server -v ../backend

if [ $? -eq 0 ]; then
    echo "Build successful! The binary is 'voucher_server'."
    echo "Copy 'voucher_server', the 'frontend/' directory, and 'voucher.db' to your router."
else
    echo "Build failed."
fi
