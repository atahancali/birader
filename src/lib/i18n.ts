export type AppLang = "tr" | "en";

type Dict = Record<string, string>;

const TR: Dict = {
  nav_log: "Log",
  nav_social: "Sosyal",
  nav_heatmap: "Harita",
  nav_stats: "Istatistik",
  nav_help: "Yardim",
  heading_log: "Bira logla",
  heading_heatmap: "Isi haritasi",
  heading_stats: "Istatistik",
  cta_download: "Uygulamayi indir",
  cta_add_home: "Ana ekrana ekle",
};

const EN: Dict = {
  nav_log: "Log",
  nav_social: "Social",
  nav_heatmap: "Map",
  nav_stats: "Stats",
  nav_help: "Help",
  heading_log: "Log beer",
  heading_heatmap: "Heatmap",
  heading_stats: "Stats",
  cta_download: "Download app",
  cta_add_home: "Add to home",
};

export function t(lang: AppLang, key: string) {
  if (lang === "en") return EN[key] ?? TR[key] ?? key;
  return TR[key] ?? EN[key] ?? key;
}
