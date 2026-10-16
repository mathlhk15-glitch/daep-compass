/* v5.2 우리 학교 선배 기록(지원 건별): 대학 찾기 화면의 공통 조건(성적·검색어·전형·분야·연도)을 그대로 사용한다.
   - 교내용: data/school-records.csv 자동 로드(meta compass-school-data=on). 공개용: 사용자가 CSV를 직접 불러온다.
   - 기록에는 이름·학생 연결 번호·수능/과목 점수가 없다. 모든 처리는 브라우저 안에서만 한다. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let source='national',data=[],byName=new Map(),sourceName='',builtIn=false,job=0,displayLimit=50;
const SOURCE_TEXT={
 national:'전국 대학 입시결과의 과거 70% 컷을 기준으로 탐색합니다.',
 school:'경일고·경일여고 선배의 지원 기록(연도·내신·대학·학과·전형·결과)을 보여 줍니다. 위의 성적·검색어·전형·분야 조건이 그대로 적용됩니다.',
 both:'전국 입결 카드 아래에 같은 대학·학과·전형의 우리 학교 선배 기록을 함께 펼쳐 보여 줍니다.'
};
const BRANCH=new Set(['천안','세종','안성','삼척','도계','삼척도계','미래','여','wise','글로컬','erica','글로벌','죽전']);
const RESULTS=['최초합격','충원합격','불합격','미기재'];
const TEMPLATE='학교,연도,대학,모집단위,전형,전형명,계열,전교과,국영수사과,결과,불합격사유,예비순위,1단계,모집인원,수능최저\n창원경일고,2025,경상국립대학교(진주),기계공학부,교과,학생부교과(일반전형),자연,3.4,3.2,충원합격,,12,,20,국수영탐 중 2개 합 7\n';

function standardSchool(s){const v=String(s||'').replace(/\s/g,'');if(['경일고','창원경일고','창원경일고등학교','남고'].includes(v))return '창원경일고';if(['경일여고','창원경일여고','경일여자고등학교','창원경일여자고등학교','여고'].includes(v))return '경일여고';return '';}
function standardTrack(v){const t=String(v||'').replace(/\s/g,'');if(/교과/.test(t))return '교과';if(/종합|학종/.test(t))return '종합';if(/논술/.test(t))return '논술';if(/실기|기타|특기자|예체능|면접/.test(t))return '기타';return '';}
function standardResult(v){const t=String(v||'').replace(/\s/g,'');if(/충원|추가/.test(t))return '충원합격';if(/불합/.test(t))return '불합격';if(/합격/.test(t))return '최초합격';return '미기재';}
function universityParts(v){
 const raw=String(v||'').toLowerCase().replace(/\s/g,'').replace(/^국립/,'');
 const m=raw.match(/\(([^()]*)\)$/);const campus=m?m[1]:'';
 let name=(m?raw.slice(0,m.index):raw).replace(/교육대학교$/,'교대').replace(/교육대$/,'교대').replace(/대학교$/,'대');
 const alias={'경상대':'경상국립대','경상국립':'경상국립대','창원':'창원대','부경':'부경대','서울교육대':'서울교대','진주교육대':'진주교대','한국외국어대':'한국외대','부산외국어대':'부산외대','이화여자대':'이화여대','금오공과대':'금오공대','서울과학기술대':'서울과기대','서울과기대':'서울과기대'};
 name=alias[name]||name;
 const campusAlias={'에리카':'erica','경주':'wise','경주캠퍼스':'wise','서울캠퍼스':'서울','세종캠퍼스':'세종','글로벌캠퍼스':'글로벌','미래캠퍼스':'미래','춘천캠퍼스':'춘천','부산캠퍼스':'부산'};
 return {name,campus:campusAlias[campus]||campus};
}
function matchesUniversity(name,query){
 const n=universityParts(name),q=universityParts(query);
 if(!q.name&&!q.campus)return true;
 if(q.campus&&q.campus!==n.campus)return false;
 if(!q.name)return Boolean(n.campus);
 return n.name.includes(q.name)||(!q.campus&&Boolean(n.campus)&&n.campus.includes(q.name));
}
function majorKey(v){
 let s=String(v||'').toLowerCase().replace(/\s/g,'').replace(/\([^)]*\)/g,'').replace(/[·.]/g,'');
 for(const suf of ['학과','학부','전공','계열','과','부']){if(s.endsWith(suf)&&s.length-suf.length>=2){s=s.slice(0,-suf.length);break;}}
 return s;
}
function sameMajor(a,b){const x=majorKey(a),y=majorKey(b);return !!x&&x===y;}

function parseCSV(input){
 const rows=[];let row=[],field='',state='start',line=1;
 function finishField(){row.push(field.trim());field='';state='start';}
 function finishRow(){finishField();if(row.some(x=>x!==''))rows.push({cells:row,line});row=[];}
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(state==='quoted'){if(c==='"'){if(input[i+1]==='"'){field+='"';i++;}else state='closed';}else{field+=c;if(c==='\n')line++;}continue;}
  if(c==='"'){if(state==='start'){state='quoted';continue;}throw Error(`${line}행: 따옴표 위치가 올바르지 않습니다.`);}
  if(c===','){finishField();continue;}
  if(c==='\n'||c==='\r'){if(c==='\r'&&input[i+1]==='\n')i++;finishRow();line++;continue;}
  if(state==='closed'){if(/\s/.test(c))continue;throw Error(`${line}행: 닫는 따옴표 뒤에 허용되지 않는 글자가 있습니다.`);}
  field+=c;if(state==='start'&&!/\s/.test(c))state='plain';
 }
 if(state==='quoted')throw Error(`${line}행: 닫히지 않은 따옴표가 있습니다.`);
 finishRow();return rows;
}
const required=['학교','연도','대학','모집단위','전형','전교과','결과'];
function validateCSV(text){
 const parsed=parseCSV(text.replace(/^﻿/,''));const rows=parsed.map(x=>x.cells);
 if(!rows.length)throw Error('비어 있는 CSV입니다.');
 const headers=rows.shift().map(x=>x.trim());
 if(new Set(headers).size!==headers.length)throw Error('중복된 열 이름이 있습니다.');
 if(!required.every(x=>headers.includes(x)))throw Error('필수 열이 없습니다: '+required.filter(x=>!headers.includes(x)).join(', ')+' (선배 기록 CSV 양식을 확인하세요)');
 const forbidden=headers.filter(h=>/이름|성명|학번|주민|연락처|전화/.test(h));
 if(forbidden.length)throw Error('개인 식별 열이 들어 있어 불러오지 않습니다: '+forbidden.join(', '));
 const accepted=[],issues=[];
 rows.forEach((cells,i)=>{
  const line=parsed[i+1]?.line||i+2;
  if(cells.length!==headers.length){issues.push(`${line}행: 열 개수 불일치`);return;}
  const r=Object.fromEntries(headers.map((k,j)=>[k,cells[j]]));
  const school=standardSchool(r['학교']),track=standardTrack(r['전형'])||standardTrack(r['전형명']),year=Number(r['연도']),g=Number(r['전교과']),g2=r['국영수사과']===undefined||r['국영수사과']===''?null:Number(r['국영수사과']);
  if(!school){issues.push(`${line}행: 알 수 없는 학교명`);return;}
  if(!track){issues.push(`${line}행: 전형 구분 확인 필요`);return;}
  if(!Number.isInteger(year)||year<2015||year>2035){issues.push(`${line}행: 입시연도 확인 필요`);return;}
  if(!Number.isFinite(g)||g<1||g>9){issues.push(`${line}행: 전교과 내신 확인 필요`);return;}
  if(!r['대학']){issues.push(`${line}행: 대학 없음`);return;}
  accepted.push({...r,_school:school,_track:track,_year:year,_g:g,_g2:Number.isFinite(g2)&&g2>=1&&g2<=9?g2:null,_result:standardResult(r['결과']),_uni:universityParts(r['대학']),_mk:majorKey(r['모집단위'])});
 });
 return {accepted,issues,total:rows.length};
}
async function decodeBytes(bytes){try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return new TextDecoder('euc-kr',{fatal:true}).decode(bytes);}}

/* ---------- 공통 조건 ---------- */
function shared(){
 const g=typeof currentGrade==='function'?currentGrade():null;
 const range=Number($('caseRange')?.value);
 const types=[...document.querySelectorAll('[data-typepick]:checked')].map(x=>x.dataset.typepick==='실기'?'기타':x.dataset.typepick);
 const schools=new Set([...document.querySelectorAll('.case-school:checked')].map(x=>standardSchool(x.value)));
 const followYears=$('caseYearMode')?.value==='follow';
 const years=followYears?[...document.querySelectorAll('[data-yearpick]:checked')].map(x=>+x.dataset.yearpick):null;
 const query=String($('query')?.value||'').replace(/\s+/g,' ').trim();
 const cat=typeof activeCat==='string'?activeCat:'';
 const catWords=cat?((typeof synonyms==='object'&&synonyms[cat])||[cat]):[];
 const basis=$('caseGradeBasis')?.value==='g2'?'g2':'g';
 const results=new Set([...document.querySelectorAll('.case-result:checked')].map(x=>x.value));
 const sort=$('caseSort')?.value||'near';
 const view=$('caseView')?.value==='list'?'list':'group';
 const rangeOnly=$('caseRangeOnly')?$('caseRangeOnly').checked:true;
 return {view,rangeOnly,grade:g,range:Number.isFinite(range)&&range>=0.1&&range<=3?range:0.5,types:new Set(types),schools,years,query,catWords,basis,results,sort};
}
const gradeOf=(r,s)=>s.basis==='g2'?r._g2:r._g;
function inRange(r,s){if(s.grade===null||!s.rangeOnly)return true;const v=gradeOf(r,s);return v!==null&&Math.abs(v-s.grade)<=s.range+1e-9;}
function common(r,s){return s.schools.has(r._school)&&s.types.has(r._track)&&(!s.years||s.years.includes(r._year))&&s.results.has(r._result);}
function textMatch(r,s){
 if(s.catWords.length&&!s.catWords.some(w=>String(r['모집단위']||'').toLowerCase().includes(w.toLowerCase())))return false;
 if(!s.query)return true;
 return s.query.split(' ').every(t=>{const tl=t.toLowerCase();return matchesUniversity(r['대학'],t)||String(r['모집단위']||'').toLowerCase().includes(tl)||String(r['전형명']||'').toLowerCase().includes(tl)||String(r['계열']||'')===t;});
}
function sortRows(list,s){
 const near=r=>{const v=gradeOf(r,s);return s.grade===null||v===null?0:Math.abs(v-s.grade);};
 const by={
  near:(a,b)=>near(a)-near(b)||b._year-a._year||String(a['대학']).localeCompare(String(b['대학']),'ko'),
  year:(a,b)=>b._year-a._year||String(a['대학']).localeCompare(String(b['대학']),'ko')||(gradeOf(a,s)??9)-(gradeOf(b,s)??9),
  grade:(a,b)=>(gradeOf(a,s)??9)-(gradeOf(b,s)??9)||b._year-a._year,
  univ:(a,b)=>String(a['대학']).localeCompare(String(b['대학']),'ko')||String(a['모집단위']).localeCompare(String(b['모집단위']),'ko')||(gradeOf(a,s)??9)-(gradeOf(b,s)??9)
 };
 return list.sort(by[s.sort]||by.near);
}
function resultBadge(r){
 const cls=r._result==='최초합격'?'ok':r._result==='충원합격'?'wait':r._result==='불합격'?'no':'unk';
 let extra='';
 if(r._result==='충원합격'&&r['예비순위'])extra=` <small>예비 ${esc(r['예비순위'])}번</small>`;
 if(r._result==='불합격'){if(r['불합격사유'])extra=` <small>${esc(r['불합격사유'])}</small>`;else if(r['예비순위'])extra=` <small>예비 ${esc(r['예비순위'])}번</small>`;}
 return `<span class="rec-result ${cls}">${esc(r._result)}</span>${extra}`;
}
function trackText(t){return t==='기타'?'실기·기타':t;}
function rowHTML(r,s){
 const g=r._g.toFixed(1),g2=r._g2===null?'—':r._g2.toFixed(1);
 const min=r['수능최저']?`<details class="rec-min"><summary>수능최저 있음</summary>${esc(r['수능최저'])}</details>`:'<span class="micro">최저 없음</span>';
 return `<tr><td data-label="연도">${esc(r._year)}</td><td data-label="학교">${esc(r._school)}</td><td data-label="대학" class="rec-univ">${esc(r['대학'])}</td><td data-label="모집단위"><b>${esc(r['모집단위']||'—')}</b></td><td data-label="전형"><span class="rec-track t-${esc(r._track)}">${esc(trackText(r._track))}</span><div class="micro">${esc(r['전형명']||'')}</div></td><td data-label="전교과" class="rec-g${s.basis==='g'?' basis':''}">${g}</td><td data-label="국영수사과" class="rec-g${s.basis==='g2'?' basis':''}">${g2}</td><td data-label="결과">${resultBadge(r)}${r['1단계']?`<div class="micro">1단계 ${esc(r['1단계'])}</div>`:''}</td><td data-label="수능최저">${min}</td></tr>`;
}
function summaryHTML(list){
 const c=n=>list.filter(r=>r._result===n).length,ok=c('최초합격'),wait=c('충원합격'),no=c('불합격'),known=ok+wait+no;
 const minFail=list.filter(r=>/최저/.test(r['불합격사유']||'')).length;
 return `<div class="rec-stats"><span><b>${list.length.toLocaleString()}</b>건</span><span class="ok">최초합격 <b>${ok}</b></span><span class="wait">충원합격 <b>${wait}</b></span><span class="no">불합격 <b>${no}</b>${minFail?` <small>(최저 미충족 ${minFail})</small>`:''}</span>${known?`<span>합격 비율 <b>${Math.round((ok+wait)/known*100)}%</b> <small>(원서 기준)</small></span>`:''}</div>`;
}

/* ---------- 대학·모집단위·전형별 요약 ---------- */
function groupRows(list,s){
 const m=new Map();
 for(const r of list){const k=[r['대학'],String(r['모집단위']||'').replace(/\s+/g,' '),r._track].join('|');if(!m.has(k))m.set(k,[]);m.get(k).push(r);}
 const groups=[...m.entries()].map(([k,rs])=>{
  const gs=rs.map(r=>gradeOf(r,s)).filter(v=>v!==null).sort((a,b)=>a-b);
  const pass=rs.filter(r=>r._result==='최초합격'||r._result==='충원합격').map(r=>gradeOf(r,s)).filter(v=>v!==null).sort((a,b)=>a-b);
  const c=n=>rs.filter(r=>r._result===n).length;
  const med=gs.length?gs[Math.floor((gs.length-1)/2)]:9;
  return {key:k,univ:rs[0]['대학'],major:rs[0]['모집단위']||'—',track:rs[0]._track,rows:sortRows(rs.slice(),{...s,sort:'grade'}),n:rs.length,ok:c('최초합격'),wait:c('충원합격'),no:c('불합격'),unk:c('미기재'),
   gmin:gs[0],gmax:gs[gs.length-1],pmin:pass[0],pmax:pass[pass.length-1],med,years:[...new Set(rs.map(r=>r._year))].sort(),
   schools:[...new Set(rs.map(r=>r._school))].map(x=>x+' '+rs.filter(r=>r._school===x).length),minFail:rs.filter(r=>/최저/.test(r['불합격사유']||'')).length};
 });
 const by={
  near:(a,b)=>(s.grade===null?b.n-a.n:Math.abs(a.med-s.grade)-Math.abs(b.med-s.grade))||b.n-a.n,
  year:(a,b)=>b.years[b.years.length-1]-a.years[a.years.length-1]||b.n-a.n,
  grade:(a,b)=>a.med-b.med||b.n-a.n,
  univ:(a,b)=>a.univ.localeCompare(b.univ,'ko')||a.major.localeCompare(b.major,'ko')||a.track.localeCompare(b.track,'ko')
 };
 return groups.sort(by[s.sort]||by.near);
}
const f1=v=>v===undefined||v===null?'—':v.toFixed(1);
function groupHTML(g,s){
 const basisName=s.basis==='g2'?'국영수사과':'전교과';
 const passTxt=g.ok+g.wait?`${f1(g.pmin)}~${f1(g.pmax)}`:'합격 기록 없음';
 return `<details class="rec-group"><summary><div class="rg-head"><span class="rec-track t-${esc(g.track)}">${esc(trackText(g.track))}</span><span class="rg-univ">${esc(g.univ)}</span><span class="rg-major">${esc(g.major)}</span></div><div class="rg-counts"><span class="ok">최초합격 <b>${g.ok}</b></span><span class="wait">충원합격 <b>${g.wait}</b></span><span class="no">불합격 <b>${g.no}</b>${g.minFail?` <small>(최저미충족 ${g.minFail})</small>`:''}</span>${g.unk?`<span>미기재 ${g.unk}</span>`:''}</div><div class="rg-grades"><span>지원 내신(${basisName}) <b>${f1(g.gmin)}~${f1(g.gmax)}</b></span><span>합격 내신 <b>${passTxt}</b></span><span class="rg-meta">${g.years.join('·')}학년도 · ${esc(g.schools.join(' · '))}</span></div><span class="rg-open">상세 ${g.n}건 보기 ▾</span></summary><div class="rec-table-wrap inner"><table class="rec-table"><thead><tr><th>연도</th><th>학교</th><th>전형명</th><th>전교과</th><th>국영수사과</th><th>결과</th><th>수능최저</th></tr></thead><tbody>${g.rows.map(r=>detailRow(r,s)).join('')}</tbody></table></div></details>`;
}
function detailRow(r,s){
 const min=r['수능최저']?`<details class="rec-min"><summary>있음</summary>${esc(r['수능최저'])}</details>`:'<span class="micro">없음</span>';
 return `<tr><td data-label="연도">${esc(r._year)}</td><td data-label="학교">${esc(r._school)}</td><td data-label="전형명">${esc(r['전형명']||trackText(r._track))}${r['모집인원']?`<div class="micro">모집 ${esc(r['모집인원'])}명</div>`:''}</td><td data-label="전교과" class="rec-g${s.basis==='g'?' basis':''}">${r._g.toFixed(1)}</td><td data-label="국영수사과" class="rec-g${s.basis==='g2'?' basis':''}">${r._g2===null?'—':r._g2.toFixed(1)}</td><td data-label="결과">${resultBadge(r)}${r['1단계']?`<div class="micro">1단계 ${esc(r['1단계'])}</div>`:''}</td><td data-label="수능최저">${min}</td></tr>`;
}

/* ---------- 학교 기록 블록 ---------- */
function status(html){const el=$('caseStatus');if(el)el.innerHTML=html;}
function emptyState(){return `<div class="school-empty school-empty-cta"><strong>경일고·경일여고 선배 기록이 아직 연결되지 않았습니다.</strong><p>공개용 배포본에는 학교 자료가 들어 있지 않습니다. 선배 기록 CSV(교내 보관본)를 불러오면 같은 검색 조건으로 바로 표시됩니다. 파일은 이 브라우저 안에서만 읽고 어디에도 보내지 않습니다.</p><div class="cta-row"><button type="button" class="primary" data-case-action="pick">📂 선배 기록 CSV 불러오기</button><button type="button" class="smallbtn" data-case-action="template">CSV 양식 내려받기</button></div></div>`;}
function conditionChips(s){
 const chips=[];
chips.push(s.grade===null||!s.rangeOnly?'내신 전체(범위 제한 없음)':`${s.basis==='g2'?'국영수사과':'전교과'} ${s.grade.toFixed(2)} ±${s.range.toFixed(1)} → ${Math.max(1,s.grade-s.range).toFixed(2)}~${Math.min(9,s.grade+s.range).toFixed(2)}`);
 chips.push(s.years?`연도 ${s.years.join('·')}`:'2024~2026 전체');
 chips.push([...s.schools].join('·')||'학교 미선택');
 if(s.results.size<RESULTS.length)chips.push('결과: '+[...s.results].join('·'));
 if(s.query)chips.push(`검색어 「${s.query}」`);
 if(s.catWords.length)chips.push('분야 선택 적용');
 return chips.map(c=>`<span class="cond-chip">${esc(c)}</span>`).join('');
}
function emptyMsg(s){return `<div class="school-empty">현재 조건에 맞는 선배 기록이 없습니다. ${s.rangeOnly&&s.grade!==null?'「내 성적 ±범위만 보기」를 끄거나 범위(±)를 넓히거나, ':''}검색어를 대학명이나 더 짧은 학과명(예: 「전기」)으로 바꾸거나, 연도를 「2024~2026 전체」로 바꿔 보세요.</div>`;}
function filtered(s){return sortRows(data.filter(r=>common(r,s)&&inRange(r,s)&&textMatch(r,s)),s);}
function render(){
 const block=$('schoolResultsBlock');if(!block)return;
 const out=$('caseResults'),more=$('caseMore'),count=$('caseCount');
 block.hidden=source==='national';
 if(source==='national')return;
 out.innerHTML='';if(more)more.hidden=true;
 if(!data.length){if(count)count.textContent='자료 미연결';status('');out.innerHTML=emptyState();return;}
 const s=shared();
 if(!s.schools.size){status('<b>학교를 하나 이상 선택해 주세요.</b>');if(count)count.textContent='0건';return;}
 if(!s.types.size){status('<b>위의 관심 전형을 하나 이상 선택해 주세요.</b>');if(count)count.textContent='0건';return;}
 if(!s.results.size){status('<b>결과(최초합격·충원합격·불합격)를 하나 이상 선택해 주세요.</b>');if(count)count.textContent='0건';return;}
 const list=filtered(s);
 if(s.view==='group'){
  const groups=groupRows(list,s),glimit=source==='both'?Math.min(displayLimit,10):Math.round(displayLimit*0.6),gshown=groups.slice(0,glimit);
  if(count)count.textContent=`${groups.length.toLocaleString()}개 대학·학과·전형 · ${list.length.toLocaleString()}건`;
  status(`<div class="cond-row">${conditionChips(s)}</div>${list.length?summaryHTML(list):''}<span class="micro">자료: ${esc(sourceName)} · 대학·모집단위·전형(교과/종합 분리)별 요약 · 카드를 누르면 건별 기록이 펼쳐집니다 · 원서 단위 과거 기록이며 합격 가능성 판단이 아닙니다.</span>`);
  out.innerHTML=gshown.length?`<div class="rec-groups">${gshown.map(g=>groupHTML(g,s)).join('')}</div>`:emptyMsg(s);
  if(more&&groups.length>gshown.length){more.hidden=false;more.textContent=source==='both'?`나머지 ${groups.length-gshown.length}개 더 보기 (선배 사례 화면으로 전환)`:`나머지 ${groups.length-gshown.length}개 대학·학과 더 보기`;}
  return;
 }
 const limit=source==='both'?Math.min(displayLimit,15):displayLimit;
 const shown=list.slice(0,limit);
 if(count)count.textContent=`${list.length.toLocaleString()}건 중 ${shown.length.toLocaleString()}건 표시`;
 status(`<div class="cond-row">${conditionChips(s)}</div>${list.length?summaryHTML(list):''}<span class="micro">자료: ${esc(sourceName)} · 원서(지원 건) 단위 기록 · 한 학생이 여러 건 지원했을 수 있음 · 과거 결과이며 합격 가능성 판단이 아닙니다.</span>`);
 out.innerHTML=shown.length?`<div class="rec-table-wrap"><table class="rec-table"><thead><tr><th>연도</th><th>학교</th><th>대학</th><th>모집단위</th><th>전형</th><th>전교과</th><th>국영수사과</th><th>결과</th><th>수능최저</th></tr></thead><tbody>${shown.map(r=>rowHTML(r,s)).join('')}</tbody></table></div>`:emptyMsg(s);
 if(more&&list.length>shown.length){more.hidden=false;more.textContent=source==='both'?`선배 기록 ${list.length-shown.length}건 더 보기 (선배 사례 화면으로 전환)`:`나머지 ${list.length-shown.length}건 더 보기`;}
}

/* ---------- 전국 입결 카드: 같은 대학·학과·전형 선배 기록 ---------- */
function rowsForCard(univ,major,type){
 if(!data.length)return null;
 const s=shared(),u=universityParts(univ),t=['교과','종합','논술'].includes(type)?type:'기타';
 const nb=BRANCH.has(u.campus);
 const same=(byName.get(u.name)||[]).filter(r=>common(r,s)&&r._track===t&&(nb?r._uni.campus===u.campus:!BRANCH.has(r._uni.campus)));
 const exact=same.filter(r=>sameMajor(r['모집단위'],major));
 return {exact:sortRows(exact,{...s,sort:'near'}),others:same.length-exact.length};
}
function cardStrip(b){
 if(!data.length||source==='school')return '';
 const res=rowsForCard(b.r[1],b.r[2],b.r[3]);if(!res)return '';
 const s=shared();
 if(!res.exact.length)return source==='both'?`<div class="school-strip empty">🏫 같은 학과·전형 선배 기록 없음${res.others?` <small>(같은 대학·전형 다른 학과 ${res.others}건)</small>`:''}</div>`:'';
 const ok=res.exact.filter(r=>r._result!=='불합격'&&r._result!=='미기재').length,no=res.exact.filter(r=>r._result==='불합격').length;
 const items=res.exact.slice(0,6).map(r=>`<li><b>${esc(r._year)}</b> ${esc(r._school)} · 전교과 <b>${r._g.toFixed(1)}</b>${r._g2!==null?` (국영수사과 ${r._g2.toFixed(1)})`:''} · ${esc(r['전형명']||trackText(r._track))} → ${resultBadge(r)}</li>`).join('');
 const extra=res.exact.length>6?`<li class="more">외 ${res.exact.length-6}건 — 「경일고·경일여고 선배 사례」에서 전체 보기</li>`:'';
 return `<details class="school-strip"${source==='both'?' open':''}><summary>🏫 우리 학교 선배 사례 보기 <span>${res.exact.length}건 · 합격 ${ok} / 불합격 ${no}</span></summary><ul>${items}${extra}</ul><p>${s.grade!==null?'입력 성적과 가까운 순 · ':''}원서 단위 과거 기록 · 합격 가능성 판정 아님</p></details>`;
}

/* ---------- 출처 전환·자료 로드 ---------- */
function setSource(next,silent){
 source=['national','school','both'].includes(next)?next:'national';
 document.querySelectorAll('[data-source]').forEach(btn=>{const on=btn.dataset.source===source;btn.classList.toggle('selected',on);btn.setAttribute('aria-pressed',String(on));});
 const note=$('sourceNote');if(note)note.textContent=SOURCE_TEXT[source];
 const opts=$('schoolOptions');if(opts)opts.hidden=source==='national';
 const nat=$('nationalResults');if(nat)nat.hidden=source==='school';
 const nOnly=$('nationalOnlyNote');if(nOnly)nOnly.hidden=source!=='school';
 displayLimit=50;render();
 if(!silent&&typeof search==='function')search();
}
function applyData(res,name,isBuiltIn){
 data=res.accepted;sourceName=name;builtIn=isBuiltIn;byName=new Map();
 for(const r of data){const k=r._uni.name;if(!byName.has(k))byName.set(k,[]);byName.get(k).push(r);}
 const yrs=[...new Set(data.map(r=>r._year))].sort();
 const info=$('caseCsvInfo');
 if(info)info.textContent=`현재 자료: ${name} · ${res.accepted.length.toLocaleString()}건(${yrs[0]}~${yrs[yrs.length-1]})${res.issues.length?' · 제외 '+res.issues.length+'건 ('+res.issues.slice(0,4).join(' / ')+')':''}${isBuiltIn?' · 이 배포본에 포함된 자료':' · 직접 불러온 파일(새로고침 시 사라짐)'}`;
 const clear=$('caseClear');if(clear)clear.hidden=isBuiltIn;
 const sub=document.querySelector('[data-source="school"] small');if(sub)sub.textContent=`${yrs[0]}~${yrs[yrs.length-1]} · 기록 ${data.length.toLocaleString()}건`;
}
async function loadCSV(e){
 const f=e.target.files?.[0];e.target.value='';if(!f)return;const id=++job;
 const info=$('caseCsvInfo');
 if(!/\.csv$/i.test(f.name)||f.size>5*1024*1024){if(info)info.textContent='CSV 파일(최대 5MB)을 선택하세요. 기존 자료를 유지합니다.';return;}
 try{
  const res=validateCSV(await decodeBytes(await f.arrayBuffer()));if(id!==job)return;
  if(!res.accepted.length)throw Error('사용 가능한 기록이 없습니다. '+res.issues.slice(0,3).join(' / '));
  applyData(res,f.name,false);
  setSource(source==='national'?'school':source);
 }catch(err){if(id!==job)return;if(info)info.textContent=`현재 자료: ${sourceName||'없음'} · 최근 파일 읽기 실패: ${err.message}`;}
}
async function loadBuiltIn(){
 if(!document.querySelector('meta[name="compass-school-data"][content="on"]'))return;
 try{
  const res=await fetch('data/school-records.csv',{cache:'no-cache'});if(!res.ok)return;
  const parsed=validateCSV(await decodeBytes(await res.arrayBuffer()));
  if(!parsed.accepted.length||data.length)return;
  applyData(parsed,'경일고·경일여고 수시 지원 기록',true);
  render();if(typeof search==='function'&&document.querySelector('#results .result, #results .empty'))search();
 }catch(e){}
}
function clearCSV(){if(builtIn)return;data=[];byName=new Map();sourceName='';const info=$('caseCsvInfo');if(info)info.textContent='현재 자료: 없음 · 불러온 기록을 지웠습니다.';const clear=$('caseClear');if(clear)clear.hidden=true;const sub=document.querySelector('[data-source="school"] small');if(sub)sub.textContent='선배 기록 자료 필요';setSource(source);}
function downloadTemplate(){const blob=new Blob(['﻿'+TEMPLATE],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='선배기록_양식.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}

function setup(){
 if(!$('schoolOptions'))return;
 document.querySelectorAll('[data-source]').forEach(btn=>btn.addEventListener('click',()=>setSource(btn.dataset.source)));
 $('caseCsv')?.addEventListener('change',loadCSV);
 $('caseClear')?.addEventListener('click',clearCSV);
 $('caseTemplate')?.addEventListener('click',downloadTemplate);
 document.addEventListener('click',e=>{const a=e.target.closest('[data-case-action]');if(!a)return;if(a.dataset.caseAction==='pick')$('caseCsv')?.click();else if(a.dataset.caseAction==='template')downloadTemplate();});
 $('caseMore')?.addEventListener('click',()=>{if(source==='both'){setSource('school');window.scrollTo({top:$('schoolResultsBlock').getBoundingClientRect().top+window.scrollY-10});return;}displayLimit+=50;render();});
 const rerender=()=>{displayLimit=50;render();if(source!=='school'&&data.length&&typeof search==='function')search();};
 document.querySelectorAll('.case-school,.case-result').forEach(x=>x.addEventListener('change',rerender));
 $('caseRange')?.addEventListener('input',()=>{clearTimeout(setup.t);setup.t=setTimeout(rerender,250)});
 ['caseYearMode','caseGradeBasis','caseSort','caseView','caseRangeOnly'].forEach(id=>$(id)?.addEventListener('change',rerender));
 setSource('national',true);
 loadBuiltIn();
}
window.SchoolCases={render,cardStrip,setSource,get source(){return source},get loaded(){return data.length>0}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
