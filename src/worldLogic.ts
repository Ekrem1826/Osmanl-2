/**
 * Pure mathematical, topographical, historical region, quest, NPC & interior logic
 * for Fatih Istanbul Historical Open World (1451–1481 & 1557–1560).
 */

export interface LandmarkInfo {
  id: string;
  name: string;
  date: string;
  periodTag: '1451-1481' | '1500-1560';
  patronArchitect: string;
  certainty: 'Belgeli' | 'Kısmen belgeli' | 'Varsayımsal yeniden kurgu';
  description: string;
  pos: [number, number, number];
  camOffset: [number, number, number];
  category: 'saray' | 'cami' | 'meydan' | 'kemer' | 'sur' | 'liman' | 'bizans';
  interiorType?: 'saray' | 'cami' | 'han' | 'hamam' | 'dukkan' | 'avlu';
}

export interface HistoricalRegion {
  id: string;
  name: string;
  periodNote: string;
  center: [number, number];
  radius: number;
}

export interface QuestDefinition {
  id: string;
  title: string;
  giverName: string;
  description: string;
  targetPos: [number, number];
  rewardAkce: number;
  type: 'lost_item' | 'escort' | 'explore' | 'history' | 'buy_item';
  requiredItem?: string;
}

export interface TourKeyframe {
  timeSec: number;
  locationId: string;
  camPos: [number, number, number];
  lookAt: [number, number, number];
  timeOfDay: number;
  season: 'Bahar' | 'Yaz' | 'Sonbahar' | 'Kış';
  weather: 'Açık' | 'Bulutlu' | 'Sisli' | 'Hafif yağmur';
  title: string;
  narration: string;
}

/** Deterministic seeded PRNG (Mulberry32) */
export function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2D(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function valueNoise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm2D(x: number, z: number, octaves = 4): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * valueNoise2D(x * freq, z * freq);
    freq *= 2.03;
    amp *= 0.5;
  }
  return val;
}

export function getCoastBoundsZ(x: number): { northZ: number; southZ: number } {
  const t = Math.max(0, Math.min(1, (x + 480) / 920));
  const northZ =
    -185 +
    115 * Math.pow(t, 0.75) +
    14 * Math.sin(t * Math.PI * 2.0) +
    (t > 0.82 ? Math.pow((t - 0.82) / 0.18, 1.6) * 85 : 0);

  const southZ =
    280 -
    238 * Math.pow(t, 1.22) -
    16 * Math.sin(t * Math.PI * 3.0) -
    (t > 0.85 ? Math.pow((t - 0.85) / 0.15, 1.6) * 20 : 0);

  return { northZ, southZ };
}

export const SEVEN_HILLS = [
  { name: '1. Tepe (Sarayburnu / Ayasofya)', x: 325, z: 10, rx: 115, rz: 85, h: 24 },
  { name: '2. Tepe (Çemberlitaş / Nuruosmaniye mevkii)', x: 185, z: 20, rx: 95, rz: 80, h: 28 },
  { name: '3. Tepe (Süleymaniye / Eski Saray)', x: 55, z: -20, rx: 120, rz: 95, h: 36 },
  { name: '4. Tepe (Fatih Külliyesi)', x: -125, z: -45, rx: 115, rz: 95, h: 35 },
  { name: '5. Tepe (Yavuz Selim / Fener üstü)', x: -235, z: -78, rx: 95, rz: 75, h: 34 },
  { name: '6. Tepe (Edirnekapı / Mihrimah)', x: -385, z: -98, rx: 110, rz: 85, h: 38 },
  { name: '7. Tepe (Kocamustafapaşa / Yedikule üstü)', x: -310, z: 125, rx: 155, rz: 105, h: 26 },
] as const;

export function getPeninsulaElevation(x: number, z: number): number {
  if (x >= -510 && x <= 442) {
    const { northZ, southZ } = getCoastBoundsZ(x);
    if (z >= northZ && z <= southZ && southZ > northZ + 8) {
      const width = southZ - northZ;
      const distFromEdge = Math.min(z - northZ, southZ - z);
      const eastDist = 440 - x;
      const shoreFactor = Math.min(
        1,
        Math.max(0, distFromEdge / Math.min(75, width * 0.45))
      );
      const eastTipFactor = Math.min(1, Math.max(0, eastDist / 45));
      const westSlope = x < -480 ? Math.max(0, 1 - (-480 - x) / 30) : 1;
      const envelope = Math.pow(shoreFactor * eastTipFactor * westSlope, 0.65);

      if (envelope <= 0.001) return -2.5;

      let hillSum = 4.5;
      for (const hill of SEVEN_HILLS) {
        const dx = (x - hill.x) / hill.rx;
        const dz = (z - hill.z) / hill.rz;
        const d2 = dx * dx + dz * dz;
        if (d2 < 2.8) {
          hillSum += hill.h * Math.exp(-d2 * 1.15);
        }
      }

      const lycusZ = -20 + (x + 150) * -0.25;
      const lycusDist = Math.abs(z - lycusZ);
      if (x < 20 && x > -460 && lycusDist < 70) {
        hillSum -= 6.5 * Math.exp(-Math.pow(lycusDist / 38, 2));
      }

      if (x > -90 && x < 20 && Math.abs(z + 30) < 65) {
        hillSum -= 4.5 * Math.exp(-Math.pow((x + 35) / 42, 2));
      }

      const detail = (fbm2D(x * 0.012 + 7.1, z * 0.012 + 3.4, 3) - 0.5) * 3.8;
      return Math.max(0.4, (hillSum + detail) * envelope);
    }
  }

  if (x >= -120 && x <= 380) {
    const { northZ } = getCoastBoundsZ(Math.min(350, Math.max(-120, x)));
    const galataSouthZ = northZ - 88;
    const galataNorthZ = -430;
    if (z <= galataSouthZ && z >= galataNorthZ) {
      const distSouth = galataSouthZ - z;
      const distEast = 380 - x;
      const distWest = x + 120;
      const env = Math.min(1, distSouth / 60) * Math.min(1, distEast / 55) * Math.min(1, distWest / 60);
      if (env > 0.02) {
        return Math.max(0.5, 18 * env + fbm2D(x * 0.015, z * 0.015, 2) * 5);
      }
    }
  }

  if (x >= 610 && x <= 840 && z >= -260 && z <= 280) {
    const distWest = x - 610;
    const distZ = Math.min(z + 260, 280 - z);
    const env = Math.min(1, distWest / 70) * Math.min(1, distZ / 80);
    if (env > 0.02) {
      return Math.max(0.5, 16 * env + fbm2D(x * 0.01, z * 0.01, 2) * 4);
    }
  }

  return -3.5;
}

export function isPeninsulaLand(x: number, z: number): boolean {
  if (x < -482 || x > 438) return false;
  const { northZ, southZ } = getCoastBoundsZ(x);
  return z >= northZ + 3 && z <= southZ - 3 && getPeninsulaElevation(x, z) > 0.6;
}

/** 9 Historical Regions of Fatih Istanbul (1451–1481 focus) */
export const HISTORICAL_REGIONS: HistoricalRegion[] = [
  {
    id: 'topkapi-bolgesi',
    name: 'Topkapı Sarayı ve Çevresi (Saray-ı Cedîd)',
    periodNote: '1460–1478 arasında Fatih Sultan Mehmed tarafından Sur-ı Sultani içinde inşa ettirildi.',
    center: [355, -10],
    radius: 70,
  },
  {
    id: 'ayasofya-bolgesi',
    name: 'Ayasofya ve Çevresi',
    periodNote: '1453 fethiyle camiye tahvil edilen Ayasofya-i Kebîr, Fatih medresesi ve Aya İrini.',
    center: [305, 32],
    radius: 55,
  },
  {
    id: 'hipodrom-bolgesi',
    name: 'At Meydanı (Sultanahmet Mevkii) ve Hipodrom',
    periodNote: '1451–1481 döneminde antik Hipodrom dikilitaşları açıktadır; Sultanahmet Camii henüz yoktur.',
    center: [255, 58],
    radius: 60,
  },
  {
    id: 'kapalicarsi-bolgesi',
    name: 'Kapalıçarşı Öncülleri (Bedestenler) ve Ticaret Bölgesi',
    periodNote: '1460–1461 yıllarında Fatih vakfı olarak kurulan Cevahir (İç) ve Sandal Bedestenleri ile hanlar.',
    center: [125, 12],
    radius: 65,
  },
  {
    id: 'eminonu-bolgesi',
    name: 'Eminönü ve Liman Çevresi',
    periodNote: 'Haliç gümrük iskeleleri, zahire kapanları ve ticaret kadırgalarının yanaştığı kıyı kuşağı.',
    center: [175, -85],
    radius: 60,
  },
  {
    id: 'zeyrek-bolgesi',
    name: 'Zeyrek ve Bozdoğan Kemeri Çevresi',
    periodNote: 'Fatih Camii tamamlanana dek Molla Zeyrek tarafından ilk Osmanlı medresesi olarak kullanılan Pantokrator.',
    center: [-42, -55],
    radius: 65,
  },
  {
    id: 'fatih-bolgesi',
    name: 'Fatih Külliyesi ve Eski Yerleşim Bölgeleri',
    periodNote: '1463–1470 arasında Mimar Atik Sinan eliyle inşa edilen Fatih Camii ve Sahn-ı Semân medreseleri.',
    center: [-125, -45],
    radius: 85,
  },
  {
    id: 'edirnekapi-bolgesi',
    name: 'Edirnekapı ve Kara Surları',
    periodNote: '1453 kuşatmasının izlerini taşıyan ve Fatih emriyle onarılan üç kademeli Theodosius surları ve Yedikule (1458).',
    center: [-440, -98],
    radius: 95,
  },
  {
    id: 'halic-bolgesi',
    name: 'Haliç Kıyıları (Unkapanı, Fener ve Balat)',
    periodNote: 'Haliç deniz surları, balıkçı iskeleleri, Fener Rum Patrikhanesi ve Balat mahalleleri.',
    center: [-195, -135],
    radius: 85,
  },
];

export function findRegionAtPoint(x: number, z: number): HistoricalRegion {
  let best = HISTORICAL_REGIONS[6];
  let bestDist = Infinity;
  for (const reg of HISTORICAL_REGIONS) {
    const d = Math.hypot(x - reg.center[0], z - reg.center[1]);
    if (d < bestDist) {
      bestDist = d;
      best = reg;
    }
  }
  return best;
}

/** Resolve NPC-to-NPC and NPC-to-Player collision avoidance without passing through each other */
export function resolveNpcCollision(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  minDist = 1.6
): [number, number] {
  const dx = ax - bx;
  const dz = az - bz;
  const dist = Math.hypot(dx, dz);
  if (dist >= minDist || dist === 0) return [ax, az];
  const push = (minDist - dist) * 0.55;
  const nx = dx / dist;
  const nz = dz / dist;
  return [ax + nx * push, az + nz * push];
}

/** 5 Playable Historical Quests (1451–1481 Period Authentic) */
export const HISTORICAL_QUESTS: QuestDefinition[] = [
  {
    id: 'quest-lost-item',
    title: 'Esnafın Kaybolan Sandığı',
    giverName: 'Bakırcı İlyas Usta',
    description:
      'Bedesten esnafı İlyas Usta\'nın Eminönü iskelesinden gelirken düşürdüğü mühürlü bakır sandığı Unkapanı-Eminönü yolunda bul.',
    targetPos: [155, -55],
    rewardAkce: 45,
    type: 'lost_item',
  },
  {
    id: 'quest-escort-merchant',
    title: 'Tüccara Limana Kadar Eşlik Et',
    giverName: 'Tüccar Kasım Çelebi',
    description:
      'Bursa ipeği taşıyan Kasım Çelebi\'ye Cevahir Bedesteni\'nden Eminönü Gümrük İskelesi\'ne kadar güvenle eşlik et.',
    targetPos: [175, -82],
    rewardAkce: 60,
    type: 'escort',
  },
  {
    id: 'quest-explore-palace',
    title: 'Saray-ı Cedîd Çevresini Keşfet',
    giverName: 'Bölükbaşı Sinan Ağa',
    description:
      '1460–1478 arasında inşa edilen Yeni Saray (Topkapı Sarayı) Sur-ı Sultani kapısını ve Bâb-ı Hümâyûn nöbet mevkiini kontrol et.',
    targetPos: [345, -8],
    rewardAkce: 50,
    type: 'explore',
  },
  {
    id: 'quest-learn-history',
    title: 'Fatih Külliyesi\'nin İmar Hikâyesini Öğren',
    giverName: 'Müderris Alaüddin Efendi',
    description:
      'Dördüncü Tepe\'de 1463–1470 yılları arasında Mimar Atik Sinan tarafından inşa edilen Fatih Camii ve Sahn-ı Semân medreselerinin tarihçesini dinle.',
    targetPos: [-125, -45],
    rewardAkce: 40,
    type: 'history',
  },
  {
    id: 'quest-buy-bazaar',
    title: 'Bedesten\'den Darüşşifa İçin Baharat Al',
    giverName: 'Hekimbaşı Yardımcısı',
    description:
      'Kapalıçarşı Cevahir Bedesteni\'ndeki aktardan Darüşşifa için Şifalı Macun satın al ve teslim et.',
    targetPos: [122, 14],
    rewardAkce: 55,
    type: 'buy_item',
    requiredItem: 'Şifalı Macun',
  },
];

export const LANDMARKS: LandmarkInfo[] = [
  {
    id: 'genel-bakis',
    name: 'Genel Bakış (Tarihî Yarımada)',
    date: '1451–1481 (Fatih Devri) ve 1557–1560 (Klasik Dönem)',
    periodTag: '1451-1481',
    patronArchitect: 'Bâniler: Fatih Sultan Mehmed ve Kanuni Sultan Süleyman',
    certainty: 'Belgeli',
    description:
      'Haliç, Marmara Denizi ve Boğaziçi\'nin kesişiminde Yedi Tepe üzerine kurulu payitaht İstanbul. 1453 fethinden itibaren Fatih Sultan Mehmed\'in imar ettiği Saray-ı Cedîd, Fatih Külliyesi, Bedestenler, Yedikule ve Mimar Sinan\'ın klasik dönem eserleriyle yaşayan açık dünya şehir dokusu.',
    pos: [35, 18, -5],
    camOffset: [135, 245, 395],
    category: 'meydan',
  },
  {
    id: 'topkapi-sarayi',
    name: 'Topkapı Sarayı (Saray-ı Cedîd-i Âmire)',
    date: '1460–1478 (Fatih Sultan Mehmed dönemi kuruluşu)',
    periodTag: '1451-1481',
    patronArchitect: 'Bâni: Fatih Sultan Mehmed · Mimarlar: Mimar Alaüddin, Acem Ali',
    certainty: 'Belgeli',
    description:
      'Sarayburnu zeytinlikleri üzerinde 1460–1478 yıllarında Sur-ı Sultani ile çevrili olarak kurulan devletin yönetim merkezi. Bâb-ı Hümâyûn, Alay Meydanı, Bâbüsselâm (Orta Kapı), Divan-ı Hümâyûn (Kubbealtı), Adalet Kulesi ve Enderun odalarının içine girilerek gezilebilir.',
    pos: [355, 22, -10],
    camOffset: [65, 45, 80],
    category: 'saray',
    interiorType: 'saray',
  },
  {
    id: 'ayasofya',
    name: 'Ayasofya-i Kebîr Camii ve Aya İrini',
    date: '532–537 (İnşa) · 1453 (Fatih Sultan Mehmed tarafından camiye tahvili)',
    periodTag: '1451-1481',
    patronArchitect: 'Bâni: I. Justinianus (Vakfeden: Fatih Sultan Mehmed)',
    certainty: 'Belgeli',
    description:
      '1453 fethinin hemen ardından Fatih Sultan Mehmed\'in ilk cuma namazını kılarak Fethiye Camii olarak vakfettiği ulu mabed. 1451–1481 döneminde Fatih\'in eklettiği ilk minare ve kuzeyindeki Fatih Medresesi ile hizmet vermektedir; harim kısmına kapıdan girilebilir.',
    pos: [305, 24, 32],
    camOffset: [55, 36, 65],
    category: 'cami',
    interiorType: 'cami',
  },
  {
    id: 'suleymaniye',
    name: 'Süleymaniye Camii ve Külliyesi',
    date: '1550–1557 (16. Yüzyıl Klasik Dönem · 1451–1481\'de Eski Saray arazisi)',
    periodTag: '1500-1560',
    patronArchitect: 'Bâni: Kanuni Sultan Süleyman · Mimar: Mimar Koca Sinan',
    certainty: 'Belgeli',
    description:
      'Üçüncü Tepe\'de Haliç\'e hâkim teraslar üzerinde yükselen külliye. Not: 1451–1481 Fatih Sultan Mehmed döneminde bu alan Eski Saray (Saray-ı Atîk) bahçelerinin devamı niteliğindedir; 1550–1557 arasında Mimar Sinan tarafından inşa edilmiştir.',
    pos: [62, 37, -38],
    camOffset: [68, 44, 76],
    category: 'cami',
    interiorType: 'cami',
  },
  {
    id: 'fatih-camii',
    name: 'Fatih Camii ve Sahn-ı Semân Külliyesi (1463–1470)',
    date: '1463–1470 (1766 depremi öncesi özgün Fatih Sultan Mehmed devri yapısı)',
    periodTag: '1451-1481',
    patronArchitect: 'Bâni: Fatih Sultan Mehmed · Mimar: Atik Sinan (Sinanüddin Yusuf)',
    certainty: 'Varsayımsal yeniden kurgu',
    description:
      'Dördüncü Tepe\'de Şubat 1463\'te temeli atılıp 1470\'te tamamlanan ilk büyük selâtin külliyesi. Bir ana kubbe ve kıble yönünde tek bir yarım kubbeden oluşan özgün cami ile Karadeniz ve Akdeniz yönlerindeki sekizer Sahn-ı Semân medresesi, darüşşifası ve tabhanesiyle 1451–1481 döneminin en büyük imar eseridir.',
    pos: [-125, 36, -45],
    camOffset: [65, 44, 74],
    category: 'cami',
    interiorType: 'cami',
  },
  {
    id: 'sehzade-camii',
    name: 'Şehzade Camii ve Eski Yeniçeri Odaları Mevkii',
    date: '1460\'lar (Eski Odalar) · 1543–1548 (Şehzade Külliyesi)',
    periodTag: '1500-1560',
    patronArchitect: 'Fatih Devri: Yeniçeri Eski Odaları · 1548: Mimar Koca Sinan',
    certainty: 'Belgeli',
    description:
      'Yarımadanın merkezinde Fatih Sultan Mehmed devrinde Yeniçeri Eski Odaları\'nın kurulduğu stratejik kavşak; 1543–1548 yıllarında Mimar Sinan tarafından dört yarım kubbeli Şehzade Mehmed Külliyesi inşa edilmiştir.',
    pos: [-30, 31, -8],
    camOffset: [52, 34, 62],
    category: 'cami',
    interiorType: 'cami',
  },
  {
    id: 'beyazit-kapalicarsi',
    name: 'Kapalıçarşı Bedestenleri, Eski Saray ve Mahmud Paşa Külliyesi',
    date: '1454–1463 (Eski Saray: 1455, Bedestenler: 1460–61, Mahmud Paşa: 1463)',
    periodTag: '1451-1481',
    patronArchitect: 'Bâni: Fatih Sultan Mehmed ve Veziriazam Mahmud Paşa · Mimar Atik Sinan',
    certainty: 'Kısmen belgeli',
    description:
      '1454–1455\'te tamamlanan Eski Saray (Saray-ı Atîk), 1460–1461\'de Ayasofya vakfına gelir sağlamak üzere inşa edilen Cevahir (İç) ve Sandal Bedestenleri ile Veziriazam Mahmud Paşa\'nın 1463 tarihli külliyesi, hamamı ve Kürkçüler Hanı. Dükkânlara ve han avlusuna girilebilir.',
    pos: [105, 31, 15],
    camOffset: [64, 42, 74],
    category: 'cami',
    interiorType: 'han',
  },
  {
    id: 'at-meydani',
    name: 'At Meydanı (Hipodrom) ve Çemberlitaş',
    date: 'MÖ 203 – MS 1481 (Fatih devri şenlik ve sipahi talim meydanı)',
    periodTag: '1451-1481',
    patronArchitect: 'Bizans mirası · Osmanlı cülus ve sipahi meydanı',
    certainty: 'Belgeli',
    description:
      'Theodosius Dikilitaşı, Yılanlı Sütun ve Örme Dikilitaş\'ın yükseldiği açık U planlı At Meydanı. 1451–1481 döneminde Sultanahmet Camii henüz inşa edilmemiştir; meydan sipahi atlılarının talim alanı ve divan yolu geçişidir.',
    pos: [255, 24, 58],
    camOffset: [56, 35, 66],
    category: 'meydan',
    interiorType: 'avlu',
  },
  {
    id: 'bozdogan-kemeri',
    name: 'Bozdoğan (Valens) Su Kemeri ve Molla Zeyrek Medresesi',
    date: 'MS 375 (Kemer) · 1453–1470 (Molla Zeyrek Medresesi ve Camii)',
    periodTag: '1451-1481',
    patronArchitect: 'İmparator Valens · Müderris Molla Mehmed Zeyrek',
    certainty: 'Belgeli',
    description:
      'Üçüncü ve Dördüncü tepeleri bağlayan çift katlı su kemeri ve hemen kuzeyindeki Pantokrator Manastırı. 1453 fethinden sonra Fatih Külliyesi tamamlanana dek Molla Zeyrek yönetiminde Osmanlı İstanbul\'unun ilk medresesi olarak hizmet vermiştir.',
    pos: [-38, 28, -32],
    camOffset: [55, 34, 65],
    category: 'kemer',
    interiorType: 'avlu',
  },
  {
    id: 'halic-fener-balat',
    name: 'Haliç Kıyıları: Unkapanı, Fener ve Balat İskeleleri',
    date: '1453–1481 Liman, Kapan ve Mahalle Dokusu',
    periodTag: '1451-1481',
    patronArchitect: 'Fatih Sultan Mehmed\'in millet sistemi fermanıyla korunan mahalleler',
    certainty: 'Kısmen belgeli',
    description:
      'Haliç deniz surları boyunca Unkapanı buğday kapanı, Cibali, Fener ve Balat iskeleleri. Fatih Sultan Mehmed\'in 1454\'te Gennadios\'u patrik tayin ederek güvence altına aldığı Rum cemaati konakları, Balat mahalleleri ve balıkçı iskeleleri.',
    pos: [-195, 8, -165],
    camOffset: [55, 32, -75],
    category: 'liman',
    interiorType: 'dukkan',
  },
  {
    id: 'eminonu-limani',
    name: 'Eminönü ve Sirkeci Limanı (Gümrük Önü)',
    date: '1453–1481 Deniz Ticareti ve Kapan İskeleleri',
    periodTag: '1451-1481',
    patronArchitect: 'Osmanlı Gümrük Eminliği ve Liman Kethüdaları',
    certainty: 'Kısmen belgeli',
    description:
      'Haliç ağzında zahire, kereste, baharat ve ipek yüklü gemilerin yanaştığı ana gümrük limanı. Yeni Cami ve Mısır Çarşısı henüz mevcut değildir; kıyıda ahşap mahzenler, balıkçılar ve tüccar hanları yer alır.',
    pos: [175, 6, -85],
    camOffset: [45, 28, -68],
    category: 'liman',
    interiorType: 'dukkan',
  },
  {
    id: 'edirnekapi-surlar',
    name: 'Theodosius Kara Surları ve Edirnekapı',
    date: 'MS 413 (Surlar) · 1453–1458 (Fatih devri sur onarımları)',
    periodTag: '1451-1481',
    patronArchitect: 'II. Theodosius · Onarım: Fatih Sultan Mehmed',
    certainty: 'Belgeli',
    description:
      'Yarımadayı batıdan koruyan su hendeği, dış sur ve 96 burçlu yüksek iç sur. Fatih Sultan Mehmed\'in 29 Mayıs 1453\'te şehre törenle girdiği Edirnekapı (Charisius Kapısı) ve kervanların kontrol edildiği sur kapısı.',
    pos: [-440, 34, -98],
    camOffset: [-65, 38, 60],
    category: 'sur',
    interiorType: 'avlu',
  },
  {
    id: 'yedikule-hisari',
    name: 'Yedikule Hisarı ve Altınkapı (Hazine-i Hümâyûn)',
    date: '1457–1458 (Fatih Sultan Mehmed tarafından inşa ettirildi)',
    periodTag: '1451-1481',
    patronArchitect: 'Bâni: Fatih Sultan Mehmed · Mimar: Kemaleddin',
    certainty: 'Belgeli',
    description:
      'Fatih Sultan Mehmed\'in 1457–1458\'de Bizans Altınkapı\'sına dört büyük kule ekleterek inşa ettirdiği yedi kuleli yıldızvari hisar. Devletin altın hazinesi (Hazine-i Âmire) ve muhafız garnizonu burada korunmaktadır.',
    pos: [-455, 16, 215],
    camOffset: [-60, 38, 70],
    category: 'sur',
    interiorType: 'saray',
  },
  {
    id: 'marmara-kumkapi',
    name: 'Marmara Kıyıları: Kumkapı, Samatya ve Langa Bostanları',
    date: '1453–1481 Marmara Deniz Surları, Hamamlar ve Bostanlar',
    periodTag: '1451-1481',
    patronArchitect: 'Fatih Devri Vakıfları ve Deniz Surları Muhafızları',
    certainty: 'Belgeli',
    description:
      'Marmara deniz surları boyunca Kumkapı ve Samatya balıkçı limanları, antik Theodosius limanı yatağındaki verimli Langa bostanları ve mahalle hamamları.',
    pos: [-85, 14, 155],
    camOffset: [45, 32, 78],
    category: 'liman',
    interiorType: 'hamam',
  },
];

export const GUIDED_TOUR_KEYFRAMES: TourKeyframe[] = [
  {
    timeSec: 0,
    locationId: 'genel-bakis',
    camPos: [220, 210, 320],
    lookAt: [30, 20, -10],
    timeOfDay: 7.2,
    season: 'Bahar',
    weather: 'Açık',
    title: '1/10 · Dersaadet Sabahı',
    narration:
      'Sabah güneşi Boğaziçi\'nden doğarken Yedi Tepe üzerindeki Tarihî Yarımada, surları, bedestenleri ve külliyeleriyle uyanıyor.',
  },
  {
    timeSec: 20,
    locationId: 'topkapi-sarayi',
    camPos: [435, 68, 65],
    lookAt: [350, 22, -10],
    timeOfDay: 8.5,
    season: 'Bahar',
    weather: 'Açık',
    title: '2/10 · Topkapı Sarayı (Saray-ı Cedîd)',
    narration:
      'Fatih Sultan Mehmed\'in 1460–1478 arasında inşa ettirdiği Sur-ı Sultani içindeki Topkapı Sarayı: Bâb-ı Hümâyûn, Orta Kapı ve Adalet Kulesi.',
  },
  {
    timeSec: 40,
    locationId: 'ayasofya',
    camPos: [365, 58, 92],
    lookAt: [305, 25, 32],
    timeOfDay: 10.5,
    season: 'Bahar',
    weather: 'Açık',
    title: '3/10 · Ayasofya-i Kebîr ve At Meydanı',
    narration:
      '1453\'te camiye tahvil edilen Ayasofya ve hemen güneybatısında dikilitaşlarıyla açık At Meydanı (Hipodrom).',
  },
  {
    timeSec: 60,
    locationId: 'beyazit-kapalicarsi',
    camPos: [155, 68, 88],
    lookAt: [105, 30, 10],
    timeOfDay: 12.2,
    season: 'Yaz',
    weather: 'Açık',
    title: '4/10 · Cevahir ve Sandal Bedestenleri (Kapalıçarşı)',
    narration:
      'Öğle vaktinde ticaretin merkezi: 1460\'larda kurulan çok kubbeli İç ve Sandal Bedestenleri, Kürkçüler Hanı, Mahmud Paşa Külliyesi ve Eski Saray.',
  },
  {
    timeSec: 82,
    locationId: 'suleymaniye',
    camPos: [128, 76, 32],
    lookAt: [62, 38, -38],
    timeOfDay: 14.5,
    season: 'Yaz',
    weather: 'Açık',
    title: '5/10 · Üçüncü Tepe ve Haliç Yamaçları',
    narration:
      'Haliç\'e nazır Üçüncü Tepe terasları, külliye kubbeleri, medreseler ve darüşşifa.',
  },
  {
    timeSec: 104,
    locationId: 'bozdogan-kemeri',
    camPos: [18, 62, 35],
    lookAt: [-38, 28, -28],
    timeOfDay: 16.5,
    season: 'Sonbahar',
    weather: 'Açık',
    title: '6/10 · Bozdoğan Su Kemeri ve Molla Zeyrek',
    narration:
      'Üçüncü ve dördüncü tepeleri bağlayan çift katlı Bozdoğan Su Kemeri ve fetihten sonraki ilk medrese olan Molla Zeyrek.',
  },
  {
    timeSec: 124,
    locationId: 'fatih-camii',
    camPos: [-65, 75, 25],
    lookAt: [-125, 36, -45],
    timeOfDay: 17.8,
    season: 'Sonbahar',
    weather: 'Bulutlu',
    title: '7/10 · Fatih Camii ve Sahn-ı Semân Medreseleri (1470)',
    narration:
      'Gün batımında Dördüncü Tepe: 1463–1470 arasında inşa edilen özgün Fatih Camii ve iki yanındaki sekizer Sahn-ı Semân medresesi.',
  },
  {
    timeSec: 144,
    locationId: 'halic-fener-balat',
    camPos: [-140, 42, -235],
    lookAt: [-195, 12, -160],
    timeOfDay: 18.6,
    season: 'Sonbahar',
    weather: 'Sisli',
    title: '8/10 · Haliç Suları, Fener ve Balat İskeleleri',
    narration:
      'Haliç\'te kürek çeken Osmanlı kadırgaları, balıkçı kayıkları ve kıyıda Unkapanı, Fener ile Balat\'ın ahşap cumbalı mahalleleri.',
  },
  {
    timeSec: 162,
    locationId: 'edirnekapi-surlar',
    camPos: [-525, 68, -80],
    lookAt: [-440, 28, -110],
    timeOfDay: 20.5,
    season: 'Kış',
    weather: 'Açık',
    title: '9/10 · Theodosius Kara Surları ve Yedikule Hisarı (1458)',
    narration:
      'Gece çökerken batı sınırındaki üçlü Theodosius kara surları, Edirnekapı ve 1458\'de inşa edilen yedi kuleli Yedikule Hazine Hisarı.',
  },
  {
    timeSec: 180,
    locationId: 'genel-bakis',
    camPos: [160, 175, 260],
    lookAt: [60, 28, -20],
    timeOfDay: 22.0,
    season: 'Kış',
    weather: 'Açık',
    title: '10/10 · Dersaadet Gecesi ve Kandiller',
    narration:
      'Ay ışığı altında Haliç ve Marmara\'da yansıyan kandiller, aydınlanan sokaklar ve kubbelerle tarihî İstanbul\'a veda.',
  },
];

export function evaluateTourAtTime(elapsedSec: number): {
  camPos: [number, number, number];
  lookAt: [number, number, number];
  timeOfDay: number;
  season: TourKeyframe['season'];
  weather: TourKeyframe['weather'];
  title: string;
  narration: string;
  progress: number;
} {
  const totalDuration = GUIDED_TOUR_KEYFRAMES[GUIDED_TOUR_KEYFRAMES.length - 1].timeSec;
  const clamped = Math.max(0, Math.min(totalDuration, elapsedSec));
  let idx = 0;
  for (let i = 0; i < GUIDED_TOUR_KEYFRAMES.length - 1; i++) {
    if (clamped >= GUIDED_TOUR_KEYFRAMES[i].timeSec && clamped <= GUIDED_TOUR_KEYFRAMES[i + 1].timeSec) {
      idx = i;
      break;
    }
  }
  const a = GUIDED_TOUR_KEYFRAMES[idx];
  const b = GUIDED_TOUR_KEYFRAMES[Math.min(GUIDED_TOUR_KEYFRAMES.length - 1, idx + 1)];
  const span = Math.max(0.001, b.timeSec - a.timeSec);
  const rawT = (clamped - a.timeSec) / span;
  const t = rawT * rawT * (3 - 2 * rawT);

  const camPos: [number, number, number] = [
    a.camPos[0] + (b.camPos[0] - a.camPos[0]) * t,
    a.camPos[1] + (b.camPos[1] - a.camPos[1]) * t,
    a.camPos[2] + (b.camPos[2] - a.camPos[2]) * t,
  ];
  const lookAt: [number, number, number] = [
    a.lookAt[0] + (b.lookAt[0] - a.lookAt[0]) * t,
    a.lookAt[1] + (b.lookAt[1] - a.lookAt[1]) * t,
    a.lookAt[2] + (b.lookAt[2] - a.lookAt[2]) * t,
  ];
  const timeOfDay = a.timeOfDay + (b.timeOfDay - a.timeOfDay) * t;

  return {
    camPos,
    lookAt,
    timeOfDay,
    season: a.season,
    weather: a.weather,
    title: a.title,
    narration: a.narration,
    progress: clamped / totalDuration,
  };
}
