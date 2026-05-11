# Documentazione Tecnica: MIRAMARADONA

**MIRAMARADONA** è un'applicazione web interattiva che permette agli utenti di caricare fotografie geolocalizzate, visualizzandole su una mappa di Napoli. Il sistema include un'area di moderazione integrata nella dashboard admin per gestire l'approvazione delle foto prima della pubblicazione.

---

## 🚀 Architettura del Progetto

Il progetto segue una struttura **Client-Server** con backend Node.js:

### 🎨 Frontend (HTML/CSS/JS)
- **Mappa**: Basata su [Leaflet.js](https://leafletjs.com/) con tile map di CartoDB (stile Voyager).
- **Icone**: Utilizzo della libreria **Lucide Icons** (stile outline) per un'interfaccia minimalista e moderna.
- **Design System**: Estetica premium basata su una palette colori sofisticata: **Deep Carbon (#202020)** per la struttura, **Napoli Azure (#8dc5d9)** per gli accenti, **Sunlight Gold (#ffd15b)** per le azioni (CTA) e **Warm Stone (#ccc2ac)** per i toni neutri. Utilizzo di **Glassmorphism** e **Manrope Font**.
- **Metadati**: Utilizzo di `EXIF.js` per estrarre le coordinate GPS direttamente dai file originali.
- **Resizing Client-Side**: Le immagini vengono ridimensionate automaticamente (max 1600px) prima dell'upload per ottimizzare banda e spazio su disco.
- **Clustering & Spiderfy**: Utilizzo di `Leaflet.markercluster` per raggruppare i marker vicini e gestire le foto con coordinate identiche (funzione spiderfy al clic).
- **Bulk Upload & Queue**: Supporto per il caricamento contemporaneo di più file. Gestione tramite una coda di anteprima (`uploadQueue`) che permette la categorizzazione individuale prima dell'invio massivo.
- **Preview & Categorizzazione**: Lista scorrevole di anteprime con selezione rapida della categoria per ogni singola immagine.

### ⚙ Backend (Node.js / Express)
- **Server**: Express.js in esecuzione su `localhost:3000` (sviluppo locale).
- **Database**: File JSON (`db.json`), scelto per semplicità e portabilità senza dipendenze esterne.
- **Schema**: Array `photos` con campi per coordinate, URL, categoria e stato. Oggetto `config` per il PIN hash. Oggetto `rate_limit` per il blocco temporaneo dopo tentativi falliti.
- **Stato Foto**: `0 = Pendente`, `1 = Approvata`.
- **Upload**: Gestione dei file tramite `multer` con sanificazione automatica dei nomi.
- **⚠️ Ordine middleware critico**: Le route API devono essere definite **prima** del middleware `express.static`, altrimenti i file PHP nella cartella `api/` vengono serviti come testo grezzo, impedendo il corretto funzionamento delle API.

---

## 🛠 Funzionamento Utente (Mappa)

1. **Selezione Multipla**: L'utente può scegliere una o più immagini. Il sistema analizza i metadati EXIF di ciascuna in parallelo.
2. **Analisi GPS & Fallback**: Se una o più foto mancano di coordinate, il sistema propone di applicare la posizione GPS attuale dell'utente a tutte le foto mancanti della coda con un'unica azione.
3. **Gestione Coda**: Viene mostrata una lista scorrevole delle foto caricate. Per ogni foto l'utente può scegliere una categoria diversa o rimuovere l'elemento dalla coda.
4. **Invio Massivo**: Al click su "Invia Tutte", le foto vengono caricate in sequenza sul server, con feedback visivo sullo stato di avanzamento (es. "Foto 2 di 5").
5. **Popup Informativi**: Ogni marker sulla mappa mostra un popup con anteprima foto, categoria, indirizzo (reverse geocoding via Nominatim) e un **link diretto a Google Maps**.
6. **Sicurezza**: Integrazione di **Cloudflare Turnstile (Invisible)** per la protezione dai bot.

---

## 🔐 Area Admin e Moderazione

L'area di amministrazione è accessibile direttamente su `admin.html` tramite overlay di login integrato.

### 🔑 Security (PIN Access)
L'accesso è protetto da un **PIN di sicurezza** con sessioni Express:
- **PIN Predefinito**: `101516` (da cambiare in produzione).
- Il PIN viene salvato come **hash SHA-256** in `db.json`.
- Dopo **5 tentativi falliti**, l'accesso è bloccato per **15 minuti**.
- Qualsiasi azione via API admin senza sessione attiva restituisce `401 Unauthorized`.
- La sessione scade automaticamente dopo **2 ore** di inattività.

### 📋 Dashboard Admin
La dashboard è divisa in **due sezioni separate**:

| Sezione | Contenuto | Azioni disponibili |
|---|---|---|
| **In Attesa di Approvazione** | Foto caricate dagli utenti (status 0) | ✅ Conferma → appare sulla mappa · ❌ Rifiuta → eliminazione definitiva |
| **Foto Approvate** | Foto visibili sulla mappa (status 1) | 👁️ Vedi → apre la mappa sulla foto · 🗑️ Elimina → rimozione definitiva |

- **Deep Linking**: Il pulsante "Vedi" apre la mappa pubblica centrando automaticamente la visuale sulla foto scelta e aprendone il popup informativo tramite parametri URL (`lat`, `lng`, `id`).

- Ogni card mostra: anteprima foto, badge di stato, categoria, indirizzo (via reverse geocoding Nominatim) e coordinate GPS.
- Un **badge contatore** aggiornato in tempo reale indica quante foto ci sono per ogni sezione.
- Il **login e logout** avvengono nella stessa pagina senza redirect.
- Se la sessione è ancora valida, il login viene saltato automaticamente.

---

## 📂 Struttura File Principale

```text
/
├── index.html                  # Pagina principale (Mappa e Upload)
├── admin.html                  # Dashboard admin con login integrato
├── admin_login.html            # (Deprecato — login ora in admin.html)
├── db.json                     # Database JSON (foto + config PIN + rate limit)
├── DOCUMENTAZIONE_TECNICA.md   # Questo file
├── css/style.css               # Design system e stili
├── js/
│   ├── app.js                  # Logica frontend utente & Preview
│   ├── admin.js                # Logica admin, login overlay e moderazione
│   └── config.js               # URL API (auto-detect locale/produzione)
├── api/                        # Script PHP (legacy, non utilizzati in locale)
├── assets/
│   ├── logo_azzurro_01.svg     # Logo principale
│   └── watermark.png           # Watermark mappa
├── uploads/                    # Immagini caricate dagli utenti
└── server/
    ├── server.js               # Server Express (API + static serving)
    ├── package.json            # Dipendenze Node.js
    └── node_modules/           # Dipendenze installate
```

---

## ⚙ Requisiti e Installazione (Locale)

1. **Prerequisiti**: Node.js 16+ installato.
2. **Installazione dipendenze**:
   ```bash
   cd server
   npm install
   ```
3. **Avvio server**:
   ```bash
   node server.js
   ```
4. **Accesso**: Aprire il browser su `http://localhost:3000`
5. **Admin**: `http://localhost:3000/admin.html` → PIN: `101516`

### Dipendenze Node.js
| Pacchetto | Versione | Uso |
|---|---|---|
| `express` | ^4.18.2 | Server HTTP e routing |
| `multer` | ^1.4.5-lts.1 | Gestione upload file |
| `express-session` | ^1.17.3 | Sessioni admin |
| `cors` | ^2.8.5 | Gestione CORS |

---

## ⚠️ Note Tecniche Importanti

1. **Ordine middleware Express**: Le route API (`/api/*`) devono essere registrate **prima** di `express.static`. In caso contrario, i file PHP nella cartella `api/` vengono serviti come testo grezzo, causando errori di parsing JSON sul client.

2. **`credentials: 'include'`**: Tutte le chiamate `fetch` verso le API admin devono includere questa opzione per trasmettere il cookie di sessione.

3. **PIN di default**: Cambiare il PIN `101516` dopo il primo accesso tramite il pulsante "Cambia PIN" nella dashboard.

4. **Cartella `api/`**: Contiene script PHP legacy non utilizzati in ambiente locale Node.js. In produzione con server PHP, possono sostituire il `server.js`.

---

*Ultimo aggiornamento: 11 Maggio 2026*
