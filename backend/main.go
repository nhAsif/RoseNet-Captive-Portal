package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"sync"
	"time"
)

var sessionCookieName = "voucher-admin-session"
var frontendDir = "frontend"

// For BinAuth: an in-memory store to stage client authentications.
var stagedAuths = make(map[string]int)
var stagedAuthsMutex = &sync.Mutex{}

func init() {
	// Check if we are on the router (production) or local (dev)
	if _, err := os.Stat("/www/voucher"); err == nil {
		frontendDir = "/www/voucher"
	}
}

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
	if err == nil {
		log.SetOutput(logFile)
	}
}

func main() {
	setupLogging()

	// Setup database
	if err := setupDatabase(); err != nil {
		log.Fatalf("Failed to setup database: %v", err)
	}

	// Initialize admin password if not set
	if err := initializeAdminPassword("rosepinepink"); err != nil {
		log.Fatalf("Failed to initialize admin password: %v", err)
	}

	restageActiveUsers()

	// Restore active sessions into NoDogSplash after a reboot so reconnecting
	// devices skip the splash entirely. Runs in the background because it polls
	// for devices to come back online over a few minutes.
	go reauthSessionsViaNDS()

	// Setup routes
	http.HandleFunc("/binauth-stage", binauthStageHandler)
	http.HandleFunc("/binauth-check", binauthCheckHandler)
	http.HandleFunc("/auth", authHandler)

	// Admin routes
	http.HandleFunc("/admin/login", adminLoginHandler)
	http.HandleFunc("/admin/add", authMiddleware(adminAddHandler))
	http.HandleFunc("/admin/delete", authMiddleware(adminDeleteHandler))
	http.HandleFunc("/admin/vouchers", authMiddleware(adminVouchersHandler))
	http.HandleFunc("/admin/change-password", authMiddleware(adminChangePasswordHandler))
	http.HandleFunc("/admin/logout", adminLogoutHandler)
	http.HandleFunc("/admin/stats", authMiddleware(adminStatsHandler))
	http.HandleFunc("/admin/settings", authMiddleware(adminGetSettingsHandler))
	http.HandleFunc("/admin/update-settings", authMiddleware(adminUpdateSettingsHandler))

	// Serve the portal with theme support
	http.HandleFunc("/", rootHandler)

	log.Printf("Starting server on :7891, serving from %s", frontendDir)
	if err := http.ListenAndServe(":7891", nil); err != nil {
		log.Fatal(err)
	}
}

func rootHandler(w http.ResponseWriter, r *http.Request) {
	// Serve static files (admin.html, admin.js, etc.)
	if r.URL.Path != "/" && r.URL.Path != "/index.html" {
		http.FileServer(http.Dir(frontendDir)).ServeHTTP(w, r)
		return
	}

	// For the root or index.html, serve the themed template
	theme, err := getSetting("active_theme")
	if err != nil || theme == "" {
		theme = "default"
	}

	themePath := fmt.Sprintf("%s/themes/%s.html", frontendDir, theme)
	if _, err := os.Stat(themePath); os.IsNotExist(err) {
		themePath = fmt.Sprintf("%s/themes/default.html", frontendDir)
	}

	http.ServeFile(w, r, themePath)
}

func validateVoucher(voucherCode string) (*Voucher, string) {
	if voucherCode == "" {
		return nil, "Voucher code is required"
	}

	voucher, err := getVoucherByCode(voucherCode)
	if err != nil {
		return nil, "Invalid voucher code"
	}

	if !voucher.IsReusable && voucher.IsUsed {
		return nil, "Voucher has already been used"
	}

	if !voucher.Expiration.IsZero() && time.Now().After(voucher.Expiration) {
		return nil, "Voucher has expired"
	}

	if voucher.IsUsed && voucher.Duration > 0 {
		if time.Since(voucher.StartTime).Minutes() > float64(voucher.Duration) {
			return nil, "Voucher access duration has expired"
		}
	}

	return voucher, ""
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
		"duration": voucher.Duration,
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

	currentAdminPassword, err := getSetting("admin_password")
	if err != nil {
		http.Error(w, `{"error": "Internal server error"}`, http.StatusInternalServerError)
		return
	}

	if creds.Password != currentAdminPassword {
		http.Error(w, `{"error": "Invalid credentials"}`, http.StatusUnauthorized)
		return
	}

	expiration := time.Now().Add(10 * time.Minute)
	cookie := http.Cookie{
		Name:     sessionCookieName,
		Value:    "admin-is-logged-in",
		Expires:  expiration,
		Path:     "/",
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteStrictMode,
	}
	http.SetCookie(w, &cookie)
	w.Write([]byte(`{"status": "success"}`))
}

func adminLogoutHandler(w http.ResponseWriter, r *http.Request) {
	cookie := http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Expires:  time.Unix(0, 0),
		Path:     "/",
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteStrictMode,
	}
	http.SetCookie(w, &cookie)
	w.Write([]byte(`{"status": "success"}`))
}

func adminAddHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var v Voucher
	if err := json.NewDecoder(r.Body).Decode(&v); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if v.Code == "" {
		code, _ := generateVoucherCode()
		v.Code = code
	}
	if v.Name == "" {
		v.Name = v.Code
	}

	err := addVoucher(v)
	if err != nil {
		http.Error(w, `{"error": "Could not add voucher"}`, http.StatusInternalServerError)
		return
	}

	newVoucher, _ := getVoucherByCode(v.Code)
	json.NewEncoder(w).Encode(newVoucher)
}

func adminDeleteHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var payload struct {
		ID int `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
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
	var payload struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	currentAdminPassword, _ := getSetting("admin_password")
	if payload.OldPassword != currentAdminPassword {
		http.Error(w, `{"error": "Incorrect old password"}`, http.StatusUnauthorized)
		return
	}

	setSetting("admin_password", payload.NewPassword)
	w.Write([]byte(`{"status": "success"}`))
}

func adminGetSettingsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	settings := make(map[string]string)
	for k, v := range settingsCache {
		if k != "admin_password" {
			settings[k] = v
		}
	}
	if _, ok := settings["currency_symbol"]; !ok {
		settings["currency_symbol"] = "$"
	}
	json.NewEncoder(w).Encode(settings)
}

func adminUpdateSettingsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var newSettings map[string]string
	if err := json.NewDecoder(r.Body).Decode(&newSettings); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}
	for k, v := range newSettings {
		if k == "currency_symbol" || k == "active_theme" {
			setSetting(k, v)
		}
	}
	w.Write([]byte(`{"status": "success"}`))
}

func adminStatsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	vouchers, _ := getVouchers()
	now := time.Now()
	var totalRevenue float64
	activeVouchers := 0
	expiredCount := 0
	unusedCount := 0

	salesByMonth := make(map[string]float64)
	sixMonthsAgo := now.AddDate(0, -6, 0)
	topPlans := make(map[string]int)

	for _, v := range vouchers {
		totalRevenue += v.Price
		if v.Name != "" {
			topPlans[v.Name]++
		}
		if !v.CreatedAt.IsZero() && v.CreatedAt.After(sixMonthsAgo) {
			month := v.CreatedAt.Format("2006-01")
			salesByMonth[month] += v.Price
		}
		if v.IsUsed {
			expires := v.StartTime.Add(time.Duration(v.Duration) * time.Minute)
			if now.After(expires) {
				expiredCount++
			} else {
				activeVouchers++
			}
		} else {
			unusedCount++
		}
	}

	salesLabels := make([]string, 0)
	salesData := make([]float64, 0)
	for i := 5; i >= 0; i-- {
		month := now.AddDate(0, -i, 0)
		monthKey := month.Format("2006-01")
		salesLabels = append(salesLabels, month.Format("Jan"))
		salesData = append(salesData, salesByMonth[monthKey])
	}

	type plan struct {
		Name  string `json:"name"`
		Sales int    `json:"sales"`
	}
	planList := make([]plan, 0)
	for name, sales := range topPlans {
		planList = append(planList, plan{Name: name, Sales: sales})
	}

	stats := map[string]interface{}{
		"total_revenue":   totalRevenue,
		"active_vouchers": activeVouchers,
		"live_users":      activeVouchers,
		"sales_stats":     map[string]interface{}{"labels": salesLabels, "data": salesData},
		"voucher_status":  map[string]int{"active": activeVouchers, "expired": expiredCount, "unused": unusedCount},
		"top_plans":       planList,
		"traffic_by_zone": map[string]interface{}{"labels": []string{"Zone A", "Zone B", "Zone C"}, "data": []int{0, 0, 0}},
	}
	json.NewEncoder(w).Encode(stats)
}

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

	if !voucher.IsUsed {
		err := useVoucher(voucher.Code, clientIP, clientMAC)
		if err != nil {
			log.Printf("Error marking voucher as used: %v", err)
			http.Error(w, `{"error": "Internal server error"}`, http.StatusInternalServerError)
			return
		}
	}

	durationInSeconds := voucher.Duration * 60
	stagedAuthsMutex.Lock()
	stagedAuths[clientMAC] = durationInSeconds
	stagedAuthsMutex.Unlock()

	time.AfterFunc(30*time.Second, func() {
		stagedAuthsMutex.Lock()
		delete(stagedAuths, clientMAC)
		stagedAuthsMutex.Unlock()
	})

	json.NewEncoder(w).Encode(map[string]interface{}{"status": "success", "duration": voucher.Duration})
}

func binauthCheckHandler(w http.ResponseWriter, r *http.Request) {
	clientMAC := r.URL.Query().Get("mac")
	if clientMAC == "" {
		http.Error(w, "MAC address required", http.StatusBadRequest)
		return
	}

	stagedAuthsMutex.Lock()
	duration, ok := stagedAuths[clientMAC]
	if ok {
		delete(stagedAuths, clientMAC)
	}
	stagedAuthsMutex.Unlock()

	if ok {
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprintf(w, "%d", duration)
		return
	}

	vouchers, err := getVouchers()
	if err == nil {
		now := time.Now()
		for _, v := range vouchers {
			if v.UserMAC == clientMAC && v.IsUsed && v.Duration > 0 && !v.StartTime.IsZero() {
				expiry := v.StartTime.Add(time.Duration(v.Duration) * time.Minute)
				if now.Before(expiry) {
					remaining := int(expiry.Sub(now).Seconds())
					if remaining > 0 {
						w.Header().Set("Content-Type", "text/plain")
						fmt.Fprintf(w, "%d", remaining)
						return
					}
				}
			}
		}
	}
	http.Error(w, "Not authorized", http.StatusUnauthorized)
}

// activeSession is a still-valid voucher session keyed by client MAC.
type activeSession struct {
	MAC    string
	Expiry time.Time
}

// getActiveSessions scans the vouchers for used, time-limited sessions that have
// not yet expired and returns one entry per MAC with its absolute expiry time.
func getActiveSessions() []activeSession {
	vouchers, err := getVouchers()
	if err != nil {
		log.Printf("[getActiveSessions] Failed to get vouchers: %v", err)
		return nil
	}
	now := time.Now()
	sessions := make([]activeSession, 0)
	for _, v := range vouchers {
		if v.IsUsed && v.UserMAC != "" && v.Duration > 0 && !v.StartTime.IsZero() {
			expiry := v.StartTime.Add(time.Duration(v.Duration) * time.Minute)
			if now.Before(expiry) {
				sessions = append(sessions, activeSession{MAC: v.UserMAC, Expiry: expiry})
			}
		}
	}
	return sessions
}

func restageActiveUsers() {
	now := time.Now()
	count := 0
	for _, s := range getActiveSessions() {
		remaining := int(s.Expiry.Sub(now).Seconds())
		if remaining > 0 {
			stagedAuthsMutex.Lock()
			stagedAuths[s.MAC] = remaining
			stagedAuthsMutex.Unlock()
			count++
		}
	}
	log.Printf("[restageActiveUsers] Re-staged %d active users for NoDogSplash.", count)
}

// reauthSessionsViaNDS restores still-valid sessions into NoDogSplash after a
// reboot. NDS keeps its authenticated-client table in volatile firewall state,
// so a reboot wipes it and every device would otherwise be intercepted by the
// splash page once. restageActiveUsers() only makes that re-auth voucher-free;
// this proactively re-authenticates devices in NDS so no splash appears at all.
//
// A device can only be authenticated once NDS knows about it (i.e. after it has
// reconnected and sent traffic). Right after boot most devices haven't
// re-associated yet, so we retry on an interval, dropping each MAC as soon as
// `ndsctl auth` succeeds, until every session is restored or the window closes.
//
// It no-ops in dev where `ndsctl` is not installed.
func reauthSessionsViaNDS() {
	ndsctl, err := exec.LookPath("ndsctl")
	if err != nil {
		return // not on the router / NoDogSplash not installed
	}

	// Collect the sessions to restore once; expiry is absolute so the granted
	// duration shrinks correctly as we retry over the window.
	pending := make(map[string]time.Time)
	for _, s := range getActiveSessions() {
		pending[s.MAC] = s.Expiry
	}
	if len(pending) == 0 {
		return
	}
	log.Printf("[reauthSessionsViaNDS] Attempting to restore %d session(s) into NoDogSplash after boot.", len(pending))

	const (
		retryInterval = 15 * time.Second
		window        = 3 * time.Minute
	)
	deadline := time.Now().Add(window)
	for {
		now := time.Now()
		for mac, expiry := range pending {
			remaining := int(expiry.Sub(now).Seconds())
			if remaining <= 0 {
				delete(pending, mac) // session expired while we were waiting
				continue
			}
			// `ndsctl auth <mac> <seconds>` fails if the client isn't known to
			// NDS yet; that's expected before the device reconnects, so we just
			// retry on the next tick.
			if out, err := exec.Command(ndsctl, "auth", mac, strconv.Itoa(remaining)).CombinedOutput(); err != nil {
				log.Printf("[reauthSessionsViaNDS] %s not ready yet: %v (%s)", mac, err, string(out))
			} else {
				log.Printf("[reauthSessionsViaNDS] Restored %s in NDS for %ds.", mac, remaining)
				delete(pending, mac)
			}
		}
		if len(pending) == 0 || time.Now().After(deadline) {
			break
		}
		time.Sleep(retryInterval)
	}
	if len(pending) > 0 {
		log.Printf("[reauthSessionsViaNDS] Gave up with %d session(s) still pending (devices offline); they will re-auth via the portal when they reconnect.", len(pending))
	} else {
		log.Printf("[reauthSessionsViaNDS] All sessions restored into NoDogSplash.")
	}
}
