import { sb, S, esc, ic, moeda, data, hoje, inicioMes, fimMes, somaMeses, obrasOp, pode, tag, barra, msgErro, q } from "../core.js";
import { barras, linhas, rosca, comparativo, mesCurto, CORES } from "../graficos.js";

export const STATUS_OBRA = { planejamento: ["Planejamento", "cinza"], andamento: ["Em andamento", "azul"], atrasada: ["Atrasada", "verm"], pausada: ["Pausada", "lar"], concluida: ["Concluída", "verde"], cancelada: ["Cancelada", "cinza"] };

const st = { periodo: "mes", ini: inicioMes(), fim: fimMes(), obra: "" };

export async function render(el) {
  const obras = await obrasOp();
  const fin = pode("financeiro", "ver");
  el.innerHTML = `<div class="cab-pagina"><div><h1>Dashboard</h1><p>Olá, ${esc(S.sessao.membro.nome.split(" ")[0])}. Visão consolidada de ${esc(S.sessao.empresa.nome)}.</p></div>
    <div class="botoes" style="align-items:flex-end">
      <div class="campo"><label>Período</label><select class="inp" id="d-per">${[["mes", "Este mês"], ["3", "Últimos 3 meses"], ["6", "Últimos 6 meses"], ["12", "Últimos 12 meses"], ["ano", "Este ano"], ["pers", "Personalizado"]].map(([v, l]) => `<option value="${v}" ${st.periodo === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="campo ${st.periodo === "pers" ? "" : "oculto"}" id="d-datas" style="flex-direction:row;gap:6px"><input type="date" class="inp" id="d-ini" value="${st.ini}"><input type="date" class="inp" id="d-fim" value="${st.fim}"></div>
      <div class="campo"><label>Obra</label><select class="inp" id="d-obra"><option value="">Todas as obras</option>${obras.map(([v, l]) => `<option value="${v}" ${String(st.obra) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
    </div></div>
    <div id="d-corpo"><div class="vazio"><div class="spinner" style="margin:auto"></div></div></div>`;
  const aplicar = () => {
    const p = el.querySelector("#d-per").value; st.periodo = p;
    el.querySelector("#d-datas").classList.toggle("oculto", p !== "pers");
    if (p === "mes") { st.ini = inicioMes(); st.fim = fimMes(); }
    else if (p === "ano") { st.ini = hoje().slice(0, 4) + "-01-01"; st.fim = hoje().slice(0, 4) + "-12-31"; }
    else if (p === "pers") { st.ini = el.querySelector("#d-ini").value; st.fim = el.querySelector("#d-fim").value; }
    else { st.ini = inicioMes(somaMeses(hoje(), -(+p - 1))); st.fim = fimMes(); }
    st.obra = el.querySelector("#d-obra").value;
    carregar(el.querySelector("#d-corpo"), fin);
  };
  el.querySelectorAll("#d-per,#d-obra,#d-ini,#d-fim").forEach((i) => i.onchange = aplicar);
  aplicar();
}

async function carregar(el, fin) {
  try {
    const d = await q(sb.rpc("dashboard_resumo", { p_inicio: st.ini, p_fim: st.fim, p_obra: st.obra ? +st.obra : null }));
    const kpi = (i, cor, l, v, sub = "") => `<div class="card kpi"><div class="ic t-${cor}">${ic(i)}</div><div style="min-width:0"><small>${l}</small><b>${v}</b>${sub ? `<div class="sub">${sub}</div>` : ""}</div></div>`;
    const lucro = d.lucro_estimado;
    el.innerHTML = `
      <div class="grade g4" style="margin-bottom:16px">
        ${kpi("obras", "azul", "Obras ativas", d.obras_ativas, S.sessao.limites.obras ? `limite do plano: ${S.sessao.limites.obras}` : "")}
        ${kpi("compras", "roxo", "Ordens de compra", d.ocs, "no período")}
        ${kpi("notas", "azul", "Notas fiscais", d.nfs, "emitidas no período")}
        ${fin ? kpi("dinheiro", "verde", "Receita prevista", moeda(d.receita_prevista), "no período") : kpi("estoque", "lar", "Período", `${data(d.inicio)}`, `até ${data(d.fim)}`)}
        ${fin ? kpi("financeiro", "verm", "Despesas do período", moeda(d.despesas_periodo)) : ""}
        ${fin ? kpi("relatorios", lucro >= 0 ? "verde" : "verm", "Lucro estimado", `<span class="${lucro >= 0 ? "verde" : "verm"}">${moeda(lucro)}</span>`, "receitas − despesas") : ""}
        ${fin || pode("notas", "ver") ? kpi("alerta", "lar", "Contas a pagar", moeda(d.contas_pagar), "em aberto") : ""}
        ${fin ? kpi("dinheiro", "azul", "Contas a receber", moeda(d.contas_receber), "em aberto") : ""}
      </div>
      <div class="grade g-2-1" style="margin-bottom:16px">
        <div class="card"><div class="ct"><h3>Receitas x despesas (12 meses)</h3></div><div class="cc" id="g-rd"></div></div>
        <div class="card"><div class="ct"><h3>Despesas por categoria</h3></div><div class="cc" id="g-cat"></div></div>
      </div>
      <div class="grade g2" style="margin-bottom:16px">
        <div class="card"><div class="ct"><h3>Evolução financeira (saldo acumulado)</h3></div><div class="cc" id="g-evo"></div></div>
        <div class="card"><div class="ct"><h3>Compras realizadas por mês</h3></div><div class="cc" id="g-comp"></div></div>
      </div>
      <div class="grade g2" style="margin-bottom:16px">
        <div class="card"><div class="ct"><h3>Custos por obra</h3><span class="mu peq">orçamento x custo lançado</span></div><div class="cc" id="g-obra"></div></div>
        <div class="card"><div class="ct"><h3>Progresso das obras</h3></div><div class="cc" id="g-prog"></div></div>
      </div>
      <div class="card"><div class="ct"><h3>Obras em andamento</h3><a href="#obras" class="bt sec peq">Ver todas</a></div><div id="t-and"></div></div>`;
    const m = d.mensal || [], rot = m.map((x) => mesCurto(x.mes));
    if (fin) {
      barras(el.querySelector("#g-rd"), rot, [{ nome: "Receitas", cor: CORES[1], valores: m.map((x) => +x.receitas) }, { nome: "Despesas", cor: CORES[3], valores: m.map((x) => +x.despesas) }]);
      let ac = 0; linhas(el.querySelector("#g-evo"), rot, [{ nome: "Saldo acumulado", cor: CORES[0], valores: m.map((x) => (ac += +x.receitas - +x.despesas)) }]);
    } else {
      el.querySelector("#g-rd").innerHTML = `<div class="vazio">${ic("cadeado")}<div>Disponível para perfis com acesso ao Financeiro.</div></div>`;
      el.querySelector("#g-evo").innerHTML = el.querySelector("#g-rd").innerHTML;
    }
    rosca(el.querySelector("#g-cat"), (d.por_categoria || []).slice(0, 8).map((x) => ({ nome: x.categoria, valor: +x.valor })));
    barras(el.querySelector("#g-comp"), rot, [{ nome: "Compras (OCs)", cor: CORES[4], valores: m.map((x) => +x.compras) }]);
    comparativo(el.querySelector("#g-obra"), (d.por_obra || []).slice(0, 8).map((x) => ({ nome: x.obra, a: +x.orcamento, b: +x.custo })));
    const and = d.andamento || [];
    el.querySelector("#g-prog").innerHTML = and.length ? `<div style="display:grid;gap:12px">${and.slice(0, 8).map((o) => `<div><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><a href="#obras/${o.id}"><b>${esc(o.nome)}</b></a><span>${o.progresso}%</span></div>${barra(o.progresso, o.status === "atrasada" ? "verm" : o.progresso >= 100 ? "verde" : "")}</div>`).join("")}</div>` : '<div class="vazio">Nenhuma obra em andamento.</div>';
    el.querySelector("#t-and").innerHTML = and.length ? `<div class="tabela-wrap"><table class="tab resp"><thead><tr><th>Obra</th><th>Cliente</th><th>Responsável</th><th>Conclusão</th><th>Entrega prevista</th><th>Situação</th></tr></thead><tbody>${and.map((o) => {
      const [sl, sc] = STATUS_OBRA[o.status] || [o.status, "cinza"];
      return `<tr class="clic" onclick="location.hash='obras/${o.id}'"><td class="pri" data-l="Obra">${esc(o.codigo)} · ${esc(o.nome)}</td><td data-l="Cliente">${esc(o.cliente || "-")}</td><td data-l="Responsável">${esc(o.responsavel || "-")}</td><td data-l="Conclusão"><div style="display:flex;gap:8px;align-items:center;justify-content:flex-end">${barra(o.progresso)}<span>${o.progresso}%</span></div></td><td data-l="Entrega">${data(o.previsao) || "-"}</td><td data-l="Situação">${tag(sl, sc)}</td></tr>`;
    }).join("")}</tbody></table></div>` : '<div class="vazio">Nenhuma obra em andamento. <a href="#obras">Cadastre a primeira obra</a>.</div>';
  } catch (e) { el.innerHTML = `<div class="card"><div class="vazio verm">${esc(msgErro(e))}</div></div>`; }
}
