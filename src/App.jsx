import React, { useState, useMemo } from 'react'

// ── 요금 데이터 (2026 전교인 리트릿) ───────────────────────────
const DEPTS = [
  { name: '장년부', fee: 278000, hint: '' },
  { name: '청년부', fee: 278000, hint: '' },
  { name: '중고등부', fee: 268000, hint: '08~13년생' },
  { name: '소년부', fee: 258000, hint: '14~15년생' },
  { name: '초등부', fee: 248000, hint: '16~17년생' },
  { name: '유년부', fee: 228000, hint: '18~19년생' },
  { name: '유치부', fee: 208000, hint: '20~21년생' },
  { name: '영유아부', fee: 198000, hint: '22~24년생' },
  { name: '영아부(돌전)', fee: 178000, hint: '25~26년생' },
]

const ROOMS = [
  { name: '소노벨 패밀리', group: 0, indiv: 0, max: 6, desc: '최대 6인 · 원룸(더블 2개) · 예배실 도보 3~5분' },
  { name: '소노벨 스위트', group: 60000, indiv: 10000, max: 8, desc: '최대 8인 · 투룸(온돌 / 더블·싱글) · 예배실 도보 3~5분' },
  { name: '소노캄 스위트', group: 240000, indiv: 40000, max: 8, desc: '최대 8인 · 투룸(싱글2 / 더블) · 예배실 옆 건물' },
]

// 투숙 인원별 그룹 추가비용 (객실당)
const OCCUPANCY = [
  { people: 8, label: '7~8인', fee: 0 },
  { people: 6, label: '6인', fee: 50000 },
  { people: 5, label: '5인', fee: 100000 },
  { people: 4, label: '4인', fee: 200000 },
  { people: 3, label: '3인', fee: 300000 },
  { people: 2, label: '2인', fee: 400000 },
  { people: 1, label: '1인', fee: 500000 },
]

const BUS_FEE = 38000
const SEORAK_FEE = 10000
const ACCOUNT = '우리은행 1005803168121 주님의 교회'

// ── 도움말 콘텐츠 (구글폼 안내문) ──────────────────────────────
const HELP = {
  general: `[일정]
· 7월 21일(화)~23일(목) · 델피노 리조트 (원암리 403-1)
· 등록기간: 6/7(주일)~6/28(주일), 3주간 (선착순)
· 문의: 이흥배 목사 010-9584-7575

[리트릿 등록 안내]
1. 신청서 제출 및 등록비 입금이 확인된 순서대로 선착순 마감됩니다. 숙소 수용 인원이 한정되어 조기 마감될 수 있습니다.
2. 가족/그룹으로 함께 등록하셔도, 인원 확인·숙소 배정을 위해 참여자별로 신청서를 개별 작성·제출해 주세요.
3. 이동은 버스 또는 자차. 버스 이용 시 신청서 8번에서 별도 신청(왕복 38,000원, 등록비 미포함).
4. 식사: 1일차 중식·석식 / 2일차 조식·석식 / 3일차 조식·중식 제공. 2일차(22일) 중식은 자유시간(자유식).
5. 입금자명(등록자 또는 가족 대표자 이름)을 정확히 적어주세요. (예: 등록비 김바울 / 버스비 김바울 / 가족 김바울 / 객실선택 김바울)
6. 자세한 사항은 주일예배(1~3부) 후 1층 안내데스크에서 문의·도움 받으실 수 있습니다.

* 이번 리트릿은 새가족 과정을 수료하신 성도님에 한해 등록하실 수 있습니다.

[가족 및 그룹 신청 안내]
1. 가족 및 원하는 성도분들과 함께 숙박을 신청하실 수 있습니다.
2. 추가 신청 항목은 가족/그룹 대표자분이 신청해 주세요.
3. 가족/그룹은 한정 수량이며, 선착순 신청·입금 순으로 마감됩니다.
4. 룸 투숙 인원 옵션당 객실당 추가비용을 기본 등록비 외에 납부해 주세요. 룸 인원이 7~8명이면 추가비용이 없습니다.

[입금 계좌]
· 우리은행 1005803168121 주님의 교회
· 리트릿 등록비·버스비·가족(그룹)룸 비용 모두 동일 계좌로 입금해 주세요.
· 환불은 등록기간 이후 숙소·버스가 확정되어 어렵습니다.

[숙소 안내]
델피노 홈페이지에서 숙소를 미리 둘러보실 수 있습니다.`,

  dept: `등록자 본인의 소속부서를 선택해 주세요. 부서(출생연도)에 따라 1인 기본 등록비가 다릅니다. [개인 비용]

· 장년부 278,000원
· 청년부 278,000원
· 중고등부 268,000원 (08~13년생)
· 소년부 258,000원 (14~15년생)
· 초등부 248,000원 (16~17년생)
· 유년부 228,000원 (18~19년생)
· 유치부 208,000원 (20~21년생)
· 영유아부 198,000원 (22~24년생)
· 영아부(돌전) 178,000원 (25~26년생)`,

  room: `객실당 추가비용이 드는 룸을 선택하실 경우, [그룹 비용]은 대표자 이름으로 한 번에 추가 입금해 주세요. (예: 객실선택 김바울)

· 소노벨 패밀리 (최대 6인, 원룸·더블침대 2개)
  → 객실당 추가비용 없음 (투숙 인원에 따른 추가비용은 별도)
· 소노벨 스위트 (최대 8인, 투룸 / 침실A 온돌, 침실B 더블1 또는 싱글2)
  → 객실당 추가 [그룹] 6만원 · [개인] 1만원
· 소노캄 스위트 (최대 8인, 투룸 / 침실A 싱글2, 침실B 더블1)
  → 객실당 추가 [그룹] 24만원 · [개인] 4만원

[위치]
· 소노벨 패밀리·스위트: 예배실·식사장소와 도보 3~5분 거리 건물동 (지하 연결통로 있음)
· 소노캄 스위트: 예배실·식사장소와 붙어있는 옆 건물동`,

  occupancy: `가족/그룹을 따로 신청하지 않는 성도님은 교회에서 방배정을 해드립니다. (추가비용 없음)

한 객실에 몇 명이 투숙하는지에 따라 객실당 추가비용이 발생합니다. 룸 인원이 7~8명이면 추가비용이 없습니다. [그룹 비용]

· 7~8인: 추가비용 없음
· 6인: 5만원
· 5인: 10만원
· 4인: 20만원
· 3인: 30만원
· 2인: 40만원
· 1인: 50만원

* 소노벨 패밀리는 최대 6인이므로, 7~8인 투숙을 원하시는 가족/그룹은 소노벨 스위트 / 소노캄 스위트를 선택해 주세요.
* 부분적으로 그룹을 원하시는 경우 신청서 7번에 상세 내용을 적어주세요. (예: 저 김바울과 김노아 2명은 다른 성도님들과 함께 (   )명 방으로 배정 / 또는 방 인원 무관) 추가비용은 추후 결정됩니다.`,

  members: `가족 및 원하는 성도분들과 함께 숙박하실 수 있습니다. 가족/그룹 대표자분이 추가 항목을 신청해 주세요.

* 가족/그룹으로 등록하셔도, 인원 확인과 숙소 배정을 위해 참여자별로 공식 신청서를 각각 따로 제출해야 합니다. (본 계산기는 금액 산정·입금 안내용)
* 가족/그룹은 한정 수량이며 선착순 신청·입금 순으로 마감됩니다.

[구성원별 버스·설악산뷰]
버스(왕복 38,000원)와 설악산뷰(1만원)는 개인 비용이라, 신청한 구성원만큼만 합산됩니다. 각 구성원의 버튼으로 선택해 주세요.`,

  move: `[버스] 이동은 버스 또는 자차를 이용하실 수 있습니다. 버스 이용을 원하시면 신청해 주세요. 버스 비용은 등록비에 포함되지 않습니다. [개인 비용]
· 왕복 버스비용: 1인 38,000원

[설악산뷰] 1인당 등록비에 1만원을 추가하여 입금하시면, 선착순으로 설악산뷰를 배정해 드립니다. [개인 비용]`,

  deposit: `원활한 확인·진행을 위해 항목별로 구분하여 따로 입금해 주세요.
가족(그룹)으로 등록하실 분은 대표자분 이름을, 개인 등록자는 본인 이름을 입금자명으로 적어 주세요.

[입금 예시] (입금내역 + 등록자/대표자 성함)
· 등록비 김바울 — 부서별 금액 (4번, 개인)
· 객실선택 김바울 — 객실별·그룹/개인 (5번)
· 가족 김바울 / 그룹 김바울 — 투숙 인원별 (6번, 그룹)
· 버스비 김바울 — 38,000원 (8번, 개인)
· 설악산 김바울 — 10,000원 (9번, 개인)

[입금 계좌]
· 우리은행 1005803168121 주님의 교회
* 환불은 등록기간 이후 숙소·버스가 확정되어 어렵습니다.`,
}

const won = (n) => n.toLocaleString('ko-KR') + '원'

function deriveOcc(count) {
  if (count >= 7) return OCCUPANCY[0]
  return OCCUPANCY.find((o) => o.people === count) || OCCUPANCY[0]
}

// ── 도움말 (탭 → 하단 시트) ────────────────────────────────────
function HelpModal({ open, title, body, onClose }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 animate-backdrop" />
      <div
        className="relative w-full max-w-[480px] bg-white rounded-t-[26px] max-h-[82vh] overflow-y-auto p-6 pb-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[#e5e8eb] rounded-full mx-auto mb-4" />
        <div className="flex justify-between items-start mb-3 gap-3">
          <h3 className="text-[16px] font-bold text-[#191f28] leading-snug">{title}</h3>
          <button onClick={onClose} className="text-[#b0b8c1] text-[20px] leading-none shrink-0 -mt-1">✕</button>
        </div>
        <div className="text-[13px] text-[#4e5968] leading-relaxed whitespace-pre-wrap">{body}</div>
        <button onClick={onClose} className="w-full mt-5 py-3 rounded-2xl bg-[#f2f4f6] text-[#4e5968] font-bold text-[14px]">
          닫기
        </button>
      </div>
    </div>
  )
}

function HelpIcon({ title, body }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        aria-label="도움말"
        className="inline-flex items-center justify-center w-5 h-5 shrink-0 text-[#b0c4e8] hover:text-[#3182f6] transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      <HelpModal open={open} title={title} body={body} onClose={() => setOpen(false)} />
    </>
  )
}

// ── 공통 UI ────────────────────────────────────────────────────
function Card({ title, badge, help, helpTitle, children }) {
  return (
    <section className="bg-white rounded-[22px] shadow-sm border border-[#f2f4f6] p-5 mb-4">
      {title && (
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-[15px] font-bold text-[#191f28] tracking-tight">{title}</h2>
          {badge != null && (
            <span className="bg-[#3182f6] text-white text-[11px] px-2 py-0.5 rounded-full font-bold">{badge}</span>
          )}
          {help && <HelpIcon title={helpTitle || title} body={help} />}
        </div>
      )}
      {children}
    </section>
  )
}

function OptionRow({ active, onClick, title, sub, right }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${
        active
          ? 'border-2 border-[#3182f6] bg-[#f2f8ff]'
          : 'border border-[#e5e8eb] bg-white hover:bg-[#f9fafb]'
      }`}
    >
      <div className="min-w-0">
        <div className={`text-[14px] font-bold ${active ? 'text-[#1b64da]' : 'text-[#333d4b]'}`}>{title}</div>
        {sub && <div className="text-[11px] text-[#8b95a1] mt-0.5 leading-snug">{sub}</div>}
      </div>
      {right != null && (
        <div className={`text-[13px] font-bold whitespace-nowrap ${active ? 'text-[#1b64da]' : 'text-[#8b95a1]'}`}>{right}</div>
      )}
    </button>
  )
}

function Toggle({ on, onChange, label, sub, price }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${
        on ? 'border-2 border-[#3182f6] bg-[#f2f8ff]' : 'border border-[#e5e8eb] bg-white'
      }`}
    >
      <div className="text-left">
        <div className={`text-[14px] font-bold ${on ? 'text-[#1b64da]' : 'text-[#333d4b]'}`}>{label}</div>
        {sub && <div className="text-[11px] text-[#8b95a1] mt-0.5">{sub}</div>}
      </div>
      <div className="flex items-center gap-2">
        {price && <span className={`text-[13px] font-bold ${on ? 'text-[#1b64da]' : 'text-[#8b95a1]'}`}>{price}</span>}
        <div className={`w-11 h-6 rounded-full p-0.5 transition-all ${on ? 'bg-[#3182f6]' : 'bg-[#d1d8e0]'}`}>
          <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
        </div>
      </div>
    </button>
  )
}

function DeptSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[#f9fafb] border border-[#e5e8eb] rounded-xl px-3 py-2.5 text-[14px] font-semibold text-[#333d4b] focus:ring-2 focus:ring-[#3182f6] focus:outline-none"
    >
      {DEPTS.map((d) => (
        <option key={d.name} value={d.name}>
          {d.name} · {won(d.fee)}{d.hint ? ` (${d.hint})` : ''}
        </option>
      ))}
    </select>
  )
}

// ── 개인 등록 ──────────────────────────────────────────────────
function IndividualMode() {
  const [dept, setDept] = useState('장년부')
  const [roomIdx, setRoomIdx] = useState(0)
  const [bus, setBus] = useState(false)
  const [seorak, setSeorak] = useState(false)
  const [name, setName] = useState('')

  const d = DEPTS.find((x) => x.name === dept)
  const room = ROOMS[roomIdx]

  const calc = useMemo(() => {
    const base = d.fee
    const roomAdd = room.indiv
    const busAmt = bus ? BUS_FEE : 0
    const seorakAmt = seorak ? SEORAK_FEE : 0
    const total = base + roomAdd + busAmt + seorakAmt
    const lines = [{ cat: '등록비', amt: base, note: d.name }]
    if (roomAdd > 0) lines.push({ cat: '객실선택', amt: roomAdd, note: room.name })
    if (busAmt > 0) lines.push({ cat: '버스비', amt: busAmt, note: '왕복' })
    if (seorakAmt > 0) lines.push({ cat: '설악산', amt: seorakAmt, note: '뷰 추가' })
    return { total, perPerson: total, lines, count: 1 }
  }, [d, room, bus, seorak])

  return (
    <>
      <Card title="소속부서 (개인 등록비)" help={HELP.dept} helpTitle="소속부서 / 등록비 안내">
        <DeptSelect value={dept} onChange={setDept} />
      </Card>

      <Card title="객실 종류 (개인 추가비용)" help={HELP.room} helpTitle="객실 종류 안내">
        <div className="space-y-2">
          {ROOMS.map((r, i) => (
            <OptionRow
              key={r.name}
              active={roomIdx === i}
              onClick={() => setRoomIdx(i)}
              title={r.name}
              sub={r.desc}
              right={r.indiv > 0 ? `+${won(r.indiv)}` : '추가없음'}
            />
          ))}
        </div>
        <p className="text-[11px] text-[#8b95a1] mt-3 leading-relaxed">
          * 가족/그룹을 따로 신청하지 않으면 교회에서 방배정을 해드립니다. (투숙인원 추가비용 없음)
        </p>
      </Card>

      <Card title="이동 / 뷰 (개인 추가비용)" help={HELP.move} helpTitle="버스 / 설악산뷰 안내">
        <div className="space-y-2">
          <Toggle on={bus} onChange={setBus} label="버스 신청 (왕복)" sub="자차 이용 시 선택 안 함" price={`+${won(BUS_FEE)}`} />
          <Toggle on={seorak} onChange={setSeorak} label="설악산 뷰 신청" sub="선착순 배정" price={`+${won(SEORAK_FEE)}`} />
        </div>
      </Card>

      <Card title="입금자명 (선택)">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 김바울"
          className="w-full bg-[#f9fafb] border border-[#e5e8eb] rounded-xl px-3 py-2.5 text-[14px] focus:ring-2 focus:ring-[#3182f6] focus:outline-none"
        />
      </Card>

      <ResultPanel calc={calc} name={name} mode="개인" />
    </>
  )
}

// ── 가족 / 그룹 등록 ──────────────────────────────────────────
function GroupMode() {
  const [leader, setLeader] = useState('')
  const [members, setMembers] = useState([{ dept: '장년부', bus: false, seorak: false }])
  const [roomIdx, setRoomIdx] = useState(1)
  const [occOverride, setOccOverride] = useState(null) // null = 자동(인원수 기준)

  const room = ROOMS[roomIdx]
  const count = members.length
  const effOcc = occOverride != null ? OCCUPANCY.find((o) => o.label === occOverride) : deriveOcc(count)

  const updateMember = (i, patch) =>
    setMembers((m) => m.map((mm, idx) => (idx === i ? { ...mm, ...patch } : mm)))
  const addMember = () => setMembers((m) => [...m, { dept: '장년부', bus: false, seorak: false }])
  const removeMember = (i) => setMembers((m) => (m.length > 1 ? m.filter((_, idx) => idx !== i) : m))

  const calc = useMemo(() => {
    const baseSum = members.reduce((s, m) => s + (DEPTS.find((d) => d.name === m.dept)?.fee || 0), 0)
    const busCount = members.filter((m) => m.bus).length
    const seorakCount = members.filter((m) => m.seorak).length
    const roomGroup = room.group
    const occFee = effOcc.fee
    const busTotal = busCount * BUS_FEE
    const seorakTotal = seorakCount * SEORAK_FEE
    const total = baseSum + roomGroup + occFee + busTotal + seorakTotal

    const lines = [{ cat: '등록비', amt: baseSum, note: `${count}명 합산` }]
    if (roomGroup > 0) lines.push({ cat: '객실선택', amt: roomGroup, note: room.name })
    if (occFee > 0) lines.push({ cat: '그룹', amt: occFee, note: `${effOcc.label} 투숙` })
    if (busTotal > 0) lines.push({ cat: '버스비', amt: busTotal, note: `${busCount}명` })
    if (seorakTotal > 0) lines.push({ cat: '설악산', amt: seorakTotal, note: `${seorakCount}명` })

    return {
      total,
      perPerson: Math.round(total / count),
      lines,
      count,
      overMax: count > room.max,
    }
  }, [members, room, effOcc, count])

  return (
    <>
      <Card title="대표자 이름 (입금자명)">
        <input
          value={leader}
          onChange={(e) => setLeader(e.target.value)}
          placeholder="예: 김바울 (모든 항목 대표자 이름으로 입금)"
          className="w-full bg-[#f9fafb] border border-[#e5e8eb] rounded-xl px-3 py-2.5 text-[14px] focus:ring-2 focus:ring-[#3182f6] focus:outline-none"
        />
      </Card>

      <Card title="구성원" badge={count} help={HELP.members} helpTitle="가족 · 그룹 신청 안내">
        <div className="space-y-3">
          {members.map((m, i) => (
            <div key={i} className="bg-[#f9fafb] rounded-2xl p-3 border border-[#f2f4f6]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-bold text-[#4e5968]">{i + 1}번 {i === 0 ? '(대표자)' : ''}</span>
                {members.length > 1 && (
                  <button onClick={() => removeMember(i)} className="text-[12px] font-bold text-[#f04452]">삭제</button>
                )}
              </div>
              <DeptSelect value={m.dept} onChange={(v) => updateMember(i, { dept: v })} />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => updateMember(i, { bus: !m.bus })}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-bold border transition-all ${
                    m.bus ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#8b95a1]'
                  }`}
                >
                  버스 {m.bus ? '✓' : ''}
                </button>
                <button
                  onClick={() => updateMember(i, { seorak: !m.seorak })}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-bold border transition-all ${
                    m.seorak ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#8b95a1]'
                  }`}
                >
                  설악산뷰 {m.seorak ? '✓' : ''}
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={addMember}
          className="w-full mt-3 py-3 rounded-2xl text-[13px] font-bold text-[#3182f6] bg-[#f2f8ff] border-2 border-dashed border-[#3182f6]/30 hover:bg-[#e8f3ff]"
        >
          + 구성원 추가
        </button>
      </Card>

      <Card title="객실 종류 (그룹 추가비용)" help={HELP.room} helpTitle="객실 종류 안내">
        <div className="space-y-2">
          {ROOMS.map((r, i) => (
            <OptionRow
              key={r.name}
              active={roomIdx === i}
              onClick={() => setRoomIdx(i)}
              title={r.name}
              sub={r.desc}
              right={r.group > 0 ? `+${won(r.group)}` : '추가없음'}
            />
          ))}
        </div>
        {calc.overMax && (
          <p className="text-[12px] text-[#f04452] font-bold mt-3">
            ⚠ 구성원 {count}명이 선택한 객실 최대 인원({room.max}인)을 초과합니다.
          </p>
        )}
      </Card>

      <Card title="투숙 인원 (그룹 추가비용)" help={HELP.occupancy} helpTitle="투숙 인원 / 방배정 안내">
        <p className="text-[12px] text-[#8b95a1] mb-3 leading-relaxed">
          한 객실에 몇 명이 투숙하는지에 따른 추가비용입니다. 기본값은 구성원 수 기준이며, 다르면 직접 선택하세요.
          <br />7~8인 투숙 시 추가비용 없음.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setOccOverride(null)}
            className={`py-2.5 rounded-xl text-[12px] font-bold border transition-all ${
              occOverride == null ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#8b95a1]'
            }`}
          >
            자동 ({deriveOcc(count).label})
          </button>
          {OCCUPANCY.map((o) => (
            <button
              key={o.label}
              onClick={() => setOccOverride(o.label)}
              className={`py-2.5 rounded-xl text-[12px] font-bold border transition-all ${
                occOverride === o.label ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#8b95a1]'
              }`}
            >
              {o.label} {o.fee > 0 ? `+${(o.fee / 10000)}만` : '0'}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[#8b95a1] mt-3 leading-relaxed">
          * 부분 그룹을 원하시면 신청서 7번에 상세 내용을 적어주세요. (추가비용 추후 결정)
        </p>
      </Card>

      <ResultPanel calc={calc} name={leader} mode="그룹" />
    </>
  )
}

// ── 결과 / 입금 안내 ──────────────────────────────────────────
function ResultPanel({ calc, name, mode }) {
  const [copied, setCopied] = useState(false)
  const who = name?.trim() || (mode === '그룹' ? '대표자' : '이름')

  const guideText = useMemo(() => {
    const lines = calc.lines
      .map((l) => `▸ ${l.cat} ${who}   ${won(l.amt)}${l.note ? `  (${l.note})` : ''}`)
      .join('\n')
    const perLine = calc.count > 1 ? `\n(1인 평균 ${won(calc.perPerson)} · ${calc.count}명)` : ''
    return `[2026 전교인 리트릿 등록 입금 안내]\n입금 계좌: ${ACCOUNT}\n\n${lines}\n─────────────────\n총 합계: ${won(calc.total)}${perLine}\n\n* 위 항목별로 구분하여 따로 입금해 주세요.\n  (입금자명: ${who})`
  }, [calc, who])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(guideText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('복사에 실패했습니다. 길게 눌러 직접 복사해 주세요.')
    }
  }

  return (
    <div className="mt-2">
      {/* 총액 카드 */}
      <div className="bg-[#191f28] text-white rounded-[26px] shadow-xl p-6 mb-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-[80px]" />
        <div className="text-[#adb5bd] text-[13px] font-bold mb-2">총 등록 금액</div>
        <div className="text-[34px] font-extrabold tracking-tight leading-none">
          {calc.total.toLocaleString('ko-KR')}
          <span className="text-xl font-medium text-[#adb5bd] ml-1">원</span>
        </div>
        {calc.count > 1 && (
          <div className="mt-4 pt-4 border-t border-white/10 flex justify-between text-[13px]">
            <span className="text-[#adb5bd]">1인 평균 ({calc.count}명)</span>
            <span className="font-bold text-[#3182f6]">{won(calc.perPerson)}</span>
          </div>
        )}
      </div>

      {/* 입금 분할 */}
      <Card title="입금 안내 (항목별 따로 입금)" help={HELP.deposit} helpTitle="입금 방법 안내">
        <div className="space-y-2.5">
          {calc.lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-[#f2f4f6] last:border-0">
              <div>
                <span className="inline-block bg-[#f2f8ff] text-[#1b64da] text-[12px] font-bold px-2 py-0.5 rounded-lg mr-2">
                  {l.cat} {who}
                </span>
                {l.note && <span className="text-[11px] text-[#8b95a1]">{l.note}</span>}
              </div>
              <span className="text-[14px] font-bold text-[#191f28]">{won(l.amt)}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 bg-[#f9fafb] rounded-2xl p-4">
          <div className="text-[12px] text-[#8b95a1] font-semibold mb-1">입금 계좌</div>
          <div className="text-[14px] font-bold text-[#191f28]">{ACCOUNT}</div>
        </div>

        <button
          onClick={copy}
          className="w-full mt-3 py-3.5 rounded-2xl bg-[#3182f6] hover:bg-[#1b64da] text-white font-bold text-[15px] transition-all shadow-lg"
        >
          {copied ? '✓ 복사 완료' : '입금 안내 문구 복사하기'}
        </button>
      </Card>
    </div>
  )
}

// 헤더 "등록 안내 전체보기" 버튼
function GuideButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#f2f8ff] text-[#3182f6] font-bold text-[12px] hover:bg-[#e8f3ff] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        등록 안내 전체보기
      </button>
      <HelpModal open={open} title="2026 전교인 리트릿 등록 안내" body={HELP.general} onClose={() => setOpen(false)} />
    </>
  )
}

// ── 메인 ───────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState('개인')

  return (
    <div className="min-h-screen bg-[#f2f4f6] text-[#333d4b] pb-12 animate-fade-in">
      <div className="max-w-[480px] mx-auto px-4 pt-6">
        {/* 헤더 */}
        <header className="mb-5">
          <div className="text-[12px] font-bold text-[#3182f6] mb-1">BUILD HIS CHURCH</div>
          <h1 className="text-[22px] font-extrabold text-[#191f28] tracking-tight leading-tight">
            2026 전교인 리트릿<br />등록비 계산기
          </h1>
          <div className="mt-3 bg-white rounded-2xl border border-[#f2f4f6] p-4 text-[12px] text-[#4e5968] leading-relaxed">
            📅 7/21(화)~23(목) · 델피노 리조트<br />
            📝 등록기간 6/7~6/28 (선착순) · 문의 이흥배 목사 010-9584-7575<br />
            <span className="text-[#8b95a1]">* 새가족 과정 수료자에 한해 등록 가능</span>
            <GuideButton />
          </div>
        </header>

        {/* 모드 탭 */}
        <div className="flex gap-1.5 bg-[#e9ecef] p-1.5 rounded-[16px] mb-4 sticky top-2 z-10">
          {['개인', '그룹'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-3 text-[14px] font-bold rounded-[12px] transition-all ${
                mode === m ? 'bg-white text-[#3182f6] shadow-md' : 'text-[#8b95a1]'
              }`}
            >
              {m === '개인' ? '개인 등록' : '가족 · 그룹 등록'}
            </button>
          ))}
        </div>

        {mode === '개인' ? <IndividualMode /> : <GroupMode />}

        <p className="text-[11px] text-[#b0b8c1] text-center mt-6 leading-relaxed">
          본 계산기는 입금 편의를 위한 참고용입니다.<br />
          정확한 등록은 공식 신청서 제출 기준이며, 환불은 등록기간 이후 어렵습니다.<br />
          가족/그룹은 구성원별로 신청서를 각각 제출해야 합니다.
        </p>
      </div>
    </div>
  )
}
