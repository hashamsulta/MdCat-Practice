const state = {
  allQuestions: [],
  questions: [],
  currentQuiz: null,
  currentQuestionIndex: 0,
  currentEditorUid: null,
  resultAttempt: null,
  timer: null,
  elapsed: 0,
  lastQuizConfig: null
};

const STORAGE = {
  overrides: "mdcat_overrides_v1",
  stats: "mdcat_stats_v1",
  history: "mdcat_history_v1",
  theme: "mdcat_theme_v1"
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

function getOverrides(){ try{return JSON.parse(localStorage.getItem(STORAGE.overrides)||"{}")}catch{return{}} }
function saveOverrides(x){localStorage.setItem(STORAGE.overrides,JSON.stringify(x))}
function getStats(){ try{return JSON.parse(localStorage.getItem(STORAGE.stats)||"{}")}catch{return{}} }
function saveStats(x){localStorage.setItem(STORAGE.stats,JSON.stringify(x))}
function getHistory(){ try{return JSON.parse(localStorage.getItem(STORAGE.history)||"[]")}catch{return[]} }
function saveHistory(x){localStorage.setItem(STORAGE.history,JSON.stringify(x))}

function applyOverrides(data){
  const overrides=getOverrides();
  return data.map(q => overrides[q.uid] ? {...q, ...overrides[q.uid], options:{...q.options,...overrides[q.uid].options}} : q);
}

async function loadData(){
  const res=await fetch("questions.json");
  if(!res.ok) throw new Error("Could not load questions.json");
  const raw=await res.json();
  state.allQuestions=applyOverrides(raw);
  state.questions=[...state.allQuestions];
  renderCounts();
  setupAllFilters();
  renderYearCards();
  renderRevision();
  renderHistory();
  renderEditorList();
}

function years(){return [...new Set(state.allQuestions.map(q=>Number(q.year)||2025))].sort((a,b)=>b-a)}
function papersFor(year){return [...new Set(state.allQuestions.filter(q=>year==="all"||Number(q.year)===Number(year)).map(q=>q.paper).filter(Boolean))].sort()}
function subjectsFor(year,paper){
  return [...new Set(state.allQuestions.filter(q=>(year==="all"||Number(q.year)===Number(year)) && (paper==="all"||q.paper===paper)).map(q=>q.subject).filter(Boolean))].sort()
}
function setOptions(select, items, allLabel="All"){
  select.innerHTML="";
  const o=document.createElement("option");o.value="all";o.textContent=allLabel;select.appendChild(o);
  items.forEach(x=>{const opt=document.createElement("option");opt.value=x;opt.textContent=x;select.appendChild(opt)});
}
function setupAllFilters(){
  const ys=years();
  ["homeYear","revisionYear","editorYear"].forEach(id=>{
    const s=$(id); if(!s)return;
    s.innerHTML="";
    const all=document.createElement("option");all.value="all";all.textContent="All years";s.appendChild(all);
    ys.forEach(y=>{const o=document.createElement("option");o.value=y;o.textContent=y;s.appendChild(o)});
  });
  const allP=papersFor("all"), allS=subjectsFor("all","all");
  setOptions($("homePaper"),allP,"All papers");
  setOptions($("homeSubject"),allS,"AS — All Subjects");
  setOptions($("revisionSubject"),allS,"AS — All Subjects");
  setOptions($("editorSubject"),allS,"AS — All Subjects");
  updateDependentFilters();
}
function updateDependentFilters(){
  const y=$("homeYear").value, p=$("homePaper").value;
  const oldPaper=$("homePaper").value, oldSub=$("homeSubject").value;
  setOptions($("homePaper"),papersFor(y),"All papers"); if(papersFor(y).includes(oldPaper))$("homePaper").value=oldPaper;
  setOptions($("homeSubject"),subjectsFor(y,$("homePaper").value),"AS — All Subjects"); if(subjectsFor(y,$("homePaper").value).includes(oldSub))$("homeSubject").value=oldSub;
}

function renderCounts(){
  $("totalCount").textContent=state.allQuestions.length.toLocaleString();
  $("paperCount").textContent=new Set(state.allQuestions.map(q=>q.paper).filter(Boolean)).size;
  $("attemptedCount").textContent=Object.keys(getStats()).length.toLocaleString();
}
function renderYearCards(){
  const grid=$("yearGrid");grid.innerHTML="";
  years().forEach(y=>{
    const count=state.allQuestions.filter(q=>Number(q.year)===y).length;
    const papers=new Set(state.allQuestions.filter(q=>Number(q.year)===y).map(q=>q.paper)).size;
    const b=document.createElement("button");b.className="year-card";b.innerHTML=`<strong>${y}</strong><small>${count.toLocaleString()} MCQs • ${papers} papers</small>`;
    b.onclick=()=>{ $("homeYear").value=y; updateDependentFilters(); $("homeMode").value="practice"; window.scrollTo({top:document.querySelector(".filters").offsetTop-90,behavior:"smooth"}); };
    grid.appendChild(b);
  });
  const all=document.createElement("button");all.className="year-card";all.innerHTML=`<strong>All years</strong><small>${state.allQuestions.length.toLocaleString()} MCQs • mixed database</small>`;
  all.onclick=()=>{$("homeYear").value="all";updateDependentFilters();};
  grid.appendChild(all);
}

function filterBase(year,paper,subject){
  return state.allQuestions.filter(q=>
    (year==="all"||Number(q.year)===Number(year)) &&
    (paper==="all"||q.paper===paper) &&
    (subject==="all"||q.subject===subject)
  );
}

function startQuizFromHome(){
  let arr=filterBase($("homeYear").value,$("homePaper").value,$("homeSubject").value);
  const mode=$("homeMode").value;
  const countVal=$("homeCount").value;
  const baseConfig={year:$("homeYear").value,paper:$("homePaper").value,subject:$("homeSubject").value,mode,count:countVal};
  if(mode==="revision"){
    const stats=getStats();
    arr=arr.filter(q=>stats[q.uid]);
    arr.sort((a,b)=> (stats[b.uid].incorrect||0)-(stats[a.uid].incorrect||0));
  } else if(mode==="random"){
    arr=shuffle(arr);
  } else if(mode==="paper"){
    arr=arr.slice().sort((a,b)=>Number(a.original_question_number||0)-Number(b.original_question_number||0));
  } else {
    arr=arr.slice().sort((a,b)=>Number(a.original_question_number||0)-Number(b.original_question_number||0));
  }
  if(countVal!=="all") arr=arr.slice(0,Number(countVal));
  if(!arr.length){toast("No questions match these filters.");return}
  beginQuiz(arr,baseConfig);
}

function beginQuiz(arr, config, reviewOnly=false){
  stopTimer();
  state.currentQuiz=arr.map(q=>q.uid);
  state.currentQuestionIndex=0;
  state.lastQuizConfig=config;
  state.resultAttempt=null;
  state.elapsed=0;
  const answers={};
  state.currentQuiz.forEach(id=>answers[id]=null);
  state.currentAttempt={id:uid(),startedAt:new Date().toISOString(),answers,flagged:{},reviewOnly};
  showView("quizView");
  $("quizModeLabel").textContent=labelMode(config.mode || "practice");
  startTimer();
  renderQuizQuestion();
  renderPalette();
}

function labelMode(m){return ({practice:"Practice",random:"Random Test",paper:"Paper Test",revision:"Revision",history:"History Review"}[m]||m)}
function currentQ(){return state.allQuestions.find(q=>q.uid===state.currentQuiz[state.currentQuestionIndex])}
function renderQuizQuestion(){
  const q=currentQ();if(!q)return;
  $("qYearTag").textContent=q.year||"";
  $("qPaperTag").textContent=q.paper||"";
  $("qSubjectTag").textContent=q.subject||"";
  $("qOriginalTag").textContent=`Original Q${q.original_question_number ?? "?"}`;
  $("questionText").innerHTML=esc(q.question).replace(/\n/g,"<br>");
  $("quizProgress").textContent=`Question ${state.currentQuestionIndex+1} / ${state.currentQuiz.length}`;
  $("progressBar").style.width=`${((state.currentQuestionIndex+1)/state.currentQuiz.length)*100}%`;
  const options=$("options");options.innerHTML="";
  const ans=state.currentAttempt.answers[q.uid];
  Object.entries(q.options||{}).forEach(([letter,text])=>{
    const b=document.createElement("button");b.className="option-btn"+(ans===letter?" selected":"");
    b.innerHTML=`<span class="option-letter">${letter}</span><span>${esc(text).replace(/\n/g,"<br>")}</span>`;
    if(ans!==null && state.lastQuizConfig?.mode==="practice" && !state.currentAttempt.reviewOnly){
      b.classList.add("disabled");
      if(q.answer===letter)b.classList.add("correct");
      else if(ans===letter)b.classList.add("wrong");
    }
    b.onclick=()=>selectAnswer(letter);
    options.appendChild(b);
  });
  const panel=$("explanation");
  panel.className="answer-panel hidden";
  if(ans!==null && (state.lastQuizConfig?.mode==="practice" || state.currentAttempt.reviewOnly)){
    showImmediateFeedback(q,ans);
  }
  $("answeredLabel").textContent=`${Object.values(state.currentAttempt.answers).filter(Boolean).length} answered`;
  $("prevBtn").disabled=state.currentQuestionIndex===0;
  $("nextBtn").textContent=state.currentQuestionIndex===state.currentQuiz.length-1 && state.lastQuizConfig?.mode!=="practice"?"Finish":"Next →";
  renderPalette();
}
function showImmediateFeedback(q,ans){
  const panel=$("explanation");
  if(!q.answer){
    panel.className="answer-panel";panel.innerHTML=`<strong>Answer key unavailable.</strong><br>This question is unkeyed in your database, so it is not scored.`;
    return;
  }
  const good=ans===q.answer;
  panel.className=`answer-panel ${good?"correct":"wrong"}`;
  panel.innerHTML=`<strong>${good?"Correct ✓":"Incorrect ✗"}</strong><br>Correct answer: <b>${q.answer}</b>${q.options?.[q.answer]?` — ${esc(q.options[q.answer])}`:""}`;
}
function selectAnswer(letter){
  const q=currentQ(), mode=state.lastQuizConfig?.mode;
  if(mode==="practice" && state.currentAttempt.answers[q.uid]) return;
  state.currentAttempt.answers[q.uid]=letter;
  updateStatsForAnswer(q,letter);
  renderQuizQuestion();
  if(mode==="practice"){
    setTimeout(()=>{},0);
  }
}
function updateStatsForAnswer(q,letter){
  const stats=getStats();
  const old=stats[q.uid]||{attempts:0,correct:0,incorrect:0,lastAnswer:null,lastAttemptAt:null,year:q.year,paper:q.paper,subject:q.subject,original_question_number:q.original_question_number};
  old.attempts++;
  old.lastAnswer=letter;old.lastAttemptAt=new Date().toISOString();
  if(q.answer){
    if(letter===q.answer) old.correct++; else old.incorrect++;
  }
  stats[q.uid]=old;saveStats(stats);renderCounts();
}
function nextQuestion(){
  if(state.currentQuestionIndex<state.currentQuiz.length-1){state.currentQuestionIndex++;renderQuizQuestion();return}
  if(state.lastQuizConfig?.mode==="practice"){
    if(state.currentQuestionIndex===state.currentQuiz.length-1){
      completeAttempt();
    } 
  } else completeAttempt();
}
function prevQuestion(){if(state.currentQuestionIndex>0){state.currentQuestionIndex--;renderQuizQuestion()}}
function renderPalette(){
  const p=$("palette");p.innerHTML="";
  state.currentQuiz.forEach((id,i)=>{
    const q=state.allQuestions.find(x=>x.uid===id), a=state.currentAttempt.answers[id];
    const b=document.createElement("button");b.textContent=i+1;
    if(i===state.currentQuestionIndex)b.classList.add("current");
    if(a&&q?.answer)b.classList.add(a===q.answer?"correct":"wrong");
    b.onclick=()=>{state.currentQuestionIndex=i;renderQuizQuestion()};
    p.appendChild(b);
  });
}
function toggleFlag(){
  const id=currentQ().uid;state.currentAttempt.flagged[id]=!state.currentAttempt.flagged[id];
  $("flagBtn").textContent=state.currentAttempt.flagged[id]?"⚑ Flagged":"⚑ Flag";
}
function startTimer(){ if(state.lastQuizConfig?.mode==="random"||state.lastQuizConfig?.mode==="paper"){ $("timerLabel").classList.remove("hidden"); state.timer=setInterval(()=>{state.elapsed++;renderTimer()},1000)} else $("timerLabel").classList.add("hidden") }
function stopTimer(){if(state.timer){clearInterval(state.timer);state.timer=null}}
function renderTimer(){const m=String(Math.floor(state.elapsed/60)).padStart(2,"0"),s=String(state.elapsed%60).padStart(2,"0");$("timerLabel").textContent=`${m}:${s}`}

function completeAttempt(){
  stopTimer();
  const qs=state.currentQuiz.map(id=>state.allQuestions.find(q=>q.uid===id)).filter(Boolean);
  let correct=0,wrong=0,skipped=0,unkeyed=0;
  const answers=state.currentAttempt.answers;
  qs.forEach(q=>{
    const a=answers[q.uid];
    if(!q.answer){unkeyed++;return}
    if(!a) skipped++; else if(a===q.answer)correct++; else wrong++;
  });
  const scored=correct+wrong;
  const percent=scored?Math.round((correct/scored)*100):0;
  const attempt={id:state.currentAttempt.id,startedAt:state.currentAttempt.startedAt,finishedAt:new Date().toISOString(),mode:state.lastQuizConfig.mode,config:state.lastQuizConfig,questionIds:state.currentQuiz,answers,flagged:state.currentAttempt.flagged,elapsed:state.elapsed,correct,wrong,skipped,unkeyed,percent};
  const history=getHistory();history.unshift(attempt);saveHistory(history.slice(0,200));
  state.resultAttempt=attempt;
  renderResult(attempt);
  showView("resultView");
  renderHistory();
  renderRevision();
}
function renderResult(a){
  $("resultTitle").textContent=`${labelMode(a.mode)} complete`;
  $("resultScore").textContent=`${a.percent}%`;
  $("resultSummary").textContent=`${a.correct} correct out of ${a.correct+a.wrong} scored questions • ${a.unkeyed} without an answer key`;
  $("resultCorrect").textContent=a.correct;$("resultWrong").textContent=a.wrong;$("resultSkipped").textContent=a.skipped;$("resultUnkeyed").textContent=a.unkeyed;
  const d=$("resultDetails");d.innerHTML="";
  a.questionIds.forEach((id,i)=>{
    const q=state.allQuestions.find(x=>x.uid===id);if(!q)return;
    const ans=a.answers[id];let cls="skip",label="Skipped";
    if(q.answer&&ans){cls=ans===q.answer?"correct":"wrong";label=ans===q.answer?"Correct":"Wrong"}
    if(!q.answer){cls="skip";label="Unkeyed"}
    const row=document.createElement("div");row.className="result-row";
    row.innerHTML=`<div>Q${q.original_question_number??i+1}</div><div class="result-q">${esc(q.question)}</div><div class="status-pill ${cls}">${label}</div>`;
    d.appendChild(row);
  });
}
function reviewResult(){
  if(!state.resultAttempt)return;
  const ids=state.resultAttempt.questionIds;
  state.currentQuiz=ids;state.currentQuestionIndex=0;state.lastQuizConfig={...state.resultAttempt.config,mode:"history"};
  state.currentAttempt={id:uid(),startedAt:new Date().toISOString(),answers:{...state.resultAttempt.answers},flagged:{...state.resultAttempt.flagged},reviewOnly:true};
  showView("quizView");renderQuizQuestion();$("quizModeLabel").textContent="Review answers";stopTimer();$("timerLabel").classList.add("hidden");
}
function retryResult(){if(state.resultAttempt){const arr=state.resultAttempt.questionIds.map(id=>state.allQuestions.find(q=>q.uid===id)).filter(Boolean);beginQuiz(arr,state.resultAttempt.config)}}

function renderRevision(){
  const box=$("revisionList");if(!box)return;
  const filter=$("revisionFilter")?.value||"wrong", year=$("revisionYear")?.value||"all", subj=$("revisionSubject")?.value||"all", search=($("revisionSearch")?.value||"").toLowerCase();
  const stats=getStats();
  let arr=state.allQuestions.filter(q=>{
    const s=stats[q.uid];if(!s)return false;
    if(year!=="all"&&Number(q.year)!==Number(year))return false;
    if(subj!=="all"&&q.subject!==subj)return false;
    if(search&&!(`${q.question} ${q.paper} ${q.original_question_number}`.toLowerCase().includes(search)))return false;
    if(filter==="wrong"&&!(s.incorrect>0))return false;
    if(filter==="correct"&&!(s.correct>0))return false;
    if(filter==="unanswered"&&!(s.incorrect>0||s.correct===0))return false;
    return true;
  });
  arr.sort((a,b)=>((stats[b.uid]?.incorrect||0)-(stats[a.uid]?.incorrect||0))||((stats[b.uid]?.lastAttemptAt||"").localeCompare(stats[a.uid]?.lastAttemptAt||"")));
  if(!arr.length){box.innerHTML=`<div class="card empty">Nothing here yet. Attempt some MCQs and they will appear in revision.</div>`;return}
  box.innerHTML=arr.map(q=>{
    const s=stats[q.uid]||{};
    return `<div class="list-item">
      <div class="list-item-head"><div><div class="list-item-title">Q${esc(q.original_question_number)} • ${esc(q.subject)}</div><div class="list-item-sub">${esc(q.paper)} • Attempts ${s.attempts||0} • Correct ${s.correct||0} • Wrong ${s.incorrect||0}</div></div><span class="tag accent">${q.answer?`Key ${esc(q.answer)}`:"No key"}</span></div>
      <div class="list-item-sub">${esc(q.question)}</div>
      <div class="list-actions"><button class="ghost" onclick="reviseOne('${q.uid}')">Revise this</button><button class="ghost" onclick="jumpToEditor('${q.uid}')">Edit</button></div>
    </div>`;
  }).join("");
}
function reviseOne(id){
  const q=state.allQuestions.find(x=>x.uid===id);if(!q)return;
  beginQuiz([q],{year:q.year,paper:q.paper,subject:q.subject,mode:"revision",count:"1"});
}
function startRevision(){
  const stats=getStats();let arr=state.allQuestions.filter(q=>stats[q.uid]&&stats[q.uid].incorrect>0);
  arr.sort((a,b)=>(stats[b.uid].incorrect||0)-(stats[a.uid].incorrect||0));
  if(!arr.length){toast("No incorrect attempts to revise yet.");return}
  beginQuiz(arr.slice(0,50),{year:"all",paper:"all",subject:"all",mode:"revision",count:"50"});
}

function renderHistory(){
  const box=$("historyList");if(!box)return;const h=getHistory();
  if(!h.length){box.innerHTML=`<div class="card empty">No completed attempts yet.</div>`;return}
  box.innerHTML=h.map(a=>{
    const d=new Date(a.finishedAt);const title=`${labelMode(a.mode)} • ${a.config.paper==="all"?"All papers":a.config.paper}`;
    return `<div class="list-item history-item"><div><div class="list-item-title">${esc(title)}</div><div class="history-meta">${d.toLocaleString()} • ${a.correct}/${a.correct+a.wrong} scored • ${a.questionIds.length} questions • ${a.elapsed?formatTime(a.elapsed):"no timer"}</div></div><div><div class="history-score">${a.percent}%</div><div class="list-actions"><button class="ghost" onclick="openHistory('${a.id}')">Review</button></div></div></div>`;
  }).join("");
}
function openHistory(id){const a=getHistory().find(x=>x.id===id);if(!a)return;state.resultAttempt=a;reviewResult()}
function formatTime(s){return `${Math.floor(s/60)}m ${s%60}s`}

function renderEditorList(){
  const box=$("editorList");if(!box)return;
  const year=$("editorYear").value||"all",subject=$("editorSubject").value||"all",search=($("editorSearch").value||"").toLowerCase();
  const arr=state.allQuestions.filter(q=>
    (year==="all"||Number(q.year)===Number(year)) &&
    (subject==="all"||q.subject===subject) &&
    (!search||`${q.question} ${q.paper} ${q.original_question_number}`.toLowerCase().includes(search))
  );
  box.innerHTML=arr.slice(0,500).map(q=>`<div class="editor-question-item ${state.currentEditorUid===q.uid?"active":""}" onclick="selectEditorQuestion('${q.uid}')"><strong>Q${esc(q.original_question_number)} • ${esc(q.subject)}</strong><small>${esc(q.paper)}</small><small>${esc(q.question).slice(0,100)}${q.question.length>100?"…":""}</small></div>`).join("");
}
function selectEditorQuestion(id){
  const q=state.allQuestions.find(x=>x.uid===id);if(!q)return;state.currentEditorUid=id;
  $("editorEmpty").classList.add("hidden");$("editorForm").classList.remove("hidden");
  $("editOriginalNumber").value=q.original_question_number??"";$("editYear").value=q.year??"";$("editPaper").value=q.paper??"";$("editSubject").value=q.subject??"";
  $("editQuestion").value=q.question??"";
  ["A","B","C","D","E"].forEach(L=>$(("edit"+L)).value=q.options?.[L]??"");
  $("editAnswer").value=q.answer??"";
  renderEditorList();
}
function saveEditedQuestion(e){
  e.preventDefault();if(!state.currentEditorUid)return;
  const original=state.allQuestions.find(q=>q.uid===state.currentEditorUid);if(!original)return;
  const updated={...original,year:Number($("editYear").value)||original.year,original_question_number:Number($("editOriginalNumber").value)||original.original_question_number,paper:$("editPaper").value,subject:$("editSubject").value,question:$("editQuestion").value,options:{...original.options}};
  ["A","B","C","D","E"].forEach(L=>{const v=$(("edit"+L)).value;if(v.trim())updated.options[L]=v;else delete updated.options[L]});
  updated.answer=$("editAnswer").value||null;
  const overrides=getOverrides();overrides[updated.uid]={year:updated.year,original_question_number:updated.original_question_number,paper:updated.paper,subject:updated.subject,question:updated.question,options:updated.options,answer:updated.answer};
  saveOverrides(overrides);
  state.allQuestions=state.allQuestions.map(q=>q.uid===updated.uid?updated:q);
  toast("Saved locally.");
  renderCounts();renderYearCards();setupAllFilters();renderRevision();renderEditorList();selectEditorQuestion(updated.uid);
}
function resetQuestion(){
  if(!state.currentEditorUid)return;
  const overrides=getOverrides();delete overrides[state.currentEditorUid];saveOverrides(overrides);
  const raw=state.rawQuestions.find(q=>q.uid===state.currentEditorUid);
  if(raw)state.allQuestions=state.allQuestions.map(q=>q.uid===raw.uid?raw:q);
  selectEditorQuestion(state.currentEditorUid);renderCounts();renderYearCards();setupAllFilters();toast("Reset to original JSON.");
}
function exportJson(){
  const blob=new Blob([JSON.stringify(state.allQuestions,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="questions-updated.json";a.click();URL.revokeObjectURL(a.href);toast("Exported updated JSON.");
}
function importJsonFile(file){
  const r=new FileReader();r.onload=()=>{
    try{
      const arr=JSON.parse(r.result);if(!Array.isArray(arr))throw new Error("JSON must be an array");
      state.allQuestions=arr;state.rawQuestions=structuredClone(arr);saveOverrides({});
      localStorage.setItem("mdcat_import_notice","imported");
      setupAllFilters();renderCounts();renderYearCards();renderEditorList();renderRevision();toast(`Imported ${arr.length} questions into this browser.`);
    }catch(e){toast("Import failed: invalid JSON.");}
  };r.readAsText(file);
}

function showView(id){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  $(id).classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.nav===id.replace("View","")));
  window.scrollTo({top:0,behavior:"instant"});
}
function nav(name){
  if(name==="home")showView("homeView");
  else if(name==="revision"){showView("revisionView");renderRevision()}
  else if(name==="history"){showView("historyView");renderHistory()}
  else if(name==="editor"){showView("editorView");renderEditorList()}
}
function toast(msg){
  const t=$("toast");t.textContent=msg;t.classList.remove("hidden");clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.add("hidden"),2400)
}
function shuffle(arr){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

function initTheme(){
  const saved=localStorage.getItem(STORAGE.theme);
  if(saved==="dark")document.documentElement.classList.add("dark");
  $("themeBtn").textContent=document.documentElement.classList.contains("dark")?"☀":"☾";
}
function toggleTheme(){const dark=document.documentElement.classList.toggle("dark");localStorage.setItem(STORAGE.theme,dark?"dark":"light");$("themeBtn").textContent=dark?"☀":"☾"}

document.addEventListener("click",e=>{
  const n=e.target.closest("[data-nav]");if(n)nav(n.dataset.nav);
});
$("homeYear").addEventListener("change",updateDependentFilters);
$("homePaper").addEventListener("change",updateDependentFilters);
$("homeMode").addEventListener("change",()=>{$("countWrap").classList.toggle("hidden",$("homeMode").value==="revision")});
$("startQuizBtn").onclick=startQuizFromHome;
$("exitQuizBtn").onclick=()=>{stopTimer();nav("home")};
$("prevBtn").onclick=prevQuestion;
$("nextBtn").onclick=nextQuestion;
$("flagBtn").onclick=toggleFlag;
$("reviewResultBtn").onclick=reviewResult;
$("retryResultBtn").onclick=retryResult;
$("themeBtn").onclick=toggleTheme;
$("revisionFilter").onchange=renderRevision;$("revisionYear").onchange=renderRevision;$("revisionSubject").onchange=renderRevision;$("revisionSearch").oninput=renderRevision;
$("startRevisionBtn").onclick=startRevision;
$("clearHistoryBtn").onclick=()=>{if(confirm("Delete all attempt history from this browser?")){saveHistory([]);renderHistory();toast("History cleared.")}};
$("editorYear").onchange=renderEditorList;$("editorSubject").onchange=renderEditorList;$("editorSearch").oninput=renderEditorList;
$("editorForm").onsubmit=saveEditedQuestion;$("resetQuestionBtn").onclick=resetQuestion;$("exportJsonBtn").onclick=exportJson;$("importJsonBtn").onclick=()=>$("importJsonInput").click();
$("importJsonInput").onchange=e=>{if(e.target.files[0])importJsonFile(e.target.files[0])};

window.jumpToEditor=function(id){nav("editor");setTimeout(()=>selectEditorQuestion(id),50)};
window.reviseOne=reviseOne;window.openHistory=openHistory;window.selectEditorQuestion=selectEditorQuestion;

(async()=>{
  initTheme();
  try{
    const res=await fetch("questions.json");const raw=await res.json();state.rawQuestions=structuredClone(raw);state.allQuestions=applyOverrides(raw);state.questions=[...state.allQuestions];
    renderCounts();setupAllFilters();renderYearCards();renderRevision();renderHistory();renderEditorList();$("homeMode").dispatchEvent(new Event("change"));
  }catch(e){
    console.error(e);
    document.querySelector("main").innerHTML=`<div class="card empty"><h2>Could not load the MCQ database.</h2><p>Make sure <code>questions.json</code> is in the same folder as <code>index.html</code> and that the site is being served through GitHub Pages or a local web server.</p></div>`;
  }
})();
