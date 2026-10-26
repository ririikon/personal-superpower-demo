// Työpaikkakanava (speksi 4l D): keksitty yritys "Esimerkki Oy", sen tiimit ja työpaikkahaaste sekä
// työnantajan näkymän kootut luvut. Puhdas moduuli: ei DOM-, window-, localStorage- eikä Date.now()-
// kutsuja. Aika annetaan parametrina.
//
// Kaikki työkavereiden data on mockup: jäsenet, lähtötasot ja edistyminen generoidaan
// deterministisesti (mulberry32). Käyttäjän oma panos lasketaan hänen kirjauksistaan.
// Työnantajan näkymässä on vain koottuja, anonyymejä lukuja, ja alle viiden hengen ryhmistä ei
// näytetä lukuja lainkaan.

import { addDays, onVoimatreeni } from './util.js?v=19a48e7';
import { challengeProgress, friendProgress } from './challenges.js?v=19a48e7';
import { mulberry32, tanaanPvm, kuukausiGen } from '../seed.js?v=19a48e7';

export const YRITYS = { id: 'esimerkki-oy', nimi: 'Esimerkki Oy' };
export const VAHIMMAISRYHMA = 5;
export const PIILOTETTU_TEKSTI = 'alle 5 – ei näytetä';
export const TYONANTAJA_MERKINTA = 'Työnantaja ei näe yksittäisen työntekijän tietoja';
export const KOKONAISUUS_HUOMIO = 'Luvut sisältävät vain tiimit, joissa on vähintään 5 jäsentä';
export const TYOPAIKKA_MITTARI = 'aktiivisetPaivat';
const KAYTTAJAN_TIIMI = 'kehitys';

// Tiimit: koko ilman käyttäjää, tiimin vire (kuinka hyvin tiimi tänä kuussa ylittää omat lähtötasonsa)
// ja osallistumistodennäköisyys. Talous on tarkoituksella alle vähimmäisryhmäkoon.
const TIIMIT = [
  { id: 'myynti', nimi: 'Myynti', koko: 8, vire: 1.05, osallistuu: 0.85 },
  { id: 'kehitys', nimi: 'Kehitys', koko: 6, vire: 1.0, osallistuu: 1 },
  { id: 'talous', nimi: 'Talous', koko: 4, vire: 1.0, osallistuu: 1 },
  { id: 'asiakaspalvelu', nimi: 'Asiakaspalvelu', koko: 11, vire: 0.94, osallistuu: 0.75 },
];
const PROFIILIT = ['aloittelija', 'keskitaso', 'keskitaso', 'kokenut'];

// FNV-1a: merkkijono → 32-bittinen siemen mulberry32:lle.
function siemen(teksti) {
  let h = 0x811c9dc5;
  for (let i = 0; i < teksti.length; i++) {
    h ^= teksti.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pyorista1(x) {
  return Math.round(x * 10) / 10;
}

function kuukaudenRajat(pvm) {
  const [y, m] = pvm.split('-').map(Number);
  const alku = `${y}-${String(m).padStart(2, '0')}-01`;
  const seuraava = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { alku, loppu: addDays(seuraava, -1) };
}

function suhde(arvo, lahtotaso) {
  if (lahtotaso > 0) return Math.round((arvo / lahtotaso) * 100);
  return arvo > 0 ? 100 : 0;
}

function keskiarvo(luvut) {
  return luvut.length ? luvut.reduce((s, x) => s + x, 0) / luvut.length : 0;
}

function jasenet(tiimi) {
  const rng = mulberry32(siemen(`tyopaikka|${YRITYS.id}|${tiimi.id}`));
  return Array.from({ length: tiimi.koko }, (_, i) => {
    const profiili = PROFIILIT[Math.floor(rng() * PROFIILIT.length)];
    const treenit = pyorista1(0.6 + rng() * 3.2);
    const muutos = 0.85 + rng() * 0.35;
    return {
      id: `${tiimi.id}-${i + 1}`,
      profiili,
      osallistuu: rng() < tiimi.osallistuu,
      lahtotasot: { aktiivisetPaivat: pyorista1(Math.min(7, treenit + 0.8 + rng() * 1.5)), treenit },
      viikkotreenit: pyorista1(treenit * (0.95 + rng() * 0.2)),
      viikkotreenitEnnen: pyorista1(treenit * muutos),
    };
  });
}

/**
 * tyopaikkaHaaste(tanaan) → työpaikkahaaste (yhteiso.haasteet-muoto, tyyppi 'tyopaikka') kuluvalle kuulle:
 * { id: 'tyopaikka-YYYY-MM', pohjaId: 'tyopaikka', tyyppi: 'tyopaikka', nimi: 'Lokakuun liikuntakuukausi',
 *   kuvaus, mittari: 'aktiivisetPaivat', tavoite: null (oma lähtötaso), alku, loppu, tasapainotus: true,
 *   yritys: 'Esimerkki Oy', palkinto: { pisteet: 50 }, liittynyt: true, luoja: 'demo' }
 */
export function tyopaikkaHaaste(tanaan) {
  const { alku, loppu } = kuukaudenRajat(tanaan);
  return {
    id: `tyopaikka-${alku.slice(0, 7)}`,
    pohjaId: 'tyopaikka',
    tyyppi: 'tyopaikka',
    nimi: `${kuukausiGen(alku)} liikuntakuukausi`,
    kuvaus: `${YRITYS.nimi}:n tiimit kisaavat aktiivisista päivistä. Tiimin tulos on jäsenten tasapainotettujen `
      + 'tulosten keskiarvo, joten kooltaan ja kunnoltaan erilaiset tiimit ovat tasavertaisia. Demo: kuvitteellinen yritys.',
    mittari: TYOPAIKKA_MITTARI,
    tavoite: null,
    alku,
    loppu,
    tasapainotus: true,
    yritys: YRITYS.nimi,
    palkinto: { pisteet: 50 },
    liittynyt: true,
    luoja: 'demo',
  };
}

/**
 * workplaceDemo(tanaan) → {
 *   yritys: { id, nimi, demo: true },
 *   tiimit: [{ id, nimi, jasenet: [{ id, profiili, osallistuu, lahtotasot: { aktiivisetPaivat, treenit },
 *              viikkotreenit, viikkotreenitEnnen }] }],   (Myynti 8, Kehitys 6 + käyttäjä, Talous 4, Asiakaspalvelu 11)
 *   kayttajanTiimi: 'kehitys', haaste: tyopaikkaHaaste(tanaan)
 * }
 * Jäsenet ovat anonyymejä (vain tunniste). Lähtötasot ovat viikkoarvoja kuten kavereilla (4i).
 */
export function workplaceDemo(tanaan) {
  return {
    yritys: { ...YRITYS, demo: true },
    tiimit: TIIMIT.map((t) => ({ id: t.id, nimi: t.nimi, jasenet: jasenet(t) })),
    kayttajanTiimi: KAYTTAJAN_TIIMI,
    haaste: tyopaikkaHaaste(tanaan),
  };
}

/**
 * uusiTyopaikkahaaste(yhteiso, tanaan) → yhteiso (sama olio, jos haaste on kuluvan kuun)
 * Latausajan uusinta: kun yhteiso.tyopaikka.haasteId:n haaste on päättynyt (tai puuttuu), kuluvan kuun
 * haaste lisätään haasteisiin (vanha säilyy päättyneenä) ja haasteId päivitetään.
 * Jos yhteiso.tyopaikka puuttuu, ei tehdä mitään.
 */
export function uusiTyopaikkahaaste(yhteiso, tanaan) {
  if (!yhteiso || typeof yhteiso !== 'object' || !yhteiso.tyopaikka || !tanaan) return yhteiso;
  const haasteet = Array.isArray(yhteiso.haasteet) ? yhteiso.haasteet : [];
  const nykyinen = haasteet.find((h) => h && h.id === yhteiso.tyopaikka.haasteId);
  if (nykyinen && nykyinen.alku <= tanaan && tanaan <= nykyinen.loppu) return yhteiso;
  const uusi = tyopaikkaHaaste(tanaan);
  const jo = haasteet.some((h) => h && h.id === uusi.id);
  return {
    ...yhteiso,
    haasteet: jo ? haasteet : [...haasteet, uusi],
    tyopaikka: { ...yhteiso.tyopaikka, haasteId: uusi.id },
  };
}

function tyopaikkaTila(tila) {
  return tila && tila.yhteiso && tila.yhteiso.tyopaikka && typeof tila.yhteiso.tyopaikka === 'object'
    ? tila.yhteiso.tyopaikka : null;
}

function nykyinenHaaste(tila, tanaan) {
  const tp = tyopaikkaTila(tila);
  const haasteet = tila && tila.yhteiso && Array.isArray(tila.yhteiso.haasteet) ? tila.yhteiso.haasteet : [];
  return (tp && haasteet.find((h) => h && h.id === tp.haasteId)) || tyopaikkaHaaste(tanaan);
}

// Jäsenen tasapainotettu tulos: tiimin vireellä skaalattu edistyminen / lähtötaso × 100 %.
function jasenenTulos(jasen, tiimi, haaste, nyt) {
  const mittari = haaste.mittari || TYOPAIKKA_MITTARI;
  const pituus = Math.round((Date.parse(`${haaste.loppu}T12:00:00Z`) - Date.parse(`${haaste.alku}T12:00:00Z`)) / 864e5) + 1;
  const viikossa = Number(jasen.lahtotasot[mittari] ?? jasen.lahtotasot.aktiivisetPaivat ?? 0);
  const kaveri = { id: jasen.id, profiili: jasen.profiili, lahtotasot: { [mittari]: viikossa * tiimi.vire } };
  const arvo = friendProgress(kaveri, haaste, nyt);
  return { arvo, pros: suhde(arvo, (viikossa * pituus) / 7) };
}

/**
 * teamStandings(haaste, tila, nyt) → [{
 *   id, nimi, jasenia, osallistujia, tulos (tasapainotettu keskiarvo, %), raakaYhteensa, sija,
 *   kayttajanTiimi: bool, omaPanos?: { pros, arvo, lahtotaso, vaikutus }   (vain käyttäjän tiimillä)
 * }]
 * Tiimin tulos on osallistuvien jäsenten tasapainotettujen tulosten (arvo / oma lähtötaso × 100 %)
 * keskiarvo, joten tiimin koko tai jäsenten kunto ei ratkaise. Käyttäjä (yhteiso.tyopaikka.tiimi,
 * oletus Kehitys) on oman tiiminsä jäsen, kun hän on liittynyt haasteeseen; hänen tuloksensa tulee
 * challengeProgress-funktiosta (arvo / lähtötaso). omaPanos.vaikutus = tiimin tulos käyttäjän kanssa −
 * ilman. haaste null → tilan nykyinen työpaikkahaaste. Järjestys tuloksen mukaan, tasatilanteessa sama sija.
 *
 * Vähimmäisryhmäkoko (5) pätee myös työntekijöiden tiimitaulukkoon: tiimi, jossa on alle 5 osallistujaa,
 * saa piilotettu: true, ja sen tulos, raakaYhteensa ja sija ovat null. Piilotetut tiimit ovat listan
 * lopussa alkuperäisessä järjestyksessä. Jos käyttäjän oma tiimi on piilotettu, omaPanos säilyy (pros,
 * arvo, lähtötaso), mutta vaikutus on null, jottei tiimin keskiarvoa voi päätellä.
 */
export function teamStandings(haaste, tila, nyt) {
  const tanaan = tanaanPvm(nyt);
  const h = haaste || nykyinenHaaste(tila, tanaan);
  const demo = workplaceDemo(tanaan);
  const tp = tyopaikkaTila(tila);
  const omaTiimi = (tp && tp.tiimi) || demo.kayttajanTiimi;
  const oma = h.liittynyt !== false ? challengeProgress(h, tila, nyt) : null;
  const omaPros = oma ? suhde(oma.arvo, oma.lahtotaso ?? 0) : null;

  const rivit = demo.tiimit.map((t) => {
    const maaritys = TIIMIT.find((x) => x.id === t.id);
    const tulokset = t.jasenet.filter((j) => j.osallistuu).map((j) => jasenenTulos(j, maaritys, h, nyt));
    const prosentit = tulokset.map((x) => x.pros);
    const kayttajanTiimi = t.id === omaTiimi;
    const rivi = {
      id: t.id,
      nimi: t.nimi,
      jasenia: t.jasenet.length + (kayttajanTiimi ? 1 : 0),
      osallistujia: prosentit.length,
      tulos: Math.round(keskiarvo(prosentit)),
      raakaYhteensa: tulokset.reduce((s, x) => s + x.arvo, 0),
      kayttajanTiimi,
    };
    if (kayttajanTiimi && oma) {
      const ilman = keskiarvo(prosentit);
      const kanssa = keskiarvo([...prosentit, omaPros]);
      rivi.osallistujia += 1;
      rivi.tulos = Math.round(kanssa);
      rivi.raakaYhteensa += oma.arvo;
      rivi.omaPanos = { pros: omaPros, arvo: oma.arvo, lahtotaso: oma.lahtotaso ?? 0, vaikutus: pyorista1(kanssa - ilman) };
    }
    if (rivi.osallistujia < VAHIMMAISRYHMA) {
      rivi.piilotettu = true;
      rivi.tulos = null;
      rivi.raakaYhteensa = null;
      if (rivi.omaPanos) rivi.omaPanos = { ...rivi.omaPanos, vaikutus: null };
    }
    return rivi;
  });
  const jarjestetty = rivit.filter((r) => !r.piilotettu).map((r, i) => ({ ...r, i }))
    .sort((a, b) => b.tulos - a.tulos || a.i - b.i);
  let sija = 0;
  const naytetyt = jarjestetty.map(({ i, ...r }, n) => {
    if (n === 0 || r.tulos !== jarjestetty[n - 1].tulos) sija = n + 1;
    return { ...r, sija };
  });
  return [...naytetyt, ...rivit.filter((r) => r.piilotettu).map((r) => ({ ...r, sija: null }))];
}

// Käyttäjän viikkotreenit: voimatreenit 28 päivän jaksoilta / 4 (nyt ja sitä edeltävä jakso).
function omatViikkotreenit(tila, tanaan) {
  const historia = tila && Array.isArray(tila.historia) ? tila.historia : [];
  const jakso = (a, b) => historia.filter((t) => onVoimatreeni(t) && typeof t.pvm === 'string' && t.pvm >= a && t.pvm <= b).length / 4;
  return {
    viikkotreenit: jakso(addDays(tanaan, -27), tanaan),
    viikkotreenitEnnen: jakso(addDays(tanaan, -55), addDays(tanaan, -28)),
  };
}

function aggregaatit(henkilot, osallistujat) {
  const aktiiviset = osallistujat.filter((j) => j.viikkotreenit >= 1).length;
  const nyt = keskiarvo(osallistujat.map((j) => j.viikkotreenit));
  const ennen = keskiarvo(osallistujat.map((j) => j.viikkotreenitEnnen));
  return {
    osallistumisaste: henkilot.length ? Math.round((osallistujat.length / henkilot.length) * 100) : 0,
    aktiivistenOsuus: osallistujat.length ? Math.round((aktiiviset / osallistujat.length) * 100) : 0,
    viikkotreenitKa: pyorista1(nyt),
    viikkotreenitMuutos: ennen > 0 ? Math.round(((nyt - ennen) / ennen) * 100) : 0,
  };
}

/**
 * employerDashboard(tila, nyt) → {
 *   yritys: 'Esimerkki Oy', demo: true, vahimmaisryhma: 5, merkinta: 'Työnantaja ei näe yksittäisen työntekijän tietoja',
 *   kokonaisuus: { tyontekijoita, osallistujia, osallistumisaste, aktiivistenOsuus, viikkotreenitKa, viikkotreenitMuutos,
 *                  huomio: 'Luvut sisältävät vain tiimit, joissa on vähintään 5 jäsentä', piilotettujaTiimeja },
 *   tiimit: [{ id, nimi, naytetaan, teksti?, osallistumisaste, aktiivistenOsuus, viikkotreenitKa, viikkotreenitMuutos, tulos, sija }],
 *   jarjestys: [{ sija, id, nimi, tulos }]   (näytettävät tiimit tasapainotetun tuloksen mukaan)
 * }
 * Vain kootut, anonyymit luvut: tulokseen ei tule yhdenkään henkilön tietoa tai tunnistetta. Ryhmä, jossa
 * on alle 5 osallistujaa, näytetään muodossa { naytetaan: false, teksti: 'alle 5 – ei näytetä' } ja sen
 * kaikki luvut ovat null. Prosentit ovat kokonaislukuja; viikkotreenitMuutos = muutos % edelliseen 4 viikkoon.
 * Aktiivinen = vähintään 1 treeni viikossa (4 viikon keskiarvo). Käyttäjä lasketaan omaan tiimiinsä.
 * Kokonaisluvut lasketaan vain näytettävistä tiimeistä, jotta piilotetun pienen tiimin lukuja ei voi
 * päätellä vähentämällä näkyvät tiimit yrityksen luvuista.
 */
export function employerDashboard(tila, nyt) {
  const tanaan = tanaanPvm(nyt);
  const demo = workplaceDemo(tanaan);
  const tp = tyopaikkaTila(tila);
  const omaTiimi = (tp && tp.tiimi) || demo.kayttajanTiimi;
  const haaste = nykyinenHaaste(tila, tanaan);
  const kayttajaMukana = haaste.liittynyt !== false;
  const sijat = new Map(teamStandings(haaste, tila, nyt).map((r) => [r.id, r]));

  const kaikki = [];
  const kaikkiOsallistujat = [];
  const tiimit = demo.tiimit.map((t) => {
    const henkilot = t.jasenet.slice();
    if (t.id === omaTiimi) henkilot.push({ osallistuu: kayttajaMukana, ...omatViikkotreenit(tila, tanaan) });
    const osallistujat = henkilot.filter((j) => j.osallistuu);
    if (osallistujat.length >= VAHIMMAISRYHMA) {
      kaikki.push(...henkilot);
      kaikkiOsallistujat.push(...osallistujat);
    }
    if (osallistujat.length < VAHIMMAISRYHMA) {
      return {
        id: t.id, nimi: t.nimi, naytetaan: false, teksti: PIILOTETTU_TEKSTI,
        osallistumisaste: null, aktiivistenOsuus: null, viikkotreenitKa: null, viikkotreenitMuutos: null, tulos: null, sija: null,
      };
    }
    return { id: t.id, nimi: t.nimi, naytetaan: true, ...aggregaatit(henkilot, osallistujat), tulos: sijat.get(t.id).tulos, sija: null };
  });
  const naytettavat = tiimit.filter((t) => t.naytetaan).sort((a, b) => b.tulos - a.tulos);
  let sija = 0;
  naytettavat.forEach((t, n) => {
    if (n === 0 || t.tulos !== naytettavat[n - 1].tulos) sija = n + 1;
    t.sija = sija;
  });
  return {
    yritys: YRITYS.nimi,
    demo: true,
    vahimmaisryhma: VAHIMMAISRYHMA,
    merkinta: TYONANTAJA_MERKINTA,
    kokonaisuus: {
      tyontekijoita: kaikki.length,
      osallistujia: kaikkiOsallistujat.length,
      ...aggregaatit(kaikki, kaikkiOsallistujat),
      huomio: KOKONAISUUS_HUOMIO,
      piilotettujaTiimeja: tiimit.filter((t) => !t.naytetaan).length,
    },
    tiimit,
    jarjestys: naytettavat.map((t) => ({ sija: t.sija, id: t.id, nimi: t.nimi, tulos: t.tulos })),
  };
}
