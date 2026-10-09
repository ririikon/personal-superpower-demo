// Viikon sarjatavoitteet (speksi 4d, 4h): kuusikulmiorengas, ryhmäkortit, jotka avautuvat
// lihasriveiksi, ja "Muokattu viikko" -merkintä, kun hyväksytty viikkosuunnitelma on voimassa.
import { getState } from '../store.js?v=270067f';
import { tanaanPvm } from '../seed.js?v=270067f';
import { LIIKKEET, RYHMAT } from '../data.js?v=270067f';
import { el, svgEl, hexRing, whyButton, segmented } from './ui.js?v=270067f';
import { weeklyTargets, weeklyProgress } from '../engine/targets.js?v=270067f';
import { weekStart, addDays } from '../engine/util.js?v=270067f';

// Natiivi append ei litistä taulukoita eikä ohita null-arvoja, joten ne käsitellään tässä.
function lisaa(root, ...osat) {
  root.append(...osat.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false));
}

const RYHMA_NIMI = { tyonnot: 'Työnnöt', vedot: 'Vedot', jalat: 'Jalat' };
const RYHMA_VARI = { tyonnot: 'var(--push)', vedot: 'var(--pull)', jalat: 'var(--legs)' };
const iso = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const pv = (pvm) => `${Number(pvm.slice(8, 10))}.${Number(pvm.slice(5, 7))}.`;
const desimaali = (n) => String(n).replace('.', ',');

const MIKSI = 'Viikoittaisten työsarjojen määrä lihasryhmää kohden on yksi edistymisen keskeisistä ajureista. '
  + 'Tavoite on volyymihaarukka: riittävästi työtä kehittymiseen, mutta niin, että palautumiselle jää tilaa.'
  + '\n\nTavoite muodostuu profiilistasi. Perustaso tulee tavoitteesta (esim. lihasmassa 12 sarjaa), kokemus kertoo sen '
  + '(aloittelija 0,75, keskitaso 1,0, kokenut 1,25), ja pienet lihakset (hauis, ojentajat, pohkeet, vatsa) saavat kertoimen 0,75, '
  + 'koska ne saavat työtä myös isoista liikkeistä. Lopuksi kokonaismäärä mahdutetaan treeniaikaasi (noin 3 min sarjaa kohden).'
  + '\n\nVain liikkeen päälihasryhmä kerryttää tavoitetta, eikä lämmittelysarjoja lasketa. Prosentissa ylitys yhdessä lihaksessa ei paikkaa vajetta toisessa.'
  + '\n\nLuvut ovat demon oletuksia. Tuotteessa tekoäly personoi ne.';

// Kun ryhmäkortti avataan, tila säilyy uudelleenpiirrossa.
const auki = new Set();
let valittuViikko = 'tama';

function suunnitelmaViikolle(suunnitelmat, alku) {
  const loppu = addDays(alku, 7);
  return suunnitelmat.find((s) => s && s.viikonAlku === alku)
    || suunnitelmat.find((s) => s && (s.paivat || []).some((p) => p.pvm >= alku && p.pvm < loppu))
    || null;
}

function chevronAlas() {
  return svgEl('svg', { class: 't8-group-chev', viewBox: '0 0 14 8', width: 14, height: 8, 'aria-hidden': 'true' },
    svgEl('path', { d: 'M1.5 1.5 7 6.5l5.5-5', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

function ryhmaKortti(avain, ryhma, lihakset) {
  const id = `t8-group-${avain}`;
  const onAuki = auki.has(avain);
  const valmis = ryhma.tavoite > 0 && ryhma.jaljella === 0;
  const rivit = el('div', { class: 't8-group-rows', id, hidden: !onAuki },
    RYHMAT[avain].map((lihas) => {
      const m = lihakset[lihas] || { tehty: 0, tavoite: 0, jaljella: 0 };
      const pros = m.tavoite > 0 ? Math.min(100, Math.round((m.tehty / m.tavoite) * 100)) : 0;
      return el('div', { class: 't8-muscle' },
        el('div', { class: 't8-muscle-top' },
          el('span', { class: 't8-muscle-name' }, iso(lihas)),
          el('span', { class: 't8-muscle-val' }, `${m.tehty} / ${m.tavoite}`),
          el('span', { class: `t8-muscle-left${m.jaljella === 0 ? ' is-done' : ''}` }, m.jaljella === 0 ? 'Valmis' : `${m.jaljella} jäljellä`)),
        el('div', { class: 't8-bar', role: 'presentation' },
          el('span', { class: 't8-bar-fill', style: `width:${pros}%;background:${RYHMA_VARI[avain]}` })));
    }));
  const nappi = el('button', {
    class: 't8-group-head',
    type: 'button',
    'aria-expanded': String(onAuki),
    'aria-controls': id,
  },
  hexRing({ segmentit: [{ pros: ryhma.pros, vari: RYHMA_VARI[avain] }], koko: 46 }),
  el('span', { class: 't8-group-text' },
    el('span', { class: 't8-group-title' }, RYHMA_NIMI[avain]),
    el('span', { class: 't8-group-sub' }, `${ryhma.tehty} / ${ryhma.tavoite} sarjaa`)),
  el('span', { class: `t8-group-left${valmis ? ' is-done' : ''}` },
    valmis ? 'Valmis' : el('span', null, el('b', null, String(ryhma.jaljella)), ' jäljellä')),
  chevronAlas());
  const kortti = el('section', { class: `card t8-group${onAuki ? ' is-open' : ''}` }, nappi, rivit);
  nappi.addEventListener('click', () => {
    const avataan = !auki.has(avain);
    if (avataan) auki.add(avain);
    else auki.delete(avain);
    rivit.hidden = !avataan;
    nappi.setAttribute('aria-expanded', String(avataan));
    kortti.classList.toggle('is-open', avataan);
  });
  return kortti;
}

function sisalto(state, tanaan, alku, suunnitelma) {
  const historia = (state.historia || []).filter(Boolean);
  const tavoitteet = weeklyTargets(state.profiili || {}, suunnitelma);
  const edistys = weeklyProgress(historia, LIIKKEET, tavoitteet, alku);
  const kertoimet = (suunnitelma && suunnitelma.sarjatavoiteKertoimet) || {};
  const muutokset = Object.entries(kertoimet)
    .filter(([k, v]) => RYHMA_NIMI[k] && typeof v === 'number' && v !== 1)
    .map(([k, v]) => `${RYHMA_NIMI[k].toLowerCase()} × ${desimaali(v)}`);

  const legenda = el('div', { class: 't8-legend' }, ['tyonnot', 'vedot', 'jalat'].map((k) => el('div', { class: 't8-legend-item' },
    el('span', { class: 't8-legend-dot', style: `background:${RYHMA_VARI[k]}` }),
    el('span', { class: 't8-legend-name' }, RYHMA_NIMI[k]),
    el('span', { class: 't8-legend-val' }, `${edistys.ryhmat[k].pros} %`))));

  return [
    el('section', { class: 'card t8-ring-card' },
      el('div', { class: 't8-ring-wrap' },
        hexRing({
          segmentit: ['tyonnot', 'vedot', 'jalat'].map((k) => ({ pros: edistys.ryhmat[k].pros, vari: RYHMA_VARI[k] })),
          keskiteksti: `${edistys.kokonaisPros} %`,
          koko: 196,
        })),
      el('div', { class: 't8-ring-caption' }, 'viikon sarjoista tehty'),
      legenda),
    suunnitelma
      ? el('div', { class: 'note t8-plan-note' },
        el('strong', null, 'Muokattu viikko. '),
        muutokset.length ? `Valmentajan suunnitelma: ${muutokset.join(', ')}. ` : 'Valmentajan suunnitelma on voimassa. ',
        suunnitelma.perustelu ? suunnitelma.perustelu : '')
      : null,
    el('div', { class: 't8-groups' },
      ['tyonnot', 'vedot', 'jalat'].map((k) => ryhmaKortti(k, edistys.ryhmat[k], edistys.lihakset))),
  ];
}

export function render(root) {
  const state = getState() || {};
  const profiili = state.profiili || {};
  const tanaan = tanaanPvm(new Date().toISOString());
  const viikonAlku = profiili.viikonAlku === 'sunnuntai' ? 'sunnuntai' : 'maanantai';
  const tamaAlku = weekStart(tanaan, viikonAlku);
  const ensiAlku = addDays(tamaAlku, 7);
  const suunnitelmat = state.viikkosuunnitelmat || [];
  const tamaSuunnitelma = suunnitelmaViikolle(suunnitelmat, tamaAlku);
  const ensiSuunnitelma = suunnitelmaViikolle(suunnitelmat, ensiAlku);
  const naytaValitsin = !!ensiSuunnitelma && ensiSuunnitelma !== tamaSuunnitelma;
  if (!naytaValitsin) valittuViikko = 'tama';

  const alue = el('div', { class: 't8-goals-body' });
  const otsikkoVali = el('span', null);
  const merkinta = el('span', { class: 't8-pill t8-pill-accent', hidden: true }, 'Muokattu viikko');

  function piirra() {
    const ensi = valittuViikko === 'ensi';
    const alku = ensi ? ensiAlku : tamaAlku;
    const suunnitelma = ensi ? ensiSuunnitelma : tamaSuunnitelma;
    otsikkoVali.textContent = `${pv(alku)}–${pv(addDays(alku, 6))}`;
    merkinta.hidden = !suunnitelma;
    alue.replaceChildren(...sisalto(state, tanaan, alku, suunnitelma).filter(Boolean));
  }

  lisaa(root, 
    el('a', { class: 't8-back', href: '#/koti' }, '‹ Koti'),
    el('h1', { class: 'page-title t8-page-title-tight' }, 'Viikon sarjatavoitteet'),
    el('div', { class: 't8-subhead' }, otsikkoVali, merkinta),
    naytaValitsin
      ? el('div', { class: 't8-week-switch' }, segmented({
        vaihtoehdot: [{ arvo: 'tama', teksti: 'Tämä viikko' }, { arvo: 'ensi', teksti: 'Ensi viikko' }],
        arvo: valittuViikko,
        label: 'Viikko',
        onChange: (v) => { valittuViikko = v; piirra(); },
      }))
      : null,
    alue,
    el('div', { class: 't8-why-row' },
      whyButton(MIKSI),
      el('span', { class: 'muted small' }, 'Luvut ovat demon oletuksia.')),
  );
  piirra();
}
