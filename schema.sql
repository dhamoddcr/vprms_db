-- ============================================================
-- VPRMS - Vehicle Parking Reservation Management System
-- PostgreSQL Schema & Seeds
-- ============================================================

-- ── Safe ENUM Types Creation ─────────────────────────────────
DO $$ BEGIN
    CREATE TYPE slot_type AS ENUM ('two-wheeler', 'car', 'SUV', 'truck');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_type AS ENUM ('pending', 'paid', 'failed', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_type AS ENUM ('cash', 'card', 'upi', 'online');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('customer', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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

DROP VIEW IF EXISTS Lot_Occupancy CASCADE;
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

-- ── Seed Default Parking Lots ──────────────────────────────────
INSERT INTO Parking_Lot (lot_id, lot_name, address, city, total_slots, open_time, close_time, contact_number)
SELECT 1, 'Downtown Plaza Parking', '123 MG Road', 'Bangalore', 5, '06:00:00', '23:00:00', '080-11112222'
WHERE NOT EXISTS (SELECT 1 FROM Parking_Lot WHERE lot_id = 1);

INSERT INTO Parking_Lot (lot_id, lot_name, address, city, total_slots, open_time, close_time, contact_number)
SELECT 2, 'Terminal 1 Airport Parking', 'HAL Airport Road', 'Bangalore', 4, '00:00:00', '23:59:59', '080-33334444'
WHERE NOT EXISTS (SELECT 1 FROM Parking_Lot WHERE lot_id = 2);

INSERT INTO Parking_Lot (lot_id, lot_name, address, city, total_slots, open_time, close_time, contact_number)
SELECT 3, 'Phoenix Mall Parking', 'LBS Road, Kurla', 'Mumbai', 3, '10:00:00', '22:00:00', '022-55556666'
WHERE NOT EXISTS (SELECT 1 FROM Parking_Lot WHERE lot_id = 3);

-- Adjust SERIAL sequence for Parking_Lot
SELECT setval(pg_get_serial_sequence('public.Parking_Lot', 'lot_id'), COALESCE(MAX(lot_id), 1)) FROM Parking_Lot;

-- ── Seed Default Parking Slots ──────────────────────────────────
INSERT INTO Parking_Slot (slot_id, lot_id, slot_number, slot_type, floor_level, hourly_rate, is_available)
SELECT 1, 1, 'A-101', 'car', 0, 40.00, true
WHERE NOT EXISTS (SELECT 1 FROM Parking_Slot WHERE slot_id = 1);

INSERT INTO Parking_Slot (slot_id, lot_id, slot_number, slot_type, floor_level, hourly_rate, is_available)
SELECT 2, 1, 'A-102', 'car', 0, 40.00, true
WHERE NOT EXISTS (SELECT 1 FROM Parking_Slot WHERE slot_id = 2);

INSERT INTO Parking_Slot (slot_id, lot_id, slot_number, slot_type, floor_level, hourly_rate, is_available)
SELECT 3, 1, 'B-201', 'two-wheeler', 1, 20.00, true
WHERE NOT EXISTS (SELECT 1 FROM Parking_Slot WHERE slot_id = 3);

INSERT INTO Parking_Slot (slot_id, lot_id, slot_number, slot_type, floor_level, hourly_rate, is_available)
SELECT 4, 1, 'C-301', 'SUV', 2, 60.00, true
WHERE NOT EXISTS (SELECT 1 FROM Parking_Slot WHERE slot_id = 4);

INSERT INTO Parking_Slot (slot_id, lot_id, slot_number, slot_type, floor_level, hourly_rate, is_available)
SELECT 5, 1, 'D-401', 'truck', 3, 100.00, true
WHERE NOT EXISTS (SELECT 1 FROM Parking_Slot WHERE slot_id = 5);

INSERT INTO Parking_Slot (slot_id, lot_id, slot_number, slot_type, floor_level, hourly_rate, is_available)
SELECT 6, 2, 'T1-01', 'car', 0, 80.00, true
WHERE NOT EXISTS (SELECT 1 FROM Parking_Slot WHERE slot_id = 6);

INSERT INTO Parking_Slot (slot_id, lot_id, slot_number, slot_type, floor_level, hourly_rate, is_available)
SELECT 7, 2, 'T1-02', 'car', 0, 80.00, true
WHERE NOT EXISTS (SELECT 1 FROM Parking_Slot WHERE slot_id = 7);

INSERT INTO Parking_Slot (slot_id, lot_id, slot_number, slot_type, floor_level, hourly_rate, is_available)
SELECT 8, 2, 'T1-03', 'two-wheeler', 0, 30.00, true
WHERE NOT EXISTS (SELECT 1 FROM Parking_Slot WHERE slot_id = 8);

INSERT INTO Parking_Slot (slot_id, lot_id, slot_number, slot_type, floor_level, hourly_rate, is_available)
SELECT 9, 2, 'T1-04', 'SUV', 0, 120.00, true
WHERE NOT EXISTS (SELECT 1 FROM Parking_Slot WHERE slot_id = 9);

INSERT INTO Parking_Slot (slot_id, lot_id, slot_number, slot_type, floor_level, hourly_rate, is_available)
SELECT 10, 3, 'P-01', 'car', 0, 50.00, true
WHERE NOT EXISTS (SELECT 1 FROM Parking_Slot WHERE slot_id = 10);

INSERT INTO Parking_Slot (slot_id, lot_id, slot_number, slot_type, floor_level, hourly_rate, is_available)
SELECT 11, 3, 'P-02', 'two-wheeler', 0, 25.00, true
WHERE NOT EXISTS (SELECT 1 FROM Parking_Slot WHERE slot_id = 11);

INSERT INTO Parking_Slot (slot_id, lot_id, slot_number, slot_type, floor_level, hourly_rate, is_available)
SELECT 12, 3, 'P-03', 'SUV', 0, 75.00, true
WHERE NOT EXISTS (SELECT 1 FROM Parking_Slot WHERE slot_id = 12);

-- Adjust SERIAL sequence for Parking_Slot
SELECT setval(pg_get_serial_sequence('public.Parking_Slot', 'slot_id'), COALESCE(MAX(slot_id), 1)) FROM Parking_Slot;
