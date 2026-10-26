// Personal SuperPower POC: sisältödata (liikkeet, ohjelmat, merkkipaalut, oletusprofiili).
// Puhdas moduuli: ei DOMia, ei windowia, ei localStoragea eikä Date.now()-kutsuja.

export const LIHASRYHMAT = [
  'rinta', 'selkä', 'olkapäät', 'hauis', 'ojentajat',
  'etureidet', 'takareidet', 'pakarat', 'pohkeet', 'vatsa',
];

export const RYHMAT = {
  tyonnot: ['rinta', 'olkapäät', 'ojentajat'],
  vedot: ['selkä', 'hauis'],
  jalat: ['etureidet', 'takareidet', 'pakarat', 'pohkeet'],
};

export const VERTAILULIIKKEET = ['penkkipunnerrus', 'takakyykky', 'maastaveto', 'leuanveto', 'pystypunnerrus'];

// --- Salin laitteet (speksi 4j) ------------------------------------------------
// Lattia ja kehonpaino ovat aina käytettävissä, eikä niitä listata.
export const LAITERYHMAT = ['vapaat', 'laitteet', 'taljat', 'kehonpaino'];

export const LAITTEET = [
  { id: 'levytanko', nimi: 'Levytanko', ryhma: 'vapaat' },
  { id: 'kyykkyteline', nimi: 'Kyykkyteline', ryhma: 'vapaat' },
  { id: 'penkki', nimi: 'Penkki', ryhma: 'vapaat' },
  { id: 'käsipainot', nimi: 'Käsipainot', ryhma: 'vapaat' },
  { id: 'kahvakuulat', nimi: 'Kahvakuulat', ryhma: 'vapaat' },
  { id: 'jalkaprässi', nimi: 'Jalkaprässi', ryhma: 'laitteet' },
  { id: 'reiden-ojennuslaite', nimi: 'Reiden ojennus', ryhma: 'laitteet' },
  { id: 'reiden-koukistuslaite', nimi: 'Reiden koukistus', ryhma: 'laitteet' },
  { id: 'smith-laite', nimi: 'Smith-laite', ryhma: 'laitteet' },
  { id: 'rintaprässi', nimi: 'Rintaprässi', ryhma: 'laitteet' },
  { id: 'soutulaite', nimi: 'Soutulaite', ryhma: 'laitteet' },
  { id: 'lonkkalaite', nimi: 'Lonkkalaite (loitonnus ja lähennys)', ryhma: 'laitteet' },
  { id: 'pohjelaite', nimi: 'Pohjelaite', ryhma: 'laitteet' },
  { id: 'ylätalja', nimi: 'Ylätalja', ryhma: 'taljat' },
  { id: 'alatalja', nimi: 'Alatalja', ryhma: 'taljat' },
  { id: 'ristikkäistalja', nimi: 'Ristikkäistalja', ryhma: 'taljat' },
  { id: 'leuanvetotanko', nimi: 'Leuanvetotanko', ryhma: 'kehonpaino' },
  { id: 'dippiteline', nimi: 'Dippiteline', ryhma: 'kehonpaino' },
  { id: 'vastuskuminauhat', nimi: 'Vastuskuminauhat', ryhma: 'kehonpaino' },
  // HYROX-asemien laitteet (speksi 4k). Lisätty listan loppuun, jotta aiempien laitteiden järjestys säilyy.
  { id: 'skierg', nimi: 'SkiErg', ryhma: 'laitteet' },
  { id: 'kelkka', nimi: 'Kelkka (työntö ja veto)', ryhma: 'vapaat' },
  { id: 'wall-ball-pallo', nimi: 'Wall ball -pallo', ryhma: 'vapaat' },
  { id: 'hiekkasäkki', nimi: 'Hiekkasäkki', ryhma: 'vapaat' },
];

// HYROX-laitteet, joilla ei ole vastinetta vanhassa välinemallissa (profiili.valineet).
export const HYROX_LAITTEET = ['skierg', 'kelkka', 'wall-ball-pallo', 'hiekkasäkki'];

const KAIKKI_LAITTEET = LAITTEET.map((l) => l.id);

// Pikavalinnat Profiilin laitenäkymään.
export const LAITEPOHJAT = [
  { id: 'taysi-sali', nimi: 'Täysi kuntosali', laitteet: [...KAIKKI_LAITTEET] },
  { id: 'kotisali', nimi: 'Kotisali',
    laitteet: ['levytanko', 'kyykkyteline', 'penkki', 'käsipainot', 'leuanvetotanko', 'vastuskuminauhat'] },
  { id: 'hotellisali', nimi: 'Hotellisali', laitteet: ['käsipainot', 'penkki', 'ylätalja', 'alatalja'] },
  { id: 'vain-kehonpaino', nimi: 'Vain kehonpaino', laitteet: [] },
];

export const KAAVAT = [
  'kyykky', 'lantiosarana', 'vaakatyonto', 'pystytyonto', 'vaakaveto', 'pystyveto',
  'eristava-ylä', 'eristava-ala', 'keskivartalo',
  // Kestävyysasemat (HYROX, speksi 4k): oma liikemalli, jotta asemat eivät nouse voimaliikkeiden
  // ensisijaisiksi korvaajiksi pelkän kaavan perusteella.
  'kestavyys',
];
export const KUORMITUSALUEET = ['polvi', 'alaselkä', 'olkapää', 'kyynärpää', 'ranne'];

// Vanhan välinemallin (profiili.valineet) vastineet laitteina. Käytetään migraatiossa.
export const VALINE_LAITTEET = {
  levytanko: ['levytanko', 'kyykkyteline', 'penkki'],
  'käsipainot': ['käsipainot', 'penkki'],
  laitteet: LAITTEET.filter((l) => l.ryhma === 'laitteet' && !HYROX_LAITTEET.includes(l.id)).map((l) => l.id),
  taljat: LAITTEET.filter((l) => l.ryhma === 'taljat').map((l) => l.id),
  kehonpaino: ['leuanvetotanko', 'dippiteline'],
};

/**
 * valineetLaitteiksi(valineet, vainKehonpaino) → [laiteId] LAITTEET-järjestyksessä.
 * vainKehonpaino → tyhjä lista. Puuttuva tai tyhjä välinelista → täysi kuntosali, samoin vanha
 * oletusvalinta, jossa kaikki välineet ovat valittuina (myös laitteet, joilla ei ollut vastinetta).
 */
export function valineetLaitteiksi(valineet, vainKehonpaino = false) {
  if (vainKehonpaino) return [];
  if (!Array.isArray(valineet) || valineet.length === 0) return [...KAIKKI_LAITTEET];
  if (Object.keys(VALINE_LAITTEET).every((v) => valineet.includes(v))) return [...KAIKKI_LAITTEET];
  const joukko = new Set(valineet.flatMap((v) => VALINE_LAITTEET[v] || []));
  return KAIKKI_LAITTEET.filter((id) => joukko.has(id));
}

// Liikkeiden tarvikkeet, liikemalli (kaava) ja kuormittamat alueet (speksi 4j).
// [tarvikkeet, kaava, kuormittaa]; tyhjä tarvikelista = vain kehonpaino.
const VAIHTOTIEDOT = {
  penkkipunnerrus: [['levytanko', 'penkki'], 'vaakatyonto', ['olkapää', 'ranne']],
  'vinopenkkipunnerrus-kasipainot': [['käsipainot', 'penkki'], 'vaakatyonto', ['olkapää']],
  kasipainopenkkipunnerrus: [['käsipainot', 'penkki'], 'vaakatyonto', ['olkapää']],
  punnerrus: [[], 'vaakatyonto', ['olkapää', 'ranne']],
  'rintaprassi-laite': [['rintaprässi'], 'vaakatyonto', ['olkapää']],
  taljaristikkaisveto: [['ristikkäistalja'], 'eristava-ylä', ['olkapää']],
  leuanveto: [['leuanvetotanko'], 'pystyveto', ['olkapää', 'kyynärpää']],
  kulmasoutu: [['levytanko'], 'vaakaveto', ['alaselkä']],
  ylataljaveto: [['ylätalja'], 'pystyveto', ['olkapää', 'kyynärpää']],
  alataljasoutu: [['alatalja'], 'vaakaveto', []],
  kasipainosoutu: [['käsipainot', 'penkki'], 'vaakaveto', []],
  pystypunnerrus: [['levytanko'], 'pystytyonto', ['olkapää', 'alaselkä']],
  kasipainopystypunnerrus: [['käsipainot', 'penkki'], 'pystytyonto', ['olkapää']],
  vipunostot: [['käsipainot'], 'eristava-ylä', ['olkapää']],
  kasvoveto: [['ylätalja'], 'vaakaveto', ['olkapää']],
  'hauiskaanto-tanko': [['levytanko'], 'eristava-ylä', ['kyynärpää', 'ranne']],
  'hauiskaanto-kasipainot': [['käsipainot'], 'eristava-ylä', ['kyynärpää']],
  vasarakaanto: [['käsipainot'], 'eristava-ylä', ['kyynärpää']],
  'ojentajapunnerrus-talja': [['ylätalja'], 'eristava-ylä', ['kyynärpää']],
  'ranskalainen-punnerrus': [['levytanko', 'penkki'], 'eristava-ylä', ['kyynärpää']],
  dipit: [['dippiteline'], 'pystytyonto', ['olkapää', 'kyynärpää']],
  'kapea-penkkipunnerrus': [['levytanko', 'penkki'], 'vaakatyonto', ['olkapää', 'kyynärpää', 'ranne']],
  penkkidipit: [[], 'pystytyonto', ['olkapää', 'kyynärpää']], // penkin tai tuolin reuna
  takakyykky: [['levytanko', 'kyykkyteline'], 'kyykky', ['polvi', 'alaselkä']],
  jalkaprassi: [['jalkaprässi'], 'kyykky', ['polvi']],
  'askelkyykky-kasipainot': [['käsipainot'], 'kyykky', ['polvi']],
  'reiden-ojennus': [['reiden-ojennuslaite'], 'eristava-ala', ['polvi']],
  'bulgarialainen-kyykky': [['käsipainot', 'penkki'], 'kyykky', ['polvi']],
  ilmakyykky: [[], 'kyykky', ['polvi']],
  maastaveto: [['levytanko'], 'lantiosarana', ['alaselkä']],
  'romanialainen-maastaveto': [['levytanko'], 'lantiosarana', ['alaselkä']],
  'romanialainen-maastaveto-kasipainot': [['käsipainot'], 'lantiosarana', ['alaselkä']],
  'reiden-koukistus': [['reiden-koukistuslaite'], 'eristava-ala', ['polvi']],
  lantionnosto: [['levytanko', 'penkki'], 'lantiosarana', []],
  pakarasilta: [[], 'lantiosarana', []],
  'lonkan-loitonnus': [['lonkkalaite'], 'eristava-ala', []],
  // Seisten tehtävä pohjenousu on tämän liikkeen ohjeessa ja painoissa laitteella; portaalla
  // tehtävä versio on erillinen liike (yhden-jalan-pohjenousu).
  'pohjenousu-seisten': [['pohjelaite'], 'eristava-ala', []],
  'pohjenousu-istuen': [['pohjelaite'], 'eristava-ala', []],
  'yhden-jalan-pohjenousu': [[], 'eristava-ala', []],
  vatsarutistus: [[], 'keskivartalo', []],
  'roikkuen-jalkojen-nosto': [['leuanvetotanko'], 'keskivartalo', ['olkapää']],
  taljarutistus: [['ylätalja'], 'keskivartalo', []],
  // Välineettömät liikkeet, jotta "Vain kehonpaino" kattaa kaikki lihasryhmät.
  'superman-selkaojennus': [[], 'keskivartalo', ['alaselkä']],
  'pike-punnerrus': [[], 'pystytyonto', ['olkapää', 'ranne']],
  pyyhehauis: [[], 'eristava-ylä', ['kyynärpää']],
  'liukuva-reiden-koukistus': [[], 'eristava-ala', ['polvi']],
  // HYROX-asemat (speksi 4k).
  skierg: [['skierg'], 'kestavyys', ['olkapää']],
  kelkkatyonto: [['kelkka'], 'kestavyys', ['polvi']],
  kelkkaveto: [['kelkka'], 'kestavyys', ['alaselkä', 'kyynärpää']],
  'burpee-pituushyppy': [[], 'kestavyys', ['polvi', 'ranne']],
  soutu: [['soutulaite'], 'kestavyys', ['alaselkä']],
  farmarikavely: [['käsipainot'], 'kestavyys', ['ranne']],
  hiekkasakkiaskelkyykky: [['hiekkasäkki'], 'kestavyys', ['polvi']],
  'wall-ball': [['wall-ball-pallo'], 'kestavyys', ['polvi', 'olkapää']],
};

// Täydentää liikkeen oletuskentät. Painoliikkeillä annetaan viitekerroin ja aloituspaino (kg),
// kehonpainoliikkeillä viitetoistot. youtubeId on aina null (tunnisteita ei keksitä).
// `valine` on vanha välinemalli, jota näkymät käyttävät yhä; laitevaihdot käyttävät `tarvikkeet`-kenttää.
function maarita({
  id, nimi, lihasryhma, toissijaiset = [], valine, alue, ohje,
  viitekerroin = null, viitetoistot = null, aloituspaino = 0, hakusana, animaatio = null,
}) {
  const [tarvikkeet, kaava, kuormittaa] = VAIHTOTIEDOT[id] || [[], null, []];
  return {
    id, nimi, lihasryhma, toissijaiset, valine, alue, ohje,
    viitekerroin, viitetoistot, aloituspaino,
    tarvikkeet: [...tarvikkeet], kaava, kuormittaa: [...kuormittaa],
    media: { youtubeId: null, hakusana, animaatio },
  };
}

// HYROX-asemaliike (speksi 4k): tavallisen liikkeen kentät sekä
// - tapahtuma: 'hyrox' (näkymä voi ryhmitellä asemat),
// - toistoYksikko: mitä sarjan "toistot" tarkoittavat ('kcal' | 'osuutta' | 'toistoa'). Matka-asemat
//   (kelkat, farmarikävely) kirjataan osuuksina (osuusM metriä), jotta volyymi (paino × toistot) pysyy
//   järkevänä: metrit toistoina tuottaisivat tuhansien kilojen volyymeja yhdestä asemasta,
// - osuusM (matka-asemat): yhden osuuden pituus metreinä,
// - vaihtoehtoTarvikkeet (valinnainen): tarvikeyhdistelmät, joilla aseman voi tehdä ilman omaa laitetta.
// Kestävyysasemat ilman ulkoista kuormaa (SkiErg, soutu, burpee) ovat valine 'kehonpaino', jolloin
// painokenttää ei tarvita ja arvioitu voima on paras "toistomäärä" (kcal tai toistot).
function asema({ toistoYksikko, osuusM = null, vaihtoehtoTarvikkeet = null, ...kentat }) {
  const l = maarita(kentat);
  l.tapahtuma = 'hyrox';
  l.toistoYksikko = toistoYksikko;
  if (osuusM) l.osuusM = osuusM;
  if (vaihtoehtoTarvikkeet) l.vaihtoehtoTarvikkeet = vaihtoehtoTarvikkeet.map((t) => [...t]);
  return l;
}

export const LIIKKEET = [
  // --- Rinta ---
  maarita({
    id: 'penkkipunnerrus', nimi: 'Penkkipunnerrus', lihasryhma: 'rinta',
    toissijaiset: ['ojentajat', 'olkapäät'], valine: 'levytanko', alue: 'ylä',
    viitekerroin: 1.0, aloituspaino: 40,
    hakusana: 'barbell bench press form', animaatio: 'penkki',
    ohje: 'Asetu penkille niin, että silmät ovat tangon alla ja lapaluut puristettu yhteen. Laske tanko hallitusti rinnan alaosaan kyynärpäät noin 45 asteen kulmassa vartaloon nähden. Punnerra ylös jalat tukevasti lattiassa ja pakarat penkissä. Käytä raskailla sarjoilla varmistajaa tai turvatukia.',
  }),
  maarita({
    id: 'vinopenkkipunnerrus-kasipainot', nimi: 'Vinopenkkipunnerrus käsipainoilla', lihasryhma: 'rinta',
    toissijaiset: ['olkapäät', 'ojentajat'], valine: 'käsipainot', alue: 'ylä',
    viitekerroin: 0.35, aloituspaino: 12.5,
    hakusana: 'incline dumbbell press form',
    ohje: 'Säädä penkin selkänoja noin 30 asteen kulmaan ja tuo käsipainot polvien avulla olkapäiden kohdalle. Laske painot hallitusti rinnan yläosan sivuille ja punnerra ylös kohti toisiaan. Pidä lapaluut alhaalla ja takana koko sarjan ajan.',
  }),
  maarita({
    id: 'kasipainopenkkipunnerrus', nimi: 'Käsipainopenkkipunnerrus', lihasryhma: 'rinta',
    toissijaiset: ['ojentajat', 'olkapäät'], valine: 'käsipainot', alue: 'ylä',
    viitekerroin: 0.4, aloituspaino: 15,
    hakusana: 'dumbbell bench press form',
    ohje: 'Makaa tasapenkillä käsipainot rinnan sivuilla ja jalat tukevasti lattiassa. Punnerra painot ylös niin, että ne kohtaavat rinnan yläpuolella, ja laske ne hitaasti takaisin. Pidä ranteet suorina kyynärvarsien jatkeena. Laske painot sarjan lopuksi rauhallisesti reisille ennen kuin nouset istumaan.',
  }),
  maarita({
    id: 'punnerrus', nimi: 'Punnerrus', lihasryhma: 'rinta',
    toissijaiset: ['ojentajat', 'olkapäät', 'vatsa'], valine: 'kehonpaino', alue: 'ylä',
    viitetoistot: 25,
    hakusana: 'push up form',
    ohje: 'Aseta kädet hartioiden leveydelle ja pidä vartalo suorana kantapäistä päähän. Laske rintakehä lähelle lattiaa kyynärpäät hieman vartaloa kohti ja punnerra takaisin ylös. Älä anna lantion painua tai nousta. Helpota tarvittaessa tekemällä liike polviltaan tai kädet korokkeella.',
  }),
  maarita({
    id: 'rintaprassi-laite', nimi: 'Rintaprässi laitteessa', lihasryhma: 'rinta',
    toissijaiset: ['ojentajat', 'olkapäät'], valine: 'laitteet', alue: 'ylä',
    viitekerroin: 0.8, aloituspaino: 30,
    hakusana: 'machine chest press form',
    ohje: 'Säädä istuimen korkeus niin, että kahvat ovat rinnan keskikohdan tasolla. Punnerra kahvat eteen lukitsematta kyynärpäitä täysin suoriksi. Palauta hitaasti, kunnes tunnet kevyen venytyksen rinnassa. Pidä selkä kiinni selkänojassa koko liikkeen ajan.',
  }),
  maarita({
    id: 'taljaristikkaisveto', nimi: 'Taljaristikkäisveto', lihasryhma: 'rinta',
    toissijaiset: ['olkapäät'], valine: 'taljat', alue: 'ylä',
    viitekerroin: 0.25, aloituspaino: 10,
    hakusana: 'cable crossover form',
    ohje: 'Seiso taljojen välissä toinen jalka edessä ja kyynärpäät kevyesti koukussa. Tuo kahvat kaarevassa liikkeessä yhteen rinnan eteen ja purista hetki. Palauta hallitusti niin, ettei paino vedä olkapäitä liian taakse.',
  }),

  // --- Selkä ---
  maarita({
    id: 'leuanveto', nimi: 'Leuanveto', lihasryhma: 'selkä',
    toissijaiset: ['hauis'], valine: 'kehonpaino', alue: 'ylä',
    viitetoistot: 10,
    hakusana: 'pull up form', animaatio: 'leuanveto',
    ohje: 'Tartu tankoon hieman hartioita leveämmällä otteella ja aloita suorin käsin roikkuen. Vedä lapaluut alas ja nosta leuka tangon yläpuolelle ilman heilautusta. Laske itsesi hallitusti takaisin ala-asentoon. Jos täysi toisto ei vielä onnistu, käytä kuminauhaa tai avustavaa laitetta.',
  }),
  maarita({
    id: 'kulmasoutu', nimi: 'Kulmasoutu levytangolla', lihasryhma: 'selkä',
    toissijaiset: ['hauis', 'olkapäät'], valine: 'levytanko', alue: 'ylä',
    viitekerroin: 0.8, aloituspaino: 40,
    hakusana: 'barbell bent over row form',
    ohje: 'Seiso jalat lantion leveydellä, koukista polvia hieman ja kallista ylävartalo eteen suoralla selällä. Vedä tanko alavatsaa kohti kyynärpäät vartalon vieressä ja purista lapaluita yhteen. Laske tanko hallitusti suoriin käsiin niin, ettei selkä pyöristy.',
  }),
  maarita({
    id: 'ylataljaveto', nimi: 'Ylätaljaveto', lihasryhma: 'selkä',
    toissijaiset: ['hauis'], valine: 'taljat', alue: 'ylä',
    viitekerroin: 0.7, aloituspaino: 35,
    hakusana: 'lat pulldown form',
    ohje: 'Istu laitteeseen reidet tukien alla ja tartu tankoon hartioita leveämmällä otteella. Vedä tanko solisluiden tasolle rinta ylhäällä ja kyynärpäät alas ja taakse. Palauta hitaasti suoriin käsiin nykimättä painoa.',
  }),
  maarita({
    id: 'alataljasoutu', nimi: 'Alataljasoutu', lihasryhma: 'selkä',
    toissijaiset: ['hauis', 'olkapäät'], valine: 'taljat', alue: 'ylä',
    viitekerroin: 0.7, aloituspaino: 35,
    hakusana: 'seated cable row form',
    ohje: 'Istu selkä suorana jalat tuilla ja polvet hieman koukussa. Vedä kahva vatsaa kohti ja vie lapaluut yhteen niin, ettei ylävartalo keinu taakse. Palauta hallitusti, kunnes kädet ovat suorat ja lapaluut liukuvat eteen.',
  }),
  maarita({
    id: 'kasipainosoutu', nimi: 'Yhden käden käsipainosoutu', lihasryhma: 'selkä',
    toissijaiset: ['hauis'], valine: 'käsipainot', alue: 'ylä',
    viitekerroin: 0.35, aloituspaino: 15,
    hakusana: 'one arm dumbbell row form',
    ohje: 'Tue toinen käsi ja polvi penkkiin ja pidä selkä suorana ja lattian suuntaisena. Vedä käsipaino lantion viereen kyynärpää vartaloa pitkin. Laske paino hallitusti alas kiertämättä ylävartaloa.',
  }),
  maarita({
    id: 'superman-selkaojennus', nimi: 'Superman-selkäojennus', lihasryhma: 'selkä',
    toissijaiset: ['pakarat'], valine: 'kehonpaino', alue: 'ylä',
    viitetoistot: 20,
    hakusana: 'superman back extension form',
    ohje: 'Makaa vatsallasi lattialla kädet suorina pään jatkeena. Nosta kädet, rintakehä ja jalat hieman irti lattiasta ja purista lapaluita yhteen. Pidä yläasento hetken ja laske hallitusti alas. Pidä katse lattiassa, jotta niska pysyy neutraalina.',
  }),

  // --- Olkapäät ---
  maarita({
    id: 'pystypunnerrus', nimi: 'Pystypunnerrus', lihasryhma: 'olkapäät',
    toissijaiset: ['ojentajat'], valine: 'levytanko', alue: 'ylä',
    viitekerroin: 0.6, aloituspaino: 25,
    hakusana: 'barbell overhead press form', animaatio: 'pystypunnerrus',
    ohje: 'Seiso jalat lantion leveydellä ja pidä tanko solisluiden päällä kyynärpäät hieman tangon edessä. Jännitä pakarat ja vatsa ja punnerra tanko suoraan ylös niin, että pää siirtyy käsien väliin yläasennossa. Laske hallitusti takaisin rinnalle notkistamatta alaselkää.',
  }),
  maarita({
    id: 'kasipainopystypunnerrus', nimi: 'Käsipainopystypunnerrus istuen', lihasryhma: 'olkapäät',
    toissijaiset: ['ojentajat'], valine: 'käsipainot', alue: 'ylä',
    viitekerroin: 0.25, aloituspaino: 10,
    hakusana: 'seated dumbbell shoulder press form',
    ohje: 'Istu penkillä selkänoja pystyssä ja nosta käsipainot olkapäiden tasolle. Punnerra painot ylös pään yläpuolelle ja laske ne hallitusti takaisin korvien tasolle. Pidä alaselkä kiinni selkänojassa.',
  }),
  maarita({
    id: 'vipunostot', nimi: 'Vipunostot sivuille', lihasryhma: 'olkapäät',
    toissijaiset: [], valine: 'käsipainot', alue: 'ylä',
    viitekerroin: 0.1, aloituspaino: 5,
    hakusana: 'dumbbell lateral raise form',
    ohje: 'Seiso käsipainot sivuilla ja kyynärpäät hieman koukussa. Nosta painot sivuille olkapäiden korkeudelle johtaen liikettä kyynärpäillä. Laske hitaasti ilman heilautusta, ja valitse mieluummin liian kevyt kuin liian raskas paino.',
  }),
  maarita({
    id: 'kasvoveto', nimi: 'Kasvoveto taljassa', lihasryhma: 'olkapäät',
    toissijaiset: ['selkä'], valine: 'taljat', alue: 'ylä',
    viitekerroin: 0.25, aloituspaino: 12.5,
    hakusana: 'cable face pull form',
    ohje: 'Säädä talja silmien korkeudelle ja tartu köysikahvaan peukalot taaksepäin. Vedä köyttä kasvoja kohti ja levitä kädet sivuille niin, että kyynärpäät ovat korkealla. Palauta hallitusti ja pidä ylävartalo paikallaan.',
  }),
  maarita({
    id: 'pike-punnerrus', nimi: 'Pike-punnerrus', lihasryhma: 'olkapäät',
    toissijaiset: ['ojentajat'], valine: 'kehonpaino', alue: 'ylä',
    viitetoistot: 15,
    hakusana: 'pike push up form',
    ohje: 'Asetu punnerrusasentoon ja kävele jalkoja käsiä kohti, kunnes lantio nousee korkealle ja vartalo muodostaa ylösalaisin olevan V:n. Laske päälakea lattiaa kohti koukistamalla kyynärpäitä ja punnerra takaisin ylös. Pidä paino käsillä ja selkä suorana. Helpota liikettä tekemällä se kädet korokkeella.',
  }),

  // --- Hauis ---
  maarita({
    id: 'hauiskaanto-tanko', nimi: 'Hauiskääntö levytangolla', lihasryhma: 'hauis',
    toissijaiset: [], valine: 'levytanko', alue: 'ylä',
    viitekerroin: 0.35, aloituspaino: 20,
    hakusana: 'barbell curl form',
    ohje: 'Seiso suorana tanko reisien edessä kämmenet eteenpäin. Koukista kyynärpäät ja nosta tanko rinnan tasolle pitäen olkavarret vartalon vieressä. Laske hitaasti suoriin käsiin heiluttamatta vartaloa.',
  }),
  maarita({
    id: 'hauiskaanto-kasipainot', nimi: 'Hauiskääntö käsipainoilla', lihasryhma: 'hauis',
    toissijaiset: [], valine: 'käsipainot', alue: 'ylä',
    viitekerroin: 0.15, aloituspaino: 7.5,
    hakusana: 'dumbbell curl form',
    ohje: 'Seiso tai istu käsipainot sivuilla kämmenet eteenpäin. Nosta painot vuorotellen tai yhtä aikaa olkapäitä kohti olkavarret paikallaan. Laske hallitusti ala-asentoon asti.',
  }),
  maarita({
    id: 'vasarakaanto', nimi: 'Vasarakääntö', lihasryhma: 'hauis',
    toissijaiset: [], valine: 'käsipainot', alue: 'ylä',
    viitekerroin: 0.15, aloituspaino: 7.5,
    hakusana: 'hammer curl form',
    ohje: 'Pidä käsipainoja kämmenet vartaloa kohti kuin vasaraa. Koukista kyynärpää ja nosta paino olkapäätä kohti ranteen asentoa muuttamatta. Laske hitaasti ja pidä olkavarsi vartalon vieressä.',
  }),
  maarita({
    id: 'pyyhehauis', nimi: 'Pyyhehauis', lihasryhma: 'hauis',
    toissijaiset: [], valine: 'kehonpaino', alue: 'ylä',
    viitetoistot: 15,
    hakusana: 'towel bicep curl form',
    ohje: 'Astu pyyhkeen keskelle toisella jalalla ja tartu pyyhkeen päihin kämmenet ylöspäin. Koukista kyynärpäät ja vedä pyyhettä ylös samalla, kun jalka vastustaa liikettä. Laske hitaasti jalan vastusta vastaan ja pidä olkavarret vartalon vieressä. Voit myös pitää liikkeen puolivälissä 20–30 sekunnin pidon.',
  }),

  // --- Ojentajat ---
  maarita({
    id: 'ojentajapunnerrus-talja', nimi: 'Ojentajapunnerrus taljassa', lihasryhma: 'ojentajat',
    toissijaiset: [], valine: 'taljat', alue: 'ylä',
    viitekerroin: 0.3, aloituspaino: 15,
    hakusana: 'cable triceps pushdown form',
    ohje: 'Seiso taljan edessä ja tartu kahvaan tai köyteen kyynärpäät kylkiä vasten. Ojenna kyynärpäät suoriksi ja palauta hallitusti noin 90 asteen kulmaan. Vain kyynärvarret liikkuvat, ja olkavarret pysyvät paikallaan.',
  }),
  maarita({
    id: 'ranskalainen-punnerrus', nimi: 'Ranskalainen punnerrus', lihasryhma: 'ojentajat',
    toissijaiset: [], valine: 'levytanko', alue: 'ylä',
    viitekerroin: 0.3, aloituspaino: 15,
    hakusana: 'skull crusher form',
    ohje: 'Makaa penkillä ja pidä tankoa suorin käsin rinnan yläpuolella kapealla otteella. Laske tanko koukistamalla vain kyynärpäitä otsan tai pään taakse. Ojenna takaisin ylös pitäen kyynärpäät lähellä toisiaan. Aloita kevyellä painolla, sillä liike kuormittaa kyynärpäitä.',
  }),
  maarita({
    id: 'dipit', nimi: 'Dipit', lihasryhma: 'ojentajat',
    toissijaiset: ['rinta', 'olkapäät'], valine: 'kehonpaino', alue: 'ylä',
    viitetoistot: 15,
    hakusana: 'dips form',
    ohje: 'Tue itsesi suorin käsin dippitelineeseen ja pidä hartiat alhaalla. Laske itseäsi koukistamalla kyynärpäät noin 90 asteeseen ja punnerra takaisin ylös. Älä laskeudu syvemmälle kuin olkapäät kivuttomasti sallivat. Helpota tarvittaessa kuminauhalla tai avustavalla laitteella.',
  }),
  maarita({
    id: 'kapea-penkkipunnerrus', nimi: 'Kapea penkkipunnerrus', lihasryhma: 'ojentajat',
    toissijaiset: ['rinta', 'olkapäät'], valine: 'levytanko', alue: 'ylä',
    viitekerroin: 0.8, aloituspaino: 30,
    hakusana: 'close grip bench press form',
    ohje: 'Tartu tankoon hartioiden levyisellä otteella penkillä maaten. Laske tanko rinnan alaosaan kyynärpäät lähellä vartaloa ja punnerra ylös ojentajilla. Älä kavenna otetta liikaa, jotta ranteet pysyvät suorina. Käytä varmistajaa raskailla sarjoilla.',
  }),
  maarita({
    id: 'penkkidipit', nimi: 'Penkkidipit', lihasryhma: 'ojentajat',
    toissijaiset: ['rinta', 'olkapäät'], valine: 'kehonpaino', alue: 'ylä',
    viitetoistot: 20,
    hakusana: 'bench dips form',
    ohje: 'Istu penkin tai tuolin reunalla ja tue kädet reunaan lantion viereen sormet eteenpäin. Siirrä lantio penkin eteen ja laske itseäsi koukistamalla kyynärpäät noin 90 asteeseen, selkä lähellä penkkiä. Punnerra takaisin ylös ojentajilla. Helpota koukistamalla polvia ja lopeta, jos olkapään etuosaan sattuu.',
  }),

  // --- Etureidet ---
  maarita({
    id: 'takakyykky', nimi: 'Takakyykky', lihasryhma: 'etureidet',
    toissijaiset: ['pakarat', 'takareidet'], valine: 'levytanko', alue: 'ala',
    viitekerroin: 1.25, aloituspaino: 50,
    hakusana: 'barbell back squat form', animaatio: 'kyykky',
    ohje: 'Aseta tanko yläselän päälle ja seiso jalat hartioiden leveydellä varpaat hieman ulospäin. Hengitä sisään, jännitä keskivartalo ja laske lantiota alas ja taakse niin, että polvet seuraavat varpaiden suuntaa. Mene niin syvälle kuin pystyt selkä neutraalina ja nouse ylös koko jalkapohjalla työntäen. Käytä telineen turvatukia.',
  }),
  maarita({
    id: 'jalkaprassi', nimi: 'Jalkaprässi', lihasryhma: 'etureidet',
    toissijaiset: ['pakarat'], valine: 'laitteet', alue: 'ala',
    viitekerroin: 2.0, aloituspaino: 80,
    hakusana: 'leg press form',
    ohje: 'Istu laitteeseen selkä tiiviisti selkänojaa vasten ja aseta jalat levylle hartioiden leveydelle. Laske levyä hallitusti, kunnes polvet ovat noin 90 asteen kulmassa, ja työnnä takaisin ylös. Älä lukitse polvia täysin suoriksi yläasennossa.',
  }),
  maarita({
    id: 'askelkyykky-kasipainot', nimi: 'Askelkyykky käsipainoilla', lihasryhma: 'etureidet',
    toissijaiset: ['pakarat'], valine: 'käsipainot', alue: 'ala',
    viitekerroin: 0.25, aloituspaino: 10,
    hakusana: 'dumbbell lunge form',
    ohje: 'Pidä käsipainoja sivuilla ja ota pitkä askel eteen. Laske takapolvea kohti lattiaa niin, että etupolvi pysyy nilkan yläpuolella. Työnnä etujalan kantapäällä takaisin alkuasentoon ja vaihda jalkaa.',
  }),
  maarita({
    id: 'reiden-ojennus', nimi: 'Reiden ojennus laitteessa', lihasryhma: 'etureidet',
    toissijaiset: [], valine: 'laitteet', alue: 'ala',
    viitekerroin: 0.6, aloituspaino: 25,
    hakusana: 'leg extension form',
    ohje: 'Säädä selkänoja niin, että polvet ovat laitteen kääntöakselin kohdalla ja tyyny nilkkojen edessä. Ojenna polvet suoriksi ja purista hetki etureisiä. Laske paino hitaasti takaisin niin, ettei se iske pinoon.',
  }),
  maarita({
    id: 'bulgarialainen-kyykky', nimi: 'Bulgarialainen askelkyykky', lihasryhma: 'etureidet',
    toissijaiset: ['pakarat'], valine: 'käsipainot', alue: 'ala',
    viitekerroin: 0.2, aloituspaino: 7.5,
    hakusana: 'bulgarian split squat form',
    ohje: 'Aseta takajalan jalkapöytä penkille ja astu etujalalla riittävän pitkälle eteen. Laske lantiota suoraan alas, kunnes etureisi on lähes vaakatasossa, ja nouse etujalalla työntäen. Aloita ilman painoja, jos tasapaino vaatii harjoittelua.',
  }),
  maarita({
    id: 'ilmakyykky', nimi: 'Kyykky kehonpainolla', lihasryhma: 'etureidet',
    toissijaiset: ['pakarat'], valine: 'kehonpaino', alue: 'ala',
    viitetoistot: 40,
    hakusana: 'bodyweight squat form',
    ohje: 'Seiso jalat hartioiden leveydellä ja kädet edessä tasapainon tukena. Laske lantiota alas ja taakse selkä suorana ja kantapäät lattiassa. Nouse ylös ojentamalla polvet ja lonkat samanaikaisesti.',
  }),

  // --- Takareidet ---
  maarita({
    id: 'maastaveto', nimi: 'Maastaveto', lihasryhma: 'takareidet',
    toissijaiset: ['pakarat', 'selkä', 'etureidet'], valine: 'levytanko', alue: 'ala',
    viitekerroin: 1.5, aloituspaino: 60,
    hakusana: 'barbell deadlift form', animaatio: 'maastaveto',
    ohje: 'Seiso tangon takana niin, että tanko on jalkaterien keskikohdan päällä, ja tartu siihen hartioiden leveydeltä. Jännitä keskivartalo, pidä selkä neutraalina ja nosta tanko työntämällä jaloilla lattiaa ja pidä tanko lähellä sääriä. Ojenna lonkat yläasennossa nojaamatta taaksepäin ja laske tanko samaa linjaa pitkin. Lopeta sarja, jos selkä alkaa pyöristyä.',
  }),
  maarita({
    id: 'romanialainen-maastaveto', nimi: 'Romanialainen maastaveto', lihasryhma: 'takareidet',
    toissijaiset: ['pakarat', 'selkä'], valine: 'levytanko', alue: 'ala',
    viitekerroin: 1.0, aloituspaino: 40,
    hakusana: 'romanian deadlift form',
    ohje: 'Aloita seisten tanko reisien edessä ja polvet hieman koukussa. Vie lantiota taakse ja laske tankoa reisiä pitkin selkä suorana, kunnes tunnet venytyksen takareisissä. Nouse ylös ojentamalla lonkat ja puristamalla pakaroita.',
  }),
  maarita({
    id: 'romanialainen-maastaveto-kasipainot', nimi: 'Romanialainen maastaveto käsipainoilla', lihasryhma: 'takareidet',
    toissijaiset: ['pakarat', 'selkä'], valine: 'käsipainot', alue: 'ala',
    viitekerroin: 0.4, aloituspaino: 15,
    hakusana: 'dumbbell romanian deadlift form',
    ohje: 'Seiso käsipainot reisien edessä ja polvet hieman koukussa. Vie lantiota taakse ja laske painoja reisiä pitkin selkä suorana, kunnes tunnet venytyksen takareisissä. Nouse ylös ojentamalla lonkat ja pidä painot lähellä jalkoja koko liikkeen ajan.',
  }),
  maarita({
    id: 'reiden-koukistus', nimi: 'Reiden koukistus laitteessa', lihasryhma: 'takareidet',
    toissijaiset: ['pohkeet'], valine: 'laitteet', alue: 'ala',
    viitekerroin: 0.5, aloituspaino: 25,
    hakusana: 'leg curl machine form',
    ohje: 'Säädä laite niin, että polvinivel on laitteen kääntöakselin kohdalla ja tyyny nilkkojen yläpuolella. Koukista polvet niin pitkälle kuin hallitusti pystyt ja palauta hitaasti. Pidä lantio kiinni penkissä koko liikkeen ajan.',
  }),
  maarita({
    id: 'liukuva-reiden-koukistus', nimi: 'Liukuva reiden koukistus', lihasryhma: 'takareidet',
    toissijaiset: ['pakarat'], valine: 'kehonpaino', alue: 'ala',
    viitetoistot: 12,
    hakusana: 'sliding leg curl form',
    ohje: 'Makaa selälläsi liukkaalla lattialla sukat jalassa tai kantapäät pyyhkeen päällä. Nosta lantio ylös pakarasiltaan ja vedä kantapäät pakaroita kohti koukistamalla polvia. Liu\'uta jalat hitaasti takaisin suoriksi niin, ettei lantio putoa. Helpota liikettä laskemalla lantio lattiaan toistojen välissä.',
  }),

  // --- Pakarat ---
  maarita({
    id: 'lantionnosto', nimi: 'Lantionnosto levytangolla', lihasryhma: 'pakarat',
    toissijaiset: ['takareidet'], valine: 'levytanko', alue: 'ala',
    viitekerroin: 1.25, aloituspaino: 50,
    hakusana: 'barbell hip thrust form',
    ohje: 'Istu lattialla yläselkä penkin reunaa vasten ja aseta pehmustettu tanko lantion päälle. Työnnä kantapäillä ja nosta lantio ylös, kunnes vartalo on suorassa linjassa polvista hartioihin. Purista pakaroita yläasennossa ja laske hallitusti alaselkää notkistamatta.',
  }),
  maarita({
    id: 'pakarasilta', nimi: 'Pakarasilta', lihasryhma: 'pakarat',
    toissijaiset: ['takareidet'], valine: 'kehonpaino', alue: 'ala',
    viitetoistot: 30,
    hakusana: 'glute bridge form',
    ohje: 'Makaa selällään polvet koukussa ja jalkapohjat lattiassa. Nosta lantio ylös työntämällä kantapäillä ja purista pakaroita yläasennossa. Laske hitaasti takaisin ja pidä vatsa jännitettynä koko liikkeen ajan.',
  }),
  maarita({
    id: 'lonkan-loitonnus', nimi: 'Lonkan loitonnus laitteessa', lihasryhma: 'pakarat',
    toissijaiset: [], valine: 'laitteet', alue: 'ala',
    viitekerroin: 0.6, aloituspaino: 30,
    hakusana: 'hip abduction machine form',
    ohje: 'Istu laitteeseen selkä selkänojaa vasten ja tyynyt polvien ulkosivuilla. Työnnä polvet ulospäin hallitusti ja palauta hitaasti. Vältä nykimistä ja pidä lantio paikallaan istuimessa.',
  }),

  // --- Pohkeet ---
  maarita({
    id: 'pohjenousu-seisten', nimi: 'Pohjenousu seisten', lihasryhma: 'pohkeet',
    toissijaiset: [], valine: 'laitteet', alue: 'ala',
    viitekerroin: 1.0, aloituspaino: 40,
    hakusana: 'standing calf raise form',
    ohje: 'Asetu laitteeseen päkiät korokkeen reunalla ja hartiat tyynyjen alla. Nouse varpaille niin korkealle kuin pystyt ja laske kantapäät hitaasti korokkeen tason alapuolelle. Pidä polvet suorina mutta lukitsematta.',
  }),
  maarita({
    id: 'pohjenousu-istuen', nimi: 'Pohjenousu istuen', lihasryhma: 'pohkeet',
    toissijaiset: [], valine: 'laitteet', alue: 'ala',
    viitekerroin: 0.6, aloituspaino: 25,
    hakusana: 'seated calf raise form',
    ohje: 'Istu laitteeseen tyynyt reisien päällä ja päkiät korokkeella. Nosta kantapäät ylös ja pidä yläasento hetken. Laske hitaasti täyteen venytykseen.',
  }),
  maarita({
    id: 'yhden-jalan-pohjenousu', nimi: 'Yhden jalan pohjenousu', lihasryhma: 'pohkeet',
    toissijaiset: [], valine: 'kehonpaino', alue: 'ala',
    viitetoistot: 20,
    hakusana: 'single leg calf raise form',
    ohje: 'Seiso yhdellä jalalla portaan tai korokkeen reunalla ja ota tukea seinästä. Nouse varpaille hallitusti ja laske kantapää alas venytykseen. Tee sama määrä toistoja molemmilla jaloilla.',
  }),

  // --- Vatsa ---
  maarita({
    id: 'vatsarutistus', nimi: 'Vatsarutistus', lihasryhma: 'vatsa',
    toissijaiset: [], valine: 'kehonpaino', alue: 'ylä',
    viitetoistot: 30,
    hakusana: 'crunch form',
    ohje: 'Makaa selällään polvet koukussa ja kädet kevyesti ohimoilla. Rullaa ylävartaloa ylös vatsalihaksilla, kunnes lapaluut irtoavat lattiasta. Laske hitaasti takaisin vetämättä päätä käsillä.',
  }),
  maarita({
    id: 'roikkuen-jalkojen-nosto', nimi: 'Jalkojen nosto roikkuen', lihasryhma: 'vatsa',
    toissijaiset: [], valine: 'kehonpaino', alue: 'ylä',
    viitetoistot: 12,
    hakusana: 'hanging leg raise form',
    ohje: 'Roiku leuanvetotangosta suorin käsin ja pidä hartiat aktiivisina. Nosta polvet tai suorat jalat lantion tasolle kallistamalla lantiota taakse. Laske hallitusti ilman heilumista.',
  }),
  maarita({
    id: 'taljarutistus', nimi: 'Taljarutistus', lihasryhma: 'vatsa',
    toissijaiset: [], valine: 'taljat', alue: 'ylä',
    viitekerroin: 0.4, aloituspaino: 20,
    hakusana: 'cable crunch form',
    ohje: 'Polvistu ylätaljan eteen ja pidä köyttä pään sivuilla. Rutista ylävartaloa alas pyöristämällä selkää vatsalihaksilla, kunnes kyynärpäät ovat lähellä reisiä. Palauta hitaasti ja pidä lantio paikallaan.',
  }),

  // --- HYROX-asemat (speksi 4k) ---
  asema({
    id: 'skierg', nimi: 'SkiErg', lihasryhma: 'selkä',
    toissijaiset: ['ojentajat', 'vatsa', 'olkapäät'], valine: 'kehonpaino', alue: 'ylä',
    viitetoistot: 20, toistoYksikko: 'kcal',
    hakusana: 'skierg technique form',
    ohje: 'Seiso laitteen edessä jalat lantion leveydellä ja tartu kahvoihin kädet ylhäällä. Vedä kahvat alas ja taakse koko vartalolla niin, että lantio liikkuu taakse ja polvet koukistuvat hieman. Palauta kädet ylös rauhallisesti ennen seuraavaa vetoa. Pidä tahti tasaisena, sillä liian kova alku kostautuu kisassa myöhemmin.',
  }),
  asema({
    id: 'kelkkatyonto', nimi: 'Kelkkatyöntö', lihasryhma: 'etureidet',
    toissijaiset: ['pakarat', 'pohkeet', 'ojentajat'], valine: 'laitteet', alue: 'ala',
    viitekerroin: 0.55, aloituspaino: 40, toistoYksikko: 'osuutta', osuusM: 12.5,
    hakusana: 'sled push form',
    ohje: 'Tartu kelkan pystykahvoihin kädet suorina tai hieman koukussa ja nojaa eteen niin, että vartalo on vinossa linjassa. Työnnä lyhyin, voimakkain askelin päkiöillä ja pidä lantio matalalla. Pidä katse eteenpäin ja selkä neutraalina koko matkan.',
  }),
  asema({
    id: 'kelkkaveto', nimi: 'Kelkkaveto', lihasryhma: 'selkä',
    toissijaiset: ['hauis', 'takareidet', 'pakarat'], valine: 'laitteet', alue: 'ylä',
    viitekerroin: 0.4, aloituspaino: 30, toistoYksikko: 'osuutta', osuusM: 12.5,
    hakusana: 'sled pull rope form',
    ohje: 'Seiso tukevasti jalat leveällä ja polvet hieman koukussa köysi edessäsi. Vedä köyttä vuorokäsin kohti lantiota ja käytä jalkoja ja lantiota apuna vetojen välissä. Pidä selkä suorana äläkä nojaa liikaa taakse.',
  }),
  asema({
    id: 'burpee-pituushyppy', nimi: 'Burpee-pituushyppy', lihasryhma: 'pakarat',
    toissijaiset: ['etureidet', 'rinta', 'ojentajat'], valine: 'kehonpaino', alue: 'ala',
    viitetoistot: 15, toistoYksikko: 'toistoa',
    hakusana: 'burpee broad jump form',
    ohje: 'Laskeudu burpeen ala-asentoon rinta lattiaan ja punnerra tai nouse takaisin kyykkyyn. Hyppää molemmilla jaloilla eteenpäin ja laskeudu pehmeästi polvet varpaiden suuntaisesti. Pidä tasainen rytmi, sillä hengitys tasaantuu helpommin kuin rynnistäen.',
  }),
  asema({
    id: 'soutu', nimi: 'Soutu soutulaitteella', lihasryhma: 'selkä',
    toissijaiset: ['etureidet', 'takareidet', 'hauis'], valine: 'kehonpaino', alue: 'ylä',
    viitetoistot: 20, toistoYksikko: 'kcal',
    hakusana: 'rowing machine technique form',
    ohje: 'Aloita veto jaloilla, jatka nojaamalla hieman taakse ja vedä kahva lopuksi alarintaan. Palauta päinvastaisessa järjestyksessä: kädet, ylävartalo ja vasta sitten polvet. Pidä selkä suorana ja hartiat rentoina koko vedon ajan.',
  }),
  asema({
    id: 'farmarikavely', nimi: 'Farmarikävely', lihasryhma: 'vatsa',
    toissijaiset: ['selkä', 'olkapäät', 'pohkeet'], valine: 'käsipainot', alue: 'ylä',
    viitekerroin: 0.2, aloituspaino: 15, toistoYksikko: 'osuutta', osuusM: 25,
    vaihtoehtoTarvikkeet: [['kahvakuulat']],
    hakusana: 'farmers carry form',
    ohje: 'Nosta käsipainot tai kahvakuulat lattialta suoralla selällä ja seiso pystyssä hartiat alhaalla. Kävele lyhyin, nopein askelin niin, että vartalo pysyy pystysuorassa eikä heilu. Laske painot hallitusti, kun ote alkaa pettää.',
  }),
  asema({
    id: 'hiekkasakkiaskelkyykky', nimi: 'Hiekkasäkkiaskelkyykky', lihasryhma: 'etureidet',
    toissijaiset: ['pakarat', 'takareidet', 'vatsa'], valine: 'laitteet', alue: 'ala',
    viitekerroin: 0.25, aloituspaino: 20, toistoYksikko: 'toistoa',
    hakusana: 'sandbag walking lunge form',
    ohje: 'Nosta hiekkasäkki hartioille niskan taakse ja pidä ylävartalo pystyssä. Astu pitkä askel eteen ja laske takapolvi kevyesti lattiaan. Nouse etujalan kantapäällä työntäen ja jatka seuraavaan askeleeseen toisella jalalla.',
  }),
  asema({
    id: 'wall-ball', nimi: 'Wall ball', lihasryhma: 'etureidet',
    toissijaiset: ['olkapäät', 'pakarat', 'ojentajat'], valine: 'laitteet', alue: 'ala',
    viitekerroin: 0.1, aloituspaino: 5, toistoYksikko: 'toistoa',
    vaihtoehtoTarvikkeet: [['kahvakuulat'], ['käsipainot']],
    hakusana: 'wall ball shot form',
    ohje: 'Pidä palloa rinnan edessä ja kyykkää vähintään reisien vaakatasoon. Nouse räjähtävästi ja heitä pallo jalkojen voimalla kohti seinän maalia. Ota pallo kiinni ja jatka suoraan seuraavaan kyykkyyn. Ilman palloa tee sama liike kahvakuulalla tai käsipainolla kyykky ja pystypunnerrus yhdistäen.',
  }),
];

// Juoksu (speksi 4k) on kestoliike: se kirjataan kestona tai matkana ilman sarjoja. Juoksu ei ole
// LIIKKEET-listassa, jotta se ei näy vaihtoehtohaussa, Treeniscoressa eikä sarjatavoitteissa.
// Treenissä juoksu tallennetaan liikkeenä { liikeId: 'juoksu', tyyppi: 'kesto', kestoMin, matkaKm?,
// sarjat: [] }, jolloin olemassa olevat laskennat (volyymi, ennätykset, sarjat) ohittavat sen.
export const JUOKSU = {
  id: 'juoksu',
  nimi: 'Juoksu',
  tyyppi: 'kesto',
  lihasryhma: 'etureidet',
  toissijaiset: ['takareidet', 'pohkeet', 'pakarat'],
  alue: 'ala',
  kirjaus: ['kestoMin', 'matkaKm'],
  tarvikkeet: [],
  kuormittaa: ['polvi'],
  ohje: 'Juokse rennosti pystyasennossa ja anna käsien heilua vartalon vieressä. Pidä askel lyhyenä ja kevyenä niin, että jalka osuu maahan lähelle vartalon alle. Rauhallinen juoksu tehdään vauhdilla, jolla pystyt puhumaan.',
  media: { youtubeId: null, hakusana: 'running technique form', animaatio: null },
};

// Liike tai juoksu tunnisteella (näkymille, jotka näyttävät myös tapahtuman juoksurivin).
export function liikeTaiJuoksu(id) {
  return id === JUOKSU.id ? JUOKSU : LIIKKEET.find((l) => l.id === id);
}

// HYROX-asemat kisajärjestyksessä (speksi 4k). harjoitus = asemaharjoituksen oletussarjat ohjelmapäivään;
// toistot tulkitaan liikkeen toistoYksikko-kentän mukaan.
export const HYROX_ASEMAT = [
  { asema: 1, liikeId: 'skierg', kisamatka: '1000 m', harjoitus: { sarjat: 3, toistoMin: 12, toistoMax: 15, palautusS: 90 } },
  { asema: 2, liikeId: 'kelkkatyonto', kisamatka: '50 m', harjoitus: { sarjat: 4, toistoMin: 2, toistoMax: 2, palautusS: 120 } },
  { asema: 3, liikeId: 'kelkkaveto', kisamatka: '50 m', harjoitus: { sarjat: 4, toistoMin: 2, toistoMax: 2, palautusS: 120 } },
  { asema: 4, liikeId: 'burpee-pituushyppy', kisamatka: '80 m', harjoitus: { sarjat: 3, toistoMin: 8, toistoMax: 10, palautusS: 90 } },
  { asema: 5, liikeId: 'soutu', kisamatka: '1000 m', harjoitus: { sarjat: 3, toistoMin: 12, toistoMax: 15, palautusS: 90 } },
  { asema: 6, liikeId: 'farmarikavely', kisamatka: '200 m', harjoitus: { sarjat: 3, toistoMin: 2, toistoMax: 2, palautusS: 90 } },
  { asema: 7, liikeId: 'hiekkasakkiaskelkyykky', kisamatka: '100 m', harjoitus: { sarjat: 3, toistoMin: 10, toistoMax: 12, palautusS: 90 } },
  { asema: 8, liikeId: 'wall-ball', kisamatka: '100 toistoa', harjoitus: { sarjat: 3, toistoMin: 15, toistoMax: 20, palautusS: 90 } },
];

// Tavoitetapahtumat (speksi 4k). luokka ohjaa ohjelmapäivän lisäyksiä: hyrox = asemat ja juoksu,
// juoksu = juoksurivi, turnaus ja oma = vain jaksotuksen kertoimet.
export const TAPAHTUMATYYPIT = [
  { id: 'hyrox', nimi: 'HYROX', luokka: 'hyrox',
    kuvaus: '8 × 1 km juoksua ja 8 toiminnallista asemaa vuorotellen.' },
  { id: 'juoksu-5km', nimi: 'Juoksukisa 5 km', luokka: 'juoksu', matkaKm: 5,
    kuvaus: 'Lyhyt kilpailumatka: vauhtikestävyys ja reipas kisavauhti.' },
  { id: 'juoksu-10km', nimi: 'Juoksukisa 10 km', luokka: 'juoksu', matkaKm: 10,
    kuvaus: 'Kymppi: peruskestävyys ja tasainen kisavauhti.' },
  { id: 'puolimaraton', nimi: 'Puolimaraton', luokka: 'juoksu', matkaKm: 21.1,
    kuvaus: '21,1 km: pitkät lenkit ja kestävyyspohja ratkaisevat.' },
  { id: 'padel-turnaus', nimi: 'Padel-turnaus', luokka: 'turnaus',
    kuvaus: 'Useita otteluita peräkkäin: nopeus, ketteryys ja palautuminen pelien välillä.' },
  { id: 'salibandyturnaus', nimi: 'Salibandyturnaus', luokka: 'turnaus',
    kuvaus: 'Lyhyitä, kovia vaihtoja: räjähtävyys, suunnanmuutokset ja toistuva sprinttikyky.' },
  { id: 'oma', nimi: 'Oma tavoite', luokka: 'oma',
    kuvaus: 'Oma päivämäärätavoite: jaksotus keventää treeniä ennen tavoitepäivää.' },
];

// HYROX-divisioonat (speksi 4k). Vaikuttavat painoihin tekstitasolla (painoOhje asemariveillä).
export const HYROX_DIVISIOONAT = [
  { id: 'open', nimi: 'Open',
    kuvaus: 'Perussarja kevyemmillä kisapainoilla.',
    painoOhje: 'Open: harjoittele asemat kisapainoa kevyemmällä kuormalla tekniikka edellä.' },
  { id: 'pro', nimi: 'Pro',
    kuvaus: 'Raskaammat kisapainot kelkoissa, hiekkasäkissä, farmarikävelyssä ja wall ballissa.',
    painoOhje: 'Pro: kuormita kelkat, hiekkasäkki ja painot raskaammin, lähelle kisapainoa.' },
  { id: 'doubles', nimi: 'Doubles',
    kuvaus: 'Pareittain: juoksut yhdessä, asematyö jaetaan parin kanssa.',
    painoOhje: 'Doubles: tee asemat lyhyinä, kovina pätkinä vuorotellen parin kanssa.' },
];

export function liike(id) {
  return LIIKKEET.find((l) => l.id === id);
}

// Ohjelman liikerivi. Arvot ovat oletuksia; goalParams ohittaa ne treeniä aloitettaessa.
function rivi(liikeId, sarjat, toistoMin, toistoMax, palautusS) {
  return { liikeId, sarjat, toistoMin, toistoMax, palautusS };
}

export const OHJELMAT = [
  {
    id: 'koko-kroppa-3',
    nimi: 'Koko kroppa 3x/vko',
    kuvaus: 'Kolme koko kehon treeniä viikossa. Jokainen lihasryhmä saa ärsykkeen useasti viikossa, ja palautumiselle jää aikaa treenien väliin.',
    tasot: 'aloittelija',
    paivat: [
      {
        nimi: 'Päivä A',
        liikkeet: [
          rivi('takakyykky', 3, 6, 10, 150),
          rivi('penkkipunnerrus', 3, 6, 10, 150),
          rivi('ylataljaveto', 3, 8, 12, 120),
          rivi('vipunostot', 3, 10, 15, 60),
          rivi('reiden-koukistus', 3, 10, 15, 90),
          rivi('vatsarutistus', 3, 12, 20, 60),
        ],
      },
      {
        nimi: 'Päivä B',
        liikkeet: [
          rivi('romanialainen-maastaveto', 3, 6, 10, 150),
          rivi('pystypunnerrus', 3, 6, 10, 150),
          rivi('leuanveto', 3, 5, 10, 120),
          rivi('vinopenkkipunnerrus-kasipainot', 3, 8, 12, 90),
          rivi('pohjenousu-seisten', 3, 10, 15, 60),
          rivi('hauiskaanto-tanko', 3, 8, 12, 60),
        ],
      },
      {
        nimi: 'Päivä C',
        liikkeet: [
          rivi('maastaveto', 3, 5, 8, 180),
          rivi('askelkyykky-kasipainot', 3, 8, 12, 90),
          rivi('kasipainopenkkipunnerrus', 3, 8, 12, 90),
          rivi('kasipainosoutu', 3, 8, 12, 90),
          rivi('lantionnosto', 3, 8, 12, 90),
          rivi('ojentajapunnerrus-talja', 3, 10, 15, 60),
        ],
      },
    ],
  },
  {
    id: 'yla-ala-4',
    nimi: 'Ylä/ala 4x/vko',
    kuvaus: 'Neljä treeniä viikossa vuorotellen ylä- ja alavartalolle. Jokainen lihasryhmä treenataan kahdesti viikossa, ja treenikohtainen volyymi on suurempi kuin koko kehon ohjelmassa.',
    tasot: 'keskitaso',
    paivat: [
      {
        nimi: 'Ylävartalo A',
        liikkeet: [
          rivi('penkkipunnerrus', 4, 6, 10, 150),
          rivi('kulmasoutu', 4, 6, 10, 150),
          rivi('kasipainopystypunnerrus', 3, 8, 12, 90),
          rivi('ylataljaveto', 3, 8, 12, 90),
          rivi('hauiskaanto-tanko', 3, 8, 12, 60),
          rivi('ojentajapunnerrus-talja', 3, 10, 15, 60),
        ],
      },
      {
        nimi: 'Alavartalo A',
        liikkeet: [
          rivi('takakyykky', 4, 6, 10, 180),
          rivi('romanialainen-maastaveto', 3, 8, 10, 150),
          rivi('jalkaprassi', 3, 10, 15, 120),
          rivi('reiden-koukistus', 3, 10, 15, 90),
          rivi('pohjenousu-seisten', 3, 10, 15, 60),
          rivi('taljarutistus', 3, 10, 15, 60),
        ],
      },
      {
        nimi: 'Ylävartalo B',
        liikkeet: [
          rivi('pystypunnerrus', 4, 6, 10, 150),
          rivi('leuanveto', 4, 5, 10, 150),
          rivi('vinopenkkipunnerrus-kasipainot', 3, 8, 12, 90),
          rivi('alataljasoutu', 3, 8, 12, 90),
          rivi('vipunostot', 3, 12, 15, 60),
          rivi('vasarakaanto', 3, 8, 12, 60),
          rivi('ranskalainen-punnerrus', 3, 8, 12, 60),
        ],
      },
      {
        nimi: 'Alavartalo B',
        liikkeet: [
          rivi('maastaveto', 3, 5, 8, 180),
          rivi('bulgarialainen-kyykky', 3, 8, 12, 90),
          rivi('lantionnosto', 3, 8, 12, 90),
          rivi('reiden-ojennus', 3, 10, 15, 60),
          rivi('pohjenousu-istuen', 3, 12, 15, 60),
          rivi('roikkuen-jalkojen-nosto', 3, 8, 15, 60),
        ],
      },
    ],
  },
  {
    id: 'ppl-6',
    nimi: 'Työntö/veto/jalat 6x/vko',
    kuvaus: 'Kuusi treeniä viikossa jaettuna työntöihin, vetoihin ja jalkoihin. Jokainen lihasryhmä treenataan kahdesti viikossa suurella volyymilla, joten ohjelma sopii kokeneelle treenaajalle.',
    tasot: 'kokenut',
    paivat: [
      {
        nimi: 'Työntö A',
        liikkeet: [
          rivi('penkkipunnerrus', 4, 6, 10, 150),
          rivi('kasipainopystypunnerrus', 3, 8, 12, 90),
          rivi('vinopenkkipunnerrus-kasipainot', 3, 8, 12, 90),
          rivi('vipunostot', 3, 12, 15, 60),
          rivi('ojentajapunnerrus-talja', 3, 10, 15, 60),
          rivi('dipit', 3, 6, 12, 90),
        ],
      },
      {
        nimi: 'Veto A',
        liikkeet: [
          rivi('leuanveto', 4, 5, 10, 150),
          rivi('kulmasoutu', 3, 6, 10, 120),
          rivi('alataljasoutu', 3, 8, 12, 90),
          rivi('kasvoveto', 3, 12, 15, 60),
          rivi('hauiskaanto-tanko', 3, 8, 12, 60),
          rivi('vasarakaanto', 3, 10, 12, 60),
        ],
      },
      {
        nimi: 'Jalat A',
        liikkeet: [
          rivi('takakyykky', 4, 6, 10, 180),
          rivi('romanialainen-maastaveto', 3, 8, 10, 150),
          rivi('jalkaprassi', 3, 10, 15, 120),
          rivi('reiden-koukistus', 3, 10, 15, 90),
          rivi('pohjenousu-seisten', 4, 10, 15, 60),
          rivi('vatsarutistus', 3, 12, 20, 60),
        ],
      },
      {
        nimi: 'Työntö B',
        liikkeet: [
          rivi('pystypunnerrus', 4, 6, 10, 150),
          rivi('kasipainopenkkipunnerrus', 3, 8, 12, 90),
          rivi('rintaprassi-laite', 3, 10, 12, 90),
          rivi('taljaristikkaisveto', 3, 12, 15, 60),
          rivi('vipunostot', 3, 12, 15, 60),
          rivi('ranskalainen-punnerrus', 3, 8, 12, 60),
        ],
      },
      {
        nimi: 'Veto B',
        liikkeet: [
          rivi('ylataljaveto', 4, 8, 12, 120),
          rivi('kasipainosoutu', 3, 8, 12, 90),
          rivi('alataljasoutu', 3, 10, 12, 90),
          rivi('kasvoveto', 3, 12, 15, 60),
          rivi('hauiskaanto-kasipainot', 3, 8, 12, 60),
        ],
      },
      {
        nimi: 'Jalat B',
        liikkeet: [
          rivi('maastaveto', 3, 5, 8, 180),
          rivi('bulgarialainen-kyykky', 3, 8, 12, 90),
          rivi('lantionnosto', 3, 8, 12, 90),
          rivi('reiden-ojennus', 3, 10, 15, 60),
          rivi('pohjenousu-istuen', 4, 12, 15, 60),
          rivi('roikkuen-jalkojen-nosto', 3, 8, 15, 60),
        ],
      },
    ],
  },
];

// Merkkipaalujen määritelmät (speksin kohta 4e). Saavuttamisen logiikka on engine.milestones-funktiossa.
export const MERKKIPAALUT = [
  { id: 'eka-treeni', nimi: 'Ensimmäinen treeni', kuvake: 'star' },
  { id: 'treenit-10', nimi: '10 treeniä', kuvake: 'dumbbell' },
  { id: 'treenit-50', nimi: '50 treeniä', kuvake: 'medal' },
  { id: 'treenit-100', nimi: '100 treeniä', kuvake: 'crown' },
  { id: 'eka-ennatys', nimi: 'Ensimmäinen ennätys', kuvake: 'trophy' },
  { id: 'putki-4-viikkoa', nimi: '4 viikon putki', kuvake: 'flame' },
  { id: 'volyymi-10000', nimi: '10 000 kg yhdessä treenissä', kuvake: 'weight' },
];

// Haastemerkit (speksin kohta 4i). Ansaitsemisen logiikka on engine/challenges.js:n badges-funktiossa.
// Uudet kuvakkeet (calendar, users, gift) piirretään näkymässä; tuntematon kuvake näytetään tähtenä.
export const HAASTEMERKIT = [
  { id: 'kuukauden-haaste', nimi: 'Kuukauden haaste', kuvake: 'calendar', ehto: 'Suorita oma kuukauden haaste' },
  { id: 'eka-kaverihaaste', nimi: 'Ensimmäinen kaverihaaste', kuvake: 'users', ehto: 'Osallistu kaverihaasteeseen loppuun asti' },
  { id: 'voitettu-kaverihaaste', nimi: 'Voitettu kaverihaaste', kuvake: 'trophy', ehto: 'Voita kaverihaaste' },
  { id: 'kumppanihaaste', nimi: 'Kumppanihaaste', kuvake: 'gift', ehto: 'Suorita kumppanin haaste' },
  // Kutsuhaaste (speksi 4k): ansaitaan, kun kutsuttu kaveri tekee ensimmäisen treeninsä (engine/invite.js).
  { id: 'treenikaveri', nimi: 'Treenikaveri', kuvake: 'users', ehto: 'Kutsu kaveri, joka tekee ensimmäisen treeninsä' },
];

// Esimerkkitiedosto ohjelman tuontiin (speksi 4k D). Demossa tunnistus näyttää aina tämän: raakarivit
// ovat kuin tekstintunnistuksen tulos PT:n ohjelmatiedostosta. Rivi "Landmine press" puuttuu
// liikekirjastosta, joten se näkyy rivinä "Valitse vastaava liike".
export const ESIMERKKITUONTI = {
  id: 'pt-ohjelma-esimerkki',
  nimi: 'PT-ohjelma (esimerkki)',
  tiedosto: 'PT-ohjelma_syksy.pdf',
  ilmoitus: 'Demossa tunnistus näyttää esimerkin – tuotteessa tekoäly lukee tiedostosi.',
  rivit: [
    'Päivä 1 – Ylävartalo',
    'Bench press 4x8',
    'Lat pulldown 3x12',
    'Pystypunnerrus 3 x 8',
    'Face pull 3x15',
    'Landmine press 3x10',
    'Hammer curl 3×12',
    'Päivä 2 – Alavartalo',
    'Kyykky 3 x 10',
    'Romanian DL 3x10',
    'Leg press 3x12',
    'Pohjenousut 4x15',
    'Vatsarutistus 3x20',
  ],
};

// Esimerkkiprofiili (speksin kohta 4c), jota käytetään, kun aloitusohjaus ohitetaan.
export const OLETUSPROFIILI = {
  nimi: 'Demokäyttäjä',
  tavoite: 'lihasmassa',
  kokemus: 'keskitaso',
  treenitViikossa: 3,
  kesto: 60,
  jako: 'automaattinen',
  valineet: ['levytanko', 'käsipainot', 'laitteet', 'taljat', 'kehonpaino'],
  vainKehonpaino: false,
  // Salin laitteet (speksi 4j), oletuksena täysi kuntosali. Vanhasta tilasta kenttä johdetaan
  // migraatiossa `valineet`/`vainKehonpaino`-asetuksesta.
  laitteet: [...KAIKKI_LAITTEET],
  lammittelysarjat: true,
  kehonpaino: 80,
  yksikko: 'kg',
  viikonAlku: 'maanantai',
  // Palautusajastin on valinnainen. Kesto: 'tavoite' (liikkeen tavoitteen palautusS) tai 60/90/120/180 s.
  // Vanhasta tilasta kentät voivat puuttua: lue aina oletuksella (?? false / ?? 'tavoite').
  palautusajastin: false,
  palautusKesto: 'tavoite',
  // Kuntosali, jonka jäsenhaasteet näkyvät Yhteisössä (speksi 4i). Vanhasta tilasta kenttä voi puuttua.
  sali: 'Kotisali',
};
