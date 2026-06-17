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

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var body = JSON.parse(e.postData.contents);
    var sheet = _findResponseSheet_();
    var width = sheet.getLastColumn();
    var H = sheet.getRange(1, 1, 1, width).getValues()[0];

    var col = {
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
    };

    var BUS_YES = '버스 신청합니다. (1인 버스 비용 38,000원)';
    var BUS_NO = '자차를 이용합니다';
    var SEORAK_YES = '설악산 뷰 원합니다.';

    var members = body.members || [];
    if (!members.length) return _json_({ ok: false, error: '구성원이 없습니다.' });

    var now = new Date();
    var gid = 'A' + Utilities.formatDate(now, 'Asia/Seoul', 'yyMMddHHmmss');
    var isGroupMode = (body.mode === '그룹');
    var leader = (body.leader || '').trim();
    var roomLabel = body.roomLabel || '';
    var occLabel = body.occLabel || '';
    var seorakOn = !!body.seorak;
    var isGrp = isGroupOcc_(occLabel); // "N인 투숙" → 그룹 객실가

    var commonFee = isGrp ? (roomAdd_(roomLabel) + occAdd_(occLabel)) : 0;
    var pRoom = function () { return isGrp ? 0 : roomIndiv_(roomLabel); };

    var groupTotal = commonFee;
    members.forEach(function (m) {
      groupTotal += deptFee_(m.deptLabel || '') + pRoom() + (m.bus ? BUS_FEE : 0) + (seorakOn ? SEORAK_FEE : 0);
    });

    // 대표행: 이름이 leader와 같은 첫 멤버, 없으면 0
    var repIdx = 0;
    for (var i = 0; i < members.length; i++) { if ((members[i].name || '').trim() === leader) { repIdx = i; break; } }

    var rows = [];
    members.forEach(function (m, idx) {
      var row = new Array(width).fill('');
      var deptLabel = m.deptLabel || '';
      var payer = isGroupMode ? (body.depositMode === 'split' ? (m.name || '') : (leader || m.name || '')) : (m.name || '');
      var set = function (c, v) { if (c >= 0) row[c] = v; };
      set(col.ts, now);
      set(col.email, body.email || '');
      set(col.name, m.name || '');
      set(col.gender, m.gender || '');
      set(col.contact, m.contact || body.contact || '');
      set(col.rep, isGroupMode ? leader : (m.name || ''));
      set(col.campus, body.campus || '');
      set(col.dept, deptLabel);
      set(col.room, roomLabel);
      set(col.occ, occLabel);
      set(col.list, isGroupMode ? (body.roster || '') : '');
      set(col.bus, m.bus ? BUS_YES : BUS_NO);
      set(col.seorak, seorakOn ? SEORAK_YES : '');
      set(col.pay, payer);
      set(col.inquiry, body.inquiry || '');
      // 앱 컬럼
      set(col.route, '앱');
      set(col.gid, gid);
      set(col.grep, isGroupMode ? (leader || (members[0] && members[0].name) || '') : (m.name || ''));
      set(col.gn, members.length);
      set(col.ifee, deptFee_(deptLabel));
      set(col.iroom, pRoom());
      set(col.mbus, m.bus ? BUS_FEE : 0);
      set(col.mseo, seorakOn ? SEORAK_FEE : 0);
      set(col.common, idx === repIdx ? commonFee : 0);
      set(col.gtotal, idx === repIdx ? groupTotal : 0);
      set(col.check, '');
      set(col.note, '앱 제출(' + (isGroupMode ? '그룹·' + (body.depositMode === 'split' ? '등록비각자' : '대표자일괄') : '개인') + ')');
      rows.push(row);
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, width).setValues(rows);
    return _json_({ ok: true, groupId: gid, rows: rows.length, total: groupTotal });
  } catch (err) {
    return _json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}
