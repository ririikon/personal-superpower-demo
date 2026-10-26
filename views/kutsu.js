// Kutsulinkin vastaanotto (speksi 4k B): `#/kutsu?d=<base64url(JSON)>`.
// Näyttää kutsujan nimen, kaksintaistelun, tasapainotuksen selityksen ja palkkion.
// "Hyväksy haaste" lisää kaksintaistelun haasteisiin (createInviteChallenge) ja avaa haasteen.
// Jos aloitusohjausta ei ole tehty, kutsu tallennetaan odottamaan (sessionStorage, varalla
// moduulin muuttuja), ja app.js kutsuu kasitteleOdottavaKutsu()-funktiota aloitusohjauksen jälkeen.
//
// Puhtaat apurit (kutsuKoodi, lisaaKutsuHaaste, odottava-tallennus annetulla storagella) ovat
// testattavissa ilman DOMia.
import { getState, update } from '../store.js?v=19a48e7';
import { tanaanPvm } from '../seed.js?v=19a48e7';
import {
  decodeInvite, encodeInvite, inviteTitle, createInviteChallenge, KUTSU_PISTEET,
} from '../engine/invite.js?v=19a48e7';
import { el, svgEl, card } from './ui.js?v=19a48e7';

export const ODOTTAVA_AVAIN = 'psp-odottava-kutsu';
const MITTARI_NIMI = {
  treenit: 'Treenien määrä', volyymi: 'Volyymi (kg)', sarjat: 'Työsarjat', aktiivisetPaivat: 'Aktiiviset päivät',
};

// Varalla, jos sessionStorage ei ole käytettävissä (yksityinen tila tms.).
let muistiOdottava = null;

// ---------------------------------------------------------------------------
// Puhtaat apurit

/**
 * kutsuKoodi(params, hash) → kutsun koodi (merkkijono) tai ''.
 * Ensisijaisesti reitin params.d, muuten hashin query-arvo d.
 */
export function kutsuKoodi(params, hash = '') {
  if (params && typeof params.d === 'string' && params.d) return params.d;
  const q = String(hash || '').split('?')[1] || '';
  try {
    return new URLSearchParams(q).get('d') || '';
  } catch {
    return '';
  }
}

/**
 * lisaaKutsuHaaste(tila, kutsu, tanaan) → { tila, haasteId, uusi } | null
 * Lisää kutsuhaasteen yhteiso.haasteet-listaan ja kutsujan yhteiso.kaverit-listaan, jos niitä ei
 * vielä ole (sama kutsu kahdesti → ei kaksoiskappaletta, uusi: false). Ei muuta alkuperäistä tilaa.
 */
export function lisaaKutsuHaaste(tila, kutsu, tanaan) {
  const luotu = createInviteChallenge(kutsu, tanaan);
  if (!luotu) return null;
  const kopio = structuredClone(tila || {});
  if (!kopio.yhteiso || typeof kopio.yhteiso !== 'object') kopio.yhteiso = {};
  const y = kopio.yhteiso;
  y.haasteet = Array.isArray(y.haasteet) ? y.haasteet : [];
  y.kaverit = Array.isArray(y.kaverit) ? y.kaverit : [];
  const uusi = !y.haasteet.some((h) => h && h.id === luotu.haaste.id);
  if (uusi) y.haasteet.push(luotu.haaste);
  if (!y.kaverit.some((k) => k && k.id === luotu.kaveri.id)) y.kaverit.push(luotu.kaveri);
  return { tila: kopio, haasteId: luotu.haaste.id, uusi };
}

/** haasteenId(kutsu) → haasteen id, jonka hyväksyminen loisi (tai null). */
export function haasteenId(kutsu, tanaan = '2026-01-01') {
  const luotu = createInviteChallenge(kutsu, tanaan);
  return luotu ? luotu.haaste.id : null;
}

/** tallennaOdottava(koodi, storage) → true, jos tallennus onnistui storageen. */
export function tallennaOdottava(koodi, storage) {
  muistiOdottava = koodi;
  try {
    if (storage) {
      storage.setItem(ODOTTAVA_AVAIN, koodi);
      return true;
    }
  } catch {
    // Tallennus estetty: moduulin muuttuja riittää saman välilehden sisällä.
  }
  return false;
}

/** lueOdottava(storage) → koodi tai null. */
export function lueOdottava(storage) {
  try {
    const arvo = storage ? storage.getItem(ODOTTAVA_AVAIN) : null;
    if (typeof arvo === 'string' && arvo) return arvo;
  } catch {
    // ohitetaan, käytetään muistia
  }
  return muistiOdottava;
}

/** poistaOdottava(storage): tyhjentää odottavan kutsun. */
export function poistaOdottava(storage) {
  muistiOdottava = null;
  try {
    if (storage) storage.removeItem(ODOTTAVA_AVAIN);
  } catch {
    // ohitetaan
  }
}

function istunto() {
  try {
    return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Toiminnot

function lisaaJaAvaa(kutsu) {
  const tanaan = tanaanPvm(new Date().toISOString());
  const tulos = lisaaKutsuHaaste(getState() || {}, kutsu, tanaan);
  if (!tulos) return null;
  if (tulos.uusi) update(() => tulos.tila);
  return `#/yhteiso/haaste/${encodeURIComponent(tulos.haasteId)}`;
}

/**
 * kasitteleOdottavaKutsu() → reitti haasteeseen tai null.
 * app.js kutsuu tätä, kun aloitusohjaus on tehty: odottava kutsu lisätään haasteisiin ja poistetaan.
 */
export function kasitteleOdottavaKutsu() {
  const s = istunto();
  const koodi = lueOdottava(s);
  if (!koodi) return null;
  poistaOdottava(s);
  const state = getState();
  if (!state || !state.onboardattu) {
    tallennaOdottava(koodi, s);
    return null;
  }
  const kutsu = decodeInvite(koodi);
  if (!kutsu) return null;
  try {
    return lisaaJaAvaa(kutsu);
  } catch (err) {
    console.error(err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Näkymä

function ikoni(polut, koko = 22) {
  return svgEl('svg', { viewBox: '0 0 24 24', width: koko, height: koko, 'aria-hidden': 'true', class: 'ku-ico' },
    ...polut.map((d) => svgEl('path', {
      d, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    })));
}

function nimikirjaimet(nimi) {
  return String(nimi || '').trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map((o) => [...o][0].toUpperCase()).join('') || '?';
}

function virhe(root) {
  root.append(el('div', { class: 'ku' },
    el('div', { class: 'ku-brand' }, 'Personal SuperPower'),
    el('div', { class: 'card ku-error' },
      el('span', { class: 'ku-error-ico', 'aria-hidden': 'true' }, ikoni(['M12 8v5', 'M12 16.5h.01', 'M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'], 26)),
      el('h1', { class: 'page-title ku-error-title' }, 'Kutsulinkki ei toimi'),
      el('p', { class: 'muted' }, 'Linkki on ehkä katkennut kopioitaessa tai muuttunut matkalla. Pyydä kaveriltasi uusi kutsulinkki.'),
      el('a', { class: 'btn btn-primary', href: '#/koti' }, 'Kotiin'))));
}

export function render(root, params = {}) {
  const koodi = kutsuKoodi(params, location.hash);
  const kutsu = koodi ? decodeInvite(koodi) : null;
  if (!kutsu) {
    virhe(root);
    return;
  }

  const state = getState() || {};
  const otsikko = (inviteTitle(kutsu) || '').replace(/, tasapainotettu$/, '');
  const id = haasteenId(kutsu);
  const haasteet = state.yhteiso && Array.isArray(state.yhteiso.haasteet) ? state.yhteiso.haasteet : [];
  const jo = !!(state.onboardattu && id && haasteet.some((h) => h && h.id === id));

  const hyvaksy = () => {
    if (!state.onboardattu) {
      tallennaOdottava(encodeInvite(kutsu) || koodi, istunto());
      location.hash = '#/aloitus';
      return;
    }
    const kohde = lisaaJaAvaa(kutsu);
    if (kohde) location.replace(kohde);
  };

  const toiminnot = jo
    ? el('div', { class: 'ku-actions' },
      el('a', { class: 'btn btn-primary', href: `#/yhteiso/haaste/${encodeURIComponent(id)}` }, 'Avaa haaste'),
      el('p', { class: 'muted small ku-center' }, 'Olet jo mukana tässä haasteessa.'))
    : el('div', { class: 'ku-actions' },
      el('button', { class: 'btn btn-primary ku-accept', type: 'button', onClick: hyvaksy }, 'Hyväksy haaste'),
      el('a', { class: 'btn btn-ghost ku-decline', href: '#/koti' }, 'Ei kiitos'),
      state.onboardattu ? null : el('p', { class: 'muted small ku-center' }, 'Hyväksymisen jälkeen luot ensin oman profiilin (noin minuutti). Haaste odottaa sinua Yhteisössä.'));

  root.append(el('div', { class: 'ku' },
    el('div', { class: 'ku-brand' }, 'Personal SuperPower'),
    el('section', { class: 'ku-hero' },
      el('span', { class: 'ku-ball', 'aria-hidden': 'true' }, nimikirjaimet(kutsu.nimi)),
      el('p', { class: 'ku-kicker' }, 'Kaverikutsu'),
      el('h1', { class: 'page-title ku-title' }, otsikko),
      el('span', { class: 'ku-pill' }, 'Tasapainotettu kaksintaistelu')),
    card(
      el('div', { class: 'ku-facts' },
        el('div', { class: 'ku-fact' },
          el('span', { class: 'ku-fact-label' }, 'Mittari'),
          el('span', { class: 'ku-fact-value' }, MITTARI_NIMI[kutsu.mittari] || kutsu.mittari)),
        el('div', { class: 'ku-fact' },
          el('span', { class: 'ku-fact-label' }, 'Kesto'),
          el('span', { class: 'ku-fact-value' }, kutsu.kesto === 7 ? '1 viikko' : '2 viikkoa'))),
      el('div', { class: 'ku-balance' },
        el('span', { class: 'ku-balance-ico', 'aria-hidden': 'true' }, ikoni(['M12 4v16', 'M5 8h14', 'M5 8l-3 6a3 3 0 0 0 6 0z', 'M19 8l-3 6a3 3 0 0 0 6 0z', 'M8.5 20h7'], 22)),
        el('div', null,
          el('p', { class: 'ku-balance-title' }, 'Voit voittaa vaikka olisit aloittelija'),
          el('p', { class: 'muted small ku-balance-text' }, `Tasapainotus vertaa kumpaakin omaan lähtötasoonsa: voittaja on se, joka ylittää oman tasonsa eniten. ${kutsu.nimi} ei näe treenejäsi, vain prosenttisi.`)))),
    el('div', { class: 'card ku-reward' },
      el('span', { class: 'ku-reward-ico', 'aria-hidden': 'true' }, ikoni(['M4.5 10.5h15v9.5h-15z', 'M3.5 7h17v3.5h-17z', 'M12 7v13', 'M12 7C10.5 3.5 6.5 3.5 6.5 5.5S10 7 12 7z', 'M12 7c1.5-3.5 5.5-3.5 5.5-1.5S14 7 12 7z'], 22)),
      el('div', null,
        el('p', { class: 'ku-reward-title' }, `Palkkio: +${KUTSU_PISTEET} pistettä ja Treenikaveri-merkki`),
        el('p', { class: 'muted small' }, `Kun teet ensimmäisen treenisi, sinä ja ${kutsu.nimi} saatte molemmat palkkion.`))),
    toiminnot));
}
