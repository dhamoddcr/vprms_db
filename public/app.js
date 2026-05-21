// ============================================================
// VPRMS – app.js
// Roles: admin = manage only | customer = book only
// ============================================================

const API = window.location.hostname === 'dhamoddcr.github.io'
  ? 'https://vprms-db.onrender.com'
  : '';
let token       = localStorage.getItem('vprms_token');
let currentUser = JSON.parse(localStorage.getItem('vprms_user') || 'null');
let selectedSlotId = null;
let allMyVehicles  = [];

// ── Helpers ───────────────────────────────────────────────────
async function api(method, url, body, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = (type === 'success' ? '✅ ' : type === 'error' ? '❌ ' : 'ℹ️ ') + msg;
  t.className = `show ${type}`;
  setTimeout(() => { t.className = ''; }, 3500);
}

function fmtDate(d) {
  if (!d) return '–';
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

function statusBadge(s) {
  const map = { confirmed:'success', pending:'warning', cancelled:'danger', completed:'info' };
  return `<span class="badge badge-${map[s]||'secondary'}">${s}</span>`;
}

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function isAdmin()      { return currentUser?.role === 'admin'; }
function isCustomer()   { return currentUser?.role === 'customer'; }

// ── Auth ──────────────────────────────────────────────────────
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) =>
    t.classList.toggle('active', i === 0 ? tab === 'login' : tab === 'register'));
  document.getElementById('login-form').classList.toggle('active', tab === 'login');
  document.getElementById('register-form').classList.toggle('active', tab === 'register');
}

async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.style.display = 'none';
  try {
    const data  = await api('POST', '/api/auth/login', { email, password }, false);
    token       = data.token; currentUser = data.user;
    localStorage.setItem('vprms_token', token);
    localStorage.setItem('vprms_user', JSON.stringify(currentUser));
    initApp();
  } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
}

async function handleRegister() {
  const full_name = document.getElementById('reg-name').value.trim();
  const email     = document.getElementById('reg-email').value.trim();
  const phone     = document.getElementById('reg-phone').value.trim();
  const password  = document.getElementById('reg-password').value;
  const role      = document.getElementById('reg-role').value;
  const errEl     = document.getElementById('register-error');
  const sucEl     = document.getElementById('register-success');
  errEl.style.display = 'none'; sucEl.style.display = 'none';
  try {
    await api('POST', '/api/auth/register', { full_name, email, phone, password, role }, false);
    sucEl.textContent = '✅ Account created! Please sign in.'; sucEl.style.display = 'block';
    setTimeout(() => switchAuthTab('login'), 1500);
  } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
}

function handleLogout() {
  token = null; currentUser = null;
  localStorage.removeItem('vprms_token');
  localStorage.removeItem('vprms_user');
  document.getElementById('app').style.display       = 'none';
  document.getElementById('auth-page').style.display = 'flex';
}

// ── App Init ──────────────────────────────────────────────────
function initApp() {
  document.getElementById('auth-page').style.display = 'none';
  document.getElementById('app').style.display       = 'block';

  // Set user info everywhere
  document.getElementById('user-name').textContent    = currentUser.full_name;
  document.getElementById('user-role').textContent    = currentUser.role;
  document.getElementById('user-avatar').textContent  = currentUser.full_name[0].toUpperCase();
  document.getElementById('topbar-avatar').textContent = currentUser.full_name[0].toUpperCase();
  document.getElementById('topbar-name').textContent  = currentUser.full_name;

  // Set default booking times
  const now   = new Date();
  const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const fmt   = d => d.toISOString().slice(0, 16);
  document.getElementById('book-start').value = fmt(now);
  document.getElementById('book-end').value   = fmt(later);

  const nav = document.getElementById('sidebar-nav');

  if (isCustomer()) {
    nav.innerHTML = `
      <div class="nav-section">Menu</div>
      <div class="nav-item active" onclick="showPage('dashboard')"><span class="ni">🏠</span> Dashboard</div>
      <div class="nav-item" onclick="showPage('lots')"><span class="ni">🏢</span> Parking Lots</div>
      <div class="nav-item" onclick="showPage('book')"><span class="ni">📋</span> Book a Slot</div>
      <div class="nav-item" onclick="showPage('reservations')"><span class="ni">🎫</span> My Reservations</div>
      <div class="nav-item" onclick="showPage('vehicles')"><span class="ni">🚗</span> My Vehicles</div>`;
    // Hide admin pages
    ['page-admin-dash','page-admin-reservations','page-manage-lots']
      .forEach(id => { const el = document.getElementById(id); if(el) el.style.display='none'; });
    showPage('dashboard');

  } else if (isAdmin()) {
    nav.innerHTML = `
      <div class="nav-section">Admin Panel</div>
      <div class="nav-item active" onclick="showPage('admin-dash')"><span class="ni">📊</span> Dashboard</div>
      <div class="nav-item" onclick="showPage('admin-reservations')"><span class="ni">📑</span> All Reservations</div>
      <div class="nav-item" onclick="showPage('manage-lots')"><span class="ni">⚙️</span> Manage Lots</div>`;
    // Hide customer pages
    ['page-dashboard','page-lots','page-book','page-reservations','page-vehicles']
      .forEach(id => { const el = document.getElementById(id); if(el) el.style.display='none'; });
    showPage('admin-dash');
  }
}

// ── Navigation ─────────────────────────────────────────────────
function showPage(name) {
  const adminPages    = ['admin-dash','admin-reservations','manage-lots'];
  const customerPages = ['dashboard','lots','book','reservations','vehicles'];

  if (isAdmin() && customerPages.includes(name))    { showToast('Admins cannot access customer pages','error'); return; }
  if (isCustomer() && adminPages.includes(name))    { showToast('Access denied','error'); return; }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById(`page-${name}`);
  if (page) { page.style.display = ''; page.classList.add('active'); }

  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick')?.includes(`'${name}'`)) n.classList.add('active');
  });

  const titles = { dashboard:'Dashboard', lots:'Parking Lots', book:'Book a Slot',
    reservations:'My Reservations', vehicles:'My Vehicles',
    'admin-dash':'Admin Dashboard', 'admin-reservations':'All Reservations', 'manage-lots':'Manage Lots' };
  document.getElementById('topbar-title').textContent = titles[name] || name;

  if (name === 'dashboard')          loadDashboard();
  if (name === 'lots')               loadLots();
  if (name === 'book')               loadBookPage();
  if (name === 'reservations')       loadReservations();
  if (name === 'vehicles')           loadVehicles();
  if (name === 'admin-dash')         loadAdminDash();
  if (name === 'admin-reservations') loadAdminReservations();
  if (name === 'manage-lots')        loadManageLots();
}

// ── CUSTOMER: Dashboard ────────────────────────────────────────
async function loadDashboard() {
  try {
    const [vehicles, reservations, lots] = await Promise.all([
      api('GET', '/api/vehicles'),
      api('GET', '/api/reservations'),
      api('GET', '/api/lots', null, false),
    ]);
    document.getElementById('stat-vehicles').textContent     = vehicles.length;
    document.getElementById('stat-reservations').textContent = reservations.length;
    document.getElementById('stat-active').textContent =
      reservations.filter(r => r.status === 'confirmed').length;
    document.getElementById('stat-lots').textContent = lots.length;
    document.getElementById('dash-greeting').textContent =
      `Welcome back, ${currentUser.full_name.split(' ')[0]}! 👋`;

    const tbody  = document.getElementById('dash-recent-tbody');
    const recent = reservations.slice(0, 5);
    tbody.innerHTML = !recent.length
      ? `<tr><td colspan="6"><div class="empty"><div>🎫</div><p>No bookings yet</p></div></td></tr>`
      : recent.map(r => `<tr>
          <td>${r.lot_name}</td><td><strong>${r.slot_number}</strong></td>
          <td>${r.license_plate}</td><td>${fmtDate(r.start_time)}</td>
          <td>${fmtDate(r.end_time)}</td><td>${statusBadge(r.status)}</td>
        </tr>`).join('');
  } catch (e) { console.error(e); }
}

// ── CUSTOMER: Parking Lots ─────────────────────────────────────
async function loadLots() {
  try {
    const lots = await api('GET', '/api/lots', null, false);
    const grid = document.getElementById('lots-grid');
    if (!lots.length) { grid.innerHTML = `<div class="empty"><div>🏢</div><p>No lots found</p></div>`; return; }
    grid.innerHTML = lots.map(l => {
      const total = parseInt(l.total_slots) || 0;
      const avail = parseInt(l.available_slots) || 0;
      const pct   = total ? Math.round(((total - avail) / total) * 100) : 0;
      const cls   = pct >= 80 ? 'high' : pct >= 50 ? 'med' : 'low';
      return `
      <div class="lot-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
          <div class="lot-name">${l.lot_name}</div>
          <span class="badge ${avail > 0 ? 'badge-success' : 'badge-danger'}">${avail > 0 ? 'Open' : 'Full'}</span>
        </div>
        <div class="lot-city">📍 ${l.city || ''}</div>
        <div class="lot-addr">${l.address || ''}</div>
        <div class="lot-bar-wrap">
          <div class="lot-bar-info">
            <span>${avail} available / ${total} total</span>
            <span>${pct}% full</span>
          </div>
          <div class="lot-bar"><div class="lot-bar-fill ${cls}" style="width:${pct}%"></div></div>
        </div>
        <div class="lot-meta">🕐 ${l.open_time||'–'} – ${l.close_time||'–'} &nbsp;|&nbsp; 📞 ${l.contact_number||'–'}</div>
        <button class="btn-primary" style="width:100%;margin-top:4px"
          onclick="showPage('book');setTimeout(()=>{document.getElementById('book-lot').value='${l.lot_id}';loadSlots();},200)">
          Reserve Here →
        </button>
      </div>`;
    }).join('');
  } catch (e) { console.error(e); }
}

// ── CUSTOMER: Book a Slot ─────────────────────────────────────
function filterVehicleDropdown() {
  const vtype = document.getElementById('book-vtype').value;
  const vSel  = document.getElementById('book-vehicle');
  const filtered = vtype ? allMyVehicles.filter(v => v.vehicle_type === vtype) : allMyVehicles;
  vSel.innerHTML = '<option value="">– Select Vehicle –</option>' +
    filtered.map(v => `<option value="${v.vehicle_id}">${v.license_plate} – ${v.brand || v.vehicle_type} (${v.vehicle_type})</option>`).join('');
  if (vtype && filtered.length === 0) {
    vSel.innerHTML = '<option value="">– No matching vehicle –</option>';
    showToast(`No ${vtype} registered. Add one in My Vehicles.`, 'error');
  }
}

async function loadBookPage() {
  try {
    const [lots, vehicles] = await Promise.all([
      api('GET', '/api/lots', null, false),
      api('GET', '/api/vehicles'),
    ]);
    allMyVehicles = vehicles;
    const lotSel = document.getElementById('book-lot');
    lotSel.innerHTML = '<option value="">– Select Lot –</option>' +
      lots.map(l => `<option value="${l.lot_id}">${l.lot_name} (${l.city})</option>`).join('');
    filterVehicleDropdown();
  } catch (e) { console.error(e); }
}

async function loadSlots() {
  const lotId = document.getElementById('book-lot').value;
  const vtype = document.getElementById('book-vtype').value;
  filterVehicleDropdown();
  if (!lotId) { document.getElementById('slots-card').style.display = 'none'; return; }
  try {
    const slots = await api('GET', `/api/lots/${lotId}/slots${vtype ? `?vehicle_type=${vtype}` : ''}`, null, false);
    document.getElementById('slots-card').style.display = 'block';
    const c = document.getElementById('slots-container');
    if (!slots.length) { c.innerHTML = `<div class="empty"><div>🅿️</div><p>No slots found</p></div>`; return; }
    c.innerHTML = slots.map(s => `
      <div class="slot-card ${s.is_available ? '' : 'occupied'}"
           onclick="${s.is_available ? `selectSlot(${s.slot_id},'${s.slot_number}',${s.hourly_rate},'${s.slot_type}')` : ''}">
        <div class="sn">${s.slot_number}</div>
        <div class="si">Fl.${s.floor_level} · ${s.slot_type}</div>
        <div class="sr">${s.is_available ? `₹${s.hourly_rate}/hr` : 'Occupied'}</div>
      </div>`).join('');
  } catch (e) { console.error(e); }
}

function selectSlot(slotId, slotNum, rate, type) {
  selectedSlotId = slotId;
  document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('selected'));
  event.currentTarget.classList.add('selected');

  const start = new Date(document.getElementById('book-start').value);
  const end   = new Date(document.getElementById('book-end').value);
  const hours = Math.max(1, Math.ceil((end - start) / 3600000));
  const total = (hours * rate).toFixed(2);
  const vSel  = document.getElementById('book-vehicle');
  const vText = vSel.options[vSel.selectedIndex]?.text || '–';

  document.getElementById('booking-summary-body').innerHTML = `
    <div class="summary-grid">
      <div class="summary-item"><div class="sl">Slot</div><div class="sv">${slotNum}</div></div>
      <div class="summary-item"><div class="sl">Type</div><div class="sv" style="text-transform:capitalize">${type}</div></div>
      <div class="summary-item"><div class="sl">Vehicle</div><div class="sv">${vText}</div></div>
      <div class="summary-item"><div class="sl">Duration</div><div class="sv">${hours} hour(s)</div></div>
      <div class="summary-item"><div class="sl">Start</div><div class="sv">${fmtDate(start)}</div></div>
      <div class="summary-item"><div class="sl">End</div><div class="sv">${fmtDate(end)}</div></div>
    </div>
    <div class="total-box">
      <div class="total-label">Estimated Total</div>
      <div class="total-amount">₹${total}</div>
      <div class="total-calc">₹${rate}/hr × ${hours} hr(s)</div>
    </div>`;
  document.getElementById('booking-summary').style.display = 'block';
  document.getElementById('booking-summary').scrollIntoView({ behavior: 'smooth' });
}

async function confirmBooking() {
  const vehicleId = document.getElementById('book-vehicle').value;
  const start     = document.getElementById('book-start').value;
  const end       = document.getElementById('book-end').value;
  if (!vehicleId)      { showToast('Please select a vehicle', 'error'); return; }
  if (!selectedSlotId) { showToast('Please select a slot', 'error');    return; }
  if (!start || !end)  { showToast('Please set start and end times', 'error'); return; }
  try {
    await api('POST', '/api/reservations', {
      vehicle_id: parseInt(vehicleId), slot_id: selectedSlotId,
      start_time: new Date(start).toISOString(), end_time: new Date(end).toISOString(),
    });
    showToast('Booking confirmed!', 'success');
    clearBooking();
    setTimeout(() => showPage('reservations'), 1000);
  } catch (e) { showToast(e.message, 'error'); }
}

function clearBooking() {
  selectedSlotId = null;
  document.getElementById('booking-summary').style.display = 'none';
  document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('selected'));
}

// ── CUSTOMER: Reservations ────────────────────────────────────
async function loadReservations() {
  try {
    const reservations = await api('GET', '/api/reservations');
    const tbody        = document.getElementById('reservations-tbody');
    if (!reservations.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty"><div>🎫</div><p>No reservations found</p></div></td></tr>`; return;
    }
    tbody.innerHTML = reservations.map(r => `
      <tr>
        <td style="color:var(--text3)">#${r.reservation_id}</td>
        <td>${r.lot_name}</td><td><strong>${r.slot_number}</strong></td>
        <td>${r.license_plate}</td>
        <td>${fmtDate(r.start_time)}</td><td>${fmtDate(r.end_time)}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${r.status==='confirmed'||r.status==='pending'
          ? `<button class="btn-danger btn-sm" onclick="cancelReservation(${r.reservation_id})">Cancel</button>`
          : '–'}</td>
      </tr>`).join('');
  } catch (e) { console.error(e); }
}

async function cancelReservation(id) {
  if (!confirm('Cancel this reservation?')) return;
  try {
    await api('PATCH', `/api/reservations/${id}/cancel`);
    showToast('Reservation cancelled', 'info');
    loadReservations();
  } catch (e) { showToast(e.message, 'error'); }
}

// ── CUSTOMER: Vehicles ────────────────────────────────────────
async function loadVehicles() {
  try {
    const vehicles = await api('GET', '/api/vehicles');
    const grid     = document.getElementById('vehicles-grid');
    const icons    = { 'two-wheeler':'🛵', car:'🚗', SUV:'🚙', truck:'🚛' };
    if (!vehicles.length) {
      grid.innerHTML = `<div class="empty"><div>🚗</div><p>No vehicles registered yet</p></div>`; return;
    }
    grid.innerHTML = vehicles.map(v => `
      <div class="vehicle-card">
        <div class="vc-ico">${icons[v.vehicle_type]||'🚗'}</div>
        <div class="vc-plate">${v.license_plate}</div>
        <div class="vc-info">${v.brand||''} ${v.color ? '· '+v.color : ''}</div>
        <div class="vc-type">${v.vehicle_type}</div>
        <div style="margin-top:16px">
          <button class="btn-danger btn-sm" onclick="deleteVehicle(${v.vehicle_id})">🗑 Remove</button>
        </div>
      </div>`).join('');
  } catch (e) { console.error(e); }
}

function openAddVehicleModal() {
  document.getElementById('v-plate').value = '';
  document.getElementById('v-brand').value = '';
  document.getElementById('v-color').value = '';
  document.getElementById('vehicle-modal-error').style.display = 'none';
  openModal('modal-vehicle');
}

async function addVehicle() {
  const license_plate = document.getElementById('v-plate').value.trim();
  const vehicle_type  = document.getElementById('v-type').value;
  const brand         = document.getElementById('v-brand').value.trim();
  const color         = document.getElementById('v-color').value.trim();
  const errEl         = document.getElementById('vehicle-modal-error');
  errEl.style.display = 'none';
  if (!license_plate) { errEl.textContent='License plate required'; errEl.style.display='block'; return; }
  try {
    await api('POST', '/api/vehicles', { license_plate, vehicle_type, brand, color });
    closeModal('modal-vehicle'); showToast('Vehicle added!'); loadVehicles();
  } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
}

async function deleteVehicle(id) {
  if (!confirm('Remove this vehicle?')) return;
  try { await api('DELETE', `/api/vehicles/${id}`); showToast('Vehicle removed','info'); loadVehicles(); }
  catch (e) { showToast(e.message,'error'); }
}

// ── ADMIN: Dashboard ──────────────────────────────────────────
async function loadAdminDash() {
  try {
    const stats = await api('GET', '/api/admin/stats');
    document.getElementById('adm-customers').textContent = stats.total_customers;
    document.getElementById('adm-active').textContent    = stats.active_reservations;
    document.getElementById('adm-revenue').textContent   = `₹${stats.total_revenue.toFixed(2)}`;
    const occ = document.getElementById('adm-occupancy');
    if (!stats.occupancy.length) { occ.innerHTML = '<p style="color:var(--text3)">No data</p>'; return; }
    occ.innerHTML = stats.occupancy.map(o => {
      const pct = o.total_slots ? Math.round((o.occupied/o.total_slots)*100) : 0;
      const cls = pct>=80?'high':pct>=50?'med':'low';
      return `<div class="occ-row">
        <div class="occ-label"><strong>${o.lot_name}</strong><span>${o.occupied}/${o.total_slots} (${pct}%)</span></div>
        <div class="occ-bar"><div class="occ-fill ${cls}" style="width:${pct}%"></div></div>
      </div>`;
    }).join('');
  } catch (e) { console.error(e); }
}

// ── ADMIN: All Reservations ───────────────────────────────────
async function loadAdminReservations() {
  try {
    const res   = await api('GET', '/api/admin/reservations');
    const tbody = document.getElementById('admin-res-tbody');
    if (!res.length) { tbody.innerHTML=`<tr><td colspan="8"><div class="empty"><p>No reservations</p></div></td></tr>`; return; }
    tbody.innerHTML = res.map(r => `
      <tr>
        <td style="color:var(--text3)">#${r.reservation_id}</td>
        <td>${r.full_name}<br><small style="color:var(--text3)">${r.email}</small></td>
        <td>${r.license_plate}</td>
        <td>${r.lot_name}</td><td><strong>${r.slot_number}</strong></td>
        <td>${fmtDate(r.start_time)}</td><td>${fmtDate(r.end_time)}</td>
        <td>${statusBadge(r.status)}</td>
      </tr>`).join('');
  } catch (e) { console.error(e); }
}

// ── ADMIN: Manage Lots ────────────────────────────────────────
async function loadManageLots() {
  try {
    const lots  = await api('GET', '/api/lots', null, false);
    const tbody = document.getElementById('manage-lots-tbody');
    if (!lots.length) { tbody.innerHTML=`<tr><td colspan="8"><div class="empty"><p>No lots</p></div></td></tr>`; return; }
    tbody.innerHTML = lots.map(l => `
      <tr>
        <td style="color:var(--text3)">${l.lot_id}</td>
        <td><strong>${l.lot_name}</strong></td>
        <td>${l.city||'–'}</td>
        <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.address||'–'}</td>
        <td>${l.total_slots}</td>
        <td>${l.open_time||'–'} – ${l.close_time||'–'}</td>
        <td>${l.contact_number||'–'}</td>
        <td style="display:flex;gap:6px">
          <button class="btn-indigo btn-sm" onclick="openAddSlotModal(${l.lot_id})">+ Slot</button>
          <button class="btn-danger btn-sm" onclick="deleteLot(${l.lot_id},'${l.lot_name.replace(/'/g,"\\'")}')">🗑</button>
        </td>
      </tr>`).join('');
  } catch (e) { console.error(e); }
}

function openAddLotModal() { openModal('modal-lot'); }

async function addLot() {
  const body = {
    lot_name: document.getElementById('lot-name').value.trim(),
    address:  document.getElementById('lot-address').value.trim(),
    city:     document.getElementById('lot-city').value.trim(),
    open_time: document.getElementById('lot-open').value,
    close_time: document.getElementById('lot-close').value,
    contact_number: document.getElementById('lot-contact').value.trim(),
  };
  try { await api('POST','/api/lots',body); closeModal('modal-lot'); showToast('Lot added!'); loadManageLots(); }
  catch (e) { showToast(e.message,'error'); }
}

function openAddSlotModal(lotId) {
  document.getElementById('slot-lot-id').value = lotId;
  openModal('modal-slot');
}

async function deleteLot(id, name) {
  if (!confirm(`Delete lot "${name}" and ALL its slots?\n\nThis cannot be undone.`)) return;
  try {
    await api('DELETE', `/api/lots/${id}`);
    showToast('Parking lot deleted', 'info');
    loadManageLots();
  } catch (e) { showToast(e.message, 'error'); }
}

async function addSlot() {
  const lotId = document.getElementById('slot-lot-id').value;
  const body  = {
    slot_number: document.getElementById('slot-num').value.trim(),
    slot_type:   document.getElementById('slot-type-sel').value,
    floor_level: parseInt(document.getElementById('slot-floor').value)||0,
    hourly_rate: parseFloat(document.getElementById('slot-rate').value),
  };
  try { await api('POST',`/api/lots/${lotId}/slots`,body); closeModal('modal-slot'); showToast('Slot added!'); loadManageLots(); }
  catch (e) { showToast(e.message,'error'); }
}

// ── Bootstrap ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (token && currentUser) {
    initApp();
  } else {
    document.getElementById('auth-page').style.display = 'flex';
    document.getElementById('app').style.display       = 'none';
  }
});