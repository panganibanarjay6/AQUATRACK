const today=new Date().toISOString().slice(0,10),K='aquatrack_procurement_db_v2';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=n=>'₱'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const ST=['Pending','Confirmed','Rejected'];
const POS=['Open','Pending','Paid','Partial','Completed','Cancelled'],POCOL=['#0b5fa5','#5a35b8','#d4a017','#d9772f','#2e9e2e','#888'];
/* ---------- MODULE DEFINITIONS (tables + forms) ---------- */
const M={
suppliers:{t:'Supplier Management',s:'Add, update and deactivate suppliers (suppliers are never deleted)',f:[['name','Supplier Name','text'],['contact','Contact Person','text'],['phone','Phone','text'],['email','Email','text'],['address','Address','text'],['status','Status','sel',['Active','Deactivated']]],nodel:()=>true,a:[['Deactivate',r=>{if(confirm('Mark '+r.name+' as deactivated?'))setSup(r.id,'Deactivated')},r=>r.status=='Active'],['Reactivate',r=>setSup(r.id,'Active'),r=>r.status!='Active']]},
items:{t:'Warehouse Inventory',s:'Main warehouse stock – empty containers, filters, filtration tanks, caps, seals, labels',f:[['name','Item Name','text'],['cat','Category','sel',['Empty Container','Filter','Caps','Seals','Label','Filtration Tank']],['unit','Unit','sel',['pcs','liters','gallons','box']],['stock','Stock on Hand','num'],['reorder','Reorder Level','num']]},
pl:{t:'Supplier Price List',s:'The price each company charges for each material',f:[['supplier','Supplier','ref','suppliers'],['item','Material','ref','items'],['price','Unit Price','num']]},
pr:{t:'Purchase Request',pre:'PR',s:'Internal requests for items to buy',f:[['item','Material','ref','items'],['qty','Quantity','num'],['date','Date','date'],['status','Status','sel',[...ST,'RFQ Sent','Completed']]],
 after:r=>{if(r.status=='Pending')r.status='Confirmed'},
 nodel:r=>r.status=='Completed', a:[['Create RFQ',r=>openForm('rfq',0,{_pr:r.id,item:r.item,qty:r.qty}),r=>r.status=='Confirmed'&&!D.rfq.some(x=>x.pr==r.id)]]},
rfq:{t:'Request for Quotation',nonew:1,pre:'RFQ',s:'Ask suppliers for a price on a material',f:[['item','Material','ref','items'],['qty','Quantity','num'],['supplier','Supplier','ref','suppliers'],['due','Due Date','date'],['status','Status','sel',['Sent','Responded','Finished']]],
 x:[['Quotation',r=>{const q=D.quo.filter(x=>x.rfq==r.id).pop();if(!q)return r.status=='Finished'?'<small>—</small>':'<small>No quotation yet</small>';return quoBtn(r)}]],
 nodel:r=>r.status=='Finished',a:[['Add Quotation',r=>openForm('quo',0,{rfq:r.id,supplier:r.supplier,item:r.item,qty:r.qty,price:listed(r.supplier,r.item)??(([...D.quo].reverse().find(x=>x.supplier==r.supplier&&x.item==r.item))||{}).price}),r=>r.status!='Finished'&&!D.quo.some(x=>x.rfq==r.id)],
 ['Proceed to Purchase Order',r=>{const q=D.quo.filter(x=>x.rfq==r.id&&x.status=='Received').pop();if(q)openForm('po',0,{supplier:q.supplier,item:q.item,qty:q.qty,price:q.price,_quo:q.id})},r=>D.quo.some(x=>x.rfq==r.id&&x.status=='Received')],
 ['Reject Quotation',r=>{const q=D.quo.filter(x=>x.rfq==r.id&&x.status=='Received').pop();if(q&&confirm('Reject quotation '+q.no+'?')){q.status='Rejected';save();go()}},r=>D.quo.some(x=>x.rfq==r.id&&x.status=='Received')]],after:r=>{const p=D.pr.find(x=>x.id==r.pr);if(p)p.status='RFQ Sent'}},
quo:{t:'Quotation',pre:'QT',s:'Supplier price offers',f:[['rfq','RFQ','ref','rfq'],['supplier','Supplier','ref','suppliers'],['item','Material','ref','items'],['qty','Quantity','num'],['price','Unit Price','num'],['status','Status','sel',['Received','Accepted','Rejected']]],tot:1,nodel:r=>r.status!='Received',
 a:[['Proceed to Purchase Order',r=>openForm('po',0,{supplier:r.supplier,item:r.item,qty:r.qty,price:r.price,_quo:r.id}),r=>r.status=='Received'],['Reject',r=>{if(confirm('Reject this quotation?')){r.status='Rejected';save();go()}},r=>r.status=='Received']],after:r=>{const f=D.rfq.find(x=>x.id==r.rfq);if(f&&f.status=='Sent')f.status='Responded'}},
po:{t:'Purchase Order',nonew:1,pre:'PO',s:'Confirmed orders sent to suppliers',f:[['supplier','Supplier','ref','suppliers'],['item','Material','ref','items'],['qty','Quantity','num'],['price','Unit Price','num'],['date','Order Date','date'],['status','Status','sel',POS]],tot:1,nodel:r=>!['Open','Cancelled'].includes(r.status),
 a:[['Confirm',r=>{if(confirm('Confirm '+r.no+' ('+fmt(tot(r))+')?\n\nIt will be sent to Finance for payment.')){r.status='Pending';const i=ins('inv',{po:r.id,amount:tot(r),due:today,status:'Payment Requested'});ins('pq',{inv:i.id,amount:i.amount,date:today,status:'Pending'});save();go();toast(r.no+' confirmed and sent to Finance. Next: Finance pays it under Finance → Payment Requests.')}},r=>r.status=='Open'],
 ['Cancel',r=>{if(confirm('Cancel '+r.no+'?\n\nThe order will not be sent to the supplier.')){r.status='Cancelled';save();go();toast(r.no+' cancelled.')}},r=>r.status=='Open']],after:r=>{const q=D.quo.find(x=>x.id==r._quo);if(!q)return;q.status='Accepted';const f=D.rfq.find(x=>x.id==q.rfq);if(f){const same=x=>{const g=D.rfq.find(y=>y.id==x.rfq);return g&&grp(g)==grp(f)};D.quo.forEach(o=>{if(o.id!=q.id&&same(o)&&o.status=='Received')o.status='Rejected'});D.rfq.forEach(y=>{if(grp(y)==grp(f))y.status='Finished'});const p=D.pr.find(x=>x.id==f.pr);if(p)p.status='RFQ Sent'}}},
gr:{t:'Goods Receiving',nonew:1,pre:'GR',s:'Posting receipts updates Warehouse Inventory stock automatically',f:[['po','Purchase Order','ref','po'],['qty','Qty Received','num'],['date','Date Received','date'],['status','Status','sel',['Updated']]],nodel:r=>r.status=='Updated',
 after:r=>{const p=D.po.find(x=>x.id==r.po);if(!p)return;const s=D.items.find(x=>x.id==p.item);if(s)s.stock+=r.qty;const dv=p.dv||{};r.photo=dv.photo||'';r.photoAt=dv.photoAt||'';r.rider=dv.rider||'';if(p.dv){p.dv.photo=null;p.dv.photoAt=null}p.status=recv(p.id)>=p.qty?'Completed':'Partial';if(p.status=='Completed')prDone(p)},
 chk:v=>{const p=D.po.find(x=>x.id==v.po);if(!(v.qty>0))return'Quantity must be more than zero.';if(p&&v.qty>p.qty-recv(p.id))return'Only '+(p.qty-recv(p.id))+' left to receive on '+p.no+'.';if(p&&p.dv&&p.dv.nr)return'This order is marked as Not Received. Reopen it first.';if(p&&!(p.dv&&p.dv.photo))return'The courier must send a photo of the actual product first (Goods Receiving > Track).'}},
inv:{t:'Purchase Invoice',nodel:()=>1,nonew:1,pre:'INV',s:'Unpaid invoices post to Finance as payables',f:[['po','Purchase Order','ref','po'],['amount','Amount','num'],['due','Due Date','date'],['status','Status','sel',['Unpaid']]],
 a:[['Request Payment',r=>{if(confirm('Send a payment request to Finance for '+r.no+' – '+fmt(r.amount)+'?')){const n=ins('pq',{inv:r.id,amount:r.amount,date:today,status:'Pending'});M.pq.after(n);save();go();toast(n.no+' sent to Finance for approval.')}},r=>r.status=='Unpaid'&&!D.pq.some(q=>q.inv==r.id&&q.status!='Rejected')],['View Receipt',r=>viewRc(r.id),r=>r.status=='Paid'&&D.rc.some(c=>c.inv==r.id)]]}
};
M.suppliers.t='Suppliers';M.suppliers.s='Vendors for filters, bottles, caps and minerals';M.quo.t='Supplier Quotation';M.quo.nonew=1;M.inv.t='Invoice / Payables';M.gr.s='Received deliveries automatically add to stock';
M.suppliers.g='Add the companies you buy from. <b>Click a company name</b> to see its details and manage the prices it charges for each material.';
M.suppliers.x=[['Price List',r=>`<a class="lnk" onclick="nav('sup:${r.id}')">${new Set(D.pl.filter(x=>x.supplier==r.id).map(x=>x.item)).size} materials ›</a>`]];
M.items.g='List every material you buy. Stock goes up automatically when goods are received. These items appear in the Purchase Request dropdown.';
M.pl.g='Each company charges its own price for each material. Click <b>+ New</b> to add or update a price (the latest entry is used). These prices fill in automatically when you add a quotation.';
M.pr.g='Ask for the materials you need. Click <b>+ New</b>, pick the item and quantity. It is confirmed automatically once saved. Then click <b>Create RFQ</b> to ask a supplier for a price.';
M.rfq.g='A price request sent to a supplier. Click <b>Create RFQ</b> on a confirmed Purchase Request. When the supplier replies, click <b>Add Quotation</b>; the supplier\'s printed quotation then shows in the <b>Quotation</b> column, and <b>Proceed to Purchase Order</b> or <b>Reject Quotation</b> appear under Actions.';
M.quo.g='The supplier\'s price offer. The material is always the one requested in the Purchase Request. Compare them, then click <b>Proceed to Purchase Order</b> on the best one. The other quotations for the same request are rejected automatically.';
M.po.g='The order for the supplier. Click <b>Confirm</b> to send it to Finance (or <b>Cancel</b> to drop it). Finance then pays it (or cancels it) under <b>Finance → Payment Requests</b>. After payment, record the delivery under <b>Goods Receiving</b>. Finished orders can no longer be deleted.';
M.gr.g='Deliveries for orders that Finance has already paid. Orders waiting for delivery are listed at the top – click <b>Receive</b> and enter the quantity. Saving adds it to Warehouse Inventory automatically, and the order becomes <b>Completed</b> once everything is received.';
M.inv.g='The supplier\'s bill. It is created automatically when you Confirm a Purchase Order, and Finance pays it under <b>Payment Requests</b>. Once paid, the receipt appears here (<b>View Receipt</b>).';
const supOfInv=id=>{const i=D.inv.find(x=>x.id==id),p=i&&D.po.find(x=>x.id==i.po);return p?lbl('suppliers',p.supplier):'—'};
M.pq={t:'Payment Requests',pre:'PQ',s:'Confirmed purchase orders from Procurement – pay or cancel them',f:[['inv','Purchase Invoice','ref','inv'],['amount','Amount','num'],['date','Date Requested','date'],['status','Status','sel',['Pending','Approved','Rejected','Paid','Cancelled']]],
 x:[['Supplier',r=>esc(supOfInv(r.inv))],['Remarks',r=>r.reason?esc(r.reason):'—']],
 a:[['Pay',r=>openForm('rc',0,{pq:r.id,amount:r.amount}),r=>['Pending','Approved'].includes(r.status)],
 ['Cancel',r=>{if(confirm('Cancel '+r.no+'?\n\nThe invoice and its Purchase Order will be cancelled.')){r.status='Cancelled';const i=D.inv.find(x=>x.id==r.inv);if(i)i.status='Cancelled';const po=i&&D.po.find(x=>x.id==i.po);if(po&&po.status=='Pending')po.status='Cancelled';save();go();toast(r.no+' cancelled.')}},r=>['Pending','Approved'].includes(r.status)]],
 after:r=>{const i=D.inv.find(x=>x.id==r.inv);if(i&&i.status=='Unpaid')i.status='Payment Requested'}};
M.rc={t:'Payment Receipts',pre:'OR',s:'Official receipts issued by Finance for paid invoices',f:[['pq','Payment Request','ref','pq'],['amount','Amount Paid','num'],['method','Payment Method','sel',['Cash','Bank Transfer','GCash','Check']],['refno','Reference No.','text'],['date','Date Paid','date']],
 x:[['Supplier',r=>esc(supOfInv(r.inv))]],
 a:[['View / Print',r=>viewRc(r.inv,r.id)]],
 after:r=>{const q=D.pq.find(x=>x.id==r.pq);if(!q)return;r.inv=q.inv;q.status='Paid';const i=D.inv.find(x=>x.id==q.inv);if(i){i.status='Paid';const po=D.po.find(x=>x.id==i.po);if(po&&!['Cancelled','Completed'].includes(po.status))po.status=recv(po.id)>=po.qty?'Completed':recv(po.id)>0?'Partial':'Paid';if(po.status=='Completed')prDone(po)}}};
M.pq.g='Every Purchase Order confirmed by Procurement arrives here. Click <b>Pay</b> to enter the payment method and reference number – this issues a receipt and marks the invoice and order as Paid – or <b>Cancel</b> to cancel the order.';
M.rc.g='Official receipts issued when Finance pays an invoice. Click <b>View / Print</b> to open a printable copy. To pay an invoice, go to Payment Requests and click <b>Pay</b>.';

M.branches={t:'Branches',s:'The 25 branches that receive materials',f:[['name','Branch Name','text'],['status','Status','sel',['Active','Inactive']]],
 x:[['Materials Held',r=>r.wh?D.items.filter(i=>i.stock>0).length:D.bs.filter(x=>x.branch==r.id&&x.stock>0).length]]};
M.bs={t:'Branch Stock',s:'Stock and reorder level of each material in each branch',f:[['branch','Branch','ref','branches'],['item','Material','ref','items'],['stock','Stock on Hand','num'],['reorder','Reorder Level','num']],
 x:[['Status',r=>r.stock<=r.reorder?'<span class="pill r1">Low Stock</span>':'<span class="pill g1">OK</span>']]};
M.dist={t:'Branch Distribution',pre:'DS',s:'Issue materials from the main warehouse to a branch',f:[['branch','Branch','ref','branches'],['item','Material','ref','items'],['qty','Quantity','num'],['date','Date Issued','date'],['status','Status','sel',['Issued']]],
 chk:v=>{const it=D.items.find(x=>x.id==v.item);if(!(v.qty>0))return'Quantity must be more than zero.';if(!it||it.stock<v.qty)return'Not enough stock in the main warehouse.\nAvailable: '+(it?it.stock:0)+' '+(it?it.unit:'')+'. Receive more goods first.'},
 after:r=>{const it=D.items.find(x=>x.id==r.item);if(it)it.stock-=r.qty;let b=D.bs.find(x=>x.branch==r.branch&&x.item==r.item);if(!b)b=ins('bs',{branch:r.branch,item:r.item,stock:0,reorder:(it&&it.reorder)||0});b.stock+=r.qty;}};
M.branches.g='The 25 branches plus the Main Warehouse. Each branch has its own stock of every material (see <b>Branch Stock</b>). Use the Branch filter on the other pages to see one branch at a time.';
M.bs.g='How much of each material every branch holds. Stock goes up automatically when you <b>Issue to Branch</b>. To change a stock or reorder level, click <b>+ New</b> and pick the same branch and material (it updates the existing row).';
/* one-per-step rules */
M.suppliers.chk=v=>{const n=String(v.name||'').trim();v.name=n;if(!n)return'Enter the supplier name.';if(D.suppliers.some(s=>String(s.name).trim().toLowerCase()==n.toLowerCase()))return'A supplier named "'+n+'" already exists.'};
M.rfq.chk=v=>{if(D.rfq.some(x=>x.supplier==v.supplier&&x.item==v.item&&x.qty==v.qty&&x.due==v.due))return'This order already exists: same company, material, quantity and date.';if(v.pr!=null&&D.rfq.some(x=>x.pr==v.pr))return'This purchase request already has an RFQ. Only one RFQ is allowed per request.'};
M.po.chk=v=>{if(D.po.some(x=>x.status!='Cancelled'&&x.supplier==v.supplier&&x.item==v.item&&x.qty==v.qty&&x.date==v.date))return'This order already exists: same company, material, quantity and date.';if(v._quo==null)return;const q=D.quo.find(x=>x.id==v._quo),f=q&&D.rfq.find(x=>x.id==q.rfq);if(!f)return;const rf=D.rfq.filter(y=>grp(y)==grp(f)).map(y=>y.id),qs=D.quo.filter(x=>rf.includes(x.rfq)).map(x=>x.id);if(D.po.some(o=>qs.includes(o._quo)&&o.status!='Cancelled'))return'A purchase order already exists for this request. Only one PO is allowed.'};
M.inv.chk=v=>{if(D.inv.some(i=>i.po==v.po&&i.status!='Cancelled'))return'This purchase order already has an invoice. Only one invoice is allowed per order.'};
M.pq.chk=v=>{if(D.pq.some(q=>q.inv==v.inv&&!['Rejected','Cancelled'].includes(q.status)))return'This invoice already has a payment request.'};
M.dist.g='Send materials from the main warehouse to a branch. Saving reduces the Warehouse Inventory stock and adds to that branch stock.';
const NEXT={pr:'Request confirmed automatically. Next: click Create RFQ.',rfq:'Next: when the supplier replies, click Add Quotation.',quo:'Next: click Proceed to Purchase Order on the request.',po:'Next: click Confirm to send it to Finance for payment.',gr:'Warehouse Inventory updated.',inv:'Next: when ready to pay, click Request Payment.',pq:'Finance will review it under Finance → Payment Requests.',rc:'Order paid. Next: record the delivery under Goods Receiving.',suppliers:'',items:'',pl:'',branches:'',bs:'',dist:'Warehouse stock reduced and branch stock increased.'};
const STEPS=[['pr','Request'],['rfq','RFQ'],['po','Order'],['inv','Invoice & Payment'],['gr','Receive']];
const todo=t=>({pr:D.pr.filter(x=>['Pending','Confirmed'].includes(x.status)).length,rfq:D.rfq.filter(x=>x.status=='Sent').length,quo:D.quo.filter(x=>x.status=='Received').length,po:D.po.filter(x=>x.status=='Open').length,inv:D.pq.filter(x=>['Pending','Approved'].includes(x.status)).length,gr:D.po.filter(x=>['Paid','Partial'].includes(x.status)).length}[t]||0);
const flowBar=()=>`<div class="flow">${STEPS.map((x,i)=>`<div class="st ${x[0]==cur?'on':''}" onclick="nav('${x[0]}')"><b>${i+1}</b>${x[1]}${todo(x[0])?`<em title="Needs action">${todo(x[0])}</em>`:''}</div>`).join('')}</div>`;
const flow=()=>'';
const guide=t=>'';
let HL=null;
function nav(v){HL=null;cur=v;if(isProc(v)){pOpen=true;fOpen=iOpen=false}if(isFin(v)){fOpen=true;pOpen=iOpen=false}if(isInv(v)){iOpen=true;pOpen=fOpen=false}$('#q').value='';go()}
function toast(){}
const NAV=[['pdash','Dashboard'],['suppliers','Suppliers'],['po','Purchase Orders'],['gr','Goods Receiving'],['rec','Supplier Records'],['arch','Archive']];
/* pages that live under a tab bar belong to one sidebar item */
const TABG=[['po','pr','rfq','quo'],['gr','inv']],TABL={po:'Purchase Order',pr:'Purchase Request',rfq:'Requests for Quotation',quo:'Supplier Quotations',gr:'Goods Receipts',inv:'Invoice / Payables'};
const navKey=v=>String(v).startsWith('sup:')?'suppliers':(TABG.find(g=>g.includes(v))||[v])[0];
const tabsBar=t=>{const g=TABG.find(x=>x.includes(t));return g?`<div class="tabs">${g.map(v=>`<a class="${v==t?'on':''}" onclick="nav('${v}')">${TABL[v]}</a>`).join('')}</div>`:''};
/* ---------- DATABASE (persistent, localStorage) ---------- */
let D=window.__D||null,SYNC={};if(D)for(const k in D)SYNC[k]=JSON.stringify(D[k]);
/* ---------- ARCHIVE: dated history of everything created, changed or deleted ---------- */
const LOGT=['items','suppliers','pr','rfq','quo','po','inv','gr','pq','rc','dist'];
const nowStamp=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds())};
function logInfo(t,r){const sp=D.suppliers.find(x=>x.id==r.supplier),it=D.items.find(x=>x.id==r.item),p=[];if(t=='suppliers'||t=='items')p.push(r.name);else{if(sp)p.push(sp.name);if(it)p.push(it.name);if(r.qty!=null)p.push('Qty '+r.qty);if(r.price!=null)p.push('₱'+Number(r.price).toFixed(2)+'/unit');if(r.amount!=null&&t!='gr')p.push('₱'+Number(r.amount).toFixed(2))}return p.filter(Boolean).join(' · ')}
/* key-order and null-proof fingerprint, so a record read back from MySQL never looks "changed" */
const stab=o=>JSON.stringify(o,(k,v)=>v&&typeof v=='object'&&!Array.isArray(v)?Object.keys(v).sort().reduce((a,x)=>{if(v[x]!=null)a[x]=v[x];return a},{}):v);
function archiveSync(){try{D.log=D.log||[];const first=!D.snap,snap=D.snap||{},nxt={};let by='';try{by=USER&&USER.name||''}catch(e){}
 const add=(act,t,no,ord,text)=>D.log.push({id:(D.log.length?D.log[D.log.length-1].id:0)+1,ts:nowStamp(),act,t,no:no||'',ord:ord||'',text,by});
 LOGT.forEach(t=>{const hasOld=!!snap[t],old=snap[t]||{};nxt[t]={};(D[t]||[]).forEach(r=>{const no=r.no||r.name||'',h=stab(Object.assign({},r,{no:0,ord:0})),o=old[r.id];nxt[t][r.id]={no,ord:r.ord||'',st:r.status||'',h,txt:logInfo(t,r)};
   if(first||!hasOld)return;if(!o)add('Created',t,no,r.ord,logInfo(t,r));else if(o.h!=h){if(o.st!=(r.status||''))add('Status changed',t,no,r.ord,(o.st||'—')+' → '+(r.status||'—')+(logInfo(t,r)?' · '+logInfo(t,r):''));else add('Updated',t,no,r.ord,logInfo(t,r))}});
  if(!first&&hasOld)Object.keys(old).forEach(id=>{if(!nxt[t][id])add('Deleted',t,old[id].no,old[id].ord,(old[id].st?'Status was '+old[id].st+' · ':'')+old[id].txt)})});
 D.snap=nxt;if(D.log.length>3000)D.log=D.log.slice(-3000)}catch(e){}}
let SQ=Promise.resolve(),SERR=0;
/* saves only the collections that changed, in order, to MySQL through api.php */
function pushDB(){const parts={};for(const k in D){const j=JSON.stringify(D[k]);if(SYNC[k]!==j){parts[k]=D[k];SYNC[k]=j}}if(!Object.keys(parts).length)return SQ;
 SQ=SQ.then(()=>fetch('api.php?a=save',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({parts})}).then(r=>r.json().catch(()=>({ok:false,error:'Bad server reply'}))).then(j=>{if(!j.ok)throw new Error(j.error||'Save failed')})).catch(e=>{Object.keys(parts).forEach(k=>delete SYNC[k]);if(!SERR){SERR=1;alert('Could not save to the database: '+e.message+'\n\nCheck that MySQL is running in XAMPP, then try again.');setTimeout(()=>SERR=0,4000)}});return SQ}
function save(){archiveSync();pushDB()}
const ORDT=['pr','rfq','quo','po','inv','gr','pq','rc','dist'];
/* Order numbers are plain numbers (0001, 0002, ...). A deleted order's number is freed: the next new order takes the lowest number not in use. */
function ordNew(){D.seq=D.seq||{};const used=new Set(ORDT.flatMap(t=>(D[t]||[]).map(x=>+String(x.ord||'').replace(/\D/g,'')||0)));let n=1;while(used.has(n))n++;D.seq.ord=n;return String(n).padStart(4,'0')}
function ordParent(t,r){const f=(a,id)=>(D[a]||[]).find(x=>x.id==id);const g={rfq:()=>f('pr',r.pr),quo:()=>f('rfq',r.rfq),po:()=>f('quo',r._quo),inv:()=>f('po',r.po),gr:()=>f('po',r.po),pq:()=>f('inv',r.inv),rc:()=>f('pq',r.pq)||f('inv',r.inv),dist:()=>f('pr',r.pr)}[t];const x=g&&g();return x&&x.ord}
const poTaken=(o,self)=>D.po.some(p=>p!==self&&p.ord==o);
const ordFor=(t,r)=>{const o=ordParent(t,r);if(o&&!(t=='po'&&poTaken(o,r)))return o;return t=='dist'&&!o?undefined:ordNew()};
function ins(t,r){D.seq[t]=Math.max(D.seq[t]||0,...D[t].map(x=>x.id||0))+1;r.id=D.seq[t];r.cdate=r.cdate||today;r.no=(M[t].pre||'')+String(D[t].length+1).padStart(4,'0');if(ORDT.includes(t)&&!r.ord){const o=ordFor(t,r);if(o)r.ord=o}D[t].push(r);return r}
function ordClose(){const nums=[...new Set(ORDT.flatMap(t=>(D[t]||[]).map(x=>x.ord).filter(Boolean)))].sort((a,b)=>a-b),map={};nums.forEach((o,i)=>map[o]=String(i+1).padStart(4,'0'));ORDT.forEach(t=>(D[t]||[]).forEach(x=>{if(x.ord)x.ord=map[x.ord]}));D.seq=D.seq||{};D.seq.ord=nums.length}
function ordStrip(){ORDT.forEach(t=>(D[t]||[]).forEach(x=>{if(x.ord)x.ord=String(x.ord).replace(/\D/g,'').padStart(4,'0')}))}
function renum(t){if(M[t].pre)D[t].forEach((x,i)=>x.no=M[t].pre+String(i+1).padStart(4,'0'))}
if(!D){D={ver:5,seq:{},suppliers:[],pr:[],rfq:[],quo:[],po:[],gr:[],inv:[],pq:[],rc:[],bs:[],dist:[],branches:[],opts:{},items:[]};
 [['Filtered Water','Filtered Water','liters',2000,500],['Empty Container 5G','Empty Container','pcs',120,30],['Filter Cartridge','Filter','pcs',5,10],['Bottle Cap','Caps','pcs',40,100],['Safety Seal','Seals','pcs',300,100],['Label','Label','pcs',80,100]].forEach(a=>ins('items',{name:a[0],cat:a[1],unit:a[2],stock:a[3],reorder:a[4]}));
 [['AquaPlast Corp.','Maria Cruz','0917-555-0101','sales@aquaplast.ph','Calamba, Laguna'],['PureFilter Trading','John Reyes','0918-555-0202','info@purefilter.ph','Silang, Cavite'],['ChemSource PH','Ana Lim','0920-555-0303','ana@chemsource.ph','Makati City']].forEach(a=>ins('suppliers',{name:a[0],contact:a[1],phone:a[2],email:a[3],address:a[4],status:'Active'}));
 ins('pr',{item:3,qty:50,dept:'Production',date:today,status:'Confirmed'});ins('pr',{item:4,qty:500,dept:'Production',date:today,status:'Pending'});
 ins('rfq',{pr:1,supplier:2,due:today,status:'Responded'});ins('quo',{rfq:1,supplier:2,item:3,qty:50,price:180,status:'Accepted'});
 ins('po',{supplier:2,item:3,qty:50,price:180,date:today,status:'Open'});ins('po',{supplier:1,item:2,qty:200,price:95,date:today,status:'Open'});
save()}
D.pq=D.pq||[];D.rc=D.rc||[];D.pr.forEach(p=>{if(p.status=='Approved'||p.status=='Pending')p.status='Confirmed';if(p.status=='Issued')p.status='Completed'});D.suppliers.forEach(x=>{if(x.status=='Inactive')x.status='Deactivated'});D.msgs=D.msgs||[];D.bs=D.bs||[];D.dist=D.dist||[];D.branches=D.branches||[];D.rfq.forEach(r=>{const p=D.pr.find(x=>x.id==r.pr);if(p&&r.branch==null)r.branch=p.branch});D.quo.forEach(q=>{const f=D.rfq.find(x=>x.id==q.rfq);if(f&&q.branch==null)q.branch=f.branch});D.po.forEach(p=>{const q=D.quo.find(x=>x.id==p._quo);if(q&&p.branch==null)p.branch=q.branch});D.opts=D.opts||{};delete D.opts['inv.status'];delete D.opts['po.status'];D.po.forEach(p=>{if(p.status=='Received'){const i=D.inv.find(x=>x.po==p.id);p.status=i&&i.status=='Paid'?'Paid':'Pending'}});D.items=D.items||[];if(!D.noWater){D.items=D.items.filter(i=>i.name!='Filtered Water');D.bs=D.bs.filter(b=>D.items.some(i=>i.id==b.item));if(D.opts['items.cat'])D.opts['items.cat']=[...new Set(D.opts['items.cat'].filter(c=>c!='Filtered Water').concat('Filtration Tank'))];D.noWater=1}if(!D.ver){D.po.forEach(p=>{if(p.status=='Paid'||p.status=='Pending')p.status='Completed'});D.ver=3}if(D.ver<4){D.po.forEach(p=>{if(p.status=='Accepted')p.status='Confirmed';if(p.status=='Rejected')p.status='Open';if(p.status=='Confirmed'&&!D.inv.some(i=>i.po==p.id)){const i=ins('inv',{po:p.id,amount:p.qty*p.price,due:today,status:'Payment Requested'});ins('pq',{inv:i.id,amount:i.amount,date:today,status:'Pending'})}});delete D.fo;D.ver=4}if(D.ver<5){D.po.forEach(p=>{if(p.status=='Confirmed')p.status='Pending'});D.ver=5}if(!D.prDone){D.pr.forEach(p=>{if(p.status=='Ordered')p.status=poFor(p).some(o=>o.status=='Completed')?'Completed':'RFQ Sent'});D.prDone=1}D.gr.forEach(g=>{if(g.status=='Posted')g.status='Updated'});delete D.opts['gr.status'];delete D.opts['rfq.status'];D.rfq.forEach(r=>{if(r.status=='Closed')r.status='Finished'});
{const seen=new Set(),used=new Set(D.po.map(p=>p._quo));D.quo=D.quo.filter(q=>{const k=[q.rfq,q.supplier,q.item,q.qty,q.price,q.status].join('|');if(seen.has(k)&&!used.has(q.id))return false;seen.add(k);return true})}
D.items.forEach(i=>{if(i.cat=='Caps & Seals')i.cat=/seal/i.test(i.name)?'Seals':'Caps'});if(D.opts['items.cat'])D.opts['items.cat']=[...new Set(D.opts['items.cat'].flatMap(c=>c=='Caps & Seals'?['Caps','Seals']:[c]))];D.pr.forEach(p=>{if(p.status=='Quoted')p.status='RFQ Sent'});D.rfq.forEach(r=>{const p=D.pr.find(x=>x.id==r.pr);if(p&&r.item==null){r.item=p.item;r.qty=p.qty}});
(()=>{const f=n=>D.items.find(x=>x.name==n),E=(n,c,st,ro)=>f(n)||ins('items',{name:n,cat:c,unit:'pcs',stock:st,reorder:ro});
 const a=f('Empty Container 5G');if(a)a.name='5-Gallon Round Container';const b=f('Bottle Cap');if(b)b.name='Round Container Cap';
 E('5-Gallon Round Container','Empty Container',150,30);E('5-Gallon Slim Container','Empty Container',100,30);E('Round Container Cap','Caps',200,100);E('Slim Container Small Cap','Caps',150,100);E('Slim Container Big Cap','Caps',150,100);E('Multi-Filtration Tank','Filtration Tank',10,3);
 if(!D.pl){D.pl=[];const S=n=>(D.suppliers.find(x=>x.name==n)||{}).id,P={
 'AquaPlast Corp.':{'5-Gallon Round Container':95,'5-Gallon Slim Container':130,'Round Container Cap':4.5,'Slim Container Small Cap':3.5,'Slim Container Big Cap':5,'Safety Seal':1.2,'Label':0.8,'Filter Cartridge':185},
 'PureFilter Trading':{'5-Gallon Round Container':98,'5-Gallon Slim Container':126,'Round Container Cap':4.2,'Slim Container Small Cap':3.8,'Slim Container Big Cap':5.5,'Safety Seal':1,'Label':0.9,'Filter Cartridge':180},
 'ChemSource PH':{'5-Gallon Round Container':92,'5-Gallon Slim Container':135,'Round Container Cap':4.8,'Slim Container Small Cap':3.2,'Slim Container Big Cap':4.6,'Safety Seal':1.4,'Label':0.7,'Filter Cartridge':172}};
 Object.entries(P).forEach(([sn,o])=>Object.entries(o).forEach(([n,pr])=>{const i=f(n);if(S(sn)&&i)ins('pl',{supplier:S(sn),item:i.id,price:pr})}))}})();
const BR=["Alaminos (San Pablo)", "Bagong Pook", "Barangay I-A", "Barangay I-B", "Barangay II-A", "Barangay II-B", "Barangay III-A", "Barangay III-B", "Barangay IV-A", "Barangay IV-B", "Barangay V-A", "Barangay V-B", "Barangay VI-A", "Barangay VI-B", "Barangay VII-A", "Barangay VII-B", "Bautista", "Concepcion", "Del Remedio", "Dolores", "San Antonio", "San Buenaventura", "San Crispin", "San Francisco", "San Gabriel"];if(!D.branches.length)BR.forEach(n=>ins('branches',{name:n,status:'Active'}));if(!D.branches.some(b=>b.wh))ins('branches',{name:'Main Warehouse',wh:1,status:'Active'});
if(!D.sampleBS){const L=D.branches.filter(b=>!b.wh),I=D.items.filter(i=>i.cat!='Filtered Water');L.forEach((b,bi)=>I.forEach((it,ii)=>{if(!D.bs.some(x=>x.branch==b.id&&x.item==it.id))ins('bs',{branch:b.id,item:it.id,stock:20+((bi*7+ii*13)%15)*10,reorder:it.reorder||0})}));D.sampleBS=1;save()}
if(!D.tankPL){const t=D.items.find(i=>i.name=='Multi-Filtration Tank');if(t){D.pl=D.pl||[];[['AquaPlast Corp.',8500],['PureFilter Trading',8500],['ChemSource PH',8500]].forEach(([n,p])=>{const sp=D.suppliers.find(x=>x.name==n);if(sp&&!D.pl.some(x=>x.supplier==sp.id&&x.item==t.id))ins('pl',{supplier:sp.id,item:t.id,price:p})});D.tankPL=1}}
if(!D.tankP2){const t=D.items.find(i=>i.name=='Multi-Filtration Tank');if(t){D.pl.forEach(p=>{if(p.item==t.id)p.price=8500});D.tankP2=1}}
if(!D.tankBS){const t=D.items.find(i=>i.name=='Multi-Filtration Tank');if(t){D.branches.filter(b=>!b.wh).forEach((b,bi)=>{if(!D.bs.some(x=>x.branch==b.id&&x.item==t.id))ins('bs',{branch:b.id,item:t.id,stock:2+(bi*3)%6,reorder:2})});D.tankBS=1;save()}}
D.inv.forEach(i=>{if(i.status=='Paid'&&!D.rc.some(c=>c.inv==i.id)){const q=D.pq.find(x=>x.inv==i.id);ins('rc',{pq:q?q.id:null,inv:i.id,amount:i.amount,method:'Not recorded',refno:'—',date:i.due||today})}});
ORDT.forEach(t=>D[t].forEach(r=>{if(!r.ord){const o=ordFor(t,r);if(o)r.ord=o}}));
{const seenO=new Set();D.po.forEach(p=>{if(seenO.has(p.ord)){p.ord=ordNew();D.inv.filter(i=>i.po==p.id).forEach(i=>{i.ord=p.ord;D.pq.filter(q=>q.inv==i.id).forEach(q=>{q.ord=p.ord;D.rc.filter(c=>c.pq==q.id||c.inv==i.id).forEach(c=>c.ord=p.ord)})});D.gr.filter(g=>g.po==p.id).forEach(g=>g.ord=p.ord)}seenO.add(p.ord)})}
ordStrip();if(!D.ordFixed){ordClose();D.ordFixed=1}['pr','rfq','quo','po','gr','inv','pq','rc','dist'].forEach(renum);save();
const isWh=id=>!!(D.branches.find(x=>x.id==id)||{}).wh;
const brOf=(t,r)=>t=='gr'||t=='inv'?(D.po.find(x=>x.id==r.po)||{}).branch:r.branch;
const issued=id=>D.dist.filter(g=>g.pr==id).reduce((a,g)=>a+g.qty,0);
const recv=id=>D.gr.filter(g=>g.po==id).reduce((a,g)=>a+g.qty,0);
const lbl=(t,id)=>{const r=D[t].find(x=>x.id==id);return r?(r.name||r.no+(r.item?' · '+lbl('items',r.item):r.inv?' · '+lbl('inv',r.inv):'')):'—'};
const tot=r=>r.qty*r.price;
['pr','rfq','quo','po','gr','inv','pq','dist'].forEach(t=>M[t].nostat=1);ORDT.forEach(t=>M[t].ord=1);
/* ---------- UI ---------- */
let cur='dash',pOpen=false,fOpen=false,iOpen=false;const $=s=>document.querySelector(s);
const PROC=new Set([...NAV.map(n=>n[0]),'pr','rfq','quo','inv']),isProc=v=>PROC.has(v)||v.startsWith('sup:');
const FNAV=[['pq','Payment Requests'],['rc','Payment Receipts'],['msgs','Messages']],isFin=v=>FNAV.some(n=>n[0]==v);
const INAV=[['items','Warehouse Inventory'],['branches','Branches'],['bs','Branch Stock'],['dist','Branch Distribution']],isInv=v=>INAV.some(n=>n[0]==v);
const MODS={inventory:'Inventory',production:'Production',sales:'Sales & CRM',finance:'Finance',hr:'HR & Payroll',audit:'Audit Trail'};
const soon=k=>head(MODS[k]||'Module','This module is not part of the Procurement system yet')+`<div class="card soon"><h3>${esc(MODS[k]||'Module')}</h3><p>This section is coming soon.</p></div>`;
$('#nav').innerHTML=NAV.map(n=>`<a data-v="${n[0]}">${n[1]}</a>`).join('');
$('#inav').innerHTML=INAV.map(n=>`<a data-v="${n[0]}">${n[1]}</a>`).join('');
$('#fnav').innerHTML=FNAV.map(n=>`<a data-v="${n[0]}">${n[1]}</a>`).join('');
document.querySelectorAll('aside a').forEach(a=>a.onclick=()=>{const v=a.dataset.v;if(v=='proc'){pOpen=!pOpen;fOpen=iOpen=false;if(pOpen&&!isProc(cur))cur='pdash'}else if(v=='fin'){fOpen=!fOpen;pOpen=iOpen=false;if(fOpen&&!isFin(cur))cur='pq'}else if(v=='invt'){iOpen=!iOpen;pOpen=fOpen=false;if(iOpen&&!isInv(cur))cur='items'}else{cur=v;pOpen=isProc(v);fOpen=isFin(v);iOpen=isInv(v)}$('#q').value='';go()});
$('#q').oninput=go;$('#qx').onclick=()=>{$('#q').value='';go()};try{if(localStorage.getItem('aqua_theme')=='dark')document.body.classList.add('dark')}catch(e){}
$('#th').onclick=()=>{const d=document.body.classList.toggle('dark');try{localStorage.setItem('aqua_theme',d?'dark':'light')}catch(e){}};
const PRC={Pending:'o1',Confirmed:'b1','RFQ Sent':'p1',Completed:'g1',Issued:'t1',Rejected:'r1'};
const STC={suppliers:{Active:'g1',Deactivated:'y1'},branches:{Active:'g1',Inactive:'y1'},
pr:{Pending:'o1',Confirmed:'b1','RFQ Sent':'p1',Completed:'g1',Rejected:'r1'},
rfq:{Sent:'b1',Responded:'a1',Finished:'g1'},
quo:{Received:'b1',Accepted:'g1',Rejected:'r1'},
po:{Open:'b1',Pending:'p1',Paid:'a1',Partial:'o1',Completed:'g1',Cancelled:'y1'},
inv:{Unpaid:'r1','Payment Requested':'o1',Paid:'g1',Cancelled:'y1'},
pq:{Pending:'o1',Approved:'b1',Rejected:'r1',Paid:'g1',Cancelled:'y1'},
gr:{Updated:'g1'},dist:{Issued:'t1'}};
const badge=(v,t)=>`<span class="pill ${((STC[t]||{})[v])||'y1'}">${esc(v)}</span>`;
const head=(t,s,btn='')=>`<div class="top"><div>${isProc(cur)||String(cur).startsWith('sup:')?'<div class="bc">Procurement</div>':isFin(cur)?'<div class="bc">Finance</div>':isInv(cur)?'<div class="bc">Inventory</div>':''}<h1>${t}</h1><div class="sub">${s}</div></div>${btn}</div>`;
function go(){if(!canView(cur))cur='pdash';setTimeout(()=>{const e=document.getElementById('hlrow');if(e){e.scrollIntoView({block:'center',behavior:'smooth'});setTimeout(()=>{HL=null;e.classList.remove('hl')},4000)}},60);document.querySelectorAll('aside a').forEach(a=>a.classList.toggle('on',a.dataset.v=='proc'?pOpen:a.dataset.v=='fin'?fOpen:a.dataset.v=='invt'?iOpen:a.dataset.v==navKey(cur)));
 $('#nav').classList.toggle('open',pOpen);$('#fnav').classList.toggle('open',fOpen);$('#inav').classList.toggle('open',iOpen);
 $('#pg').innerHTML=cur=='dash'?'':cur=='pdash'?dash():cur=='rep'?rep():cur.startsWith('mod:')?soon(cur.slice(4)):cur=='rec'?rec():cur=='arch'?arch():cur=='msgs'?msgs():cur.startsWith('sup:')?supPage(+cur.slice(4)):list(cur);try{refreshMsgBadge()}catch(e){}}
const KI={chk:'<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" stroke-width="2.4"/>',
clk:'<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M12 6.5V12l3.500 2" stroke="#fff" stroke-width="2.4"/>',
box:'<path d="M12 2l9 5v10l-9 5-9-5V7z" fill="currentColor"/><path d="M3 7l9 5 9-5M12 12v10" stroke="#fff" stroke-width="1.600"/>',
trk:'<rect x="1" y="6" width="13" height="10" rx="2" fill="currentColor"/><path d="M14 9h4l4 4v3h-8z" fill="currentColor"/><circle cx="6" cy="18" r="2.200" fill="currentColor" stroke="#fff"/><circle cx="18" cy="18" r="2.200" fill="currentColor" stroke="#fff"/>',
doc:'<path d="M5 2h11l4 4v16H5z" fill="currentColor"/><path d="M9 10h7M9 14h7M9 18h4" stroke="#fff" stroke-width="1.800"/>',
bag:'<path d="M3 8h18l-2 13H5z" fill="currentColor"/><path d="M8 8l4-6 4 6" stroke="currentColor" stroke-width="2"/><path d="M9 14l2 2 4-4" stroke="#fff" stroke-width="2"/>',
x:'<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M8.500 8.500l7 7M15.500 8.500l-7 7" stroke="#fff" stroke-width="2.400"/>',
mail:'<path d="M3 8l9-6 9 6v12H3z" fill="currentColor"/><path d="M3 8l9 6 9-6" stroke="#fff" stroke-width="1.800"/>',
send:'<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" fill="currentColor"/>',
cal:'<rect x="3" y="4" width="18" height="17" rx="2" fill="currentColor"/><path d="M3 9h18M8 2v4M16 2v4" stroke="#fff" stroke-width="1.800"/><path d="M12 13v4" stroke="#fff" stroke-width="2"/>'};
const kic=l=>{l=l.toLowerCase();const k=/supplier/.test(l)&&/total/.test(l)?'trk':/active|completed|paid|accepted|finished|ok|approved/.test(l)?'chk':/pending|sent/.test(l)?'clk':/reject|cancel/.test(l)?'x':/open/.test(l)?'mail':/respond/.test(l)?'mail':/due|unpaid/.test(l)?'cal':/units|stock|items|received|awaiting|distribut/.test(l)?'box':/spend|value|total|amount|invoice|receipts|request|quotation|rfq/.test(l)?'doc':'bag';return `<svg class="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${KI[k]}</svg>`};
let SORT={};
const sortKeys=t=>{const m=M[t];return[...(m.ord?[['__ord','Order No.']]:[]),...(m.pre&&!NONO.includes(t)?[['no','No.']]:[]),...m.f.map(f=>[f[0],f[1]])]};
const qSync=el=>{$('#q').value=el.value;go();const n=$('#q2');if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}};
const qClr=()=>{$('#q').value='';go()};
const toolbar=t=>`<div class="tbar"><div class="tsr"><svg class="si" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="q2" placeholder="Search ${esc(M[t].t)}..." value="${esc($('#q').value)}" oninput="qSync(this)" autocomplete="off"><button type="button" class="x" title="Clear" onclick="qClr()">×</button></div><select class="tsort" title="Sort" onchange="SORT['${t}']=this.value;go()"><option value="">Sort</option>${sortKeys(t).map(([k,l])=>`<option value="${k}" ${SORT[t]==k?'selected':''}>${l}</option>`).join('')}</select></div>`;
function kpiBar(t){const N=(a,s)=>a.filter(x=>s.includes(x.status)).length,S=(a,f)=>a.reduce((c,x)=>c+(f(x)||0),0),po=D.po,live=po.filter(p=>p.status!='Cancelled');
const K={suppliers:[['Total Suppliers',D.suppliers.length],['Active Suppliers',N(D.suppliers,['Active'])],['Open POs',N(po,['Open','Pending','Paid','Partial'])],['Spend (POs)',fmt(S(live,tot))]],
items:[['Total Items',D.items.length],['Low Stock',D.items.filter(i=>i.stock<i.reorder).length],['Units on Hand',S(D.items,i=>i.stock)],['Categories',new Set(D.items.map(i=>i.cat)).size]],
branches:[['Total Branches',D.branches.length],['Active',N(D.branches,['Active'])],['Inactive',D.branches.length-N(D.branches,['Active'])]],
pr:[['Total Requests',D.pr.length],['Pending',N(D.pr,['Pending','RFQ Sent'])],['Completed',N(D.pr,['Completed'])],['Issued',N(D.pr,['Issued'])]],
rfq:[['Total RFQs',D.rfq.length],['Sent',N(D.rfq,['Sent'])],['Responded',N(D.rfq,['Responded'])],['Finished',N(D.rfq,['Finished'])]],
quo:[['Total Quotations',D.quo.length],['Received',N(D.quo,['Received'])],['Accepted',N(D.quo,['Accepted'])],['Rejected',N(D.quo,['Rejected'])]],
po:[['Pending',N(po,['Pending'])],['Paid',N(po,['Paid'])],['Completed',N(po,['Completed'])],['Total Value',fmt(S(live,tot))]],
inv:[['Invoices',D.inv.length],['Unpaid',N(D.inv,['Unpaid','Payment Requested'])],['Paid',N(D.inv,['Paid'])],['Amount Due',fmt(S(D.inv.filter(i=>['Unpaid','Payment Requested'].includes(i.status)),i=>i.amount))]],
pq:[['Pending',N(D.pq,['Pending','Approved'])],['Paid',N(D.pq,['Paid'])],['Cancelled',N(D.pq,['Cancelled'])],['Amount Due',fmt(S(D.pq.filter(q=>['Pending','Approved'].includes(q.status)),q=>q.amount))]],
rc:[['Receipts',D.rc.length],['Total Paid',fmt(S(D.rc,r=>r.amount))]],
gr:[['Receipts',D.gr.length],['Units Received',S(D.gr,g=>g.qty)],['Awaiting Delivery',N(po,['Paid','Partial'])],['Completed POs',N(po,['Completed'])]],
dist:[['Distributions',D.dist.length],['Units Issued',S(D.dist,x=>x.qty)],['Branches Served',new Set(D.dist.map(x=>x.branch)).size]],
bs:[['Stock Rows',D.bs.length],['Low Stock',D.bs.filter(b=>b.stock<b.reorder).length],['Units on Hand',S(D.bs,b=>b.stock)]]}[t];
return K?`<div class="kpis">${K.map(([l,v])=>`<div class="kpi"><div>${kic(l)}${l}</div><b>${v}</b></div>`).join('')}</div>`:''}
const NONO=['pr','rfq','quo','po','inv','gr'];
function list(t){const m=M[t],q=$('#q').value.toLowerCase(),hasB=m.f.some(f=>f[0]=='branch');
 const rows=D[t].filter(r=>(t!='bs'||!isWh(r.branch))&&(!BF||!hasB||brOf(t,r)==BF)&&(!q||JSON.stringify(r).toLowerCase().includes(q)||m.f.some(f=>f[2]=='ref'&&lbl(f[3],r[f[0]]).toLowerCase().includes(q))));
 if(NONO.includes(t))rows.sort((a,b)=>(+a.ord||0)-(+b.ord||0)||a.id-b.id);
 if(SORT[t]){const k=SORT[t],fd=m.f.find(f=>f[0]==k),v=r=>k=='__ord'?(+r.ord||0):fd&&fd[2]=='ref'?lbl(fd[3],r[k]):r[k];rows.sort((a,b)=>{const x=v(a),y=v(b);return typeof x=='number'&&typeof y=='number'?x-y:String(x??'').localeCompare(String(y??''),undefined,{numeric:true})})}
 let h=(STEPS.some(x=>x[0]==t)?flow():'')+guide(t)+head(m.t,m.s,(m.nonew||!canAdd(t)?'':`<button class="btn new" onclick="openForm('${t}')">Add New +</button>`)+(t=='po'?` <button class="btn" onclick="exportOrders()">Export to Excel</button>`:''))+tabsBar(t)+kpiBar(t)+(hasB?bfSel(t):'')+(t=='gr'?gwait():'')+`<div class="card tw">${toolbar(t)}<table><tr>${m.ord?'<th>Order No.</th>':''}${m.pre&&!NONO.includes(t)?'<th>No.</th>':''}${m.f.map(f=>`<th>${f[1]}</th>`).join('')}${m.tot?'<th>Total</th>':''}${(m.x||[]).map(x=>`<th>${x[0]}</th>`).join('')}${t=='items'?'<th>Status</th>':t=='inv'?'<th>Invoice</th>':'<th>Actions</th>'}</tr>`;
 rows.forEach(r=>{h+=`<tr${m.ord&&r.ord&&r.ord==HL?' class="hl" id="hlrow"':''}>${m.ord?`<td><b class="ordno">${esc(r.ord||'—')}</b></td>`:''}${m.pre&&!NONO.includes(t)?`<td><b>${r.no}</b></td>`:''}${m.f.map(([k,,ty,o])=>`<td>${t=='suppliers'&&k=='name'?`<a class="lnk" onclick="nav('sup:${r.id}')">${esc(r[k])}</a>`:ty=='ref'?esc(lbl(o,r[k])):k=='status'?badge(r[k],t):['price','amount'].includes(k)?fmt(r[k]):esc(r[k])}</td>`).join('')}${m.tot?`<td>${fmt(tot(r))}</td>`:''}${(m.x||[]).map(x=>`<td>${x[1](r)}</td>`).join('')}${t=='items'?`<td>${r.stock<=r.reorder?'<span class="pill r1">Low Stock</span>':'<span class="pill g1">In Stock</span>'}</td>`:`<td class="acts">${(m.a||[]).map((a,i)=>(a[2]&&!a[2](r))||!canAct(t,a[0])?'':`<button class="btn s" onclick="act('${t}',${D[t].indexOf(r)},${i})">${a[0]}</button>`).join('')}${(m.nodel&&m.nodel(r))||!isSuper()?'':`<button class="btn s r" title="Delete" aria-label="Delete" onclick="del('${t}',${D[t].indexOf(r)})"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/></svg></button>`}${t=='po'?msgBtn(r):''}</td>`}</tr>`});
 return h+(rows.length?'':'<tr><td colspan=9>No records yet.</td></tr>')+'</table></div>'}
const supSel=r=>`<select class="pill stsel ${r.status=='Active'?'g1':'y1'}" title="Change supplier status" onchange="setSup(${r.id},this.value)">${['Active','Deactivated'].map(v=>`<option ${r.status==v?'selected':''}>${v}</option>`).join('')}</select>`;
function setSup(id,v){const x=D.suppliers.find(y=>y.id==id);if(!x)return;x.status=v;save();go()}
const quoPO=id=>{const q=D.quo.find(x=>x.id==id);if(q&&q.status=='Received')openForm('po',0,{supplier:q.supplier,item:q.item,qty:q.qty,price:q.price,_quo:q.id})};
const quoRej=id=>{const q=D.quo.find(x=>x.id==id);if(q&&q.status=='Received'&&canAct('rfq','Reject Quotation')&&confirm('Reject quotation '+q.no+'?')){q.status='Rejected';save();go()}};
const act=(t,ix,i)=>{if(!canAct(t,M[t].a[i][0]))return;M[t].a[i][1](D[t][ix])};
function del(t,ix){if(!isSuper())return;const m0=M[t],r0=D[t][ix];if(!r0||(m0&&m0.nodel&&m0.nodel(r0)))return;if(confirm('Delete this record?')){const x=D[t].splice(ix,1)[0];if(t=='po')D.msgs=(D.msgs||[]).filter(m=>m.po!=x.id);
 if(t=='pr'){const rs=D.rfq.filter(y=>y.pr==x.id&&!D.po.some(p=>D.quo.some(q=>q.id==p._quo&&q.rfq==y.id))),ri=rs.map(y=>y.id);D.quo=D.quo.filter(q=>!ri.includes(q.rfq));D.rfq=D.rfq.filter(y=>!ri.includes(y.id));renum('rfq')}
 if(t=='pq'&&x.status!='Paid'){const i=D.inv.find(y=>y.id==x.inv);if(i&&i.status=='Payment Requested')i.status='Unpaid'}
 if(t=='rc'){const q=D.pq.find(y=>y.id==x.pq),i=D.inv.find(y=>y.id==x.inv);if(q)q.status='Pending';if(i){i.status='Payment Requested';const po=D.po.find(y=>y.id==i.po);if(po&&po.status=='Paid')po.status='Pending'}}
 if(t=='dist'){const it=D.items.find(y=>y.id==x.item),b=D.bs.find(y=>y.branch==x.branch&&y.item==x.item);if(it)it.stock+=x.qty;if(b)b.stock=Math.max(0,b.stock-x.qty);if(x.pr){const p=D.pr.find(y=>y.id==x.pr);if(p&&p.status=='Issued')p.status='Completed'}}
 renum(t);save();go()}}
function rows(t,k,o,r){let a=D[o];
 if(o=='branches'){a=[...a].sort((x,y)=>(y.wh?1:0)-(x.wh?1:0));if(['dist','bs'].includes(t))a=a.filter(x=>!x.wh)}
 if(o=='items'&&['pr','rfq','quo','po','pl','dist','bs'].includes(t))a=a.filter(x=>x.cat!='Filtered Water'||x.id==r[k]);
 if(t=='quo'&&k=='item'){const id=r.rfq??(D.rfq.find(x=>x.status!='Finished')||{}).id,f=D.rfq.find(x=>x.id==id);if(f)a=a.filter(x=>x.id==f.item)}
 if(t=='po'&&k=='item'&&LINK&&LINK._quo)a=a.filter(x=>x.id==r.item);
 if(t=='rfq'&&k=='item'&&LINK&&LINK._pr)a=a.filter(x=>x.id==r.item);
 if(t=='pl'&&k=='supplier'&&r.supplier)a=a.filter(x=>x.id==r.supplier);
 if(t=='quo'&&k=='rfq')a=a.filter(x=>x.status!='Finished'||x.id==r.rfq);
 if(t=='dist'&&LINK&&LINK._pr&&(k=='item'||k=='branch'))a=a.filter(x=>x.id==r[k]);
 if(t=='gr'&&k=='po')a=a.filter(x=>['Paid','Partial'].includes(x.status)||x.id==r.po);
 if(t=='rc'&&k=='pq')a=a.filter(x=>['Pending','Approved'].includes(x.status)||x.id==r.pq);if(t=='pq'&&k=='inv')a=a.filter(x=>x.status=='Unpaid'||x.id==r.inv);
 return a}
function poFor(p){const rf=D.rfq.filter(x=>x.pr==p.id).map(x=>x.id),qs=D.quo.filter(q=>rf.includes(q.rfq)).map(q=>q.id);return D.po.filter(o=>qs.includes(o._quo))}
function prDone(po){const q=D.quo.find(x=>x.id==po._quo),f=q&&D.rfq.find(x=>x.id==q.rfq),pr=f&&D.pr.find(x=>x.id==f.pr);if(pr&&pr.status!='Issued')pr.status='Completed'}
const grp=r=>r.pr??'r'+r.id;
const listed=(sup,item)=>{const a=(D.pl||[]).filter(x=>x.supplier==sup&&x.item==item);return a.length?a[a.length-1].price:undefined};
/* One order per company + material + quantity + date: remove existing duplicates (RFQ and PO), keeping the one furthest along */
function dedupeOrders(){let ch=0;
 const grpBy=(a,key)=>{const m={};a.forEach(x=>{const k=key(x);(m[k]=m[k]||[]).push(x)});return Object.values(m).filter(g=>g.length>1)};
 const rank=(x,t)=>t=='rfq'?(D.quo.some(q=>q.rfq==x.id)?2:0)+(x.status=='Finished'?1:0):({Open:0,Cancelled:-1}[x.status]??2)+(D.inv.some(i=>i.po==x.id)?1:0)+(D.gr.some(g=>g.po==x.id)?1:0);
 grpBy(D.rfq,r=>[r.supplier,r.item,r.qty,r.due||r.cdate].join('|')).forEach(g=>{const keep=[...g].sort((a,b)=>rank(b,'rfq')-rank(a,'rfq')||a.id-b.id)[0];g.filter(x=>x!==keep).forEach(x=>{D.quo.forEach(q=>{if(q.rfq==x.id)q.rfq=keep.id});D.rfq.splice(D.rfq.indexOf(x),1);ch=1;if(x.pr!=null&&!D.rfq.some(y=>y.pr==x.pr)){const p=D.pr.find(y=>y.id==x.pr);if(p&&p.status=='RFQ Sent')p.status='Confirmed'}})});
 grpBy(D.po,p=>[p.supplier,p.item,p.qty,p.date||p.cdate].join('|')).forEach(g=>{const keep=[...g].sort((a,b)=>rank(b,'po')-rank(a,'po')||a.id-b.id)[0];g.filter(x=>x!==keep).forEach(x=>{const iv=D.inv.filter(i=>i.po==x.id);if(D.gr.some(q=>q.po==x.id)||iv.some(i=>i.status=='Paid'))return;const ids=iv.map(i=>i.id);D.pq=(D.pq||[]).filter(q=>!ids.includes(q.inv));D.inv=D.inv.filter(i=>i.po!=x.id);D.msgs=(D.msgs||[]).filter(m=>m.po!=x.id);D.po.splice(D.po.indexOf(x),1);ch=1})});
 if(ch){['rfq','po','inv','pq'].forEach(t=>{if(M[t]&&M[t].pre)renum(t)})}return ch}
if(dedupeOrders())save();
/* sample supplier quotation for order 0016 */
if(!D.q16){D.rfq.filter(r=>String(r.ord)=='0016'&&!D.quo.some(q=>q.rfq==r.id)).forEach(r=>ins('quo',{rfq:r.id,supplier:r.supplier,item:r.item,qty:r.qty,price:listed(r.supplier,r.item)??95,status:'Received'}));D.q16=1;save()}
/* backfill the Archive with every transaction that already exists (date known, time not) */
if(!D.logBF){D.log=D.log||[];LOGT.forEach(t=>(D[t]||[]).forEach(r=>{const no=r.no||r.name||'';if(D.log.some(x=>x.t==t&&x.no==no&&x.act=='Created'))return;const d=String(r.cdate||r.date||r.due||today).slice(0,10),inf=logInfo(t,r);D.log.push({id:0,ts:d+' 00:00:00',bf:1,act:'Created',t,no,ord:r.ord||'',text:(inf||'')+(r.status?(inf?' · ':'')+'Current status: '+r.status:''),by:''})}));
 D.log=D.log.map((x,i)=>[x,i]).sort((a,b)=>a[0].ts<b[0].ts?-1:a[0].ts>b[0].ts?1:a[1]-b[1]).map(a=>a[0]);D.log.forEach((x,i)=>x.id=i+1);D.logBF=1;save()}
if(!D.snap)save();
const ADD=['suppliers','items'],opts=(t,k,d)=>D.opts[t+'.'+k]||d;
function formVals(t){const f=new FormData($('#fm')),v={};M[t].f.forEach(([k,,ty,o])=>{const x=f.get(k);v[k]=ty=='num'||ty=='ref'?(x==='__new'?'':Number(x)):(k=='status'&&M[t].nostat&&x==null?opts(t,k,o)[0]:x)});return v}
function addOpt(sel,t,k,id){
 if(sel.value!='__new'&&t=='quo'&&(k=='rfq'||k=='supplier')){const v=formVals('quo');if(k=='rfq'){const f=D.rfq.find(x=>x.id==v.rfq);if(f){v.item=f.item;v.qty=f.qty;v.supplier=f.supplier}}const l=listed(v.supplier,v.item);if(l!==undefined)v.price=l;openForm(t,id,LINK,v);return}
 if(sel.value!='__new')return;const fd=M[t].f.find(f=>f[0]==k),v=formVals(t),n=(prompt('Enter new '+fd[1].toLowerCase()+':')||'').trim();
 if(!n)v[k]=id?D[t].find(x=>x.id==id)[k]:undefined;
 else if(fd[2]=='sel'){D.opts[t+'.'+k]=[...opts(t,k,fd[3]),n];v[k]=n;save()}
 else{const rt=fd[3],x=ins(rt,rt=='items'?{name:n,cat:opts('items','cat',M.items.f[1][3]).find(c=>true),unit:'pcs',stock:0,reorder:0}:{name:n,contact:'',phone:'',email:'',address:'',status:'Active'});v[k]=x.id;save()}
 openForm(t,id,LINK,v)}
let LINK=null,BF='';const bfSel=t=>`<div style="margin:0 0 12px"><label style="font-size:12px">Branch: </label><select onchange="BF=this.value;go()" style="padding:8px;border-radius:8px;border:1px solid var(--bd);background:var(--in);color:var(--tx)"><option value="">All branches</option>${[...D.branches].filter(b=>!(t=='bs'&&b.wh)).sort((x,y)=>(y.wh?1:0)-(x.wh?1:0)).map(b=>`<option value="${b.id}" ${BF==b.id?'selected':''}>${esc(b.name)}</option>`).join('')}</select></div>`;
function openForm(t,id,pre,draft){LINK=pre||null;const m=M[t],r=draft||(id?D[t].find(x=>x.id==id):Object.assign({},pre||{}));
  let h=`<h3 style="color:var(--pri)">${id?'Edit':'New'} ${m.t}</h3>`;
 m.f.forEach(([k,l,ty,o])=>{if(k=='status'&&m.nostat)return;h+=`<label>${l}</label>`;
  if(ty=='sel')h+=`<select name="${k}" onchange="addOpt(this,'${t}','${k}',${id||0})">${opts(t,k,o).map(v=>`<option ${r[k]==v?'selected':''}>${esc(v)}</option>`).join('')}<option value="__new">+ Add new option…</option></select>`;
  else if(ty=='ref')h+=`<select name="${k}" onchange="addOpt(this,'${t}','${k}',${id||0})">${rows(t,k,o,r).map(x=>`<option value="${x.id}" ${r[k]==x.id?'selected':''}>${esc(lbl(o,x.id))}</option>`).join('')}${ADD.includes(o)&&!(t=='quo'&&k=='item')&&!(t=='rfq'&&k=='item'&&LINK&&LINK._pr)&&!(t=='po'&&k=='item'&&LINK&&LINK._quo)&&t!='dist'&&t!='bs'?'<option value="__new">+ Add new…</option>':''}</select>`;
  else h+=`<input name="${k}" type="${ty=='num'?'number':ty}" step="any" required value="${esc(r[k]??(ty=='date'?today:''))}">`});
 $('#fm').innerHTML=h+`<div class="bt"><button type="button" class="btn g" onclick="$('#md').classList.remove('on')">Cancel</button><button class="btn">Save</button></div>`;
 $('#md').classList.add('on');
 $('#fm').onsubmit=e=>{e.preventDefault();let msg='';const v=formVals(t);if(LINK&&LINK._quo)v._quo=LINK._quo;if(t=='dist'&&LINK&&LINK._pr)v.pr=LINK._pr;if(t=='quo'){const f=D.rfq.find(x=>x.id==v.rfq);if(f){v.item=f.item}}if(t=='rfq'&&LINK&&LINK._pr){const p=D.pr.find(x=>x.id==LINK._pr);if(p){v.pr=p.id;v.item=p.item}}if(t=='inv'&&v.status=='Paid'&&!confirm('WARNING: Are you sure this invoice is PAID?\n\nOnce saved as Paid, this cannot be undone.'))return;
  if(!id&&m.chk){const er=m.chk(v);if(er){alert(er);return}}
  if(!id&&t=='bs'){const ex=D.bs.find(x=>x.branch==v.branch&&x.item==v.item);if(ex){Object.assign(ex,v);save();$('#md').classList.remove('on');cur=t;go();toast('Branch stock updated.');return}}
  if(!id&&t=='quo'){const ex=D.quo.find(x=>x.rfq==v.rfq&&x.supplier==v.supplier&&x.status=='Received');if(ex){Object.assign(ex,v);save();$('#md').classList.remove('on');cur='rfq';go();toast(ex.no+' updated – this supplier already had a quotation for this request.');return}}
  if(id){if(m.nostat)delete v.status;const rr=D[t].find(x=>x.id==id);Object.assign(rr,v);const o=ordParent(t,rr);if(o&&!(t=='po'&&poTaken(o,rr)))rr.ord=o}else{const n=ins(t,v);m.after&&m.after(n);msg=(m.pre?n.no:m.t)+' saved. '+NEXT[t]}
  save();$('#md').classList.remove('on');cur=t=='pl'?'sup:'+v.supplier:t=='quo'?'rfq':(t=='suppliers'&&cur=='rec'?'rec':t);go();toast(msg)}}
/* ---------- DASHBOARD / RECORDS / REPORTS ---------- */
const spendBy=()=>{const o={};D.po.filter(p=>!['Cancelled','Rejected'].includes(p.status)).forEach(p=>o[p.supplier]=(o[p.supplier]||0)+tot(p));return Object.entries(o).map(([k,v])=>[lbl('suppliers',k),v]).sort((a,b)=>b[1]-a[1])};
const payables=()=>D.inv.filter(i=>i.status!='Paid');
const recentBuys=()=>`<br><div class="card tw"><b>Recent Purchases</b><table><tr><th>Order No.</th><th>No.</th><th>Supplier</th><th>Material</th><th>Total</th><th>Status</th><th>Actions</th></tr>${D.po.slice(-5).reverse().map(p=>{const i=D.inv.find(x=>x.po==p.id&&x.status=='Paid');return`<tr><td><b class="ordno">${esc(p.ord||'—')}</b></td><td><b>${p.no}</b></td><td>${esc(lbl('suppliers',p.supplier))}</td><td>${esc(lbl('items',p.item))}</td><td>${fmt(tot(p))}</td><td>${badge(p.status,'po')}</td><td class="acts">${i&&D.rc.some(c=>c.inv==i.id)?`<button class="btn s" onclick="viewRc(${i.id})">View Receipt</button>`:''}</td></tr>`}).join('')||'<tr><td colspan=7>No purchases yet.</td></tr>'}</table></div>`;
function dash(){const sp=spendBy(),mx=Math.max(1,...sp.map(s=>s[1])),totSp=sp.reduce((a,s)=>a+s[1],0),op=D.po.filter(p=>['Open','Pending','Paid','Partial'].includes(p.status)).length,pend=D.pr.filter(p=>p.status=='Pending').length,low=D.items.filter(s=>s.stock<=s.reorder).length,pay=payables();
 const cnt=POS.map(s=>D.po.filter(p=>p.status==s).length),col=POCOL,T=cnt.reduce((a,b)=>a+b,0)||1;let a=0;
 const cg=cnt.map((c,i)=>{const s=a;a+=c/T*100;return`${col[i]} ${s}% ${a}%`}).join(',');
 return flow()+head('Procurement Dashboard','Aquamuna Water Refilling Station')+`<div class="cards">
 <div class="card"><div class="l">Total Purchases</div><div class="v">${fmt(totSp)}</div><span class="pill g1">${D.po.length} purchase orders</span></div>
 <div class="card"><div class="l">Open POs</div><div class="v">${op}</div><span class="pill b1">${pend} requests pending</span></div>
 <div class="card"><div class="l">Warehouse Alerts</div><div class="v">${low}</div><span class="pill o1">${low} at reorder level</span></div>
 <div class="card"><div class="l">Payables (Finance)</div><div class="v">${fmt(pay.reduce((a,i)=>a+i.amount,0))}</div><span class="pill r1">${pay.length} unpaid invoices</span></div></div>
 <div class="row"><div class="card"><b>Spend per Supplier</b><div class="bars">${sp.slice(0,6).map((s,i)=>`<div><i class="${i?'':'h'}" style="height:${Math.max(8,s[1]/mx*150)}px"></i>${esc(s[0].split(' ')[0])}</div>`).join('')||'No data'}</div></div>
 <div class="card"><b>Purchase Order Status Mix</b><br><br><div class="donut" style="background:conic-gradient(${cg})"><span><b style="font-size:20px;color:var(--pri)">${D.po.length}</b><br>Total POs</span></div>
 <div class="lg" style="margin-top:14px">${POS.map((s,i)=>`<div><i style="background:${col[i]}"></i>${s} ${Math.round(cnt[i]/T*100)}%</div>`).join('')}</div></div></div>`+recentBuys()}
function supPage(id){const s=D.suppliers.find(x=>x.id==id);if(!s){cur='suppliers';return list('suppliers')}
 const pl=D.pl.filter(x=>x.supplier==id).slice().reverse(),seen={};
 let h=`<a class="lnk back" onclick="nav('suppliers')">← Back to Supplier Management</a>`+head(esc(s.name),'Company details and price list',`<button class="btn" onclick="openForm('pl',0,{supplier:${id}})">+ Add Price</button>`)+
 `<div class="card tw" style="margin-bottom:18px"><table><tr><th>Contact</th><th>Phone</th><th>Email</th><th>Address</th><th>Status</th></tr><tr><td>${esc(s.contact)}</td><td>${esc(s.phone)}</td><td>${esc(s.email)}</td><td>${esc(s.address)}</td><td>${supSel(s)}</td></tr></table></div>`+
 `<div class="card tw"><b>Price List – materials ${esc(s.name)} sells</b><table><tr><th>Material</th><th>Category</th><th>Unit Price</th><th>Price Status</th><th>Actions</th></tr>`;
 pl.forEach(r=>{const it=D.items.find(x=>x.id==r.item)||{},isNew=!seen[r.item];seen[r.item]=1;h+=`<tr><td>${esc(it.name)}</td><td>${esc(it.cat)}</td><td><b>${fmt(r.price)}</b></td><td>${isNew?'<span class="pill g1">Current</span>':'<span class="pill y1">Old price</span>'}</td><td><button class="btn s r" title="Delete" aria-label="Delete" onclick="del('pl',${D.pl.indexOf(r)})"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/></svg></button></td></tr>`});
 return h+(pl.length?'':'<tr><td colspan=5>No prices yet. Click + Add Price.</td></tr>')+'</table></div>'}
function showOrds(id){const s=D.suppliers.find(x=>x.id==id);if(!s)return;
 const o=[...new Set(D.po.filter(x=>x.supplier==id&&x.ord).map(x=>x.ord))].sort((a,b)=>a-b);
 $('#fm').onsubmit=e=>e.preventDefault();
 $('#fm').innerHTML=`<h3 style="color:var(--pri)">Orders – ${esc(s.name)}</h3><p style="margin:0 0 10px"><small>Click an order number to open it in Purchase Invoice.</small></p><div class="ordlist">${o.map(x=>`<a class="lnk ordpick" onclick="openOrd('${esc(x)}')"><b class="ordno">${esc(x)}</b> ›</a>`).join('')||'No orders.'}</div><div class="bt"><button type="button" class="btn g" onclick="$('#md').classList.remove('on')">Close</button></div>`;
 $('#md').classList.add('on')}
function openOrd(o){$('#md').classList.remove('on');nav('inv');HL=o;go()}
/* ---------- Archive page ---------- */
let AF={act:'',from:'',to:''};
const ACTC={Finished:'g1',Cancelled:'r1',Inactive:'y1',Deleted:'r1'};
const ARCHDEL=['pr','rfq','quo','po','items','suppliers'];
function archRows(){const L=D.log||[],R=[];
 D.po.filter(p=>['Completed','Cancelled'].includes(p.status)).forEach(p=>{const e=[...L].reverse().find(x=>x.t=='po'&&x.no==p.no&&x.act=='Status changed'&&x.text.includes('→ '+p.status));R.push({ts:e?e.ts:String(p.date||p.cdate||today).slice(0,10)+' 00:00:00',bf:!e,act:p.status=='Completed'?'Finished':'Cancelled',rt:'Purchase Order',ord:p.ord||'',no:p.no,tx:[lbl('suppliers',p.supplier),lbl('items',p.item),'Qty '+p.qty,fmt(tot(p))].join(' · '),by:e?e.by:''})});
 D.suppliers.filter(x=>x.status=='Deactivated').forEach(x=>{const e=[...L].reverse().find(y=>y.t=='suppliers'&&y.no==x.no&&y.act=='Status changed'&&y.text.includes('→ Deactivated'));R.push({ts:e?e.ts:String(x.cdate||today).slice(0,10)+' 00:00:00',bf:!e,act:'Inactive',rt:'Supplier',ord:'',no:x.no||'',tx:x.name,by:e?e.by:''})});
 L.filter(x=>x.act=='Deleted'&&ARCHDEL.includes(x.t)).forEach(x=>R.push({ts:x.ts,bf:!!x.bf,act:'Deleted',rt:x.t=='items'?'Item':(M[x.t]||{}).t||x.t,ord:x.ord,no:x.no,tx:x.text,by:x.by}));
 return R.sort((x,y)=>x.ts<y.ts?1:x.ts>y.ts?-1:0)}
function arch(){const q=($('#q').value||'').toLowerCase(),A=archRows(),L=A.filter(x=>(!AF.act||x.act==AF.act)&&(!AF.from||x.ts.slice(0,10)>=AF.from)&&(!AF.to||x.ts.slice(0,10)<=AF.to)&&(!q||[x.no,x.ord,x.tx,x.act,x.rt].join(' ').toLowerCase().includes(q))),n=a=>A.filter(x=>x.act==a).length;
 const sel=(k,o)=>`<select onchange="AF.${k}=this.value;go()">${o.map(([v,l])=>`<option value="${v}" ${AF[k]==v?'selected':''}>${l}</option>`).join('')}</select>`;
 return head('Archive','Old, finished, cancelled, inactive and deleted procurement records, kept apart from active transactions')+
 `<div class="kpis">${[['','Total Records',A.length],['Finished','Finished',n('Finished')],['Cancelled','Cancelled',n('Cancelled')],['Inactive','Inactive',n('Inactive')],['Deleted','Deleted',n('Deleted')]].map(([k,l,v])=>`<div class="kpi" style="cursor:pointer;${AF.act==k?'outline:2px solid var(--pri)':''}" title="Click to show ${k?l.toLowerCase()+' records':'all records'}" onclick="AF.act='${k}';go()"><div><i class="ki"></i>${l}</div><b>${v}</b></div>`).join('')}</div>`+
 `<div style="margin:0 0 12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center"><label style="font-size:12px">Action</label>${sel('act',[['','All'],['Finished','Finished'],['Cancelled','Cancelled'],['Inactive','Inactive'],['Deleted','Deleted']])}<label style="font-size:12px">From</label><input type="date" value="${AF.from}" onchange="AF.from=this.value;go()"><label style="font-size:12px">To</label><input type="date" value="${AF.to}" onchange="AF.to=this.value;go()"></div>`+
 `<div class="card tw"><table><tr><th>Date &amp; Time</th><th>Action</th><th>Record</th><th>No.</th><th>Order No.</th><th>Details</th><th>By</th></tr>${L.map(x=>`<tr><td style="white-space:nowrap">${esc(x.bf?x.ts.slice(0,10):x.ts)}</td><td><span class="pill ${ACTC[x.act]}">${x.act}</span></td><td>${esc(x.rt)}</td><td><b>${esc(x.no)}</b></td><td>${x.ord?`<b class="ordno">${esc(x.ord)}</b>`:'—'}</td><td>${esc(x.tx)}</td><td>${esc(x.by||'—')}</td></tr>`).join('')||'<tr><td colspan=7>No records here yet.</td></tr>'}</table></div>`}
function rec(){const q=$('#q').value.toLowerCase(),ords=s=>[...new Set(D.po.filter(x=>x.supplier==s.id&&x.ord).map(x=>x.ord))].sort((a,b)=>a-b);
 let h=head('Supplier Records','Purchase history and balances per supplier')+'<div class="card tw"><table><tr><th>Supplier</th><th>Contact</th><th>Status</th><th>Order No(s).</th><th>Total Purchased</th><th>Outstanding Payable</th><th>Last Order</th></tr>';
 const L=D.suppliers.filter(s=>!q||JSON.stringify(s).toLowerCase().includes(q)||ords(s).some(o=>o.toLowerCase().includes(q)));
 L.forEach(s=>{const p=D.po.filter(x=>x.supplier==s.id),ids=p.map(x=>x.id),out=D.inv.filter(i=>ids.includes(i.po)&&i.status!='Paid').reduce((a,i)=>a+i.amount,0),o=ords(s);
  h+=`<tr><td><b>${esc(s.name)}</b><br><small>${esc(s.email)}</small></td><td>${esc(s.contact)}<br><small>${esc(s.phone)}</small></td><td>${badge(s.status,'suppliers')}</td><td>${o.length?`<button class="btn s" onclick="showOrds(${s.id})">View Orders (${o.length})</button>`:'—'}</td><td>${fmt(p.reduce((a,x)=>a+tot(x),0))}</td><td>${fmt(out)}</td><td>${p.length?p[p.length-1].date:'—'}</td></tr>`});
 return h+(L.length?'':'<tr><td colspan=8>No suppliers found.</td></tr>')+'</table></div>'}
function rep(){const sp=spendBy(),mx=Math.max(1,...sp.map(s=>s[1]));
 return head('Purchase Reports','Spend, inventory and finance integration',`<span class="noprint"><button class="btn" onclick="exportOrders()">Export to Excel</button> <button class="btn g" onclick="print()">Print</button> <button class="btn g" onclick="bk()">Backup DB</button> <button class="btn g" onclick="$('#im').click()">Restore DB</button><input id="im" type="file" hidden accept=".json" onchange="rs(this)"></span>`)+
 `<div class="card tw"><b>Spend by Supplier</b><table>${sp.map(s=>`<tr><td width=200>${esc(s[0])}</td><td><div class="bar" style="width:${s[1]/mx*100}%"></div></td><td>${fmt(s[1])}</td></tr>`).join('')}</table></div><br>
 <div class="row" style="grid-template-columns:1fr 1fr"><div class="card tw"><b>Warehouse Inventory Stock (updated by Goods Receiving)</b><table><tr><th>Item</th><th>Category</th><th>Stock</th></tr>${D.items.map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.cat)}</td><td>${s.stock} ${esc(s.unit)} ${s.stock<=s.reorder?'<span class="pill o1">Reorder</span>':''}</td></tr>`).join('')}</table></div>
 <div class="card tw"><b>Finance Payables Ledger</b><table><tr><th>Order No.</th><th>Invoice</th><th>Supplier</th><th>Amount</th><th>Status</th></tr>${D.inv.map(i=>{const p=D.po.find(x=>x.id==i.po)||{};return`<tr><td><b class="ordno">${esc(i.ord||'—')}</b></td><td>${i.no}</td><td>${esc(lbl('suppliers',p.supplier))}</td><td>${fmt(i.amount)}</td><td>${badge(i.status,'inv')}</td></tr>`}).join('')}</table></div></div><br><div class="card tw"><b>Stock per Branch</b><table><tr><th>Branch</th><th>Materials</th><th>Total Units</th><th>Low Stock Items</th></tr>${D.branches.filter(b=>!b.wh).map(b=>{const r=D.bs.filter(x=>x.branch==b.id);return`<tr><td>${esc(b.name)}</td><td>${r.length}</td><td>${r.reduce((a,x)=>a+x.stock,0)}</td><td>${r.filter(x=>x.stock<=x.reorder).length||'—'}</td></tr>`}).join('')}</table></div>`}
/* ---------- OFFICIAL RECEIPT ---------- */
const _o=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'],_t=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
const _w=n=>n<20?_o[n]:n<100?_t[Math.floor(n/10)]+(n%10?'-'+_o[n%10]:''):_o[Math.floor(n/100)]+' Hundred'+(n%100?' '+_w(n%100):'');
const words=n=>{if(n==0)return'Zero';const o=[];for(const[v,l]of[[1e9,'Billion'],[1e6,'Million'],[1e3,'Thousand']])if(n>=v){o.push(words(Math.floor(n/v))+' '+l);n%=v}if(n>0)o.push(_w(n));return o.join(' ')};
const pesoWords=a=>{const tc=Math.round(Number(a||0)*100),p=Math.floor(tc/100),c=tc%100;return words(p)+(p==1?' Peso':' Pesos')+(c?' and '+String(c).padStart(2,'0')+'/100':'')+' Only'};
const vcode=s=>{let h=2166136261;for(const ch of s){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0}return 'AQ-'+h.toString(36).toUpperCase().padStart(7,'0').slice(-7)};
const DROP='M0-15C7-6 12-1 12 5a12 12 0 0 1-24 0c0-6 5-11 12-20z';
const sealSvg=d=>`<svg class="seal" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg"><defs><path id="sealT" d="M24,80A56,56 0 0 1 136,80"/><path id="sealB" d="M16,80A64,64 0 0 0 144,80"/></defs><g fill="none" stroke="#1b4f9c"><circle cx="80" cy="80" r="76" stroke-width="3"/><circle cx="80" cy="80" r="71.500" stroke-width=".9"/><circle cx="80" cy="80" r="51" stroke-width="1.400"/><circle cx="80" cy="80" r="47.500" stroke-width=".7"/></g><g fill="#1b4f9c" font-family="Arial,Helvetica,sans-serif" font-weight="700"><text font-size="10.500" letter-spacing=".6"><textPath href="#sealT" startOffset="50%" text-anchor="middle" textLength="140" lengthAdjust="spacing">WATER REFILLING STATION</textPath></text><text font-size="10.500" letter-spacing=".6"><textPath href="#sealB" startOffset="50%" text-anchor="middle" textLength="160" lengthAdjust="spacing">AQUAMUNA · OFFICIAL SEAL</textPath></text><text x="16" y="84" font-size="12" text-anchor="middle">★</text><text x="144" y="84" font-size="12" text-anchor="middle">★</text><path transform="translate(80 54) scale(.95)" d="${DROP}"/><text x="80" y="91" font-size="21" text-anchor="middle" letter-spacing="2.500">PAID</text><text x="80" y="107" font-size="9" text-anchor="middle" letter-spacing=".5">${esc(d)}</text></g></svg>`;
function rcHtml(c){const i=D.inv.find(x=>x.id==c.inv)||{},p=D.po.find(x=>x.id==i.po)||{},ord=c.ord||i.ord||'—',sup=supOfInv(c.inv),mat=p.item?lbl('items',p.item):'—',
 ms=opts('rc','method',M.rc.f[2][3]),code=vcode([c.no,ord,c.amount,c.date,c.refno,sup].join('|'));
 const ck=ms.map(m=>`<span class="ck${m==c.method?' on':''}"><i></i>${esc(m)}</span>`).join('');
 return`<div class="or"><div class="or-in">
 <img class="or-wm" src="assets/logo.png" alt="">
 <div class="or-hd"><img class="or-lg" src="assets/logo-white.png" alt="Aquamuna Water Refilling Station">
 <div class="or-ti"><h2>OFFICIAL RECEIPT</h2><span>Payment to Supplier</span></div>
 <div class="or-no"><small>NO.</small><b>${esc(c.no)}</b></div></div>
 <div class="or-r2"><div class="or-row"><label>DATE</label><span class="fill">${esc(c.date)}</span></div><div class="or-row"><label>ORDER NO.</label><span class="fill">${esc(ord)}</span></div></div>
 <div class="or-row"><label>PAID TO</label><span class="fill">${esc(sup)}</span></div>
 <div class="or-row"><label>THE SUM OF</label><span class="fill sm">${esc(pesoWords(c.amount))}</span></div>
 <div class="or-mid"><table class="or-tb"><tr><th colspan="2">IN PAYMENT OF</th></tr><tr><td class="k">Invoice No.</td><td>${esc(i.no||'—')}</td></tr><tr><td class="k">Purchase Order</td><td>${esc(p.no||'—')}</td></tr><tr><td class="k">Material</td><td>${esc(mat)}</td></tr></table>
 <div class="or-amt"><small>AMOUNT PAID</small><b>${fmt(c.amount)}</b></div></div>
 <div class="or-row pay"><label>PAID BY</label><span class="cks">${ck}</span><label class="rf">REF. NO.</label><span class="fill rfv">${esc(c.refno||'—')}</span></div>
 <div class="or-ft">${sealSvg(c.date)}<div class="sig"><div class="sl"></div><b>AUTHORIZED SIGNATURE</b><span>Finance Department</span></div></div>
 <div class="or-note"><span>Valid only when stamped with the official Aquamuna seal and signed by the Finance Department.</span><span>Validation Code: <b>${code}</b></span></div>
 </div></div>`}
let _ttl=document.title;
function viewRc(iid,rid){const c=rid!=null?D.rc.find(x=>x.id==rid):[...D.rc].reverse().find(x=>x.inv==iid);if(!c)return;openRm(rcHtml(c),'rc','Print Receipt','Official Receipt '+c.no)}
function closeRc(){$('#rm').classList.remove('on')}
addEventListener('beforeprint',()=>{const r=$('#rm');if(r&&r.classList.contains('on')&&r.dataset.ttl){_ttl=document.title;document.title=r.dataset.ttl}});
addEventListener('afterprint',()=>{document.title=_ttl});

/* ---------- EXCEL EXPORT (orders summary per month & year; no library needed) ---------- */
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const xe=s=>String(s??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const xc=i=>{let s='';i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=(i-m-1)/26}return s};
const xser=d=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(d||'');return m?Math.round((Date.UTC(+m[1],+m[2]-1,+m[3])-Date.UTC(1899,11,30))/864e5):null};
const crcT=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=b=>{let c=-1;for(let i=0;i<b.length;i++)c=crcT[(c^b[i])&255]^(c>>>8);return(c^-1)>>>0};
function zipStore(files){const enc=new TextEncoder(),out=[],cen=[];let off=0;const u16=v=>[v&255,v>>8&255],u32=v=>[v&255,v>>8&255,v>>16&255,v>>>24&255];
 files.forEach(f=>{const nm=enc.encode(f.name),d=enc.encode(f.data),crc=crc32(d);
  const lh=Uint8Array.from([0x50,0x4b,3,4,...u16(20),...u16(0),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(d.length),...u32(d.length),...u16(nm.length),...u16(0)]);
  out.push(lh,nm,d);
  cen.push(Uint8Array.from([0x50,0x4b,1,2,...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(d.length),...u32(d.length),...u16(nm.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),nm);
  off+=lh.length+nm.length+d.length});
 const cs=cen.reduce((a,b)=>a+b.length,0);
 return new Blob([...out,...cen,Uint8Array.from([0x50,0x4b,5,6,0,0,0,0,...u16(files.length),...u16(files.length),...u32(cs),...u32(off),...u16(0)])],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}
/* style ids */
const XS={title:1,sub:2,note:3,head:4,txt:5,ctr:6,date:7,int:8,money:9,tlab:10,tint:11,tmoney:12,tblank:13,bold:14,blab:15,sec:16};
const XSTYLES=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;₱&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="#,##0"/><numFmt numFmtId="166" formatCode="mmm\\ dd\\,\\ yyyy"/></numFmts>
<fonts count="7"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="16"/><color rgb="FF16427F"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><i/><sz val="9"/><color rgb="FF666666"/><name val="Arial"/></font><font><b/><sz val="12"/><color rgb="FF1F6FB5"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FF16427F"/><name val="Arial"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F6FB5"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCE9F5"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFA6B8CC"/></left><right style="thin"><color rgb="FFA6B8CC"/></right><top style="thin"><color rgb="FFA6B8CC"/></top><bottom style="thin"><color rgb="FFA6B8CC"/></bottom><diagonal/></border><border><left style="thin"><color rgb="FFA6B8CC"/></left><right style="thin"><color rgb="FFA6B8CC"/></right><top style="medium"><color rgb="FF16427F"/></top><bottom style="double"><color rgb="FF16427F"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="17"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="165" fontId="1" fillId="3" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="164" fontId="1" fillId="3" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right"/></xf>
<xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
function xSheet(o){const mc=Math.max(...o.rows.map(r=>r.c.length)),H='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
 let x=H+'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'+`<dimension ref="A1:${xc(mc-1)}${o.rows.length}"/>`+
 `<sheetViews><sheetView showGridLines="0" workbookViewId="0"${o.first?' tabSelected="1"':''}>${o.freeze?`<pane ySplit="${o.freeze}" topLeftCell="A${o.freeze+1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${o.freeze+1}" sqref="A${o.freeze+1}"/>`:''}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>`+
 `<cols>${o.cols.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>`;
 o.rows.forEach((r,ri)=>{x+=`<row r="${ri+1}"${r.h?` ht="${r.h}" customHeight="1"`:''}>`;
  r.c.forEach((c,ci)=>{if(c==null)return;const ref=xc(ci)+(ri+1),s=c.s?` s="${c.s}"`:'';
   if(c.f!==undefined)x+=`<c r="${ref}"${s}><f>${xe(c.f)}</f><v>${c.v}</v></c>`;
   else if(typeof c.v=='number')x+=`<c r="${ref}"${s}><v>${c.v}</v></c>`;
   else if(c.v===''||c.v==null)x+=`<c r="${ref}"${s}/>`;
   else x+=`<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xe(c.v)}</t></is></c>`});
  x+='</row>'});
 x+='</sheetData>'+(o.merges&&o.merges.length?`<mergeCells count="${o.merges.length}">${o.merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells>`:'')+
 '<printOptions horizontalCentered="1"/><pageMargins left="0.4" right="0.4" top="0.6" bottom="0.7" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>'+
 `<headerFooter><oddFooter>${xe('&LAquamuna Water Refilling Station&CPage &P of &N&RPrinted &D')}</oddFooter></headerFooter></worksheet>`;
 return x}
/* collect orders grouped by year-month of the order date */
function xlGroups(){const g={};D.po.forEach(p=>{const d=(p.date||today).slice(0,10),k=d.slice(0,7);const i=D.inv.filter(x=>x.po==p.id&&x.status!='Cancelled').pop()||D.inv.filter(x=>x.po==p.id).pop(),c=i&&D.rc.filter(x=>x.inv==i.id).pop();
  (g[k]=g[k]||[]).push({ord:p.ord||'',date:d,po:p.no,sup:lbl('suppliers',p.supplier),item:lbl('items',p.item),qty:+p.qty||0,price:+p.price||0,total:tot(p),st:p.status,inv:i?i.no:'',pay:i?(i.status=='Payment Requested'?'Pending Payment':i.status):'Not invoiced',rc:c?c.no:'',paid:c?c.date:'',meth:c?c.method:'',ref:c?c.refno:''})});
 Object.values(g).forEach(a=>a.sort((x,y)=>(x.date<y.date?-1:x.date>y.date?1:0)||String(x.ord).localeCompare(String(y.ord))));
 return Object.keys(g).sort().map(k=>({k,y:+k.slice(0,4),m:+k.slice(5,7),rows:g[k]}))}
const xlLive=r=>r.st!='Cancelled';
function xlBook(sel,mode){const genOn=new Date().toISOString().slice(0,10),H='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
 all=sel.flatMap(g=>g.rows),n=all.length,f=6,e=5+n,T=e+1,NC=16,
 y0=Math.min(...sel.map(g=>g.y)),y1=Math.max(...sel.map(g=>g.y)),single=sel.length==1,
 period=single?MONTHS[sel[0].m-1]+' '+sel[0].y:y0==y1?String(y0):y0+' – '+y1;
 const live=all.filter(xlLive),sum=a=>a.reduce((s,r)=>s+r.total,0);
 /* ---- Sheet 1: every order, one by one ---- */
 const R=[],blank=()=>Array(NC).fill(null),row=(h,c)=>R.push({h,c});
 row(26,[{v:'Aquamuna Water Refilling Station',s:XS.title}]);row(18,[{v:'List of Purchase Orders – '+period,s:XS.sub}]);row(14,[{v:'Generated '+genOn+'. Every order is listed below; cancelled orders are shown but not counted in the totals.',s:XS.note}]);row(8,[]);
 row(32,['No.','Order No.','Order Date','PO No.','Supplier','Material','Qty','Unit Price','Total Amount','PO Status','Invoice No.','Payment Status','Receipt No.','Date Paid','Payment Method','Reference No.'].map(v=>({v,s:XS.head})));
 all.forEach((r,i)=>{const c=blank();c[0]={v:i+1,s:XS.ctr};c[1]={v:r.ord,s:XS.ctr};c[2]={v:xser(r.date),s:XS.date};c[3]={v:r.po,s:XS.ctr};c[4]={v:r.sup,s:XS.txt};c[5]={v:r.item,s:XS.txt};c[6]={v:r.qty,s:XS.int};c[7]={v:r.price,s:XS.money};c[8]={f:`G${f+i}*H${f+i}`,v:r.total,s:XS.money};c[9]={v:r.st,s:XS.ctr};c[10]={v:r.inv,s:XS.ctr};c[11]={v:r.pay,s:XS.ctr};c[12]={v:r.rc,s:XS.ctr};c[13]=r.paid?{v:xser(r.paid),s:XS.date}:{v:'',s:XS.ctr};c[14]={v:r.meth,s:XS.ctr};c[15]={v:r.ref,s:XS.ctr};row(0,c)});
 const tc=Array(NC).fill(null).map(()=>({v:'',s:XS.tblank}));tc[0]={v:'TOTAL (excluding cancelled orders)',s:XS.tlab};
 tc[6]={f:`SUMIF(J${f}:J${e},"<>Cancelled",G${f}:G${e})`,v:live.reduce((s,r)=>s+r.qty,0),s:XS.tint};tc[8]={f:`SUMIF(J${f}:J${e},"<>Cancelled",I${f}:I${e})`,v:sum(live),s:XS.tmoney};row(20,tc);
 const orders={rows:R,cols:[5,9,13,9,24,26,7,13,15,13,11,17,10,13,15,14],freeze:5,first:1,merges:['A1:P1','A2:P2','A3:P3',`A${T}:F${T}`]};
 /* ---- Sheet 2: summary per month or per year (formulas read the Orders sheet) ---- */
 const O="Orders!",rg=c=>`${O}$${c}$${f}:$${c}$${e}`,dt=(y,m)=>`DATE(${y},${m},1)`,
  crit=(y1_,m1,y2,m2)=>`${rg('C')},">="&${dt(y1_,m1)},${rg('C')},"<"&${dt(y2,m2)},${rg('J')},"<>Cancelled"`;
 const S=[],srow=(h,c)=>S.push({h,c}),byM=mode!='year';
 srow(26,[{v:'Aquamuna Water Refilling Station',s:XS.title}]);srow(18,[{v:'Purchase Orders Summary – per '+(byM?'Month':'Year')+' ('+period+')',s:XS.sub}]);srow(14,[{v:'Generated '+genOn+'. Figures are calculated from the Orders sheet and exclude cancelled orders.',s:XS.note}]);srow(8,[]);
 const heads=byM?['Year','Month','No. of Orders','Total Qty','Total Amount','Paid','Unpaid Balance']:['Year','No. of Orders','Total Qty','Total Amount','Paid','Unpaid Balance'];
 srow(32,heads.map(v=>({v,s:XS.head})));
 const units=byM?sel.map(g=>({y:g.y,m:g.m,lab:MONTHS[g.m-1],rows:g.rows})):[...new Set(sel.map(g=>g.y))].map(y=>({y,rows:sel.filter(g=>g.y==y).flatMap(g=>g.rows)}));
 const base=6;
 units.forEach((u,i)=>{const L=u.rows.filter(xlLive),r=base+i,tot_=sum(L),pd=sum(L.filter(x=>x.pay=='Paid')),qt=L.reduce((s,x)=>s+x.qty,0),
   cr=byM?(u.m==12?crit(u.y,u.m,u.y+1,1):crit(u.y,u.m,u.y,u.m+1)):crit(u.y,1,u.y+1,1),
   cnt={f:`COUNTIFS(${cr})`,v:L.length,s:XS.int},qty={f:`SUMIFS(${rg('G')},${cr})`,v:qt,s:XS.int},amt={f:`SUMIFS(${rg('I')},${cr})`,v:tot_,s:XS.money},
   paid={f:`SUMIFS(${rg('I')},${cr},${rg('L')},"Paid")`,v:pd,s:XS.money};
   const o=byM?4:3;
   srow(0,[{v:u.y,s:XS.ctr},...(byM?[{v:u.lab,s:XS.ctr}]:[]),cnt,qty,amt,paid,{f:`${xc(o+1)}${r}-${xc(o+2)}${r}`,v:tot_-pd,s:XS.money}])});
 const a=base,b=base+units.length-1,k=byM?2:1,all_=units.flatMap(u=>u.rows).filter(xlLive),tA=sum(all_),tP=sum(all_.filter(x=>x.pay=='Paid'));
 const gt=[{v:'GRAND TOTAL',s:XS.tlab},...(byM?[{v:'',s:XS.tblank}]:[])];
 [[all_.length,XS.tint],[all_.reduce((s,x)=>s+x.qty,0),XS.tint],[tA,XS.tmoney],[tP,XS.tmoney],[tA-tP,XS.tmoney]].forEach(([v,s],j)=>{const c=xc(k+j);gt.push({f:`SUM(${c}${a}:${c}${b})`,v,s})});
 srow(20,gt);const GT=base+units.length;
 srow(0,[]);srow(0,[]);const sg=Array(7).fill(null);sg[0]={v:'Prepared by: ____________________',s:XS.bold};sg[3]={v:'Checked by: ____________________',s:XS.bold};
 srow(22,sg);const sg2=Array(7).fill(null);sg2[0]={v:'Approved by: ____________________',s:XS.bold};srow(30,sg2);
 const summary={rows:S,cols:byM?[9,15,14,12,18,18,18]:[10,14,12,18,18,18],freeze:5,merges:['A1:G1','A2:G2','A3:G3',`A${GT}:${byM?'B':'A'}${GT}`].filter(m=>!/^A(\d+):A\1$/.test(m))};
 const sheets=[{name:'Orders',xml:xSheet(orders)},{name:'Summary',xml:xSheet(summary)}],NS=2;
 const files=[
 {name:'[Content_Types].xml',data:H+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+'</Types>'},
 {name:'_rels/.rels',data:H+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
 {name:'xl/workbook.xml',data:H+'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>'+sheets.map((s,i)=>`<sheet name="${xe(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')+'</sheets><definedNames>'+sheets.map((s,i)=>`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${xe(s.name)}'!$5:$5</definedName>`).join('')+'</definedNames></workbook>'},
 {name:'xl/_rels/workbook.xml.rels',data:H+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+`<Relationship Id="rId${NS+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
 {name:'xl/styles.xml',data:XSTYLES},...sheets.map((s,i)=>({name:`xl/worksheets/sheet${i+1}.xml`,data:s.xml}))];
 return zipStore(files)}
function xlSel(){const y=$('#xy')?$('#xy').value:'',m=$('#xm')?$('#xm').value:'';return xlGroups().filter(g=>(!y||g.y==y)&&(!m||g.m==m))}
function xlPrev(){const s=xlSel(),el=$('#xp'),b=$('#xgo');if(!el)return;const yr=$('#xs').value=='year',n=s.reduce((a,g)=>a+g.rows.length,0);
 const us=yr?[...new Set(s.map(g=>g.y))].map(y=>({l:String(y),rows:s.filter(g=>g.y==y).flatMap(g=>g.rows)})):s.map(g=>({l:MONTHS[g.m-1]+' '+g.y,rows:g.rows}));
 el.innerHTML=s.length?`<div style="padding:6px 0;border-bottom:1px solid var(--bd)"><b>Orders sheet:</b> all ${n} order${n==1?'':'s'}, listed one by one</div><div style="padding:6px 0 2px"><b>Summary sheet (per ${yr?'year':'month'}):</b></div>`+us.map(u=>{const L=u.rows.filter(xlLive);return`<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid var(--bd)"><span>${u.l} · ${L.length} order${L.length==1?'':'s'}</span><span>${fmt(L.reduce((a,r)=>a+r.total,0))}</span></div>`}).join(''):'<div>No orders found for this selection.</div>';b.disabled=!s.length;b.style.opacity=s.length?1:.5}
function xlGo(){const s=xlSel();if(!s.length)return;const y=$('#xy').value,m=$('#xm').value,mode=$('#xs').value;
 const nm='Aquamuna_Orders_'+(y||'All-Years')+(m?'-'+String(m).padStart(2,'0'):'')+'_Summary-per-'+(mode=='year'?'Year':'Month')+'.xlsx',a=document.createElement('a');a.href=URL.createObjectURL(xlBook(s,mode));a.download=nm;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);$('#md').classList.remove('on')}
function exportOrders(){const g=xlGroups(),ys=[...new Set(g.map(x=>x.y))].sort((a,b)=>b-a);
 $('#fm').innerHTML=`<h3 style="color:var(--pri);margin:0 0 4px">Export Orders to Excel</h3><p style="margin:0 0 6px;font-size:12px">Creates an Excel file that lists every order one by one, followed by a summary per month or per year.</p>
 <label>Summary per</label><select id="xs" onchange="xlPrev()"><option value="month">Month</option><option value="year">Year</option></select><label>Year</label><select id="xy" onchange="xlPrev()"><option value="">All years</option>${ys.map(y=>`<option>${y}</option>`).join('')}</select>
 <label>Month</label><select id="xm" onchange="xlPrev()"><option value="">All months</option>${MONTHS.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('')}</select>
 <label style="margin-top:14px">Will be included</label><div id="xp" style="font-size:13px"></div>
 <div class="bt"><button type="button" class="btn g" onclick="$('#md').classList.remove('on')">Cancel</button><button type="button" class="btn" id="xgo" onclick="xlGo()">Download Excel</button></div>`;
 $('#fm').onsubmit=e=>e.preventDefault();$('#md').classList.add('on');xlPrev()}

function bk(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(D)],{type:'application/json'}));a.download='aquamuna_procurement_backup.json';a.click()}
function rs(i){const f=i.files[0];if(!f)return;f.text().then(t=>{D=JSON.parse(t);SYNC={};save();SQ.then(()=>location.reload())})}
/* ---------- Wide viewer (receipt / quotation / map / photo) ---------- */
function openRm(html,kind,printLabel,ttl){const r=$('#rm');$('#rcpt').innerHTML=html;r.className='rm on '+kind;r.dataset.ttl=ttl||'';const b=$('#rmp');b.style.display=printLabel?'':'none';if(printLabel)b.textContent=printLabel}
function photoView(src,cap){openRm(`<div class="phw"><img class="phv" src="${src}" alt="Delivery photo">${cap?`<div class="phc">${esc(cap)}</div>`:''}</div>`,'img','')}
function readPhoto(file,cb){const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,900/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);cb(c.toDataURL('image/jpeg',.72))};im.onerror=()=>cb(null);im.src=fr.result};fr.onerror=()=>cb(null);fr.readAsDataURL(file)}

/* ---------- Supplier's quotation (shown on the RFQ row once the supplier has replied) ---------- */
const QICO='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6"/></svg>';
const quoBtn=r=>D.quo.some(q=>q.rfq==r.id)?`<button class="btn s msg" title="View the supplier's quotation" aria-label="View quotation" onclick="quoView(${r.id})">${QICO}</button>`:'';
function quoView(rid,qid){const r=D.rfq.find(x=>x.id==rid),qs=D.quo.filter(q=>q.rfq==rid);if(!r||!qs.length)return;const q=qid?qs.find(x=>x.id==qid):qs[qs.length-1];
 openRm((qs.length>1?`<div class="qsel noprint">${qs.map(x=>`<button type="button" class="btn s ${x.id==q.id?'':'g'}" onclick="quoView(${rid},${x.id})">${esc(x.no)}</button>`).join('')}</div>`:'')+qHtml(q,r),'qt','Print Quotation','Quotation '+q.no)}
function qHtml(q,r){const s=D.suppliers.find(x=>x.id==q.supplier)||{},amt=(+q.qty||0)*(+q.price||0),st=q.status;
 return`<div class="qd"><div class="qd-in"><div class="qd-st ${st}">${esc(st.toUpperCase())}</div>
 <div class="qd-hd"><div><h2>${esc(s.name||lbl('suppliers',q.supplier))}</h2><small>${esc(s.address||'')}${s.phone?'<br>Tel: '+esc(s.phone):''}${s.email?' · '+esc(s.email):''}</small></div><div class="qd-ti"><h3>QUOTATION</h3><div>No. <b>${esc(q.no)}</b></div>${q.cdate?`<div>Date: <b>${esc(q.cdate)}</b></div>`:''}</div></div>
 <div class="qd-meta"><div><label>QUOTED TO</label><b>Aquamuna Water Refilling Station</b><br>Procurement Department</div><div><label>IN REPLY TO</label><b>${esc(r.no)}</b>${r.ord?' · Order No. <b>'+esc(r.ord)+'</b>':''}${r.due?'<br>Requested by: '+esc(r.due):''}</div></div>
 <table class="qd-tb"><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr><tr><td>1</td><td>${esc(lbl('items',q.item))}</td><td>${q.qty}</td><td>${fmt(q.price)}</td><td>${fmt(amt)}</td></tr><tr class="tt"><td colspan="4">TOTAL AMOUNT</td><td>${fmt(amt)}</td></tr></table>
 <div class="qd-w">Amount in words: <i>${esc(pesoWords(amt))}</i></div>
 <div class="qd-tm"><label>TERMS</label><ol><li>Prices are quoted in Philippine Peso (₱).</li><li>This quotation is valid for 15 days from its date.</li><li>Delivery and payment terms follow the purchase order.</li></ol></div>
 <div class="qd-sg"><div class="sl"></div><b>${esc(s.contact||'Authorized Representative')}</b><span>${esc(s.name||'')}</span></div></div></div>`}

/* ---------- Goods Receiving: delivery details, rider, map tracking, courier photo, "Not Received" ---------- */
const STAGES=['Preparing','Picked up','On the way','Near your location','Arrived'],STG={Preparing:0,'Picked up':.12,'On the way':.55,'Near your location':.85,Arrived:1};
const PINI='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.100 7-11.500A7 7 0 0 0 5 9.500C5 14.900 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.500"/></svg>';
const dvOf=p=>p.dv||{};
const dvStage=p=>{const d=dvOf(p);if(d.nr)return['Not Received','r1'];const l=[...(d.track||[])].reverse().find(x=>STG[x.stage]!==undefined);if(d.photo)return[l?l.stage:'Delivered','g1'];return l?[l.stage,'b1']:[d.date?'Scheduled':'Not scheduled','y1']};
const gwait=()=>{const w=D.po.filter(p=>['Paid','Partial'].includes(p.status)),su=isSuper();if(w.map(ensureDv).some(Boolean))save();
 return`<div class="card tw" style="margin-bottom:18px"><b>Awaiting Delivery (paid orders)</b><table><tr><th>Order No.</th><th>Supplier</th><th>Material</th><th>Ordered</th><th>Received</th><th>Remaining</th><th>Expected Delivery<br><small>(stated by supplier)</small></th><th>Rider &amp; Contact<br><small>(stated by supplier)</small></th><th>Delivery Status</th><th>Actions</th></tr>${w.map(p=>{const d=dvOf(p),st=dvStage(p),has=!!d.photo,nr=!!d.nr;
 return`<tr><td><b class="ordno">${esc(p.ord||'—')}</b></td><td>${esc(lbl('suppliers',p.supplier))}</td><td>${esc(lbl('items',p.item))}</td><td>${p.qty}</td><td>${recv(p.id)}</td><td>${p.qty-recv(p.id)}</td>
 <td>${d.date?`<b>${esc(d.date)}</b>`:'<small>Not set yet</small>'}</td><td>${d.rider?`<b>${esc(d.rider)}</b><br><small>${esc(d.contact||'—')}</small>`:'<small>Not set yet</small>'}</td>
 <td><span class="pill ${st[1]}">${esc(st[0])}</span>${has?'<br><small>Photo of product received</small>':''}${nr?`<br><small>${esc(d.nr.reason)}<br>— ${esc(d.nr.by)}, ${fdt(d.nr.at)}</small>`:''}</td>
 <td class="acts">${has&&!nr?`<button class="btn s" onclick="openForm('gr',0,{po:${p.id},qty:${p.qty-recv(p.id)}})">Receive</button>`:`<button class="btn s" disabled style="opacity:.45;cursor:not-allowed" title="${nr?'Marked as not received':'Waiting for the courier to send a photo of the actual product'}">Receive</button>`}${su&&!nr?`<button class="btn s" style="background:#c4161c" onclick="nrOpen(${p.id})">Not Received</button>`:''}${su&&nr?`<button class="btn s g" onclick="nrReopen(${p.id})">Reopen</button>`:''}<button class="btn s msg" title="Track delivery on map" aria-label="Track delivery" onclick="trackOpen(${p.id})">${PINI}</button></td></tr>`}).join('')||'<tr><td colspan=10>No paid orders are waiting for delivery.</td></tr>'}</table></div>`};
const poHead=p=>`<div class="mh">Order <b>${esc(p.ord||'—')}</b> · ${esc(p.no)} · ${esc(lbl('suppliers',p.supplier))} · ${esc(lbl('items',p.item))} × ${p.qty-recv(p.id)}</div>`;
const RIDERS=['Juan Dela Cruz','Mark Santos','Ramon Villanueva','Carlo Mendoza','Jerome Bautista','Rey Navarro','Allan Garcia','Dennis Ramos','Paolo Reyes','Noel Aquino'];
const rnd=n=>Math.floor(Math.random()*n);
/* The supplier states the rider and expected date once an order is paid; they are generated here (random sample details) the first time it is listed */
function ensureDv(p){const d=p.dv=p.dv||{};if(d.rider&&d.contact&&d.date)return false;const px=['17','18','19','27','28','91','92','95','96'][rnd(9)],n=String(1000000+rnd(9000000));
 d.rider=d.rider||RIDERS[rnd(RIDERS.length)];d.contact=d.contact||'09'+px+' '+n.slice(0,3)+' '+n.slice(3,7);
 if(!d.date){const x=new Date();x.setDate(x.getDate()+1+rnd(5));d.date=x.toISOString().slice(0,10)}d.by='Supplier';return true}
function trackOpen(id){const p=D.po.find(x=>x.id==id);if(!p)return;window.__ph=null;const d=dvOf(p),tr=d.track||[],last=[...tr].reverse().find(x=>STG[x.stage]!==undefined),stage=last?last.stage:null,t=stage?STG[stage]:0,ci=stage?STAGES.indexOf(stage):-1,sup=lbl('suppliers',p.supplier),st=dvStage(p);
 const route='M70 238C160 238 190 150 290 150S430 205 500 140S600 72 648 64';
 const map=`<svg class="trm" viewBox="0 0 720 290" xmlns="http://www.w3.org/2000/svg"><rect width="720" height="290" fill="#e9f1e4"/><path d="M0 40C150 70 300 10 460 60S660 30 720 70V0H0z" fill="#cfe3f3"/>
 <g fill="#f5f1e8" stroke="#dcd6c6"><rect x="20" y="110" width="90" height="60" rx="6"/><rect x="130" y="190" width="110" height="70" rx="6"/><rect x="250" y="190" width="80" height="45" rx="6"/><rect x="340" y="60" width="100" height="62" rx="6"/><rect x="470" y="165" width="110" height="80" rx="6"/><rect x="600" y="110" width="95" height="60" rx="6"/><rect x="190" y="90" width="90" height="40" rx="6"/></g>
 <g stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round"><path d="M0 200H720"/><path d="M120 90V290"/><path d="M345 140V290"/><path d="M590 80V290"/><path d="M0 120H300"/></g>
 <path id="rtp" d="${route}" fill="none" stroke="#7d8fb0" stroke-width="4" stroke-dasharray="8 8" stroke-linecap="round"/><path id="rtd" d="${route}" fill="none" stroke="#1f6fb5" stroke-width="6" stroke-linecap="round"/>
 <g transform="translate(70 238)"><circle r="10" fill="#16427f" stroke="#fff" stroke-width="3"/></g><text x="70" y="262" font-size="12" font-weight="700" fill="#14284b" text-anchor="middle">${esc(sup)}</text>
 <g transform="translate(648 64)"><path d="M0 0c-9-12-14-18-14-26a14 14 0 0 1 28 0c0 8-5 14-14 26z" transform="translate(0 4)" fill="#c4161c" stroke="#fff" stroke-width="2"/><circle cx="0" cy="-22" r="5" fill="#fff"/></g><text x="648" y="90" font-size="12" font-weight="700" fill="#14284b" text-anchor="middle">Aquamuna Station</text>
 <g id="rdr"><circle r="16" fill="#1f6fb5" opacity=".22"><animate attributeName="r" values="12;22;12" dur="2s" repeatCount="indefinite"/></circle><circle r="10" fill="#1f6fb5" stroke="#fff" stroke-width="3"/><circle r="3.500" fill="#fff"/></g><text id="rdl" font-size="12" font-weight="700" fill="#16427f" text-anchor="middle">Rider</text></svg>`;
 const steps=`<div class="stp">${STAGES.map((s,i)=>`<div class="${i<=ci?'on':''}"><i></i><span>${s}</span></div>`).join('')}</div>`;
 const log=tr.length?[...tr].reverse().map(x=>`<div class="lg1"><b>${esc(x.stage)}</b>${x.note?' – '+esc(x.note):''}<small>${esc(x.by||'')} · ${fdt(x.at)}</small></div>`).join(''):'<div class="lg1"><small>No tracking updates yet.</small></div>';
 const phot=d.photo?`<div class="phr"><img class="thm" src="${d.photo}" onclick="photoView(this.src,'Photo of the actual product – ${esc(d.photoBy||'Courier')}, ${fdt(d.photoAt)}')"><div><b>Photo of the actual product</b><br><small>Sent by ${esc(d.photoBy||'the courier')} · ${fdt(d.photoAt)}</small></div></div>`:'<div class="phr warn">The courier has not sent a photo of the actual product yet. The order cannot be received until the photo arrives.</div>';
 openRm(`<div class="trk"><h3>Track Delivery</h3>${poHead(p)}<div class="tmeta"><span>Expected delivery: <b>${d.date?esc(d.date):'not set'}</b></span><span>Rider: <b>${d.rider?esc(d.rider):'not set'}</b></span><span>Contact: <b>${d.contact?`<a href="tel:${esc(d.contact)}">${esc(d.contact)}</a>`:'not set'}</b></span><span class="pill ${st[1]}">${esc(st[0])}</span></div>
 ${map}<div class="cap">Schematic map – the rider marker follows the courier's latest status update (it is not live GPS).</div>${steps}${phot}
 <div class="cu"><b>Courier update</b><div class="cuf"><select id="ts">${STAGES.map((s,i)=>`<option ${i==Math.min(ci+1,4)?'selected':''}>${s}</option>`).join('')}</select><input id="tn" placeholder="Note (optional)"><label class="fl">Photo of the actual product<input type="file" id="tf" accept="image/*" capture="environment" onchange="phPick(this)"></label><button type="button" class="btn s" onclick="trSend(${id})">Send update</button></div><img id="tpv" class="thm" style="display:none"></div>
 <div class="tlog"><b>Tracking history</b>${log}</div></div>`,'map','');
 const rp=$('#rtp'),L=rp.getTotalLength(),pt=rp.getPointAtLength(L*t);$('#rdr').setAttribute('transform',`translate(${pt.x} ${pt.y})`);const nr_=t>.9;$('#rdl').setAttribute('x',nr_?pt.x-22:pt.x);$('#rdl').setAttribute('y',nr_?pt.y+4:pt.y-20);$('#rdl').setAttribute('text-anchor',nr_?'end':'middle');$('#rtd').setAttribute('stroke-dasharray',`${L*t} ${L}`)}
function phPick(i){const f=i.files[0];if(!f)return;readPhoto(f,u=>{if(!u){alert('That file could not be read as a photo.');return}window.__ph=u;const v=$('#tpv');v.src=u;v.style.display='block'})}
function trSend(id){const p=D.po.find(x=>x.id==id);if(!p)return;const d=p.dv=p.dv||{};if(d.nr){alert('This order is marked as Not Received. Reopen it first.');return}
 const stage=$('#ts').value,note=$('#tn').value.trim(),who=d.rider?'Courier – '+d.rider:'Courier';
 if(stage=='Arrived'&&!(window.__ph||d.photo)){alert('The courier must send a photo of the actual product before the order can be marked as Arrived.');return}
 const now=new Date().toISOString();d.track=d.track||[];d.track.push({at:now,stage,note,by:who});if(window.__ph){d.photo=window.__ph;d.photoAt=now;d.photoBy=who}
 save();trackOpen(id);go()}
/* "Not Received": Super Admin only, two steps (reason, then a confirmation) */
function nrOpen(id){if(!isSuper())return;const p=D.po.find(x=>x.id==id);if(!p)return;
 $('#fm').innerHTML=`<h3 style="color:#c4161c;margin:0 0 4px">Mark as Not Received</h3>${poHead(p)}<label>Reason (required)</label><textarea id="nrr" rows="3" placeholder="e.g. Rider did not arrive on the expected date"></textarea>
 <div class="bt"><button type="button" class="btn g" onclick="$('#md').classList.remove('on')">Cancel</button><button type="button" class="btn" onclick="nrConfirm(${id})">Continue</button></div>`;
 $('#fm').onsubmit=e=>e.preventDefault();$('#md').classList.add('on')}
function nrConfirm(id){const p=D.po.find(x=>x.id==id),r=$('#nrr').value.trim();if(!r){alert('Please write the reason first.');return}window.__nrr=r;
 $('#fm').innerHTML=`<h3 style="color:#c4161c;margin:0 0 4px">Please confirm</h3>${poHead(p)}<div class="warnb">Are you sure order <b>${esc(p.ord||p.no)}</b> was <b>NOT received</b>?<br><br>Reason: <i>${esc(r)}</i><br><br>This will be recorded under <b>${esc(USER.name)}</b> (${esc(USER.u)}) with today's date and time, and the order cannot be received until it is reopened.</div>
 <div class="bt"><button type="button" class="btn g" onclick="nrOpen(${id})">Go back</button><button type="button" class="btn" style="background:#c4161c" onclick="nrDo(${id})">Yes, Not Received</button></div>`}
function nrDo(id){if(!isSuper())return;const p=D.po.find(x=>x.id==id);if(!p)return;const d=p.dv=p.dv||{},now=new Date().toISOString(),r=window.__nrr||'';
 d.nr={at:now,by:USER.name,u:USER.u,reason:r};d.track=d.track||[];d.track.push({at:now,stage:'Not Received',note:r,by:USER.name+' ('+USER.u+')'});save();$('#md').classList.remove('on');go()}
function nrReopen(id){if(!isSuper())return;const p=D.po.find(x=>x.id==id);if(!p||!p.dv)return;if(!confirm('Remove the Not Received flag from this order so it can be received?'))return;
 delete p.dv.nr;p.dv.track.push({at:new Date().toISOString(),stage:'Reopened',note:'Not Received flag removed',by:USER.name+' ('+USER.u+')'});save();go()}
M.gr.x=[['Delivery Photo',r=>r.photo?`<img class="thm" src="${r.photo}" title="Photo of the actual product${r.rider?' – courier: '+esc(r.rider):''}" onclick="photoView(this.src,'Goods receiving ${esc(r.no)} – photo of the actual product')">`:'—']];
M.suppliers.nostat=1;M.suppliers.after=r=>{if(!r.status)r.status='Active'};

/* ---------- Procurement <-> Finance messages (per purchase order) ---------- */
const poMsgs=id=>(D.msgs||[]).filter(m=>m.po==id).sort((a,b)=>a.at<b.at?-1:a.at>b.at?1:a.id-b.id);
const unreadFor=(side,id)=>(D.msgs||[]).filter(m=>(id==null||m.po==id)&&m.from!=side&&!m.read).length;
const fdt=a=>{try{const d=new Date(a);return d.toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'})+' · '+d.toLocaleTimeString('en-PH',{hour:'numeric',minute:'2-digit'})}catch(e){return a}};
const MSGICO='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.600 7.100L3 21l1.900-5.400A8 8 0 1 1 21 12z"/></svg>';
/* icon shows on a Pending order (and stays once a conversation exists, so replies can still be read) */
const msgBtn=r=>{if(r.status!='Pending'&&!poMsgs(r.id).length)return'';const n=unreadFor('p',r.id);return`<button class="btn s msg" title="Message Finance" aria-label="Message Finance" onclick="msgOpen(${r.id},'p')">${MSGICO}${n?`<i>${n}</i>`:''}</button>`};
function msgOpen(id,side){const po=D.po.find(x=>x.id==id);if(!po)return;D.msgs=D.msgs||[];
 let ch=false;D.msgs.forEach(m=>{if(m.po==id&&m.from!=side&&!m.read){m.read=true;ch=true}});if(ch)save();
 const th=poMsgs(id),P=side=='p';
 $('#fm').innerHTML=`<h3 style="color:var(--pri);margin:0 0 4px">${P?'Message to Finance':'Reply to Procurement'}</h3>
 <div class="mh">Order <b>${esc(po.ord||'—')}</b> · ${esc(po.no)} · ${esc(lbl('suppliers',po.supplier))} · ${fmt(tot(po))} · ${badge(po.status,'po')}</div>
 <div class="mt" id="mt">${th.length?th.map(m=>`<div class="mb ${m.from==side?'me':'ot'}"><small><b>${esc(m.by||'Unknown')}${m.u?' ('+esc(m.u)+')':''}</b> · ${m.from=='p'?'Procurement':'Finance'}<br>${fdt(m.at)}</small><div>${esc(m.text).replace(/\n/g,'<br>')}</div></div>`).join(''):`<div class="mn">No messages yet. ${P?'Write your message to Finance below.':''}</div>`}</div>
 <label>${P?'Your message to Finance':'Your reply to Procurement'}</label><div class="snd">Sending as <b>${esc(USER?USER.name:'')}</b>${USER?' ('+esc(USER.u)+')':''} · ${P?'Procurement':'Finance'} · the date and time are added when you send</div><textarea id="mx" rows="3" placeholder="${P?'e.g. Please prepare payment for this order…':'Type your reply…'}"></textarea>
 <div class="bt"><button type="button" class="btn g" onclick="msgClose()">Close</button><button type="button" class="btn" onclick="msgSend(${id},'${side}')">Send</button></div>`;
 $('#fm').onsubmit=e=>e.preventDefault();$('#md').classList.add('on');const t=$('#mt');if(t)t.scrollTop=t.scrollHeight;go()}
function msgSend(id,side){const tx=$('#mx').value.trim();if(!tx){$('#mx').focus();return}D.msgs=D.msgs||[];
 D.msgs.push({id:Math.max(0,...D.msgs.map(m=>m.id||0))+1,po:id,from:side,by:USER?USER.name:'',u:USER?USER.u:'',text:tx,at:new Date().toISOString(),read:false});save();msgOpen(id,side)}
function msgClose(){$('#md').classList.remove('on');go()}
function msgs(){const q=$('#q').value.toLowerCase(),ids=[...new Set((D.msgs||[]).map(m=>m.po))];
 const rows=ids.map(id=>{const po=D.po.find(x=>x.id==id);if(!po)return null;const th=poMsgs(id);return{po,last:th[th.length-1],un:unreadFor('f',id),th}}).filter(Boolean)
  .filter(r=>!q||JSON.stringify([r.po.ord,r.po.no,lbl('suppliers',r.po.supplier),r.th.map(m=>m.text)]).toLowerCase().includes(q)).sort((a,b)=>a.last.at<b.last.at?1:-1);
 let h=head('Messages','Messages from Procurement about purchase orders – open one to read it and reply')+`<div class="card tw"><table><tr><th>Order No.</th><th>PO No.</th><th>Supplier</th><th>Amount</th><th>PO Status</th><th>Latest message</th><th>Sent by</th><th>Date &amp; Time</th><th>Status</th><th>Actions</th></tr>`;
 rows.forEach(r=>{const l=r.last,sn=l.text.length>60?l.text.slice(0,60)+'…':l.text;
  h+=`<tr><td><b class="ordno">${esc(r.po.ord||'—')}</b></td><td><b>${esc(r.po.no)}</b></td><td>${esc(lbl('suppliers',r.po.supplier))}</td><td>${fmt(tot(r.po))}</td><td>${badge(r.po.status,'po')}</td><td>${esc(sn)}</td><td><b>${esc(l.by||'—')}</b>${l.u?' <small>('+esc(l.u)+')</small>':''}<br><small>${l.from=='p'?'Procurement':'Finance'}</small></td><td>${fdt(l.at)}</td><td>${r.un?'<span class="pill o1">New</span>':l.from=='f'?'<span class="pill g1">Replied</span>':'<span class="pill b1">Read</span>'}</td><td class="acts"><button class="btn s" onclick="msgOpen(${r.po.id},'f')">${r.un?'Read &amp; Reply':'Open'}</button></td></tr>`});
 return h+(rows.length?'':'<tr><td colspan=10>No messages yet. Procurement can message Finance from a Pending purchase order.</td></tr>')+'</table></div>'}
function refreshMsgBadge(){const n=unreadFor('f'),b=n?` <span class="nb">${n}</span>`:'',a=document.querySelector('#fnav a[data-v=msgs]'),f=document.querySelector('aside a[data-v=fin] .lb');if(a)a.innerHTML='Messages'+b;if(f)f.innerHTML='Finance'+b}
/* ---------- Login & roles ---------- */
/* Demo accounts – change these (they live in this file, so this is a front-end gate only, not server security). */
let USER=window.__USER||null;
const isSuper=()=>!!USER&&USER.role=='super';
/* Admin cannot open Supplier Management (or a supplier's page); Super Admin can open everything */
const canView=v=>isSuper()||!(v=='suppliers'||String(v).startsWith('sup:'));
/* Approvals & payments are Super Admin only */
const SUPER_ONLY={po:['Confirm','Cancel'],rfq:['Reject Quotation'],inv:['Request Payment'],pq:['Pay','Cancel']};
const canAct=(t,l)=>isSuper()||!(SUPER_ONLY[t]||[]).includes(l);
/* Inventory & Branches are view-only for Admin */
const canAdd=t=>isSuper()||!isInv(t);
function applyRole(){const el=document.querySelector('#nav a[data-v=suppliers]');if(el)el.style.display=canView('suppliers')?'':'none';
 $('#un').textContent=USER?USER.name:'';$('#ur').textContent=USER?(USER.role=='super'?'Super Administrator':'Administrator'):''}
function logout(){fetch('api.php?a=logout',{method:'POST',credentials:'same-origin'}).finally(()=>location.reload())}
applyRole();go();
