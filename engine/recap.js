// Treenikuukautesi (speksi 4l C): kuukauden kooste tarinamuotoisina ruutuina ja treenityyppi
// (persoona) selkein säännöin. Puhdas moduuli: ei DOM-, window-, localStorage- eikä Date.now()-
// kutsuja. Aika annetaan parametrina (`nyt`: ISO-merkkijono).
//
// Salivertailu ("olit salisi aktiivisimman X %:n joukossa") on demodataa: se johdetaan käyttäjän
// omasta treenimäärästä, ja ruudussa on merkintä demo: true.

import { addDays, daysBetween, onVoimatreeni, onTyosarja } from './util.js?v=19a48e7';
import { workoutSummary } from './history.js?v=19a48e7';
import { estimatedStrength, muscleStrength, treeniscore, onKestavyysliike } from './score.js?v=19a48e7';
import { challengeProgress, badges } from './challenges.js?v=19a48e7';
import { SANAMERKKI } from './share.js?v=19a48e7';
import { LIIKKEET } from '../data.js?v=19a48e7';
import { tanaanPvm } from '../seed.js?v=19a48e7';

export const HENKILOAUTO_KG = 1400;
const HILJAINEN_RAJA = 4; // alle 4 voimatreeniä kuukaudessa = hiljainen kuukausi

const KUUKAUSI_SI = ['Tammikuusi', 'Helmikuusi', 'Maaliskuusi', 'Huhtikuusi', 'Toukokuusi', 'Kesäkuusi',
  'Heinäkuusi', 'Elokuusi', 'Syyskuusi', 'Lokakuusi', 'Marraskuusi', 'Joulukuusi'];
const KUUKAUSI_INE = ['tammikuussa', 'helmikuussa', 'maaliskuussa', 'huhtikuussa', 'toukokuussa', 'kesäkuussa',
  'heinäkuussa', 'elokuussa', 'syyskuussa', 'lokakuussa', 'marraskuussa', 'joulukuussa'];
const KUUKAUSI_NOM = ['tammikuu', 'helmikuu', 'maaliskuu', 'huhtikuu', 'toukokuu', 'kesäkuu',
  'heinäkuu', 'elokuu', 'syyskuu', 'lokakuu', 'marraskuu', 'joulukuu'];
const VKP_TAYSI = ['sunnuntai', 'maanantai', 'tiistai', 'keskiviikko', 'torstai', 'perjantai', 'lauantai'];
const VUOROKAUDENAJAT = {
  aamu: { nimi: 'aamu', adverbi: 'aamuisin' },
  paiva: { nimi: 'päivä', adverbi: 'päivisin' },
  ilta: { nimi: 'ilta', adverbi: 'iltaisin' },
};

/**
 * Treenityypit (persoonat). Säännöt tarkistetaan tässä järjestyksessä, ja ensimmäinen osuma voittaa
 * (trainingPersona). Osuudet lasketaan kuukauden voimatreeneistä, joilla on aloitusaika.
 */
export const PERSOONAT = [
  {
    id: 'kipinan-keraaja', nimi: 'Kipinän Kerääjä',
    kuvaus: 'Tämä kuu oli kipinöiden keräämistä: jokainen treeni sytyttää seuraavan. Ensi kuussa liekki roihahtaa!',
    saanto: 'Alle 4 voimatreeniä kuukaudessa.',
  },
  {
    id: 'monilajinen-seikkailija', nimi: 'Monilajinen Seikkailija',
    kuvaus: 'Sali, lenkkipolku ja pyörän satula – sinulle liike on seikkailu, eikä yksikään laji jää ilman huomiota.',
    saanto: 'Tuotuja aktiviteetteja (kävelyt, pyöräilyt ym.) vähintään yhtä monta kuin voimatreenejä.',
  },
  {
    id: 'viikonlopun-soturi', nimi: 'Viikonlopun Soturi',
    kuvaus: 'Arki on arkea, mutta viikonloppuna sali kutsuu. Lauantai on sinun taistelukenttäsi, ja sunnuntaina kerätään voitot.',
    saanto: 'Vähintään puolet voimatreeneistä lauantaina tai sunnuntaina.',
  },
  {
    id: 'aamun-tasainen-puurtaja', nimi: 'Aamun Tasainen Puurtaja',
    kuvaus: 'Kun muut vasta painavat torkkua, sinä olet jo tehnyt päivän tärkeimmän työn. Aamukahvi maistuu ansaitulta.',
    saanto: 'Vähintään puolet voimatreeneistä alkoi ennen klo 10.',
  },
  {
    id: 'lounastauon-livahtaja', nimi: 'Lounastauon Livahtaja',
    kuvaus: 'Kalenterin aukko? Sinulle se on treenirako. Lounastauko venyy sopivasti muutamaan raskaaseen sarjaan.',
    saanto: 'Vähintään puolet voimatreeneistä alkoi klo 10–16.',
  },
  {
    id: 'iltojen-voimanostaja', nimi: 'Iltojen Voimanostaja',
    kuvaus: 'Päivän päätteeksi rauta nousee. Työpäivän jälkeen salilla purkautuu kaikki – ja vähän enemmänkin.',
    saanto: 'Vähintään puolet voimatreeneistä alkoi klo 16 tai myöhemmin.',
  },
  {
    id: 'tasainen-tahdittaja', nimi: 'Tasainen Tahdittaja',
    kuvaus: 'Viikko toisensa perään tavoite täyttyy. Salainen aseesi on rytmi, ja se on vahvempi kuin mikään ennätys.',
    saanto: 'Viikkotavoite täyttyi jokaisella kuukauden täydellä viikolla.',
  },
  {
    id: 'monipuolinen-menija', nimi: 'Monipuolinen Menijä',
    kuvaus: 'Aamulla, illalla tai viikonloppuna – sinä treenaat silloin, kun elämä antaa tilaa. Joustavuus on supervoimasi.',
    saanto: 'Oletus, kun mikään muu sääntö ei täyty.',
  },
];

// --- Apurit ----------------------------------------------------------------

/** kelvollinenKuukausi(kk) → bool: 'YYYY-MM', vuosi 2000–2100 ja kuukausi 01–12. */
export function kelvollinenKuukausi(kk) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(kk || ''));
  return !!m && Number(m[1]) >= 2000 && Number(m[1]) <= 2100 && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

// Kuukauden rajat. Virheellinen kuukausi (esim. '0000-01') → null.
function kuukaudenRajat(kk) {
  if (!kelvollinenKuukausi(kk)) return null;
  const [y, m] = kk.split('-').map(Number);
  const alku = `${y}-${String(m).padStart(2, '0')}-01`;
  const seuraava = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { alku, loppu: addDays(seuraava, -1), m };
}

function tuhannet(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function desimaali(n) {
  return String(n).replace('.', ',');
}

function etunimi(profiili) {
  return String((profiili && profiili.nimi) || '').trim().split(/\s+/)[0] || 'Treenaaja';
}

function viikonpaiva(pvm) {
  return new Date(`${pvm}T12:00:00Z`).getUTCDay();
}

function tunti(treeni) {
  if (!treeni || !treeni.aloitus) return null;
  const d = new Date(treeni.aloitus);
  return Number.isFinite(d.getTime()) ? d.getHours() : null;
}

function vuorokaudenaika(h) {
  if (h < 10) return 'aamu';
  if (h < 16) return 'paiva';
  return 'ilta';
}

function kuukaudenData(tila, alku, loppu) {
  const historia = (tila && Array.isArray(tila.historia) ? tila.historia : []).filter((t) => t && typeof t.pvm === 'string');
  const kuun = historia.filter((t) => t.pvm >= alku && t.pvm <= loppu);
  return { historia, kuun, voima: kuun.filter(onVoimatreeni), tuodut: kuun.filter((t) => !onVoimatreeni(t)) };
}

// Täydet viikot (ma–su tai profiilin viikonAlku) kuukauden sisällä ja niiden täyttyminen.
function taydetViikot(voimaJaMuut, alku, loppu, tavoite, viikonAlku) {
  const ensimmainen = viikonAlku === 'sunnuntai' ? 0 : 1;
  let w = alku;
  while (viikonpaiva(w) !== ensimmainen) w = addDays(w, 1);
  const viikot = [];
  for (; addDays(w, 6) <= loppu; w = addDays(w, 7)) {
    const paivat = new Set(voimaJaMuut.filter((t) => t.pvm >= w && t.pvm <= addDays(w, 6)).map((t) => t.pvm));
    viikot.push(paivat.size >= tavoite);
  }
  return viikot;
}

// --- Julkiset funktiot -----------------------------------------------------

/**
 * trainingPersona(tila, kuukausi 'YYYY-MM') → { id, nimi, kuvaus, saanto, perusteet: {...} }
 * Säännöt (ensimmäinen osuma voittaa, ks. PERSOONAT):
 * 1. alle 4 voimatreeniä → Kipinän Kerääjä
 * 2. tuotuja aktiviteetteja ≥ voimatreenien määrä → Monilajinen Seikkailija
 * 3. ≥ 50 % voimatreeneistä la–su → Viikonlopun Soturi
 * 4. ≥ 50 % alkoi ennen klo 10 → Aamun Tasainen Puurtaja
 * 5. ≥ 50 % alkoi klo 10–16 → Lounastauon Livahtaja
 * 6. ≥ 50 % alkoi klo 16 tai myöhemmin → Iltojen Voimanostaja
 * 7. viikkotavoite (profiili.treenitViikossa) täyttyi jokaisella kuukauden täydellä viikolla → Tasainen Tahdittaja
 * 8. muuten → Monipuolinen Menijä
 * perusteet: { voimatreeneja, aktiviteetteja, viikonloppuOsuus, aamuOsuus, paivaOsuus, iltaOsuus, taydetViikot, taytetytViikot }
 */
export function trainingPersona(tila, kuukausi) {
  // Virheellinen kuukausi: tyhjä jakso eli ei treenejä → Kipinän Kerääjä.
  const { alku, loppu } = kuukaudenRajat(kuukausi) || { alku: '2000-01-01', loppu: '1999-12-31' };
  const { voima, tuodut, kuun } = kuukaudenData(tila, alku, loppu);
  const profiili = (tila && tila.profiili) || {};
  const tunnit = voima.map(tunti).filter((h) => h !== null);
  const osuus = (ehto) => (tunnit.length ? tunnit.filter(ehto).length / tunnit.length : 0);
  const viikonloppuOsuus = voima.length ? voima.filter((t) => [0, 6].includes(viikonpaiva(t.pvm))).length / voima.length : 0;
  const viikot = taydetViikot(kuun, alku, loppu, profiili.treenitViikossa ?? 3, profiili.viikonAlku);
  const perusteet = {
    voimatreeneja: voima.length,
    aktiviteetteja: tuodut.length,
    viikonloppuOsuus: Math.round(viikonloppuOsuus * 100),
    aamuOsuus: Math.round(osuus((h) => h < 10) * 100),
    paivaOsuus: Math.round(osuus((h) => h >= 10 && h < 16) * 100),
    iltaOsuus: Math.round(osuus((h) => h >= 16) * 100),
    taydetViikot: viikot.length,
    taytetytViikot: viikot.filter(Boolean).length,
  };
  let id;
  if (voima.length < HILJAINEN_RAJA) id = 'kipinan-keraaja';
  else if (tuodut.length >= voima.length) id = 'monilajinen-seikkailija';
  else if (perusteet.viikonloppuOsuus >= 50) id = 'viikonlopun-soturi';
  else if (perusteet.aamuOsuus >= 50) id = 'aamun-tasainen-puurtaja';
  else if (perusteet.paivaOsuus >= 50) id = 'lounastauon-livahtaja';
  else if (perusteet.iltaOsuus >= 50) id = 'iltojen-voimanostaja';
  else if (viikot.length > 0 && viikot.every(Boolean)) id = 'tasainen-tahdittaja';
  else id = 'monipuolinen-menija';
  const p = PERSOONAT.find((x) => x.id === id);
  return { id: p.id, nimi: p.nimi, kuvaus: p.kuvaus, saanto: p.saanto, perusteet };
}

// Liikkeiden volyymi kuukauden voimatreeneistä (käsipainot × 2), suurin ensin.
function liikeVolyymit(voima) {
  const lmap = new Map(LIIKKEET.map((l) => [l.id, l]));
  const v = new Map();
  for (const t of voima) {
    for (const tl of t.liikkeet || []) {
      const l = lmap.get(tl.liikeId);
      if (!l) continue;
      const kerroin = l.valine === 'käsipainot' ? 2 : 1;
      const kg = (tl.sarjat || []).filter(onTyosarja)
        .reduce((s, x) => s + (Number(x.paino) || 0) * (Number(x.toistot) || 0) * kerroin, 0);
      v.set(l.id, (v.get(l.id) || 0) + kg);
    }
  }
  return [...v.entries()].map(([id, kg]) => ({ liike: lmap.get(id), kg: Math.round(kg) })).sort((a, b) => b.kg - a.kg);
}

// Isoin edistys arvioidussa voimassa: kuukautta edeltävä päivä → kuukauden viimeinen (tai tämä) päivä.
function isoinEdistys(historia, voima, alku, loppu) {
  const idt = new Set(voima.flatMap((t) => (t.liikkeet || []).map((tl) => tl.liikeId)));
  let paras = null;
  for (const l of LIIKKEET) {
    if (!idt.has(l.id) || onKestavyysliike(l)) continue;
    const ennen = estimatedStrength(l, historia.filter((t) => t.pvm < alku), addDays(alku, -1));
    const nyt = estimatedStrength(l, historia.filter((t) => t.pvm <= loppu), loppu);
    if (!ennen || !nyt || !(ennen.arvo > 0)) continue;
    const pros = Math.round(((nyt.arvo - ennen.arvo) / ennen.arvo) * 1000) / 10;
    if (pros > 0 && (!paras || pros > paras.pros)) paras = { liike: l, ennen: ennen.arvo, nyt: nyt.arvo, yksikko: nyt.yksikko, pros };
  }
  return paras;
}

function scoreKohta(historia, kehonpaino, pvm) {
  return treeniscore(muscleStrength(LIIKKEET, historia.filter((t) => t.pvm <= pvm), kehonpaino, pvm)).kokonais;
}

// Demon salivertailu: osuus odotetusta treenimäärästä → "aktiivisimman X %:n joukossa".
function saliVertailu(treeneja, odotettu) {
  const suhde = odotettu > 0 ? treeneja / odotettu : 0;
  const pros = suhde >= 1 ? 10 : suhde >= 0.85 ? 15 : suhde >= 0.7 ? 25 : suhde >= 0.5 ? 40 : null;
  if (pros === null) return null;
  return { pros, teksti: `Olit salisi aktiivisimman ${pros} %:n joukossa`, demo: true };
}

/**
 * monthRecap(tila, kuukausi 'YYYY-MM', nyt) → {
 *   kuukausi, otsikko: 'Lokakuusi', alku, loppu, hiljainen,
 *   ruudut: [{ id, otsikko, iso, teksti, ... }]   (tavallinen kuukausi 8 ruutua, hiljainen 6),
 *   tyyppi: { id, nimi, kuvaus },
 *   jako: { sanamerkki, otsikko, tyyppi, kohokohdat: [{ id, teksti, tekstiIlmanPainoja }] (3), jakoteksti }
 * }
 * Ruudut järjestyksessä (id): 'kuukausi' (treenit ja tunnit, vertailu: { pros, teksti, demo: true } | null),
 * 'liike' (eniten nostettu liike ja volyymi henkilöautoina, 1 400 kg/auto), 'edistys' (isoin edistys
 * arvioidussa voimassa), 'score' (Treeniscoren muutos), 'ajat' (ahkerin viikonpäivä ja vuorokaudenaika),
 * 'haasteet' (suoritetut haasteet ja kuun merkit), 'tyyppi' (treenityyppi) ja 'terveiset' (valmentajan
 * terveiset ja ensi kuun tavoite). Kesken oleva kuukausi lasketaan nyt-päivään asti.
 * Hiljainen kuukausi (alle 4 voimatreeniä): kannustava muotoilu, ei vertailuja (ei salivertailua eikä
 * edistys- ja score-ruutuja).
 */
export function monthRecap(tila, kuukausi, nyt) {
  const tanaan = tanaanPvm(nyt);
  // Virheellinen kuukausi (esim. '0000-01' tai '2026-13') → tämän päivän kuukausi (puolustava).
  const kuluva = kelvollinenKuukausi(tanaan.slice(0, 7)) ? tanaan.slice(0, 7) : '2000-01';
  const kk = kelvollinenKuukausi(kuukausi) ? kuukausi : kuluva;
  const rajat = kuukaudenRajat(kk);
  const alku = rajat.alku;
  const loppu = tanaan < rajat.loppu ? tanaan : rajat.loppu;
  const m = rajat.m - 1;
  const profiili = (tila && tila.profiili) || {};
  const { historia, kuun, voima, tuodut } = kuukaudenData(tila, alku, loppu);
  const hiljainen = voima.length < HILJAINEN_RAJA;
  const nimi = etunimi(profiili);
  const kuuIne = KUUKAUSI_INE[m];
  const ruudut = [];

  // 1. Kuukausi: treenit ja tunnit.
  const tunnit = Math.round((kuun.reduce((s, t) => s + (Number(t.kestoS) || 0), 0) / 3600) * 10) / 10;
  const paivia = daysBetween(alku, loppu) + 1;
  const odotettu = ((profiili.treenitViikossa ?? 3) * paivia) / 7;
  const vertailu = hiljainen ? null : saliVertailu(voima.length, odotettu);
  ruudut.push({
    id: 'kuukausi',
    otsikko: KUUKAUSI_SI[m],
    iso: voima.length === 1 ? '1 treeni' : `${voima.length} treeniä`,
    teksti: hiljainen
      ? (voima.length + tuodut.length > 0
        ? `${isoAlku(kuuIne)} liikuit ${kertaa(voima.length + tuodut.length)}, yhteensä ${desimaali(tunnit)} h. Jokainen kerta on askel eteenpäin – ja pohja ensi kuulle on valmis.`
        : `${isoAlku(kuuIne)} oli hiljaisempaa, ja se on täysin ok. Lepo kuuluu treeniin, ja ensi kuu alkaa puhtaalta pöydältä.`)
      : `${isoAlku(kuuIne)} teit ${voima.length} voimatreeniä${tuodut.length ? ` ja ${tuodut.length} muuta liikuntakertaa` : ''}. Liikuit yhteensä ${desimaali(tunnit)} tuntia.`,
    treeneja: voima.length,
    aktiviteetteja: tuodut.length,
    tunnit,
    vertailu,
  });

  // 2. Eniten nostettu liike ja volyymi henkilöautoina.
  const volyymit = liikeVolyymit(voima);
  const volyymi = voima.reduce((s, t) => s + workoutSummary(t, LIIKKEET).volyymi, 0);
  const autot = Math.round((volyymi / HENKILOAUTO_KG) * 10) / 10;
  const karki = volyymit[0] && volyymit[0].kg > 0 ? volyymit[0] : null;
  ruudut.push({
    id: 'liike',
    otsikko: 'Eniten nostettu liike',
    iso: karki ? karki.liike.nimi : 'Ensimmäiset nostot',
    teksti: karki
      ? `${karki.liike.nimi}: ${tuhannet(karki.kg)} kg. Koko kuukauden aikana nostit ${tuhannet(volyymi)} kg – saman verran kuin ${desimaali(autot)} henkilöautoa (1 400 kg/auto).`
      : 'Ensi kuussa lasketaan kiloja: jo muutama treeni nostaa kokonaisen henkilöauton (1 400 kg).',
    liikeId: karki ? karki.liike.id : null,
    liikeKg: karki ? karki.kg : 0,
    volyymi,
    henkiloautot: autot,
  });

  if (!hiljainen) {
    // 3. Isoin edistys.
    const ed = isoinEdistys(historia, voima, alku, loppu);
    ruudut.push({
      id: 'edistys',
      otsikko: 'Isoin edistys',
      iso: ed ? `+${desimaali(ed.pros)} %` : 'Vakaa pohja',
      teksti: ed
        ? `${ed.liike.nimi}: arvioitu voima ${desimaali(ed.ennen)} → ${desimaali(ed.nyt)} ${ed.yksikko}. Kehitys näkyy!`
        : 'Voimasi pysyi vakaana koko kuukauden. Tasainen pohja on paras alusta seuraavalle nousulle.',
      liikeId: ed ? ed.liike.id : null,
      pros: ed ? ed.pros : 0,
    });

    // 4. Treeniscoren muutos.
    const kp = profiili.kehonpaino;
    const ennen = scoreKohta(historia, kp, addDays(alku, -1));
    const jalkeen = scoreKohta(historia, kp, loppu);
    let teksti;
    if (ennen == null || jalkeen == null) {
      teksti = jalkeen != null ? `Treeniscoresi on nyt ${jalkeen}. Seuraavaksi seurataan, miten se nousee.` : 'Treeniscore avautuu, kun kaikille lihasryhmille on kertynyt sarjoja. Hyvä alku on jo tehty.';
    } else if (jalkeen > ennen) {
      teksti = `Treeniscoresi nousi kuukauden aikana ${ennen} → ${jalkeen}. Upeaa työtä!`;
    } else if (jalkeen === ennen) {
      teksti = `Treeniscoresi pysyi ${jalkeen}:ssa. Vakaa taso on hyvä lähtökohta uudelle nousulle.`;
    } else {
      teksti = `Treeniscoresi on ${jalkeen} (kuun alussa ${ennen}). Pieni notkahdus on normaalia, ja palautuminen tekee siitä ponnahduslaudan.`;
    }
    ruudut.push({
      id: 'score',
      otsikko: 'Treeniscore',
      iso: jalkeen != null ? String(jalkeen) : '–',
      teksti,
      ennen,
      jalkeen,
      muutos: ennen != null && jalkeen != null ? jalkeen - ennen : null,
    });
  }

  // 5. Ahkerin viikonpäivä ja vuorokaudenaika.
  const vkpLaskuri = new Array(7).fill(0);
  for (const t of voima) vkpLaskuri[viikonpaiva(t.pvm)] += 1;
  const vkpJarjestys = [1, 2, 3, 4, 5, 6, 0];
  const ahkerin = voima.length ? vkpJarjestys.reduce((a, b) => (vkpLaskuri[b] > vkpLaskuri[a] ? b : a)) : null;
  const ajat = { aamu: 0, paiva: 0, ilta: 0 };
  for (const t of voima) {
    const h = tunti(t);
    if (h !== null) ajat[vuorokaudenaika(h)] += 1;
  }
  const aika = Object.values(ajat).some((x) => x > 0)
    ? Object.keys(ajat).reduce((a, b) => (ajat[b] > ajat[a] ? b : a)) : null;
  ruudut.push({
    id: 'ajat',
    otsikko: 'Ahkerin hetkesi',
    iso: ahkerin !== null ? VKP_TAYSI[ahkerin] : 'Joka päivä uusi mahdollisuus',
    teksti: ahkerin !== null
      ? `Ahkerin treenipäiväsi oli ${VKP_TAYSI[ahkerin]}${aika ? `, ja treenasit useimmiten ${VUOROKAUDENAJAT[aika].adverbi}` : ''}.`
      : 'Ensi kuussa löydät oman treenirytmisi – kalenterivalmentaja auttaa löytämään sopivat ajat.',
    viikonpaiva: ahkerin !== null ? VKP_TAYSI[ahkerin] : null,
    vuorokaudenaika: aika,
  });

  // 6. Haasteet ja merkit.
  const haasteet = (tila && tila.yhteiso && Array.isArray(tila.yhteiso.haasteet) ? tila.yhteiso.haasteet : [])
    .filter((h) => h && h.liittynyt && typeof h.alku === 'string' && h.alku <= loppu && h.loppu >= alku && h.loppu <= rajat.loppu);
  const suoritetut = haasteet.filter((h) => challengeProgress(h, tila, nyt).suoritettu && h.tyyppi !== 'kaveri');
  const merkit = badges(tila, nyt).ansaitut.filter((b) => b.pvm >= alku && b.pvm <= loppu);
  ruudut.push({
    id: 'haasteet',
    otsikko: 'Haasteet ja merkit',
    iso: suoritetut.length ? lkm(suoritetut.length, 'haaste', 'haastetta') : lkm(merkit.length, 'merkki', 'merkkiä'),
    teksti: [
      suoritetut.length ? `Suoritit ${lkm(suoritetut.length, 'haasteen', 'haastetta')}: ${suoritetut.map((h) => h.nimi).join(', ')}.` : '',
      merkit.length ? `Ansaitsit ${lkm(merkit.length, 'merkin', 'merkkiä')}: ${merkit.map((b) => b.nimi).join(', ')}.` : '',
    ].filter(Boolean).join(' ')
      || 'Uusi kuukausi, uudet haasteet: liity Yhteisössä yhteen haasteeseen, niin ensi kuun koosteessa on mitali.',
    haasteet: suoritetut.map((h) => ({ id: h.id, nimi: h.nimi })),
    merkit: merkit.map((b) => ({ id: b.id, nimi: b.nimi })),
  });

  // 7. Treenityyppi.
  const persoona = trainingPersona(tila, kk);
  ruudut.push({ id: 'tyyppi', otsikko: 'Treenityyppisi', iso: persoona.nimi, teksti: persoona.kuvaus, tyyppiId: persoona.id });

  // 8. Valmentajan terveiset ja ensi kuun tavoite.
  const ensiTavoite = hiljainen ? Math.max(HILJAINEN_RAJA, voima.length + 2) : voima.length + 1;
  const seuraavaKk = KUUKAUSI_INE[(m + 1) % 12];
  ruudut.push({
    id: 'terveiset',
    otsikko: 'Valmentajan terveiset',
    iso: `${ensiTavoite} treeniä`,
    teksti: hiljainen
      ? `${nimi}, jokainen aloitus on rohkea teko. Tavoite ${seuraavaKk}: ${ensiTavoite} treeniä – pienin askelin, ja minä autan sovittamaan ne viikkoosi.`
      : `${nimi}, mahtava kuukausi! Tavoite ${seuraavaKk}: ${ensiTavoite} treeniä. Pidä rytmi, niin kehitys jatkuu.`,
    ensiKuunTavoite: { mittari: 'treenit', arvo: ensiTavoite },
  });

  // Jako: treenityyppi ja kolme kohokohtaa (4k A -jakokorttipohja).
  const liikeRuutu = ruudut.find((r) => r.id === 'liike');
  const edistysRuutu = ruudut.find((r) => r.id === 'edistys');
  const kohokohdat = [
    { id: 'treenit', teksti: `${voima.length} treeniä, ${desimaali(tunnit)} h`, tekstiIlmanPainoja: `${voima.length} treeniä, ${desimaali(tunnit)} h` },
    karki
      ? { id: 'volyymi', teksti: `${tuhannet(volyymi)} kg = ${desimaali(autot)} henkilöautoa`, tekstiIlmanPainoja: `Eniten treenattu: ${liikeRuutu.iso}` }
      : { id: 'aktiivisuus', teksti: `${kuun.length} liikuntakertaa`, tekstiIlmanPainoja: `${kuun.length} liikuntakertaa` },
    edistysRuutu && edistysRuutu.liikeId
      ? { id: 'edistys', teksti: `${edistysRuutu.iso} ${LIIKKEET.find((l) => l.id === edistysRuutu.liikeId).nimi}`, tekstiIlmanPainoja: `${edistysRuutu.iso} ${LIIKKEET.find((l) => l.id === edistysRuutu.liikeId).nimi}` }
      : { id: 'ajat', teksti: ruudut.find((r) => r.id === 'ajat').iso, tekstiIlmanPainoja: ruudut.find((r) => r.id === 'ajat').iso },
  ];
  return {
    kuukausi: kk,
    otsikko: KUUKAUSI_SI[m],
    alku,
    loppu,
    hiljainen,
    ruudut,
    tyyppi: { id: persoona.id, nimi: persoona.nimi, kuvaus: persoona.kuvaus },
    jako: {
      sanamerkki: SANAMERKKI,
      otsikko: `Treenikuukausi: ${KUUKAUSI_NOM[m]} ${kk.slice(0, 4)}`,
      tyyppi: persoona.nimi,
      kohokohdat,
      jakoteksti: `${KUUKAUSI_SI[m]} ${SANAMERKKI}issa: ${persoona.nimi}! ${kohokohdat.map((k) => k.tekstiIlmanPainoja).join(' · ')}`,
    },
  };
}

function kertaa(n) {
  return n === 1 ? 'kerran' : `${n} kertaa`;
}

// Lukumäärä ja substantiivi: 1 → akkusatiivi (1 haasteen), muuten partitiivi (3 haastetta).
function lkm(n, yksi, monta) {
  return `${n} ${n === 1 ? yksi : monta}`;
}

function isoAlku(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
