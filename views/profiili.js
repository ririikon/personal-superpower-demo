// Profiili ja oma suunnitelma (speksi 4c ja 6.6). Rakenne: korostettu Tavoite-rivi, jonka
// takana on oma valintanäkymä, ja sen alla ryhmitellyt osiot VÄLINEET, TREENIPROFIILI,
// TREENIN MUOTO, VALMENTAJAN MUISTI ja ASETUKSET. Jokainen muutos tallentuu heti update()-
// kutsulla, ja reititin piirtää näkymän uudelleen statechange-tapahtumasta.
//
// Vie myös apurit, joita aloitusohjaus ja valmentaja käyttävät (tavoitteet, kokemustasot,
// ohjelmasuositus, valintalaatikko ja Valmentajan muisti).

import { getState, update, resetDemo } from '../store.js?v=270067f';
import { OHJELMAT, OLETUSPROFIILI } from '../data.js?v=270067f';
import { goalParams } from '../engine/progression.js?v=270067f';
import { tanaanPvm } from '../seed.js?v=270067f';
import { el, svgEl, sectionTitle, listRow, sheet, toggle, segmented, formatWeight } from './ui.js?v=270067f';
import { PALAUTUS_KESTOT } from './treeni-input.js?v=270067f';

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

const VALINEET = [
  { arvo: 'levytanko', otsikko: 'Levytanko' },
  { arvo: 'käsipainot', otsikko: 'Käsipainot' },
  { arvo: 'laitteet', otsikko: 'Laitteet' },
  { arvo: 'taljat', otsikko: 'Taljat' },
  { arvo: 'kehonpaino', otsikko: 'Kehonpaino' },
];

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

function ohjelma(id) {
  return OHJELMAT.find((o) => o.id === id) || OHJELMAT[0];
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
      vaihtoehdot: OHJELMAT.map((o) => ({
        arvo: o.id,
        otsikko: o.nimi,
        kuvaus: `${o.paivat.length} treenipäivää kierrossa.`,
        merkki: o.id === suositus ? 'Suositeltu' : null,
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
    inputmode: tyyppi === 'luku' ? 'decimal' : null,
    autocomplete: 'off',
    maxlength: tyyppi === 'luku' ? 6 : 40,
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

export function render(root) {
  const s = getState();
  const p = profiili();
  const aktiivinen = ohjelma(s.aktiivinenOhjelmaId);
  const nimi = String(p.nimi || '').trim() || OLETUSPROFIILI.nimi;
  const valineet = Array.isArray(p.valineet) ? p.valineet : [];
  const teemaArvo = s.asetukset ? s.asetukset.teema : null;
  const teema = teemaArvo === 'auto' ? 'auto'
    : teemaArvo === 'tumma' || teemaArvo === 'dark' ? 'tumma' : 'vaalea';

  const vaihdaValine = (valine, paalla) => {
    const nyky = new Set(valineet);
    if (paalla) nyky.add(valine);
    else nyky.delete(valine);
    tallenna({ valineet: VALINEET.map((v) => v.arvo).filter((v) => nyky.has(v)) });
  };

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

    sectionTitle('Välineet'),
    lista(
      ...VALINEET.map((v) => toggleRivi(v.otsikko, valineet.includes(v.arvo), (on) => vaihdaValine(v.arvo, on), { disabled: !!p.vainKehonpaino })),
      toggleRivi('Vain kehonpaino', !!p.vainKehonpaino, (on) => tallenna({ vainKehonpaino: on }), { kuvaus: 'Liikkeet ilman välineitä' }),
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

    sectionTitle('Asetukset'),
    lista(
      segmenttiRivi('Yksikkö', [{ arvo: 'kg', teksti: 'kg' }, { arvo: 'lb', teksti: 'lb' }], p.yksikko, (arvo) => tallenna({ yksikko: arvo })),
      segmenttiRivi('Viikon alku', [{ arvo: 'maanantai', teksti: 'Ma' }, { arvo: 'sunnuntai', teksti: 'Su' }], p.viikonAlku, (arvo) => tallenna({ viikonAlku: arvo })),
      toggleRivi('Lämmittelysarjat', !!p.lammittelysarjat, (on) => tallenna({ lammittelysarjat: on }), { kuvaus: '2 kevyttä sarjaa ennen ensimmäistä painavaa liikettä' }),
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
