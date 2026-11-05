import { sb, S, esc, ic, num, data, hoje, somaDias, tag, pode, toast, msgErro, q, tabela, formulario, modal, funcionariosOp, obrasOp, linkArquivo, ir, dataHora, limparCache } from "../core.js";
import { listaRecurso } from "../crud.js";
import { pdf } from "../exportar.js";

export async function render(el, [aba = "epis"]) {
  const abas = [["epis", "EPIs"], ["entregas", "Entregas"], ["ficha", "Ficha por funcionário"], ["movimentos", "Movimentações"]];
  const [{ count: venc }, { count: prox }] = await Promise.all([
    sb.from("epis").select("id", { count: "exact", head: true }).eq("ativo", true).lt("validade_ca", hoje()),
    sb.from("epis").select("id", { count: "exact", head: true }).eq("ativo", true).gte("validade_ca", hoje()).lte("validade_ca", somaDias(hoje(), 30)),
  ]);
  el.innerHTML = `<div class="cab-pagina"><div><h1>EPI</h1><p>Equipamentos de proteção individual: estoque, CA e entregas aos funcionários.</p></div>
    <div class="botoes">${pode("epi", "cadastrar") ? `<button class="bt" id="bt-ent">${ic("usuario")}Entregar EPI</button>` : ""}</div></div>
    ${venc ? `<div class="faixa alerta">${ic("alerta")}<span><b>${venc} EPI(s) com CA vencido.</b> A entrega desses itens fica bloqueada até atualizar o CA.</span></div>` : ""}
    ${prox ? `<div class="faixa aviso">${ic("relogio")}<span><b>${prox} EPI(s)</b> com CA vencendo nos próximos 30 dias.</span></div>` : ""}
    <div class="abas">${abas.map(([k, l]) => `<button data-aba="${k}" class="${k === aba ? "on" : ""}">${l}</button>`).join("")}</div><div id="ep-aba"></div>`;
  el.querySelectorAll("[data-aba]").forEach((b) => b.onclick = () => ir("epi/" + b.dataset.aba));
  el.querySelector("#bt-ent")?.addEventListener("click", () => entregar(() => render(el, ["entregas"])));
  const c = el.querySelector("#ep-aba");
  await (ABAS[aba] || ABAS.epis)(c, () => render(el, [aba]));
}

const ABAS = {
  async epis(c, rec) {
    await listaRecurso(c, {
      titulo: "EPIs", singular: "EPI", tabela: "epis", modulo: "epi", novoTexto: "Novo EPI", busca: ["codigo", "nome", "ca", "fabricante"], ordem: ["nome", true],
      filtros: [{ k: "ativo", l: "Situação", op: [["true", "Ativos"], ["false", "Inativos"]], padrao: "true" },
        { k: "ca", l: "CA", op: [["venc", "CA vencido"], ["30", "Vence em 30 dias"]], aplicar: (q2, v) => v === "venc" ? q2.lt("validade_ca", hoje()) : q2.gte("validade_ca", hoje()).lte("validade_ca", somaDias(hoje(), 30)) }],
      colunas: [{ l: "EPI", pri: true, k: "nome", f: (r) => `<b>${esc(r.codigo)}</b> · ${esc(r.nome)}` }, { l: "Fabricante / modelo", v: (r) => [r.fabricante, r.modelo].filter(Boolean).join(" "), f: (r) => esc([r.fabricante, r.modelo].filter(Boolean).join(" ") || "-") },
        { l: "CA", k: "ca" }, { l: "Validade do CA", k: "validade_ca", tipo: "data", f: (r) => !r.validade_ca ? "-" : r.validade_ca < hoje() ? tag(data(r.validade_ca) + " vencido", "verm") : r.validade_ca <= somaDias(hoje(), 30) ? tag(data(r.validade_ca), "lar") : data(r.validade_ca) },
        { l: "Disponível", k: "quantidade", tipo: "num", num: true, f: (r) => `<b class="${+r.quantidade < +r.estoque_minimo ? "verm" : ""}">${num(r.quantidade, 3)}</b>` }, { l: "Mínimo", k: "estoque_minimo", tipo: "num", num: true, f: (r) => num(r.estoque_minimo, 3) }],
      acoesLinha: (r) => pode("epi", "editar") ? `<button class="bt sec peq" data-ent="${r.id}">Entrada</button><button class="bt sec peq" data-aj="${r.id}">Ajustar</button>` : "",
      aoCarregar: (cx, linhas) => {
        cx.querySelectorAll("[data-ent],[data-aj]").forEach((b) => b.onclick = () => {
          const r = linhas.find((x) => x.id == (b.dataset.ent || b.dataset.aj)), ent = !!b.dataset.ent;
          formulario({ titulo: `${ent ? "Entrada" : "Ajuste de inventário"} · ${r.nome}`, campos: [{ k: "q", l: ent ? "Quantidade recebida" : `Quantidade contada (atual: ${num(r.quantidade, 3)})`, t: "num", req: true, min: ent ? 0.001 : 0 }, { k: "m", l: "Motivo", req: true, s2: true, padrao: ent ? "Compra" : "Inventário físico" }],
            salvar: async (v) => { await q(sb.rpc("epi_movimentar", { p_epi: r.id, p_tipo: ent ? "entrada" : "ajuste", p_quantidade: v.q, p_motivo: v.m })); toast("Estoque de EPI atualizado.", "ok"); rec(); } });
        });
      },
      campos: [{ k: "codigo", l: "Código", req: true }, { k: "nome", l: "Nome do EPI", req: true }, { k: "fabricante", l: "Fabricante" }, { k: "modelo", l: "Modelo" },
        { k: "ca", l: "CA (Certificado de Aprovação)" }, { k: "validade_ca", l: "Validade do CA", t: "date" }, { k: "estoque_minimo", l: "Estoque mínimo", t: "num", min: 0 }, { k: "ativo", l: "Ativo", t: "check", padrao: true }],
      preparar: (v) => ({ codigo: v.codigo, nome: v.nome, fabricante: v.fabricante, modelo: v.modelo, ca: v.ca, validade_ca: v.validade_ca, estoque_minimo: v.estoque_minimo || 0, ativo: v.ativo }),
      padroes: () => ({ ativo: true }), permiteExcluir: false,
    });
  },
  async entregas(c, rec) {
    const [func, obras] = await Promise.all([funcionariosOp(), obrasOp(true)]);
    await listaRecurso(c, {
      titulo: "Entregas de EPI", fonte: "epi_entregas", modulo: "epi", semNovo: true, select: "*, epis(codigo,nome,ca), funcionarios(nome)", ordem: ["criado_em", false],
      filtros: [{ k: "funcionario_id", l: "Funcionário", op: func }, { k: "obra_id", l: "Obra", op: obras }, { k: "dev", l: "Situação", op: [["n", "Em uso"], ["s", "Devolvidos"]], aplicar: (q2, v) => v === "s" ? q2.not("data_devolucao", "is", null) : q2.is("data_devolucao", null) },
        { k: "de", l: "De", tipo: "data", aplicar: (q2, v) => q2.gte("data_entrega", v) }, { k: "ate", l: "Até", tipo: "data", aplicar: (q2, v) => q2.lte("data_entrega", v) }],
      colunas: [{ l: "Data", k: "data_entrega", tipo: "data", f: (r) => data(r.data_entrega) }, { l: "Funcionário", pri: true, v: (r) => r.funcionarios?.nome, f: (r) => esc(r.funcionarios?.nome) },
        { l: "EPI", v: (r) => r.epis?.nome, f: (r) => `${esc(r.epis?.nome)} <span class="mu peq">CA ${esc(r.epis?.ca || "-")}</span>` }, { l: "Qtd.", k: "quantidade", tipo: "num", num: true, f: (r) => num(r.quantidade, 3) },
        { l: "Entregue por", k: "responsavel_nome" }, { l: "Devolução", k: "data_devolucao", tipo: "data", f: (r) => data(r.data_devolucao) || "-" },
        { l: "Comprovante", v: (r) => r.assinatura_path ? "Assinado" : "Pendente", f: (r) => r.assinatura_path ? `<button class="bt sec peq" data-ass="${esc(r.assinatura_path)}">${ic("ok")}Ver assinatura</button>` : tag("Sem assinatura", "lar") }],
      acoesLinha: (r) => pode("epi", "editar") ? `${!r.assinatura_path ? `<button class="bt sec peq" data-assinar="${r.id}">Assinar</button>` : ""}${!r.data_devolucao ? `<button class="bt sec peq" data-dev="${r.id}">Devolver</button>` : ""}` : "",
      aoCarregar: (cx, linhas) => {
        cx.querySelectorAll("[data-ass]").forEach((b) => b.onclick = async () => window.open(await linkArquivo(b.dataset.ass, 600), "_blank"));
        cx.querySelectorAll("[data-assinar]").forEach((b) => b.onclick = () => assinatura(+b.dataset.assinar, rec));
        cx.querySelectorAll("[data-dev]").forEach((b) => b.onclick = () => formulario({ titulo: "Registrar devolução", campos: [{ k: "d", l: "Data da devolução", t: "date", req: true, padrao: hoje() }, { k: "r", l: "Retorna ao estoque (item em condições de uso)", t: "check", padrao: true, s2: true }],
          salvar: async (v) => { await q(sb.rpc("epi_devolver", { p_entrega: +b.dataset.dev, p_data: v.d, p_retorna_estoque: v.r })); toast("Devolução registrada.", "ok"); rec(); } }));
      },
    });
  },
  async ficha(c) {
    const func = await funcionariosOp();
    c.innerHTML = `<div class="card"><div class="filtros"><div class="campo" style="flex:1"><label>Funcionário</label><select class="inp" id="fi-f"><option value="">Selecione...</option>${func.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></div>
      ${pode("epi", "exportar") ? `<button class="bt sec peq" id="fi-pdf">${ic("pdf")}Ficha em PDF</button>` : ""}</div><div id="fi-l"><div class="vazio">Selecione um funcionário para ver o histórico individual de entregas.</div></div></div>`;
    let linhas = [];
    c.querySelector("#fi-f").onchange = async (e) => {
      if (!e.target.value) return;
      linhas = await q(sb.from("epi_entregas").select("*, epis(codigo,nome,ca,validade_ca)").eq("funcionario_id", e.target.value).order("data_entrega", { ascending: false }));
      c.querySelector("#fi-l").innerHTML = tabela([{ l: "Data", f: (r) => data(r.data_entrega) }, { l: "EPI", pri: true, f: (r) => esc(r.epis?.nome) }, { l: "CA", f: (r) => esc(r.epis?.ca || "-") },
        { l: "Qtd.", num: true, f: (r) => num(r.quantidade, 3) }, { l: "Entregue por", k: "responsavel_nome" }, { l: "Devolução", f: (r) => data(r.data_devolucao) || "-" }, { l: "Assinatura", f: (r) => r.assinatura_path ? tag("Assinado", "verde") : tag("Pendente", "lar") }], linhas, { vazio: "Nenhuma entrega para este funcionário." });
    };
    c.querySelector("#fi-pdf")?.addEventListener("click", () => {
      const nome = c.querySelector("#fi-f").selectedOptions[0]?.text; if (!linhas.length) return toast("Selecione um funcionário com entregas.");
      pdf("Ficha de entrega de EPI", [{ l: "Data", k: "data_entrega", tipo: "data" }, { l: "EPI", v: (r) => r.epis?.nome }, { l: "CA", v: (r) => r.epis?.ca }, { l: "Qtd.", k: "quantidade", tipo: "num" }, { l: "Entregue por", k: "responsavel_nome" }, { l: "Devolução", k: "data_devolucao", tipo: "data" }, { l: "Assinatura", v: (r) => (r.assinatura_path ? "Assinado digitalmente" : "Pendente") }], linhas,
        { info: [`Funcionário: ${nome}`, `Empresa: ${S.sessao.empresa.nome}`], paisagem: true });
    });
  },
  async movimentos(c) {
    await listaRecurso(c, {
      titulo: "Movimentações de EPI", fonte: "epi_movimentos", modulo: "epi", semNovo: true, select: "*, epis(codigo,nome)", ordem: ["criado_em", false],
      filtros: [{ k: "tipo", l: "Tipo", op: [["entrada", "Entrada"], ["entrega", "Entrega"], ["devolucao", "Devolução"], ["ajuste", "Ajuste"]] }],
      colunas: [{ l: "Data/hora", k: "criado_em", f: (r) => dataHora(r.criado_em), v: (r) => dataHora(r.criado_em) }, { l: "EPI", pri: true, v: (r) => r.epis?.nome, f: (r) => esc(r.epis?.nome) }, { l: "Tipo", k: "tipo" },
        { l: "Quantidade", k: "quantidade", tipo: "num", num: true, f: (r) => num(r.quantidade, 3) }, { l: "Saldo após", k: "saldo_apos", tipo: "num", num: true, f: (r) => num(r.saldo_apos, 3) }, { l: "Motivo", k: "motivo" }, { l: "Usuário", k: "usuario_nome" }],
    });
  },
};

async function entregar(ok) {
  const [epis, func, obras] = await Promise.all([q(sb.from("epis").select("id,codigo,nome,ca,validade_ca,quantidade").eq("ativo", true).order("nome")), funcionariosOp(), obrasOp()]);
  if (!func.length) return toast("Cadastre os funcionários no módulo Equipe primeiro.", "erro");
  formulario({ titulo: "Entregar EPI ao funcionário", campos: [
    { k: "func", l: "Funcionário", t: "select", op: func, req: true, numerico: true, s2: true },
    { k: "epi", l: "EPI", t: "select", op: epis.map((e) => [e.id, `${e.codigo} · ${e.nome} — disp. ${num(e.quantidade, 3)}${e.validade_ca && e.validade_ca < hoje() ? " (CA VENCIDO)" : ""}`]), req: true, numerico: true, s2: true },
    { k: "qtd", l: "Quantidade", t: "num", req: true, min: 0.001, padrao: 1 }, { k: "data", l: "Data da entrega", t: "date", req: true, padrao: hoje() },
    { k: "obra", l: "Obra", t: "select", op: obras, numerico: true }, { k: "obs", l: "Observações", t: "textarea", s2: true }],
    textoOk: "Registrar e coletar assinatura",
    salvar: async (v) => {
      const id = await q(sb.rpc("epi_entregar", { p_epi: v.epi, p_funcionario: v.func, p_quantidade: v.qtd, p_data: v.data, p_obra: v.obra || null, p_observacoes: v.obs }));
      limparCache(); setTimeout(() => assinatura(id, ok), 60);
    } });
}

// assinatura do funcionário na tela (dedo ou mouse) — vira o comprovante de recebimento
function assinatura(entregaId, ok) {
  const m = modal({ titulo: "Assinatura de recebimento do EPI", corpo: `<p class="mu" style="margin-top:0">Peça ao funcionário para assinar no quadro abaixo. Declaro ter recebido o(s) EPI(s) e o treinamento de uso.</p>
    <canvas class="assinatura-area" id="cv"></canvas><div class="form-erro oculto"></div>`,
    rodape: `<button class="bt sec" data-l>Limpar</button><button class="bt sec" data-d>Assinar depois</button><button class="bt verde" data-s>Salvar assinatura</button>` });
  const cv = m.el.querySelector("#cv"), r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  cv.width = r.width * dpr; cv.height = r.height * dpr;
  const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr); ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.strokeStyle = "#0b1f3a";
  let des = false, usou = false;
  const pos = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  cv.onpointerdown = (e) => { des = true; usou = true; cv.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); };
  cv.onpointermove = (e) => { if (!des) return; ctx.lineTo(...pos(e)); ctx.stroke(); };
  cv.onpointerup = () => { des = false; };
  m.el.querySelector("[data-l]").onclick = () => { ctx.clearRect(0, 0, cv.width, cv.height); usou = false; };
  m.el.querySelector("[data-d]").onclick = () => { m.fechar(); ok?.(); };
  m.el.querySelector("[data-s]").onclick = async () => {
    if (!usou) return toast("Colete a assinatura antes de salvar.", "erro");
    const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
    const caminho = `${S.sessao.empresa.id}/epi_entrega/${entregaId}/assinatura-${Date.now()}.png`;
    const e1 = (await sb.storage.from("anexos").upload(caminho, blob, { contentType: "image/png" })).error;
    const e2 = e1 || (await sb.rpc("epi_registrar_assinatura", { p_entrega: entregaId, p_caminho: caminho })).error;
    if (e2) { const b = m.el.querySelector(".form-erro"); b.textContent = msgErro(e2); b.classList.remove("oculto"); return; }
    m.fechar(); toast("Entrega registrada com assinatura.", "ok"); ok?.();
  };
}
