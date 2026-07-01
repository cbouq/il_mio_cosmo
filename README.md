# Dmitry Laurenzi — Portfolio + Esperienza Via Lattea 🌌

Un sito unico in due parti:

1. **Portfolio** (sito principale, 8 pagine statiche): `index.html`, `bio.html`, `portfolio.html`, `lavoro-1/2/3.html`, `contatti.html`, `privacy.html`.
2. **Esperienza Via Lattea** (`esperienza.html`): la galassia 3D navigabile dove i generi sono costellazioni, i progetti sono stelle e ogni stella ha i suoi pianeti. Con buco nero al centro, nebulose e salto nell'iperspazio.

Le due parti sono collegate: dalla home e dal menu si entra nell'**Esperienza**; dentro l'esperienza, il pulsante **← Portfolio** (e il tasto "Apri progetto" sui sistemi stellari) riporta alle pagine del portfolio.

> Tutto vive in questa cartella `via-lattea/`, una **copia indipendente**: la cartella originale non è stata toccata.

## Come avviarlo

Serve [Node.js](https://nodejs.org). Dal terminale, dentro la cartella `via-lattea`:

```bash
npm install      # solo la prima volta (scarica three e vite)
npm run dev      # avvia tutto e apre il browser su http://127.0.0.1:5173
```

- La **home del portfolio** è `index.html` (si apre per prima).
- L'**esperienza 3D** è su `esperienza.html` (link "Esperienza ✦" nel menu).

Le pagine del portfolio sono HTML/CSS/JS puro: si possono anche aprire col doppio click. L'esperienza 3D, invece, ha bisogno del server (`npm run dev`) o della build, perché usa Three.js come modulo.

Per pubblicare online (cartella statica `dist/`):

```bash
npm run build
npm run preview   # per provarla in locale
```

## Struttura

```
via-lattea/
├─ index.html           Home portfolio (hero carousel, estratto bio, form)
├─ bio.html             Storia, formazione, competenze (testo + lightbox)
├─ portfolio.html       Griglia progetti → pagine dettaglio
├─ lavoro-1/2/3.html    Casi studio (carousel + lightbox + CTA)
├─ contatti.html        Mappa, info, form con consenso privacy
├─ privacy.html         Privacy, Termini, Cookie policy
├─ esperienza.html      La Via Lattea 3D (usa src/ e public/progetti.json)
├─ css/style.css        Stile del portfolio (reset, variabili, tipografia, layout, componenti, pagine)
├─ js/site.js           Menu, carousel, lightbox, cookie banner, form (JS puro)
├─ img/*.svg            Immagini vettoriali a tema (cover, hero, profilo, og)
├─ favicon.svg          Favicon personalizzata
├─ cv.pdf               CV (SEGNAPOSTO da sostituire)
├─ src/                 Codice della galassia 3D (three.js)
└─ public/progetti.json I dati della galassia (generi/progetti/pianeti)
```

## Cosa personalizzare (segnaposto)

I contenuti sono di esempio, pensati per essere sostituiti con i tuoi reali:

- **Testi e progetti**: bio, casi studio (Orbital/Nova/Pulsar), recapiti.
- **Immagini**: i file in `img/` sono illustrazioni vettoriali a tema; sostituiscile con foto/render reali (compressi con TinyPNG o Squoosh). Mantieni gli attributi `alt`.
- **`cv.pdf`**: è un PDF segnaposto: sostituiscilo con il tuo CV vero.
- **Recapiti e mappa**: email, telefono, indirizzo e l'`iframe` di Google Maps in `contatti.html`.
- **Social**: i link nel footer puntano alle home dei social: inserisci i tuoi profili.
- **Dominio OG**: i meta `og:image`/`og:url` usano `https://dmitrylaurenzi.it/...`: aggiornali col tuo dominio reale quando pubblichi.
- **La galassia**: modifica `public/progetti.json` per cambiare costellazioni (generi), stelle (progetti) e pianeti.

## Note tecniche (requisiti rispettati)

HTML5 semantico (`header/nav/main/section/article/aside/footer`), CSS solo su file esterni e organizzato in sezioni, JS esterno (menu hamburger, carousel, lightbox, cookie banner con `localStorage`), favicon, design responsive mobile-first (768px / 1024px), SEO on-page (title, description, Open Graph, un solo `<h1>` per pagina, `alt` sulle immagini), header e footer identici su tutte le pagine, link interni funzionanti.

## Comandi dell'esperienza Via Lattea

WASD/frecce per manovrare, mouse (trascina) per orientarti, Shift turbo, Spazio/Ctrl su-giù, click per selezionare. Dalla carta stellare clicca un genere per il salto nell'iperspazio o un progetto per entrare nel suo sistema.

Buona esplorazione! 🚀
