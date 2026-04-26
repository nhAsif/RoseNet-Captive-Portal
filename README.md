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
3.  This `splash.html` contains a meta-refresh that immediately redirects the user to the RoseNet Access Portal's Go-powered voucher page (e.g., `http://192.168.100.1:7891`), forwarding essential parameters like `ip`, `mac`, and `token`.
4.  The user enters a valid voucher code on the portal page.
5.  The frontend JavaScript validates the voucher and stages the session via `/binauth-stage`.
6.  Upon successful validation, the user is redirected to the NoDogSplash authentication URL.
7.  NoDogSplash calls `binauth.sh`, which queries the backend's `/binauth-check` to finalize the connection.
8.  The user is granted internet access for the duration specified by the voucher.

## Installation & Deployment

RoseNet Access Portal can be deployed on your OpenWrt router either by building from source or by using pre-compiled binaries from GitHub Releases.

### Method 1: Building from Source

Follow these steps to build the server binary and deploy it on your OpenWrt router:

1.  **Build the Server Binary**:
    On a Windows machine, execute the `build.bat` script. This will cross-compile the Go application for OpenWrt and generate the `voucher_server` binary in the project root directory.

    ```bash
    build.bat
    ```

2.  **Copy the Release Directory to the Router**:
    Transfer the entire project directory (including `voucher_server`, `frontend`, and `scripts`) to your OpenWrt router. You can use `scp` or a similar tool.

    ```bash
    # Example using scp from your project root
    scp -r RoseNet-Captive-Portal root@your_router_ip:/root/
    ```

3.  **Run Installation Script on Router**:
    SSH into your OpenWrt router, navigate to the project directory, and execute the installation script:

    ```bash
    ssh root@your_router_ip
    cd /root/RoseNet-Captive-Portal
    ./scripts/install.sh
    ```

    The `install.sh` script automates the following:
    *   Creates necessary directories (`/opt/voucher`, `/www/voucher`, `/data`).
    *   Copies application files to their final destinations.
    *   Sets up an `init.d` service to ensure the voucher server starts on boot.
    *   Configures NoDogSplash with the correct authentication service and rules.
    *   Creates the custom `splash.html` redirect page for NoDogSplash.
    *   Restarts relevant services to apply changes.

### Method 2: Using Pre-compiled Release Binaries

This method is recommended for users who do not wish to set up a Go development environment.

1.  **Download the Release Archive**:
    Go to the [GitHub Releases page](https://github.com/nhAsif/RoseNet-Access-Portal/releases)
    Download the appropriate release archive (e.g., `RoseNet-Portal-linux-arm.zip` or `RoseNet-Portal-linux-arm64.zip`) for your router's architecture.

2.  **Extract and Copy the Directory to Router**:
    Extract the contents of the downloaded archive on your local machine. It will contain `voucher_server`, the `frontend` directory, and the `scripts` directory.
    Transfer the entire extracted directory to your OpenWrt router:

    ```bash
    # Example using scp from your extracted directory
    scp -r RoseNet-Portal-linux-arm root@your_router_ip:/root/
    ```

3.  **Run Installation Script on Router**:
    SSH into your OpenWrt router, navigate to the extracted directory, and execute the installation script:

    ```bash
    ssh root@your_router_ip
    cd /root/RoseNet-Portal-linux-arm
    ./scripts/install.sh
    ```

    The `install.sh` script will perform the same setup steps as described in Method 1.

**Note:**
The install script will automatically copy all required files from the extracted directory to their correct locations on the router. There is no need to manually move files to `/tmp/`.

## Usage

### User Portal

Users connecting to your Wi-Fi network will be redirected to the voucher entry page. The visual style is determined by the "Portal Theme" setting in the admin panel.

### Administrator Panel

Access the administrator panel via `admin.html` (e.g., `http://your_router_ip:7891/admin.html`).
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
