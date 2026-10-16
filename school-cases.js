(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let mode='grade',data=[],sourceName='',job=0,displayLimit=100;
function standardSchool(s){const v=String(s||'').replace(/\s/g,'');if(['경일고','창원경일고','창원경일고등학교'].includes(v))return '창원경일고';if(['경일여고','창원경일여고','경일여자고등학교','창원경일여자고등학교'].includes(v))return '경일여고';return '';}
function standardTrack(v){const t=String(v||'').replace(/\s/g,'');if(/교과/.test(t))return '교과';if(/종합|학종/.test(t))return '종합';if(/논술/.test(t))return '논술';if(/실기|기타|특기자|예체능/.test(t))return '기타';return '';}
function universityParts(v){
 const raw=String(v||'').toLowerCase().replace(/\s/g,'').replace(/^국립/,'');
 const m=raw.match(/\(([^()]*)\)$/);const campus=m?m[1]:'';
 let name=(m?raw.slice(0,m.index):raw).replace(/교육대학교$/,'교대').replace(/교육대$/,'교대').replace(/대학교$/,'대');
 const alias={'경상대':'경상국립대','경상국립':'경상국립대','창원':'창원대','부경':'부경대','서울교육대':'서울교대','진주교육대':'진주교대','한국외국어대':'한국외대'};
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
function status(s){$('caseStatus').textContent=s;}
function switchMode(m){mode=m;$('caseGradePane').hidden=m!=='grade';$('caseTargetPane').hidden=m!=='target';[['caseModeGrade','grade'],['caseModeTarget','target']].forEach(([id,v])=>{const b=$(id);b.classList.toggle('selected',v===m);b.setAttribute('aria-selected',String(v===m));});render();}
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
  if(c===',' ){finishField();continue;}
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
function validateCSV(text){const parsed=parseCSV(text.replace(/^\uFEFF/,''));const rows=parsed.map(x=>x.cells);if(!rows.length)throw Error('비어 있는 CSV입니다.');const headers=rows.shift().map(x=>x.trim());if(new Set(headers).size!==headers.length)throw Error('중복된 열 이름이 있습니다.');if(!required.every(x=>headers.includes(x)))throw Error('필수 열이 없습니다: '+required.filter(x=>!headers.includes(x)).join(', '));const accepted=[],issues=[];rows.forEach((cells,i)=>{const line=parsed[i+1]?.line||i+2;if(cells.length!==headers.length){issues.push(`${line}행: 열 개수 불일치`);return;}const r=Object.fromEntries(headers.map((k,j)=>[k,cells[j]]));const school=standardSchool(r['학교']),track=standardTrack(r['전형']),year=Number(r['연도']),count=Number(r['독립학생수']);const a=r['등급구간시작'],b=r['등급구간끝'];const hasRange=a!==''||b!=='';if(!school){issues.push(`${line}행: 알 수 없는 학교명`);return;}if(!track){issues.push(`${line}행: 전형 구분 확인 필요`);return;}if(!Number.isInteger(year)||year<2020||year>2035){issues.push(`${line}행: 입시연도 확인 필요`);return;}if(!Number.isSafeInteger(count)||count<10){issues.push(`${line}행: 독립학생수가 10 이상의 정수가 아님`);return;}if(hasRange&&(!a||!b||!Number.isFinite(+a)||!Number.isFinite(+b)||+a<1||+b>9||+a>+b)){issues.push(`${line}행: 등급구간 오류`);return;}if(!r['대학']&&!r['학과']){issues.push(`${line}행: 대학·학과 모두 비어 있음`);return;}if(!r['지원구간']&&!r['합격정보']){issues.push(`${line}행: 결과 정보 없음`);return;}
accepted.push({...r,_school:school,_track:track,_year:year,_start:hasRange?+a:null,_end:hasRange?+b:null});});return {accepted,issues,total:rows.length};}
function currentGradeFromExplore(){const sys=$('system')?.value,raw=$('grade')?.value?.trim()||'';if(raw===''||sys==='none')return null;const n=Number(raw);if(!Number.isFinite(n)||n<1||n>(sys==='5'?5:9))return null;if(sys==='9')return {value:n,label:`9등급제 ${n.toFixed(2)}`};const model=$('conversionModel')?.value||'mixed';const converted=typeof convert5to9==='function'?convert5to9(n,model):null;return converted?{value:converted.estimate,label:`5등급제 ${n.toFixed(2)} → 통계적 9등급 추정 ${converted.estimate.toFixed(2)} (${({'mixed':'3지역 평균','gyeonggi':'경기 기준','busan':'부산 기준','gwangju':'광주 기준'})[model]||model})`}:null;}
function importExploreGrade(){const g=currentGradeFromExplore();if(!g){status('대학 찾기에서 먼저 유효한 등급을 입력해 주세요.');return;}$('caseGrade').value=g.value.toFixed(2);const hint=$('caseImportedGrade');if(hint)hint.textContent=`대학 찾기 성적 반영: ${g.label} · 이후 직접 변경할 수 있습니다.`;render();}
function makeCard(r,overlap){return `<article class="school-result"><div class="sr-badges"><span>${esc(r._school)}</span><span>${esc(r['연도'])}</span><span>${esc(r._track)}</span>${overlap?'<span class="sr-partial">등급구간 일부 겹침</span>':''}</div><h3>${esc(r['대학']||'대학 통합')} · ${esc(r['학과']||'학과 통합')}</h3><p class="sr-meta">집계 등급구간: ${r._start===null?'미제공':esc(r._start.toFixed(2)+' ~ '+r._end.toFixed(2))}${overlap?' · 선택 범위 밖 성적도 집계에 포함될 수 있습니다.':''}</p><div class="sr-stats"><div><small>지원 기록</small><strong>${esc(r['지원구간']||'미제공')}</strong></div><div><small>집계 결과</small><strong>${esc(r['합격정보']||'미제공')}</strong></div></div></article>`;}
function render(){const out=$('caseResults');out.innerHTML='';const more=$('caseMore');if(more)more.hidden=true;if(!data.length){status('학교별 선배 입시결과 자료 미연결: 학교가 검토한 집계 CSV를 불러오기 전에는 합격·불합격 결과를 조회할 수 없습니다. 두 학교 선택·① 비슷한 등급 ② 대학·학과 검색은 CSV 연결 후 작동합니다.');out.innerHTML='<div class="school-empty">아직 학교별 합불 집계가 연결되지 않았습니다. 위의 「학교가 사전 검토한 집계 CSV 불러오기」에서 자료를 선택하세요. 개별 학생 원서 기록은 사용하지 마세요.</div>';return;}const schools=new Set([...document.querySelectorAll('.case-school:checked')].map(x=>standardSchool(x.value))),tracks=new Set([...document.querySelectorAll('.case-track:checked')].map(x=>standardTrack(x.value)));if(!schools.size||!tracks.size){status('학교와 전형을 하나 이상 선택하세요.');return;}
const query=$('caseGradeQuery').value.trim(),uni=$('caseUniversity').value.trim(),major=$('caseMajor').value.trim(),grade=Number($('caseGrade').value),range=Number($('caseRange').value),year=$('caseYear').value;if(mode==='grade'&&(!Number.isFinite(grade)||grade<1||grade>9||!Number.isFinite(range)||range<.1||range>2)){status('평균 1~9, 범위 ±0.1~2.0을 입력하세요.');return;}if(mode==='target'&&!uni&&!major){status('대학명이나 학과명 중 하나 이상 입력하세요.');return;}
const selected=data.filter(r=>schools.has(r._school)&&tracks.has(r._track)).filter(r=>{if(mode==='grade'){return r._start!==null&&r._start<=grade+range&&r._end>=grade-range&&(!query||(matchesUniversity(r['대학'],query)||String(r['학과']).toLowerCase().includes(query.toLowerCase())));}return (!year||String(r._year)===year)&&matchesUniversity(r['대학'],uni)&&(!major||String(r['학과']).toLowerCase().includes(major.toLowerCase()));});
const displayed=selected.slice(0,displayLimit),partial=mode==='grade'&&selected.some(r=>r._start<grade-range||r._end>grade+range);
status(`${sourceName||'불러온 CSV'} · 검색 ${selected.length}개 중 ${displayed.length}개 표시 · 공개 승인 여부는 파일 제공자가 확인해야 합니다.${partial?' 등급 집계구간은 검색범위와 일부만 겹칠 수 있습니다.':''}`);out.innerHTML=displayed.map(r=>makeCard(r,mode==='grade'&&(r._start<grade-range||r._end>grade+range))).join('')||'<div class="school-empty">해당 조건에서 표시할 집계가 없습니다. 실제 지원 사례가 없다는 뜻은 아닙니다.</div>';
if(more){more.hidden=selected.length<=displayLimit;more.textContent=`나머지 ${selected.length-displayed.length}개 결과 더 보기`;}}
function reset(){document.querySelectorAll('.case-school,.case-track').forEach(x=>x.checked=true);$('caseGrade').value='3.00';$('caseRange').value='0.5';['caseGradeQuery','caseUniversity','caseMajor'].forEach(id=>$(id).value='');$('caseYear').value='';displayLimit=100;render();}
async function decodeCSV(file){const bytes=await file.arrayBuffer();try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return new TextDecoder('euc-kr',{fatal:true}).decode(bytes);}}
async function loadCSV(e){const f=e.target.files?.[0];e.target.value='';if(!f)return;const id=++job;if(!/\.csv$/i.test(f.name)||f.size>1024*1024){status('CSV 파일(최대 1MB)을 선택하세요. 기존 자료를 유지합니다.');return;}try{const res=validateCSV(await decodeCSV(f));if(id!==job)return;if(!res.accepted.length)throw Error('사용 가능한 집계 행이 없습니다. '+res.issues.slice(0,3).join(' / '));data=res.accepted;sourceName=f.name;displayLimit=100;render();$('caseCsvInfo').textContent=`현재 자료: ${f.name} · ${res.accepted.length}행 불러옴 · 제외 ${res.issues.length}행. ${res.issues.slice(0,4).join(' / ')} · 구조 검사만 수행했으며 독립학생수·학교 승인·재식별 위험을 검증한 것은 아닙니다.`;}catch(err){if(id!==job)return;status('새 파일 읽기 실패 — 기존 집계 자료를 표시 중입니다. '+err.message);$('caseCsvInfo').textContent=`현재 자료: ${sourceName||'없음'} · 최근 파일 읽기 실패: ${err.message}`;}}
function setup(){if(!$('caseSearch'))return;$('caseModeGrade').onclick=()=>switchMode('grade');$('caseModeTarget').onclick=()=>switchMode('target');$('caseSearch').onclick=()=>{displayLimit=100;render()};$('caseReset').onclick=reset;$('caseCsv').addEventListener('change',loadCSV);$('caseImportGrade')?.addEventListener('click',importExploreGrade);$('caseGrade')?.addEventListener('input',()=>{const hint=$('caseImportedGrade');if(hint)hint.textContent='학교 사례 검색용 평균등급을 직접 수정했습니다.';});$('caseMore')?.addEventListener('click',()=>{displayLimit+=100;render()});document.querySelectorAll('.case-school,.case-track').forEach(x=>x.addEventListener('change',render));window.addEventListener('compass:schoolcases-open',()=>{const hint=$('caseImportedGrade');if(hint&&!hint.textContent)hint.textContent='대학 찾기 현재 등급을 가져오려면 아래 버튼을 누르세요.';render();});render();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
