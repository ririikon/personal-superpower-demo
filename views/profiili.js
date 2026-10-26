// Profiili ja oma suunnitelma (speksi 4c ja 6.6). Rakenne: korostettu Tavoite-rivi, jonka
// takana on oma valintanäkymä, ja sen alla ryhmitellyt osiot TAVOITETAPAHTUMA ja VALMENTAJANI
// (speksi 4k C ja E), SALIN LAITTEET (speksi 4j),
// TREENIPROFIILI, TREENIN MUOTO, VALMENTAJAN MUISTI, TILAUS (speksi 4l D: maksutapa ja työpaikka,
// mockup), TIETOA ja ASETUKSET (mm. "Osallistun liigaan", speksi 4l A). Jokainen muutos tallentuu
// heti update()-kutsulla, ja reititin piirtää näkymän uudelleen statechange-tapahtumasta.
//
// Vie myös apurit, joita aloitusohjaus ja valmentaja käyttävät (tavoitteet, kokemustasot,
// ohjelmasuositus, valintalaatikko ja Valmentajan muisti).

import { getState, update, resetDemo } from '../store.js?v=19a48e7';
import {
  OHJELMAT, OLETUSPROFIILI, LAITTEET, LAITERYHMAT, LAITEPOHJAT, TAPAHTUMATYYPIT, HYROX_DIVISIOONAT,
} from '../data.js?v=19a48e7';
import { goalParams } from '../engine/progression.js?v=19a48e7';
import { eventPlan } from '../engine/event.js?v=19a48e7';
import { addDays } from '../engine/util.js?v=19a48e7';
import { tanaanPvm } from '../seed.js?v=19a48e7';
import { el, svgEl, sectionTitle, listRow, sheet, toggle, segmented, formatWeight } from './ui.js?v=19a48e7';
import { PALAUTUS_KESTOT } from './treeni-input.js?v=19a48e7';
import { ohjelmanLaiteVaihdot } from './vaihto.js?v=19a48e7';
import { kaikkiOhjelmat } from './paiva.js?v=19a48e7';
import { asetaLiigaOsallistuminen } from './yhteiso.js?v=19a48e7';
import { workplaceDemo } from '../engine/workplace.js?v=19a48e7';
import { vaihdaViikonAlku } from '../engine/league.js?v=19a48e7';

const KG_LB = 2.20462;

function palautusKestoTeksti(valinta) {
  return PALAUTUS_KESTOT.includes(valinta) ? `${valinta} s` : 'Tavoitteen mukaan';
}

// ---------------------------------------------------------------------------
// Jaetut määritelmät

export const TAVOITTEET = [
  { arvo: 'lihasmassa', otsikko: 'Lihasmassa', kuvaus: 'Kasvata lihaksia ja voimaa tasaisesti.', yleinen: true },
  { arvo: 'voima', otsikko: 'Voima', kuvaus: 'Nosta raskaampia painoja vähemmillä toistoilla.', yleinen: true },
  { arvo: 'painonpudotus', otsikko: 'Painonpudotus', kuvaus: 'Tiiviit treenit, enemmän toistoja ja lyhyet palautukset.', yleinen: true },
  { arvo: 'kiinteytys', otsikko: 'Kiinteytys', kuvaus: 'Lihaskestävyys ja muoto keskiraskailla painoilla.' },
  { arvo: 'kunto', otsikko: 'Kunto', kuvaus: 'Yleinen jaksaminen kevyemmällä intensiteetillä.' },
  { arvo: 'voimanosto', otsikko: 'Voimanosto', kuvaus: 'Kyykky, penkki ja maastaveto: raskaat pääliikkeet ja apuliikkeet.' },
];

export const KOKEMUKSET = [
  { arvo: 'aloittelija', otsikko: 'Aloittelija', kuvaus: 'Alle vuosi säännöllistä salitreeniä. Painot nousevat nopeammin.' },
  { arvo: 'keskitaso', otsikko: 'Keskitaso', kuvaus: '1–3 vuotta, perusliikkeet ovat hallussa.' },
  { arvo: 'kokenut', otsikko: 'Kokenut', kuvaus: 'Yli 3 vuotta, tekniikka ja ohjelmointi ovat tuttuja.' },
];

// Salin laitteet (speksi 4j). Vanha välinevalinta (profiili.valineet, vainKehonpaino) ei näy enää
// Profiilissa; kentät säilyvät tilassa yhteensopivuuden vuoksi.
const LAITERYHMA_NIMI = { vapaat: 'Vapaat painot', laitteet: 'Laitteet', taljat: 'Taljat', kehonpaino: 'Kehonpaino' };
const KAIKKI_LAITTEET = LAITTEET.map((l) => l.id);

function omatLaitteet(p) {
  return Array.isArray(p.laitteet) ? p.laitteet.filter((id) => KAIKKI_LAITTEET.includes(id)) : [...KAIKKI_LAITTEET];
}

function samatLaitteet(a, b) {
  return a.length === b.length && a.every((id) => b.includes(id));
}

function tallennaLaitteet(lista) {
  const joukko = new Set(lista);
  tallenna({ laitteet: KAIKKI_LAITTEET.filter((id) => joukko.has(id)) });
}

// Alalaatikko: pikavalinnat (LAITEPOHJAT) ja laitteet ryhmittäin rastiruutuina. Muutos tallentuu
// heti; laatikko päivittää omat tilansa paikallaan, jotta kohdistus säilyy.
function avaaLaitteet() {
  const yhteenveto = el('p', { class: 'muted small vx-gear-count', 'aria-live': 'polite' });
  const vaihtuu = el('p', { class: 'vx-gear-swaps', 'aria-live': 'polite' });
  const pohjaNapit = LAITEPOHJAT.map((pohja) => el('button', {
    class: 'chip', type: 'button', 'aria-pressed': 'false',
    onClick: () => { tallennaLaitteet(pohja.laitteet); paivita(); },
  }, pohja.nimi));
  const ruudut = new Map();
  const ryhmat = LAITERYHMAT.map((ryhma) => [
    sectionTitle(LAITERYHMA_NIMI[ryhma] || ryhma),
    el('div', { class: 'list vx-gear-list' }, ...LAITTEET.filter((l) => l.ryhma === ryhma).map((l) => {
      const ruutu = el('input', {
        type: 'checkbox', class: 'vx-check-input',
        onChange: (e) => {
          const nyky = new Set(omatLaitteet(profiili()));
          if (e.target.checked) nyky.add(l.id);
          else nyky.delete(l.id);
          tallennaLaitteet([...nyky]);
          paivita();
        },
      });
      ruudut.set(l.id, ruutu);
      return el('label', { class: 'row vx-check' }, ruutu, el('span', { class: 'row-title' }, l.nimi));
    })),
  ]);

  function paivita() {
    const omat = omatLaitteet(profiili());
    yhteenveto.textContent = `${omat.length}/${LAITTEET.length} laitetta valittu`;
    pohjaNapit.forEach((nappi, i) => nappi.setAttribute('aria-pressed', String(samatLaitteet(omat, LAITEPOHJAT[i].laitteet))));
    for (const [id, ruutu] of ruudut) ruutu.checked = omat.includes(id);
    const { vaihtuu: n, eiVaihtoehtoa } = ohjelmanLaiteVaihdot(ohjelma(getState().aktiivinenOhjelmaId), omat);
    vaihtuu.textContent = `${n} ${n === 1 ? 'liike vaihtuu' : 'liikettä vaihtuu'} nykyisessä ohjelmassa`
      + (eiVaihtoehtoa ? ` · ${eiVaihtoehtoa} ilman vaihtoehtoa` : '');
  }
  paivita();

  return sheet(el('div', { class: 'pick-sheet vx-gear-sheet' },
    el('h2', { class: 'sheet-title' }, 'Salini laitteet'),
    yhteenveto,
    el('div', { class: 'chips vx-gear-presets', role: 'group', 'aria-label': 'Pikavalinnat' }, ...pohjaNapit),
    el('p', { class: 'muted small vx-gear-floor' }, 'Lattia ja kehonpaino ovat aina käytettävissä.'),
    ...ryhmat,
    el('div', { class: 'note vx-gear-note' },
      el('p', null, 'Ohjelma vaihtaa automaattisesti liikkeet, joiden laitteita salilta ei löydy.'),
      vaihtuu)));
}

const KESTOT = [30, 45, 60, 75, 90];

const JAOT = [
  { arvo: 'automaattinen', otsikko: 'Automaattinen', kuvaus: 'Jako valitaan treenimäärän mukaan.' },
  { arvo: 'koko kroppa', otsikko: 'Koko kroppa', kuvaus: 'Koko keho jokaisessa treenissä.' },
  { arvo: 'ylä/ala', otsikko: 'Ylä/ala', kuvaus: 'Ylä- ja alavartalo vuorotellen.' },
  { arvo: 'PPL', otsikko: 'Työntö/veto/jalat', kuvaus: 'Kolmijako työntöihin, vetoihin ja jalkoihin.' },
];

const JAKO_OHJELMA = { 'koko kroppa': 'koko-kroppa-3', 'ylä/ala': 'yla-ala-4', PPL: 'ppl-6' };

export function nimiArvolle(lista, arvo) {
  const v = lista.find((x) => x.arvo === arvo);
  return v ? v.otsikko : String(arvo ?? '');
}

// Tavoitteen haarukat goalParams-funktiosta, esim. "8–12 toistoa · 3–4 sarjaa · palautus 90 s".
export function tavoiteHaarukka(tavoite) {
  const g = goalParams(tavoite);
  const sarjat = g.sarjatMin === g.sarjatMax ? `${g.sarjatMax}` : `${g.sarjatMin}–${g.sarjatMax}`;
  const toistot = g.apuliikkeet
    ? `${g.toistoMin}–${g.toistoMax} toistoa (apuliikkeet ${g.apuliikkeet.toistoMin}–${g.apuliikkeet.toistoMax})`
    : `${g.toistoMin}–${g.toistoMax} toistoa`;
  return `${toistot} · ${sarjat} sarjaa · palautus ${g.palautusS} s`;
}

// Suositeltu ohjelma: 2–3 → koko kroppa, 4 → ylä/ala, 5–6 → PPL. Jako ohittaa suosituksen.
export function suositeltuOhjelmaId(treenitViikossa, jako = 'automaattinen') {
  if (JAKO_OHJELMA[jako]) return JAKO_OHJELMA[jako];
  const n = Number(treenitViikossa) || 3;
  if (n >= 5) return 'ppl-6';
  if (n === 4) return 'yla-ala-4';
  return 'koko-kroppa-3';
}

export function suosituksenPerustelu(treenitViikossa) {
  const n = Number(treenitViikossa) || 3;
  if (n >= 5) {
    return `Treenaat ${n} kertaa viikossa, joten työntö/veto/jalat-jako on paras: jokainen lihasryhmä treenataan kahdesti viikossa suurella volyymilla, ja treenien välissä lihakset ehtivät palautua.`;
  }
  if (n === 4) {
    return 'Treenaat 4 kertaa viikossa, joten ylä/ala-jako on paras: jokainen lihasryhmä treenataan kahdesti viikossa, ja yksittäisen treenin volyymi on suurempi kuin koko kehon ohjelmassa.';
  }
  return `Treenaat ${n} kertaa viikossa, joten koko kehon ohjelma on paras: jokainen lihasryhmä saa ärsykkeen jokaisessa treenissä, ja palautumiselle jää aikaa treenien väliin.`;
}

// Valmiit ja tuodut ohjelmat (speksi 4k D): tuotu aktiivinen ohjelma näkyy omalla nimellään.
function ohjelma(id) {
  return kaikkiOhjelmat(getState()).find((o) => o.id === id) || OHJELMAT[0];
}

function profiili() {
  return { ...OLETUSPROFIILI, ...(getState().profiili || {}) };
}

function tallenna(muutos) {
  update((s) => {
    s.profiili = { ...OLETUSPROFIILI, ...(s.profiili || {}), ...muutos };
  });
}

// ---------------------------------------------------------------------------
// Päivämäärät

function pvmLyhyt(pvm) {
  const [, m, d] = String(pvm).split('-').map(Number);
  return `${d}.${m}.`;
}

function valiTeksti(a, b) {
  if (!a && !b) return '';
  if (!b) return `${pvmLyhyt(a)} alkaen`;
  if (!a) return `${pvmLyhyt(b)} asti`;
  if (a === b) return pvmLyhyt(a);
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  if (ya === yb && ma === mb) return `${da}.–${db}.${mb}.`;
  return `${pvmLyhyt(a)}–${pvmLyhyt(b)}`;
}

export function voimassaTeksti(m, tanaan) {
  const pysyva = m.tyyppi === 'pysyvä';
  const osat = [pysyva ? 'Pysyvä' : 'Tilapäinen'];
  const vali = valiTeksti(m.voimassaAlku, m.voimassaLoppu);
  if (vali) osat.push(vali);
  if (m.voimassaLoppu && m.voimassaLoppu < tanaan) osat.push('päättynyt');
  else if (m.voimassaAlku && m.voimassaAlku > tanaan) osat.push('tulossa');
  else if (!pysyva || m.voimassaLoppu) osat.push('voimassa');
  return osat.join(' · ');
}

// ---------------------------------------------------------------------------
// Kuvakkeet

function backIcon() {
  return svgEl('svg', { viewBox: '0 0 24 24', width: 24, height: 24, 'aria-hidden': 'true' },
    svgEl('path', { d: 'M15 4.5 7.5 12l7.5 7.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

function trashIcon() {
  return svgEl('svg', { viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': 'true' },
    svgEl('path', { d: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5.5M14 11v5.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

// ---------------------------------------------------------------------------
// Valintalaatikko (tavoite, kokemus, treenimäärä, kesto, jako, ohjelma)

// osiot: [{ otsikko?, vaihtoehdot: [{ arvo, otsikko, kuvaus?, merkki? }] }]
export function valintaSheet({ otsikko, selite, osiot, arvo, onValitse, alaosa }) {
  let valittu = arvo;
  const napit = [];
  let kahva = null;
  const sisalto = el('div', { class: 'pick-sheet' },
    el('h2', { class: 'sheet-title' }, otsikko),
    selite ? el('div', { class: 'note pick-note' }, selite) : null,
    ...osiot.map((osio) => [
      osio.otsikko ? sectionTitle(osio.otsikko) : null,
      el('div', { class: 'list pick-list', role: 'radiogroup', 'aria-label': osio.otsikko || otsikko },
        ...osio.vaihtoehdot.map((v) => {
          const nappi = el('button', {
            class: 'row pick-row',
            type: 'button',
            role: 'radio',
            'aria-checked': String(v.arvo === valittu),
            onClick: () => {
              valittu = v.arvo;
              napit.forEach((n) => n.nappi.setAttribute('aria-checked', String(n.arvo === valittu)));
              if (onValitse) onValitse(v.arvo);
              setTimeout(() => { if (kahva) kahva.close(); }, 220);
            },
          },
          el('span', { class: 'pick-text' },
            el('span', { class: 'pick-title' }, v.otsikko, v.merkki ? el('span', { class: 'pick-badge' }, v.merkki) : null),
            v.kuvaus ? el('span', { class: 'pick-desc' }, v.kuvaus) : null),
          el('span', { class: 'pick-radio', 'aria-hidden': 'true' }));
          napit.push({ nappi, arvo: v.arvo });
          return nappi;
        })),
    ]),
    alaosa || null);
  kahva = sheet(sisalto);
  return kahva;
}

export function avaaTavoiteValinta() {
  const p = profiili();
  const rivi = (t) => ({ arvo: t.arvo, otsikko: t.otsikko, kuvaus: `${t.kuvaus} ${tavoiteHaarukka(t.arvo)}.` });
  return valintaSheet({
    otsikko: 'Tavoite',
    selite: 'Tavoitteesi ohjaa liikevalintoja, toisto- ja painohaarukoita sekä intensiteettiä.',
    osiot: [
      { otsikko: 'Yleisimmät tavoitteet', vaihtoehdot: TAVOITTEET.filter((t) => t.yleinen).map(rivi) },
      { otsikko: 'Muut tavoitteet', vaihtoehdot: TAVOITTEET.filter((t) => !t.yleinen).map(rivi) },
    ],
    arvo: p.tavoite,
    onValitse: (arvo) => tallenna({ tavoite: arvo }),
  });
}

function avaaOhjelmaValinta() {
  const s = getState();
  const p = profiili();
  const suositus = suositeltuOhjelmaId(p.treenitViikossa, p.jako);
  valintaSheet({
    otsikko: 'Ohjelma',
    selite: 'Seuraava treeni otetaan aktiivisesta ohjelmasta. Historia säilyy, kun vaihdat ohjelmaa.',
    osiot: [{
      vaihtoehdot: kaikkiOhjelmat(s).map((o) => ({
        arvo: o.id,
        otsikko: o.nimi,
        kuvaus: `${o.paivat.length} treenipäivää kierrossa.`,
        merkki: o.tuotu ? 'Tuotu' : o.id === suositus ? 'Suositeltu' : null,
      })),
    }],
    arvo: s.aktiivinenOhjelmaId,
    onValitse: (id) => update((st) => { st.aktiivinenOhjelmaId = id; }),
    alaosa: el('a', { class: 'btn btn-ghost pick-link', href: '#/ohjelmat' }, 'Katso ohjelmien sisältö'),
  });
}

function avaaTekstiSyote({ otsikko, label, arvo, tyyppi = 'text', yksikko, ohje, tarkista, onTallenna }) {
  const syote = el('input', {
    class: 'input prof-input',
    type: 'text',
    inputmode: tyyppi === 'luku' ? 'decimal' : tyyppi === 'email' ? 'email' : null,
    autocomplete: 'off',
    autocapitalize: tyyppi === 'email' ? 'off' : null,
    maxlength: tyyppi === 'luku' ? 6 : tyyppi === 'email' ? 80 : 40,
    value: arvo,
    'aria-label': label,
  });
  const virhe = el('p', { class: 'prof-input-error', hidden: true }, 'Tarkista arvo.');
  let kahva = null;
  const laheta = () => {
    const tulos = tarkista ? tarkista(syote.value) : { ok: true, arvo: syote.value.trim() };
    if (!tulos.ok) {
      syote.setAttribute('aria-invalid', 'true');
      virhe.textContent = tulos.viesti || 'Tarkista arvo.';
      virhe.hidden = false;
      return;
    }
    onTallenna(tulos.arvo);
    kahva.close();
  };
  syote.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); laheta(); } });
  syote.addEventListener('input', () => { syote.removeAttribute('aria-invalid'); virhe.hidden = true; });
  const sisalto = el('div', { class: 'pick-sheet' },
    el('h2', { class: 'sheet-title' }, otsikko),
    el('label', { class: 'prof-input-label' }, label),
    el('div', { class: 'prof-input-wrap' }, syote, yksikko ? el('span', { class: 'prof-input-unit' }, yksikko) : null),
    virhe,
    ohje ? el('p', { class: 'muted small prof-input-help' }, ohje) : null,
    el('button', { class: 'btn btn-primary', type: 'button', onClick: laheta }, 'Tallenna'));
  kahva = sheet(sisalto);
  setTimeout(() => { if (syote.isConnected) syote.focus({ preventScroll: true }); }, 60);
  return kahva;
}

function avaaNollausVahvistus() {
  let kahva = null;
  const sisalto = el('div', { class: 'pick-sheet' },
    el('h2', { class: 'sheet-title' }, 'Nollataanko demo?'),
    el('p', { class: 'muted' }, 'Profiili, treenihistoria, valmentajan muisti ja keskustelut palautetaan esimerkkidataan, ja aloitusohjaus alkaa alusta.'),
    el('div', { class: 'prof-confirm' },
      el('button', { class: 'btn btn-primary', type: 'button', onClick: () => { kahva.close(); resetDemo(); } }, 'Nollaa demo'),
      el('button', { class: 'btn', type: 'button', onClick: () => kahva.close() }, 'Peruuta')));
  kahva = sheet(sisalto);
}

// ---------------------------------------------------------------------------
// Valmentajan muisti

export function poistaMuisti(id) {
  update((s) => {
    s.muistit = (s.muistit || []).filter((m) => m && m.id !== id);
  });
}

// Lista kaikista muisteista voimassaoloaikoineen ja poistopainikkeineen.
export function muistiLista({ onPoistettu } = {}) {
  const tanaan = tanaanPvm(new Date().toISOString());
  const muistit = (getState().muistit || []).filter(Boolean).slice()
    .sort((a, b) => String(a.voimassaAlku || '').localeCompare(String(b.voimassaAlku || '')));
  if (!muistit.length) {
    return el('div', { class: 'list' },
      el('div', { class: 'row memory-empty' }, el('span', { class: 'row-title muted' }, 'Valmentaja ei ole vielä tallentanut mitään. Kerro valmentajalle esimerkiksi tulevasta reissusta tai vaivasta.')));
  }
  return el('div', { class: 'list memory-list' },
    ...muistit.map((m) => el('div', { class: 'row memory-row' },
      el('span', { class: 'memory-text' },
        el('span', { class: 'memory-title' }, m.teksti),
        el('span', { class: 'memory-meta' }, voimassaTeksti(m, tanaan))),
      el('button', {
        class: 'icon-btn memory-del',
        type: 'button',
        'aria-label': `Poista muisti: ${m.teksti}`,
        onClick: () => {
          poistaMuisti(m.id);
          if (onPoistettu) onPoistettu();
        },
      }, trashIcon()))));
}

const MUISTI_SELITE = 'Valmentaja muistaa vain sen, mitä tässä näkyy.';

// Alalaatikko, jonka valmentajan muistisiru avaa.
export function avaaMuistit() {
  const lista = el('div', null);
  const piirra = () => lista.replaceChildren(muistiLista({ onPoistettu: piirra }));
  piirra();
  return sheet(el('div', { class: 'pick-sheet' },
    el('h2', { class: 'sheet-title' }, 'Valmentajan muisti'),
    el('p', { class: 'muted small memory-note' }, MUISTI_SELITE),
    lista,
    el('a', { class: 'btn btn-ghost pick-link', href: '#/profiili' }, 'Avaa profiili')));
}

// ---------------------------------------------------------------------------
// Tavoitetapahtuma (speksi 4k C) ja Valmentajani (4k E)

const PVM_RE = /^\d{4}-\d{2}-\d{2}$/;
const OLETUS_VIIKKOJA = 8; // uuden tapahtuman oletuspäivä: 8 viikon päässä

function tamaPaiva() {
  return tanaanPvm(new Date().toISOString());
}

function viikonAlkuAsetus(p) {
  return p.viikonAlku === 'sunnuntai' ? 'sunnuntai' : 'maanantai';
}

/**
 * tapahtumaTeksti(tapahtuma, tanaan, viikonAlku) → { teksti: 'HYROX 21.12. · 8 vk', plan } | null
 * Mennyt tai virheellinen tapahtuma → teksti "… · mennyt" ja plan null.
 */
export function tapahtumaTeksti(tapahtuma, tanaan, viikonAlku = 'maanantai') {
  if (!tapahtuma || typeof tapahtuma !== 'object' || typeof tapahtuma.pvm !== 'string') return null;
  const plan = eventPlan(tapahtuma, tanaan, { viikonAlku });
  if (!plan) {
    const tyyppi = TAPAHTUMATYYPIT.find((t) => t.id === tapahtuma.tyyppi);
    return { teksti: `${tyyppi ? tyyppi.nimi : 'Tapahtuma'} ${pvmLyhyt(tapahtuma.pvm)} · mennyt`, plan: null };
  }
  const vk = plan.viikkojaJaljella === 0 ? 'tällä viikolla' : `${plan.viikkojaJaljella} vk`;
  return { teksti: `${plan.otsikko} · ${vk}`, plan };
}

/**
 * tallennaTapahtuma({ tyyppi, pvm, divisioona? }) → tallentaa profiili.tapahtuma-kenttään.
 * `asetettu` (tämä päivä) kiinnittää jaksojen rajat; se säilyy, jos tyyppi ja päivä eivät muutu.
 * Virheellinen tyyppi tai päivä (ei vähintään huomenna) → false.
 */
export function tallennaTapahtuma(uusi) {
  const tanaan = tamaPaiva();
  if (!uusi || !TAPAHTUMATYYPIT.some((t) => t.id === uusi.tyyppi)) return false;
  if (typeof uusi.pvm !== 'string' || !PVM_RE.test(uusi.pvm) || uusi.pvm <= tanaan) return false;
  update((s) => {
    const p = { ...OLETUSPROFIILI, ...(s.profiili || {}) };
    const vanha = p.tapahtuma && typeof p.tapahtuma === 'object' ? p.tapahtuma : null;
    const sama = vanha && vanha.tyyppi === uusi.tyyppi && vanha.pvm === uusi.pvm && typeof vanha.asetettu === 'string';
    const tapahtuma = { tyyppi: uusi.tyyppi, pvm: uusi.pvm, asetettu: sama ? vanha.asetettu : tanaan };
    if (uusi.tyyppi === 'hyrox') {
      tapahtuma.divisioona = HYROX_DIVISIOONAT.some((d) => d.id === uusi.divisioona) ? uusi.divisioona : 'open';
    }
    s.profiili = { ...p, tapahtuma };
  });
  return true;
}

export function poistaTapahtuma() {
  update((s) => {
    const p = { ...OLETUSPROFIILI, ...(s.profiili || {}) };
    delete p.tapahtuma;
    s.profiili = p;
  });
}

function jaksoYhteenveto(plan) {
  if (!plan) return '';
  return plan.jaksot.map((j) => `${j.nimi} ${j.viikkoja} vk`).join(' · ');
}

// Alalaatikko: tyyppi (TAPAHTUMATYYPIT), päivämäärä (vähintään huomenna) ja HYROX-divisioona.
// ehdotus: { tyyppi?, pvm?, divisioona? } esitäyttää valinnat (esim. valmentajan ehdotus).
export function avaaTapahtumaValinta({ ehdotus } = {}) {
  const p = profiili();
  const tanaan = tamaPaiva();
  const huomenna = addDays(tanaan, 1);
  const nyky = p.tapahtuma && typeof p.tapahtuma === 'object' ? p.tapahtuma : null;
  const pohja = { ...(nyky || {}), ...(ehdotus || {}) };
  let tyyppi = TAPAHTUMATYYPIT.some((t) => t.id === pohja.tyyppi) ? pohja.tyyppi : 'hyrox';
  let divisioona = HYROX_DIVISIOONAT.some((d) => d.id === pohja.divisioona) ? pohja.divisioona : 'open';
  const alkuPvm = typeof pohja.pvm === 'string' && PVM_RE.test(pohja.pvm) && pohja.pvm >= huomenna
    ? pohja.pvm : addDays(tanaan, OLETUS_VIIKKOJA * 7);

  const napit = [];
  const tyyppiLista = el('div', { class: 'list pick-list', role: 'radiogroup', 'aria-label': 'Tapahtuman tyyppi' },
    ...TAPAHTUMATYYPIT.map((t) => {
      const nappi = el('button', {
        class: 'row pick-row', type: 'button', role: 'radio', 'aria-checked': String(t.id === tyyppi),
        onClick: () => {
          tyyppi = t.id;
          napit.forEach((n) => n.nappi.setAttribute('aria-checked', String(n.id === tyyppi)));
          paivita();
        },
      },
      el('span', { class: 'pick-text' },
        el('span', { class: 'pick-title' }, t.nimi),
        el('span', { class: 'pick-desc' }, t.kuvaus)),
      el('span', { class: 'pick-radio', 'aria-hidden': 'true' }));
      napit.push({ nappi, id: t.id });
      return nappi;
    }));

  const pvmSyote = el('input', {
    class: 'input prof-input ev-date', type: 'date', min: huomenna, value: alkuPvm,
    'aria-label': 'Tapahtuman päivämäärä', onInput: () => paivita(), onChange: () => paivita(),
  });
  const virhe = el('p', { class: 'prof-input-error', hidden: true }, 'Valitse päivä huomisesta alkaen.');
  const divisioonaOsa = el('div', { class: 'ev-division' },
    el('span', { class: 'prof-input-label' }, 'HYROX-divisioona'),
    segmented({
      vaihtoehdot: HYROX_DIVISIOONAT.map((d) => ({ arvo: d.id, teksti: d.nimi })),
      arvo: divisioona,
      label: 'HYROX-divisioona',
      onChange: (arvo) => { divisioona = arvo; paivita(); },
    }),
    el('p', { class: 'muted small ev-division-desc' }));
  const esikatselu = el('div', { class: 'note ev-preview', 'aria-live': 'polite' });

  function paivita() {
    const pvm = pvmSyote.value;
    const ok = PVM_RE.test(pvm) && pvm >= huomenna;
    if (ok) pvmSyote.removeAttribute('aria-invalid');
    else pvmSyote.setAttribute('aria-invalid', 'true');
    virhe.hidden = ok;
    divisioonaOsa.hidden = tyyppi !== 'hyrox';
    const div = HYROX_DIVISIOONAT.find((d) => d.id === divisioona);
    divisioonaOsa.querySelector('.ev-division-desc').textContent = div ? div.kuvaus : '';
    const plan = ok ? eventPlan({ tyyppi, pvm, asetettu: tanaan }, tanaan, { viikonAlku: viikonAlkuAsetus(p) }) : null;
    esikatselu.hidden = !plan;
    esikatselu.replaceChildren(...(plan ? [
      el('p', { class: 'ev-preview-title' }, `${plan.otsikko} · ${plan.paiviaJaljella} päivää`),
      el('p', { class: 'small' }, jaksoYhteenveto(plan)),
    ] : []));
  }

  let kahva = null;
  const tallennaNappi = el('button', {
    class: 'btn btn-primary', type: 'button',
    onClick: () => {
      paivita();
      if (!virhe.hidden) {
        pvmSyote.focus({ preventScroll: true });
        return;
      }
      if (tallennaTapahtuma({ tyyppi, pvm: pvmSyote.value, divisioona })) kahva.close();
    },
  }, 'Tallenna tavoitetapahtuma');

  const sisalto = el('div', { class: 'pick-sheet ev-sheet' },
    el('h2', { class: 'sheet-title' }, 'Tavoitetapahtuma'),
    el('div', { class: 'note pick-note' }, 'Treenit jaksotetaan tapahtumaa kohti: perusjakso, kovennus, kevennys ja kisaviikko. HYROXissa ohjelmapäiviin tulee asemia ja juoksua.'),
    sectionTitle('Tyyppi'),
    tyyppiLista,
    sectionTitle('Päivämäärä'),
    pvmSyote,
    virhe,
    divisioonaOsa,
    esikatselu,
    el('div', { class: 'prof-confirm' }, tallennaNappi));
  paivita();
  kahva = sheet(sisalto);
  return kahva;
}

function tapahtumaOsio(p) {
  const tieto = tapahtumaTeksti(p.tapahtuma, tamaPaiva(), viikonAlkuAsetus(p));
  if (!tieto) {
    return lista(listRow({ otsikko: 'Tavoitetapahtuma', arvo: 'Ei asetettu', onClick: () => avaaTapahtumaValinta() }));
  }
  const div = p.tapahtuma.tyyppi === 'hyrox' ? HYROX_DIVISIOONAT.find((d) => d.id === p.tapahtuma.divisioona) : null;
  return lista(
    listRow({ otsikko: 'Tavoitetapahtuma', arvo: tieto.teksti, onClick: () => avaaTapahtumaValinta() }),
    tieto.plan ? el('div', { class: 'row prof-row' },
      el('span', { class: 'row-title' }, 'Tämä viikko',
        el('span', { class: 'row-sub' }, `${tieto.plan.nykyinen.jaksoNimi}${tieto.plan.nykyinen.kevennysviikko ? ' · kevennysviikko' : ''}${div ? ` · ${div.nimi}` : ''}`))) : null,
    el('button', { class: 'row prof-danger', type: 'button', onClick: () => poistaTapahtuma() },
      el('span', { class: 'row-title' }, 'Poista tavoitetapahtuma')));
}

function tallennaValmentaja(muutos) {
  update((s) => {
    const p = { ...OLETUSPROFIILI, ...(s.profiili || {}) };
    const vanha = p.valmentaja && typeof p.valmentaja === 'object' ? p.valmentaja : { nimi: '', email: '' };
    const uusi = { nimi: '', email: '', ...vanha, ...muutos };
    if (!uusi.nimi && !uusi.email) delete p.valmentaja;
    else p.valmentaja = { nimi: uusi.nimi, email: uusi.email };
    s.profiili = p;
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function valmentajaOsio(p) {
  const v = p.valmentaja && typeof p.valmentaja === 'object' ? p.valmentaja : { nimi: '', email: '' };
  return lista(
    listRow({
      otsikko: 'Valmentajan nimi',
      arvo: v.nimi || 'Ei asetettu',
      onClick: () => avaaTekstiSyote({
        otsikko: 'Valmentajani', label: 'Valmentajan nimi', arvo: String(v.nimi || ''),
        ohje: 'Näkyy viikkoraportissa. Demossa valinnainen.',
        onTallenna: (arvo) => tallennaValmentaja({ nimi: arvo }),
      }),
    }),
    listRow({
      otsikko: 'Sähköposti',
      arvo: v.email || 'Valinnainen',
      onClick: () => avaaTekstiSyote({
        otsikko: 'Valmentajani', label: 'Valmentajan sähköposti', arvo: String(v.email || ''), tyyppi: 'email',
        ohje: 'Viikkoraportin sähköpostiluonnos osoitetaan tähän. Voit jättää tyhjäksi.',
        tarkista: (raaka) => {
          const arvo = String(raaka).trim();
          if (arvo && !EMAIL_RE.test(arvo)) return { ok: false, viesti: 'Tarkista sähköpostiosoite.' };
          return { ok: true, arvo };
        },
        onTallenna: (arvo) => tallennaValmentaja({ email: arvo }),
      }),
    }),
    listRow({ otsikko: 'Viikkoraportti', arvo: 'Valmentajalle', href: '#/raportti' }));
}

// ---------------------------------------------------------------------------
// Tilaus ja työpaikka (speksi 4l D, mockup). Etuoperaattorit ovat maksutapoja, eivät kumppaneita:
// nimet tekstinä, ei logoja.

export const MAKSUTAVAT = [
  { arvo: 'liikuntaetu', otsikko: 'Liikuntaetu (ePassi, Smartum, Edenred)', kuvaus: 'Työnantajan liikunta- ja hyvinvointietu' },
  { arvo: 'kortti', otsikko: 'Kortti', kuvaus: 'Maksukortti' },
];
export const PREMIUM_TEKSTI = 'Personal SuperPower Premium – demo, ei oikeaa maksua';

/** maksutapaHuomio('liikuntaetu') → demon huomautus valinnan jälkeen; tuntematon tai puuttuva → null. */
export function maksutapaHuomio(maksutapa) {
  if (maksutapa === 'liikuntaetu') return 'Demo: tuotteessa maksu ohjataan etupalvelun kautta';
  if (maksutapa === 'kortti') return 'Demo: tuotteessa korttimaksu tehdään maksupalvelun kautta';
  return null;
}

/** tyopaikkaTeksti(yhteiso.tyopaikka, tanaan) → 'Esimerkki Oy · Kehitys' tai null (ei työpaikkaa). */
export function tyopaikkaTeksti(tyopaikka, tanaan) {
  if (!tyopaikka || typeof tyopaikka !== 'object') return null;
  const tiimi = workplaceDemo(tanaan).tiimit.find((t) => t.id === tyopaikka.tiimi);
  return [tyopaikka.yritys || 'Esimerkki Oy', tiimi ? tiimi.nimi : null].filter(Boolean).join(' · ');
}

function tallennaMaksutapa(arvo) {
  update((s) => {
    const t = s.tilaus && typeof s.tilaus === 'object' && !Array.isArray(s.tilaus) ? s.tilaus : {};
    s.tilaus = { ...t, maksutapa: arvo };
  });
}

function tilausOsio(s) {
  const maksutapa = s.tilaus && typeof s.tilaus === 'object' ? s.tilaus.maksutapa : undefined;
  const huomio = maksutapaHuomio(maksutapa);
  const tp = tyopaikkaTeksti(s.yhteiso && s.yhteiso.tyopaikka, tamaPaiva());
  return [
    lista(
      el('div', { class: 'row prof-row' },
        el('span', { class: 'row-title' }, 'Personal SuperPower Premium', el('span', { class: 'row-sub' }, 'Kuukausitilaus')),
        el('span', { class: 'yh-pill is-gold' }, 'Demo'))),
    el('p', { class: 'prof-pay-label', id: 'prof-maksutapa' }, 'Maksutapa'),
    el('div', { class: 'list pick-list', role: 'radiogroup', 'aria-labelledby': 'prof-maksutapa' },
      ...MAKSUTAVAT.map((m) => el('button', {
        class: 'row pick-row', type: 'button', role: 'radio', 'aria-checked': String(m.arvo === maksutapa),
        onClick: () => { if (m.arvo !== maksutapa) tallennaMaksutapa(m.arvo); },
      },
      el('span', { class: 'pick-text' },
        el('span', { class: 'pick-title' }, m.otsikko),
        el('span', { class: 'pick-desc' }, m.kuvaus)),
      el('span', { class: 'pick-radio', 'aria-hidden': 'true' })))),
    huomio ? el('p', { class: 'note prof-pay-note', role: 'status' }, huomio) : null,
    el('p', { class: 'muted small memory-note' }, PREMIUM_TEKSTI),
    tp ? el('div', { class: 'list prof-work' }, listRow({ otsikko: `Työpaikka: ${tp}`, href: '#/yhteiso?tab=haasteet' })) : null,
    tp ? el('p', { class: 'muted small memory-note' }, 'Demo: kuvitteellinen yritys. Työpaikkahaaste näkyy Yhteisön Haasteet-välilehdellä.') : null,
  ];
}

// Kodin kortti ja valmentajan siru avaavat tapahtumavalinnan osoitteella #/profiili?tapahtuma=1
// (valinnainen &tyyppi=…). Laatikko avataan kerran reitille tultaessa, ei tilan muutoksen
// uudelleenpiirrossa; reitin vaihto nollaa merkinnän.
let tapahtumaAvattu = false;
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => { tapahtumaAvattu = false; });
}

// ---------------------------------------------------------------------------
// Rivit

function toggleRivi(otsikko, arvo, onChange, { kuvaus, disabled } = {}) {
  const kytkin = toggle({ arvo, onChange, label: otsikko });
  if (disabled) kytkin.disabled = true;
  return el('div', { class: `row prof-row${disabled ? ' is-disabled' : ''}` },
    el('span', { class: 'row-title' }, otsikko, kuvaus ? el('span', { class: 'row-sub' }, kuvaus) : null),
    kytkin);
}

// pino: valitsin otsikon alle koko leveydelle (pitkät vaihtoehtotekstit, esim. teema).
function segmenttiRivi(otsikko, vaihtoehdot, arvo, onChange, { pino = false } = {}) {
  return el('div', { class: `row prof-row${pino ? ' is-stacked' : ''}` },
    el('span', { class: 'row-title' }, otsikko),
    el('div', { class: 'prof-seg' }, segmented({ vaihtoehdot, arvo, onChange, label: otsikko })));
}

function tulossaRivi(otsikko) {
  return el('div', { class: 'row prof-row is-soon', 'aria-disabled': 'true' },
    el('span', { class: 'row-title' }, otsikko),
    el('span', { class: 'soon-badge' }, 'Tulossa'));
}

function lista(...rivit) {
  return el('div', { class: 'list' }, ...rivit);
}

// ---------------------------------------------------------------------------
// Näkymä

export function render(root, params = {}) {
  let avausAjastin = null;
  if (params.tapahtuma === '1' && !tapahtumaAvattu) {
    tapahtumaAvattu = true;
    const tyyppi = TAPAHTUMATYYPIT.some((t) => t.id === params.tyyppi) ? params.tyyppi : undefined;
    // Avataan piirron jälkeen, jotta reitittimen kohdistus ja vieritys eivät osu laatikkoon.
    avausAjastin = setTimeout(() => {
      avausAjastin = null;
      if (!root.isConnected) return;
      const osio = root.querySelector('[data-osio="tapahtuma"]');
      if (osio) osio.scrollIntoView({ block: 'center' });
      avaaTapahtumaValinta({ ehdotus: tyyppi ? { tyyppi } : undefined });
    }, 0);
  }
  piirraProfiili(root);
  return () => { if (avausAjastin) clearTimeout(avausAjastin); };
}

function piirraProfiili(root) {
  const s = getState();
  const p = profiili();
  const aktiivinen = ohjelma(s.aktiivinenOhjelmaId);
  const nimi = String(p.nimi || '').trim() || OLETUSPROFIILI.nimi;
  const teemaArvo = s.asetukset ? s.asetukset.teema : null;
  const teema = teemaArvo === 'auto' ? 'auto'
    : teemaArvo === 'tumma' || teemaArvo === 'dark' ? 'tumma' : 'vaalea';

  root.append(
    el('div', { class: 'prof-top' },
      el('a', { class: 'back-btn', href: '#/koti', 'aria-label': 'Takaisin kotiin' }, backIcon()),
      el('span', { class: 'prof-top-title' }, 'Oma suunnitelma')),

    el('div', { class: 'prof-hero' },
      el('div', { class: 'prof-avatar', 'aria-hidden': 'true' }, nimi.charAt(0).toUpperCase()),
      el('div', { class: 'prof-hero-text' },
        el('h1', { class: 'prof-name' }, nimi),
        el('p', { class: 'muted small' }, `${aktiivinen.nimi} · ${nimiArvolle(KOKEMUKSET, p.kokemus)}`))),

    el('div', { class: 'list prof-goal' },
      listRow({ otsikko: 'Tavoite', arvo: nimiArvolle(TAVOITTEET, p.tavoite), onClick: () => avaaTavoiteValinta() })),
    el('p', { class: 'muted small prof-goal-hint' }, `Ohjaa treenejäsi: ${tavoiteHaarukka(p.tavoite)} (demon oletus).`),

    el('h2', { class: 'section-title', dataset: { osio: 'tapahtuma' } }, 'Tavoitetapahtuma'),
    tapahtumaOsio(p),

    sectionTitle('Valmentajani'),
    valmentajaOsio(p),
    el('p', { class: 'muted small memory-note' }, 'Tuotteessa valmentaja näkee asiakkaidensa raportit omassa näkymässään.'),

    sectionTitle('Salin laitteet'),
    lista(
      listRow({ otsikko: 'Salini laitteet', arvo: `${omatLaitteet(p).length}/${LAITTEET.length}`, onClick: () => avaaLaitteet() }),
      tulossaRivi('Sijainnit')),

    sectionTitle('Treeniprofiili'),
    lista(
      listRow({
        otsikko: 'Nimi',
        arvo: nimi,
        onClick: () => avaaTekstiSyote({
          otsikko: 'Nimi', label: 'Nimesi', arvo: String(p.nimi || ''),
          ohje: 'Näkyy tervehdyksissä ja valmentajan vastauksissa.',
          onTallenna: (arvo) => tallenna({ nimi: arvo || OLETUSPROFIILI.nimi }),
        }),
      }),
      listRow({
        otsikko: 'Kokemus',
        arvo: nimiArvolle(KOKEMUKSET, p.kokemus),
        onClick: () => valintaSheet({
          otsikko: 'Kokemus',
          selite: 'Kokemus vaikuttaa aloituspainoihin ja siihen, kuinka isoin askelin painot nousevat.',
          osiot: [{ vaihtoehdot: KOKEMUKSET }],
          arvo: p.kokemus,
          onValitse: (arvo) => tallenna({ kokemus: arvo }),
        }),
      }),
      listRow({
        otsikko: 'Kehonpaino',
        arvo: formatWeight(p.kehonpaino, p.yksikko),
        onClick: () => {
          const lb = p.yksikko === 'lb';
          const naytto = Number.isFinite(Number(p.kehonpaino))
            ? String(Math.round((lb ? p.kehonpaino * KG_LB : p.kehonpaino) * 10) / 10).replace('.', ',')
            : '';
          avaaTekstiSyote({
            otsikko: 'Kehonpaino',
            label: `Kehonpaino (${lb ? 'lb' : 'kg'})`,
            arvo: naytto,
            tyyppi: 'luku',
            yksikko: lb ? 'lb' : 'kg',
            ohje: 'Käytetään Treeniscoren viitearvoihin.',
            tarkista: (raaka) => {
              const n = Number(String(raaka).trim().replace(',', '.'));
              const kg = lb ? n / KG_LB : n;
              if (!String(raaka).trim() || !Number.isFinite(n) || kg < 30 || kg > 250) {
                return { ok: false, viesti: lb ? 'Anna paino väliltä 66–551 lb.' : 'Anna paino väliltä 30–250 kg.' };
              }
              return { ok: true, arvo: Math.round(kg * 10) / 10 };
            },
            onTallenna: (kg) => tallenna({ kehonpaino: kg }),
          });
        },
      }),
      tulossaRivi('Vammat ja rajoitteet')),

    sectionTitle('Treenin muoto'),
    lista(
      listRow({ otsikko: 'Ohjelma', arvo: aktiivinen.nimi, onClick: () => avaaOhjelmaValinta() }),
      listRow({
        otsikko: 'Treenejä viikossa',
        arvo: `${p.treenitViikossa} krt`,
        onClick: () => valintaSheet({
          otsikko: 'Treenejä viikossa',
          selite: 'Treenimäärä ohjaa ohjelmasuositusta ja viikon sarjatavoitteita.',
          osiot: [{
            vaihtoehdot: [2, 3, 4, 5, 6].map((n) => ({
              arvo: n,
              otsikko: `${n} kertaa viikossa`,
              kuvaus: `Suositus: ${ohjelma(suositeltuOhjelmaId(n)).nimi}`,
            })),
          }],
          arvo: p.treenitViikossa,
          onValitse: (n) => tallenna({ treenitViikossa: n }),
        }),
      }),
      listRow({
        otsikko: 'Treenin kesto',
        arvo: `${p.kesto} min`,
        onClick: () => valintaSheet({
          otsikko: 'Treenin kesto',
          selite: 'Sarjojen määrä per liike sovitetaan niin, että arvioitu kesto mahtuu aikaan.',
          osiot: [{ vaihtoehdot: KESTOT.map((k) => ({ arvo: k, otsikko: `${k} min` })) }],
          arvo: p.kesto,
          onValitse: (k) => tallenna({ kesto: k }),
        }),
      }),
      listRow({
        otsikko: 'Jako',
        arvo: nimiArvolle(JAOT, p.jako),
        onClick: () => valintaSheet({
          otsikko: 'Jako',
          selite: 'Automaattinen valitsee jaon treenimäärän mukaan. Oma valinta ohittaa suosituksen.',
          osiot: [{ vaihtoehdot: JAOT }],
          arvo: p.jako,
          onValitse: (arvo) => tallenna({ jako: arvo }),
        }),
      }),
      tulossaRivi('Venyttely'),
      tulossaRivi('Kardio'),
      tulossaRivi('Superset-sarjat'),
      tulossaRivi('Liikkeiden vaihtelevuus')),

    sectionTitle('Valmentajan muisti'),
    muistiLista(),
    el('p', { class: 'muted small memory-note' }, MUISTI_SELITE),

    sectionTitle('Tilaus'),
    ...tilausOsio(s),

    sectionTitle('Tietoa'),
    lista(listRow({ otsikko: 'Tietoa demosta ja ominaisuuksista', href: './ominaisuudet.html' })),

    sectionTitle('Asetukset'),
    lista(
      segmenttiRivi('Yksikkö', [{ arvo: 'kg', teksti: 'kg' }, { arvo: 'lb', teksti: 'lb' }], p.yksikko, (arvo) => tallenna({ yksikko: arvo })),
      segmenttiRivi('Viikon alku', [{ arvo: 'maanantai', teksti: 'Ma' }, { arvo: 'sunnuntai', teksti: 'Su' }], p.viikonAlku, (arvo) => update((st) => {
        // Liigan seuranta siirtyy kuluvaan viikkoon uudella viikonalulla (ei rolloveria vaihdosta).
        const uusi = vaihdaViikonAlku(st, arvo, new Date().toISOString());
        uusi.profiili = { ...OLETUSPROFIILI, ...uusi.profiili };
        return uusi;
      })),
      toggleRivi('Lämmittelysarjat', !!p.lammittelysarjat, (on) => tallenna({ lammittelysarjat: on }), { kuvaus: '2 kevyttä sarjaa ennen ensimmäistä painavaa liikettä' }),
      toggleRivi('Osallistun liigaan', !(s.liiga && s.liiga.osallistuu === false), (on) => asetaLiigaOsallistuminen(on),
        { kuvaus: 'Viikkoliiga Yhteisössä: tasapainotetut pisteet, kärkiviisikko nousee' }),
      toggleRivi('Palautusajastin', p.palautusajastin ?? false, (on) => update((st) => {
        st.profiili = { ...OLETUSPROFIILI, ...(st.profiili || {}), palautusajastin: on };
        // Pois kytkentä päättää käynnissä olevan tauon (kuten treenin yläpalkin kytkin).
        if (!on && st.kaynnissa) st.kaynnissa.palautusLoppuu = null;
      }), { kuvaus: 'Tauko alkaa, kun kuittaat sarjan' }),
      (p.palautusajastin ?? false) ? listRow({
        otsikko: 'Tauon pituus',
        arvo: palautusKestoTeksti(p.palautusKesto ?? 'tavoite'),
        onClick: () => valintaSheet({
          otsikko: 'Tauon pituus',
          selite: 'Tavoitteen mukaan tauko on liikkeen tavoitteen palautusaika. Kiinteä pituus koskee kaikkia sarjoja.',
          osiot: [{
            vaihtoehdot: [
              { arvo: 'tavoite', otsikko: `Tavoitteen mukaan (esim. ${goalParams(p.tavoite).palautusS} s)` },
              ...PALAUTUS_KESTOT.map((n) => ({ arvo: n, otsikko: `${n} s` })),
            ],
          }],
          arvo: p.palautusKesto ?? 'tavoite',
          onValitse: (arvo) => tallenna({ palautusKesto: arvo }),
        }),
      }) : null,
      segmenttiRivi('Teema', [
        { arvo: 'vaalea', teksti: 'Vaalea (oletus)' },
        { arvo: 'tumma', teksti: 'Tumma' },
        { arvo: 'auto', teksti: 'Automaattinen' },
      ], teema, (arvo) => update((st) => {
        st.asetukset = { ...(st.asetukset || {}), teema: arvo, teemaValittu: true };
      }), { pino: true }),
      el('button', { class: 'row prof-danger', type: 'button', onClick: () => avaaNollausVahvistus() },
        el('span', { class: 'row-title' }, 'Nollaa demo'))),
  );
}
