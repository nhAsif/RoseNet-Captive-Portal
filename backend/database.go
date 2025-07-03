package main

import (
	"database/sql"
	"time"

	_ "modernc.org/sqlite"
)


var db *sql.DB

type Voucher struct {
	ID         int       `json:"id"`
	Code       string    `json:"code"`
	Name       string    `json:"name"`
	Duration   int       `json:"duration"` // in minutes
	Expiration time.Time `json:"expiration,omitempty"`
	DataLimit  int       `json:"data_limit,omitempty"` // in MB
	IsReusable bool      `json:"is_reusable"`
	IsUsed     bool      `json:"is_used"`
	StartTime  time.Time `json:"start_time,omitempty"`
	UserIP     string    `json:"user_ip,omitempty"`
	UserMAC    string    `json:"user_mac,omitempty"`
}


func setupDatabase() error {
	var err error
	// Use a persistent path on OpenWrt, /data is a common choice for user data
	db, err = sql.Open("sqlite", "/data/voucher.db")
	if err != nil {
		return err
	}


	createTableSQL := `CREATE TABLE IF NOT EXISTS vouchers (
		"id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
		"code" TEXT NOT NULL UNIQUE,
		"name" TEXT,
		"duration" INTEGER NOT NULL,
		"expiration" DATETIME,
		"data_limit" INTEGER,
		"is_reusable" BOOLEAN NOT NULL,
		"is_used" BOOLEAN NOT NULL DEFAULT 0,
		"start_time" DATETIME,
		"user_ip" TEXT,
		"user_mac" TEXT
	);
	CREATE TABLE IF NOT EXISTS settings (
		"key" TEXT NOT NULL PRIMARY KEY,
		"value" TEXT NOT NULL
	);`

	_, err = db.Exec(createTableSQL)
	return err
}

func addVoucher(voucher Voucher) error {
	stmt, err := db.Prepare("INSERT INTO vouchers(code, name, duration, expiration, data_limit, is_reusable) VALUES(?, ?, ?, ?, ?, ?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	var expiration sql.NullTime
	if !voucher.Expiration.IsZero() {
		expiration.Time = voucher.Expiration
		expiration.Valid = true
	}

	var dataLimit sql.NullInt64
	if voucher.DataLimit > 0 {
		dataLimit.Int64 = int64(voucher.DataLimit)
		dataLimit.Valid = true
	}

	_, err = stmt.Exec(voucher.Code, voucher.Name, voucher.Duration, expiration, dataLimit, voucher.IsReusable)
	return err
}

func getVoucherByCode(code string) (*Voucher, error) {
	row := db.QueryRow("SELECT id, code, name, duration, expiration, data_limit, is_reusable, is_used, start_time, user_ip, user_mac FROM vouchers WHERE code = ?", code)

	var v Voucher
	var expiration, startTime sql.NullTime
	var dataLimit sql.NullInt64
	var userIP, userMAC, name sql.NullString

	err := row.Scan(&v.ID, &v.Code, &name, &v.Duration, &expiration, &dataLimit, &v.IsReusable, &v.IsUsed, &startTime, &userIP, &userMAC)
	if err != nil {
		return nil, err
	}

	if expiration.Valid {
		v.Expiration = expiration.Time
	}
	if startTime.Valid {
		v.StartTime = startTime.Time
	}
	if dataLimit.Valid {
		v.DataLimit = int(dataLimit.Int64)
	}
	if userIP.Valid {
		v.UserIP = userIP.String
	}
	if userMAC.Valid {
		v.UserMAC = userMAC.String
	}

	if name.Valid {
		v.Name = name.String
	} else {
		v.Name = "" // Ensure it's an empty string if NULL
	}

	return &v, nil
}

func useVoucher(code, ip, mac string) error {
	stmt, err := db.Prepare("UPDATE vouchers SET is_used = 1, start_time = ?, user_ip = ?, user_mac = ? WHERE code = ?")
	if err != nil {
		return err
	}
	defer stmt.Close()

	_, err = stmt.Exec(time.Now(), ip, mac, code)
	return err
}

func getVouchers() ([]Voucher, error) {
	rows, err := db.Query("SELECT id, code, name, duration, expiration, data_limit, is_reusable, is_used, start_time, user_ip, user_mac FROM vouchers ORDER BY id DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	vouchers := []Voucher{}
	for rows.Next() {
		var v Voucher
		var expiration, startTime sql.NullTime
		var dataLimit sql.NullInt64
		var userIP, userMAC, name sql.NullString

		if err := rows.Scan(&v.ID, &v.Code, &name, &v.Duration, &expiration, &dataLimit, &v.IsReusable, &v.IsUsed, &startTime, &userIP, &userMAC); err != nil {
			return nil, err
		}

		// Explicitly handle nullable fields
		if name.Valid {
			v.Name = name.String
		} else {
			v.Name = "" // Ensure it's an empty string if NULL
		}

		if expiration.Valid {
			v.Expiration = expiration.Time
		} else {
			v.Expiration = time.Time{} // Ensure it's zero time if NULL
		}

		if dataLimit.Valid {
			v.DataLimit = int(dataLimit.Int64)
		} else {
			v.DataLimit = 0 // Ensure it's zero if NULL
		}

		if startTime.Valid {
			v.StartTime = startTime.Time
		} else {
			v.StartTime = time.Time{} // Ensure it's zero time if NULL
		}

		if userIP.Valid {
			v.UserIP = userIP.String
		} else {
			v.UserIP = "" // Ensure it's an empty string if NULL
		}

		if userMAC.Valid {
			v.UserMAC = userMAC.String
		} else {
			v.UserMAC = "" // Ensure it's an empty string if NULL
		}
		vouchers = append(vouchers, v)
	}
	return vouchers, nil
}

func deleteVoucher(id int) error {
	stmt, err := db.Prepare("DELETE FROM vouchers WHERE id = ?")
	if err != nil {
		return err
	}
	defer stmt.Close()

	_, err = stmt.Exec(id)
	return err
}

func getSetting(key string) (string, error) {
	var value string
	err := db.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&value)
	if err != nil {
		return "", err
	}
	return value, nil
}

func setSetting(key, value string) error {
	stmt, err := db.Prepare("INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	_, err = stmt.Exec(key, value)
	return err
}

func initializeAdminPassword(defaultPass string) error {
	_, err := getSetting("admin_password")
	if err == sql.ErrNoRows {
		// Password not set, set default
		return setSetting("admin_password", defaultPass)
	}
	return err // Return existing error or nil if password already exists
}
