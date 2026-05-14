const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const DB_FILE = path.join(__dirname, '../db.json');
const UPLOAD_DIR = path.join(__dirname, '../uploads');
const DEFAULT_PIN = '101516';
const MAX_ATTEMPTS = 5;
const LOCK_DURATION = 900 * 1000; // 15 minutes in ms
const SESSION_TIMEOUT = 7200 * 1000; // 2 hours in ms

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
    secret: 'maradona-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: SESSION_TIMEOUT, httpOnly: true }
}));

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Helpers
function readDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const initial = {
                photos: [],
                config: { pin_hash: null, pin_created_at: null },
                rate_limit: { attempts: 0, locked_until: null }
            };
            writeDB(initial);
            return initial;
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { photos: [], config: { pin_hash: null }, rate_limit: { attempts: 0, locked_until: null } };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getPinHash() {
    const db = readDB();
    if (!db.config.pin_hash) {
        const hash = crypto.createHash('sha256').update(DEFAULT_PIN).digest('hex');
        db.config.pin_hash = hash;
        db.config.pin_created_at = new Date().toISOString();
        writeDB(db);
        return hash;
    }
    return db.config.pin_hash;
}

function checkAuth(req, res, next) {
    if (!req.session.admin_logged_in) {
        return res.status(401).json({ error: "Unauthorized access" });
    }
    next();
}

// Multer Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueName = 'photo-' + Date.now() + '-' + Math.round(Math.random() * 9999) + ext;
        cb(null, uniqueName);
    }
});
const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Unsupported file type'));
    }
});

/**
 * ROUTES
 */

// Login
app.post('/api/login.php', (req, res) => {
    console.log('Login attempt received:', req.body);
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: "Missing PIN" });

    // Important: getPinHash() might update the DB file if it's the first run.
    // So we call it first and then read the DB to get the most fresh state.
    const storedHash = getPinHash(); 
    const db = readDB();
    const rateLimit = db.rate_limit || { attempts: 0, locked_until: null };

    if (rateLimit.locked_until) {
        const lockedUntil = new Date(rateLimit.locked_until).getTime();
        if (Date.now() < lockedUntil) {
            const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
            return res.status(429).json({ error: `Troppi tentativi. Riprova tra ${remaining} secondi.` });
        }
        rateLimit.attempts = 0;
        rateLimit.locked_until = null;
    }

    const inputHash = crypto.createHash('sha256').update(pin).digest('hex');

    if (inputHash === storedHash) {
        db.rate_limit = { attempts: 0, locked_until: null };
        writeDB(db);
        req.session.admin_logged_in = true;
        res.json({ success: true });
    } else {
        rateLimit.attempts++;
        if (rateLimit.attempts >= MAX_ATTEMPTS) {
            rateLimit.locked_until = new Date(Date.now() + LOCK_DURATION).toISOString();
            db.rate_limit = rateLimit;
            writeDB(db);
            res.status(429).json({ error: "Account bloccato per 15 minuti dopo troppi tentativi falliti." });
        } else {
            const remaining = MAX_ATTEMPTS - rateLimit.attempts;
            db.rate_limit = rateLimit;
            writeDB(db);
            res.status(401).json({ error: `PIN errato. ${remaining} tentativi rimasti.` });
        }
    }
});

// Logout
app.get('/api/logout.php', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Upload
app.post('/api/upload.php', upload.single('photo'), (req, res) => {
    if (!req.file || !req.body.lat || !req.body.lng) {
        return res.status(400).json({ error: "Missing data" });
    }

    const db = readDB();
    const photoId = 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const newPhoto = {
        id: photoId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        lat: parseFloat(req.body.lat),
        lng: parseFloat(req.body.lng),
        url: 'uploads/' + req.file.filename,
        status: 0,
        category: req.body.category || 'Graffito',
        created_at: new Date().toISOString()
    };

    db.photos.push(newPhoto);
    writeDB(db);
    res.status(201).json({ message: "Foto caricata!", id: photoId });
});

// Public Photos
app.get('/api/get_photos.php', (req, res) => {
    const db = readDB();
    const photos = db.photos
        .filter(p => p.status === 1)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(photos);
});

// Admin Pending Photos
app.get('/api/admin_pending.php', checkAuth, (req, res) => {
    const db = readDB();
    let photos = db.photos;
    
    if (req.query.status !== undefined) {
        const status = parseInt(req.query.status);
        photos = photos.filter(p => p.status === status);
    } else {
        photos.sort((a, b) => {
            if (a.status !== b.status) return a.status - b.status;
            return new Date(b.created_at) - new Date(a.created_at);
        });
    }
    res.json(photos);
});

// Admin Action
app.post('/api/admin_action.php', checkAuth, (req, res) => {
    const { id, status } = req.body;
    if (!id || status === undefined) return res.status(400).json({ error: "Missing data" });

    const db = readDB();
    const index = db.photos.findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ error: "Photo not found" });

    if (parseInt(status) === 99) {
        const photo = db.photos[index];
        const filePath = path.join(UPLOAD_DIR, photo.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        db.photos.splice(index, 1);
        writeDB(db);
        res.json({ success: true, message: "Foto eliminata" });
    } else {
        db.photos[index].status = parseInt(status);
        writeDB(db);
        res.json({ success: true });
    }
});

// Change PIN
app.post('/api/change_pin.php', checkAuth, (req, res) => {
    const { current_pin, new_pin } = req.body;
    if (!current_pin || !new_pin) return res.status(400).json({ error: "Missing data" });

    const currentHash = crypto.createHash('sha256').update(current_pin).digest('hex');
    if (currentHash !== getPinHash()) {
        return res.status(401).json({ error: "PIN attuale non corretto" });
    }

    if (String(new_pin).length < 4) {
        return res.status(400).json({ error: "Il nuovo PIN deve avere almeno 4 caratteri" });
    }

    const db = readDB();
    db.config.pin_hash = crypto.createHash('sha256').update(String(new_pin)).digest('hex');
    db.config.pin_created_at = new Date().toISOString();
    writeDB(db);
    res.json({ success: true, message: "PIN aggiornato con successo" });
});

// Serve static files AFTER routes — prevents raw PHP files from shadowing API endpoints
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, '../')));

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
