const U={'user-agent':'ATPTour/3.0 (Android)',accept:'application/json'};
for (const u of ['https://app.atptour.com/api/v2/gateway/rankings/ranksglrollrange?fromRank=1&toRank=200','https://app.atptour.com/api/gateway/rankings.ranksglrollrange?fromRank=1&toRank=200','https://www.atptour.com/en/-/www/rank/sglroll/250?v=1','https://api.protennislive.com/feeds/rankings/singles','https://www.atptour.com/-/media/files/rankings/singles.pdf']) {
  try{const r=await fetch(u,{headers:U});const t=await r.text();console.log('PROBE',r.status,u,t.length,t.slice(0,160).replace(/\s+/g,' '));}catch(e){console.log('PROBE ERR',u,e.message)}
}
