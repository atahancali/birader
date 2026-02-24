export const TURKEY_CITIES = [
  "Adana", "Adiyaman", "Afyonkarahisar", "Agri", "Aksaray", "Amasya", "Ankara", "Antalya",
  "Ardahan", "Artvin", "Aydin", "Balikesir", "Bartin", "Batman", "Bayburt", "Bilecik", "Bingol",
  "Bitlis", "Bolu", "Burdur", "Bursa", "Canakkale", "Cankiri", "Corum", "Denizli", "Diyarbakir",
  "Duzce", "Edirne", "Elazig", "Erzincan", "Erzurum", "Eskisehir", "Gaziantep", "Giresun", "Gumushane",
  "Hakkari", "Hatay", "Igdir", "Isparta", "Istanbul", "Izmir", "Kahramanmaras", "Karabuk", "Karaman",
  "Kars", "Kastamonu", "Kayseri", "Kilis", "Kirikkale", "Kirklareli", "Kirsehir", "Kocaeli", "Konya",
  "Kutahya", "Malatya", "Manisa", "Mardin", "Mersin", "Mugla", "Mus", "Nevsehir", "Nigde", "Ordu",
  "Osmaniye", "Rize", "Sakarya", "Samsun", "Sanliurfa", "Siirt", "Sinop", "Sirnak", "Sivas", "Tekirdag",
  "Tokat", "Trabzon", "Tunceli", "Usak", "Van", "Yalova", "Yozgat", "Zonguldak"
] as const;

const DISTRICTS: Record<string, string[]> = {
  Istanbul: ["Adalar", "Besiktas", "Beyoglu", "Kadikoy", "Kartal", "Maltepe", "Sisli", "Uskudar"],
  Ankara: ["Altindag", "Cankaya", "Etimesgut", "Kecioren", "Mamak", "Sincan", "Yenimahalle"],
  Izmir: ["Bornova", "Buca", "Cesme", "Karsiyaka", "Konak", "Menemen"],
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
  return DISTRICTS[city] ?? ["Merkez"];
}
