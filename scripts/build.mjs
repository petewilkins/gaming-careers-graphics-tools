import { readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asset = path => resolve(root, "src/assets", path);

const assets = {
  FONT: asset("fonts/SpaceGrotesk.ttf"),
  BRAND: asset("brand/logo-dark.svg"),
  STREAMLABS: asset("logos/streamlabs.svg"),
  PRISM: asset("logos/prism.png"),
  VMIX: asset("logos/vmix.png"),
  STREAMYARD: asset("logos/streamyard.png"),
  RIVERSIDE: asset("logos/riverside.png"),
  RESTREAM: asset("logos/restream.png"),
  XSPLIT: asset("logos/xsplit.png"),
  ECAMM: asset("logos/ecamm.png"),
  MELD: asset("logos/meld.png"),
  OBS: asset("logos/obs.svg")
};

const mime = path => ({
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf"
})[extname(path).toLowerCase()];

async function build(templatePath, outputPath, tokens) {
  let html = await readFile(resolve(root, templatePath), "utf8");
  for (const token of tokens) {
    const path = assets[token];
    const data = await readFile(path);
    html = html.replaceAll(`{{${token}}}`, `data:${mime(path)};base64,${data.toString("base64")}`);
  }
  await writeFile(resolve(root, outputPath), html);
  console.log(outputPath);
}

await Promise.all([
  build("src/tier-list/index.template.html", "tools/tier-list/index.html", ["FONT", "BRAND", "STREAMLABS", "PRISM", "VMIX", "STREAMYARD", "RIVERSIDE", "RESTREAM", "XSPLIT", "ECAMM", "MELD", "OBS"]),
  build("src/social-comments/index.template.html", "tools/social-comments/index.html", ["FONT", "BRAND"]),
  build("src/benchmark-charts/index.template.html", "tools/benchmark-charts/index.html", ["FONT", "BRAND", "OBS", "STREAMLABS", "PRISM", "MELD", "VMIX", "XSPLIT", "ECAMM"])
]);
