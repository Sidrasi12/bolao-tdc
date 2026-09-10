Bolao.PreseasonResults = {
  deadline() { return new Date(BOLAO_CONFIG.preseasonDeadline); },
  released() { return Date.now() >= this.deadline().getTime(); },
  escape(value) { return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  team(value) {
    if (!value) return 'Sem palpite';
    const lists = [window.NFL_TEAMS, window.NFL_TEAMS_2026, Bolao.teams, Bolao.NFL_TEAMS].filter(Array.isArray);
    const item = lists.flat().find(t => t.abbr === value || t.id === value || t.name === value);
    return item ? item.name : value;
  },
  pct(count, total) { return total ? count * 100 / total : 0; },
  pctText(value) { return Number(value || 0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1}) + '%'; },
  count(entries, keys, uniquePerUser=false) {
    const counts = new Map();
    entries.forEach(({picks}) => {
      const values = keys.map(k => String(picks?.[k] || '').trim()).filter(Boolean);
      const selected = uniquePerUser ? [...new Set(values)] : values;
      selected.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    });
    return [...counts.entries()].sort((a,b) => b[1]-a[1] || this.team(a[0]).localeCompare(this.team(b[0]),'pt-BR'));
  },
  chart(title, rows, total, options={}) {
    const {isTeam=true, note='', maxRows=32} = options;
    const visible = rows.slice(0,maxRows);
    return `<section class="pre-chart-card"><div class="pre-chart-title"><h3>${this.escape(title)}</h3><span>${total} resposta(s)</span></div>${visible.length ? `<div class="pre-bars">${visible.map(([raw,count]) => { const label=isTeam?this.team(raw):raw; const percent=this.pct(count,total); return `<div class="pre-bar-row"><div class="pre-bar-head"><span class="pre-bar-name" title="${this.escape(label)}">${this.escape(label)}</span><span class="pre-bar-value">${count} · ${this.pctText(percent)}</span></div><div class="pre-bar-track"><div class="pre-bar-fill" style="width:${Math.max(0,Math.min(100,percent)).toFixed(2)}%"></div></div></div>`;}).join('')}</div>` : '<div class="pre-empty">Nenhuma escolha registrada.</div>'}${note?`<div class="pre-wildcard-note">${this.escape(note)}</div>`:''}</section>`;
  },
  async render() {
    const released = this.released();
    Bolao.App.content(`<div class="section-title"><h1>Palpites da pré-temporada</h1><span class="badge">${released?'Dashboard liberado':'Palpites privados'}</span></div><div id="preseason-results">${released?'<div class="card">Carregando dashboard...</div>':'<div class="notice">O dashboard será liberado após o encerramento do prazo.</div>'}</div>`);
    if (!released) return;
    const box=document.querySelector('#preseason-results');
    try {
      const snap=await Bolao.db.collection('users').get();
      const users=snap.docs.map(d=>({uid:d.id,...d.data()})).filter(u=>u.active!==false).sort((a,b)=>(a.name||a.email||'').localeCompare(b.name||b.email||'','pt-BR'));
      const entries=await Promise.all(users.map(async user=>{const d=await Bolao.db.collection('userPredictions').doc(user.uid).collection('preseason').doc(String(BOLAO_CONFIG.season)).get();return{user,picks:d.exists?(d.data().picks||null):null};}));
      this.renderDashboard(entries);
    } catch(error) { box.innerHTML=`<div class="notice">Não foi possível carregar o dashboard: ${this.escape(error.message)}</div>`; }
  },
  renderDashboard(entries) {
    const box=document.querySelector('#preseason-results');
    const submitted=entries.filter(e=>e.picks), missing=entries.length-submitted.length, participation=this.pct(submitted.length,entries.length);
    const divisions=[['div_AFC_Leste','AFC Leste'],['div_AFC_Oeste','AFC Oeste'],['div_AFC_Sul','AFC Sul'],['div_AFC_Norte','AFC Norte'],['div_NFC_Leste','NFC Leste'],['div_NFC_Oeste','NFC Oeste'],['div_NFC_Sul','NFC Sul'],['div_NFC_Norte','NFC Norte']];
    const wcNote='Cada participante escolhe até três equipes. Por isso, a soma dos percentuais pode ultrapassar 100%.';
    box.innerHTML=`<div class="pre-dashboard"><div class="pre-kpis"><div class="pre-kpi"><div class="pre-kpi-label">Participantes ativos</div><div class="pre-kpi-value">${entries.length}</div></div><div class="pre-kpi"><div class="pre-kpi-label">Palpites enviados</div><div class="pre-kpi-value">${submitted.length}</div></div><div class="pre-kpi"><div class="pre-kpi-label">Sem palpite</div><div class="pre-kpi-value">${missing}</div></div><div class="pre-kpi"><div class="pre-participation"><div class="pre-donut" style="--value:${participation.toFixed(2)}"><div class="pre-donut-label">${this.pctText(participation)}</div></div><div><div class="pre-kpi-label">Participação</div><div class="muted">Base: ${entries.length} ativos</div></div></div></div></div><section class="pre-section"><h2>Favoritos ao Super Bowl</h2><p class="muted">Quantidade e percentual entre os participantes que enviaram os palpites.</p><div class="pre-chart-grid">${this.chart('Campeão do Super Bowl',this.count(submitted,['champion']),submitted.length)}${this.chart('Vice-campeão do Super Bowl',this.count(submitted,['runner']),submitted.length)}</div></section><section class="pre-section"><h2>Campeões das divisões</h2><div class="pre-chart-grid divisions">${divisions.map(([key,label])=>this.chart(label,this.count(submitted,[key]),submitted.length)).join('')}</div></section><section class="pre-section"><h2>Wild Cards</h2><div class="pre-chart-grid">${this.chart('Wild Cards da AFC',this.count(submitted,['wcAFC1','wcAFC2','wcAFC3'],true),submitted.length,{note:wcNote})}${this.chart('Wild Cards da NFC',this.count(submitted,['wcNFC1','wcNFC2','wcNFC3'],true),submitted.length,{note:wcNote})}</div></section><section class="pre-section"><h2>Outras previsões</h2><div class="pre-chart-grid">${this.chart('Pior campanha',this.count(submitted,['worst']),submitted.length)}${this.chart('MVP da temporada',this.count(submitted,['mvp']),submitted.length,{isTeam:false})}</div></section><section class="pre-section pre-participants"><h2>Escolhas por participante</h2><p class="muted">Clique no nome para consultar todos os palpites.</p>${entries.map(e=>this.participantCard(e)).join('')}</section></div>`;
  },
  participantCard({user,picks}) {
    const name=this.escape(user.name||user.email||'Participante');
    if(!picks)return `<details><summary><b>${name}</b> · Sem palpite registrado</summary><p class="muted" style="padding:0 16px 14px">Nenhum palpite de pré-temporada foi salvo.</p></details>`;
    const fields=[['Campeão do Super Bowl',this.team(picks.champion)],['Vice-campeão',this.team(picks.runner)],['AFC Leste',this.team(picks.div_AFC_Leste)],['AFC Oeste',this.team(picks.div_AFC_Oeste)],['AFC Sul',this.team(picks.div_AFC_Sul)],['AFC Norte',this.team(picks.div_AFC_Norte)],['NFC Leste',this.team(picks.div_NFC_Leste)],['NFC Oeste',this.team(picks.div_NFC_Oeste)],['NFC Sul',this.team(picks.div_NFC_Sul)],['NFC Norte',this.team(picks.div_NFC_Norte)],['Wildcard AFC 1',this.team(picks.wcAFC1)],['Wildcard AFC 2',this.team(picks.wcAFC2)],['Wildcard AFC 3',this.team(picks.wcAFC3)],['Wildcard NFC 1',this.team(picks.wcNFC1)],['Wildcard NFC 2',this.team(picks.wcNFC2)],['Wildcard NFC 3',this.team(picks.wcNFC3)],['Pior campanha',this.team(picks.worst)],['MVP',picks.mvp||'Sem palpite']];
    return `<details><summary><b>${name}</b></summary><div class="table-wrap"><table><tbody>${fields.map(([l,v])=>`<tr><th>${this.escape(l)}</th><td>${this.escape(v)}</td></tr>`).join('')}</tbody></table></div></details>`;
  }
};
