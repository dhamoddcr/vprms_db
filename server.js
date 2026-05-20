// ============================================================
// VPRMS - Vehicle Parking Reservation Management System
// Backend: Node.js + Express + PostgreSQL
// ============================================================

const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'vprms_secret_key_2024';

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── PostgreSQL Connection ─────────────────────────────────────
const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     || 5432,
    database: process.env.DB_NAME     || 'vprms_db',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || 'admin@123',
});

pool.connect((err) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
    } else {
        console.log('✅ Connected to PostgreSQL database');
    }
});

// ── Auth Middleware ───────────────────────────────────────────
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied. No token.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
}

function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
    next();
}

// ============================================================
// AUTH ROUTES
// ============================================================

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { full_name, email, phone, password, role } = req.body;
        if (!full_name || !email || !password)
            return res.status(400).json({ error: 'Name, email and password are required.' });

        const existing = await pool.query('SELECT user_id FROM "User" WHERE email = $1', [email]);
        if (existing.rows.length > 0)
            return res.status(409).json({ error: 'Email already registered.' });

        const password_hash = await bcrypt.hash(password, 10);
        const userRole = role === 'admin' ? 'admin' : 'customer';

        const result = await pool.query(
            `INSERT INTO "User" (full_name, email, phone, password_hash, role)
             VALUES ($1, $2, $3, $4, $5) RETURNING user_id, full_name, email, role`,
            [full_name, email, phone || null, password_hash, userRole]
        );
        const user = result.rows[0];
        const token = jwt.sign({ user_id: user.user_id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ message: 'User registered successfully', token, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ error: 'Email and password are required.' });

        const result = await pool.query('SELECT * FROM "User" WHERE email = $1', [email]);
        if (result.rows.length === 0)
            return res.status(401).json({ error: 'Invalid credentials.' });

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword)
            return res.status(401).json({ error: 'Invalid credentials.' });

        const token = jwt.sign({ user_id: user.user_id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            message: 'Login successful',
            token,
            user: { user_id: user.user_id, full_name: user.full_name, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// ============================================================
// USER ROUTES
// ============================================================

// GET /api/users/profile
app.get('/api/users/profile', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT user_id, full_name, email, phone, role, created_at FROM "User" WHERE user_id = $1',
            [req.user.user_id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// ============================================================
// VEHICLE ROUTES
// ============================================================

// GET /api/vehicles - my vehicles
app.get('/api/vehicles', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM Vehicle WHERE user_id = $1 ORDER BY vehicle_id',
            [req.user.user_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/vehicles - add vehicle
app.post('/api/vehicles', authenticateToken, async (req, res) => {
    try {
        const { license_plate, vehicle_type, brand, color } = req.body;
        if (!license_plate || !vehicle_type)
            return res.status(400).json({ error: 'License plate and vehicle type are required.' });

        const result = await pool.query(
            `INSERT INTO Vehicle (user_id, license_plate, vehicle_type, brand, color)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [req.user.user_id, license_plate.toUpperCase(), vehicle_type, brand || null, color || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'License plate already registered.' });
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/vehicles/:id
app.delete('/api/vehicles/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM Vehicle WHERE vehicle_id = $1 AND user_id = $2', [req.params.id, req.user.user_id]);
        res.json({ message: 'Vehicle removed.' });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// ============================================================
// PARKING LOT ROUTES
// ============================================================

// GET /api/lots - all lots
app.get('/api/lots', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT pl.*, 
             COUNT(ps.slot_id) AS total_slots,
             SUM(CASE WHEN ps.is_available = TRUE THEN 1 ELSE 0 END) AS available_slots
             FROM Parking_Lot pl
             LEFT JOIN Parking_Slot ps ON pl.lot_id = ps.lot_id
             GROUP BY pl.lot_id ORDER BY pl.lot_id`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/lots/:id/slots - slots in a lot
app.get('/api/lots/:id/slots', async (req, res) => {
    try {
        const { vehicle_type } = req.query;
        let query = 'SELECT * FROM Parking_Slot WHERE lot_id = $1';
        const params = [req.params.id];
        if (vehicle_type) {
            query += ' AND slot_type = $2';
            params.push(vehicle_type);
        }
        query += ' ORDER BY floor_level, slot_number';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/lots - admin: add lot
app.post('/api/lots', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { lot_name, address, city, open_time, close_time, contact_number } = req.body;
        const result = await pool.query(
            `INSERT INTO Parking_Lot (lot_name, address, city, open_time, close_time, contact_number)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [lot_name, address, city, open_time, close_time, contact_number]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/lots/:id/slots - admin: add slot
app.post('/api/lots/:id/slots', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { slot_number, slot_type, floor_level, hourly_rate } = req.body;

        // Validate required fields
        if (!slot_number || !slot_type || !hourly_rate) {
            return res.status(400).json({ error: 'Slot number, type, and hourly rate are required.' });
        }

        // Validate slot_type matches PostgreSQL ENUM values exactly
        const validTypes = ['two-wheeler', 'car', 'SUV', 'truck'];
        if (!validTypes.includes(slot_type)) {
            return res.status(400).json({ error: `Invalid slot type. Must be one of: ${validTypes.join(', ')}` });
        }

        const result = await pool.query(
            `INSERT INTO Parking_Slot (lot_id, slot_number, slot_type, floor_level, hourly_rate)
             VALUES ($1, $2, $3::slot_type, $4, $5) RETURNING *`,
            [req.params.id, slot_number, slot_type, floor_level || 0, hourly_rate]
        );
        // Update total_slots count
        await pool.query('UPDATE Parking_Lot SET total_slots = total_slots + 1 WHERE lot_id = $1', [req.params.id]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Add slot error:', err.message);
        if (err.code === '23505') return res.status(409).json({ error: 'Slot number already exists in this lot.' });
        res.status(500).json({ error: err.message || 'Server error.' });
    }
});

// DELETE /api/lots/:id - admin: delete lot
app.delete('/api/lots/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const lotId = req.params.id;
        // Check if lot exists
        const check = await pool.query('SELECT lot_id FROM Parking_Lot WHERE lot_id = $1', [lotId]);
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Lot not found.' });
        }
        // Delete slots first (cascade should handle it, but being explicit)
        await pool.query('DELETE FROM Parking_Slot WHERE lot_id = $1', [lotId]);
        await pool.query('DELETE FROM Parking_Lot WHERE lot_id = $1', [lotId]);
        res.json({ message: 'Parking lot deleted successfully.' });
    } catch (err) {
        console.error('Delete lot error:', err.message);
        res.status(500).json({ error: err.message || 'Server error.' });
    }
});

// ============================================================
// RESERVATION ROUTES
// ============================================================

// GET /api/reservations - my reservations
app.get('/api/reservations', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT R.*, V.license_plate, V.vehicle_type, V.brand,
                    PS.slot_number, PS.slot_type, PS.hourly_rate,
                    PL.lot_name, PL.city
             FROM Reservation R
             JOIN Vehicle V ON R.vehicle_id = V.vehicle_id
             JOIN Parking_Slot PS ON R.slot_id = PS.slot_id
             JOIN Parking_Lot PL ON PS.lot_id = PL.lot_id
             WHERE R.user_id = $1
             ORDER BY R.created_at DESC`,
            [req.user.user_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/reservations - create reservation
app.post('/api/reservations', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { vehicle_id, slot_id, start_time, end_time } = req.body;

        // Check slot is available
        const slotCheck = await client.query(
            'SELECT * FROM Parking_Slot WHERE slot_id = $1 AND is_available = TRUE FOR UPDATE',
            [slot_id]
        );
        if (slotCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Slot is not available.' });
        }

        // Check no overlapping reservation
        const overlap = await client.query(
            `SELECT reservation_id FROM Reservation
             WHERE slot_id = $1 AND status NOT IN ('cancelled','completed')
             AND (start_time < $3 AND end_time > $2)`,
            [slot_id, start_time, end_time]
        );
        if (overlap.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Slot is already booked for this time range.' });
        }

        const result = await client.query(
            `INSERT INTO Reservation (user_id, vehicle_id, slot_id, start_time, end_time, status)
             VALUES ($1, $2, $3, $4, $5, 'confirmed') RETURNING *`,
            [req.user.user_id, vehicle_id, slot_id, start_time, end_time]
        );

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    } finally {
        client.release();
    }
});

// PATCH /api/reservations/:id/cancel
app.patch('/api/reservations/:id/cancel', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE Reservation SET status = 'cancelled'
             WHERE reservation_id = $1 AND user_id = $2 AND status IN ('pending','confirmed')
             RETURNING *`,
            [req.params.id, req.user.user_id]
        );
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Reservation not found or cannot be cancelled.' });
        res.json({ message: 'Reservation cancelled.', reservation: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// ============================================================
// CHECK-IN / CHECK-OUT ROUTES
// ============================================================

// POST /api/checkin
app.post('/api/checkin', authenticateToken, async (req, res) => {
    try {
        const { reservation_id } = req.body;
        const result = await pool.query(
            `INSERT INTO CheckIn_CheckOut (reservation_id, actual_checkin)
             VALUES ($1, NOW()) RETURNING *`,
            [reservation_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// PATCH /api/checkout/:reservation_id
app.patch('/api/checkout/:reservation_id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE CheckIn_CheckOut SET actual_checkout = NOW()
             WHERE reservation_id = $1 RETURNING *`,
            [req.params.reservation_id]
        );
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'CheckIn record not found.' });

        // Mark reservation as completed
        await pool.query(
            "UPDATE Reservation SET status = 'completed' WHERE reservation_id = $1",
            [req.params.reservation_id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// ============================================================
// PAYMENT ROUTES
// ============================================================

// POST /api/payments
app.post('/api/payments', authenticateToken, async (req, res) => {
    try {
        const { reservation_id, amount, payment_method } = req.body;
        const result = await pool.query(
            `INSERT INTO Payment (reservation_id, amount, payment_method, payment_status, payment_time)
             VALUES ($1, $2, $3, 'paid', NOW()) RETURNING *`,
            [reservation_id, amount, payment_method]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Payment already exists for this reservation.' });
        res.status(500).json({ error: 'Server error.' });
    }
});

// ============================================================
// ADMIN ROUTES
// ============================================================

// GET /api/admin/reservations - all reservations
app.get('/api/admin/reservations', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT R.*, U.full_name, U.email, V.license_plate,
                    PS.slot_number, PL.lot_name
             FROM Reservation R
             JOIN "User" U ON R.user_id = U.user_id
             JOIN Vehicle V ON R.vehicle_id = V.vehicle_id
             JOIN Parking_Slot PS ON R.slot_id = PS.slot_id
             JOIN Parking_Lot PL ON PS.lot_id = PL.lot_id
             ORDER BY R.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/stats - dashboard stats
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [users, reservations, revenue, occupancy] = await Promise.all([
            pool.query('SELECT COUNT(*) AS count FROM "User" WHERE role = $1', ['customer']),
            pool.query("SELECT COUNT(*) AS count FROM Reservation WHERE status = 'confirmed'"),
            pool.query("SELECT COALESCE(SUM(amount),0) AS total FROM Payment WHERE payment_status = 'paid'"),
            pool.query('SELECT * FROM Lot_Occupancy'),
        ]);
        res.json({
            total_customers:    parseInt(users.rows[0].count),
            active_reservations: parseInt(reservations.rows[0].count),
            total_revenue:      parseFloat(revenue.rows[0].total),
            occupancy:          occupancy.rows,
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// ============================================================
// SERVE FRONTEND
// ============================================================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start Server ──────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 VPRMS Server running at http://localhost:${PORT}`);
});