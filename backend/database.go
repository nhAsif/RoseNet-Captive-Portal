package main

import (
	"encoding/json"
	"errors"
	"os"
	"sync"
	"time"
)

const (
	voucherDBPath = "/data/voucher.json"
	settingsPath  = "/data/settings.json"
)

// Using a mutex to prevent race conditions when reading/writing files
var fileMutex = &sync.Mutex{}

// In-memory cache for vouchers and settings
var vouchersCache []Voucher
var settingsCache map[string]string

type Voucher struct {
	ID         int       `json:"id"`
	Code       string    `json:"code"`
	Name       string    `json:"name"`
	Duration   int       `json:"duration"` // in minutes
	Price      float64   `json:"price,omitempty"`
	CreatedAt  time.Time `json:"created_at,omitempty"`
	Expiration time.Time `json:"expiration,omitempty"`
	DataLimit  int       `json:"data_limit,omitempty"` // in MB
	IsReusable bool      `json:"is_reusable"`
	IsUsed     bool      `json:"is_used"`
	StartTime  time.Time `json:"start_time,omitempty"`
	UserIP     string    `json:"user_ip,omitempty"`
	UserMAC    string    `json:"user_mac,omitempty"`
}

// loadData reads the voucher and settings JSON files into memory.
func loadData() error {
	fileMutex.Lock()
	defer fileMutex.Unlock()

	// Load vouchers
	vouchersCache = []Voucher{}
	voucherData, err := os.ReadFile(voucherDBPath)
	if err != nil {
		if os.IsNotExist(err) {
			// File doesn't exist, which is fine on first run. It will be created.
		} else {
			return err
		}
	} else {
		if err := json.Unmarshal(voucherData, &vouchersCache); err != nil {
			return err
		}
	}

	// Load settings
	settingsCache = make(map[string]string)
	settingsData, err := os.ReadFile(settingsPath)
	if err != nil {
		if os.IsNotExist(err) {
			// File doesn't exist, fine on first run.
		} else {
			return err
		}
	} else {
		if err := json.Unmarshal(settingsData, &settingsCache); err != nil {
			return err
		}
	}
	return nil
}

// saveData writes the in-memory caches back to their respective JSON files.
func saveData() error {
	fileMutex.Lock()
	defer fileMutex.Unlock()

	// Save vouchers
	voucherData, err := json.MarshalIndent(vouchersCache, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(voucherDBPath, voucherData, 0644); err != nil {
		return err
	}

	// Save settings
	settingsData, err := json.MarshalIndent(settingsCache, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(settingsPath, settingsData, 0644)
}

func setupDatabase() error {
	// Create the /data directory if it doesn't exist
	if err := os.MkdirAll("/data", 0755); err != nil {
		return err
	}
	// Load existing data from files into memory
	return loadData()
}

func addVoucher(voucher Voucher) error {
	// Find the highest existing ID to auto-increment
	maxID := 0
	for _, v := range vouchersCache {
		if v.ID > maxID {
			maxID = v.ID
		}
	}
	voucher.ID = maxID + 1
	voucher.CreatedAt = time.Now()

	vouchersCache = append(vouchersCache, voucher)
	return saveData()
}

func getVoucherByCode(code string) (*Voucher, error) {
	for i, v := range vouchersCache {
		if v.Code == code {
			return &vouchersCache[i], nil
		}
	}
	return nil, errors.New("voucher not found")
}

func useVoucher(code, ip, mac string) error {
	v, err := getVoucherByCode(code)
	if err != nil {
		return err
	}

	v.IsUsed = true
	v.StartTime = time.Now()
	v.UserIP = ip
	v.UserMAC = mac

	return saveData()
}

func getVouchers() ([]Voucher, error) {
	// Return a copy to avoid external modification of the cache
	vouchersCopy := make([]Voucher, len(vouchersCache))
	copy(vouchersCopy, vouchersCache)
	// reverse the slice to get the latest vouchers first
	for i, j := 0, len(vouchersCopy)-1; i < j; i, j = i+1, j-1 {
		vouchersCopy[i], vouchersCopy[j] = vouchersCopy[j], vouchersCopy[i]
	}

	return vouchersCopy, nil
}

func deleteVoucher(id int) error {
	found := false
	var indexToDelete int
	for i, v := range vouchersCache {
		if v.ID == id {
			found = true
			indexToDelete = i
			break
		}
	}

	if !found {
		return errors.New("voucher not found")
	}

	vouchersCache = append(vouchersCache[:indexToDelete], vouchersCache[indexToDelete+1:]...)
	return saveData()
}

func getSetting(key string) (string, error) {
	value, ok := settingsCache[key]
	if !ok {
		return "", errors.New("setting not found")
	}
	return value, nil
}

func setSetting(key, value string) error {
	settingsCache[key] = value
	return saveData()
}

func initializeAdminPassword(defaultPass string) error {
	if _, err := getSetting("admin_password"); err != nil {
		// If the password is not found, set the default one.
		return setSetting("admin_password", defaultPass)
	}
	// Password already exists, no error.
	return nil
}
