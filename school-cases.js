/* v4.9 통합 검색: 학교 사례는 대학 찾기 화면의 공통 조건(성적·검색어·전형·분야·연도)을 그대로 사용한다.
   학교 집계 CSV는 사용자가 직접 불러온 경우에만 브라우저 메모리에서 사용하며 서버로 전송하지 않는다. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let source='national',data=[],byName=new Map(),sourceName='',job=0,displayLimit=60;
const SOURCE_TEXT={
 national:'전국 대학 입시결과의 과거 70% 컷을 기준으로 탐색합니다.',
 school:'경일고·경일여고 선배 집계만 표시합니다. 위의 성적·대학·학과·전형 조건이 그대로 적용됩니다.',
 both:'전국 입결 카드 아래에 같은 대학·전형의 우리 학교 선배 집계를 함께 펼쳐 보여 줍니다.'
};
const BRANCH=new Set(['세종','미래','erica','wise','안성','국제','글로벌','삼척','도계','삼척도계','여','칠암']);

function standardSchool(s){const v=String(s||'').replace(/\s/g,'');if(['경일고','창원경일고','창원경일고등학교'].includes(v))return '창원경일고';if(['경일여고','창원경일여고','경일여자고등학교','창원경일여자고등학교'].includes(v))return '경일여고';return '';}
function standardTrack(v){const t=String(v||'').replace(/\s/g,'');if(/교과/.test(t))return '교과';if(/종합|학종/.test(t))return '종합';if(/논술/.test(t))return '논술';if(/실기|기타|특기자|예체능/.test(t))return '기타';return '';}
function universityParts(v){
 const raw=String(v||'').toLowerCase().replace(/\s/g,'').replace(/^국립/,'');
 const m=raw.match(/\(([^()]*)\)$/);const campus=m?m[1]:'';
 let name=(m?raw.slice(0,m.index):raw).replace(/교육대학교$/,'교대').replace(/교육대$/,'교대').replace(/대학교$/,'대');
 const alias={'경상대':'경상국립대','경상국립':'경상국립대','창원':'창원대','부경':'부경대','서울교육대':'서울교대','진주교육대':'진주교대','한국외국어대':'한국외대','이화여자대':'이화여대','금오공과대':'금오공대','서울과학기술대':'서울과기대','서울과기대':'서울과기대'};
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
function majorKey(v){return String(v||'').toLowerCase().replace(/\s/g,'').replace(/\([^)]*\)/g,'').replace(/(학과|학부|전공|계열|과)$/,'');}
function sameMajor(a,b){const x=majorKey(a),y=majorKey(b);if(!x||!y)return false;return x===y||(Math.min(x.length,y.length)>=2&&(x.includes(y)||y.includes(x)));}

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
  const school=standardSchool(r['학교']),track=standardTrack(r['전형']),year=Number(r['연도']),count=Number(r['독립학생수']);
  const a=r['등급구간시작'],b=r['등급구간끝'];const hasRange=a!==''||b!=='';
  if(!school){issues.push(`${line}행: 알 수 없는 학교명`);return;}
  if(!track){issues.push(`${line}행: 전형 구분 확인 필요`);return;}
  if(!Number.isInteger(year)||year<2020||year>2035){issues.push(`${line}행: 입시연도 확인 필요`);return;}
  if(!Number.isSafeInteger(count)||count<10){issues.push(`${line}행: 독립학생수가 10 이상의 정수가 아님`);return;}
  if(hasRange&&(!a||!b||!Number.isFinite(+a)||!Number.isFinite(+b)||+a<1||+b>9||+a>+b)){issues.push(`${line}행: 등급구간 오류`);return;}
  if(!r['대학']&&!r['학과']){issues.push(`${line}행: 대학·학과 모두 비어 있음`);return;}
  if(!r['지원구간']&&!r['합격정보']){issues.push(`${line}행: 결과 정보 없음`);return;}
  accepted.push({...r,_school:school,_track:track,_year:year,_start:hasRange?+a:null,_end:hasRange?+b:null,_uni:universityParts(r['대학'])});
 });
 return {accepted,issues,total:rows.length};
}
async function decodeCSV(file){const bytes=await file.arrayBuffer();try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return new TextDecoder('euc-kr',{fatal:true}).decode(bytes);}}

/* ---------- 대학 찾기 화면의 공통 조건 읽기 ---------- */
function shared(){
 const g=typeof currentGrade==='function'?currentGrade():null;
 const range=Number($('caseRange')?.value);
 const types=[...document.querySelectorAll('[data-typepick]:checked')].map(x=>x.dataset.typepick==='실기'?'기타':x.dataset.typepick);
 const schools=[...document.querySelectorAll('.case-school:checked')].map(x=>standardSchool(x.value));
 const followYears=$('caseYearMode')?.value==='follow';
 const years=followYears?[...document.querySelectorAll('[data-yearpick]:checked')].map(x=>+x.dataset.yearpick):null;
 const query=String($('query')?.value||'').replace(/\s+/g,' ').trim();
 const cat=typeof activeCat==='string'?activeCat:'';
 const catWords=cat?((typeof synonyms==='object'&&synonyms[cat])||[cat]):[];
 return {grade:g,range:Number.isFinite(range)&&range>=0.1&&range<=3?range:0.5,types:new Set(types),schools:new Set(schools),years,query,catWords};
}
function gradeState(r,s){
 if(s.grade===null)return 'nograde';
 if(r._start===null)return 'norange';
 if(r._start<=s.grade+s.range&&r._end>=s.grade-s.range)return (r._start<s.grade-s.range||r._end>s.grade+s.range)?'partial':'inside';
 return 'out';
}
function baseFilter(r,s){
 if(!s.schools.has(r._school)||!s.types.has(r._track))return false;
 if(s.years&&!s.years.includes(r._year))return false;
 return gradeState(r,s)!=='out';
}
function queryMatch(r,s){
 if(s.catWords.length&&!s.catWords.some(w=>String(r['학과']||'').toLowerCase().includes(w.toLowerCase())))return false;
 if(!s.query)return true;
 return s.query.split(' ').every(t=>matchesUniversity(r['대학'],t)||String(r['학과']||'').toLowerCase().includes(t.toLowerCase())||String(r['전형']||'').includes(t));
}
const stateOrder={inside:0,partial:1,nograde:1,norange:2};
function sortRows(list,s){
 const mid=r=>r._start===null?99:Math.abs((r._start+r._end)/2-(s.grade??0));
 return list.sort((a,b)=>(stateOrder[gradeState(a,s)]-stateOrder[gradeState(b,s)])||(s.grade!==null?mid(a)-mid(b):0)||b._year-a._year||a._school.localeCompare(b._school,'ko')||String(a['대학']).localeCompare(String(b['대학']),'ko'));
}
function rangeText(r){return r._start===null?'등급구간 미제공':`${r._start.toFixed(2)}~${r._end.toFixed(2)}등급`;}
function gradeBadge(st){return st==='partial'?'<span class="sr-partial">등급구간 일부 겹침</span>':st==='norange'?'<span class="sr-partial">등급구간 미제공</span>':'';}

function makeCard(r,s){const st=gradeState(r,s);return `<article class="school-result"><div class="sr-badges"><span>${esc(r._school)}</span><span>${esc(r._year)}학년도</span><span>${esc(r._track==='기타'?'실기·기타':r._track)}</span>${gradeBadge(st)}</div><h3>${esc(r['대학']||'대학 통합')} · ${esc(r['학과']||'학과 통합')}</h3><p class="sr-meta">집계 등급구간: ${esc(rangeText(r))}${st==='partial'?' · 선택 범위 밖 성적도 집계에 포함될 수 있습니다.':''}</p><div class="sr-stats"><div><small>지원 기록</small><strong>${esc(r['지원구간']||'미제공')}</strong></div><div><small>집계 결과</small><strong>${esc(r['합격정보']||'미제공')}</strong></div></div></article>`;}

/* ---------- 학교 사례 블록 ---------- */
function status(t){const el=$('caseStatus');if(el)el.textContent=t;}
function render(){
 const block=$('schoolResultsBlock');if(!block)return;
 const out=$('caseResults'),more=$('caseMore'),count=$('caseCount');
 block.hidden=source==='national';
 if(source==='national')return;
 out.innerHTML='';if(more)more.hidden=true;
 if(!data.length){
  if(count)count.textContent='자료 미연결';
  status('경일고·경일여고 선배 집계 CSV가 아직 연결되지 않았습니다. 위의 「학교 집계 CSV 불러오기」에서 학교가 검토한 집계 파일을 선택하면 같은 검색 조건으로 선배 사례가 표시됩니다.');
  out.innerHTML='<div class="school-empty">공개 사이트에는 개인정보 보호를 위해 학교별 합불 자료가 들어 있지 않습니다. 개별 학생 원서 기록은 사용하지 마세요.</div>';
  return;
 }
 const s=shared();
 if(!s.schools.size){status('학교를 하나 이상 선택해 주세요.');if(count)count.textContent='0건';return;}
 if(!s.types.size){status('위의 관심 전형을 하나 이상 선택해 주세요.');if(count)count.textContent='0건';return;}
 const selected=sortRows(data.filter(r=>baseFilter(r,s)&&queryMatch(r,s)),s);
 const limit=source==='both'?Math.min(displayLimit,12):displayLimit;
 const displayed=selected.slice(0,limit);
 if(count)count.textContent=`${selected.length.toLocaleString()}건 중 ${displayed.length.toLocaleString()}건 표시`;
 const gradeLine=s.grade===null?'성적 조건 없음(전체 성적대)':`비교 등급 ${s.grade.toFixed(2)} ±${s.range.toFixed(1)} (9등급 척도)`;
 status(`${sourceName} · ${gradeLine}${s.query?' · 검색어 「'+s.query+'」':''}${s.years?' · 연도 '+s.years.join('·'):' · 2024~2026 전체 연도'} · 집계는 선배 개인 사례가 아니며 합격 가능성 판단이 아닙니다.`);
 out.innerHTML=displayed.map(r=>makeCard(r,s)).join('')||'<div class="school-empty">현재 조건에 맞는 학교 집계가 없습니다. 검색 범위(±)를 넓히거나 검색어·전형·학교 선택을 조정해 보세요. 집계가 없다는 것이 지원 사례가 없었다는 뜻은 아닙니다.</div>';
 if(more&&selected.length>displayed.length){more.hidden=false;more.textContent=source==='both'?`우리 학교 선배 집계 ${selected.length-displayed.length}건 더 보기 (학교 사례 화면으로 전환)`:`나머지 ${selected.length-displayed.length}건 더 보기`;}
}

/* ---------- 전국 입결 카드용: 같은 대학·전형(·학과) 집계 ---------- */
function rowsForCard(univ,major,type){
 if(!data.length)return null;
 const s=shared(),u=universityParts(univ),t=['교과','종합','논술'].includes(type)?type:'기타';
 const nationalBranch=BRANCH.has(u.campus);
 const list=(byName.get(u.name)||[]).filter(r=>{
  if(r._track!==t||!s.schools.has(r._school))return false;
  if(s.years&&!s.years.includes(r._year))return false;
  if(nationalBranch?r._uni.campus!==u.campus:BRANCH.has(r._uni.campus))return false;
  if(r['학과']&&!sameMajor(r['학과'],major))return false;
  return gradeState(r,s)!=='out';
 });
 return sortRows(list,s);
}
function cardStrip(b){
 if(!data.length||source==='school')return '';
 const rows=rowsForCard(b.r[1],b.r[2],b.r[3]);if(!rows)return '';
 if(!rows.length)return source==='both'?'<div class="school-strip empty">🏫 같은 대학·전형의 우리 학교 선배 집계 없음 <small>(공개 기준 미달 포함)</small></div>':'';
 const s=shared();
 const items=rows.slice(0,3).map(r=>`<li><b>${esc(r._school)}</b> ${esc(r._year)} · ${esc(r['학과']||'대학 전체')} · ${esc(rangeText(r))} · 지원 ${esc(r['지원구간']||'—')} · ${esc(r['합격정보']||'—')}${gradeState(r,s)==='partial'?' <em>(구간 일부 겹침)</em>':''}</li>`).join('');
 const extra=rows.length>3?`<li class="more">외 ${rows.length-3}건 — 「경일고·경일여고 선배 사례」에서 전체 보기</li>`:'';
 return `<details class="school-strip"${source==='both'?' open':''}><summary>🏫 우리 학교 선배 사례 보기 <span>${rows.length}건</span></summary><ul>${items}${extra}</ul><p>학교 집계 참고 · 합격 가능성 판정 아님</p></details>`;
}

/* ---------- 출처 전환 ---------- */
function setSource(next,silent){
 source=['national','school','both'].includes(next)?next:'national';
 document.querySelectorAll('[data-source]').forEach(btn=>{const on=btn.dataset.source===source;btn.classList.toggle('selected',on);btn.setAttribute('aria-pressed',String(on));});
 const note=$('sourceNote');if(note)note.textContent=SOURCE_TEXT[source];
 const opts=$('schoolOptions');if(opts)opts.hidden=source==='national'&&!data.length;
 const nat=$('nationalResults');if(nat)nat.hidden=source==='school';
 const nOnly=$('nationalOnlyNote');if(nOnly)nOnly.hidden=source!=='school';
 displayLimit=60;
 render();
 if(!silent&&typeof search==='function')search();
}
async function loadCSV(e){
 const f=e.target.files?.[0];e.target.value='';if(!f)return;const id=++job;
 const info=$('caseCsvInfo');
 if(!/\.csv$/i.test(f.name)||f.size>1024*1024){if(info)info.textContent='CSV 파일(최대 1MB)을 선택하세요. 기존 자료를 유지합니다.';return;}
 try{
  const res=validateCSV(await decodeCSV(f));if(id!==job)return;
  if(!res.accepted.length)throw Error('사용 가능한 집계 행이 없습니다. '+res.issues.slice(0,3).join(' / '));
  data=res.accepted;sourceName=f.name;byName=new Map();
  for(const r of data){const k=r._uni.name;if(!byName.has(k))byName.set(k,[]);byName.get(k).push(r);}
  if(info)info.textContent=`현재 자료: ${f.name} · ${res.accepted.length}행 불러옴 · 제외 ${res.issues.length}행${res.issues.length?' ('+res.issues.slice(0,4).join(' / ')+')':''} · 구조 검사만 수행했으며 독립학생수·학교 승인·재식별 위험을 검증한 것은 아닙니다.`;
  const clear=$('caseClear');if(clear)clear.hidden=false;
  setSource(source==='national'?'both':source);
 }catch(err){if(id!==job)return;if(info)info.textContent=`현재 자료: ${sourceName||'없음'} · 최근 파일 읽기 실패: ${err.message}`;}
}
function clearCSV(){data=[];byName=new Map();sourceName='';const info=$('caseCsvInfo');if(info)info.textContent='현재 자료: 없음 · 불러온 학교 집계를 지웠습니다.';const clear=$('caseClear');if(clear)clear.hidden=true;setSource(source);}

function setup(){
 if(!$('schoolOptions'))return;
 document.querySelectorAll('[data-source]').forEach(btn=>btn.addEventListener('click',()=>setSource(btn.dataset.source)));
 $('caseCsv')?.addEventListener('change',loadCSV);
 $('caseClear')?.addEventListener('click',clearCSV);
 $('caseMore')?.addEventListener('click',()=>{if(source==='both'){setSource('school');window.scrollTo({top:$('schoolResultsBlock').getBoundingClientRect().top+window.scrollY-10});return;}displayLimit+=60;render();});
 const rerender=()=>{render();if(source!=='school'&&data.length&&typeof search==='function')search();};
 document.querySelectorAll('.case-school').forEach(x=>x.addEventListener('change',rerender));
 $('caseRange')?.addEventListener('input',()=>{clearTimeout(setup.t);setup.t=setTimeout(rerender,250)});
 $('caseYearMode')?.addEventListener('change',rerender);
 // 학교 집계는 새로고침 시 사라지므로 항상 전국 입결로 시작한다.
 setSource('national',true);
}
window.SchoolCases={render,cardStrip,setSource,get source(){return source},get loaded(){return data.length>0}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
