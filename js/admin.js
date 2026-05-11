// ── UI helpers: login overlay ──────────────────────────────────────────────

function showLogin(errorMsg = '') {
    document.getElementById('admin-content').style.display  = 'none';
    document.getElementById('login-overlay').style.display  = 'flex';
    document.getElementById('login-error').textContent      = errorMsg;
    document.getElementById('pin-input').value              = '';
    document.getElementById('pin-input').classList.remove('error');
    if (errorMsg) document.getElementById('pin-input').classList.add('error');
}

function showDashboard() {
    document.getElementById('login-overlay').style.display  = 'none';
    document.getElementById('admin-content').style.display  = 'block';
}

// ── Login logic ────────────────────────────────────────────────────────────

async function handleLogin() {
    const pin    = document.getElementById('pin-input').value.trim();
    const btnEl  = document.getElementById('btn-login');
    const errEl  = document.getElementById('login-error');

    if (!pin) return;

    btnEl.disabled = true;
    btnEl.textContent = 'Verifica...';
    errEl.textContent = '';

    try {
        const res  = await fetch(`${CONFIG.API_BASE}/login.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin }),
            credentials: 'include'
        });
        const data = await res.json();

        if (res.ok && data.success) {
            showDashboard();
            fetchPhotos();
            if (window.lucide) lucide.createIcons();
        } else {
            showLogin(data.error || 'PIN errato. Riprova.');
        }
    } catch (e) {
        showLogin('Errore di connessione. Il server è avviato?');
    } finally {
        btnEl.disabled = false;
        btnEl.textContent = 'Entra';
    }
}

// ── Photo fetching ─────────────────────────────────────────────────────────

async function fetchPhotos() {
    try {
        const url = `${CONFIG.API_BASE}/admin_pending.php?t=${Date.now()}`;
        console.log("Fetching photos from:", url);

        const res = await fetch(url, { credentials: 'include' });

        if (res.status === 401) {
            console.warn("Sessione non valida (401)");
            showLogin();
            return;
        }

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`Server error (${res.status}):`, errorText);
            throw new Error(`Errore server ${res.status}`);
        }

        const photos   = await res.json();
        console.log("Photos loaded:", photos.length);
        const pending  = photos.filter(p => p.status === 0);
        const approved = photos.filter(p => p.status === 1);

        document.getElementById('pending-count').textContent  = pending.length;
        document.getElementById('approved-count').textContent = approved.length;

        renderGrid('pending-grid',  pending,  'pending');
        renderGrid('approved-grid', approved, 'approved');

        if (window.lucide) lucide.createIcons();
        loadAdminAddresses();

    } catch (e) {
        console.error("Fetch error:", e);
        document.getElementById('pending-grid').innerHTML =
            `<div class="empty-state"><p>Errore nel caricamento: ${e.message}</p></div>`;
    }
}

// ── Grid rendering ─────────────────────────────────────────────────────────

function renderGrid(gridId, photos, type) {
    const grid = document.getElementById(gridId);

    if (photos.length === 0) {
        const msg = type === 'pending'
            ? 'Nessuna foto in attesa. Le nuove foto appariranno qui.'
            : 'Nessuna foto approvata.';
        grid.innerHTML = `<div class="empty-state"><p>${msg}</p></div>`;
        return;
    }

    grid.innerHTML = photos.map(photo => `
        <div class="card" data-lat="${photo.lat}" data-lng="${photo.lng}">
            <img src="${photo.url}?t=${Date.now()}" alt="Foto">
            <div class="card-content">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span class="status-${photo.status}">
                        ${photo.status === 0 ? 'PENDENTE' : 'APPROVATA'}
                    </span>
                    <span style="font-size:11px; font-weight:800; background:#eee; padding:4px 8px; border-radius:6px; color:#555; text-transform:uppercase;">
                        ${photo.category || 'Generale'}
                    </span>
                </div>
                <p class="admin-address" style="font-weight:700; color:#111; margin-bottom:4px;">Caricamento...</p>
                <p style="font-size:13px; color:#777;">
                    <i data-lucide="map-pin" class="card-icon"></i>
                    ${photo.lat.toFixed(5)}, ${photo.lng.toFixed(5)}
                </p>
            </div>
            <div class="card-actions ${type === 'approved' ? 'single' : ''}">
                ${type === 'pending' ? `
                    <button class="btn btn-success" onclick="adminAction('${photo.id}', 1, 'pending')">
                        <i data-lucide="check"></i> Conferma
                    </button>
                    <button class="btn btn-danger" onclick="adminAction('${photo.id}', 99, 'pending')">
                        <i data-lucide="x"></i> Rifiuta
                    </button>
                ` : `
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; width:100%;">
                        <a href="index.html?lat=${photo.lat}&lng=${photo.lng}&id=${photo.id}" class="btn btn-secondary" target="_blank">
                            <i data-lucide="map-pin"></i> Vedi
                        </a>
                        <button class="btn btn-danger" onclick="adminAction('${photo.id}', 99, 'approved')">
                            <i data-lucide="trash-2"></i> Elimina
                        </button>
                    </div>
                `}
            </div>
        </div>
    `).join('');
}

// ── Address reverse geocoding ──────────────────────────────────────────────

async function loadAdminAddresses() {
    const cards = document.querySelectorAll('.card[data-lat]');
    for (let card of cards) {
        const lat       = card.getAttribute('data-lat');
        const lng       = card.getAttribute('data-lng');
        const addressEl = card.querySelector('.admin-address');
        if (addressEl) {
            addressEl.textContent = await getAddressFromCoords(lat, lng);
        }
        await new Promise(r => setTimeout(r, 400));
    }
}

async function getAddressFromCoords(lat, lng) {
    try {
        const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
            { headers: { 'Accept-Language': 'it' } }
        );
        const data = await res.json();
        return data.address
            ? (data.address.road || data.address.pedestrian || data.address.suburb || 'Napoli')
            : 'Napoli, Italia';
    } catch {
        return 'Napoli, Italia';
    }
}

// ── Admin actions ──────────────────────────────────────────────────────────

async function adminAction(id, status, context) {
    let confirmMsg = '';
    if (status === 99 && context === 'pending')  confirmMsg = 'Rifiutare e rimuovere questa foto?';
    if (status === 99 && context === 'approved') confirmMsg = 'Eliminare definitivamente questa foto?';
    if (confirmMsg && !confirm(confirmMsg)) return;

    try {
        const response = await fetch(`${CONFIG.API_BASE}/admin_action.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status }),
            credentials: 'include'
        });
        
        console.log(`Action ${status} for ${id} responded with ${response.status}`);
        const result = await response.json();

        if (response.ok && result.success) {
            fetchPhotos();
        } else if (response.status === 401) {
            showLogin();
        } else {
            console.error('Admin action failed:', result.error);
            alert('Errore: ' + (result.error || 'Operazione fallita'));
        }
    } catch (err) {
        console.error('Network error during action:', err);
        alert('Errore di connessione');
    }
}

// ── Change PIN ─────────────────────────────────────────────────────────────

async function changePin() {
    const current_pin = prompt('Inserisci il PIN attuale:');
    if (!current_pin) return;
    const new_pin = prompt('Inserisci il NUOVO PIN (min 4 cifre):');
    if (!new_pin) return;

    try {
        const res  = await fetch(`${CONFIG.API_BASE}/change_pin.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_pin, new_pin }),
            credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) alert('PIN aggiornato!');
        else alert('Errore: ' + data.error);
    } catch {
        alert('Errore connessione');
    }
}

// ── Logout ─────────────────────────────────────────────────────────────────

document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await fetch(`${CONFIG.API_BASE}/logout.php`, { credentials: 'include' });
    showLogin();
});

// ── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Login button
    document.getElementById('btn-login').addEventListener('click', handleLogin);
    document.getElementById('pin-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') handleLogin();
    });

    // Try to load photos — if session is still valid, skip login screen
    fetch(`${CONFIG.API_BASE}/admin_pending.php`, { credentials: 'include' })
        .then(res => {
            if (res.ok) {
                showDashboard();
                fetchPhotos();
                if (window.lucide) lucide.createIcons();
            }
            // else: stay on login overlay (default)
        })
        .catch(() => { /* stay on login overlay */ });

    if (window.lucide) lucide.createIcons();
});
