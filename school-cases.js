/* v5.0 통합 검색: 우리 학교 선배 집계는 대학 찾기 화면의 공통 조건(성적·검색어·전형·분야·연도)을 그대로 사용한다.
   - data/school-cases.csv(교내용 배포본에 포함)가 있으면 자동으로 읽고, 없으면 사용자가 CSV를 직접 불러온다.
   - 모든 처리는 브라우저 안에서만 이루어지며 서버로 전송하지 않는다. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let source='national',data=[],byName=new Map(),sourceName='',builtIn=false,job=0,displayLimit=24;
const SOURCE_TEXT={
 national:'전국 대학 입시결과의 과거 70% 컷을 기준으로 탐색합니다.',
 school:'경일고·경일여고 선배 집계만 표시합니다. 위의 성적·대학·학과·전형 조건이 그대로 적용됩니다.',
 both:'전국 입결 카드 아래에 같은 대학·전형의 우리 학교 선배 집계를 함께 펼쳐 보여 줍니다.'
};
// 전국 입결 자료에서 별도 대학명으로 구분되는 분교·캠퍼스만 분리한다.
const BRANCH=new Set(['천안','세종','안성','삼척','도계','삼척도계','미래','여','wise','글로컬','erica','글로벌','죽전']);
const LEVEL={MB:'학과·등급구간',MA:'학과 전체',UB:'대학·등급구간',UA:'대학 전체'};
const LEVEL_RANK={'학과·등급구간':0,'학과 전체':1,'대학·등급구간':2,'대학 전체':3,'':4};
const COMBINED='합산';
const TEMPLATE='학교,연도,등급구간시작,등급구간끝,대학,학과,전형,지원구간,합격정보,독립학생수,집계단위\n창원경일고,2024~2026,3.00,3.99,경상국립대학교(진주),,교과,학생 10~14명 · 원서 15~19건,최초합격 5건 미만 · 충원합격 5~9건 · 불합격 5~9건,10,대학·등급구간\n';

function standardSchool(s){const v=String(s||'').replace(/\s/g,'');if(['경일고','창원경일고','창원경일고등학교','남고'].includes(v))return '창원경일고';if(['경일여고','창원경일여고','경일여자고등학교','창원경일여자고등학교','여고'].includes(v))return '경일여고';if(/합산/.test(v))return COMBINED;return '';}
function schoolLabel(s){return s===COMBINED?'두 학교 합산':s;}
function standardTrack(v){const t=String(v||'').replace(/\s/g,'');if(/교과/.test(t))return '교과';if(/종합|학종/.test(t))return '종합';if(/논술/.test(t))return '논술';if(/실기|기타|특기자|예체능|면접/.test(t))return '기타';return '';}
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
// 학과 일치: 괄호(세부 전공) 제거 후 접미어(학과·학부·전공·과·부)를 떼고 핵심어가 '완전히 같을 때만' 같은 학과로 본다.
function majorKey(v){
 let s=String(v||'').toLowerCase().replace(/\s/g,'').replace(/\([^)]*\)/g,'').replace(/[·.]/g,'');
 for(const suf of ['학과','학부','전공','계열','과','부']){if(s.endsWith(suf)&&s.length-suf.length>=2){s=s.slice(0,-suf.length);break;}}
 return s;
}
function sameMajor(a,b){const x=majorKey(a),y=majorKey(b);return !!x&&x===y;}

function parseCSV(input){
 // RFC 4180 style quoting; multiline fields supported. Fail on trailing characters after closing quote.
 const rows=[];let row=[],field='',state='start',line=1;
 function finishField(){row.push(field.trim());field='';state='start';}
 function finishRow(){finishField();if(row.some(x=>x!==''))rows.push({cells:row,line});row=[];}
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(state==='quoted'){
   if(c==='"'){if(input[i+1]==='"'){field+='"';i++;}else state='closed';}
   else{field+=c;if(c==='\n')line++;}
   continue;
  }
  if(c==='"'){
   if(state==='start'){state='quoted';continue;}
   throw Error(`${line}행: 따옴표 위치가 올바르지 않습니다.`);
  }
  if(c===','){finishField();continue;}
  if(c==='\n'||c==='\r'){
   if(c==='\r'&&input[i+1]==='\n')i++;
   finishRow();line++;continue;
  }
  if(state==='closed'){
   if(/\s/.test(c))continue;
   throw Error(`${line}행: 닫는 따옴표 뒤에 허용되지 않는 글자가 있습니다.`);
  }
  field+=c;if(state==='start'&&!/\s/.test(c))state='plain';
 }
 if(state==='quoted')throw Error(`${line}행: 닫히지 않은 따옴표가 있습니다.`);
 finishRow();return rows;
}
const required=['학교','연도','등급구간시작','등급구간끝','대학','학과','전형','지원구간','합격정보','독립학생수'];
function parseYears(v){const t=String(v||'').replace(/\s/g,'');let m=t.match(/^(\d{4})$/);if(m)return [+m[1],+m[1]];m=t.match(/^(\d{4})[~\-–](\d{4})$/);if(m&&+m[1]<=+m[2])return [+m[1],+m[2]];return null;}
function validateCSV(text){
 const parsed=parseCSV(text.replace(/^﻿/,''));const rows=parsed.map(x=>x.cells);
 if(!rows.length)throw Error('비어 있는 CSV입니다.');
 const headers=rows.shift().map(x=>x.trim());
 if(new Set(headers).size!==headers.length)throw Error('중복된 열 이름이 있습니다.');
 if(!required.every(x=>headers.includes(x)))throw Error('필수 열이 없습니다: '+required.filter(x=>!headers.includes(x)).join(', '));
 const accepted=[],issues=[];
 rows.forEach((cells,i)=>{
  const line=parsed[i+1]?.line||i+2;
  if(cells.length!==headers.length){issues.push(`${line}행: 열 개수 불일치`);return;}
  const r=Object.fromEntries(headers.map((k,j)=>[k,cells[j]]));
  const school=standardSchool(r['학교']),track=standardTrack(r['전형']),years=parseYears(r['연도']),count=Number(r['독립학생수']);
  const a=r['등급구간시작'],b=r['등급구간끝'];const hasRange=a!==''||b!=='';
  if(!school){issues.push(`${line}행: 알 수 없는 학교명`);return;}
  if(!track){issues.push(`${line}행: 전형 구분 확인 필요`);return;}
  if(!years||years[0]<2020||years[1]>2035){issues.push(`${line}행: 입시연도 확인 필요`);return;}
  if(!Number.isSafeInteger(count)||count<10){issues.push(`${line}행: 독립학생수가 10 이상의 정수가 아님`);return;}
  if(hasRange&&(!a||!b||!Number.isFinite(+a)||!Number.isFinite(+b)||+a<1||+b>9||+a>+b)){issues.push(`${line}행: 등급구간 오류`);return;}
  if(!r['대학']&&!r['학과']){issues.push(`${line}행: 대학·학과 모두 비어 있음`);return;}
  if(!r['지원구간']&&!r['합격정보']){issues.push(`${line}행: 결과 정보 없음`);return;}
  const level=Object.values(LEVEL).includes(String(r['집계단위']||'').trim())?String(r['집계단위']).trim():'';
  accepted.push({...r,_school:school,_track:track,_y1:years[0],_y2:years[1],_start:hasRange?+a:null,_end:hasRange?+b:null,_uni:universityParts(r['대학']),_level:level,_binned:level===LEVEL.MB||level===LEVEL.UB});
 });
 return {accepted,issues,total:rows.length};
}
async function decodeBytes(bytes){try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return new TextDecoder('euc-kr',{fatal:true}).decode(bytes);}}

/* ---------- 대학 찾기 화면의 공통 조건 읽기 ---------- */
function shared(){
 const g=typeof currentGrade==='function'?currentGrade():null;
 const range=Number($('caseRange')?.value);
 const types=[...document.querySelectorAll('[data-typepick]:checked')].map(x=>x.dataset.typepick==='실기'?'기타':x.dataset.typepick);
 const schools=new Set([...document.querySelectorAll('.case-school:checked')].map(x=>standardSchool(x.value)));
 if(schools.size===2)schools.add(COMBINED); // 두 학교를 모두 선택해야 합산 집계가 보인다
 const followYears=$('caseYearMode')?.value==='follow';
 const years=followYears?[...document.querySelectorAll('[data-yearpick]:checked')].map(x=>+x.dataset.yearpick):null;
 const query=String($('query')?.value||'').replace(/\s+/g,' ').trim();
 const cat=typeof activeCat==='string'?activeCat:'';
 const catWords=cat?((typeof synonyms==='object'&&synonyms[cat])||[cat]):[];
 return {grade:g,range:Number.isFinite(range)&&range>=0.1&&range<=3?range:0.5,types:new Set(types),schools,years,query,catWords,rawSchools:[...document.querySelectorAll('.case-school:checked')].length};
}
function gradeState(r,s){
 if(s.grade===null)return 'nograde';
 if(r._start===null)return 'norange';
 if(r._start<=s.grade+s.range&&r._end>=s.grade-s.range)return (r._start<s.grade-s.range||r._end>s.grade+s.range)?'partial':'inside';
 return 'out';
}
function yearOk(r,s){return !s.years||s.years.some(y=>y>=r._y1&&y<=r._y2);}
function common(r,s){return s.schools.has(r._school)&&s.types.has(r._track)&&yearOk(r,s);}
function queryMatch(r,s){
 if(s.catWords.length&&!s.catWords.some(w=>String(r['학과']||'').toLowerCase().includes(w.toLowerCase())))return false;
 if(!s.query)return true;
 return s.query.split(' ').every(t=>matchesUniversity(r['대학'],t)||String(r['학과']||'').toLowerCase().includes(t.toLowerCase())||String(r['전형']||'').includes(t));
}
const groupKey=r=>[r._school,r._uni.name,r._uni.campus,majorKey(r['학과']),r._track].join('|');
/* 집계 단위 선택 규칙
   - 성적이 있으면: 등급구간 집계 중 겹치는 것을 우선. 같은 대학·학과·전형에 등급구간 집계가 없을 때만 '전체 성적대' 집계를 보충(그 범위가 겹칠 때).
   - 성적이 없으면: '전체 성적대' 집계만 (등급구간 집계는 중복이므로 제외).
   - 집계단위가 없는 외부 CSV 행은 기존 방식(겹침 검사)대로 모두 대상. */
function pick(list,s){
 const binned=[],whole=[],plain=[];
 for(const r of list){const st=gradeState(r,s);if(st==='out')continue;if(!r._level)plain.push(r);else if(r._binned)binned.push(r);else whole.push(r);}
 if(s.grade===null)return [...whole,...plain];
 const covered=new Set(binned.map(groupKey));
 return [...binned,...whole.filter(r=>!covered.has(groupKey(r))),...plain];
}
const stateOrder={inside:0,partial:1,nograde:1,norange:2};
function sortRows(list,s){
 const mid=r=>r._start===null?99:Math.abs((r._start+r._end)/2-(s.grade??0));
 return list.sort((a,b)=>(stateOrder[gradeState(a,s)]-stateOrder[gradeState(b,s)])||(LEVEL_RANK[a._level]-LEVEL_RANK[b._level])||(s.grade!==null?mid(a)-mid(b):0)||(Number(b['독립학생수'])-Number(a['독립학생수']))||a._school.localeCompare(b._school,'ko')||String(a['대학']).localeCompare(String(b['대학']),'ko'));
}
function yearText(r){return r._y1===r._y2?`${r._y1}학년도`:`${r._y1}~${r._y2}학년도`;}
function rangeText(r){return r._start===null?'등급구간 미제공':`${r._start.toFixed(2)}~${r._end.toFixed(2)}등급`;}
function levelBadge(r){return r._level?`<span class="sr-level">${esc(r._level)}</span>`:'';}
function gradeNote(r,st){
 if(st==='norange')return '등급구간이 제공되지 않은 집계입니다.';
 if(!r._binned&&r._level)return '전체 성적대 집계입니다. 표시한 등급구간은 지원 학생 대부분(10~90%)이 속한 범위이며, 범위 밖 학생도 포함될 수 있습니다.';
 if(st==='partial')return '집계 구간이 검색 범위와 일부만 겹칩니다. 범위 밖 성적의 선배도 포함됩니다.';
 return '';
}
function makeCard(r,s){const st=gradeState(r,s),note=gradeNote(r,st);return `<article class="school-result${r._school===COMBINED?' combined':''}"><div class="sr-badges"><span>${esc(schoolLabel(r._school))}</span><span>${esc(yearText(r))}</span><span>${esc(r._track==='기타'?'실기·기타':r._track)}</span>${levelBadge(r)}${st==='partial'?'<span class="sr-partial">등급구간 일부 겹침</span>':''}</div><h3>${esc(r['대학']||'대학 통합')} · ${esc(r['학과']||'학과 통합')}</h3><p class="sr-meta">집계 등급구간(9등급 전교과): <b>${esc(rangeText(r))}</b>${note?'<br>'+esc(note):''}</p><div class="sr-stats"><div><small>지원 규모</small><strong>${esc(r['지원구간']||'미제공')}</strong></div><div><small>원서 결과</small><strong>${esc(r['합격정보']||'미제공')}</strong></div></div></article>`;}

/* ---------- 학교 사례 블록 ---------- */
function status(html){const el=$('caseStatus');if(el)el.innerHTML=html;}
function emptyState(){
 return `<div class="school-empty school-empty-cta"><strong>경일고·경일여고 선배 집계가 아직 연결되지 않았습니다.</strong><p>공개용 배포본에는 개인정보 보호를 위해 학교 자료가 들어 있지 않습니다. 학교가 검토한 집계 CSV를 불러오면 같은 검색 조건으로 선배 사례가 바로 표시됩니다.</p><div class="cta-row"><button type="button" class="primary" data-case-action="pick">📂 학교 집계 CSV 불러오기</button><button type="button" class="smallbtn" data-case-action="template">CSV 양식 내려받기</button></div><p class="micro">개별 학생 원서 기록이나 이름·학번이 들어간 파일은 사용하지 마세요.</p></div>`;
}
function conditionChips(s){
 const chips=[];
 chips.push(s.grade===null?'성적 조건 없음(전체 성적대)':`비교 등급 ${s.grade.toFixed(2)} ±${s.range.toFixed(1)} → ${Math.max(1,s.grade-s.range).toFixed(2)}~${Math.min(9,s.grade+s.range).toFixed(2)}`);
 chips.push(s.years?`연도 ${s.years.join('·')}에 걸친 집계`:'2024~2026 전체 연도');
 chips.push([...s.schools].filter(x=>x!==COMBINED).join('·')+(s.schools.has(COMBINED)?' (+두 학교 합산)':''));
 if(s.query)chips.push(`검색어 「${s.query}」`);
 if(s.catWords.length)chips.push('분야 선택 적용');
 return chips.map(c=>`<span class="cond-chip">${esc(c)}</span>`).join('');
}
function render(){
 const block=$('schoolResultsBlock');if(!block)return;
 const out=$('caseResults'),more=$('caseMore'),count=$('caseCount');
 block.hidden=source==='national';
 if(source==='national')return;
 out.innerHTML='';if(more)more.hidden=true;
 if(!data.length){if(count)count.textContent='자료 미연결';status('');out.innerHTML=emptyState();return;}
 const s=shared();
 if(!s.rawSchools){status('<b>학교를 하나 이상 선택해 주세요.</b>');if(count)count.textContent='0건';return;}
 if(!s.types.size){status('<b>위의 관심 전형을 하나 이상 선택해 주세요.</b>');if(count)count.textContent='0건';return;}
 const selected=sortRows(pick(data.filter(r=>common(r,s)&&queryMatch(r,s)),s),s);
 const limit=source==='both'?Math.min(displayLimit,12):displayLimit;
 const displayed=selected.slice(0,limit);
 if(count)count.textContent=`${selected.length.toLocaleString()}건 중 ${displayed.length.toLocaleString()}건 표시`;
 status(`<div class="cond-row">${conditionChips(s)}</div><span class="micro">자료: ${esc(sourceName)} · 서로 다른 학생 10명 이상 집계만 표시 · 선배 개인 사례가 아니며 합격 가능성 판단이 아닙니다.</span>`);
 out.innerHTML=displayed.map(r=>makeCard(r,s)).join('')||'<div class="school-empty">현재 조건에 맞는 학교 집계가 없습니다. 검색 범위(±)를 넓히거나, 학과 대신 대학명으로 검색하거나, 두 학교를 모두 선택해 보세요. 집계가 없다는 것은 지원 사례가 없었다는 뜻이 아니라 공개 기준(학생 10명)에 못 미쳤을 수 있다는 뜻입니다.</div>';
 if(more&&selected.length>displayed.length){more.hidden=false;more.textContent=source==='both'?`우리 학교 선배 집계 ${selected.length-displayed.length}건 더 보기 (선배 사례 화면으로 전환)`:`나머지 ${selected.length-displayed.length}건 더 보기`;}
}

/* ---------- 전국 입결 카드용: 같은 대학·전형(·학과) 집계 ---------- */
function rowsForCard(univ,major,type){
 if(!data.length)return null;
 const s=shared(),u=universityParts(univ),t=['교과','종합','논술'].includes(type)?type:'기타';
 const nationalBranch=BRANCH.has(u.campus);
 const list=(byName.get(u.name)||[]).filter(r=>{
  if(r._track!==t||!s.schools.has(r._school)||!yearOk(r,s))return false;
  if(nationalBranch?r._uni.campus!==u.campus:BRANCH.has(r._uni.campus))return false;
  if(r['학과']&&!sameMajor(r['학과'],major))return false;
  return true;
 });
 const picked=sortRows(pick(list,s),s);
 // 학과 단위 집계가 있으면 대학 단위 집계는 생략(같은 학교 기준)
 const majorSchools=new Set(picked.filter(r=>r['학과']).map(r=>r._school));
 return picked.filter(r=>r['학과']||!majorSchools.has(r._school));
}
function cardStrip(b){
 if(!data.length||source==='school')return '';
 const rows=rowsForCard(b.r[1],b.r[2],b.r[3]);if(!rows)return '';
 if(!rows.length)return source==='both'?'<div class="school-strip empty">🏫 같은 대학·전형의 우리 학교 선배 집계 없음 <small>(학생 10명 미만은 비공개)</small></div>':'';
 const items=rows.slice(0,3).map(r=>`<li><b>${esc(schoolLabel(r._school))}</b> · ${esc(r['학과']||'대학 전체 모집단위')} · ${esc(rangeText(r))}${r._level&&!r._binned?' (전체 성적대)':''}<br><span>${esc(r['지원구간']||'')} · ${esc(r['합격정보']||'')}</span></li>`).join('');
 const extra=rows.length>3?`<li class="more">외 ${rows.length-3}건 — 「경일고·경일여고 선배 사례」에서 전체 보기</li>`:'';
 return `<details class="school-strip"${source==='both'?' open':''}><summary>🏫 우리 학교 선배 사례 보기 <span>${rows.length}건</span></summary><ul>${items}${extra}</ul><p>2024~2026 학교 집계 참고 · 학과가 비어 있으면 그 대학 같은 전형 전체 · 합격 가능성 판정 아님</p></details>`;
}

/* ---------- 출처 전환 ---------- */
function setSource(next,silent){
 source=['national','school','both'].includes(next)?next:'national';
 document.querySelectorAll('[data-source]').forEach(btn=>{const on=btn.dataset.source===source;btn.classList.toggle('selected',on);btn.setAttribute('aria-pressed',String(on));});
 const note=$('sourceNote');if(note)note.textContent=SOURCE_TEXT[source];
 const opts=$('schoolOptions');if(opts)opts.hidden=source==='national';
 const nat=$('nationalResults');if(nat)nat.hidden=source==='school';
 const nOnly=$('nationalOnlyNote');if(nOnly)nOnly.hidden=source!=='school';
 displayLimit=24;
 render();
 if(!silent&&typeof search==='function')search();
}
function applyData(res,name,isBuiltIn){
 data=res.accepted;sourceName=name;builtIn=isBuiltIn;byName=new Map();
 for(const r of data){const k=r._uni.name;if(!byName.has(k))byName.set(k,[]);byName.get(k).push(r);}
 const info=$('caseCsvInfo');
 if(info)info.textContent=`현재 자료: ${name} · ${res.accepted.length}행${res.issues.length?' · 제외 '+res.issues.length+'행 ('+res.issues.slice(0,4).join(' / ')+')':''}${isBuiltIn?' · 이 배포본에 포함된 학교 집계':' · 직접 불러온 파일(새로고침 시 사라짐)'}`;
 const clear=$('caseClear');if(clear)clear.hidden=isBuiltIn;
 const sub=document.querySelector('[data-source="school"] small');if(sub)sub.textContent=`2024~2026 · 집계 ${data.length}건`;
}
async function loadCSV(e){
 const f=e.target.files?.[0];e.target.value='';if(!f)return;const id=++job;
 const info=$('caseCsvInfo');
 if(!/\.csv$/i.test(f.name)||f.size>2*1024*1024){if(info)info.textContent='CSV 파일(최대 2MB)을 선택하세요. 기존 자료를 유지합니다.';return;}
 try{
  const res=validateCSV(await decodeBytes(await f.arrayBuffer()));if(id!==job)return;
  if(!res.accepted.length)throw Error('사용 가능한 집계 행이 없습니다. '+res.issues.slice(0,3).join(' / '));
  applyData(res,f.name,false);
  setSource(source==='national'?'both':source);
 }catch(err){if(id!==job)return;if(info)info.textContent=`현재 자료: ${sourceName||'없음'} · 최근 파일 읽기 실패: ${err.message}`;}
}
async function loadBuiltIn(){
 if(!document.querySelector('meta[name="compass-school-data"][content="on"]'))return; // 공개용: 학교 자료 없음
 try{
  const res=await fetch('data/school-cases.csv',{cache:'no-cache'});
  if(!res.ok)return; // 공개용 배포본: 학교 자료 없음
  const parsed=validateCSV(await decodeBytes(await res.arrayBuffer()));
  if(!parsed.accepted.length||data.length)return;
  applyData(parsed,'학교 집계(2024~2026, 학생 10명 이상 묶음)',true);
  render();if(typeof search==='function'&&searchReadyish())search();
 }catch(e){/* 내장 자료가 없거나 형식 오류: 사용자가 직접 불러올 수 있다 */}
}
function searchReadyish(){return !!document.querySelector('#results .result, #results .empty');}
function clearCSV(){if(builtIn)return;data=[];byName=new Map();sourceName='';const info=$('caseCsvInfo');if(info)info.textContent='현재 자료: 없음 · 불러온 학교 집계를 지웠습니다.';const clear=$('caseClear');if(clear)clear.hidden=true;const sub=document.querySelector('[data-source="school"] small');if(sub)sub.textContent='학교 집계 자료 필요';setSource(source);}
function downloadTemplate(){const blob=new Blob(['﻿'+TEMPLATE],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='학교집계_양식.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}

function setup(){
 if(!$('schoolOptions'))return;
 document.querySelectorAll('[data-source]').forEach(btn=>btn.addEventListener('click',()=>setSource(btn.dataset.source)));
 $('caseCsv')?.addEventListener('change',loadCSV);
 $('caseClear')?.addEventListener('click',clearCSV);
 $('caseTemplate')?.addEventListener('click',downloadTemplate);
 document.addEventListener('click',e=>{const a=e.target.closest('[data-case-action]');if(!a)return;if(a.dataset.caseAction==='pick')$('caseCsv')?.click();else if(a.dataset.caseAction==='template')downloadTemplate();});
 $('caseMore')?.addEventListener('click',()=>{if(source==='both'){setSource('school');window.scrollTo({top:$('schoolResultsBlock').getBoundingClientRect().top+window.scrollY-10});return;}displayLimit+=24;render();});
 const rerender=()=>{render();if(source!=='school'&&data.length&&typeof search==='function')search();};
 document.querySelectorAll('.case-school').forEach(x=>x.addEventListener('change',rerender));
 $('caseRange')?.addEventListener('input',()=>{clearTimeout(setup.t);setup.t=setTimeout(rerender,250)});
 $('caseYearMode')?.addEventListener('change',rerender);
 setSource('national',true); // 항상 전국 입결로 시작
 loadBuiltIn();
}
window.SchoolCases={render,cardStrip,setSource,get source(){return source},get loaded(){return data.length>0}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
