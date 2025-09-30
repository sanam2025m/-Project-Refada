/* ===================== الإعدادات العامة ===================== */
const apiKey = "AIzaSyBYPUAnYE8GC4Vx32cDYSb8UH6YV-VWmEA";

/* ===================== جلب البيانات ===================== */
async function fetchSheetData(sheetId, range){
  try{
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.values && data.values.length ? data.values : [["لا توجد بيانات"]];
  }catch(e){
    return [["خطأ في الاتصال بالجدول"]];
  }
}

/* ===================== التاريخ ===================== */
function parseDateCell(v){
  const m=(v||'').match(/\d{4}[-\/]\d{2}[-\/]\d{2}|\d{2}[-\/]\d{2}[-\/]\d{4}/);
  return m ? new Date(m[0].replace(/-/g,'/')) : null;
}
function filterByDateRange(data, fromDateStr, toDateStr, colIndex=0){
  const f=new Date(fromDateStr), t=new Date(toDateStr);
  if(isNaN(f)||isNaN(t)) return data;
  return data.filter((row,idx)=>{
    if(idx===0) return true;
    const d=parseDateCell(row[colIndex]||"");
    return d && d>=f && d<=t;
  });
}

/* ===================== تطبيع/كشف الأعمدة ===================== */
function normalizeSite(s){
  if (s == null) return '';
  const arabicDigits = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
  const replaced = String(s).replace(/[٠-٩]/g, d => arabicDigits[d] || d);
  return replaced.trim().replace(/\s+/g,' ').toLowerCase();
}
function normalizeHeader(s){
  const arabicDigits = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
  let t = s.replace(/[٠-٩]/g, d => arabicDigits[d] || d);
  t = t.replace(/\s+|[_\-:/|]+/g,'').toLowerCase();
  return t;
}
function detectSiteColumn(headers){
  if (!headers || !headers.length) return -1;
  const norm = headers.map(h => normalizeHeader(String(h||'')));
  const keys = ['الموقع','اسمالموقع','site','location','sitename','locationname'];
  for (let i=0;i<norm.length;i++){
    if (keys.some(k => norm[i].includes(k))) return i;
  }
  return -1;
}
function findNameColumn(headers){
  const patterns = [/\bالاسم\b/i,/اسم الموظف/i,/الاسم الرباعي/i,'name','employee name'];
  for (let i=0;i<headers.length;i++){
    const h = String(headers[i]||'').trim();
    if (patterns.some(re => (re instanceof RegExp ? re.test(h) : h.toLowerCase().includes(re)))) return i;
  }
  return 1;
}

/* ===================== مواقع من الجدولين ===================== */
function uniqueSitesFrom(values, siteColIndex){
  if (!values || values.length < 2 || siteColIndex < 0) return [];
  const seen = new Map(); // norm -> display
  for (let r=1; r<values.length; r++){
    const row = values[r] || [];
    const disp = (row[siteColIndex] ?? '').toString().trim();
    if (!disp) continue;
    const norm = normalizeSite(disp);
    if (!seen.has(norm)) seen.set(norm, disp);
  }
  return Array.from(seen.values()).sort((a,b)=> a.localeCompare(b,'ar'));
}
function collectAllSites(values1, col1, values2, col2){
  const s1 = uniqueSitesFrom(values1, col1);
  const s2 = uniqueSitesFrom(values2, col2);
  const all = new Map();
  [...s1, ...s2].forEach(disp => {
    const norm = normalizeSite(disp);
    if (!all.has(norm)) all.set(norm, disp);
  });
  return Array.from(all.values()).sort((a,b)=> a.localeCompare(b,'ar'));
}
function populateSiteSelectFromData(values1, col1, values2, col2){
  const sel = document.getElementById('site');
  if (!sel) return;
  const previous = sel.value;
  const sites = collectAllSites(values1, col1, values2, col2);
  sel.innerHTML = '<option value="">الكل</option>' + sites.map(s => `<option value="${s}">${s}</option>`).join('');
  if (previous && sites.some(s => s === previous)) sel.value = previous; else sel.value = '';
}
function filterBySiteFixedColumn(data, siteName, colIndex){
  if (!siteName) return data;
  if (!data || !data.length || colIndex < 0) return data;
  const wanted = normalizeSite(siteName);
  return data.filter((row, r) => {
    if (r === 0) return true;
    const cell = normalizeSite(row[colIndex] ?? '');
    return cell === wanted;
  });
}

/* ===================== فلتر اسم الموظف (من الجدولين) ===================== */
function uniqueEmployeeNames(values){
  if (!values || values.length<2) return [];
  const headers = values[0];
  const nameIdx = findNameColumn(headers);
  const set = new Set();
  for (let r=1;r<values.length;r++){
    const name = String((values[r]||[])[nameIdx]||'').trim();
    if (name) set.add(name);
  }
  return Array.from(set);
}
function uniqueEmployeeNamesFromBoth(values1, values2){
  const n1 = uniqueEmployeeNames(values1);
  const n2 = uniqueEmployeeNames(values2);
  const all = new Set([...n1, ...n2]);
  return Array.from(all).sort((a,b)=> a.localeCompare(b,'ar'));
}
function populateEmployeeFilterBoth(values1, values2){
  const sel = document.getElementById('employeeFilter');
  if (!sel) return;
  const chosen = sel.value;
  const names = uniqueEmployeeNamesFromBoth(values1, values2);
  sel.innerHTML = '<option value="">الكل</option>' + names.map(n=>`<option value="${n}">${n}</option>`).join('');
  if (chosen && names.includes(chosen)) sel.value = chosen;
}
function filterByEmployeeName(values, selectedName){
  if (!selectedName) return values;
  if (!values || values.length<2) return values;
  const headers = values[0];
  const nameIdx = findNameColumn(headers);
  const result = [headers];
  for (let r=1;r<values.length;r++){
    const row = values[r]||[];
    if (String(row[nameIdx]||'').trim() === selectedName) result.push(row);
  }
  return result;
}

/* ===================== بناء الجداول ===================== */
function convertTimesInText(text){
  if (text == null) return text;
  let s = String(text);
  const hasAmPm = /\b(AM|PM|am|pm|ص|م)\b/.test(s);
  const re = /(\b[01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?/g;
  return s.replace(re, (full, hh, mm, ss) => {
    if (hasAmPm) return full;
    const h = parseInt(hh,10);
    const period = (h < 12) ? 'ص' : 'م';
    let h12 = h % 12; if (h12 === 0) h12 = 12;
    return `${h12}:${mm}${ss ? ':'+ss : ''} ${period}`;
  });
}
function buildTableHTML(values, className){
  if (!values || !values.length) return '<p>لا توجد بيانات</p>';
  const headers = values[0];
  const cls = className ? ` class="${className}"` : '';
  let h = `<table${cls}><thead><tr>` +
          headers.map(h => `<th>${h}</th>`).join('') +
          `</tr></thead><tbody>`;
  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];
    const rowPadded = Array.from({length: headers.length}, (_, j) => row[j] ?? '');
    h += '<tr>' + rowPadded.map((cell) => {
      let val = (cell == null || String(cell).trim() === '') ? '' : String(cell).trim();
      if (!val) return `<td>-</td>`;
      const shown = convertTimesInText(val);
      return `<td>${shown}</td>`;
    }).join('') + '</tr>';
  }
  h += '</tbody></table>';
  return h;
}

/* ===================== ترتيب حسب (التاريخ + الهوية) ===================== */
function detectIdColumn(headers){
  if (!headers || !headers.length) return -1;
  const normalized = headers.map(h => normalizeHeader(String(h||'')));
  const candidates = ['رقمالهوية','هوية','id','employeeid','badge','البطاقة','المعرف','رقمالموظف'];
  for (let i=0;i<normalized.length;i++){
    const h = normalized[i];
    if (candidates.some(c => h.includes(c))) return i;
  }
  return -1;
}
function groupSortByDateThenId(values, dateColIndex=0){
  if (!values || values.length<=2) return values;
  const headers = values[0];
  const rows = values.slice(1);
  const idColIndex = detectIdColumn(headers);
  if (idColIndex === -1) {
    rows.sort((a,b)=>{
      const da=parseDateCell(a[dateColIndex]||'');
      const db=parseDateCell(b[dateColIndex]||'');
      if (da && db) return da - db;
      if (da && !db) return -1;
      if (!da && db) return 1;
      return 0;
    });
    return [headers, ...rows];
  }
  rows.sort((a,b)=>{
    const da=parseDateCell(a[dateColIndex]||'');
    const db=parseDateCell(b[dateColIndex]||'');
    if (da && db && da - db !== 0) return da - db;
    if (da && !db) return -1;
    if (!da && db) return 1;
    const ia=(a[idColIndex]??'').toString();
    const ib=(b[idColIndex]??'').toString();
    return ia.localeCompare(ib,'ar',{numeric:true,sensitivity:'base'});
  });
  return [headers, ...rows];
}

/* ===================== تقسيم لصفحات A4 ===================== */
function mm2px(mm){ return mm * (96 / 25.4); }
function paginateValuesMeasured(allValues, title, extraBottomMm = 20){
  if (!allValues || !allValues.length) return [];
  const headers = allValues[0];
  const rows = allValues.slice(1);
  const chunks = [];
  let i = 0;
  let firstPage = true;
  while (i < rows.length) {
    const fit = measureRowsFit(headers, rows.slice(i), firstPage, title, extraBottomMm);
    const rowsThisPage = Math.max(1, fit);
    chunks.push([headers, ...rows.slice(i, i + rowsThisPage)]);
    i += rowsThisPage;
    firstPage = false;
  }
  return chunks;
}
function measureRowsFit(headers, candidateRows, includeTitle, title, extraBottomMm){
  const page = document.createElement('div');
  page.style.cssText = `position:absolute; left:-10000px; top:0; width:210mm; height:297mm; box-sizing:border-box; background:#fff; overflow:hidden; font-family:'Cairo', sans-serif;`;
  const pagePaddingStr = getComputedStyle(document.documentElement).getPropertyValue('--page-padding').trim() || '20mm';
  const padMm = parseFloat(pagePaddingStr) || 20;
  const padPx = mm2px(padMm);
  const extraPx = mm2px(extraBottomMm);

  const content = document.createElement('div');
  content.style.cssText = `box-sizing:border-box; width:100%; height:100%; padding:${padPx}px; padding-bottom:${padPx + extraPx}px;`;
  page.appendChild(content);

  if (includeTitle) {
    const h2 = document.createElement('h2');
    h2.style.cssText = `margin:8px 0; text-align:center; font-size:16px;`;
    h2.textContent = title || '';
    content.appendChild(h2);
  }

  const table = document.createElement('table');
  table.style.cssText = 'width:100%; border-collapse:collapse; table-layout:fixed;';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h ?? '';
    th.style.cssText = 'border:1px solid #ccc; padding:6px; font-size:12px; word-break:break-word; white-space:pre-wrap;';
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  content.appendChild(table);

  document.body.appendChild(page);
  const safeHeight = page.clientHeight;
  let fit = 0;
  for (let r = 0; r < candidateRows.length; r++) {
    const tr = document.createElement('tr');
    candidateRows[r].forEach(cell => {
      const td = document.createElement('td');
      td.textContent = (cell ?? '').toString();
      td.style.cssText = 'border:1px solid #ccc; padding:6px; font-size:12px; word-break:break-word; white-space:pre-wrap;';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
    if (page.scrollHeight > safeHeight) {
      tbody.removeChild(tr);
      break;
    } else {
      fit++;
    }
  }
  document.body.removeChild(page);
  return fit;
}

/* ===================== بناء صفحات الطباعة بخلفيات الصفحات 1/2/3 ===================== */
function buildPrintPages(values1, values2){
  const root=document.getElementById('printRoot');
  root.innerHTML='';

  const coverTextSaved=document.getElementById('coverText').value||'';

  // (1) الصفحة الأولى: cover-page1
  const cover=document.createElement('section');
  cover.className='print-page cover-page';
  const bg1 = document.createElement('img');
  bg1.className = 'page-bg';
  bg1.src = 'cover-page1.png';
  cover.appendChild(bg1);
  const cText=document.createElement('div');
  Object.assign(cText.style,{position:'absolute',bottom:'90px',left:'30px',color:'#fff',fontSize:'16px',fontWeight:'700',whiteSpace:'pre-wrap',width:'300px',zIndex:2});
  cText.textContent=coverTextSaved;
  cover.appendChild(cText);
  root.appendChild(cover);

  // (2) الصفحة الثانية: cover-page2
  const info=document.createElement('section');
  info.className='print-page second-page';
  const bg2 = document.createElement('img');
  bg2.className = 'page-bg';
  bg2.src = 'cover-page2.png';
  info.appendChild(bg2);
  info.innerHTML += `
    <div class="page-content">
      <div class="header">
         <img src="logo_sanam.png" alt="شعار سنام الأمن" />
         <img src="logo_rajhi.png" alt="شعار الراجحي" />
      </div>
      <h1>تقرير الحالة الأمنية</h1>
      <div style="font-size:14px;line-height:1.8">
        <p><strong>التاريخ:</strong> <span id="print_date"></span></p>
        <p><strong>الفترة:</strong> من <span id="print_from"></span> إلى <span id="print_to"></span></p>
        <p><strong>الموضوع:</strong> <span id="print_subject"></span></p>
        <p><strong>عدد الصفحات:</strong> <span id="print_pages"></span></p>
        <p><strong>اسم العميل:</strong> <span id="print_company"></span></p>
        <p><strong>الموقع:</strong> <span id="print_site"></span></p>
        <div id="print_letterBlock" style="margin-top:12px"></div>
      </div>
    </div>`;
  root.appendChild(info);

  // (3) صفحات الجداول
  appendPaginatedTableMeasured(root, values1, 'ملخص الحالات الأمنية', 21, 'cases-table', /*firstTableBackground=*/'cover-page3.png');
  appendPaginatedTableMeasured(root, values2, 'ملخص الحضور والانصراف', 21, 'attendance-table');
}

function appendPaginatedTableMeasured(root, values, title, extraBottomMm=20, className, firstTableBackground=null){
  const pages = paginateValuesMeasured(values, title, extraBottomMm);
  if (!pages.length) {
    const sec = document.createElement('section');
    sec.className = 'print-page table-page';
    if (firstTableBackground){
      const bg = document.createElement('img');
      bg.className = 'page-bg';
      bg.src = firstTableBackground;
      sec.appendChild(bg);
    }
    sec.innerHTML += `<div class="page-content"><h2>${title}</h2><p>لا توجد بيانات.</p></div>`;
    root.appendChild(sec);
    return;
  }
  pages.forEach((vals, idx) => {
    const sec = document.createElement('section');
    sec.className = 'print-page table-page';
    if (idx === 0 && firstTableBackground){
      const bg = document.createElement('img');
      bg.className = 'page-bg';
      bg.src = firstTableBackground;
      sec.appendChild(bg);
    }
    const tableHTML = buildTableHTML(vals, className);
    sec.innerHTML += `<div class="page-content">${idx === 0 ? ('<h2>' + title + '</h2>') : ''}${tableHTML}</div>`;
    root.appendChild(sec);
  });
}

/* ===================== مزامنة الحقول ===================== */
function syncPrintFields(){
  ['date','from','to','subject','pages','company','site'].forEach(id=>{
    const el=document.getElementById(id);
    const span=document.getElementById('print_'+id);
    if(el && span) span.textContent=el.value||'';
  });
  const out = document.getElementById('print_letterBlock');
  const bodyEl   = document.getElementById('letterBody');
  const thanksEl = document.getElementById('thanksLine');
  const footEl   = document.getElementById('footerBlock');
  if(!out) return;
  const fromVal=document.getElementById('from').value||'____';
  const toVal  =document.getElementById('to').value  ||'____';
  const bodyRaw = (bodyEl?.value || '')
    .replaceAll('{from}', fromVal)
    .replaceAll('{to}', toVal);
  const toParas = (txt, align, bold=false) => {
    return (txt || '')
      .split(/\r?\n/)
      .map(line=>{
        const t=line.trim();
        if(!t) return `<p dir="rtl">&nbsp;</p>`;
        const alignCss  = align ? `text-align:${align};` : '';
        const weightCss = bold ? 'font-weight:700;' : '';
        return `<p dir="rtl" style="${alignCss}${weightCss}">${t}</p>`;
      })
      .join('');
  };
  let html = '';
  html += toParas(bodyRaw, '');
  const thanks = (thanksEl?.value || '').trim();
  if(thanks){ html += `<p dir="rtl" style="text-align:center;">${thanks}</p>`; }
  const footer = footEl?.value || '';
  if(footer){ html += toParas(footer, 'left', true); }
  out.innerHTML = html;
}

/* ===================== طباعة آمنة (لا صفحات بيضاء) ===================== */
async function waitForAssets(){
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch(_) {} }
  const imgs = Array.from(document.querySelectorAll('.print-root img'));
  await Promise.all(imgs.map(img => (img.decode ? img.decode().catch(()=>{}) : Promise.resolve())));
  void document.body.offsetHeight;
}
async function printNow(){
  await waitForAssets();
  finalizePrintPages();
  updatePagesFieldFromDOM();
  syncPrintFields();
  void document.body.offsetHeight;
  window.print();
}

/* ===================== أدوات طباعة إضافية ===================== */
function updatePagesFieldFromDOM(){
  const root  = document.getElementById('printRoot');
  const field = document.getElementById('pages');
  const span  = document.getElementById('print_pages');
  if (!root || !field) return;
  const count = root.querySelectorAll('.print-page').length;
  field.value = count;
  if (span) span.textContent = count;
}
function finalizePrintPages(){
  const root = document.getElementById('printRoot');
  const pages = Array.from(root.querySelectorAll('.print-page'));
  if (pages.length) {
    const last = pages[pages.length - 1];
    last.style.breakAfter = 'auto';
    last.style.pageBreakAfter = 'auto';
  }
  pages.forEach(p => {
    const hasContent = p.classList.contains('cover-page') ||
                       p.classList.contains('second-page') ||
                       p.querySelector('table, img, h1, h2, p, .page-content *');
    if (!hasContent) p.remove();
  });
}
function tableToValues(table){
  const values=[];
  const headers=Array.from(table.tHead?.rows?.[0]?.cells||[]).map(th=>th.textContent.trim());
  if(headers.length) values.push(headers);
  const rows=Array.from(table.tBodies?.[0]?.rows||[]);
  rows.forEach(tr=>{ values.push(Array.from(tr.cells).map(td=>td.textContent)); });
  return values;
}

/* ===================== التحميل وإعادة البناء ===================== */
async function loadAndRender(){
  const fromDate=document.getElementById('from').value;
  const toDate  =document.getElementById('to').value;
  const siteSelEl = document.getElementById('site');

  const sheet1Raw=await fetchSheetData('1pQgSrwy-73f1zylllGf-gvPdO8f7JbkqVfyFzaGmIf8','Sheet1!A2:K'); // الحالات
  const sheet2Raw=await fetchSheetData('1cbygyFa5toibkfnEeMo77moHKiZHDfp3FC8ElURt8fg','البيانات!A2:L'); // الحضور

  // فلترة التاريخ
  const dated1=(fromDate&&toDate)?filterByDateRange(sheet1Raw,fromDate,toDate,0):sheet1Raw;
  const dated2=(fromDate&&toDate)?filterByDateRange(sheet2Raw,fromDate,toDate,0):sheet2Raw;

  // اكتشاف عمود الموقع تلقائيًا
  const siteCol1 = detectSiteColumn(dated1[0] || []);
  const siteCol2 = detectSiteColumn(dated2[0] || []);

  // تحديث قائمة المواقع من الجدولين
  populateSiteSelectFromData(dated1, siteCol1, dated2, siteCol2);

  // القيمة المختارة بعد التحديث
  const siteSel = siteSelEl?.value || '';

  // فلترة حسب الموقع على الجدولين
  const bySite1 = filterBySiteFixedColumn(dated1, siteSel, siteCol1);
  const bySite2 = filterBySiteFixedColumn(dated2, siteSel, siteCol2);

  // أسماء الموظفين من الجدولين (بعد فلترة الموقع)
  populateEmployeeFilterBoth(bySite1, bySite2);
  const employeeName = document.getElementById('employeeFilter')?.value || '';
  const byEmp1  = filterByEmployeeName(bySite1, employeeName);
  const byEmp2  = filterByEmployeeName(bySite2, employeeName);

  // التجميع/الترتيب
  const grouped1 = groupSortByDateThenId(byEmp1, 0);
  const grouped2 = groupSortByDateThenId(byEmp2, 0);

  // المعاينات
  document.getElementById('securityCasesPreview').innerHTML = buildTableHTML(grouped1, 'cases-table');
  document.getElementById('attendanceRecordsPreview').innerHTML = buildTableHTML(grouped2, 'attendance-table');

  // بناء صفحات الطباعة (مسبقة)
  buildPrintPages(grouped1,grouped2);
  updatePagesFieldFromDOM();
  syncPrintFields();
}

/* ===================== التهيئة ===================== */
window.addEventListener('load', ()=>{
  const fields=["date","from","to","subject","pages","company","site","coverText","letterBody","thanksLine","footerBlock"];
  fields.forEach(id=>{
    const el=document.getElementById(id);
    const saved=localStorage.getItem('report_'+id);
    if(saved && el) el.value=saved;
    if(el){
      el.addEventListener('input', ()=>{
        localStorage.setItem('report_'+id, el.value);
        updateDocumentTitleWithDateRange();
        syncPrintFields();
      });
      if(id==='from' || id==='to'){
        el.addEventListener('change', ()=>{
          loadAndRender();
          updateDocumentTitleWithDateRange();
        });
      }
    }
  });

  const siteSel = document.getElementById('site');
  if (siteSel){
    siteSel.addEventListener('change', ()=>{
      loadAndRender();
      syncPrintFields();
    });
  }

  // إعادة العرض عند تغيير اختيار اسم الموظف
  document.addEventListener('change', (e)=>{
    if (e.target && e.target.id === 'employeeFilter'){
      try { loadAndRender(); } catch(_) {}
    }
  });

  // أول تحميل
  loadAndRender();
  syncPrintFields();
  updateDocumentTitleWithDateRange();
});

function updateDocumentTitleWithDateRange(){
  const f=document.getElementById('from').value;
  const t=document.getElementById('to').value;
  const s=document.getElementById('subject').value||'تقرير أمني';
  document.title=(f&&t)?`${s} - من ${f} إلى ${t}`:s;
}

/* ===================== زر الطباعة ===================== */
document.getElementById('printBtn')?.addEventListener('click', ()=>{ printNow(); });
