Bolao.Scoring={
 factor(p){return p>=100?1:p>=85?1.1:p>=70?1.2:p>=55?1.4:p>=40?1.6:p>=21?1.8:p>=10?2:2.5},
 result(game){
   if(!game.completed||game.home.score===game.away.score)return null;
   return {winner:game.home.score>game.away.score?game.home.abbr:game.away.abbr,difficulty:Bolao.ESPN.difficulty(game)};
 },
 scoreGame(pick,game,winnerPct,difficultyPct){
   const result=this.result(game);if(!result||!pick)return {winnerPoints:0,difficultyPoints:0,total:0,winnerCorrect:false,difficultyCorrect:false};
   const winnerCorrect=pick.winner===result.winner;
   const difficultyCorrect=winnerCorrect&&pick.difficulty===result.difficulty;
   const winnerBase=game.playoff?6:3,difficultyBase=game.playoff?2:1;
   const winnerPoints=winnerCorrect?winnerBase*this.factor(winnerPct):0;
   const difficultyPoints=difficultyCorrect?difficultyBase*this.factor(difficultyPct):0;
   return {winnerPoints:+winnerPoints.toFixed(2),difficultyPoints:+difficultyPoints.toFixed(2),total:+(winnerPoints+difficultyPoints).toFixed(2),winnerCorrect,difficultyCorrect};
 }
};
