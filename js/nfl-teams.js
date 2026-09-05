Bolao.teams=[
['NE','New England Patriots','AFC','Leste'],['BUF','Buffalo Bills','AFC','Leste'],['MIA','Miami Dolphins','AFC','Leste'],['NYJ','New York Jets','AFC','Leste'],
['DEN','Denver Broncos','AFC','Oeste'],['KC','Kansas City Chiefs','AFC','Oeste'],['LAC','Los Angeles Chargers','AFC','Oeste'],['LV','Las Vegas Raiders','AFC','Oeste'],
['IND','Indianapolis Colts','AFC','Sul'],['HOU','Houston Texans','AFC','Sul'],['JAX','Jacksonville Jaguars','AFC','Sul'],['TEN','Tennessee Titans','AFC','Sul'],
['BAL','Baltimore Ravens','AFC','Norte'],['CLE','Cleveland Browns','AFC','Norte'],['CIN','Cincinnati Bengals','AFC','Norte'],['PIT','Pittsburgh Steelers','AFC','Norte'],
['DAL','Dallas Cowboys','NFC','Leste'],['NYG','New York Giants','NFC','Leste'],['PHI','Philadelphia Eagles','NFC','Leste'],['WSH','Washington Commanders','NFC','Leste'],
['ARI','Arizona Cardinals','NFC','Oeste'],['SF','San Francisco 49ers','NFC','Oeste'],['LAR','Los Angeles Rams','NFC','Oeste'],['SEA','Seattle Seahawks','NFC','Oeste'],
['ATL','Atlanta Falcons','NFC','Sul'],['NO','New Orleans Saints','NFC','Sul'],['TB','Tampa Bay Buccaneers','NFC','Sul'],['CAR','Carolina Panthers','NFC','Sul'],
['CHI','Chicago Bears','NFC','Norte'],['GB','Green Bay Packers','NFC','Norte'],['DET','Detroit Lions','NFC','Norte'],['MIN','Minnesota Vikings','NFC','Norte']
].map(x=>({abbr:x[0],name:x[1],conference:x[2],division:x[3]}));
Bolao.teamOptions=(filter={})=>'<option value="">Selecione</option>'+Bolao.teams.filter(t=>(!filter.conference||t.conference===filter.conference)&&(!filter.division||t.division===filter.division)).map(t=>`<option value="${t.abbr}">${t.name}</option>`).join('');