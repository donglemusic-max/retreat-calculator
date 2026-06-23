/* 리트릿 신청→조회 전 경로 시뮬레이션 — 프론트 calc vs 백엔드 _submit_/enrich/recalc, CRUD 불변식 검증.
   .gs / App.jsx 로직을 그대로 이식. node scripts/sim.cjs */
'use strict'
let PASS = 0, FAIL = 0
const fails = []
function check(name, cond, detail) { if (cond) PASS++; else { FAIL++; fails.push(name + (detail ? ' — ' + detail : '')) } }

// ── 요금 상수/헬퍼 (Migrate.gs / App.jsx 동일) ──
const DEPT = { 장년부: 278000, 청년부: 278000, 중고등부: 268000, 소년부: 258000, 초등부: 248000, 유년부: 228000, 유치부: 208000, 영유아부: 198000, 영아부: 178000 }
const BUS = 38000, SEO = 10000
const deptFee = (t) => { for (const k in DEPT) if ((t || '').indexOf(k) >= 0) return DEPT[k]; return 0 }
const roomAdd = (t) => t.indexOf('소노캄') >= 0 ? 240000 : (t.indexOf('소노벨 스위트') >= 0 ? 60000 : 0)
const roomIndiv = (t) => t.indexOf('소노캄') >= 0 ? 40000 : (t.indexOf('소노벨 스위트') >= 0 ? 10000 : 0)
const isGroupOcc = (t) => /인이 투숙/.test(t)
const occAdd = (t) => { const m = t.match(/(\d)인이 투숙/); if (!m) return 0; return ({ 6: 50000, 5: 100000, 4: 200000, 3: 300000, 2: 400000, 1: 500000 })[+m[1]] || 0 }
const groupFeeByCount = (n) => ({ 1: 500000, 2: 400000, 3: 300000, 4: 200000, 5: 100000, 6: 50000 })[n] || 0
const isVoid = (v) => { v = String(v || ''); return v === '구' || v.indexOf('삭제') >= 0 }

// 객실 라벨(부분 문자열만 맞으면 됨), 투숙 formLabel
const ROOMS = [
  { name: '소노벨 패밀리', group: 0, indiv: 0, label: '소노벨 패밀리 (원룸)' },
  { name: '소노벨 스위트', group: 60000, indiv: 10000, label: '소노벨 스위트 (투룸)' },
  { name: '소노캄 스위트', group: 240000, indiv: 40000, label: '소노캄 스위트 (투룸)' },
]
const OCC = { // people -> formLabel, fee
  8: { label: '7~8인이 투숙합니다: 추가 비용 없음', fee: 0 },
  6: { label: '6인이 투숙합니다: [그룹 비용] 5만원', fee: 50000 },
  5: { label: '5인이 투숙합니다: [그룹 비용] 10만원', fee: 100000 },
  4: { label: '4인이 투숙합니다: [그룹 비용] 20만원', fee: 200000 },
  3: { label: '3인이 투숙합니다: [그룹 비용] 30만원', fee: 300000 },
  2: { label: '2인이 투숙합니다: [그룹 비용] 40만원', fee: 400000 },
  1: { label: '1인이 투숙합니다: [그룹 비용] 50만원', fee: 500000 },
}
const OCC_CHURCH = '가족/그룹을 따로 신청하지 않고 교회에서 정해주시는 대로 신청합니다. 추가 비용 없음'
const OCC_PARTIAL = '부분 그룹 신청 (나머지는 교회에서 배정, 추가비용 추후 결정)'

// ── 프론트 calc ──
function feCalcIndividual({ dept, room, bus, seorak }) {
  return deptFee(dept) + room.indiv + (bus ? BUS : 0) + (seorak ? SEO : 0)
}
function feCalcGroup({ members, room, occPeople, seorak, partial }) {
  const baseSum = members.reduce((s, m) => s + deptFee(m.dept), 0)
  const occFee = partial ? 0 : OCC[occPeople].fee
  const busCount = members.filter((m) => m.bus).length
  return baseSum + room.group + occFee + busCount * BUS + (seorak ? members.length * SEO : 0)
}

// ── 백엔드 _submit_ groupTotal (현재 코드: OCC_PARTIAL 특별처리 없음) ──
function beSubmitTotal({ members, roomLabel, occLabel, seorak }) {
  const isGrp = isGroupOcc(occLabel)
  const isPartial = /나머지는 교회에서 배정/.test(occLabel)
  const grp = isGrp || isPartial
  const common = grp ? (roomAdd(roomLabel) + (isGrp ? occAdd(occLabel) : 0)) : 0
  const pRoom = grp ? 0 : roomIndiv(roomLabel)
  let t = common
  members.forEach((m) => { t += deptFee(m.dept) + pRoom + (m.bus ? BUS : 0) + (seorak ? SEO : 0) })
  return t
}

// ── enrich / _recalcGroupFull_ 공통 그룹 재계산 (구·삭제 제외, 강제·부분 분기) ──
function recalc(rowsAll, gid, { forced = false, occOverride = null, roomOverride = null, seorakAll = null } = {}) {
  const idxs = rowsAll.filter((r) => r.gid === gid)
  if (!idxs.length) return { total: 0, count: 0 }
  const live = idxs.filter((r) => !isVoid(r.ver)); const base = live[0] || idxs[0] // 유효(비void) 행 기준으로 객실/투숙 결정
  const roomLabel = roomOverride != null ? roomOverride : base.roomLabel
  const occLabel = occOverride != null ? occOverride : base.occLabel
  const isGrp = isGroupOcc(occLabel)
  const typeGrp = idxs.some((r) => r.appType === '그룹')
  const typePartial = idxs.some((r) => r.appType === '부분')
  const isPartialMarker = /나머지는 교회에서 배정/.test(occLabel) || (!isGrp && typePartial)
  const forcedGrp = !isGrp && !isPartialMarker && (forced || typeGrp)
  const grp = isGrp || forcedGrp || isPartialMarker
  const counted = idxs.filter((r) => !isVoid(r.ver))
  const seen = {}, mem = []
  counted.forEach((r) => { if (!seen[r.name]) { seen[r.name] = 1; mem.push(r) } })
  const count = mem.length
  const groupFee = isGrp ? occAdd(occLabel) : (isPartialMarker ? 0 : groupFeeByCount(count))
  const common = grp ? (roomAdd(roomLabel) + groupFee) : 0
  const seoOf = (r) => seorakAll !== null ? seorakAll : r.seorak
  let total = common
  mem.forEach((r) => { total += deptFee(r.dept) + (grp ? 0 : roomIndiv(roomLabel)) + (r.bus ? BUS : 0) + (seoOf(r) ? SEO : 0) })
  return { total, count, appType: isPartialMarker ? '부분' : grp ? '그룹' : '개인' }
}

// ── 인메모리 시트 + 핸들러 ──
let SHEET = [], GIDC = 0
function submit({ mode, members, roomLabel, occLabel, email, leader, seorak, partial, fillGap }) {
  const gid = 'A' + (++GIDC)
  let roster = members.map((m) => m.name).join(' ') + ' (' + members.length + ')'
  if (partial) roster += ' [부분그룹·나머지 교회배정]'
  else if (fillGap > 0) roster += ' [빈자리 ' + fillGap + '자리 교회배정 요청]'
  members.forEach((m) => SHEET.push({ gid, name: m.name, email, dept: m.dept, roomLabel, occLabel, bus: !!m.bus, seorak: !!seorak, ver: '', appType: '', roster, rep: mode === '그룹' ? leader : m.name }))
  return gid
}
// enrich: 모든 gid 클러스터 재계산 → appType/저장총액 갱신
function enrich() {
  const gids = [...new Set(SHEET.map((r) => r.gid))]
  const stored = {}
  gids.forEach((gid) => {
    const idxs = SHEET.filter((r) => r.gid === gid)
    const forced = false
    const r = recalc(SHEET, gid, { forced })
    idxs.forEach((row) => { row.appType = r.appType })
    stored[gid] = r
  })
  return stored
}
function lookup(name, email) {
  // void 제외 + 이름·이메일 매칭 → gid 확장
  const self = SHEET.filter((r) => !isVoid(r.ver) && r.name === name && r.email === email)
  if (!self.length) return []
  const gids = new Set(self.map((r) => r.gid))
  return SHEET.filter((r) => !isVoid(r.ver) && gids.has(r.gid))
}
function update(name, email, patch) { // #16 새 행 + 기존 '구'
  const old = SHEET.find((r) => !isVoid(r.ver) && r.name === name && r.email === email)
  if (!old) return false
  const nr = { ...old, ...patch, ver: '' }
  old.ver = '구'
  SHEET.push(nr)
  return recalc(SHEET, nr.gid)
}
function del(name, email) { // #17 마크
  const row = SHEET.find((r) => !isVoid(r.ver) && r.name === name && r.email === email)
  if (!row) return false
  row.ver = '앱에서 삭제신청'
  return recalc(SHEET, row.gid)
}

// ════════════ 1) 개인: 모든 부서 × 객실 × 버스 × 설악 (전조합) ════════════
for (const dept of Object.keys(DEPT)) for (const room of ROOMS) for (const bus of [0, 1]) for (const seorak of [0, 1]) {
  SHEET = []; GIDC = 0
  const fe = feCalcIndividual({ dept, room, bus, seorak })
  const be = beSubmitTotal({ members: [{ dept, bus }], roomLabel: room.label, occLabel: OCC_CHURCH, seorak })
  check(`개인 ${dept} ${room.name} bus${bus} seo${seorak} FE=BE`, fe === be, `FE=${fe} BE=${be}`)
  const gid = submit({ mode: '개인', members: [{ name: '김개인', dept, bus }], roomLabel: room.label, occLabel: OCC_CHURCH, email: 'a@x.com', leader: '김개인', seorak })
  const en = enrich()[gid]
  check(`개인 enrich=FE ${dept} ${room.name}`, en.total === fe, `enrich=${en.total} FE=${fe}`)
  const r = lookup('김개인', 'a@x.com')
  check(`개인 조회 1건 ${room.name}`, r.length === 1)
}

// ════════════ 2) 그룹: 객실 × 투숙(1~8) × 인원 × 입금 × 버스 × 설악 ════════════
const depts = ['장년부', '청년부', '중고등부', '소년부', '초등부']
for (const room of ROOMS) for (const occP of [8, 6, 5, 4, 3, 2, 1]) for (const count of [2, 3, 4, 5, 6, 7, 8]) for (const seorak of [0, 1]) for (const busAll of [0, 1]) {
  const members = Array.from({ length: count }, (_, i) => ({ name: 'G' + i, dept: depts[i % depts.length], bus: busAll }))
  const fe = feCalcGroup({ members, room, occPeople: occP, seorak, partial: false })
  const be = beSubmitTotal({ members, roomLabel: room.label, occLabel: OCC[occP].label, seorak })
  check(`그룹 ${room.name} occ${occP} n${count} seo${seorak} bus${busAll} FE=BE`, fe === be, `FE=${fe} BE=${be}`)
  // enrich 재계산도 동일해야 (정상 그룹)
  SHEET = []; GIDC = 0
  const gid = submit({ mode: '그룹', members: members.map((m, i) => ({ ...m, name: 'g' + i })), roomLabel: room.label, occLabel: OCC[occP].label, email: 'g@x.com', leader: 'g0', seorak })
  const en = enrich()[gid]
  check(`그룹 enrich=FE ${room.name} occ${occP} n${count}`, en.total === fe, `enrich=${en.total} FE=${fe}`)
  check(`그룹 enrich count ${count}`, en.count === count, `count=${en.count}`)
}

// ════════════ 3) 부분그룹(OCC_PARTIAL): 프론트(그룹가) vs 백엔드 — 버스·설악 전조합 ════════════
for (const room of ROOMS) for (const count of [2, 3, 4]) for (const seorak of [0, 1]) for (const busAll of [0, 1]) {
  const members = Array.from({ length: count }, (_, i) => ({ name: 'P' + i, dept: '장년부', bus: busAll }))
  const fe = feCalcGroup({ members, room, occPeople: count, seorak, partial: true }) // 프론트: room.group + occ0 + 등록·버스·설악
  const beSub = beSubmitTotal({ members, roomLabel: room.label, occLabel: OCC_PARTIAL, seorak }) // _submit_ 현재
  SHEET = []; GIDC = 0
  const gid = submit({ mode: '그룹', members: members.map((m, i) => ({ ...m, name: 'p' + i })), roomLabel: room.label, occLabel: OCC_PARTIAL, email: 'p@x.com', leader: 'p0', seorak, partial: true })
  const en = enrich()[gid]
  check(`부분 _submit_=FE ${room.name} n${count} seo${seorak} bus${busAll}`, beSub === fe, `submit=${beSub} FE=${fe}`)
  check(`부분 enrich=FE ${room.name} n${count} seo${seorak} bus${busAll}`, en.total === fe, `enrich=${en.total} FE=${fe}`)
  check(`부분 유형='부분' ${room.name} n${count}`, en.appType === '부분', `type=${en.appType}`)
  check(`부분 투숙비0(그룹비 미부과) ${room.name}`, en.total === members.reduce((s) => s, 0) + roomAdd(room.label) + count * 278000 + (busAll ? count * BUS : 0) + (seorak ? count * SEO : 0), `total=${en.total}`)
}

// ════════════ 4) 수정(#16): 새 행+구, 조회 1건 유지, 부서변경 반영 ════════════
{
  SHEET = []; GIDC = 0
  const gid = submit({ mode: '개인', members: [{ name: '수정군', dept: '청년부', bus: 0 }], roomLabel: ROOMS[0].label, occLabel: OCC_CHURCH, email: 'e@x.com', leader: '수정군', seorak: 0 })
  enrich()
  update('수정군', 'e@x.com', { dept: '장년부', bus: true })
  const r = lookup('수정군', 'e@x.com')
  check('수정 후 조회 1건(구 제외)', r.length === 1, `len=${r.length}`)
  check('수정 후 부서 반영', r[0].dept === '장년부' && r[0].bus === true)
  check('구 행 보존(시트엔 2행)', SHEET.filter((x) => x.name === '수정군').length === 2)
  check('구 행은 void', SHEET.find((x) => x.ver === '구') != null)
}

// ════════════ 5) 삭제(#17): 마크, 조회 제외, 인원 -1 ════════════
{
  SHEET = []; GIDC = 0
  const gid = submit({ mode: '그룹', members: [{ name: 'D0' }, { name: 'D1' }, { name: 'D2' }].map((m) => ({ ...m, dept: '장년부' })), roomLabel: ROOMS[2].label, occLabel: OCC[3].label, email: 'd@x.com', leader: 'D0', seorak: 0 })
  enrich()
  const before = lookup('D0', 'd@x.com').length
  del('D2', 'd@x.com')
  const after = lookup('D0', 'd@x.com')
  check('삭제 후 조회 인원 -1', after.length === before - 1, `${before}→${after.length}`)
  check('삭제 대상 조회 제외', !after.some((r) => r.name === 'D2'))
  check('삭제 행 보존(시트 유지)', SHEET.some((r) => r.name === 'D2' && isVoid(r.ver)))
  const rc = recalc(SHEET, gid)
  check('삭제 후 재계산 인원=2', rc.count === 2, `count=${rc.count}`)
}

// ════════════ 6) 강제그룹 합치기: 개인 2명 → 그룹, 그룹비=인원수 기준 ════════════
{
  SHEET = []; GIDC = 0
  // 개인 2명(서로 다른 gid, 같은 강제그룹), 소노캄 객실 선택했다 가정
  submit({ mode: '개인', members: [{ name: 'M0', dept: '장년부' }], roomLabel: ROOMS[2].label, occLabel: OCC_CHURCH, email: 'm0@x.com', leader: 'M0', seorak: 0 })
  submit({ mode: '개인', members: [{ name: 'M1', dept: '장년부' }], roomLabel: ROOMS[2].label, occLabel: OCC_CHURCH, email: 'm1@x.com', leader: 'M1', seorak: 0 })
  // 합치기: 같은 gid로 묶고 forced 재계산 (enrich 강제그룹 분기)
  SHEET.forEach((r) => { r.gid = 'MG' }) // union
  const rc = recalc(SHEET, 'MG', { forced: true })
  // 기대: 객실 그룹가(소노캄 24만) + 그룹비(2인=40만) + 등록비 2명
  const expect = 240000 + groupFeeByCount(2) + 278000 * 2
  check('강제그룹 합치기 총액(인원수 그룹비)', rc.total === expect, `rc=${rc.total} exp=${expect}`)
  check('강제그룹 유형=그룹', rc.appType === '그룹')
}

// ════════════ 7) 조회 키: 이메일 일치/불일치, 그룹 전체 확장 ════════════
{
  SHEET = []; GIDC = 0
  submit({ mode: '그룹', members: [{ name: '대표' }, { name: '식구1' }, { name: '식구2' }].map((m) => ({ ...m, dept: '장년부' })), roomLabel: ROOMS[1].label, occLabel: OCC[3].label, email: 'fam@x.com', leader: '대표', seorak: 0 })
  enrich()
  check('대표 이메일로 그룹 전체 조회', lookup('대표', 'fam@x.com').length === 3)
  check('식구도 대표 이메일로 조회(그룹 공유)', lookup('식구1', 'fam@x.com').length === 3)
  check('이메일 틀리면 조회 0', lookup('대표', 'wrong@x.com').length === 0)
}

// ════════════ 8) 이미 제출한 사람: 기존 그룹 조회 → 수정 → 재조회 ════════════
{
  SHEET = []; GIDC = 0
  // 며칠 전 제출된 그룹(소노벨스위트 4인) 가정
  const gid = submit({ mode: '그룹', members: [{ name: '아빠' }, { name: '엄마' }, { name: '아들' }, { name: '딸' }].map((m, i) => ({ ...m, dept: i < 2 ? '장년부' : '중고등부', bus: 0 })), roomLabel: ROOMS[1].label, occLabel: OCC[4].label, email: 'home@x.com', leader: '아빠', seorak: 0 })
  enrich()
  const before = recalc(SHEET, gid).total
  // 엄마가 버스 추가로 수정
  update('엄마', 'home@x.com', { bus: true })
  const look = lookup('아빠', 'home@x.com')
  check('기존그룹 수정후 조회 4명(구제외)', look.length === 4, `len=${look.length}`)
  check('기존그룹 수정후 엄마 버스 반영', look.find((r) => r.name === '엄마').bus === true)
  check('기존그룹 수정후 총액 +버스', recalc(SHEET, gid).total === before + BUS, `${before}→${recalc(SHEET, gid).total}`)
  check('기존그룹 구행 1개 누적', SHEET.filter((r) => r.name === '엄마' && r.ver === '구').length === 1)
}

// ════════════ 9) 재-enrich 멱등성: 두 번 돌려도 동일 ════════════
{
  SHEET = []; GIDC = 0
  submit({ mode: '그룹', members: [{ name: 'I0' }, { name: 'I1' }, { name: 'I2' }].map((m) => ({ ...m, dept: '장년부' })), roomLabel: ROOMS[2].label, occLabel: OCC[6].label, email: 'i@x.com', leader: 'I0', seorak: 1 })
  const e1 = enrich()
  const e2 = enrich()
  const gid = SHEET[0].gid
  check('enrich 멱등(총액 동일)', e1[gid].total === e2[gid].total, `${e1[gid].total} vs ${e2[gid].total}`)
  check('enrich 멱등(인원 동일)', e1[gid].count === e2[gid].count)
  // 수정 후에도 재-enrich 안정
  update('I1', 'i@x.com', { dept: '청년부' })
  const e3 = enrich(); const e4 = enrich()
  check('수정후 enrich 멱등', e3[gid].total === e4[gid].total && e3[gid].count === 3, `cnt=${e3[gid].count}`)
}

// ════════════ 10) 다중 수정: '구' 여러 개 누적돼도 최신 1건만 ════════════
{
  SHEET = []; GIDC = 0
  submit({ mode: '개인', members: [{ name: '여러번', dept: '유년부', bus: 0 }], roomLabel: ROOMS[0].label, occLabel: OCC_CHURCH, email: 'multi@x.com', leader: '여러번', seorak: 0 })
  enrich()
  update('여러번', 'multi@x.com', { dept: '초등부' })
  update('여러번', 'multi@x.com', { dept: '중고등부' })
  update('여러번', 'multi@x.com', { dept: '장년부' })
  const r = lookup('여러번', 'multi@x.com')
  check('다중수정 조회 1건', r.length === 1, `len=${r.length}`)
  check('다중수정 최신 부서', r[0].dept === '장년부')
  check('구 행 3개 누적(보존)', SHEET.filter((x) => x.ver === '구').length === 3)
}

// ════════════ 11) 원본폼 '구' 행 혼재(기존 데이터): 조회·집계 제외 ════════════
{
  SHEET = []; GIDC = 0
  const gid = 'OLD1'
  // 원본 구글폼 구버전 행 2개 + 유효행 3개 (같은 그룹)
  SHEET.push({ gid, name: '구버전킴', email: 'old@x.com', dept: '장년부', roomLabel: ROOMS[2].label, occLabel: OCC[5].label, bus: false, seorak: false, ver: '구', appType: '', rep: '대표킴' })
  SHEET.push({ gid, name: '구버전리', email: 'old@x.com', dept: '장년부', roomLabel: ROOMS[2].label, occLabel: OCC[5].label, bus: false, seorak: false, ver: '구', appType: '', rep: '대표킴' });
  ['대표킴', '멤버1', '멤버2'].forEach((nm) => SHEET.push({ gid, name: nm, email: 'old@x.com', dept: '장년부', roomLabel: ROOMS[2].label, occLabel: OCC[5].label, bus: false, seorak: false, ver: '', appType: '', rep: '대표킴' }))
  const look = lookup('대표킴', 'old@x.com')
  check('원본 구행 혼재: 조회 유효 3명만', look.length === 3, `len=${look.length}`)
  check('원본 구행 혼재: 구버전 이름 안나옴', !look.some((r) => r.name.indexOf('구버전') >= 0))
  const rc = recalc(SHEET, gid)
  check('원본 구행 혼재: 집계 인원 3', rc.count === 3, `count=${rc.count}`)
}

// ════════════ 12) 신청유형 없는 기존 행(구 _submit_) 수정·삭제 정상 ════════════
{
  SHEET = []; GIDC = 0
  const gid = 'NOTYPE'
  // appType '' 인 기존 부분그룹 행(occ=OCC_PARTIAL, 구 _submit_은 개인가 저장했었음)
  ;['부분0', '부분1'].forEach((nm) => SHEET.push({ gid, name: nm, email: 'nt@x.com', dept: '장년부', roomLabel: ROOMS[2].label, occLabel: OCC_PARTIAL, bus: false, seorak: false, ver: '', appType: '', rep: '부분0' }))
  const rc = recalc(SHEET, gid) // occ 마커로 부분 인식해야
  const expect = roomAdd(ROOMS[2].label) + 0 + 278000 * 2 // 객실그룹가 + 투숙0 + 등록2
  check('신청유형없는 부분행 recalc=그룹가', rc.total === expect && rc.appType === '부분', `rc=${rc.total} exp=${expect} type=${rc.appType}`)
  del('부분1', 'nt@x.com')
  check('신청유형없는 행 삭제 후 조회 1명', lookup('부분0', 'nt@x.com').length === 1)
}

// ════════════ 13) 같은 이메일·전화 + 다른 대표자 → 분리 (수정8 버그) ════════════
const rkOf = (r) => { const m = (r.rep || '').match(/[가-힣]{2,4}[A-Za-z0-9]*/); return m ? m[0] : '' }
function enrichCluster() { // 실제 enrich union(이메일+대표자, 전화+대표자, 대표자) 미러 → gid 재배정
  const N = SHEET.length, parent = {}; for (let i = 0; i < N; i++) parent[i] = i
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
  const uni = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb }
  const buckets = {}
  SHEET.forEach((r, i) => { if (isVoid(r.ver)) return; const k = rkOf(r); ['e' + (r.email || '') + '|' + k, 'p' + (r.phone || '') + '|' + k].forEach((bk) => { (buckets[bk] = buckets[bk] || []).push(i) }) })
  Object.values(buckets).forEach((arr) => { for (let j = 1; j < arr.length; j++) uni(arr[0], arr[j]) })
  SHEET.forEach((r, i) => { if (!isVoid(r.ver)) r.gid = 'G' + find(i) })
}
{
  SHEET = []; GIDC = 0
  SHEET.push({ gid: 'A1', name: '김마리', email: 'x@x.com', phone: '010', rep: '김마리', dept: '장년부', roomLabel: ROOMS[1].label, occLabel: OCC_CHURCH, bus: false, seorak: false, ver: '', appType: '개인' })
  SHEET.push({ gid: 'A2', name: '박테스트1', email: 'x@x.com', phone: '010', rep: '박테스트1', dept: '장년부', roomLabel: ROOMS[1].label, occLabel: OCC[2].label, bus: false, seorak: false, ver: '', appType: '그룹' })
  SHEET.push({ gid: 'A2', name: '박테스트4', email: 'x@x.com', phone: '010', rep: '박테스트1', dept: '장년부', roomLabel: ROOMS[1].label, occLabel: OCC[2].label, bus: false, seorak: false, ver: '', appType: '그룹' })
  enrichCluster()
  check('수정8: 김마리 조회 1명(박테스트 안 붙음)', lookup('김마리', 'x@x.com').length === 1, `len=${lookup('김마리', 'x@x.com').length}`)
  check('수정8: 박테스트1 조회 2명(김마리 안 붙음)', lookup('박테스트1', 'x@x.com').length === 2 && lookup('박테스트1', 'x@x.com').every((r) => r.name.indexOf('박테스트') === 0))
}
{
  SHEET = []; GIDC = 0
  ;['조형만', '조영렬', '김미정', '조윤정'].forEach((nm, i) => SHEET.push({ gid: 'O' + i, name: nm, email: 'fam@x.com', phone: '010-' + i, rep: '', dept: '장년부', roomLabel: ROOMS[2].label, occLabel: OCC[4].label, bus: false, seorak: false, ver: '', appType: '' }))
  enrichCluster()
  check('옛가족(대표자 공란·같은 이메일·다른 전화) 4명 한 그룹', lookup('조형만', 'fam@x.com').length === 4, `len=${lookup('조형만', 'fam@x.com').length}`)
}

// ════════════ 14) 7~8인 그룹비 0 / 1인·2인 고액 그룹비 경계 ════════════
for (const occP of [8, 6, 5, 4, 3, 2, 1]) {
  const expectFee = occP === 8 ? 0 : OCC[occP].fee
  check(`occ ${occP} 그룹투숙비=${expectFee}`, occAdd(OCC[occP].label) === expectFee, `got=${occAdd(OCC[occP].label)}`)
}
check('7~8인 라벨 그룹비 0', occAdd('7~8인이 투숙합니다: 추가 비용 없음') === 0)

// ════════════ 15) 수정화면 미정(부분 전환): occStatus 'pending' → 부분(그룹비 0, 객실 그룹가 유지) ════════════
for (const room of ROOMS) for (const count of [2, 3, 4, 5]) {
  SHEET = []; GIDC = 0
  // 확정 그룹으로 제출됐다가, 조회·수정에서 '미정'으로 바꿈 → occLabel을 OCC_PARTIAL로 교체(새 행)
  const gid = submit({ mode: '그룹', members: Array.from({ length: count }, (_, i) => ({ name: 'q' + i, dept: '장년부', bus: 0 })), roomLabel: room.label, occLabel: OCC[count].label, email: 'q@x.com', leader: 'q0', seorak: 0 })
  enrich()
  const before = recalc(SHEET, gid)
  check(`미정전환 전 그룹비 부과 ${room.name} n${count}`, before.total === roomAdd(room.label) + OCC[count].fee + count * 278000, `t=${before.total}`)
  // 전원 occ를 OCC_PARTIAL로 수정(미정)
  SHEET.filter((r) => r.gid === gid && !isVoid(r.ver)).forEach((r) => { const nr = { ...r, occLabel: OCC_PARTIAL, appType: '부분', ver: '' }; r.ver = '구'; SHEET.push(nr) })
  const after = recalc(SHEET, gid)
  check(`미정전환 후 그룹투숙비0·객실그룹가유지 ${room.name} n${count}`, after.total === roomAdd(room.label) + 0 + count * 278000 && after.appType === '부분', `t=${after.total} type=${after.appType}`)
}

// ════════════ 16) #20 구성원 추가 → 인원+1, 총액 +등록비 ════════════
{
  SHEET = []; GIDC = 0
  const gid = submit({ mode: '그룹', members: ['a', 'b', 'c'].map((n) => ({ name: n, dept: '장년부', bus: 0 })), roomLabel: ROOMS[1].label, occLabel: OCC[4].label, email: 'add@x.com', leader: 'a', seorak: 0 })
  enrich()
  const before = recalc(SHEET, gid)
  SHEET.push({ gid, name: 'd', email: 'add@x.com', dept: '중고등부', roomLabel: ROOMS[1].label, occLabel: OCC[4].label, bus: false, seorak: false, ver: '', appType: '그룹', rep: 'a' })
  const after = recalc(SHEET, gid)
  check('#20 구성원 추가 인원+1', after.count === before.count + 1, `${before.count}→${after.count}`)
  check('#20 구성원 추가 총액 +등록비', after.total === before.total + DEPT['중고등부'], `Δ=${after.total - before.total}`)
}

// ════════════ 17) #29 대표자 삭제 → 새 대표 재지정, 그룹 유지·인원-1 ════════════
{
  SHEET = []; GIDC = 0
  const gid = submit({ mode: '그룹', members: ['대표', '식구1', '식구2'].map((n) => ({ name: n, dept: '장년부', bus: 0 })), roomLabel: ROOMS[2].label, occLabel: OCC[3].label, email: 'rep@x.com', leader: '대표', seorak: 0 })
  enrich()
  // 대표 삭제 + 남은 구성원 식구1을 새 대표로
  const row = SHEET.find((r) => r.name === '대표' && !isVoid(r.ver)); row.ver = '앱에서 삭제신청'
  SHEET.filter((r) => r.gid === gid && !isVoid(r.ver)).forEach((r) => { r.rep = '식구1' })
  const look = lookup('식구1', 'rep@x.com')
  check('#29 대표삭제 후 조회 2명', look.length === 2, `len=${look.length}`)
  check('#29 새 대표=식구1', look.every((r) => r.rep === '식구1'))
  check('#29 삭제대표 조회 제외', !look.some((r) => r.name === '대표'))
  check('#29 재계산 인원=2', recalc(SHEET, gid).count === 2)
}

// ════════════ 18) 빈자리 교회배정(fillGap): roster 마커, 비용은 실제 인원 기준 ════════════
{
  SHEET = []; GIDC = 0
  const gid = submit({ mode: '그룹', members: ['f0', 'f1', 'f2', 'f3'].map((n) => ({ name: n, dept: '장년부', bus: 0 })), roomLabel: ROOMS[2].label, occLabel: OCC[4].label, email: 'fill@x.com', leader: 'f0', seorak: 0, fillGap: 4 })
  const en = enrich()[gid]
  check('빈자리 roster 마커 존재', SHEET.find((r) => r.gid === gid).roster.indexOf('빈자리 4자리') >= 0)
  check('빈자리 비용=실제4인 그룹가', en.total === roomAdd(ROOMS[2].label) + OCC[4].fee + 4 * 278000, `t=${en.total}`)
}

// ════════════ 19) 설악산뷰 그룹공통 토글: 전원 적용/해제 → ±count*SEO ════════════
for (const count of [2, 3, 4, 5, 6]) {
  SHEET = []; GIDC = 0
  const gid = submit({ mode: '그룹', members: Array.from({ length: count }, (_, i) => ({ name: 's' + i, dept: '장년부', bus: 0 })), roomLabel: ROOMS[1].label, occLabel: OCC[count].label, email: 's@x.com', leader: 's0', seorak: 0 })
  enrich()
  const off = recalc(SHEET, gid, { seorakAll: false }).total
  const on = recalc(SHEET, gid, { seorakAll: true }).total
  check(`설악공통 n${count} 차이=count*SEO`, on - off === count * SEO, `Δ=${on - off}`)
}

// ════════════ 20) #35 객실종류 충돌 경고 로직: 신청객실≠배정방타입 → warn ════════════
const reqType = (label) => label.indexOf('소노캄') >= 0 ? '소노캄 스위트' : label.indexOf('소노벨 스위트') >= 0 ? '소노벨 스위트' : '소노벨 패밀리'
const warnOf = (memberLabel, roomType, seed) => !seed && reqType(memberLabel) !== roomType
for (const a of ROOMS) for (const b of ROOMS) {
  const expect = a.name !== b.name
  check(`#35 warn ${a.name}신청→${b.name}방`, warnOf(a.label, b.name, false) === expect, `got=${warnOf(a.label, b.name, false)}`)
}
check('#35 씨앗방(seed)은 경고 안함', warnOf(ROOMS[2].label, '소노벨 패밀리', true) === false)

// ════════════ 21) 중복/구/삭제/테스트 행 집계·조회 제외 ════════════
{
  SHEET = []; GIDC = 0
  const gid = 'DUP1'
  SHEET.push({ gid, name: '본인', email: 'z@x.com', dept: '장년부', roomLabel: ROOMS[0].label, occLabel: OCC[3].label, bus: false, seorak: false, ver: '', appType: '그룹', rep: '본인' })
  SHEET.push({ gid, name: '본인', email: 'z@x.com', dept: '장년부', roomLabel: ROOMS[0].label, occLabel: OCC[3].label, bus: false, seorak: false, ver: '구', appType: '그룹', rep: '본인' })
  SHEET.push({ gid, name: '식구', email: 'z@x.com', dept: '장년부', roomLabel: ROOMS[0].label, occLabel: OCC[3].label, bus: false, seorak: false, ver: '', appType: '그룹', rep: '본인' })
  SHEET.push({ gid, name: '삭제자', email: 'z@x.com', dept: '장년부', roomLabel: ROOMS[0].label, occLabel: OCC[3].label, bus: false, seorak: false, ver: '앱에서 삭제신청', appType: '그룹', rep: '본인' })
  check('중복/구/삭제 제외 조회 2명', lookup('본인', 'z@x.com').length === 2, `len=${lookup('본인', 'z@x.com').length}`)
  check('중복/구/삭제 제외 집계 2명', recalc(SHEET, gid).count === 2, `count=${recalc(SHEET, gid).count}`)
}

// ════════════ 22) 캠퍼스 혼합 그룹(부산/분당)은 분리 안 됨 ════════════
{
  SHEET = []; GIDC = 0
  ;[['조형만', '부산'], ['조영렬', '분당'], ['김미정', '부산'], ['조윤정', '부산']].forEach(([nm, cmp], i) => SHEET.push({ gid: 'C' + i, name: nm, email: 'mix@x.com', phone: '010-' + i, campus: cmp, rep: '', dept: '장년부', roomLabel: ROOMS[2].label, occLabel: OCC[4].label, bus: false, seorak: false, ver: '', appType: '' }))
  enrichCluster()
  check('캠퍼스 혼합 그룹 4명 유지(분리X)', lookup('조형만', 'mix@x.com').length === 4, `len=${lookup('조형만', 'mix@x.com').length}`)
}

// ── 결과 ──
console.log(`\n시뮬레이션: PASS ${PASS} / FAIL ${FAIL}`)
if (fails.length) { console.log('\n실패 케이스:'); fails.slice(0, 40).forEach((f) => console.log(' ✗ ' + f)); if (fails.length > 40) console.log(` …외 ${fails.length - 40}건`) }
else console.log('전 케이스 통과 ✅')
