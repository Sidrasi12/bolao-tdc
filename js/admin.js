Bolao.Admin={
  selectedWeek:1,
  games:[],

  async render(){
    if(Bolao.Auth.user.role!=='admin')return Bolao.App.navigate('dashboard');
    Bolao.App.content(`
      <div class="section-title"><h1>Administração</h1><span class="badge">Acesso administrativo</span></div>
      <div class="grid">
        <div class="card">
          <h3>Resultados manuais de teste</h3>
          <label>Rodada<select id="manual-week">${Array.from({length:18},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}</select></label>
          <button id="load-manual">Carregar jogos</button>
          <p class="muted">Informe placares para simular jogos finalizados. Os resultados manuais têm prioridade na apuração.</p>
        </div>
        <div class="card">
          <h3>Apuração semanal</h3>
          <label>Rodada<select id="score-week">${Array.from({length:18},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}</select></label>
          <button id="process-week">Apurar rodada</button>
          <p class="muted">Processa resultados finais da ESPN ou resultados manuais marcados como finalizados.</p>
        </div>
        <div class="card">
          <h3>Distribuição dos palpites</h3>
          <label>Rodada<select id="summary-week">${Array.from({length:18},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}</select></label>
          <button id="update-summaries">Atualizar distribuição</button>
          <p class="muted">Gera somente totais e percentuais dos jogos cujo prazo já encerrou.</p>
        </div>
      </div>
      <div class="card" style="margin-top:16px"><h3>Status</h3><div id="process-status">Aguardando ação.</div></div>
      <div class="card" style="margin-top:16px" id="manual-results"><p>Selecione uma rodada e clique em Carregar jogos.</p></div>
      <div class="card" style="margin-top:16px" id="users">Carregando participantes...</div>`);
    document.querySelector('#load-manual').onclick=()=>this.loadManualGames(+document.querySelector('#manual-week').value);
    document.querySelector('#process-week').onclick=()=>this.processWeek(+document.querySelector('#score-week').value);
    document.querySelector('#update-summaries').onclick=()=>this.updateBetSummaries(+document.querySelector('#summary-week').value);
    await this.loadUsers();
  },

  async activeUsers(){
    const s=await Bolao.db.collection('users').get();
    return s.docs.map(d=>({uid:d.id,...d.data()})).filter(u=>u.active!==false);
  },

  async loadUsers(){
    try{
      const users=await this.activeUsers();
      document.querySelector('#users').innerHTML=`<h2>Participantes ativos (${users.length})</h2><div class="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Função</th><th>Pago</th></tr></thead><tbody>${users.map(x=>`<tr><td>${x.name||''}</td><td>${x.email||''}</td><td>${x.role||'player'}</td><td>${x.paid?'Sim':'Não'}</td></tr>`).join('')}</tbody></table></div>`;
    }catch(e){document.querySelector('#users').textContent='Erro: '+e.message}
  },

  async manualMap(week){
    const s=await Bolao.db.collection('manualResults').where('season','==',BOLAO_CONFIG.season).where('week','==',week).get();
    return Object.fromEntries(s.docs.map(d=>[d.data().gameId,{id:d.id,...d.data()}]));
  },

  async loadManualGames(week){
    const box=document.querySelector('#manual-results'),status=document.querySelector('#process-status');
    box.textContent='Carregando jogos...';status.textContent='Consultando a rodada...';
    try{
      this.selectedWeek=week;
      this.games=await Bolao.ESPN.games(week,2);
      const manual=await this.manualMap(week);
      const cards=this.games.map(g=>{
        const m=manual[g.id]||{};
        const removeButton=m.id?`<button class="secondary" data-delete="${g.id}">Remover teste</button>`:'';
        return `<div class="game-card"><div class="game"><div class="team"><img src="${g.away.logo}">${g.away.name}</div><div class="game-meta">${new Date(g.date).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}<div class="venue">🏟️ ${g.venue}${g.venueCity?' · '+g.venueCity:''}</div></div><div class="team">${g.home.name}<img src="${g.home.logo}"></div></div><div class="form-grid" style="margin-top:12px"><label>Placar ${g.away.abbr}<input id="away-${g.id}" type="number" min="0" step="1" value="${m.awayScore??''}"></label><label>Placar ${g.home.abbr}<input id="home-${g.id}" type="number" min="0" step="1" value="${m.homeScore??''}"></label></div><label style="display:flex;gap:8px;align-items:center"><input id="final-${g.id}" type="checkbox" style="width:auto" ${m.completed?'checked':''}> Marcar como finalizado para teste</label><div style="display:flex;gap:8px"><button data-save="${g.id}">Salvar resultado</button>${removeButton}</div></div>`;
      }).join('');
      box.innerHTML=`<div class="section-title"><h2>Resultados de teste, rodada ${week}</h2><span class="badge">${this.games.length} jogos</span></div>${cards||'<p>Nenhum jogo encontrado.</p>'}`;
      box.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>this.saveManual(b.dataset.save));
      box.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>this.deleteManual(b.dataset.delete));
      status.textContent='Jogos carregados.';
    }catch(e){box.textContent='Erro ao carregar jogos: '+e.message;status.textContent='Falha no carregamento.'}
  },

  async saveManual(gameId){
    const game=this.games.find(g=>g.id===gameId),away=document.querySelector(`#away-${gameId}`).value,home=document.querySelector(`#home-${gameId}`).value,completed=document.querySelector(`#final-${gameId}`).checked;
    if(away===''||home==='')return Bolao.App.toast('Informe os dois placares');
    const awayScore=Number(away),homeScore=Number(home);
    if(!Number.isInteger(awayScore)||!Number.isInteger(homeScore)||awayScore<0||homeScore<0)return Bolao.App.toast('Use placares inteiros e não negativos');
    if(completed&&awayScore===homeScore)return Bolao.App.toast('Resultado final não pode terminar empatado');
    try{
      await Bolao.db.collection('manualResults').doc(`${BOLAO_CONFIG.season}_${this.selectedWeek}_${gameId}`).set({season:BOLAO_CONFIG.season,week:this.selectedWeek,gameId,awayAbbr:game.away.abbr,homeAbbr:game.home.abbr,awayScore,homeScore,completed,updatedBy:Bolao.Auth.user.uid,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
      Bolao.App.toast('Resultado manual salvo');await this.loadManualGames(this.selectedWeek);
    }catch(e){Bolao.App.toast('Erro ao salvar: '+e.message)}
  },

  async deleteManual(gameId){
    try{await Bolao.db.collection('manualResults').doc(`${BOLAO_CONFIG.season}_${this.selectedWeek}_${gameId}`).delete();Bolao.App.toast('Resultado manual removido');await this.loadManualGames(this.selectedWeek)}catch(e){Bolao.App.toast('Erro ao remover: '+e.message)}
  },

  async updateBetSummaries(week){
    const btn=document.querySelector('#update-summaries'),status=document.querySelector('#process-status');
    btn.disabled=true;status.textContent='Calculando distribuições agregadas...';
    try{
      const games=await Bolao.ESPN.games(week,2);
      const now=Date.now();
      const lockedGames=games.filter(g=>now>=new Date(g.date).getTime()-BOLAO_CONFIG.lockMinutes*60000);
      if(!lockedGames.length)throw Error('Nenhum jogo desta rodada encerrou os palpites.');
      const users=await this.activeUsers();
      if(!users.length)throw Error('Nenhum participante ativo encontrado.');
      const batch=Bolao.db.batch();
      for(const game of lockedGames){
        const docId=`${BOLAO_CONFIG.season}_${week}_${game.id}`;
        const picks=await Promise.all(users.map(async user=>{
          const d=await Bolao.db.collection('userPredictions').doc(user.uid).collection('games').doc(docId).get();
          return d.exists?d.data():null;
        }));
        const awayCount=picks.filter(p=>p&&p.winner===game.away.abbr).length;
        const homeCount=picks.filter(p=>p&&p.winner===game.home.abbr).length;
        const submittedCount=awayCount+homeCount;
        const missingCount=users.length-submittedCount;
        const lockAt=firebase.firestore.Timestamp.fromMillis(new Date(game.date).getTime()-BOLAO_CONFIG.lockMinutes*60000);
        batch.set(Bolao.db.collection('weeklyBetSummaries').doc(docId),{
          season:BOLAO_CONFIG.season,week,gameId:game.id,
          awayTeam:game.away.abbr,homeTeam:game.home.abbr,
          awayCount,homeCount,submittedCount,missingCount,
          activeParticipants:users.length,
          awayPercent:submittedCount?+(awayCount*100/submittedCount).toFixed(2):0,
          homePercent:submittedCount?+(homeCount*100/submittedCount).toFixed(2):0,
          lockAt,updatedBy:Bolao.Auth.user.uid,
          updatedAt:firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      await batch.commit();
      status.innerHTML=`<b>Distribuição atualizada.</b><br>${lockedGames.length} jogo(s) com prazo encerrado, ${users.length} participante(s) ativo(s).`;
      Bolao.App.toast('Distribuições atualizadas');
    }catch(e){status.textContent='Erro: '+e.message;Bolao.App.toast('Falha ao atualizar distribuições')}finally{btn.disabled=false}
  },

  async gamesForScoring(week){
    const espnGames=await Bolao.ESPN.games(week,2),manual=await this.manualMap(week);
    return espnGames.map(g=>{const m=manual[g.id];if(!m||!m.completed)return g;return{...g,completed:true,status:'STATUS_FINAL',manual:true,away:{...g.away,score:Number(m.awayScore)},home:{...g.home,score:Number(m.homeScore)}}});
  },

  async processWeek(week){
    const btn=document.querySelector('#process-week'),status=document.querySelector('#process-status');btn.disabled=true;status.textContent='Consultando resultados e palpites...';
    try{
      const games=(await this.gamesForScoring(week)).filter(g=>g.completed&&g.home.score!==g.away.score);
      if(!games.length)throw Error('Nenhum jogo finalizado foi encontrado. Cadastre um resultado manual de teste ou aguarde o resultado da ESPN.');
      const users=await this.activeUsers();if(!users.length)throw Error('Nenhum participante ativo encontrado.');
      const userPicks={};
      for(const user of users){userPicks[user.uid]={};for(const game of games){const id=`${BOLAO_CONFIG.season}_${week}_${game.id}`,d=await Bolao.db.collection('userPredictions').doc(user.uid).collection('games').doc(id).get();if(d.exists)userPicks[user.uid][game.id]=d.data()}}
      const gameStats={};
      for(const game of games){const result=Bolao.Scoring.result(game),submitted=users.map(u=>userPicks[u.uid][game.id]).filter(Boolean),winnerHits=submitted.filter(p=>p.winner===result.winner).length,difficultyHits=submitted.filter(p=>p.winner===result.winner&&p.difficulty===result.difficulty).length,denominator=users.length;gameStats[game.id]={result,source:game.manual?'manual':'espn',submitted:submitted.length,winnerHits,difficultyHits,winnerPct:denominator?winnerHits*100/denominator:0,difficultyPct:denominator?difficultyHits*100/denominator:0}}
      const scores=users.map(user=>{const details=games.map(game=>{const st=gameStats[game.id],pick=userPicks[user.uid][game.id]||null,sc=Bolao.Scoring.scoreGame(pick,game,st.winnerPct,st.difficultyPct);return{gameId:game.id,away:game.away.abbr,home:game.home.abbr,result:st.result,source:st.source,pick:pick?{winner:pick.winner,difficulty:pick.difficulty}:null,winnerPct:+st.winnerPct.toFixed(2),difficultyPct:+st.difficultyPct.toFixed(2),...sc}});return{uid:user.uid,name:user.name||user.email,weekPoints:+details.reduce((s,x)=>s+x.total,0).toFixed(2),winnerHits:details.filter(x=>x.winnerCorrect).length,difficultyHits:details.filter(x=>x.difficultyCorrect).length,details}});
      const batch=Bolao.db.batch(),roundId=`${BOLAO_CONFIG.season}_${week}`;
      batch.set(Bolao.db.collection('roundResults').doc(roundId),{season:BOLAO_CONFIG.season,week,seasonType:2,gamesProcessed:games.length,manualGames:games.filter(g=>g.manual).length,gameStats,scores,processedBy:Bolao.Auth.user.uid,processedAt:firebase.firestore.FieldValue.serverTimestamp()});
      for(const s of scores)batch.set(Bolao.db.collection('roundScores').doc(`${roundId}_${s.uid}`),{season:BOLAO_CONFIG.season,week,userId:s.uid,userName:s.name,points:s.weekPoints,winnerHits:s.winnerHits,difficultyHits:s.difficultyHits,processedAt:firebase.firestore.FieldValue.serverTimestamp()});
      await batch.commit();status.innerHTML=`<b>Rodada ${week} apurada.</b><br>${games.length} jogos, sendo ${games.filter(g=>g.manual).length} resultado(s) manual(is), para ${users.length} participantes.`;Bolao.App.toast('Apuração concluída');
    }catch(e){status.textContent='Erro: '+e.message;Bolao.App.toast('Falha na apuração')}finally{btn.disabled=false}
  }
};
