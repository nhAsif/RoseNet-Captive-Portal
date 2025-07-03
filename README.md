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
*   **Database**: SQLite (using `modernc.org/sqlite` for CGO-free builds)
*   **Database Location (on router)**: `/data/voucher.db`
*   **Log File (on router)**: `/tmp/voucher.log`

### Frontend

Designed for extreme lightness and performance, crucial for captive portal environments.

*   **`index.html` (User Voucher Page)**: The initial page users encounter, featuring a form for voucher code entry. Utilizes embedded CSS and vanilla JavaScript for instant loading.
*   **`admin.html` (Administrator Panel)**: A single-page application for comprehensive voucher management (login, listing, adding, deleting vouchers).

### NoDogSplash Integration

The integration with NoDogSplash is fundamental to the captive portal functionality:

1.  A user connects to the Wi-Fi network.
2.  NoDogSplash intercepts the user's initial HTTP request and redirects them to its `splash.html` page (`/etc/nodogsplash/htdocs/splash.html`).
3.  This `splash.html` contains a meta-refresh that immediately redirects the user to the RoseNet Access Portal's Go-powered voucher page (e.g., `http://192.168.100.1:7891`), forwarding essential parameters like `ip`, `mac`, and `token`.
4.  The user enters a valid voucher code on the `index.html` page.
5.  The frontend JavaScript validates the voucher with the Go backend.
6.  Upon successful validation, the JavaScript constructs a special NoDogSplash authentication URL (e.g., `http://192.168.100.1:2050/nodogsplash_auth/?tok=...`) and redirects the user.
7.  NoDogSplash processes this request, validates the token, and grants the user internet access for the duration specified by the voucher.

## Installation & Deployment

RoseNet Access Portal can be deployed on your OpenWrt router either by building from source or by using pre-compiled binaries from GitHub Releases.

### Method 1: Building from Source

Follow these steps to build the server binary and deploy it on your OpenWrt router:

1.  **Build the Server Binary**:
    On a Windows machine, execute the `build.bat` script. This will cross-compile the Go application for OpenWrt and generate the `voucher_server` binary in the project root directory.

    ```bash
    build.bat
    ```

2.  **Copy Files to Router**:
    Transfer the compiled `voucher_server` binary and the entire `frontend` directory to the `/tmp/` directory on your OpenWrt router. You can use `scp` or a similar tool.

    ```bash
    # Example using scp
    scp voucher_server root@your_router_ip:/tmp/
    scp -r frontend root@your_router_ip:/tmp/
    scp -r scripts root@your_router_ip:/tmp/
    ```

3.  **Run Installation Script on Router**:
    SSH into your OpenWrt router and execute the installation script:

    ```bash
    ssh root@your_router_ip
    sh /tmp/scripts/install.sh
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
    Download the `RoseNet-Portal-linux-arm.zip` (or `RoseNet-Portal-linux-arm64.zip` depending on your router's architecture) file from the latest release.

2.  **Extract and Copy Files to Router**:
    Extract the contents of the downloaded `.zip` file on your local machine. It will contain `voucher_server`, the `frontend` directory, and `install.sh`.
    Transfer these extracted files to the `/tmp/` directory on your OpenWrt router. You can use `scp` or a similar tool.

    ```bash
    # Example using scp from your extracted directory
    scp voucher_server root@your_router_ip:/tmp/
    scp -r frontend root@your_router_ip:/tmp/
    scp install.sh root@your_router_ip:/tmp/
    ```

3.  **Run Installation Script on Router**:
    SSH into your OpenWrt router and execute the installation script:

    ```bash
    ssh root@your_router_ip
    sh /tmp/install.sh
    ```

    The `install.sh` script will perform the same setup steps as described in Method 1.

## Usage

### User Portal

Users connecting to your Wi-Fi network will be redirected to the voucher entry page (`index.html`). They can enter a valid voucher code to gain internet access.

### Administrator Panel

Access the administrator panel via `admin.html` (e.g., `http://your_router_ip:7891/admin.html`).
*   **Default Password**: `rosepinepink` (This is the initial default password. It is highly recommended to change this from the admin panel after the first login for security.).
*   **Features**:
    *   Secure login.
    *   View a list of all active and expired vouchers.
    *   Add new vouchers with specified durations.
    *   Delete existing vouchers by ID.

## Configuration

*   **Default Admin Password**: The default administrator password is `rosepinepink`. This can be changed from the administrator panel after the first login. **It is strongly advised to change this to a strong, unique password before deploying the system in a production environment.**
*   **Server Port**: The Go backend listens on port `7891` by default. This can be modified in `backend/main.go`.
*   **NoDogSplash Configuration**: The `install.sh` script configures NoDogSplash. Review `/etc/nodogsplash/nodogsplash.conf` and `/etc/nodogsplash/htdocs/splash.html` if you need to customize NoDogSplash behavior further.

## API Endpoints

The Go backend exposes the following API endpoints:

*   `GET /`: Serves the `index.html` user voucher entry page.
*   `GET /admin.html`: Serves the administrator panel.
*   `GET /auth`: The primary authentication endpoint for voucher validation.
    *   **Parameters**: `voucher` (string), `ip` (string), `mac` (string)
    *   **Returns**: JSON object with `status` (string: "success" or "error") and `duration` (integer, in minutes, on success) or `error` (string message, on failure).
*   `POST /admin/login`: Authenticates administrator access.
*   `GET /admin/vouchers`: (Protected) Retrieves a list of all vouchers.
*   `POST /admin/add`: (Protected) Adds a new voucher to the system.
*   `POST /admin/delete`: (Protected) Deletes a voucher by its ID.

## Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## License

This project is licensed under the [MIT License](LICENSE).
