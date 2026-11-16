Bolao.Ranking={
  async render(){
    Bolao.App.content(`
      <div class="section-title">
        <h1>Ranking e premiação</h1>
        <select id="rank-mode" style="width:250px">
          <option value="general">Classificação geral</option>
          <option value="preseason">Pré-temporada</option>
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
    const[us,ss,rs,ps]=await Promise.all([
      Bolao.db.collection('users').get(),
      Bolao.db.collection('roundScores').where('season','==',BOLAO_CONFIG.season).get(),
      Bolao.db.collection('roundResults').where('season','==',BOLAO_CONFIG.season).get(),
      Bolao.db.collectionGroup('preseason').where('season','==',String(BOLAO_CONFIG.season)).get().catch(()=>({docs:[]}))
    ]);
    return{
      users:us.docs.map(d=>({uid:d.id,...d.data()})).filter(x=>x.active!==false),
      scores:ss.docs.map(d=>d.data()),
      roundResults:rs.docs.map(d=>({id:d.id,...d.data()})),
      preseason:ps.docs.map(d=>({uid:d.ref.parent.parent.id,...d.data()}))
    };
  },

  rows(users,scores,mode,preseasonData=[]){
    if(mode==='general'){
      return users.map(u=>{
        const a=scores.filter(x=>x.userId===u.uid);
        const regular=a.filter(x=>x.stage==='regular'||!x.stage).reduce((s,x)=>s+(x.points||0),0);
        const playoffs=a.filter(x=>x.stage==='playoffs').reduce((s,x)=>s+(x.points||0),0);
        const userPre=preseasonData.find(p=>p.uid===u.uid);
        const preseason=u.preseasonPoints||userPre?.points||0;
        const winnerHits=a.reduce((s,x)=>s+(x.winnerHits||0),0);
        const difficultyHits=a.reduce((s,x)=>s+(x.difficultyHits||0),0);
        const total=+(regular+playoffs+preseason).toFixed(2);
        return {uid:u.uid,name:u.name||u.email,regular,playoffs,preseason,total,winnerHits,difficultyHits};
      });
    }

    if(mode==='preseason'){
      return users.map(u=>{
        const userPre=preseasonData.find(p=>p.uid===u.uid);
        const preseason=u.preseasonPoints||userPre?.points||0;
        return {uid:u.uid,name:u.name||u.email,regular:0,playoffs:0,preseason,total:+preseason.toFixed(2),winnerHits:0,difficultyHits:0};
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
      const data=await this.source();
      const f=Bolao.Finance.summary(data.users);
      const rows=this.rows(data.users,data.scores,mode,data.preseason).sort((a,b)=>Bolao.Finance.compare(a,b));
      
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

      this.renderAwards(mode,data,rows,f);
      if(mode.includes('_') && mode!=='accumulated_regular' && mode!=='accumulated_playoffs'){
        await this.details(mode);
      }
    }catch(e){
      box.textContent='Erro ao carregar ranking: '+e.message;
    }
  },

  renderAwards(mode,data,rows,f){
    const box=document.querySelector('#awards');
    const {users, scores, roundResults}=data;

    if(mode==='general'){
      const regularRows=this.rows(users,scores,'accumulated_regular',data.preseason).sort((a,b)=>Bolao.Finance.compare(a,b));
      const playoffRows=this.rows(users,scores,'accumulated_playoffs',data.preseason).sort((a,b)=>Bolao.Finance.compare(a,b));
      
      const regAwards=Bolao.Finance.accumulatedAwards(regularRows,f.regularPool);
      const playAwards=Bolao.Finance.accumulatedAwards(playoffRows,f.playoffPool);
      const finalAwards=Bolao.Finance.finalAwards(rows,f.finalPool,f.percentages);

      const hasPlayoffPoints=playoffRows.some(r=>r.playoffs>0);

      const weekWinnersList=[];
      for(let i=1; i<=18; i++){
        const res=roundResults.find(r=>r.id===`${BOLAO_CONFIG.season}_regular_${i}` || r.id===`${BOLAO_CONFIG.season}_${i}`);
        if(res && res.scores && res.scores.length){
          const sortedScores=[...res.scores].sort((a,b)=>b.weekPoints-a.weekPoints);
          const topPts=sortedScores[0].weekPoints;
          if(topPts>0){
            const winners=sortedScores.filter(s=>s.weekPoints===topPts).map(s=>s.name).join(', ');
            weekWinnersList.push(`<tr><td>Semana ${i}</td><td>${winners}</td><td>${Bolao.Finance.money(f.roundPrize / sortedScores.filter(s=>s.weekPoints===topPts).length)} cada</td></tr>`);
          }
        }
      }
      const playoffNames=['Wild Card','Divisional','Finais de Conferência','Super Bowl'];
      for(let i=1; i<=3; i++){
        const res=roundResults.find(r=>r.id===`${BOLAO_CONFIG.season}_playoffs_${i}`);
        if(res && res.scores && res.scores.length){
          const sortedScores=[...res.scores].sort((a,b)=>b.weekPoints-a.weekPoints);
          const topPts=sortedScores[0].weekPoints;
          if(topPts>0){
            const winners=sortedScores.filter(s=>s.weekPoints===topPts).map(s=>s.name).join(', ');
            weekWinnersList.push(`<tr><td>${playoffNames[i-1]}</td><td>${winners}</td><td>${Bolao.Finance.money(f.roundPrize / sortedScores.filter(s=>s.weekPoints===topPts).length)} cada</td></tr>`);
          }
        }
      }

      const financialSummary=users.map(u=>{
        let prizeTotal=0;
        const finalMatch=finalAwards.find(x=>x.name===(u.name||u.email));
        if(finalMatch) prizeTotal+=finalMatch.amount;

        const regMatch=regAwards.find(x=>x.name===(u.name||u.email));
        if(regMatch) prizeTotal+=regMatch.amount;

        if(hasPlayoffPoints){
          const playMatch=playAwards.find(x=>x.name===(u.name||u.email));
          if(playMatch) prizeTotal+=playMatch.amount;
        }

        roundResults.forEach(res=>{
          if(res.scores && res.scores.length){
            const sorted=[...res.scores].sort((a,b)=>b.weekPoints-a.weekPoints);
            const top=sorted[0].weekPoints;
            if(top>0){
              const winners=sorted.filter(s=>s.weekPoints===top);
              const isWinner=winners.some(s=>s.uid===u.uid || s.name===(u.name||u.email));
              if(isWinner){
                if(!res.id.includes('playoffs_4')){
                  prizeTotal += (f.roundPrize / winners.length);
                }
              }
            }
          }
        });

        const netBalance = prizeTotal - 100;
        return { name: u.name||u.email, prizeTotal, netBalance };
      }).sort((a,b)=>b.prizeTotal-a.prizeTotal);

      box.innerHTML=`
        <h2>Premiação e Balanço Financeiro</h2>

        <h3>🏆 Classificação Geral (Final)</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Posição</th><th>Participante</th><th>Prêmio Estimado</th></tr></thead>
            <tbody>
              ${finalAwards.length ? finalAwards.map((x,i)=>`<tr><td><b>${i+1}º</b></td><td>${x.name}</td><td><b>${Bolao.Finance.money(x.amount)}</b></td></tr>`).join('') : '<tr><td colspan="3" class="muted">A definir</td></tr>'}
            </tbody>
          </table>
        </div>

        <h3>🏈 Campeão da Temporada Regular</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Posição</th><th>Participante</th><th>Prêmio Estimado</th></tr></thead>
            <tbody>
              ${regAwards.length ? regAwards.map((x,i)=>`<tr><td><b>${i+1}º</b></td><td>${x.name}</td><td><b>${Bolao.Finance.money(x.amount)}</b></td></tr>`).join('') : '<tr><td colspan="3" class="muted">A definir</td></tr>'}
            </tbody>
          </table>
        </div>

        <h3>⭐ Campeão dos Playoffs</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Posição</th><th>Participante</th><th>Prêmio Estimado</th></tr></thead>
            <tbody>
              ${hasPlayoffPoints && playAwards.length ? playAwards.map((x,i)=>`<tr><td><b>${i+1}º</b></td><td>${x.name}</td><td><b>${Bolao.Finance.money(x.amount)}</b></td></tr>`).join('') : '<tr><td colspan="3" class="muted">Aguardando apuração dos playoffs</td></tr>'}
            </tbody>
          </table>
        </div>

        <h3>📅 Vencedores das Rodadas Premiadas</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Rodada / Etapa</th><th>Vencedor(es)</th><th>Prêmio</th></tr></thead>
            <tbody>
              ${weekWinnersList.length ? weekWinnersList.join('') : '<tr><td colspan="3" class="muted">Nenhuma rodada apurada até o momento.</td></tr>'}
            </tbody>
          </table>
        </div>

        <h3>💵 Balanço Financeiro (Quanto cada um vai receber ou pagar)</h3>
        <p class="muted">Baseado na taxa de inscrição de R$ 100,00 e nos prêmios conquistados até o momento.</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Participante</th><th>Total de Prêmios</th><th>Saldo Líquido (Receber / Pagar)</th></tr></thead>
            <tbody>
              ${financialSummary.map(item=>`
                <tr>
                  <td><b>${item.name}</b></td>
                  <td>${Bolao.Finance.money(item.prizeTotal)}</td>
                  <td><span style="color: ${item.netBalance >= 0 ? 'var(--gold, #27ae60)' : '#e74c3c'}"><b>${item.netBalance >= 0 ? '+ ' : ''}${Bolao.Finance.money(item.netBalance)}</b> ${item.netBalance >= 0 ? '(A receber)' : '(A pagar)'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

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
    }else if(mode==='preseason'){
      box.innerHTML=`
        <h2>Pontuação da Pré-temporada</h2>
        <p class="muted">Desempenho dos participantes nos palpites de longo prazo da pré-temporada.</p>
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
              ${reg.length ? reg.map((x,i)=>`<tr><td><b>${i+1}º</b></td><td>${x.name}</td><td><b>${Bolao.Finance.money(x.amount)}</b></td></tr>`).join('') : '<tr><td colspan="3" class="muted">A definir</td></tr>'}
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
              ${rows.some(r=>r.playoffs>0) && play.length ? play.map((x,i)=>`<tr><td><b>${i+1}º</b></td><td>${x.name}</td><td><b>${Bolao.Finance.money(x.amount)}</b></td></tr>`).join('') : '<tr><td colspan="3" class="muted">Aguardando apuração dos playoffs</td></tr>'}
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
