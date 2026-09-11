Bolao.LiveGames={
  timer:null,

  async load(week,games){
    const now=Date.now();
    const entries=await Promise.all(games.map(async game=>{
      const lockAt=new Date(game.date).getTime()-BOLAO_CONFIG.lockMinutes*60000;
      if(now<lockAt)return[game.id,null];

      const id=`${BOLAO_CONFIG.season}_${week}_${game.id}`;
      const reveal=await Bolao.db.collection('weeklyPickReveals')
        .doc(id).get().catch(()=>null);
      return[game.id,reveal?.exists?reveal.data():null];
    }));
    return Object.fromEntries(entries);
  },

  points(value){
    return Number(value||0).toLocaleString('pt-BR',{
      minimumFractionDigits:1,
      maximumFractionDigits:2
    });
  },

  status(game){
    if(game.completed)return'Final';
    if(game.state==='in'){
      return game.statusDetail||`${game.period}º período · ${game.clock}`;
    }
    return'';
  },

  displayedSpread(game,reveal){
    const live=Bolao.ESPN.spreadText(game);
    if(live&&live!=='Spread indisponível')return live;
    return reveal?.spread||'Spread indisponível';
  },

  displayedFavorite(game,reveal){
    const live=Bolao.ESPN.favorite(game);
    if(live&&live!=='Não definido')return live;
    return reveal?.favorite||'Não definido';
  },

  html(game,reveal,locked){
    const status=this.status(game);
    const spread=this.displayedSpread(game,reveal);
    const favorite=this.displayedFavorite(game,reveal);

    let html=`
      <section class="score-panel ${game.state==='in'?'is-live':''}">
        <div class="score-panel-title">
          <span>PLACAR</span>
          ${game.state==='in'?'<b>AO VIVO</b>':''}
        </div>
        <div class="score-row">
          <span class="score-team">${game.away.abbr}</span>
          <strong>${game.away.score}</strong>
          <span class="score-x">×</span>
          <strong>${game.home.score}</strong>
          <span class="score-team">${game.home.abbr}</span>
        </div>
        ${status?`<div class="score-status">${status}</div>`:''}
      </section>

      <section class="odds-card">
        <div class="odds-column">
          <span>SPREAD</span>
          <strong>${spread}</strong>
        </div>
        <div class="odds-column">
          <span>FAVORITO</span>
          <strong>${favorite}</strong>
        </div>
      </section>`;

    if(!locked)return html;
    if(!reveal){
      return html+'<div class="notice game-note">Palpites individuais aguardando publicação.</div>';
    }

    const participants=reveal.participants||[];
    const active=Number(reveal.activeParticipants||participants.length||1);
    const result=Bolao.Scoring.liveResult(game);
    const winnerPct=result
      ?participants.filter(item=>item.winner===result.winner).length*100/active
      :0;
    const difficultyPct=result
      ?participants.filter(item=>
        item.winner===result.winner&&item.difficulty===result.difficulty
      ).length*100/active
      :0;
    const provisional=!game.completed;

    return html+`
      <details class="live-picks">
        <summary>
          <b>Palpites e ${provisional?'pontuação provisória':'pontuação final'}</b>
        </summary>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Participante</th><th>Palpite</th><th>Pontos</th></tr>
            </thead>
            <tbody>
              ${participants.map(item=>{
                const pick=item.winner
                  ?{winner:item.winner,difficulty:item.difficulty}
                  :null;
                const score=Bolao.Scoring.scoreAgainst(
                  pick,game,winnerPct,difficultyPct,provisional
                );
                const label=pick
                  ?`${item.winner}${item.difficulty?' · '+item.difficulty:''}`
                  :'Sem palpite';
                return`<tr><td>${item.name}</td><td>${label}</td><td class="live-points">${this.points(score.total)}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <p class="muted">
          ${provisional
            ?'Pontuação provisória, sujeita a alteração até o final.'
            :'A pontuação oficial depende da apuração da rodada.'}
        </p>
      </details>`;
  }
};

const originalWeekly=Bolao.Predictions.weekly.bind(Bolao.Predictions);
Bolao.Predictions.weekly=async function(){
  clearInterval(Bolao.LiveGames.timer);
  await originalWeekly();

  const week=+(localStorage.getItem('bolao_week')||1);
  const title=document.querySelector('.section-title');

  if(title&&!document.querySelector('#refresh-live')){
    const button=document.createElement('button');
    button.id='refresh-live';
    button.type='button';
    button.className='secondary';
    button.textContent='↻ Atualizar';
    title.appendChild(button);
    button.onclick=()=>refresh(true);
  }

  await refresh(false);
  Bolao.LiveGames.timer=setInterval(()=>refresh(false),30000);

  async function refresh(showToast){
    const button=document.querySelector('#refresh-live');
    if(button){
      button.disabled=true;
      button.textContent='Atualizando...';
    }

    try{
      Bolao.Predictions.games=await Bolao.ESPN.games(week);
      const data=await Bolao.LiveGames.load(week,Bolao.Predictions.games);

      document.querySelectorAll('.game-card').forEach((card,index)=>{
        const game=Bolao.Predictions.games[index];
        if(!game)return;

        const locked=Date.now()>=
          new Date(game.date).getTime()-BOLAO_CONFIG.lockMinutes*60000;
        let box=card.querySelector('.live-enhancement');
        if(!box){
          box=document.createElement('div');
          box.className='live-enhancement';
          card.appendChild(box);
        }
        box.innerHTML=Bolao.LiveGames.html(game,data[game.id],locked);
      });

      if(showToast)Bolao.App.toast('Placar atualizado');
    }catch(error){
      if(showToast)Bolao.App.toast('Não foi possível atualizar o placar');
      console.error('Falha ao atualizar os jogos:',error);
    }finally{
      if(button){
        button.disabled=false;
        button.textContent='↻ Atualizar';
      }
    }
  }
};
