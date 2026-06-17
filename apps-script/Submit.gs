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

function doGet() { return _json_({ ok: true, msg: '리트릿 제출 엔드포인트 (POST 사용)' }); }

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
var ADMIN_PIN = '2026';        // ← 관리자 PIN (원하는 번호로 바꾸세요)
var ADMIN_COLS = ['입금확인', '배정방', '관리자메모']; // 관리자 전용 컬럼 (없으면 자동 생성)

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
    check: H.indexOf('확인필요'), note: H.indexOf('비고'),
    paid: H.indexOf('입금확인'), assigned: H.indexOf('배정방'), amemo: H.indexOf('관리자메모'),
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
function _digits_(s) { return String(s || '').replace(/[^0-9]/g, ''); }
function _gv_(row, c) { return c >= 0 ? String(row[c] || '').trim() : ''; }
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
    // 관리자 액션: 컬럼 보강 후 폭/헤더 갱신
    if (action === 'admin' || action === 'adminSet' || action === 'adminBatch') {
      if (body.pin !== ADMIN_PIN) return _json_({ ok: false, error: 'PIN이 올바르지 않습니다.' });
      H = _ensureAdminCols_(sheet, H);
      width = H.length;
      var acol = _colMap_(H);
      if (action === 'admin') return _admin_(sheet, H, acol, width);
      if (action === 'adminSet') return _adminSet_(body, sheet, acol, width);
      if (action === 'adminBatch') return _adminBatch_(body, sheet, acol, width);
    }
    var col = _colMap_(H);
    if (action === 'lookup') return _lookup_(body, sheet, H, col, width);
    if (action === 'update') return _update_(body, sheet, H, col, width);
    return _submit_(body, sheet, col, width);
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
  var commonFee = isGrp ? (roomAdd_(roomLabel) + occAdd_(occLabel)) : 0;
  var pRoom = function () { return isGrp ? 0 : roomIndiv_(roomLabel); };
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
    set(col.rep, isGroupMode ? leader : (m.name || '')); set(col.campus, body.campus || '');
    set(col.dept, deptLabel); set(col.room, roomLabel); set(col.occ, occLabel);
    set(col.list, isGroupMode ? (body.roster || '') : '');
    set(col.bus, m.bus ? BUS_YES : BUS_NO); set(col.seorak, seorakOn ? SEORAK_YES : '');
    set(col.pay, payer); set(col.inquiry, body.inquiry || '');
    set(col.route, '앱'); set(col.gid, gid);
    set(col.grep, isGroupMode ? (leader || (members[0] && members[0].name) || '') : (m.name || ''));
    set(col.gn, members.length);
    set(col.ifee, deptFee_(deptLabel)); set(col.iroom, pRoom());
    set(col.mbus, m.bus ? BUS_FEE : 0); set(col.mseo, seorakOn ? SEORAK_FEE : 0);
    set(col.common, idx === repIdx ? commonFee : 0); set(col.gtotal, idx === repIdx ? groupTotal : 0);
    set(col.check, '');
    set(col.note, '앱 제출(' + (isGroupMode ? '그룹·' + (body.depositMode === 'split' ? '등록비각자' : '대표자일괄') : '개인') + ')');
    rows.push(row);
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, width).setValues(rows);
  return _json_({ ok: true, groupId: gid, rows: rows.length, total: groupTotal });
}

// 이름 + 연락처(숫자만)로 본인 신청 조회 (그룹이면 그룹 전체 반환)
function _lookup_(body, sheet, H, col, width) {
  var name = (body.name || '').trim();
  var ph = _digits_(body.contact || '');
  if (!name || !ph) return _json_({ ok: false, error: '이름과 연락처를 입력해 주세요.' });
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
      groupTotal: Number(row[col.gtotal] || 0), payer: _gv_(row, col.pay),
    };
  }
  // 본인 행 + 연결 신호 수집 (그룹이 이메일별로 쪼개진 경우 대비)
  var gids = {}, phones = {}, mentioned = {}, selfNames = {}, selfRows = [];
  for (var r = 1; r < n; r++) {
    var row = vals[r];
    if (_gv_(row, col.name) === name && _digits_(_gv_(row, col.contact)) === ph) {
      selfRows.push(r);
      var g = _gv_(row, col.gid); if (g) gids[g] = true;
      phones[_digits_(_gv_(row, col.contact))] = true;
      selfNames[_gv_(row, col.name)] = true;
      _nameTokens_(_gv_(row, col.list)).forEach(function (t) { mentioned[t] = true; });
    }
  }
  if (!selfRows.length) return _json_({ ok: true, results: [] });
  // 확장: 같은 그룹ID / 같은 전화번호 / 본인이 명단에 적은 사람 / 본인을 명단에 적은 사람
  var out = [];
  for (var r2 = 1; r2 < n; r2++) {
    var rw = vals[r2]; var nm = _gv_(rw, col.name); if (!nm) continue;
    var match = gids[_gv_(rw, col.gid)] || phones[_digits_(_gv_(rw, col.contact))] || mentioned[nm];
    if (!match) {
      var toks = _nameTokens_(_gv_(rw, col.list));
      for (var t = 0; t < toks.length && !match; t++) if (selfNames[toks[t]]) match = true;
    }
    if (match) { var o = rowObj(rw, r2); o.isSelf = selfRows.indexOf(r2) >= 0; out.push(o); }
  }
  return _json_({ ok: true, results: out, grouped: out.length > 1, me: name });
}

// 본인 신청 수정 (개인 필드만: 성별/연락처/이메일/캠퍼스/부서/버스/설악산/문의)
function _update_(body, sheet, H, col, width) {
  var rowNum = Number(body.row || 0);
  if (rowNum < 2) return _json_({ ok: false, error: '잘못된 요청입니다.' });
  var row = sheet.getRange(rowNum, 1, 1, width).getValues()[0];
  // 낙관적 동시성: 조회 후 행이 밀렸는지 이름+연락처로 검증
  if (_gv_(row, col.name) !== (body.name || '').trim() || _digits_(_gv_(row, col.contact)) !== _digits_(body.contact || '')) {
    return _json_({ ok: false, error: '신청 정보가 변경되었습니다. 다시 조회해 주세요.' });
  }
  var f = body.fields || {};
  var set = function (c, v) { if (c >= 0) row[c] = v; };
  if (f.gender != null) set(col.gender, f.gender);
  if (f.contact != null) set(col.contact, f.contact);
  if (f.email != null) set(col.email, f.email);
  if (f.campus != null) set(col.campus, f.campus);
  if (f.deptLabel != null) { set(col.dept, f.deptLabel); set(col.ifee, deptFee_(f.deptLabel)); }
  if (f.bus != null) { set(col.bus, f.bus ? BUS_YES : BUS_NO); set(col.mbus, f.bus ? BUS_FEE : 0); }
  if (f.seorak != null) { set(col.seorak, f.seorak ? SEORAK_YES : ''); set(col.mseo, f.seorak ? SEORAK_FEE : 0); }
  if (f.inquiry != null) set(col.inquiry, f.inquiry);
  if (col.note >= 0) set(col.note, (_gv_(row, col.note) + ' / 본인수정 ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'MM-dd HH:mm')).trim().replace(/^\/ /, ''));
  sheet.getRange(rowNum, 1, 1, width).setValues([row]);
  var newTotal = _recalcGroup_(sheet, H, col, width, _gv_(row, col.gid));
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
    out.push({
      row: r + 1, name: _gv_(row, col.name), gender: _gv_(row, col.gender), contact: _gv_(row, col.contact),
      email: _gv_(row, col.email), campus: _gv_(row, col.campus), deptLabel: _gv_(row, col.dept),
      roomLabel: _gv_(row, col.room), occLabel: _gv_(row, col.occ),
      bus: _gv_(row, col.bus).indexOf('버스') >= 0, seorak: _gv_(row, col.seorak).indexOf('원합니다') >= 0,
      gid: _gv_(row, col.gid), rep: _gv_(row, col.grep), route: _gv_(row, col.route),
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
