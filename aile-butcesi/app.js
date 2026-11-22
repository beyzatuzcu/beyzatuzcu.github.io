/* Birlikte – Aile bütçesi. Sunucusuz, cihaz içi veri saklama. */
(function () {
  "use strict";
  var KEY = "birlikte_aile_butcesi_v1";
  var CATS = [
    ["Market","🛒"],["Faturalar","💡"],["Kira / Ev","🏡"],["Ulaşım","🚗"],
    ["Yemek","🍜"],["Sağlık","🩺"],["Eğitim","📚"],["Ev & Yaşam","🪴"],
    ["Eğlence","🎬"],["Diğer","📦"]
  ];
  var INCOME = [["Maaş","💼"],["Ek Gelir","✨"],["Hediye","🎁"],["Diğer","💰"]];
  var COLORS = ["#ede8ff","#fcece0","#e1f4eb","#fce6ed","#e8edf9","#fff3cd"];
  var state, selectedMonth = localMonth(), page = "genel", editingId = null, editingMemberId = null, toastTimer = null;
  var $ = function (id) { return document.getElementById(id); };
  var money = function (cents) { return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format((Number(cents)||0)/100); };
  function pad(n) { return String(n).padStart(2,"0"); }
  function localDate(date) { var d=date || new Date(); return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
  function localMonth() { return localDate().slice(0,7); }
  function uid() { return (typeof crypto!=="undefined" && crypto.randomUUID ? crypto.randomUUID() : "id-"+Date.now()+"-"+Math.random().toString(36).slice(2)); }
  function escapeHtml(value) { return String(value==null?"":value).replace(/[&<>"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];}); }
  function byName(a,b) { return a.title.localeCompare(b.title,"tr"); }
  function parseLira(text) {
    var s=String(text||"").trim().replace(/\s|₺/g,"");
    if (s.includes(",")) s=s.replace(/\./g,"").replace(",",".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,"");
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    var n=Math.round(Number(s)*100);
    return Number.isSafeInteger(n) && n>0 && n<=100000000000 ? n : null;
  }
  function centsInput(cents) { return cents ? (cents/100).toFixed(2).replace(".",",") : ""; }
  function validDate(s) { return typeof s==="string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s+"T12:00:00").getTime()) && new Date(s+"T12:00:00").toISOString().slice(0,10)===s; }
  function cleanAmount(n) { return Number.isSafeInteger(n) && n>0 && n<=100000000000 ? n : null; }
  function defaults() { return {version:1,members:[{id:uid(),name:"Ben"},{id:uid(),name:"Ablam"},{id:uid(),name:"Nisa"}],transactions:[],transfers:[],budgets:{}}; }
  function normalize(raw) {
    if (!raw || typeof raw!=="object" || !Array.isArray(raw.members) || !Array.isArray(raw.transactions)) throw Error("Geçerli bir Birlikte yedeği bulunamadı.");
    if (raw.members.length>100 || raw.transactions.length>20000 || (raw.transfers||[]).length>20000) throw Error("Dosya çok büyük.");
    var seen = new Set();
    var members = raw.members.filter(function(m){return m && typeof m.id==="string" && m.id.length<100 && typeof m.name==="string" && m.name.trim().length>0 && !seen.has(m.id) && (seen.add(m.id),true);}).map(function(m){return {id:m.id,name:m.name.trim().slice(0,40)};});
    if (!members.length) throw Error("Yedekte aile üyesi bulunamadı.");
    var ids = new Set(members.map(function(m){return m.id;}));
    var txnSeen = new Set();
    var transactions = raw.transactions.filter(function(t){return t && typeof t.id==="string" && !txnSeen.has(t.id) && (txnSeen.add(t.id),true) && (t.type==="expense"||t.type==="income") && cleanAmount(t.amount) && validDate(t.date) && ids.has(t.payer) && typeof t.title==="string" && t.title.trim();}).map(function(t){
      var kind=t.type==="income"?INCOME:CATS;
      var cat=kind.some(function(c){return c[0]===t.category;})?t.category:"Diğer";
      var participants=Array.isArray(t.participants)?t.participants.filter(function(id,i,arr){return ids.has(id)&&arr.indexOf(id)===i;}):[];
      if(t.type==="expense"&&!participants.length) participants=[t.payer];
      return {id:t.id,type:t.type,title:t.title.trim().slice(0,100),amount:t.amount,date:t.date,category:cat,payer:t.payer,note:String(t.note||"").slice(0,280),participants:t.type==="income"?[]:participants};
    });
    var transferSeen = new Set();
    var transfers=(Array.isArray(raw.transfers)?raw.transfers:[]).filter(function(t){return t && typeof t.id==="string" && !transferSeen.has(t.id) && (transferSeen.add(t.id),true) && ids.has(t.from) && ids.has(t.to) && t.from!==t.to && cleanAmount(t.amount) && validDate(t.date);}).map(function(t){return {id:t.id,from:t.from,to:t.to,amount:t.amount,date:t.date};});
    var budgets={};
    CATS.forEach(function(c){var n=raw.budgets&&raw.budgets[c[0]];if(cleanAmount(n))budgets[c[0]]=n;});
    return {version:1,members:members,transactions:transactions,transfers:transfers,budgets:budgets};
  }
  function load() { try {var saved=localStorage.getItem(KEY);return saved?normalize(JSON.parse(saved)):defaults();} catch(e){return defaults();} }
  function save() {try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch(e){toast("Kaydedilemedi. Tarayıcı depolamasını kontrol edin.");return false;}}
  function commit() {save();render();}
  function toast(message) {var t=$("toast");t.textContent=message;t.classList.add("visible");clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.classList.remove("visible");},3500);}
  function nameOf(id) {var m=state.members.find(function(x){return x.id===id;});return m?m.name:"Bilinmiyor";}
  function avatar(m,i) {return '<span class="avatar" style="background:'+COLORS[i%COLORS.length]+'">'+escapeHtml(m.name.trim().slice(0,1).toLocaleUpperCase("tr-TR"))+'</span>';}
  function memberIdx(id) {return Math.max(0,state.members.findIndex(function(m){return m.id===id;}));}
  function iconFor(category,type) {var cat=(type==="income"?INCOME:CATS).find(function(c){return c[0]===category;});return cat?cat[1]:"📌";}
  function transactionsFor(month) {return state.transactions.filter(function(t){return t.date.slice(0,7)===month;});}
  function monthTotals(month) {return transactionsFor(month).reduce(function(out,t){out[t.type]+=t.amount;return out;},{income:0,expense:0});}
  function expenses(month) {return transactionsFor(month).filter(function(t){return t.type==="expense";});}
  function amountByCategory(month) {var out={};expenses(month).forEach(function(t){out[t.category]=(out[t.category]||0)+t.amount;});return out;}
  function paidByMember(month) {var out={};state.members.forEach(function(m){out[m.id]=0;});expenses(month).forEach(function(t){out[t.payer]+=t.amount;});return out;}
  function monthDisplay(month) {var parts=month.split("-");return new Intl.DateTimeFormat("tr-TR",{month:"long",year:"numeric"}).format(new Date(Number(parts[0]),Number(parts[1])-1,1));}
  function humanDate(date){return new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"short",year:"numeric"}).format(new Date(date+"T12:00:00"));}
  function sortedRows(rows){return rows.slice().sort(function(a,b){return b.date.localeCompare(a.date)||b.id.localeCompare(a.id);});}
  function noData(emoji,heading,description,button){return '<div class="empty-state"><span class="empty-emoji">'+emoji+'</span><strong>'+heading+'</strong><p>'+description+'</p>'+(button?'<button class="btn btn-outline" data-open-expense>＋ İlk işlemi ekle</button>':"")+'</div>';}
  function categoryRows(month,limit) {
    var all=Object.entries(amountByCategory(month)).sort(function(a,b){return b[1]-a[1];});
    if (!all.length)return noData("🧾","Henüz gider kaydı yok","İlk masrafını ekleyince kategoriler burada görünecek.",true);
    var total=monthTotals(month).expense;
    return (limit?all.slice(0,limit):all).map(function(pair){
      var width=Math.round(pair[1]/total*100);
      return '<div class="category-row"><span class="category-icon">'+iconFor(pair[0],"expense")+'</span><div class="category-info"><span class="category-name">'+escapeHtml(pair[0])+' <span class="small-muted">%'+width+'</span></span><div class="progress-track"><div class="progress-fill" style="width:'+width+'%"></div></div></div><strong class="category-total">'+money(pair[1])+'</strong></div>';
    }).join("");
  }
  function transactionHtml(t,controls){
    var incoming=t.type==="income";
    return '<div class="transaction-row"><span class="txn-icon" style="'+(incoming?"background:#e7f5ed":"")+'">'+iconFor(t.category,t.type)+'</span><div class="txn-details"><div class="txn-title">'+escapeHtml(t.title)+'</div><div class="txn-meta">'+escapeHtml(t.category)+' · '+escapeHtml(nameOf(t.payer))+' · '+humanDate(t.date)+'</div></div><strong class="txn-amount '+(incoming?"income":"")+'">'+(incoming?"+":"−")+money(t.amount)+'</strong>'+(controls?'<div class="txn-actions"><button class="icon-btn" data-edit="'+escapeHtml(t.id)+'" title="Düzenle" aria-label="İşlemi düzenle">✎</button><button class="icon-btn" data-delete="'+escapeHtml(t.id)+'" title="Sil" aria-label="İşlemi sil">✕</button></div>':"")+'</div>';
  }
  function overview(){
    var totals=monthTotals(selectedMonth);
    $("sum-expense").textContent=money(totals.expense);
    $("sum-income").textContent=String(expenses(selectedMonth).length)+" adet";
    $("sum-net").textContent=money(Math.round(totals.expense/Math.max(1,state.members.length)));
    $("net-caption").textContent="Bilgi amaçlı; gerçek borçlar seçilen paylaşıma göre hesaplanır";
    $("month-title").textContent=monthDisplay(selectedMonth);
    $("category-overview").innerHTML=categoryRows(selectedMonth,5);
    var paid=paidByMember(selectedMonth);
    var max=Math.max(1,...Object.values(paid));
    $("payer-overview").innerHTML=state.members.map(function(m,i){return '<div class="person-row">'+avatar(m,i)+'<div class="person-info"><div class="person-name">'+escapeHtml(m.name)+'</div><div class="person-meta">'+(max===1&&paid[m.id]===0?"Henüz ödeme yok":"Toplam giderin %"+Math.round(paid[m.id]/Math.max(1,totals.expense)*100)+"’i")+'</div></div><div class="person-value">'+money(paid[m.id])+'</div></div>';}).join("");
    var last=sortedRows(transactionsFor(selectedMonth)).slice(0,5);
    $("recent-list").innerHTML=last.length?last.map(function(t){return transactionHtml(t,false);}).join(""):noData("🌷","Güzel bir başlangıç!","Bu ay henüz kayıt yok. İlk gelirini veya giderini ekle.",true);
  }
  function renderTransactions(){
    var q=$("search-input").value.trim().toLocaleLowerCase("tr-TR"),type=$("filter-type").value,member=$("filter-member").value;
    var old=$("filter-member").value;
    $("filter-member").innerHTML='<option value="all">Tüm üyeler</option>'+state.members.map(function(m){return '<option value="'+escapeHtml(m.id)+'">'+escapeHtml(m.name)+'</option>';}).join("");
    $("filter-member").value=state.members.some(function(m){return m.id===old;})?old:"all"; member=$("filter-member").value;
    var rows=sortedRows(transactionsFor(selectedMonth)).filter(function(t){return (type==="all"||type===t.type)&&(member==="all"||t.payer===member)&&(!q||(t.title+" "+t.note+" "+t.category+" "+nameOf(t.payer)).toLocaleLowerCase("tr-TR").includes(q));});
    $("transaction-count").textContent=rows.length+" işlem";
    $("transaction-list").innerHTML=rows.length?rows.map(function(t){return transactionHtml(t,true);}).join(""):noData("🔎","Kayıt bulunamadı","Bu ay için filtrelerle eşleşen bir işlem yok.",false);
  }
  function renderReports(){
    var totals=monthTotals(selectedMonth),cats=Object.entries(amountByCategory(selectedMonth)).sort(function(a,b){return b[1]-a[1];});
    $("report-categories").innerHTML=cats.length?cats.map(function(pair){var pct=Math.round(pair[1]/Math.max(1,totals.expense)*100);return '<div class="report-category"><div class="report-category-main"><div class="report-category-heading"><span>'+iconFor(pair[0],"expense")+' '+escapeHtml(pair[0])+'</span><small>'+money(pair[1])+'</small></div><div class="progress-track"><div class="progress-fill" style="width:'+pct+'%"></div></div></div><strong class="count-pill">%'+pct+'</strong></div>';}).join(""):noData("📊","Rapor için veri bekleniyor","Gider ekleyerek kategori dağılımını takip edebilirsin.",false);
    var amounts=amountByCategory(selectedMonth);
    var budgets=Object.entries(state.budgets).filter(function(p){return p[1]>0;});
    $("budget-list").innerHTML=budgets.length?budgets.map(function(pair){var used=amounts[pair[0]]||0,pct=Math.round(used/pair[1]*100);return '<div class="budget-row '+(used>pair[1]?"over":"")+'"><div class="budget-row-top"><strong>'+iconFor(pair[0],"expense")+' '+escapeHtml(pair[0])+'</strong><span>'+money(used)+' / '+money(pair[1])+'</span></div><div class="progress-track"><div class="progress-fill" style="width:'+Math.min(pct,100)+'%"></div></div><small>%'+pct+' kullanıldı'+(used>pair[1]?" · Limit aşıldı":"")+'</small></div>';}).join(""):noData("🎯","Henüz limit belirlenmedi","Kategori bazında bütçe koyarak harcamaları kontrol et.",false);
    var dates=[],parts=selectedMonth.split("-"),end=new Date(Number(parts[0]),Number(parts[1])-1,1);
    for(var i=5;i>=0;i--){var d=new Date(end.getFullYear(),end.getMonth()-i,1);dates.push(localDate(d).slice(0,7));}
    var max=Math.max(1,...dates.map(function(m){var t=monthTotals(m);return Math.max(t.income,t.expense);}));
    $("trend-chart").innerHTML=dates.map(function(m){var t=monthTotals(m),label=new Intl.DateTimeFormat("tr-TR",{month:"short"}).format(new Date(m+"-01T12:00:00"));return '<div class="trend-month"><div class="trend-bars"><div class="trend-bar expense" title="'+escapeHtml(money(t.expense))+'" style="height:'+Math.max(2,Math.round(t.expense/max*130))+'px"></div><div class="trend-bar income" title="'+escapeHtml(money(t.income))+'" style="height:'+Math.max(2,Math.round(t.income/max*130))+'px"></div></div><span class="trend-month-label">'+escapeHtml(label)+'</span></div>';}).join("");
  }
  function calculateBalances(month){
    var b={},groups={};state.members.forEach(function(m){b[m.id]=0;});
    expenses(month).forEach(function(t){
      var people=t.participants.filter(function(id){return Object.prototype.hasOwnProperty.call(b,id);}).sort();
      if(!people.length)return;
      b[t.payer]+=t.amount;
      var key=JSON.stringify(people);
      if(!groups[key])groups[key]={people:people,total:0};
      groups[key].total+=t.amount;
    });
    Object.keys(groups).forEach(function(key){
      var group=groups[key],each=Math.floor(group.total/group.people.length),remainder=group.total%group.people.length;
      group.people.forEach(function(id,i){b[id]-=each+(i<remainder?1:0);});
    });
    state.transfers.filter(function(t){return t.date.slice(0,7)===month;}).forEach(function(t){b[t.from]+=t.amount;b[t.to]-=t.amount;});
    return b;
  }
  function suggestions(balances){
    var creditors=Object.keys(balances).filter(function(id){return balances[id]>0;}).map(function(id){return{id:id,amount:balances[id]};}).sort(function(a,b){return b.amount-a.amount;});
    var debtors=Object.keys(balances).filter(function(id){return balances[id]<0;}).map(function(id){return{id:id,amount:-balances[id]};}).sort(function(a,b){return b.amount-a.amount;});
    var transfers=[],i=0,j=0;
    while(i<debtors.length&&j<creditors.length){var n=Math.min(debtors[i].amount,creditors[j].amount);if(n>0)transfers.push({from:debtors[i].id,to:creditors[j].id,amount:n});debtors[i].amount-=n;creditors[j].amount-=n;if(debtors[i].amount===0)i++;if(creditors[j].amount===0)j++;}
    return transfers;
  }
  function renderSettlements(){
    var b=calculateBalances(selectedMonth);
    $("balance-list").innerHTML=state.members.map(function(m,i){var n=b[m.id],cls=n>0?"positive":n<0?"negative":"neutral",description=n>0?"Alacaklı":n<0?"Borçlu":"Hesap tamam";return '<div class="balance-row">'+avatar(m,i)+'<div class="balance-info"><strong>'+escapeHtml(m.name)+'</strong><small>'+description+'</small></div><strong class="balance-value '+cls+'">'+(n>0?"+":"")+(n<0?"−":"")+money(Math.abs(n))+'</strong></div>';}).join("");
    var recommended=suggestions(b);
    $("settlement-list").innerHTML=recommended.length?recommended.map(function(s){return '<div class="settlement-card"><div class="settlement-names"><strong>'+escapeHtml(nameOf(s.from))+' → '+escapeHtml(nameOf(s.to))+'</strong><small>Önerilen ödeme</small></div><strong class="settlement-amount">'+money(s.amount)+'</strong><button class="btn btn-outline" data-pay-from="'+escapeHtml(s.from)+'" data-pay-to="'+escapeHtml(s.to)+'" data-pay-amount="'+s.amount+'">Ödendi ✓</button></div>';}).join(""):noData("🎉","Hesaplar tamam!","Bu ay için ödenmesi gereken bir bakiye görünmüyor.",false);
    var transfers=sortedRows(state.transfers.filter(function(t){return t.date.slice(0,7)===selectedMonth;}));
    $("transfer-list").innerHTML=transfers.length?transfers.map(function(t){return '<div class="transfer-row"><span>✓ <strong>'+escapeHtml(nameOf(t.from))+'</strong> → <strong>'+escapeHtml(nameOf(t.to))+'</strong><br><small>'+humanDate(t.date)+'</small></span><strong>'+money(t.amount)+'</strong><button class="icon-btn" title="Ödemeyi sil" aria-label="Ödemeyi sil" data-remove-transfer="'+escapeHtml(t.id)+'">✕</button></div>';}).join(""):noData("🫶","Ödeme kaydı yok","Hesaplaşma önerisindeki Ödendi düğmesiyle ödeme kaydedebilirsin.",false);
  }
  function renderMembers(){
    $("members-list").innerHTML=state.members.map(function(m,i){var cnt=state.transactions.filter(function(t){return t.payer===m.id;}).length;return '<article class="member-card">'+avatar(m,i)+'<h2>'+escapeHtml(m.name)+'</h2><p>'+cnt+' işlemde ödeme yapan</p><div class="member-actions"><button class="btn btn-outline" data-edit-member="'+escapeHtml(m.id)+'">Düzenle</button><button class="btn btn-danger" data-delete-member="'+escapeHtml(m.id)+'">Sil</button></div></article>';}).join("");
  }
  function render(){
    $("month-input").value=selectedMonth;
    overview();renderTransactions();renderReports();renderSettlements();renderMembers();
  }
  function go(next){
    page=["genel","hareketler","raporlar","paylasim","uyeler","ayarlar"].includes(next)?next:"genel";
    document.querySelectorAll(".page").forEach(function(s){s.classList.toggle("hidden",s.id!=="page-"+page);});
    document.querySelectorAll("[data-page]").forEach(function(b){b.classList.toggle("active",b.dataset.page===page);});
    window.scrollTo({top:0,behavior:"instant"});
  }
  function close(id){$(id).close();}
  function open(id){$(id).showModal();}
  function displayEntryType(type){
    var income=type==="income",category=document.querySelector('#entry-form [name="category"]'),selected=category.value;
    category.innerHTML=(income?INCOME:CATS).map(function(c){return '<option value="'+escapeHtml(c[0])+'">'+c[1]+' '+escapeHtml(c[0])+'</option>';}).join("");
    if([].some.call(category.options,function(o){return o.value===selected;}))category.value=selected;
    $("payer-label").textContent=income?"Geliri kim aldı?":"Kim ödedi?";
    document.querySelector(".participants-field").classList.toggle("hidden",income);
    document.querySelector(".segmented").classList.toggle("hidden",!income);
  }
  function openEntry(id){
    editingId=id||null;
    var form=$("entry-form");form.reset();
    var t=id?state.transactions.find(function(x){return x.id===id;}):null;
    $("entry-heading").textContent=t?"Masrafı düzenle":"Yeni masraf";
    document.querySelector('#entry-form [name="entry-type"][value="'+(t?t.type:"expense")+'"]').checked=true;
    var payer=form.elements.payer;
    payer.innerHTML=state.members.map(function(m){return '<option value="'+escapeHtml(m.id)+'">'+escapeHtml(m.name)+'</option>';}).join("");
    displayEntryType(t?t.type:"expense");
    if(t){
      form.elements.title.value=t.title;form.elements.amount.value=centsInput(t.amount);form.elements.date.value=t.date;
      form.elements.category.value=t.category;form.elements.payer.value=t.payer;form.elements.note.value=t.note;
    }else{form.elements.date.value=selectedMonth===localMonth()?localDate():selectedMonth+"-01";}
    var participants=t&&t.type==="expense"?t.participants:state.members.map(function(m){return m.id;});
    $("participants-checkboxes").innerHTML=state.members.map(function(m){return '<label class="member-check"><input type="checkbox" name="participants" value="'+escapeHtml(m.id)+'" '+(participants.includes(m.id)?"checked":"")+'> '+escapeHtml(m.name)+'</label>';}).join("");
    open("entry-dialog");setTimeout(function(){form.elements.title.focus();},40);
  }
  function submitEntry(event){
    event.preventDefault();
    var form=event.currentTarget,type=form.querySelector('[name="entry-type"]:checked').value,amount=parseLira(form.elements.amount.value);
    if(amount===null){toast("Lütfen geçerli ve sıfırdan büyük bir tutar girin.");form.elements.amount.focus();return;}
    var people=Array.from(form.querySelectorAll('[name="participants"]:checked')).map(function(n){return n.value;});
    if(type==="expense"&&!people.length){toast("Masrafı paylaşacak en az bir kişi seçin.");return;}
    var t={id:editingId||uid(),type:type,title:form.elements.title.value.trim(),amount:amount,date:form.elements.date.value,category:form.elements.category.value,payer:form.elements.payer.value,note:form.elements.note.value.trim(),participants:type==="expense"?people:[]};
    if(!t.title||!validDate(t.date)){toast("İşlem adı ve tarihini kontrol edin.");return;}
    var index=state.transactions.findIndex(function(x){return x.id===editingId;});
    if(index>=0)state.transactions[index]=t;else state.transactions.push(t);
    selectedMonth=t.date.slice(0,7);close("entry-dialog");commit();toast(index>=0?"Masraf güncellendi.":"Masraf kaydedildi.");go("paylasim");
  }
  function openMember(id){
    editingMemberId=id||null;$("member-form").reset();
    $("member-heading").textContent=id?"Üyeyi düzenle":"Üye ekle";
    if(id){var m=state.members.find(function(x){return x.id===id;});if(m)$("member-form").elements.name.value=m.name;}
    open("member-dialog");
  }
  function submitMember(event){
    event.preventDefault();var name=event.currentTarget.elements.name.value.trim();
    if(!name){toast("Lütfen isim girin.");return;}
    if(editingMemberId){state.members.find(function(m){return m.id===editingMemberId;}).name=name;}
    else if(state.members.length>=100){toast("En fazla 100 üye eklenebilir.");return;}
    else state.members.push({id:uid(),name:name});
    close("member-dialog");commit();toast("Üye kaydedildi.");go("uyeler");
  }
  function deleteMember(id){
    if(state.members.length<=1){toast("En az bir aile üyesi kalmalı.");return;}
    var used=state.transactions.some(function(t){return t.payer===id||t.participants.includes(id);})||state.transfers.some(function(t){return t.from===id||t.to===id;});
    if(used){toast("Bu üyenin bağlı işlemleri var. Önce işlemleri düzenleyin.");return;}
    if(confirm(nameOf(id)+" adlı üyeyi silmek istiyor musunuz?")){state.members=state.members.filter(function(m){return m.id!==id;});commit();toast("Üye silindi.");}
  }
  function openBudget(){
    $("budget-fields").innerHTML=CATS.map(function(c,i){return '<label class="budget-field">'+c[1]+' '+escapeHtml(c[0])+'<input type="text" inputmode="decimal" data-budget-index="'+i+'" placeholder="Limit yok" value="'+escapeHtml(centsInput(state.budgets[c[0]]))+'"></label>';}).join("");
    open("budget-dialog");
  }
  function submitBudget(event){
    event.preventDefault();var budgets={},invalid=false;
    $("budget-fields").querySelectorAll("input").forEach(function(inp){
      var s=inp.value.trim();if(!s)return;var amount=parseLira(s);
      if(amount===null){invalid=true;return;}budgets[CATS[Number(inp.dataset.budgetIndex)][0]]=amount;
    });
    if(invalid){toast("Limitler için geçerli tutar girin veya boş bırakın.");return;}
    state.budgets=budgets;close("budget-dialog");commit();toast("Aylık bütçe limitleri kaydedildi.");
  }
  function download(text,filename,type){
    var blob=new Blob([text],{type:type}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1500);
  }
  function exportJson(){download(JSON.stringify(state,null,2),"birlikte-yedek-"+localDate()+".json","application/json;charset=utf-8");toast("Yedek dosyası indirildi.");}
  function csvField(val){var s=String(val==null?"":val);if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
  function exportCsv(){
    var rows=[["Tür","İşlem","Tarih","Kategori","Ödeyen / Alan","Tutar (TL)","Paylaşanlar","Not"]];
    sortedRows(state.transactions).forEach(function(t){rows.push([t.type==="expense"?"Gider":"Gelir",t.title,t.date,t.category,nameOf(t.payer),(t.amount/100).toFixed(2).replace(".",","),t.participants.map(nameOf).join(", "),t.note]);});
    download("\ufeff"+rows.map(function(r){return r.map(csvField).join(";");}).join("\r\n"),"birlikte-islemler-"+localDate()+".csv","text/csv;charset=utf-8");toast("CSV dosyası indirildi.");
  }
  async function importJson(event){
    var file=event.currentTarget.files[0];event.currentTarget.value="";
    if(!file)return;if(file.size>5*1024*1024){toast("Yedek dosyası 5 MB'dan büyük olamaz.");return;}
    try{
      var raw=JSON.parse(await file.text()),incoming=normalize(raw);
      if(!confirm("Mevcut veriler silinip seçilen yedek yüklenecek. Devam edilsin mi?"))return;
      state=incoming;selectedMonth=localMonth();commit();go("genel");toast("Yedek başarıyla yüklendi.");
    }catch(error){toast("Yedek okunamadı: "+error.message);}
  }
  function clickHandler(event){
    var target=event.target.closest("button,[data-go]");
    if(!target)return;
    if(target.dataset.page){go(target.dataset.page);return;}
    if(target.dataset.go){go(target.dataset.go);return;}
    if(target.hasAttribute("data-open-expense")){openEntry();return;}
    if(target.dataset.close){close(target.dataset.close);return;}
    if(target.dataset.edit){openEntry(target.dataset.edit);return;}
    if(target.dataset.delete){var t=state.transactions.find(function(x){return x.id===target.dataset.delete;});if(t&&confirm('"'+t.title+'" işlemini silmek istiyor musunuz?')){state.transactions=state.transactions.filter(function(x){return x.id!==t.id;});commit();toast("İşlem silindi.");}return;}
    if(target.dataset.editMember){openMember(target.dataset.editMember);return;}
    if(target.dataset.deleteMember){deleteMember(target.dataset.deleteMember);return;}
    if(target.dataset.payFrom){
      var amount=Number(target.dataset.payAmount);
      var from=target.dataset.payFrom,to=target.dataset.payTo;
      if(!cleanAmount(amount)||!state.members.some(function(m){return m.id===from;})||!state.members.some(function(m){return m.id===to;}))return;
      if(confirm(nameOf(from)+" → "+nameOf(to)+" "+money(amount)+" ödendi olarak kaydedilsin mi?")){
        state.transfers.push({id:uid(),from:from,to:to,amount:amount,date:selectedMonth===localMonth()?localDate():selectedMonth+"-01"});
        commit();toast("Ödeme kaydedildi.");
      }return;
    }
    if(target.dataset.removeTransfer){if(confirm("Bu hesaplaşma ödemesini silmek istiyor musunuz?")){state.transfers=state.transfers.filter(function(t){return t.id!==target.dataset.removeTransfer;});commit();toast("Ödeme silindi.");}return;}
  }
  function init(){
    state=load();
    $("month-input").value=selectedMonth;
    document.addEventListener("click",clickHandler);
    document.querySelectorAll(".dialog").forEach(function(d){d.addEventListener("click",function(e){if(e.target===d)d.close();});});
    document.querySelectorAll('[name="entry-type"]').forEach(function(i){i.addEventListener("change",function(){displayEntryType(i.value);});});
    $("month-input").addEventListener("change",function(e){if(/^\d{4}-\d{2}$/.test(e.target.value)){selectedMonth=e.target.value;render();}});
    $("search-input").addEventListener("input",renderTransactions);
    $("filter-type").addEventListener("change",renderTransactions);
    $("filter-member").addEventListener("change",renderTransactions);
    $("entry-form").addEventListener("submit",submitEntry);
    $("member-form").addEventListener("submit",submitMember);
    $("budget-form").addEventListener("submit",submitBudget);
    $("add-member").addEventListener("click",function(){openMember();});
    $("edit-budgets").addEventListener("click",openBudget);
    $("export-json").addEventListener("click",exportJson);
    $("export-csv").addEventListener("click",exportCsv);
    $("import-json").addEventListener("change",importJson);
    $("reset-data").addEventListener("click",function(){if(confirm("TÜM kayıtlar ve üyeler silinecek. Emin misiniz?")){state=defaults();selectedMonth=localMonth();commit();go("genel");toast("Veriler sıfırlandı.");}});
    window.addEventListener("storage",function(e){if(e.key===KEY){state=load();render();toast("Kayıtlar başka sekmede güncellendi.");}});
    render();go("genel");
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();