// Progressiomoottori: e1RM, tavoitteen parametrit, jumiutumisen tunnistus ja
// seuraavan sarjan ehdotus. Puhdas moduuli: aika ja data tulevat parametreina.

import { round25, onVoimatreeni, onTyosarja } from './util.js';

// Voimanoston pääliikkeet: näille haarukka 1–5, muille liikkeille apuliikkeiden 6–10.
export const VOIMANOSTO_PAALIIKKEET = ['takakyykky', 'penkkipunnerrus', 'maastaveto'];

// Epley: paino * (1 + toistot / 30). Yhden toiston (tai vähemmän) sarjassa e1RM = paino.
export function e1rm(paino, toistot) {
  if (toistot <= 1) return paino;
  return paino * (1 + toistot / 30);
}

// Speksin taulukko 4c. `sarjat` on haarukan yläpää; sarjatMin/sarjatMax kertovat
// koko haarukan, jotta keston sovitus voi pudottaa sarjamäärää alapäähän asti.
const TAVOITTEET = {
  lihasmassa: { toistoMin: 8, toistoMax: 12, sarjatMin: 3, sarjatMax: 4, palautusS: 90, rirMin: 1, rirMax: 2 },
  kiinteytys: { toistoMin: 10, toistoMax: 15, sarjatMin: 3, sarjatMax: 3, palautusS: 60, rirMin: 1, rirMax: 3 },
  voima: { toistoMin: 3, toistoMax: 6, sarjatMin: 4, sarjatMax: 5, palautusS: 180, rirMin: 1, rirMax: 2 },
  kunto: { toistoMin: 8, toistoMax: 15, sarjatMin: 3, sarjatMax: 3, palautusS: 60, rirMin: 2, rirMax: 3 },
  painonpudotus: { toistoMin: 12, toistoMax: 20, sarjatMin: 2, sarjatMax: 3, palautusS: 45, rirMin: 2, rirMax: 3 },
  // Voimanosto: pääliikkeet 1–5, apuliikkeet 6–10.
  voimanosto: { toistoMin: 1, toistoMax: 5, sarjatMin: 3, sarjatMax: 5, palautusS: 180, rirMin: 1, rirMax: 3,
    apuliikkeet: { toistoMin: 6, toistoMax: 10 } },
};

// Palauttaa tavoitteen parametrit. Tuntematon tavoite → lihasmassa (demon oletus).
export function goalParams(tavoite) {
  const t = TAVOITTEET[tavoite] || TAVOITTEET.lihasmassa;
  const tulos = {
    toistoMin: t.toistoMin,
    toistoMax: t.toistoMax,
    sarjat: t.sarjatMax,
    sarjatMin: t.sarjatMin,
    sarjatMax: t.sarjatMax,
    palautusS: t.palautusS,
    rirMin: t.rirMin,
    rirMax: t.rirMax,
  };
  if (t.apuliikkeet) tulos.apuliikkeet = { ...t.apuliikkeet };
  return tulos;
}

// --- Sisäiset apurit -------------------------------------------------------

function tyoSarjat(sarjat) {
  return (sarjat || []).filter(
    (s) => onTyosarja(s) && Number.isFinite(s.paino) && Number.isFinite(s.toistot) && s.toistot > 0,
  );
}

// Kerrat aikajärjestyksessä, vain ne joissa on vähintään yksi työsarja. Jos kerralla on
// tyyppi, tuodut aktiviteetit (muu kuin 'voima') ohitetaan; tyypitön kerta kelpaa.
function jarjestetytKerrat(kerrat) {
  return (kerrat || [])
    .filter(onVoimatreeni)
    .map((k) => ({ pvm: k.pvm, sarjat: tyoSarjat(k.sarjat) }))
    .filter((k) => k.sarjat.length > 0)
    .sort((a, b) => (a.pvm < b.pvm ? -1 : a.pvm > b.pvm ? 1 : 0));
}

function fmt(n) {
  return String(n).replace('.', ',');
}

function rajaa(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

// --- detectStall -----------------------------------------------------------

function maxPaino(kerta) {
  return Math.max(...kerta.sarjat.map((s) => s.paino));
}

// Paras toistomäärä kerran suurimmalla painolla (kevyemmät pudotussarjat eivät kelpaa).
function maxToistot(kerta) {
  const p = maxPaino(kerta);
  return Math.max(...kerta.sarjat.filter((s) => s.paino === p).map((s) => s.toistot));
}

// Tosi, jos kolme viimeisintä kertaa tehtiin SAMALLA suurimmalla työsarjapainolla
// (kehonpainoliikkeillä samalla lisäpainolla) eikä paras e1RM noussut: kumpikaan
// kahdesta jälkimmäisestä kerrasta ei ylitä ensimmäisen kerran parasta.
// Painon nosto ikkunan aikana tarkoittaa aina, ettei jumia ole.
// Kun paino on 0 (kehonpaino ilman lisäpainoa), mittarina on paras toistomäärä.
export function detectStall(kerrat) {
  const k = jarjestetytKerrat(kerrat);
  if (k.length < 3) return false;
  const ikkuna = k.slice(-3);
  const painot = ikkuna.map(maxPaino);
  if (!painot.every((p) => p === painot[0])) return false;
  const mittari = (s) => (painot[0] === 0 ? s.toistot : e1rm(s.paino, s.toistot));
  const parhaat = ikkuna.map((kerta) => Math.max(...kerta.sarjat.map(mittari)));
  const EPS = 1e-9;
  return parhaat[1] <= parhaat[0] + EPS && parhaat[2] <= parhaat[0] + EPS;
}

// Toistokevennyksen tunnistus (kehonpainoliikkeet): ikkunassa on kerta, jonka paras
// toistomäärä putosi yli 10 % edellisestä kerrasta. Ei päätellä painoista.
const TOISTOKEVENNYS_RAJA = 0.9;
function toistotKevennettyIkkunassa(kerrat) {
  const ikkuna = kerrat.slice(-3);
  for (let i = 1; i < ikkuna.length; i += 1) {
    if (maxToistot(ikkuna[i]) < maxToistot(ikkuna[i - 1]) * TOISTOKEVENNYS_RAJA) return true;
  }
  return false;
}

// Täydentää puutteellisen tavoiteobjektin lihasmassan oletuksilla.
function tavoiteParametrit(tavoite) {
  if (typeof tavoite === 'string' || !tavoite || typeof tavoite !== 'object') return goalParams(tavoite);
  const oletus = goalParams('lihasmassa');
  const tulos = {};
  for (const [avain, arvo] of Object.entries(oletus)) {
    tulos[avain] = Number.isFinite(tavoite[avain]) ? tavoite[avain] : arvo;
  }
  const apu = tavoite.apuliikkeet;
  if (apu && Number.isFinite(apu.toistoMin) && Number.isFinite(apu.toistoMax)) {
    tulos.apuliikkeet = { toistoMin: apu.toistoMin, toistoMax: apu.toistoMax };
  }
  return tulos;
}

// --- suggestNextSet --------------------------------------------------------

const ALOITUSKERROIN = { aloittelija: 0.8, keskitaso: 1, kokenut: 1.2 };
const VALINEOLETUS = { levytanko: 20, 'käsipainot': 7.5, laitteet: 20, taljat: 15, kehonpaino: 0 };

// Toistohaarukka liikkeelle. Voimanostossa (tavoitteella apuliikkeet-haarukka) pääliikkeet
// käyttävät päähaarukkaa ja muut liikkeet apuliikkeiden haarukkaa.
function toistoHaarukka(tp, liike) {
  const paaliike = !!liike && VOIMANOSTO_PAALIIKKEET.includes(liike.id);
  return tp.apuliikkeet && !paaliike ? tp.apuliikkeet : tp;
}

// Ehdottaa seuraavan sarjan painon ja toistot. Ensimmäinen osuva sääntö voittaa.
// Treenin aikana (tämän kerran työsarjoja on jo): first-time → deload → recovery →
// rir-zero → rir-high → hold (jatka viimeisen sarjan painolla).
// Treenin ensimmäinen sarja: first-time → deload → recovery → double-progression →
// hold (sama paino, yksi toisto enemmän kuin viimeksi, enintään toistoMax).
// rir-high laukeaa, kun edellisen sarjan RIR > tavoitteen rirMax.
// Kehonpainoliikkeillä nousu on aina +2,5 kg lisäpainoa ja kevennys vähentää toistoja.
export function suggestNextSet({
  liike,
  tavoite,
  edellisetKerrat = [],
  tamanKerranSarjat = [],
  kokemus = 'keskitaso',
  lihasTila,
  valineet, // hyväksytään rajapinnassa; POC:ssa ei vaikuta ehdotukseen
} = {}) {
  const tp = tavoiteParametrit(tavoite);
  const { toistoMin, toistoMax } = toistoHaarukka(tp, liike);
  const rirMax = tp.rirMax;
  const kehonpaino = !!liike && liike.valine === 'kehonpaino';
  // Kehonpainoliikkeellä nousu on aina yksi 2,5 kg:n lisäpainoaskel.
  const askel = !kehonpaino && liike && liike.alue === 'ala' ? 5 : 2.5;
  const kerrat = jarjestetytKerrat(edellisetKerrat);
  const nyt = tyoSarjat(tamanKerranSarjat);
  const edellinen = kerrat[kerrat.length - 1];
  const viimeSarja = nyt[nyt.length - 1];
  const ulos = (paino, toistot, syy, miksi) => ({
    paino: Math.max(0, round25(paino)),
    toistot: Math.max(1, Math.round(toistot)),
    syy,
    miksi,
  });

  // 1. first-time: ei historiaa eikä tämän kerran sarjoja.
  if (!edellinen && !viimeSarja) {
    const perus = liike && Number.isFinite(liike.aloituspaino)
      ? liike.aloituspaino
      : VALINEOLETUS[liike && liike.valine] ?? 20;
    const paino = Math.max(0, round25(perus * (ALOITUSKERROIN[kokemus] ?? 1)));
    const painoTeksti = kehonpaino && paino === 0 ? 'omalla kehonpainolla' : `maltillisella painolla (${fmt(paino)} kg)`;
    return ulos(paino, toistoMin, 'first-time',
      `Ensimmäinen kerta tällä liikkeellä: aloitetaan ${painoTeksti}, jotta tekniikka ja sopiva kuorma löytyvät. ` +
      'Kaksoisprogressio alkaa seuraavasta kerrasta, kun tiedämme lähtötasosi.');
  }

  const edellinenMaxPaino = edellinen ? maxPaino(edellinen) : 0;
  // Toistokevennys: kehonpainoliike tai liike, jota on tehty ilman painoa.
  const toistoKevennys = kehonpaino || (!!edellinen && edellinenMaxPaino === 0);

  // 2. deload: jumiutuminen (3 kertaa samalla painolla, e1RM ei noussut). Painokevennys
  //    muuttaa painoa, joten jumi-ikkuna alkaa siitä alusta. Toistokevennyksen jälkeen uutta
  //    kevennystä ei tehdä, jos ikkunassa on jo selvä toistojen pudotus.
  if (detectStall(kerrat) && !(toistoKevennys && toistotKevennettyIkkunassa(kerrat))) {
    if (toistoKevennys) {
      const paras = maxToistot(edellinen);
      const toistot = Math.min(toistoMax, Math.max(1, Math.min(paras - 1, Math.round(paras * 0.8))));
      const mita = edellinenMaxPaino > 0 ? `Lisäpaino pysyy samana (${fmt(edellinenMaxPaino)} kg)` : 'Paino pysyy samana';
      return ulos(edellinenMaxPaino, toistot, 'deload',
        'Kevennys: paras toistomäärä ei ole noussut kolmeen viimeiseen kertaan. ' +
        `${mita}, mutta toistoja tehdään noin 20 % vähemmän (${toistot}), jotta keho ehtii palautua ja kehitys lähtee taas liikkeelle.`);
    }
    const kevyempi = Math.min(round25(edellinenMaxPaino * 0.9), edellinenMaxPaino - 2.5);
    return ulos(kevyempi, toistoMin, 'deload',
      'Kevennys: paras arvioitu maksimi (e1RM) ei ole noussut kolmeen viimeiseen kertaan samalla painolla. ' +
      'Paino laskee noin 10 % ja toistot haarukan alapäähän, jotta keho ehtii palautua ja kehitys lähtee taas liikkeelle.');
  }

  // Edellisen kerran vastaava sarja (sama järjestysnumero, tai viimeinen).
  const viiteEdellinen = edellinen
    ? edellinen.sarjat[Math.min(nyt.length, edellinen.sarjat.length - 1)]
    : null;
  // Treenin aikana viitesarja on aina tämän treenin viimeisin työsarja. Edellisen kerran
  // sarjaa käytetään vain, jos se tehtiin samalla painolla (silloin tavoite +1 toisto).
  const treeninAikaisetToistot = () => (viiteEdellinen && viiteEdellinen.paino === viimeSarja.paino
    ? rajaa(viiteEdellinen.toistot + 1, toistoMin, toistoMax)
    : rajaa(viimeSarja.toistot, toistoMin, toistoMax));
  const pidettavaPaino = viimeSarja ? viimeSarja.paino : edellinenMaxPaino;

  // 3. recovery: päälihasryhmä väsynyt → ei nosteta painoa.
  if (lihasTila === 'väsynyt') {
    const toistot = viimeSarja
      ? rajaa((viiteEdellinen && viiteEdellinen.paino === viimeSarja.paino ? viiteEdellinen : viimeSarja).toistot,
        toistoMin, toistoMax)
      : rajaa(viiteEdellinen.toistot, toistoMin, toistoMax);
    const lihas = (liike && liike.lihasryhma) || 'lihasryhmä';
    return ulos(pidettavaPaino, toistot, 'recovery',
      `Palautuminen: ${lihas} on vielä väsynyt edellisestä treenistä, joten painoa ei nosteta tänään. ` +
      'Pidä kuorma ennallaan ja keskity puhtaisiin toistoihin. Palautunut lihas kehittyy paremmin.');
  }

  // --- Treenin aikana: tämän kerran sarjojen RIR ohjaa ennen kaksoisprogressiota. ---
  if (viimeSarja) {
    // 4a. rir-zero: tämän kerran edellinen sarja meni uupumukseen asti.
    if (viimeSarja.rir === 0) {
      if (viimeSarja.toistot < toistoMin) {
        return ulos(viimeSarja.paino - 2.5, toistoMin, 'rir-zero',
          `Edellinen sarja jäi RIR 0:aan eli meni uupumukseen asti, ja toistot (${viimeSarja.toistot}) jäivät ` +
          `haarukan alle (${toistoMin}–${toistoMax}). RIR-autoregulaatio: paino laskee 2,5 kg, ` +
          'jotta seuraava sarja osuu tavoitehaarukkaan ilman ylikuormaa.');
      }
      return ulos(viimeSarja.paino, rajaa(viimeSarja.toistot, toistoMin, toistoMax), 'rir-zero',
        'Edellinen sarja jäi RIR 0:aan eli meni uupumukseen asti. RIR-autoregulaatio: paino pysyy samana, ' +
        'ja seuraavassa sarjassa kannattaa jättää 1–2 toistoa varalle.');
    }

    // 5a. rir-high: edellisessä sarjassa jäi enemmän toistoja varalle kuin tavoite sallii.
    if (Number.isFinite(viimeSarja.rir) && viimeSarja.rir > rirMax) {
      const mita = kehonpaino ? 'lisäpaino' : 'paino';
      return ulos(viimeSarja.paino + askel, rajaa(viimeSarja.toistot, toistoMin, toistoMax), 'rir-high',
        `Edellisessä sarjassa jäi ${viimeSarja.rir} toistoa varalle, kun tavoitteesi mukainen varaus on enintään ${rirMax}. ` +
        `RIR-autoregulaatio: kuorma oli kevyt, joten ${mita} nousee yhden askeleen (${fmt(askel)} kg).`);
    }

    // 6a. hold: jatka viimeisen sarjan painolla; viitesarjana tämän treenin viimeisin sarja.
    const toistot = treeninAikaisetToistot();
    const rirTeksti = Number.isFinite(viimeSarja.rir) ? ` (RIR ${viimeSarja.rir})` : '';
    return ulos(viimeSarja.paino, toistot, 'hold',
      `Edellinen sarja${rirTeksti} osui sopivaan rasitukseen, joten jatka samalla painolla. ` +
      `Kaksoisprogression toistovaihe: tavoitteena on ${toistot} toistoa. Kun kaikki sarjat yltävät ${toistoMax} toistoon, paino nousee.`);
  }

  // --- Treenin ensimmäinen sarja: edellinen kerta ohjaa. ---
  // 4b. double-progression: edellisellä kerralla kaikki sarjat toistoMax:iin ja keskimääräinen RIR >= 1.
  const kaikkiYlapaahan = edellinen.sarjat.every((s) => s.toistot >= toistoMax);
  const ririt = edellinen.sarjat.map((s) => s.rir).filter((r) => Number.isFinite(r));
  const kaRir = ririt.length ? ririt.reduce((a, b) => a + b, 0) / ririt.length : -1;
  if (kaikkiYlapaahan && kaRir >= 1) {
    // Kehonpainoliikkeellä aina yksi 2,5 kg:n lisäpainoaskel, ei aloittelijan tuplaa.
    const askelia = kokemus === 'aloittelija' && !kehonpaino ? 2 : 1;
    const nousu = askel * askelia;
    const mita = kehonpaino ? 'lisäpaino' : 'paino';
    return ulos(edellinenMaxPaino + nousu, toistoMin, 'double-progression',
      `Viime kerralla teit kaikki sarjat haarukan yläpäähän (${toistoMax} toistoa) ja varaa jäi. ` +
      `Kaksoisprogressio: ${mita} nousee ${fmt(nousu)} kg ja toistot palaavat haarukan alapäähän (${toistoMin}).`);
  }

  // 5b. hold: sama paino, yksi toisto enemmän kuin viimeksi (enintään toistoMax).
  //     Viitteenä edellisen kerran ensimmäinen sarja, joka tehtiin samalla (suurimmalla) painolla.
  const viite = edellinen.sarjat.find((s) => s.paino === edellinenMaxPaino);
  const toistot = rajaa(viite.toistot + 1, toistoMin, toistoMax);
  const peruste = kaikkiYlapaahan
    ? `Viime kerralla yllit haarukan yläpäähän (${toistoMax} toistoa), mutta sarjat menivät lähes uupumukseen asti, joten paino pysyy vielä samana. `
    : `Viime kerralla ensimmäisessä sarjassa tällä painolla tuli ${viite.toistot} toistoa. `;
  return ulos(edellinenMaxPaino, toistot, 'hold',
    peruste +
    `Kaksoisprogression toistovaihe: paino pysyy samana ja tavoitteena on yksi toisto enemmän (${toistot}). ` +
    `Kun kaikki sarjat yltävät ${toistoMax} toistoon, paino nousee.`);
}
