// Pipeline ML murni JavaScript (tanpa dependensi) - dipakai di browser dan Node
const ML = (() => {
  const NUM = ["Age","RestingBP","Cholesterol","MaxHR","Oldpeak"];
  const CATS = {ChestPainType:["ATA","NAP","TA"], RestingECG:["Normal","ST"], ST_Slope:["Flat","Up"]};
  const F = [...["Age","RestingBP","Cholesterol","FastingBS","MaxHR","Oldpeak"].map(k=>[k,r=>+r[k]]),
    ["Sex",r=>+(r.Sex==="M")], ["ExerciseAngina",r=>+(r.ExerciseAngina==="Y")],
    ...Object.entries(CATS).flatMap(([k,v])=>v.map(c=>[k+"_"+c,r=>+(r[k]===c)]))];
  const names = F.map(f=>f[0]), enc = r=>F.map(f=>f[1](r)), numIdx = NUM.map(n=>names.indexOf(n));
  const median = a => { const s=[...a].sort((x,y)=>x-y), m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2; };
  const mean = a => a.reduce((s,v)=>s+v,0)/a.length;
  const std = a => { const m=mean(a); return Math.sqrt(mean(a.map(v=>(v-m)**2)))||1; };

  function stats(rows){
    return {rows:rows.length, missing:rows.reduce((s,r)=>s+Object.values(r).filter(v=>v===null||v===""||v===undefined).length,0),
      dup:rows.length-new Set(rows.map(r=>JSON.stringify(r))).size,
      chol0:rows.filter(r=>r.Cholesterol===0).length, bp0:rows.filter(r=>r.RestingBP===0).length};
  }
  function clean(raw,strat="median"){
    const seen=new Set(), rows=[];
    for(const r of raw){ const k=JSON.stringify(r); if(!seen.has(k)){seen.add(k); rows.push({...r});} }
    const ok = rows.filter(r=>r.RestingBP>0);
    const cv = ok.filter(r=>r.Cholesterol>0).map(r=>r.Cholesterol), med = +(strat==="mean"?mean(cv):median(cv)).toFixed(1);
    ok.forEach(r=>{ if(r.Cholesterol===0) r.Cholesterol=med; });
    return {rows:ok, before:stats(raw), after:stats(ok), med, strat};
  }
  function rng(a){ return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  function split(X,y,testFrac,seed){ // stratified
    const R=rng(seed), tr=[], te=[];
    for(const c of [0,1]){
      const idx=y.map((v,i)=>v===c?i:-1).filter(i=>i>=0);
      for(let i=idx.length-1;i>0;i--){ const j=Math.floor(R()*(i+1)); [idx[i],idx[j]]=[idx[j],idx[i]]; }
      const nt=Math.ceil(idx.length*testFrac); te.push(...idx.slice(0,nt)); tr.push(...idx.slice(nt));
    }
    return {tr,te};
  }
  function fitScaler(X){ return numIdx.map(j=>{ const c=X.map(r=>r[j]); return [mean(c),std(c)]; }); }
  function applyScaler(x,sc){ const o=[...x]; numIdx.forEach((j,k)=>o[j]=(x[j]-sc[k][0])/sc[k][1]); return o; }

  function trainLR(X,y){
    const n=X.length,d=X[0].length; let w=Array(d).fill(0),b=0;
    for(let it=0;it<1500;it++){
      const gw=Array(d).fill(0); let gb=0;
      for(let i=0;i<n;i++){ let z=b; for(let j=0;j<d;j++) z+=w[j]*X[i][j]; const e=1/(1+Math.exp(-z))-y[i]; gb+=e; for(let j=0;j<d;j++) gw[j]+=e*X[i][j]; }
      for(let j=0;j<d;j++) w[j]-=0.1*(gw[j]/n+0.01*w[j]); b-=0.1*gb/n;
    }
    const f=x=>{ let z=b; for(let j=0;j<d;j++) z+=w[j]*x[j]; return 1/(1+Math.exp(-z)); }; f.w=w; return f;
  }
  let IMP=[];
  function tree(X,y,idx,R,m){
    const n=idx.length,n1=idx.reduce((s,i)=>s+y[i],0);
    if(n1===0||n1===n||n<2) return {p:n1/n};
    const d=X[0].length; let best=null,bg=Infinity;
    const fs=[...Array(d).keys()]; for(let i=d-1;i>0;i--){ const j=Math.floor(R()*(i+1)); [fs[i],fs[j]]=[fs[j],fs[i]]; } fs.length=m;
    for(const f of fs){
      const s=[...idx].sort((a,b)=>X[a][f]-X[b][f]); let l1=0;
      for(let k=0;k<n-1;k++){
        l1+=y[s[k]]; if(X[s[k]][f]===X[s[k+1]][f]) continue;
        const nl=k+1,nr=n-nl,r1=n1-l1;
        const g=nl*(1-(l1/nl)**2-((nl-l1)/nl)**2)+nr*(1-(r1/nr)**2-((nr-r1)/nr)**2);
        if(g<bg){bg=g;best=[f,(X[s[k]][f]+X[s[k+1]][f])/2];}
      }
    }
    if(!best) return {p:n1/n};
    IMP[best[0]]+=n*(1-(n1/n)**2-((n-n1)/n)**2)-bg;
    return {f:best[0],t:best[1],
      l:tree(X,y,idx.filter(i=>X[i][best[0]]<=best[1]),R,m), r:tree(X,y,idx.filter(i=>X[i][best[0]]>best[1]),R,m)};
  }
  const walk=(t,x)=>{ while(t.f!==undefined) t=x[t.f]<=t.t?t.l:t.r; return t.p; };
  function trainRF(X,y,T,seed){
    const R=rng(seed),n=X.length,m=Math.floor(Math.sqrt(X[0].length)),ts=[]; IMP=Array(X[0].length).fill(0);
    for(let t=0;t<T;t++) ts.push(tree(X,y,Array.from({length:n},()=>Math.floor(R()*n)),R,m));
    const f=x=>ts.reduce((s,t)=>s+walk(t,x),0)/T, tot=IMP.reduce((s,v)=>s+v,0)||1; f.imp=IMP.map(v=>v/tot); return f;
  }
  function metrics(p,y){
    let tp=0,fp=0,tn=0,fn=0;
    p.forEach((v,i)=>{ const h=v>=0.5?1:0; if(h&&y[i])tp++; else if(h)fp++; else if(y[i])fn++; else tn++; });
    const pr=tp/(tp+fp||1), rc=tp/(tp+fn||1);
    return {acc:(tp+tn)/y.length, pr, rc, f1:2*pr*rc/(pr+rc||1), tp,fp,tn,fn};
  }
  function roc(p,y){
    const o=p.map((v,i)=>[v,y[i]]).sort((a,b)=>b[0]-a[0]), P=y.reduce((s,v)=>s+v,0), N=y.length-P;
    let tp=0,fp=0,auc=0; const pts=[{x:0,y:0}];
    o.forEach(([v,l],i)=>{ l?tp++:fp++;
      if(i===o.length-1||o[i+1][0]!==v){ const x=fp/N,yy=tp/P,q=pts[pts.length-1]; auc+=(x-q.x)*(yy+q.y)/2; pts.push({x,y:yy}); } });
    return {pts,auc};
  }
  function corr(a,b){ const ma=mean(a),mb=mean(b); let s=0,sa=0,sb=0; a.forEach((v,i)=>{s+=(v-ma)*(b[i]-mb);sa+=(v-ma)**2;sb+=(b[i]-mb)**2;}); return s/Math.sqrt(sa*sb||1); }

  function run(rows,{testFrac=0.2,seed=42,trees=200}={}){
    const X=rows.map(enc), y=rows.map(r=>+r.HeartDisease), {tr,te}=split(X,y,testFrac,seed);
    const sc=fitScaler(tr.map(i=>X[i]));
    const Xtr=tr.map(i=>applyScaler(X[i],sc)), Xte=te.map(i=>applyScaler(X[i],sc)), ytr=tr.map(i=>y[i]), yte=te.map(i=>y[i]);
    const lr=trainLR(Xtr,ytr), rf=trainRF(Xtr,ytr,trees,seed), models={"Logistic Regression":lr,"Random Forest":rf};
    const ps=Object.fromEntries(Object.entries(models).map(([k,f])=>[k,Xte.map(f)]));
    return {X,y,tr,te,sc,ytr,yte,Xtr,models,
      scores:Object.fromEntries(Object.entries(ps).map(([k,p])=>[k,metrics(p,yte)])),
      roc:Object.fromEntries(Object.entries(ps).map(([k,p])=>[k,roc(p,yte)]))};
  }
  return {NUM,CATS,names,enc,clean,run,corr,applyScaler,median};
})();
if (typeof module !== "undefined") module.exports = ML;
