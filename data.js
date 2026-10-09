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

// Täydentää liikkeen oletuskentät. Painoliikkeillä annetaan viitekerroin ja aloituspaino (kg),
// kehonpainoliikkeillä viitetoistot. youtubeId on aina null (tunnisteita ei keksitä).
function maarita({
  id, nimi, lihasryhma, toissijaiset = [], valine, alue, ohje,
  viitekerroin = null, viitetoistot = null, aloituspaino = 0, hakusana, animaatio = null,
}) {
  return {
    id, nimi, lihasryhma, toissijaiset, valine, alue, ohje,
    viitekerroin, viitetoistot, aloituspaino,
    media: { youtubeId: null, hakusana, animaatio },
  };
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
  lammittelysarjat: true,
  kehonpaino: 80,
  yksikko: 'kg',
  viikonAlku: 'maanantai',
  // Palautusajastin on valinnainen. Kesto: 'tavoite' (liikkeen tavoitteen palautusS) tai 60/90/120/180 s.
  // Vanhasta tilasta kentät voivat puuttua: lue aina oletuksella (?? false / ?? 'tavoite').
  palautusajastin: false,
  palautusKesto: 'tavoite',
};
