import {createClient,createAccount,generatePrivateKey} from "genlayer-js";
import {studionet} from "genlayer-js/chains";
const E=import.meta.env;
const RPC=E.VITE_RPC||"https://studio-next.genlayer.com/api";
const chain={...studionet,id:Number(E.VITE_CHAIN_ID||61997),rpcUrls:{default:{http:[RPC]}}};
const $=s=>document.querySelector(s);
const pk=localStorage.wm_pk||(localStorage.wm_pk=generatePrivateKey());
const demo=createAccount(pk);
let wallet=null;
const reader=createClient({chain,endpoint:RPC});
let client=createClient({chain,endpoint:RPC,account:demo});
const me=()=>wallet||demo.address;
let addr=localStorage.wm_addr||E.VITE_WAYMARK_ADDRESS||"";$("#addr").value=addr;
const showWho=()=>$("#who").textContent=me().slice(0,6)+"…"+me().slice(-4);
showWho();$("#who").title="Click to copy your full address";$("#who").style.cursor="pointer";$("#who").onclick=()=>{navigator.clipboard.writeText(me());say("Address copied");setTimeout(()=>say(""),1500)};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const say=t=>{const m=$("#msg");m.textContent=t;m.style.display=t?"block":"none"};
const sh=a=>a.slice(0,6)+"…"+a.slice(-4);
async function write(fn,args,value=0n){
  try{say("Estimating fees…");
    const w={address:addr,functionName:fn,args,value};
    const est=await client.estimateTransactionFeesForWrite(w);
    say("Confirm the transaction…");
    const hash=await client.writeContract({...w,fees:{distribution:est.distribution,feeValue:est.feeValue}});
    say("Waiting for validators…");
    await (client.waitForDecision?client.waitForDecision({hash}):client.waitForTransactionReceipt({hash,status:"ACCEPTED",retries:60,interval:4000}));
    say(fn+" confirmed");await load();setTimeout(()=>say(""),2500);
  }catch(e){say("Failed: "+(e.shortMessage||e.message||e));}
}
let filter="mine";
const same=(a,b)=>a.toLowerCase()===b.toLowerCase();
const isMine=d=>same(d.funder,me())||same(d.builder,me());
const gen=n=>(n/1e18).toLocaleString(undefined,{maximumFractionDigits:4})+" GEN";
function stats(all){
  let locked=0,paid=0,earned=0,todo=0;
  for(const d of all.filter(isMine)){
    const f=same(d.funder,me()),b=same(d.builder,me());
    for(const m of d.milestones){const v=Number(d.total)*m.percent/100;
      if(m.status==="released"){if(f)paid+=v;if(b)earned+=v}else{if(f)locked+=v;if(b)todo+=v}}}
  $("#stats").innerHTML=[["Locked by you",locked],["Paid out",paid],["Earned as builder",earned],["Still to earn",todo]].map(([k,v])=>`<div class="stat"><b>${gen(v)}</b><small>${k}</small></div>`).join("");
  document.querySelectorAll("#tabs button").forEach(x=>x.classList.toggle("on",x.dataset.f===filter));
}
async function load(){
  if(!addr)return;
  try{const all=JSON.parse(await reader.readContract({address:addr,functionName:"get_all",args:[]}));
    stats(all);const list=filter==='mine'?all.filter(isMine):all;
    $("#deals").innerHTML=list.slice().reverse().map(d=>{
      const done=d.milestones.filter(m=>m.status==="released").reduce((s,m)=>s+m.percent,0);
      const mine=me().toLowerCase()===d.builder.toLowerCase();
      return `<article class="card"><h2>${esc(d.title)}</h2>
      <p class="sub">${(Number(d.total)/1e18).toFixed(3)} GEN · funder ${sh(d.funder)} · builder ${sh(d.builder)}</p>
      <div class="bar"><i style="width:${done}%"></i></div><small>${done}% released</small>
      ${d.milestones.map((m,i)=>`<div class="ms"><div class="top"><div><b>${esc(m.title)}</b> <small>${m.percent}%</small><br><small>${esc(m.criteria)}</small></div><span class="tag ${m.status}">${m.status}</span></div>
      ${m.url?`<small>Evidence: <a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.url)}</a></small>`:""}
      ${m.note?`<br><small>Panel: ${esc(m.note)}</small>`:""}
      ${(m.status==="open"||m.status==="rejected")&&mine?`<div class="act"><input placeholder="Evidence URL" id="u${d.id}_${i}"><button data-s="${d.id},${i}">Submit evidence</button></div>`:""}
      ${m.status==="submitted"?`<div class="act"><button data-j="${d.id},${i}">Ask validators to review</button></div>`:""}</div>`).join("")}</article>`}).join("")||`<section class="card"><h2>No deals here yet</h2><p class="sub">Create one below, or switch to All deals.</p></section>`;
  }catch(e){say("Could not read contract: "+(e.shortMessage||e.message))}
}
$("#save").onclick=()=>{addr=$("#addr").value.trim();localStorage.wm_addr=addr;load()};
$("#create").onclick=()=>{
  const ms=$("#ms").value.split("\n").filter(Boolean).map(l=>{const[p,c,q]=l.split("|").map(s=>s.trim());return{title:p,criteria:c,percent:Number(q)}});
  const sum=ms.reduce((a,m)=>a+m.percent,0);
  if(!ms.length||ms.some(m=>!m.title||!m.criteria||!Number.isInteger(m.percent)||m.percent<1||m.percent>100)||sum!==100){say("Each milestone needs a title, goal and a whole percent from 1 to 100, adding up to exactly 100");setTimeout(()=>say(""),4000);return}
  write("create_deal",[$("#b").value.trim(),$("#t").value.trim(),JSON.stringify(ms)],BigInt(Math.round(Number($("#amt").value)*1e18)));
};
document.addEventListener("click",e=>{
  if(e.target.dataset.f){filter=e.target.dataset.f;load()}
  const s=e.target.dataset.s,j=e.target.dataset.j;
  if(s){const[id,i]=s.split(",").map(Number);write("submit",[id,i,$(`#u${id}_${i}`).value.trim()])}
  if(j){const[id,i]=j.split(",").map(Number);write("judge",[id,i])}
});
load();setInterval(load,20000);

$("#fund").onclick=async()=>{try{say("Requesting test funds…");await client.request({method:"sim_fundAccount",params:[me(),1e19]});say("Funded with 10 GEN");setTimeout(()=>say(""),2500)}catch(e){say("Funding failed: "+(e.shortMessage||e.message))}};

$("#connect").onclick=async()=>{
  const eth=window.ethereum;
  if(!eth){say("No wallet found. Install MetaMask, Rabby or any EIP-1193 wallet.");return}
  try{
    const [a]=await eth.request({method:"eth_requestAccounts"});
    const chainId="0x"+chain.id.toString(16);
    try{await eth.request({method:"wallet_switchEthereumChain",params:[{chainId}]})}
    catch(e){await eth.request({method:"wallet_addEthereumChain",params:[{chainId,chainName:"GenLayer Studio Next",nativeCurrency:{name:"GEN",symbol:"GEN",decimals:18},rpcUrls:[RPC],blockExplorerUrls:["https://explorer-studio-dev.genlayer.com/"]}]})}
    wallet=a;client=createClient({chain,endpoint:RPC,account:a,provider:eth});
    showWho();$("#connect").textContent="Wallet connected";load();
    say("Connected. Press Get test funds if your balance is empty.");setTimeout(()=>say(""),3500);
  }catch(e){say("Wallet: "+(e.shortMessage||e.message||e))}
};
window.ethereum?.on?.("accountsChanged",()=>location.reload());
