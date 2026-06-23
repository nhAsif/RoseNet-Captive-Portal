# RoseNet Access Portal

## OpenWrt WiFi Voucher System

RoseNet Access Portal is a comprehensive, self-contained voucher authentication system designed for Wi-Fi users on OpenWrt routers. It provides a robust and lightweight solution for managing internet access through a captive portal, leveraging a Go backend, a vanilla JavaScript frontend, and seamless integration with NoDogSplash.

## Table of Contents

- [Features](#features)
- [System Architecture](#system-architecture)
- [Components](#components)
- [Installation & Deployment](#installation--deployment)
- [Usage](#usage)
  - [User Portal](#user-portal)
  - [Administrator Panel](#administrator-panel)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Contributing](#contributing)
- [License](#license)

## Features

*   **Lightweight & Efficient**: Optimized for resource-constrained OpenWrt environments.
*   **CGO-Free Go Backend**: Easy cross-compilation and deployment without external C dependencies.
*   **Vanilla JavaScript Frontend**: Fast loading and minimal dependencies for captive portal environments.
*   **Integrated Captive Portal**: Seamlessly works with NoDogSplash for user redirection and authentication.
*   **Voucher Management**: Administrators can generate, manage, and revoke time-limited access vouchers.
*   **Secure Admin Panel**: Dedicated interface for voucher administration with password protection.
*   **Customizable**: The frontend can be easily themed and adapted.

## System Architecture

The RoseNet Access Portal operates entirely on the OpenWrt router, comprising three core components that work in concert to deliver the captive portal experience:

1.  **Go Backend (`voucher_server`)**: Serves as the central logic hub, handling HTTP requests, database interactions, and voucher authentication.
2.  **Frontend**: Provides the user interface for voucher entry and the administrative interface for managing vouchers.
3.  **NoDogSplash**: The captive portal software responsible for intercepting unauthenticated traffic and redirecting users to the RoseNet Access Portal.

## Components

### Go Backend (`voucher_server`)

*   **Language**: Go (Golang)
*   **Database**: JSON-based Persistence (Thread-safe document store)
*   **Database Location (on router)**: `/data/voucher.json` and `/data/settings.json`
*   **Log File (on router)**: `/tmp/voucher.log`

### Frontend

Designed for extreme lightness and performance, crucial for captive portal environments.

*   **`index.html` (User Voucher Page)**: The themed entry page users encounter. Support for multiple visual styles including corporate, modern, and retro-music.
*   **`admin.html` (Administrator Panel)**: A single-page application for comprehensive voucher management, system statistics, and theme configuration.

### NoDogSplash Integration

The integration with NoDogSplash is fundamental to the captive portal functionality:

1.  A user connects to the Wi-Fi network.
2.  NoDogSplash intercepts the user's initial HTTP request and redirects them to its `splash.html` page (`/etc/nodogsplash/htdocs/splash.html`).
3.  This `splash.html` contains a meta-refresh that immediately redirects the user to the RoseNet Access Portal's Go-powered voucher page (e.g., `http://<router-lan-ip>:7891`), forwarding essential parameters like `ip`, `mac`, and `token`. The router's LAN IP is detected automatically during installation, so the portal works on any subnet without manual edits.
4.  The user enters a valid voucher code on the portal page.
5.  The frontend JavaScript validates the voucher and stages the session via `/binauth-stage`.
6.  Upon successful validation, the user is redirected to the NoDogSplash authentication URL.
7.  NoDogSplash calls `binauth.sh`, which queries the backend's `/binauth-check` to finalize the connection.
8.  The user is granted internet access for the duration specified by the voucher.

## Installation & Deployment

RoseNet Access Portal can be deployed on your OpenWrt router either by using a pre-compiled binary release (recommended) or by building from source. Everything is installed directly on the router — no separate Go toolchain or local machine staging is required.

### Method 1: Using a Pre-compiled Release (Recommended)

This is the easiest method. You do everything over SSH on the router itself.

1.  **SSH into your router**:

    ```sh
    ssh root@<router-lan-ip>
    ```

2.  **Check your router's architecture**:
    Releases are published per architecture. Identify yours with:

    ```sh
    opkg print-architecture
    # or, alternatively:
    uname -m
    ```

    Map the result to the correct release archive:

    | `uname -m` / arch        | Release archive                    |
    | ------------------------ | ---------------------------------- |
    | `aarch64` / `arm64`      | `RoseNet-Portal-linux-arm64.zip`   |
    | `armv7l`, `armv6l` / arm | `RoseNet-Portal-linux-arm.zip`     |
    | `mips`, `mipsel`         | `RoseNet-Portal-linux-mipsle.zip`  |
    | `x86_64`                 | `RoseNet-Portal-linux-amd64.zip`   |

3.  **Download the latest release** with `wget` (replace the filename with the one for your architecture):

    ```sh
    wget https://github.com/nhAsif/RoseNet-Access-Portal/releases/latest/download/RoseNet-Portal-linux-arm64.zip
    ```

4.  **Unzip the archive**:
    If `unzip` is not installed, install it first with `opkg update && opkg install unzip`.

    ```sh
    unzip RoseNet-Portal-linux-arm64.zip
    cd RoseNet-Portal-linux-arm64
    ```

5.  **Run the installation script**:

    ```sh
    chmod +x scripts/install.sh
    sh scripts/install.sh
    ```

    The `install.sh` script automates the following:
    *   Installs NoDogSplash automatically via `opkg` if it is not already present.
    *   Detects the router's LAN IP automatically (from `network.lan.ipaddr`, falling back to the `br-lan` interface address). To override detection, run the script with an explicit IP: `LAN_IP=192.168.1.1 sh scripts/install.sh`.
    *   Creates necessary directories (`/opt/voucher`, `/www/voucher`, `/data`) and copies application files to their final destinations.
    *   Sets up an `init.d` service to ensure the voucher server starts on boot.
    *   Configures NoDogSplash with the correct authentication service and rules, and generates the custom `splash.html` redirect page.
    *   Restarts relevant services to apply changes.

### Method 2: Building from Source

For developers who want to build the binary themselves.

1.  **Build the Server Binary**:
    On Windows, run `build.bat`; on Linux/macOS, run `scripts/build.sh`. Adjust `GOARCH` to match your router (`arm64`, `arm`, `mipsle`, `amd64`). This cross-compiles the Go application and produces the `voucher_server` binary in the project root.

    ```sh
    ./scripts/build.sh
    ```

2.  **Copy the project to the router** (including `voucher_server`, `frontend/`, and `scripts/`):

    ```sh
    scp -r RoseNet-Captive-Portal root@<router-lan-ip>:/root/
    ```

3.  **Run the installation script on the router**:

    ```sh
    ssh root@<router-lan-ip>
    cd /root/RoseNet-Captive-Portal
    chmod +x scripts/install.sh
    sh scripts/install.sh
    ```

    This performs the same setup steps as described in Method 1.

## Usage

### User Portal

Users connecting to your Wi-Fi network will be redirected to the voucher entry page. The visual style is determined by the "Portal Theme" setting in the admin panel.

### Administrator Panel

Access the administrator panel via `admin.html` (e.g., `http://<router-lan-ip>:7891/admin.html`). The installation script prints the exact URL with your router's detected IP when it finishes.
*   **Default Password**: `rosepinepink`
*   **Features**:
    *   Secure login and password management.
    *   Real-time dashboard with revenue and user statistics.
    *   Voucher generation with customizable names, durations, and prices.
    *   Theme management (Choose between Default, Modern, Corporate, or Music).
    *   Global settings (Currency symbols, system configuration).

## Configuration

*   **Default Admin Password**: The default administrator password is `rosepinepink`.
*   **Server Port**: The Go backend listens on port `7891` by default.
*   **LAN IP**: Detected automatically at install time and wired into the captive-portal redirects, so no IP is hardcoded. The frontend resolves the router address from the browser's location, and `splash.html` uses the IP detected by `install.sh` (override with `LAN_IP=<ip> ./scripts/install.sh`).
*   **Persistence**: Data is stored in `/data/` as JSON files. This ensures portability and easy backups without needing database drivers.

## API Endpoints

The Go backend exposes the following API endpoints:

*   `GET /`: Serves the themed user voucher entry page.
*   `GET /auth`: Legacy authentication endpoint.
*   `GET /binauth-stage`: Validates a voucher and stages a client MAC for NDS authentication.
*   `GET /binauth-check`: Used by `binauth.sh` to verify if a client is authorized and return the remaining duration.
*   `POST /admin/login`: Authenticates administrator access.
*   `GET /admin/vouchers`: (Protected) Retrieves a list of all vouchers.
*   `POST /admin/add`: (Protected) Adds a new voucher to the system.
*   `POST /admin/delete`: (Protected) Deletes a voucher by its ID.
*   `GET /admin/settings`: (Protected) Retrieves system settings.
*   `POST /admin/update-settings`: (Protected) Updates system settings (e.g., active theme, currency).
*   `GET /admin/stats`: (Protected) Provides dashboard statistics and chart data.

## Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## License

This project is licensed under the [MIT License](LICENSE).
