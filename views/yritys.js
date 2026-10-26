// Työnantajan näkymä (speksi 4l D, #/yritys, mockup). Kootut, anonyymit luvut keksitystä
// Esimerkki Oy:stä engine/workplace.js:n employerDashboard-funktiosta: osallistumisaste, aktiivisten
// osuus, viikkotreenien keskiarvon muutos ja tiimien tasapainotettu järjestys. Alle viiden hengen
// ryhmistä ei näytetä lukuja. Näkymässä ei ole yhtään yksittäisen henkilön tietoa.
import { getState } from '../store.js?v=19a48e7';
import { employerDashboard, PIILOTETTU_TEKSTI, VAHIMMAISRYHMA } from '../engine/workplace.js?v=19a48e7';
import { el, svgEl, sectionTitle } from './ui.js?v=19a48e7';

export const YKSITYISYYS_TEKSTI = 'Työnantaja näkee vain kootut, anonyymit luvut – ei yksittäisen työntekijän tietoja.';
export const TUOTE_TEKSTI = 'Tuotteessa: yrityksen hallinta, haasteiden luonti ja raportointi';

function desimaali(n) {
  return String(Math.round((Number(n) || 0) * 10) / 10).replace('.', ',');
}

/** muutosTeksti(3) → '+3 %', muutosTeksti(-8) → '−8 %', muutosTeksti(0) → '±0 %', null → '–'. */
export function muutosTeksti(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '–';
  const x = Math.round(Number(n));
  if (x > 0) return `+${x} %`;
  if (x < 0) return `−${-x} %`;
  return '±0 %';
}

/**
 * tiimiRivit(dashboard) → [{ id, nimi, naytetaan, sija, tulos, teksti, tiedot: [teksti] }]
 * Näytettävät tiimit järjestyksessä (sija, tasapainotettu tulos) ja niiden perään alle
 * vähimmäisryhmäkoon tiimit tekstillä "alle 5 – ei näytetä" ilman yhtään lukua.
 */
export function tiimiRivit(dashboard) {
  const tiimit = (dashboard && Array.isArray(dashboard.tiimit)) ? dashboard.tiimit : [];
  const jarjestys = (dashboard && Array.isArray(dashboard.jarjestys)) ? dashboard.jarjestys : [];
  const naytetyt = jarjestys.map((j) => tiimit.find((t) => t.id === j.id)).filter(Boolean).map((t) => ({
    id: t.id,
    nimi: t.nimi,
    naytetaan: true,
    sija: t.sija,
    tulos: t.tulos,
    teksti: `${t.tulos} %`,
    tiedot: [
      `Osallistuu ${t.osallistumisaste} %`,
      `Aktiivisia ${t.aktiivistenOsuus} %`,
      `${desimaali(t.viikkotreenitKa)} treeniä/vk (${muutosTeksti(t.viikkotreenitMuutos)})`,
    ],
  }));
  const piilotetut = tiimit.filter((t) => !t.naytetaan).map((t) => ({
    id: t.id, nimi: t.nimi, naytetaan: false, sija: null, tulos: null, teksti: t.teksti || PIILOTETTU_TEKSTI, tiedot: [],
  }));
  return [...naytetyt, ...piilotetut];
}

function lukkoIkoni() {
  return svgEl('svg', { viewBox: '0 0 24 24', width: 26, height: 26, 'aria-hidden': 'true', class: 'tp-ico' },
    ...['M6.5 11h11v9h-11z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'].map((d) => svgEl('path', {
      d, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    })));
}

function luku(otsikko, arvo, ali) {
  return el('div', { class: 'yh-stat tp-stat' },
    el('span', { class: 'yh-stat-label' }, otsikko),
    el('span', { class: 'yh-stat-value' }, arvo),
    ali ? el('span', { class: 'tp-stat-sub' }, ali) : null);
}

export function render(root) {
  const state = getState() || {};
  const d = employerDashboard(state, new Date().toISOString());
  const k = d.kokonaisuus;
  const haaste = state.yhteiso && state.yhteiso.tyopaikka && Array.isArray(state.yhteiso.haasteet)
    ? state.yhteiso.haasteet.find((h) => h && h.id === state.yhteiso.tyopaikka.haasteId) : null;
  const rivit = tiimiRivit(d);

  root.append(
    el('a', { class: 't8-back', href: '#/yhteiso?tab=haasteet' }, '‹ Yhteisö'),
    el('header', { class: 'yh-head tp-head' },
      el('div', null,
        el('div', { class: 't8-eyebrow t8-eyebrow-accent' }, `${d.yritys}${haaste ? ` · ${haaste.nimi}` : ''}`),
        el('h1', { class: 'page-title yh-title' }, 'Työnantajan näkymä')),
      el('span', { class: 'demo-badge' }, 'Demo: kuvitteellinen yritys')),

    el('section', { class: 'tp-privacy', role: 'note' },
      el('span', { class: 'tp-privacy-ico' }, lukkoIkoni()),
      el('p', { class: 'tp-privacy-text' }, YKSITYISYYS_TEKSTI)),

    sectionTitle('Koko yritys'),
    el('section', { class: 'yh-stats tp-stats' },
      luku('Osallistumisaste', `${k.osallistumisaste} %`, `${k.osallistujia}/${k.tyontekijoita} työntekijää mukana`),
      luku('Aktiivisia', `${k.aktiivistenOsuus} %`, 'vähintään 1 treeni viikossa'),
      luku('Treenejä viikossa', desimaali(k.viikkotreenitKa), 'keskimäärin osallistujaa kohden'),
      luku('Muutos', muutosTeksti(k.viikkotreenitMuutos), 'edelliseen 4 viikkoon')),
    el('p', { class: 'muted small tp-note tp-total-note' }, `${k.huomio}.`),

    sectionTitle('Tiimien järjestys'),
    el('ol', { class: 'card tp-teams', 'aria-label': 'Tiimien tasapainotettu järjestys' },
      ...rivit.map((r) => el('li', { class: `tp-team${r.naytetaan ? '' : ' is-hidden'}` },
        el('span', { class: 'tp-team-rank' }, r.naytetaan ? String(r.sija) : '–'),
        el('span', { class: 'tp-team-main' },
          el('span', { class: 'tp-team-name' }, r.nimi),
          r.tiedot.length
            ? el('span', { class: 'tp-team-facts' }, ...r.tiedot.map((t) => el('span', null, t)))
            : el('span', { class: 'tp-team-facts' }, el('span', null, 'Liian pieni ryhmä raportoitavaksi'))),
        el('span', { class: 'tp-team-value' }, r.teksti)))),
    el('p', { class: 'muted small tp-note' },
      `Tiimin tulos on jäsenten tasapainotettujen tulosten keskiarvo, joten tiimin koko tai kunto ei ratkaise. `
      + `Vähimmäisryhmäkoko on ${VAHIMMAISRYHMA}: pienemmistä ryhmistä ei näytetä lukuja.`),

    el('p', { class: 'yk-product-note tp-product' }, TUOTE_TEKSTI),
    el('p', { class: 'yh-demo-note tp-demo' }, 'Demo: Esimerkki Oy, sen tiimit ja luvut ovat keksittyjä.'),
  );
}
