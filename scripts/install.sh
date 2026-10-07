#!/bin/sh

# RoseNet Captive Portal — OpenNDS Installer
# Run this script ON the OpenWRT router after copying the release files.
#
# Usage:
#   ./scripts/install.sh
#   LAN_IP=192.168.1.1 ./scripts/install.sh   # Override LAN IP detection

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RELEASE_ROOT="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo " RoseNet Voucher System — OpenNDS Setup"
echo "========================================"

# ── 0. Detect LAN IP ──────────────────────────────────────────────────────────
echo "Detecting LAN IP address..."
if [ -z "$LAN_IP" ]; then
    LAN_IP="$(uci -q get network.lan.ipaddr)"
fi
if [ -z "$LAN_IP" ]; then
    LAN_IP="$(ip -4 addr show br-lan 2>/dev/null | grep -oE 'inet [0-9.]+' | awk '{print $2}' | head -n1)"
fi
LAN_IP="${LAN_IP%%/*}"
if [ -z "$LAN_IP" ]; then
    echo "Error: could not detect LAN IP address."
    echo "Set it manually: LAN_IP=<router-ip> ./scripts/install.sh"
    exit 1
fi
echo "Using LAN IP: $LAN_IP"

# ── 1. Create directories ──────────────────────────────────────────────────────
echo "Creating directories..."
mkdir -p /www/voucher
mkdir -p /opt/voucher
mkdir -p /data

# ── 2. Copy application files ──────────────────────────────────────────────────
echo "Copying application files..."
cp "$RELEASE_ROOT/voucher_server" /opt/voucher/
chmod +x /opt/voucher/voucher_server
cp -r "$RELEASE_ROOT/frontend"/* /www/voucher/

# ── 3. Create procd init script ────────────────────────────────────────────────
echo "Creating init.d startup script..."
cat << 'EOF' > /etc/init.d/voucher
#!/bin/sh /etc/rc.common

START=99
STOP=10

USE_PROCD=1
PROG=/opt/voucher/voucher_server

start_service() {
    procd_open_instance
    procd_set_param command $PROG
    procd_set_param stdout 1
    procd_set_param stderr 1
    procd_set_param user root
    procd_set_param respawn
    procd_close_instance
}

stop_service() {
    echo "Stopping voucher server..."
}

reload_service() {
    stop
    start
}
EOF
chmod +x /etc/init.d/voucher
/etc/init.d/voucher enable
# Use restart so re-running the installer hot-swaps the binary.
/etc/init.d/voucher restart
echo "Voucher server started."

# ── 4. Remove NoDogSplash if present ──────────────────────────────────────────
if [ -f /etc/init.d/nodogsplash ]; then
    echo "Removing NoDogSplash..."
    /etc/init.d/nodogsplash stop 2>/dev/null
    /etc/init.d/nodogsplash disable 2>/dev/null
    opkg remove nodogsplash 2>/dev/null
    rm -f /etc/config/nodogsplash
    rm -rf /etc/nodogsplash
    echo "NoDogSplash removed."
fi

# ── 5. Install OpenNDS if missing ──────────────────────────────────────────────
echo "Checking OpenNDS..."
if [ ! -f /etc/init.d/opennds ]; then
    echo "OpenNDS not found. Installing via opkg..."
    opkg update
    if ! opkg install opennds; then
        echo "Error: failed to install OpenNDS via opkg."
        echo "Check your internet connection and opkg feeds."
        exit 1
    fi
fi
echo "OpenNDS is present."

# ── 6. Generate a unique FAS key for this installation ────────────────────────
# If the key file already exists (re-install), preserve the existing key so
# authenticated sessions are not invalidated.
if [ -f /opt/voucher/faskey ] && [ -s /opt/voucher/faskey ]; then
    FASKEY="$(cat /opt/voucher/faskey)"
    echo "Reusing existing FAS key."
else
    FASKEY="$(head -c 32 /dev/urandom | sha256sum | cut -d' ' -f1)"
    echo "$FASKEY" > /opt/voucher/faskey
    chmod 600 /opt/voucher/faskey
    echo "Generated new FAS key."
fi

# ── 7. Write OpenNDS configuration ────────────────────────────────────────────
echo "Writing OpenNDS configuration..."

# Backup existing config if present
if [ -f /etc/config/opennds ]; then
    cp /etc/config/opennds /etc/config/opennds.bak
fi

cat << EOF > /etc/config/opennds
config opennds
  option enabled '1'
  option fwhook_enabled '1'
  option debuglevel '1'
  option gatewayinterface 'br-lan'
  option gatewayname 'RoseNet'
  option gatewayfqdn 'disable'
  option maxclients '250'

  # FAS mode — redirect captured clients to local Go backend
  option login_option_enabled '0'
  option fasport '7891'
  option faspath '/portal'
  option fasremoteip '${LAN_IP}'
  option fas_secure_enabled '1'
  option faskey '${FASKEY}'

  # Timeouts
  option preauthidletimeout '30'
  option authidletimeout '120'
  option sessiontimeout '0'
  option checkinterval '15'

  # Allow clients to reach the Go backend BEFORE authentication
  list preauthenticated_users 'allow tcp port 7891'
  list preauthenticated_users 'allow udp port 7891'

  # Allow authenticated users full internet access
  list authenticated_users 'allow all'

  # Allow clients to reach essential router services
  list users_to_router 'allow tcp port 22'
  list users_to_router 'allow tcp port 23'
  list users_to_router 'allow tcp port 53'
  list users_to_router 'allow udp port 53'
  list users_to_router 'allow udp port 67'
  list users_to_router 'allow tcp port 80'
  list users_to_router 'allow tcp port 7891'

  # Trusted MACs — these devices bypass the portal entirely
  list trustedmac 'ac:e0:10:81:1c:11'
  list trustedmac 'b8:c3:85:7f:68:44'
  list trustedmac 'd0:9c:7a:d6:5a:b8'
  list trustedmac '54:ab:3a:97:92:f8'
EOF

echo "OpenNDS configuration written."

# ── 8. Install custom BinAuth script ──────────────────────────────────────────
echo "Installing custom BinAuth script..."
cp "$SCRIPT_DIR/custombinauth.sh" /usr/lib/opennds/custombinauth.sh
chmod +x /usr/lib/opennds/custombinauth.sh
echo "custombinauth.sh installed."

# ── 9. Restart OpenNDS ────────────────────────────────────────────────────────
echo "Restarting OpenNDS..."
/etc/init.d/opennds restart
sleep 3

# Quick status check
if ndsctl status > /dev/null 2>&1; then
    echo "OpenNDS is running."
else
    echo "WARNING: OpenNDS may not be running. Check: logread | grep opennds"
fi

echo ""
echo "========================================"
echo " Installation complete!"
echo "========================================"
echo " Admin panel: http://${LAN_IP}:7891/admin/"
echo " FAS key:     ${FASKEY}"
echo " Trusted MAC: 54:ab:3a:97:92:f8 (always has internet)"
echo "========================================"
