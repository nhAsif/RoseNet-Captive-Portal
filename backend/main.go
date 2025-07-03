package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)




// var adminPassword = "rosepinepink" // This will now be stored in the database
var sessionCookieName = "voucher-admin-session"

// For BinAuth: an in-memory store to stage client authentications.
// Key: MAC address, Value: duration in seconds
var stagedAuths = make(map[string]int)
var stagedAuthsMutex = &sync.Mutex{}

func generateVoucherCode() (string, error) {
	bytes := make([]byte, 4) // 8 characters hex
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookieName)
		if err != nil || cookie.Value != "admin-is-logged-in" {
			
			w.Header().Set("Content-Type", "application/json")
			http.Error(w, `{"error": "Unauthorized"}`, http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	}
}

func setupLogging() {

	// On OpenWRT, /tmp/ is a ramdisk, so this is fine for logging.
	logFile, err := os.OpenFile("/tmp/voucher.log", os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0666)


	if err != nil {
		
	}
	log.SetOutput(logFile)
}

func main() {
	setupLogging()

	// Setup database
	if err := setupDatabase(); err != nil {
		
	}

	// Initialize admin password if not set
	if err := initializeAdminPassword("rosepinepink"); err != nil {
		
	}



	// Setup routes
	http.HandleFunc("/binauth-stage", binauthStageHandler) // For staging an auth from the frontend
	http.HandleFunc("/binauth-check", binauthCheckHandler) // For the binauth script to check
	http.HandleFunc("/auth", authHandler)

	// Admin routes
	http.HandleFunc("/admin/login", adminLoginHandler)
	http.HandleFunc("/admin/add", authMiddleware(adminAddHandler))
	http.HandleFunc("/admin/delete", authMiddleware(adminDeleteHandler))
	http.HandleFunc("/admin/vouchers", authMiddleware(adminVouchersHandler))
	http.HandleFunc("/admin/change-password", authMiddleware(adminChangePasswordHandler))
	http.HandleFunc("/admin/logout", adminLogoutHandler)


	// Serve frontend files from the absolute path where install.sh places them
	fs := http.FileServer(http.Dir("/www/voucher/"))
	http.Handle("/", fs)

	


	if err := http.ListenAndServe(":7891", nil); err != nil {
		
	}

}

// validateVoucher checks if a voucher is valid and returns it along with an error message suitable for clients.
func validateVoucher(voucherCode string) (*Voucher, string) {
	if voucherCode == "" {
		return nil, "Voucher code is required"
	}

	voucher, err := getVoucherByCode(voucherCode)
	if err != nil {
		return nil, "Invalid voucher code"
	}

	// Validation checks
	// Check 1: One-time voucher already used?
	if !voucher.IsReusable && voucher.IsUsed {
		return nil, "Voucher has already been used"
	}

	// Check 2: Has the voucher itself expired (e.g. promotional voucher for December)
	if !voucher.Expiration.IsZero() && time.Now().After(voucher.Expiration) {
		return nil, "Voucher has expired"
	}

	// Check 3: Has the active period expired since first use?
	// This applies to all vouchers that have been used at least once.
	if voucher.IsUsed && voucher.Duration > 0 {
		if time.Since(voucher.StartTime).Minutes() > float64(voucher.Duration) {
			return nil, "Voucher access duration has expired"
		}
	}

	return voucher, "" // No error
}

func authHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	voucherCode := r.URL.Query().Get("voucher")
	clientIP := r.URL.Query().Get("ip")
	clientMAC := r.URL.Query().Get("mac")

	voucher, errMsg := validateVoucher(voucherCode)
	if errMsg != "" {
		log.Printf("Auth validation failed for voucher '%s': %s", voucherCode, errMsg)
		http.Error(w, fmt.Sprintf(`{"error": "%s"}`, errMsg), http.StatusUnauthorized)
		return
	}

	// If we are here, the voucher is valid to be used.
	// If it's the first time it's being used for anyone, mark it.
	if !voucher.IsUsed {
		err := useVoucher(voucher.Code, clientIP, clientMAC)
		if err != nil {
			log.Printf("Error marking voucher as used: %v", err)
			http.Error(w, `{"error": "Internal server error"}`, http.StatusInternalServerError)
			return
		}
		log.Printf("First use of voucher '%s' by MAC %s", voucher.Code, clientMAC)
	} else {
		log.Printf("Repeat use of voucher '%s' by MAC %s", voucher.Code, clientMAC)
	}

	log.Printf("Successfully authenticated voucher %s for MAC %s, providing %d minutes.", voucher.Code, clientMAC, voucher.Duration)

	response := map[string]interface{}{
		"status":   "success",
		"duration": voucher.Duration, // NDS will use this duration
	}
	json.NewEncoder(w).Encode(response)
}


func adminLoginHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error": "Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var creds struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Get admin password from database
	currentAdminPassword, err := getSetting("admin_password")
	if err != nil {
		
		http.Error(w, `{"error": "Internal server error"}`, http.StatusInternalServerError)
		return
	}

	if creds.Password != currentAdminPassword {
		
		http.Error(w, `{"error": "Invalid credentials"}`, http.StatusUnauthorized)
		return
	}

	// Set a simple session cookie
	expiration := time.Now().Add(10 * time.Minute)
	cookie := http.Cookie{
		Name:    sessionCookieName,
		Value:   "admin-is-logged-in", // In a real app, this would be a secure token
		Expires: expiration,
		Path:    "/", // Set path to / so it can be read by /admin/* and /admin.html
		HttpOnly: true, // Prevent JavaScript access to the cookie
		Secure:   false, // Set to false for HTTP connections. Set to true for HTTPS in production.
		SameSite: http.SameSiteStrictMode, // Protect against CSRF
	}
	http.SetCookie(w, &cookie)
	w.Write([]byte(`{"status": "success"}`))
}

func adminLogoutHandler(w http.ResponseWriter, r *http.Request) {
	cookie := http.Cookie{
		Name:    sessionCookieName,
		Value:   "",
		Expires: time.Unix(0, 0), // Set expiration to a past date to delete the cookie
		Path:    "/",
		HttpOnly: true,
		Secure:   false, // Set to false for HTTP connections. Set to true for HTTPS in production.
		SameSite: http.SameSiteStrictMode,
	}
	http.SetCookie(w, &cookie)
	w.Write([]byte(`{"status": "success", "message": "Logged out successfully"}`))
}

func adminAddHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error": "Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var v Voucher
	if err := json.NewDecoder(r.Body).Decode(&v); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	// If a custom code is not provided, generate one
	if v.Code == "" {
		code, err := generateVoucherCode()
		if err != nil {
			
			http.Error(w, `{"error": "Could not generate voucher code"}`, http.StatusInternalServerError)
			return
		}
		v.Code = code
	}

	// If no name is provided, use the code as the name
	if v.Name == "" {
		v.Name = v.Code
	}

	err := addVoucher(v)
	if err != nil {
		
		http.Error(w, `{"error": "Could not add voucher. Code may already exist."}`, http.StatusInternalServerError)
		return
	}

	
	// Return the newly created voucher, including its generated code and ID
	newVoucher, err := getVoucherByCode(v.Code)
	if err != nil {
		
		http.Error(w, `{"error": "Could not retrieve new voucher"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(newVoucher)
}

func adminDeleteHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error": "Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var payload struct {
		ID int `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if payload.ID <= 0 {
		http.Error(w, `{"error": "Invalid voucher ID"}`, http.StatusBadRequest)
		return
	}

	err := deleteVoucher(payload.ID)
	if err != nil {
		
		http.Error(w, `{"error": "Could not delete voucher"}`, http.StatusInternalServerError)
		return
	}

	
	w.Write([]byte(`{"status": "success"}`))
}

func adminVouchersHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	vouchers, err := getVouchers()
	if err != nil {
		
		http.Error(w, `{"error": "Internal server error"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(vouchers)
}

func adminChangePasswordHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error": "Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var payload struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	currentAdminPassword, err := getSetting("admin_password")
	if err != nil {
		http.Error(w, `{"error": "Internal server error"}`, http.StatusInternalServerError)
		return
	}

	if payload.OldPassword != currentAdminPassword {
		http.Error(w, `{"error": "Incorrect old password"}`, http.StatusUnauthorized)
		return
	}

	if payload.NewPassword == "" {
		http.Error(w, `{"error": "New password cannot be empty"}`, http.StatusBadRequest)
		return
	}

	err = setSetting("admin_password", payload.NewPassword)
	if err != nil {
		http.Error(w, `{"error": "Internal server error"}`, http.StatusInternalServerError)
		return
	}

	w.Write([]byte(`{"status": "success"}`))
}

// binauthStageHandler is called by the frontend to validate a voucher and "stage" it for BinAuth.
func binauthStageHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	voucherCode := r.URL.Query().Get("voucher")
	clientMAC := r.URL.Query().Get("mac")
	clientIP := r.URL.Query().Get("ip")

	if clientMAC == "" {
		http.Error(w, `{"error": "Client MAC address is required"}`, http.StatusBadRequest)
		return
	}

	voucher, errMsg := validateVoucher(voucherCode)
	if errMsg != "" {
		log.Printf("BinAuth stage validation failed for voucher '%s': %s", voucherCode, errMsg)
		http.Error(w, fmt.Sprintf(`{"error": "%s"}`, errMsg), http.StatusUnauthorized)
		return
	}

	// If it's the first use, mark it in the DB.
	if !voucher.IsUsed {
		err := useVoucher(voucher.Code, clientIP, clientMAC)
		if err != nil {
			log.Printf("Error marking voucher as used: %v", err)
			http.Error(w, `{"error": "Internal server error"}`, http.StatusInternalServerError)
			return
		}
	}

	// Stage the authentication for the binauth script to pick up.
	durationInSeconds := voucher.Duration * 60
	stagedAuthsMutex.Lock()
	stagedAuths[clientMAC] = durationInSeconds
	stagedAuthsMutex.Unlock()

	// Set a timer to clean up the staged auth if not used within a short period (e.g., 30 seconds)
	// This prevents the map from growing indefinitely if the check call never comes.
	time.AfterFunc(30*time.Second, func() {
		stagedAuthsMutex.Lock()
		// We only delete if it exists, no harm if it was already used and deleted.
		delete(stagedAuths, clientMAC)
		stagedAuthsMutex.Unlock()
	})

	response := map[string]interface{}{
		"status":   "success",
		"duration": voucher.Duration,
	}
	json.NewEncoder(w).Encode(response)
}

// binauthCheckHandler is called by the binauth.sh script.
func binauthCheckHandler(w http.ResponseWriter, r *http.Request) {
	clientMAC := r.URL.Query().Get("mac")
	if clientMAC == "" {
		http.Error(w, "MAC address required", http.StatusBadRequest)
		return
	}

	stagedAuthsMutex.Lock()
	duration, ok := stagedAuths[clientMAC]
	if ok {
		// IMPORTANT: Delete the entry after successful check to prevent replay.
		delete(stagedAuths, clientMAC)
	}
	stagedAuthsMutex.Unlock()

	if ok {
		// Respond with plain text for the shell script
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprintf(w, "%d", duration)
	} else {
		// Not found or already used
		http.Error(w, "Not authorized", http.StatusUnauthorized)
	}
}
