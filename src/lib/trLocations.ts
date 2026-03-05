export const TURKEY_CITIES = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya",
  "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl",
  "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır",
  "Düzce", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane",
  "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul", "İzmir", "Kahramanmaraş", "Karabük", "Karaman",
  "Kars", "Kastamonu", "Kayseri", "Kilis", "Kırıkkale", "Kırklareli", "Kırşehir", "Kocaeli", "Konya",
  "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu",
  "Osmaniye", "Rize", "Sakarya", "Samsun", "Şanlıurfa", "Siirt", "Sinop", "Şırnak", "Sivas", "Tekirdağ",
  "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak",
] as const;

const DISTRICTS: Record<string, string[]> = {
  İstanbul: [
    "Adalar", "Arnavutköy", "Ataşehir", "Avcılar", "Bağcılar", "Bahçelievler", "Bakırköy", "Başakşehir",
    "Bayrampaşa", "Beşiktaş", "Beykoz", "Beylikdüzü", "Beyoğlu", "Büyükçekmece", "Çatalca", "Çekmeköy",
    "Esenler", "Esenyurt", "Eyüpsultan", "Fatih", "Gaziosmanpaşa", "Güngören", "Kadıköy", "Kağıthane",
    "Kartal", "Küçükçekmece", "Maltepe", "Pendik", "Sancaktepe", "Sarıyer", "Silivri", "Şişli", "Şile",
    "Sultanbeyli", "Sultangazi", "Tuzla", "Ümraniye", "Üsküdar", "Zeytinburnu",
  ],
  Ankara: [
    "Akyurt", "Altındağ", "Ayaş", "Bala", "Beypazarı", "Çamlıdere", "Çankaya", "Çubuk", "Elmadağ",
    "Etimesgut", "Evren", "Gölbaşı", "Güdül", "Haymana", "Kahramankazan", "Kalecik", "Keçiören",
    "Kızılcahamam", "Mamak", "Nallıhan", "Polatlı", "Pursaklar", "Şereflikoçhisar", "Sincan", "Yenimahalle",
  ],
  İzmir: [
    "Aliağa", "Balçova", "Bayındır", "Bayraklı", "Bergama", "Beydağ", "Bornova", "Buca", "Çeşme", "Çiğli",
    "Dikili", "Foça", "Gaziemir", "Güzelbahçe", "Karabağlar", "Karaburun", "Karşıyaka", "Kemalpaşa", "Kınık",
    "Kiraz", "Konak", "Menderes", "Menemen", "Narlıdere", "Ödemiş", "Seferihisar", "Selçuk", "Tire",
    "Torbalı", "Urla",
  ],

  Bursa: ["Nilüfer", "Osmangazi", "Yıldırım", "Mudanya", "Gemlik"],
  Antalya: ["Alanya", "Kepez", "Konyaaltı", "Muratpaşa", "Manavgat"],
  Adana: ["Çukurova", "Sarıçam", "Seyhan", "Yüreğir"],
  Kocaeli: ["Başiskele", "Darıca", "Gebze", "Gölcük", "İzmit", "Kartepe"],
  Mersin: ["Akdeniz", "Erdemli", "Mezitli", "Tarsus", "Toroslar", "Yenişehir"],
  Muğla: ["Bodrum", "Dalaman", "Datça", "Fethiye", "Marmaris", "Menteşe"],
  Balıkesir: ["Ayvalık", "Bandırma", "Burhaniye", "Edremit", "Karesi"],
  Çanakkale: ["Ayvacık", "Biga", "Bozcaada", "Ezine", "Merkez"],
};

const CITY_ALIASES: Record<string, string> = {
  Istanbul: "İstanbul",
  Izmir: "İzmir",
  Canakkale: "Çanakkale",
  Mugla: "Muğla",
  Adiyaman: "Adıyaman",
  Agri: "Ağrı",
  Aydin: "Aydın",
  Balikesir: "Balıkesir",
  Bartin: "Bartın",
  Bingol: "Bingöl",
  Cankiri: "Çankırı",
  Corum: "Çorum",
  Diyarbakir: "Diyarbakır",
  Duzce: "Düzce",
  Elazig: "Elazığ",
  Eskisehir: "Eskişehir",
  Gumushane: "Gümüşhane",
  Igdir: "Iğdır",
  Kahramanmaras: "Kahramanmaraş",
  Karabuk: "Karabük",
  Kirikkale: "Kırıkkale",
  Kirklareli: "Kırklareli",
  Kirsehir: "Kırşehir",
  Kutahya: "Kütahya",
  Mus: "Muş",
  Nevsehir: "Nevşehir",
  Nigde: "Niğde",
  Sanliurfa: "Şanlıurfa",
  Sirnak: "Şırnak",
  Tekirdag: "Tekirdağ",
  Usak: "Uşak",
};

export function districtsForCity(city: string) {
  const resolvedCity = CITY_ALIASES[city] ?? city;
  const base = DISTRICTS[resolvedCity] ?? ["Merkez"];
  return [...base, "Diğer"];
}
