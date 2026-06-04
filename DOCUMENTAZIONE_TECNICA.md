# Documentazione Tecnica: MIRAMARADONA

**MIRAMARADONA** è un'applicazione web interattiva che permette agli utenti di caricare fotografie geolocalizzate, visualizzandole su una mappa di Napoli. Il sistema include un'area di moderazione integrata nella dashboard admin per gestire l'approvazione delle foto prima della pubblicazione.

---

## 🚀 Architettura del Progetto

Il progetto segue una struttura **Client-Server** con backend Node.js:

### 🎨 Frontend (HTML/CSS/JS)
- **Mappa**: Basata su [Leaflet.js](https://leafletjs.com/) con tile map di CartoDB (stile Voyager). Avvio centrato su Napoli con zoom ravvicinato (livello 15) per mostrare subito il dettaglio delle strade.
- **Icone**: Utilizzo della libreria **Lucide Icons** (stile outline) per un'interfaccia minimalista e moderna.
- **Design System**: Estetica premium basata su una palette colori sofisticata: **Deep Carbon (#202020)** per la struttura, **Napoli Azure (#8dc5d9)** per gli accenti. Utilizzo di **Sidebar destra** e **Marker personalizzati** da 70px.
- **Marker & Cluster**: Tutti i punti di interesse e i cluster sono rappresentati da pin circolari celesti di **70px**. I numeri (conteggio foto) sono visualizzati in bianco e perfettamente centrati all'interno del cerchio azzurro.
- **Clustering Ibrido**: 
    - **Posizioni Identiche**: Foto con coordinate GPS esatte vengono raggruppate in un unico marker che apre un **Carousel (stile Booking)** per scorrere le immagini.
    - **Posizioni Vicine**: Marker in zone limitrofe vengono raggruppati in cluster che utilizzano l'espansione (**Spiderfy**) per mostrare i singoli punti al clic.
- **Filtri Mappa Multipli**: Barra filtri orizzontale posta in alto, con logica di selezione multipla (Graffiti, Stencil, Affissione, Sticker, Mosaico). Sia la barra che i pulsanti presentano un design squadrato (`border-radius: 0`) e il colore del testo diventa azzurro al passaggio del mouse o quando sono attivi.
- **Internazionalizzazione (i18n)**: Supporto bilingue (Italiano/Inglese) gestito lato client tramite dizionario in `app.js`. La lingua si cambia istantaneamente tramite l'apposito pulsante (FAB) in basso a destra.
- **Metadati & Geocoding Intelligente**: Estrazione GPS via `EXIF.js` e Reverse Geocoding avanzato via `Nominatim` per risolvere piazze, vie, quartieri e numeri civici, che vengono poi mostrati direttamente nei popup della mappa al posto delle coordinate grezze.

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

- Ogni card mostra: anteprima foto, badge di stato, categoria, e l'indirizzo dettagliato (via reverse geocoding Nominatim). Le coordinate GPS grezze sono state sostituite dalla dicitura dell'indirizzo esatto per una migliore leggibilità.
- Un **badge contatore** aggiornato in tempo reale indica quante foto ci sono per ogni sezione.
- Il **login e logout** avvengono nella stessa pagina senza redirect.
- Se la sessione è ancora valida, il login viene saltato automaticamente.

---

## 🎨 Brand Identity

Questa sezione documenta il sistema visivo ufficiale di **MIRAMARADONA**, derivato dai materiali nella cartella `BRAND IDENTITY/`.

### 🖋 Tipografia

Il brand utilizza due typeface principali:

| Ruolo | Font | Formato | Note |
|---|---|---|---|
| **Display / Titoli** | **ITC Gorilla Regular** | `.otf` | Font caratterizzante per headline e logotipo testuale |
| **Corpo / UI** | **Manrope** | Variable font (`.zip`) | Font moderno variable per testi, UI e label |

> I file originali si trovano in `BRAND IDENTITY/Brand identity/Font/`.

---

### 🔷 Logo

Il logo di MIRAMARADONA è disponibile in più varianti cromatiche e formati. Il file master in formato vettoriale è:

**`BRAND IDENTITY/Brand identity/LOGO DEFINITIVO/LOGO MIRAMARADONA DEFINITIVO.ai`**

#### Varianti Ufficiali del Logo (LOGO DEFINITIVO)

Ogni variante è disponibile in 3 versioni (`_01`, `_02`, `_03`) in formato **SVG**:

| Variante | Colore sfondo | Colore testo | File |
|---|---|---|---|
| **Azzurro** *(principale)* | `#8dc5d9` — Napoli Azure | `#ffffff` — Bianco | `blue_logo/blue_logo_0[1-3].svg` |
| **Giallo** | `#ffd15b` — Giallo Maradona | `#ffffff` — Bianco | `yellow/yellow_logo_0[1-3].svg` |
| **Nero** *(positivo)* | `#000000` — Nero | `#ffffff` — Bianco | `black/black_logo_0[1-3].svg` |
| **Bianco** *(negativo)* | `#ffffff` — Bianco | `#000000` — Nero | `white_logo/white_logo_0[1-3].svg` |

#### Set Logo Completo (cartella `Logo/`)

Versioni aggiuntive disponibili in **SVG** e **PNG** con le seguenti denominazioni:

- `logo_azzurro_01/02/03` — Variante celeste principale
- `logo_giallo_01/02/03` — Variante gialla
- `logo_positivo_01/02/03` — Logo positivo (scuro su chiaro)
- `logo_negativo_01/02/03` — Logo negativo (chiaro su scuro)
- `logo.png` — Logo base semplificato

> Il logo da usare nel sito è **`assets/logo_azzurro_01.svg`** (già integrato nel progetto).

#### Applicazioni del Brand

La cartella `BRAND IDENTITY/Brand identity/applicazioni/` contiene mockup dimostrativi:

- **Stickers** — `Mockup stickers.png`
- **Tote bag (bianca)** — `mock up tote bag.png`
- **Tote bag (celeste)** — `mock up tote bag celeste.png`
- **Composizioni grafiche** — 4 immagini generate (Marzo 2026)
- **Campagna visiva** — `Senza titolo-2.png` (composizione completa)

---

## 🎨 Color Palette

La palette ufficiale di MIRAMARADONA è documentata in `COLOR PALETTE/Color palette/` (file `palette maradroga.pdf` e `Tavola disegno 2.jpg`).

I colori ufficiali estratti dai file SVG del logo sono:

### Colori Primari

| Nome | HEX | Uso |
|---|---|---|
| **Napoli Azure** | `#8dc5d9` | Colore primario — sfondo logo principale, marker mappa, accenti UI |
| **Bianco** | `#ffffff` | Colore secondario — testo su sfondo azzurro o nero |
| **Nero** | `#000000` | Colore terziario — sfondo logo versione positiva |

### Colori di Accento

| Nome | HEX | Uso |
|---|---|---|
| **Giallo Maradona** | `#ffd15b` | Accento caldo — variante logo gialla, highlights |

### Colori Sistema (UI)

| Nome | HEX | Uso |
|---|---|---|
| **Deep Carbon** | `#202020` | Sfondo principale dell'interfaccia web |
| **Napoli Azure** | `#8dc5d9` | Accenti, marker, bordi attivi, badge |

### Riferimento CSS

```css
:root {
  /* Brand Colors */
  --color-napoli-azure:   #8dc5d9;  /* Primario */
  --color-giallo-maradona: #ffd15b; /* Accento */
  --color-white:          #ffffff;
  --color-black:          #000000;

  /* UI Colors */
  --color-deep-carbon:    #202020;  /* Sfondo UI */
  --color-accent:         #8dc5d9;  /* = Napoli Azure */
}
```

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

*Ultimo aggiornamento: Giugno 2026*
