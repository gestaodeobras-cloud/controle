// Gráficos em SVG (sem bibliotecas externas)
import { esc, moeda } from "./core.js";

export const CORES = ["#1e63e9", "#16a34a", "#ea8a0c", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#475569", "#f59e0b"];
const compacto = (v) => { const a = Math.abs(v); return (v < 0 ? "-" : "") + (a >= 1e6 ? (a / 1e6).toFixed(1).replace(".", ",") + " mi" : a >= 1e3 ? (a / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(".", ",") + " mil" : Math.round(a)); };

function escala(max, min = 0) {
  const span = max - min || 1;
  const passo = Math.pow(10, Math.floor(Math.log10(span / 4)));
  const p = [1, 2, 2.5, 5, 10].map((m) => m * passo).find((x) => span / x <= 5) || passo * 10;
  const lo = Math.floor(min / p) * p, hi = Math.ceil(max / p) * p || p;
  const t = []; for (let v = lo; v <= hi + p / 2; v += p) t.push(v);
  return { lo, hi, t };
}

function ligarDica(el, fmt = moeda) {
  let d;
  el.querySelectorAll("[data-dica]").forEach((n) => {
    n.addEventListener("mousemove", (e) => {
      if (!d) { d = document.createElement("div"); d.className = "dica-graf"; document.body.appendChild(d); }
      d.innerHTML = n.dataset.dica; d.style.left = e.clientX + 12 + "px"; d.style.top = e.clientY - 34 + "px";
    });
    n.addEventListener("mouseleave", () => { d?.remove(); d = null; });
  });
}

// barras agrupadas: rotulos[], series: [{nome, cor, valores[]}]
export function barras(el, rotulos, series, { formato = moeda, empilhado = false } = {}) {
  const W = 640, H = 250, ml = 52, mb = 26, mt = 8, mr = 8;
  const vals = series.flatMap((s) => s.valores);
  const tot = empilhado ? rotulos.map((_, i) => series.reduce((a, s) => a + (s.valores[i] || 0), 0)) : vals;
  const { lo, hi, t } = escala(Math.max(0, ...tot), Math.min(0, ...vals));
  const y = (v) => mt + (H - mt - mb) * (1 - (v - lo) / (hi - lo || 1));
  const bw = (W - ml - mr) / rotulos.length, gap = bw * 0.22, n = empilhado ? 1 : series.length, w = (bw - gap) / n;
  let s = t.map((v) => `<line class="grade-l" x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}"/><text class="eixo" x="${ml - 6}" y="${y(v) + 4}" text-anchor="end">${compacto(v)}</text>`).join("");
  rotulos.forEach((r, i) => {
    let base = 0;
    series.forEach((se, j) => {
      const v = se.valores[i] || 0;
      const x = ml + i * bw + gap / 2 + (empilhado ? 0 : j * w);
      const y1 = empilhado ? y(base + v) : y(Math.max(0, v)), y2 = empilhado ? y(base) : y(Math.min(0, v));
      s += `<rect x="${x}" y="${y1}" width="${Math.max(1, w - 2)}" height="${Math.max(0, y2 - y1)}" rx="3" fill="${se.cor}" data-dica="${esc(r)} · ${esc(se.nome)}: <b>${esc(formato(v))}</b>"/>`;
      if (empilhado) base += v;
    });
    s += `<text class="eixo" x="${ml + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(r)}</text>`;
  });
  el.innerHTML = `<div class="grafico"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${s}</svg></div>${legenda(series)}`;
  ligarDica(el, formato);
}

export function linhas(el, rotulos, series, { formato = moeda, area = true } = {}) {
  const W = 640, H = 250, ml = 52, mb = 26, mt = 10, mr = 10;
  const vals = series.flatMap((s) => s.valores);
  const { lo, hi, t } = escala(Math.max(0, ...vals), Math.min(0, ...vals));
  const y = (v) => mt + (H - mt - mb) * (1 - (v - lo) / (hi - lo || 1));
  const x = (i) => ml + (rotulos.length === 1 ? (W - ml - mr) / 2 : (i * (W - ml - mr)) / (rotulos.length - 1));
  let s = t.map((v) => `<line class="grade-l" x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}"/><text class="eixo" x="${ml - 6}" y="${y(v) + 4}" text-anchor="end">${compacto(v)}</text>`).join("");
  if (lo < 0) s += `<line x1="${ml}" x2="${W - mr}" y1="${y(0)}" y2="${y(0)}" stroke="#94a3b8" stroke-dasharray="3 3"/>`;
  series.forEach((se) => {
    const pts = se.valores.map((v, i) => `${x(i)},${y(v || 0)}`).join(" ");
    if (area && series.length === 1) s += `<polygon points="${x(0)},${y(Math.max(lo, 0))} ${pts} ${x(se.valores.length - 1)},${y(Math.max(lo, 0))}" fill="${se.cor}" opacity=".1"/>`;
    s += `<polyline points="${pts}" fill="none" stroke="${se.cor}" stroke-width="2.5" stroke-linejoin="round" ${se.tracejado ? 'stroke-dasharray="6 4"' : ""}/>`;
    se.valores.forEach((v, i) => { s += `<circle cx="${x(i)}" cy="${y(v || 0)}" r="3.5" fill="#fff" stroke="${se.cor}" stroke-width="2" data-dica="${esc(rotulos[i])} · ${esc(se.nome)}: <b>${esc(formato(v || 0))}</b>"/>`; });
  });
  rotulos.forEach((r, i) => { if (rotulos.length <= 12 || i % 2 === 0) s += `<text class="eixo" x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(r)}</text>`; });
  el.innerHTML = `<div class="grafico"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${s}</svg></div>${legenda(series)}`;
  ligarDica(el, formato);
}

export function rosca(el, itens, { formato = moeda } = {}) {
  const tot = itens.reduce((a, b) => a + b.valor, 0);
  if (!tot) { el.innerHTML = '<div class="vazio">Sem dados no período.</div>'; return; }
  let ang = -Math.PI / 2, s = "";
  const R = 80, r = 50, cx = 100, cy = 100;
  itens.forEach((it, i) => {
    const a = (it.valor / tot) * Math.PI * 2, a2 = ang + a, g = a > Math.PI ? 1 : 0, cor = it.cor || CORES[i % CORES.length];
    const p = (rad, raio) => `${cx + raio * Math.cos(rad)},${cy + raio * Math.sin(rad)}`;
    s += itens.length === 1
      ? `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${cor}" stroke-width="${R - r}" data-dica="${esc(it.nome)}: <b>${esc(formato(it.valor))}</b>"/>`
      : `<path d="M${p(ang, R)} A${R},${R} 0 ${g} 1 ${p(a2, R)} L${p(a2, r)} A${r},${r} 0 ${g} 0 ${p(ang, r)}Z" fill="${cor}" data-dica="${esc(it.nome)}: <b>${esc(formato(it.valor))}</b> (${Math.round((it.valor / tot) * 100)}%)"/>`;
    ang = a2;
  });
  el.innerHTML = `<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap"><svg viewBox="0 0 200 200" style="width:170px;height:170px;flex:none">${s}<text x="100" y="96" text-anchor="middle" font-size="11" fill="#8a99ae">Total</text><text x="100" y="114" text-anchor="middle" font-size="14" font-weight="800" fill="#0f1b2d">${esc(compacto(tot))}</text></svg>
    <div style="flex:1;min-width:160px;display:grid;gap:7px">${itens.map((it, i) => `<div style="display:flex;gap:8px;align-items:center;font-size:13px"><i style="width:10px;height:10px;border-radius:3px;background:${it.cor || CORES[i % CORES.length]};flex:none"></i><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.nome)}</span><b>${esc(formato(it.valor))}</b></div>`).join("")}</div></div>`;
  ligarDica(el, formato);
}

// barras horizontais comparando dois valores (ex.: orçamento x custo)
export function comparativo(el, itens, { formato = moeda, rotA = "Orçamento", rotB = "Custo" } = {}) {
  if (!itens.length) { el.innerHTML = '<div class="vazio">Sem dados.</div>'; return; }
  const mx = Math.max(1, ...itens.flatMap((i) => [i.a, i.b]));
  el.innerHTML = `<div style="display:grid;gap:12px">${itens.map((i) => {
    const pct = i.a ? (i.b / i.a) * 100 : 0, cor = pct > 100 ? "var(--verm)" : pct > 85 ? "var(--lar)" : "var(--verde)";
    return `<div><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(i.nome)}</b><span class="mu">${esc(formato(i.b))} / ${esc(formato(i.a))}</span></div>
      <div style="position:relative;height:10px;background:#edf1f7;border-radius:6px"><div style="position:absolute;inset:0 auto 0 0;width:${(i.a / mx) * 100}%;background:#c9dafc;border-radius:6px"></div><div style="position:absolute;inset:0 auto 0 0;width:${(i.b / mx) * 100}%;background:${cor};border-radius:6px"></div></div></div>`;
  }).join("")}</div><div class="legenda"><span><i style="background:#c9dafc"></i>${esc(rotA)}</span><span><i style="background:var(--verde)"></i>${esc(rotB)}</span></div>`;
}

const legenda = (series) => series.length > 1 ? `<div class="legenda">${series.map((s) => `<span><i style="background:${s.cor}"></i>${esc(s.nome)}</span>`).join("")}</div>` : "";
export const mesCurto = (ym) => { const [a, m] = ym.split("-"); return ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][+m - 1] + "/" + a.slice(2); };
