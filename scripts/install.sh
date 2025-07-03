#!/bin/sh

# This script should be run on the OpenWRT router.
# It assumes you have copied the 'voucher_server' binary and the 'frontend' directory
# to the /tmp/ directory on the router.

# Determine the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RELEASE_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Setting up voucher system..."

# 1. Create directories
echo "Creating directories..."
mkdir -p /www/voucher
mkdir -p /opt/voucher
mkdir -p /data # For the persistent database

# 2. Copy files
echo "Copying application files..."
cp "$RELEASE_ROOT/voucher_server" /opt/voucher/
chmod +x /opt/voucher/voucher_server
cp -r "$RELEASE_ROOT/frontend"/* /www/voucher/

# Copy the binauth script and make it executable
cp "$SCRIPT_DIR/binauth.sh" /opt/voucher/
chmod +x /opt/voucher/binauth.sh

# 3. Create the init script to start the server on boot
echo "Creating init.d startup script..."
cat << 'EOF' > /etc/init.d/voucher
#!/bin/sh /etc/rc.common

START=99
STOP=10

USE_PROCD=1
PROG=/opt/voucher/voucher_server
LOG_FILE=/tmp/voucher.log

start_service() {
    # Start the server in the background
    # The server itself will log to /tmp/voucher.log
    procd_open_instance
    procd_set_param command $PROG
    procd_set_param stdout 1 # 1=stdout, 2=stderr
    procd_set_param stderr 1 
    procd_set_param user root # Run as root to have necessary permissions
    procd_set_param respawn
    procd_close_instance
}

stop_service() {
    # The 'service_stop' function will handle killing the process
    echo "Stopping voucher server..."
}

reload_service() {
    stop
    start
}
EOF

# 4. Make the init script executable and enable it
echo "Enabling and starting the service..."
chmod +x /etc/init.d/voucher
/etc/init.d/voucher enable
/etc/init.d/voucher start

# 5. Configure NoDogSplash
echo "Configuring NoDogSplash..."

if [ ! -f /etc/init.d/nodogsplash ]; then
    echo "Error: NoDogSplash service not found at /etc/init.d/nodogsplash."
    echo "Please install NoDogSplash first by running: opkg update &amp;&amp; opkg install nodogsplash"
    exit 1
fi

# Backup existing config
if [ -f /etc/config/nodogsplash ]; then
    cp /etc/config/nodogsplash /etc/config/nodogsplash.bak
fi

# Overwrite the config file directly. Given the uci issues, this is the most reliable method.
echo "Creating NoDogSplash configuration file..."
cat << 'EOF' > /etc/config/nodogsplash
config nodogsplash
  option enabled '1'
  option fwhook_enabled '1'
  option gatewayinterface 'br-lan'
  option maxclients '250'
  option binauth '/opt/voucher/binauth.sh'
  option client_idle_timeout '2'
  list preauthenticated_users 'allow tcp port 7891'
  list preauthenticated_users 'allow tcp port 53'
  list preauthenticated_users 'allow udp port 53'
  list authenticated_users 'allow all'
  option splashpage 'splash.html'
  option preauthidletimeout '3'
  option authidletimeout '1'
  option checkinterval '20'
  list authenticated_users 'allow all'
  list preauthenticated_users 'allow tcp port 53'
  list preauthenticated_users 'allow udp port 53'
  list preauthenticated_users 'allow tcp port 7891'
  list preauthenticated_users 'allow udp port 7891'
  list users_to_router 'allow tcp port 22'
  list users_to_router 'allow tcp port 23'
  list users_to_router 'allow tcp port 53'
  list users_to_router 'allow udp port 53'
  list users_to_router 'allow udp port 67'
  list users_to_router 'allow tcp port 80'
  list users_to_router 'allow tcp port 7891'
  list trustedmac 'ac:e0:10:81:1c:11'
  list trustedmac 'b8:c3:85:7f:68:44'
  list trustedmac 'd0:9c:7a:d6:5a:b8'
EOF


# 6. Create the custom splash page for redirection
echo "Creating custom NoDogSplash splash page..."
mkdir -p /etc/nodogsplash/htdocs/
cat << 'EOF' > /etc/nodogsplash/htdocs/splash.html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Connecting...</title>
    <meta http-equiv="refresh" content="0; url=http://192.168.100.1:7891/?ip=$clientip&amp;mac=$clientmac&amp;token=$tok" />
</head>
<body>
    <p>Please wait, you are being redirected to the login page...</p>
</body>
</html>
EOF

# 7. Restart NoDogSplash to apply changes
echo "Restarting NoDogSplash..."
/etc/init.d/nodogsplash restart

echo "Installation complete!"
echo "Your voucher server should be running and integrated with NoDogSplash."
echo "You can access the admin panel at http://192.168.100.1:7891/admin.html"
