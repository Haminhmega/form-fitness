const origin=process.env.FORM_TEST_URL||'http://127.0.0.1:5192/';
let ready=false;
for(let attempt=0;attempt<40;attempt++){
  try{if((await fetch(origin,{signal:AbortSignal.timeout(1000)})).ok){ready=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
}
if(!ready)throw Error('App preview did not become ready: '+origin);
