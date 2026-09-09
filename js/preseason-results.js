Bolao.PreseasonResults={
 deadline(){return new Date(BOLAO_CONFIG.preseasonDeadline)},
 released(){return Date.now()>=this.deadline().getTime()},
 escape(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))},
 team(v){if(!v)return'Sem palpite';const list=window.NFL_TEAMS||window.NFL_TEAMS_2026||[];const t=list.find(x=>x.abbr===v||x.id===v||x.name===v);return t?t.name:v},
 async render(){
  const boxHtml=this.released()?'Carregando palpites...':'<div class="notice">Os palpites de todos os participantes serão liberados hoje, 9 de setembro de 2026, às 21h20, horário de Brasília.</div>';
  Bolao.App.content(`<div class="section-title"><h1>Palpites da pré-temporada</h1><span class="badge">${this.released()?'Palpites revelados':'Palpites privados'}</span></div><div id="preseason-results" class="card">${boxHtml}</div>`);
  if(!this.released())return;
  const box=document.querySelector('#preseason-results');
  try{
   const us=await Bolao.db.collection('users').get();
   const users=us.docs.map(d=>({uid:d.id,...d.data()})).filter(u=>u.active!==false).sort((a,b)=>(a.name||a.email||'').localeCompare(b.name||b.email||'','pt-BR'));
   const rows=await Promise.all(users.map(async u=>{const d=await Bolao.db.collection('userPredictions').doc(u.uid).collection('preseason').doc(String(BOLAO_CONFIG.season)).get();return{user:u,picks:d.exists?(d.data().picks||{}):null}}));
   box.innerHTML=`<p class="muted">Participantes ativos: ${rows.length}. Consulta em modo somente leitura.</p>${rows.map(x=>this.card(x)).join('')}`;
  }catch(e){box.innerHTML=`<div class="notice">Não foi possível carregar os palpites: ${this.escape(e.message)}</div>`}
 },
 card({user,picks}){
  const name=this.escape(user.name||user.email||'Participante');
  if(!picks)return`<details><summary><b>${name}</b> · Sem palpite registrado</summary><p class="muted">Nenhum palpite de pré-temporada foi salvo.</p></details>`;
  const divs=[['div_AFC_Leste','AFC Leste'],['div_AFC_Oeste','AFC Oeste'],['div_AFC_Sul','AFC Sul'],['div_AFC_Norte','AFC Norte'],['div_NFC_Leste','NFC Leste'],['div_NFC_Oeste','NFC Oeste'],['div_NFC_Sul','NFC Sul'],['div_NFC_Norte','NFC Norte']];
  const line=(label,value)=>`<tr><th>${label}</th><td>${this.escape(value)}</td></tr>`;
  return`<details><summary><b>${name}</b></summary><div class="table-wrap"><table><tbody>${line('Campeão do Super Bowl',this.team(picks.champion))}${line('Vice-campeão',this.team(picks.runner))}${divs.map(([k,l])=>line(l,this.team(picks[k]))).join('')}${line('Wildcard AFC 1',this.team(picks.wcAFC1))}${line('Wildcard AFC 2',this.team(picks.wcAFC2))}${line('Wildcard AFC 3',this.team(picks.wcAFC3))}${line('Wildcard NFC 1',this.team(picks.wcNFC1))}${line('Wildcard NFC 2',this.team(picks.wcNFC2))}${line('Wildcard NFC 3',this.team(picks.wcNFC3))}${line('Pior campanha',this.team(picks.worst))}${line('MVP',picks.mvp||'Sem palpite')}</tbody></table></div></details>`
 }
};
