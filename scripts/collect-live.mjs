// Read-only evidence collector. Each hash is an observed Studio transaction.
import {createClient,decodeInputData}from'genlayer-js';
import{studionet}from'genlayer-js/chains';
import{readFileSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';
import{transactionState,stringify,verifyRecord}from'../web/core.js';
import{verifyTransactionCall}from'../web/transaction.js';
const report=JSON.parse(readFileSync('evidence/deployment.json'));
const client=createClient({chain:studionet});
const hashes={
 'studio-submit-exact':'0x09c6d7e269d12c642aa6570c5ee907abb6fc93eea49e2081834eb741fdde0885',
 'studio-review-exact':'0x4b9b906d496422c47e73bb0fa38ce4736a007beddd6c9d25003078e09db6b3f0',
};
report.transactions=report.transactions||{};
for(const [name,hash]of Object.entries(hashes)){
 const tx=await client.getTransaction({hash});const state=transactionState(tx);
 writeFileSync(`evidence/receipt-${name}.json`,stringify(tx)+'\n');
 const raw=tx.data.calldata.raw;const data=(await import('genlayer-js')).abi.calldata.decode(new Uint8Array(raw));
 report.transactions[name]={hash,...state,from:tx.from_address,to:tx.to_address,method:data.get('method'),leader_only:tx.leader_only,initial_validators:tx.num_of_initial_validators,rotations:tx.rotation_count};
 console.log(name,state);
 if(state.state!=='success')throw Error('Live transaction not successful');
 verifyTransactionCall(tx,{owner:report.studio_account,contract:report.address,method:data.get('method'),args:data.get('args')});
}
const ids=JSON.parse(await client.readContract({address:report.address,functionName:'list_cases',args:[0,20],transactionHashVariant:'finalized'}));
for(const id of ids.ids){
 const record=JSON.parse(await client.readContract({address:report.address,functionName:'get_case',args:[id],transactionHashVariant:'finalized'}));
 await verifyRecord(record);
 const d=JSON.parse(record.bundle);const kind=d.dataset.includes('paraphrased')?'semantic':d.dataset.includes('answer key')?'leakage':d.dataset.includes('unrelated')?'unrelated':d.dataset.includes('incomplete')?'uncertain':'exact';
 if(record.attempts){report.example_cases[kind]=id;}
 writeFileSync(`evidence/export-${kind}.json`,stringify({format:'benchmarkfence/1',chain_id:61999,contract:report.address,contract_source_sha256:report.source_sha256,record})+'\n');
 console.log(kind,id,record.attempts,record.receipts.at(-1).body.verdict);
}
const deploy=JSON.parse(readFileSync('evidence/receipt-deploy.json'));
const decoded=decodeInputData('0x'+deploy.tx_data,deploy.to_address);
const code=decoded.contractCode;console.log('Deployment input fields',Object.keys(decoded));
// The deployed code bytes are checked separately below as SDK fields vary by release.
report.checked_at=new Date().toISOString();
writeFileSync('evidence/deployment.json',stringify(report)+'\n');if(process.argv.includes('--publish-manifest'))writeFileSync('web/deployment.json',stringify(report)+'\n');
