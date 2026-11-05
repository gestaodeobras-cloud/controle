// Exportação: PDF (jsPDF) e Excel (SheetJS). Se a biblioteca não carregar, usa impressão / CSV.
import { S, CFG, esc, hoje, data as fdata, toast } from "./core.js";

function baixar(blob, nome) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const nomeArq = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "") + "_" + hoje();

// colunas: [{l, k|v(row), tipo:'moeda'|'num'|'data'}]; linhas: objetos
function valor(c, r) {
  const v = c.v ? c.v(r) : r[c.k];
  if (c.tipo === "data") return fdata(v);
  return v ?? "";
}

export function excel(titulo, colunas, linhas, info = []) {
  const cab = colunas.map((c) => c.l);
  const corpo = linhas.map((r) => colunas.map((c) => { const v = valor(c, r); return ["moeda", "num"].includes(c.tipo) ? Number(v || 0) : v; }));
  if (window.XLSX) {
    const aoa = [[titulo], [`${S.sessao?.empresa?.nome || ""} · gerado em ${new Date().toLocaleString("pt-BR")}`], ...info.map((i) => [i]), [], cab, ...corpo];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const ini = aoa.length - corpo.length;
    colunas.forEach((c, j) => { if (c.tipo === "moeda") for (let i = 0; i < corpo.length; i++) { const cel = ws[XLSX.utils.encode_cell({ r: ini + i, c: j })]; if (cel) cel.z = '"R$" #,##0.00'; } });
    ws["!cols"] = colunas.map((c) => ({ wch: Math.min(45, Math.max(10, c.l.length + 2, ...corpo.slice(0, 200).map((r) => String(r[colunas.indexOf(c)] ?? "").length + 1))) }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, titulo.slice(0, 31).replace(/[\\/?*[\]:]/g, " "));
    XLSX.writeFile(wb, nomeArq(titulo) + ".xlsx");
  } else {
    const csv = [cab, ...corpo].map((l) => l.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    baixar(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), nomeArq(titulo) + ".csv");
    toast("Gerador de Excel indisponível: arquivo salvo em CSV (abre no Excel).");
  }
}

// várias abas em um único arquivo (backup/exportação geral)
export function excelVariasAbas(nome, abas) {
  if (!window.XLSX) return toast("Gerador de Excel indisponível. Verifique a internet e recarregue.", "erro");
  const wb = XLSX.utils.book_new();
  for (const a of abas) {
    const ws = XLSX.utils.json_to_sheet(a.linhas.length ? a.linhas : [{ info: "sem registros" }]);
    XLSX.utils.book_append_sheet(wb, ws, a.nome.slice(0, 31));
  }
  XLSX.writeFile(wb, nomeArq(nome) + ".xlsx");
}

export function pdf(titulo, colunas, linhas, { info = [], totais = null, paisagem = null, blocos = [] } = {}) {
  const corpo = linhas.map((r) => colunas.map((c) => fmtPdf(c, valor(c, r))));
  const horiz = paisagem ?? colunas.length > 6;
  if (window.jspdf?.jsPDF) {
    const doc = new window.jspdf.jsPDF({ orientation: horiz ? "landscape" : "portrait", unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(11, 31, 58); doc.rect(0, 0, W, 22, "F");
    doc.setTextColor(255); doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text(titulo, 12, 10);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`${S.sessao?.empresa?.nome || CFG.NOME_APP || ""} · ${new Date().toLocaleString("pt-BR")}`, 12, 16.5);
    doc.setTextColor(30); let y = 30;
    info.forEach((t) => { doc.text(String(t), 12, y); y += 5; });
    for (const b of blocos) {
      doc.setFont("helvetica", "bold"); doc.text(b.titulo, 12, y + 2); doc.setFont("helvetica", "normal"); y += 7;
      b.linhas.forEach(([k, v]) => { doc.setTextColor(110); doc.text(String(k), 12, y); doc.setTextColor(30); doc.text(doc.splitTextToSize(String(v ?? ""), W - 70), 60, y); y += 5 * Math.max(1, doc.splitTextToSize(String(v ?? ""), W - 70).length); });
      y += 3;
    }
    if (colunas.length) {
      doc.autoTable({
        startY: y + 2, head: [colunas.map((c) => c.l)], body: corpo, foot: totais ? [totais.map((t) => t ?? "")] : undefined,
        styles: { fontSize: 8.5, cellPadding: 2 }, headStyles: { fillColor: [30, 99, 233] }, footStyles: { fillColor: [238, 241, 246], textColor: 20, fontStyle: "bold" },
        columnStyles: Object.fromEntries(colunas.map((c, i) => [i, ["moeda", "num"].includes(c.tipo) ? { halign: "right" } : {}])),
        didDrawPage: () => { doc.setFontSize(8); doc.setTextColor(140); doc.text(`Página ${doc.internal.getNumberOfPages()}`, W - 25, doc.internal.pageSize.getHeight() - 6); },
      });
    }
    doc.save(nomeArq(titulo) + ".pdf");
  } else {
    imprimir(titulo, colunas, corpo, { info, totais, blocos });
  }
}

function fmtPdf(c, v) {
  if (c.tipo === "moeda") return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (c.tipo === "num") return Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  return String(v ?? "");
}

// alternativa: janela de impressão (o usuário escolhe "Salvar como PDF")
export function imprimir(titulo, colunas, corpo, { info = [], totais = null, blocos = [], html = "" } = {}) {
  const w = window.open("", "_blank");
  if (!w) return toast("Permita janelas (pop-up) para imprimir.", "erro");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
    body{font:12px Arial,sans-serif;color:#111;margin:24px} h1{font-size:18px;margin:0 0 2px} .sub{color:#555;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;margin-top:8px} th{background:#1e63e9;color:#fff;text-align:left;padding:6px} td{border-bottom:1px solid #ddd;padding:5px 6px}
    tfoot td{font-weight:bold;background:#eef1f6} .bl{margin:10px 0} .bl div{display:flex;gap:10px} .bl b{width:160px;color:#555;font-weight:normal}</style></head><body>
    <h1>${esc(titulo)}</h1><div class="sub">${esc(S.sessao?.empresa?.nome || "")} · ${new Date().toLocaleString("pt-BR")}</div>
    ${info.map((i) => `<div>${esc(i)}</div>`).join("")}
    ${blocos.map((b) => `<div class="bl"><h3>${esc(b.titulo)}</h3>${b.linhas.map(([k, v]) => `<div><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join("")}</div>`).join("")}
    ${html}
    ${colunas.length ? `<table><thead><tr>${colunas.map((c) => `<th>${esc(c.l)}</th>`).join("")}</tr></thead><tbody>${corpo.map((l) => `<tr>${l.map((x) => `<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody>${totais ? `<tfoot><tr>${totais.map((t) => `<td>${esc(t ?? "")}</td>`).join("")}</tr></tfoot>` : ""}</table>` : ""}
    <script>setTimeout(()=>print(),300)<\/script></body></html>`);
  w.document.close();
}
