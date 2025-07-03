@echo off
echo Building for OpenWrt (linux/arm64)...

set GOOS=linux
set GOARCH=arm64
set CGO_ENABLED=0

:: Change to the backend directory to build
pushd backend

:: Build the binary and output it to the parent directory
go build -o ../voucher_server -ldflags="-s -w"

:: Return to the original directory
popd

echo.
echo Build complete! 
echo The binary 'voucher_server' has been created in the root project directory.

echo You can now copy it to your router.
pause
