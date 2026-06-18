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
var SUBMIT_VERSION = 'sv9-move'; // 배포 확인용 (웹앱 URL을 브라우저로 열면 보임)
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
    // 관리자 액션: 컬럼 보강 후 폭/헤더 갱신 (PIN 필요)
    if (action === 'admin' || action === 'adminSet' || action === 'adminBatch' || action === 'mergeGroups' || action === 'addPlaceholder' || action === 'moveMember') {
      if (body.pin !== ADMIN_PIN) return _json_({ ok: false, error: 'PIN이 올바르지 않습니다.' });
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
    if (action === 'lookup') return _lookup_(body, sheet, H, col, width);
    if (action === 'update') return _update_(body, sheet, H, col, width);
    if (action === 'memberAdd') return _memberAdd_(body, sheet, H, col, width);
    if (action === 'memberDelete') return _memberDelete_(body, sheet, H, col, width);
    if (action === 'groupSet') return _groupSet_(body, sheet, H, col, width);
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
      groupTotal: Number(row[col.gtotal] || 0), common: Number(row[col.common] || 0), payer: _gv_(row, col.pay), appType: _gv_(row, col.type),
    };
  }
  // 본인 행 수집 → 같은 그룹ID/같은 전화번호로 그룹 전체 확장
  // (enrich가 이메일+전화로 그룹을 묶으므로 보통 groupId만으로 충분. 전화는 보강.)
  var gids = {}, phones = {}, selfRows = [];
  for (var r = 1; r < n; r++) {
    var row = vals[r];
    if (_gv_(row, col.name) === name && _digits_(_gv_(row, col.contact)) === ph) {
      selfRows.push(r);
      var g = _gv_(row, col.gid); if (g) gids[g] = true;
      phones[_digits_(_gv_(row, col.contact))] = true;
    }
  }
  if (!selfRows.length) return _json_({ ok: true, results: [] });
  var out = [];
  for (var r2 = 1; r2 < n; r2++) {
    var rw = vals[r2]; if (!_gv_(rw, col.name)) continue;
    if (gids[_gv_(rw, col.gid)] || phones[_digits_(_gv_(rw, col.contact))]) {
      var o = rowObj(rw, r2); o.isSelf = selfRows.indexOf(r2) >= 0; out.push(o);
    }
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

// 그룹 접근 권한: 관리자 PIN 또는 그룹의 연락처 일치
function _verifyGroupAccess_(vals, col, gid, body) {
  if (body.pin && body.pin === ADMIN_PIN) return true;
  var ph = _digits_(body.verifyContact || '');
  if (!ph) return false;
  for (var r = 1; r < vals.length; r++) if (_gv_(vals[r], col.gid) === gid && _digits_(_gv_(vals[r], col.contact)) === ph) return true;
  return false;
}

// 그룹 전체 재계산 (occ는 그룹 선택값 유지 — 인원수와 독립). override={roomLabel?, occLabel?}
function _recalcGroupFull_(sheet, H, col, width, gid, override) {
  var n = sheet.getLastRow(); if (n < 2) return 0;
  var vals = sheet.getRange(1, 1, n, width).getValues();
  var idxs = []; for (var r = 1; r < n; r++) if (_gv_(vals[r], col.gid) === gid) idxs.push(r);
  if (!idxs.length) return 0;
  var roomLabel = (override && override.roomLabel != null) ? override.roomLabel : _gv_(vals[idxs[0]], col.room);
  var occLabel = (override && override.occLabel != null) ? override.occLabel : _gv_(vals[idxs[0]], col.occ);
  var isGrp = isGroupOcc_(occLabel);
  // 강제그룹(합치기로 묶인 개인/부분): 6번 'N인 투숙' 텍스트는 없지만 enrich가 신청유형='그룹'을 남김.
  //  → 그룹 요금 유지. 객실 그룹가는 대표자 객실(roomLabel), 그룹비는 인원수 기준.
  var typeGrp = false;
  if (col.type >= 0) for (var ti = 0; ti < idxs.length; ti++) if (_gv_(vals[idxs[ti]], col.type) === '그룹') { typeGrp = true; break; }
  var forcedGrp = !isGrp && typeGrp;
  var grp = isGrp || forcedGrp;
  // dedup by name (구버전 후순위)
  var ord = idxs.slice().sort(function (a, b) { return ((col.ver >= 0 && _gv_(vals[a], col.ver) === '구') ? 1 : 0) - ((col.ver >= 0 && _gv_(vals[b], col.ver) === '구') ? 1 : 0); });
  var seen = {}, counted = {}, names = [];
  ord.forEach(function (r) { var nm = _gv_(vals[r], col.name); if (nm && !seen[nm]) { seen[nm] = 1; counted[r] = 1; names.push(nm); } });
  var memberCount = names.length;
  var common = grp ? (roomAdd_(roomLabel) + (isGrp ? occAdd_(occLabel) : groupFeeByCount_(memberCount))) : 0;
  var rep = ''; for (var k = 0; k < idxs.length && !rep; k++) { var mm = _gv_(vals[idxs[k]], col.rep).match(/[가-힣]{2,4}/); if (mm) rep = mm[0]; }
  if (!rep) rep = names[0] || _gv_(vals[idxs[0]], col.name);
  var repRow = idxs.filter(function (r) { return counted[r] && _gv_(vals[r], col.name) === rep; })[0];
  if (repRow === undefined) repRow = idxs.filter(function (r) { return counted[r]; })[0];
  if (repRow === undefined) repRow = idxs[0];
  var roster = names.join(' ') + ' (' + memberCount + ')';
  var total = common;
  idxs.forEach(function (r) {
    if (!counted[r]) return;
    total += deptFee_(_gv_(vals[r], col.dept)) + (grp ? 0 : roomIndiv_(roomLabel))
      + (_gv_(vals[r], col.bus).indexOf('버스') >= 0 ? BUS_FEE : 0)
      + (_gv_(vals[r], col.seorak).indexOf('원합니다') >= 0 ? SEORAK_FEE : 0);
  });
  idxs.forEach(function (r) {
    var dup = !counted[r]; var row = vals[r]; var set = function (c, v) { if (c >= 0) row[c] = v; };
    set(col.room, roomLabel); set(col.occ, occLabel); set(col.list, roster);
    set(col.gn, memberCount); set(col.grep, rep);
    if (grp && col.type >= 0 && !dup) set(col.type, '그룹'); // 강제그룹 유지(편집해도 그룹 요금 보존)
    set(col.ifee, dup ? 0 : deptFee_(_gv_(row, col.dept)));
    set(col.iroom, dup ? 0 : (grp ? 0 : roomIndiv_(roomLabel)));
    set(col.mbus, dup ? 0 : (_gv_(row, col.bus).indexOf('버스') >= 0 ? BUS_FEE : 0));
    set(col.mseo, dup ? 0 : (_gv_(row, col.seorak).indexOf('원합니다') >= 0 ? SEORAK_FEE : 0));
    set(col.common, r === repRow ? common : 0); set(col.gtotal, r === repRow ? total : 0);
    if (dup) { set(col.route, '중복'); set(col.note, '중복 재제출(집계 제외)'); }
    sheet.getRange(r + 1, 1, 1, width).setValues([row]);
  });
  return total;
}

// 그룹에 구성원 추가
function _memberAdd_(body, sheet, H, col, width) {
  var gid = String(body.gid || '');
  var n = sheet.getLastRow(); var vals = sheet.getRange(1, 1, n, width).getValues();
  if (!_verifyGroupAccess_(vals, col, gid, body)) return _json_({ ok: false, error: '권한 확인 실패(연락처/PIN)' });
  var tpl = -1; for (var r = 1; r < n; r++) if (_gv_(vals[r], col.gid) === gid) { tpl = r; break; }
  if (tpl < 0) return _json_({ ok: false, error: '그룹을 찾을 수 없습니다.' });
  var m = body.member || {};
  if (!(m.name || '').trim()) return _json_({ ok: false, error: '이름을 입력해 주세요.' });
  var row = new Array(width).fill(''); var t = vals[tpl];
  var set = function (c, v) { if (c >= 0) row[c] = v; };
  set(col.ts, new Date());
  set(col.email, _gv_(t, col.email)); set(col.contact, _gv_(t, col.contact)); set(col.campus, _gv_(t, col.campus));
  set(col.rep, _gv_(t, col.rep)); set(col.room, _gv_(t, col.room)); set(col.occ, _gv_(t, col.occ));
  set(col.seorak, _gv_(t, col.seorak)); set(col.pay, _gv_(t, col.pay));
  set(col.name, (m.name || '').trim()); set(col.gender, m.gender || ''); set(col.dept, m.deptLabel || '');
  set(col.bus, m.bus ? BUS_YES : BUS_NO);
  set(col.route, '앱추가'); set(col.gid, gid);
  sheet.getRange(n + 1, 1, 1, width).setValues([row]);
  var total = _recalcGroupFull_(sheet, H, col, width, gid);
  return _json_({ ok: true, groupTotal: total });
}

// 그룹에서 구성원 삭제 (행 삭제)
function _memberDelete_(body, sheet, H, col, width) {
  var gid = String(body.gid || ''); var rowNum = Number(body.row || 0);
  if (rowNum < 2) return _json_({ ok: false, error: '잘못된 행' });
  var n = sheet.getLastRow(); var vals = sheet.getRange(1, 1, n, width).getValues();
  if (!_verifyGroupAccess_(vals, col, gid, body)) return _json_({ ok: false, error: '권한 확인 실패(연락처/PIN)' });
  if (_gv_(vals[rowNum - 1], col.name) !== (body.name || '').trim()) return _json_({ ok: false, error: '정보가 변경되었습니다. 다시 조회해 주세요.' });
  sheet.deleteRow(rowNum);
  var total = _recalcGroupFull_(sheet, H, col, width, gid);
  return _json_({ ok: true, groupTotal: total });
}

// 그룹 객실/투숙 인원 변경
function _groupSet_(body, sheet, H, col, width) {
  var gid = String(body.gid || '');
  var n = sheet.getLastRow(); var vals = sheet.getRange(1, 1, n, width).getValues();
  if (!_verifyGroupAccess_(vals, col, gid, body)) return _json_({ ok: false, error: '권한 확인 실패(연락처/PIN)' });
  var override = {};
  if (body.roomLabel != null) override.roomLabel = body.roomLabel;
  if (body.occLabel != null) override.occLabel = body.occLabel;
  var total = _recalcGroupFull_(sheet, H, col, width, gid, override);
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
  return _json_({ ok: true });
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
