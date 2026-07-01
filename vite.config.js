import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Sito multi-pagina: il portfolio (index + pagine) e l'esperienza Via Lattea
// (esperienza.html) vivono nello stesso progetto.
// `base: './'` mantiene i percorsi relativi, così la build in dist/ funziona
// anche aprendo i file localmente o su qualsiasi hosting statico.
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', open: true },
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        bio: resolve(__dirname, 'bio.html'),
        portfolio: resolve(__dirname, 'portfolio.html'),
        lavoro1: resolve(__dirname, 'lavoro-1.html'),
        lavoro2: resolve(__dirname, 'lavoro-2.html'),
        lavoro3: resolve(__dirname, 'lavoro-3.html'),
        contatti: resolve(__dirname, 'contatti.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        esperienza: resolve(__dirname, 'esperienza.html'),
      },
    },
  },
});
