import {createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import deployment from './deployment.json';
import {POLICY,EXPLORER,stringify,shorten,sha256,validateBundle,transactionState,verifyRecord,examples} from './core.js';
import {connectProvider} from './wallet.js';
import {verifyTransactionCall} from './transaction.js';
import './style.css';
const $=id=>document.getElementById(id);
const reader=createClient({chain:studionet});
let signer=null,account=null,accountMode=null,busy=false,shownRecord=null,readEpoch=0,hashEpoch=0,preparedCall=null;
const txKey='benchmarkfence:last-transaction';
const errorText=e=>e?.code===4001?'Signature request rejected. Nothing was submitted.':e.shortMessage||e.message||String(e);
const setStatus=(text,error=false)=>{$('status').textContent=text;$('status').classList.toggle('error',error);};
function setBusy(value){busy=value;for(const id of ['submit','review','connect','track','wallet-connect','studio-connect','studio-track','disconnect']) $(id).disabled=value;}
function storePending(value){try{localStorage.setItem(txKey,JSON.stringify(value));}catch{/* Hash remains visible for manual recovery. */}}
function savedPending(){try{return JSON.parse(localStorage.getItem(txKey));}catch{return null;}}
function assertContract(){if(!/^0x[0-9a-fA-F]{40}$/.test(deployment.address||'')) throw Error('The live deployment has not been configured.');}
function accountLabel(type){$('connect').textContent=account?shorten(account)+(type?' · '+type:''):'Connect account ↗';}
function ensureSigner(){if(!account||(accountMode!=='studio'&&!signer)){$('account-dialog').showModal();throw Error('Connect a signing account, then submit again.');}}
function disconnect(){signer=null;account=null;accountMode=null;accountLabel();$('account-status').textContent='Disconnected. Studio keys always remain in Studio.';}
const provider=window.ethereum;
provider?.on?.('accountsChanged',()=>{disconnect();setStatus('Wallet account changed. Reconnect before signing.');});
provider?.on?.('chainChanged',()=>{disconnect();setStatus('Wallet network changed. Reconnect to Studionet before signing.');});
$('connect').addEventListener('click',()=>$('account-dialog').showModal());
$('disconnect').addEventListener('click',disconnect);
$('wallet-connect').addEventListener('click',async()=>{
  setBusy(true);
  try{const address=await connectProvider(provider,studionet);account=address;accountMode='wallet';signer=createClient({chain:studionet,account,provider});accountLabel('wallet');$('account-dialog').close();setStatus('Studionet wallet connected. Your wallet approves each write.');}
  catch(e){$('account-status').textContent=errorText(e);}
  finally{setBusy(false);}
});
$('studio-address').value=deployment.studio_account||'';
$('studio-connect').addEventListener('click',()=>{
  const address=$('studio-address').value.trim();
  if(!/^0x[0-9a-fA-F]{40}$/.test(address)){$('account-status').textContent='Enter the public address selected in Studio.';return;}
  account=address;accountMode='studio';signer=null;accountLabel('Studio');$('account-dialog').close();
  setStatus('Studio account selected: '+account+'. Calls are prepared here and signed in Studio.');
});
function prepareStudioCall(method,args,pending){
  preparedCall={method,args,owner:account.toLowerCase(),contract:deployment.address,...pending};
  $('studio-call').value=stringify({contract:deployment.address,chain_id:61999,account,method,args});
  $('studio-instructions').textContent='Call '+method+' on '+deployment.address+' using '+account+'.';
  $('studio-error').textContent='';$('studio-tx').value='';$('studio-dialog').showModal();
  try{localStorage.setItem('benchmarkfence:prepared-studio-call',JSON.stringify(preparedCall));}catch{}
  setStatus('Prepared '+method+' for Studio. Sign there, then paste its transaction hash to verify the lifecycle.');
}
$('copy-studio-call').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('studio-call').value);$('copy-studio-call').textContent='Call JSON copied ✓';}catch{$('studio-error').textContent='Select and copy the visible call JSON manually.';}});
$('studio-track').addEventListener('click',async()=>{
  if(busy||!preparedCall)return;
  const hash=$('studio-tx').value.trim();if(!/^0x[0-9a-fA-F]{64}$/.test(hash)){$('studio-error').textContent='Paste a 32-byte Studio transaction hash.';return;}
  const pending={...preparedCall,hash};storePending(pending);$('studio-dialog').close();setBusy(true);
  try{await track(hash,pending,true);}catch(e){setStatus(errorText(e),true);}finally{setBusy(false);}
});
async function updateHash(){const epoch=++hashEpoch;const raw=$('bundle').value;try{const data=validateBundle(raw);const hash=await sha256(raw);if(epoch!==hashEpoch)return;$('evidence-hash').textContent=hash;$('bundle-stats').textContent=`${new TextEncoder().encode(raw).length.toLocaleString()} bytes · ${data.samples.length} samples · ${data.evaluations.length} evaluation items`;$('bundle-stats').classList.remove('error');}catch(e){if(epoch!==hashEpoch)return;$('evidence-hash').textContent='—';$('bundle-stats').textContent=errorText(e);$('bundle-stats').classList.add('error');}}
function loadExample(){$('bundle').value=stringify(examples[$('example').value]);$('public-consent').checked=false;void updateHash();}
$('load-example').addEventListener('click',loadExample);$('bundle').addEventListener('input',()=>void updateHash());
$('import-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>14000)throw Error('JSON file exceeds 14,000 bytes.');const raw=await file.text();validateBundle(raw);$('bundle').value=raw;$('public-consent').checked=false;await updateHash();}catch(err){setStatus(errorText(err),true);}finally{e.target.value='';}});
function showPhase(state){$('tx-badge').textContent=state.state==='success'?'SUCCESS':state.state==='failed'?'FAILED':state.phase;const step=state.state==='success'?4:state.phase==='FINALIZED'?3:['PENDING','UNKNOWN'].includes(state.phase)?1:2;document.querySelectorAll('[data-phase]').forEach((el,i)=>el.classList.toggle('active',i<step));}
function showHash(hash){$('tx-hash').value=hash;$('tx-link').href=EXPLORER+'/tx/'+hash;$('tx-link').textContent='View transaction '+shorten(hash)+' ↗';$('tx-link').hidden=false;}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function readCase(id){assertContract();return JSON.parse(await reader.readContract({address:deployment.address,functionName:'get_case',args:[id],transactionHashVariant:'finalized'}));}
async function track(hash,pending={},wait=false){
  if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw Error('Use a 32-byte transaction hash.');
  showHash(hash);
  for(let i=0;i<(wait?120:1);i++){
    let tx;
    try{tx=await reader.getTransaction({hash});}
    catch(e){setStatus('Network receipt temporarily unavailable. Transaction ID is saved; resume tracking without resubmitting.');if(!wait)throw e;await delay(3000);continue;}
    if(pending.owner && pending.args)verifyTransactionCall(tx,pending);
    const state=transactionState(tx);showPhase(state);setStatus(`${state.phase}${state.execution?' · '+state.execution:''}`,state.state==='failed');
    if(state.state==='success'){
      if(pending.case_id){
        const record=await readCase(pending.case_id);
        if(!record || (pending.method==='review' && record.attempts<=pending.previous_attempts))throw Error('Execution returned, but the expected finalized state is not verified. Inspect the saved transaction before retrying.');
        await verifyRecord(record);$('active-case').value=record.id;$('lookup-id').value=record.id;renderRecord(record);setStatus('FINALIZED · SUCCESS · Expected contract state and receipt chain verified.');
      }else setStatus('FINALIZED · SUCCESS · Execution returned. Load the case separately to verify its state.');
      return;
    }
    if(state.state==='failed')throw Error('Transaction failed. No successful finding is claimed. Inspect the explorer receipt before submitting another transaction.');
    if(state.state==='unverified'){setStatus('FINALIZED · execution result unverified. Inspect the explorer receipt; do not assume success.',true);return;}
    if(!wait)return;
    await delay(3000);
  }
  setStatus('Still pending. Transaction ID is saved. Use Track to resume; do not submit the same operation again.');
}
async function write(method,args,pending){
  if(busy)return;
  assertContract();ensureSigner();
  if(accountMode==='studio'){prepareStudioCall(method,args,pending);return;}
  setBusy(true);setStatus('Waiting for signature and network submission…');
  try{
    const hash=await signer.writeContract({address:deployment.address,functionName:method,args,value:0n,leaderOnly:false,consensusMaxRotations:3});
    const saved={hash,method,args,owner:account.toLowerCase(),contract:deployment.address,...pending};storePending(saved);showHash(hash);setStatus('Submitted. Waiting for validator consensus…');
    await track(hash,saved,true);
  }finally{setBusy(false);}
}
$('submit').addEventListener('click',async()=>{
  try{
    if(busy)return;
    let raw=$('bundle').value;const parsed=validateBundle(raw);
    if(accountMode==='studio'){raw=JSON.stringify(parsed);$('bundle').value=raw;await updateHash();}
    if(!$('public-consent').checked)throw Error('Confirm that these samples can be published before locking them.');
    ensureSigner();const owner=account.toLowerCase();const hash=await sha256(raw);const id=await sha256(owner+'\n'+hash);
    const existing=await readCase(id);if(existing){$('active-case').value=id;$('lookup-id').value=id;renderRecord(existing);throw Error('These exact evidence bytes are already locked by this account. Use the existing case.');}
    await write('submit',[raw,hash],{case_id:id});
  }catch(e){setStatus(errorText(e),true);}
});
$('review').addEventListener('click',async()=>{
  try{
    if(busy)return;const id=$('active-case').value.trim();if(!/^[0-9a-f]{64}$/.test(id))throw Error('Use a 64-character lowercase case ID.');
    ensureSigner();const record=await readCase(id);if(!record)throw Error('Case not found in finalized state.');
    if(record.owner.toLowerCase()!==account.toLowerCase())throw Error('Only the original submitting account can review this case.');
    if(record.attempts>=3 || (record.attempts && record.receipts.at(-1).body.verdict!=='INCONCLUSIVE'))throw Error('Review is closed. Only INCONCLUSIVE cases may be retried, up to 3 attempts.');
    await write('review',[id],{case_id:id,previous_attempts:record.attempts});
  }catch(e){setStatus(errorText(e),true);}
});
$('track').addEventListener('click',async()=>{if(busy)return;setBusy(true);try{const hash=$('tx-hash').value.trim();const old=savedPending();await track(hash,old?.hash===hash?old:{},true);}catch(e){setStatus(errorText(e),true);}finally{setBusy(false);}});
function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
function external(text,href){const a=el('a',text);a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a;}
function renderRecord(record){
  shownRecord=record;const container=$('record');container.className='panel';container.replaceChildren();const data=JSON.parse(record.bundle);const last=record.receipts.at(-1).body;const head=el('div',undefined,'result-head');head.append(el('h3',data.dataset));head.append(el('span',(last.verdict||'EVIDENCE_LOCKED').replaceAll('_',' '),'verdict '+(last.verdict==='NO_OVERLAP_FOUND'?'clear':last.verdict==='INCONCLUSIVE'?'uncertain':'')));container.append(head);
  container.append(el('p','✓ Evidence bytes and '+record.receipts.length+' linked receipt'+(record.receipts.length===1?'':'s')+' verified locally against finalized on-chain state.','integrity'));
  const meta=el('div',undefined,'record-meta');for(const [k,v]of Object.entries({'BENCHMARK':data.benchmark,'CASE ID':record.id,'SUBMITTED BY':record.owner,'EVIDENCE SHA-256':record.evidence_sha256,'DISCLOSURE CLAIM (UNVERIFIED)':data.source_claim,'REVIEW ATTEMPTS':record.attempts+' / 3'})){const item=el('div');item.style.overflowWrap='anywhere';item.append(el('b',k),el('span',v));meta.append(item);}container.append(meta);
  if(last.pairs){const list=el('div',undefined,'pair-list');for(const pair of last.pairs){const row=el('div',undefined,'pair');const title=el('div',undefined,'pair-header');title.append(el('span',pair.sample_id+' → '+pair.evaluation_id,'mono'),el('strong',pair.kind.replaceAll('_',' ')));row.append(title);const body=el('div',undefined,'pair-body');const sample=data.samples.find(s=>s.id===pair.sample_id);const evaluation=data.evaluations.find(q=>q.id===pair.evaluation_id);for(const [label,text] of [['TRAINING SAMPLE',sample.text],['EVALUATION ITEM',evaluation.question+'\nReference answer: '+evaluation.answer]]){const block=el('div');block.append(el('b',label),el('blockquote',text));body.append(block);}row.append(body);list.append(row);}container.append(list);container.append(el('p',`${last.semantic_pairs} semantic pair(s) reviewed through validator consensus · ${last.uncertain_pairs} unresolved pair(s). Findings apply only to this submitted batch. Disclosure provenance and training timing are unverified.`,'footnote'));}else container.append(el('p','Evidence is locked. The owner can now request its first review.','muted'));
  const history=el('details',undefined,'receipt-history');history.append(el('summary','Inspect receipt hash chain ('+record.receipts.length+')'));for(const r of record.receipts){history.append(el('p',r.body.sequence+' · '+r.body.event+(r.body.verdict?' · '+r.body.verdict:'')),el('code',r.hash));}container.append(history);
  const links=el('div',undefined,'receipt-links');const exportBtn=el('button','Export verification record ↓','secondary');exportBtn.addEventListener('click',()=>exportRecord(record));links.append(exportBtn,external('Contract on explorer ↗',EXPLORER+'/address/'+deployment.address));const share=el('button','Copy case link','text-button');share.addEventListener('click',async()=>{try{const url=new URL(location.href);url.search='';url.searchParams.set('case',record.id);url.hash='receipts';await navigator.clipboard.writeText(url.href);share.textContent='Link copied ✓';}catch{share.textContent='Case ID: '+record.id;}});links.append(share);container.append(links);
}
function exportRecord(record){const blob=new Blob([stringify({format:POLICY,chain_id:61999,contract:deployment.address,contract_source_sha256:deployment.source_sha256,record})+'\n'],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='benchmarkfence-'+record.id.slice(0,12)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}
async function inspect(id){const epoch=++readEpoch;const box=$('record');box.className='panel empty';box.textContent='Reading finalized contract state and checking receipt hashes…';try{if(!/^[0-9a-f]{64}$/.test(id))throw Error('Use a lowercase 64-character case ID.');const record=await readCase(id);if(!record)throw Error('No finalized case was found for this ID.');await verifyRecord(record);if(epoch!==readEpoch)return;renderRecord(record);$('active-case').value=id;$('lookup-id').value=id;}catch(e){if(epoch===readEpoch){box.textContent=errorText(e);box.classList.add('error');}}}
$('lookup-form').addEventListener('submit',e=>{e.preventDefault();void inspect($('lookup-id').value.trim());});
function loadLive(){const key=$('example').value;const id=deployment.example_cases[key]||Object.values(deployment.example_cases)[0];if(id){$('lookup-id').value=id;void inspect(id);}else setStatus('No live example is configured yet. Submit your own public evidence batch.');}
$('example-receipt').addEventListener('click',loadLive);$('hero-example').addEventListener('click',loadLive);
if(deployment.address)$('contract-link').href=EXPLORER+'/address/'+deployment.address;
try{preparedCall=JSON.parse(localStorage.getItem('benchmarkfence:prepared-studio-call'));}catch{}
const last=savedPending();if(last?.hash){showHash(last.hash);if(last.case_id)$('active-case').value=last.case_id;setStatus('A previous transaction is saved. Use Track to check its outcome before submitting again.');}
loadExample();
const initial=new URLSearchParams(location.search).get('case');if(initial){$('lookup-id').value=initial;void inspect(initial);}
// Expose no signing objects, private keys, or mutable test hooks to window.
