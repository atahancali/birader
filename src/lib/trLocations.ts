export const TURKEY_CITIES = [
  "Adana", "Adiyaman", "Afyonkarahisar", "Agri", "Aksaray", "Amasya", "Ankara", "Antalya",
  "Ardahan", "Artvin", "Aydin", "Balikesir", "Bartin", "Batman", "Bayburt", "Bilecik", "Bingol",
  "Bitlis", "Bolu", "Burdur", "Bursa", "Canakkale", "Cankiri", "Corum", "Denizli", "Diyarbakir",
  "Duzce", "Edirne", "Elazig", "Erzincan", "Erzurum", "Eskisehir", "Gaziantep", "Giresun", "Gumushane",
  "Hakkari", "Hatay", "Igdir", "Isparta", "Istanbul", "Izmir", "Kahramanmaras", "Karabuk", "Karaman",
  "Kars", "Kastamonu", "Kayseri", "Kilis", "Kirikkale", "Kirklareli", "Kirsehir", "Kocaeli", "Konya",
  "Kutahya", "Malatya", "Manisa", "Mardin", "Mersin", "Mugla", "Mus", "Nevsehir", "Nigde", "Ordu",
  "Osmaniye", "Rize", "Sakarya", "Samsun", "Sanliurfa", "Siirt", "Sinop", "Sirnak", "Sivas", "Tekirdag",
  "Tokat", "Trabzon", "Tunceli", "Usak", "Van", "Yalova", "Yozgat", "Zonguldak",
] as const;

const DISTRICTS: Record<string, string[]> = {
  Istanbul: [
    "Adalar", "Arnavutkoy", "Atasehir", "Avcilar", "Bagcilar", "Bahcelievler", "Bakirkoy", "Basaksehir",
    "Bayrampasa", "Besiktas", "Beykoz", "Beylikduzu", "Beyoglu", "Buyukcekmece", "Catalca", "Cekmekoy",
    "Esenler", "Esenyurt", "Eyupsultan", "Fatih", "Gaziosmanpasa", "Gungoren", "Kadikoy", "Kagithane",
    "Kartal", "Kucukcekmece", "Maltepe", "Pendik", "Sancaktepe", "Sariyer", "Silivri", "Sisli", "Sile",
    "Sultanbeyli", "Sultangazi", "Tuzla", "Umraniye", "Uskudar", "Zeytinburnu",
  ],
  Ankara: [
    "Akyurt", "Altindag", "Ayas", "Bala", "Beypazari", "Camlidere", "Cankaya", "Cubuk", "Elmadag",
    "Etimesgut", "Evren", "Golbasi", "Gudul", "Haymana", "Kahramankazan", "Kalecik", "Kecioren",
    "Kizilcahamam", "Mamak", "Nallihan", "Polatli", "Pursaklar", "Sereflikochisar", "Sincan", "Yenimahalle",
  ],
  Izmir: [
    "Aliaga", "Balcova", "Bayindir", "Bayrakli", "Bergama", "Beydag", "Bornova", "Buca", "Cesme", "Cigli",
    "Dikili", "Foca", "Gaziemir", "Guzelbahce", "Karabaglar", "Karaburun", "Karsiyaka", "Kemalpasa", "Kinik",
    "Kiraz", "Konak", "Menderes", "Menemen", "Narlidere", "Odemis", "Seferihisar", "Selcuk", "Tire",
    "Torbali", "Urla",
  ],

  Bursa: ["Nilufer", "Osmangazi", "Yildirim", "Mudanya", "Gemlik"],
  Antalya: ["Alanya", "Kepez", "Konyaalti", "Muratpasa", "Manavgat"],
  Adana: ["Cukurova", "Saricam", "Seyhan", "Yuregir"],
  Kocaeli: ["Basiskele", "Darica", "Gebze", "Golcuk", "Izmit", "Kartepe"],
  Mersin: ["Akdeniz", "Erdemli", "Mezitli", "Tarsus", "Toroslar", "Yenisehir"],
  Mugla: ["Bodrum", "Dalaman", "Datca", "Fethiye", "Marmaris", "Mentese"],
  Balikesir: ["Ayvalik", "Bandirma", "Burhaniye", "Edremit", "Karesi"],
  Canakkale: ["Ayvacik", "Biga", "Bozcaada", "Ezine", "Merkez"],
};

export function districtsForCity(city: string) {
  const base = DISTRICTS[city] ?? ["Merkez"];
  return [...base, "Diger"];
}
