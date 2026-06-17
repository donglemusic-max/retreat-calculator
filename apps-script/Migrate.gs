/**
 * 2026 전교인 리트릿 — 응답 시트 정리/마이그레이션 (Phase 1)
 *
 * 무엇을 하나:
 *   기존 구글폼 응답(1인 1행)을 보존한 채, 오른쪽에 "앱 컬럼"을 자동 부여한다.
 *   - 이메일로 가족/그룹을 복원하고 그룹ID 부여
 *   - 부서별 등록비, 객실/투숙(그룹당 1회), 버스/설악산(인당) 금액 계산
 *   - 명단(7번)에 더 적혀 있는데 제출 안 한 인원 → "확인필요" 자동 플래그
 *
 * 사용법:
 *   1) 응답 시트에서 [확장 프로그램] → [Apps Script]
 *   2) 이 파일 내용을 붙여넣고 저장
 *   3) 함수 enrichSheet 실행 → 권한 승인
 *   4) 시트 오른쪽에 앱 컬럼이 채워진다 (다시 실행하면 재계산 = 멱등)
 *
 * 비고:
 *   - 기존 폼 컬럼은 건드리지 않는다 (오른쪽에 컬럼만 추가).
 *   - 폼에 새 응답이 들어오면 enrichSheet 재실행(또는 onFormSubmit 트리거)으로 갱신.
 */

// ── 요금표 ────────────────────────────────────────────────
var DEPT_FEE = {
  '장년부': 278000, '청년부': 278000, '중고등부': 268000, '소년부': 258000,
  '초등부': 248000, '유년부': 228000, '유치부': 208000, '영유아부': 198000, '영아부': 178000,
};
var BUS_FEE = 38000;
var SEORAK_FEE = 10000;

// 앱이 추가하는 컬럼 (헤더 텍스트 = 식별자, 멱등 재계산)
var APP_COLS = [
  '제출경로', '그룹ID', '그룹대표(추정)', '그룹인원(제출)',
  '1인등록비', '본인객실', '본인버스', '본인설악산',
  '그룹공동비용(객실+투숙)', '그룹총액',
  '확인필요', '비고',
];

function deptFee_(t) { for (var k in DEPT_FEE) if (t.indexOf(k) >= 0) return DEPT_FEE[k]; return 0; }
function roomAdd_(t) { return t.indexOf('소노캄') >= 0 ? 240000 : (t.indexOf('소노벨 스위트') >= 0 ? 60000 : 0); }   // 그룹가
function roomIndiv_(t) { return t.indexOf('소노캄') >= 0 ? 40000 : (t.indexOf('소노벨 스위트') >= 0 ? 10000 : 0); } // 개인가
function isGroupOcc_(t) { return /인이 투숙/.test(t); } // "N인이 투숙" = 그룹 객실 신청
function occAdd_(t) {
  var m = t.match(/(\d)인이 투숙/); if (!m) return 0;
  return ({ 6: 50000, 5: 100000, 4: 200000, 3: 300000, 2: 400000, 1: 500000 })[+m[1]] || 0;
}
// 입금자명/대표자칸에서 카테고리 단어를 걷어내고 이름 토큰만 추출
function repTokens_(p) {
  return (p || '')
    .replace(/가족룸|그룹룸|객실선택|등록비|버스비|설악산|가족|그룹|소노벨|소노캄|페밀리|패밀리|스위트|룸|뷰|선택|신청|원룸|개인비용|개인/g, '')
    .replace(/[,()0-9.\/]/g, ' ').trim().split(/\s+/).filter(function (x) { return x; });
}
// 명단 텍스트에서 한글 이름 토큰 개수 추정
function listCount_(t) {
  if (!t) return 0;
  var m = t.match(/\((\d+)\)/); if (m) return +m[1];
  var n = t.split(/[ ,]+/).filter(function (x) {
    return x && /[가-힣]/.test(x) && !/투숙|신청|상관|방|명|배정|따로|교회|추가|비용|없|있|캠퍼스|원|님이|적|어요/.test(x);
  });
  return n.length;
}

function findCol_(headers, re, occurrence) {
  var seen = 0;
  for (var i = 0; i < headers.length; i++) {
    if (re.test(String(headers[i]))) { if (seen === (occurrence || 0)) return i; seen++; }
  }
  return -1;
}

function enrichSheet() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var rng = sheet.getDataRange();
  var data = rng.getValues();
  if (data.length < 2) { SpreadsheetApp.getUi().alert('데이터가 없습니다.'); return; }
  var headers = data[0];

  // 기존 폼 컬럼 위치 탐색 (헤더 텍스트 기준)
  var C = {
    email: findCol_(headers, /이메일/, 0),
    name: findCol_(headers, /등록자 이름/, 0),
    rep: findCol_(headers, /그룹의 대표자/, 0),
    campus: findCol_(headers, /캠퍼스/, 0),
    dept: findCol_(headers, /소속부서/, 0),
    room: findCol_(headers, /객실/, 0),
    occ: findCol_(headers, /가족\/그룹을 신청/, 0),
    list: findCol_(headers, /명단/, 0),
    bus: findCol_(headers, /버스 신청 혹은 자차/, 0),
    seorak: findCol_(headers, /설악산뷰/, 0),
    pay: findCol_(headers, /입금자명/, 0),
  };

  // 앱 컬럼 위치 확보 (없으면 오른쪽에 추가)
  var appColIdx = {};
  APP_COLS.forEach(function (label) {
    var idx = headers.indexOf(label);
    if (idx < 0) { idx = headers.length; headers.push(label); }
    appColIdx[label] = idx;
  });
  var totalCols = headers.length;

  var get = function (row, key) { return C[key] >= 0 ? String(data[row][C[key]] || '').trim() : ''; };

  // 1) 이메일 기준 그룹핑
  var groups = {}; // key -> [rowIndex,...]
  for (var r = 1; r < data.length; r++) {
    var em = get(r, 'email') || ('noemail_' + get(r, 'name') + '_' + r);
    (groups[em] = groups[em] || []).push(r);
  }

  // 2) 그룹별 계산
  var out = {}; // rowIndex -> {label: value}
  var gid = 0;
  Object.keys(groups).forEach(function (key) {
    gid++;
    var gidStr = 'G' + ('00' + gid).slice(-3);
    var members = groups[key];
    var names = members.map(function (r) { return get(r, 'name'); });

    // 객실비용: "N인 투숙"(그룹)이면 그룹가를 그룹당 1회 + 투숙비. 아니면(교회배정/부분그룹) 개인 객실가를 인당.
    var roomL0 = get(members[0], 'room');
    var occL0 = get(members[0], 'occ');
    var isGrp = isGroupOcc_(occL0);
    var commonFee = isGrp ? (roomAdd_(roomL0) + occAdd_(occL0)) : 0;
    var pRoom = function (r) { return isGrp ? 0 : roomIndiv_(get(r, 'room')); };

    // 대표자 추정: 대표자칸 → 입금자명 토큰(멤버이름 일치) → 장년부 → 첫행
    var rep = '';
    for (var i = 0; i < members.length && !rep; i++) {
      var v = get(members[i], 'rep'); var mm = v.match(/[가-힣]{2,4}/); if (mm) rep = mm[0];
    }
    if (!rep) {
      outer:
      for (var i2 = 0; i2 < members.length; i2++) {
        var toks = repTokens_(get(members[i2], 'pay'));
        for (var j = 0; j < toks.length; j++) if (names.indexOf(toks[j]) >= 0) { rep = toks[j]; break outer; }
      }
    }
    if (!rep) { var jang = members.filter(function (r) { return get(r, 'dept').indexOf('장년부') >= 0; }); if (jang.length) rep = get(jang[0], 'name'); }
    if (!rep) rep = names[0];

    // 명단 인원 vs 제출 인원 → 확인필요
    var listN = 0, listRaw = '';
    members.forEach(function (r) { var n = listCount_(get(r, 'list')); if (n > listN) { listN = n; listRaw = get(r, 'list'); } });
    var needCheck = (listN > members.length);

    // 대표행 = 이름이 rep와 같은 첫 행, 없으면 첫 행
    var repRow = members.filter(function (r) { return get(r, 'name') === rep; })[0];
    if (repRow === undefined) repRow = members[0];

    var groupTotal = members.reduce(function (s, r) {
      return s + deptFee_(get(r, 'dept')) + pRoom(r)
        + (get(r, 'bus').indexOf('버스') >= 0 ? BUS_FEE : 0)
        + (get(r, 'seorak').indexOf('원합니다') >= 0 ? SEORAK_FEE : 0);
    }, 0) + commonFee;

    members.forEach(function (r) {
      out[r] = {
        '제출경로': '기존폼',
        '그룹ID': gidStr,
        '그룹대표(추정)': rep,
        '그룹인원(제출)': members.length,
        '1인등록비': deptFee_(get(r, 'dept')),
        '본인객실': pRoom(r),
        '본인버스': get(r, 'bus').indexOf('버스') >= 0 ? BUS_FEE : 0,
        '본인설악산': get(r, 'seorak').indexOf('원합니다') >= 0 ? SEORAK_FEE : 0,
        '그룹공동비용(객실+투숙)': r === repRow ? commonFee : 0,
        '그룹총액': r === repRow ? groupTotal : 0,
        '확인필요': needCheck ? 'Y' : '',
        '비고': needCheck ? ('명단 ' + listN + '명 / 제출 ' + members.length + '명 — 명단: ' + listRaw) : '',
      };
    });
  });

  // 3) 시트에 기록 (헤더 + 앱 컬럼 값만 업데이트)
  // 헤더 행 보강
  var headerRange = sheet.getRange(1, 1, 1, totalCols);
  var headerRow = headerRange.getValues()[0];
  for (var h = 0; h < totalCols; h++) headerRow[h] = headers[h];
  headerRange.setValues([headerRow]);

  // 본문 앱 컬럼 값
  var writeCols = APP_COLS.map(function (l) { return appColIdx[l]; });
  var minCol = Math.min.apply(null, writeCols);
  var maxCol = Math.max.apply(null, writeCols);
  var width = maxCol - minCol + 1;
  var body = [];
  for (var r3 = 1; r3 < data.length; r3++) {
    var line = new Array(width).fill('');
    var o = out[r3] || {};
    APP_COLS.forEach(function (l) { line[appColIdx[l] - minCol] = (o[l] !== undefined ? o[l] : ''); });
    body.push(line);
  }
  sheet.getRange(2, minCol + 1, body.length, width).setValues(body);

  SpreadsheetApp.getActiveSpreadsheet().toast('정리 완료: ' + gid + '개 그룹', '리트릿', 5);
}

/** 폼 제출 시 자동 갱신하려면, 이 함수로 설치형 트리거를 1회 등록 */
function installOnFormSubmit() {
  ScriptApp.newTrigger('enrichSheet')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onFormSubmit()
    .create();
}
