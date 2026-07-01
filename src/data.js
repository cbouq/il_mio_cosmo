// ---------------------------------------------------------------------------
// data.js — carica progetti.json e calcola le posizioni 3D di costellazioni
// (generi) e stelle (progetti) lungo i bracci della galassia a spirale.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mulberry32, hashStr, TWO_PI } from './utils.js';

export const GALAXY_RADIUS = 13000;  // raggio del disco galattico (scala cinematografica)
const ARMS = 4;                       // bracci della spirale
const SPIN = 1.15;                    // quanto si avvolgono i bracci

// Dati minimi di riserva, se il file progetti.json non è raggiungibile
// (per esempio aprendo l'index.html senza server).
const FALLBACK = {
  titoloGalassia: 'La mia Via Lattea',
  costellazioni: [
    {
      id: 'demo', nome: 'Progetti', colore: '#4fa3ff',
      descrizione: 'Dati di esempio. Modifica public/progetti.json.',
      progetti: [
        {
          id: 'p1', nome: 'Progetto Uno', stato: 'completato', anno: 2025,
          coloreStella: '#ffd27f', dimensione: 1.1, descrizione: 'Un progetto di esempio.',
          tecnologie: ['Demo'],
          pianeti: [
            { nome: 'Idea', tipo: 'roccioso', colore: '#c08457', dimensione: 0.7, distanza: 1.0, descrizione: 'Il concetto.' },
            { nome: 'Sviluppo', tipo: 'oceano', colore: '#3da9c9', dimensione: 0.9, distanza: 1.8, descrizione: 'La realizzazione.' }
          ]
        }
      ]
    }
  ]
};

// Carica i dati dal JSON pubblico; in caso di errore usa il fallback.
export async function loadData() {
  try {
    const res = await fetch('./progetti.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data || !Array.isArray(data.costellazioni)) throw new Error('formato non valido');
    return data;
  } catch (e) {
    console.warn('[Via Lattea] progetti.json non caricato, uso i dati di esempio:', e.message);
    return FALLBACK;
  }
}

// Calcola posizioni e collegamenti. Restituisce una struttura "universe".
export function buildUniverse(data) {
  const costellazioni = data.costellazioni || [];
  const n = Math.max(1, costellazioni.length);

  const result = {
    titolo: data.titoloGalassia || 'La mia Via Lattea',
    costellazioni: [],
    stelle: [], // elenco piatto di tutte le stelle (progetti)
  };

  costellazioni.forEach((cost, i) => {
    // Posizione della costellazione lungo un braccio della spirale.
    // I generi sono distribuiti su raggi e angoli molto diversi, così risultano
    // lontanissimi tra loro: l'iperspazio diventa indispensabile.
    const arm = i % ARMS;
    const along = n <= 1 ? 0.5 : i / (n - 1);
    const radius = THREE.MathUtils.lerp(GALAXY_RADIUS * 0.34, GALAXY_RADIUS * 0.95, along);
    const seed = hashStr(cost.id || cost.nome || ('c' + i));
    const rnd = mulberry32(seed);
    // angolo: braccio + avvolgimento a spirale + scostamento per indice
    const armAngle = (arm / ARMS) * TWO_PI + radius / GALAXY_RADIUS * SPIN * TWO_PI + i * 1.4;
    const jitter = (rnd() - 0.5) * 0.12;
    const cx = Math.cos(armAngle + jitter) * radius;
    const cz = Math.sin(armAngle + jitter) * radius;
    const cy = (rnd() - 0.5) * GALAXY_RADIUS * 0.05; // spessore del disco
    const center = new THREE.Vector3(cx, cy, cz);

    const cObj = {
      id: cost.id || 'c' + i,
      nome: cost.nome || 'Costellazione ' + (i + 1),
      colore: cost.colore || '#8fe9ff',
      descrizione: cost.descrizione || '',
      center,
      stelle: [],
      links: [],
    };

    // Stelle (progetti) disposte in un AMMASSO ENORME attorno al centro.
    const progetti = cost.progetti || [];
    const clusterR = 1100 + progetti.length * 260;
    cObj.clusterR = clusterR;
    const placed = [];
    progetti.forEach((prj, j) => {
      const sr = mulberry32(seed + j * 2654435761);
      // Disposizione su un disco perturbato (le costellazioni reali sono ~planari)
      const ang = (j / Math.max(1, progetti.length)) * TWO_PI + sr() * 0.6;
      const dist = clusterR * (0.35 + sr() * 0.65);
      const local = new THREE.Vector3(
        Math.cos(ang) * dist,
        (sr() - 0.5) * clusterR * 0.5,
        Math.sin(ang) * dist
      );
      const pos = center.clone().add(local);
      const star = {
        id: prj.id || (cObj.id + '-' + j),
        nome: prj.nome || 'Progetto ' + (j + 1),
        stato: prj.stato || 'idea',
        anno: prj.anno || null,
        descrizione: prj.descrizione || '',
        tecnologie: prj.tecnologie || [],
        link: prj.link || '',
        coloreStella: prj.coloreStella || cObj.colore,
        dimensione: prj.dimensione || 1.0,
        pianeti: prj.pianeti || [],
        position: pos,
        localAngle: ang,
        costellazione: cObj,
      };
      cObj.stelle.push(star);
      result.stelle.push(star);
      placed.push(star);
    });

    // Collega le stelle in sequenza ordinata per angolo (linee di costellazione).
    const ordered = [...placed].sort((a, b) => a.localAngle - b.localAngle);
    for (let k = 0; k < ordered.length - 1; k++) {
      cObj.links.push([ordered[k].position, ordered[k + 1].position]);
    }
    if (ordered.length > 2) {
      cObj.links.push([ordered[ordered.length - 1].position, ordered[0].position]);
    }

    result.costellazioni.push(cObj);
  });

  return result;
}
