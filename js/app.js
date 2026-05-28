// Configuration
const NAPOLI_COORDS = [40.8518, 14.2681];
const NAPOLI_BOUNDS = [
    [40.7600, 14.1200], // Sud-Ovest
    [40.9200, 14.3800]  // Nord-Est
];
let map, markerLayer;
let isTurnstileVerified = false;
let displayedMarkerIds = new Set();
let markersMap = new Map(); // Store marker instances by ID for deep linking
let allPhotos = []; // Store all loaded photos for filtering
let activeFilters = new Set(); // Store multiple active category filters

// Translations
const TRANSLATIONS = {
    it: {
        filterAll: "Tutte",
        filterGraffito: "Graffiti",
        filterStencil: "Stencil",
        filterAffissione: "Affissione",
        filterSticker: "Sticker",
        filterMosaico: "Mosaico",
        btnUploadTitle: "Carica una foto",
        previewTitle: "Foto da inviare",
        btnSendAll: "Invia Tutte",
        btnCancelAll: "Annulla tutto",
        gpsMissing: "⚠️ GPS assente",
        missingGpsTitle: "GPS Mancante",
        useMyLocation: "Usa Mia Posizione",
        cancel: "Annulla",
        gettingLocation: "Ottengo posizione...",
        locationError: "Errore posizione.",
        opCompletedTitle: "✅ Operazione Completata",
        loadingAddress: "Caricamento indirizzo...",
        openGmaps: "Apri in Google Maps",
        unableLocation: "Impossibile ottenere la posizione attuale.",
        analyzing: "Analisi di {count} foto...",
        missingGpsMsg: "{count} foto non hanno coordinate. Usare la tua posizione attuale per queste foto?",
        sendingPhoto: "Invio foto {i} di {total}...",
        opCompletedMsg: "Abbiamo inviato {total} foto per l'approvazione."
    },
    en: {
        filterAll: "All",
        filterGraffito: "Graffiti",
        filterStencil: "Stencils",
        filterAffissione: "Posters",
        filterSticker: "Stickers",
        filterMosaico: "Mosaics",
        btnUploadTitle: "Upload a photo",
        previewTitle: "Photos to send",
        btnSendAll: "Send All",
        btnCancelAll: "Cancel all",
        gpsMissing: "⚠️ No GPS",
        missingGpsTitle: "Missing GPS",
        useMyLocation: "Use My Location",
        cancel: "Cancel",
        gettingLocation: "Getting location...",
        locationError: "Location error.",
        opCompletedTitle: "✅ Operation Completed",
        loadingAddress: "Loading address...",
        openGmaps: "Open in Google Maps",
        unableLocation: "Unable to get current location.",
        analyzing: "Analyzing {count} photos...",
        missingGpsMsg: "{count} photos don't have coordinates. Use your current location for these photos?",
        sendingPhoto: "Sending photo {i} of {total}...",
        opCompletedMsg: "We have sent {total} photos for approval."
    }
};

let currentLang = 'it';
function t(key, params) {
    let str = TRANSLATIONS[currentLang][key] || key;
    if (params) {
        for (let k in params) {
            str = str.replace(`{${k}}`, params[k]);
        }
    }
    return str;
}

function setLanguage(lang) {
    currentLang = lang;
    document.getElementById('lang-text').textContent = lang === 'it' ? 'EN' : 'IT';

    // Update filter chips
    document.querySelector('.filter-chip[data-category="all"]').textContent = t('filterAll');
    document.querySelector('.filter-chip[data-category="Graffito"]').textContent = t('filterGraffito');
    document.querySelector('.filter-chip[data-category="Stencil"]').textContent = t('filterStencil');
    document.querySelector('.filter-chip[data-category="Affissione"]').textContent = t('filterAffissione');
    document.querySelector('.filter-chip[data-category="Sticker"]').textContent = t('filterSticker');
    document.querySelector('.filter-chip[data-category="Mosaico"]').textContent = t('filterMosaico');
    
    // UI attributes
    document.getElementById('btn-toggle-panel').title = t('btnUploadTitle');
    
    // Action buttons inside sidebar
    const sendAll = document.getElementById('btn-confirm-upload');
    if (sendAll) sendAll.innerHTML = `<i data-lucide="send"></i> ${t('btnSendAll')}`;
    const cancelAll = document.getElementById('btn-cancel-preview');
    if (cancelAll) cancelAll.textContent = t('btnCancelAll');

    // Title
    const titleEl = document.querySelector('.section-title');
    if (titleEl && titleEl.childNodes.length > 0) {
        titleEl.childNodes[0].nodeValue = t('previewTitle') + " (";
    }

    if (window.lucide) lucide.createIcons();
    renderPreviewList(); // Update preview list texts if open
    if (allPhotos.length > 0) renderFilteredMap(); // Update texts inside map popups
}

// DOM Elements
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
    map = L.map('map', { 
        zoomControl: false,
        maxBounds: NAPOLI_BOUNDS,
        maxBoundsViscosity: 1.0,
        minZoom: 12
    }).setView(NAPOLI_COORDS, 13);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);
    markerLayer = L.markerClusterGroup({ 
        showCoverageOnHover: false, 
        spiderfyOnMaxZoom: true,
        zoomToBoundsOnClick: true,
        iconCreateFunction: function(cluster) {
            const count = cluster.getChildCount();
            return L.divIcon({
                className: 'custom-pin cluster-pin',
                html: `<div class="custom-pin-inner"><span class="pin-count">${count}</span></div>`,
                iconSize: [70, 70],
                iconAnchor: [35, 35]
            });
        }
    }).addTo(map);

    map.on('popupopen', async (e) => {
        if (window.lucide) lucide.createIcons();
        
        const popupContainer = e.popup.getElement();
        const addressElements = popupContainer.querySelectorAll('.address-text');
        
        if (addressElements.length > 0) {
            const latlng = e.popup.getLatLng();
            const address = await getAddressFromCoords(latlng.lat, latlng.lng);
            addressElements.forEach(el => {
                if (el.textContent === t('loadingAddress')) {
                    el.textContent = address;
                }
            });
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

    showStatus(t('analyzing', {count: files.length}), true);
    
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
                ${!item.lat ? `<p style="color:#e67e22; font-size:10px; font-weight:700;">${t('gpsMissing')}</p>` : ''}
                <div class="mini-category-chips">
                    ${['Graffito', 'Stencil', 'Affissione', 'Sticker', 'Mosaico'].map(cat => `
                        <span class="mini-chip ${item.category === cat ? 'active' : ''}" 
                              onclick="setCategory('${item.id}', '${cat}')">${t('filter' + cat)}</span>
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
            t('missingGpsTitle'), 
            t('missingGpsMsg', {count: missingGps.length}),
            t('useMyLocation'), t('cancel'),
            async () => {
                showStatus(t('gettingLocation'), true);
                try {
                    const pos = await getCurrentPositionPromise();
                    missingGps.forEach(p => {
                        p.lat = pos.coords.latitude;
                        p.lng = pos.coords.longitude;
                    });
                    startBulkUpload();
                } catch(e) { alert(t('locationError')); showStatus("", false); }
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
        showStatus(t('sendingPhoto', {i: i+1, total: total}), true);
        await uploadPhotoToServer(item);
    }

    showStatus("", false);
    showModal(t('opCompletedTitle'), t('opCompletedMsg', {total: total}), "Ok", "");
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
            
            // Verifica se ci sono cambiamenti reali prima di resettare tutto
            const newPhotosJson = JSON.stringify(photos);
            if (window.lastPhotosJson === newPhotosJson) return;
            window.lastPhotosJson = newPhotosJson;

            allPhotos = photos; // Store globally for filtering
            renderFilteredMap();
        }
    } catch (e) { console.error("API Error:", e); }
}

function addMarkerToMap(photoGroup) {
    const mainPhoto = photoGroup[0];
    const isMultiple = photoGroup.length > 1;

    let popupContent = '';

    if (!isMultiple) {
        popupContent = `
            <div class="popup-content">
                <img src="${mainPhoto.url}" alt="Foto" class="popup-img">
                <div class="popup-info">
                    <p class="address-text" style="font-weight: 700; color: var(--primary); margin-bottom: 4px;">${t('loadingAddress')}</p>
                    <div style="margin-bottom: 8px;">
                        <span style="font-size: 10px; font-weight: 800; background: #eee; padding: 3px 6px; border-radius: 4px; color: #555; text-transform: uppercase;">${t('filter' + mainPhoto.category)}</span>
                    </div>
                    <p style="font-size: 12px; color: var(--text-muted);"><i data-lucide="map-pin" class="card-icon"></i> ${mainPhoto.lat.toFixed(5)}, ${mainPhoto.lng.toFixed(5)}</p>
                    <a href="https://www.google.com/maps?q=${mainPhoto.lat},${mainPhoto.lng}" target="_blank" class="gmaps-link">
                        <i data-lucide="external-link" style="width:12px"></i> ${t('openGmaps')}
                    </a>
                </div>
            </div>
        `;
    } else {
        popupContent = `
            <div class="popup-carousel-container">
                <div class="carousel-counter">1 di ${photoGroup.length}</div>
                <div class="popup-carousel" onscroll="updateCarouselNav(this)">
                    ${photoGroup.map((p, i) => `
                        <div class="carousel-item">
                            <img src="${p.url}" alt="Foto" class="popup-img">
                            <div class="popup-info">
                                <p class="address-text" style="font-weight: 700; color: var(--primary); margin-bottom: 4px;">${t('loadingAddress')}</p>
                                <div style="margin-bottom: 8px;">
                                    <span style="font-size: 10px; font-weight: 800; background: #eee; padding: 3px 6px; border-radius: 4px; color: #555; text-transform: uppercase;">${t('filter' + p.category)}</span>
                                </div>
                                <a href="https://www.google.com/maps?q=${p.lat},${p.lng}" target="_blank" class="gmaps-link">
                                    <i data-lucide="external-link" style="width:12px"></i> ${t('openGmaps')}
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
        html: `<div class="custom-pin-inner">${isMultiple ? `<span class="pin-count" style="color:white; font-size:16px;">${photoGroup.length}</span>` : ''}</div>`,
        iconSize: [70, 70], iconAnchor: [35, 35], popupAnchor: [0, -35]
    });

    const marker = L.marker([mainPhoto.lat, mainPhoto.lng], { icon: customIcon }).bindPopup(popupContent).addTo(markerLayer);
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

/**
 * FEATURE: Category Filtering (Multi-Select)
 */
function toggleFilter(category) {
    if (category === 'all') {
        activeFilters.clear();
    } else {
        if (activeFilters.has(category)) {
            activeFilters.delete(category);
        } else {
            activeFilters.add(category);
        }
    }
    renderFilteredMap();
}

function renderFilteredMap() {
    // Se nessun filtro è attivo, mostra tutte le foto
    const filtered = activeFilters.size === 0 
        ? allPhotos 
        : allPhotos.filter(p => activeFilters.has(p.category));
    
    // Raggruppamento per coordinate ESATTE
    const groups = {};
    filtered.forEach(p => {
        const key = `${p.lat.toFixed(6)}_${p.lng.toFixed(6)}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
    });

    markerLayer.clearLayers();
    displayedMarkerIds.clear();
    markersMap.clear();

    Object.values(groups).forEach(group => {
        addMarkerToMap(group);
        group.forEach(p => displayedMarkerIds.add(p.id));
    });
    
    // Update filter chip UI
    document.querySelectorAll('.filter-chip').forEach(chip => {
        if (chip.dataset.category === 'all') {
            chip.classList.toggle('active', activeFilters.size === 0);
        } else {
            chip.classList.toggle('active', activeFilters.has(chip.dataset.category));
        }
    });
}

// Wire up filter chip click events
document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        toggleFilter(chip.dataset.category);
    });
});

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

    // Language toggle listener
    const btnLangToggle = document.getElementById('btn-lang-toggle');
    if (btnLangToggle) {
        btnLangToggle.addEventListener('click', () => {
            setLanguage(currentLang === 'it' ? 'en' : 'it');
        });
    }

    document.getElementById('btn-close-sidebar').addEventListener('click', closeSidebar);
    document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);
});
