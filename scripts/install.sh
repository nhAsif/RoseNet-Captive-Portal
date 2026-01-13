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

# Overwrite the config file directly.
echo "Creating NoDogSplash configuration file..."
cat << 'EOF' > /etc/config/nodogsplash
config nodogsplash
    option enabled '1'
    option fwhook_enabled '1'
    option gatewayinterface 'br-lan'
    option gatewayname 'RoseNet Hotspot'
    option maxclients '250'
    option binauth '/opt/voucher/binauth.sh'
    option splashpage 'splash.html'

    # Set a long idle timeout (12 hours). The voucher's own duration is the real limit.
    # This prevents users from being deauthenticated just because they are idle for a few minutes.
    option client_idle_timeout '720'

    # Let the binauth script handle re-authentication checks once a day.
    # This is more efficient than checking every minute.
    option authidletimeout '1440'

    # How long a client can be on the splash page before being deauthed (3 minutes).
    option preauthidletimeout '180'

    # How often to check for timeouts. Must be less than half of the shortest timeout.
    option checkinterval '60'

    # Rules for users who have NOT authenticated yet.
    # Allow DNS and access to our voucher server.
    list preauthenticated_users 'allow tcp port 53'
    list preauthenticated_users 'allow udp port 53'
    list preauthenticated_users 'allow tcp port 7891'

    # Rules for users who HAVE authenticated.
    list authenticated_users 'allow all'

    # Rules for user access to the router itself.
    # Allow SSH, DNS, DHCP, and access to the web server and voucher server.
    # Telnet (port 23) has been removed for security.
    list users_to_router 'allow tcp port 22'
    list users_to_router 'allow tcp port 53'
    list users_to_router 'allow udp port 53'
    list users_to_router 'allow udp port 67'
    list users_to_router 'allow tcp port 80'
    list users_to_router 'allow tcp port 7891'

    # Add your own device MAC addresses here if you want them to bypass the portal.
    # list trustedmac 'AA:BB:CC:DD:EE:FF'
EOF


# 6. Create the custom splash page for redirection
echo "Creating custom NoDogSplash splash page..."
mkdir -p /etc/nodogsplash/htdocs/
cat << 'EOF' > /etc/nodogsplash/htdocs/splash.html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to RoseNet Wi-Fi</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #f0f2f5;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        .container {
            background-color: #ffffff;
            padding: 2.5rem;
            border-radius: 0.75rem;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 400px;
            width: 90%;
        }
        h1 {
            color: #1d4ed8; /* blue-700 */
            font-size: 2rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
        }
        p {
            color: #4b5563; /* gray-600 */
            font-size: 1rem;
            margin-bottom: 2rem;
        }
        .button {
            display: inline-block;
            background-color: #2563eb; /* blue-600 */
            color: #ffffff;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            text-decoration: none;
            font-size: 1.125rem;
            font-weight: 500;
            transition: background-color 0.3s;
        }
        .button:hover {
            background-color: #1d4ed8; /* blue-700 */
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to RoseNet Wi-Fi</h1>
        <p>To get internet access, please proceed to the login page.</p>
        <a class="button" href="http://192.168.100.1:7891/?ip=$clientip&mac=$clientmac&token=$tok">
            Proceed to Login
        </a>
    </div>
</body>
</html>
EOF

# 7. Restart NoDogSplash to apply changes
echo "Restarting NoDogSplash..."
/etc/init.d/nodogsplash restart

echo "Installation complete!"
echo "Your voucher server should be running and integrated with NoDogSplash."
echo "You can access the admin panel at http://192.168.100.1:7891/admin.html"
