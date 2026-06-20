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
  const roomLabel = roomOverride != null ? roomOverride : idxs[0].roomLabel
  const occLabel = occOverride != null ? occOverride : idxs[0].occLabel
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

// ════════════ 1) 개인: 모든 객실 × 버스 × 설악 ════════════
for (const room of ROOMS) for (const bus of [0, 1]) for (const seorak of [0, 1]) {
  SHEET = []; GIDC = 0
  const dept = '장년부'
  const fe = feCalcIndividual({ dept, room, bus, seorak })
  const be = beSubmitTotal({ members: [{ dept, bus }], roomLabel: room.label, occLabel: OCC_CHURCH, seorak })
  check(`개인 ${room.name} bus${bus} seo${seorak} FE=BE`, fe === be, `FE=${fe} BE=${be}`)
  const gid = submit({ mode: '개인', members: [{ name: '김개인', dept, bus }], roomLabel: room.label, occLabel: OCC_CHURCH, email: 'a@x.com', leader: '김개인', seorak })
  enrich()
  const r = lookup('김개인', 'a@x.com')
  check(`개인 조회 1건 ${room.name}`, r.length === 1)
}

// ════════════ 2) 그룹: 객실 × 투숙(1~8) × 인원 × 입금 × 버스 × 설악 ════════════
const depts = ['장년부', '청년부', '중고등부', '소년부', '초등부']
for (const room of ROOMS) for (const occP of [8, 6, 5, 4, 3, 2, 1]) for (const count of [2, 3, 4, 5, 6]) for (const seorak of [0, 1]) for (const busAll of [0, 1]) {
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

// ════════════ 3) 부분그룹(OCC_PARTIAL): 프론트(그룹가) vs 백엔드 ════════════
for (const room of ROOMS) for (const count of [2, 3, 4]) {
  const members = Array.from({ length: count }, (_, i) => ({ name: 'P' + i, dept: '장년부', bus: 0 }))
  const fe = feCalcGroup({ members, room, occPeople: count, seorak: 0, partial: true }) // 프론트: room.group + occ0
  const beSub = beSubmitTotal({ members, roomLabel: room.label, occLabel: OCC_PARTIAL, seorak: 0 }) // _submit_ 현재
  SHEET = []; GIDC = 0
  const gid = submit({ mode: '그룹', members: members.map((m, i) => ({ ...m, name: 'p' + i })), roomLabel: room.label, occLabel: OCC_PARTIAL, email: 'p@x.com', leader: 'p0', seorak: 0, partial: true })
  const en = enrich()[gid]
  check(`부분 _submit_=FE ${room.name} n${count}`, beSub === fe, `submit=${beSub} FE=${fe}`)
  check(`부분 enrich=FE ${room.name} n${count}`, en.total === fe, `enrich=${en.total} FE=${fe}`)
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

// ── 결과 ──
console.log(`\n시뮬레이션: PASS ${PASS} / FAIL ${FAIL}`)
if (fails.length) { console.log('\n실패 케이스:'); fails.slice(0, 40).forEach((f) => console.log(' ✗ ' + f)); if (fails.length > 40) console.log(` …외 ${fails.length - 40}건`) }
else console.log('전 케이스 통과 ✅')
