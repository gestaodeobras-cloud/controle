// =====================================================================
//  NÚCLEO: conexão, sessão, formatação, ícones, janelas e formulários
// =====================================================================
export const CFG = window.CONFIG || {};
export const sb = window.supabase
  ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

// estado global da sessão (preenchido após o login)
export const S = { sessao: null, user: null, obras: [], fornecedores: [], depositos: [] };

// ---------- utilidades ----------
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const num = (v, d = 2) => Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: d });
export const data = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");
export const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");
export const hoje = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
export const somaDias = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const somaMeses = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
export const inicioMes = (iso = hoje()) => iso.slice(0, 8) + "01";
export const fimMes = (iso = hoje()) => { const d = new Date(iso.slice(0, 8) + "01T12:00:00"); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.toISOString().slice(0, 10); };
export const docFmt = (d) => { d = String(d || "").replace(/\D/g, ""); if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"); if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4"); return d; };
export const iniciais = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
export const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

export function cpfValido(c) {
  c = String(c || "").replace(/\D/g, ""); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +c[9] && dv(10) === +c[10];
}
export function cnpjValido(c) {
  c = String(c || "").replace(/\D/g, ""); if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const dv = (n) => { const p = n === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]; let s = 0; for (let i = 0; i < n; i++) s += +c[i] * p[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === +c[12] && dv(13) === +c[13];
}
export const docValido = (d) => { d = String(d || "").replace(/\D/g, ""); return !d || (d.length === 11 ? cpfValido(d) : d.length === 14 ? cnpjValido(d) : false); };

// ---------- permissões (a verificação real acontece no banco) ----------
export const pode = (mod, acao = "ver") => !!S.sessao?.permissoes?.[mod]?.includes(acao);
export const ehAdmin = () => !!S.sessao?.admin_empresa;
export const temRecurso = (r) => !!S.sessao?.plano?.recursos?.includes(r);

// ---------- erros do servidor em linguagem simples ----------
export function msgErro(e) {
  const m = String(e?.message || e?.error_description || e || "");
  if (/row-level security|permission denied|42501|Sem permissão/i.test(m) || e?.code === "42501") return m.includes("permissão") && !/row-level/.test(m) ? m : "Você não tem permissão para esta ação.";
  if (e?.code === "23505" || /duplicate key/i.test(m)) return "Já existe um registro com esses dados (número/código/documento repetido).";
  if (e?.code === "23503" || /foreign key/i.test(m)) return "Este registro está vinculado a outros dados e não pode ser excluído. Use arquivar/desativar.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Sem conexão com o servidor. Verifique a internet.";
  if (/Invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
  if (/JWT|session/i.test(m)) return "Sua sessão expirou. Entre novamente.";
  return m || "Ocorreu um erro inesperado.";
}

// ---------- ícones (SVG próprios) ----------
const P = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  obras: '<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"/>',
  compras: '<path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7V5a3 3 0 016 0v2"/>',
  notas: '<path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 12h7M9 16h7"/>',
  estoque: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  epi: '<path d="M4 15a8 8 0 0116 0"/><path d="M2 15h20v2H2zM12 7v4"/>',
  diario: '<path d="M5 3h12a2 2 0 012 2v16H7a2 2 0 01-2-2z"/><path d="M5 17a2 2 0 012-2h12M9 7h6M9 11h4"/>',
  financeiro: '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20M6 15h4"/>',
  relatorios: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  fornecedores: '<path d="M2 8h12v9H2zM14 11h4l3 3v3h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  equipe: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 4.5a3.5 3.5 0 010 7M22 20c0-3-1.8-5-4.5-5.7"/>',
  configuracoes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"/>',
  sair: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
  plataforma: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  sino: '<path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  editar: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4z"/>',
  lixo: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  arquivo: '<path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/>',
  pdf: '<path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5"/><path d="M9 15h1.5a1.5 1.5 0 000-3H9v5M15 12v5M15 12h2M15 14.5h1.5"/>',
  excel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8l8 8M16 8l-8 8"/>',
  anexo: '<path d="M21.4 11l-9.2 9.2a6 6 0 01-8.5-8.5l9.2-9.2a4 4 0 015.7 5.7l-9.2 9.2a2 2 0 01-2.8-2.8l8.5-8.5"/>',
  camera: '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>',
  ok: '<path d="M20 6L9 17l-5-5"/>',
  alerta: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  dinheiro: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
  seta: '<path d="M15 18l-6-6 6-6"/>',
  troca: '<path d="M4 8h13M13 4l4 4-4 4M20 16H7M11 12l-4 4 4 4"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  cadeado: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  impressora: '<path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  caminhao: '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  relogio: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
};
export const ic = (n, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${P[n] || P.info}</svg>`;

// ---------- avisos rápidos ----------
export function toast(msg, tipo = "") {
  const d = document.createElement("div");
  d.className = "toast " + tipo;
  d.innerHTML = `${ic(tipo === "erro" ? "alerta" : tipo === "ok" ? "ok" : "info")}<span>${esc(msg)}</span>`;
  d.querySelector("svg").style.cssText = "width:18px;height:18px;flex:none;margin-top:1px";
  $("#toasts").appendChild(d);
  setTimeout(() => d.remove(), tipo === "erro" ? 6500 : 3500);
}

// ---------- janelas ----------
export function modal({ titulo, corpo = "", rodape = "", tamanho = "" }) {
  const f = document.createElement("div");
  f.className = "modal-fundo";
  f.innerHTML = `<div class="modal ${tamanho}" role="dialog" aria-modal="true"><div class="mh"><h3>${esc(titulo)}</h3><button class="fechar" aria-label="Fechar">${ic("x")}</button></div><div class="mb">${corpo}</div>${rodape ? `<div class="mf">${rodape}</div>` : ""}</div>`;
  document.body.appendChild(f);
  const fechar = () => { f.remove(); document.removeEventListener("keydown", esc_); };
  const esc_ = (e) => { if (e.key === "Escape") fechar(); };
  document.addEventListener("keydown", esc_);
  f.querySelector(".fechar").onclick = fechar;
  f.addEventListener("mousedown", (e) => { if (e.target === f) fechar(); });
  return { el: f, corpo: f.querySelector(".mb"), fechar };
}

export function confirmar(msg, { titulo = "Confirmar", ok = "Confirmar", perigo = false } = {}) {
  return new Promise((res) => {
    const m = modal({ titulo, corpo: `<p style="margin:0">${esc(msg)}</p>`, tamanho: "estreita",
      rodape: `<button class="bt sec" data-n>Cancelar</button><button class="bt ${perigo ? "verm" : ""}" data-s>${esc(ok)}</button>` });
    m.el.querySelector("[data-n]").onclick = () => { m.fechar(); res(false); };
    m.el.querySelector("[data-s]").onclick = () => { m.fechar(); res(true); };
    m.el.querySelector(".fechar").addEventListener("click", () => res(false));
  });
}

// ---------- construtor de formulários ----------
// campo: { k, l, t:'text|email|tel|num|money|date|select|textarea|check|pct|password', op:[[v,l]], req, ajuda, s2, min, max, ph, dis }
export function camposHTML(campos, v = {}) {
  return `<div class="form-grade">${campos.map((c) => {
    if (c.t === "secao") return `<div class="s2" style="margin-top:6px"><b>${esc(c.l)}</b></div>`;
    const val = v[c.k] ?? c.padrao ?? "";
    const id = "f_" + c.k;
    let inp;
    if (c.t === "select") {
      inp = `<select id="${id}" name="${c.k}" ${c.dis ? "disabled" : ""}>${c.vazio !== false ? `<option value="">${esc(c.vazio || "Selecione...")}</option>` : ""}${(c.op || []).map((o) => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${String(ov) === String(val) ? "selected" : ""}>${esc(ol)}</option>`; }).join("")}</select>`;
    } else if (c.t === "textarea") {
      inp = `<textarea id="${id}" name="${c.k}" rows="${c.linhas || 3}" ${c.dis ? "disabled" : ""} placeholder="${esc(c.ph || "")}">${esc(val)}</textarea>`;
    } else if (c.t === "check") {
      return `<div class="campo check ${c.s2 ? "s2" : ""}"><input type="checkbox" id="${id}" name="${c.k}" ${val ? "checked" : ""}><label for="${id}" style="color:var(--tx)">${esc(c.l)}</label></div>`;
    } else {
      const tipo = { date: "date", email: "email", tel: "tel", password: "password", num: "text", money: "text", pct: "number" }[c.t] || "text";
      const mostra = c.t === "money" && val !== "" ? Number(val).toFixed(2).replace(".", ",") : c.t === "num" && val !== "" ? String(val).replace(".", ",") : val;
      inp = `<input id="${id}" name="${c.k}" type="${tipo}" ${["num", "money"].includes(c.t) ? 'inputmode="decimal"' : ""} ${c.t === "pct" ? 'min="0" max="100"' : ""} value="${esc(mostra)}" placeholder="${esc(c.ph || (c.t === "money" ? "0,00" : ""))}" ${c.dis ? "disabled" : ""} autocomplete="${c.t === "password" ? "new-password" : "off"}">`;
    }
    return `<div class="campo ${c.s2 ? "s2" : ""}" data-c="${c.k}"><label for="${id}">${esc(c.l)}${c.req ? ' <span class="req">*</span>' : ""}</label>${inp}${c.ajuda ? `<span class="ajuda">${esc(c.ajuda)}</span>` : ""}</div>`;
  }).join("")}</div>`;
}

export const lerNumero = (s) => {
  s = String(s ?? "").trim().replace(/[R$\s]/g, "");
  if (s === "") return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s); return isFinite(n) ? n : NaN;
};

export function lerCampos(el, campos) {
  const v = {}, erros = {};
  for (const c of campos) {
    if (c.t === "secao") continue;
    const i = el.querySelector(`[name="${c.k}"]`); if (!i) continue;
    let x = c.t === "check" ? i.checked : i.value.trim();
    if (["num", "money", "pct"].includes(c.t)) {
      if (x === "") x = null; else { x = lerNumero(x); if (Number.isNaN(x)) erros[c.k] = "Número inválido"; }
      if (x != null && c.min != null && x < c.min) erros[c.k] = `Mínimo ${c.min}`;
      if (x != null && c.max != null && x > c.max) erros[c.k] = `Máximo ${c.max}`;
    } else if (x === "") x = null;
    if (c.req && (x === null || x === "")) erros[c.k] = "Obrigatório";
    if (c.t === "email" && x && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x)) erros[c.k] = "E-mail inválido";
    if (c.valida && x != null && !erros[c.k]) { const r = c.valida(x); if (r) erros[c.k] = r; }
    if (c.t === "select" && x != null && c.numerico) x = Number(x);
    v[c.k] = x;
  }
  return { v, erros };
}

export function mostrarErros(el, erros) {
  el.querySelectorAll(".campo.erro").forEach((c) => { c.classList.remove("erro"); c.querySelector(".msg-erro")?.remove(); });
  for (const [k, m] of Object.entries(erros)) {
    const c = el.querySelector(`[data-c="${k}"]`); if (!c) continue;
    c.classList.add("erro"); c.insertAdjacentHTML("beforeend", `<span class="msg-erro">${esc(m)}</span>`);
  }
  const p = el.querySelector(".campo.erro input,.campo.erro select,.campo.erro textarea"); p?.focus();
}

// abre um formulário em janela; salvar(v) deve lançar erro ou retornar
export function formulario({ titulo, campos, valores = {}, salvar, tamanho = "", textoOk = "Salvar", aoAbrir, extra = "" }) {
  const m = modal({ titulo, tamanho, corpo: `<form novalidate>${camposHTML(campos, valores)}${extra}<div class="form-erro oculto"></div><button type="submit" class="oculto"></button></form>`,
    rodape: `<button class="bt sec" data-cancelar>Cancelar</button><button class="bt" data-salvar>${esc(textoOk)}</button>` });
  const form = m.el.querySelector("form"), btn = m.el.querySelector("[data-salvar]"), caixaErro = m.el.querySelector(".form-erro");
  m.el.querySelector("[data-cancelar]").onclick = m.fechar;
  const enviar = async (e) => {
    e?.preventDefault();
    const { v, erros } = lerCampos(form, campos);
    mostrarErros(form, erros);
    if (Object.keys(erros).length) return;
    btn.disabled = true; btn.innerHTML = '<span class="spinner peq"></span> Salvando...'; caixaErro.classList.add("oculto");
    try { await salvar(v, m); m.fechar(); }
    catch (err) { caixaErro.textContent = msgErro(err); caixaErro.classList.remove("oculto"); }
    finally { btn.disabled = false; btn.textContent = textoOk; }
  };
  form.onsubmit = enviar; btn.onclick = enviar;
  setTimeout(() => form.querySelector("input:not([type=checkbox]),select,textarea")?.focus(), 60);
  aoAbrir?.(m, form);
  return m;
}

// ---------- tabela responsiva ----------
// colunas: [{l, k|f(row), num:bool, pri:bool}]
export function tabela(colunas, linhas, { clique, rodape, vazio = "Nenhum registro encontrado." } = {}) {
  if (!linhas.length) return `<div class="vazio">${ic("arquivo")}<div>${esc(vazio)}</div></div>`;
  return `<div class="tabela-wrap"><table class="tab resp"><thead><tr>${colunas.map((c) => `<th class="${c.num ? "num" : ""}">${esc(c.l)}</th>`).join("")}</tr></thead><tbody>${linhas.map((r, i) =>
    `<tr ${clique ? `class="clic" data-i="${i}"` : ""}>${colunas.map((c) => `<td data-l="${esc(c.l)}" class="${c.num ? "num" : ""} ${c.pri ? "pri" : ""}">${c.f ? c.f(r) : esc(r[c.k])}</td>`).join("")}</tr>`).join("")}</tbody>${rodape ? `<tfoot><tr>${rodape.map((x) => `<td>${x ?? ""}</td>`).join("")}</tr></tfoot>` : ""}</table></div>`;
}
export function ligarCliques(el, linhas, fn) {
  el.querySelectorAll("tr.clic").forEach((tr) => tr.addEventListener("click", (e) => { if (e.target.closest("button,a,input")) return; fn(linhas[+tr.dataset.i]); }));
}

export const tag = (txt, cor = "azul") => `<span class="tag ${cor}">${esc(txt)}</span>`;
export const barra = (pct, cor = "") => `<div class="barra ${cor}"><i style="width:${Math.max(0, Math.min(100, pct || 0))}%"></i></div>`;
export const carregando = () => `<div class="vazio"><div class="spinner" style="margin:0 auto 8px"></div>Carregando...</div>`;

// ---------- consultas com tratamento de erro ----------
export async function q(promessa) {
  const { data, error, count } = await promessa;
  if (error) throw error;
  return count != null ? { data, count } : data;
}

// listas auxiliares (obras, fornecedores, depósitos) com cache curto
const cache = {};
export async function lista(nome, consulta, ttl = 60000) {
  const c = cache[nome];
  if (c && Date.now() - c.t < ttl) return c.v;
  const v = await q(consulta());
  cache[nome] = { t: Date.now(), v };
  return v;
}
export const limparCache = (nome) => { if (nome) delete cache[nome]; else Object.keys(cache).forEach((k) => delete cache[k]); };
export const obrasOp = async (todas = false) => (await lista("obras", () => sb.from("obras").select("id,codigo,nome,status,arquivada").order("nome")))
  .filter((o) => todas || !o.arquivada).map((o) => [o.id, `${o.codigo} - ${o.nome}`]);
export const fornecedoresOp = async () => (await lista("fornecedores", () => sb.from("fornecedores").select("id,razao_social,nome_fantasia,documento,ativo").order("razao_social")))
  .filter((f) => f.ativo).map((f) => [f.id, f.nome_fantasia || f.razao_social]);
export const depositosOp = async () => (await lista("depositos", () => sb.from("depositos").select("id,nome,obra_id,ativo").order("nome")))
  .filter((d) => d.ativo).map((d) => [d.id, d.nome]);
export const funcionariosOp = async () => (await lista("funcionarios", () => sb.rpc("funcionarios_basico")))
  .filter((f) => f.situacao !== "desligado").map((f) => [f.id, f.nome + (f.funcao ? ` (${f.funcao})` : "")]);

// ---------- navegação ----------
export const ir = (rota) => { if (location.hash === "#" + rota) window.dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = rota; };

// ---------- anexos (Storage privado) ----------
export async function enviarArquivo(entidade, entidadeId, arquivo, categoria = "outro") {
  if (arquivo.size > 10 * 1024 * 1024) throw new Error(`"${arquivo.name}" passa de 10 MB.`);
  const ext = (arquivo.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const caminho = `${S.sessao.empresa.id}/${entidade}/${entidadeId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  let tipo = arquivo.type || (ext === "xml" ? "application/xml" : ext === "pdf" ? "application/pdf" : "");
  const { error } = await sb.storage.from("anexos").upload(caminho, arquivo, { contentType: tipo, upsert: false });
  if (error) throw new Error(/mime|type/i.test(error.message) ? "Tipo de arquivo não permitido (use foto, PDF ou XML)." : error.message);
  const { error: e2 } = await sb.from("anexos").insert({ entidade, entidade_id: entidadeId, categoria, nome: arquivo.name, caminho, tipo_mime: tipo, tamanho: arquivo.size });
  if (e2) { await sb.storage.from("anexos").remove([caminho]); throw e2; }
  return caminho;
}
export async function linkArquivo(caminho, segundos = 3600) {
  const { data: d, error } = await sb.storage.from("anexos").createSignedUrl(caminho, segundos);
  if (error) throw error; return d.signedUrl;
}

// compacta fotos grandes do celular antes de enviar (economiza internet e espaço)
export async function reduzirImagem(arquivo, max = 1600, qual = 0.82) {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type) || arquivo.size < 400 * 1024) return arquivo;
  try {
    const bmp = await createImageBitmap(arquivo);
    const esc_ = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * esc_); c.height = Math.round(bmp.height * esc_);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", qual));
    return blob ? new File([blob], arquivo.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : arquivo;
  } catch { return arquivo; }
}
