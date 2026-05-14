// Configuration
const NAPOLI_COORDS = [40.8518, 14.2681];
let map, markerLayer;
let isTurnstileVerified = false;
let displayedMarkerIds = new Set();
let markersMap = new Map(); // Store marker instances by ID for deep linking

// DOM Elements
const btnLocation = document.getElementById('btn-location');
const photoUpload = document.getElementById('photo-upload');
const uploadStatus = document.getElementById('upload-status');
const statusText = document.getElementById('status-text');

// Modal Elements
const modalOverlay = document.getElementById('custom-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalPrimaryBtn = document.getElementById('modal-primary-btn');
const modalSecondaryBtn = document.getElementById('modal-secondary-btn');
const sidebarMessageArea = document.getElementById('sidebar-message-area');

// Preview Elements
const previewSection = document.getElementById('preview-section');
const previewList = document.getElementById('preview-list');
const pendingCountUI = document.getElementById('pending-count-ui');
const btnConfirmUpload = document.getElementById('btn-confirm-upload');
const btnCancelPreview = document.getElementById('btn-cancel-preview');

let uploadQueue = []; // Array of { id, file, filename, dataUrl, lat, lng, category }

/**
 * INIT: Leaflet Map
 */
function initMap() {
    map = L.map('map', { zoomControl: false }).setView(NAPOLI_COORDS, 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);
    // Disabilitato spiderfy per usare il sistema a carousel stile Booking
    markerLayer = L.markerClusterGroup({ 
        showCoverageOnHover: false, 
        spiderfyOnMaxZoom: false,
        zoomToBoundsOnClick: true 
    }).addTo(map);

    map.on('popupopen', async (e) => {
        if (window.lucide) lucide.createIcons();
        const addressEl = e.popup.getElement().querySelector('.address-text');
        if (addressEl && addressEl.textContent === 'Caricamento indirizzo...') {
            const latlng = e.popup.getLatLng();
            addressEl.textContent = await getAddressFromCoords(latlng.lat, latlng.lng);
        }
    });
}

/**
 * UTILITY: Geocoding & Helpers
 */
async function getAddressFromCoords(lat, lng) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, { headers: { 'Accept-Language': 'it' } });
        const data = await res.json();
        return data.address ? (data.address.road || data.address.pedestrian || data.address.suburb || "Napoli") : "Napoli, Italia";
    } catch { return "Napoli, Italia"; }
}

function exifToDecimal(coords, ref) {
    if (!coords || !coords.length) return null;
    let decimal = coords[0].valueOf() + coords[1].valueOf() / 60 + coords[2].valueOf() / 3600;
    if (ref === 'S' || ref === 'W') decimal = -decimal;
    return decimal;
}

function readFileAsDataURL(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

async function resizeImage(dataUrl, maxWidth = 1600, maxHeight = 1600) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width, height = img.height;
            if (width > maxWidth || height > maxHeight) {
                if (width > height) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
                else { width = Math.round((width * maxHeight) / height); height = maxHeight; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = dataUrl;
    });
}

/**
 * FEATURE: Multiple Photo Processing
 */
photoUpload.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    showStatus(`Analisi di ${files.length} foto...`, true);
    
    for (const file of files) {
        await processFile(file);
    }

    showStatus("", false);
    renderPreviewList();
    openSidebar(); // Apre la sidebar dopo aver processato le foto
    photoUpload.value = '';
});

async function processFile(file) {
    return new Promise((resolve) => {
        EXIF.getData(file, async function() {
            const lat = EXIF.getTag(this, "GPSLatitude");
            const latRef = EXIF.getTag(this, "GPSLatitudeRef");
            const lng = EXIF.getTag(this, "GPSLongitude");
            const lngRef = EXIF.getTag(this, "GPSLongitudeRef");
            
            let latitude = exifToDecimal(lat, latRef);
            let longitude = exifToDecimal(lng, lngRef);
            const dataUrl = await readFileAsDataURL(file);

            // If no GPS, we'll ask later or use default. 
            // For multiple uploads, we'll collect all first.
            uploadQueue.push({
                id: 'tmp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                file,
                filename: file.name,
                dataUrl,
                lat: latitude,
                lng: longitude,
                category: 'Graffito'
            });
            resolve();
        });
    });
}

function renderPreviewList() {
    if (!uploadQueue.length) {
        if (previewSection) previewSection.style.display = 'none';
        closeSidebar();
        return;
    }

    if (previewSection) previewSection.style.display = 'flex';
    pendingCountUI.textContent = uploadQueue.length;

    previewList.innerHTML = uploadQueue.map(item => `
        <div class="preview-item" id="item-${item.id}">
            <img src="${item.dataUrl}" class="preview-item-img">
            <div class="preview-item-info">
                <div class="preview-item-header">
                    <span class="preview-item-name">${item.filename}</span>
                    <button class="btn-remove-item" onclick="removeItemFromQueue('${item.id}')">
                        <i data-lucide="x-circle"></i>
                    </button>
                </div>
                ${!item.lat ? '<p style="color:#e67e22; font-size:10px; font-weight:700;">⚠️ GPS assente</p>' : ''}
                <div class="mini-category-chips">
                    ${['Graffito', 'Stencil', 'Affissione', 'Sticker'].map(cat => `
                        <span class="mini-chip ${item.category === cat ? 'active' : ''}" 
                              onclick="setCategory('${item.id}', '${cat}')">${cat}</span>
                    `).join('')}
                </div>
            </div>
        </div>
    `).join('');
    
    if (window.lucide) lucide.createIcons();
}

window.removeItemFromQueue = (id) => {
    uploadQueue = uploadQueue.filter(p => p.id !== id);
    renderPreviewList();
};

window.setCategory = (id, cat) => {
    const item = uploadQueue.find(p => p.id === id);
    if (item) {
        item.category = cat;
        renderPreviewList();
    }
};

/**
 * FEATURE: Bulk Upload
 */
btnConfirmUpload.addEventListener('click', async () => {
    if (!uploadQueue.length) return;

    // Check for missing GPS
    const missingGps = uploadQueue.filter(p => !p.lat);
    if (missingGps.length > 0) {
        showModal(
            "GPS Mancante", 
            `${missingGps.length} foto non hanno coordinate. Usare la tua posizione attuale per queste foto?`,
            "Usa Mia Posizione", "Annulla",
            async () => {
                showStatus("Ottengo posizione...", true);
                try {
                    const pos = await getCurrentPositionPromise();
                    missingGps.forEach(p => {
                        p.lat = pos.coords.latitude;
                        p.lng = pos.coords.longitude;
                    });
                    startBulkUpload();
                } catch(e) { alert("Errore posizione."); showStatus("", false); }
            }
        );
    } else {
        startBulkUpload();
    }
});

async function startBulkUpload() {
    const total = uploadQueue.length;
    if (previewSection) previewSection.style.display = 'none';

    for (let i = 0; i < uploadQueue.length; i++) {
        const item = uploadQueue[i];
        showStatus(`Invio foto ${i+1} di ${total}...`, true);
        await uploadPhotoToServer(item);
    }

    showStatus("", false);
    showModal("✅ Operazione Completata", `Abbiamo inviato ${total} foto per l'approvazione.`, "Ok", "");
    uploadQueue = [];
    renderPreviewList();
}

async function uploadPhotoToServer(photo) {
    try {
        let dataToUpload = photo.dataUrl;
        if (photo.dataUrl.length > 1024 * 500) { 
            dataToUpload = await resizeImage(photo.dataUrl);
        }
        
        const res = await fetch(dataToUpload);
        const blob = await res.blob();
        
        const formData = new FormData();
        formData.append('photo', blob, photo.filename);
        formData.append('lat', photo.lat);
        formData.append('lng', photo.lng);
        formData.append('category', photo.category);

        await fetch(`${CONFIG.API_BASE}/upload.php`, { method: 'POST', body: formData });
    } catch(err) { console.error("Upload failed for", photo.filename, err); }
}

/**
 * OTHER FEATURES (Polling, Map, etc.)
 */
async function loadGlobalPhotos() {
    try {
        const url = `${CONFIG.API_BASE}/get_photos.php?t=${Date.now()}`;
        const response = await fetch(url);
        if (response.ok) {
            const photos = await response.json();
            
            // Raggruppamento per coordinate (chiave "lat_lng")
            const groups = {};
            photos.forEach(p => {
                const key = `${p.lat.toFixed(6)}_${p.lng.toFixed(6)}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(p);
            });

            // Rimuovo i marker esistenti per rinfrescare correttamente i gruppi
            markerLayer.clearLayers();
            displayedMarkerIds.clear();
            markersMap.clear();

            Object.values(groups).forEach(group => {
                addMarkerToMap(group);
                group.forEach(p => displayedMarkerIds.add(p.id));
            });
        }
    } catch (e) { console.error("API Error:", e); }
}

function addMarkerToMap(photoGroup) {
    const mainPhoto = photoGroup[0];
    const isMultiple = photoGroup.length > 1;

    let popupContent = '';

    if (!isMultiple) {
        // Layout Standard (Singola foto)
        popupContent = `
            <div class="popup-content">
                <img src="${mainPhoto.url}" alt="Foto" class="popup-img">
                <div class="popup-info">
                    <p class="address-text" style="font-weight: 700; color: var(--primary); margin-bottom: 4px;">Caricamento indirizzo...</p>
                    <div style="margin-bottom: 8px;">
                        <span style="font-size: 10px; font-weight: 800; background: #eee; padding: 3px 6px; border-radius: 4px; color: #555; text-transform: uppercase;">${mainPhoto.category}</span>
                    </div>
                    <p style="font-size: 12px; color: var(--text-muted);"><i data-lucide="map-pin" class="card-icon"></i> ${mainPhoto.lat.toFixed(5)}, ${mainPhoto.lng.toFixed(5)}</p>
                    <a href="https://www.google.com/maps?q=${mainPhoto.lat},${mainPhoto.lng}" target="_blank" class="gmaps-link">
                        <i data-lucide="external-link" style="width:12px"></i> Apri in Google Maps
                    </a>
                </div>
            </div>
        `;
    } else {
        // Layout Carousel (Stile Booking)
        popupContent = `
            <div class="popup-carousel-container">
                <div class="carousel-counter">1 di ${photoGroup.length}</div>
                <div class="popup-carousel" onscroll="updateCarouselNav(this)">
                    ${photoGroup.map((p, i) => `
                        <div class="carousel-item">
                            <img src="${p.url}" alt="Foto" class="popup-img">
                            <div class="popup-info">
                                <p class="address-text" style="font-weight: 700; color: var(--primary); margin-bottom: 4px;">Caricamento indirizzo...</p>
                                <div style="margin-bottom: 8px;">
                                    <span style="font-size: 10px; font-weight: 800; background: #eee; padding: 3px 6px; border-radius: 4px; color: #555; text-transform: uppercase;">${p.category}</span>
                                </div>
                                <a href="https://www.google.com/maps?q=${p.lat},${p.lng}" target="_blank" class="gmaps-link">
                                    <i data-lucide="external-link" style="width:12px"></i> Apri in Google Maps
                                </a>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="carousel-nav">
                    ${photoGroup.map((_, i) => `<div class="nav-dot ${i === 0 ? 'active' : ''}"></div>`).join('')}
                </div>
            </div>
        `;
    }

    const customIcon = L.divIcon({
        className: 'custom-pin',
        html: `<div class="custom-pin-inner">${isMultiple ? `<span class="pin-count">${photoGroup.length}</span>` : ''}</div>`,
        iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -10]
    });

    const marker = L.marker([mainPhoto.lat, mainPhoto.lng], { icon: customIcon }).bindPopup(popupContent).addTo(markerLayer);
    
    // Mappo tutti gli ID del gruppo a questo marker per il deep linking
    photoGroup.forEach(p => markersMap.set(p.id, marker));
}

window.updateCarouselNav = (el) => {
    const index = Math.round(el.scrollLeft / el.offsetWidth);
    const container = el.closest('.popup-carousel-container');
    const dots = container.querySelectorAll('.nav-dot');
    const counter = container.querySelector('.carousel-counter');
    
    dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
    if (counter) counter.textContent = `${index + 1} di ${dots.length}`;
};

function handleDeepLinking() {
    const params = new URLSearchParams(window.location.search);
    const lat = params.get('lat'), lng = params.get('lng'), id = params.get('id');
    if (lat && lng) {
        map.flyTo([parseFloat(lat), parseFloat(lng)], 17, { animate: true, duration: 2 });
        if (id) { setTimeout(() => { const marker = markersMap.get(id); if (marker) marker.openPopup(); }, 2500); }
    }
}

function getCurrentPositionPromise() {
    return new Promise((resolve, reject) => {
        if (!('geolocation' in navigator)) return reject();
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
    });
}

btnLocation.addEventListener('click', async () => {
    try {
        const position = await getCurrentPositionPromise();
        const { latitude, longitude } = position.coords;
        map.flyTo([latitude, longitude], 15, { animate: true, duration: 1.5 });
        L.circleMarker([latitude, longitude], { radius: 8, fillColor: "var(--primary)", color: "#fff", weight: 2, opacity: 1, fillOpacity: 0.8 }).addTo(markerLayer);
    } catch { alert("Impossibile ottenere la posizione attuale."); }
});

btnCancelPreview.addEventListener('click', () => {
    uploadQueue = [];
    renderPreviewList();
});

function showStatus(text, visible = true) {
    statusText.textContent = text;
    uploadStatus.style.display = visible ? 'flex' : 'none';
}

function showModal(title, msg, primaryLabel, secondaryLabel, onPrimary, onSecondary) {
    modalTitle.textContent = title;
    modalMessage.textContent = msg;
    modalPrimaryBtn.textContent = primaryLabel;
    modalSecondaryBtn.style.display = secondaryLabel ? 'block' : 'none';
    modalSecondaryBtn.textContent = secondaryLabel;
    
    // Hide preview list and show message area
    if (previewSection) previewSection.style.display = 'none';
    if (uploadStatus) uploadStatus.style.display = 'none';
    sidebarMessageArea.style.display = 'flex';
    openSidebar(); // Assicura che la sidebar sia aperta

    if (window.lucide) lucide.createIcons();

    modalPrimaryBtn.onclick = () => { 
        sidebarMessageArea.style.display = 'none'; 
        if (onPrimary) onPrimary(); 
        else renderPreviewList(); // Torna alla lista se non c'è azione speciale
    };
    modalSecondaryBtn.onclick = () => { 
        sidebarMessageArea.style.display = 'none'; 
        if (onSecondary) onSecondary(); 
        else renderPreviewList();
    };
}

setInterval(loadGlobalPhotos, CONFIG.POLLING_INTERVAL);

// ── Sidebar toggle ────────────────────────────────────────────────────────
function openSidebar() {
    document.getElementById('upload-sidebar').classList.add('is-open');
    document.getElementById('sidebar-overlay').classList.add('is-open');
    document.getElementById('btn-toggle-panel').classList.add('is-open');
    if (window.lucide) lucide.createIcons();
}

function closeSidebar() {
    document.getElementById('upload-sidebar').classList.remove('is-open');
    document.getElementById('sidebar-overlay').classList.remove('is-open');
    document.getElementById('btn-toggle-panel').classList.remove('is-open');
}

document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    await loadGlobalPhotos();
    handleDeepLinking();
    if (window.lucide) lucide.createIcons();

    // Sidebar controls: Il FAB ora attiva direttamente l'upload
    document.getElementById('btn-toggle-panel').addEventListener('click', () => {
        photoUpload.click();
    });

    document.getElementById('btn-close-sidebar').addEventListener('click', closeSidebar);
    document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);
});
