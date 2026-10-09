// "Näytä liike" -alalaatikko ja viiden vertailuliikkeen silmukka-animaatiot (speksi 4f).
//
// Median valinta: 1) oma animaatio (media.animaatio), 2) tarkistettu YouTube-upotus
// (media.youtubeId, demossa aina null), 3) YouTube-haku (media.hakusana, aina olemassa).
//
// Animaatiot: jokainen asento lasketaan kinematiikasta (nivelkulmat ja kahden luun IK),
// ja tuloksesta muodostetaan CSS-avainkehykset (translate + rotate jokaiselle luulle).
// Näin animaatio on puhdasta SVG:tä ja CSS:ää, toimii ilman verkkoa ja myös iOS Safarissa.
// prefers-reduced-motion: animaatio ei pyöri, vaan hahmo näytetään tunnistettavassa asennossa.

import { el, svgEl, sheet } from './ui.js?v=270067f';
import { liike as haeLiike } from '../data.js?v=270067f';

const YT_HAKU = 'https://www.youtube.com/results?search_query=';
const YT_UPOTUS = 'https://www.youtube-nocookie.com/embed/';

const LIHAS_NIMI = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

// Hakulinkki: https://www.youtube.com/results?search_query=<URL-koodattu hakusana>
export function youtubeHakuUrl(liike) {
  const sana = (liike && liike.media && liike.media.hakusana) || `${(liike && liike.nimi) || ''} form`;
  return YT_HAKU + encodeURIComponent(sana);
}

function vahennettyLiike() {
  return typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---------------------------------------------------------------------------
// Kinematiikka

const F = 150; // lattian y-koordinaatti (viewBox 0 -12 200 172)
const ASTE = Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const rajaa01 = (t) => Math.min(1, Math.max(0, t));
const pehmea = (t) => t * t * (3 - 2 * t);

// Piste etäisyydellä L kulmassa `kulma` (asteina pystysuorasta ylöspäin, + = eteenpäin/oikealle).
function polar(p, L, kulma) {
  return [p[0] + L * Math.sin(kulma * ASTE), p[1] - L * Math.cos(kulma * ASTE)];
}

// Kulma pystysuorasta (asteina) pisteestä a pisteeseen b.
function kulmaPysty(a, b) {
  return Math.atan2(b[0] - a[0], -(b[1] - a[1])) / ASTE;
}

// Kahden luun IK: nivel (esim. kyynärpää) luiden L1 ja L2 välissä, kun alku S ja pää H
// tunnetaan. puoli (+1/-1) valitsee ratkaisun samalta puolelta koko silmukan ajan.
function ik(S, H, L1, L2, puoli) {
  const dx = H[0] - S[0];
  const dy = H[1] - S[1];
  const d = Math.hypot(dx, dy);
  const dd = Math.min(L1 + L2 - 0.01, Math.max(Math.abs(L1 - L2) + 0.01, d));
  const ux = d ? dx / d : 1;
  const uy = d ? dy / d : 0;
  const a = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  return [S[0] + ux * a - puoli * uy * h, S[1] + uy * a + puoli * ux * h];
}

// Piste pituuden L päässä a:sta kohti b:tä.
function kohti(a, b, L) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [a[0] + ((b[0] - a[0]) / d) * L, a[1] + ((b[1] - a[1]) / d) * L];
}

// Toistosykli: 0 → 1 (meno), pito, 1 → 0 (paluu), pito. Palauttaa edistymän 0–1.
function sykli(t, meno, pito, paluu) {
  if (t < meno) return pehmea(t / meno);
  if (t < meno + pito) return 1;
  if (t < meno + pito + paluu) return 1 - pehmea((t - meno - pito) / paluu);
  return 0;
}

const luu = (p, q, L, w = 6) => ({ k: 'luu', p, q, L, w });
const paa = (p, r = 8) => ({ k: 'pallo', p, r });
const levy = (p, r = 13) => ({ k: 'levy', p, r });

function kasi(S, H, L1, L2, puoli) {
  const E = ik(S, H, L1, L2, puoli);
  return [luu(S, E, L1), luu(E, kohti(E, H, L2), L2)];
}

// Staattiset osat: lattia ja välineet (himmeä väri) sekä liikkumattomat raajat.
const lattia = () => svgEl('line', { x1: 18, y1: F + 1, x2: 182, y2: F + 1, class: 't8-ex-lattia' });
const staattinenLuu = (a, b, w = 6) => svgEl('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 't8-ex-raaja', 'stroke-width': w });

const ANIMAATIOT = {
  // Penkkipunnerrus sivulta: tanko (levy) laskee rinnalle ja punnertuu ylös.
  penkki: {
    nimi: 'Penkkipunnerrus',
    kesto: 3.2,
    perusT: 0,
    staattinen() {
      const lantio = [100, F - 31];
      const polvi = [129, F - 37];
      const nilkka = [134, F - 4];
      return [
        lattia(),
        svgEl('rect', { x: 26, y: F - 26, width: 96, height: 7, rx: 3.5, class: 't8-ex-valine' }),
        svgEl('rect', { x: 36, y: F - 20, width: 5, height: 20, rx: 2, class: 't8-ex-valine' }),
        svgEl('rect', { x: 106, y: F - 20, width: 5, height: 20, rx: 2, class: 't8-ex-valine' }),
        staattinenLuu(lantio, polvi),
        staattinenLuu(polvi, nilkka),
        staattinenLuu([nilkka[0] - 1, F - 2], [nilkka[0] + 11, F - 2], 5),
        staattinenLuu(lantio, [63, F - 32], 10),
        svgEl('circle', { cx: 49, cy: F - 34, r: 8.5, class: 't8-ex-paa-s' }),
      ];
    },
    pose(t) {
      const p = sykli(t, 0.42, 0.06, 0.36);
      const S = [63, F - 34];
      const H = [69, lerp(F - 75, F - 42, p)];
      return [levy(H, 13), ...kasi(S, H, 22, 21, 1)];
    },
  },

  // Takakyykky sivulta: nilkka paikallaan, polvi ja lantio koukistuvat, tanko pysyy jalkaterän päällä.
  kyykky: {
    nimi: 'Takakyykky',
    kesto: 3.4,
    perusT: 0.45,
    staattinen() {
      return [lattia(), staattinenLuu([97, F - 2], [114, F - 2], 5)];
    },
    pose(t) {
      const p = sykli(t, 0.42, 0.06, 0.38);
      const A = [100, F - 4];
      const K = polar(A, 31, lerp(5, 36, p));
      const L = polar(K, 31, lerp(-5, -84, p));
      const tavoiteX = lerp(102, 109, p);
      const s = Math.min(0.9, Math.max(-0.3, (tavoiteX - L[0]) / 38));
      const th = Math.asin(s) / ASTE;
      const S = polar(L, 38, th);
      const u = [Math.sin(th * ASTE), -Math.cos(th * ASTE)];
      const taakse = [-Math.cos(th * ASTE), -Math.sin(th * ASTE)];
      const tanko = [S[0] + taakse[0] * 6, S[1] + taakse[1] * 6];
      const ote = [S[0] + taakse[0] * 5 + u[0] * 2, S[1] + taakse[1] * 5 + u[1] * 2];
      return [
        levy(tanko, 15),
        luu(A, K, 31),
        luu(K, L, 31, 7),
        luu(L, S, 38, 10),
        ...kasi(S, ote, 20, 18, -1),
        paa(polar(S, 14, th * 0.55)),
      ];
    },
  },

  // Maastaveto sivulta: tanko nousee lattialta suoraa linjaa, polvet ojentuvat ensin, lantio perässä.
  maastaveto: {
    nimi: 'Maastaveto',
    kesto: 3.4,
    perusT: 0.2,
    staattinen() {
      return [lattia(), staattinenLuu([97, F - 2], [114, F - 2], 5)];
    },
    pose(t) {
      const p = sykli(t, 0.4, 0.1, 0.38);
      const A = [100, F - 4];
      const jalat = (q) => {
        const K = polar(A, 31, lerp(20, 3, pehmea(rajaa01(q * 1.5))));
        return [K, polar(K, 31, lerp(-68, -2, q))];
      };
      const [K, L] = jalat(p);
      const [, Lyla] = jalat(1);
      const tanko = [lerp(109, Lyla[0] + 3, p), lerp(F - 14, Lyla[1] + 4, p)];
      const S = ik(L, tanko, 38, 42, -1);
      const th = kulmaPysty(L, S);
      return [
        levy(tanko, 14),
        luu(A, K, 31),
        luu(K, L, 31, 7),
        luu(L, S, 38, 10),
        luu(S, kohti(S, tanko, 42), 42),
        paa(polar(S, 14, th * 0.7)),
      ];
    },
  },

  // Leuanveto edestä: kädet tangossa, keho nousee niin, että leuka ylittää tangon.
  leuanveto: {
    nimi: 'Leuanveto',
    kesto: 3.2,
    perusT: 0.45,
    staattinen() {
      return [
        svgEl('line', { x1: 52, y1: 18, x2: 148, y2: 18, class: 't8-ex-valine-viiva', 'stroke-width': 5 }),
        svgEl('rect', { x: 46, y: 12, width: 7, height: 12, rx: 2, class: 't8-ex-valine' }),
        svgEl('rect', { x: 147, y: 12, width: 7, height: 12, rx: 2, class: 't8-ex-valine' }),
      ];
    },
    pose(t) {
      const p = sykli(t, 0.4, 0.1, 0.42);
      const y = lerp(58, 30, p);
      const SV = [86, y];
      const SO = [114, y];
      return [
        luu(SV, SO, 28, 8),
        luu([100, y], [100, y + 36], 36, 10),
        luu([96, y + 36], [94, y + 62], Math.hypot(2, 26), 7),
        luu([94, y + 62], [97, y + 85], Math.hypot(3, 23)),
        luu([104, y + 36], [106, y + 62], Math.hypot(2, 26), 7),
        luu([106, y + 62], [103, y + 85], Math.hypot(3, 23)),
        ...kasi(SV, [76, 18], 22, 21, -1),
        ...kasi(SO, [124, 18], 22, 21, 1),
        paa([100, y - 15], 8.5),
      ];
    },
  },

  // Pystypunnerrus sivulta: tanko etuolkapäiltä suoraan pään yläpuolelle, pää väistää hieman.
  pystypunnerrus: {
    nimi: 'Pystypunnerrus',
    kesto: 3.2,
    perusT: 0.42,
    staattinen() {
      const A = [100, F - 4];
      const K = [101.5, F - 35];
      const L = [100, F - 66];
      return [
        lattia(),
        staattinenLuu([97, F - 2], [114, F - 2], 5),
        staattinenLuu(A, K),
        staattinenLuu(K, L, 7),
        staattinenLuu(L, [100, F - 104], 10),
      ];
    },
    pose(t) {
      const p = sykli(t, 0.38, 0.1, 0.4);
      const S = [100, F - 104];
      const kaari = Math.sin(Math.PI * p);
      const H = [lerp(112, 101, p) + 3 * kaari, lerp(F - 105, F - 145, p)];
      return [
        paa([101 - 4 * kaari, F - 118], 8.5),
        levy(H, 11),
        ...kasi(S, H, 21, 21, 1),
      ];
    },
  },
};

// ---------------------------------------------------------------------------
// Animaation piirto

const NAYTTEITA = 36;
const f2 = (n) => (Math.round(n * 100) / 100).toString();

function muunnos(osa) {
  const a = osa.k === 'luu' ? Math.atan2(osa.q[1] - osa.p[1], osa.q[0] - osa.p[0]) / ASTE : 0;
  return { x: osa.p[0], y: osa.p[1], a };
}

function osaElementti(osa) {
  if (osa.k === 'luu') {
    return svgEl('line', { x1: 0, y1: 0, x2: f2(osa.L), y2: 0, class: 't8-ex-raaja', 'stroke-width': osa.w });
  }
  if (osa.k === 'pallo') return svgEl('circle', { cx: 0, cy: 0, r: osa.r, class: 't8-ex-paa-s' });
  return svgEl('g', null,
    svgEl('circle', { cx: 0, cy: 0, r: osa.r, class: 't8-ex-levy' }),
    svgEl('circle', { cx: 0, cy: 0, r: Math.max(2.5, osa.r * 0.26), class: 't8-ex-napa' }));
}

// Luo animaation avainkehykset kerran dokumentin <head>-osaan.
function varmistaTyylit(nimi, spec) {
  const id = `t8-ex-tyyli-${nimi}`;
  if (document.getElementById(id)) return;
  const kehykset = [];
  for (let k = 0; k <= NAYTTEITA; k += 1) {
    const osat = spec.pose(k / NAYTTEITA);
    osat.forEach((osa, i) => {
      const m = muunnos(osa);
      const lista = kehykset[i] || (kehykset[i] = []);
      const edellinen = lista[lista.length - 1];
      if (edellinen) {
        while (m.a - edellinen.a > 180) m.a -= 360;
        while (m.a - edellinen.a < -180) m.a += 360;
      }
      lista.push(m);
    });
  }
  const css = kehykset.map((lista, i) => {
    const nimiI = `t8x-${nimi}-${i}`;
    const avaimet = lista.map((m, k) => `${f2((k / NAYTTEITA) * 100)}%{transform:translate(${f2(m.x)}px,${f2(m.y)}px) rotate(${f2(m.a)}deg)}`).join('');
    return `@keyframes ${nimiI}{${avaimet}}.${nimiI}{animation:${nimiI} ${spec.kesto}s linear infinite}`;
  }).join('\n');
  document.head.append(el('style', { id }, css));
}

function animaatioSvg(nimi) {
  const spec = ANIMAATIOT[nimi];
  varmistaTyylit(nimi, spec);
  const svg = svgEl('svg', {
    class: 't8-ex-svg',
    viewBox: '0 -12 200 172',
    preserveAspectRatio: 'xMidYMid meet',
    'aria-hidden': 'true',
  });
  svg.append(...spec.staattinen());
  spec.pose(spec.perusT).forEach((osa, i) => {
    const node = osaElementti(osa);
    const m = muunnos(osa);
    node.setAttribute('transform', `translate(${f2(m.x)} ${f2(m.y)}) rotate(${f2(m.a)})`);
    node.classList.add('t8-ex-osa', `t8x-${nimi}-${i}`);
    svg.append(node);
  });
  return svg;
}

function playIkoni(koko = 18) {
  return svgEl('svg', { viewBox: '0 0 24 24', width: koko, height: koko, 'aria-hidden': 'true' },
    svgEl('path', { d: 'M8 5.5v13l10.5-6.5z', fill: 'currentColor' }));
}

function taukoIkoni() {
  return svgEl('svg', { viewBox: '0 0 24 24', width: 16, height: 16, 'aria-hidden': 'true' },
    svgEl('path', { d: 'M8 5.5v13M16 5.5v13', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' }));
}

function ulkoIkoni() {
  return svgEl('svg', { viewBox: '0 0 24 24', width: 16, height: 16, 'aria-hidden': 'true' },
    svgEl('path', { d: 'M14 4.5h5.5V10M19.5 4.5 11 13M17.5 14v4.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V8A1.5 1.5 0 0 1 6 6.5h4.5', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }));
}

function animaatioLava(liike) {
  const nimi = liike.media.animaatio;
  const reduce = vahennettyLiike();
  const lava = el('div', {
    class: 't8-ex-stage',
    role: 'img',
    'aria-label': `Animaatio: ${liike.nimi}`,
  }, animaatioSvg(nimi));
  lava.append(el('span', { class: 't8-ex-badge' }, reduce ? 'Kuva' : 'Animaatio'));
  if (reduce) {
    lava.append(el('span', { class: 't8-ex-reduce' }, 'Animaatio pysäytetty laitteen asetuksen mukaan'));
  } else {
    const nappi = el('button', { class: 't8-ex-pause', type: 'button', 'aria-label': 'Pysäytä animaatio' }, taukoIkoni());
    nappi.addEventListener('click', (e) => {
      e.stopPropagation();
      const tauolla = lava.classList.toggle('is-paused');
      nappi.replaceChildren(tauolla ? playIkoni(16) : taukoIkoni());
      nappi.setAttribute('aria-label', tauolla ? 'Jatka animaatiota' : 'Pysäytä animaatio');
    });
    lava.append(nappi);
  }
  return lava;
}

function upotusLava(liike) {
  const id = liike.media.youtubeId;
  const iframe = el('iframe', {
    class: 't8-ex-iframe',
    title: `Esimerkkivideo: ${liike.nimi}`,
    loading: 'lazy',
    allow: 'encrypted-media; picture-in-picture',
    allowfullscreen: true,
    referrerpolicy: 'strict-origin-when-cross-origin',
  });
  iframe.setAttribute('src', YT_UPOTUS + encodeURIComponent(id));
  return el('div', { class: 't8-ex-stage t8-ex-stage-video' }, iframe);
}

function hakuLava(liike) {
  return el('a', {
    class: 't8-ex-stage t8-ex-stage-haku',
    href: youtubeHakuUrl(liike),
    target: '_blank',
    rel: 'noopener',
    'aria-label': `Katso esimerkkejä YouTubesta: ${liike.nimi}`,
  },
  el('span', { class: 't8-ex-play' }, playIkoni(30)),
  el('span', { class: 't8-ex-haku-title' }, 'Esimerkkivideo'),
  el('span', { class: 't8-ex-haku-sub' }, 'Avautuu YouTube-hakuun uudessa välilehdessä'));
}

// Liikkeen media-alue (animaatio, tarkistettu upotus tai hakulinkki). Käytetään myös liikkeen sivulla.
export function exerciseMedia(liike) {
  const m = (liike && liike.media) || {};
  if (m.animaatio && ANIMAATIOT[m.animaatio]) return animaatioLava(liike);
  if (typeof m.youtubeId === 'string' && /^[\w-]{11}$/.test(m.youtubeId)) return upotusLava(liike);
  return hakuLava(liike);
}

export function youtubeLinkki(liike, { teksti = 'Katso esimerkkejä YouTubesta' } = {}) {
  return el('a', {
    class: 'btn t8-yt-btn',
    href: youtubeHakuUrl(liike),
    target: '_blank',
    rel: 'noopener',
  }, teksti, ulkoIkoni());
}

// "▶ Näytä liike" -alalaatikko: media, ohje ja lihasryhmät. Hyväksyy liikeolion tai id:n.
export function openExerciseSheet(liikeTaiId) {
  const liike = typeof liikeTaiId === 'string' ? haeLiike(liikeTaiId) : liikeTaiId;
  if (!liike) return null;
  const toissijaiset = (liike.toissijaiset || []).map(LIHAS_NIMI);
  const sisalto = el('div', { class: 't8-media' },
    el('h2', { class: 'sheet-title' }, liike.nimi),
    exerciseMedia(liike),
    el('div', { class: 't8-media-actions' }, youtubeLinkki(liike)),
    el('p', { class: 't8-media-ohje' }, liike.ohje),
    el('div', { class: 't8-media-lihakset' },
      el('div', { class: 't8-media-lihas' },
        el('span', { class: 't8-eyebrow' }, 'Päälihasryhmä'),
        el('span', { class: 'chip is-active t8-chip-static' }, LIHAS_NIMI(liike.lihasryhma))),
      toissijaiset.length
        ? el('div', { class: 't8-media-lihas' },
          el('span', { class: 't8-eyebrow' }, 'Toissijaiset'),
          el('div', { class: 'chips' }, toissijaiset.map((n) => el('span', { class: 'chip t8-chip-static' }, n))))
        : null),
    el('p', { class: 't8-media-note' }, 'Tuotteessa Personal SuperPowerin omat tai lisensoidut liikevideot.'),
  );
  return sheet(sisalto);
}
