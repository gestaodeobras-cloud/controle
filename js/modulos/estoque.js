import { sb, esc, ic, moeda, data, num, hoje, tag, pode, toast, msgErro, q, tabela, formulario, depositosOp, fornecedoresOp, obrasOp, limparCache, ir, dataHora, carregando } from "../core.js";
import { listaRecurso } from "../crud.js";
import { UNIDADES } from "./compras.js";
import { excel, pdf } from "../exportar.js";

const TIPOS = { entrada: ["Entrada", "verde"], saida: ["Saída", "verm"], transferencia: ["Transferência", "azul"], devolucao: ["Devolução", "roxo"], ajuste: ["Ajuste de inventário", "lar"] };
const CATS = ["Material civil", "Material elétrico", "Material hidráulico", "Pintura", "Ferragens", "Madeira", "Ferramentas", "Acabamento", "Outros"];

export async function render(el, [p1, p2]) {
  const abas = [["saldos", "Saldos"], ["materiais", "Materiais"], ["movimentos", "Movimentações"], ["depositos", "Depósitos"], ["precos", "Histórico de preços"]];
  const aba = abas.some((a) => a[0] === p1) ? p1 : p1 === "material" ? "material" : "saldos";
  el.innerHTML = `<div class="cab-pagina"><div><h1>Estoque</h1><p>Materiais, saldos por depósito/obra e movimentações.</p></div>
    <div class="botoes">${pode("estoque", "cadastrar") ? Object.entries(TIPOS).filter(([t]) => t !== "ajuste" || pode("estoque", "editar")).map(([t, [l]]) => `<button class="bt ${t === "entrada" ? "verde" : t === "saida" ? "" : "sec"}" data-mov="${t}">${l}</button>`).join("") : ""}</div></div>
    <div class="abas">${abas.map(([k, l]) => `<button data-aba="${k}" class="${k === aba ? "on" : ""}">${l}</button>`).join("")}</div><div id="e-aba"></div>`;
  el.querySelectorAll("[data-aba]").forEach((b) => b.onclick = () => ir("estoque/" + b.dataset.aba));
  el.querySelectorAll("[data-mov]").forEach((b) => b.onclick = () => movimentar(b.dataset.mov, null, () => render(el, [aba])));
  const c = el.querySelector("#e-aba");
  if (aba === "material") return material(c, +p2, () => render(el, ["material", p2]));
  return ABAS[aba](c, el);
}

const ABAS = {
  async saldos(c) {
    const deps = await depositosOp();
    c.innerHTML = `<div class="card"><div class="filtros"><div class="campo busca"><label>Pesquisar</label><input class="inp" id="s-b" placeholder="Código ou nome"></div>
      <div class="campo"><label>Depósito / obra</label><select class="inp" id="s-d"><option value="">Todos (somado)</option>${deps.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></div>
      <label class="campo check" style="height:38px"><input type="checkbox" id="s-baixo"><span>Somente abaixo do mínimo</span></label>
      ${pode("estoque", "exportar") ? `<div style="margin-left:auto;display:flex;gap:8px"><button class="bt sec peq" id="s-xls">${ic("excel")}Excel</button><button class="bt sec peq" id="s-pdf">${ic("pdf")}PDF</button></div>` : ""}</div><div id="s-l">${carregando()}</div></div>`;
    let linhas = [];
    const carregar = async () => {
      const dep = c.querySelector("#s-d").value, b = c.querySelector("#s-b").value.toLowerCase(), baixo = c.querySelector("#s-baixo").checked;
      const [mats, sal] = await Promise.all([q(sb.from("materiais").select("*").eq("ativo", true).order("nome")), q(sb.from("v_saldos").select("*"))]);
      linhas = mats.map((m) => { const s = sal.filter((x) => x.material_id === m.id && (!dep || x.deposito_id == dep)); const qt = s.reduce((a, x) => a + +x.quantidade, 0);
        return { ...m, saldo: qt, valor_total: qt * +m.valor_unitario, locais: s.filter((x) => +x.quantidade).map((x) => `${x.deposito_nome}: ${num(x.quantidade, 3)}`).join(" · ") }; })
        .filter((m) => (!b || (m.codigo + " " + m.nome).toLowerCase().includes(b)) && (!baixo || m.saldo < m.estoque_minimo));
      c.querySelector("#s-l").innerHTML = tabela([
        { l: "Material", pri: true, f: (r) => `<b>${esc(r.codigo)}</b> · ${esc(r.nome)}` }, { l: "Categoria", k: "categoria" },
        { l: "Saldo", num: true, f: (r) => `<b class="${r.saldo < r.estoque_minimo ? "verm" : ""}">${num(r.saldo, 3)}</b> ${esc(r.unidade)}` },
        { l: "Mínimo", num: true, f: (r) => num(r.estoque_minimo, 3) },
        { l: "Situação", f: (r) => r.saldo <= 0 ? tag("Zerado", "verm") : r.saldo < r.estoque_minimo ? tag("Abaixo do mínimo", "verm") : r.saldo < r.estoque_minimo * 1.2 ? tag("Próximo do mínimo", "lar") : tag("Normal", "verde") },
        { l: "Valor em estoque", num: true, f: (r) => moeda(r.valor_total) }, { l: "Onde está", f: (r) => `<span class="peq mu">${esc(r.locais || "-")}</span>` },
      ], linhas, { clique: true, vazio: "Nenhum material.", rodape: ["Total", "", "", "", "", moeda(linhas.reduce((a, r) => a + r.valor_total, 0)), ""] });
      c.querySelectorAll("tr.clic").forEach((tr, i) => tr.onclick = () => ir("estoque/material/" + linhas[i].id));
    };
    const cols = [{ l: "Código", k: "codigo" }, { l: "Material", k: "nome" }, { l: "Categoria", k: "categoria" }, { l: "Unidade", k: "unidade" }, { l: "Saldo", k: "saldo", tipo: "num" }, { l: "Mínimo", k: "estoque_minimo", tipo: "num" }, { l: "Valor unit.", k: "valor_unitario", tipo: "moeda" }, { l: "Valor total", k: "valor_total", tipo: "moeda" }];
    c.querySelector("#s-xls")?.addEventListener("click", () => excel("Saldos de estoque", cols, linhas));
    c.querySelector("#s-pdf")?.addEventListener("click", () => pdf("Saldos de estoque", cols, linhas, { totais: ["Total", "", "", "", "", "", "", moeda(linhas.reduce((a, r) => a + r.valor_total, 0))] }));
    c.querySelectorAll("#s-d,#s-baixo").forEach((i) => i.onchange = carregar);
    c.querySelector("#s-b").oninput = carregar;
    carregar();
  },
  async materiais(c) {
    const forn = await fornecedoresOp();
    await listaRecurso(c, {
      titulo: "Materiais", singular: "material", tabela: "materiais", modulo: "estoque", novoTexto: "Novo material",
      busca: ["codigo", "nome", "descricao", "categoria"], ordem: ["nome", true],
      filtros: [{ k: "categoria", l: "Categoria", op: CATS }, { k: "ativo", l: "Situação", op: [["true", "Ativos"], ["false", "Inativos"]], padrao: "true" }],
      colunas: [{ l: "Código", pri: true, k: "codigo" }, { l: "Nome", k: "nome" }, { l: "Categoria", k: "categoria" }, { l: "Unidade", k: "unidade" },
        { l: "Mínimo", k: "estoque_minimo", tipo: "num", num: true, f: (r) => num(r.estoque_minimo, 3) }, { l: "Valor unit.", k: "valor_unitario", tipo: "moeda", num: true, f: (r) => moeda(r.valor_unitario) }, { l: "Localização", k: "localizacao" }],
      campos: [{ k: "codigo", l: "Código", req: true }, { k: "nome", l: "Nome", req: true }, { k: "descricao", l: "Descrição", s2: true },
        { k: "categoria", l: "Categoria", t: "select", op: CATS }, { k: "unidade", l: "Unidade de medida", t: "select", op: UNIDADES, req: true, vazio: false, padrao: "UN" },
        { k: "estoque_minimo", l: "Estoque mínimo", t: "num", min: 0 }, { k: "valor_unitario", l: "Valor unitário (R$)", t: "money", min: 0 },
        { k: "fornecedor_id", l: "Fornecedor principal", t: "select", op: forn, numerico: true }, { k: "localizacao", l: "Localização (prateleira, galpão...)" },
        { k: "ativo", l: "Material ativo", t: "check", padrao: true }],
      preparar: (v) => ({ ...v, estoque_minimo: v.estoque_minimo || 0, valor_unitario: v.valor_unitario || 0 }),
      padroes: () => ({ ativo: true }), permiteExcluir: false,
    });
  },
  async movimentos(c) {
    const [deps, obras] = await Promise.all([depositosOp(), obrasOp(true)]);
    await listaRecurso(c, {
      titulo: "Movimentações de estoque", fonte: "estoque_movimentos", modulo: "estoque", semNovo: true,
      select: "*, materiais(codigo,nome,unidade)", ordem: ["criado_em", false], busca: ["motivo", "usuario_nome"],
      filtros: [{ k: "tipo", l: "Tipo", op: Object.entries(TIPOS).map(([v, [l]]) => [v, l]) }, { k: "obra_id", l: "Obra", op: obras },
        { k: "dep", l: "Depósito", op: deps, aplicar: (q2, v) => q2.or(`deposito_origem.eq.${+v},deposito_destino.eq.${+v}`) },
        { k: "de", l: "De", tipo: "data", aplicar: (q2, v) => q2.gte("data", v) }, { k: "ate", l: "Até", tipo: "data", aplicar: (q2, v) => q2.lte("data", v) }],
      colunas: [{ l: "Data", k: "data", tipo: "data", f: (r) => data(r.data) }, { l: "Material", pri: true, v: (r) => r.materiais?.nome, f: (r) => `${esc(r.materiais?.codigo)} · ${esc(r.materiais?.nome)}` },
        { l: "Tipo", k: "tipo", v: (r) => TIPOS[r.tipo]?.[0], f: (r) => tag(...TIPOS[r.tipo]) + (r.negativo_autorizado ? ' <span class="tag verm">negativo autorizado</span>' : "") },
        { l: "Quantidade", k: "quantidade", tipo: "num", num: true, f: (r) => `${num(r.quantidade, 3)} ${esc(r.materiais?.unidade || "")}` },
        { l: "Origem → destino", v: (r) => `${nomeDep(deps, r.deposito_origem)} → ${nomeDep(deps, r.deposito_destino)}`, f: (r) => `<span class="peq">${esc(nomeDep(deps, r.deposito_origem))} → ${esc(nomeDep(deps, r.deposito_destino))}</span>` },
        { l: "Motivo", k: "motivo" }, { l: "Usuário", k: "usuario_nome", f: (r) => `<span class="peq">${esc(r.usuario_nome)}<br><span class="mu">${dataHora(r.criado_em)}</span></span>` }],
    });
  },
  async depositos(c) {
    const obras = await obrasOp(true);
    await listaRecurso(c, {
      titulo: "Depósitos", singular: "depósito", tabela: "depositos", modulo: "estoque", novoTexto: "Novo depósito", cache: "depositos", ordem: ["nome", true], busca: ["nome"],
      colunas: [{ l: "Nome", pri: true, k: "nome" }, { l: "Obra", f: (r) => esc(obras.find((o) => o[0] === r.obra_id)?.[1] || "Central / sem obra") }, { l: "Situação", f: (r) => tag(r.ativo ? "Ativo" : "Inativo", r.ativo ? "verde" : "cinza") }],
      campos: [{ k: "nome", l: "Nome", req: true, s2: true }, { k: "obra_id", l: "Obra vinculada", t: "select", op: obras, vazio: "— Depósito central —", numerico: true }, { k: "ativo", l: "Ativo", t: "check", padrao: true }],
      padroes: () => ({ ativo: true }), permiteExcluir: false,
    });
  },
  async precos(c) {
    await listaRecurso(c, {
      titulo: "Histórico de preços", fonte: "material_precos", modulo: "estoque", semNovo: true, select: "*, materiais(codigo,nome,unidade)", ordem: ["data", false], ordem2: ["id", false],
      colunas: [{ l: "Data", k: "data", tipo: "data", f: (r) => data(r.data) }, { l: "Material", pri: true, v: (r) => r.materiais?.nome, f: (r) => `${esc(r.materiais?.codigo)} · ${esc(r.materiais?.nome)}` },
        { l: "Valor unitário", k: "valor_unitario", tipo: "moeda", num: true, f: (r) => moeda(r.valor_unitario) }, { l: "Origem", k: "origem" }],
    });
  },
};
const nomeDep = (deps, id) => (id ? deps.find((d) => d[0] === id)?.[1] || "#" + id : "—");

export async function movimentar(tipo, materialId, ok) {
  const [mats, deps] = await Promise.all([q(sb.from("materiais").select("id,codigo,nome,unidade,valor_unitario").eq("ativo", true).order("nome")), depositosOp()]);
  if (!mats.length) return toast("Cadastre um material primeiro (aba Materiais).", "erro");
  const opM = mats.map((m) => [m.id, `${m.codigo} · ${m.nome} (${m.unidade})`]);
  const campos = [{ k: "material", l: "Material", t: "select", op: opM, req: true, numerico: true, s2: true }];
  if (["saida", "transferencia", "devolucao"].includes(tipo)) campos.push({ k: "origem", l: tipo === "devolucao" ? "Devolvido de (depósito/obra)" : "Depósito de origem", t: "select", op: deps, req: tipo !== "devolucao", numerico: true });
  if (["entrada", "transferencia", "devolucao", "ajuste"].includes(tipo)) campos.push({ k: "destino", l: tipo === "ajuste" ? "Depósito inventariado" : "Depósito de destino", t: "select", op: deps, req: true, numerico: true });
  campos.push({ k: "quantidade", l: tipo === "ajuste" ? "Quantidade contada (inventário físico)" : "Quantidade", t: "num", req: true, min: tipo === "ajuste" ? 0 : 0.001 });
  if (tipo === "entrada") campos.push({ k: "valor", l: "Valor unitário (R$)", t: "money", min: 0 });
  campos.push({ k: "data", l: "Data", t: "date", req: true, padrao: hoje() }, { k: "motivo", l: "Motivo / observação", req: true, s2: true, ph: tipo === "saida" ? "Ex.: aplicação na laje do 2º pavimento" : "" });
  if (["saida", "transferencia"].includes(tipo) && pode("estoque", "aprovar")) campos.push({ k: "negativo", l: "Autorizar saldo negativo (uso excepcional)", t: "check", s2: true });
  const m = formulario({ titulo: TIPOS[tipo][0] + " de material", campos, valores: { material: materialId },
    salvar: async (v) => {
      await q(sb.rpc("estoque_movimentar", { p_tipo: tipo, p_material: v.material, p_quantidade: v.quantidade, p_motivo: v.motivo, p_deposito_origem: v.origem || null,
        p_deposito_destino: v.destino || null, p_valor_unitario: v.valor ?? null, p_data: v.data, p_autorizar_negativo: !!v.negativo }));
      toast("Movimentação registrada.", "ok"); limparCache(); ok?.();
    } });
  const sm = m.el.querySelector('[name="material"]'), sv = m.el.querySelector('[name="valor"]');
  const preenche = () => { const x = mats.find((y) => y.id == sm.value); if (x && sv && !sv.value && +x.valor_unitario) sv.value = Number(x.valor_unitario).toFixed(2).replace(".", ","); };
  sm.addEventListener("change", preenche); preenche();
}

async function material(c, id, recarregar) {
  const [m, sal, mov, pr] = await Promise.all([
    q(sb.from("materiais").select("*, fornecedores(razao_social)").eq("id", id).maybeSingle()),
    q(sb.from("v_saldos").select("*").eq("material_id", id)),
    q(sb.from("estoque_movimentos").select("*").eq("material_id", id).order("criado_em", { ascending: false }).limit(100)),
    q(sb.from("material_precos").select("*").eq("material_id", id).order("data", { ascending: false }).limit(30)),
  ]);
  if (!m) { c.innerHTML = '<div class="vazio">Material não encontrado.</div>'; return; }
  const deps = await depositosOp(); const tot = sal.reduce((a, x) => a + +x.quantidade, 0);
  c.innerHTML = `<div class="trilha"><a href="#estoque/materiais">Materiais</a> / ${esc(m.codigo)}</div>
    <div class="grade g4" style="margin-bottom:16px">
      <div class="card kpi"><div class="ic t-azul">${ic("estoque")}</div><div><small>${esc(m.nome)}</small><b>${num(tot, 3)} ${esc(m.unidade)}</b><div class="sub">saldo total</div></div></div>
      <div class="card kpi"><div class="ic t-${tot < m.estoque_minimo ? "verm" : "verde"}">${ic("alerta")}</div><div><small>Estoque mínimo</small><b>${num(m.estoque_minimo, 3)}</b></div></div>
      <div class="card kpi"><div class="ic t-roxo">${ic("dinheiro")}</div><div><small>Valor unitário</small><b>${moeda(m.valor_unitario)}</b></div></div>
      <div class="card kpi"><div class="ic t-lar">${ic("fornecedores")}</div><div><small>Fornecedor principal</small><b style="font-size:15px;white-space:normal">${esc(m.fornecedores?.razao_social || "-")}</b></div></div></div>
    ${pode("estoque", "cadastrar") ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">${Object.entries(TIPOS).filter(([t]) => t !== "ajuste" || pode("estoque", "editar")).map(([t, [l]]) => `<button class="bt sec peq" data-mm="${t}">${l}</button>`).join("")}</div>` : ""}
    <div class="grade g2"><div class="card"><div class="ct"><h3>Saldo por depósito</h3></div>${tabela([{ l: "Depósito", pri: true, k: "deposito_nome" }, { l: "Quantidade", num: true, f: (r) => num(r.quantidade, 3) }], sal, { vazio: "Sem saldo." })}</div>
    <div class="card"><div class="ct"><h3>Histórico de preços</h3></div>${tabela([{ l: "Data", f: (r) => data(r.data) }, { l: "Valor", num: true, f: (r) => moeda(r.valor_unitario) }, { l: "Origem", k: "origem" }], pr, { vazio: "Sem registros de preço." })}</div></div>
    <div class="card" style="margin-top:16px"><div class="ct"><h3>Movimentações</h3></div>${tabela([{ l: "Data", f: (r) => data(r.data) }, { l: "Tipo", pri: true, f: (r) => tag(...TIPOS[r.tipo]) }, { l: "Qtd.", num: true, f: (r) => num(r.quantidade, 3) },
      { l: "De → para", f: (r) => `${esc(nomeDep(deps, r.deposito_origem))} → ${esc(nomeDep(deps, r.deposito_destino))}` }, { l: "Motivo", k: "motivo" }, { l: "Usuário", f: (r) => `${esc(r.usuario_nome)} · ${dataHora(r.criado_em)}` }], mov)}</div>`;
  c.querySelectorAll("[data-mm]").forEach((b) => b.onclick = () => movimentar(b.dataset.mm, id, recarregar));
}
