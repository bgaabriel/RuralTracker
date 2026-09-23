// Regenera js/catalogo-produtos.js a partir de data/produtos_cafe.json (RF-18).
// O navegador não consegue ler JSON local via file://, por isso o catálogo é
// embutido como script. Uso: node scripts/build-catalog.js
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const json = JSON.parse(fs.readFileSync(path.join(root, "data/produtos_cafe.json"), "utf8"));
const body = JSON.stringify(json, null, 2).replace(/\n/g, "\n  ");

const out = `// Gerado a partir de data/produtos_cafe.json (RF-18) — não editar à mão.
// Para atualizar: node scripts/build-catalog.js
(function (root) {
  const CATALOGO_PRODUTOS = ${body};
  if (typeof module !== "undefined" && module.exports) module.exports = CATALOGO_PRODUTOS;
  else root.CATALOGO_PRODUTOS = CATALOGO_PRODUTOS;
})(typeof window !== "undefined" ? window : globalThis);
`;
fs.writeFileSync(path.join(root, "js/catalogo-produtos.js"), out);
console.log("js/catalogo-produtos.js atualizado.");
