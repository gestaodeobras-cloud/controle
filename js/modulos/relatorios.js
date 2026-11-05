import { sb, esc, ic, moeda, data, num, hoje, inicioMes, tag, pode, toast, msgErro, q, tabela, obrasOp, fornecedoresOp, funcionariosOp, temRecurso, carregando } from "../core.js";
import { excel, pdf } from "../exportar.js";
import { STATUS_OC } from "./compras.js";
import { STATUS_OBRA } from "./dashboard.js";

const soma = (l, k) => l.reduce((a, r) => a + (+r[k] || 0), 0);
// cada relatório: filtros usados, consulta e colunas
const REL = {
  financeiro: { n: "Financeiro", mod: "financeiro", av: true, f: ["periodo", "obra", "fornecedor", "categoria", "status"], async dados(F) {
    let x = sb.from("v_lancamentos").select("*").neq("status", "cancelado").gte("vencimento", F.ini).lte("vencimento", F.fim).order("vencimento");
    if (F.obra) x = x.eq("obra_id", F.obra); if (F.fornecedor) x = x.eq("fornecedor_id", F.fornecedor); if (F.categoria) x = x.ilike("categoria", `%${F.categoria}%`); if (F.status) x = x.eq("situacao", F.status);
    const l = await q(x); const r = l.filter((a) => a.tipo === "receita"), d = l.filter((a) => a.tipo === "despesa");
    return { linhas: l, cols: [{ l: "Vencimento", k: "vencimento", tipo: "data" }, { l: "Tipo", k: "tipo" }, { l: "Descrição", k: "descricao" }, { l: "Obra", k: "obra_nome" }, { l: "Categoria", k: "categoria" }, { l: "Valor", k: "valor", tipo: "moeda" }, { l: "Pago/recebido", k: "valor_pago", tipo: "moeda" }, { l: "Situação", k: "situacao" }],
      resumo: [["Receitas", moeda(soma(r, "valor"))], ["Despesas", moeda(soma(d, "valor"))], ["Resultado", moeda(soma(r, "valor") - soma(d, "valor"))], ["Recebido", moeda(soma(r, "valor_pago"))], ["Pago", moeda(soma(d, "valor_pago"))]],
      tot: ["", "", "", "", "Total", moeda(soma(l, "valor")), moeda(soma(l, "valor_pago")), ""] }; } },
  obras: { n: "Obras", mod: "obras", f: ["obra", "status"], async dados(F) {
    let x = sb.from("obras").select("*").eq("arquivada", false).order("nome"); if (F.obra) x = x.eq("id", F.obra); if (F.status) x = x.eq("status", F.status);
    const o = await q(x); const l = pode("financeiro", "ver") ? await q(sb.from("lancamentos").select("obra_id,tipo,valor").neq("status", "cancelado")) : [];
    const ls = o.map((a) => ({ ...a, desp: l.filter((y) => y.obra_id === a.id && y.tipo === "despesa").reduce((s, y) => s + +y.valor, 0), rec: l.filter((y) => y.obra_id === a.id && y.tipo === "receita").reduce((s, y) => s + +y.valor, 0), st: STATUS_OBRA[a.status]?.[0] }));
    return { linhas: ls, cols: [{ l: "Código", k: "codigo" }, { l: "Obra", k: "nome" }, { l: "Cliente", k: "cliente" }, { l: "Início", k: "data_inicio", tipo: "data" }, { l: "Previsão", k: "previsao_termino", tipo: "data" }, { l: "Conclusão %", k: "progresso", tipo: "num" }, { l: "Orçamento", k: "orcamento", tipo: "moeda" }, { l: "Despesas", k: "desp", tipo: "moeda" }, { l: "Receitas", k: "rec", tipo: "moeda" }, { l: "Status", k: "st" }],
      resumo: [["Obras", ls.length], ["Orçamento total", moeda(soma(ls, "orcamento"))], ["Despesas", moeda(soma(ls, "desp"))], ["Atrasadas", ls.filter((a) => a.previsao_termino && a.previsao_termino < hoje() && !["concluida", "cancelada"].includes(a.status)).length]],
      tot: ["", "", "", "", "", "Total", moeda(soma(ls, "orcamento")), moeda(soma(ls, "desp")), moeda(soma(ls, "rec")), ""] }; } },
  compras: { n: "Compras (OCs)", mod: "compras", f: ["periodo", "obra", "fornecedor", "status_oc"], async dados(F) {
    let x = sb.from("v_ocs").select("*").gte("data_compra", F.ini).lte("data_compra", F.fim).order("data_compra"); if (F.obra) x = x.eq("obra_id", F.obra); if (F.fornecedor) x = x.eq("fornecedor_id", F.fornecedor); if (F.status_oc) x = x.eq("status", F.status_oc);
    const l = (await q(x)).map((a) => ({ ...a, st: STATUS_OC[a.status]?.[0] })); const v = l.filter((a) => !["cancelada", "reprovada"].includes(a.status));
    return { linhas: l, cols: [{ l: "Número", k: "numero" }, { l: "Data", k: "data_compra", tipo: "data" }, { l: "Obra", k: "obra_nome" }, { l: "Fornecedor", k: "fornecedor_nome" }, { l: "Subtotal", k: "subtotal", tipo: "moeda" }, { l: "Desconto", k: "desconto", tipo: "moeda" }, { l: "Total", k: "total", tipo: "moeda" }, { l: "Status", k: "st" }],
      resumo: [["OCs", l.length], ["Valor (válidas)", moeda(soma(v, "total"))], ["Aguardando aprovação", l.filter((a) => a.status === "aguardando").length]], tot: ["", "", "", "Total", moeda(soma(l, "subtotal")), moeda(soma(l, "desconto")), moeda(soma(l, "total")), ""] }; } },
  notas: { n: "Notas fiscais", mod: "notas", f: ["periodo", "obra", "fornecedor", "status_nf"], async dados(F) {
    let x = sb.from("v_notas").select("*").gte("data_emissao", F.ini).lte("data_emissao", F.fim).order("data_emissao"); if (F.obra) x = x.eq("obra_id", F.obra); if (F.fornecedor) x = x.eq("fornecedor_id", F.fornecedor); if (F.status_nf) x = x.eq("status_pagamento", F.status_nf);
    const l = await q(x); return { linhas: l, cols: [{ l: "NF", k: "numero" }, { l: "Emissão", k: "data_emissao", tipo: "data" }, { l: "Fornecedor", k: "fornecedor_nome" }, { l: "Obra", k: "obra_nome" }, { l: "OC", k: "oc_numero" }, { l: "Valor", k: "valor_total", tipo: "moeda" }, { l: "Pago", k: "valor_pago", tipo: "moeda" }, { l: "Saldo", k: "saldo", tipo: "moeda" }, { l: "Pagamento", k: "status_pagamento" }],
      resumo: [["Notas", l.length], ["Valor total", moeda(soma(l, "valor_total"))], ["Saldo a pagar", moeda(soma(l, "saldo"))], ["Vencidas", l.filter((a) => a.status_pagamento === "vencida").length]], tot: ["", "", "", "", "Total", moeda(soma(l, "valor_total")), moeda(soma(l, "valor_pago")), moeda(soma(l, "saldo")), ""] }; } },
  estoque: { n: "Estoque (saldos e consumo)", mod: "estoque", f: ["periodo", "obra", "categoria"], async dados(F) {
    let mq = sb.from("materiais").select("*").eq("ativo", true).order("nome"); if (F.categoria) mq = mq.ilike("categoria", `%${F.categoria}%`);
    const [mats, sal] = await Promise.all([q(mq), q(sb.from("v_saldos").select("*"))]);
    let mv = sb.from("estoque_movimentos").select("material_id,tipo,quantidade,obra_id").gte("data", F.ini).lte("data", F.fim); if (F.obra) mv = mv.eq("obra_id", F.obra);
    const movs = await q(mv);
    const l = mats.map((m) => { const s = sal.filter((x) => x.material_id === m.id && (!F.obra || x.obra_id == F.obra)).reduce((a, x) => a + +x.quantidade, 0);
      const mm = movs.filter((x) => x.material_id === m.id); return { ...m, saldo: s, valor: s * +m.valor_unitario, entradas: mm.filter((x) => x.tipo === "entrada").reduce((a, x) => a + +x.quantidade, 0), consumo: mm.filter((x) => x.tipo === "saida").reduce((a, x) => a + +x.quantidade, 0) }; });
    return { linhas: l, cols: [{ l: "Código", k: "codigo" }, { l: "Material", k: "nome" }, { l: "Categoria", k: "categoria" }, { l: "Un.", k: "unidade" }, { l: "Entradas no período", k: "entradas", tipo: "num" }, { l: "Consumo no período", k: "consumo", tipo: "num" }, { l: "Saldo atual", k: "saldo", tipo: "num" }, { l: "Mínimo", k: "estoque_minimo", tipo: "num" }, { l: "Valor em estoque", k: "valor", tipo: "moeda" }],
      resumo: [["Materiais", l.length], ["Abaixo do mínimo", l.filter((a) => a.saldo < a.estoque_minimo).length], ["Valor em estoque", moeda(soma(l, "valor"))]], tot: ["", "", "", "", "", "", "", "Total", moeda(soma(l, "valor"))] }; } },
  epi: { n: "EPI (entregas)", mod: "epi", av: true, f: ["periodo", "obra", "funcionario"], async dados(F) {
    let x = sb.from("epi_entregas").select("*, epis(nome,ca), funcionarios(nome)").gte("data_entrega", F.ini).lte("data_entrega", F.fim).order("data_entrega"); if (F.obra) x = x.eq("obra_id", F.obra); if (F.funcionario) x = x.eq("funcionario_id", F.funcionario);
    const l = (await q(x)).map((a) => ({ ...a, func: a.funcionarios?.nome, epi: a.epis?.nome, ca: a.epis?.ca, ass: a.assinatura_path ? "Sim" : "Não" }));
    return { linhas: l, cols: [{ l: "Data", k: "data_entrega", tipo: "data" }, { l: "Funcionário", k: "func" }, { l: "EPI", k: "epi" }, { l: "CA", k: "ca" }, { l: "Qtd.", k: "quantidade", tipo: "num" }, { l: "Entregue por", k: "responsavel_nome" }, { l: "Devolução", k: "data_devolucao", tipo: "data" }, { l: "Assinado", k: "ass" }],
      resumo: [["Entregas", l.length], ["Itens entregues", num(soma(l, "quantidade"))], ["Sem assinatura", l.filter((a) => !a.assinatura_path).length]] }; } },
  funcionarios: { n: "Funcionários", mod: "equipe", f: ["obra", "funcao"], async dados(F) {
    let x = sb.from("funcionarios").select("*, obras(nome)").order("nome"); if (F.obra) x = x.eq("obra_id", F.obra); if (F.funcao) x = x.ilike("funcao", `%${F.funcao}%`);
    const l = (await q(x)).map((a) => ({ ...a, obra: a.obras?.nome }));
    return { linhas: l, cols: [{ l: "Nome", k: "nome" }, { l: "Cargo", k: "cargo" }, { l: "Função", k: "funcao" }, { l: "Obra", k: "obra" }, { l: "Admissão", k: "data_admissao", tipo: "data" }, { l: "Situação", k: "situacao" }, { l: "Telefone", k: "telefone" }],
      resumo: [["Funcionários", l.length], ["Ativos", l.filter((a) => a.situacao === "ativo").length]] }; } },
  fornecedores: { n: "Fornecedores", mod: "fornecedores", f: ["periodo", "categoria"], async dados(F) {
    let fq = sb.from("fornecedores").select("*").order("razao_social"); if (F.categoria) fq = fq.ilike("categoria", `%${F.categoria}%`);
    const [fs, ocs, nfs] = await Promise.all([q(fq), pode("compras", "ver") ? q(sb.from("ordens_compra").select("fornecedor_id,total,status").gte("data_compra", F.ini).lte("data_compra", F.fim)) : [], pode("notas", "ver") ? q(sb.from("v_notas").select("fornecedor_id,valor_total,saldo,cancelada").gte("data_emissao", F.ini).lte("data_emissao", F.fim)) : []]);
    const l = fs.map((f) => { const o = ocs.filter((x) => x.fornecedor_id === f.id && !["cancelada", "reprovada"].includes(x.status)), n = nfs.filter((x) => x.fornecedor_id === f.id && !x.cancelada);
      return { ...f, n_oc: o.length, v_oc: soma(o, "total"), n_nf: n.length, v_nf: soma(n, "valor_total"), saldo: soma(n, "saldo") }; }).sort((a, b) => b.v_oc - a.v_oc);
    return { linhas: l, cols: [{ l: "Fornecedor", k: "razao_social" }, { l: "CNPJ/CPF", k: "documento" }, { l: "Categoria", k: "categoria" }, { l: "OCs", k: "n_oc", tipo: "num" }, { l: "Valor OCs", k: "v_oc", tipo: "moeda" }, { l: "NFs", k: "n_nf", tipo: "num" }, { l: "Valor NFs", k: "v_nf", tipo: "moeda" }, { l: "Saldo a pagar", k: "saldo", tipo: "moeda" }],
      resumo: [["Fornecedores", l.length], ["Compras no período", moeda(soma(l, "v_oc"))]], tot: ["", "", "", "Total", moeda(soma(l, "v_oc")), "", moeda(soma(l, "v_nf")), moeda(soma(l, "saldo"))] }; } },
  produtividade: { n: "Produtividade (diário de obra)", mod: "diario", av: true, f: ["periodo", "obra"], async dados(F) {
    let x = sb.from("diarios").select("obra_id,data,status,problemas,ocorrencias,clima,obras(codigo,nome,progresso)").gte("data", F.ini).lte("data", F.fim); if (F.obra) x = x.eq("obra_id", F.obra);
    const d = await q(x); const g = {};
    d.forEach((r) => { const k = r.obra_id; g[k] ??= { obra: `${r.obras?.codigo} · ${r.obras?.nome}`, progresso: r.obras?.progresso, dias: 0, aprovados: 0, problemas: 0, chuva: 0 };
      g[k].dias++; if (r.status === "aprovado") g[k].aprovados++; if (r.problemas) g[k].problemas++; if (/chuv/i.test(r.clima || "")) g[k].chuva++; });
    const l = Object.values(g);
    return { linhas: l, cols: [{ l: "Obra", k: "obra" }, { l: "Dias registrados", k: "dias", tipo: "num" }, { l: "Aprovados", k: "aprovados", tipo: "num" }, { l: "Dias com problemas", k: "problemas", tipo: "num" }, { l: "Dias com chuva", k: "chuva", tipo: "num" }, { l: "Conclusão atual %", k: "progresso", tipo: "num" }],
      resumo: [["Registros no período", d.length], ["Obras com registro", l.length]] }; } },
};

export async function render(el) {
  const disp = Object.entries(REL).filter(([, r]) => pode(r.mod, "ver"));
  const bloqueado = (r) => r.av && !temRecurso("relatorios_avancados");
  const [obras, forn, func] = await Promise.all([obrasOp(true), pode("fornecedores", "ver") ? fornecedoresOp() : [], pode("equipe", "ver") || pode("epi", "ver") ? funcionariosOp() : []]);
  el.innerHTML = `<div class="cab-pagina"><div><h1>Relatórios</h1><p>Escolha o relatório, aplique os filtros e exporte em PDF ou Excel.</p></div></div>
    <div class="grade" style="grid-template-columns:260px minmax(0,1fr)" id="r-grid">
      <div class="card" style="align-self:start"><div class="cc" style="display:grid;gap:4px">${disp.map(([k, r], i) => `<button class="bt ${i === 0 ? "" : "sec"}" style="justify-content:flex-start" data-r="${k}" ${bloqueado(r) ? "disabled title='Disponível no plano Profissional ou superior'" : ""}>${esc(r.n)}${bloqueado(r) ? " 🔒" : ""}</button>`).join("")}</div></div>
      <div><div class="card" style="margin-bottom:16px"><div class="filtros" id="r-f"></div></div><div id="r-res"></div></div>
    </div>`;
  if (window.innerWidth < 900) el.querySelector("#r-grid").style.gridTemplateColumns = "1fr";
  let atual = disp.find(([, r]) => !bloqueado(r))?.[0];
  const F = { ini: inicioMes(hoje().slice(0, 4) + "-01-01"), fim: hoje() };
  const filtroHTML = (r) => r.f.map((f) => ({
    periodo: `<div class="campo"><label>De</label><input type="date" class="inp" data-k="ini" value="${F.ini}"></div><div class="campo"><label>Até</label><input type="date" class="inp" data-k="fim" value="${F.fim}"></div>`,
    obra: sel("obra", "Obra", obras), fornecedor: sel("fornecedor", "Fornecedor", forn), funcionario: sel("funcionario", "Funcionário", func),
    categoria: `<div class="campo"><label>Categoria</label><input class="inp" data-k="categoria" placeholder="Contém..."></div>`, funcao: `<div class="campo"><label>Função</label><input class="inp" data-k="funcao"></div>`,
    status: sel("status", "Situação", [["pendente", "A vencer"], ["vencido", "Vencido"], ["parcial", "Parcial"], ["pago", "Pago"]]), status_oc: sel("status_oc", "Status", Object.entries(STATUS_OC).map(([v, [l]]) => [v, l])),
    status_nf: sel("status_nf", "Pagamento", [["pendente", "Pendente"], ["parcial", "Parcial"], ["paga", "Paga"], ["vencida", "Vencida"], ["cancelada", "Cancelada"]]),
  }[f])).join("") + `<div style="display:flex;gap:8px;margin-left:auto"><button class="bt" id="r-ger">${ic("relatorios")}Gerar</button>${pode("relatorios", "exportar") ? `<button class="bt sec" id="r-pdf">${ic("pdf")}PDF</button><button class="bt sec" id="r-xls">${ic("excel")}Excel</button>` : ""}</div>`;
  let res = null;
  const gerar = async () => {
    el.querySelectorAll("#r-f [data-k]").forEach((i) => { F[i.dataset.k] = i.value || ""; ["obra", "fornecedor", "funcionario"].forEach((k) => { if (i.dataset.k === k) F[k] = i.value ? +i.value : ""; }); });
    const box = el.querySelector("#r-res"); box.innerHTML = `<div class="card">${carregando()}</div>`;
    try {
      res = await REL[atual].dados(F);
      box.innerHTML = `${res.resumo ? `<div class="grade g4" style="margin-bottom:16px">${res.resumo.map(([k, v]) => `<div class="card kpi"><div><small>${esc(k)}</small><b>${esc(v)}</b></div></div>`).join("")}</div>` : ""}
        <div class="card">${tabela(res.cols.map((c) => ({ l: c.l, num: ["moeda", "num"].includes(c.tipo), f: (r) => c.tipo === "moeda" ? moeda(r[c.k]) : c.tipo === "data" ? data(r[c.k]) : c.tipo === "num" ? num(r[c.k], 3) : esc(r[c.k] ?? "") })), res.linhas, { rodape: res.tot, vazio: "Nenhum dado para os filtros escolhidos." })}</div>`;
    } catch (e) { box.innerHTML = `<div class="card"><div class="vazio verm">${esc(msgErro(e))}</div></div>`; }
  };
  const info = () => [`Período: ${data(F.ini)} a ${data(F.fim)}`, ...(F.obra ? [`Obra: ${obras.find((o) => o[0] == F.obra)?.[1]}`] : [])];
  const abrir = (k) => {
    atual = k; el.querySelectorAll("[data-r]").forEach((b) => { b.classList.toggle("sec", b.dataset.r !== k); });
    el.querySelector("#r-f").innerHTML = filtroHTML(REL[k]);
    el.querySelector("#r-ger").onclick = gerar;
    el.querySelector("#r-pdf")?.addEventListener("click", async () => { if (!res) await gerar(); pdf(`Relatório de ${REL[atual].n}`, res.cols, res.linhas, { info: [...info(), ...(res.resumo || []).map(([a, b]) => `${a}: ${b}`)], totais: res.tot }); });
    el.querySelector("#r-xls")?.addEventListener("click", async () => { if (!res) await gerar(); excel(`Relatório de ${REL[atual].n}`, res.cols, res.linhas, info()); });
    res = null; gerar();
  };
  el.querySelectorAll("[data-r]").forEach((b) => b.onclick = () => abrir(b.dataset.r));
  if (atual) abrir(atual); else el.querySelector("#r-res").innerHTML = '<div class="card"><div class="vazio">Nenhum relatório disponível para o seu perfil.</div></div>';
}
const sel = (k, l, op) => `<div class="campo"><label>${l}</label><select class="inp" data-k="${k}"><option value="">Todos</option>${op.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("")}</select></div>`;
