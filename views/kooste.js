// Treenikuukautesi (speksi 4l C, #/kooste?kk=YYYY-MM): kuukauden kooste tarinamuotoisina ruutuina
// koko ruudulla (reitti hideNav). Ruudut tulevat engine/recap.js:n monthRecap-funktiosta; ilman
// kk-parametria näytetään edellinen kuukausi.
//
// Selaus: napautus vasempaan kolmannekseen = edellinen, oikeaan = seuraava; vaakapyyhkäisy; painettuna
// pitäminen pysäyttää (myös välilyönti); nuolinäppäimet; Esc ja X vievät Kotiin. Jokainen ruutu etenee
// automaattisesti noin 5 sekunnissa (edistymispalkin CSS-animaatio). prefers-reduced-motion: ei
// automaattista etenemistä eikä animaatioita.
//
// Viimeisellä ruudulla "Jaa koosteesi" avaa jakokortin (views/jako.js, tyyppi 'kooste'). Avaus merkitsee
// kuukauden nähdyksi (koosteetNahty[kk] = true). Näkymä hoitaa oman päivityksensä (omaPaivitys), jotta
// tilan muutos ei aloita tarinaa alusta.
import { getState, update } from '../store.js?v=19a48e7';
import { tanaanPvm } from '../seed.js?v=19a48e7';
import { monthRecap } from '../engine/recap.js?v=19a48e7';
import { el, svgEl } from './ui.js?v=19a48e7';
import { openShareSheet, jakoIkoni } from './jako.js?v=19a48e7';

export const omaPaivitys = true;
export const RUUDUN_KESTO_MS = 5000;
const TAUSTAT = ['sininen', 'viini', 'kulta'];
const PITO_MS = 250;
const SALAMA = 'M37 6 15 36h14l-4 22 24-31H34z';

// ---------------------------------------------------------------------------
// Puhtaat apurit

function pad(n) {
  return String(n).padStart(2, '0');
}

/** edellinenKuukausi('2026-10-26') → '2026-09'; tammikuussa edellisen vuoden joulukuu. */
export function edellinenKuukausi(tanaan) {
  const [y, m] = String(tanaan).split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
}

/**
 * koosteKuukausi(kk, tanaan) → 'YYYY-MM'
 * Kelvollinen kk-parametri (vuosi 2000–2100, kuukausi 01–12, ei tulevaisuudessa) sellaisenaan, muuten
 * edellinen kuukausi.
 */
export function koosteKuukausi(kk, tanaan) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(kk || ''));
  if (m && Number(m[1]) >= 2000 && Number(m[1]) <= 2100 && Number(m[2]) >= 1 && Number(m[2]) <= 12
    && kk <= String(tanaan).slice(0, 7)) return kk;
  return edellinenKuukausi(tanaan);
}

/** ruudunTausta(i) → 'sininen' | 'viini' | 'kulta' vuorotellen. */
export function ruudunTausta(i) {
  return TAUSTAT[((i % TAUSTAT.length) + TAUSTAT.length) % TAUSTAT.length];
}

/** napautusSuunta(x, leveys) → -1 (vasen kolmannes), 1 (oikea kolmannes) tai 0 (keskikolmannes). */
export function napautusSuunta(x, leveys) {
  if (!(leveys > 0)) return 0;
  if (x < leveys / 3) return -1;
  if (x > (leveys * 2) / 3) return 1;
  return 0;
}

/** pyyhkaisySuunta(dx, dy, kynnys = 50) → 1 (vasemmalle = seuraava), -1 (oikealle = edellinen) tai 0. */
export function pyyhkaisySuunta(dx, dy, kynnys = 50) {
  if (Math.abs(dx) < kynnys || Math.abs(dx) <= Math.abs(dy) * 1.2) return 0;
  return dx < 0 ? 1 : -1;
}

/** seuraavaRuutu(i, suunta, maara) → uusi indeksi rajattuna välille 0 … maara − 1. */
export function seuraavaRuutu(i, suunta, maara) {
  return Math.max(0, Math.min(maara - 1, i + suunta));
}

function desimaali(n) {
  return String(n).replace('.', ',');
}

// ---------------------------------------------------------------------------
// Ruudut

function sulkuIkoni() {
  return svgEl('svg', { viewBox: '0 0 24 24', width: 22, height: 22, 'aria-hidden': 'true' },
    svgEl('path', { d: 'M6 6l12 12M18 6 6 18', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round' }));
}

function lisatiedot(r) {
  if (r.id === 'kuukausi' && r.vertailu) {
    return el('p', { class: 'ks-compare' }, r.vertailu.teksti, ' ', el('span', { class: 'ks-demo' }, 'demo'));
  }
  if (r.id === 'liike' && r.henkiloautot > 0) {
    return el('p', { class: 'ks-fact' }, el('b', null, desimaali(r.henkiloautot)), ' henkilöautoa');
  }
  if (r.id === 'score' && Number.isFinite(r.muutos) && r.muutos !== 0) {
    return el('p', { class: 'ks-fact' }, el('b', null, `${r.muutos > 0 ? '+' : '−'}${Math.abs(r.muutos)}`), ' pistettä kuukaudessa');
  }
  if (r.id === 'haasteet' && (r.haasteet.length || r.merkit.length)) {
    return el('ul', { class: 'ks-chips' },
      ...[...r.haasteet, ...r.merkit].slice(0, 4).map((x) => el('li', null, x.nimi)));
  }
  return null;
}

function ruutu(r, i, recap, onJaa) {
  const viimeinen = i === recap.ruudut.length - 1;
  return el('section', { class: `ks-slide is-${ruudunTausta(i)}`, 'aria-label': `${r.otsikko} (${i + 1}/${recap.ruudut.length})` },
    svgEl('svg', { class: 'ks-bolt', viewBox: '0 0 64 64', 'aria-hidden': 'true' }, svgEl('path', { d: SALAMA })),
    el('div', { class: 'ks-content' },
      el('p', { class: 'ks-kicker' }, i === 0 ? recap.jako.otsikko : r.otsikko),
      i === 0 ? el('h1', { class: 'ks-month' }, recap.otsikko) : null,
      el('p', { class: `ks-iso${String(r.iso).length > 16 ? ' is-long' : ''}` }, r.iso),
      lisatiedot(r),
      el('p', { class: 'ks-text' }, r.teksti),
      viimeinen ? el('div', { class: 'ks-actions' },
        el('button', { class: 'ks-share', type: 'button', onClick: onJaa }, jakoIkoni(20), 'Jaa koosteesi'),
        el('a', { class: 'ks-home', href: '#/koti' }, 'Takaisin kotiin')) : null));
}

// ---------------------------------------------------------------------------
// Näkymä

export function render(root, params = {}) {
  const state = getState() || {};
  const nyt = new Date().toISOString();
  const kk = koosteKuukausi(params.kk, tanaanPvm(nyt));
  const recap = monthRecap(state, kk, nyt);
  const n = recap.ruudut.length;
  const vahenna = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  if (!(state.koosteetNahty && state.koosteetNahty[kk] === true)) {
    update((s) => {
      const nahty = s.koosteetNahty && typeof s.koosteetNahty === 'object' && !Array.isArray(s.koosteetNahty) ? s.koosteetNahty : {};
      s.koosteetNahty = { ...nahty, [kk]: true };
    });
  }

  let i = 0;
  let tauolla = false;
  const palkit = recap.ruudut.map(() => el('span', { class: 'ks-bar' }, el('span', { class: 'ks-bar-fill' })));
  const isanta = el('div', { class: 'ks-host' });
  const ilmoitus = el('p', { class: 'ks-sr', 'aria-live': 'polite' });
  const taukoMerkki = el('span', { class: 'ks-paused', hidden: true }, 'Tauko');
  const kooste = el('div', {
    class: `ks${vahenna ? ' is-static' : ''}`,
    role: 'region',
    'aria-roledescription': 'tarina',
    'aria-label': `Treenikuukautesi: ${recap.otsikko}`,
  },
  el('div', { class: 'ks-stage' },
    isanta,
    el('div', { class: 'ks-top' },
      el('div', { class: 'ks-bars', 'aria-hidden': 'true' }, ...palkit),
      el('div', { class: 'ks-toprow' },
        el('span', { class: 'ks-brand' }, 'Treenikuukautesi'),
        taukoMerkki,
        el('a', { class: 'ks-close', href: '#/koti', 'aria-label': 'Sulje kooste' }, sulkuIkoni()))),
    ilmoitus));

  function asetaTauko(on) {
    tauolla = on;
    kooste.classList.toggle('is-paused', on);
    taukoMerkki.hidden = !on;
  }

  function jaa() {
    asetaTauko(true);
    openShareSheet({ tyyppi: 'kooste', kooste: recap, tila: getState() });
  }

  function nayta(uusi) {
    i = uusi;
    const r = recap.ruudut[i];
    kooste.dataset.tausta = ruudunTausta(i); // yläpalkin värit (kultaisella tumma)
    isanta.replaceChildren(ruutu(r, i, recap, jaa));
    palkit.forEach((p, j) => {
      p.classList.toggle('is-done', j < i);
      p.classList.toggle('is-current', j === i);
      const taytto = p.firstChild;
      taytto.classList.remove('is-run');
      if (j === i && !vahenna) {
        void taytto.offsetWidth; // animaatio alkaa alusta
        taytto.classList.add('is-run');
      }
    });
    ilmoitus.textContent = `Ruutu ${i + 1}/${n}. ${r.otsikko}: ${r.iso}. ${r.teksti}`;
  }

  function siirry(suunta) {
    asetaTauko(false);
    nayta(seuraavaRuutu(i, suunta, n));
  }

  // Automaattinen eteneminen: nykyisen palkin animaatio päättyi.
  kooste.addEventListener('animationend', (e) => {
    if (vahenna || e.animationName !== 'ks-fill' || !e.target.classList.contains('is-run')) return;
    if (i < n - 1) nayta(i + 1);
  });

  // Napautus, pyyhkäisy ja painettuna pitäminen.
  const lava = kooste.querySelector('.ks-stage');
  let alku = null;
  let pitoAjastin = null;
  let pidetty = false;
  const lopetaPito = () => {
    clearTimeout(pitoAjastin);
    pitoAjastin = null;
  };
  lava.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('a, button')) return;
    alku = { x: e.clientX, y: e.clientY };
    pidetty = false;
    lopetaPito();
    pitoAjastin = setTimeout(() => {
      pidetty = true;
      asetaTauko(true);
    }, PITO_MS);
  });
  lava.addEventListener('pointermove', (e) => {
    if (alku && pitoAjastin && Math.hypot(e.clientX - alku.x, e.clientY - alku.y) > 12) lopetaPito();
  });
  lava.addEventListener('pointerup', (e) => {
    if (!alku) return;
    lopetaPito();
    const dx = e.clientX - alku.x;
    const dy = e.clientY - alku.y;
    alku = null;
    const pyyhkaisy = pyyhkaisySuunta(dx, dy);
    if (pyyhkaisy) {
      siirry(pyyhkaisy);
      return;
    }
    if (pidetty) {
      asetaTauko(false);
      return;
    }
    const rect = lava.getBoundingClientRect();
    const suunta = napautusSuunta(e.clientX - rect.left, rect.width);
    if (suunta) siirry(suunta);
  });
  lava.addEventListener('pointercancel', () => {
    lopetaPito();
    if (pidetty) asetaTauko(false);
    alku = null;
  });
  lava.addEventListener('contextmenu', (e) => e.preventDefault());

  const nappain = (e) => {
    if (document.querySelector('.sheet-layer')) return; // jakolaatikko auki: Esc kuuluu sille
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      siirry(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      siirry(-1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      location.hash = '#/koti';
    } else if (e.key === ' ' && !(e.target && e.target.closest && e.target.closest('a, button'))) {
      e.preventDefault();
      asetaTauko(!tauolla);
    }
  };
  document.addEventListener('keydown', nappain);

  root.append(kooste);
  nayta(0);

  return () => {
    document.removeEventListener('keydown', nappain);
    lopetaPito();
  };
}
