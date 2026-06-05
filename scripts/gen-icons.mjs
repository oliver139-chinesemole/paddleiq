import { Resvg } from "@resvg/resvg-js";
import { writeFileSync, mkdirSync } from "fs";

mkdirSync("./public/icons", { recursive: true });

function svgIcon(size) {
  const r = Math.round(size * 0.18);
  const cx = size / 2, cy = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#0A0F1E"/>
  <circle cx="${cx}" cy="${cy}" r="${size*0.285}" fill="none" stroke="#0EA5E9" stroke-width="${size*0.06}"/>
  <circle cx="${cx}" cy="${cy}" r="${size*0.13}" fill="#0EA5E9"/>
  <line x1="${cx}" y1="${cy*0.3}" x2="${cx}" y2="${cy*1.7}" stroke="#0EA5E9" stroke-width="${size*0.055}" stroke-linecap="round"/>
  <ellipse cx="${cx}" cy="${size*0.23}" rx="${size*0.13}" ry="${size*0.095}" fill="#0EA5E9"/>
</svg>`;
}

for (const size of [192, 512]) {
  const resvg = new Resvg(svgIcon(size), { fitTo: { mode: "width", value: size } });
  writeFileSync(`./public/icons/icon-${size}.png`, resvg.render().asPng());
  console.log(`icon-${size}.png OK`);
}
