// Ohjelmat (speksi 6.3, 4f): ohjelmakortit, ohjelman sisältö (päivät ja liikkeet, ▶ Näytä liike)
// ja "Ota käyttöön", joka asettaa aktiivinenOhjelmaId:n. Sisältö: #/ohjelmat?id=<ohjelmaId>.
import { getState, update } from '../store.js?v=270067f';
import { OHJELMAT, liike as haeLiike } from '../data.js?v=270067f';
import { el, svgEl, sectionTitle } from './ui.js?v=270067f';
import { openExerciseSheet } from './media.js?v=270067f';

// Natiivi append ei litistä taulukoita eikä ohita null-arvoja, joten ne käsitellään tässä.
function lisaa(root, ...osat) {
  root.append(...osat.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false));
}

const iso = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

// Näkyy ohjelmasivulla seuraavan piirron ajan "Ota käyttöön" -painalluksen jälkeen.
let juuriOtettu = null;

function chevron() {
  return svgEl('svg', { class: 'chevron', viewBox: '0 0 8 14', width: 8, height: 14, 'aria-hidden': 'true' },
    svgEl('path', { d: 'M1.5 1.5 6.5 7l-5 5.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

function playIkoni() {
  return svgEl('svg', { viewBox: '0 0 24 24', width: 14, height: 14, 'aria-hidden': 'true' },
    svgEl('path', { d: 'M8 5.5v13l10.5-6.5z', fill: 'currentColor' }));
}

function liikkeita(ohjelma) {
  return new Set(ohjelma.paivat.flatMap((p) => p.liikkeet.map((r) => r.liikeId))).size;
}

// Arvioitu treenin kesto: sarjat × (palautus + noin 45 s työtä), pyöristettynä 5 minuuttiin.
function keskikesto(ohjelma) {
  const sekunnit = ohjelma.paivat.map((p) => p.liikkeet.reduce((s, r) => s + r.sarjat * (r.palautusS + 45), 0));
  const ka = sekunnit.reduce((a, b) => a + b, 0) / Math.max(1, sekunnit.length);
  return Math.round(ka / 60 / 5) * 5;
}

function suositeltu(profiili) {
  const n = Number(profiili && profiili.treenitViikossa);
  if (!Number.isFinite(n)) return null;
  if (n <= 3) return 'koko-kroppa-3';
  if (n === 4) return 'yla-ala-4';
  return 'ppl-6';
}

function lista(root, state) {
  const aktiivinen = state.aktiivinenOhjelmaId;
  const suositus = suositeltu(state.profiili);
  lisaa(root, 
    el('a', { class: 't8-back', href: '#/koti' }, '‹ Koti'),
    el('h1', { class: 'page-title t8-page-title-tight' }, 'Ohjelmat'),
    el('p', { class: 't8-lead' }, 'Valitse runko. Tavoitteesi säätää toistot, sarjat ja palautukset jokaiseen treeniin.'),
    el('div', { class: 't8-programs' }, OHJELMAT.map((o) => {
      const onAktiivinen = o.id === aktiivinen;
      return el('a', { class: `card t8-program${onAktiivinen ? ' is-active' : ''}`, href: `#/ohjelmat?id=${encodeURIComponent(o.id)}` },
        el('div', { class: 't8-program-top' },
          el('span', { class: 't8-pill' }, iso(o.tasot)),
          onAktiivinen ? el('span', { class: 't8-pill t8-pill-accent' }, 'Käytössä') : null,
          !onAktiivinen && suositus === o.id ? el('span', { class: 't8-pill t8-pill-ok' }, 'Suositus sinulle') : null),
        el('div', { class: 't8-program-row' },
          el('div', { class: 't8-program-body' },
            el('h2', { class: 't8-program-title' }, o.nimi),
            el('p', { class: 't8-program-desc' }, o.kuvaus)),
          chevron()),
        el('div', { class: 't8-stats' },
          el('div', { class: 't8-stat' }, el('span', { class: 't8-stat-val' }, String(o.paivat.length)), el('span', { class: 't8-stat-lbl' }, 'päivää')),
          el('div', { class: 't8-stat' }, el('span', { class: 't8-stat-val' }, String(liikkeita(o))), el('span', { class: 't8-stat-lbl' }, 'liikettä')),
          el('div', { class: 't8-stat' }, el('span', { class: 't8-stat-val' }, `~${keskikesto(o)}`), el('span', { class: 't8-stat-lbl' }, 'min / treeni'))));
    })),
  );
}

function liikeRivi(r) {
  const l = haeLiike(r.liikeId);
  const nimi = l ? l.nimi : r.liikeId;
  return el('div', { class: 't8-ex-row' },
    el('a', { class: 't8-ex-row-main', href: `#/liike/${encodeURIComponent(r.liikeId)}` },
      el('span', { class: 't8-ex-row-name' }, nimi),
      el('span', { class: 't8-ex-row-sub' }, `${r.sarjat} × ${r.toistoMin}–${r.toistoMax} · palautus ${r.palautusS} s`)),
    l
      ? el('button', {
        class: 't8-play',
        type: 'button',
        'aria-label': `Näytä liike: ${nimi}`,
        onClick: () => openExerciseSheet(l),
      }, playIkoni(), el('span', { class: 't8-play-text' }, 'Näytä'))
      : null);
}

function sisalto(root, state, ohjelma) {
  const onAktiivinen = state.aktiivinenOhjelmaId === ohjelma.id;
  const naytaKuittaus = juuriOtettu === ohjelma.id && onAktiivinen;
  juuriOtettu = null;
  lisaa(root, 
    el('a', { class: 't8-back', href: '#/ohjelmat' }, '‹ Ohjelmat'),
    el('div', { class: 't8-program-top' },
      el('span', { class: 't8-pill' }, iso(ohjelma.tasot)),
      onAktiivinen ? el('span', { class: 't8-pill t8-pill-accent' }, 'Käytössä') : null),
    el('h1', { class: 'page-title t8-page-title-tight' }, ohjelma.nimi),
    el('p', { class: 't8-lead' }, ohjelma.kuvaus),
    el('div', { class: 'card t8-stats t8-stats-card' },
      el('div', { class: 't8-stat' }, el('span', { class: 't8-stat-val' }, String(ohjelma.paivat.length)), el('span', { class: 't8-stat-lbl' }, 'treeniä / vko')),
      el('div', { class: 't8-stat' }, el('span', { class: 't8-stat-val' }, String(liikkeita(ohjelma))), el('span', { class: 't8-stat-lbl' }, 'liikettä')),
      el('div', { class: 't8-stat' }, el('span', { class: 't8-stat-val' }, iso(ohjelma.tasot)), el('span', { class: 't8-stat-lbl' }, 'taso'))),
    naytaKuittaus
      ? el('div', { class: 'note t8-confirm', role: 'status' },
        el('strong', null, 'Ohjelma otettu käyttöön. '),
        'Kodin seuraava treeni päivittyi. ',
        el('a', { href: '#/koti' }, 'Siirry kotiin'))
      : null,
    ohjelma.paivat.map((p) => [
      sectionTitle(`${p.nimi} · ${p.liikkeet.length} liikettä`),
      el('div', { class: 'list t8-ex-list' }, p.liikkeet.map(liikeRivi)),
    ]),
    el('p', { class: 'muted small t8-footnote' }, 'Sarjat, toistot ja palautukset ovat ohjelman oletuksia (demon oletus). Treeniä aloitettaessa tavoitteesi säätää ne.'),
    onAktiivinen
      ? el('div', { class: 't8-cta' }, el('a', { class: 'btn btn-primary', href: '#/koti' }, 'Käytössä · Siirry kotiin'))
      : el('div', { class: 't8-cta' }, el('button', {
        class: 'btn btn-primary',
        type: 'button',
        onClick: () => {
          juuriOtettu = ohjelma.id;
          update((s) => { s.aktiivinenOhjelmaId = ohjelma.id; });
        },
      }, 'Ota käyttöön')),
  );
}

export function render(root, params = {}) {
  const state = getState() || {};
  const id = params.id;
  if (id) {
    const ohjelma = OHJELMAT.find((o) => o.id === id);
    if (ohjelma) {
      sisalto(root, state, ohjelma);
      return;
    }
    lisaa(root, 
      el('a', { class: 't8-back', href: '#/ohjelmat' }, '‹ Ohjelmat'),
      el('h1', { class: 'page-title' }, 'Ohjelmaa ei löytynyt'),
      el('a', { class: 'btn btn-primary', href: '#/ohjelmat' }, 'Takaisin ohjelmiin'),
    );
    return;
  }
  lista(root, state);
}
