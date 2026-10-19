// Sovelluksen tila (speksi 5). Tila tallennetaan localStorageen avaimella `psp-poc-v1`.
// Jokainen luku ja kirjoitus on try/catchin sisällä: jos tallennus ei toimi tai JSON on rikki,
// tila elää muistissa ja sovellus toimii normaalisti.
//
// Rajapinta: getState(), update(fn), resetDemo(). createStore(tallennus, nytFn) on testejä
// varten; moduulin oletusinstanssi käyttää window.localStorage-oliota, jos se on saatavilla.

import { seedState, tanaanPvm, kuukausiGen } from './seed.js?v=6612722';
import { valineetLaitteiksi } from './data.js?v=6612722';
import { addDays } from './engine/util.js?v=6612722';

export const TALLENNUSAVAIN = 'psp-poc-v1';
export const TILAN_VERSIO = 1;

// --- Demon haasteiden uusiminen (speksi 4i) ------------------------------------

const KUUKAUSITYYPIT = new Set(['oma', 'sali']);
const UUSINTA_PV = 14; // kumppani- ja kaverihaasteen uusi jakso: tästä päivästä 2 viikkoa

function kuukaudenRajat(pvm) {
  const [y, m] = pvm.split('-').map(Number);
  const alku = `${y}-${String(m).padStart(2, '0')}-01`;
  const seuraava = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { alku, loppu: addDays(seuraava, -1) };
}

function onKuukausihaaste(h) {
  const r = kuukaudenRajat(h.alku);
  return h.alku === r.alku && h.loppu === r.loppu;
}

/**
 * uusiDemoHaasteet(yhteiso, tanaan) → yhteiso (sama olio, jos mitään ei uusittu)
 * Puhdas. Demon omat haasteet (luoja 'demo'), jotka ovat päättyneet, luodaan uudelleen kuluvalle
 * jaksolle; päättyneet säilyvät listassa päättyneinä ja käyttäjän luomiin haasteisiin ei kosketa.
 * - oma ja sali: kuukausihaaste kuluvalle kuulle, kuukausi vaihtuu nimessä ("Marraskuun 12 treeniä");
 *   muun pituinen jakso uusitaan samanpituisena tästä päivästä,
 * - kumppani: 2 viikkoa tästä päivästä,
 * - kaveri: samanlainen kisa 2 viikoksi tästä päivästä, jos aktiivista kaverihaastetta ei ole
 *   (seedin päättynyt, voitettu kisa säilyy esimerkkinä niin kauan kuin toinen kisa on käynnissä).
 * Ketju tunnistetaan kentästä `pohjaId` (alkuperäisen haasteen id); vain ketjun uusin uusitaan.
 */
export function uusiDemoHaasteet(yhteiso, tanaan) {
  if (!yhteiso || typeof yhteiso !== 'object' || !Array.isArray(yhteiso.haasteet) || !tanaan) return yhteiso;
  const haasteet = yhteiso.haasteet.filter(Boolean);
  const pohja = (h) => h.pohjaId || h.id;
  const uusimmat = new Map();
  for (const h of haasteet) {
    const v = uusimmat.get(pohja(h));
    if (!v || String(h.loppu) > String(v.loppu)) uusimmat.set(pohja(h), h);
  }
  let kaveriKaynnissa = haasteet.some((h) => h.tyyppi === 'kaveri' && h.alku <= tanaan && tanaan <= h.loppu);
  const uudet = [];
  for (const [id0, h] of uusimmat) {
    if (h.luoja !== 'demo' || typeof h.alku !== 'string' || typeof h.loppu !== 'string' || h.loppu >= tanaan) continue;
    let alku;
    let loppu;
    let nimi = h.nimi;
    let id;
    if (KUUKAUSITYYPIT.has(h.tyyppi)) {
      if (onKuukausihaaste(h)) {
        ({ alku, loppu } = kuukaudenRajat(tanaan));
        nimi = String(h.nimi || '').replace(kuukausiGen(h.alku), kuukausiGen(alku));
        id = `${id0}-${alku.slice(0, 7)}`;
      } else {
        alku = tanaan;
        loppu = addDays(tanaan, Math.max(0, Math.round((Date.parse(h.loppu) - Date.parse(h.alku)) / 864e5)));
        id = `${id0}-${tanaan}`;
      }
    } else if (h.tyyppi === 'kumppani' || (h.tyyppi === 'kaveri' && !kaveriKaynnissa)) {
      alku = tanaan;
      loppu = addDays(tanaan, UUSINTA_PV - 1);
      id = `${id0}-${tanaan}`;
      if (h.tyyppi === 'kaveri') kaveriKaynnissa = true;
    } else {
      continue;
    }
    if (haasteet.some((x) => x.id === id)) continue;
    uudet.push({ ...structuredClone(h), id, pohjaId: id0, nimi, alku, loppu });
  }
  return uudet.length ? { ...yhteiso, haasteet: [...haasteet, ...uudet] } : yhteiso;
}

// Aiempi seed tallensi päättyneen demokaverihaasteen merkit tilaan. Ne poistetaan, koska
// badges() johtaa merkit tilasta: vanhan tilan käyttäjä ei saa voittoa, jota hänen historiansa ei tue.
function poistaSeedinMerkit(yhteiso) {
  const merkit = Array.isArray(yhteiso.ansaitutMerkit) ? yhteiso.ansaitutMerkit : [];
  const kisa = (yhteiso.haasteet || []).find((h) => h && h.id === 'kaveri-sarjat-1vk');
  if (!merkit.length || !kisa) return yhteiso;
  const jaljelle = merkit.filter((m) => !(m && ['eka-kaverihaaste', 'voitettu-kaverihaaste'].includes(m.id) && m.pvm === kisa.loppu));
  return jaljelle.length === merkit.length ? yhteiso : { ...yhteiso, ansaitutMerkit: jaljelle };
}

function oletusNyt() {
  return new Date().toISOString();
}

function ilmoita() {
  if (typeof window !== 'undefined' && window && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event('statechange'));
  }
}

/**
 * createStore(tallennus, nytFn) → { getState, update, resetDemo }
 * tallennus: localStorage-tyyppinen olio (getItem, setItem, removeItem) tai null.
 * nytFn: palauttaa nykyhetken ISO-merkkijonona (seed-tilan aikaleima). Myös pelkkä
 * ISO-merkkijono kelpaa.
 */
export function createStore(tallennus, nytFn = oletusNyt) {
  const nyt = typeof nytFn === 'function' ? nytFn : () => nytFn;

  function lue() {
    try {
      const raaka = tallennus ? tallennus.getItem(TALLENNUSAVAIN) : null;
      if (typeof raaka !== 'string' || raaka === '') return null;
      const tila = JSON.parse(raaka);
      if (!tila || typeof tila !== 'object' || tila.versio !== TILAN_VERSIO) return null;
      return tila;
    } catch {
      return null;
    }
  }

  function tallenna() {
    try {
      if (tallennus) tallennus.setItem(TALLENNUSAVAIN, JSON.stringify(state));
    } catch {
      // Tallennus ei onnistu (esim. kielletty tai täynnä): tila jatkaa muistissa.
    }
  }

  // Migraatio: aiemmat oletusteemat ('tumma', 'auto') vaihtuvat vaaleaksi, ellei käyttäjä ole
  // itse valinnut teemaa Profiilista (asetukset.teemaValittu). Muu tila ja versio säilyvät.
  //
  // Yhteisö (speksi 4i): puuttuva `yhteiso` lisätään seed-tilasta ja puuttuva `profiili.sali` saa
  // arvon 'Kotisali'. Historiaa tai muita kenttiä ei kosketa, eikä versiota nosteta.
  function migroi(tila) {
    let muuttui = false;
    const asetukset = tila.asetukset && typeof tila.asetukset === 'object' ? tila.asetukset : {};
    if (!(asetukset.teemaValittu === true || asetukset.teema === 'vaalea')) {
      tila.asetukset = { ...asetukset, teema: 'vaalea' };
      muuttui = true;
    }
    if (!tila.yhteiso || typeof tila.yhteiso !== 'object') {
      tila.yhteiso = seedState(nyt()).yhteiso;
      muuttui = true;
    }
    if (tila.profiili && typeof tila.profiili === 'object' && tila.profiili.sali == null) {
      tila.profiili = { ...tila.profiili, sali: 'Kotisali' };
      muuttui = true;
    }
    // Salin laitteet (speksi 4j): puuttuva `profiili.laitteet` johdetaan vanhasta välinemallista
    // (vainKehonpaino → tyhjä lista, puuttuva valineet → täysi kuntosali). Puuttuva
    // `paivanVaihdot` saa arvon {}. Muita kenttiä ei kosketa.
    if (tila.profiili && typeof tila.profiili === 'object' && !Array.isArray(tila.profiili.laitteet)) {
      tila.profiili = {
        ...tila.profiili,
        laitteet: valineetLaitteiksi(tila.profiili.valineet, tila.profiili.vainKehonpaino === true),
      };
      muuttui = true;
    }
    if (!tila.paivanVaihdot || typeof tila.paivanVaihdot !== 'object') {
      tila.paivanVaihdot = {};
      muuttui = true;
    }
    // Yhteisö: seedin tallentamat merkit pois ja päättyneet demohaasteet uudelle jaksolle.
    if (tila.yhteiso && typeof tila.yhteiso === 'object') {
      const ilmanMerkkeja = poistaSeedinMerkit(tila.yhteiso);
      const uusittu = uusiDemoHaasteet(ilmanMerkkeja, tanaanPvm(nyt()));
      if (uusittu !== tila.yhteiso) {
        tila.yhteiso = uusittu;
        muuttui = true;
      }
    }
    return muuttui;
  }

  let state = lue();
  if (!state) {
    state = seedState(nyt());
    tallenna();
  } else if (migroi(state)) {
    tallenna();
  }

  function getState() {
    return state;
  }

  // fn muokkaa tilan kopiota (tai palauttaa uuden tilaolion). Sen jälkeen tallennus ja
  // 'statechange'-tapahtuma.
  function update(fn) {
    const kopio = structuredClone(state);
    const tulos = fn(kopio);
    state = tulos && typeof tulos === 'object' ? tulos : kopio;
    tallenna();
    ilmoita();
  }

  // Tyhjennys ja esimerkkidata uudelleen; aloitusohjaus näytetään uudelleen.
  function resetDemo() {
    try {
      if (tallennus) tallennus.removeItem(TALLENNUSAVAIN);
    } catch {
      // ohitetaan, tila korvataan joka tapauksessa
    }
    state = seedState(nyt());
    tallenna();
    ilmoita();
  }

  return { getState, update, resetDemo };
}

// --- Moduulin oletusinstanssi (selain) ---------------------------------------

function selaimenTallennus() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    // localStoragen käyttö voi heittää (esim. evästeet estetty)
  }
  return null;
}

let oletus = null;

function instanssi() {
  if (!oletus) oletus = createStore(selaimenTallennus(), oletusNyt);
  return oletus;
}

export function getState() {
  return instanssi().getState();
}

export function update(fn) {
  instanssi().update(fn);
}

export function resetDemo() {
  instanssi().resetDemo();
}
