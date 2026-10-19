// Liikkeen vaihto (speksi 4j): yhteinen vaihtolaatikko (syy → vaihtoehdot → seuraukset),
// pyyhkäisyrivi ja vaihdetun rivin merkintä. Käyttäjät: Kodin "Tämän päivän treeni", Treenin
// aloitusnäkymä ja käynnissä olevan treenin liikkeet, joista ei ole kirjattu työsarjoja.
//
// Puhtaat apurit (testataan Nodessa): poistettavatLaitteet, kipuMuisti, vaihtoehdotSyylle,
// paivitaVaihtoSyyt, taydennaVaihdettu, vaihtoMerkki, eiVaihtoehtoaTeksti, ohjelmanLaiteVaihdot.
//
// Tila: käyttäjän päivän vaihdot ovat `paivanVaihdot`-kentässä (views/paiva.js). Vaihdon syy
// tallennetaan rinnakkain kenttään `paivanVaihtoSyyt: { [pvm]: { [alkuperainenId]: { syy, kipualue? } } }`,
// jotta rivin merkintä osaa kertoa syyn ("Vaihdettu · ei kyykkytelinettä"). Kenttä voi puuttua.

import { getState, update } from '../store.js?v=6612722';
import { tanaanPvm } from '../seed.js?v=6612722';
import { LAITTEET, KUORMITUSALUEET, liike as haeLiike } from '../data.js?v=6612722';
import { alternatives, autoSwap, valtettavatMuisteista } from '../engine/alternatives.js?v=6612722';
import { addDays } from '../engine/util.js?v=6612722';
import { el, sheet } from './ui.js?v=6612722';
import { vaihdaPaivanLiike } from './paiva.js?v=6612722';
import { ilmoitus } from './yhteiso.js?v=6612722';

export const VAIHTOSYYT = [
  { arvo: 'laite-puuttuu', otsikko: 'Laite puuttuu', kuvaus: 'Salilta ei löydy tarvittavaa laitetta.' },
  { arvo: 'laite-varattu', otsikko: 'Laite varattu', kuvaus: 'Vaihto koskee vain tätä treeniä.' },
  { arvo: 'kipu', otsikko: 'Kipu tai loukkaantuminen', kuvaus: 'Valitse alue, jota ei kuormiteta.' },
  { arvo: 'muu', otsikko: 'Muu', kuvaus: 'Oma valinta tähän treeniin.' },
];
export const KIPU_OHJE = 'Jos kipu jatkuu, hakeudu lääkärin tai fysioterapeutin vastaanotolle.';
export const KIPUMUISTI_PAIVAT = 14;

const KAIKKI_LAITTEET = LAITTEET.map((l) => l.id);

// Laitteiden partitiivit merkintää varten ("ei kyykkytelinettä"). Sama sanasto kuin
// engine/alternatives.js:n perusteluissa.
const PARTITIIVI = {
  levytanko: 'levytankoa',
  kyykkyteline: 'kyykkytelinettä',
  penkki: 'penkkiä',
  'käsipainot': 'käsipainoja',
  kahvakuulat: 'kahvakuulia',
  'jalkaprässi': 'jalkaprässiä',
  'reiden-ojennuslaite': 'reiden ojennuslaitetta',
  'reiden-koukistuslaite': 'reiden koukistuslaitetta',
  'smith-laite': 'smith-laitetta',
  'rintaprässi': 'rintaprässiä',
  soutulaite: 'soutulaitetta',
  lonkkalaite: 'lonkkalaitetta',
  pohjelaite: 'pohjelaitetta',
  'ylätalja': 'ylätaljaa',
  alatalja: 'alataljaa',
  'ristikkäistalja': 'ristikkäistaljaa',
  leuanvetotanko: 'leuanvetotankoa',
  dippiteline: 'dippitelinettä',
  vastuskuminauhat: 'vastuskuminauhoja',
};

const ALUE_PARTITIIVI = {
  polvi: 'polvea',
  'alaselkä': 'alaselkää',
  'olkapää': 'olkapäätä',
  'kyynärpää': 'kyynärpäätä',
  ranne: 'rannetta',
};

const iso = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

function laiteNimi(id) {
  const l = LAITTEET.find((x) => x.id === id);
  return l ? l.nimi : id;
}

function omatLaitteet(laitteet) {
  return Array.isArray(laitteet) ? laitteet : KAIKKI_LAITTEET;
}

function luettelo(osat, sidos) {
  if (osat.length <= 1) return osat.join('');
  return `${osat.slice(0, -1).join(', ')} ${sidos} ${osat[osat.length - 1]}`;
}

function pvmLyhyt(pvm) {
  const [, m, d] = String(pvm).split('-').map(Number);
  return `${d}.${m}.`;
}

// ---------------------------------------------------------------------------
// Puhtaat apurit

/**
 * poistettavatLaitteet(liikeId, laitteet) → [laiteId]
 * "Laite puuttuu" -kysymyksen laitteet: alkuperäisen liikkeen tarvikkeet, jotka ovat käyttäjän
 * laitelistassa (tarvikkeiden järjestyksessä). Puuttuva laitelista = täysi kuntosali.
 */
export function poistettavatLaitteet(liikeId, laitteet) {
  const l = haeLiike(liikeId);
  if (!l) return [];
  const omat = omatLaitteet(laitteet);
  return (l.tarvikkeet || []).filter((t) => omat.includes(t));
}

/**
 * kipuMuisti({ liikeId, korvaavaId, kipualue, tanaan, nyt, jarjestys }) → valmentajan muisti (speksi 4h)
 * Tilapäinen 14 päivän muisti: voimassa tänään ja 13 seuraavaa päivää. autoSwap käyttää kenttiä
 * `valtettava` ja `kipualue` seuraavien treenien ohjelmissa.
 */
export function kipuMuisti({ liikeId, korvaavaId = null, kipualue, tanaan, nyt, jarjestys = 1 }) {
  const l = haeLiike(liikeId);
  const nimi = l ? l.nimi : liikeId;
  const leima = String(nyt).replace(/\D/g, '').slice(0, 14);
  return {
    id: `muisti-vaihto-${leima}-${jarjestys}`,
    teksti: `Vältä ${kipualue}: ${nimi} ${korvaavaId ? 'korvattu' : 'ohitettu'} (${pvmLyhyt(tanaan)})`,
    tyyppi: 'tilapäinen',
    voimassaAlku: tanaan,
    voimassaLoppu: addDays(tanaan, KIPUMUISTI_PAIVAT - 1),
    kipualue,
    valtettava: liikeId,
    luotu: nyt,
    lahde: 'vaihto',
  };
}

/**
 * vaihtoehdotSyylle(state, { liikeId, syy, kipualue, paivanLiikkeet, laitteet, tanaan }) → alternatives()
 * Laite puuttuu tai varattu: alkuperäisen liikkeen tarvikkeet jätetään pois käytettävistä laitteista.
 * Kipu: liike itse ja valittu alue vältetään. Voimassa olevat kipumuistit huomioidaan aina.
 * Puuttuva `laitteet` = profiilin laitteet.
 */
export function vaihtoehdotSyylle(state, { liikeId, syy, kipualue, paivanLiikkeet = [], laitteet, tanaan } = {}) {
  const s = state || {};
  const l = haeLiike(liikeId);
  if (!l) return [];
  const omat = omatLaitteet(laitteet !== undefined ? laitteet : (s.profiili && s.profiili.laitteet));
  const kaytossa = syy === 'laite-puuttuu' || syy === 'laite-varattu'
    ? omat.filter((t) => !(l.tarvikkeet || []).includes(t))
    : omat;
  const muisti = valtettavatMuisteista(s.muistit, tanaan);
  return alternatives(liikeId, {
    laitteet: kaytossa,
    valtettavat: [...muisti.valtettavat, ...(syy === 'kipu' ? [liikeId] : [])],
    kipualueet: [...muisti.kipualueet, ...(syy === 'kipu' && kipualue ? [kipualue] : [])],
    paivanLiikkeet,
    historia: s.historia,
    nyt: tanaan,
  });
}

/**
 * paivitaVaihtoSyyt(vanhat, pvm, alkuperainenId, tieto) → uusi paivanVaihtoSyyt
 * Puhdas. tieto = { syy, kipualue? } tallentaa syyn; null poistaa sen (Palauta).
 */
export function paivitaVaihtoSyyt(vanhat, pvm, alkuperainenId, tieto) {
  const tulos = {};
  for (const [p, v] of Object.entries(vanhat && typeof vanhat === 'object' ? vanhat : {})) tulos[p] = { ...v };
  const paiva = { ...(tulos[pvm] || {}) };
  if (tieto && tieto.syy) {
    paiva[alkuperainenId] = tieto.kipualue ? { syy: tieto.syy, kipualue: tieto.kipualue } : { syy: tieto.syy };
  } else {
    delete paiva[alkuperainenId];
  }
  if (Object.keys(paiva).length) tulos[pvm] = paiva;
  else delete tulos[pvm];
  return tulos;
}

/**
 * normalisoiVaihdettu(arvo) → { alkuperainen, syy, ... } | null
 * Vanhassa tallennetussa käynnissä olevassa treenissä `vaihdettu` voi olla pelkkä alkuperäisen
 * liikkeen id (välinevaihto); se tulkitaan automaattiseksi laitevaihdoksi.
 */
export function normalisoiVaihdettu(arvo) {
  if (typeof arvo === 'string' && arvo) return { alkuperainen: arvo, syy: 'laite' };
  return arvo && typeof arvo === 'object' && arvo.alkuperainen ? arvo : null;
}

/**
 * taydennaVaihdettu(vaihdettu, state, pvm) → vaihdettu (+ tarkenne)
 * rakennaPaiva merkitsee käyttäjän vaihdot syyllä 'kayttaja'; tarkenne (laite-puuttuu,
 * laite-varattu, kipu, muu) luetaan paivanVaihtoSyyt-kentästä.
 */
export function taydennaVaihdettu(vaihdettu, state, pvm) {
  if (!vaihdettu) return null;
  if (vaihdettu.syy !== 'kayttaja' || vaihdettu.tarkenne) return { ...vaihdettu };
  const syyt = state && state.paivanVaihtoSyyt && state.paivanVaihtoSyyt[pvm];
  const tieto = syyt && syyt[vaihdettu.alkuperainen];
  return tieto && tieto.syy ? { ...vaihdettu, tarkenne: tieto.syy } : { ...vaihdettu };
}

/**
 * vaihtoMerkki(vaihdettu, { liike, laitteet }) → teksti tai null
 * Automaattinen (syy 'laite' tai 'kipu'): "Vaihdettu automaattisesti · ei levytankoa".
 * Käyttäjän vaihto (syy 'kayttaja', tarkenne): "Vaihdettu · ei kyykkytelinettä" / "· kipu" / "· oma valinta".
 * liike = korvaava liike, laitteet = päivän käytettävät laitteet.
 */
export function vaihtoMerkki(vaihdettuArvo, { liike, laitteet } = {}) {
  const vaihdettu = normalisoiVaihdettu(vaihdettuArvo);
  if (!vaihdettu) return null;
  const alkup = haeLiike(vaihdettu.alkuperainen);
  const alkupTarvikkeet = alkup ? alkup.tarvikkeet || [] : [];
  if (vaihdettu.syy === 'laite') {
    const omat = omatLaitteet(laitteet);
    const puuttuvat = alkupTarvikkeet.filter((t) => !omat.includes(t)).map((t) => PARTITIIVI[t] || t);
    return puuttuvat.length
      ? `Vaihdettu automaattisesti · ei ${luettelo(puuttuvat, 'eikä')}`
      : 'Vaihdettu automaattisesti · laite puuttuu';
  }
  if (vaihdettu.syy === 'kipu') return 'Vaihdettu automaattisesti · kipu';
  const uudet = liike && liike.tarvikkeet ? liike.tarvikkeet : [];
  const erot = alkupTarvikkeet.filter((t) => !uudet.includes(t));
  switch (vaihdettu.tarkenne) {
    case 'laite-puuttuu':
      return erot.length ? `Vaihdettu · ei ${luettelo(erot.map((t) => PARTITIIVI[t] || t), 'eikä')}` : 'Vaihdettu · laite puuttuu';
    case 'laite-varattu':
      return erot.length ? `Vaihdettu · ${luettelo(erot.map((t) => laiteNimi(t).toLowerCase()), 'ja')} varattu` : 'Vaihdettu · laite varattu';
    case 'kipu':
      return 'Vaihdettu · kipu';
    default:
      return 'Vaihdettu · oma valinta';
  }
}

/** eiVaihtoehtoaTeksti(syy) → rivin teksti, kun autoSwap ei löytänyt korvaajaa. */
export function eiVaihtoehtoaTeksti(syy) {
  return syy === 'kipu' ? 'Ei kivutonta vaihtoehtoa – ohitetaan tänään' : 'Ei laitteita – ohitetaan tänään';
}

/**
 * ohjelmanLaiteVaihdot(ohjelma, laitteet) → { vaihtuu, eiVaihtoehtoa }
 * Ohjelman kaikista päivistä: montako liikeriviä autoSwap vaihtaa laitteiden puuttuessa
 * ja montako jää ilman korvaajaa.
 */
export function ohjelmanLaiteVaihdot(ohjelma, laitteet) {
  let vaihtuu = 0;
  let eiVaihtoehtoa = 0;
  for (const p of (ohjelma && ohjelma.paivat) || []) {
    for (const v of autoSwap((p.liikkeet || []).map((r) => r.liikeId), { laitteet: omatLaitteet(laitteet) })) {
      if (v.korvaava) vaihtuu += 1;
      else eiVaihtoehtoa += 1;
    }
  }
  return { vaihtuu, eiVaihtoehtoa };
}

// ---------------------------------------------------------------------------
// Päivän vaihtojen tallennus (Koti ja Treenin aloitus)

/**
 * tallennaPaivanVaihto(pvm, alkuperainenId, korvaavaId, tieto)
 * korvaavaId null = ohita tänään, alkuperainenId = poista vaihto (Palauta). tieto = { syy, kipualue }.
 */
export function tallennaPaivanVaihto(pvm, alkuperainenId, korvaavaId, tieto) {
  const poisto = korvaavaId === undefined || korvaavaId === alkuperainenId;
  update((s) => {
    s.paivanVaihdot = vaihdaPaivanLiike(s, pvm, alkuperainenId, korvaavaId);
    s.paivanVaihtoSyyt = paivitaVaihtoSyyt(s.paivanVaihtoSyyt, pvm, alkuperainenId, poisto ? null : tieto);
  });
}

/**
 * palautaPaivanVaihto(pvm, alkuperainenId, rivit?) → bool
 * Palauttaa alkuperäisen liikkeen. Jos se on jo toisen rivin liikkeenä (rivit = päivän rivit),
 * vaihto jää voimaan ja käyttäjä saa ilmoituksen.
 */
export function palautaPaivanVaihto(pvm, alkuperainenId, rivit) {
  if (rivit && palautusEstetty(rivit, alkuperainenId)) {
    ilmoitus(PALAUTUS_ESTETTY);
    return false;
  }
  tallennaPaivanVaihto(pvm, alkuperainenId, alkuperainenId, null);
  return true;
}

/**
 * palautaKaikkiOhitetut(pvm, rivit) → palautettujen määrä
 * Poistaa päivän ohitukset ("Ohita liike tänään") yhdellä päivityksellä. Liikettä, joka on jo
 * toisen rivin liikkeenä, ei palauteta.
 */
export function palautaKaikkiOhitetut(pvm, rivit) {
  const idt = ohitetutTanaan(getState() || {}, pvm).filter((id) => !palautusEstetty(rivit, id));
  if (!idt.length) return 0;
  update((s) => {
    for (const id of idt) {
      s.paivanVaihdot = vaihdaPaivanLiike(s, pvm, id, id);
      s.paivanVaihtoSyyt = paivitaVaihtoSyyt(s.paivanVaihtoSyyt, pvm, id, null);
    }
  });
  return idt.length;
}

/**
 * kaytetytLiikkeet(rivit) → [liikeId]
 * Päivän nykyiset liikkeet ja vaihdettujen rivien alkuperäiset (rivi: { liikeId, vaihdettu }).
 * Välitetään vaihtolaatikolle paivanLiikkeet-listana, jotta vaihtoehdoista karsitaan molemmat
 * eikä sama liike päädy ohjelmaan kahdesti.
 */
export function kaytetytLiikkeet(rivit) {
  const idt = [];
  for (const r of Array.isArray(rivit) ? rivit : []) {
    if (!r) continue;
    const v = normalisoiVaihdettu(r.vaihdettu);
    for (const id of [r.liikeId, v && v.alkuperainen]) if (id && !idt.includes(id)) idt.push(id);
  }
  return idt;
}

/**
 * palautusEstetty(rivit, liikeId, omaIndeksi) → bool
 * Tosi, jos palautettava liike on jo ohjelmassa toisen rivin liikkeenä (esim. toisen liikkeen
 * korvaajana). Palautus loisi silloin kaksoiskappaleen.
 */
export function palautusEstetty(rivit, liikeId, omaIndeksi = -1) {
  return (Array.isArray(rivit) ? rivit : []).some((r, i) => r && i !== omaIndeksi && r.liikeId === liikeId);
}

export const PALAUTUS_ESTETTY = 'Liike on jo ohjelmassa toisen liikkeen tilalla';

/** ohitetutTanaan(state, pvm) → [liikeId]: käyttäjän tänään ohittamat liikkeet ("Ohita liike tänään"). */
export function ohitetutTanaan(state, pvm) {
  const paiva = state && state.paivanVaihdot && state.paivanVaihdot[pvm];
  if (!paiva || typeof paiva !== 'object') return [];
  return Object.entries(paiva).filter(([, v]) => v === null).map(([k]) => k).filter((id) => haeLiike(id));
}

// ---------------------------------------------------------------------------
// Käyttöliittymän osat

function avaaLiike(liike) {
  import('./media.js?v=6612722')
    .then((m) => { if (m && typeof m.openExerciseSheet === 'function') m.openExerciseSheet(liike); })
    .catch(() => {});
}

/**
 * Aina näkyvä ⇄-painike (saavutettavuus ja tietokone). kohdistus = rivin pysyvä avain
 * (data-kohdistus): vaihdon jälkeen rivi piirretään uudelleen, ja ui.sheet palauttaa kohdistuksen
 * saman avaimen uuteen painikkeeseen.
 */
export function vaihtoNappi(nimi, onClick, kohdistus) {
  return el('button', {
    class: 'vx-swap-btn', type: 'button', 'aria-label': `Vaihda liike ${nimi}`,
    dataset: kohdistus ? { kohdistus } : null,
    onClick: (e) => { e.stopPropagation(); onClick(); },
  }, el('span', { 'aria-hidden': 'true' }, '⇄'));
}

/**
 * vaihtoRivi({ vaihdettu, liike, laitteet, onPalauta }) → merkintärivi tai null
 * Pieni merkki vaihdetulle riville ja "Palauta"-linkki käyttäjän omalle vaihdolle.
 */
export function vaihtoRivi({ vaihdettu, liike, laitteet, eiVaihtoehtoa, onPalauta }) {
  if (eiVaihtoehtoa) return el('span', { class: 'vx-mark is-skip' }, eiVaihtoehtoaTeksti(eiVaihtoehtoa));
  const teksti = vaihtoMerkki(vaihdettu, { liike, laitteet });
  if (!teksti) return null;
  return el('span', { class: 'vx-mark' },
    el('span', { class: 'vx-mark-text' }, teksti),
    onPalauta ? el('button', {
      class: 'vx-undo', type: 'button',
      'aria-label': `Palauta ${haeLiike(vaihdettu.alkuperainen) ? haeLiike(vaihdettu.alkuperainen).nimi : 'alkuperäinen liike'}`,
      onClick: (e) => { e.stopPropagation(); onPalauta(); },
    }, 'Palauta') : null);
}

/** ohitetutLista({ state, pvm, ohjelmassa, rivit }) → "Ohitettu tänään: X · Palauta" -rivit tai null. */
export function ohitetutLista({ state, pvm, ohjelmassa, rivit }) {
  const idt = ohitetutTanaan(state, pvm).filter((id) => !ohjelmassa || ohjelmassa.includes(id));
  if (!idt.length) return null;
  return el('div', { class: 'vx-skipped' }, ...idt.map((id) => {
    const nimi = haeLiike(id).nimi;
    return el('p', { class: 'vx-skipped-row' },
      el('span', null, `Ohitettu tänään: ${nimi}`),
      el('button', {
        class: 'vx-undo', type: 'button', 'aria-label': `Palauta ${nimi}`,
        onClick: () => palautaPaivanVaihto(pvm, id, rivit),
      }, 'Palauta'));
  }));
}

/**
 * kaikkiOhitettu({ state, pvm, rivit }) → "Kaikki liikkeet ohitettu tänään" -lohko
 * Näytetään Aloita-painikkeen tilalla, kun päivässä ei ole yhtään tehtävää liikettä.
 * "Palauta kaikki" näkyy, kun käyttäjän ohituksia on palautettavissa.
 */
export function kaikkiOhitettu({ state, pvm, rivit, konteksti = 'koti' }) {
  const palautettavia = ohitetutTanaan(state, pvm).some((id) => !palautusEstetty(rivit, id));
  const koti = konteksti === 'koti';
  // Olemassa olevat tyylit: Kodissa herokortin huomiorivi, aloituksessa huomautuslaatikko.
  return el('div', {
    class: `vx-all-skipped${koti ? '' : ' note'}`, role: 'status',
    style: `display:grid;gap:12px;${koti ? '' : 'margin-top:16px;'}`,
  },
  el('p', { class: koti ? 't8-today-plan' : 'tr-note-title', style: 'margin:0' }, 'Kaikki liikkeet ohitettu tänään'),
  palautettavia ? el('button', {
    class: `btn btn-primary vx-restore-all${koti ? ' t8-hero-btn' : ''}`, type: 'button',
    onClick: () => palautaKaikkiOhitetut(pvm, rivit),
  }, 'Palauta kaikki') : null);
}

const KYNNYS_PX = 60;
const MAKSIMI_PX = 112;

/**
 * swipeRow(rivi, onSwap) → kääre
 * Vasemmalle pyyhkäisy (pointer events) paljastaa "⇄ Vaihda" -alueen; vapautus yli 60 px:n
 * kynnyksen avaa vaihdon. Pystysuuntainen vieritys säilyy (touch-action: pan-y ja kulman
 * tunnistus: liike tulkitaan pyyhkäisyksi vain, kun se on selvästi vaakasuuntainen).
 */
export function swipeRow(rivi, onSwap) {
  rivi.classList.add('vx-swipe-content');
  const toiminto = el('div', { class: 'vx-swipe-action', 'aria-hidden': 'true' },
    el('span', { class: 'vx-swipe-action-text' }, '⇄ Vaihda'));
  const kaare = el('div', { class: 'vx-swipe' }, toiminto, rivi);
  let alku = null;
  let tila = 'lepo';
  let dx = 0;
  let estaKlikki = false;

  let piilotus = null;
  const aseta = (x, animoi) => {
    clearTimeout(piilotus);
    rivi.style.transition = animoi ? '' : 'none';
    rivi.style.transform = x ? `translateX(${x}px)` : '';
    kaare.classList.toggle('is-armed', -x >= KYNNYS_PX);
    // Paluuanimaation ajan toiminto pysyy näkyvissä rivin takana.
    if (x !== 0) kaare.classList.add('is-swiping');
    else if (animoi) piilotus = setTimeout(() => kaare.classList.remove('is-swiping'), 240);
    else kaare.classList.remove('is-swiping');
  };

  kaare.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    alku = { x: e.clientX, y: e.clientY, id: e.pointerId };
    tila = 'odottaa';
    dx = 0;
  });
  kaare.addEventListener('pointermove', (e) => {
    if (!alku || e.pointerId !== alku.id) return;
    const mx = e.clientX - alku.x;
    const my = e.clientY - alku.y;
    if (tila === 'odottaa') {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      if (mx < 0 && Math.abs(mx) > Math.abs(my) * 1.3) {
        tila = 'pyyhkii';
        try { kaare.setPointerCapture(e.pointerId); } catch { /* ei tuettu */ }
      } else {
        alku = null;
        tila = 'lepo';
        return;
      }
    }
    if (tila !== 'pyyhkii') return;
    if (e.cancelable) e.preventDefault();
    dx = Math.min(0, mx);
    const x = -dx > MAKSIMI_PX ? -(MAKSIMI_PX + (-dx - MAKSIMI_PX) * 0.25) : dx;
    aseta(x, false);
  });
  const lopeta = (e, peru) => {
    if (!alku || (e && e.pointerId !== alku.id)) return;
    const pyyhki = tila === 'pyyhkii';
    const laukaise = !peru && pyyhki && -dx >= KYNNYS_PX;
    alku = null;
    tila = 'lepo';
    if (pyyhki) {
      estaKlikki = true;
      setTimeout(() => { estaKlikki = false; }, 80);
      aseta(0, true);
    }
    if (laukaise) onSwap();
  };
  kaare.addEventListener('pointerup', (e) => lopeta(e, false));
  kaare.addEventListener('pointercancel', (e) => lopeta(e, true));
  // Pyyhkäisyn päättävä klikkaus ei saa avata rivin painikkeita.
  kaare.addEventListener('click', (e) => {
    if (!estaKlikki) return;
    estaKlikki = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);
  return kaare;
}

// Pyyhkäisyvihje: ensimmäisellä kerralla rivi liukuu hetken vasemmalle (vain kerran;
// asetukset.pyyhkaisyVihjeNaytetty). prefers-reduced-motion: ei animaatiota.
let vihjeKaynnissa = false;

/** vihjaaPyyhkaisy(kaare) → peruutusfunktio (näkymän siivoukseen). */
export function vihjaaPyyhkaisy(kaare) {
  const s = getState() || {};
  if (!kaare || vihjeKaynnissa || (s.asetukset && s.asetukset.pyyhkaisyVihjeNaytetty)) return () => {};
  const reduce = typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return () => {};
  vihjeKaynnissa = true;
  const ajastimet = [];
  ajastimet.push(setTimeout(() => {
    if (!kaare.isConnected) { vihjeKaynnissa = false; return; }
    kaare.classList.add('is-hint');
    ajastimet.push(setTimeout(() => {
      kaare.classList.remove('is-hint');
      vihjeKaynnissa = false;
      update((st) => { st.asetukset = { ...(st.asetukset || {}), pyyhkaisyVihjeNaytetty: true }; });
    }, 1300));
  }, 700));
  return () => {
    ajastimet.forEach(clearTimeout);
    if (kaare.classList.contains('is-hint')) kaare.classList.remove('is-hint');
    vihjeKaynnissa = false;
  };
}

function laiteTeksti(liike) {
  const t = liike.tarvikkeet || [];
  return t.length ? `Laitteet: ${t.map(laiteNimi).join(', ')}` : 'Ei laitteita · kehonpaino';
}

function syyTeksti(valinta) {
  if (valinta.syy === 'kipu') return `kipu · ${valinta.kipualue}`;
  const s = VAIHTOSYYT.find((x) => x.arvo === valinta.syy);
  return s ? s.otsikko.toLowerCase() : '';
}

/**
 * openSwapSheet({ liikeId, pvm, konteksti, paivanLiikkeet, laitteet?, onValittu }) → {close}
 * Vaiheet: syy → vaihtoehdot (alternatives) → seuraukset (laitteen poisto tai kipumuisti).
 * onValittu(korvaavaId | null, { syy, kipualue }) kutsutaan, kun käyttäjä valitsee vaihtoehdon tai
 * ohittaa liikkeen; seuraukset näytetään sen jälkeen, joten laatikon sulkeminen kesken
 * seurauskysymyksen ei peru vaihtoa. Esc ja selaimen takaisin sulkevat laatikon (ui.sheet).
 */
export function openSwapSheet({ liikeId, pvm, konteksti = 'koti', paivanLiikkeet = [], laitteet, onValittu } = {}) {
  const liike = haeLiike(liikeId);
  if (!liike) return null;
  const tanaan = pvm || tanaanPvm(new Date().toISOString());
  const sisalto = el('div', { class: 'vx-sheet', dataset: { konteksti } });
  let kahva = null;
  let valittu = false;

  const nayta = (kohdistus, ...osat) => {
    sisalto.replaceChildren(...osat.flat().filter(Boolean));
    if (!sisalto.isConnected) return;
    const paneeli = sisalto.closest('.sheet');
    if (paneeli) paneeli.scrollTop = 0;
    const kohde = sisalto.querySelector(kohdistus || '.sheet-title');
    if (kohde) kohde.focus({ preventScroll: true });
  };
  const otsikko = (teksti) => el('h2', { class: 'sheet-title', tabindex: '-1' }, teksti);

  // 1. Syy
  function syyVaihe(kipuAuki = false) {
    const osat = [];
    for (const s of VAIHTOSYYT) {
      const kipu = s.arvo === 'kipu';
      osat.push(el('button', {
        class: `vx-reason${kipu && kipuAuki ? ' is-selected' : ''}`, type: 'button',
        'aria-expanded': kipu ? String(kipuAuki) : null,
        onClick: () => (kipu ? syyVaihe(!kipuAuki) : vaihtoehtoVaihe({ syy: s.arvo })),
      },
      el('span', { class: 'vx-reason-title' }, s.otsikko),
      el('span', { class: 'vx-reason-desc' }, s.kuvaus)));
      if (kipu && kipuAuki) {
        osat.push(el('div', { class: 'vx-pain' },
          el('p', { class: 'vx-pain-q', id: 'vx-pain-q' }, 'Mitä aluetta ei saa kuormittaa?'),
          el('div', { class: 'chips vx-pain-chips', role: 'group', 'aria-labelledby': 'vx-pain-q' },
            ...KUORMITUSALUEET.map((a) => el('button', {
              class: 'chip vx-pain-chip', type: 'button',
              onClick: () => vaihtoehtoVaihe({ syy: 'kipu', kipualue: a }),
            }, iso(a)))),
          el('p', { class: 'vx-doctor' }, KIPU_OHJE)));
      }
    }
    nayta(kipuAuki ? '.vx-pain-chip' : null,
      otsikko('Vaihda liike'),
      el('p', { class: 'vx-lead' }, `${liike.nimi} – miksi vaihdat?`),
      el('div', { class: 'vx-reasons' }, ...osat));
  }

  // 2. Vaihtoehdot
  function vaihtoehtoVaihe(valinta) {
    const state = getState() || {};
    const lista = vaihtoehdotSyylle(state, {
      liikeId, syy: valinta.syy, kipualue: valinta.kipualue, paivanLiikkeet, laitteet, tanaan,
    });
    const kortit = lista.map((v) => el('article', { class: 'vx-alt' },
      el('h3', { class: 'vx-alt-name' }, v.liike.nimi),
      el('p', { class: 'vx-alt-why' }, v.perustelu),
      el('p', { class: 'vx-alt-gear' }, laiteTeksti(v.liike)),
      el('div', { class: 'vx-alt-actions' },
        el('button', {
          class: 'tr-show', type: 'button', 'aria-label': `Näytä liike: ${v.liike.nimi}`,
          onClick: () => avaaLiike(v.liike),
        }, el('span', { 'aria-hidden': 'true' }, '▶'), ' Näytä liike'),
        el('button', {
          class: 'btn vx-pick', type: 'button', 'aria-label': `Valitse ${v.liike.nimi}`,
          onClick: () => valitse(v.liike.id, valinta),
        }, 'Valitse'))));
    nayta(null,
      el('button', { class: 'vx-back', type: 'button', onClick: () => syyVaihe(valinta.syy === 'kipu') },
        el('span', { 'aria-hidden': 'true' }, '‹ '), 'Syy'),
      otsikko('Vaihtoehdot'),
      el('p', { class: 'vx-lead' }, `${liike.nimi} · ${syyTeksti(valinta)}`),
      valinta.syy === 'kipu' ? el('p', { class: 'vx-doctor' }, KIPU_OHJE) : null,
      lista.length
        ? el('div', { class: 'vx-alts' }, ...kortit)
        : el('div', { class: 'vx-empty' },
          el('p', null, 'Sopivaa vaihtoehtoa ei löytynyt salisi laitteilla.'),
          el('button', { class: 'btn btn-primary', type: 'button', onClick: () => valitse(null, valinta) }, 'Ohita liike tänään')));
  }

  // Valinta: kipumuisti tallennetaan ja vaihto välitetään kutsujalle, sitten seuraukset.
  function valitse(korvaavaId, valinta) {
    if (valittu) return;
    valittu = true;
    const ennen = getState() || {};
    let muisti = null;
    if (valinta.syy === 'kipu' && valinta.kipualue) {
      muisti = kipuMuisti({
        liikeId, korvaavaId, kipualue: valinta.kipualue, tanaan,
        nyt: new Date().toISOString(), jarjestys: (ennen.muistit || []).length + 1,
      });
      update((s) => { s.muistit = [...(Array.isArray(s.muistit) ? s.muistit : []), muisti]; });
    }
    const poistettavat = valinta.syy === 'laite-puuttuu'
      ? poistettavatLaitteet(liikeId, ennen.profiili && ennen.profiili.laitteet)
      : [];
    if (onValittu) onValittu(korvaavaId, { syy: valinta.syy, kipualue: valinta.kipualue || null });
    if (muisti) {
      kipuVahvistus(muisti, korvaavaId);
    } else if (poistettavat.length) {
      laiteKysymys(poistettavat, korvaavaId);
    } else if (kahva) {
      kahva.close();
    }
  }

  // 3a. Laite puuttuu: poistetaanko laitteet salin laitteista?
  function laiteKysymys(idt, korvaavaId) {
    const valitut = new Set(idt);
    const kysymys = el('p', { class: 'vx-question', id: 'vx-question' });
    const kylla = el('button', {
      class: 'btn btn-primary', type: 'button',
      onClick: () => {
        if (!valitut.size) return;
        update((s) => {
          const nyky = omatLaitteet(s.profiili && s.profiili.laitteet);
          s.profiili = { ...(s.profiili || {}), laitteet: KAIKKI_LAITTEET.filter((id) => nyky.includes(id) && !valitut.has(id)) };
        });
        if (kahva) kahva.close();
      },
    }, 'Kyllä, poista');
    const paivita = () => {
      const nimet = idt.filter((id) => valitut.has(id)).map(laiteNimi);
      kysymys.textContent = nimet.length
        ? `Poistetaanko ${luettelo(nimet, 'ja')} salisi laitteista?`
        : 'Valitse laitteet, jotka salilta puuttuvat.';
      kylla.disabled = !nimet.length;
    };
    const sirut = idt.length > 1
      ? el('div', { class: 'chips vx-gear-chips', role: 'group', 'aria-labelledby': 'vx-question' },
        ...idt.map((id) => el('button', {
          class: 'chip', type: 'button', 'aria-pressed': 'true',
          onClick: (e) => {
            if (valitut.has(id)) valitut.delete(id);
            else valitut.add(id);
            e.currentTarget.setAttribute('aria-pressed', String(valitut.has(id)));
            paivita();
          },
        }, laiteNimi(id))))
      : null;
    paivita();
    nayta(null,
      otsikko(korvaavaId ? 'Liike vaihdettu' : 'Liike ohitettu tänään'),
      kysymys,
      sirut,
      el('p', { class: 'vx-fine' }, 'Ohjelma vaihtaa jatkossa automaattisesti liikkeet, joiden laitteita salilta ei löydy.'),
      el('div', { class: 'vx-confirm' },
        kylla,
        el('button', { class: 'btn', type: 'button', onClick: () => { if (kahva) kahva.close(); } }, 'Ei')));
  }

  // 3b. Kipu: vahvistus valmentajan muistista.
  function kipuVahvistus(muisti, korvaavaId) {
    nayta(null,
      otsikko(korvaavaId ? 'Liike vaihdettu' : 'Liike ohitettu tänään'),
      el('div', { class: 'vx-saved', role: 'status' },
        el('span', { class: 'vx-saved-ico', 'aria-hidden': 'true' }, '✓'),
        el('span', { class: 'vx-saved-body' },
          el('span', { class: 'vx-saved-title' }, 'Tallennettu valmentajan muistiin 14 päiväksi'),
          el('span', { class: 'vx-saved-text' }, muisti.teksti))),
      el('p', { class: 'vx-fine' },
        `${liike.nimi} vaihdetaan tai ohitetaan seuraavissa treeneissä automaattisesti ${pvmLyhyt(muisti.voimassaLoppu)} asti, eikä korvaava liike kuormita ${ALUE_PARTITIIVI[muisti.kipualue] || muisti.kipualue}. Muistin voi poistaa Profiilista.`),
      el('p', { class: 'vx-doctor' }, KIPU_OHJE),
      el('button', { class: 'btn btn-primary', type: 'button', onClick: () => { if (kahva) kahva.close(); } }, 'Valmis'));
  }

  syyVaihe();
  kahva = sheet(sisalto, { label: `Vaihda liike ${liike.nimi}` });
  return kahva;
}
