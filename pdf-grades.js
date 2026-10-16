'use strict';
/* 학생부 PDF 보조 분석: 개인 정보는 브라우저에서만 처리한다. */
(()=>{
const $=id=>document.getElementById(id);
let records=[],serial=0,pdfLoading=null,reviewed=false,readSequence=0, sourceName='수동 입력', heldRows=[], loading=false;
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
 $('pdfAnalysis').hidden=false;updateReview();
}
function validRow(r){return r.include!==false&&allowedSemester(r.year,r.semester)&&String(r.subject).trim()!==''&&Number.isFinite(+r.credit)&&+r.credit>0&&+r.credit<=30&&Number.isInteger(+r.grade)&&+r.grade>=1&&+r.grade<=Number($('pdfGradeSystem')?.value||5)}
function add(r){records.push({id:++serial,year:r.year??1,semester:r.semester??1,subject:r.subject??'',group:r.group||classify(r.subject),credit:r.credit??0,grade:r.grade??'',include:r.include!==false,page:r.page||null})}
// PDF.js 텍스트 레이어의 x/y 위치를 사용한다. 표 제목의 열 순서와 본문을 확인하고, 확실하지 않은 행은 보류한다.
function norm(x){return String(x||'').replace(/\s+/g,'').toLowerCase()}
function groupText(items){const sorted=[...items].sort((a,b)=>a.x-b.x);let text='',previous=null;for(const c of sorted){if(previous&&c.x-(previous.x+previous.width)>4)text+=' ';text+=c.text;previous=c}return text.trim()}
function rowsByGeometry(content,page){const items=content.items.filter(x=>x.str?.trim()).map(x=>({text:x.str,x:x.transform[4],y:x.transform[5],width:x.width||x.str.length*5})).sort((a,b)=>b.y-a.y||a.x-b.x);const rows=[];for(const item of items){let row=rows.find(r=>Math.abs(r.y-item.y)<=2);if(!row){row={y:item.y,items:[],page};rows.push(row)}row.items.push(item)}return rows.sort((a,b)=>b.y-a.y)}
function findColumns(row){const items=[...row.items].sort((a,b)=>a.x-b.x);const names=[['semester',/(^학기$)/],['group',/(^교과$|^교과군$)/],['subject',/(^과목$|^과목명$)/],['credit',/(학점|단위수|이수단위)/],['grade',/(석차등급|^등급$)/],['note',/(^비고$)/]];const cols={};for(const item of items){const t=norm(item.text);for(const [key,regex] of names)if(!(key in cols)&&regex.test(t))cols[key]=item.x}return cols.subject!==undefined&&cols.credit!==undefined&&cols.grade!==undefined?cols:null}
function parsePdfGeometry(pages){let found=[],hold=[],year=null,sem=null,cols=null;
for(const {page,rows} of pages){for(const row of rows){const text=groupText(row.items),dense=norm(text);if(!dense)continue;
const ym=text.match(/\[?\s*([123])\s*학년\s*\]?/);if(ym){const ny=Number(ym[1]);if(year!==ny)sem=null;year=ny}
const head=findColumns(row);if(head){cols=head;continue}
if(/교과학습발달상황|세부능력및특기사항|창의적체험활동|독서활동상황/.test(dense)){if(!/교과학습발달상황/.test(dense))cols=null;continue}
if(!cols||year===null)continue;
const keys=Object.keys(cols).sort((a,b)=>cols[a]-cols[b]);const buckets={};for(const key of keys)buckets[key]=[];
for(const item of row.items){let key=keys[0];for(let i=0;i<keys.length;i++){const right= i+1<keys.length?(cols[keys[i]]+cols[keys[i+1]])/2:Infinity;if(item.x<right){key=keys[i];break}}buckets[key].push(item)}
const get=k=>groupText(buckets[k]||[]);const semText=get('semester');const current=semText.match(/^([12])$/)||text.match(/^(?:[123]\s*학년\s*)?([12])\s*학기/);if(current)sem=Number(current[1]);
if(!allowedSemester(year,sem))continue;
let subject=get('subject').replace(/^(?:\[?[123]학년\]?\s*)?(?:[12]학기\s*)?/,'').trim(),group=get('group'),creditText=get('credit'),gradeText=get('grade');
if(!subject||/과목명|합계|총계|평균/.test(subject))continue;
let credit=Number(creditText.replace(/\s/g,'')),grade=Number(gradeText.replace(/\s/g,''));
if(/^[가-힣A-Za-z]/.test(subject)&&Number.isFinite(credit)&&credit>0&&credit<=30&&Number.isInteger(grade)&&grade>=1&&grade<=Number($('pdfGradeSystem')?.value||5))found.push({year,semester:sem,subject,group:classify(subject,group),credit,grade,page});
else if(/[가-힣A-Za-z]/.test(subject))hold.push({page,text:`${year}학년 ${sem}학기 | ${group} | ${subject} | 학점 ${creditText||'미인식'} | 등급 ${gradeText||'미인식'}`});
}}
return {found,hold};}
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
 if(parsed.found.length){records=[];parsed.found.forEach(add);sourceName=file.name;markUnreviewed();draw();$('pdfState').textContent=`${file.name}에서 ${parsed.found.length}개 과목 후보를 추출했습니다. 보류 ${parsed.hold.length}건. 원본 전체와 대조하세요.`}
 else{$('pdfState').textContent=`새 PDF에서 확정 가능한 과목이 없습니다. 이전 자료(${previous})를 유지합니다. 보류 ${parsed.hold.length}건 확인 후 직접 입력하세요.`;draw()}
 }finally{try{await doc.destroy()}catch(e){}}
 }catch(e){if(sequence===readSequence){$('pdfState').textContent=`새 파일 분석 실패 — 이전 자료(${previous})를 표시 중입니다. `+(e.name==='PasswordException'?'암호를 해제한 PDF를 선택하세요.':e.message);draw()}}
 finally{if(sequence===readSequence){loading=false;renderHeld();updateReview()}}
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
 $('pdfClear').addEventListener('click',()=>{readSequence++;loading=false;sourceName='수동 입력';heldRows=[];renderHeld();records=[];markUnreviewed();draw();$('pdfState').textContent='분석 내용을 지웠습니다. 새 PDF를 올리거나 과목을 직접 추가할 수 있습니다.'});
 $('pdfPrint').addEventListener('click',()=>{if(!reviewed)return;document.body.classList.add('print-pdf-grade');try{window.print()}finally{setTimeout(()=>document.body.classList.remove('print-pdf-grade'),1000)}});
 window.addEventListener('afterprint',()=>document.body.classList.remove('print-pdf-grade'));
 $('pdfGradeSystem')?.addEventListener('change',()=>{markUnreviewed();draw()});$('pdfApply').addEventListener('click',()=>{if(!reviewed||loading)return;const group=$('pdfApplyGroup').value,rule=categoryRules.find(x=>x[0]===group);if(!rule)return;const a=gradeAvg(records.filter(r=>validRow(r)&&rule[1](r.group||classify(r.subject))));if(!a)return;const system=$('pdfGradeSystem').value;$('system').value=system;$('grade').max=system;$('grade').value=a.value.toFixed(2);document.querySelector('[data-tab=explore]').click();$('grade').dispatchEvent(new Event('input',{bubbles:true}));});
 $('pdfReviewed')?.addEventListener('change',e=>{reviewed=!!e.target.checked&&records.some(validRow);updateReview()});
 $('pdfRecordBody').addEventListener('input',e=>{const inp=e.target.closest('input[data-field],select[data-field]');if(!inp)return;const tr=inp.closest('tr'),r=records.find(x=>x.id===+tr.dataset.rid);if(!r)return;const k=inp.dataset.field;r[k]=k==='subject'||k==='group'?inp.value:k==='include'?inp.checked:(inp.value===''?'':Number(inp.value));if(k==='subject')r.group=classify(inp.value);markUnreviewed();const rowClass=validRow(r)?'':'invalid';tr.className=rowClass;drawSummaryOnly()});
 $('pdfRecordBody').addEventListener('change',e=>{if(e.target.matches('[data-field=include],[data-field=group]'))e.target.dispatchEvent(new Event('input',{bubbles:true}))});$('pdfRecordBody').addEventListener('click',e=>{const btn=e.target.closest('[data-remove]');if(!btn)return;records=records.filter(x=>x.id!==+btn.dataset.remove);markUnreviewed();draw()});
 renderHeld();draw();
}
function drawSummaryOnly(){
 const body=$('pdfSummaryBody');body.innerHTML=categoryRules.map(([name,pred])=>`<tr><th scope="row">${name}</th>${[null,...semesters].map(sem=>{let subset=records.filter(r=>validRow(r)&&pred(r.group||classify(r.subject))&&(!sem||(r.year===sem[0]&&r.semester===sem[1]))),a=gradeAvg(subset);return `<td title="${a?`${a.count}과목 · ${a.units}학점`:'자료 없음'}">${a?`<strong>${a.value.toFixed(2)}</strong><small class="pdf-unit">${a.count}과목 · ${a.units}학점</small>`:'—'}</td>`}).join('')}</tr>`).join('');const n=records.filter(validRow).length;$('pdfCount').textContent=`계산에 포함한 과목 ${n}개 / 총 ${records.length}개 · 확인이 필요한 행 ${records.length-n}개. (전체 평균은 3학년 1학기까지의 합산입니다.)`;updateReview();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
