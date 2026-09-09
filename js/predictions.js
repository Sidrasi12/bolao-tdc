Bolao.Predictions={
  gameDoc(week, gameId) {
  return Bolao.db
    .collection('userPredictions')
    .doc(Bolao.Auth.user.uid)
    .collection('games')
    .doc(`${BOLAO_CONFIG.season}_${week}_${gameId}`);
},
  async loadWeekly(week,games){
    const entries=await Promise.all(games.map(async g=>{
      const d=await this.gameDoc(week,g.id).get();
      return [g.id,d.exists?{winner:d.data().winner,difficulty:d.data().difficulty}:null]
    }));
    return Object.fromEntries(entries.filter(([,v])=>v));
  },
  async saveGame(week,game,pick){
    const start=firebase.firestore.Timestamp.fromDate(new Date(game.date));
    const lock=firebase.firestore.Timestamp.fromMillis(start.toMillis()-BOLAO_CONFIG.lockMinutes*60000);
    await this.gameDoc(week,game.id).set({
      userId:Bolao.Auth.user.uid,userName:Bolao.Auth.user.name,
      season:BOLAO_CONFIG.season,week,gameId:game.id,
      winner:pick.winner||'',difficulty:pick.difficulty||'',
      gameStart:start,lockAt:lock,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  },
  async weekly(){
    const week=+(localStorage.getItem('bolao_week')||1);
    Bolao.App.content(`<div class="section-title"><h1>Palpites semanais</h1><select id="week" style="width:150px">${Array.from({length:18},(_,i)=>`<option ${i+1===week?'selected':''}>${i+1}</option>`).join('')}</select></div><div class="notice">Seus palpites permanecem privados até o encerramento de cada jogo.</div><div id="games" class="card" style="margin-top:14px">Carregando jogos...</div>`);
    document.querySelector('#week').onchange=e=>{localStorage.setItem('bolao_week',e.target.value);this.weekly()};
    try{this.games=await Bolao.ESPN.games(week);this.picks=await this.loadWeekly(week,this.games);this.renderGames(week)}
    catch(e){document.querySelector('#games').innerHTML=`<div class="notice">Não foi possível carregar: ${e.message}</div>`}
  },
  renderGames(week){
    const now=Date.now();
    document.querySelector('#games').innerHTML=this.games.length?this.games.map(g=>{
      const locked=now>=new Date(g.date).getTime()-BOLAO_CONFIG.lockMinutes*60000,p=this.picks[g.id]||{};
      return `<article class="game-card ${locked?'locked':''}"><div class="game"><div class="team"><img src="${g.away.logo}">${g.away.name}</div><div class="game-meta">${new Date(g.date).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}<div class="venue">🏟️ ${g.venue}${g.venueCity?' · '+g.venueCity:''}</div><div>${locked?'🔒 Palpite encerrado':'🔐 Palpite privado'}</div></div><div class="team">${g.home.name}<img src="${g.home.logo}"></div></div><div class="choices"><button class="choice ${p.winner===g.away.abbr?'selected':''}" data-g="${g.id}" data-w="${g.away.abbr}">${g.away.abbr}</button><button class="choice ${p.winner===g.home.abbr?'selected':''}" data-g="${g.id}" data-w="${g.home.abbr}">${g.home.abbr}</button><button class="choice ${p.difficulty==='VD'?'selected':''}" data-g="${g.id}" data-d="VD">VD</button><button class="choice ${p.difficulty==='VF'?'selected':''}" data-g="${g.id}" data-d="VF">VF</button></div></article>`
    }).join(''):'<p>Nenhum jogo encontrado.</p>';
    document.querySelectorAll('.choice').forEach(b=>b.onclick=async()=>{
      const game=this.games.find(g=>g.id===b.dataset.g),id=game.id;
      this.picks[id]=this.picks[id]||{};
      if(b.dataset.w)this.picks[id].winner=b.dataset.w;
      if(b.dataset.d)this.picks[id].difficulty=b.dataset.d;
      try{await this.saveGame(week,game,this.picks[id]);this.renderGames(week);Bolao.App.toast('Palpite salvo com segurança')}
      catch(e){Bolao.App.toast(e.code==='permission-denied'?'Prazo encerrado ou operação não permitida':('Erro ao salvar: '+e.message))}
    })
  },
  async preseason(){
    const ref = Bolao.db
  .collection('userPredictions')
  .doc(Bolao.Auth.user.uid)
  .collection('preseason')
  .doc(String(BOLAO_CONFIG.season));

const snap = await ref.get();
const p = snap.exists ? snap.data().picks || {} : {};
    const divs=[['AFC','Leste'],['AFC','Oeste'],['AFC','Sul'],['AFC','Norte'],['NFC','Leste'],['NFC','Oeste'],['NFC','Sul'],['NFC','Norte']];
    const field=(id,label,filter={})=>`<label>${label}<select id="${id}">${Bolao.teamOptions(filter)}</select></label>`;
    Bolao.App.content(`<div class="section-title"><h1>Pré-temporada</h1><span class="badge">Prazo: 9 de setembro, às 21h20</span></div><div class="notice">Os palpites ficam privados até o prazo final da pré-temporada.</div><form id="pre-form" class="card" style="margin-top:14px"><div class="form-grid">${field('champion','Campeão do Super Bowl')}${field('runner','Vice-campeão')}${divs.map(([c,d])=>field(`div_${c}_${d}`,`${c} ${d}`,{conference:c,division:d})).join('')}${field('worst','Pior campanha')}<label>MVP<input id="mvp" placeholder="Nome do jogador"></label></div><h3>Wild Cards</h3><div class="form-grid">${[1,2,3].map(i=>field('wcAFC'+i,'Wildcard AFC '+i,{conference:'AFC'})).join('')}${[1,2,3].map(i=>field('wcNFC'+i,'Wildcard NFC '+i,{conference:'NFC'})).join('')}</div><button>Salvar palpites</button></form>`);
    Object.entries(p).forEach(([k,v])=>{const e=document.getElementById(k);if(e)e.value=v});
    const deadline=firebase.firestore.Timestamp.fromDate(new Date(BOLAO_CONFIG.preseasonDeadline));
    if(Date.now()>=deadline.toMillis())document.querySelector('#pre-form').classList.add('locked');
    document.querySelector('#pre-form').onsubmit=async e=>{
      e.preventDefault();const picks={};e.target.querySelectorAll('select,input').forEach(x=>picks[x.id]=x.value);
      try{await ref.set({userId:Bolao.Auth.user.uid,userName:Bolao.Auth.user.name,season:BOLAO_CONFIG.season,deadline,picks,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});Bolao.App.toast('Pré-temporada salva com segurança')}
      catch(x){Bolao.App.toast(x.code==='permission-denied'?'Prazo encerrado ou operação não permitida':('Erro ao salvar: '+x.message))}
    }
  }
};
