// Ohjelmat (speksi 6.3, 4f, 4k D): ohjelmakortit, ohjelman sisältö (päivät ja liikkeet, ▶ Näytä liike)
// ja "Ota käyttöön", joka asettaa aktiivinenOhjelmaId:n. Sisältö: #/ohjelmat?id=<ohjelmaId>.
// "Tuo ohjelma" (mockup): tiedosto tai esimerkkitiedosto → "Tunnistetaan…" → esikatselu, jossa
// luottamusmerkit ja korjattavat rivit → "Tallenna ohjelmaksi" (omatOhjelmat, merkintä "Tuotu").
import { getState, update } from '../store.js?v=19a48e7';
import { LIIKKEET, ESIMERKKITUONTI, liike as haeLiike } from '../data.js?v=19a48e7';
import { matchImportedExercises, importedToProgram } from '../engine/import.js?v=19a48e7';
import { el, svgEl, sectionTitle, sheet } from './ui.js?v=19a48e7';
import { openExerciseSheet } from './media.js?v=19a48e7';
import { kaikkiOhjelmat } from './paiva.js?v=19a48e7';

// Natiivi append ei litistä taulukoita eikä ohita null-arvoja, joten ne käsitellään tässä.
function lisaa(root, ...osat) {
  root.append(...osat.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false));
}

const iso = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

// Näkyy ohjelmasivulla seuraavan piirron ajan "Ota käyttöön" -painalluksen jälkeen.
let juuriOtettu = null;
// Näkyy listassa seuraavan piirron ajan tuodun ohjelman tallennuksen jälkeen.
let juuriTuotu = null;

const TUNNISTUS_MS = 2000;
const TIEDOSTOT = 'image/*,.pdf,.xlsx,.xls,.csv';
const LUOTTAMUS = {
  korkea: { teksti: 'Varma', luokka: 'is-high' },
  keskitaso: { teksti: 'Todennäköinen', luokka: 'is-mid' },
  matala: { teksti: 'Tarkista', luokka: 'is-low' },
  korjattu: { teksti: 'Valittu', luokka: 'is-fixed' },
};

function chevron() {
  return svgEl('svg', { class: 'chevron', viewBox: '0 0 8 14', width: 8, height: 14, 'aria-hidden': 'true' },
    svgEl('path', { d: 'M1.5 1.5 6.5 7l-5 5.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

function playIkoni() {
  return svgEl('svg', { viewBox: '0 0 24 24', width: 14, height: 14, 'aria-hidden': 'true' },
    svgEl('path', { d: 'M8 5.5v13l10.5-6.5z', fill: 'currentColor' }));
}

function tuontiIkoni() {
  return svgEl('svg', { viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': 'true', class: 't8-ico' },
    svgEl('path', { d: 'M12 15.5V4M7.5 8.5 12 4l4.5 4.5M4.5 14.5v4a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
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

function otaKayttoon(id) {
  juuriOtettu = id;
  update((s) => { s.aktiivinenOhjelmaId = id; });
}

function toistoTeksti(r) {
  return r.toistoMin === r.toistoMax ? `${r.toistoMin}` : `${r.toistoMin}–${r.toistoMax}`;
}

// --- Lista -------------------------------------------------------------------

function ohjelmaStatit(o) {
  return el('div', { class: 't8-stats' },
    el('div', { class: 't8-stat' }, el('span', { class: 't8-stat-val' }, String(o.paivat.length)), el('span', { class: 't8-stat-lbl' }, 'päivää')),
    el('div', { class: 't8-stat' }, el('span', { class: 't8-stat-val' }, String(liikkeita(o))), el('span', { class: 't8-stat-lbl' }, 'liikettä')),
    el('div', { class: 't8-stat' }, el('span', { class: 't8-stat-val' }, `~${keskikesto(o)}`), el('span', { class: 't8-stat-lbl' }, 'min / treeni')));
}

// Tuotu ohjelma: kortissa "Tuotu"-merkki ja "Ota käyttöön" -painike (painike ei voi olla linkin sisällä).
function tuotuKortti(o, aktiivinen) {
  const onAktiivinen = o.id === aktiivinen;
  return el('div', { class: `card t8-program im-program${onAktiivinen ? ' is-active' : ''}` },
    el('a', { class: 'im-program-link', href: `#/ohjelmat?id=${encodeURIComponent(o.id)}` },
      el('div', { class: 't8-program-top' },
        el('span', { class: 't8-pill im-pill' }, 'Tuotu'),
        onAktiivinen ? el('span', { class: 't8-pill t8-pill-accent' }, 'Käytössä') : null),
      el('div', { class: 't8-program-row' },
        el('div', { class: 't8-program-body' },
          el('h2', { class: 't8-program-title' }, o.nimi),
          el('p', { class: 't8-program-desc' }, o.kuvaus)),
        chevron()),
      ohjelmaStatit(o)),
    onAktiivinen ? null : el('button', {
      class: 'btn btn-primary im-use', type: 'button', onClick: () => otaKayttoon(o.id),
    }, 'Ota käyttöön'));
}

function lista(root, state) {
  const aktiivinen = state.aktiivinenOhjelmaId;
  const suositus = suositeltu(state.profiili);
  const kaikki = kaikkiOhjelmat(state);
  const tuodut = kaikki.filter((o) => o.tuotu);
  const valmiit = kaikki.filter((o) => !o.tuotu);
  const tallennettu = juuriTuotu && tuodut.find((o) => o.id === juuriTuotu);
  juuriTuotu = null;
  lisaa(root,
    el('a', { class: 't8-back', href: '#/koti' }, '‹ Koti'),
    el('h1', { class: 'page-title t8-page-title-tight' }, 'Ohjelmat'),
    el('p', { class: 't8-lead' }, 'Valitse runko. Tavoitteesi säätää toistot, sarjat ja palautukset jokaiseen treeniin.'),
    el('button', { class: 'card t8-link-card im-open', type: 'button', onClick: () => avaaTuonti() },
      el('span', { class: 't8-link-ico' }, tuontiIkoni()),
      el('span', { class: 't8-link-body' },
        el('span', { class: 't8-eyebrow' }, 'Tuo ohjelma'),
        el('span', { class: 't8-link-title' }, 'PT:n ohjelma sovellukseen'),
        el('span', { class: 't8-link-sub' }, 'Kuva, PDF tai Excel. Sarjat ja toistot säilyvät.')),
      chevron()),
    tallennettu
      ? el('div', { class: 'note t8-confirm', role: 'status' },
        el('strong', null, 'Ohjelma tallennettu. '),
        `${tallennettu.nimi} on listalla merkinnällä Tuotu. Ota se käyttöön, niin Kodin treeni seuraa PT:n sarjoja ja toistoja.`)
      : null,
    tuodut.length ? [sectionTitle('Tuodut ohjelmat'), el('div', { class: 't8-programs' }, tuodut.map((o) => tuotuKortti(o, aktiivinen)))] : null,
    tuodut.length ? sectionTitle('Valmiit ohjelmat') : null,
    el('div', { class: 't8-programs' }, valmiit.map((o) => {
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
        ohjelmaStatit(o));
    })),
  );
}

// --- Sisältö -----------------------------------------------------------------

function liikeRivi(r) {
  const l = haeLiike(r.liikeId);
  const nimi = l ? l.nimi : r.liikeId;
  return el('div', { class: 't8-ex-row' },
    el('a', { class: 't8-ex-row-main', href: `#/liike/${encodeURIComponent(r.liikeId)}` },
      el('span', { class: 't8-ex-row-name' }, nimi),
      el('span', { class: 't8-ex-row-sub' }, `${r.sarjat} × ${toistoTeksti(r)} · palautus ${r.palautusS} s`)),
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
      ohjelma.tuotu ? el('span', { class: 't8-pill im-pill' }, 'Tuotu') : el('span', { class: 't8-pill' }, iso(ohjelma.tasot)),
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
    el('p', { class: 'muted small t8-footnote' }, ohjelma.tuotu
      ? 'Sarjat ja toistot tulevat PT:n ohjelmasta, ja ne säilyvät treenissä. Palautus ja RIR tulevat tavoitteestasi.'
      : 'Sarjat, toistot ja palautukset ovat ohjelman oletuksia (demon oletus). Treeniä aloitettaessa tavoitteesi säätää ne.'),
    onAktiivinen
      ? el('div', { class: 't8-cta' }, el('a', { class: 'btn btn-primary', href: '#/koti' }, 'Käytössä · Siirry kotiin'))
      : el('div', { class: 't8-cta' }, el('button', {
        class: 'btn btn-primary',
        type: 'button',
        onClick: () => otaKayttoon(ohjelma.id),
      }, 'Ota käyttöön')),
  );
}

// --- Tuonti (speksi 4k D, mockup) --------------------------------------------------

function luottamusMerkki(r) {
  const tieto = r.korjattu ? LUOTTAMUS.korjattu : (LUOTTAMUS[r.liikeId ? r.luottamus : 'matala'] || LUOTTAMUS.matala);
  return el('span', { class: `im-conf ${tieto.luokka}` }, tieto.teksti);
}

// Hakuvalinta liikekirjastosta (sisäkkäinen alalaatikko). onValitse(liikeId).
function avaaLiikehaku({ nimi, onValitse }) {
  let kahva = null;
  const tulokset = el('div', { class: 'list im-search-list' });
  const syote = el('input', {
    class: 'input prof-input', type: 'search', placeholder: 'Hae liikettä', 'aria-label': 'Hae liikettä',
    autocomplete: 'off', enterkeyhint: 'search', onInput: () => piirra(),
  });
  const normal = (s) => String(s || '').toLocaleLowerCase('fi-FI').trim();
  function piirra() {
    const q = normal(syote.value);
    const osumat = LIIKKEET.filter((l) => !q || normal(`${l.nimi} ${l.lihasryhma} ${l.id.replace(/-/g, ' ')}`).includes(q));
    tulokset.replaceChildren(...(osumat.length ? osumat.map((l) => el('button', {
      class: 'row', type: 'button',
      onClick: () => { onValitse(l.id); kahva.close(); },
    }, el('span', { class: 'row-title' }, l.nimi), el('span', { class: 'row-value' }, iso(l.lihasryhma)))) : [
      el('div', { class: 'row' }, el('span', { class: 'row-title muted' }, `Ei osumia haulla ”${syote.value.trim()}”.`)),
    ]));
  }
  piirra();
  kahva = sheet(el('div', { class: 'pick-sheet im-search' },
    el('h2', { class: 'sheet-title' }, 'Valitse vastaava liike'),
    el('p', { class: 'muted small' }, `Tiedostossa: ${nimi}`),
    syote,
    tulokset));
  setTimeout(() => { if (syote.isConnected) syote.focus({ preventScroll: true }); }, 60);
  return kahva;
}

function luku(raaka, min, max) {
  const n = Math.round(Number(String(raaka).trim()));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

// Alalaatikko: valinta → tunnistus (noin 2 s) → esikatselu → tallennus.
function avaaTuonti() {
  const runko = el('div', { class: 'pick-sheet im-sheet' });
  let ajastin = null;
  let kahva = null;
  let rivit = [];
  let nimi = ESIMERKKITUONTI.nimi;

  const ilmoitus = () => el('div', { class: 'note im-notice' }, ESIMERKKITUONTI.ilmoitus);

  function valinta() {
    const tiedosto = el('input', {
      class: 'im-file-input', type: 'file', accept: TIEDOSTOT,
      onChange: (e) => {
        const f = e.target.files && e.target.files[0];
        if (f) tunnistus(f.name);
      },
    });
    runko.replaceChildren(
      el('h2', { class: 'sheet-title' }, 'Tuo ohjelma'),
      el('p', { class: 'muted' }, 'Tuo PT:n ohjelma kuvasta, PDF:stä tai Excelistä. Tunnistetut liikkeet sovitetaan liikekirjastoon, ja voit tarkistaa rivit ennen tallennusta.'),
      el('label', { class: 'btn btn-primary im-file' }, tiedosto, 'Valitse tiedosto'),
      el('p', { class: 'muted small im-file-types' }, 'Kuva, PDF, xlsx, xls tai csv'),
      el('button', { class: 'btn im-sample', type: 'button', onClick: () => tunnistus(ESIMERKKITUONTI.tiedosto) }, 'Kokeile esimerkkitiedostolla'),
      ilmoitus());
  }

  function tunnistus(tiedostonimi) {
    runko.replaceChildren(
      el('h2', { class: 'sheet-title' }, 'Tunnistetaan…'),
      el('div', { class: 'im-scan', role: 'status', 'aria-live': 'polite' },
        el('div', { class: 'im-scan-doc', 'aria-hidden': 'true' },
          el('span', { class: 'im-scan-line' }), el('span', { class: 'im-scan-line' }), el('span', { class: 'im-scan-line' }),
          el('span', { class: 'im-scan-line' }), el('span', { class: 'im-scan-beam' })),
        el('p', { class: 'im-scan-file' }, tiedostonimi),
        el('p', { class: 'muted small' }, 'Luetaan päivät, liikkeet, sarjat ja toistot…')),
      ilmoitus());
    clearTimeout(ajastin);
    ajastin = setTimeout(() => {
      ajastin = null;
      if (!runko.isConnected) return;
      // Demo: tunnistus näyttää aina esimerkkiohjelman.
      rivit = matchImportedExercises(ESIMERKKITUONTI.rivit).map((r) => ({ ...r, korjattu: false }));
      esikatselu();
    }, TUNNISTUS_MS);
  }

  function riviNakyma(r, i) {
    const liike = r.liikeId ? haeLiike(r.liikeId) : null;
    const sarjat = el('input', {
      class: 'tr-input im-num', type: 'text', inputmode: 'numeric', value: r.sarjat ?? '', placeholder: '3',
      'aria-label': `Sarjat: ${r.nimi}`, maxlength: 2,
      onInput: (e) => { rivit[i].sarjat = luku(e.target.value, 1, 10); },
    });
    const toistot = el('input', {
      class: 'tr-input im-num', type: 'text', inputmode: 'numeric', value: r.toistot ?? '', placeholder: '10',
      'aria-label': `Toistot: ${r.nimi}`, maxlength: 3,
      onInput: (e) => { rivit[i].toistot = luku(e.target.value, 1, 50); rivit[i].toistoMax = null; },
    });
    const valitse = () => avaaLiikehaku({
      nimi: r.rivi,
      onValitse: (id) => {
        rivit[i] = { ...rivit[i], liikeId: id, korjattu: true };
        esikatselu();
      },
    });
    return el('div', { class: `im-row${r.liikeId ? '' : ' is-unknown'}${!r.korjattu && r.liikeId && r.luottamus !== 'korkea' ? ' is-check' : ''}` },
      el('div', { class: 'im-row-head' },
        el('span', { class: 'im-row-name' }, liike ? liike.nimi : r.nimi),
        luottamusMerkki(r)),
      el('p', { class: 'im-row-src' }, `Tiedostossa: ${r.rivi}`),
      liike
        ? null
        : el('button', { class: 'btn im-pick', type: 'button', onClick: valitse }, 'Valitse vastaava liike'),
      el('div', { class: 'im-row-sets' },
        el('label', { class: 'im-set' }, sarjat, el('span', { class: 'muted small' }, 'sarjaa')),
        el('span', { class: 'im-x', 'aria-hidden': 'true' }, '×'),
        el('label', { class: 'im-set' }, toistot, el('span', { class: 'muted small' }, 'toistoa')),
        liike ? el('button', { class: 'im-change', type: 'button', onClick: valitse }, 'Vaihda liike') : null));
  }

  function esikatselu() {
    const paivat = [];
    rivit.forEach((r, i) => {
      let p = paivat.find((x) => x.nimi === r.paiva);
      if (!p) paivat.push(p = { nimi: r.paiva, rivit: [] });
      p.rivit.push(riviNakyma(r, i));
    });
    const tuntemattomia = rivit.filter((r) => !r.liikeId).length;
    const virhe = el('p', { class: 'prof-input-error', role: 'alert', hidden: true });
    const nimiSyote = el('input', {
      class: 'input prof-input', type: 'text', value: nimi, maxlength: 40, 'aria-label': 'Ohjelman nimi',
      onInput: (e) => { nimi = e.target.value; },
    });
    const y = runko.closest('.sheet') ? runko.closest('.sheet').scrollTop : 0;
    runko.replaceChildren(...[
      el('h2', { class: 'sheet-title' }, 'Tunnistettu ohjelma'),
      ilmoitus(),
      el('label', { class: 'prof-input-label im-name-label' }, 'Ohjelman nimi'),
      nimiSyote,
      el('p', { class: 'muted small im-summary' },
        `${paivat.length} päivää · ${rivit.length} riviä`
        + (tuntemattomia ? ` · ${tuntemattomia} ${tuntemattomia === 1 ? 'rivi tarvitsee' : 'riviä tarvitsee'} vastaavan liikkeen` : ' · kaikki rivit tunnistettu')),
      ...paivat.map((p) => [sectionTitle(p.nimi), el('div', { class: 'list im-list' }, ...p.rivit)]),
      tuntemattomia ? el('p', { class: 'muted small im-skip-note' }, 'Rivit ilman vastaavaa liikettä jäävät pois ohjelmasta.') : null,
      virhe,
      el('div', { class: 'prof-confirm' },
        el('button', {
          class: 'btn btn-primary', type: 'button',
          onClick: () => {
            const ohjelma = importedToProgram(rivit, nimi);
            if (!ohjelma) {
              virhe.textContent = 'Ohjelmassa ei ole yhtään tunnistettua liikettä.';
              virhe.hidden = false;
              return;
            }
            juuriTuotu = ohjelma.id;
            update((s) => {
              const omat = Array.isArray(s.omatOhjelmat) ? s.omatOhjelmat : [];
              s.omatOhjelmat = [...omat.filter((o) => o && o.id !== ohjelma.id), ohjelma];
            });
            kahva.close();
          },
        }, 'Tallenna ohjelmaksi'),
        el('button', { class: 'btn', type: 'button', onClick: () => valinta() }, 'Aloita alusta')),
    ].flat(Infinity).filter(Boolean));
    const paneeli = runko.closest('.sheet');
    if (paneeli) paneeli.scrollTop = y;
  }

  valinta();
  kahva = sheet(runko, { label: 'Tuo ohjelma' });
  return kahva;
}

export function render(root, params = {}) {
  const state = getState() || {};
  const id = params.id;
  if (id) {
    const ohjelma = kaikkiOhjelmat(state).find((o) => o.id === id);
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
