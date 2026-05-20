-- ============================================================
-- VPRMS - Vehicle Parking Reservation Management System
-- PostgreSQL Schema
-- ============================================================

-- ── ENUM Types ────────────────────────────────────────────────
CREATE TYPE slot_type AS ENUM ('two-wheeler', 'car', 'SUV', 'truck');
CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
CREATE TYPE payment_status_type AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE payment_method_type AS ENUM ('cash', 'card', 'upi', 'online');
CREATE TYPE user_role AS ENUM ('customer', 'admin');

-- ── User Table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "User" (
    user_id       SERIAL PRIMARY KEY,
    full_name     VARCHAR(100) NOT NULL,
    email         VARCHAR(100) UNIQUE NOT NULL,
    phone         VARCHAR(15),
    password_hash TEXT NOT NULL,
    role          user_role DEFAULT 'customer',
    created_at    TIMESTAMP DEFAULT NOW()
);

-- ── Vehicle Table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Vehicle (
    vehicle_id    SERIAL PRIMARY KEY,
    user_id       INT NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type  VARCHAR(20) NOT NULL,
    brand         VARCHAR(50),
    color         VARCHAR(30),
    created_at    TIMESTAMP DEFAULT NOW()
);

-- ── Parking Lot Table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Parking_Lot (
    lot_id         SERIAL PRIMARY KEY,
    lot_name       VARCHAR(100) NOT NULL,
    address        TEXT,
    city           VARCHAR(50),
    total_slots    INT DEFAULT 0,
    open_time      TIME,
    close_time     TIME,
    contact_number VARCHAR(15),
    created_at     TIMESTAMP DEFAULT NOW()
);

-- ── Parking Slot Table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Parking_Slot (
    slot_id      SERIAL PRIMARY KEY,
    lot_id       INT NOT NULL REFERENCES Parking_Lot(lot_id) ON DELETE CASCADE,
    slot_number  VARCHAR(10) NOT NULL,
    slot_type    slot_type NOT NULL,
    floor_level  INT DEFAULT 0,
    hourly_rate  NUMERIC(8,2) NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    UNIQUE(lot_id, slot_number)
);

-- ── Reservation Table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Reservation (
    reservation_id SERIAL PRIMARY KEY,
    user_id        INT NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
    vehicle_id     INT NOT NULL REFERENCES Vehicle(vehicle_id) ON DELETE CASCADE,
    slot_id        INT NOT NULL REFERENCES Parking_Slot(slot_id) ON DELETE CASCADE,
    start_time     TIMESTAMP NOT NULL,
    end_time       TIMESTAMP NOT NULL,
    status         reservation_status DEFAULT 'confirmed',
    created_at     TIMESTAMP DEFAULT NOW()
);

-- ── CheckIn / CheckOut Table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS CheckIn_CheckOut (
    checkin_id      SERIAL PRIMARY KEY,
    reservation_id  INT UNIQUE NOT NULL REFERENCES Reservation(reservation_id) ON DELETE CASCADE,
    actual_checkin  TIMESTAMP,
    actual_checkout TIMESTAMP
);

-- ── Payment Table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Payment (
    payment_id      SERIAL PRIMARY KEY,
    reservation_id  INT UNIQUE NOT NULL REFERENCES Reservation(reservation_id) ON DELETE CASCADE,
    amount          NUMERIC(10,2) NOT NULL,
    payment_method  VARCHAR(20),
    payment_status  VARCHAR(20) DEFAULT 'paid',
    payment_time    TIMESTAMP DEFAULT NOW()
);

-- ── Lot Occupancy View ────────────────────────────────────────
CREATE OR REPLACE VIEW Lot_Occupancy AS
SELECT
    pl.lot_id,
    pl.lot_name,
    pl.city,
    COUNT(ps.slot_id)                                          AS total_slots,
    SUM(CASE WHEN ps.is_available = TRUE THEN 1 ELSE 0 END)   AS available_slots,
    SUM(CASE WHEN ps.is_available = FALSE THEN 1 ELSE 0 END)  AS occupied_slots
FROM Parking_Lot pl
LEFT JOIN Parking_Slot ps ON pl.lot_id = ps.lot_id
GROUP BY pl.lot_id, pl.lot_name, pl.city;

-- ── Default Admin User ────────────────────────────────────────
-- Password: admin@123 (bcrypt hashed)
INSERT INTO "User" (full_name, email, phone, password_hash, role)
VALUES (
    'Admin',
    'admin@vprms.com',
    '0000000000',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'admin'
) ON CONFLICT (email) DO NOTHING;
