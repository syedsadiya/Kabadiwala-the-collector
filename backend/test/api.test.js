const B=process.env.API_URL||'http://localhost:5000/api';let pass=0,fail=0;
async function r(path,{method='GET',body,token}={}){const res=await fetch(B+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return{status:res.status,data:await res.json().catch(()=>({}))};}
function ok(name,cond,extra=''){cond?pass++:fail++;console.log((cond?'PASS ':'FAIL ')+name+(cond?'':'  -> '+extra));}
(async()=>{
 const login=async(e)=> (await r('/auth/login',{method:'POST',body:{email:e,password:'demo1234'}})).data;
 const cust=await login('customer@kabadiwalaconnect.demo'),col=await login('collector@kabadiwalaconnect.demo'),adm=await login('admin@kabadiwalaconnect.demo');
 ok('login 3 roles',cust.token&&col.token&&adm.token);
 ok('wrong password 401',(await r('/auth/login',{method:'POST',body:{email:'customer@kabadiwalaconnect.demo',password:'x'}})).status===401);
 // register
 ok('register admin blocked',(await r('/auth/register',{method:'POST',body:{role:'admin',name:'Eve',email:'eve@x.com',password:'secret1'}})).status===400);
 ok('register bad email',(await r('/auth/register',{method:'POST',body:{role:'customer',name:'Eve',email:'nope',password:'secret1'}})).status===400);
 ok('register short pw',(await r('/auth/register',{method:'POST',body:{role:'customer',name:'Eve',email:'e@x.com',password:'123'}})).status===400);
 ok('collector needs categories',(await r('/auth/register',{method:'POST',body:{role:'collector',name:'Col Z',email:'cz@x.com',password:'secret1',area:'Kakinada'}})).status===400);
 const reg=await r('/auth/register',{method:'POST',body:{role:'customer',name:'Mixed Case',email:'MiXed@Case.COM',password:'secret1',area:'Kakinada'}});
 ok('register ok',reg.status===201);
 ok('login with different email case',(await r('/auth/login',{method:'POST',body:{email:'mixed@case.com',password:'secret1'}})).status===200);
 ok('duplicate email 409',(await r('/auth/register',{method:'POST',body:{role:'customer',name:'Mixed Case',email:'mixed@case.com',password:'secret1'}})).status===409);
 // pickup validation
 const bad=await r('/pickups',{method:'POST',token:cust.token,body:{category:'gold',qtyEst:-1,lat:16.98,lng:82.2,address:''}});
 ok('pickup validation 400',bad.status===400);
 ok('past date rejected',(await r('/pickups',{method:'POST',token:cust.token,body:{category:'plastic',qtyEst:3,lat:16.98,lng:82.2,address:'Ward 9',pickupDate:'2020-01-01'}})).status===400);
 ok('collector cannot create pickup',(await r('/pickups',{method:'POST',token:col.token,body:{category:'plastic',qtyEst:3,lat:16.98,lng:82.2,address:'Ward 9'}})).status===403);
 const p=(await r('/pickups',{method:'POST',token:cust.token,body:{category:'plastic',qtyEst:3,lat:16.99,lng:82.25,address:'Ward 9, Kakinada',pickupTime:'Morning (9–11 AM)',pickupDate:new Date().toISOString().slice(0,10)}})).data.pickup;
 ok('pickup created',p&&p._id);
 // matching
 const m=(await r(`/pickups/${p._id}/matches`,{token:cust.token})).data;
 console.log('   matches:',m.matches.map(x=>`${x.name}[${x.categories}] ${x.distanceKm}km score=${x.score}`).join(' | '),'excluded',JSON.stringify(m.excluded));
 ok('matches only plastic-accepting',m.matches.length>0&&m.matches.every(x=>x.categories.includes('plastic')));
 ok('sorted by score',m.matches.every((x,i,a)=>i===0||a[i-1].score>=x.score));
 const other=await login('customer1@kabadiwalaconnect.demo');
 ok("other customer can't see matches",(await r(`/pickups/${p._id}/matches`,{token:other.token})).status===403);
 // request collector: bad + good
 ok('route to ineligible rejected',(await r(`/pickups/${p._id}/request-collector`,{method:'PATCH',token:cust.token,body:{collectorId:adm.user._id}})).status===400);
 const top=m.matches[0];
 ok('route to recommended',(await r(`/pickups/${p._id}/request-collector`,{method:'PATCH',token:cust.token,body:{collectorId:top._id}})).status===200);
 // collector view
 const cl=(await r('/pickups/mine',{token:col.token})).data.pickups;
 const seen=cl.find(x=>x._id===p._id);
 console.log('   collector sees pickup:',!!seen,'forYou',seen&&seen.forYou,'customer',JSON.stringify(seen&&seen.customer));
 ok('customer name populated',cl.every(x=>x.customer&&x.customer.name));
 ok('open request hides customer phone',cl.filter(x=>x.status==='REQUESTED').every(x=>!('phone' in x.customer)));
 ok('collector sees only accepted categories',cl.filter(x=>x.status==='REQUESTED').every(x=>['paper','plastic','metal','cardboard'].includes(x.category)||x.forYou));
 // availability
 const off=await r('/users/me',{method:'PATCH',token:col.token,body:{available:false}});
 ok('availability off',off.data.user&&off.data.user.available===false,JSON.stringify(off.data));
 ok('unavailable cannot accept',(await r(`/pickups/${p._id}/accept`,{method:'PATCH',token:col.token})).status===409);
 const m2=(await r(`/pickups/${p._id}/matches`,{token:cust.token})).data;
 ok('unavailable excluded from matches',!m2.matches.some(x=>x._id===col.user._id)&&m2.excluded.unavailable>=1);
 await r('/users/me',{method:'PATCH',token:col.token,body:{available:true}});
 // accept race
 const [a1,a2]=await Promise.all([r(`/pickups/${p._id}/accept`,{method:'PATCH',token:col.token}),r(`/pickups/${p._id}/accept`,{method:'PATCH',token:col.token})]);
 ok('only one accept wins',[a1.status,a2.status].sort().join()==='200,409',[a1.status,a2.status]);
 ok('customer cannot cancel after accept',(await r(`/pickups/${p._id}/cancel`,{method:'PATCH',token:cust.token})).status===409);
 const mine=(await r('/pickups/mine',{token:cust.token})).data.pickups.find(x=>x._id===p._id);
 ok('customer sees collector name+phone',mine.collector&&mine.collector.name,JSON.stringify(mine.collector));
 // complete
 ok('bad weight 400',(await r('/collections',{method:'POST',token:col.token,body:{pickupId:p._id,weight:0}})).status===400);
 const c1=await r('/collections',{method:'POST',token:col.token,body:{pickupId:p._id,weight:4.2,quality:'Good',paymentMethod:'Cash',amountPaid:99999}});
 ok('collection recorded',c1.status===201&&c1.data.collection.amountPaid===105,JSON.stringify(c1.data.collection&&c1.data.collection.amountPaid));
 ok('double completion blocked',(await r('/collections',{method:'POST',token:col.token,body:{pickupId:p._id,weight:4.2}})).status===409);
 // cancel flow
 const p2=(await r('/pickups',{method:'POST',token:cust.token,body:{category:'paper',qtyEst:2,lat:16.99,lng:82.25,address:'Ward 9, Kakinada'}})).data.pickup;
 ok('owner cancels open',(await r(`/pickups/${p2._id}/cancel`,{method:'PATCH',token:cust.token})).status===200);
 ok('accept cancelled blocked',(await r(`/pickups/${p2._id}/accept`,{method:'PATCH',token:col.token})).status===409);
 // permission checks
 ok('users list admin only',(await r('/users',{token:cust.token})).status===403);
 ok('admin stats',(await r('/stats/admin',{token:adm.token})).status===200);
 ok('admin stats denied customer',(await r('/stats/admin',{token:cust.token})).status===403);
 const st=(await r('/stats/admin',{token:adm.token})).data;
 console.log('   kpis',JSON.stringify(st.kpis),'pickupStatus',JSON.stringify(st.pickupStatus),'\n   monthly',JSON.stringify(st.monthly.map(m=>m.label+':'+m.pickups)));
 const ms=(await r('/stats/mine',{token:cust.token})).data;console.log('   my stats',JSON.stringify(ms));
 const trace=await r('/collections/trace/'+c1.data.collection.collectionCode,{token:cust.token});
 ok('trace populated',trace.data.collection&&trace.data.collection.collector&&trace.data.collection.collector.name,JSON.stringify(trace.data).slice(0,200));
 console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})();
