// Treeni-näkymä (speksi 6.2, 4c, 4b-2, 4f, 4h): aloitus, sarjojen kirjaus, ehdotuskortti,
// palautusajastin ja lopetus. Näkymä päivittää itsensä (omaPaivitys), jotta syötekenttien
// kohdistus säilyy; render palauttaa siivousfunktion, joka purkaa ajastimen ja kuuntelijan.
import { getState, update } from '../store.js';
import { tanaanPvm } from '../seed.js';
import { LIIKKEET, liike as haeLiike } from '../data.js';
import { suggestNextSet, recovery, round25, onTyosarja } from '../engine.js';
import { el, sectionTitle, sheet, whyButton, formatWeight } from './ui.js';
import { parseSet } from './treeni-input.js';
import { rakennaPaiva, liikkeenKerrat, onKehonpaino, LAMMITTELY, LAMMITTELY_PALAUTUS_S } from './paiva.js';

export const omaPaivitys = true;

const KG_LB = 2.20462;
// Yli 4 h sitten aloitettu treeni on jäänyt auki (demon oletus); kesto tuntemattomana 60 min.
export const KESKEN_RAJA_MS = 4 * 60 * 60 * 1000;
const OLETUSKESTO_S = 60 * 60;
const RIR_VALINNAT = [0, 1, 2, 3, 4];
const SYY_NIMET = {
  'double-progression': 'Kaksoisprogressio',
  'rir-high': 'RIR-autoregulaatio',
  'rir-zero': 'RIR-autoregulaatio',
  deload: 'Kevennys',
  'first-time': 'Ensimmäinen kerta',
  recovery: 'Palautuminen',
  hold: 'Toistovaihe',
};
const SUUNNITELMA_TYYPIT = { treeni: 'Salitreeni', laji: 'Lajipäivä', lepo: 'Lepopäivä', matka: 'Matkatreeni' };

// Syötekenttien luonnokset muistissa (ei tallenneta): `${treeniId}:${liikeIndeksi}` → luonnos.
const luonnokset = new Map();
// Avoin liikekortti: { id: treeniId, i: indeksi } (-1 = kaikki kiinni).
let avoin = { id: null, i: null };

// ---------------------------------------------------------------------------
// Apurit

function mmss(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function aikaMs(iso) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function lukuTeksti(n) {
  return String(n).replace('.', ',');
}

function isoAlku(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Kilot → syötekentän arvo näyttöyksikössä (lb 0,5:n tarkkuudella, kuten syötteen jäsennys vaatii).
function kenttaArvo(kg, yksikko) {
  if (yksikko === 'lb') return lukuTeksti(Math.round(kg * KG_LB * 2) / 2);
  return lukuTeksti(kg);
}

// Syöte näyttöyksikössä → tallennettavat kilot. lb-arvo pyöristetään 2,5 kg:aan (round25),
// joten hyväksytty ehdotus tallentuu täsmälleen ehdotetuksi kilomääräksi.
function kiloiksi(arvo, yksikko) {
  return yksikko === 'lb' ? round25(arvo / KG_LB) : arvo;
}

// Treenin painoteksti: lb-arvo näytetään samalla 0,5 lb:n tarkkuudella kuin syötekenttään
// hyväksytty arvo, jotta ehdotus, kenttä ja kirjattu sarja näyttävät saman luvun.
function painoNaytto(kg, yksikko) {
  if (yksikko === 'lb') return `${kenttaArvo(kg, yksikko)} lb`;
  return formatWeight(kg, yksikko);
}

function painoTeksti(kg, yksikko, liike) {
  if (onKehonpaino(liike)) return kg > 0 ? `+${painoNaytto(kg, yksikko)}` : 'Kehonpaino';
  return painoNaytto(kg, yksikko);
}

function tavoiteTeksti(t) {
  const rir = Number.isFinite(t.rirMin) && Number.isFinite(t.rirMax) ? ` · RIR ${t.rirMin}–${t.rirMax}` : '';
  return `${t.sarjat} × ${t.toistoMin}–${t.toistoMax}${rir}`;
}

function tyoSarjaMaara(tl) {
  return (tl.sarjat || []).filter(onTyosarja).length;
}

function lammittelyMaara(tl) {
  return (tl.sarjat || []).filter((s) => !onTyosarja(s)).length;
}

function avaaLiike(liike) {
  if (!liike) return;
  import('./media.js')
    .then((m) => { if (m && typeof m.openExerciseSheet === 'function') m.openExerciseSheet(liike); })
    .catch(() => {});
}

function naytaLiikeNappi(liike) {
  return el('button', {
    class: 'tr-show', type: 'button', 'aria-label': `Näytä liike: ${liike ? liike.nimi : ''}`,
    onClick: (e) => { e.stopPropagation(); avaaLiike(liike); },
  }, el('span', { 'aria-hidden': 'true' }, '▶'), ' Näytä liike');
}

// ---------------------------------------------------------------------------
// Näkymä

export function render(root) {
  let lopetetaan = false;
  let konteksti = { id: null };

  // Treenin aikainen laskentakonteksti: aiemmat kerrat ja palautumistila treenin alussa.
  function haeKonteksti(state, k) {
    if (konteksti.id === k.id && konteksti.historia === state.historia) return konteksti;
    const historia = Array.isArray(state.historia) ? state.historia : [];
    const alku = k.aloitus || new Date().toISOString();
    konteksti = {
      id: k.id,
      historia: state.historia,
      kerrat: new Map(),
      tilat: recovery(LIIKKEET, historia, alku).lihakset,
    };
    for (const tl of k.liikkeet || []) {
      if (!konteksti.kerrat.has(tl.liikeId)) konteksti.kerrat.set(tl.liikeId, liikkeenKerrat(historia, tl.liikeId));
    }
    return konteksti;
  }

  function luonnos(k, i) {
    const avain = `${k.id}:${i}`;
    if (!luonnokset.has(avain)) luonnokset.set(avain, { paino: '', toistot: '', rir: null, virheet: {} });
    return luonnokset.get(avain);
  }

  function oletusAvoin(k) {
    const liikkeet = k.liikkeet || [];
    const i = liikkeet.findIndex((tl) => tyoSarjaMaara(tl) < ((tl.tavoite && tl.tavoite.sarjat) || 3));
    return i >= 0 ? i : Math.max(0, liikkeet.length - 1);
  }

  function avoinIndeksi(k) {
    if (avoin.id !== k.id || avoin.i === null) avoin = { id: k.id, i: oletusAvoin(k) };
    return avoin.i;
  }

  // --- Piirto ---------------------------------------------------------------

  function piirra() {
    const state = getState() || {};
    const k = state.kaynnissa;
    const aktiivinen = document.activeElement;
    const fokus = aktiivinen && root.contains(aktiivinen) && aktiivinen.dataset ? aktiivinen.dataset.fokus : null;
    const valinta = fokus && typeof aktiivinen.selectionStart === 'number'
      ? [aktiivinen.selectionStart, aktiivinen.selectionEnd] : null;
    const y = window.scrollY;

    root.replaceChildren(k ? kaynnissaNakyma(state, k) : aloitusNakyma(state));

    if (fokus) {
      const kohde = root.querySelector(`[data-fokus="${CSS.escape(fokus)}"]`);
      if (kohde) {
        kohde.focus({ preventScroll: true });
        if (valinta && typeof kohde.setSelectionRange === 'function') {
          try { kohde.setSelectionRange(valinta[0], valinta[1]); } catch { /* ei tuettu */ }
        }
      }
    }
    window.scrollTo(0, y);
    paivitaAjat();
  }

  // --- Aloitus ----------------------------------------------------------------

  function aloitusNakyma(state) {
    const nyt = new Date().toISOString();
    const p = rakennaPaiva(state, nyt);
    const profiili = state.profiili || {};
    const sisalto = [];

    sisalto.push(
      el('p', { class: 'tr-overline' }, `Tämän päivän treeni · ${p.ohjelma.nimi}`),
      el('h1', { class: 'page-title tr-start-title' }, p.paiva.nimi),
      el('p', { class: 'tr-start-meta muted' },
        `${p.rivit.length} liikettä · noin ${p.arvioMin} min · tavoite: ${profiili.tavoite || 'lihasmassa'}`),
    );

    if (p.suunnitelma) {
      const s = p.suunnitelma;
      sisalto.push(el('div', { class: 'note tr-plan-note' },
        el('p', { class: 'tr-note-title' }, `Viikkosuunnitelma: ${SUUNNITELMA_TYYPIT[s.tyyppi] || s.tyyppi}`),
        s.huomio ? el('p', null, s.huomio) : null,
        Array.isArray(s.valineet) && s.valineet.length
          ? el('p', { class: 'small muted' }, `Välineet tänään: ${s.valineet.join(', ')}. Liikkeet on vaihdettu niihin sopiviksi.`)
          : null,
        s.tyyppi === 'lepo' || s.tyyppi === 'laji'
          ? el('p', { class: 'small muted' }, 'Voit silti treenata, jos olo on hyvä.')
          : null));
    }

    // Palautumishuomautus: päivän päälihasryhmistä väsyneet.
    const lihakset = [];
    for (const r of p.rivit) if (!lihakset.includes(r.liike.lihasryhma)) lihakset.push(r.liike.lihasryhma);
    const vasyneet = lihakset.filter((l) => p.tilat[l] && p.tilat[l].tila === 'väsynyt');
    if (vasyneet.length) {
      const kuvaus = vasyneet.map((l) => `${isoAlku(l)} ${p.tilat[l].palautuminenPros} %`).join(', ');
      sisalto.push(el('div', { class: 'note tr-recovery-note' },
        el('p', { class: 'tr-note-title' }, 'Palautuminen kesken'),
        el('p', null, `${kuvaus}. ${vasyneet.length > 1 ? 'Nämä lihakset ovat vielä väsyneitä' : 'Lihas on vielä väsynyt'} edellisestä treenistä, joten ehdotukset eivät nosta ${vasyneet.length > 1 ? 'niiden' : 'sen'} painoja tänään.`),
        whyButton('Jokaisen lihasryhmän väsymys lasketaan viimeisen 96 tunnin sarjoista. Päälihasryhmänä sarja painaa 1, toissijaisena 0,5.\n\n'
          + 'Suurempi volyymi vaatii pidemmän palautumisen: alle 6 sarjaa 48 h, 6–10 sarjaa 72 h ja yli 10 sarjaa 96 h. Alle 50 % palautunut lihas on väsynyt.\n\n'
          + 'Arvot ovat demon oletuksia. Tuotteessa tekoäly personoi ne.')));
    }

    sisalto.push(sectionTitle('Liikkeet'));
    const lista = el('ol', { class: 'tr-plan list' });
    p.rivit.forEach((r, i) => {
      const alkup = r.vaihdettu ? haeLiike(r.vaihdettu) : null;
      lista.append(el('li', { class: 'tr-plan-row' },
        el('span', { class: 'tr-num', 'aria-hidden': 'true' }, String(i + 1)),
        el('div', { class: 'tr-plan-main' },
          el('span', { class: 'tr-plan-name' }, r.liike.nimi),
          el('span', { class: 'tr-plan-sub' },
            `${tavoiteTeksti(r.tavoite)} · palautus ${r.tavoite.palautusS} s`
            + (r.lammittelyt.length ? ` · +${r.lammittelyt.length} lämmittelyä` : '')),
          alkup ? el('span', { class: 'tr-plan-swap' }, `Vaihdettu: ${alkup.nimi} (väline ei käytössä)`) : null),
        naytaLiikeNappi(r.liike)));
    });
    sisalto.push(lista);
    sisalto.push(el('p', { class: 'tr-fine muted' },
      `Sarjamäärät on sovitettu ${p.kestoMin} minuuttiin. Toistohaarukka, sarjat ja palautus tulevat tavoitteestasi (demon oletukset).`));

    sisalto.push(el('div', { class: 'tr-actionbar' },
      el('button', { class: 'btn btn-primary tr-start-btn', type: 'button', onClick: aloita }, 'Aloita treeni')));
    return el('div', { class: 'tr-view tr-start' }, ...sisalto);
  }

  function aloita() {
    const state = getState();
    if (state.kaynnissa) {
      piirra();
      return;
    }
    const nyt = new Date().toISOString();
    const p = rakennaPaiva(state, nyt);
    const k = {
      id: `t-${Date.now().toString(36)}`,
      aloitus: nyt,
      pvm: tanaanPvm(nyt),
      ohjelmaId: p.ohjelma.id,
      paivaNimi: p.paiva.nimi,
      tyyppi: 'voima',
      lahde: 'psp',
      liikkeet: p.rivit.map((r) => {
        const { sarjatMin, ...tavoite } = r.tavoite;
        const tl = { liikeId: r.liikeId, tavoite, sarjat: [] };
        if (r.lammittelyt.length) tl.lammittelyt = r.lammittelyt;
        if (r.vaihdettu) tl.vaihdettu = r.vaihdettu;
        return tl;
      }),
      ehdotukset: [],
      palautusLoppuu: null,
    };
    avoin = { id: k.id, i: 0 };
    window.scrollTo(0, 0);
    update((s) => { s.kaynnissa = k; });
  }

  // --- Käynnissä oleva treeni ------------------------------------------------

  function kaynnissaNakyma(state, k) {
    const ctx = haeKonteksti(state, k);
    const profiili = state.profiili || {};
    const yksikko = profiili.yksikko === 'lb' ? 'lb' : 'kg';
    const liikkeet = Array.isArray(k.liikkeet) ? k.liikkeet : [];
    const auki = avoinIndeksi(k);
    const alku = aikaMs(k.aloitus);

    const otsake = el('header', { class: 'tr-top' },
      el('div', { class: 'tr-top-info' },
        el('span', { class: 'tr-top-title' }, k.paivaNimi || 'Treeni'),
        el('span', { class: 'tr-top-time', dataset: { aika: '' }, 'aria-label': 'Treenin kesto' },
          alku !== null ? mmss(Date.now() - alku) : '00:00')),
      el('button', { class: 'btn tr-stop', type: 'button', onClick: lopetaYlapalkista }, 'Lopeta'));

    const kortit = liikkeet.map((tl, i) => liikeKortti(state, k, tl, i, i === auki, ctx, profiili, yksikko));

    return el('div', { class: 'tr-view tr-running' },
      otsake,
      el('div', { class: 'tr-list' }, ...kortit),
      liikkeet.length
        ? el('button', { class: 'btn tr-finish', type: 'button', onClick: lopeta }, 'Lopeta treeni')
        : el('p', { class: 'muted' }, 'Treenissä ei ole liikkeitä.'),
      lepoPalkki(k));
  }

  function liikeKortti(state, k, tl, i, onAuki, ctx, profiili, yksikko) {
    const liike = haeLiike(tl.liikeId);
    const nimi = liike ? liike.nimi : tl.liikeId;
    const tavoite = tl.tavoite || { sarjat: 3, toistoMin: 8, toistoMax: 12, palautusS: 90 };
    const tehty = tyoSarjaMaara(tl);
    const valmis = tehty >= tavoite.sarjat;

    const otsikko = el('div', { class: 'tr-ex-head' },
      el('button', {
        class: 'tr-ex-toggle', type: 'button', 'aria-expanded': String(onAuki),
        onClick: () => {
          avoin = { id: k.id, i: onAuki ? -1 : i };
          piirra();
        },
      },
      el('span', { class: `tr-num${valmis ? ' is-done' : ''}`, 'aria-hidden': 'true' }, valmis ? '✓' : String(i + 1)),
      el('span', { class: 'tr-ex-name' }, nimi),
      el('span', { class: 'tr-ex-count' }, `${tehty}/${tavoite.sarjat}`)),
      naytaLiikeNappi(liike));

    const kortti = el('section', { class: `tr-ex${onAuki ? ' is-open' : ''}${valmis ? ' is-done' : ''}` }, otsikko);
    if (!onAuki) return kortti;

    const runko = el('div', { class: 'tr-ex-body' });
    runko.append(el('p', { class: 'tr-goal' }, el('span', { class: 'tr-goal-label' }, 'Tavoite '), tavoiteTeksti(tavoite)));
    if (tl.vaihdettu) {
      const alkup = haeLiike(tl.vaihdettu);
      runko.append(el('p', { class: 'tr-plan-swap' }, `Vaihdettu: ${alkup ? alkup.nimi : tl.vaihdettu} (väline ei käytössä)`));
    }

    // Kirjatut sarjat.
    if ((tl.sarjat || []).length) {
      let tyoNro = 0;
      let lamNro = 0;
      runko.append(el('ol', { class: 'tr-sets' }, ...tl.sarjat.map((s) => {
        const lammittely = !onTyosarja(s);
        const nro = lammittely ? `L${++lamNro}` : String(++tyoNro);
        return el('li', { class: `tr-set${lammittely ? ' is-warmup' : ''}` },
          el('span', { class: 'tr-set-no' }, nro),
          el('span', { class: 'tr-set-main' }, `${painoTeksti(s.paino, yksikko, liike)} × ${s.toistot}`),
          el('span', { class: 'tr-set-rir' }, lammittely ? 'lämmittely' : (Number.isFinite(s.rir) ? `RIR ${s.rir >= 4 ? '4+' : s.rir}` : '')),
          el('span', { class: 'tr-set-ok', 'aria-label': 'kuitattu' }, '✓'));
      })));
    }

    const lammittelyja = lammittelyMaara(tl);
    const lammittelyVaihe = Array.isArray(tl.lammittelyt) && tl.lammittelyt.length && !tl.lammittelyOhitettu
      && tehty === 0 && lammittelyja < tl.lammittelyt.length;

    if (lammittelyVaihe) {
      runko.append(lammittelyRivi(k, tl, i, lammittelyja, liike, yksikko));
    } else {
      const ehdotus = suggestNextSet({
        liike,
        tavoite,
        edellisetKerrat: ctx.kerrat.get(tl.liikeId) || [],
        tamanKerranSarjat: tl.sarjat || [],
        kokemus: profiili.kokemus,
        lihasTila: liike && ctx.tilat[liike.lihasryhma] ? ctx.tilat[liike.lihasryhma].tila : undefined,
      });
      runko.append(ehdotusKortti(k, tl, i, ehdotus, liike, yksikko));
      runko.append(syottoRivi(k, tl, i, ehdotus, liike, yksikko, tehty, tavoite));
    }

    kortti.append(runko);
    return kortti;
  }

  function lammittelyRivi(k, tl, i, nro, liike, yksikko) {
    const l = tl.lammittelyt[nro];
    const osuus = Math.round(LAMMITTELY[nro] ? LAMMITTELY[nro].osuus * 100 : 50);
    return el('div', { class: 'tr-warm' },
      el('p', { class: 'tr-warm-title' }, `Lämmittely ${nro + 1}/${tl.lammittelyt.length} · noin ${osuus} % työpainosta`),
      el('p', { class: 'tr-warm-value' }, `${painoTeksti(l.paino, yksikko, liike)} × ${l.toistot}`),
      el('div', { class: 'tr-actions' },
        el('button', {
          class: 'btn btn-primary', type: 'button', dataset: { fokus: `${i}:lam` },
          onClick: () => kuittaaSarja(k.id, i, { paino: l.paino, toistot: l.toistot, rir: null, lammittely: true }, LAMMITTELY_PALAUTUS_S),
        }, 'Kuittaa lämmittely'),
        el('button', {
          class: 'btn', type: 'button',
          onClick: () => update((s) => {
            const kk = s.kaynnissa;
            if (kk && kk.id === k.id && kk.liikkeet[i]) kk.liikkeet[i].lammittelyOhitettu = true;
          }),
        }, 'Ohita')),
      el('p', { class: 'tr-fine muted' }, 'Lämmittelysarjat eivät kerrytä volyymia eivätkä viikkotavoitetta.'));
  }

  function ehdotusMerkinta(k, liikeId, sarjaIndeksi) {
    return (k.ehdotukset || []).find((e) => e && e.liikeId === liikeId && e.sarjaIndeksi === sarjaIndeksi) || null;
  }

  function ehdotusKortti(k, tl, i, ehdotus, liike, yksikko) {
    const indeksi = (tl.sarjat || []).length;
    const merkinta = ehdotusMerkinta(k, tl.liikeId, indeksi);
    const arvo = `${painoTeksti(ehdotus.paino, yksikko, liike)} × ${ehdotus.toistot}`;
    const syy = SYY_NIMET[ehdotus.syy] || 'Ehdotus';

    if (merkinta) {
      const ok = merkinta.hyvaksytty;
      return el('div', { class: `tr-sugg is-compact${ok ? ' is-accepted' : ' is-skipped'}` },
        el('span', { class: 'tr-sugg-state' }, ok ? `✓ Ehdotus hyväksytty: ${arvo}` : `Ehdotus ohitettu (${arvo})`),
        whyButton(ehdotus.miksi));
    }

    const tallenna = (hyvaksytty) => {
      const d = luonnos(k, i);
      if (hyvaksytty) {
        d.paino = onKehonpaino(liike) && !ehdotus.paino ? '0' : kenttaArvo(ehdotus.paino, yksikko);
        d.toistot = String(ehdotus.toistot);
        d.virheet = {};
      }
      update((s) => {
        const kk = s.kaynnissa;
        if (!kk || kk.id !== k.id) return;
        kk.ehdotukset = (kk.ehdotukset || []).filter((e) => !(e.liikeId === tl.liikeId && e.sarjaIndeksi === indeksi));
        kk.ehdotukset.push({ liikeId: tl.liikeId, sarjaIndeksi: indeksi, ehdotus, hyvaksytty });
      });
      if (hyvaksytty) {
        const nappi = root.querySelector(`[data-fokus="${i}:kuittaa"]`);
        if (nappi) nappi.focus({ preventScroll: true });
      }
    };

    return el('div', { class: 'tr-sugg-wrap' },
      el('div', { class: 'tr-sugg' },
        el('div', { class: 'tr-sugg-top' },
          el('span', { class: 'tr-sugg-label' }, `Ehdotus · ${syy}`),
          whyButton(ehdotus.miksi)),
        el('p', { class: 'tr-sugg-value' }, arvo),
        el('div', { class: 'tr-actions' },
          el('button', { class: 'btn btn-primary tr-accept', type: 'button', onClick: () => tallenna(true) }, 'Hyväksy'),
          el('button', { class: 'btn tr-skip', type: 'button', onClick: () => tallenna(false) }, 'Ohita'))),
      el('p', { class: 'tr-ai-note' }, 'Tuotteessa tekoäly personoi nämä säännöt.'));
  }

  function syottoRivi(k, tl, i, ehdotus, liike, yksikko, tehty, tavoite) {
    const d = luonnos(k, i);
    const kp = onKehonpaino(liike);
    const virheTeksti = el('p', { class: 'tr-error', role: 'alert' });

    const kentta = (avain, otsikko, attrs) => {
      const input = el('input', {
        class: `tr-input${d.virheet[avain] ? ' is-invalid' : ''}`,
        type: 'text',
        autocomplete: 'off',
        'aria-invalid': d.virheet[avain] ? 'true' : 'false',
        dataset: { fokus: `${i}:${avain}` },
        value: d[avain],
        ...attrs,
        onInput: (e) => {
          d[avain] = e.target.value;
          if (d.virheet[avain]) {
            d.virheet[avain] = false;
            e.target.classList.remove('is-invalid');
            e.target.setAttribute('aria-invalid', 'false');
            if (!d.virheet.paino && !d.virheet.toistot) virheTeksti.textContent = '';
          }
        },
      });
      return el('label', { class: 'tr-field' }, el('span', { class: 'tr-field-label' }, otsikko), input);
    };

    const painoKentta = kentta('paino', kp ? `Lisäpaino (${yksikko})` : `Paino (${yksikko})`, {
      inputmode: 'decimal', enterkeyhint: 'next',
      placeholder: kp && !ehdotus.paino ? '0' : kenttaArvo(ehdotus.paino, yksikko),
      onKeydown: (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const seuraava = root.querySelector(`[data-fokus="${i}:toistot"]`);
          if (seuraava) seuraava.focus();
        }
      },
    });
    const toistoKentta = kentta('toistot', 'Toistot', {
      inputmode: 'numeric', enterkeyhint: 'done', placeholder: String(ehdotus.toistot),
      onKeydown: (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          kuittaa();
        }
      },
    });

    const sirut = RIR_VALINNAT.map((r) => el('button', {
      class: 'chip tr-rir-chip', type: 'button', 'aria-pressed': String(d.rir === r),
      dataset: { fokus: `${i}:rir${r}` },
      onClick: (e) => {
        d.rir = d.rir === r ? null : r;
        for (const c of e.currentTarget.parentElement.children) c.setAttribute('aria-pressed', 'false');
        e.currentTarget.setAttribute('aria-pressed', String(d.rir === r));
      },
    }, r >= 4 ? '4+' : String(r)));

    if (d.virheet.paino || d.virheet.toistot) {
      const osat = [];
      if (d.virheet.paino) osat.push(kp ? 'lisäpaino 0 tai enemmän (esim. 2,5)' : 'paino 0 tai enemmän 0,5:n askelin (esim. 62,5)');
      if (d.virheet.toistot) osat.push('toistot kokonaislukuna 0–100');
      virheTeksti.textContent = `Tarkista ${osat.join(' ja ')}.`;
    }

    function kuittaa() {
      const painoSyote = kp && String(d.paino).trim() === '' ? '0' : d.paino;
      const tulos = parseSet(painoSyote, d.toistot);
      if (!tulos.ok) {
        d.virheet = { ...tulos.virheet };
        piirra();
        const kohde = root.querySelector(`[data-fokus="${i}:${tulos.virheet.paino ? 'paino' : 'toistot'}"]`);
        if (kohde) kohde.focus({ preventScroll: true });
        return;
      }
      const sarja = { paino: kiloiksi(tulos.paino, yksikko), toistot: tulos.toistot, rir: d.rir };
      kuittaaSarja(k.id, i, sarja, tavoite.palautusS, ehdotus);
    }

    const sarjaNro = tehty + 1;
    return el('div', { class: 'tr-entry' },
      el('p', { class: 'tr-entry-title' }, sarjaNro > tavoite.sarjat ? `Lisäsarja ${sarjaNro}` : `Sarja ${sarjaNro}/${tavoite.sarjat}`),
      el('div', { class: 'tr-fields' }, painoKentta, toistoKentta),
      el('div', { class: 'tr-rir' },
        el('span', { class: 'tr-field-label', id: `tr-rir-${i}` }, 'RIR · toistoja varalla'),
        el('div', { class: 'tr-rir-chips', role: 'group', 'aria-labelledby': `tr-rir-${i}` }, ...sirut)),
      virheTeksti,
      el('button', { class: 'btn btn-primary tr-log', type: 'button', dataset: { fokus: `${i}:kuittaa` }, onClick: kuittaa }, 'Kuittaa sarja'));
  }

  // Lisää sarjan, kirjaa ehdotuksen valinnan (jos käyttäjä ei valinnut, hyväksytyksi lasketaan
  // ehdotuksen mukainen sarja) ja käynnistää palautusajastimen tallennetulla päättymisajalla.
  function kuittaaSarja(treeniId, i, sarja, palautusS, ehdotus) {
    let siirry = null;
    // Luonnos tyhjennetään ennen päivitystä, koska update() piirtää näkymän heti uudelleen.
    luonnokset.set(`${treeniId}:${i}`, { paino: '', toistot: '', rir: null, virheet: {} });
    update((s) => {
      const kk = s.kaynnissa;
      if (!kk || kk.id !== treeniId || !kk.liikkeet[i]) return;
      const tl = kk.liikkeet[i];
      tl.sarjat = tl.sarjat || [];
      const indeksi = tl.sarjat.length;
      tl.sarjat.push(sarja);
      if (ehdotus && !sarja.lammittely) {
        kk.ehdotukset = kk.ehdotukset || [];
        if (!kk.ehdotukset.some((e) => e.liikeId === tl.liikeId && e.sarjaIndeksi === indeksi)) {
          kk.ehdotukset.push({
            liikeId: tl.liikeId, sarjaIndeksi: indeksi, ehdotus,
            hyvaksytty: sarja.paino === ehdotus.paino && sarja.toistot >= ehdotus.toistot,
          });
        }
      }
      const kesto = Number.isFinite(palautusS) && palautusS > 0 ? palautusS : 90;
      kk.viimeisinSarjaAika = new Date().toISOString(); // kesken jääneen treenin kestoa varten
      kk.palautusLoppuu = new Date(Date.now() + kesto * 1000).toISOString();
      kk.palautusKestoS = kesto;
      // Siirrytään seuraavaan keskeneräiseen liikkeeseen, kun tavoitesarjat ovat täynnä.
      const tavoite = (tl.tavoite && tl.tavoite.sarjat) || 3;
      if (!sarja.lammittely && tyoSarjaMaara(tl) === tavoite) {
        const j = kk.liikkeet.findIndex((x, n) => n > i && tyoSarjaMaara(x) < ((x.tavoite && x.tavoite.sarjat) || 3));
        if (j >= 0 && avoin.id === treeniId && avoin.i === i) {
          siirry = j;
          avoin = { id: treeniId, i: j }; // asetetaan ennen uudelleenpiirtoa
        }
      }
    });
    if (siirry !== null) {
      const kortti = root.querySelector('.tr-ex.is-open');
      if (kortti && typeof kortti.scrollIntoView === 'function') kortti.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  // --- Palautusajastin --------------------------------------------------------

  function lepoPalkki(k) {
    const loppuu = aikaMs(k.palautusLoppuu);
    const nakyvissa = loppuu !== null && loppuu > Date.now();
    return el('div', { class: 'tr-rest', hidden: !nakyvissa, role: 'timer', 'aria-label': 'Palautusaika' },
      el('div', { class: 'tr-rest-track', 'aria-hidden': 'true' }, el('div', { class: 'tr-rest-fill' })),
      el('div', { class: 'tr-rest-row' },
        el('div', { class: 'tr-rest-info' },
          el('span', { class: 'tr-rest-label' }, 'Palautus'),
          el('span', { class: 'tr-rest-time', dataset: { lepo: '' } }, nakyvissa ? mmss(loppuu - Date.now() + 999) : '00:00')),
        el('button', {
          class: 'btn tr-rest-btn', type: 'button',
          onClick: () => update((s) => {
            const kk = s.kaynnissa;
            if (!kk) return;
            const pohja = Math.max(Date.now(), aikaMs(kk.palautusLoppuu) || 0);
            kk.palautusLoppuu = new Date(pohja + 15000).toISOString();
            kk.palautusKestoS = (kk.palautusKestoS || 0) + 15;
          }),
        }, '+15 s'),
        el('button', {
          class: 'btn tr-rest-btn', type: 'button',
          onClick: () => update((s) => { if (s.kaynnissa) s.kaynnissa.palautusLoppuu = null; }),
        }, 'Ohita')));
  }

  function paivitaAjat() {
    const state = getState();
    const k = state && state.kaynnissa;
    if (!k) return;
    const alku = aikaMs(k.aloitus);
    const aika = root.querySelector('[data-aika]');
    if (aika && alku !== null) {
      const t = mmss(Date.now() - alku);
      if (aika.textContent !== t) aika.textContent = t;
    }
    const palkki = root.querySelector('.tr-rest');
    if (!palkki) return;
    const loppuu = aikaMs(k.palautusLoppuu);
    const jaljella = loppuu === null ? 0 : loppuu - Date.now();
    if (jaljella <= 0) {
      if (!palkki.hidden) palkki.hidden = true;
      return;
    }
    palkki.hidden = false;
    const teksti = palkki.querySelector('[data-lepo]');
    const t = mmss(jaljella + 999);
    if (teksti && teksti.textContent !== t) teksti.textContent = t;
    const kesto = (k.palautusKestoS || 90) * 1000;
    const tayte = palkki.querySelector('.tr-rest-fill');
    if (tayte) tayte.style.transform = `scaleX(${Math.max(0, Math.min(1, jaljella / kesto)).toFixed(3)})`;
  }

  // --- Lopetus ------------------------------------------------------------------

  function lopeta() {
    const state = getState();
    const k = state.kaynnissa;
    if (!k) return;
    const liikkeet = Array.isArray(k.liikkeet) ? k.liikkeet : [];
    const sarjoja = liikkeet.reduce((n, tl) => n + (tl.sarjat || []).length, 0);
    if (!sarjoja) {
      vahvistaHylkays();
      return;
    }
    const alku = aikaMs(k.aloitus);
    tallennaTreeni(k, alku !== null ? Math.max(0, Math.round((Date.now() - alku) / 1000)) : 0, true);
  }

  // Tallentaa käynnissä olevan treenin historiaan annetulla kestolla ja avaa yhteenvedon.
  function tallennaTreeni(k, kestoS, uusi) {
    const liikkeet = Array.isArray(k.liikkeet) ? k.liikkeet : [];
    const id = k.id || `t-${Date.now().toString(36)}`;
    const tallennetut = liikkeet.filter((tl) => (tl.sarjat || []).length);
    const treeni = {
      id,
      pvm: k.pvm || tanaanPvm(k.aloitus || new Date().toISOString()),
      aloitus: k.aloitus,
      kestoS,
      lahde: 'psp',
      tyyppi: 'voima',
      ohjelmaId: k.ohjelmaId,
      paivaNimi: k.paivaNimi,
      liikkeet: tallennetut.map((tl) => ({ liikeId: tl.liikeId, sarjat: tl.sarjat })),
      ehdotukset: (k.ehdotukset || []).filter((e) => {
        const tl = tallennetut.find((x) => x.liikeId === e.liikeId);
        return !!tl && e.sarjaIndeksi < tl.sarjat.length;
      }),
    };
    lopetetaan = true;
    update((s) => {
      s.historia = [...(Array.isArray(s.historia) ? s.historia : []), treeni];
      s.kaynnissa = null;
    });
    poistaLuonnokset(k.id);
    location.hash = `#/historia/${encodeURIComponent(id)}${uusi ? '?uusi=1' : ''}`;
  }

  // Yläpalkin Lopeta: vahvistus, jos tavoitesarjoja on vielä tekemättä.
  function lopetaYlapalkista() {
    const k = getState().kaynnissa;
    if (!k) return;
    const liikkeet = Array.isArray(k.liikkeet) ? k.liikkeet : [];
    const kirjattu = liikkeet.some((tl) => (tl.sarjat || []).length);
    const tekematta = liikkeet.reduce((n, tl) => n + Math.max(0, ((tl.tavoite && tl.tavoite.sarjat) || 3) - tyoSarjaMaara(tl)), 0);
    if (!kirjattu || tekematta === 0) {
      lopeta();
      return;
    }
    let laatikko = null;
    laatikko = sheet(el('div', { class: 'tr-confirm' },
      el('h2', { class: 'sheet-title' }, `${tekematta} ${tekematta === 1 ? 'sarja' : 'sarjaa'} tekemättä – lopetetaanko?`),
      el('p', null, 'Kirjatut sarjat tallennetaan historiaan. Tekemättömät sarjat jäävät pois.'),
      el('div', { class: 'tr-confirm-actions' },
        el('button', { class: 'btn btn-primary', type: 'button', onClick: () => { laatikko.close(); lopeta(); } }, 'Lopeta treeni'),
        el('button', { class: 'btn', type: 'button', onClick: () => laatikko.close() }, 'Jatka treeniä'))));
  }

  // Yli 4 h sitten aloitettu treeni on jäänyt auki: tallennetaanko vai hylätäänkö?
  function kysyKeskenJaanyt(k) {
    const liikkeet = Array.isArray(k.liikkeet) ? k.liikkeet : [];
    const sarjoja = liikkeet.reduce((n, tl) => n + (tl.sarjat || []).length, 0);
    const pvm = typeof k.pvm === 'string' ? k.pvm : tanaanPvm(k.aloitus);
    const pvmTeksti = `${Number(pvm.slice(8, 10))}.${Number(pvm.slice(5, 7))}.`;
    let laatikko = null;
    const tallenna = () => {
      const kk = getState().kaynnissa;
      if (laatikko) laatikko.close();
      if (!kk || kk.id !== k.id) return;
      const alku = aikaMs(kk.aloitus);
      const viimeinen = aikaMs(kk.viimeisinSarjaAika);
      const kestoS = alku !== null && viimeinen !== null && viimeinen > alku
        ? Math.round((viimeinen - alku) / 1000) : OLETUSKESTO_S;
      tallennaTreeni(kk, kestoS, false);
    };
    const hylkaa = () => {
      const kk = getState().kaynnissa;
      if (laatikko) laatikko.close();
      if (!kk || kk.id !== k.id) return;
      update((s) => { s.kaynnissa = null; }); // näkymä piirtyy aloitukseksi
      poistaLuonnokset(kk.id);
    };
    laatikko = sheet(el('div', { class: 'tr-confirm' },
      el('h2', { class: 'sheet-title' }, `Edellinen treeni jäi kesken (${pvmTeksti})`),
      el('p', null, sarjoja
        ? `Tallennetaanko vai hylätäänkö? Treenissä on ${sarjoja} kirjattua sarjaa.`
        : 'Tallennetaanko vai hylätäänkö? Treenissä ei ole kirjattuja sarjoja, joten sen voi vain hylätä.'),
      el('div', { class: 'tr-confirm-actions' },
        sarjoja ? el('button', { class: 'btn btn-primary', type: 'button', onClick: tallenna }, 'Tallenna treeni') : null,
        el('button', { class: `btn${sarjoja ? '' : ' btn-primary'}`, type: 'button', onClick: hylkaa }, 'Hylkää treeni'))));
  }

  function vahvistaHylkays() {
    let laatikko = null;
    const hylkaa = () => {
      const k = getState().kaynnissa;
      if (laatikko) laatikko.close();
      lopetetaan = true;
      update((s) => { s.kaynnissa = null; });
      if (k) poistaLuonnokset(k.id);
      location.hash = '#/koti';
    };
    laatikko = sheet(el('div', { class: 'tr-confirm' },
      el('h2', { class: 'sheet-title' }, 'Hylätäänkö treeni?'),
      el('p', null, 'Yhtään sarjaa ei ole kuitattu, joten treeniä ei tallenneta historiaan.'),
      el('div', { class: 'tr-confirm-actions' },
        el('button', { class: 'btn btn-primary', type: 'button', onClick: hylkaa }, 'Hylkää treeni'),
        el('button', { class: 'btn', type: 'button', onClick: () => laatikko.close() }, 'Jatka treeniä'))));
  }

  function poistaLuonnokset(treeniId) {
    for (const avain of [...luonnokset.keys()]) if (avain.startsWith(`${treeniId}:`)) luonnokset.delete(avain);
  }

  // --- Elinkaari ------------------------------------------------------------------

  const onStateChange = () => {
    if (!lopetetaan) piirra();
  };
  window.addEventListener('statechange', onStateChange);
  piirra();
  const ajastin = setInterval(paivitaAjat, 500);

  const avattaessa = getState() && getState().kaynnissa;
  const avattaessaAlku = avattaessa ? aikaMs(avattaessa.aloitus) : null;
  if (avattaessaAlku !== null && Date.now() - avattaessaAlku > KESKEN_RAJA_MS) kysyKeskenJaanyt(avattaessa);

  return () => {
    clearInterval(ajastin);
    window.removeEventListener('statechange', onStateChange);
  };
}
