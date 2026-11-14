Bolao.Ranking={
  async render(){
    Bolao.App.content(`
      <div class="section-title">
        <h1>Ranking e premiação</h1>
        <select id="rank-mode" style="width:250px">
          <option value="general">Classificação geral</option>
          <option value="accumulated_regular">Temporada regular (Acumulado)</option>
          <option value="accumulated_playoffs">Playoffs (Acumulado)</option>
          <optgroup label="Rodadas - Temporada Regular">
            ${Array.from({length:18},(_,i)=>`<option value="regular_${i+1}">Rodada ${i+1}</option>`).join('')}
          </optgroup>
          <optgroup label="Rodadas - Playoffs">
            ${['Wild Card','Divisional','Finais de Conferência','Super Bowl'].map((x,i)=>`<option value="playoffs_${i+1}">${x}</option>`).join('')}
          </optgroup>
        </select>
      </div>
      <div id="finance-summary" class="grid"></div>
      <div class="card" id="ranking" style="margin-top:16px">Carregando...</div>
      <div class="card" id="awards" style="margin-top:16px"></div>
      <div class="card" id="round-details" style="margin-top:16px"></div>
    `);
    document.querySelector('#rank-mode').onchange=e=>this.load(e.target.value);
    await this.load('general');
  },

  async source(){
    const[us,ss]=await Promise.all([
      Bolao.db.collection('users').get(),
      Bolao.db.collection('roundScores').where('season','==',BOLAO_CONFIG.season).get()
    ]);
    return{
      users:us.docs.map(d=>({uid:d.id,...d.data()})).filter(x=>x.active!==false),
      scores:ss.docs.map(d=>d.data())
    };
  },

  rows(users,scores,mode){
    if(mode==='general'){
      return users.map(u=>{
        const a=scores.filter(x=>x.userId===u.uid);
        const regular=a.filter(x=>x.stage==='regular'||!x.stage).reduce((s,x)=>s+(x.points||0),0);
        const playoffs=a.filter(x=>x.stage==='playoffs').reduce((s,x)=>s+(x.points||0),0);
        const preseason=u.preseasonPoints||0;
        const winnerHits=a.reduce((s,x)=>s+(x.winnerHits||0),0);
        const difficultyHits=a.reduce((s,x)=>s+(x.difficultyHits||0),0);
        const total=+(regular+playoffs+preseason).toFixed(2);
        return {uid:u.uid,name:u.name||u.email,regular,playoffs,preseason,total,winnerHits,difficultyHits};
      });
    }

    if(mode==='accumulated_regular'){
      return users.map(u=>{
        const a=scores.filter(x=>x.userId===u.uid&&(x.stage==='regular'||!x.stage));
        const regular=a.reduce((s,x)=>s+(x.points||0),0);
        const winnerHits=a.reduce((s,x)=>s+(x.winnerHits||0),0);
        const difficultyHits=a.reduce((s,x)=>s+(x.difficultyHits||0),0);
        return {uid:u.uid,name:u.name||u.email,regular,playoffs:0,preseason:0,total:+regular.toFixed(2),winnerHits,difficultyHits};
      });
    }

    if(mode==='accumulated_playoffs'){
      return users.map(u=>{
        const a=scores.filter(x=>x.userId===u.uid&&x.stage==='playoffs');
        const playoffs=a.reduce((s,x)=>s+(x.points||0),0);
        const winnerHits=a.reduce((s,x)=>s+(x.winnerHits||0),0);
        const difficultyHits=a.reduce((s,x)=>s+(x.difficultyHits||0),0);
        return {uid:u.uid,name:u.name||u.email,regular:0,playoffs,preseason:0,total:+playoffs.toFixed(2),winnerHits,difficultyHits};
      });
    }

    const[stage,w]=mode.split('_');
    return users.map(u=>{
      const x=scores.find(s=>s.userId===u.uid&&(s.stage===stage||(stage==='regular'&&!s.stage))&&s.week===+w);
      const points=x?.points||0;
      return{
        uid:u.uid,
        name:u.name||u.email,
        regular:stage==='regular'?points:0,
        playoffs:stage==='playoffs'?points:0,
        preseason:0,
        total:points,
        points,
        winnerHits:x?.winnerHits||0,
        difficultyHits:x?.difficultyHits||0
      };
    });
  },

  async load(mode){
    const box=document.querySelector('#ranking'),awardsBox=document.querySelector('#awards'),detail=document.querySelector('#round-details');
    box.textContent='Carregando...';
    awardsBox.innerHTML='';
    detail.innerHTML='';
    try{
      const{users,scores}=await this.source();
      const f=Bolao.Finance.summary(users);
      const rows=this.rows(users,scores,mode).sort((a,b)=>Bolao.Finance.compare(a,b));
      
      document.querySelector('#finance-summary').innerHTML=`
        <div class="card"><div class="muted">Participantes ativos</div><div class="metric">${f.participants}</div></div>
        <div class="card"><div class="muted">Arrecadação</div><div class="metric">${Bolao.Finance.money(f.total)}</div></div>
        <div class="card"><div class="muted">Prêmio por rodada</div><div class="metric">${Bolao.Finance.money(f.roundPrize)}</div></div>
      `;

      box.innerHTML=`
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Participante</th><th>Regular</th><th>Playoffs</th><th>Pré</th><th>Total</th><th>Vencedores</th><th>VD/VF</th></tr>
            </thead>
            <tbody>
              ${rows.map((r,i)=>`
                <tr class="${r.uid===Bolao.Auth.user.uid?'me':''}">
                  <td class="rank">${i+1}</td>
                  <td>${r.name}</td>
                  <td>${r.regular.toFixed(2)}</td>
                  <td>${r.playoffs.toFixed(2)}</td>
                  <td>${r.preseason.toFixed(2)}</td>
                  <td><b>${r.total.toFixed(2)}</b></td>
                  <td>${r.winnerHits}</td>
                  <td>${r.difficultyHits}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      this.renderAwards(mode,users,scores,rows,f);
      if(mode.includes('_') && mode!=='accumulated_regular' && mode!=='accumulated_playoffs'){
        await this.details(mode);
      }
    }catch(e){
      box.textContent='Erro ao carregar ranking: '+e.message;
    }
  },

  renderAwards(mode,users,scores,rows,f){
    const box=document.querySelector('#awards');
    if(mode==='general'){
      const regularRows=this.rows(users,scores,'accumulated_regular');
      const playoffRows=this.rows(users,scores,'accumulated_playoffs');
      const reg=Bolao.Finance.accumulatedAwards(regularRows,f.regularPool);
      const play=Bolao.Finance.accumulatedAwards(playoffRows,f.playoffPool);
      const final=Bolao.Finance.finalAwards(rows,f.finalPool,f.percentages);

      box.innerHTML=`
        <h2>Premiação estimada para todos os participantes</h2>
        
        <h3>🏆 Classificação Geral (Final)</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Posição</th><th>Participante</th><th>Prêmio Estimado</th></tr></thead>
            <tbody>
              ${final.length ? final.map(x=>`<tr><td><b>${x.position}º</b></td><td>${x.name}</td><td><b>${Bolao.Finance.money(x.amount)}</b></td></tr>`).join('') : '<tr><td colspan="3" class="muted">A definir</td></tr>'}
            </tbody>
          </table>
        </div>

        <h3>🏈 Campeão da Temporada Regular</h3>
        <p>${reg.map(x=>`<b>${x.name}</b>: ${Bolao.Finance.money(x.amount)}`).join(' · ')||'A definir'}</p>

        <h3>⭐ Campeão dos Playoffs</h3>
        <p>${play.map(x=>`<b>${x.name}</b>: ${Bolao.Finance.money(x.amount)}`).join(' · ')||'A definir'}</p>

        <h3>💰 Resumo dos Fundos de Premiação</h3>
        <div class="table-wrap">
          <table>
            <tr><th>Fundo</th><th>Valor Total</th></tr>
            <tr><td>Premiação Final (Classificação Geral)</td><td>${Bolao.Finance.money(f.finalPool)}</td></tr>
            <tr><td>Temporada Regular (Acumulado)</td><td>${Bolao.Finance.money(f.regularPool)}</td></tr>
            <tr><td>Playoffs (Acumulado)</td><td>${Bolao.Finance.money(f.playoffPool)}</td></tr>
            <tr><td>21 Rodadas (Premiação por rodada)</td><td>${Bolao.Finance.money(f.roundPool)}</td></tr>
          </table>
        </div>
      `;
    }else if(mode==='accumulated_regular'){
      const reg=Bolao.Finance.accumulatedAwards(rows,f.regularPool);
      box.innerHTML=`
        <h2>Premiação da Temporada Regular (Acumulado)</h2>
        <p>Fundo total da temporada regular: <strong>${Bolao.Finance.money(f.regularPool)}</strong></p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Posição</th><th>Participante</th><th>Prêmio Estimado</th></tr></thead>
            <tbody>
              ${reg.length ? reg.map(x=>`<tr><td><b>${x.position}º</b></td><td>${x.name}</td><td><b>${Bolao.Finance.money(x.amount)}</b></td></tr>`).join('') : '<tr><td colspan="3" class="muted">A definir</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    }else if(mode==='accumulated_playoffs'){
      const play=Bolao.Finance.accumulatedAwards(rows,f.playoffPool);
      box.innerHTML=`
        <h2>Premiação dos Playoffs (Acumulado)</h2>
        <p>Fundo total dos playoffs: <strong>${Bolao.Finance.money(f.playoffPool)}</strong></p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Posição</th><th>Participante</th><th>Prêmio Estimado</th></tr></thead>
            <tbody>
              ${play.length ? play.map(x=>`<tr><td><b>${x.position}º</b></td><td>${x.name}</td><td><b>${Bolao.Finance.money(x.amount)}</b></td></tr>`).join('') : '<tr><td colspan="3" class="muted">A definir</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    }else{
      const[stage,w]=mode.split('_');
      const eligible=stage==='regular'||(stage==='playoffs'&&+w<=3);
      const a=eligible?Bolao.Finance.roundAwards(rows,f.roundPrize):[];
      box.innerHTML=eligible?`
        <h2>Prêmio da Rodada</h2>
        <p>Valor total do prêmio desta rodada: <strong>${Bolao.Finance.money(f.roundPrize)}</strong></p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Participante</th><th>Prêmio da Rodada</th></tr></thead>
            <tbody>
              ${a.length ? a.map(x=>`<tr><td>${x.name}</td><td><b>${Bolao.Finance.money(x.amount)}</b></td></tr>`).join('') : '<tr><td colspan="2" class="muted">A definir após a apuração da rodada.</td></tr>'}
            </tbody>
          </table>
        </div>
      `:`
        <h2>Premiação da Etapa</h2>
        <p>O Super Bowl pontua nos playoffs e na classificação geral, mas não possui prêmio específico de rodada conforme o regulamento.</p>
      `;
    }
  },

  async details(mode){
    const[stage,w]=mode.split('_');
    const ids=[`${BOLAO_CONFIG.season}_${stage}_${w}`,stage==='regular'?`${BOLAO_CONFIG.season}_${w}`:''];
    let d=null;
    for(const id of ids.filter(Boolean)){
      const x=await Bolao.db.collection('roundResults').doc(id).get();
      if(x.exists){d=x;break}
    }
    const box=document.querySelector('#round-details');
    if(!d){
      box.innerHTML='<p class="muted">Esta etapa ainda não foi apurada.</p>';
      return;
    }
    const x=d.data();
    box.innerHTML=`
      <h2>Detalhamento da etapa</h2>
      ${(x.scores||[]).map(s=>`
        <details>
          <summary><b>${s.name}</b> · ${s.weekPoints.toFixed(2)} pontos</summary>
          <div class="table-wrap">
            <table>
              <tr><th>Jogo</th><th>Palpite</th><th>Resultado</th><th>Pontos</th></tr>
              ${s.details.map(g=>`
                <tr>
                  <td>${g.away} × ${g.home}</td>
                  <td>${g.pick?g.pick.winner+' '+g.pick.difficulty:'Sem palpite'}</td>
                  <td>${g.result.winner} ${g.result.difficulty}</td>
                  <td>${g.total.toFixed(2)}</td>
                </tr>
              `).join('')}
            </table>
          </div>
        </details>
      `).join('')}
    `;
  }
};
