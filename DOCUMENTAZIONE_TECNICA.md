# Documentazione Tecnica: MIRAMARADONA

**MIRAMARADONA** è un'applicazione web interattiva che permette agli utenti di caricare fotografie geolocalizzate, visualizzandole su una mappa di Napoli. Il sistema include un'area di moderazione integrata nella dashboard admin per gestire l'approvazione delle foto prima della pubblicazione.

---

## 🚀 Architettura del Progetto

Il progetto segue una struttura **Client-Server** con backend Node.js:

### 🎨 Frontend (HTML/CSS/JS)
- **Mappa**: Basata su [Leaflet.js](https://leafletjs.com/) con tile map di CartoDB (stile Voyager).
- **Icone**: Utilizzo della libreria **Lucide Icons** (stile outline) per un'interfaccia minimalista e moderna.
- **Design System**: Estetica premium basata su una palette colori sofisticata: **Deep Carbon (#202020)** per la struttura, **Napoli Azure (#8dc5d9)** per gli accenti. Utilizzo di **Sidebar destra** e **Marker personalizzati** da 70px.
- **Marker & Cluster**: Tutti i punti di interesse e i cluster sono rappresentati da pin circolari celesti di **70px**. I numeri (conteggio foto) sono visualizzati in bianco e perfettamente centrati all'interno del cerchio azzurro.
- **Clustering Ibrido**: 
    - **Posizioni Identiche**: Foto con coordinate GPS esatte vengono raggruppate in un unico marker che apre un **Carousel (stile Booking)** per scorrere le immagini.
    - **Posizioni Vicine**: Marker in zone limitrofe vengono raggruppati in cluster che utilizzano l'espansione (**Spiderfy**) per mostrare i singoli punti al clic.
- **Filtri Mappa Multipli**: Barra filtri orizzontale posta in alto, con logica di selezione multipla (Graffiti, Stencil, Affissione, Sticker, Mosaico). Se nessun filtro è attivo, vengono visualizzati tutti i marker.
- **Internazionalizzazione (i18n)**: Supporto bilingue (Italiano/Inglese) gestito lato client tramite dizionario in `app.js`. La lingua si cambia istantaneamente tramite l'apposito pulsante (FAB) in basso a destra.
- **Metadati & Geocoding**: Estrazione GPS via `EXIF.js` e Reverse Geocoding via `Nominatim` per visualizzare l'indirizzo nel popup.

### ⚙ Backend (Node.js / Express)
- **Server**: Express.js in esecuzione su `localhost:3000` (sviluppo locale).
- **Database**: File JSON (`db.json`), scelto per semplicità e portabilità senza dipendenze esterne.
- **Schema**: Array `photos` con campi per coordinate, URL, categoria e stato. Oggetto `config` per il PIN hash. Oggetto `rate_limit` per il blocco temporaneo dopo tentativi falliti.
- **Stato Foto**: `0 = Pendente`, `1 = Approvata`.
- **Upload**: Gestione dei file tramite `multer` con sanificazione automatica dei nomi.
- **⚠️ Ordine middleware critico**: Le route API devono essere definite **prima** del middleware `express.static`, altrimenti i file PHP nella cartella `api/` vengono serviti come testo grezzo, impedendo il corretto funzionamento delle API.

---

## 🛠 Funzionamento Utente (Mappa)

1. **Attivazione Upload**: L'utente clicca sul pulsante flottante (FAB) della fotocamera. Si apre immediatamente il selettore file del sistema operativo.
2. **Selezione Multipla & Categorie**: Il sistema analizza i metadati EXIF. Le foto possono essere categorizzate in: *Graffito, Stencil, Affissione, Sticker, Mosaico*.
3. **Analisi GPS & Fallback**: Se una o più foto mancano di coordinate, viene mostrato un messaggio nella sidebar che propone di applicare la posizione attuale dell'utente.
4. **Filtri & Navigazione**: Sulla mappa, i marker si riorganizzano in base ai filtri attivi in alto. Il sistema multilingua aggiorna dinamicamente anche i popup, le allerte e i filtri se cambiato tramite l'apposito pulsante.
5. **Visualizzazione Mappa**: 
    - Se più foto hanno lo stesso punto GPS: un unico marker apre un **popup carousel**.
    - Se le foto sono vicine: i cluster si espandono a raggiera (**spiderfy**) per mostrare ogni pin.
    - Ogni popup include indirizzo, categoria e link a **Google Maps**.
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

*Ultimo aggiornamento: 28 Maggio 2026*
