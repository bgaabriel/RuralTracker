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
};
