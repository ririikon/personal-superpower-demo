// Yhteisö (speksi 4i): haasteet, merkit ja kaverit. Kolme välilehteä segmenttivalitsimella
// (#/yhteiso?tab=haasteet|merkit|kaverit) ja haasteen tiedot (#/yhteiso/haaste/<id>).
// Laskenta on engine/challenges.js:ssä; tämä moduuli vain piirtää ja tallentaa käyttäjän valinnat
// (liittyminen, poistuminen, oma kaverihaaste, tsempit ja lunastetut edut) yhteiso-osioon.
//
// Kaikki sosiaalinen data on keksittyä. Oma edistyminen lasketaan oikeista kirjauksista.
//
// Muut näkymät käyttävät tämän moduulin apureita: palkki, mittariArvo, edistysTeksti, kisaNimi,
// merkkiKuusikulmio (Koti, treenin yhteenveto).
import { getState, update } from '../store.js?v=31a36ec';
import { tanaanPvm } from '../seed.js?v=31a36ec';
import { challengeProgress, leaderboard, pointsAndLevel, badges, feed, PISTE_ERITTELY_NIMET } from '../engine/challenges.js?v=31a36ec';
import { addDays } from '../engine/util.js?v=31a36ec';
import {
  createInvite, encodeInvite, simulateInviteStep, KUTSU_MITTARIT, KUTSU_PISTEET, KUTSU_TILAT,
} from '../engine/invite.js?v=31a36ec';
import { el, svgEl, sectionTitle, sheet, whyButton, segmented, toggle, hexRing } from './ui.js?v=31a36ec';
import { kopioiLeikepoydalle } from './jako.js?v=31a36ec';

const VKP = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
const VALILEHDET = [
  { arvo: 'haasteet', teksti: 'Haasteet' },
  { arvo: 'merkit', teksti: 'Merkit' },
  { arvo: 'kaverit', teksti: 'Kaverit' },
];
const TYYPPI_NIMI = { oma: 'Oma haaste', kaveri: 'Kaverihaaste', sali: 'Salihaaste', kumppani: 'Kumppanihaaste' };
const LUOTAVAT_MITTARIT = [
  { arvo: 'treenit', teksti: 'Treenit' },
  { arvo: 'sarjat', teksti: 'Sarjat' },
  { arvo: 'volyymi', teksti: 'Volyymi' },
  { arvo: 'aktiivisetPaivat', teksti: 'Aktiiviset päivät' },
];
const KISA_NIMI = {
  treenit: 'Treenikisa', sarjat: 'Sarjakisa', volyymi: 'Volyymikisa', aktiivisetPaivat: 'Aktiivisuuskisa', putki: 'Putkikisa',
};
const PROFIILI_NIMI = { aloittelija: 'Aloittelija', keskitaso: 'Keskitaso', kokenut: 'Kokenut' };
const KOODI_OLETUS = 'PSP-DEMO-25';

const TASAPAINOTUS_SELITYS = 'Raakana verrataan suoria lukuja, jolloin kokenut treenaaja voittaa lähes aina.\n\n'
  + 'Tasapainotettuna jokaisen tulos suhteutetaan omaan lähtötasoon: haasteen ajan tulos jaettuna omalla '
  + 'keskiarvolla vastaavan pituiselta jaksolta neljän edellisen viikon ajalta. Näin aloittelija ja kokenut '
  + 'kilpailevat tasavertaisesti: kärjessä on se, joka ylittää oman tasonsa eniten.\n\n'
  + 'Demossa kavereiden lähtötasot ja tulokset ovat keksittyjä. Oma lähtötasosi lasketaan treenihistoriastasi.';
const PISTE_SELITYS = 'Pisteitä kertyy jokaisesta voimatreenistä (10), tuodusta aktiviteetista (3), suoritetusta '
  + 'haasteesta (haasteen palkinto, yleensä 50–100), ansaitusta merkistä (20) ja kaverikutsusta, '
  + 'kun kaveri tekee ensimmäisen treeninsä (100).\n\n'
  + 'Taso n vaatii yhteensä 100 × n × (n + 1) / 2 pistettä, joten jokainen taso on hieman edellistä pidempi.';

// Merkkien täyttövärit (kuten Historian merkkipaaluissa) ja kultaisten merkkien tumma ikoni.
const MERKKI_VARIT = {
  'eka-treeni': 'var(--accent)',
  'treenit-10': 'var(--ok)',
  'treenit-50': 'var(--cta)',
  'treenit-100': 'var(--score)',
  'eka-ennatys': 'var(--score)',
  'putki-4-viikkoa': 'var(--fatigue)',
  'volyymi-10000': 'var(--hero)',
  'kuukauden-haaste': 'var(--accent)',
  'eka-kaverihaaste': 'var(--cta)',
  'voitettu-kaverihaaste': 'var(--score)',
  kumppanihaaste: 'var(--ok)',
  treenikaveri: 'var(--score)',
};
const MERKKI_MUSTE = {
  'treenit-100': 'var(--on-score)',
  'eka-ennatys': 'var(--on-score)',
  'voitettu-kaverihaaste': 'var(--on-score)',
  treenikaveri: 'var(--on-score)',
};
const PREMIUM_TEKSTI = 'Tuotteessa: kuukausi Premiumia jokaisesta kaverista, joka tekee ensimmäisen treeninsä.';
const KUTSU_TILA_NIMI = { lähetetty: 'Lähetetty', hyväksytty: 'Hyväksytty', treenannut: 'Treenannut' };

const KUVAKKEET = {
  star: ['M12 4.5l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5L4.8 9.7l5-.6z'],
  dumbbell: ['M5 9v6', 'M8 7v10', 'M16 7v10', 'M19 9v6', 'M8 12h8'],
  medal: ['M8.5 3.5l2 5', 'M15.5 3.5l-2 5', 'M12 20a5 5 0 1 0 0-10 5 5 0 0 0 0 10z'],
  crown: ['M5 17l-1-9 4.5 3.5L12 6l3.5 5.5L20 8l-1 9z'],
  trophy: ['M8 4h8v5a4 4 0 0 1-8 0z', 'M8 6H5a3 3 0 0 0 3 4', 'M16 6h3a3 3 0 0 1-3 4', 'M12 13v4', 'M8.5 20h7'],
  flame: ['M12 20c-3.3 0-5.5-2.2-5.5-5.2 0-3 2.5-4.6 3.3-7.8 2 1.3 2.6 3.2 2.4 4.8 1-.6 1.8-1.8 2-3 1.8 1.7 3.3 3.6 3.3 6 0 3-2.2 5.2-5.5 5.2z'],
  weight: ['M9 8a3 3 0 1 1 6 0', 'M7.5 9h9l1.5 10h-12z'],
  calendar: ['M5.5 5.5h13a1.5 1.5 0 0 1 1.5 1.5v11.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5V7a1.5 1.5 0 0 1 1.5-1.5z', 'M4 10h16', 'M8.5 3.5v4', 'M15.5 3.5v4'],
  users: ['M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M2.5 20a6.5 6.5 0 0 1 13 0', 'M15.5 4.3a3.5 3.5 0 0 1 0 6.4', 'M17.5 13.6a6.5 6.5 0 0 1 4 6.4'],
  gift: ['M4.5 10.5h15v9.5h-15z', 'M3.5 7h17v3.5h-17z', 'M12 7v13', 'M12 7C10.5 3.5 6.5 3.5 6.5 5.5S10 7 12 7z', 'M12 7c1.5-3.5 5.5-3.5 5.5-1.5S14 7 12 7z'],
  list: ['M8.5 6.5h11', 'M8.5 12h11', 'M8.5 17.5h11', 'M4.5 6.5h.01', 'M4.5 12h.01', 'M4.5 17.5h.01'],
  gym: ['M3.5 20.5h17', 'M5 20.5V9l7-5 7 5v11.5', 'M9.5 20.5v-6h5v6'],
  lock: ['M6.5 11h11v9h-11z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
  copy: ['M9 9h10v11H9z', 'M5 15V4h10'],
  invite: ['M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M3.5 20a6.5 6.5 0 0 1 13 0', 'M19 8v6', 'M16 11h6'],
};
const MITTARI_KUVAKE = { treenit: 'dumbbell', volyymi: 'weight', sarjat: 'list', aktiivisetPaivat: 'calendar', putki: 'flame' };
const TYYPPI_KUVAKE = { sali: 'gym', kumppani: 'gift' };

// Välilehti säilyy, kun Yhteisöön palataan alanavigaatiosta (kuten Edistymisessä).
let muistiTab = 'haasteet';
// Tulostaulukon valinta (raaka / tasapainotettu) haasteittain uudelleenpiirtojen yli.
const lautaMuisti = new Map();

// ---------------------------------------------------------------------------
// Muotoilu

function luku(n) {
  return Math.round(Number(n) || 0).toLocaleString('fi-FI');
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function lyhytPvm(pvm) {
  const [, m, d] = String(pvm).split('-').map(Number);
  return `${d}.${m}.`;
}

function vkPvm(pvm) {
  return `${VKP[new Date(pvm + 'T12:00:00Z').getUTCDay()]} ${lyhytPvm(pvm)}`;
}

// mittariArvo('treenit', 5) → '5 treeniä'
export function mittariArvo(mittari, n) {
  const x = Math.round(Number(n) || 0);
  switch (mittari) {
    case 'treenit': return x === 1 ? '1 treeni' : `${luku(x)} treeniä`;
    case 'volyymi': return `${luku(x)} kg`;
    case 'sarjat': return x === 1 ? '1 sarja' : `${luku(x)} sarjaa`;
    case 'aktiivisetPaivat': return x === 1 ? '1 päivä' : `${luku(x)} päivää`;
    case 'putki': return x === 1 ? '1 viikko' : `${luku(x)} viikkoa`;
    default: return luku(x);
  }
}

// edistysTeksti('treenit', 8, 9) → '8 / 9 treeniä'
export function edistysTeksti(mittari, arvo, tavoite) {
  return `${luku(arvo)} / ${mittariArvo(mittari, tavoite)}`;
}

export function kisaNimi(haaste) {
  return KISA_NIMI[haaste.mittari] || haaste.nimi;
}

function aikaTeksti(h, p) {
  if (!p.alkanut) return [`Alkaa ${vkPvm(h.alku)}`];
  if (p.paattynyt) return [`Päättyi ${vkPvm(h.loppu)}`];
  return [`Päättyy ${vkPvm(h.loppu)}`, p.paivaaJaljella === 1 ? 'Viimeinen päivä' : `${p.paivaaJaljella} päivää jäljellä`];
}

function aikaSitten(iso, nytMs) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const min = Math.round((nytMs - t) / 60000);
  if (min < 1) return 'juuri nyt';
  if (min < 60) return `${min} min sitten`;
  const d = new Date(t);
  const kello = `${d.getHours()}.${pad(d.getMinutes())}`;
  const tanaan = tanaanPvm(new Date(nytMs).toISOString());
  const pvm = tanaanPvm(iso);
  if (pvm === tanaan) return `${Math.floor(min / 60)} h sitten`;
  if (pvm === addDays(tanaan, -1)) return `eilen ${kello}`;
  return `${VKP[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}. ${kello}`;
}

function siistiKuvaus(teksti) {
  return String(teksti || '')
    .replace(/\s*Demo: kuvitteellinen kumppani\.?/g, '')
    .replace(/\s*Salit voivat järjestää omia jäsenhaasteitaan\.?/g, '')
    .trim();
}

// ---------------------------------------------------------------------------
// Pienet komponentit

function ikoni(nimi, koko = 20, leveys = 2) {
  return svgEl('svg', { viewBox: '0 0 24 24', width: koko, height: koko, 'aria-hidden': 'true', class: 'yh-ico' },
    ...(KUVAKKEET[nimi] || KUVAKKEET.star).map((d) => svgEl('path', {
      d, fill: 'none', stroke: 'currentColor', 'stroke-width': leveys, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    })));
}

function chevron() {
  return svgEl('svg', { class: 'chevron', viewBox: '0 0 8 14', width: 8, height: 14, 'aria-hidden': 'true' },
    svgEl('path', { d: 'M1.5 1.5 6.5 7l-5 5.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

// Edistymispalkki 0–100 %. valmis → kultainen täyttö.
export function palkki(pros, { valmis = false, label } = {}) {
  const p = Math.max(0, Math.min(100, Number(pros) || 0));
  return el('div', {
    class: `yh-bar${valmis ? ' is-done' : ''}`,
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    'aria-valuenow': String(Math.round(p)),
    'aria-label': label || null,
  }, el('span', { class: 'yh-bar-fill', style: `width:${p}%` }));
}

// Merkki kuusikulmiona (sama ulkoasu kuin Historian merkkipaaluissa).
export function merkkiKuusikulmio(id, kuvake, koko = 30) {
  const R = 11;
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = ((-90 + 60 * i) * Math.PI) / 180;
    pts.push(`${(12 + R * Math.cos(a)).toFixed(2)},${(12 + R * Math.sin(a)).toFixed(2)}`);
  }
  const vari = MERKKI_VARIT[id] || 'var(--accent)';
  const poly = svgEl('polygon', { points: pts.join(' '), class: 'hex-badge-bg', 'stroke-linejoin': 'round' });
  poly.style.fill = vari;
  poly.style.stroke = vari;
  const ikonit = (KUVAKKEET[kuvake] || KUVAKKEET.star).map((d) => svgEl('path', {
    d, fill: 'none', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'hex-badge-ink',
    transform: 'translate(4.8 4.8) scale(0.6)',
  }));
  const merkki = svgEl('svg', { class: 'hex-badge', viewBox: '-1 -1 26 26', width: koko, height: koko, 'aria-hidden': 'true' }, poly, ...ikonit);
  if (MERKKI_MUSTE[id]) merkki.style.setProperty('--hex-ink', MERKKI_MUSTE[id]);
  return merkki;
}

// Kaverin pallon tekstiväri: tumma, jos se erottuu riittävästi (4.5:1), muuten valkoinen ja
// taustaa tummennetaan, kunnes valkoinen erottuu.
function suhteellinenLuminanssi([r, g, b]) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function kontrasti(a, b) {
  const x = suhteellinenLuminanssi(a);
  const y = suhteellinenLuminanssi(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const palloVariMuisti = new Map();
function palloVarit(hex) {
  if (palloVariMuisti.has(hex)) return palloVariMuisti.get(hex);
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  let tulos;
  if (!m) {
    tulos = { bg: 'var(--accent)', fg: 'var(--on-accent)' };
  } else {
    const rgb = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    const tumma = [30, 41, 59];
    const valkoinen = [255, 255, 255];
    if (kontrasti(rgb, tumma) >= 4.5 && kontrasti(rgb, tumma) >= kontrasti(rgb, valkoinen)) {
      tulos = { bg: `#${m[1]}`, fg: '#1e293b' };
    } else {
      let c = rgb;
      for (let i = 0; i < 12 && kontrasti(c, valkoinen) < 4.5; i++) c = c.map((v) => Math.round(v * 0.92));
      tulos = { bg: `rgb(${c.join(', ')})`, fg: '#ffffff' };
    }
  }
  palloVariMuisti.set(hex, tulos);
  return tulos;
}

function kayttajanNimikirjaimet(profiili) {
  const osat = String((profiili && profiili.nimi) || '').trim().split(/\s+/).filter(Boolean);
  if (!osat.length) return 'S';
  return osat.slice(0, 2).map((o) => o.charAt(0).toUpperCase()).join('');
}

// Nimikirjainpallo. kaveri = { nimikirjaimet, vari } tai null (käyttäjä).
function pallo(kaveri, profiili, koko = 36) {
  if (!kaveri) {
    return el('span', { class: 'yh-ball is-user', style: `width:${koko}px;height:${koko}px`, 'aria-hidden': 'true' },
      kayttajanNimikirjaimet(profiili));
  }
  const v = palloVarit(kaveri.vari);
  return el('span', {
    class: 'yh-ball',
    style: `width:${koko}px;height:${koko}px;background:${v.bg};color:${v.fg}`,
    'aria-hidden': 'true',
  }, kaveri.nimikirjaimet || String(kaveri.nimi || '?').charAt(0));
}

function haasteIkoni(h, koko = 44) {
  const nimi = TYYPPI_KUVAKE[h.tyyppi] || MITTARI_KUVAKE[h.mittari] || 'star';
  return el('span', { class: `yh-ch-ico is-${h.tyyppi}`, style: `width:${koko}px;height:${koko}px`, 'aria-hidden': 'true' },
    ikoni(nimi, Math.round(koko * 0.5)));
}

let ilmoitusAjastin = null;
// Lyhyt ilmoitus näytön alareunaan (esim. "Kutsulinkki kopioitu (demo)").
// Lyhyt ilmoitus näytön alareunaan (käyttää myös views/vaihto.js).
export function ilmoitus(teksti) {
  const vanha = document.querySelector('.yh-toast');
  if (vanha) vanha.remove();
  clearTimeout(ilmoitusAjastin);
  const t = el('div', { class: 'yh-toast', role: 'status', 'aria-live': 'polite' }, teksti);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('is-visible'));
  ilmoitusAjastin = setTimeout(() => {
    t.classList.remove('is-visible');
    setTimeout(() => t.remove(), 300);
  }, 2600);
}

function kopioi(teksti, onnistui, epaonnistui) {
  try {
    const p = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(teksti) : null;
    if (p && typeof p.then === 'function') {
      p.then(onnistui, epaonnistui);
      return;
    }
  } catch {
    // Leikepöytä ei ole käytettävissä (esim. lupa puuttuu): koodi näkyy silti.
  }
  epaonnistui();
}

// ---------------------------------------------------------------------------
// Tila

function nykyhetki() {
  return new Date().toISOString();
}

function yhteisoOsa(state) {
  const y = (state && state.yhteiso) || {};
  return {
    kaverit: Array.isArray(y.kaverit) ? y.kaverit : [],
    haasteet: Array.isArray(y.haasteet) ? y.haasteet.filter(Boolean) : [],
    tsempit: Array.isArray(y.tsempit) ? y.tsempit : [],
    lunastetutEdut: Array.isArray(y.lunastetutEdut) ? y.lunastetutEdut : [],
  };
}

function asetaLiittynyt(id, liittynyt) {
  update((s) => {
    const h = s.yhteiso && Array.isArray(s.yhteiso.haasteet) ? s.yhteiso.haasteet.find((x) => x && x.id === id) : null;
    if (h) h.liittynyt = liittynyt;
  });
}

function lueTab(params) {
  const q = location.hash.split('?')[1] || '';
  const tab = new URLSearchParams(q).get('tab') || (params && params.tab);
  if (VALILEHDET.some((v) => v.arvo === tab)) return tab;
  return muistiTab;
}

// ---------------------------------------------------------------------------
// Haasteet-välilehti

function tasoPalkki(pl) {
  return el('a', { class: 'card yh-level', href: '#/yhteiso?tab=merkit', 'aria-label': `Taso ${pl.taso}, ${luku(pl.pisteet)} pistettä, ${luku(pl.seuraavaan)} pistettä seuraavaan tasoon` },
    hexRing({ segmentit: [{ pros: pl.pros, vari: 'var(--score)' }], keskiteksti: String(pl.taso), koko: 46 }),
    el('div', { class: 'yh-level-body' },
      el('div', { class: 'yh-level-top' },
        el('span', { class: 'yh-level-title' }, `Taso ${pl.taso}`),
        el('span', { class: 'yh-level-points' }, `${luku(pl.pisteet)} pistettä`)),
      palkki(pl.pros, { valmis: true }),
      el('div', { class: 'yh-level-sub' }, `${luku(pl.seuraavaan)} pistettä seuraavaan`)),
    chevron());
}

function omaSija(h, state, nyt) {
  const lauta = leaderboard(h, state, nyt, { tasapainotettu: !!h.tasapainotus });
  const oma = lauta.find((r) => r.kayttaja);
  return oma ? { sija: oma.sija, maara: lauta.length } : null;
}

function haasteKortti(h, p, state, nyt) {
  const href = `#/yhteiso/haaste/${encodeURIComponent(h.id)}`;
  let toiminto = null;
  if (!p.paattynyt) {
    toiminto = h.liittynyt
      ? el('button', { class: 'yh-btn is-leave', type: 'button', 'aria-label': `Poistu haasteesta ${h.nimi}`, onClick: () => asetaLiittynyt(h.id, false) }, 'Poistu')
      : el('button', { class: 'yh-btn is-join', type: 'button', 'aria-label': `Liity haasteeseen ${h.nimi}`, onClick: () => asetaLiittynyt(h.id, true) }, 'Liity');
  }
  let tila = null;
  if (h.tyyppi === 'kaveri') {
    const s = omaSija(h, state, nyt);
    if (s) {
      tila = el('span', { class: `yh-pill${s.sija === 1 ? ' is-gold' : ''}` },
        p.paattynyt && s.sija === 1 ? 'Voitit!' : `${p.paattynyt ? 'Sijoitus' : 'Sijasi'} ${s.sija}./${s.maara}`);
    }
  } else if (p.suoritettu) {
    tila = el('span', { class: 'yh-pill is-gold' }, '✓ Suoritettu');
  }
  const aika = aikaTeksti(h, p);
  return el('article', {
    class: `card yh-card${h.liittynyt ? ' is-joined' : ''}${p.paattynyt ? ' is-ended' : ''}`,
    onClick: (e) => {
      if (e.target.closest('a, button')) return;
      location.hash = href;
    },
  },
  el('div', { class: 'yh-card-top' },
    haasteIkoni(h),
    el('div', { class: 'yh-card-main' },
      el('a', { class: 'yh-card-title', href }, h.nimi),
      el('div', { class: 'yh-card-meta' }, aika.join(' · '))),
    toiminto),
  palkki(p.pros, { valmis: p.suoritettu && h.tyyppi !== 'kaveri', label: `${h.nimi}: ${p.pros} %` }),
  el('div', { class: 'yh-card-foot' },
    el('span', { class: 'yh-card-value' }, edistysTeksti(h.mittari, p.arvo, p.tavoite)),
    tila));
}

function jarjesta(lista) {
  const avain = (x) => (x.p.paattynyt ? 2 : x.h.liittynyt ? 0 : 1);
  return lista.map((x, i) => ({ ...x, i })).sort((a, b) => avain(a) - avain(b) || a.i - b.i);
}

function haasteOsio(otsikko, lista, state, nyt) {
  if (!lista.length) return null;
  return [
    sectionTitle(otsikko),
    el('div', { class: 'yh-cards' }, ...jarjesta(lista).map(({ h, p }) => haasteKortti(h, p, state, nyt))),
  ];
}

function haasteetTab(state, nyt) {
  const y = yhteisoOsa(state);
  const tiedot = y.haasteet.map((h) => ({ h, p: challengeProgress(h, state, nyt) }));
  const tyyppia = (t) => tiedot.filter((x) => x.h.tyyppi === t);
  const sali = (state.profiili && state.profiili.sali) || 'Kotisali';
  return el('div', { class: 'yh-tab' },
    tasoPalkki(pointsAndLevel(state, nyt)),
    haasteOsio('Omat haasteet', tyyppia('oma'), state, nyt),
    haasteOsio('Kaverihaasteet', tyyppia('kaveri'), state, nyt),
    haasteOsio(`Salihaaste · ${sali}`, tyyppia('sali'), state, nyt),
    haasteOsio('Kumppanihaaste', tyyppia('kumppani'), state, nyt),
    el('button', { class: 'btn yh-create-btn', type: 'button', onClick: () => avaaLuonti() },
      ikoni('users', 20), 'Luo kaverihaaste'),
    el('button', { class: 'btn yh-create-btn yk-invite-btn', type: 'button', dataset: { kohdistus: 'kutsu-haasteet' }, onClick: () => avaaKutsu() },
      ikoni('invite', 20), 'Kutsu kaveri'));
}

// ---------------------------------------------------------------------------
// Kaverikutsu on haaste (speksi 4k B)

function kutsuOtsikko(k) {
  return `${k.kesto === 7 ? '1 viikon' : '2 viikon'} ${String(KISA_NIMI[k.mittari] || 'kisa').toLowerCase()}`;
}

function kutsuLinkki(koodi) {
  return `${location.origin}${location.pathname}#/kutsu?d=${koodi}`;
}

function kopioiLinkki(linkki) {
  kopioiLeikepoydalle(linkki).then((ok) => ilmoitus(ok ? 'Kutsulinkki kopioitu ✓' : 'Kopiointi ei onnistunut – kopioi linkki kentästä'));
}

// Web Share käyttäjän eleessä; ilman tukea (tai virheessä) linkki kopioidaan.
function jaaLinkki(linkki, teksti) {
  try {
    if (typeof navigator.share === 'function') {
      navigator.share({ title: 'Personal SuperPower', text: teksti, url: linkki }).catch((err) => {
        if (err && err.name === 'AbortError') return;
        kopioiLinkki(linkki);
      });
      return;
    }
  } catch {
    // ohitetaan, kopioidaan
  }
  kopioiLinkki(linkki);
}

function avaaKutsu() {
  let mittari = 'volyymi';
  let kesto = 14;
  const mittarit = LUOTAVAT_MITTARIT.filter((m) => KUTSU_MITTARIT.includes(m.arvo));
  const mittariNapit = mittarit.map((m) => el('button', {
    class: 'chip', type: 'button', role: 'radio', 'aria-checked': String(m.arvo === mittari),
    onClick: () => {
      mittari = m.arvo;
      mittariNapit.forEach((n, i) => n.setAttribute('aria-checked', String(mittarit[i].arvo === mittari)));
    },
  }, m.teksti));

  const luo = el('button', { class: 'btn btn-primary yh-form-save yk-create', type: 'button' }, 'Luo kutsulinkki');
  const runko = el('div', { class: 'yh-form yk-form' },
    el('h2', { class: 'sheet-title' }, 'Haasta kaveri'),
    el('p', { class: 'muted yk-lead' }, 'Kaverisi saa linkin, josta hän pääsee suoraan kaksintaisteluun kanssasi, vaikka hänellä ei vielä olisi sovellusta.'),
    el('p', { class: 'yh-form-label', id: 'yk-mittari' }, 'Mittari'),
    el('div', { class: 'chips', role: 'radiogroup', 'aria-labelledby': 'yk-mittari' }, ...mittariNapit),
    el('p', { class: 'yh-form-label' }, 'Kesto'),
    segmented({
      vaihtoehdot: [{ arvo: 7, teksti: '1 viikko' }, { arvo: 14, teksti: '2 viikkoa' }],
      arvo: kesto,
      label: 'Kesto',
      onChange: (v) => { kesto = v; },
    }),
    el('div', { class: 'row yh-form-toggle yk-balance' },
      el('span', { class: 'row-title' }, 'Tasapainotus',
        el('span', { class: 'yh-form-sub' }, 'Aina päällä kutsuhaasteessa')),
      el('span', { class: 'yh-pill is-accent' }, 'Päällä')),
    el('div', { class: 'yk-explain' },
      el('p', null, 'Kumpaakin verrataan omaan lähtötasoonsa, joten aloittelijakin voi voittaa kokeneen kaverin.'),
      whyButton(TASAPAINOTUS_SELITYS)),
    el('div', { class: 'yk-reward-note' },
      el('p', { class: 'yk-reward-title' }, `Palkkio: +${KUTSU_PISTEET} pistettä ja Treenikaveri-merkki`),
      el('p', { class: 'muted small' }, 'Saatte molemmat palkkion, kun kaverisi tekee ensimmäisen treeninsä.'),
      el('p', { class: 'yk-product-note' }, PREMIUM_TEKSTI)),
    luo);

  const laatikko = sheet(runko);

  luo.addEventListener('click', () => {
    const state = getState() || {};
    const tulos = createInvite(state, { mittari, kesto }, nykyhetki());
    if (!tulos) {
      ilmoitus('Kutsun luonti ei onnistunut');
      return;
    }
    const koodi = encodeInvite(tulos.data) || tulos.koodi;
    const linkki = kutsuLinkki(koodi);
    const otsikko = kutsuOtsikko(tulos.kutsu);
    jaaLinkki(linkki, `${tulos.data.nimi} haastaa sinut: ${otsikko}, tasapainotettu. Hyväksy haaste:`);
    update((s) => {
      if (!s.yhteiso || typeof s.yhteiso !== 'object') s.yhteiso = {};
      const lista = Array.isArray(s.yhteiso.kutsut) ? s.yhteiso.kutsut : [];
      s.yhteiso.kutsut = [...lista, { ...tulos.kutsu, koodi }];
    });

    const kentta = el('input', { class: 'prof-input yk-link', type: 'text', readonly: true, value: linkki, 'aria-label': 'Kutsulinkki' });
    kentta.addEventListener('focus', () => kentta.select());
    runko.replaceChildren(
      el('h2', { class: 'sheet-title' }, 'Kutsulinkki valmis'),
      el('p', { class: 'muted yk-lead' }, `${otsikko[0].toUpperCase()}${otsikko.slice(1)}, tasapainotettu. Lähetä linkki kaverillesi. Kutsu näkyy Yhteisön Kaverit-välilehdellä kohdassa Kutsusi.`),
      kentta,
      el('div', { class: 'yk-link-actions' },
        typeof navigator.share === 'function'
          ? el('button', { class: 'btn btn-primary', type: 'button', onClick: () => jaaLinkki(linkki, `Haastan sinut: ${otsikko}. Hyväksy haaste:`) }, 'Jaa linkki')
          : null,
        el('button', { class: 'btn yk-copy', type: 'button', onClick: () => kopioiLinkki(linkki) }, ikoni('copy', 18), 'Kopioi linkki'),
        el('button', { class: 'btn btn-ghost', type: 'button', onClick: () => laatikko.close() }, 'Valmis')),
      el('p', { class: 'yk-product-note' }, PREMIUM_TEKSTI));
  });
}

// Palkkiohetken juhlava ilmoitus (alalaatikko).
function juhla(kutsu, palkkio) {
  const otsikko = palkkio.merkki
    ? `+${luku(palkkio.pisteet)} pistettä ja Treenikaveri-merkki`
    : `+${luku(palkkio.pisteet)} pistettä`;
  const konfetti = el('div', { class: 'yk-confetti', 'aria-hidden': 'true' },
    ...Array.from({ length: 14 }, (_, i) => el('span', { style: `--i:${i}` })));
  sheet(el('div', { class: 'yk-celebrate' },
    konfetti,
    merkkiKuusikulmio('treenikaveri', 'users', 96),
    el('p', { class: 'yk-celebrate-kicker' }, 'Kutsupalkkio'),
    el('h2', { class: 'sheet-title yk-celebrate-title' }, otsikko),
    el('p', { class: 'yk-celebrate-text' }, `${kutsu.kaveriNimi || 'Kaverisi'} teki ensimmäisen treeninsä. Saatte molemmat palkkion.`),
    el('p', { class: 'yk-product-note' }, PREMIUM_TEKSTI),
    el('a', { class: 'btn btn-primary', href: '#/yhteiso?tab=merkit' }, 'Katso merkit ja pisteet')));
}

// Demo: kutsu etenee lähetetty → hyväksytty → treenannut. Viimeinen vaihe antaa palkkion
// (simulateInviteStep → inviteReward).
function simuloi(id) {
  const state = getState() || {};
  const kutsut = (state.yhteiso && Array.isArray(state.yhteiso.kutsut)) ? state.yhteiso.kutsut : [];
  const k = kutsut.find((x) => x && x.id === id);
  if (!k || k.tila === 'treenannut') return;
  if (k.tila !== 'hyväksytty') {
    update((s) => {
      const x = s.yhteiso.kutsut.find((y) => y && y.id === id);
      if (x) x.tila = 'hyväksytty';
    });
    ilmoitus('Demo: kaveri hyväksyi haasteen');
    return;
  }
  const r = simulateInviteStep(state, id, nykyhetki());
  if (!r.kutsu) return;
  update(() => r.tila);
  if (r.palkkio && r.palkkio.annettu) juhla(r.kutsu, r.palkkio);
}

function kutsuKortti(k) {
  const vaihe = Math.max(0, KUTSU_TILAT.indexOf(k.tila));
  const askeleet = el('ol', { class: 'yk-steps', 'aria-label': `Kutsun tila: ${KUTSU_TILA_NIMI[k.tila] || k.tila}` },
    ...KUTSU_TILAT.map((t, i) => el('li', { class: `yk-step${i <= vaihe ? ' is-done' : ''}${i === vaihe ? ' is-current' : ''}` },
      el('span', { class: 'yk-step-dot', 'aria-hidden': 'true' }),
      el('span', { class: 'yk-step-name' }, KUTSU_TILA_NIMI[t]))));
  const pilleri = k.tila === 'treenannut' ? 'is-gold' : k.tila === 'hyväksytty' ? 'is-accent' : '';
  const meta = [`Luotu ${lyhytPvm(k.luotu)}`, k.kaveriNimi ? `Kaveri: ${k.kaveriNimi}` : null].filter(Boolean).join(' · ');
  return el('article', { class: 'card yk-card' },
    el('div', { class: 'yk-card-top' },
      haasteIkoni({ tyyppi: 'kaveri', mittari: k.mittari }, 40),
      el('div', { class: 'yk-card-main' },
        el('div', { class: 'yk-card-title' }, kutsuOtsikko(k).replace(/^./, (c) => c.toUpperCase())),
        el('div', { class: 'yh-card-meta' }, meta)),
      el('span', { class: `yh-pill ${pilleri}` }, KUTSU_TILA_NIMI[k.tila] || k.tila)),
    askeleet,
    k.palkittu
      ? el('p', { class: 'yk-reward is-done' }, `✓ Palkkio saatu: +${KUTSU_PISTEET} pistettä ja Treenikaveri-merkki`)
      : el('p', { class: 'yk-reward muted small' }, `Palkkio, kun kaveri tekee ensimmäisen treeninsä: +${KUTSU_PISTEET} pistettä ja Treenikaveri-merkki`),
    el('div', { class: 'yk-card-actions' },
      k.tila !== 'treenannut'
        ? el('button', { class: 'yh-btn is-join', type: 'button', dataset: { kohdistus: `simuloi-${k.id}` }, onClick: () => simuloi(k.id) }, 'Simuloi seuraava vaihe')
        : null,
      k.koodi
        ? el('button', { class: 'yh-btn is-leave', type: 'button', onClick: () => kopioiLinkki(kutsuLinkki(k.koodi)) }, ikoni('copy', 16), 'Kopioi linkki')
        : null));
}

function kutsuOsio(state) {
  const kutsut = ((state.yhteiso && Array.isArray(state.yhteiso.kutsut)) ? state.yhteiso.kutsut : []).filter(Boolean);
  return [
    sectionTitle(`Kutsusi${kutsut.length ? ` · ${kutsut.length}` : ''}`),
    kutsut.length
      ? el('div', { class: 'yk-cards' }, ...kutsut.slice().reverse().map(kutsuKortti))
      : el('p', { class: 'muted small yk-empty' }, `Et ole vielä kutsunut ketään. Haasta kaveri kaksintaisteluun: kun hän tekee ensimmäisen treeninsä, saatte molemmat +${KUTSU_PISTEET} pistettä.`),
    el('button', { class: 'btn yh-invite', type: 'button', dataset: { kohdistus: 'kutsu-kaverit' }, onClick: () => avaaKutsu() },
      ikoni('invite', 20), 'Kutsu kaveri'),
    el('p', { class: 'yk-product-note' }, PREMIUM_TEKSTI),
    el('p', { class: 'muted small yk-demo-note' }, 'Demo: kaverin vaiheet simuloidaan painikkeella.'),
  ];
}

// ---------------------------------------------------------------------------
// Luo kaverihaaste (alalaatikko)

function avaaLuonti() {
  const state = getState() || {};
  const y = yhteisoOsa(state);
  const tanaan = tanaanPvm(nykyhetki());
  let mittari = 'volyymi';
  let viikot = 2;
  let tasapainotus = true;
  const valitut = new Set();

  const nimi = el('input', {
    class: 'prof-input', type: 'text', id: 'yh-uusi-nimi', maxlength: 60, autocomplete: 'off',
    placeholder: `${KISA_NIMI[mittari]} (${viikot} vk)`,
  });
  const paivitaPlaceholder = () => { nimi.placeholder = `${KISA_NIMI[mittari]} (${viikot} vk)`; };

  const mittariNapit = LUOTAVAT_MITTARIT.map((m) => el('button', {
    class: 'chip', type: 'button', role: 'radio', 'aria-checked': String(m.arvo === mittari),
    onClick: () => {
      mittari = m.arvo;
      mittariNapit.forEach((n, i) => n.setAttribute('aria-checked', String(LUOTAVAT_MITTARIT[i].arvo === mittari)));
      paivitaPlaceholder();
    },
  }, m.teksti));

  const tallenna = el('button', { class: 'btn btn-primary yh-form-save', type: 'button', disabled: true }, 'Luo haaste');
  const vihje = el('p', { class: 'muted small yh-form-hint' }, 'Valitse vähintään yksi kaveri.');
  const paivitaTallenna = () => {
    tallenna.disabled = valitut.size === 0;
    vihje.hidden = valitut.size > 0;
  };

  const kaveriRivit = y.kaverit.map((k) => {
    const ruutu = el('input', {
      type: 'checkbox', class: 'yh-check', id: `yh-kaveri-${k.id}`,
      onChange: (e) => {
        if (e.target.checked) valitut.add(k.id);
        else valitut.delete(k.id);
        paivitaTallenna();
      },
    });
    return el('label', { class: 'row yh-friend-pick', for: `yh-kaveri-${k.id}` },
      pallo(k, null, 32),
      el('span', { class: 'row-title' }, k.nimi),
      ruutu);
  });

  const sisalto = el('div', { class: 'yh-form' },
    el('h2', { class: 'sheet-title' }, 'Luo kaverihaaste'),
    el('label', { class: 'prof-input-label', for: 'yh-uusi-nimi' }, 'Nimi'),
    nimi,
    el('p', { class: 'yh-form-label', id: 'yh-uusi-mittari' }, 'Mittari'),
    el('div', { class: 'chips', role: 'radiogroup', 'aria-labelledby': 'yh-uusi-mittari' }, ...mittariNapit),
    el('p', { class: 'yh-form-label' }, 'Kesto'),
    segmented({
      vaihtoehdot: [{ arvo: 1, teksti: '1 viikko' }, { arvo: 2, teksti: '2 viikkoa' }, { arvo: 4, teksti: '4 viikkoa' }],
      arvo: viikot,
      label: 'Kesto',
      onChange: (v) => { viikot = v; paivitaPlaceholder(); },
    }),
    el('p', { class: 'yh-form-label' }, 'Kutsu kaverit'),
    el('div', { class: 'list yh-friend-list' }, ...kaveriRivit),
    el('div', { class: 'row yh-form-toggle' },
      el('span', { class: 'row-title' }, 'Tasapainotus',
        el('span', { class: 'yh-form-sub' }, 'Jokaista verrataan omaan lähtötasoonsa')),
      toggle({ arvo: tasapainotus, label: 'Tasapainotus', onChange: (v) => { tasapainotus = v; } })),
    vihje,
    tallenna);

  const laatikko = sheet(sisalto);
  tallenna.addEventListener('click', () => {
    if (!valitut.size) return;
    const haasteenNimi = nimi.value.trim() || `${KISA_NIMI[mittari]} (${viikot} vk)`;
    const mittariNimi = (LUOTAVAT_MITTARIT.find((m) => m.arvo === mittari) || {}).teksti || mittari;
    const haaste = {
      id: `kaveri-oma-${Date.now().toString(36)}`,
      tyyppi: 'kaveri',
      nimi: haasteenNimi,
      kuvaus: `${mittariNimi}: kuka kerryttää eniten ${viikot === 1 ? 'viikossa' : `${viikot} viikossa`}?`
        + (tasapainotus ? ' Tasapainotus vertaa jokaista omaan lähtötasoonsa.' : ''),
      mittari,
      tavoite: null,
      alku: tanaan,
      loppu: addDays(tanaan, viikot * 7 - 1),
      osallistujat: [...valitut],
      tasapainotus,
      palkinto: { pisteet: 100 },
      liittynyt: true,
      luoja: 'kayttaja',
    };
    laatikko.close();
    update((s) => {
      if (!s.yhteiso || typeof s.yhteiso !== 'object') s.yhteiso = {};
      s.yhteiso.haasteet = [...(Array.isArray(s.yhteiso.haasteet) ? s.yhteiso.haasteet : []), haaste];
    });
    ilmoitus(`Haaste ”${haasteenNimi}” luotu ✓`);
  });
}

// ---------------------------------------------------------------------------
// Haasteen tiedot

function edistysKortti(h, p) {
  const aika = aikaTeksti(h, p);
  const pisteet = h.palkinto && Number.isFinite(h.palkinto.pisteet) ? h.palkinto.pisteet : 50;
  const palkinto = [`${pisteet} pistettä`];
  if (h.palkinto && h.palkinto.merkkiId) palkinto.push('merkki');
  if (h.palkinto && h.palkinto.etu) palkinto.push('kumppanin etu');

  let paaluku;
  let ali;
  if (h.tyyppi === 'kaveri') {
    paaluku = el('div', { class: 'yh-big' }, mittariArvo(h.mittari, p.arvo));
    // Lähtötaso 0 (ei aiempaa dataa): tavoitteeksi tulisi 1, joten lukua ei näytetä.
    ali = p.lahtotaso > 0
      ? `${p.pros} % omasta lähtötasostasi (${mittariArvo(h.mittari, p.tavoite)})`
      : 'Lähtötaso – (ei aiempaa dataa)';
  } else {
    paaluku = el('div', { class: 'yh-big' }, luku(p.arvo), el('span', { class: 'yh-big-unit' }, ` / ${mittariArvo(h.mittari, p.tavoite)}`));
    ali = p.suoritettu ? 'Tavoite saavutettu' : `${p.pros} % tavoitteesta`;
  }

  let toiminto = null;
  if (!p.paattynyt) {
    toiminto = h.liittynyt
      ? el('button', { class: 'btn yh-detail-leave', type: 'button', onClick: () => asetaLiittynyt(h.id, false) }, 'Poistu haasteesta')
      : el('button', { class: 'btn btn-primary', type: 'button', onClick: () => asetaLiittynyt(h.id, true) }, 'Liity haasteeseen');
  }

  return el('section', { class: 'card yh-progress' },
    el('div', { class: 'yh-progress-top' },
      paaluku,
      h.liittynyt ? el('span', { class: 'yh-pill is-accent' }, 'Mukana') : null,
      p.suoritettu && h.tyyppi !== 'kaveri' ? el('span', { class: 'yh-pill is-gold' }, '✓ Suoritettu') : null),
    palkki(p.pros, { valmis: p.suoritettu && h.tyyppi !== 'kaveri', label: `Edistyminen ${p.pros} %` }),
    el('p', { class: 'yh-progress-sub' }, ali),
    el('div', { class: 'yh-progress-meta' },
      el('span', null, aika.join(' · ')),
      el('span', null, `Palkinto: ${palkinto.join(' + ')}`)),
    toiminto);
}

function tulostaulukko(h, state, nyt) {
  const y = yhteisoOsa(state);
  const kaverit = new Map(y.kaverit.map((k) => [k.id, k]));
  let tasap = lautaMuisti.has(h.id) ? lautaMuisti.get(h.id) : !!h.tasapainotus;
  const lista = el('ol', { class: 'yh-board', 'aria-label': 'Tulostaulukko' });
  const rivit = new Map();
  const vahennaLiiketta = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function taytaRivi(li, r) {
    const k = kaverit.get(r.id);
    li.className = `yh-board-row${r.kayttaja ? ' is-user' : ''}`;
    li.replaceChildren(
      el('span', { class: `yh-board-rank${r.sija === 1 ? ' is-first' : ''}` }, String(r.sija)),
      pallo(r.kayttaja ? null : k || { nimikirjaimet: r.nimi.charAt(0), vari: '#5a6880' }, state.profiili, 36),
      el('span', { class: 'yh-board-name' }, r.kayttaja ? 'Sinä' : r.nimi,
        tasap ? el('span', { class: 'yh-board-sub' }, `lähtötaso ${mittariArvo(h.mittari, r.lahtotaso)}`) : null),
      el('span', { class: 'yh-board-value' }, tasap ? `${r.pros} %` : mittariArvo(h.mittari, r.arvo)));
  }

  function piirra(animoi) {
    const data = leaderboard(h, state, nyt, { tasapainotettu: tasap });
    const ennen = animoi ? new Map([...rivit].map(([id, li]) => [id, li.getBoundingClientRect().top])) : null;
    const lit = data.map((r) => {
      let li = rivit.get(r.id);
      if (!li) {
        li = el('li');
        rivit.set(r.id, li);
      }
      taytaRivi(li, r);
      return li;
    });
    lista.replaceChildren(...lit);
    if (!ennen || vahennaLiiketta()) return;
    // FLIP: rivit liukuvat uusille paikoilleen.
    const siirrot = [];
    lit.forEach((li, i) => {
      const dy = ennen.get(data[i].id) - li.getBoundingClientRect().top;
      if (!dy) return;
      li.style.transition = 'none';
      li.style.transform = `translateY(${dy}px)`;
      siirrot.push(li);
    });
    if (!siirrot.length) return;
    void lista.offsetHeight;
    for (const li of siirrot) {
      li.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
      li.style.transform = '';
    }
  }

  const valitsin = segmented({
    vaihtoehdot: [{ arvo: 'raaka', teksti: 'Raaka' }, { arvo: 'tasapainotettu', teksti: 'Tasapainotettu' }],
    arvo: tasap ? 'tasapainotettu' : 'raaka',
    label: 'Tulostaulukon laskutapa',
    onChange: (v) => {
      tasap = v === 'tasapainotettu';
      lautaMuisti.set(h.id, tasap);
      piirra(true);
    },
  });
  piirra(false);

  return [
    sectionTitle('Tulostaulukko'),
    el('section', { class: 'card yh-board-card' },
      valitsin,
      el('div', { class: 'yh-board-why' },
        whyButton(TASAPAINOTUS_SELITYS),
        el('span', { class: 'yh-ai-note' }, 'Tuotteessa tekoäly asettaa henkilökohtaiset tavoitteet ja tasoitukset.')),
      lista,
      el('p', { class: 'muted small yh-board-foot' },
        h.tasapainotus ? 'Haaste ratkaistaan tasapainotetuilla tuloksilla.' : 'Haaste ratkaistaan raakatuloksilla.')),
  ];
}

function saliOsio(h, p, state) {
  const s = p.sali;
  if (!s) return null;
  const nimi = (state.profiili && state.profiili.sali) || 'Kotisali';
  return [
    sectionTitle(nimi),
    el('section', { class: 'card yh-gym' },
      el('div', { class: 't8-eyebrow' }, 'Salin yhteinen tavoite'),
      el('div', { class: 'yh-big yh-gym-total' }, luku(s.kertyma), el('span', { class: 'yh-big-unit' }, ` / ${luku(s.tavoite)} kg`)),
      palkki(s.pros, { label: `Salin edistyminen ${s.pros} %` }),
      el('div', { class: 'yh-stats' },
        el('div', { class: 'yh-stat' },
          el('span', { class: 'yh-stat-label' }, 'Oma osuus'),
          el('span', { class: 'yh-stat-value' }, `${luku(s.omaOsuus)} kg`)),
        el('div', { class: 'yh-stat' },
          el('span', { class: 'yh-stat-label' }, 'Sijasi'),
          el('span', { class: 'yh-stat-value' }, `${s.sija}./${luku(s.jasenia)}`))),
      el('p', { class: 'muted small yh-gym-note' }, 'Salit voivat järjestää omia jäsenhaasteitaan.')),
  ];
}

function kumppaniOsio(h, p, state) {
  const etu = (h.palkinto && h.palkinto.etu) || {};
  const koodi = etu.koodi || KOODI_OLETUS;
  const kumppani = etu.kumppani || 'Kumppani X';
  const ale = (String(etu.teksti || '').match(/^\d+\s?%\s?alennus/) || ['Etu'])[0];
  const lunastettu = yhteisoOsa(state).lunastetutEdut.includes(h.id);

  let alaosa;
  if (lunastettu) {
    alaosa = el('div', { class: 'yh-code' },
      el('span', { class: 'yh-code-text' }, koodi),
      el('button', {
        class: 'yh-btn is-join', type: 'button',
        onClick: () => kopioi(koodi, () => ilmoitus('Koodi kopioitu ✓'), () => ilmoitus(`Koodisi: ${koodi}`)),
      }, ikoni('copy', 16), 'Kopioi'));
  } else if (p.suoritettu && h.liittynyt) {
    alaosa = el('button', {
      class: 'btn btn-primary', type: 'button',
      onClick: () => {
        update((s) => {
          if (!s.yhteiso) return;
          const lista = Array.isArray(s.yhteiso.lunastetutEdut) ? s.yhteiso.lunastetutEdut : [];
          if (!lista.includes(h.id)) s.yhteiso.lunastetutEdut = [...lista, h.id];
        });
        kopioi(koodi, () => ilmoitus('Koodi kopioitu ✓'), () => ilmoitus(`Koodisi: ${koodi}`));
      },
    }, 'Paljasta koodi');
  } else {
    alaosa = el('p', { class: 'yh-locked' }, ikoni('lock', 16),
      p.suoritettu
        ? 'Liity haasteeseen, niin etu avautuu.'
        : `Koodi paljastuu, kun haaste on suoritettu (${edistysTeksti(h.mittari, p.arvo, p.tavoite)}).`);
  }

  return [
    sectionTitle('Kumppanin etu'),
    el('section', { class: 'card yh-partner' },
      el('div', { class: 'yh-partner-top' },
        el('span', { class: 'yh-ch-ico is-kumppani', style: 'width:44px;height:44px', 'aria-hidden': 'true' }, ikoni('gift', 22)),
        el('div', { class: 'yh-partner-body' },
          el('div', { class: 'yh-partner-title' }, `${ale} – ${kumppani}`),
          etu.teksti ? el('div', { class: 'yh-partner-sub' }, etu.teksti) : null)),
      alaosa,
      el('p', { class: 'yh-demo-note' }, 'Demo: kuvitteellinen kumppani')),
  ];
}

function haasteNakyma(root, id) {
  const state = getState() || {};
  const nyt = nykyhetki();
  const h = yhteisoOsa(state).haasteet.find((x) => x.id === id);
  const takaisin = el('a', { class: 't8-back', href: '#/yhteiso?tab=haasteet' }, '‹ Yhteisö');
  if (!h) {
    root.append(takaisin,
      el('h1', { class: 'page-title' }, 'Haastetta ei löytynyt'),
      el('a', { class: 'btn btn-primary', href: '#/yhteiso?tab=haasteet' }, 'Takaisin haasteisiin'));
    return;
  }
  const p = challengeProgress(h, state, nyt);
  const kuvaus = siistiKuvaus(h.kuvaus);
  const osat = [
    takaisin,
    el('header', { class: 'yh-detail-head' },
      haasteIkoni(h, 52),
      el('div', { class: 'yh-detail-titles' },
        el('div', { class: 't8-eyebrow t8-eyebrow-accent' }, TYYPPI_NIMI[h.tyyppi] || 'Haaste'),
        el('h1', { class: 'page-title yh-detail-title' }, h.nimi))),
    kuvaus ? el('p', { class: 't8-lead' }, kuvaus) : null,
    edistysKortti(h, p),
  ];
  if (h.tyyppi === 'kaveri') osat.push(...tulostaulukko(h, state, nyt));
  if (h.tyyppi === 'sali') osat.push(...(saliOsio(h, p, state) || []));
  if (h.tyyppi === 'kumppani') osat.push(...kumppaniOsio(h, p, state));
  root.append(...osat.filter(Boolean));
}

// ---------------------------------------------------------------------------
// Merkit-välilehti

function merkitTab(state, nyt) {
  const pl = pointsAndLevel(state, nyt);
  const m = badges(state, nyt);
  const y = yhteisoOsa(state);
  const e = pl.erittely || {};

  const pisteRivit = [
    ...y.kaverit.map((k) => ({ id: k.id, k, nimi: k.nimi, taso: k.taso, pisteet: k.pisteet || 0, kayttaja: false })),
    { id: 'kayttaja', k: null, nimi: 'Sinä', taso: pl.taso, pisteet: pl.pisteet, kayttaja: true },
  ].sort((a, b) => b.pisteet - a.pisteet);

  return el('div', { class: 'yh-tab' },
    el('section', { class: 'card yh-points' },
      el('div', { class: 'yh-points-top' },
        hexRing({ segmentit: [{ pros: pl.pros, vari: 'var(--score)' }], keskiteksti: String(pl.taso), koko: 92 }),
        el('div', { class: 'yh-points-body' },
          el('div', { class: 't8-eyebrow' }, 'Tasosi'),
          el('div', { class: 'yh-points-level' }, `Taso ${pl.taso}`),
          el('div', { class: 'yh-points-total' }, `${luku(pl.pisteet)} pistettä`))),
      palkki(pl.pros, { valmis: true, label: `Edistyminen tasolle ${pl.taso + 1}: ${pl.pros} %` }),
      el('div', { class: 'yh-points-next' }, `${luku(pl.seuraavaan)} pistettä tasoon ${pl.taso + 1}`),
      el('div', { class: 'yh-points-split' },
        el('span', null, `Treenit ${luku(e.treenit)}`),
        el('span', null, `Aktiviteetit ${luku(e.aktiviteetit)}`),
        el('span', null, `Haasteet ${luku(e.haasteet)}`),
        el('span', null, `Merkit ${luku(e.merkit)}`),
        e.kutsut ? el('span', null, `${PISTE_ERITTELY_NIMET.kutsut} ${luku(e.kutsut)}`) : null),
      el('div', { class: 'yh-points-why' }, whyButton(PISTE_SELITYS))),

    sectionTitle(`Ansaitut merkit · ${m.ansaitut.length}`),
    m.ansaitut.length
      ? el('div', { class: 'yh-badge-grid' }, ...m.ansaitut.slice().reverse().map((b) => el('div', { class: 'yh-badge' },
        merkkiKuusikulmio(b.id, b.kuvake, 64),
        el('span', { class: 'yh-badge-name' }, b.nimi),
        el('span', { class: 'yh-badge-date' }, `${lyhytPvm(b.pvm)}${b.pvm.slice(0, 4)}`))))
      : el('p', { class: 'muted' }, 'Ei vielä ansaittuja merkkejä.'),

    m.saatavilla.length ? sectionTitle('Saatavilla') : null,
    m.saatavilla.length
      ? el('div', { class: 'list yh-avail' }, ...m.saatavilla.map((b) => el('div', { class: 'row yh-avail-row' },
        el('span', { class: 'yh-avail-hex' }, merkkiKuusikulmio(b.id, b.kuvake, 40)),
        el('span', { class: 'yh-avail-body' },
          el('span', { class: 'yh-avail-name' }, b.nimi),
          el('span', { class: 'yh-avail-cond' }, b.ehto),
          palkki(b.pros, { label: `${b.nimi}: ${b.pros} %` })),
        el('span', { class: 'yh-avail-pct' }, `${b.pros} %`))))
      : null,

    sectionTitle('Pistetaulukko'),
    el('ol', { class: 'yh-board card', 'aria-label': 'Pistetaulukko' }, ...pisteRivit.map((r, i) => el('li', { class: `yh-board-row${r.kayttaja ? ' is-user' : ''}` },
      el('span', { class: `yh-board-rank${i === 0 ? ' is-first' : ''}` }, String(i + 1)),
      pallo(r.k, state.profiili, 36),
      el('span', { class: 'yh-board-name' }, r.nimi, el('span', { class: 'yh-board-sub' }, `Taso ${r.taso}`)),
      el('span', { class: 'yh-board-value' }, `${luku(r.pisteet)} p`)))),
    el('p', { class: 'muted small yh-foot-note' }, 'Demo: kavereiden pisteet ja merkit ovat keksittyjä.'));
}

// ---------------------------------------------------------------------------
// Kaverit-välilehti

function kaveritTab(state, nyt) {
  const y = yhteisoOsa(state);
  const kaverit = new Map(y.kaverit.map((k) => [k.id, k]));
  const tsempatut = new Set(y.tsempit);
  const tapahtumat = feed(state, nyt);
  const nytMs = Date.parse(nyt);

  const tsemppaa = (id) => {
    update((s) => {
      if (!s.yhteiso) return;
      const lista = Array.isArray(s.yhteiso.tsempit) ? s.yhteiso.tsempit : [];
      if (!lista.includes(id)) s.yhteiso.tsempit = [...lista, id];
    });
  };

  return el('div', { class: 'yh-tab' },
    sectionTitle('Aktiviteetti'),
    tapahtumat.length
      ? el('ul', { class: 'list yh-feed' }, ...tapahtumat.map((t) => {
        const tehty = tsempatut.has(t.id);
        return el('li', { class: 'yh-feed-row' },
          pallo(kaverit.get(t.kaveriId) || { nimikirjaimet: '?', vari: '#5a6880' }, null, 38),
          el('span', { class: 'yh-feed-body' },
            el('span', { class: 'yh-feed-text' }, t.teksti),
            el('span', { class: 'yh-feed-time' }, aikaSitten(t.aika, nytMs))),
          el('button', {
            class: `yh-cheer${tehty ? ' is-done' : ''}`,
            type: 'button',
            'aria-pressed': String(tehty),
            disabled: tehty,
            'aria-label': tehty ? 'Tsempattu' : `Tsemppaa: ${t.teksti}`,
            onClick: () => tsemppaa(t.id),
          }, el('span', { 'aria-hidden': 'true' }, '👏'), tehty ? el('span', { class: 'yh-cheer-text' }, 'Tsempattu') : null));
      }))
      : el('p', { class: 'muted' }, 'Ei uusia tapahtumia.'),

    sectionTitle(`Kaverit · ${y.kaverit.length}`),
    el('ul', { class: 'list yh-friends' }, ...y.kaverit.map((k) => el('li', { class: 'row yh-friend-row' },
      pallo(k, null, 40),
      el('span', { class: 'row-title yh-friend-name' }, k.nimi,
        el('span', { class: 'yh-friend-sub' }, [`Taso ${k.taso}`, PROFIILI_NIMI[k.profiili]].filter(Boolean).join(' · '))),
      el('span', { class: 'row-value' }, `${luku(k.pisteet)} p`)))),
    ...kutsuOsio(state),
    el('p', { class: 'muted small yh-foot-note' }, 'Demo: kaverit ja heidän tapahtumansa ovat keksittyjä.'));
}

// ---------------------------------------------------------------------------
// Näkymä

export function render(root, params = {}) {
  if (params.id) {
    haasteNakyma(root, params.id);
    return;
  }

  let tab = lueTab(params);
  muistiTab = tab;
  const sisalto = el('div', { class: 'yh-content' });

  const piirra = () => {
    const state = getState() || {};
    const nyt = nykyhetki();
    if (tab === 'merkit') sisalto.replaceChildren(merkitTab(state, nyt));
    else if (tab === 'kaverit') sisalto.replaceChildren(kaveritTab(state, nyt));
    else sisalto.replaceChildren(haasteetTab(state, nyt));
  };

  const valitsin = segmented({
    vaihtoehdot: VALILEHDET,
    arvo: tab,
    label: 'Yhteisön näkymä',
    onChange: (v) => {
      tab = v;
      muistiTab = v;
      try {
        history.replaceState(history.state, '', `#/yhteiso?tab=${v}`);
      } catch {
        // replaceState voi olla estetty; muisti riittää
      }
      piirra();
    },
  });
  valitsin.classList.add('yh-tabs');

  root.append(
    el('header', { class: 'yh-head' },
      el('h1', { class: 'page-title yh-title' }, 'Yhteisö'),
      el('span', { class: 'demo-badge' }, 'Demo: keksityt kaverit')),
    valitsin,
    sisalto,
  );
  piirra();
}
