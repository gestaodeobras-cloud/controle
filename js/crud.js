// Motor genérico de listas + cadastro (listar, filtrar, paginar, criar, editar, excluir, exportar)
import { sb, esc, ic, tabela, ligarCliques, formulario, confirmar, toast, msgErro, pode, carregando, limparCache, debounce } from "./core.js";
import { excel, pdf } from "./exportar.js";

const POR_PAGINA = 25;

export async function listaRecurso(el, cfg) {
  const st = { pag: 0, busca: "", f: {} };
  const ops = {};
  for (const f of cfg.filtros || []) {
    ops[f.k] = typeof f.op === "function" ? await f.op() : f.op;
    if (f.padrao !== undefined) st.f[f.k] = f.padrao;
  }
  const podeCad = cfg.semNovo ? false : pode(cfg.modulo, "cadastrar");
  const podeExp = pode(cfg.modulo, "exportar");

  el.innerHTML = `<div class="card">
    <div class="filtros">
      ${cfg.busca ? `<div class="campo busca"><label>Pesquisar</label><input class="inp" data-busca placeholder="${esc(cfg.dicaBusca || "Digite para pesquisar...")}"></div>` : ""}
      ${(cfg.filtros || []).map((f) => f.tipo === "data"
        ? `<div class="campo"><label>${esc(f.l)}</label><input type="date" class="inp" data-f="${f.k}" value="${esc(st.f[f.k] || "")}"></div>`
        : f.tipo === "check" ? `<label class="campo check" style="height:38px"><input type="checkbox" data-f="${f.k}" ${st.f[f.k] ? "checked" : ""}><span>${esc(f.l)}</span></label>`
        : `<div class="campo"><label>${esc(f.l)}</label><select class="inp" data-f="${f.k}"><option value="">${esc(f.todos || "Todos")}</option>${(ops[f.k] || []).map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(st.f[f.k] ?? "") === String(v) ? "selected" : ""}>${esc(l)}</option>`; }).join("")}</select></div>`).join("")}
      <div style="display:flex;gap:8px;margin-left:auto">
        ${podeExp ? `<button class="bt sec peq" data-xls title="Exportar Excel">${ic("excel")}Excel</button><button class="bt sec peq" data-pdf title="Exportar PDF">${ic("pdf")}PDF</button>` : ""}
        ${podeCad ? `<button class="bt peq" data-novo>${ic("mais")}${esc(cfg.novoTexto || "Novo")}</button>` : ""}
      </div>
    </div>
    <div data-lista>${carregando()}</div>
    <div class="paginacao" data-pag></div>
  </div>`;

  const montar = (sel = cfg.select || "*", contar = true) => {
    let qy = sb.from(cfg.fonte || cfg.tabela).select(sel, contar ? { count: "exact" } : undefined);
    if (cfg.fixo) qy = cfg.fixo(qy);
    if (st.busca && cfg.busca) {
      const t = st.busca.replace(/[,()%]/g, " ").trim();
      if (t) qy = qy.or(cfg.busca.map((c) => `${c}.ilike.%${t}%`).join(","));
    }
    for (const f of cfg.filtros || []) {
      const v = st.f[f.k];
      if (v === "" || v == null || v === false) continue;
      qy = f.aplicar ? f.aplicar(qy, v) : qy.eq(f.coluna || f.k, v);
    }
    const [col, asc] = cfg.ordem || ["id", false];
    qy = qy.order(col, { ascending: asc, nullsFirst: false });
    if (cfg.ordem2) qy = qy.order(cfg.ordem2[0], { ascending: cfg.ordem2[1] });
    return qy;
  };

  let linhas = [];
  async function carregar() {
    const caixa = el.querySelector("[data-lista]");
    caixa.innerHTML = carregando();
    try {
      const { data, error, count } = await montar().range(st.pag * POR_PAGINA, st.pag * POR_PAGINA + POR_PAGINA - 1);
      if (error) throw error;
      linhas = data;
      const cols = [...cfg.colunas];
      if (cfg.acoesLinha) cols.push({ l: "", f: (r) => `<div style="display:flex;gap:6px;justify-content:flex-end">${cfg.acoesLinha(r)}</div>` });
      caixa.innerHTML = tabela(cols, data, { clique: !!(cfg.aoClicar || cfg.campos), vazio: cfg.vazio, rodape: cfg.rodape?.(data) });
      ligarCliques(caixa, data, (r) => cfg.aoClicar ? cfg.aoClicar(r) : editar(r));
      cfg.aoCarregar?.(caixa, data);
      const tot = count ?? data.length, pags = Math.max(1, Math.ceil(tot / POR_PAGINA));
      el.querySelector("[data-pag]").innerHTML = `<span class="mu peq">${tot} registro(s)</span><div style="display:flex;gap:6px;align-items:center">
        <button class="bt sec peq" data-ant ${st.pag === 0 ? "disabled" : ""}>Anterior</button><span class="peq">${st.pag + 1} de ${pags}</span>
        <button class="bt sec peq" data-prox ${st.pag + 1 >= pags ? "disabled" : ""}>Próxima</button></div>`;
      el.querySelector("[data-ant]").onclick = () => { st.pag--; carregar(); };
      el.querySelector("[data-prox]").onclick = () => { st.pag++; carregar(); };
    } catch (e) { caixa.innerHTML = `<div class="vazio verm">${esc(msgErro(e))}</div>`; }
  }

  async function editar(r) {
    if (r && cfg.podeEditar && !cfg.podeEditar(r)) return;
    if (r && !pode(cfg.modulo, "editar")) return toast("Você tem acesso somente para visualizar.");
    const campos = typeof cfg.campos === "function" ? await cfg.campos(r) : cfg.campos;
    const exc = r && pode(cfg.modulo, "excluir") && cfg.permiteExcluir !== false;
    const m = formulario({
      titulo: r ? `Editar ${cfg.singular || ""}` : `${cfg.novoTexto || "Novo"}`, campos, valores: r || cfg.padroes?.() || {}, tamanho: cfg.tamanho || "",
      salvar: async (v) => {
        if (cfg.validar) { const e = cfg.validar(v, r); if (e) throw new Error(e); }
        const dados = cfg.preparar ? cfg.preparar(v, r) : v;
        const res = r ? await sb.from(cfg.tabela).update(dados).eq(cfg.pk || "id", r[cfg.pk || "id"]).select().single()
                      : await sb.from(cfg.tabela).insert(dados).select().single();
        if (res.error) throw res.error;
        limparCache(cfg.cache); toast(r ? "Alterações salvas." : "Cadastro realizado.", "ok");
        await cfg.aposSalvar?.(res.data, !r);
        carregar();
      },
    });
    if (exc) {
      const b = document.createElement("button"); b.className = "bt verm"; b.style.marginRight = "auto"; b.innerHTML = ic("lixo") + "Excluir";
      m.el.querySelector(".mf").prepend(b);
      b.onclick = async () => {
        if (!(await confirmar(`Excluir este registro definitivamente?`, { perigo: true, ok: "Excluir" }))) return;
        const { error } = await sb.from(cfg.tabela).delete().eq(cfg.pk || "id", r[cfg.pk || "id"]);
        if (error) return toast(msgErro(error), "erro");
        m.fechar(); limparCache(cfg.cache); toast("Registro excluído."); carregar();
      };
    }
  }

  async function exportar(tipo) {
    try {
      const { data, error } = await montar(cfg.select || "*", false).limit(5000);
      if (error) throw error;
      const cols = cfg.exportar?.colunas || cfg.colunas.filter((c) => c.k || c.v).map((c) => ({ l: c.l, k: c.k, v: c.v, tipo: c.tipo }));
      const tit = cfg.exportar?.titulo || cfg.titulo;
      tipo === "pdf" ? pdf(tit, cols, data, { totais: cfg.exportar?.totais?.(data) }) : excel(tit, cols, data);
    } catch (e) { toast(msgErro(e), "erro"); }
  }

  const buscar = debounce((v) => { st.busca = v; st.pag = 0; carregar(); }, 350);
  el.querySelector("[data-busca]")?.addEventListener("input", (e) => buscar(e.target.value));
  el.querySelectorAll("[data-f]").forEach((i) => i.addEventListener("change", () => { st.f[i.dataset.f] = i.type === "checkbox" ? i.checked : i.value; st.pag = 0; carregar(); }));
  el.querySelector("[data-novo]")?.addEventListener("click", () => cfg.aoNovo ? cfg.aoNovo() : editar(null));
  el.querySelector("[data-xls]")?.addEventListener("click", () => exportar("xls"));
  el.querySelector("[data-pdf]")?.addEventListener("click", () => exportar("pdf"));
  await carregar();
  return { recarregar: carregar, editar };
}
