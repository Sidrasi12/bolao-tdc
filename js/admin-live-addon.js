Bolao.Admin.publishLiveData=async function(week){
  const games=await Bolao.ESPN.games(week,2);
  const now=Date.now();
  const closed=games.filter(game=>
    now>=new Date(game.date).getTime()-BOLAO_CONFIG.lockMinutes*60000
  );

  if(!closed.length){
    throw Error('Nenhum jogo desta rodada encerrou os palpites.');
  }

  const users=await this.activeUsers();
  const batch=Bolao.db.batch();

  for(const game of closed){
    const id=`${BOLAO_CONFIG.season}_${week}_${game.id}`;
    const picks=await Promise.all(users.map(async user=>{
      const doc=await Bolao.db.collection('userPredictions')
        .doc(user.uid).collection('games').doc(id).get();
      return doc.exists?doc.data():null;
    }));

    const awayCount=picks.filter(pick=>pick?.winner===game.away.abbr).length;
    const homeCount=picks.filter(pick=>pick?.winner===game.home.abbr).length;
    const submittedCount=awayCount+homeCount;
    const awayPct=submittedCount?+(awayCount*100/submittedCount).toFixed(2):0;
    const homePct=submittedCount?+(homeCount*100/submittedCount).toFixed(2):0;
    const lockAt=firebase.firestore.Timestamp.fromMillis(
      new Date(game.date).getTime()-BOLAO_CONFIG.lockMinutes*60000
    );
    const spread=Bolao.ESPN.spreadText(game);
    const favorite=Bolao.ESPN.favorite(game)||'Não definido';

    batch.set(Bolao.db.collection('weeklyBetSummaries').doc(id),{
      season:BOLAO_CONFIG.season,
      week,
      gameId:game.id,
      awayTeam:game.away.abbr,
      homeTeam:game.home.abbr,
      awayCount,
      homeCount,
      submittedCount,
      missingCount:users.length-submittedCount,
      activeParticipants:users.length,
      awayPercent:awayPct,
      homePercent:homePct,
      lockAt,
      updatedBy:Bolao.Auth.user.uid,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    });

    const participants=users.map((user,index)=>({
      name:user.name||user.email||`Participante ${index+1}`,
      winner:picks[index]?.winner||'',
      difficulty:picks[index]?.difficulty||''
    }));

    batch.set(Bolao.db.collection('weeklyPickReveals').doc(id),{
      season:BOLAO_CONFIG.season,
      week,
      gameId:game.id,
      awayTeam:game.away.abbr,
      homeTeam:game.home.abbr,
      participants,
      winnerPct:Math.max(awayPct,homePct),
      awayPct,
      homePct,
      activeParticipants:users.length,
      spread,
      favorite,
      lockAt,
      updatedBy:Bolao.Auth.user.uid,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  await batch.commit();
  return closed.length;
};

const originalAdminRender=Bolao.Admin.render.bind(Bolao.Admin);
Bolao.Admin.render=async function(){
  await originalAdminRender();
  if(Bolao.Auth.user.role!=='admin')return;

  const grid=document.querySelector('.grid');
  if(!grid||document.querySelector('#publish-live'))return;

  const card=document.createElement('div');
  card.className='card';
  card.innerHTML=`
    <h3>Palpites e placar ao vivo</h3>
    <label>Rodada
      <select id="live-week">
        ${Array.from({length:18},(_,i)=>
          `<option value="${i+1}">${i+1}</option>`
        ).join('')}
      </select>
    </label>
    <button id="publish-live">Publicar palpites fechados</button>
    <p class="muted">
      Publica as escolhas e congela spread e favorito dos jogos encerrados.
    </p>`;
  grid.appendChild(card);

  card.querySelector('#publish-live').onclick=async()=>{
    const button=card.querySelector('#publish-live');
    const status=document.querySelector('#process-status');
    button.disabled=true;
    try{
      const count=await Bolao.Admin.publishLiveData(
        +card.querySelector('#live-week').value
      );
      status.innerHTML=`<b>Palpites publicados.</b><br>${count} jogo(s) atualizado(s), com spread e favorito preservados.`;
      Bolao.App.toast('Palpites publicados');
    }catch(error){
      status.textContent='Erro: '+error.message;
      Bolao.App.toast('Falha ao publicar');
    }finally{
      button.disabled=false;
    }
  };
};
