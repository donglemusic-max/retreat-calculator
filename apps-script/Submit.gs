/**
 * 2026 전교인 리트릿 — 계산기 → 시트 직접 제출 (Phase 2)
 *
 * ⚠️ Migrate.gs 와 같은 Apps Script 프로젝트에 "새 파일"로 추가하세요.
 *    (DEPT_FEE / BUS_FEE / SEORAK_FEE / deptFee_ / roomAdd_ / roomIndiv_ /
 *     occAdd_ / isGroupOcc_ / findCol_ 는 Migrate.gs 것을 그대로 재사용합니다.
 *     중복 선언하지 마세요.)
 *
 * 배포:
 *   1) [배포] → [새 배포] → 유형: "웹 앱"
 *   2) 실행: "나(소유자)" / 액세스: "모든 사용자"
 *   3) 배포 후 나오는 웹앱 URL(.../exec)을 계산기에 연결
 *      → Vercel 프로젝트 환경변수 VITE_SUBMIT_URL 에 넣고 재배포
 *
 * 계산기가 보내는 JSON(payload):
 *   { mode:'개인'|'그룹', email, contact, campus, leader, inquiry,
 *     roomLabel, occLabel, seorak:bool, depositMode:'leader'|'split',
 *     roster, members:[{name, gender, deptLabel, bus:bool}] }
 */

function _json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() { return _json_({ ok: true, version: SUBMIT_VERSION, msg: '리트릿 제출 엔드포인트 (POST 사용)' }); }

function _findResponseSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var lc = sheets[i].getLastColumn(); if (lc < 1) continue;
    var h = sheets[i].getRange(1, 1, 1, lc).getValues()[0];
    for (var j = 0; j < h.length; j++) if (String(h[j]).indexOf('타임스탬프') >= 0) return sheets[i];
  }
  return ss.getSheets()[0];
}

var BUS_YES = '버스 신청합니다. (1인 버스 비용 38,000원)';
var BUS_NO = '자차를 이용합니다';
var SEORAK_YES = '설악산 뷰 원합니다.';
var SUBMIT_VERSION = 'sv30-notify-multi'; // 배포 확인용 (웹앱 URL을 브라우저로 열면 보임)
var ADMIN_PIN = '2026';        // ← 관리자 PIN (원하는 번호로 바꾸세요)
var ADMIN_COLS = ['입금확인', '배정방', '관리자메모']; // 관리자 전용 컬럼 (없으면 자동 생성)

// ── 결과 이메일(#18) 발신 설정 ──────────────────────────────
// 방식: 개인 Gmail의 "다른 주소로 메일 보내기(send-as 별칭)"로 교회 주소를 발신처로 사용(후자안).
//   준비: donglemusic Gmail → 설정 → 계정 → "다른 주소에서 메일 보내기"에 교회주소 추가·인증
//   → 그 주소를 MAIL_FROM 에 넣으면 그 주소로 발송됨. (미등록 주소를 넣으면 발송 실패하니 등록 후 입력)
var MAIL_SENDER_NAME = '주님의교회 리트릿'; // 받는 분에게 보이는 보낸사람 이름
var MAIL_FROM = '';                         // 발신 주소(등록된 send-as 별칭). 비우면 발신계정 기본 주소로 감
var MAIL_REPLY_TO = '';                     // 답장받을 주소 (예: 교회 대표메일). 비우면 발신 주소로 감
var MAIL_NO_REPLY = false;                  // Workspace 계정으로 바꿀 경우에만 true (no-reply 발송)

// ── AI 정리안 (관리자 버튼) ──────────────────────────────────
// Script Properties 'ANTHROPIC_API_KEY' 에 키 입력 후 동작. 호출 시 시트를 읽어 Claude에 분석 요청.
var ANTHROPIC_MODEL = 'claude-sonnet-4-6'; // 분석 모델 (원하면 변경)

function _colMap_(H) {
  return {
    ts: findCol_(H, /타임스탬프/), email: findCol_(H, /이메일/), name: findCol_(H, /등록자 이름/),
    gender: findCol_(H, /성별/), contact: findCol_(H, /연락처/), rep: findCol_(H, /그룹의 대표자/),
    campus: findCol_(H, /캠퍼스/), dept: findCol_(H, /소속부서/), room: findCol_(H, /객실/),
    occ: findCol_(H, /가족\/그룹을 신청/), list: findCol_(H, /명단/), bus: findCol_(H, /버스 신청 혹은 자차/),
    seorak: findCol_(H, /설악산뷰/), pay: findCol_(H, /입금자명/), inquiry: findCol_(H, /문의/),
    route: H.indexOf('제출경로'), gid: H.indexOf('그룹ID'), grep: H.indexOf('그룹대표(추정)'),
    gn: H.indexOf('그룹인원(제출)'), ifee: H.indexOf('1인등록비'), iroom: H.indexOf('본인객실'),
    mbus: H.indexOf('본인버스'), mseo: H.indexOf('본인설악산'),
    common: H.indexOf('그룹공동비용(객실+투숙)'), gtotal: H.indexOf('그룹총액'),
    type: H.indexOf('신청유형'),
    check: H.indexOf('확인필요'), note: H.indexOf('비고'),
    paid: H.indexOf('입금확인'), assigned: H.indexOf('배정방'), amemo: H.indexOf('관리자메모'),
    ver: findCol_(H, /구버전/, 0),
  };
}

// 관리자 컬럼이 없으면 헤더 오른쪽에 생성 (멱등)
function _ensureAdminCols_(sheet, H) {
  var added = false;
  ADMIN_COLS.forEach(function (name) {
    if (H.indexOf(name) < 0) { H.push(name); added = true; }
  });
  if (added) sheet.getRange(1, 1, 1, H.length).setValues([H]);
  return H;
}
function _digits_(s) { var d = String(s || '').replace(/[^0-9]/g, ''); if (d.length === 10 && d.charAt(0) === '1') d = '0' + d; return d; }
function _email_(s) { return String(s || '').trim().toLowerCase(); } // #19 본인확인 키 = 이메일
function _gv_(row, c) { return c >= 0 ? String(row[c] || '').trim() : ''; }
// 집계 제외 행: 구버전('구') 또는 앱에서 삭제 신청(#17). enrich/재계산에서 인원·금액 미집계.
function _isVoid_(v) { v = String(v || ''); return v === '구' || v.indexOf('삭제') >= 0; }
// '테스트' 행: 조회·수정에선 보이되 모든 집계(관리자·그룹 금액/인원·검증)에선 제외.
function _isTest_(v) { return String(v || '').indexOf('테스트') >= 0; }
// 집계 제외(=숨김 대상 void + 테스트). 가시성(조회) 판정엔 _isVoid_만 쓴다.
function _isUncounted_(v) { return _isVoid_(v) || _isTest_(v); }
// 행 단위 숨김: 구/삭제(ver) "또는" 중복 재제출(제출경로='중복'). 중복행은 ver이 비어 있어도 숨겨야 한다.
// (조회 화면 이름 중복·메일 명단·그룹저장 대상에서 제외 — 김태희/김리아 그룹 중복노출 버그)
function _rowHidden_(row, col) {
  if (col.ver >= 0 && _isVoid_(_gv_(row, col.ver))) return true;
  if (col.route >= 0 && _gv_(row, col.route) === '중복') return true;
  return false;
}
// 집계 제외(숨김 + 테스트). 인원·금액 산정 및 live 멤버 판정용.
function _rowUncounted_(row, col) { return _rowHidden_(row, col) || (col.ver >= 0 && _isTest_(_gv_(row, col.ver))); }
// 변경 알림 메일(수정·추가·삭제·그룹변경). 발신 설정은 상단 MAIL_* 사용. 실패해도 동작엔 영향 없음.
function _mailTo_(to, subject, body) {
  try {
    if (!to || String(to).indexOf('@') < 0) return;
    // plain text는 ~78자에서 강제 줄바꿈돼 문장 중간이 끊김 → HTML(pre-wrap)로 보내 자연스럽게 줄바꿈
    var esc = String(body).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var html = '<div style="white-space:pre-wrap; word-break:keep-all; overflow-wrap:break-word; font-family:\'Apple SD Gothic Neo\',\'Malgun Gothic\',sans-serif; font-size:14px; line-height:1.7; color:#222;">' + esc + '</div>';
    var opts = { name: MAIL_SENDER_NAME, htmlBody: html };
    if (MAIL_FROM) opts.from = MAIL_FROM;
    if (MAIL_REPLY_TO) opts.replyTo = MAIL_REPLY_TO;
    if (MAIL_NO_REPLY) opts.noReply = true;
    MailApp.sendEmail(to, subject, body, opts);
  } catch (e) {}
}
var MAIL_FOOT = '\n\n신청 내용은 등록 사이트 "내 신청 조회·수정"에서 언제든 확인·수정하실 수 있습니다.\n궁금하신 점은 편하게 문의해 주세요. 늘 함께해 주셔서 감사합니다. 🙏\n\n주님의교회 드림';
// 부분그룹 안내: 방(객실) 그룹 추가비용은 최종 인원 확정 후 추후 결정·별도 공지 (모든 메일 기본 삽입)
var PARTIAL_NOTE = '\n\n※ 부분 그룹은 현재 개인 기준(1인 객실비)으로 안내됩니다.\n방(객실) 그룹 추가비용은 최종 방배정·인원 확정 후 추후 결정되어 별도 공지될 예정입니다.';
// 그룹의 '최종 정리 한판' — 변경 후 현재 시트 값으로 항목별 내역·총액 생성 (수정·추가·삭제·그룹변경 메일용)
function _groupSummary_(sheet, col, width, gid) {
  var n = sheet.getLastRow(); var vals = sheet.getRange(1, 1, n, width).getValues();
  var rows = []; for (var r = 1; r < n; r++) if (_gv_(vals[r], col.gid) === gid && !_rowUncounted_(vals[r], col)) rows.push(vals[r]);
  if (!rows.length) return '';
  var names = rows.map(function (rw) { return _gv_(rw, col.name); });
  var room = _gv_(rows[0], col.room).split(' (')[0];
  var reg = 0, bus = 0, seo = 0, iroom = 0, common = 0, total = 0;
  rows.forEach(function (rw) { reg += Number(rw[col.ifee] || 0); bus += Number(rw[col.mbus] || 0); seo += Number(rw[col.mseo] || 0); iroom += Number(rw[col.iroom] || 0); common += Number(rw[col.common] || 0); total += Number(rw[col.gtotal] || 0); });
  var roomFee = roomAdd_(_gv_(rows[0], col.room)); var groupFee = common - roomFee; if (groupFee < 0) groupFee = 0;
  var won = function (v) { return v.toLocaleString() + '원'; };
  var L = [];
  if (reg > 0) L.push('▸ 등록비        ' + won(reg));
  if (iroom > 0) L.push('▸ 객실(본인)     ' + won(iroom));
  if (roomFee > 0) L.push('▸ 객실선택       ' + won(roomFee));
  if (groupFee > 0) L.push('▸ 그룹비         ' + won(groupFee));
  if (bus > 0) L.push('▸ 버스비         ' + won(bus));
  if (seo > 0) L.push('▸ 설악산뷰       ' + won(seo));
  // 부분그룹이면 추후공지 멘트 기본 삽입 (그룹 내 한 행이라도 '부분'이면)
  var isPartialGrp = rows.some(function (rw) { return _gv_(rw, col.type) === '부분'; });
  return '[최종 등록 내역]\n· 인원 ' + names.length + '명: ' + names.join(', ') + '\n· 객실: ' + (room || '교회 배정')
    + '\n\n' + L.join('\n') + '\n─────────────────\n총 합계: ' + won(total)
    + (isPartialGrp ? PARTIAL_NOTE : '') + '\n입금 계좌: 우리은행 1005803168121 주님의 교회';
}
// ── 메일 템플릿(관리자 편집 가능, #26/#30) ───────────────────────────────
// Script Properties 'MAIL_TPL'(JSON)로 덮어쓰기. 비어있으면 아래 기본값 사용.
// 치환자: {name} {gid} {guide} {summary} {changes} {vision} {foot}
var MAIL_TPL_DEFAULT = {
  foot: MAIL_FOOT,
  vision: '', // #30: 관리자에서 비전/영적 기대 문구 입력 (모든 메일 끝에 삽입)
  submit_subject: '[2026 전교인 리트릿] 등록 신청이 접수되었습니다 🙏',
  submit_body: '샬롬! {name}님,\n2026 전교인 리트릿(7/21~23, 델피노 리조트)에 함께해 주셔서 진심으로 감사합니다.\n아래 내용으로 등록 신청이 정상 접수되었습니다. (접수번호 {gid})\n\n{guide}\n\n입금까지 완료되어야 등록이 최종 확정됩니다. 위 항목대로 입금 부탁드립니다.{vision}{foot}',
  update_subject: '[2026 전교인 리트릿] 신청 내용이 수정되었습니다 🙏',
  update_body: '샬롬! {name}님,\n신청 내용이 정상적으로 수정되었습니다.{changes}\n\n변경된 최종 내역을 안내드립니다.\n\n{summary}\n\n변경 후 금액 기준으로 입금 부탁드리며, 입금까지 완료되어야 등록이 확정됩니다.{vision}{foot}',
  add_subject: '[2026 전교인 리트릿] 그룹에 구성원이 추가되었습니다 🙏',
  add_body: '샬롬! {name}님이 그룹 신청에 추가되었습니다.\n\n변경된 최종 내역을 안내드립니다.\n\n{summary}\n\n변경 후 금액 기준으로 입금 부탁드립니다.{vision}{foot}',
  delete_subject: '[2026 전교인 리트릿] 구성원 등록이 취소되었습니다',
  delete_body: '샬롬! {name}님의 등록 신청이 취소되어 그룹에서 제외되었습니다.\n혹시 착오가 있으시면 "내 신청 조회·수정" 또는 문의로 알려주세요.\n\n{summary}{foot}',
  groupset_subject: '[2026 전교인 리트릿] 그룹 설정이 변경되었습니다 🙏',
  groupset_body: '샬롬! 그룹의 객실/투숙 인원/설악산뷰 설정이 변경되었습니다.{changes}\n\n변경된 최종 내역을 안내드립니다.\n\n{summary}\n\n변경 후 금액 기준으로 입금 부탁드립니다.{vision}{foot}',
};
function _tplAll_() {
  var o = {}; for (var k in MAIL_TPL_DEFAULT) o[k] = MAIL_TPL_DEFAULT[k];
  try { var s = PropertiesService.getScriptProperties().getProperty('MAIL_TPL'); if (s) { var ov = JSON.parse(s); for (var k2 in ov) if (ov[k2] != null) o[k2] = ov[k2]; } } catch (e) {}
  return o;
}
function _render_(s, vars) { return String(s || '').replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : ''; }); }
function _mailTplSend_(to, key, vars) {
  var t = _tplAll_();
  var v = {}; for (var k in vars) v[k] = vars[k];
  v.foot = t.foot || ''; v.vision = t.vision ? ('\n\n' + t.vision) : '';
  _mailTo_(to, _render_(t[key + '_subject'] || '', v), _render_(t[key + '_body'] || '', v));
}
// #26 변경 항목 diff. items=[['항목', old, new], ...]. new==null이면 미변경으로 간주(건너뜀).
function _changesText_(items) {
  var L = [];
  items.forEach(function (it) {
    if (it[2] == null) return;
    var o = String(it[1] == null ? '' : it[1]), nw = String(it[2]);
    if (o !== nw) L.push('▸ ' + it[0] + ': ' + (o || '(없음)') + ' → ' + (nw || '(없음)'));
  });
  return L.length ? ('\n\n[변경된 항목]\n' + L.join('\n')) : '';
}
// 관리자: 메일 템플릿 조회/저장
function _mailTplGet_() { return _json_({ ok: true, tpl: _tplAll_(), defaults: MAIL_TPL_DEFAULT, keys: Object.keys(MAIL_TPL_DEFAULT) }); }
function _mailTplSet_(body) {
  var t = body.tpl || {}, clean = {};
  for (var k in MAIL_TPL_DEFAULT) if (t[k] != null) clean[k] = String(t[k]);
  PropertiesService.getScriptProperties().setProperty('MAIL_TPL', JSON.stringify(clean));
  return _json_({ ok: true });
}
// ── 접수 마감 토글 + 임시 1회성 토큰 ─────────────────────────────
// 마감 후에도 '제출 1회 + 48시간' 짜리 임시 링크(?pass=코드)로 등록·수정 가능.
// 상태는 Script Properties에 저장 → 모든 방문자에게 동일 적용. (관리자 PIN은 항상 우회)
var TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48시간
function _regOpen_() {
  var v = PropertiesService.getScriptProperties().getProperty('REG_OPEN');
  return v == null ? true : (v === 'true'); // 미설정=열림(기존 동작 유지)
}
function _setRegOpen_(body) {
  PropertiesService.getScriptProperties().setProperty('REG_OPEN', body.open ? 'true' : 'false');
  return _json_({ ok: true, regOpen: !!body.open });
}
function _tokensRaw_() {
  try { var s = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKENS'); return s ? JSON.parse(s) : []; } catch (e) { return []; }
}
function _tokensSave_(arr) { PropertiesService.getScriptProperties().setProperty('ACCESS_TOKENS', JSON.stringify(arr)); }
function _tokenFind_(arr, code) { for (var i = 0; i < arr.length; i++) if (arr[i].code === code) return arr[i]; return null; }
function _tokenValid_(code) {
  if (!code) return false;
  var t = _tokenFind_(_tokensRaw_(), String(code));
  if (!t) return false;
  return !t.used && (new Date()).getTime() < t.expires;
}
function _consumeToken_(code) { // 제출 1회 시 소비
  var arr = _tokensRaw_(), t = _tokenFind_(arr, String(code));
  if (t && !t.used) { t.used = (new Date()).getTime(); _tokensSave_(arr); }
}
function _randCode_() {
  var s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = ''; // 혼동되는 0/O/1/I 제외
  for (var i = 0; i < 10; i++) r += s.charAt(Math.floor(Math.random() * s.length));
  return r;
}
function _checkTokenRes_(body) {
  var code = String(body.token || ''), t = _tokenFind_(_tokensRaw_(), code), now = (new Date()).getTime();
  if (!t) return _json_({ ok: true, valid: false, reason: '유효하지 않은 링크입니다.' });
  if (t.used) return _json_({ ok: true, valid: false, reason: '이미 사용된 링크입니다.' });
  if (now >= t.expires) return _json_({ ok: true, valid: false, reason: '만료된 링크입니다.' });
  return _json_({ ok: true, valid: true, memo: t.memo || '', expires: t.expires });
}
function _issueToken_(body) {
  var arr = _tokensRaw_(), now = (new Date()).getTime(), code = _randCode_();
  while (_tokenFind_(arr, code)) code = _randCode_();
  arr.push({ code: code, memo: String(body.memo || ''), issued: now, expires: now + TOKEN_TTL_MS, used: null });
  arr = arr.filter(function (x) { return now - x.expires < 7 * 24 * 60 * 60 * 1000; }); // 만료+7일 지난 것 정리
  _tokensSave_(arr);
  return _json_({ ok: true, token: code, expires: now + TOKEN_TTL_MS });
}
function _listTokens_() {
  var arr = _tokensRaw_(), now = (new Date()).getTime();
  var out = arr.map(function (t) {
    return { code: t.code, memo: t.memo, issued: t.issued, expires: t.expires, used: t.used,
      status: t.used ? '사용완료' : (now >= t.expires ? '만료' : '유효') };
  });
  return _json_({ ok: true, tokens: out, regOpen: _regOpen_() });
}
function _revokeToken_(body) {
  var arr = _tokensRaw_(), t = _tokenFind_(arr, String(body.code || ''));
  if (t && !t.used) { t.used = (new Date()).getTime(); _tokensSave_(arr); }
  return _json_({ ok: true });
}
// ── 문의함 (마감 후 추가등록·수정 문의) + 텔레그램 즉시 알림 ───────
var INQUIRY_SHEET = '문의함';
function _inquirySheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(INQUIRY_SHEET);
  if (!sh) { sh = ss.insertSheet(INQUIRY_SHEET); sh.appendRow(['시각', '이름', '연락처', '내용', '상태', '비고']); }
  return sh;
}
function _inquiryAdd_(body) { // 공개: 마감 여부와 무관하게 항상 접수
  var name = String(body.name || '').trim(), contact = String(body.contact || '').trim(), content = String(body.content || '').trim();
  if (!name && !contact && !content) return _json_({ ok: false, error: '내용을 입력해 주세요.' });
  var now = new Date();
  _inquirySheet_().appendRow([now, name, contact, content, '미처리', '']);
  _notify_('🔔 [리트릿 문의 도착]\n· 이름: ' + (name || '-') + '\n· 연락처: ' + (contact || '-') + '\n· 내용: ' + (content || '-') + '\n· 시각: ' + Utilities.formatDate(now, 'Asia/Seoul', 'MM/dd HH:mm') + '\n\n관리자 페이지 "문의함"에서 확인하세요.');
  return _json_({ ok: true });
}
function _inquiryList_() {
  var sh = _inquirySheet_(), n = sh.getLastRow();
  if (n < 2) return _json_({ ok: true, inquiries: [] });
  var vals = sh.getRange(2, 1, n - 1, 6).getValues(), out = [];
  for (var i = 0; i < vals.length; i++) {
    var v = vals[i];
    out.push({ row: i + 2, at: v[0] ? (new Date(v[0])).getTime() : 0, name: String(v[1] || ''), contact: String(v[2] || ''), content: String(v[3] || ''), status: String(v[4] || '미처리'), note: String(v[5] || '') });
  }
  out.reverse(); // 최신 먼저
  return _json_({ ok: true, inquiries: out });
}
function _inquirySet_(body) {
  var sh = _inquirySheet_(), r = Number(body.row || 0);
  if (r >= 2) sh.getRange(r, 5).setValue(body.status || '처리완료');
  return _json_({ ok: true });
}
// 텔레그램 즉시 알림 (Script Properties: TG_TOKEN, TG_CHAT 설정 시 동작. 미설정이면 조용히 패스)
// 진단용: 에디터에서 직접 실행(▶). 권한 동의창을 띄우고, 텔레그램 응답을 그대로 보여줌(에러 안 삼킴).
function testTelegram() {
  var p = PropertiesService.getScriptProperties(), token = p.getProperty('TG_TOKEN'), chat = p.getProperty('TG_CHAT');
  if (!token) throw new Error('TG_TOKEN 속성이 비어있습니다. (프로젝트 설정 → 스크립트 속성)');
  if (!chat) throw new Error('TG_CHAT 속성이 비어있습니다.');
  var first = String(chat).split(/[,\s;]+/)[0].trim();
  var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ chat_id: first, text: '✅ 텔레그램 연결 테스트 (에디터 실행)' }),
  });
  var out = 'HTTP ' + res.getResponseCode() + ' / TG_CHAT=' + chat + '\n' + res.getContentText();
  Logger.log(out);
  return out; // 실행 후 '실행 로그'에서 확인
}
// 진단용: 에디터에서 ▶ 실행 → 봇에게 메시지 보낸 사람들의 chat id·이름을 로그에 표시.
// (목사님이 봇에 메시지 보낸 뒤 실행하면, 목사님 chat id가 보임 → TG_CHAT에 콤마로 추가)
function showTgChats() {
  var token = PropertiesService.getScriptProperties().getProperty('TG_TOKEN');
  if (!token) throw new Error('TG_TOKEN 속성이 비어있습니다.');
  var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getUpdates?offset=-20', { muteHttpExceptions: true });
  var data = JSON.parse(res.getContentText());
  if (!data.ok) { Logger.log('텔레그램 오류: ' + res.getContentText()); return res.getContentText(); }
  var seen = {}, out = [];
  (data.result || []).forEach(function (u) {
    var m = u.message || u.edited_message; if (!m || !m.chat) return;
    var c = m.chat;
    if (seen[c.id]) return; seen[c.id] = true;
    out.push('chat_id: ' + c.id + '  |  type: ' + c.type + '  |  이름: ' + ((c.first_name || '') + ' ' + (c.last_name || '') + (c.title || '')).trim() + '  |  "' + (m.text || '') + '"');
  });
  var txt = out.length ? out.join('\n') : '(받은 메시지 없음 — 목사님이 @TLC_Retreat_bot 에 메시지를 보냈는지 확인)';
  Logger.log(txt);
  return txt; // '실행 로그'에서 확인
}
// 진단용: 에디터에서 ▶ 실행 → 메일 발송 가능 여부 확정. 권한 미승인이면 동의창이 뜸(승인하면 해결).
function mailDiag() {
  var out = [];
  try { out.push('남은 일일 메일 발송량: ' + MailApp.getRemainingDailyQuota() + ' 통'); } catch (e) { out.push('할당량 조회 실패: ' + e); }
  var me = '';
  try { me = Session.getEffectiveUser().getEmail(); } catch (e) {}
  out.push('발송 계정(=테스트 수신지): ' + (me || '(알 수 없음)'));
  try {
    MailApp.sendEmail(me, '[리트릿] 메일 발송 진단', '이 메일이 도착하면 발송은 정상입니다.\n' + new Date());
    out.push('✅ sendEmail 호출 성공 — 위 주소 수신함을 확인하세요.');
  } catch (e) {
    out.push('❌ sendEmail 실패: ' + e);
  }
  Logger.log(out.join('\n'));
  return out.join('\n'); // '실행 로그'에서 확인
}
function _notify_(msg) {
  try {
    var p = PropertiesService.getScriptProperties(), token = p.getProperty('TG_TOKEN'), chat = p.getProperty('TG_CHAT');
    if (!token || !chat) return;
    // TG_CHAT에 여러 명 지정 가능: 콤마/공백/세미콜론으로 구분 (목사님·사장님 등 동시 수신)
    String(chat).split(/[,\s;]+/).forEach(function (cid) {
      cid = String(cid).trim(); if (!cid) return;
      UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({ chat_id: cid, text: msg }),
      });
    });
  } catch (e) {}
}
// 🤖 AI 정리안: 시트를 읽어 Claude에 분석 요청 → 구조화된 정리안 JSON 반환 (관리자 전용)
function _aiSort_(body) {
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) return _json_({ ok: false, error: 'ANTHROPIC_API_KEY가 없습니다. Apps Script → 프로젝트 설정 → 스크립트 속성에 키를 추가하세요.' });
  var sheet = _findResponseSheet_();
  var width = sheet.getLastColumn(), n = sheet.getLastRow();
  var H = sheet.getRange(1, 1, 1, width).getValues()[0];
  var col = _colMap_(H);
  var vals = sheet.getRange(1, 1, n, width).getValues();
  var lines = [];
  for (var r = 1; r < n; r++) {
    var row = vals[r]; if (!_gv_(row, col.name)) continue;
    lines.push([
      'gid=' + _gv_(row, col.gid), '이름=' + _gv_(row, col.name), '성별=' + _gv_(row, col.gender),
      '부서=' + _gv_(row, col.dept).split(' ')[0], '캠퍼스=' + _gv_(row, col.campus).replace(' 캠퍼스', ''),
      '객실=' + _gv_(row, col.room).split(' (')[0], '투숙=' + _gv_(row, col.occ),
      '명단=' + _gv_(row, col.list).replace(/\s+/g, ' '), '대표자입력=' + _gv_(row, col.rep),
      '입금자명=' + _gv_(row, col.pay), '이메일=' + _gv_(row, col.email), '연락처=' + _gv_(row, col.contact),
      '경로=' + _gv_(row, col.route), '구분=' + _gv_(row, col.ver),
    ].join(' | '));
  }
  var instr = [
    '너는 교회 리트릿 등록 데이터를 정리하는 보조자다. 아래 신청 행들을 분석해 "정리안"을 JSON으로만 출력하라.',
    '규칙:',
    '- gid가 같으면 한 그룹(비용 함께 내는 묶음)이다. 단, 명백한 동명이인/오기/가족추정은 사람이 판단하도록 decisions에 적어라.',
    '- 구분(구버전여부)이 "구"/"삭제"/"테스트" 이거나 경로가 "중복"인 행은 집계에서 제외(duplicates에 정리).',
    '- 미제출 = 명단(7번)에 적혔으나 본인 신청 행이 없는 사람. 명단 글자와 실제 이름 표기가 달라도(예: 이한나A/B) 같은 사람일 수 있으니 신중히.',
    '- 같은 이메일/연락처인데 그룹이 갈리거나, 다른 그룹과 합쳐야 할 정황, 연락처/캠퍼스 오기 등은 decisions에 적어라.',
    '- 객실: 소노캄/소노벨스위트/패밀리. 투숙 인원 숫자나 "7~8"을 room 뒤에 붙여라(예: "소노캄·4").',
    '출력 JSON 스키마(이 키만):',
    '{"groups":[{"rep":"대표자","room":"소노캄·4","flags":"설악/버스 중 해당","campus":"분당","members":["제출한 이름들"],"missing":["미제출 이름들"],"status":"전원" 또는 "3/4"}],',
    '"partial":[{"rep":"대표","members":["제출"],"desc":"요청 요약","campus":""}],',
    '"individual":[{"name":"이름","bus":true,"seorak":false,"campus":""}],',
    '"duplicates":[{"name":"이름","reason":"제외 사유"}],',
    '"decisions":["1. 사람 판단 필요한 항목","2. ..."]}',
    '설명/코드펜스 없이 순수 JSON만 출력하라.',
  ].join('\n');
  var payload = { model: ANTHROPIC_MODEL, max_tokens: 16000, messages: [{ role: 'user', content: instr + '\n\n[신청 데이터]\n' + lines.join('\n') }] };
  var resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(payload), muteHttpExceptions: true,
  });
  var code = resp.getResponseCode();
  if (code !== 200) return _json_({ ok: false, error: 'AI 호출 실패(' + code + '): ' + resp.getContentText().slice(0, 300) });
  var out = JSON.parse(resp.getContentText());
  var text = (out.content && out.content[0] && out.content[0].text) || '';
  var mm = text.match(/\{[\s\S]*\}/);
  var result; try { result = mm ? JSON.parse(mm[0]) : null; } catch (e) { result = null; }
  if (!result) return _json_({ ok: false, error: 'AI 응답 파싱 실패', raw: text.slice(0, 400) });
  var at = Utilities.formatDate(new Date(), 'Asia/Seoul', 'MM-dd HH:mm');
  PropertiesService.getScriptProperties().setProperty('AI_SORT', JSON.stringify({ at: at, result: result }));
  return _json_({ ok: true, at: at, result: result });
}
function _aiSortGet_() {
  var s = PropertiesService.getScriptProperties().getProperty('AI_SORT');
  if (!s) return _json_({ ok: true, result: null });
  try { var o = JSON.parse(s); return _json_({ ok: true, at: o.at, result: o.result }); } catch (e) { return _json_({ ok: true, result: null }); }
}
// ── 이슈관리(체크필요 충돌 추적) — 별도 '이슈관리' 탭에 기록, 관리자·시트 양쪽에서 보고 편집 ──
var ISSUE_SHEET = '이슈관리';
function _roomShort_(l) { l = String(l || ''); return l.indexOf('소노캄') >= 0 ? '소노캄' : (l.indexOf('소노벨 스위트') >= 0 ? '스위트' : '패밀리'); }
function _issueSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(); var sh = ss.getSheetByName(ISSUE_SHEET);
  if (!sh) { sh = ss.insertSheet(ISSUE_SHEET); sh.getRange(1, 1, 1, 8).setValues([['키', '유형', '대상', '내용', '상태', '처리메모', '현재감지', '갱신일']]); sh.setFrozenRows(1); sh.setColumnWidths(1, 8, 130); }
  return sh;
}
function _issueRows_(sh) {
  var n = sh.getLastRow(); if (n < 2) return { rows: [], byKey: {} };
  var v = sh.getRange(2, 1, n - 1, 8).getValues(); var rows = [], byKey = {};
  v.forEach(function (r, i) { var o = { rowN: i + 2, key: String(r[0]), type: r[1], target: r[2], content: r[3], status: r[4] || '미해결', memo: r[5] || '', live: !!r[6], at: r[7] }; if (o.key) { rows.push(o); byKey[o.key] = o; } });
  return { rows: rows, byKey: byKey };
}
// 현재 데이터에서 체크필요 충돌 산출
function _scanIssues_(sheet, col, width) {
  var n = sheet.getLastRow(); var vals = sheet.getRange(1, 1, n, width).getValues();
  var nm = function (s) { return String(s || '').replace(/\s/g, '').replace(/[A-Za-z0-9]+$/, ''); };
  var js = function (s) { return String(s || '').replace(/(와|과|은|는|이|가|도|만|의|들|님|랑|하고)$/, ''); };
  var byG = {}, out = [];
  for (var r = 1; r < n; r++) { var row = vals[r]; if (!_gv_(row, col.name)) continue; if (_gv_(row, col.route) === '중복') continue; if (col.ver >= 0 && _isUncounted_(_gv_(row, col.ver))) continue; var g = _gv_(row, col.gid); (byG[g] = byG[g] || []).push(row); }
  Object.keys(byG).forEach(function (gid) {
    var g = byG[gid], rep = ''; for (var i = 0; i < g.length && !rep; i++) { var mm = _gv_(g[i], col.grep); if (mm) rep = mm; } if (!rep) rep = _gv_(g[0], col.name);
    var sub = {}; g.forEach(function (x) { sub[nm(_gv_(x, col.name))] = 1; });
    var ln = []; g.forEach(function (x) { _nameTokens_(_gv_(x, col.list)).forEach(function (t) { t = js(t); if (t.length >= 2 && ln.indexOf(t) < 0) ln.push(t); }); });
    var miss = ln.filter(function (t) { return !sub[nm(t)]; });
    if (miss.length) out.push({ key: '미제출|' + gid, type: '미제출', target: rep + ' 그룹', content: '미신청: ' + miss.join(', ') });
    if (g.length >= 2) { var ty = {}; g.forEach(function (x) { ty[_roomShort_(_gv_(x, col.room))] = 1; }); if (Object.keys(ty).length > 1) out.push({ key: '객실|' + gid, type: '객실불일치', target: rep + ' 그룹', content: g.map(function (x) { return _gv_(x, col.name) + ':' + _roomShort_(_gv_(x, col.room)); }).join(' / ') }); }
  });
  for (var r2 = 1; r2 < n; r2++) { var row2 = vals[r2]; if (!_gv_(row2, col.name)) continue; if (_gv_(row2, col.route) === '중복' || (col.ver >= 0 && _isUncounted_(_gv_(row2, col.ver)))) continue; var occ = _gv_(row2, col.occ), list = _gv_(row2, col.list); if (/부분적으로|나머지는 교회에서 배정/.test(occ) || /배정해|방으로 배정|상관없|외 \d명|명은/.test(list)) out.push({ key: '부분|' + _gv_(row2, col.gid) + '|' + _gv_(row2, col.name), type: '부분그룹', target: _gv_(row2, col.name), content: list || occ }); }
  return out;
}
function _issueScan_(body, sheet, col, width) {
  var sh = _issueSheet_(), ex = _issueRows_(sh);
  var seed = (body && body.seed) || []; // 프론트가 보낸 큐레이션 이슈(미선 정리표). 있으면 그것만 사용(버그난 자동 파싱 비활성)
  var cur = seed.length ? [] : _scanIssues_(sheet, col, width);
  seed.forEach(function (s) { if (s && s.key) cur.push({ key: String(s.key), type: s.type || '의사결정', target: s.target || '', content: s.content || '' }); });
  var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'MM-dd HH:mm'), curKeys = {};
  cur.forEach(function (c) {
    curKeys[c.key] = 1; var e = ex.byKey[c.key];
    if (e) { sh.getRange(e.rowN, 4).setValue(c.content); sh.getRange(e.rowN, 7).setValue('Y'); sh.getRange(e.rowN, 8).setValue(now); }
    else sh.appendRow([c.key, c.type, c.target, c.content, '미해결', '', 'Y', now]);
  });
  ex.rows.forEach(function (e) { if (!curKeys[e.key] && e.live) { sh.getRange(e.rowN, 7).setValue(''); sh.getRange(e.rowN, 8).setValue(now); } });
  return _issueGet_();
}
function _issueGet_() { return _json_({ ok: true, issues: _issueRows_(_issueSheet_()).rows }); }
function _issueSet_(body) {
  var sh = _issueSheet_(), e = _issueRows_(sh).byKey[String(body.key || '')]; if (!e) return _json_({ ok: false, error: '이슈를 찾을 수 없습니다.' });
  if (body.status != null) sh.getRange(e.rowN, 5).setValue(body.status);
  if (body.memo != null) sh.getRange(e.rowN, 6).setValue(body.memo);
  sh.getRange(e.rowN, 8).setValue(Utilities.formatDate(new Date(), 'Asia/Seoul', 'MM-dd HH:mm'));
  return _json_({ ok: true });
}
// 명단 텍스트에서 한글 이름 토큰 추출 (불용어 제외)
// 명단 텍스트에서 한글 이름 토큰 추출 (불용어 제외)
function _nameTokens_(t) {
  return String(t || '').split(/[^가-힣A-Za-z]+/).filter(function (x) {
    return x && /^[가-힣]{2,4}$/.test(x) &&
      !/투숙|신청|상관|배정|교회|추가|비용|없음|캠퍼스|함께|성도|다른|또는|혹은|그룹|가족|부분|명방|방으로/.test(x);
  });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var body = JSON.parse(e.postData.contents);
    var sheet = _findResponseSheet_();
    var width = sheet.getLastColumn();
    var H = sheet.getRange(1, 1, 1, width).getValues()[0];
    var action = body.action || 'submit';
    // 공개 상태 조회: 접수 열림 여부 / 임시 링크 유효성 (PIN·col 불필요)
    if (action === 'config') return _json_({ ok: true, regOpen: _regOpen_() });
    if (action === 'checkToken') return _checkTokenRes_(body);
    if (action === 'inquiry') return _inquiryAdd_(body); // 문의 접수(공개·마감 무관)
    // 관리자 액션: 컬럼 보강 후 폭/헤더 갱신 (PIN 필요)
    if (action === 'admin' || action === 'adminSet' || action === 'adminBatch' || action === 'mergeGroups' || action === 'addPlaceholder' || action === 'moveMember' || action === 'mailTplGet' || action === 'mailTplSet' || action === 'aiSort' || action === 'aiSortGet' || action === 'issueScan' || action === 'issueGet' || action === 'issueSet' || action === 'setRegOpen' || action === 'issueToken' || action === 'listTokens' || action === 'revokeToken' || action === 'inquiryList' || action === 'inquirySet') {
      if (body.pin !== ADMIN_PIN) return _json_({ ok: false, error: 'PIN이 올바르지 않습니다.' });
      if (action === 'setRegOpen') return _setRegOpen_(body);
      if (action === 'issueToken') return _issueToken_(body);
      if (action === 'listTokens') return _listTokens_();
      if (action === 'revokeToken') return _revokeToken_(body);
      if (action === 'inquiryList') return _inquiryList_();
      if (action === 'inquirySet') return _inquirySet_(body);
      if (action === 'mailTplGet') return _mailTplGet_();
      if (action === 'mailTplSet') return _mailTplSet_(body);
      if (action === 'aiSort') return _aiSort_(body);
      if (action === 'aiSortGet') return _aiSortGet_();
      if (action === 'issueScan') return _issueScan_(body, sheet, acol, width);
      if (action === 'issueGet') return _issueGet_();
      if (action === 'issueSet') return _issueSet_(body);
      H = _ensureAdminCols_(sheet, H);
      width = H.length;
      var acol = _colMap_(H);
      if (action === 'admin') return _admin_(sheet, H, acol, width);
      if (action === 'adminSet') return _adminSet_(body, sheet, acol, width);
      if (action === 'adminBatch') return _adminBatch_(body, sheet, acol, width);
      if (action === 'mergeGroups') return _mergeGroups_(body, sheet, H, acol, width);
      if (action === 'addPlaceholder') return _addPlaceholder_(body, sheet, H, acol, width);
      if (action === 'moveMember') return _moveMember_(body, sheet, acol, width);
    }
    var col = _colMap_(H);
    if (action === 'lookup') return _lookup_(body, sheet, H, col, width); // 조회는 마감과 무관하게 항상 허용
    // 마감 게이트: 닫혀 있으면 등록·수정 차단. 단, 관리자 PIN 또는 유효한 임시 토큰은 우회.
    if (!_regOpen_() && body.pin !== ADMIN_PIN && !_tokenValid_(body.token)) {
      return _json_({ ok: false, closed: true, error: '등록·수정이 마감되었습니다. 추가 등록이나 수정이 필요하시면 문의해 주세요.' });
    }
    if (action === 'update') return _update_(body, sheet, H, col, width);
    if (action === 'memberAdd') return _memberAdd_(body, sheet, H, col, width);
    if (action === 'memberDelete') return _memberDelete_(body, sheet, H, col, width);
    if (action === 'groupSet') return _groupSet_(body, sheet, H, col, width);
    var subRes = _submit_(body, sheet, col, width);
    // 제출 성공 + 임시 토큰 사용 시 → 토큰 1회 소비(소멸)
    if (body.token) { try { var jr = JSON.parse(subRes.getContent()); if (jr && jr.ok) _consumeToken_(body.token); } catch (e3) {} }
    return subRes;
  } catch (err) {
    return _json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function _submit_(body, sheet, col, width) {
  var members = body.members || [];
  if (!members.length) return _json_({ ok: false, error: '구성원이 없습니다.' });
  var now = new Date();
  var gid = 'A' + Utilities.formatDate(now, 'Asia/Seoul', 'yyMMddHHmmss');
  var isGroupMode = (body.mode === '그룹');
  var leader = (body.leader || '').trim();
  var roomLabel = body.roomLabel || '';
  var occLabel = body.occLabel || '';
  var seorakOn = !!body.seorak;
  var isGrp = isGroupOcc_(occLabel);
  var isPartial = /나머지는 교회에서 배정/.test(occLabel); // OCC_PARTIAL: 부분그룹
  var grp = isGrp || isPartial;
  // 부분그룹은 객실 그룹가(6/24만) 미적용 → 개인 객실비(인당)만. 그룹비는 추후 인원확정 후 결정.
  var roomGroup = isGrp;
  var commonFee = roomGroup ? (roomAdd_(roomLabel) + occAdd_(occLabel)) : 0;
  var pRoom = function () { return roomGroup ? 0 : roomIndiv_(roomLabel); };
  var appType = isGrp ? '그룹' : (isPartial ? '부분' : '개인');
  var groupTotal = commonFee;
  members.forEach(function (m) {
    groupTotal += deptFee_(m.deptLabel || '') + pRoom() + (m.bus ? BUS_FEE : 0) + (seorakOn ? SEORAK_FEE : 0);
  });
  var repIdx = 0;
  for (var i = 0; i < members.length; i++) { if ((members[i].name || '').trim() === leader) { repIdx = i; break; } }
  var rows = [];
  members.forEach(function (m, idx) {
    var row = new Array(width).fill('');
    var deptLabel = m.deptLabel || '';
    var payer = isGroupMode ? (body.depositMode === 'split' ? (m.name || '') : (leader || m.name || '')) : (m.name || '');
    var set = function (c, v) { if (c >= 0) row[c] = v; };
    set(col.ts, now); set(col.email, body.email || ''); set(col.name, m.name || '');
    set(col.gender, m.gender || ''); set(col.contact, m.contact || body.contact || '');
    set(col.rep, isGroupMode ? leader : (m.name || '')); set(col.campus, m.campus || body.campus || '');
    set(col.dept, deptLabel); set(col.room, roomLabel); set(col.occ, occLabel);
    set(col.list, isGroupMode ? (body.roster || '') : '');
    set(col.bus, m.bus ? BUS_YES : BUS_NO); set(col.seorak, seorakOn ? SEORAK_YES : '');
    set(col.pay, payer); set(col.inquiry, body.inquiry || '');
    set(col.route, '앱'); set(col.gid, gid);
    set(col.grep, isGroupMode ? (leader || (members[0] && members[0].name) || '') : (m.name || ''));
    set(col.gn, members.length); set(col.type, appType);
    set(col.ifee, deptFee_(deptLabel)); set(col.iroom, pRoom());
    set(col.mbus, m.bus ? BUS_FEE : 0); set(col.mseo, seorakOn ? SEORAK_FEE : 0);
    set(col.common, idx === repIdx ? commonFee : 0); set(col.gtotal, idx === repIdx ? groupTotal : 0);
    set(col.check, '');
    set(col.note, '앱 제출(' + (isGroupMode ? '그룹·' + (body.depositMode === 'split' ? '등록비각자' : '대표자일괄') : '개인') + ')');
    rows.push(row);
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, width).setValues(rows);
  // #18 신청 결과 확인 이메일 — 프론트가 보낸 '입금 안내 문구'(복사 버튼과 동일 항목별 형식) 사용.
  var guide = body.guideText || ('총 등록 금액: ' + groupTotal.toLocaleString() + '원\n입금 계좌: 우리은행 1005803168121 주님의 교회');
  if (isPartial && guide.indexOf('추후 결정') < 0) guide += PARTIAL_NOTE; // 부분그룹 추후공지 멘트 기본 삽입(프론트 누락 대비)
  _mailTplSend_(body.email, 'submit', { name: (leader || (members[0] && members[0].name) || ''), gid: gid, guide: guide });
  return _json_({ ok: true, groupId: gid, rows: rows.length, total: groupTotal });
}

// 이름 + 이메일로 본인 신청 조회 (그룹이면 그룹 전체 반환) — #19 본인확인 키=이메일.
// (전환기 호환: 구 프론트가 보내는 전화(contact)도 폴백 매칭 → 배포 순서 무관, 조회 끊김 없음)
function _lookup_(body, sheet, H, col, width) {
  var name = (body.name || '').trim();
  var em = _email_(body.email || '');
  var ph = _digits_(body.contact || '');
  if (!name || (!em && !ph)) return _json_({ ok: false, error: '이름과 이메일을 입력해 주세요.' });
  var n = sheet.getLastRow();
  if (n < 2) return _json_({ ok: true, results: [] });
  var vals = sheet.getRange(1, 1, n, width).getValues();
  function rowObj(row, r) {
    return {
      row: r + 1, name: _gv_(row, col.name), gender: _gv_(row, col.gender), contact: _gv_(row, col.contact),
      email: _gv_(row, col.email), campus: _gv_(row, col.campus), deptLabel: _gv_(row, col.dept),
      roomLabel: _gv_(row, col.room), occLabel: _gv_(row, col.occ),
      bus: _gv_(row, col.bus).indexOf('버스') >= 0, seorak: _gv_(row, col.seorak).indexOf('원합니다') >= 0,
      inquiry: _gv_(row, col.inquiry), list: _gv_(row, col.list), groupId: _gv_(row, col.gid), rep: _gv_(row, col.grep),
      groupTotal: Number(row[col.gtotal] || 0), common: Number(row[col.common] || 0), payer: _gv_(row, col.pay), appType: _gv_(row, col.type),
    };
  }
  // 본인 행 수집 → 같은 그룹ID/같은 이메일(또는 전화)로 그룹 전체 확장
  var gids = {}, emails = {}, phones = {}, selfRows = [];
  for (var r = 1; r < n; r++) {
    var row = vals[r];
    if (_rowHidden_(row, col)) continue; // 구·삭제(ver) + 중복(route) 행 제외
    var reMail = _email_(_gv_(row, col.email)), rePh = _digits_(_gv_(row, col.contact));
    if (_gv_(row, col.name) === name && ((em && reMail === em) || (ph && rePh === ph))) {
      selfRows.push(r);
      var g = _gv_(row, col.gid); if (g) gids[g] = true;
      if (reMail) emails[reMail] = true;
      if (rePh) phones[rePh] = true;
    }
  }
  if (!selfRows.length) return _json_({ ok: true, results: [] });
  var out = [];
  for (var r2 = 1; r2 < n; r2++) {
    var rw = vals[r2]; if (!_gv_(rw, col.name)) continue;
    if (_rowHidden_(rw, col)) continue; // 구·삭제(ver) + 중복(route) 행 제외
    // 그룹 확장은 '그룹ID'로만 (이메일/전화 공유로 무관한 사람이 끌려오는 문제 방지) + 본인 행은 항상 포함
    var g2 = _gv_(rw, col.gid);
    if ((g2 && gids[g2]) || selfRows.indexOf(r2) >= 0) {
      var o = rowObj(rw, r2); o.isSelf = selfRows.indexOf(r2) >= 0; out.push(o);
    }
  }
  return _json_({ ok: true, results: out, grouped: out.length > 1, me: name });
}

// 본인 신청 수정. #19 본인확인=이름+이메일. #16 덮어쓰기 대신 새 행 생성 + 기존 행 '구' 표시.
function _update_(body, sheet, H, col, width) {
  var rowNum = Number(body.row || 0);
  if (rowNum < 2) return _json_({ ok: false, error: '잘못된 요청입니다.' });
  var row = sheet.getRange(rowNum, 1, 1, width).getValues()[0];
  // 낙관적 동시성 + 본인확인: 이름 + (이메일 또는 전화) #19 (전환기 호환)
  var keyEmail = _email_(body.email || ''), keyPh = _digits_(body.contact || '');
  var okEmail = keyEmail && _email_(_gv_(row, col.email)) === keyEmail;
  var okPh = keyPh && _digits_(_gv_(row, col.contact)) === keyPh;
  if (_gv_(row, col.name) !== (body.name || '').trim() || (!okEmail && !okPh)) {
    return _json_({ ok: false, error: '신청 정보가 변경되었습니다. 다시 조회해 주세요.' });
  }
  var gid = _gv_(row, col.gid);
  var f = body.fields || {};
  // 새 행 = 현재 행 복제 + 수정 반영 + 새 타임스탬프 (#16 데이터 버전 관리)
  var nr = row.slice();
  var set = function (c, v) { if (c >= 0) nr[c] = v; };
  set(col.ts, new Date());
  if (col.ver >= 0) nr[col.ver] = '';
  if (f.gender != null) set(col.gender, f.gender);
  if (f.contact != null) set(col.contact, f.contact);
  if (f.email != null) set(col.email, f.email);
  if (f.campus != null) set(col.campus, f.campus);
  if (f.deptLabel != null) set(col.dept, f.deptLabel);
  if (f.bus != null) set(col.bus, f.bus ? BUS_YES : BUS_NO);
  if (f.seorak != null) set(col.seorak, f.seorak ? SEORAK_YES : '');
  if (f.inquiry != null) set(col.inquiry, f.inquiry);
  if (col.route >= 0) set(col.route, '앱수정');
  if (col.note >= 0) set(col.note, '본인수정 ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'MM-dd HH:mm'));
  if (col.ver >= 0) {
    sheet.getRange(rowNum, col.ver + 1).setValue('구'); // 기존 행 보존+구 표시
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, width).setValues([nr]); // 새 행 추가
  } else {
    sheet.getRange(rowNum, 1, 1, width).setValues([nr]); // 구버전 열 없으면 덮어쓰기 폴백
  }
  var newTotal = _recalcGroupFull_(sheet, H, col, width, gid);
  var chg = _changesText_([ // #26 무엇 → 무엇으로 바뀌었는지
    ['성별', _gv_(row, col.gender), f.gender],
    ['연락처', _gv_(row, col.contact), f.contact],
    ['이메일', _gv_(row, col.email), f.email],
    ['캠퍼스', _gv_(row, col.campus), f.campus],
    ['부서', _gv_(row, col.dept), f.deptLabel],
    ['버스', _gv_(row, col.bus).indexOf('버스') >= 0 ? '신청' : '자차', f.bus == null ? null : (f.bus ? '신청' : '자차')],
    ['설악산뷰', _gv_(row, col.seorak).indexOf('원합니다') >= 0 ? '신청' : '미신청', f.seorak == null ? null : (f.seorak ? '신청' : '미신청')],
    ['문의', _gv_(row, col.inquiry), f.inquiry],
  ]);
  _mailTplSend_(col.email >= 0 ? nr[col.email] : '', 'update', { name: body.name || '', summary: _groupSummary_(sheet, col, width, gid), changes: chg });
  return _json_({ ok: true, groupTotal: newTotal });
}

// 그룹총액 재계산 (객실/투숙은 수정 대상 아님 → 그룹공동비용 유지, 1인 항목 합산)
function _recalcGroup_(sheet, H, col, width, gid) {
  if (!gid || col.gid < 0) return 0;
  var n = sheet.getLastRow();
  var vals = sheet.getRange(1, 1, n, width).getValues();
  var idxs = [];
  for (var r = 1; r < n; r++) if (_gv_(vals[r], col.gid) === gid) idxs.push(r);
  if (!idxs.length) return 0;
  var common = 0, repR = idxs[0];
  idxs.forEach(function (r) {
    common += Number(vals[r][col.common] || 0);
    if (_gv_(vals[r], col.grep) === _gv_(vals[r], col.name)) repR = r;
  });
  var perSum = 0;
  idxs.forEach(function (r) {
    perSum += Number(vals[r][col.ifee] || 0) + Number(vals[r][col.iroom] || 0)
      + Number(vals[r][col.mbus] || 0) + Number(vals[r][col.mseo] || 0);
  });
  var total = perSum + common;
  idxs.forEach(function (r) { if (col.gtotal >= 0) sheet.getRange(r + 1, col.gtotal + 1).setValue(r === repR ? total : 0); });
  return total;
}

// 관리자: 전체 데이터 반환
function _admin_(sheet, H, col, width) {
  var n = sheet.getLastRow();
  if (n < 2) return _json_({ ok: true, rows: [] });
  var vals = sheet.getRange(1, 1, n, width).getValues();
  var out = [];
  for (var r = 1; r < n; r++) {
    var row = vals[r];
    if (!_gv_(row, col.name) && !_gv_(row, col.email)) continue;
    if (_rowUncounted_(row, col)) continue; // 구·삭제(ver) + 중복(route) + 테스트 행 제외(관리자 목록·집계)
    out.push({
      row: r + 1, name: _gv_(row, col.name), gender: _gv_(row, col.gender), contact: _gv_(row, col.contact),
      email: _gv_(row, col.email), campus: _gv_(row, col.campus), deptLabel: _gv_(row, col.dept),
      roomLabel: _gv_(row, col.room), occLabel: _gv_(row, col.occ),
      bus: _gv_(row, col.bus).indexOf('버스') >= 0, seorak: _gv_(row, col.seorak).indexOf('원합니다') >= 0,
      gid: _gv_(row, col.gid), rep: _gv_(row, col.grep), repInput: _gv_(row, col.rep), route: _gv_(row, col.route),
      list: _gv_(row, col.list), inquiry: _gv_(row, col.inquiry),
      ifee: Number(row[col.ifee] || 0), iroom: Number(row[col.iroom] || 0),
      mbus: Number(row[col.mbus] || 0), mseo: Number(row[col.mseo] || 0),
      common: Number(row[col.common] || 0), gtotal: Number(row[col.gtotal] || 0),
      check: _gv_(row, col.check), note: _gv_(row, col.note), pay: _gv_(row, col.pay),
      paid: _gv_(row, col.paid), assigned: _gv_(row, col.assigned), amemo: _gv_(row, col.amemo),
    });
  }
  return _json_({ ok: true, rows: out, cols: { paid: col.paid, assigned: col.assigned, amemo: col.amemo } });
}

// 관리자: 단일 셀 수정 (입금확인/배정방/관리자메모)
function _adminSet_(body, sheet, col, width) {
  var r = Number(body.row || 0); if (r < 2) return _json_({ ok: false, error: '잘못된 행' });
  var map = { paid: col.paid, assigned: col.assigned, amemo: col.amemo };
  var c = map[body.field];
  if (c == null || c < 0) return _json_({ ok: false, error: '알 수 없는 필드' });
  sheet.getRange(r, c + 1).setValue(body.value == null ? '' : body.value);
  return _json_({ ok: true });
}

// 그룹 접근 권한: 관리자 PIN 또는 그룹의 이메일 일치 (#19). 전환기 호환: 전화(verifyContact)도 폴백.
function _verifyGroupAccess_(vals, col, gid, body) {
  if (body.pin && body.pin === ADMIN_PIN) return true;
  var em = _email_(body.verifyEmail || '');
  var ph = _digits_(body.verifyContact || '');
  if (!em && !ph) return false;
  for (var r = 1; r < vals.length; r++) {
    if (_gv_(vals[r], col.gid) !== gid) continue;
    if (em && _email_(_gv_(vals[r], col.email)) === em) return true;
    if (ph && _digits_(_gv_(vals[r], col.contact)) === ph) return true;
  }
  return false;
}

// 그룹 전체 재계산. override={roomLabel?, occLabel?, seorak?(그룹 공통)}
function _recalcGroupFull_(sheet, H, col, width, gid, override) {
  var n = sheet.getLastRow(); if (n < 2) return 0;
  var vals = sheet.getRange(1, 1, n, width).getValues();
  var idxs = []; for (var r = 1; r < n; r++) if (_gv_(vals[r], col.gid) === gid) idxs.push(r);
  if (!idxs.length) return 0;
  // 객실/투숙 기본값은 첫 'live' 행에서 가져온다(첫 행이 옛 '구' 행이면 객실이 옛 값으로 리셋되는 버그 방지)
  var liveIdxs = idxs.filter(function (r) { return !_rowUncounted_(vals[r], col); });
  var baseRow = liveIdxs.length ? liveIdxs[0] : idxs[0];
  var roomLabel = (override && override.roomLabel != null) ? override.roomLabel : _gv_(vals[baseRow], col.room);
  var occLabel = (override && override.occLabel != null) ? override.occLabel : _gv_(vals[baseRow], col.occ);
  var seorakAll = (override && typeof override.seorak === 'boolean') ? override.seorak : null; // #11 설악 그룹 공통
  var isGrp = isGroupOcc_(occLabel);
  // 기존 신청유형 참조(강제그룹/부분 유지). 강제그룹=enrich가 '그룹', 부분그룹=OCC_PARTIAL/'부분'.
  var typeGrp = false, typePartial = false;
  if (col.type >= 0) for (var ti = 0; ti < idxs.length; ti++) { var tv = _gv_(vals[idxs[ti]], col.type); if (tv === '그룹') typeGrp = true; else if (tv === '부분') typePartial = true; }
  var isPartialMarker = /나머지는 교회에서 배정/.test(occLabel) || (!isGrp && typePartial);
  var forcedGrp = !isGrp && !isPartialMarker && typeGrp;
  var grp = isGrp || forcedGrp || isPartialMarker; // 유형/설악 등 그룹 취급(부분 포함)
  // 객실 '그룹가'(대표 공동 6/24만) 적용은 정규그룹·강제그룹만. 부분그룹은 인원 미확정 → 개인 객실비(인당)만 받고
  // 객실 그룹비는 추후 인원 확정 후 결정(공지). (이흥배 목사님 피드백: 부분그룹은 6만 없이 1만씩)
  var roomGroup = isGrp || forcedGrp;
  // dedup by name + 구/삭제 집계 제외 (#16/#17)
  var ord = idxs.slice().sort(function (a, b) { return ((col.ver >= 0 && _gv_(vals[a], col.ver) === '구') ? 1 : 0) - ((col.ver >= 0 && _gv_(vals[b], col.ver) === '구') ? 1 : 0); });
  var seen = {}, counted = {}, names = [];
  // 주의: 여기선 ver(구/삭제/테스트)만 제외한다. 'route=중복'은 recalc의 "출력"이지 입력이 아니다.
  // (중복으로 잘못 박힌 행도 후보로 보고 재계산해야, 그 사람의 유일한 행이 살아난다 — 김리아 그룹 버그)
  ord.forEach(function (r) {
    if (col.ver >= 0 && _isUncounted_(_gv_(vals[r], col.ver))) return; // 구/삭제 + 테스트만 제외
    var nm = _gv_(vals[r], col.name); if (nm && !seen[nm]) { seen[nm] = 1; counted[r] = 1; names.push(nm); }
  });
  var memberCount = names.length;
  // 그룹비: 정규그룹=투숙텍스트 / 강제그룹=인원수 / 부분=0(추후결정)
  var groupFee = isGrp ? occAdd_(occLabel) : (isPartialMarker ? 0 : groupFeeByCount_(memberCount));
  var common = roomGroup ? (roomAdd_(roomLabel) + groupFee) : 0; // 부분그룹=0(추후결정)
  var rep = ''; for (var k = 0; k < idxs.length && !rep; k++) { var mm = _gv_(vals[idxs[k]], col.rep).match(/[가-힣]{2,4}[A-Za-z0-9]*/); if (mm) rep = mm[0]; } // 접미사/숫자 보존
  if (!rep) rep = names[0] || _gv_(vals[idxs[0]], col.name);
  var repRow = idxs.filter(function (r) { return counted[r] && _gv_(vals[r], col.name) === rep; })[0];
  if (repRow === undefined) repRow = idxs.filter(function (r) { return counted[r]; })[0];
  if (repRow === undefined) repRow = idxs[0];
  var roster = names.join(' ') + ' (' + memberCount + ')';
  var seoOf = function (r) { return seorakAll !== null ? seorakAll : (_gv_(vals[r], col.seorak).indexOf('원합니다') >= 0); };
  var total = common;
  idxs.forEach(function (r) {
    if (!counted[r]) return;
    total += deptFee_(_gv_(vals[r], col.dept)) + (roomGroup ? 0 : roomIndiv_(roomLabel))
      + (_gv_(vals[r], col.bus).indexOf('버스') >= 0 ? BUS_FEE : 0)
      + (seoOf(r) ? SEORAK_FEE : 0);
  });
  var typeLabel = isPartialMarker ? '부분' : '그룹';
  idxs.forEach(function (r) {
    var row = vals[r]; var set = function (c, v) { if (c >= 0) row[c] = v; };
    if (col.ver >= 0 && _isUncounted_(_gv_(row, col.ver))) { // 구/삭제 + 테스트: 금액 0, 폼/구분값 보존 (route=중복은 여기서 재판정)
      set(col.ifee, 0); set(col.iroom, 0); set(col.mbus, 0); set(col.mseo, 0); set(col.common, 0); set(col.gtotal, 0);
      sheet.getRange(r + 1, 1, 1, width).setValues([row]); return;
    }
    var dup = !counted[r];
    set(col.room, roomLabel); set(col.occ, occLabel); set(col.list, roster);
    set(col.gn, memberCount); set(col.grep, rep);
    if (grp && col.type >= 0 && !dup) set(col.type, typeLabel);
    if (seorakAll !== null && !dup) set(col.seorak, seorakAll ? SEORAK_YES : ''); // #11 전원 동일
    set(col.ifee, dup ? 0 : deptFee_(_gv_(row, col.dept)));
    set(col.iroom, dup ? 0 : (roomGroup ? 0 : roomIndiv_(roomLabel)));
    set(col.mbus, dup ? 0 : (_gv_(row, col.bus).indexOf('버스') >= 0 ? BUS_FEE : 0));
    set(col.mseo, dup ? 0 : (seoOf(r) ? SEORAK_FEE : 0));
    set(col.common, r === repRow ? common : 0); set(col.gtotal, r === repRow ? total : 0);
    if (dup) { set(col.route, '중복'); set(col.note, '중복 재제출(집계 제외)'); }
    else if (_gv_(row, col.route) === '중복') { set(col.route, '기존폼'); if (_gv_(row, col.note) === '중복 재제출(집계 제외)') set(col.note, ''); } // 집계 대상이 된 행의 잘못된 중복표시 복구
    sheet.getRange(r + 1, 1, 1, width).setValues([row]);
  });
  return total;
}

// 그룹에 구성원 추가
function _memberAdd_(body, sheet, H, col, width) {
  var gid = String(body.gid || '');
  var n = sheet.getLastRow(); var vals = sheet.getRange(1, 1, n, width).getValues();
  if (!_verifyGroupAccess_(vals, col, gid, body)) return _json_({ ok: false, error: '권한 확인 실패(연락처/PIN)' });
  var tpl = -1; for (var r = 1; r < n; r++) if (_gv_(vals[r], col.gid) === gid && !_rowUncounted_(vals[r], col)) { tpl = r; break; }
  if (tpl < 0) for (var r = 1; r < n; r++) if (_gv_(vals[r], col.gid) === gid) { tpl = r; break; }
  if (tpl < 0) return _json_({ ok: false, error: '그룹을 찾을 수 없습니다.' });
  var m = body.member || {};
  if (!(m.name || '').trim()) return _json_({ ok: false, error: '이름을 입력해 주세요.' });
  var row = new Array(width).fill(''); var t = vals[tpl];
  var set = function (c, v) { if (c >= 0) row[c] = v; };
  set(col.ts, new Date());
  set(col.email, _gv_(t, col.email)); set(col.contact, _gv_(t, col.contact)); set(col.campus, (m.campus || _gv_(t, col.campus)));
  set(col.rep, _gv_(t, col.rep)); set(col.room, _gv_(t, col.room)); set(col.occ, _gv_(t, col.occ));
  set(col.seorak, _gv_(t, col.seorak)); set(col.pay, _gv_(t, col.pay));
  set(col.name, (m.name || '').trim()); set(col.gender, m.gender || ''); set(col.dept, m.deptLabel || '');
  set(col.bus, m.bus ? BUS_YES : BUS_NO);
  set(col.route, '앱추가'); set(col.gid, gid);
  sheet.getRange(n + 1, 1, 1, width).setValues([row]);
  var total = _recalcGroupFull_(sheet, H, col, width, gid);
  _mailTplSend_(_gv_(t, col.email), 'add', { name: (m.name || '').trim(), summary: _groupSummary_(sheet, col, width, gid) });
  return _json_({ ok: true, groupTotal: total });
}

// 그룹에서 구성원 삭제 — #17 행을 지우지 않고 '구버전 여부'에 '앱에서 삭제신청' 표시(값 보존, 집계 제외)
function _memberDelete_(body, sheet, H, col, width) {
  var gid = String(body.gid || ''); var rowNum = Number(body.row || 0);
  if (rowNum < 2) return _json_({ ok: false, error: '잘못된 행' });
  var n = sheet.getLastRow(); var vals = sheet.getRange(1, 1, n, width).getValues();
  if (!_verifyGroupAccess_(vals, col, gid, body)) return _json_({ ok: false, error: '권한 확인 실패(이메일/PIN)' });
  if (_gv_(vals[rowNum - 1], col.name) !== (body.name || '').trim()) return _json_({ ok: false, error: '정보가 변경되었습니다. 다시 조회해 주세요.' });
  var delEmail = _gv_(vals[rowNum - 1], col.email);
  if (col.ver >= 0) {
    sheet.getRange(rowNum, col.ver + 1).setValue('앱에서 삭제신청');
    if (col.note >= 0) sheet.getRange(rowNum, col.note + 1).setValue('앱 삭제신청 ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'MM-dd HH:mm'));
  } else {
    sheet.deleteRow(rowNum); // 구버전 열 없으면 폴백
  }
  // #29 대표자를 삭제한 경우: 남은 구성원 중 지정된 새 대표자로 그룹 대표자 일괄 갱신(재계산이 반영)
  if (body.newRep && col.rep >= 0) {
    var nn = sheet.getLastRow(), v2 = sheet.getRange(1, 1, nn, width).getValues();
    for (var r2 = 1; r2 < nn; r2++) if (_gv_(v2[r2], col.gid) === gid && !_rowUncounted_(v2[r2], col)) sheet.getRange(r2 + 1, col.rep + 1).setValue(body.newRep);
  }
  var total = _recalcGroupFull_(sheet, H, col, width, gid);
  var summ = total > 0 ? ('[남은 그룹 최종 내역]\n' + _groupSummary_(sheet, col, width, gid).replace(/^\[최종 등록 내역\]\n/, '')) : '본 신청은 취소 처리되었습니다.';
  _mailTplSend_(delEmail, 'delete', { name: body.name || '', summary: summ });
  return _json_({ ok: true, groupTotal: total });
}

// 그룹 객실/투숙 인원 변경
function _groupSet_(body, sheet, H, col, width) {
  var gid = String(body.gid || '');
  var n = sheet.getLastRow(); var vals = sheet.getRange(1, 1, n, width).getValues();
  if (!_verifyGroupAccess_(vals, col, gid, body)) return _json_({ ok: false, error: '권한 확인 실패(연락처/PIN)' });
  // 변경 전 값(메일 diff용) — 첫 live 행 기준
  var gEmail = '', oldRoom = '', oldOcc = '', oldSeo = '';
  for (var gi = 1; gi < vals.length; gi++) if (_gv_(vals[gi], col.gid) === gid && !_rowUncounted_(vals[gi], col)) {
    gEmail = _gv_(vals[gi], col.email);
    oldRoom = _gv_(vals[gi], col.room).split(' (')[0];
    oldOcc = _gv_(vals[gi], col.occ);
    oldSeo = _gv_(vals[gi], col.seorak).indexOf('원합니다') >= 0 ? '신청' : '미신청';
    break;
  }
  var override = {};
  if (body.roomLabel != null) override.roomLabel = body.roomLabel;
  if (body.occLabel != null) override.occLabel = body.occLabel;
  if (typeof body.seorak === 'boolean') override.seorak = body.seorak; // #11 설악 그룹 공통
  // #27 버전관리: 기존 live 행을 새 행(변경 적용·새 타임스탬프)으로 복제하고 기존 행은 '구' 표시
  if (col.ver >= 0) {
    var liveIdx = []; for (var r = 1; r < n; r++) if (_gv_(vals[r], col.gid) === gid && !_rowUncounted_(vals[r], col)) liveIdx.push(r);
    var newRows = liveIdx.map(function (r) {
      var nr = vals[r].slice();
      nr[col.ts] = new Date(); nr[col.ver] = '';
      if (override.roomLabel != null) nr[col.room] = override.roomLabel;
      if (override.occLabel != null) nr[col.occ] = override.occLabel;
      if (typeof override.seorak === 'boolean') nr[col.seorak] = override.seorak ? SEORAK_YES : '';
      if (col.route >= 0) nr[col.route] = '앱수정';
      if (col.note >= 0) nr[col.note] = '객실/인원/설악 저장 ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'MM-dd HH:mm');
      return nr;
    });
    liveIdx.forEach(function (r) { sheet.getRange(r + 1, col.ver + 1).setValue('구'); });
    if (newRows.length) sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, width).setValues(newRows);
  }
  var total = _recalcGroupFull_(sheet, H, col, width, gid, override);
  var occDisp = function (s) { if (/인원무관/.test(s)) return '인원 상관없음(추후결정)'; if (/나머지는 교회에서 배정/.test(s)) return '추후 결정'; var m = String(s).match(/(\d)인/); return m ? (m[1] + '인') : String(s).split(':')[0]; };
  var chg = _changesText_([ // #26
    ['객실', oldRoom, override.roomLabel != null ? String(override.roomLabel).split(' (')[0] : null],
    ['투숙 인원', occDisp(oldOcc), override.occLabel != null ? occDisp(override.occLabel) : null],
    ['설악산뷰', oldSeo, typeof override.seorak === 'boolean' ? (override.seorak ? '신청' : '미신청') : null],
  ]);
  _mailTplSend_(gEmail, 'groupset', { summary: _groupSummary_(sheet, col, width, gid), changes: chg });
  return _json_({ ok: true, groupTotal: total });
}

// 관리자: 사람을 다른 그룹으로 이동(대상 그룹원+본인에 공유 강제그룹) / 단독 분리 — 오버라이드 기록 후 재계산
function _moveMember_(body, sheet, col, width) {
  var name = (body.name || '').trim(); if (!name) return _json_({ ok: false, error: '이름 없음' });
  var to = String(body.to || '').trim(); if (!to) return _json_({ ok: false, error: '이동 대상 없음' });
  ensureOverrideTab();
  var osh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('오버라이드');
  var oh = osh.getRange(1, 1, 1, osh.getLastColumn()).getValues()[0];
  var ix = function (re) { for (var i = 0; i < oh.length; i++) if (re.test(String(oh[i]))) return i; return -1; };
  var cN = ix(/대상 ?이름|원본/); if (cN < 0) cN = 0;
  var cF = ix(/강제그룹/); if (cF < 0) { cF = oh.length; oh.push('강제그룹(같은 값=한 그룹)'); osh.getRange(1, cF + 1).setValue(oh[cF]); }
  var cS = ix(/분리|단독/); if (cS < 0) { cS = oh.length; oh.push('분리(단독=Y)'); osh.getRange(1, cS + 1).setValue(oh[cS]); }
  var ov = osh.getDataRange().getValues();
  var nameRow = {}; for (var i = 1; i < ov.length; i++) { var k = String(ov[i][cN] || '').trim(); if (k) nameRow[k] = i + 1; }
  var nextRow = osh.getLastRow() + 1;
  var upsert = function (nm, force, split) {
    var rr = nameRow[nm]; if (!rr) { rr = nextRow++; osh.getRange(rr, cN + 1).setValue(nm); nameRow[nm] = rr; }
    osh.getRange(rr, cF + 1).setValue(force); osh.getRange(rr, cS + 1).setValue(split);
  };
  if (to === '__solo__') {
    upsert(name, '', 'Y'); // 단독 분리
  } else {
    // to = 대상 그룹ID: 대상 그룹원들과 본인에게 공유 강제그룹 키 부여
    var n = sheet.getLastRow(); var vals = sheet.getRange(1, 1, n, width).getValues();
    var key = '', members = [];
    for (var r = 1; r < n; r++) { if (_gv_(vals[r], col.gid) === to) { var nm2 = _gv_(vals[r], col.name); if (nm2) members.push(nm2); if (!key) key = _gv_(vals[r], col.grep) || nm2; } }
    if (!members.length) return _json_({ ok: false, error: '대상 그룹을 찾지 못했습니다.' });
    key = key + ' 방';
    members.forEach(function (nm3) { upsert(nm3, key, ''); });
    upsert(name, key, ''); // 본인 합류(분리 해제)
  }
  SpreadsheetApp.flush();
  enrichSheet();
  // 배정방 자동 싱크: 그룹=방. 이동→대상 그룹 방으로, 분리→미배정(비움)
  _syncRoomToGroup_(sheet, name, to === '__solo__');
  return _json_({ ok: true });
}

// 배정방을 그룹에 자동 맞춤(그룹=방). enrich 재계산 후 호출.
//  - clearOnly=true: anchorName 사람의 배정방만 비움(단독 분리 → 미배정)
//  - 그 외: anchorName이 속한 그룹(gid) 전원 배정방 = "{대표} 방"
function _syncRoomToGroup_(sheet, anchorName, clearOnly) {
  var n = sheet.getLastRow(); if (n < 2) return;
  var lc = sheet.getLastColumn();
  var data = sheet.getRange(1, 1, n, lc).getValues();
  var H = data[0];
  var cName = findCol_(H, /등록자 이름/, 0);
  var cGid = H.indexOf('그룹ID');
  var cRep = H.indexOf('그룹대표(추정)');
  var cAsg = H.indexOf('배정방');
  if (cAsg < 0 || cName < 0) return;
  anchorName = String(anchorName || '').trim();
  if (clearOnly) {
    for (var r = 1; r < n; r++) if (String(data[r][cName] || '').trim() === anchorName) sheet.getRange(r + 1, cAsg + 1).setValue('');
    return;
  }
  var gid = '', rep = '';
  for (var r = 1; r < n; r++) {
    if (String(data[r][cName] || '').trim() === anchorName) { gid = cGid >= 0 ? data[r][cGid] : ''; rep = cRep >= 0 ? String(data[r][cRep] || '') : ''; break; }
  }
  if (!gid || cGid < 0) return;
  var label = (rep || anchorName) + ' 방';
  for (var r = 1; r < n; r++) if (data[r][cGid] === gid) sheet.getRange(r + 1, cAsg + 1).setValue(label);
}

// 관리자: 미제출 인원을 이름만으로 방배정용으로 추가 (제출경로='미제출')
function _addPlaceholder_(body, sheet, H, col, width) {
  var nm = (body.name || '').trim();
  if (!nm) return _json_({ ok: false, error: '이름을 입력하세요.' });
  var row = new Array(width).fill('');
  var set = function (c, v) { if (c >= 0) row[c] = v; };
  set(col.ts, new Date());
  set(col.name, nm); set(col.gender, body.gender || '');
  if (body.deptLabel) set(col.dept, body.deptLabel);
  if (body.campus) set(col.campus, body.campus);
  set(col.route, '미제출'); set(col.gn, 1); set(col.grep, nm);
  set(col.check, 'Y'); set(col.note, '수기 추가(미제출)');
  if (body.deptLabel) set(col.ifee, deptFee_(body.deptLabel));
  if (body.room) set(col.assigned, body.room);
  var st = H.indexOf('신청유형'); if (st >= 0) row[st] = '개인';
  var gidC = col.gid; if (gidC >= 0) set(gidC, 'P' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyMMddHHmmss') + Math.floor((sheet.getLastRow() % 97)));
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, width).setValues([row]);
  return _json_({ ok: true });
}

// 관리자: 여러 그룹을 한 그룹으로 합치기 — 오버라이드 '강제그룹'에 기록 후 enrich 재계산
function _mergeGroups_(body, sheet, H, col, width) {
  var gids = body.gids || [];
  if (gids.length < 2) return _json_({ ok: false, error: '두 개 이상의 그룹을 선택하세요.' });
  var n = sheet.getLastRow(); var vals = sheet.getRange(1, 1, n, width).getValues();
  var names = [], key = '';
  for (var r = 1; r < n; r++) {
    var g = _gv_(vals[r], col.gid);
    if (gids.indexOf(g) >= 0) { var nm = _gv_(vals[r], col.name); if (nm) names.push(nm); if (!key) key = _gv_(vals[r], col.grep) || nm; }
  }
  if (!names.length) return _json_({ ok: false, error: '해당 그룹 멤버를 찾지 못했습니다.' });
  key = key + ' 합방';
  // 오버라이드 탭에 강제그룹 기록 (ensureOverrideTab/enrichSheet 는 Migrate.gs)
  ensureOverrideTab();
  var osh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('오버라이드');
  var ov = osh.getDataRange().getValues(); var oh = ov[0];
  var ix = function (re) { for (var i = 0; i < oh.length; i++) if (re.test(String(oh[i]))) return i; return -1; };
  var cN = ix(/대상 ?이름|원본/); var cF = ix(/강제그룹/);
  if (cN < 0) { cN = 0; }
  if (cF < 0) { cF = oh.length; osh.getRange(1, cF + 1).setValue('강제그룹(같은 값=한 그룹)'); }
  var nameRow = {}; for (var i = 1; i < ov.length; i++) { var k = String(ov[i][cN] || '').trim(); if (k) nameRow[k] = i + 1; }
  var nextRow = osh.getLastRow() + 1; // 새 행은 수동 증가 (getLastRow 루프 내 미갱신 버그 방지)
  var uniq = {}; var added = 0;
  names.forEach(function (nm) {
    if (uniq[nm]) return; uniq[nm] = 1;
    var rr = nameRow[nm];
    if (!rr) { rr = nextRow++; osh.getRange(rr, cN + 1).setValue(nm); nameRow[nm] = rr; }
    osh.getRange(rr, cF + 1).setValue(key);
    added++;
  });
  SpreadsheetApp.flush(); // override 기록 확정 후 재계산
  enrichSheet(); // 재계산 → 강제그룹 반영
  _syncRoomToGroup_(sheet, names[0], false); // 합친 그룹 전원 배정방 = "{대표} 방"
  return _json_({ ok: true, merged: added, key: key });
}

// 관리자: 일괄 저장. field='assigned'|'paid'|'amemo', updates=[{row, value}]
function _adminBatch_(body, sheet, col, width) {
  var field = body.field || 'assigned';
  var map = { assigned: col.assigned, paid: col.paid, amemo: col.amemo };
  var c = map[field];
  if (c == null || c < 0) return _json_({ ok: false, error: '필드 없음' });
  var ups = body.updates || [];
  ups.forEach(function (u) {
    var r = Number(u.row || 0); if (r >= 2) sheet.getRange(r, c + 1).setValue(u.value == null ? '' : u.value);
  });
  return _json_({ ok: true, count: ups.length });
}
