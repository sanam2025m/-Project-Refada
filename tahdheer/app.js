// ===== app.js (FINAL, with checkout-guard modal applied to checkout & early checkout) =====
const $ = (s) => document.querySelector(s);
const byId = (id) => document.getElementById(id);
const fields = {
  location: byId('location'),
  shift: byId('shift'),
  workType: byId('workType'),
  fullName: byId('fullName'),
  nationalId: byId('nationalId'),
  phone: byId('phone')
};
const msgs = {
  location: byId('location-msg'),
  shift: byId('shift-msg'),
  fullName: byId('fullName-msg'),
  nationalId: byId('nationalId-msg'),
  phone: byId('phone-msg')
};

const btnCheckIn = byId('btnCheckIn');
const btnCheckOut = byId('btnCheckOut');
const btnEarlyCheckout = byId('btnEarlyCheckout');
const btnEarlyConfirm = byId('btnEarlyConfirm');
const btnEarlyCancel = byId('btnEarlyCancel');

const CONFIG = window.SANAM_CONFIG || {};
const WEB_APP_URL = CONFIG.WEB_APP_URL || "https://script.google.com/macros/s/AKfycbzhFgwoIRIu5D6gybBuneQoxIsQFsaF7GFRihpZZUZSPTnrUo1zl0FosQgbOgDHkAMqBw/exec";
const BYPASS_FOR_LOCAL_FILE = (window.location.protocol === 'file:');

// Helpers
function setMsg(el, msg, type = 'error') {
  if (!el) return;
  el.textContent = msg || '';
  el.className = 'msg' + (msg ? ' ' + type : '');
}
function markValid(i, ok) {
  i.classList.remove('invalid', 'valid');
  i.classList.add(ok ? 'valid' : 'invalid');
}
function onlyDigits(s) {
  return (s || '').replace(/\D+/g, '');
}
function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function setBusy(el, busy=true) {
  if (!el) return;
  el.disabled = !!busy;
  el.classList.toggle('is-busy', !!busy);
}

/* === حضور محلي === */
const CHECKIN_FLAG_KEY = 'sanam_checked_in';
function isCheckedIn() { try { return localStorage.getItem(CHECKIN_FLAG_KEY) === 'true'; } catch { return false; } }
function markCheckedIn() { try { localStorage.setItem(CHECKIN_FLAG_KEY, 'true'); } catch {} }
function markCheckedOut() { try { localStorage.setItem(CHECKIN_FLAG_KEY, 'false'); } catch {} }

/* === نافذة عدم وجود حضور === */
const noCheckinBackdrop = byId('noCheckinBackdrop');
const noCheckinClose    = byId('noCheckinClose');
const noCheckinMsg      = byId('noCheckinMsg');
function showNoCheckinModal(msg = 'لم يمكن إكمال العملية لعدم تسجيلك الحضور.') {
  if (noCheckinMsg) noCheckinMsg.textContent = msg;
  if (noCheckinBackdrop) {
    noCheckinBackdrop.style.display = 'flex';
    noCheckinBackdrop.setAttribute('aria-hidden', 'false');
  }
}
function hideNoCheckinModal() {
  if (noCheckinBackdrop) {
    noCheckinBackdrop.style.display = 'none';
    noCheckinBackdrop.setAttribute('aria-hidden', 'true');
  }
}
if (noCheckinClose) noCheckinClose.addEventListener('click', hideNoCheckinModal);
if (noCheckinBackdrop) {
  noCheckinBackdrop.addEventListener('click', (e) => { if (e.target === noCheckinBackdrop) hideNoCheckinModal(); });
}

/* === Validators & inputs === */
function normalizeArabicNameLive(str) {
  if (!str) return '';
  str = str.replace(/[\u0640\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g, '');
  str = str.replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627').replace(/[\u0649\u06CC]/g, '\u064A');
  str = str.replace(/[\s\u00A0]+/g, ' ');
  str = str.replace(/[^\u0600-\u06FF ]/g, '');
  const hasTrailingSpace = / $/.test(str);
  str = str.replace(/ {2,}/g, ' ');
  if (str.startsWith(' ')) str = str.replace(/^ +/, '');
  if (hasTrailingSpace && str.length && !str.endsWith(' ')) str += ' ';
  return str;
}
function normalizeArabicNameFinal(str) {
  return (str || '')
    .replace(/[\u0640\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/[\u0649\u06CC]/g, '\u064A')
    .replace(/[\s\u00A0]+/g, ' ')
    .replace(/[^\u0600-\u06FF ]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}
function validateFullName() {
  const i = fields.fullName;
  i.value = normalizeArabicNameFinal(i.value);
  const ok = /^[\u0600-\u06FF]+( [\u0600-\u06FF]+){3}$/.test(i.value);
  markValid(i, ok);
  setMsg(msgs.fullName, ok ? '✅ الاسم صحيح (أربع كلمات بالعربية).' : 'الرجاء كتابة الاسم الرباعي بالعربية فقط (أربع كلمات).', ok ? 'success' : 'error');
  return ok;
}
function validateNationalId() {
  const i = fields.nationalId;
  i.value = onlyDigits(i.value).slice(0, 10);
  const ok = /^\d{10}$/.test(i.value);
  markValid(i, ok);
  setMsg(msgs.nationalId, ok ? '✅ الهوية مكونة من 10 أرقام.' : 'رقم الهوية يجب أن يكون 10 أرقام بدون رموز.', ok ? 'success' : 'error');
  return ok;
}
function validatePhone() {
  const i = fields.phone;
  i.value = onlyDigits(i.value).slice(0, 10);
  const ok = /^05\d{8}$/.test(i.value);
  markValid(i, ok);
  setMsg(msgs.phone, ok ? '✅ رقم الجوال يبدأ بـ 05 وطوله 10 أرقام.' : 'يرجى إدخال رقم بصيغة 05XXXXXXXX (10 أرقام).', ok ? 'success' : 'error');
  return ok;
}
function validateLocation() {
  const ok = !!fields.location.value;
  markValid(fields.location, ok);
  setMsg(msgs.location, ok ? '' : 'الرجاء اختيار الموقع.');
  return ok;
}
function validateShift() {
  const ok = !!fields.shift.value;
  markValid(fields.shift, ok);
  setMsg(msgs.shift, ok ? '' : 'الرجاء اختيار الوردية.');
  return ok;
}
function formValid() { return [validateLocation(), validateShift(), validateFullName(), validateNationalId(), validatePhone()].every(Boolean); }

/* === Time utils === */
function riyadhMinutesNow() {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date());
  const h = Number(p.find(x => x.type === 'hour').value);
  const m = Number(p.find(x => x.type === 'minute').value);
  return h * 60 + m;
}
function hhmm12ToMinutes(hh, mm, ap) {
  let h = Number(hh), m = Number(mm);
  const ampm = String(ap || '').trim().toLowerCase();
  const isPM = ['pm','p.m','p','م'].includes(ampm) || /م\b/.test(ampm);
  const isAM = ['am','a.m','a','ص'].includes(ampm) || /ص\b/.test(ampm);
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  return (h % 24) * 60 + m;
}
function parseShiftRange(v) {
  v = String(v || '').trim();
  const re12 = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM|am|pm|[صم])\s*(?:[-–]|(?:\s*(?:إلى|to)\s*))\s*(\d{1,2}):(\d{2})\s*(AM|PM|am|pm|[صم])\s*$/;
  const m12 = v.match(re12);
  if (m12) {
    const [, sh, sm, sap, eh, em, eap] = m12;
    return { start: hhmm12ToMinutes(sh, sm, sap), end: hhmm12ToMinutes(eh, em, eap) };
  }
  const re24 = /^\s*(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})\s*$/;
  const m24 = v.match(re24);
  if (m24) {
    const [, sh, sm, eh, em] = m24.map(Number);
    return { start: sh * 60 + sm, end: eh * 60 + em };
  }
  return { start: 0, end: 0 };
}
function minutesTo12h(mins) {
  mins = ((mins % 1440) + 1440) % 1440;
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const isPM = h >= 12;
  const h12 = (h % 12) || 12;
  const ap = isPM ? 'م' : 'ص';
  return `${h12}:${String(m).padStart(2,'0')} ${ap}`;
}

const EARLY_ALLOW_MIN = 5, ONTIME_GRACE_MIN = 5;
function inWindow(now, start, end) {
  const allowedStart = (start - EARLY_ALLOW_MIN + 1440) % 1440;
  if (end >= start) {
    if (allowedStart <= start) return now >= allowedStart && now < end;
    else return (now >= allowedStart && now < 1440) || (now >= 0 && now < end);
  } else {
    if (allowedStart <= start) return (now >= allowedStart && now < 1440) || (now >= 0 && now < end);
    else return (now >= allowedStart || now < end);
  }
}
function shiftStatus(now, start) {
  if (now < start) return { type: 'مبكر', minutes: start - now };
  if (now <= start + ONTIME_GRACE_MIN) return { type: 'في الوقت', minutes: now - start };
  return { type: 'متأخر', minutes: now - start };
}
function updateShiftState() {
  const v = fields.shift.value;
  if (!v) { setMsg(msgs.shift, 'الرجاء اختيار الوردية.'); return false; }
  const { start, end } = parseShiftRange(v);
  const now = riyadhMinutesNow();
  if (!inWindow(now, start, end)) { 
    setMsg(msgs.shift, `اختر الوقت الصحيح لدوامك. (نافذة الدوام: ${minutesTo12h(start)} → ${minutesTo12h(end)})`); 
    return false; 
  }
  const st = shiftStatus(now, start);
  let t = '', kind = 'success';
  if (st.type === 'مبكر') { t = `⏳ مبكر بـ ${st.minutes} دقيقة (يُسمح حتى ${EARLY_ALLOW_MIN}).`; kind = st.minutes <= EARLY_ALLOW_MIN ? 'success' : 'error'; }
  else if (st.type === 'في الوقت') { t = st.minutes === 0 ? '✅ على الوقت تمامًا.' : `✅ ضمن مهلة ${ONTIME_GRACE_MIN} دقائق.`; }
  else { t = `⏱ متأخر بـ ${st.minutes} دقيقة.`; kind = 'error'; }
  setMsg(msgs.shift, t, kind);
  return true;
}

/* === Live input + events === */
fields.fullName.addEventListener('input', () => {
  const el = fields.fullName;
  const before = el.value;
  const after = normalizeArabicNameLive(before);
  if (after !== before) {
    const posEnd = after.length;
    el.value = after;
    try { el.setSelectionRange(posEnd, posEnd); } catch {}
  }
  msgs.fullName && setMsg(msgs.fullName, '');
  el.classList.remove('invalid', 'valid');
});
fields.fullName.addEventListener('blur', validateFullName);
fields.nationalId.addEventListener('input', validateNationalId);
fields.phone.addEventListener('input', validatePhone);
fields.location.addEventListener('change', validateLocation);
fields.shift.addEventListener('change', () => { validateShift(); updateShiftState(); });
setInterval(() => { if (fields.shift.value) updateShiftState(); }, 60 * 1000);

/* === Geofence === */
const LOCATIONS = {
  "موقع المقر الرئيسي ": { lat: 21.36069283475989, lon: 39.987057273725085, radius: 200 },
  " موقع البوابه الرئيسية": { lat: 21.367388774623464, lon: 39.97669691790373, radius: 110 },
  "موقع مركز 20 كامل":    { lat: 21.364095855640638,  lon: 39.975008731396414, radius: 200 }, 
  "Amany": { lat: 21.362401699505586,  lon: 39.819594631396775,   radius: 100 }
};
function normKey(s){ return String(s || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim(); }
const LOC_MAP = Object.fromEntries(Object.entries(LOCATIONS).map(([k, v]) => [normKey(k), v]));
function toRad(d) { return d * Math.PI / 180; }
function haversineMeters(a, b, c, d) {
  const R = 6371000;
  const dLat = toRad(c - a), dLon = toRad(d - b);
  const m = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLon / 2) ** 2;
  const k = 2 * Math.atan2(Math.sqrt(m), Math.sqrt(1 - m));
  return R * k;
}
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('خدمة تحديد المواقع غير مدعومة.'));
    navigator.geolocation.getCurrentPosition(
      p => resolve(p),
      e => reject(e),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}
async function validateGeofence() {
  const key = fields.location.value;
  if (!key) { setMsg(msgs.location, 'الرجاء اختيار الموقع.'); return false; }
  const spec = LOC_MAP[normKey(key)];
  if (!spec) { setMsg(msgs.location, 'الموقع غير معروف في النظام.'); return false; }
  try {
    const pos = await getPosition();
    const { latitude, longitude, accuracy } = pos.coords;
    const dist = Math.round(haversineMeters(latitude, longitude, spec.lat, spec.lon));
    const inside = dist <= spec.radius;
    if (!inside) {
      setMsg(msgs.location, `أنت خارج النطاق المحدد للموقع (المسافة ${dist}م / المسموح ${spec.radius}م).`, 'error');
      return false;
    }
    setMsg(msgs.location, `✅ داخل النطاق. المسافة ~${dist}م. دقة GPS ~${Math.round(accuracy || 0)}م.`, 'success');
    return true;
  } catch (err) {
    let m = 'تعذر الوصول إلى موقعك. تأكد من تفعيل خدمة تحديد المواقع.';
    if (err && err.code === 1) m = 'تم رفض الإذن للوصول إلى الموقع. فعّل إذن الموقع.';
    else if (err && err.code === 3) m = 'انتهت مهلة الحصول على الموقع. حاول مجددًا.';
    setMsg(msgs.location, m, 'error');
    return false;
  }
}

/* === 8 hours throttle === */
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
const ACTION = { CHECKIN: 'checkin', CHECKOUT: 'checkout', EARLY: 'early' };
function lastActionKey(action) {
  const nid = (fields.nationalId.value || 'unknown').trim() || 'unknown';
  const a = action || 'any';
  return `sanam_last_${a}_${nid}`;
}
function canDoAction(action, windowMs = EIGHT_HOURS_MS) {
  try {
    const key = lastActionKey(action);
    const t = Number(localStorage.getItem(key) || '0');
    if (!t) return true;
    return (Date.now() - t) >= windowMs;
  } catch (_) { return true; }
}
function stampAction(action) { try { localStorage.setItem(lastActionKey(action), String(Date.now())); } catch {} }

/* === تذكير الانصراف === */
const reminderBackdrop = byId('reminderBackdrop');
const reminderClose = byId('reminderClose');
function showReminder() { if (reminderBackdrop) { reminderBackdrop.style.display = 'flex'; reminderBackdrop.setAttribute('aria-hidden', 'false'); } }
function hideReminder() { if (reminderBackdrop) { reminderBackdrop.style.display = 'none'; reminderBackdrop.setAttribute('aria-hidden', 'true'); } }
if (reminderClose) { reminderClose.addEventListener('click', hideReminder); }
if (reminderBackdrop) { reminderBackdrop.addEventListener('click', (e) => { if (e.target === reminderBackdrop) hideReminder(); }); }

/* === Early checkout panel (with presence guard) === */
const earlyPanel  = byId('earlyPanel');
const earlyReason = byId('earlyReason');
const earlyPhoto  = byId('earlyPhoto');

if (btnEarlyCheckout) {
  btnEarlyCheckout.addEventListener('click', () => {
    if (!isCheckedIn()) { showNoCheckinModal('لم يمكن إكمال العملية لعدم تسجيلك الحضور.'); return; }
    if (earlyPanel) { earlyPanel.style.display = 'block'; earlyPanel.setAttribute('aria-hidden', 'false'); }
  });
}
if (btnEarlyCancel) {
  btnEarlyCancel.addEventListener('click', () => {
    if (earlyPanel) { earlyPanel.style.display = 'none'; earlyPanel.setAttribute('aria-hidden', 'true'); }
    if (earlyReason) earlyReason.value = '';
    if (earlyPhoto)  earlyPhoto.value  = '';
  });
}

/* === Checkout window (1 hour after end) === */
function minutesDiffWrap(a, b) { return (a - b + 1440) % 1440; }
function withinCheckoutWindow(now, start, end) {
  const diff = minutesDiffWrap(now, end);
  return diff >= 0 && diff < 60;
}

/* === Send === */
async function sendRecord(actionArabic, extra = {}) {
  if (!WEB_APP_URL) { alert('لم يتم ضبط رابط Web App.'); throw new Error('WEB_APP_URL missing'); }
  let imageBase64 = '';
  if (extra.file) imageBase64 = await fileToDataURL(extra.file);
  const fd = new FormData();
  fd.append('action', actionArabic);
  fd.append('location',   fields.location.value || '');
  fd.append('shift',      fields.shift.value || '');
  fd.append('workType',   fields.workType.value || '');
  fd.append('fullName',   fields.fullName.value || '');
  fd.append('nationalId', fields.nationalId.value || '');
  fd.append('phone',      fields.phone.value || '');
  fd.append('status',     extra.status || '');
  fd.append('minutes',    (extra.minutes != null ? String(extra.minutes) : ''));
  fd.append('reason',     extra.reason || '');
  fd.append('imageBase64', imageBase64);
  await fetch(WEB_APP_URL, { method: 'POST', mode: 'no-cors', body: fd });
  return { ok: true };
}

/* === Actions === */
if (btnCheckIn) btnCheckIn.addEventListener('click', async () => {
  if (!formValid()) return alert('⚠️ تأكد من تعبئة الحقول بشكل صحيح.');
  if (!canDoAction(ACTION.CHECKIN)) return alert('لا يمكنك تسجيل حضور جديد قبل مرور 8 ساعات من آخر حضور.');
  const timeOK = updateShiftState(); if (!timeOK) return;
  setBusy(btnCheckIn, true);
  try {
    const geoOK = await validateGeofence(); if (!geoOK) return;
    const { start } = parseShiftRange(fields.shift.value);
    const now = riyadhMinutesNow();
    const st = shiftStatus(now, start);
    await sendRecord('تسجيل حضور', { status: st.type, minutes: st.minutes });
    stampAction(ACTION.CHECKIN);
    markCheckedIn();
    showReminder();
    alert('✅ تم تسجيل الحضور بنجاح.');
  } catch (err) {
    alert('حدث خطأ أثناء التسجيل: ' + err.message);
  } finally {
    setBusy(btnCheckIn, false);
  }
});

if (btnCheckOut) btnCheckOut.addEventListener('click', async () => {
  if (!formValid()) return alert('⚠️ تأكد من تعبئة الحقول بشكل صحيح.');
  if (!canDoAction(ACTION.CHECKOUT)) return alert('لا يمكنك تسجيل انصراف جديد قبل مرور 8 ساعات من آخر انصراف.');
  if (!isCheckedIn()) { showNoCheckinModal('لم يمكن إكمال العملية لعدم تسجيلك الحضور.'); return; }
  setBusy(btnCheckOut, true);
  try {
    const geoOK = await validateGeofence(); if (!geoOK) return;
    const { start, end } = parseShiftRange(fields.shift.value);
    const now = riyadhMinutesNow();
    if (!withinCheckoutWindow(now, start, end)) { alert('❌ تسجيل الانصراف متاح فقط خلال الساعة الأولى بعد نهاية الوردية.'); return; }
    await sendRecord('تسجيل انصراف', {});
    stampAction(ACTION.CHECKOUT);
    markCheckedOut();
    alert('✅ تم تسجيل الانصراف بنجاح.');
  } catch (err) {
    alert('حدث خطأ أثناء التسجيل: ' + err.message);
  } finally {
    setBusy(btnCheckOut, false);
  }
});

if (btnEarlyConfirm) btnEarlyConfirm.addEventListener('click', async () => {
  if (!formValid()) return alert('⚠️ تأكد من تعبئة الحقول بشكل صحيح.');
  if (!canDoAction(ACTION.EARLY)) return alert('لا يمكنك تسجيل انصراف مبكر جديد قبل مرور 8 ساعات من آخر انصراف مبكر.');
  if (!isCheckedIn()) { showNoCheckinModal('لم يمكن إكمال العملية لعدم تسجيلك الحضور.'); if (earlyPanel) { earlyPanel.style.display = 'block'; earlyPanel.setAttribute('aria-hidden', 'false'); } return; }
  setBusy(btnEarlyConfirm, true);
  try {
    const geoOK = await validateGeofence(); if (!geoOK) return;
    const reason = (earlyReason?.value || '').trim(); if (!reason) { alert('يرجى كتابة سبب الانصراف المبكر.'); return; }
    const file = earlyPhoto?.files && earlyPhoto.files[0] ? earlyPhoto.files[0] : null;
    await sendRecord('انصراف مبكر', { reason, file, status: 'مبكر' });
    stampAction(ACTION.EARLY);
    alert('✅ تم تسجيل الانصراف المبكر.');
    if (earlyPanel) { earlyPanel.style.display = 'none'; earlyPanel.setAttribute('aria-hidden','true'); }
    if (earlyReason) earlyReason.value = '';
    if (earlyPhoto)  earlyPhoto.value  = '';
  } catch (err) {
    alert('حدث خطأ أثناء التسجيل: ' + err.message);
  } finally {
    setBusy(btnEarlyConfirm, false);
  }
});
