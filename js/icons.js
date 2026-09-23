// Ícones SVG simples e leves (sem dependência externa), estilo "line icons".
// Cada função retorna uma string SVG pronta para innerHTML.

function svgIcon(paths, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const Icon = {
  leaf: () => svgIcon(`<path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 9-9 5 0 8 3 8 8 0 6-5 8-10 8Z"/><path d="M11 20c0-6 2-10 6-13"/>`),
  layers: () => svgIcon(`<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>`),
  droplet: () => svgIcon(`<path d="M12 2s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/>`),
  trendingUp: () => svgIcon(`<path d="m3 17 6-6 4 4 8-8"/><path d="M17 7h4v4"/>`),
  trendingDown: () => svgIcon(`<path d="m3 7 6 6 4-4 8 8"/><path d="M17 17h4v-4"/>`),
  alertTriangle: () => svgIcon(`<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>`),
  cloudRain: () => svgIcon(`<path d="M16 13v-1a5 5 0 1 0-9.9-1.2A3.5 3.5 0 0 0 6.5 17H16a3 3 0 0 0 0-6Z" transform="translate(0,-1)"/><path d="M8 19v1"/><path d="M12 19v2"/><path d="M16 19v1"/>`),
  bug: () => svgIcon(`<path d="M9 9V7a3 3 0 0 1 6 0v2"/><rect x="6" y="9" width="12" height="10" rx="5"/><path d="M6 13H3"/><path d="M21 13h-3"/><path d="M6 18l-2 2"/><path d="M18 18l2 2"/><path d="M12 9V7"/>`),
  whatsapp: () => svgIcon(`<path d="M4 20l1.3-3.9A8 8 0 1 1 8.4 19L4 20Z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5"/>`),
  bell: () => svgIcon(`<path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z"/><path d="M10 18a2 2 0 0 0 4 0"/>`),
  info: () => svgIcon(`<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>`, 14),
  calendar: () => svgIcon(`<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/>`),
  checkCircle: () => svgIcon(`<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 5-5"/>`),
  sprout: () => svgIcon(`<path d="M7 20h10"/><path d="M12 20v-8"/><path d="M12 12C6 12 5 6 5 6s6-1 7 6Z"/><path d="M12 12c4-1 6-4 6-6s-4-1-6 2"/>`),
  chevronDown: () => svgIcon(`<path d="m6 9 6 6 6-6"/>`, 16),
  building: () => svgIcon(`<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h1"/><path d="M14 8h1"/><path d="M9 12h1"/><path d="M14 12h1"/><path d="M9 16h1"/><path d="M14 16h1"/>`),
  calculator: () => svgIcon(`<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 11h.01"/><path d="M12 11h.01"/><path d="M16 11h.01"/><path d="M8 15h.01"/><path d="M12 15h.01"/><path d="M16 15v3"/><path d="M8 18.5h4"/>`),
  book: () => svgIcon(`<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>`),
  users: () => svgIcon(`<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>`),
  user: () => svgIcon(`<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>`),
  settings: () => svgIcon(`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>`),
  file: () => svgIcon(`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>`),
  logout: () => svgIcon(`<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>`),
  plus: () => svgIcon(`<path d="M12 5v14"/><path d="M5 12h14"/>`),
  trash: () => svgIcon(`<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>`, 16),
  edit: () => svgIcon(`<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>`, 16),
  search: () => svgIcon(`<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>`),
  wifiOff: () => svgIcon(`<path d="m2 2 20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 5.2-2.8"/><path d="M19 12.9a10 10 0 0 0-2.3-1.6"/><path d="M2 8.8a15 15 0 0 1 4.2-2.6"/><path d="M22 8.8A15 15 0 0 0 11 5"/><path d="M12 20h.01"/>`),
  refresh: () => svgIcon(`<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M3 21v-5h5"/>`, 16),
  x: () => svgIcon(`<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`),
  menu: () => svgIcon(`<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>`),
  download: () => svgIcon(`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>`, 16),
  printer: () => svgIcon(`<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>`, 16),
  thermometer: () => svgIcon(`<path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0Z"/>`),
  check: () => svgIcon(`<path d="M20 6 9 17l-5-5"/>`, 16),
  arrowRight: () => svgIcon(`<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>`, 16),
  mapPin: () => svgIcon(`<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>`, 16),
};
