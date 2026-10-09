// Aloitusohjaus (speksi 4c ja 6.7): nimi ja tavoite → kokemus → treenit viikossa →
// kehonpaino → suositeltu ohjelma perusteluineen ja Aloita. "Kokeile esimerkkiprofiililla"
// ohittaa vaiheet. Lopuksi päivitetään vain profiili ja aktiivinen ohjelma sekä
// onboardattu = true; esimerkkihistoria säilyy.
//
// Keskeneräiset vastaukset pidetään moduulin muuttujassa, jotta ne säilyvät, jos reititin
// piirtää näkymän uudelleen statechange-tapahtumasta.

import { getState, update } from '../store.js?v=270067f';
import { OHJELMAT, OLETUSPROFIILI } from '../data.js?v=270067f';
import { el, svgEl } from './ui.js?v=270067f';
import {
  TAVOITTEET, KOKEMUKSET, nimiArvolle, tavoiteHaarukka, suositeltuOhjelmaId, suosituksenPerustelu,
} from './profiili.js?v=270067f';

const VAIHEITA = 5; // 4 kysymystä + suositus
const PAINO_MIN = 30;
const PAINO_MAX = 250;

let luonnos = null;

function alkuLuonnos() {
  const p = { ...OLETUSPROFIILI, ...((getState() && getState().profiili) || {}) };
  return {
    vaihe: 0,
    nimi: p.nimi && p.nimi !== OLETUSPROFIILI.nimi ? p.nimi : '',
    tavoite: p.tavoite,
    kokemus: p.kokemus,
    treenitViikossa: p.treenitViikossa,
    kehonpaino: String(p.kehonpaino).replace('.', ','),
  };
}

function ohjelma(id) {
  return OHJELMAT.find((o) => o.id === id) || OHJELMAT[0];
}

function jasennaPaino(raaka) {
  const s = String(raaka || '').trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < PAINO_MIN || n > PAINO_MAX) return null;
  return Math.round(n * 10) / 10;
}

function backIcon() {
  return svgEl('svg', { viewBox: '0 0 24 24', width: 24, height: 24, 'aria-hidden': 'true' },
    svgEl('path', { d: 'M15 4.5 7.5 12l7.5 7.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

function valmis(esimerkki) {
  const l = luonnos || alkuLuonnos();
  update((s) => {
    if (esimerkki) {
      s.profiili = structuredClone(OLETUSPROFIILI);
      s.aktiivinenOhjelmaId = suositeltuOhjelmaId(OLETUSPROFIILI.treenitViikossa);
    } else {
      s.profiili = {
        ...OLETUSPROFIILI,
        ...(s.profiili || {}),
        nimi: l.nimi.trim() || OLETUSPROFIILI.nimi,
        tavoite: l.tavoite,
        kokemus: l.kokemus,
        treenitViikossa: l.treenitViikossa,
        kehonpaino: jasennaPaino(l.kehonpaino) ?? OLETUSPROFIILI.kehonpaino,
      };
      s.aktiivinenOhjelmaId = suositeltuOhjelmaId(l.treenitViikossa);
    }
    s.onboardattu = true;
  });
  luonnos = null;
  // replace: Takaisin ei saa palauttaa aloitusohjaukseen (se ylikirjoittaisi profiilin).
  location.replace('#/koti');
}

// Valintarivit (otsikko, kuvaus, valintaympyrä).
function valinnat(vaihtoehdot, arvo, onValitse, label) {
  return el('div', { class: 'list pick-list', role: 'radiogroup', 'aria-label': label },
    ...vaihtoehdot.map((v) => el('button', {
      class: 'row pick-row',
      type: 'button',
      role: 'radio',
      'aria-checked': String(v.arvo === arvo),
      onClick: () => onValitse(v.arvo),
    },
    el('span', { class: 'pick-text' },
      el('span', { class: 'pick-title' }, v.otsikko),
      v.kuvaus ? el('span', { class: 'pick-desc' }, v.kuvaus) : null),
    el('span', { class: 'pick-radio', 'aria-hidden': 'true' }))));
}

export function render(root) {
  if (!luonnos) luonnos = alkuLuonnos();
  const l = luonnos;

  function siirry(vaihe) {
    l.vaihe = Math.max(0, Math.min(VAIHEITA - 1, vaihe));
    piirra();
    window.scrollTo(0, 0);
    const otsikko = root.querySelector('.onb-title');
    if (otsikko) otsikko.focus({ preventScroll: true });
  }

  function piirra() {
    const vaihe = l.vaihe;
    let sisalto;
    let paaNappi;

    if (vaihe === 0) {
      const nimiSyote = el('input', {
        class: 'input onb-input', type: 'text', id: 'onb-nimi', autocomplete: 'given-name',
        maxlength: 40, placeholder: 'Etunimi', value: l.nimi,
      });
      nimiSyote.addEventListener('input', () => { l.nimi = nimiSyote.value; });
      sisalto = [
        el('label', { class: 'onb-label', for: 'onb-nimi' }, 'Nimesi (valinnainen)'),
        nimiSyote,
        el('p', { class: 'onb-label onb-label-gap' }, 'Tavoitteesi'),
        valinnat(TAVOITTEET.map((t) => ({ arvo: t.arvo, otsikko: t.otsikko, kuvaus: t.kuvaus })), l.tavoite, (arvo) => {
          l.tavoite = arvo;
          piirra();
        }, 'Tavoite'),
        el('p', { class: 'muted small onb-hint' }, `${nimiArvolle(TAVOITTEET, l.tavoite)}: ${tavoiteHaarukka(l.tavoite)} (demon oletus).`),
      ];
      paaNappi = el('button', { class: 'btn btn-primary', type: 'button', onClick: () => siirry(1) }, 'Jatka');
    } else if (vaihe === 1) {
      sisalto = [
        valinnat(KOKEMUKSET, l.kokemus, (arvo) => { l.kokemus = arvo; piirra(); }, 'Kokemus'),
      ];
      paaNappi = el('button', { class: 'btn btn-primary', type: 'button', onClick: () => siirry(2) }, 'Jatka');
    } else if (vaihe === 2) {
      sisalto = [
        el('div', { class: 'onb-counts', role: 'radiogroup', 'aria-label': 'Treenejä viikossa' },
          ...[2, 3, 4, 5, 6].map((n) => el('button', {
            class: 'onb-count',
            type: 'button',
            role: 'radio',
            'aria-checked': String(n === l.treenitViikossa),
            'aria-label': `${n} kertaa viikossa`,
            onClick: () => { l.treenitViikossa = n; piirra(); },
          }, String(n)))),
        el('p', { class: 'onb-count-label muted' }, 'kertaa viikossa'),
        el('div', { class: 'note onb-note' },
          el('strong', null, 'Suositus: '),
          ohjelma(suositeltuOhjelmaId(l.treenitViikossa)).nimi),
      ];
      paaNappi = el('button', { class: 'btn btn-primary', type: 'button', onClick: () => siirry(3) }, 'Jatka');
    } else if (vaihe === 3) {
      const syote = el('input', {
        class: 'input onb-weight', type: 'text', inputmode: 'decimal', id: 'onb-paino',
        autocomplete: 'off', maxlength: 5, value: l.kehonpaino, 'aria-describedby': 'onb-paino-ohje',
      });
      const jatka = el('button', { class: 'btn btn-primary', type: 'button', onClick: () => siirry(4) }, 'Jatka');
      const tarkista = () => {
        const ok = jasennaPaino(l.kehonpaino) !== null;
        jatka.disabled = !ok;
        if (ok) syote.removeAttribute('aria-invalid');
        else syote.setAttribute('aria-invalid', 'true');
      };
      const askel = (d) => {
        const nyky = jasennaPaino(l.kehonpaino) ?? OLETUSPROFIILI.kehonpaino;
        const uusi = Math.min(PAINO_MAX, Math.max(PAINO_MIN, Math.round((nyky + d) * 10) / 10));
        l.kehonpaino = String(uusi).replace('.', ',');
        syote.value = l.kehonpaino;
        tarkista();
      };
      syote.addEventListener('input', () => { l.kehonpaino = syote.value; tarkista(); });
      syote.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !jatka.disabled) siirry(4); });
      sisalto = [
        el('div', { class: 'onb-stepper' },
          el('button', { class: 'onb-step-btn', type: 'button', 'aria-label': 'Vähennä kilo', onClick: () => askel(-1) }, '−'),
          el('label', { class: 'onb-weight-wrap', for: 'onb-paino' }, syote, el('span', { class: 'onb-unit' }, 'kg')),
          el('button', { class: 'onb-step-btn', type: 'button', 'aria-label': 'Lisää kilo', onClick: () => askel(1) }, '+')),
        el('p', { class: 'muted small onb-hint onb-center', id: 'onb-paino-ohje' }, `Käytetään Treeniscoren viitearvoihin. Sallittu väli ${PAINO_MIN}–${PAINO_MAX} kg.`),
      ];
      paaNappi = jatka;
      queueMicrotask(tarkista);
    } else {
      const suositus = ohjelma(suositeltuOhjelmaId(l.treenitViikossa));
      sisalto = [
        el('div', { class: 'card onb-program' },
          el('span', { class: 'onb-badge' }, 'Suositeltu ohjelma'),
          el('h2', { class: 'card-title' }, suositus.nimi),
          el('p', { class: 'muted' }, suositus.kuvaus),
          el('ul', { class: 'onb-days' }, ...suositus.paivat.map((p) => el('li', null, `${p.nimi} · ${p.liikkeet.length} liikettä`)))),
        el('div', { class: 'note onb-note' }, el('strong', null, 'Miksi tämä? '), suosituksenPerustelu(l.treenitViikossa)),
        el('div', { class: 'list onb-summary' },
          el('div', { class: 'row' }, el('span', { class: 'row-title' }, 'Tavoite'), el('span', { class: 'row-value' }, nimiArvolle(TAVOITTEET, l.tavoite))),
          el('div', { class: 'row' }, el('span', { class: 'row-title' }, 'Haarukat'), el('span', { class: 'row-value' }, tavoiteHaarukka(l.tavoite))),
          el('div', { class: 'row' }, el('span', { class: 'row-title' }, 'Kokemus'), el('span', { class: 'row-value' }, nimiArvolle(KOKEMUKSET, l.kokemus))),
          el('div', { class: 'row' }, el('span', { class: 'row-title' }, 'Kehonpaino'), el('span', { class: 'row-value' }, `${String(jasennaPaino(l.kehonpaino) ?? OLETUSPROFIILI.kehonpaino).replace('.', ',')} kg`))),
        el('p', { class: 'muted small onb-hint' }, 'Kaikkea voi muuttaa myöhemmin profiilissa.'),
      ];
      paaNappi = el('button', { class: 'btn btn-primary', type: 'button', onClick: () => valmis(false) }, 'Aloita');
    }

    const otsikot = [
      ['Tervetuloa!', 'Kerro nimesi ja mihin tähtäät, niin rakennan treenisi sen mukaan.'],
      ['Kuinka kokenut olet?', 'Kokemus vaikuttaa aloituspainoihin ja siihen, kuinka nopeasti painot nousevat.'],
      ['Montako treeniä viikossa?', 'Valitse määrä, johon pystyt sitoutumaan tavallisella viikolla.'],
      ['Paljonko painat?', 'Kehonpainon avulla voimaa voi verrata viitearvoihin.'],
      ['Suunnitelmasi on valmis', 'Tämä ohjelma sopii vastauksiisi parhaiten.'],
    ][vaihe];

    root.replaceChildren(el('div', { class: 'onb' },
      el('div', { class: 'onb-top' },
        vaihe > 0
          ? el('button', { class: 'back-btn', type: 'button', 'aria-label': 'Edellinen vaihe', onClick: () => siirry(vaihe - 1) }, backIcon())
          : el('span', { class: 'onb-brand' }, 'Personal SuperPower'),
        el('div', { class: 'onb-dots', role: 'progressbar', 'aria-label': 'Aloitusohjauksen eteneminen', 'aria-valuemin': 1, 'aria-valuemax': VAIHEITA, 'aria-valuenow': vaihe + 1 },
          ...Array.from({ length: VAIHEITA }, (_, i) => el('span', { class: `onb-dot${i < vaihe ? ' is-done' : ''}${i === vaihe ? ' is-current' : ''}` })))),
      el('p', { class: 'onb-kicker' }, vaihe < VAIHEITA - 1 ? `Vaihe ${vaihe + 1}/${VAIHEITA - 1}` : 'Valmista'),
      el('h1', { class: 'page-title onb-title', tabindex: '-1' }, otsikot[0]),
      el('p', { class: 'muted onb-lead' }, otsikot[1]),
      el('div', { class: 'onb-body' }, ...sisalto),
      el('div', { class: 'onb-actions' },
        paaNappi,
        el('button', { class: 'btn btn-ghost onb-skip', type: 'button', onClick: () => valmis(true) }, 'Kokeile esimerkkiprofiililla'))));
  }

  piirra();
}
