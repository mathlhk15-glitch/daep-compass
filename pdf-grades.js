'use strict';
/* 학생부 PDF 보조 분석: 개인 정보는 브라우저에서만 처리한다. */
(()=>{
const $=id=>document.getElementById(id);
let records=[],serial=0,pdfLoading=null,reviewed=false,readSequence=0, sourceName='수동 입력', heldRows=[], loading=false;
let automaticGradeValue=null, userOverrodeAutoGrade=false, lastAutoApplied=null;
function signalManualOverride(){userOverrodeAutoGrade=true;const hint=$('pdfAutoGradeHint');if(hint&&lastAutoApplied!==null)hint.textContent='대학 찾기에서 직접 수정한 등급을 유지합니다. PDF 평균을 다시 사용하려면 아래 「검토한 평균으로 대학 찾기」를 누르세요.';}
const gradeField=$('grade');if(gradeField){gradeField.addEventListener('input',event=>{if(event.isTrusted)signalManualOverride()});}const systemField=$('system');if(systemField){systemField.addEventListener('change',event=>{if(event.isTrusted)signalManualOverride()});}
function syncWholeAverage(){
 const hint=$('pdfAutoGradeHint');
 const a=gradeAvg(records.filter(validRow));const system=$('pdfGradeSystem')?.value;
 if(!a||loading||!records.length){if(hint)hint.textContent='PDF에서 전과목 전체 평균이 계산되면 대학 찾기에 자동 입력됩니다. 원본 대조 전에는 잠정값입니다.';return;}
 if(system!=='5'){if(hint)hint.textContent='현재 학생부는 9등급제입니다. 5등급제 입력칸에 다른 척도의 값을 자동 입력하지 않습니다. 검토 후 적용 버튼을 이용하세요.';return;}
 const value=a.value.toFixed(2);automaticGradeValue=value;
 if(userOverrodeAutoGrade){if(hint)hint.textContent='전과목 전체 평균 '+value+'등급 · 대학 찾기의 직접 수정한 입력값을 유지하고 있습니다.';return;}
 if($('system').value!=='5')$('system').value='5';
 if($('grade').value!==value||lastAutoApplied===null){$('grade').value=value;$('grade').max=5;lastAutoApplied=value;$('system').dispatchEvent(new Event('change',{bubbles:true}));$('grade').dispatchEvent(new Event('input',{bubbles:true}));}
 const source=$('autoGradeSource');if(source){source.hidden=false;source.textContent='학생부 전과목 전체 평균 '+value+'등급이 자동 입력되었습니다'+(reviewed?' (원본 대조 완료)':' (원본 대조 전 · 잠정값)')+'. 이 숫자는 직접 변경할 수 있습니다.';}
 if(hint)hint.textContent='전과목 전체 평균 '+value+'등급 → 대학 찾기에 자동 입력됨'+(reviewed?' (원본 대조 완료)':' (원본 대조 전 · 잠정값)')+'. 대학 찾기에서 직접 수정한 값은 자동으로 덮어쓰지 않습니다.';
}

function markUnreviewed(){reviewed=false;const c=$('pdfReviewed');if(c)c.checked=false;updateReview();}
function updateReview(){const n=records.filter(validRow).length;const c=$('pdfReviewed');const st=$('pdfReviewState');if(c)c.disabled=!n;if(st)st.textContent=n?(reviewed?'✓ 교사가 추출·수정 내용을 원본과 대조했습니다.':'검토 전 · 원본 PDF의 모든 과목과 학점·등급을 대조해야 합니다.'):'계산에 포함할 과목이 없습니다.';const pr=$('pdfPrint');if(pr)pr.disabled=!reviewed||!n||loading;const apply=$('pdfApply');if(apply)apply.disabled=!reviewed||!n||loading;const source=$('pdfSource');if(source)source.textContent=`현재 원본: ${sourceName} · ${reviewed?'원본 대조 완료':'검토 전'}${loading?' · 새 PDF 분석 중':''}`;const meta=$('pdfPrintMeta');if(meta)meta.textContent=`원본: ${sourceName} · ${$('pdfGradeSystem').value}등급제 · 1-1~3-1 (3-2 제외) · ${reviewed?'원본 대조 완료':'미검토 참고자료'} · 반영 ${n}과목`; }

const allowedSemester=(y,sem)=>semesters.some(([a,b])=>a===Number(y)&&b===Number(sem));
const semesters=[[1,1],[1,2],[2,1],[2,2],[3,1]];
const categoryRules=[
 ['전과목',()=>true],
 ['국영수',s=>['국어','영어','수학'].includes(s)],
 ['국영수사과',s=>['국어','영어','수학','사회','과학'].includes(s)],
 ['국영수사',s=>['국어','영어','수학','사회'].includes(s)],
 ['국영수과',s=>['국어','영어','수학','과학'].includes(s)]
];
const classify=(s,group='')=>{
 const explicit=String(group||'').replace(/\s/g,'');
 if(/^국어/.test(explicit))return '국어';if(/^영어/.test(explicit))return '영어';if(/^수학/.test(explicit))return '수학';if(/^사회|역사|도덕/.test(explicit))return '사회';if(/^과학/.test(explicit))return '과학';
 const x=String(s||'').replace(/^\s*(?:[123]\s*학년\s*)?(?:[12]\s*학기\s*)?/,'').replace(/\s+/g,'').toLowerCase();
 if(/중국어|일본어|프랑스어|독일어|스페인어|러시아어|아랍어|베트남어|한문/.test(x))return '기타';
 if(/영어|영미|english/.test(x))return '영어';
 if(/국어|문학|독서|화법|작문|언어와매체|매체의사소통|언어생활탐구/.test(x))return '국어';
 if(/수학|대수|미적분|기하|확률|통계/.test(x))return '수학';
 if(/물리|화학|생명과학|지구과학|통합과학|융합과학|과학탐구|과학실험|^과학|역학과에너지|전자기와양자|물질과에너지|세포와물질대사|생물의유전/.test(x))return '과학';
 if(/통합사회|한국사|세계사|동아시아사|경제|정치|법과사회|사회|지리|윤리|역사|사회문제|시민윤리|문화와사회|도시의미래|국제관계|기후변화와지속가능/.test(x))return '사회';
 return '기타';
};
const esc=x=>String(x??'').replace(/[&<>"']/g,a=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[a]));
function gradeAvg(rows){const maxGrade=Number($('pdfGradeSystem')?.value||5);const valid=rows.filter(r=>allowedSemester(r.year,r.semester)&&r.credit>0&&r.credit<=30&&r.include!==false&&r.grade>=1&&r.grade<=maxGrade);const weight=valid.reduce((s,r)=>s+r.credit,0);return weight?{value:valid.reduce((s,r)=>s+r.credit*r.grade,0)/weight,units:weight,count:valid.length}:null}
function draw(){
 const body=$('pdfRecordBody'),summary=$('pdfSummaryBody');if(!body||!summary)return;
 body.innerHTML=records.map(r=>`<tr data-rid="${r.id}" class="${(!validRow(r))?'invalid':''}"><td><input aria-label="학년" type="number" min="1" max="3" step="1" data-field="year" value="${esc(r.year)}"></td><td><input aria-label="학기" type="number" min="1" max="2" step="1" data-field="semester" value="${esc(r.semester)}"></td><td><input aria-label="과목명" data-field="subject" value="${esc(r.subject)}"></td><td><select aria-label="교과군" data-field="group">${['국어','영어','수학','사회','과학','기타'].map(g=>`<option value="${g}" ${r.group===g?'selected':''}>${g}</option>`).join('')}</select></td><td><input aria-label="학점" type="number" min="0" max="30" step="0.5" data-field="credit" value="${esc(r.credit)}"></td><td><input aria-label="석차등급" type="number" min="1" max="${$('pdfGradeSystem')?.value||5}" step="1" data-field="grade" value="${esc(r.grade)}"></td><td><input type="checkbox" aria-label="평균에 반영" data-field="include" ${r.include!==false?'checked':''}></td><td>${r.page?`PDF ${r.page}쪽`:'직접 입력'}</td><td><button type="button" data-remove="${r.id}" aria-label="행 삭제">삭제</button></td></tr>`).join('');
 let cells=0;
 summary.innerHTML=categoryRules.map(([name,pred])=>{
   const fields=[null,...semesters];
   return `<tr><th scope="row">${name}</th>${fields.map(sem=>{const matched=records.filter(r=>validRow(r)&&pred(r.group||classify(r.subject))&&(!sem||(r.year===sem[0]&&r.semester===sem[1])));const a=gradeAvg(matched);if(a)cells++;return `<td title="${a?`${a.count}과목 · ${a.units}학점`:'계산 가능한 석차등급 없음'}">${a?`<strong>${a.value.toFixed(2)}</strong><small class="pdf-unit">${a.count}과목 · ${a.units}학점</small>`:'—'}</td>`}).join('')}</tr>`;
 }).join('');
 const n=records.filter(validRow).length,invalid=records.length-n;
 $('pdfCount').textContent=`계산에 포함한 과목 ${n}개 / 총 ${records.length}개 · 확인이 필요한 행 ${invalid}개 · 등급이 없는 칸은 — 로 표시했습니다. (전체 평균은 3학년 1학기까지의 합산입니다.)`;
 $('pdfAnalysis').hidden=false;updateReview();syncWholeAverage();
}
function validRow(r){return r.include!==false&&allowedSemester(r.year,r.semester)&&String(r.subject).trim()!==''&&Number.isFinite(+r.credit)&&+r.credit>0&&+r.credit<=30&&Number.isInteger(+r.grade)&&+r.grade>=1&&+r.grade<=Number($('pdfGradeSystem')?.value||5)}
function add(r){records.push({id:++serial,year:r.year??1,semester:r.semester??1,subject:r.subject??'',group:r.group||classify(r.subject),credit:r.credit??0,grade:r.grade??'',include:r.include!==false,page:r.page||null})}
// PDF.js 텍스트 레이어의 x/y 위치를 사용한다. 표 제목의 열 순서와 본문을 확인하고, 확실하지 않은 행은 보류한다.
function norm(x){return String(x||'').replace(/\s+/g,'').toLowerCase()}
function groupText(items){const sorted=[...items].sort((a,b)=>a.x-b.x);let text='',previous=null;for(const c of sorted){if(previous&&c.x-(previous.x+previous.width)>4)text+=' ';text+=c.text;previous=c}return text.trim()}
function rowsByGeometry(content,page){const items=content.items.filter(x=>x.str?.trim()).map(x=>({text:x.str,x:x.transform[4],y:x.transform[5],width:x.width||x.str.length*5})).sort((a,b)=>b.y-a.y||a.x-b.x);const rows=[];for(const item of items){let row=rows.find(r=>Math.abs(r.y-item.y)<=2);if(!row){row={y:item.y,items:[],page};rows.push(row)}row.items.push(item)}return rows.sort((a,b)=>b.y-a.y)}
function findColumns(rows,index){
 const row=rows[index];const text=norm(groupText(row.items));
 if(!text.includes('학기')||!text.includes('교과')||!text.includes('과목')||!text.includes('학점'))return null;
 const near=rows.filter(r=>Math.abs(r.y-row.y)<=11);
 const specs=[['semester',/^학기$/],['group',/^교과$/],['subject',/^과목$/],['credit',/^학점$/],['average',/^(원점수|과목평균)/],['achievement',/^성취도$/],['distribution',/^성취도별/],['grade',/^(석차|석차등급)$/],['enrollment',/^수강/],['note',/^비고$/]];
 const columns={};for(const r of near)for(const item of r.items){const t=norm(item.text);for(const [key,pat] of specs)if(columns[key]===undefined&&pat.test(t))columns[key]=item.x}
 return ['semester','group','subject','credit','average','grade'].every(k=>Number.isFinite(columns[k]))?columns:null;
}
function parsePdfGeometry(pages){
 const found=[],hold=[];let year=null,semester=null,columns=null,tableType='';
 for(const {page,rows} of pages){
  const markers=[];
  for(let i=0;i<rows.length;i++){
   const row=rows[i],line=groupText(row.items),dense=norm(line);
   const m=dense.match(/\[([123])학년\]/);if(m){year=Number(m[1]);semester=null;columns=null;tableType='';}
   if(/<체육|<교양|세부능력및특기사항|독서활동상황|행동특성및종합의견/.test(dense)){columns=null;tableType='';}
   const head=findColumns(rows,i);
   if(head){columns=head;tableType='graded';}
   // 학기 숫자는 병합된 셀 중앙에 나타나므로 과목 행보다 위/아래에 있을 수 있다.
   if(columns&&tableType==='graded')for(const item of row.items){
    if(/^\s*[12]\s*$/.test(item.text)&&item.x>=columns.semester-12&&item.x<columns.group-18)
      markers.push({y:row.y,semester:Number(item.text.trim())});
   }
  }
  // 이전 페이지에서 교과 성적표가 이어진 경우 머리글이 없어도 유지한다.
  // 페이지 전체를 다시 읽어 학년/표종류를 순서대로 결정한다.
  let localYear=null,activeColumns=null,active=false;
  for(let i=0;i<rows.length;i++){
   const row=rows[i],dense=norm(groupText(row.items));
   const m=dense.match(/\[([123])학년\]/);if(m){year=Number(m[1]);semester=null;active=false;activeColumns=null;}
   if(/<체육|<교양|세부능력및특기사항|독서활동상황|행동특성및종합의견/.test(dense)){active=false;activeColumns=null;}
   const head=findColumns(rows,i);if(head){activeColumns=head;active=true;continue;}
   if(!active||!activeColumns||year===null)continue;
   const col=activeColumns;
   const sorted=Object.entries(col).sort((a,b)=>a[1]-b[1]);
   const boundaries=sorted.map((e,j)=>j+1<sorted.length?(e[1]+sorted[j+1][1])/2:Infinity);
   const buckets={};for(const [key] of sorted)buckets[key]=[];
   for(const item of row.items){const index=boundaries.findIndex(right=>item.x<right);buckets[sorted[index<0?sorted.length-1:index][0]].push(item)}
   const get=(k)=>groupText(buckets[k]||[]);
   const ct=get('credit').replace(/\s/g,''),gt=get('grade').replace(/\s/g,'');
   if(!/^\d+(?:\.\d+)?$/.test(ct)||!/^\d+$/.test(gt))continue;
   const credit=Number(ct),grade=Number(gt);
   // 과목 셀의 글자가 두 줄로 나뉜 경우, 같은 x열의 인접 글자를 결합한다.
   const subjectItems=[];const groupItems=[];
   for(const neighbor of rows){if(Math.abs(neighbor.y-row.y)>9)continue;
    for(const item of neighbor.items){if(item.x>=boundaries[1]&&item.x<boundaries[2])subjectItems.push(item);
     else if(item.x>=boundaries[0]&&item.x<boundaries[1])groupItems.push(item)}
   }
   subjectItems.sort((a,b)=>b.y-a.y||a.x-b.x);
   const subject=subjectItems.map(o=>o.text.trim()).join('').replace(/\s+/g,' ').trim();
   const group=groupItems.sort((a,b)=>b.y-a.y||a.x-b.x).map(o=>o.text.trim()).join('');
   const nearest=markers.filter(x=>Math.abs(x.y-row.y)<250).sort((a,b)=>Math.abs(a.y-row.y)-Math.abs(b.y-row.y))[0];
   if(nearest)semester=nearest.semester;
   if(!subject||!/[가-힣A-Za-z]/.test(subject)||/합계|평균|과목명/.test(subject))continue;
   if(allowedSemester(year,semester)&&credit>0&&credit<=30&&grade>=1&&grade<=Number($('pdfGradeSystem')?.value||5)){
    const unique=year+'-'+semester+'-'+page+'-'+row.y.toFixed(1);
    if(!found.some(r=>r._key===unique))found.push({year,semester,subject,group:classify(subject,group),credit,grade,page,_key:unique});
   }else hold.push({page,text:`${year||'?'}학년 ${semester||'?'}학기 | ${group} | ${subject} | ${credit}학점 | ${grade}등급`});
  }
 }
 found.forEach(r=>delete r._key);return {found,hold};
}
// x좌표를 사용할 수 없는 표 텍스트: 추측하여 확정하지 않고 모두 검토 대상으로 남긴다.
function parsePdfText(lines){const hold=lines.filter(x=>/[가-힣]/.test(x)&&/\d/.test(x)).slice(0,500).map((text)=>({page:'?',text}));return {found:[],hold};}
async function pdfJS(){
 if(window.pdfjsLib)return window.pdfjsLib;
 if(pdfLoading)return pdfLoading;
 // PDF.js 4.x 모듈 릴리스: 취약한 3.11.174를 사용하지 않는다.
 pdfLoading=import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs').then(lib=>{
 lib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';return lib;
 }).catch(e=>{pdfLoading=null;throw Error('PDF 분석 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인하거나 수동 입력하세요. '+e.message)});return pdfLoading;
}
async function readPdf(file){
 const sequence=++readSequence;markUnreviewed();loading=true;updateReview();
 const previous=sourceName;
 try{
 if(!file||!/\.pdf$/i.test(file.name))throw Error('PDF 파일을 선택해 주세요.');
 if(file.size>35*1024*1024)throw Error('35MB 이하의 PDF 파일을 선택해 주세요.');
 $('pdfState').textContent='PDF 분석 중 · 기존 자료 유지 · 검토 상태 해제';
 const lib=await pdfJS();if(sequence!==readSequence)return;
 const buff=await file.arrayBuffer();if(sequence!==readSequence)return;
 const task=lib.getDocument({data:new Uint8Array(buff),isEvalSupported:false});const doc=await task.promise;
 try{
 if(doc.numPages>90)throw Error('페이지가 너무 많습니다. 학생부 PDF만 올려 주세요.');
 const pages=[];for(let i=1;i<=doc.numPages;i++){if(sequence!==readSequence)return;$('pdfState').textContent=`PDF ${i}/${doc.numPages}쪽 분석 중…`;const pg=await doc.getPage(i);const content=await pg.getTextContent();pages.push({page:i,rows:rowsByGeometry(content,i)})}
 if(sequence!==readSequence)return;
 const parsed=parsePdfGeometry(pages);heldRows=parsed.hold;
 if(parsed.found.length){userOverrodeAutoGrade=false;lastAutoApplied=null;records=[];parsed.found.forEach(add);sourceName=file.name;markUnreviewed();draw();$('pdfState').textContent=`${file.name}에서 ${parsed.found.length}개 과목 후보를 추출했습니다. 보류 ${parsed.hold.length}건. 원본 전체와 대조하세요.`}
 else{$('pdfState').textContent=`새 PDF에서 확정 가능한 과목이 없습니다. 이전 자료(${previous})를 유지합니다. 보류 ${parsed.hold.length}건 확인 후 직접 입력하세요.`;draw()}
 }finally{try{await doc.destroy()}catch(e){}}
 }catch(e){if(sequence===readSequence){$('pdfState').textContent=`새 파일 분석 실패 — 이전 자료(${previous})를 표시 중입니다. `+(e.name==='PasswordException'?'암호를 해제한 PDF를 선택하세요.':e.message);draw()}}
 finally{if(sequence===readSequence){loading=false;renderHeld();updateReview();syncWholeAverage()}}
}
function renderHeld(){const panel=$('pdfHoldRows');if(!panel)return;$('pdfHoldCount').textContent=heldRows.length;panel.innerHTML=heldRows.length?heldRows.slice(0,400).map(x=>`<div>PDF ${esc(x.page)}쪽 · ${esc(x.text)}</div>`).join(''):'자동 인식 보류 행은 없습니다. 이 목록에 없더라도 원본에서 빠진 과목이 있을 수 있습니다.'}
function init(){if(!$('pdfDrop'))return;
 const input=$('pdfInput'),drop=$('pdfDrop');$('pdfStartManual').addEventListener('click',()=>{if(!records.length)add({subject:'',year:1,semester:1,credit:0,grade:''});sourceName='수동 입력';markUnreviewed();draw();$('pdfRecordBody').querySelector('input[data-field=subject]')?.focus()});
 $('pdfPick').addEventListener('click',e=>{e.stopPropagation();input.click()});
 drop.addEventListener('click',e=>{if(e.target.id!=='pdfPick')input.click()});
 drop.addEventListener('keydown',e=>{if(e.target===drop&&(e.key==='Enter'||e.key===' ')){e.preventDefault();input.click()}});
 input.addEventListener('change',()=>{if(input.files[0])readPdf(input.files[0]);input.value=''});
 for(const ev of ['dragenter','dragover'])drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('dragover')});
 for(const ev of ['dragleave','drop'])drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('dragover')});
 drop.addEventListener('drop',e=>{const f=e.dataTransfer?.files?.[0];if(f)readPdf(f)});
 $('pdfAdd').addEventListener('click',()=>{add({year:1,semester:1,subject:'',credit:0,grade:''});markUnreviewed();draw()});
 $('pdfClear').addEventListener('click',()=>{readSequence++;loading=false;sourceName='수동 입력';heldRows=[];renderHeld();records=[];automaticGradeValue=null;lastAutoApplied=null;userOverrodeAutoGrade=false;const source=$('autoGradeSource');if(source){source.hidden=true;source.textContent='';}markUnreviewed();draw();$('pdfState').textContent='분석 내용을 지웠습니다. 새 PDF를 올리거나 과목을 직접 추가할 수 있습니다.'});
 $('pdfPrint').addEventListener('click',()=>{if(!reviewed)return;document.body.classList.add('print-pdf-grade');try{window.print()}finally{setTimeout(()=>document.body.classList.remove('print-pdf-grade'),1000)}});
 window.addEventListener('afterprint',()=>document.body.classList.remove('print-pdf-grade'));
 $('pdfGradeSystem')?.addEventListener('change',()=>{markUnreviewed();draw()});$('pdfApply').addEventListener('click',()=>{if(!reviewed||loading)return;const group=$('pdfApplyGroup').value,rule=categoryRules.find(x=>x[0]===group);if(!rule)return;const a=gradeAvg(records.filter(r=>validRow(r)&&rule[1](r.group||classify(r.subject))));if(!a)return;const system=$('pdfGradeSystem').value;$('system').value=system;$('grade').max=system;$('grade').value=a.value.toFixed(2);userOverrodeAutoGrade=false;lastAutoApplied=a.value.toFixed(2);document.querySelector('[data-tab=explore]').click();$('grade').dispatchEvent(new Event('input',{bubbles:true}));});
 $('pdfReviewed')?.addEventListener('change',e=>{reviewed=!!e.target.checked&&records.some(validRow);updateReview();syncWholeAverage()});
 $('pdfRecordBody').addEventListener('input',e=>{const inp=e.target.closest('input[data-field],select[data-field]');if(!inp)return;const tr=inp.closest('tr'),r=records.find(x=>x.id===+tr.dataset.rid);if(!r)return;const k=inp.dataset.field;r[k]=k==='subject'||k==='group'?inp.value:k==='include'?inp.checked:(inp.value===''?'':Number(inp.value));if(k==='subject')r.group=classify(inp.value);markUnreviewed();const rowClass=validRow(r)?'':'invalid';tr.className=rowClass;drawSummaryOnly()});
 $('pdfRecordBody').addEventListener('change',e=>{if(e.target.matches('[data-field=include],[data-field=group]'))e.target.dispatchEvent(new Event('input',{bubbles:true}))});$('pdfRecordBody').addEventListener('click',e=>{const btn=e.target.closest('[data-remove]');if(!btn)return;records=records.filter(x=>x.id!==+btn.dataset.remove);markUnreviewed();draw()});
 renderHeld();draw();
}
function drawSummaryOnly(){
 const body=$('pdfSummaryBody');body.innerHTML=categoryRules.map(([name,pred])=>`<tr><th scope="row">${name}</th>${[null,...semesters].map(sem=>{let subset=records.filter(r=>validRow(r)&&pred(r.group||classify(r.subject))&&(!sem||(r.year===sem[0]&&r.semester===sem[1]))),a=gradeAvg(subset);return `<td title="${a?`${a.count}과목 · ${a.units}학점`:'자료 없음'}">${a?`<strong>${a.value.toFixed(2)}</strong><small class="pdf-unit">${a.count}과목 · ${a.units}학점</small>`:'—'}</td>`}).join('')}</tr>`).join('');const n=records.filter(validRow).length;$('pdfCount').textContent=`계산에 포함한 과목 ${n}개 / 총 ${records.length}개 · 확인이 필요한 행 ${records.length-n}개. (전체 평균은 3학년 1학기까지의 합산입니다.)`;updateReview();syncWholeAverage();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
