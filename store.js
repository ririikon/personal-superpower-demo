// Sovelluksen tila (speksi 5). Tila tallennetaan localStorageen avaimella `psp-poc-v1`.
// Jokainen luku ja kirjoitus on try/catchin sisällä: jos tallennus ei toimi tai JSON on rikki,
// tila elää muistissa ja sovellus toimii normaalisti.
//
// Rajapinta: getState(), update(fn), resetDemo(). createStore(tallennus, nytFn) on testejä
// varten; moduulin oletusinstanssi käyttää window.localStorage-oliota, jos se on saatavilla.

import { seedState } from './seed.js?v=270067f';

export const TALLENNUSAVAIN = 'psp-poc-v1';
export const TILAN_VERSIO = 1;

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
  function migroi(tila) {
    const asetukset = tila.asetukset && typeof tila.asetukset === 'object' ? tila.asetukset : {};
    if (asetukset.teemaValittu === true || asetukset.teema === 'vaalea') return false;
    tila.asetukset = { ...asetukset, teema: 'vaalea' };
    return true;
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
