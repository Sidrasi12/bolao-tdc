/* =====================================================================
   BOLÃO NFL — APURAÇÃO DA PRÉ-TEMPORADA (tela de Administração)
   Requer: pre-temporada-core.js carregado antes deste arquivo.
   Uso: <div id="pre-temporada-admin"></div> na página de Administração.
   ===================================================================== */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, writeBatch, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
 
/* =====================================================================
   CONFIGURAÇÃO — ajuste aqui conforme a estrutura do seu Firestore
   ===================================================================== */
const CONFIG = {
  TEMPORADA: 2026,
  CONTAINER_ID: 'pre-temporada-admin',
 
  // Coleções existentes no site
  COLECAO_USUARIOS: 'users',
  COLECAO_PALPITES_PRE: 'preseason_predictions',
 
  // Coleções novas criadas por esta atualização
  COLECAO_RESULTADOS: 'preseason_results',   // documento único: {TEMPORADA}
  COLECAO_PONTUACAO: 'preseason_scores',     // um documento por participante
 
  // Se o ranking ler a coluna "Pré" de um campo do documento do usuário,
  // informe o nome do campo aqui (ex.: 'preseasonPoints'). Use null para não gravar.
  CAMPO_PONTOS_NO_USUARIO: null,
 
  // Quem é participante ativo
  participanteAtivo: (u) => u.active !== false && u.ativo !== false,
 
  // Nome exibido do participante
  nomeParticipante: (id, u) => u.name || u.nome || u.nickname || u.apelido || u.displayName || u.email || id,
 
  // Lê um documento de palpite da pré-temporada e devolve no formato padrão.
  // Times podem vir como sigla (KC, WAS/WSH), apelido (Chiefs), nome completo ou ID da ESPN.
  // As divisões podem vir como "AFC East", "afc_east", "AFCEast" etc.
  lerPalpite: (id, d) => ({
    uid: d.userId || d.uid || id,
    campeao: d.sbChampion ?? d.campeao ?? d.campeaoSuperBowl,
    vice: d.sbRunnerUp ?? d.vice ?? d.viceSuperBowl,
    divisoes: d.divisionChampions ?? d.campeoesDivisao ?? d.divisoes ?? {},
    wildCards: d.wildCards ?? d.wildcards ?? [],
    pior: d.worstRecord ?? d.piorCampanha ?? d.pior,
    mvp: d.mvp ?? d.MVP ?? ''
  })
};
 
/* ===================================================================== */
const C = window.PreTemporadaCore;
const ESPN_CLASSIFICACAO = `https://site.api.espn.com/apis/v2/sports/football/nfl/standings?season=${CONFIG.TEMPORADA}&seasontype=2`;
const ESPN_SEMANA18 = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=18&dates=${CONFIG.TEMPORADA}`;
 
let db, auth, usuarioAtual = null;
let estado = { participantes: [], palpites: [], resultado: {}, apuracao: null, espn: null };
 
function iniciarFirebase() {
  const config = {
    apiKey: "AIzaSyC-iahORkmDIPdNbX2Xv8EMZGCuBURzJto",
    authDomain: "dudabolaoaf.firebaseapp.com",
    projectId: "dudabolaoaf",
    storageBucket: "dudabolaoaf.firebasestorage.app",
    messagingSenderId: "581366482052",
    appId: "1:581366482052:web:743cd9db52ee56b55f6ed1"
  };
  const app = getApps().length ? getApps()[0] : initializeApp(config);
  db = getFirestore(app);
  auth = getAuth(app);
}
 
/* ---------------- utilitários ---------------- */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toFixed(2).replace('.', ',');
const sigla = (id) => { const t = C.time(id); return t ? t.abbr : '—'; };
const $ = (sel) => document.querySelector(sel);
 
function opcoesTimes(filtro, selecionado) {
  const sel = C.idTime(selecionado);
  let h = '<option value="">Selecione…</option>';
  C.TIMES.filter(filtro || (() => true)).forEach(t => {
    h += `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${esc(t.completo)} (${t.abbr})</option>`;
  });
  return h;
}
 
function status(msg, tipo) {
  const el = $('#pt-status');
  if (!el) return;
  el.className = 'pt-status ' + (tipo || '');
  el.innerHTML = msg;
}
 
/* ---------------- leitura de dados ---------------- */
async function carregarDados() {
  const [usrSnap, palSnap, resSnap] = await Promise.all([
    getDocs(collection(db, CONFIG.COLECAO_USUARIOS)),
    getDocs(collection(db, CONFIG.COLECAO_PALPITES_PRE)),
    getDoc(doc(db, CONFIG.COLECAO_RESULTADOS, String(CONFIG.TEMPORADA)))
  ]);
  estado.participantes = [];
  usrSnap.forEach(d => {
    const u = d.data();
    if (CONFIG.participanteAtivo(u)) estado.participantes.push({ uid: d.id, nome: CONFIG.nomeParticipante(d.id, u) });
  });
  estado.palpites = [];
  palSnap.forEach(d => estado.palpites.push(CONFIG.lerPalpite(d.id, d.data())));
  estado.resultado = resSnap.exists() ? resSnap.data() : {};
}
 
/* ---------------- ESPN ---------------- */
async function temporadaRegularEncerrada() {
  const r = await fetch(ESPN_SEMANA18);
  if (!r.ok) throw new Error('ESPN (semana 18): ' + r.status);
  const j = await r.json();
  const ev = j.events || [];
  return ev.length > 0 && ev.every(e => e.status && e.status.type && e.status.type.completed);
}
 
async function buscarClassificacaoESPN() {
  const r = await fetch(ESPN_CLASSIFICACAO);
  if (!r.ok) throw new Error('ESPN (classificação): ' + r.status);
  return C.interpretaClassificacaoESPN(await r.json());
}
 
/* ---------------- apuração e gravação ---------------- */
function apurarLocal() {
  estado.apuracao = C.apurar(estado.participantes, estado.palpites, estado.resultado);
  return estado.apuracao;
}
 
async function gravarPontuacao() {
  const ap = apurarLocal();
  const lotes = [];
  let lote = writeBatch(db), n = 0;
  ap.resultados.forEach(r => {
    lote.set(doc(db, CONFIG.COLECAO_PONTUACAO, r.uid), {
      uid: r.uid, nome: r.nome, temporada: CONFIG.TEMPORADA,
      total: r.total, enviouPalpite: r.enviouPalpite, itens: r.itens,
      pendentes: ap.pendentes, apuradoEm: serverTimestamp(), apuradoPor: usuarioAtual ? usuarioAtual.uid : null
    });
    n++;
    if (CONFIG.CAMPO_PONTOS_NO_USUARIO) {
      lote.set(doc(db, CONFIG.COLECAO_USUARIOS, r.uid), { [CONFIG.CAMPO_PONTOS_NO_USUARIO]: r.total }, { merge: true });
      n++;
    }
    if (n >= 450) { lotes.push(lote); lote = writeBatch(db); n = 0; }
  });
  lotes.push(lote);
  for (const l of lotes) await l.commit();
  return ap;
}
 
async function salvarResultado(parcial) {
  await setDoc(doc(db, CONFIG.COLECAO_RESULTADOS, String(CONFIG.TEMPORADA)),
    Object.assign({}, parcial, { atualizadoEm: serverTimestamp(), atualizadoPor: usuarioAtual ? usuarioAtual.uid : null }),
    { merge: true });
  Object.assign(estado.resultado, parcial);
}
 
/* ---------------- apuração automática (fase 1) ---------------- */
async function verificarAutomatico() {
  if (estado.resultado.fase1Em) return; // já apurada
  try {
    if (!(await temporadaRegularEncerrada())) {
      status('Temporada regular em andamento. A apuração automática ocorrerá quando um administrador abrir esta página após o fim da Semana 18.', '');
      return;
    }
    const espn = await buscarClassificacaoESPN();
    estado.espn = espn;
    if (espn.avisos.length || !espn.pior) {
      preencherFormularioFase1(espn);
      status('<b>Temporada regular encerrada.</b> A ESPN retornou pendências que exigem conferência:<br>• ' +
        espn.avisos.map(esc).join('<br>• ') + '<br>Revise o formulário abaixo e clique em <b>Salvar e apurar</b>.', 'aviso');
      return;
    }
    await salvarResultado({ divisoes: espn.divisoes, wildCards: espn.wildCards, pior: espn.pior, origemFase1: 'ESPN (automático)', fase1Em: new Date().toISOString() });
    await gravarPontuacao();
    renderizar();
    status('✅ Temporada regular encerrada: campeões de divisão, Wild Cards e pior campanha capturados da ESPN e pontuação apurada automaticamente. Confira os dados abaixo.', 'ok');
  } catch (e) {
    status('Não foi possível consultar a ESPN agora (' + esc(e.message) + '). Use o preenchimento manual, se necessário.', 'erro');
  }
}
 
/* ---------------- interface ---------------- */
const CSS = `
#${CONFIG.CONTAINER_ID}{margin-top:20px}
.pt-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:22px;margin-bottom:18px}
.pt-card h3{font-size:1.05rem;margin:0 0 6px}
.pt-card .pt-sub{opacity:.75;font-size:.85rem;margin:0 0 16px}
.pt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.pt-campo label{display:block;font-size:.8rem;opacity:.8;margin-bottom:4px}
.pt-campo select,.pt-campo input{width:100%;padding:9px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.25);color:inherit;font:inherit}
.pt-acoes{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.pt-btn{background:#16a37b;color:#fff;border:none;border-radius:8px;padding:10px 16px;font:inherit;font-weight:600;cursor:pointer}
.pt-btn.sec{background:transparent;border:1px solid rgba(255,255,255,.25)}
.pt-btn:disabled{opacity:.5;cursor:not-allowed}
.pt-status{padding:12px 14px;border-radius:8px;font-size:.88rem;background:rgba(255,255,255,.05);margin-bottom:18px;line-height:1.5}
.pt-status.ok{background:rgba(22,163,123,.15);border:1px solid #16a37b}
.pt-status.aviso{background:rgba(253,203,110,.12);border:1px solid #e6b84d}
.pt-status.erro{background:rgba(214,48,49,.15);border:1px solid #d63031}
.pt-tabela{width:100%;border-collapse:collapse;font-size:.85rem}
.pt-tabela th,.pt-tabela td{padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left}
.pt-tabela td.n,.pt-tabela th.n{text-align:right}
.pt-chip{display:inline-block;padding:2px 9px;border-radius:12px;font-size:.75rem;background:rgba(255,255,255,.08);margin:2px}
.pt-chip.ok{background:rgba(22,163,123,.2)} .pt-chip.pend{background:rgba(253,203,110,.18)}
.pt-mvp-lista{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px;margin-top:10px}
.pt-mvp-lista label{display:flex;gap:8px;align-items:center;font-size:.85rem;padding:6px 8px;border-radius:6px;background:rgba(0,0,0,.2)}
.pt-sub2{font-size:.9rem;margin:16px 0 8px;opacity:.9;font-weight:600}
`;
 
function htmlFase1() {
  const r = estado.resultado;
  let h = '<div class="pt-sub2">Campeões de divisão</div><div class="pt-grid">';
  C.DIVISOES.forEach(d => {
    h += `<div class="pt-campo"><label>${d}</label><select data-div="${d}" class="pt-div">${opcoesTimes(t => t.divisao === d, (r.divisoes || {})[d])}</select></div>`;
  });
  h += '</div><div class="pt-sub2">Wild Cards</div><div class="pt-grid">';
  ['AFC', 'NFC'].forEach(c => {
    for (let i = 0; i < 3; i++) {
      h += `<div class="pt-campo"><label>${c} — Wild Card ${i + 1}</label><select data-conf="${c}" class="pt-wc">${opcoesTimes(t => t.conf === c, ((r.wildCards || {})[c] || [])[i])}</select></div>`;
    }
  });
  h += `</div><div class="pt-sub2">Pior campanha</div><div class="pt-grid"><div class="pt-campo"><label>Time de pior campanha</label><select id="pt-pior">${opcoesTimes(null, r.pior)}</select></div></div>`;
  return h;
}
 
function htmlFase2() {
  const r = estado.resultado;
  const contagem = {};
  estado.palpites.forEach(p => {
    const k = C.normalizaNome(p.mvp);
    if (!k) return;
    if (!contagem[k]) contagem[k] = { texto: String(p.mvp).trim(), qtd: 0 };
    contagem[k].qtd++;
  });
  const aceitos = (r.mvpAceitos || []).map(C.normalizaNome);
  const itens = Object.keys(contagem).sort((a, b) => contagem[b].qtd - contagem[a].qtd);
  let lista = itens.map(k => `<label><input type="checkbox" class="pt-mvp-ok" value="${esc(contagem[k].texto)}" ${aceitos.includes(k) ? 'checked' : ''}> ${esc(contagem[k].texto)} <span class="pt-chip">${contagem[k].qtd}</span></label>`).join('');
  if (!lista) lista = '<span style="opacity:.7">Nenhum palpite de MVP encontrado.</span>';
  return `<div class="pt-grid">
      <div class="pt-campo"><label>Campeão do Super Bowl</label><select id="pt-campeao">${opcoesTimes(null, r.campeao)}</select></div>
      <div class="pt-campo"><label>Vice-campeão do Super Bowl</label><select id="pt-vice">${opcoesTimes(null, r.vice)}</select></div>
      <div class="pt-campo"><label>MVP eleito (nome oficial)</label><input id="pt-mvp-nome" type="text" placeholder="Ex.: Patrick Mahomes" value="${esc(r.mvpNome || '')}"></div>
    </div>
    <div class="pt-sub2">Palpites de MVP que serão considerados corretos</div>
    <p class="pt-sub">Marque todas as grafias que se referem ao MVP eleito (ex.: "Mahomes", "Patrick Mahomes"). Ao digitar o nome oficial, as grafias equivalentes são marcadas automaticamente.</p>
    <div class="pt-mvp-lista">${lista}</div>`;
}
 
function htmlResumo() {
  const ap = estado.apuracao || apurarLocal();
  const r = estado.resultado;
  const fase1 = r.fase1Em ? `<span class="pt-chip ok">Fase 1 apurada — ${esc(r.origemFase1 || '')}</span>` : '<span class="pt-chip pend">Fase 1 pendente</span>';
  const fase2 = r.fase2Em ? '<span class="pt-chip ok">Fase 2 apurada</span>' : '<span class="pt-chip pend">Fase 2 pendente</span>';
  const pend = ap.pendentes.length ? ap.pendentes.map(p => `<span class="pt-chip pend">${esc(p)}</span>`).join('') : '<span class="pt-chip ok">Nenhuma</span>';
  const soma = (r2, g) => r2.itens.filter(i => g.includes(i.grupo)).reduce((s, i) => s + i.pontos, 0);
  let linhas = ap.resultados.map((x, i) => `<tr>
      <td>${i + 1}</td><td>${esc(x.nome)}${x.enviouPalpite ? '' : ' <span class="pt-chip pend">sem palpite</span>'}</td>
      <td class="n">${fmt(soma(x, ['divisoes']))}</td><td class="n">${fmt(soma(x, ['wildcards']))}</td>
      <td class="n">${fmt(soma(x, ['playoffs']))}</td><td class="n">${fmt(soma(x, ['pior']))}</td>
      <td class="n">${fmt(soma(x, ['superbowl', 'campeao', 'vice']))}</td><td class="n">${fmt(soma(x, ['mvp']))}</td>
      <td class="n"><b>${fmt(x.total)}</b></td></tr>`).join('');
  return `<p>${fase1} ${fase2}</p>
    <p class="pt-sub">Itens pendentes: ${pend}<br>Participantes ativos: ${estado.participantes.length} · Enviaram palpite: ${ap.enviaram} · Sem fator de correção (pontos fixos da tabela)</p>
    <div style="overflow-x:auto"><table class="pt-tabela"><thead><tr><th>#</th><th>Participante</th><th class="n">Divisões</th><th class="n">Wild Cards</th><th class="n">Playoffs</th><th class="n">Pior</th><th class="n">Super Bowl</th><th class="n">MVP</th><th class="n">Total Pré</th></tr></thead><tbody>${linhas}</tbody></table></div>`;
}
 
function renderizar() {
  const c = document.getElementById(CONFIG.CONTAINER_ID);
  if (!c) return;
  apurarLocal();
  c.innerHTML = `
    <div class="pt-card">
      <h3>★ Pré-temporada — apuração</h3>
      <p class="pt-sub">Fase 1 (após a Semana 18): campeões de divisão, Wild Cards, equipes nos playoffs e pior campanha — captura automática pela ESPN, com correção manual.<br>
      Fase 2 (após o Super Bowl e o anúncio do MVP): equipes no Super Bowl, campeão, vice e MVP — preenchimento pelos administradores.</p>
      <div id="pt-status" class="pt-status">Aguardando ação.</div>
    </div>
    <div class="pt-card">
      <h3>Fase 1 — Temporada regular</h3>
      <p class="pt-sub">Use "Buscar na ESPN" para preencher automaticamente. Corrija o que for necessário e clique em "Salvar e apurar".</p>
      <div id="pt-fase1">${htmlFase1()}</div>
      <div class="pt-acoes">
        <button class="pt-btn sec" id="pt-btn-espn">Buscar na ESPN</button>
        <button class="pt-btn" id="pt-btn-fase1">Salvar e apurar fase 1</button>
      </div>
    </div>
    <div class="pt-card">
      <h3>Fase 2 — Super Bowl e MVP</h3>
      <div id="pt-fase2">${htmlFase2()}</div>
      <div class="pt-acoes"><button class="pt-btn" id="pt-btn-fase2">Salvar e apurar fase 2</button></div>
    </div>
    <div class="pt-card">
      <h3>Resultado da apuração da pré-temporada</h3>
      <div id="pt-resumo">${htmlResumo()}</div>
      <div class="pt-acoes">
        <button class="pt-btn sec" id="pt-btn-reapurar">Reapurar com os dados salvos</button>
        <button class="pt-btn sec" id="pt-btn-diag">Diagnóstico da configuração</button>
      </div>
      <pre id="pt-diag" style="display:none;white-space:pre-wrap;font-size:.78rem;opacity:.85;margin-top:12px"></pre>
    </div>`;
  ligarEventos();
}
 
function preencherFormularioFase1(espn) {
  document.querySelectorAll('.pt-div').forEach(s => { s.value = espn.divisoes[s.dataset.div] || ''; });
  ['AFC', 'NFC'].forEach(c => {
    const sels = [...document.querySelectorAll(`.pt-wc[data-conf="${c}"]`)];
    sels.forEach((s, i) => { s.value = (espn.wildCards[c] || [])[i] || ''; });
  });
  if (espn.pior) $('#pt-pior').value = espn.pior;
}
 
function lerFase1() {
  const divisoes = {}, wildCards = { AFC: [], NFC: [] }, erros = [];
  document.querySelectorAll('.pt-div').forEach(s => { if (s.value) divisoes[s.dataset.div] = s.value; else erros.push('Campeão da ' + s.dataset.div); });
  document.querySelectorAll('.pt-wc').forEach(s => { if (s.value) wildCards[s.dataset.conf].push(s.value); });
  ['AFC', 'NFC'].forEach(c => {
    if (new Set(wildCards[c]).size !== 3) erros.push('3 Wild Cards distintos da ' + c);
    wildCards[c].forEach(id => { if (Object.values(divisoes).includes(id)) erros.push(sigla(id) + ' não pode ser campeão de divisão e Wild Card'); });
  });
  const pior = $('#pt-pior').value;
  if (!pior) erros.push('Pior campanha');
  return { dados: { divisoes, wildCards, pior }, erros };
}
 
function ligarEventos() {
  $('#pt-btn-espn').onclick = async () => {
    status('Consultando a ESPN…');
    try {
      const espn = await buscarClassificacaoESPN();
      estado.espn = espn;
      preencherFormularioFase1(espn);
      status(espn.avisos.length
        ? 'Dados da ESPN carregados com pendências:<br>• ' + espn.avisos.map(esc).join('<br>• ') + '<br>Complete manualmente antes de salvar.'
        : 'Dados da ESPN carregados no formulário. Confira e clique em <b>Salvar e apurar fase 1</b>.', espn.avisos.length ? 'aviso' : 'ok');
    } catch (e) { status('Falha ao consultar a ESPN: ' + esc(e.message), 'erro'); }
  };
 
  $('#pt-btn-fase1').onclick = async (ev) => {
    const { dados, erros } = lerFase1();
    if (erros.length) { status('Corrija antes de salvar:<br>• ' + erros.map(esc).join('<br>• '), 'erro'); return; }
    ev.target.disabled = true; status('Salvando e apurando…');
    try {
      const e = estado.espn;
      const mesmoConjunto = (a, b) => (a || []).length === (b || []).length && (a || []).every(x => (b || []).includes(x));
      const veioDaEspn = !!e && C.DIVISOES.every(d => e.divisoes[d] === dados.divisoes[d])
        && mesmoConjunto(e.wildCards.AFC, dados.wildCards.AFC) && mesmoConjunto(e.wildCards.NFC, dados.wildCards.NFC) && e.pior === dados.pior;
      await salvarResultado(Object.assign(dados, { origemFase1: veioDaEspn ? 'ESPN (conferido)' : 'Manual (administrador)', fase1Em: new Date().toISOString() }));
      await gravarPontuacao();
      renderizar();
      status('✅ Fase 1 salva e pontuação da pré-temporada apurada.', 'ok');
    } catch (e) { status('Erro ao salvar: ' + esc(e.message), 'erro'); ev.target.disabled = false; }
  };
 
  const nomeMvp = $('#pt-mvp-nome');
  nomeMvp.oninput = () => {
    const alvo = C.normalizaNome(nomeMvp.value);
    if (!alvo) return;
    const sobrenome = alvo.split(' ').pop();
    document.querySelectorAll('.pt-mvp-ok').forEach(cb => {
      const v = C.normalizaNome(cb.value);
      cb.checked = v === alvo || v === sobrenome || (v.split(' ').pop() === sobrenome && v.length > 2);
    });
  };
 
  $('#pt-btn-fase2').onclick = async (ev) => {
    const campeao = $('#pt-campeao').value, vice = $('#pt-vice').value, mvpNome = nomeMvp.value.trim();
    const mvpAceitos = [...document.querySelectorAll('.pt-mvp-ok:checked')].map(cb => cb.value);
    if (mvpNome && !mvpAceitos.includes(mvpNome)) mvpAceitos.push(mvpNome);
    const erros = [];
    if ((campeao && !vice) || (!campeao && vice)) erros.push('Informe campeão e vice juntos');
    if (campeao && campeao === vice) erros.push('Campeão e vice não podem ser o mesmo time');
    if (campeao && vice && C.time(campeao).conf === C.time(vice).conf) erros.push('Campeão e vice devem ser de conferências diferentes');
    if (!campeao && !mvpNome) erros.push('Preencha o Super Bowl e/ou o MVP');
    if (erros.length) { status('Corrija antes de salvar:<br>• ' + erros.map(esc).join('<br>• '), 'erro'); return; }
    ev.target.disabled = true; status('Salvando e apurando…');
    try {
      const parcial = { fase2Em: new Date().toISOString() };
      if (campeao) Object.assign(parcial, { campeao, vice });
      if (mvpNome) Object.assign(parcial, { mvpNome, mvpAceitos });
      await salvarResultado(parcial);
      await gravarPontuacao();
      renderizar();
      status('✅ Fase 2 salva e pontuação da pré-temporada reapurada.', 'ok');
    } catch (e) { status('Erro ao salvar: ' + esc(e.message), 'erro'); ev.target.disabled = false; }
  };
 
  $('#pt-btn-reapurar').onclick = async (ev) => {
    ev.target.disabled = true; status('Reapurando…');
    try { await carregarDados(); await gravarPontuacao(); renderizar(); status('✅ Pontuação reapurada com os dados salvos.', 'ok'); }
    catch (e) { status('Erro: ' + esc(e.message), 'erro'); ev.target.disabled = false; }
  };
 
  $('#pt-btn-diag').onclick = async () => {
    const out = $('#pt-diag');
    out.style.display = 'block';
    try {
      const snap = await getDocs(collection(db, CONFIG.COLECAO_PALPITES_PRE));
      const primeiro = snap.docs[0];
      const exemplo = primeiro ? CONFIG.lerPalpite(primeiro.id, primeiro.data()) : null;
      const padrao = exemplo ? C.padronizaPalpite(exemplo) : null;
      out.textContent =
        `Coleção de palpites "${CONFIG.COLECAO_PALPITES_PRE}": ${snap.size} documento(s)\n` +
        `Participantes ativos em "${CONFIG.COLECAO_USUARIOS}": ${estado.participantes.length}\n\n` +
        (primeiro ? `Campos do 1º documento (${primeiro.id}):\n${JSON.stringify(primeiro.data(), null, 2)}\n\n` +
          `Como foi interpretado:\n- campeão: ${sigla(padrao.campeao)} | vice: ${sigla(padrao.vice)}\n` +
          `- divisões reconhecidas: ${Object.keys(padrao.divisoes).length}/8\n- wild cards reconhecidos: ${padrao.wildCards.length}/6\n` +
          `- pior: ${sigla(padrao.pior)} | MVP: ${padrao.mvp || '—'}\n\n` +
          `Se algum item aparecer vazio, ajuste a função lerPalpite() no início do arquivo pre-temporada-admin.js.`
          : 'Nenhum palpite encontrado. Verifique o nome da coleção em CONFIG.COLECAO_PALPITES_PRE.');
    } catch (e) { out.textContent = 'Erro no diagnóstico: ' + e.message; }
  };
}
 
/* ---------------- inicialização ---------------- */
let iniciado = false;
async function montar() {
  const c = document.getElementById(CONFIG.CONTAINER_ID);
  if (!c || !usuarioAtual || c.dataset.ptMontado) return;
  c.dataset.ptMontado = '1';
  if (!document.getElementById('pt-css')) {
    const st = document.createElement('style'); st.id = 'pt-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  c.innerHTML = '<div class="pt-card">Carregando apuração da pré-temporada…</div>';
  try {
    await carregarDados();
    renderizar();
    await verificarAutomatico();
  } catch (e) {
    c.innerHTML = `<div class="pt-card"><div class="pt-status erro">Não foi possível carregar a apuração da pré-temporada: ${esc(e.message)}<br>
      Verifique se as regras do Firestore permitem acesso dos administradores às coleções "${CONFIG.COLECAO_RESULTADOS}" e "${CONFIG.COLECAO_PONTUACAO}".</div></div>`;
  }
}
 
window.addEventListener('load', () => {
  if (iniciado) return; iniciado = true;
  if (!C) { console.error('pre-temporada-core.js não foi carregado antes de pre-temporada-admin.js'); return; }
  iniciarFirebase();
  onAuthStateChanged(auth, (u) => { usuarioAtual = u; montar(); });
  // A página de Administração pode ser montada depois (site de página única)
  new MutationObserver(() => montar()).observe(document.body, { childList: true, subtree: true });
});
