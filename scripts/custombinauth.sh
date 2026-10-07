#!/bin/sh

# OpenNDS Custom BinAuth Script for RoseNet Voucher System
# This file is installed to /usr/lib/opennds/custombinauth.sh
#
# Called by OpenNDS's binauth_log.sh on authentication events.
#
# For auth_client events, the following variables are available:
#   $1 = method (auth_client)
#   $2 = client MAC
#   $3 = originurl (URL-encoded)
#   $4 = useragent (URL-encoded)
#   $5 = client IP
#   $6 = client token/hid
#   $7 = custom data (URL-encoded, from FAS redirect)
#
# Expected output on auth_client (5 space-separated values):
#   <session_minutes> <upload_rate_kbps> <download_rate_kbps> <upload_quota_kB> <download_quota_kB>
# Exit 0 = allow, Exit 1 = deny

if [ "$1" != "auth_client" ]; then
  # For non-auth events (client_auth, deauth, etc.), allow default processing.
  exit 0
fi

CLIENT_MAC="$2"

if [ -z "$CLIENT_MAC" ]; then
  exit 1
fi

# Ask the Go backend for the duration (in minutes) associated with this MAC.
# The backend stages this when the user submits a voucher code.
DURATION_MINUTES=$(curl -s -f "http://127.0.0.1:7891/binauth-check?mac=${CLIENT_MAC}")

if [ $? -eq 0 ] && [ -n "$DURATION_MINUTES" ]; then
  # Success: Output 5 values for OpenNDS
  # Format: <session_minutes> <upload_rate_kbps> <download_rate_kbps> <upload_quota_kB> <download_quota_kB>
  # 0 = unlimited for rates/quotas
  echo "$DURATION_MINUTES 0 0 0 0"
  exit 0
else
  exit 1
fi
