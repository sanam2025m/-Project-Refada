// ===== app.js (FINAL) =====
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
const WEB_APP_URL =
  CONFIG.WEB_APP_URL ||
  "https://script.google.com/macros/s/AKfycbzhFgwoIRIu5D6gybBuneQoxIsQFsaF7GFRihpZZUZSPTnrUo1zl0FosQgbOgDHkAMqBw/exec";

// ================= Helpers =================
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
function setBusy(el, busy = true) {
  if (!el) return;
  el.disabled = !!busy;
}

// ================= Arabic Name =================
function normalizeArabicNameFinal(str) {
  return (str || '')
    .replace(/[\u0640\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, 'ا')
    .replace(/[\u0649\u06CC]/g, 'ي')
    .replace(/[^\u0600-\u06FF ]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

// ================= Validators =================
function validateFullName() {
  const i = fields.fullName;
  i.value = normalizeArabicNameFinal(i.value);
  const ok = /^[\u0600-\u06FF]+( [\u0600-\u06FF]+){3}$/.test(i.value);
  markValid(i, ok);
  setMsg(msgs.fullName, ok ? '✅ الاسم صحيح' : 'الاسم الرباعي مطلوب', ok ? 'success' : 'error');
  return ok;
}

function validateNationalId() {
  const i = fields.nationalId;
  i.value = onlyDigits(i.value).slice(0, 10);
  const ok = /^\d{10}$/.test(i.value);
  markValid(i, ok);
  setMsg(msgs.nationalId, ok ? '✅ الهوية صحيحة' : 'رقم الهوية 10 أرقام', ok ? 'success' : 'error');
  return ok;
}

function validatePhone() {
  const i = fields.phone;
  i.value = onlyDigits(i.value).slice(0, 10);
  const ok = /^05\d{8}$/.test(i.value);
  markValid(i, ok);
  setMsg(msgs.phone, ok ? '✅ رقم صحيح' : '05XXXXXXXX', ok ? 'success' : 'error');
  return ok;
}

function validateLocation() {
  const ok = !!fields.location.value;
  markValid(fields.location, ok);
  setMsg(msgs.location, ok ? '' : 'اختر الموقع');
  return ok;
}

function validateShift() {
  const ok = !!fields.shift.value;
  markValid(fields.shift, ok);
  setMsg(msgs.shift, ok ? '' : 'اختر الوردية');
  return ok;
}

function formValid() {
  return [
    validateLocation(),
    validateShift(),
    validateFullName(),
    validateNationalId(),
    validatePhone()
  ].every(Boolean);
}

// ================= Time =================
function riyadhMinutesNow() {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit'
  }).formatToParts(new Date());
  return Number(p[0].value) * 60 + Number(p[2].value);
}

function parseShiftRange(v) {
  const m = String(v || '').match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!m) return { start: 0, end: 0 };
  return {
    start: Number(m[1]) * 60 + Number(m[2]),
    end: Number(m[3]) * 60 + Number(m[4])
  };
}

function minutesTo12h(mins) {
  mins = ((mins % 1440) + 1440) % 1440;
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const isPM = h >= 12;
  h = (h % 12) || 12;
  return `${h}:${String(m).padStart(2, '0')} ${isPM ? 'م' : 'ص'}`;
}

/* ======== التعديل الوحيد هنا ======== */
const EARLY_ALLOW_MIN = 60; // ⏳ التحضير قبل الوردية بساعة
const ONTIME_GRACE_MIN = 5;

// ================= Logic =================
function inWindow(now, start, end) {
  const allowedStart = (start - EARLY_ALLOW_MIN + 1440) % 1440;
  if (end >= start) return now >= allowedStart && now < end;
  return now >= allowedStart || now < end;
}

function shiftStatus(now, start) {
  if (now < start) return { type: 'مبكر', minutes: start - now };
  if (now <= start + ONTIME_GRACE_MIN) return { type: 'في الوقت', minutes: now - start };
  return { type: 'متأخر', minutes: now - start };
}

function updateShiftState() {
  const { start, end } = parseShiftRange(fields.shift.value);
  const now = riyadhMinutesNow();
  if (!inWindow(now, start, end)) {
    setMsg(msgs.shift, `نافذة الدوام: ${minutesTo12h(start)} → ${minutesTo12h(end)}`);
    return false;
  }
  const st = shiftStatus(now, start);
  setMsg(msgs.shift, `${st.type} (${st.minutes} دقيقة)`, st.type === 'متأخر' ? 'error' : 'success');
  return true;
}

// ================= Checkout (ساعة بعد النهاية) =================
function minutesDiffWrap(a, b) {
  return (a - b + 1440) % 1440;
}
function withinCheckoutWindow(now, start, end) {
  const diff = minutesDiffWrap(now, end);
  return diff >= 0 && diff < 60;
}
