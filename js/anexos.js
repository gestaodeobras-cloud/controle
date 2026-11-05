// Componente de anexos (PDF, fotos, XML, boletos, comprovantes) com armazenamento privado
import { sb, esc, ic, toast, msgErro, pode, confirmar, enviarArquivo, linkArquivo, reduzirImagem, dataHora, q } from "./core.js";

const MOD = { obra: "obras", oc: "compras", nf: "notas", diario: "diario", epi_entrega: "epi", lancamento: "financeiro", fornecedor: "fornecedores" };
const CAT = { foto: "Foto", pdf: "PDF", xml: "XML fiscal", boleto: "Boleto", comprovante: "Comprovante de pagamento", documento: "Documento", outro: "Outro" };

export async function anexos(el, entidade, id, { categorias = Object.keys(CAT), titulo = "Anexos", fotos = false } = {}) {
  const mod = MOD[entidade];
  const podeEnviar = pode(mod, "cadastrar"), podeApagar = pode(mod, "excluir");
  async function desenhar() {
    const lst = await q(sb.from("anexos").select("*").eq("entidade", entidade).eq("entidade_id", id).order("criado_em", { ascending: false }));
    const imgs = lst.filter((a) => /^image\//.test(a.tipo_mime || ""));
    const outros = lst.filter((a) => !/^image\//.test(a.tipo_mime || ""));
    el.innerHTML = `<div class="card"><div class="ct"><h3>${esc(titulo)}</h3>${podeEnviar ? `<div style="display:flex;gap:6px;flex-wrap:wrap">
        <select class="inp" style="height:32px;width:auto" data-cat>${categorias.map((c) => `<option value="${c}">${CAT[c]}</option>`).join("")}</select>
        <label class="bt peq" style="cursor:pointer">${ic("anexo")}Anexar<input type="file" multiple hidden data-arq accept="image/*,application/pdf,.xml"></label>
        ${fotos ? `<label class="bt sec peq" style="cursor:pointer">${ic("camera")}Câmera<input type="file" hidden data-cam accept="image/*" capture="environment"></label>` : ""}</div>` : ""}</div>
      <div class="cc">${!lst.length ? '<div class="mu">Nenhum arquivo anexado.</div>' : ""}
        ${imgs.length ? `<div class="galeria" style="margin-bottom:12px">${imgs.map((a) => `<a href="#" data-abrir="${a.id}"><img data-img="${esc(a.caminho)}" alt="${esc(a.nome)}"><small>${esc(dataHora(a.criado_em))}</small></a>`).join("")}</div>` : ""}
        <div style="display:grid;gap:8px">${outros.map((a) => `<div class="anexo">${ic(a.categoria === "xml" ? "arquivo" : "pdf")}<span class="nm"><b>${esc(a.nome)}</b><br><small class="mu">${CAT[a.categoria] || ""} · ${esc(dataHora(a.criado_em))}</small></span>
          <button class="bt sec peq" data-abrir="${a.id}">Abrir</button>${podeApagar ? `<button class="bt sec peq" data-del="${a.id}" title="Excluir">${ic("lixo")}</button>` : ""}</div>`).join("")}</div>
      </div></div>`;
    // miniaturas
    el.querySelectorAll("[data-img]").forEach(async (img) => { try { img.src = await linkArquivo(img.dataset.img); } catch { /* */ } });
    el.querySelectorAll("[data-abrir]").forEach((b) => b.onclick = async (e) => {
      e.preventDefault(); const a = lst.find((x) => x.id == b.dataset.abrir);
      try { window.open(await linkArquivo(a.caminho, 600), "_blank"); } catch (er) { toast(msgErro(er), "erro"); }
    });
    el.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
      const a = lst.find((x) => x.id == b.dataset.del);
      if (!(await confirmar(`Excluir o arquivo "${a.nome}"?`, { perigo: true, ok: "Excluir" }))) return;
      const { error } = await sb.from("anexos").delete().eq("id", a.id);
      if (error) return toast(msgErro(error), "erro");
      await sb.storage.from("anexos").remove([a.caminho]); desenhar();
    });
    const enviar = async (files) => {
      const cat = el.querySelector("[data-cat]")?.value || "outro";
      for (const f0 of files) {
        try {
          const f = await reduzirImagem(f0);
          const c = /^image\//.test(f.type) && !["boleto", "comprovante"].includes(cat) ? "foto" : f.name.toLowerCase().endsWith(".xml") ? "xml" : cat;
          await enviarArquivo(entidade, id, f, c);
        } catch (er) { toast(msgErro(er), "erro"); }
      }
      toast("Arquivo(s) enviado(s).", "ok"); desenhar();
    };
    el.querySelector("[data-arq]")?.addEventListener("change", (e) => enviar([...e.target.files]));
    el.querySelector("[data-cam]")?.addEventListener("change", (e) => enviar([...e.target.files]));
  }
  try { await desenhar(); } catch (e) { el.innerHTML = `<div class="card"><div class="cc verm">${esc(msgErro(e))}</div></div>`; }
}
