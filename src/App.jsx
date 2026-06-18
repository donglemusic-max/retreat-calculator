import React, { useState, useMemo } from 'react'
import { DndContext, useDraggable, useDroppable, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'

// ── 요금 데이터 (2026 전교인 리트릿) ───────────────────────────
// label = 구글폼/시트에 기록되는 정본 문자열 (제출 시 그대로 적재 → 폼 응답과 동일)
const DEPTS = [
  { name: '장년부', fee: 278000, hint: '', label: '장년부 278,000원' },
  { name: '청년부', fee: 278000, hint: '', label: '청년부 278,000원' },
  { name: '중고등부', fee: 268000, hint: '08~13년생', label: '중고등부 268,000원 (08~13년생)' },
  { name: '소년부', fee: 258000, hint: '14~15년생', label: '소년부 258,000원 (14~15년생)' },
  { name: '초등부', fee: 248000, hint: '16~17년생', label: '초등부 248,000원 (16~17년생)' },
  { name: '유년부', fee: 228000, hint: '18~19년생', label: '유년부 228,000원 (18~19년생)' },
  { name: '유치부', fee: 208000, hint: '20~21년생', label: '유치부 208,000원 (20~21년생)' },
  { name: '영유아부', fee: 198000, hint: '22~24년생', label: '영유아부 198,000원 (22~24년생)' },
  { name: '영아부(돌전)', fee: 178000, hint: '25~26년생', label: '영아부 돌전 178,000원 (25~26년생)' },
]

const ROOMS = [
  { name: '소노벨 패밀리', group: 0, indiv: 0, max: 6, desc: '최대 6인 · 원룸(더블 2개) · 예배실 도보 3~5분',
    label: '소노벨 패밀리 (최대 인원 6인 원룸. 더블침대 2개) - 객실당 추가 비용은 없음 (인원에 따른 추가 비용은 선택에 따라 발생)' },
  { name: '소노벨 스위트', group: 60000, indiv: 10000, max: 8, desc: '최대 8인 · 투룸(온돌 / 더블·싱글) · 예배실 도보 3~5분',
    label: '소노벨 스위트 (최대 인원 8인 투룸. 침실A: 온돌 / 침실B: 더블 1개 or 싱글 2개) - 객실당 추가로 [그룹의 경우] 6만원 혹은 [개인비용] 1만원' },
  { name: '소노캄 스위트', group: 240000, indiv: 40000, max: 8, desc: '최대 8인 · 투룸(싱글2 / 더블) · 예배실 옆 건물',
    label: '소노캄 스위트 (최대 인원 8인 투룸. 침실A: 싱글 2개, 침실B: 더블 1개) - 객실당 추가로 [그룹의 경우] 24만원 혹은 [개인의 경우] 4만원' },
]

// 투숙 인원별 그룹 추가비용 (객실당). formLabel = 시트 정본 문자열
const OCCUPANCY = [
  { people: 8, label: '7~8인', fee: 0, formLabel: '7~8인이 투숙합니다: 추가 비용 없음' },
  { people: 6, label: '6인', fee: 50000, formLabel: '6인이 투숙합니다: [그룹 비용] 5만원' },
  { people: 5, label: '5인', fee: 100000, formLabel: '5인이 투숙합니다: [그룹 비용] 10만원' },
  { people: 4, label: '4인', fee: 200000, formLabel: '4인이 투숙합니다: [그룹 비용] 20만원' },
  { people: 3, label: '3인', fee: 300000, formLabel: '3인이 투숙합니다: [그룹 비용] 30만원' },
  { people: 2, label: '2인', fee: 400000, formLabel: '2인이 투숙합니다: [그룹 비용] 40만원' },
  { people: 1, label: '1인', fee: 500000, formLabel: '1인이 투숙합니다: [그룹 비용] 50만원' },
]
// 교회 배정(가족/그룹 미신청) 정본 문자열
const OCC_CHURCH = '가족/그룹을 따로 신청하지 않고 교회에서 정해주시는 대로 신청합니다. 추가 비용 없음'
const BUS_YES = '버스 신청합니다. (1인 버스 비용 38,000원)'
const BUS_NO = '자차를 이용합니다'
const SEORAK_YES = '설악산 뷰 원합니다.'
const CAMPUSES = ['분당 캠퍼스', '부산 캠퍼스']

const BUS_FEE = 38000
const SEORAK_FEE = 10000
const ACCOUNT = '우리은행 1005803168121 주님의 교회'

// 신청서 제출 Apps Script 웹앱 URL (Vercel 환경변수 VITE_SUBMIT_URL 우선, 없으면 아래 기본값)
const SUBMIT_URL =
  (import.meta.env && import.meta.env.VITE_SUBMIT_URL) ||
  'https://script.google.com/macros/s/AKfycbxSeDKQOKld3t4L6mAxS5beVV9XhWyQvHDr0PGo-ohx34CK1E1obvSC6Sz8XzDcCOgDUg/exec'

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

* 가족/그룹은 대표자가 구성원을 모두 입력해 한 번에 제출합니다. 제출 후 입금까지 완료해야 등록이 확정됩니다.
* 가족/그룹은 한정 수량이며 선착순 신청·입금 순으로 마감됩니다.

[구성원별 입력]
· 이름: 등록비를 각자 이름으로 입금할 때(입금 방식 "등록비 각자") 사용됩니다.
· 부서: 사람마다 등록비가 달라 각자 선택합니다.
· 버스: 왕복 38,000원(개인 비용)이라 신청한 구성원만 합산됩니다.`,

  seorakGroup: `1인당 등록비에 1만원을 추가하면 선착순으로 설악산뷰를 배정해 드립니다. [개인 비용]

그룹은 같은 객실에 함께 투숙하므로, 설악산뷰를 신청하면 그룹 전원에게 적용됩니다. (구성원 수 × 1만원)`,

  depositMode: `입금자명을 어떻게 적을지 선택합니다.

· 대표자 일괄: 등록비를 포함한 모든 항목을 대표자 한 사람 이름으로 입금합니다.
  (예: 등록비 김바울 / 객실선택 김바울 …)

· 등록비 각자: 등록비는 각 구성원 본인 이름으로, 공동비용(객실·그룹·버스·설악산)은 대표자 이름으로 입금합니다.
  (예: 등록 김바울 / 등록 클라우디아 / 등록 김노아 + 객실선택 김바울 / 그룹 김바울 …)
  청년 등 가족이 아닌 그룹에서 각자 등록비를 내실 때 편리합니다.`,

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

// 전화번호 하이픈 포맷 (010-1234-5678). 숫자만 추출 후 3-4-4로 표시
const fmtPhone = (v) => {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11)
  if (d.length < 4) return d
  if (d.length < 8) return d.slice(0, 3) + '-' + d.slice(3)
  return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7)
}

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

// ── 입력 필드 헬퍼 ─────────────────────────────────────────────
const inputCls =
  'w-full bg-[#f9fafb] border border-[#e5e8eb] rounded-xl px-3 py-2.5 text-[14px] focus:ring-2 focus:ring-[#3182f6] focus:outline-none'

function Field({ label, required, children }) {
  return (
    <div className="mb-3 last:mb-0">
      <label className="block text-[12px] font-semibold text-[#4e5968] mb-1.5">
        {label}{required && <span className="text-[#f04452]"> *</span>}
      </label>
      {children}
    </div>
  )
}

function SegPicker({ value, onChange, options, render }) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold border transition-all ${
            value === o ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#8b95a1]'
          }`}
        >
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  )
}

// ── 개인 등록 ──────────────────────────────────────────────────
function IndividualMode() {
  const [dept, setDept] = useState('장년부')
  const [roomIdx, setRoomIdx] = useState(0)
  const [bus, setBus] = useState(false)
  const [seorak, setSeorak] = useState(false)
  const [name, setName] = useState('')
  const [gender, setGender] = useState('')
  const [contact, setContact] = useState('')
  const [email, setEmail] = useState('')
  const [campus, setCampus] = useState('')
  const [inquiry, setInquiry] = useState('')

  const d = DEPTS.find((x) => x.name === dept)
  const room = ROOMS[roomIdx]

  const missing = []
  if (!name.trim()) missing.push('이름')
  if (!gender) missing.push('성별')
  if (!contact.trim()) missing.push('연락처')
  if (!email.trim()) missing.push('이메일')
  if (!campus) missing.push('캠퍼스')
  const submission = {
    mode: '개인', email: email.trim(), contact: contact.trim(), campus, leader: name.trim(), inquiry: inquiry.trim(),
    roomLabel: room.label, occLabel: OCC_CHURCH, seorak, depositMode: 'leader', roster: '',
    members: [{ name: name.trim(), gender, deptLabel: d.label, bus }],
  }

  const calc = useMemo(() => {
    const who = name.trim() || '이름'
    const base = d.fee
    const roomAdd = room.indiv
    const busAmt = bus ? BUS_FEE : 0
    const seorakAmt = seorak ? SEORAK_FEE : 0
    const total = base + roomAdd + busAmt + seorakAmt
    const lines = [{ cat: '등록비', payer: who, amt: base, note: d.name }]
    if (roomAdd > 0) lines.push({ cat: '객실선택', payer: who, amt: roomAdd, note: room.name })
    if (busAmt > 0) lines.push({ cat: '버스비', payer: who, amt: busAmt, note: '왕복' })
    if (seorakAmt > 0) lines.push({ cat: '설악산', payer: who, amt: seorakAmt, note: '뷰 추가' })
    return { total, perPerson: total, lines, count: 1 }
  }, [d, room, bus, seorak, name])

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

      <Card title="신청자 정보 (제출용)">
        <Field label="등록자 이름" required>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김바울" className={inputCls} />
        </Field>
        <Field label="성별" required>
          <SegPicker value={gender} onChange={setGender} options={['남', '여']} />
        </Field>
        <Field label="연락처" required>
          <input value={contact} onChange={(e) => setContact(fmtPhone(e.target.value))} placeholder="010-0000-0000" inputMode="tel" className={inputCls} />
        </Field>
        <Field label="이메일" required>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@gmail.com" inputMode="email" className={inputCls} />
        </Field>
        <Field label="주로 예배드리는 캠퍼스" required>
          <SegPicker value={campus} onChange={setCampus} options={CAMPUSES} render={(c) => c.replace(' 캠퍼스', '')} />
        </Field>
        <Field label="문의사항 (선택)">
          <textarea value={inquiry} onChange={(e) => setInquiry(e.target.value)} rows={2} className={inputCls + ' resize-none'} />
        </Field>
      </Card>

      <ResultPanel calc={calc} subtitle={`※ 입금자명: ${name.trim() || '이름'}`} />
      <SubmitSection payload={submission} valid={missing.length === 0} missing={missing} />
    </>
  )
}

// ── 가족 / 그룹 등록 ──────────────────────────────────────────
function GroupMode() {
  const [leader, setLeader] = useState('')
  const [members, setMembers] = useState([{ name: '', dept: '장년부', bus: false, gender: '' }])
  const [roomIdx, setRoomIdx] = useState(1)
  const [occOverride, setOccOverride] = useState(null) // null = 자동(인원수 기준)
  const [seorak, setSeorak] = useState(false) // 그룹 전체 적용
  const [depositMode, setDepositMode] = useState('leader') // 'leader' | 'split'
  const [email, setEmail] = useState('')
  const [contact, setContact] = useState('')
  const [campus, setCampus] = useState('')
  const [inquiry, setInquiry] = useState('')

  const room = ROOMS[roomIdx]
  const count = members.length
  const effOcc = occOverride != null ? OCCUPANCY.find((o) => o.label === occOverride) : deriveOcc(count)
  const who = leader.trim() || '대표자'

  const updateMember = (i, patch) =>
    setMembers((m) => m.map((mm, idx) => (idx === i ? { ...mm, ...patch } : mm)))
  const addMember = () => setMembers((m) => [...m, { name: '', dept: '장년부', bus: false, gender: '' }])
  const removeMember = (i) => setMembers((m) => (m.length > 1 ? m.filter((_, idx) => idx !== i) : m))

  const roster = members.map((m) => m.name.trim()).filter(Boolean).join(' ') + ` (${count})`
  const missing = []
  if (!leader.trim()) missing.push('대표자 이름')
  if (!email.trim()) missing.push('이메일')
  if (!contact.trim()) missing.push('연락처')
  if (!campus) missing.push('캠퍼스')
  members.forEach((m, i) => {
    if (!m.name.trim()) missing.push(`${i + 1}번 이름`)
    if (!m.gender) missing.push(`${i + 1}번 성별`)
  })
  const submission = {
    mode: '그룹', email: email.trim(), contact: contact.trim(), campus, leader: leader.trim(), inquiry: inquiry.trim(),
    roomLabel: room.label, occLabel: effOcc.formLabel, seorak, depositMode, roster,
    members: members.map((m) => ({ name: m.name.trim(), gender: m.gender, deptLabel: DEPTS.find((d) => d.name === m.dept).label, bus: m.bus })),
  }

  const calc = useMemo(() => {
    const memberFee = (m) => DEPTS.find((d) => d.name === m.dept)?.fee || 0
    const baseSum = members.reduce((s, m) => s + memberFee(m), 0)
    const busCount = members.filter((m) => m.bus).length
    const roomGroup = room.group
    const occFee = effOcc.fee
    const busTotal = busCount * BUS_FEE
    const seorakTotal = seorak ? count * SEORAK_FEE : 0 // 그룹 전원 적용
    const total = baseSum + roomGroup + occFee + busTotal + seorakTotal

    // 등록비: depositMode에 따라 합산(대표자) 또는 각자(구성원 이름)
    const lines = []
    if (depositMode === 'split') {
      members.forEach((m, i) =>
        lines.push({ cat: '등록', payer: m.name.trim() || `구성원${i + 1}`, amt: memberFee(m), note: m.dept }),
      )
    } else {
      lines.push({ cat: '등록비', payer: who, amt: baseSum, note: `${count}명 합산` })
    }
    // 공동비용은 항상 대표자 이름으로
    if (roomGroup > 0) lines.push({ cat: '객실선택', payer: who, amt: roomGroup, note: room.name })
    if (occFee > 0) lines.push({ cat: '그룹', payer: who, amt: occFee, note: `${effOcc.label} 투숙` })
    if (busTotal > 0) lines.push({ cat: '버스비', payer: who, amt: busTotal, note: `${busCount}명` })
    if (seorakTotal > 0) lines.push({ cat: '설악산', payer: who, amt: seorakTotal, note: `${count}명 전원` })

    return {
      total,
      perPerson: Math.round(total / count),
      lines,
      count,
      overMax: count > room.max,
    }
  }, [members, room, effOcc, count, seorak, depositMode, who])

  const subtitle =
    depositMode === 'split'
      ? `※ 등록비는 각 구성원 이름으로, 공동비용은 대표자(${who}) 이름으로 입금`
      : `※ 모든 항목 대표자(${who}) 이름으로 입금`

  return (
    <>
      <Card title="대표자 정보 (제출용)">
        <Field label="대표자 이름 (공동비용 입금자명)" required>
          <input value={leader} onChange={(e) => setLeader(e.target.value)} placeholder="예: 김바울" className={inputCls} />
        </Field>
        <Field label="대표 연락처" required>
          <input value={contact} onChange={(e) => setContact(fmtPhone(e.target.value))} placeholder="010-0000-0000" inputMode="tel" className={inputCls} />
        </Field>
        <Field label="대표 이메일" required>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@gmail.com" inputMode="email" className={inputCls} />
        </Field>
        <Field label="주로 예배드리는 캠퍼스" required>
          <SegPicker value={campus} onChange={setCampus} options={CAMPUSES} render={(c) => c.replace(' 캠퍼스', '')} />
        </Field>
        <Field label="문의사항 (선택)">
          <textarea value={inquiry} onChange={(e) => setInquiry(e.target.value)} rows={2} className={inputCls + ' resize-none'} />
        </Field>
        <p className="text-[11px] text-[#8b95a1] leading-relaxed">* 연락처·이메일은 가족/그룹 구성원 행에 공통으로 기록됩니다.</p>
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
              <input
                value={m.name}
                onChange={(e) => updateMember(i, { name: e.target.value })}
                placeholder={i === 0 ? '이름 (대표자 본인이면 위와 동일하게)' : '이름'}
                className="w-full bg-white border border-[#e5e8eb] rounded-xl px-3 py-2.5 text-[14px] mb-2 focus:ring-2 focus:ring-[#3182f6] focus:outline-none"
              />
              <div className="flex gap-2 mb-2">
                {['남', '여'].map((g) => (
                  <button
                    key={g}
                    onClick={() => updateMember(i, { gender: g })}
                    className={`flex-1 py-2 rounded-xl text-[12px] font-bold border transition-all ${
                      m.gender === g ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#8b95a1]'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <DeptSelect value={m.dept} onChange={(v) => updateMember(i, { dept: v })} />
              <button
                onClick={() => updateMember(i, { bus: !m.bus })}
                className={`w-full mt-2 py-2 rounded-xl text-[12px] font-bold border transition-all ${
                  m.bus ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#8b95a1]'
                }`}
              >
                버스 신청 {m.bus ? '✓' : ''} <span className="font-normal">(왕복 {won(BUS_FEE)})</span>
              </button>
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

      <Card title="설악산 뷰 (그룹 전체)" help={HELP.seorakGroup} helpTitle="설악산뷰 안내">
        <Toggle
          on={seorak}
          onChange={setSeorak}
          label="설악산 뷰 신청 (전원 적용)"
          sub={`그룹은 함께 투숙 → 전원 적용 · ${count}명 × ${won(SEORAK_FEE)}`}
          price={`+${won(count * SEORAK_FEE)}`}
        />
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

      <Card title="입금 방식" help={HELP.depositMode} helpTitle="입금 방식 안내">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setDepositMode('leader')}
            className={`px-3 py-3 rounded-xl text-[13px] font-bold border text-left transition-all ${
              depositMode === 'leader' ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#8b95a1]'
            }`}
          >
            대표자 일괄
            <span className="block text-[11px] font-normal mt-0.5">전 항목 대표자 이름</span>
          </button>
          <button
            onClick={() => setDepositMode('split')}
            className={`px-3 py-3 rounded-xl text-[13px] font-bold border text-left transition-all ${
              depositMode === 'split' ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#8b95a1]'
            }`}
          >
            등록비 각자
            <span className="block text-[11px] font-normal mt-0.5">등록비는 각 구성원 이름</span>
          </button>
        </div>
        {depositMode === 'split' && (
          <p className="text-[11px] text-[#8b95a1] mt-3 leading-relaxed">
            * 등록비 각자 선택 시 구성원별 이름이 입금자명에 들어갑니다. 위 구성원 이름을 정확히 입력해 주세요.
          </p>
        )}
      </Card>

      <ResultPanel calc={calc} subtitle={subtitle} />
      <SubmitSection payload={submission} valid={missing.length === 0} missing={missing} />
    </>
  )
}

// ── 결과 / 입금 안내 ──────────────────────────────────────────
function ResultPanel({ calc, subtitle }) {
  const [copied, setCopied] = useState(false)

  const guideText = useMemo(() => {
    const lines = calc.lines
      .map((l) => `▸ ${l.cat} ${l.payer}   ${won(l.amt)}${l.note ? `  (${l.note})` : ''}`)
      .join('\n')
    const perLine = calc.count > 1 ? `\n(1인 평균 ${won(calc.perPerson)} · ${calc.count}명)` : ''
    const sub = subtitle ? `${subtitle}\n` : ''
    return `[2026 전교인 리트릿 등록 입금 안내]\n입금 계좌: ${ACCOUNT}\n${sub}\n${lines}\n─────────────────\n총 합계: ${won(calc.total)}${perLine}\n\n* 위 항목별로 구분하여 따로 입금해 주세요.`
  }, [calc, subtitle])

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
        {subtitle && <p className="text-[12px] text-[#1b64da] font-semibold mb-3 leading-relaxed">{subtitle}</p>}
        <div className="space-y-2.5">
          {calc.lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-[#f2f4f6] last:border-0">
              <div>
                <span className="inline-block bg-[#f2f8ff] text-[#1b64da] text-[12px] font-bold px-2 py-0.5 rounded-lg mr-2">
                  {l.cat} {l.payer}
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

// ── 신청서 제출 ────────────────────────────────────────────────
function SubmitSection({ payload, valid, missing }) {
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')

  const submit = async () => {
    setStatus('loading'); setErr('')
    try {
      const res = await fetch(SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      })
      const j = await res.json()
      if (j.ok) { setResult(j); setStatus('done') }
      else { setErr(j.error || '제출 실패'); setStatus('error') }
    } catch (e) { setErr(String(e)); setStatus('error') }
  }

  if (!SUBMIT_URL) {
    return (
      <Card title="신청서 제출">
        <p className="text-[12px] text-[#8b95a1] leading-relaxed">
          제출 기능 준비 중입니다.<br />
          <span className="text-[#b0b8c1]">(관리자: Apps Script 웹앱 배포 후 Vercel 환경변수 <code>VITE_SUBMIT_URL</code> 설정)</span>
        </p>
      </Card>
    )
  }

  if (status === 'done') {
    return (
      <Card title="제출 완료">
        <div className="text-center py-3">
          <div className="text-[40px] mb-2">✅</div>
          <div className="text-[15px] font-bold text-[#191f28] mb-1">신청서가 제출되었습니다</div>
          <div className="text-[12px] text-[#8b95a1]">
            접수번호 {result?.groupId} · {result?.rows}명 · 총 {won(result?.total || 0)}
          </div>
          <p className="text-[12px] text-[#8b95a1] mt-3 leading-relaxed">
            입금까지 완료해야 등록이 확정됩니다.<br />위 "입금 안내"대로 항목별로 입금해 주세요.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card title="신청서 제출">
      {!valid && missing.length > 0 && (
        <p className="text-[12px] text-[#f04452] font-semibold mb-3 leading-relaxed">입력 필요: {missing.join(', ')}</p>
      )}
      {status === 'error' && <p className="text-[12px] text-[#f04452] mb-3 leading-relaxed">제출 오류: {err}</p>}
      <button
        onClick={submit}
        disabled={!valid || status === 'loading'}
        className={`w-full py-3.5 rounded-2xl font-bold text-[15px] transition-all ${
          valid && status !== 'loading' ? 'bg-[#191f28] text-white hover:bg-black shadow-lg' : 'bg-[#e5e8eb] text-[#b0b8c1]'
        }`}
      >
        {status === 'loading' ? '제출 중…' : '신청서 제출하기'}
      </button>
      <p className="text-[11px] text-[#8b95a1] mt-3 leading-relaxed">
        * 제출 후에도 입금을 완료해야 등록이 확정됩니다. 가족/그룹은 구성원 정보를 정확히 입력해 주세요.
      </p>
    </Card>
  )
}

// ── 내 신청 조회 / 수정 ────────────────────────────────────────
function EditCard({ data, onDelete }) {
  const [gender, setGender] = useState(data.gender || '')
  const [contact, setContact] = useState(fmtPhone(data.contact || ''))
  const [email, setEmail] = useState(data.email || '')
  const [campus, setCampus] = useState(data.campus || '')
  const [deptName, setDeptName] = useState(DEPTS.find((d) => d.label === data.deptLabel)?.name || DEPTS[0].name)
  const [bus, setBus] = useState(!!data.bus)
  const [seorak, setSeorak] = useState(!!data.seorak)
  const [inquiry, setInquiry] = useState(data.inquiry || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    setSaving(true); setErr('')
    const deptLabel = DEPTS.find((d) => d.name === deptName)?.label
    try {
      const res = await fetch(SUBMIT_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'update', row: data.row, name: data.name, contact: data.contact,
          fields: { gender, contact, email, campus, deptLabel, bus, seorak, inquiry },
        }),
      })
      const j = await res.json()
      if (j.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
      else setErr(j.error || '수정 실패')
    } catch (e) { setErr(String(e)) } finally { setSaving(false) }
  }

  const roomShort = (data.roomLabel || '').split(' (')[0]
  return (
    <div className="bg-[#f9fafb] rounded-2xl p-4 border border-[#f2f4f6] mb-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[14px] font-bold text-[#191f28]">
          {data.name}
          {data.isSelf && <span className="ml-1.5 text-[10px] font-bold text-white bg-[#3182f6] rounded-full px-1.5 py-0.5 align-middle">본인</span>}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#8b95a1]">대표 {data.rep || '-'}</span>
          {onDelete && <button onClick={onDelete} className="text-[11px] font-bold text-[#f04452]">삭제</button>}
        </div>
      </div>
      <Field label="성별"><SegPicker value={gender} onChange={setGender} options={['남', '여']} /></Field>
      <Field label="연락처"><input value={contact} onChange={(e) => setContact(fmtPhone(e.target.value))} inputMode="tel" className={inputCls} /></Field>
      <Field label="이메일"><input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" className={inputCls} /></Field>
      <Field label="캠퍼스"><SegPicker value={campus} onChange={setCampus} options={CAMPUSES} render={(c) => c.replace(' 캠퍼스', '')} /></Field>
      <Field label="소속부서"><DeptSelect value={deptName} onChange={setDeptName} /></Field>
      <Field label="버스 / 설악산뷰">
        <div className="flex gap-2">
          <button onClick={() => setBus(!bus)} className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold border ${bus ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#8b95a1]'}`}>버스 {bus ? '✓' : ''}</button>
          <button onClick={() => setSeorak(!seorak)} className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold border ${seorak ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#8b95a1]'}`}>설악산뷰 {seorak ? '✓' : ''}</button>
        </div>
      </Field>
      <Field label="문의사항"><textarea value={inquiry} onChange={(e) => setInquiry(e.target.value)} rows={2} className={inputCls + ' resize-none'} /></Field>
      {(() => {
        const isGroupRoom = /인이 투숙/.test(data.occLabel || '') || data.appType === '그룹'
        const selfRoom = isGroupRoom ? 0 : roomIndivFee(data.roomLabel)
        const common = data.common || 0                       // 그룹공동비용(객실+투숙) — 대표 행에만 값
        const isRep = common > 0 || data.groupTotal > 0        // 대표자 행
        const deptF = DEPTS.find((d) => d.name === deptName)?.fee || 0
        const selfFee = deptF + selfRoom + (bus ? BUS_FEE : 0) + (seorak ? SEORAK_FEE : 0) + (isRep ? common : 0)
        return (
          <div className="bg-[#f2f8ff] rounded-2xl p-4 mb-3 border border-[#d8e8ff]">
            <div className="flex justify-between items-baseline">
              <span className="text-[13px] font-bold text-[#1b64da]">{isRep ? '본인 부담 (공동비용 포함)' : '본인 부담 금액'}</span>
              <span className="text-[24px] font-extrabold text-[#191f28] leading-none">{won(selfFee)}</span>
            </div>
            <div className="text-[12px] text-[#4e5968] mt-2 leading-snug">
              등록비 {won(deptF)}{selfRoom > 0 ? ` · 객실 ${won(selfRoom)}` : ''}{bus ? ` · 버스 ${won(BUS_FEE)}` : ''}{seorak ? ` · 설악산 ${won(SEORAK_FEE)}` : ''}{isRep && common > 0 ? ` · 객실+투숙 그룹비 ${won(common)}` : ''}
              {isGroupRoom && isRep && data.groupTotal > 0 && <><br /><span className="text-[#8b95a1]">* 대표자라 공동비용 포함. 그룹 전체 총액 {won(data.groupTotal)}</span></>}
              {isGroupRoom && !isRep && <><br /><span className="text-[#8b95a1]">* 객실·투숙 그룹비용은 대표자({data.rep || '-'})가 납부</span></>}
            </div>
          </div>
        )
      })()}
      <div className="text-[11px] text-[#8b95a1] bg-white rounded-xl p-3 mb-3 leading-relaxed">
        객실: {roomShort || '-'} · 투숙/그룹/입금자명 변경은 별도로 문의 부탁드립니다.
      </div>
      {err && <p className="text-[12px] text-[#f04452] mb-2">{err}</p>}
      <button onClick={save} disabled={saving} className={`w-full py-3 rounded-2xl font-bold text-[14px] ${saved ? 'bg-[#15803d] text-white' : 'bg-[#3182f6] text-white hover:bg-[#1b64da]'}`}>
        {saving ? '저장 중…' : saved ? '✓ 저장됨' : '이 내용으로 수정 저장'}
      </button>
    </div>
  )
}

// 그룹 편집기 (조회·수정 / 관리자 공용). auth = { verifyContact } 또는 { pin }
function GroupEditor({ members, auth, onRefresh, title }) {
  const cur = members[0] || {}
  const gid = cur.gid || cur.groupId
  const [roomName, setRoomName] = useState(reqRoomType(cur.roomLabel))
  const occInit = (() => { const mm = (cur.occLabel || '').match(/(\d)인/); const ppl = mm ? +mm[1] : (members.length || 8); return (OCCUPANCY.find((o) => o.people === ppl || (ppl >= 7 && o.people === 8)) || OCCUPANCY[0]).label })()
  const [occSel, setOccSel] = useState(occInit)
  const [add, setAdd] = useState({ name: '', gender: '', dept: DEPTS[0].name, bus: false })
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  const post = (p) => fetch(SUBMIT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...p, ...auth }) }).then((r) => r.json())
  const saveGroup = async () => {
    setBusy('group'); setMsg('')
    const roomLabel = ROOMS.find((r) => r.name === roomName).label
    const occLabel = OCCUPANCY.find((o) => o.label === occSel).formLabel
    const j = await post({ action: 'groupSet', gid, roomLabel, occLabel })
    setBusy(''); setMsg(j.ok ? '✓ 객실/투숙 저장됨' : '오류: ' + (j.error || '')); if (j.ok) onRefresh && onRefresh()
  }
  const delMember = async (row, nm) => {
    if (members.length <= 1) { setMsg('마지막 1명은 삭제할 수 없습니다.'); return }
    setBusy('d' + row); setMsg('')
    const j = await post({ action: 'memberDelete', gid, row, name: nm })
    setBusy(''); if (j.ok) onRefresh && onRefresh(); else setMsg('오류: ' + (j.error || ''))
  }
  const addMember = async () => {
    if (!add.name.trim() || !add.gender) { setMsg('추가할 분의 이름·성별을 입력해 주세요.'); return }
    setBusy('add'); setMsg('')
    const deptLabel = DEPTS.find((d) => d.name === add.dept).label
    const j = await post({ action: 'memberAdd', gid, member: { name: add.name.trim(), gender: add.gender, deptLabel, bus: add.bus } })
    setBusy('')
    if (j.ok) { setAdd({ name: '', gender: '', dept: DEPTS[0].name, bus: false }); onRefresh && onRefresh() } else setMsg('오류: ' + (j.error || ''))
  }

  return (
    <Card title={title || `그룹 편집 (${members.length}명)`}>
      <p className="text-[12px] text-[#8b95a1] mb-3 leading-relaxed">방(객실)과 투숙 인원을 정하고, 구성원을 추가·삭제할 수 있습니다. 투숙 인원은 방 크기로, 등록 인원과 다르게(부분 그룹) 정할 수 있어요.</p>
      <Field label="객실 종류">
        <select value={roomName} onChange={(e) => setRoomName(e.target.value)} className={inputCls}>
          {ROOMS.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>
      </Field>
      <Field label="투숙 인원 (방 크기)">
        <select value={occSel} onChange={(e) => setOccSel(e.target.value)} className={inputCls}>
          {OCCUPANCY.map((o) => <option key={o.label} value={o.label}>{o.label} {o.fee > 0 ? `(그룹 +${o.fee / 10000}만)` : '(추가없음)'}</option>)}
        </select>
      </Field>
      <button onClick={saveGroup} disabled={busy === 'group'} className="w-full py-2.5 rounded-xl bg-[#3182f6] text-white font-bold text-[13px] mb-1">
        {busy === 'group' ? '저장 중…' : '객실/투숙 저장'}
      </button>
      {msg && <p className="text-[12px] text-[#1b64da] font-semibold my-2">{msg}</p>}

      <div className="text-[13px] font-bold text-[#191f28] mt-4 mb-2">구성원 ({members.length}명)</div>
      {members.map((mm) => <EditCard key={mm.row} data={{ ...mm, groupId: gid }} onDelete={() => delMember(mm.row, mm.name)} />)}

      <div className="bg-[#f9fafb] rounded-2xl p-3 border border-dashed border-[#3182f6]/40 mt-2">
        <div className="text-[12px] font-bold text-[#1b64da] mb-2">+ 구성원 추가 (미제출자 등)</div>
        <input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} placeholder="이름" className={inputCls + ' mb-2'} />
        <div className="flex gap-2 mb-2">
          {['남', '여'].map((g) => (
            <button key={g} onClick={() => setAdd({ ...add, gender: g })} className={`flex-1 py-2 rounded-xl text-[12px] font-bold border ${add.gender === g ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#8b95a1]'}`}>{g}</button>
          ))}
        </div>
        <DeptSelect value={add.dept} onChange={(v) => setAdd({ ...add, dept: v })} />
        <button onClick={() => setAdd({ ...add, bus: !add.bus })} className={`w-full mt-2 py-2 rounded-xl text-[12px] font-bold border ${add.bus ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#8b95a1]'}`}>버스 신청 {add.bus ? '✓' : ''}</button>
        <button onClick={addMember} disabled={busy === 'add'} className="w-full mt-2 py-2.5 rounded-xl bg-[#191f28] text-white font-bold text-[13px]">{busy === 'add' ? '추가 중…' : '구성원 추가'}</button>
      </div>
    </Card>
  )
}

function LookupMode() {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | loaded | error
  const [results, setResults] = useState([])
  const [grouped, setGrouped] = useState(false)
  const [err, setErr] = useState('')

  const lookup = async () => {
    setStatus('loading'); setErr('')
    try {
      const res = await fetch(SUBMIT_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'lookup', name: name.trim(), contact: contact.trim() }),
      })
      const j = await res.json()
      if (j.ok) { setResults(j.results || []); setGrouped(!!j.grouped); setStatus('loaded') }
      else { setErr(j.error || '조회 실패'); setStatus('error') }
    } catch (e) { setErr(String(e)); setStatus('error') }
  }

  return (
    <>
      <Card title="내 신청 조회">
        <p className="text-[12px] text-[#8b95a1] mb-3 leading-relaxed">제출하신 이름과 연락처로 조회합니다. 가족 대표자는 본인 이름으로 조회하세요.</p>
        <Field label="이름" required><input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김바울" className={inputCls} /></Field>
        <Field label="연락처" required><input value={contact} onChange={(e) => setContact(fmtPhone(e.target.value))} placeholder="010-0000-0000" inputMode="tel" className={inputCls} /></Field>
        <button onClick={lookup} disabled={!name.trim() || !contact.trim() || status === 'loading'}
          className={`w-full py-3.5 rounded-2xl font-bold text-[15px] ${name.trim() && contact.trim() && status !== 'loading' ? 'bg-[#191f28] text-white hover:bg-black' : 'bg-[#e5e8eb] text-[#b0b8c1]'}`}>
          {status === 'loading' ? '조회 중…' : '조회하기'}
        </button>
        {status === 'error' && <p className="text-[12px] text-[#f04452] mt-3">{err}</p>}
      </Card>

      {status === 'loaded' && (
        results.length === 0 ? (
          <Card title="조회 결과 없음">
            <p className="text-[12px] text-[#8b95a1] leading-relaxed">해당 이름·연락처로 제출된 신청이 없습니다. 입력을 확인하시거나 안내데스크로 문의해 주세요.</p>
          </Card>
        ) : (results.length > 1 || /인이 투숙/.test(results[0].occLabel || '') || results[0].appType === '그룹') ? (
          <GroupEditor members={results} auth={{ verifyContact: contact.trim() }} onRefresh={lookup} title={`${(results.find((r) => r.isSelf) || results[0]).rep || name.trim()}님 그룹`} />
        ) : (
          <Card title={`조회 결과 (${results.length}건)`}>
            {results.map((r) => <EditCard key={r.row} data={r} />)}
          </Card>
        )
      )}
    </>
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

// ── 관리자 페이지 (#admin) ─────────────────────────────────────
const deptName = (label) => DEPTS.find((d) => d.label === label)?.name || (label || '').split(' ')[0]
const isChurchAssigned = (occLabel) => !/인이 투숙/.test(occLabel || '')

// 객실 옵션별 정원
const ROOM_CAP = { '소노벨 패밀리': 6, '소노벨 스위트': 8, '소노캄 스위트': 8 }
const reqRoomType = (label) => (label || '').indexOf('소노캄') >= 0 ? '소노캄 스위트' : (label || '').indexOf('소노벨 스위트') >= 0 ? '소노벨 스위트' : '소노벨 패밀리'
const roomTypeShort = (t) => (t === '소노캄 스위트' ? '소노캄' : t === '소노벨 스위트' ? '스위트' : '패밀리')
const roomTypeOfMembers = (members) => {
  const cnt = {}; members.forEach((p) => { const t = reqRoomType(p.roomLabel); cnt[t] = (cnt[t] || 0) + 1 })
  let best = '소노벨 패밀리', bn = -1; Object.keys(cnt).forEach((t) => { if (cnt[t] > bn) { bn = cnt[t]; best = t } }); return best
}
// 금액 계산 헬퍼 (관리자 클라이언트 재계산용)
const deptFeeOf = (label) => DEPTS.find((d) => d.label === label)?.fee || 0
const roomGroupFee = (label) => ROOMS.find((r) => r.name === reqRoomType(label))?.group || 0
const roomIndivFee = (label) => ROOMS.find((r) => r.name === reqRoomType(label))?.indiv || 0
const occFeeOf = (occLabel) => {
  const m = (occLabel || '').match(/(\d)인이 투숙/); if (!m) return 0
  const ppl = +m[1]; const o = OCCUPANCY.find((x) => x.people === ppl || (ppl >= 7 && x.people === 8)); return o ? o.fee : 0
}

// 드래그 가능한 사람 칩 (warn=신청 옵션과 방 옵션 불일치)
function PersonChip({ p, warn }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: 'p' + p.row })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 } : undefined
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[12px] font-bold border cursor-grab touch-none select-none ${isDragging ? 'opacity-70 border-[#3182f6] shadow-lg' : warn ? 'border-[#f59e0b] bg-[#fffbeb]' : 'border-[#e5e8eb] bg-white'}`}>
      {warn && <span title="신청한 객실 옵션과 다른 방">⚠️</span>}
      {p.name}
      {p.route === '미제출' && <span className="text-[9px] font-bold text-white bg-[#f04452] rounded px-1">미제출</span>}
      <span className="text-[10px] text-[#8b95a1] font-normal">{(p.campus || '').replace(' 캠퍼스', '').slice(0, 2)}·{p.gender}·{deptName(p.deptLabel)}</span>
      <span className="text-[10px] text-[#1b64da] font-normal">{roomTypeShort(reqRoomType(p.roomLabel))}</span>
      {p.list && <span title={p.list}>📝</span>}
    </div>
  )
}

// 읽기 전용 사람 칩
function ReadChip({ p }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[12px] font-bold border border-[#e5e8eb] bg-[#f9fafb] text-[#4e5968]">
      {p.name}<span className="text-[10px] text-[#8b95a1] font-normal">{p.gender}·{deptName(p.deptLabel)}</span>
    </span>
  )
}

// 드롭 가능한 방 박스
function RoomDrop({ id, title, sub, count, cap, danger, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`rounded-2xl border p-3 mb-2 transition-colors ${isOver ? 'border-2 border-[#3182f6] bg-[#eaf3ff]' : danger ? 'border-[#f04452] bg-[#fff5f5]' : 'border-[#e5e8eb] bg-white'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-bold text-[#191f28]">{title}{sub && <span className="text-[11px] text-[#8b95a1] font-normal ml-1">{sub}</span>}</span>
        {cap != null && <span className={`text-[12px] font-bold ${danger ? 'text-[#f04452]' : 'text-[#8b95a1]'}`}>{count}/{cap}명</span>}
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-[34px]">{children}</div>
    </div>
  )
}

function Collapsible({ title, count, defaultOpen, children }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="bg-white rounded-2xl border border-[#f2f4f6] mb-3 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3">
        <span className="text-[13px] font-bold text-[#191f28]">{title}{count != null && <span className="text-[#8b95a1] font-normal"> · {count}</span>}</span>
        <span className={`text-[#8b95a1] text-[12px] transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

function AdminApp() {
  const [pin, setPin] = useState('')
  const [auth, setAuth] = useState(false)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('요약')
  const [assignDraft, setAssignDraft] = useState({})
  const [saveMsg, setSaveMsg] = useState('')
  const [sel, setSel] = useState({}) // 리마인드 다중선택 row→bool
  const [extraRooms, setExtraRooms] = useState([]) // 빈 방 라벨
  const [editGid, setEditGid] = useState(null) // 관리자 그룹 편집 대상
  const [mergeSel, setMergeSel] = useState({}) // 합치기 선택 gid→bool
  const [mergeMsg, setMergeMsg] = useState('')
  const [ph, setPh] = useState({ name: '', dept: '' }) // 미제출 인원 추가
  const [phMsg, setPhMsg] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  )

  const post = (payload) =>
    fetch(SUBMIT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) }).then((r) => r.json())

  const login = async () => {
    setLoading(true); setErr('')
    try {
      const j = await post({ action: 'admin', pin })
      if (j.ok) { setRows(j.rows || []); setAuth(true) } else setErr(j.error || '실패')
    } catch (e) { setErr(String(e)) } finally { setLoading(false) }
  }
  const reload = async () => {
    const j = await post({ action: 'admin', pin }); if (j.ok) setRows(j.rows || [])
  }

  // 시트 정보 기반 (enrich가 정확하므로 저장된 그룹ID·그룹총액·확인필요를 그대로 사용)
  const m = useMemo(() => {
    const notDup = rows.filter((r) => r.route !== '중복')           // 집계 대상(중복 제외)
    const confirmed = notDup.filter((r) => r.route !== '미제출')     // 실제 제출 확정
    const submittedRows = confirmed
    const totalPeople = confirmed.length
    const placeholderN = notDup.length - confirmed.length            // 수기 미제출 인원
    const totalAmount = rows.reduce((s, r) => s + (r.gtotal || 0), 0)
    const byCampus = {}; confirmed.forEach((r) => { byCampus[r.campus || '기타'] = (byCampus[r.campus || '기타'] || 0) + 1 })
    const busList = confirmed.filter((r) => r.bus)
    const seorakN = confirmed.filter((r) => r.seorak).length
    const unpaid = confirmed.filter((r) => r.paid !== 'Y')
    const pool = notDup.filter((r) => isChurchAssigned(r.occLabel))  // 교회배정 풀(미제출 placeholder 포함→배정 가능)
    const unassigned = pool.filter((r) => !(r.assigned || assignDraft[r.row]))
    const checkGroups = {}
    rows.forEach((r) => { if (r.check === 'Y') checkGroups[r.gid] = { rep: r.rep, gid: r.gid, note: r.note } })
    // 명단 기준 예상: 제출 인원 + "명단에 적혔지만 아무도 제출 안 한 이름"(전체 1회씩)
    // → 그룹이 쪼개져도 이중계산 안 됨. 이름 정규화(공백/"가족/" 제거)로 매칭 정확도 ↑
    const norm = (x) => String(x || '').replace(/\s+/g, '').replace(/^가족\//, '')
    const subNames = new Set(submittedRows.map((r) => norm(r.name)))
    const stopW = /투숙|신청|상관|배정|교회|추가|비용|없음|캠퍼스|함께|성도|다른|또는|혹은|그룹|가족|부분|명방|방으로|님이|적|어요|니다/
    const tok = (t) => (t || '').split(/[^가-힣A-Za-z]+/).filter((x) => x && /^[가-힣]{2,4}$/.test(x) && !stopW.test(x))
    const seenMiss = new Set(); let missing = 0
    rows.forEach((r) => { tok(r.list).forEach((nm) => { const k = norm(nm); if (!subNames.has(k) && !seenMiss.has(k)) { seenMiss.add(k); missing++ } }) })
    const expected = totalPeople + missing
    return { totalPeople, placeholderN, totalAmount, byCampus, busList, seorakN, unpaid, pool, unassigned, checkGroups: Object.values(checkGroups), expected, missing }
  }, [rows, assignDraft])

  const eff = (p) => (assignDraft[p.row] !== undefined ? assignDraft[p.row] : (p.assigned || ''))

  // 자동 배치: 메모 없는 교회배정자만, 캠퍼스+신청 객실옵션별로 옵션 정원만큼 채움
  const autoAssign = () => {
    const pool = m.pool.filter((p) => !p.list) // 배정 요청 메모 있는 사람은 제외
    const order = DEPTS.map((d) => d.name)
    const byKey = {}
    pool.forEach((p) => { const t = reqRoomType(p.roomLabel); const k = (p.campus || '기타') + '|' + t; (byKey[k] = byKey[k] || []).push(p) })
    const draft = {}
    Object.entries(byKey).forEach(([k, ppl]) => {
      const sep = k.lastIndexOf('|'); const campus = k.slice(0, sep), type = k.slice(sep + 1)
      const cap = ROOM_CAP[type] || 8
      ppl.sort((a, b) => (a.gender || '').localeCompare(b.gender || '') || order.indexOf(deptName(a.deptLabel)) - order.indexOf(deptName(b.deptLabel)))
      const cs = campus.replace(' 캠퍼스', '')
      let no = 1
      for (let i = 0; i < ppl.length; i += cap) { const label = `${cs}-${roomTypeShort(type)}-${no++}`; ppl.slice(i, i + cap).forEach((p) => { draft[p.row] = label }) }
    })
    setAssignDraft(draft); setExtraRooms([]) // 메모 있는 사람은 draft에 없음 → 기존 배정/미배정 유지
  }

  const onDragEnd = ({ active, over }) => {
    if (!over) return
    const row = Number(String(active.id).slice(1))
    const isPool = over.id === '__pool__' || over.id === '__reqcheck__'
    setAssignDraft((d) => ({ ...d, [row]: isPool ? '' : String(over.id) }))
  }
  const addRoom = () => {
    let i = 1; const exist = new Set([...m.pool.map((p) => eff(p)).filter(Boolean), ...extraRooms])
    while (exist.has(`방${i}`)) i++
    setExtraRooms((r) => [...r, `방${i}`])
  }

  const saveAssign = async () => {
    const updates = m.pool.map((p) => ({ row: p.row, value: eff(p), assigned: eff(p) }))
    setSaveMsg('저장 중…')
    const j = await post({ action: 'adminBatch', pin, field: 'assigned', updates })
    if (j.ok) { setSaveMsg(`✓ ${updates.length}명 저장`); await reload(); setAssignDraft({}); setExtraRooms([]) } else setSaveMsg('오류: ' + (j.error || ''))
    setTimeout(() => setSaveMsg(''), 3000)
  }

  const togglePaid = async (row, cur) => {
    const val = cur === 'Y' ? '' : 'Y'
    setRows((rs) => rs.map((r) => (r.row === row ? { ...r, paid: val } : r)))
    await post({ action: 'adminSet', pin, row, field: 'paid', value: val })
  }

  const batchConfirmPaid = async () => {
    const updates = Object.keys(sel).filter((r) => sel[r]).map((r) => ({ row: Number(r), value: 'Y' }))
    if (!updates.length) return
    setRows((rs) => rs.map((r) => (sel[r.row] ? { ...r, paid: 'Y' } : r)))
    setSel({})
    await post({ action: 'adminBatch', pin, field: 'paid', updates })
  }
  const toggleSel = (row) => setSel((s) => ({ ...s, [row]: !s[row] }))

  const mergeSelected = async () => {
    const gids = Object.keys(mergeSel).filter((g) => mergeSel[g])
    if (gids.length < 2) { setMergeMsg('2개 이상 선택하세요'); return }
    setMergeMsg('합치는 중… (재계산 포함, 수 초 소요)')
    const j = await post({ action: 'mergeGroups', pin, gids })
    if (j.ok) { setMergeMsg(`✓ ${j.merged}명을 한 그룹으로 합침`); setMergeSel({}); await reload() } else setMergeMsg('오류: ' + (j.error || ''))
    setTimeout(() => setMergeMsg(''), 4000)
  }
  const toggleMerge = (gid) => setMergeSel((s) => ({ ...s, [gid]: !s[gid] }))

  const addPlaceholder = async () => {
    if (!ph.name.trim()) { setPhMsg('이름을 입력하세요'); return }
    setPhMsg('추가 중…')
    const deptLabel = ph.dept ? DEPTS.find((d) => d.name === ph.dept)?.label : ''
    const j = await post({ action: 'addPlaceholder', pin, name: ph.name.trim(), deptLabel })
    if (j.ok) { setPh({ name: '', dept: '' }); setPhMsg('✓ 미제출 인원 추가됨'); await reload() } else setPhMsg('오류: ' + (j.error || ''))
    setTimeout(() => setPhMsg(''), 3000)
  }

  if (!auth) {
    return (
      <div className="min-h-screen bg-[#f2f4f6] flex items-center justify-center p-4">
        <div className="bg-white max-w-sm w-full rounded-[28px] shadow-xl p-8 space-y-6">
          <h1 className="text-[20px] font-extrabold text-[#191f28] text-center">리트릿 관리자</h1>
          <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()}
            placeholder="PIN" className="w-full bg-[#f9fafb] border-none rounded-2xl px-4 py-4 text-center text-2xl tracking-[0.4em] focus:ring-2 focus:ring-[#3182f6]" />
          {err && <p className="text-[#f04452] text-[13px] text-center font-semibold">{err}</p>}
          <button onClick={login} disabled={loading || !pin} className="w-full bg-[#3182f6] hover:bg-[#1b64da] text-white font-bold py-4 rounded-2xl text-[15px]">
            {loading ? '확인 중…' : '접속'}
          </button>
        </div>
      </div>
    )
  }

  const stat = (label, value, sub) => (
    <div className="bg-white rounded-2xl border border-[#f2f4f6] p-4">
      <div className="text-[11px] text-[#8b95a1] font-semibold mb-1">{label}</div>
      <div className="text-[20px] font-extrabold text-[#191f28] leading-none">{value}</div>
      {sub && <div className="text-[11px] text-[#8b95a1] mt-1">{sub}</div>}
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f2f4f6] text-[#333d4b] pb-12">
      <div className="max-w-[720px] mx-auto px-4 pt-6">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-[20px] font-extrabold text-[#191f28]">리트릿 관리자</h1>
          <button onClick={reload} className="text-[12px] bg-white border border-[#f2f4f6] px-3 py-1.5 rounded-xl font-bold text-[#4e5968]">새로고침</button>
        </header>

        <div className="flex gap-1.5 bg-[#e9ecef] p-1.5 rounded-[14px] mb-4 overflow-x-auto">
          {['요약', '방배정', '리마인드', '버스명단', '문의'].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 whitespace-nowrap py-2.5 px-3 text-[13px] font-bold rounded-[10px] ${tab === t ? 'bg-white text-[#3182f6] shadow' : 'text-[#8b95a1]'}`}>{t}</button>
          ))}
        </div>

        {tab === '요약' && (
          <div className="grid grid-cols-2 gap-2.5">
            {stat('제출 인원 (확정)', m.totalPeople + '명', m.placeholderN > 0 ? `+ 미제출 ${m.placeholderN}명` : '중복 제외')}
            {stat('명단 기준 예상', m.expected + '명', `미제출 추정 ${m.missing}명`)}
            {stat('총 등록 금액', won(m.totalAmount))}
            {stat('미입금', m.unpaid.length + '명', '입금확인 안 된 인원')}
            {stat('방배정 필요', m.pool.length + '명', `미배정 ${m.unassigned.length}명`)}
            {stat('버스 신청', m.busList.length + '명')}
            {stat('설악산뷰', m.seorakN + '명')}
            {stat('확인필요 그룹', m.checkGroups.length + '건', '명단>제출')}
            {stat('캠퍼스', Object.entries(m.byCampus).map(([k, v]) => `${k.replace(' 캠퍼스', '')} ${v}`).join(' / '))}
          </div>
        )}

        {tab === '방배정' && (() => {
          const roomMap = {}; m.pool.forEach((p) => { const l = eff(p); if (l) (roomMap[l] = roomMap[l] || []).push(p) })
          extraRooms.forEach((l) => { if (!roomMap[l]) roomMap[l] = [] })
          const roomLabels = Object.keys(roomMap).sort()
          const unassigned = m.pool.filter((p) => !eff(p))
          const reqCheck = unassigned.filter((p) => p.list)   // 메모 있는 사람(수동 확인)
          const plain = unassigned.filter((p) => !p.list)
          // 이미 구성된 그룹(N인 투숙) = 읽기 전용 (재계산된 클러스터 기준)
          const bookedGroups = {}; rows.forEach((r) => { if (!isChurchAssigned(r.occLabel)) (bookedGroups[r.gid] = bookedGroups[r.gid] || []).push(r) })
          const bookedList = Object.entries(bookedGroups).map(([gid, mem]) => [gid, mem, mem[0].rep])
          return (
            <div>
              <div className="bg-white rounded-2xl border border-[#f2f4f6] p-4 mb-3">
                <p className="text-[12px] text-[#4e5968] leading-relaxed mb-3">
                  교회 배정 대상 <b>{m.pool.length}명</b>. <b>자동 배치</b>는 <u>메모 없는</u> 사람만 캠퍼스·신청 객실옵션별 정원(패밀리 6 / 스위트·소노캄 8)에 맞춰 채웁니다. 메모 있는 사람은 아래 "배정 요청 확인"에 따로 두니 직접 드래그하세요.
                </p>
                <div className="flex gap-2">
                  <button onClick={autoAssign} className="flex-1 py-3 rounded-xl bg-[#3182f6] text-white font-bold text-[13px]">자동 배치</button>
                  <button onClick={addRoom} className="px-4 py-3 rounded-xl bg-[#f2f4f6] text-[#4e5968] font-bold text-[13px]">+ 방</button>
                  <button onClick={saveAssign} className="flex-1 py-3 rounded-xl bg-[#191f28] text-white font-bold text-[13px]">저장</button>
                </div>
                {saveMsg && <p className="text-[12px] text-[#1b64da] font-semibold mt-2">{saveMsg}</p>}
                <div className="mt-3 pt-3 border-t border-[#f2f4f6]">
                  <div className="text-[12px] font-bold text-[#191f28] mb-2">미제출 인원 추가 (이름만, 방배정용)</div>
                  <div className="flex gap-2">
                    <input value={ph.name} onChange={(e) => setPh({ ...ph, name: e.target.value })} placeholder="이름" className="flex-1 bg-[#f9fafb] border border-[#e5e8eb] rounded-xl px-3 py-2 text-[13px]" />
                    <select value={ph.dept} onChange={(e) => setPh({ ...ph, dept: e.target.value })} className="bg-[#f9fafb] border border-[#e5e8eb] rounded-xl px-2 py-2 text-[12px]">
                      <option value="">부서?</option>
                      {DEPTS.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                    </select>
                    <button onClick={addPlaceholder} className="px-3 py-2 rounded-xl bg-[#f04452] text-white font-bold text-[12px] whitespace-nowrap">+ 미제출</button>
                  </div>
                  {phMsg && <p className="text-[12px] text-[#1b64da] font-semibold mt-2">{phMsg}</p>}
                </div>
              </div>

              {editGid && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4" onClick={() => setEditGid(null)}>
                  <div className="w-full max-w-[480px] mx-auto mt-4" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setEditGid(null)} className="text-white text-[13px] font-bold mb-2">✕ 닫기</button>
                    <GroupEditor members={rows.filter((r) => r.gid === editGid)} auth={{ pin }} onRefresh={reload} title={`그룹 편집 — ${editGid}`} />
                  </div>
                </div>
              )}

              {bookedList.length > 0 && (
                <Collapsible title="이미 구성된 그룹 (편집·합치기)" count={`${bookedList.length}방`}>
                  {(() => { const selN = Object.keys(mergeSel).filter((g) => mergeSel[g]).length; return (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] text-[#8b95a1]">떨어진 그룹 체크 → 합치기</span>
                      <button onClick={mergeSelected} disabled={selN < 2} className={`ml-auto text-[12px] font-bold px-3 py-1.5 rounded-lg ${selN >= 2 ? 'bg-[#191f28] text-white' : 'bg-[#e5e8eb] text-[#b0b8c1]'}`}>선택 {selN}그룹 합치기</button>
                    </div>
                  ) })()}
                  {mergeMsg && <p className="text-[12px] text-[#1b64da] font-semibold mb-2">{mergeMsg}</p>}
                  {bookedList.map(([gid, mem, rep]) => {
                    const type = roomTypeOfMembers(mem); const cap = ROOM_CAP[type]
                    return (
                      <div key={gid} className="mb-2 pb-2 border-b border-[#f7f8fa] last:border-0">
                        <div className="flex items-center justify-between mb-1">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={!!mergeSel[gid]} onChange={() => toggleMerge(gid)} className="w-4 h-4" />
                            <span className="text-[12px] font-bold text-[#191f28]">{rep || mem[0].name} 그룹 <span className="text-[11px] font-normal text-[#8b95a1]">· {roomTypeShort(type)} {mem.length}/{cap}명</span></span>
                          </label>
                          <button onClick={() => setEditGid(gid)} className="text-[11px] font-bold text-[#3182f6]">편집</button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">{mem.map((p) => <ReadChip key={p.row} p={p} />)}</div>
                      </div>
                    )
                  })}
                </Collapsible>
              )}

              <DndContext sensors={sensors} onDragEnd={onDragEnd}>
                {reqCheck.length > 0 && (
                  <RoomDrop id="__reqcheck__" title="🔎 배정 요청 확인" sub="메모 있는 사람 (자동배치 제외)" count={reqCheck.length}>
                    {reqCheck.map((p) => (
                      <div key={p.row} className="w-full">
                        <PersonChip p={p} />
                        <div className="text-[11px] text-[#1b64da] mt-0.5 ml-1 leading-snug">📝 {p.list}</div>
                      </div>
                    ))}
                  </RoomDrop>
                )}
                <RoomDrop id="__pool__" title="미배정" count={plain.length}>
                  {plain.map((p) => <PersonChip key={p.row} p={p} />)}
                </RoomDrop>
                {roomLabels.map((lab) => {
                  const mem = roomMap[lab]; const type = roomTypeOfMembers(mem); const cap = ROOM_CAP[type]
                  return (
                    <RoomDrop key={lab} id={lab} title={lab} sub={roomTypeShort(type)} count={mem.length} cap={cap} danger={mem.length > cap}>
                      {mem.map((p) => <PersonChip key={p.row} p={p} warn={reqRoomType(p.roomLabel) !== type} />)}
                    </RoomDrop>
                  )
                })}
              </DndContext>
              <p className="text-[11px] text-[#b0b8c1] text-center mt-1">칩을 길게 눌러 방으로 끌어다 놓으세요. ⚠️=신청 옵션과 다른 방. "저장"을 눌러야 반영됩니다.</p>
            </div>
          )
        })()}

        {tab === '리마인드' && (
          <div>
            {(() => { const selN = Object.keys(sel).filter((r) => sel[r]).length; return (
              <Collapsible title="미입금" count={`${m.unpaid.length}명`} defaultOpen>
                {m.unpaid.length === 0 ? <p className="text-[12px] text-[#8b95a1]">전원 입금확인 완료</p> : (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <button onClick={() => setSel(Object.fromEntries(m.unpaid.map((r) => [r.row, true])))} className="text-[11px] font-bold text-[#3182f6] bg-[#f2f8ff] px-2.5 py-1.5 rounded-lg">전체선택</button>
                      <button onClick={() => setSel({})} className="text-[11px] font-bold text-[#8b95a1] bg-[#f2f4f6] px-2.5 py-1.5 rounded-lg">해제</button>
                      <button onClick={batchConfirmPaid} disabled={!selN} className={`ml-auto text-[12px] font-bold px-3 py-1.5 rounded-lg ${selN ? 'bg-[#191f28] text-white' : 'bg-[#e5e8eb] text-[#b0b8c1]'}`}>선택 {selN}명 입금확인</button>
                    </div>
                    {m.unpaid.map((r) => (
                      <label key={r.row} className="flex items-center gap-2 py-1.5 border-b border-[#f7f8fa] last:border-0 cursor-pointer">
                        <input type="checkbox" checked={!!sel[r.row]} onChange={() => toggleSel(r.row)} className="w-4 h-4" />
                        <span className="text-[13px] font-bold text-[#191f28] flex-1">{r.name} <span className="text-[11px] text-[#8b95a1] font-normal">{(r.campus || '').replace(' 캠퍼스', '')}·{deptName(r.deptLabel)}{r.pay ? ` · 입금자명 ${r.pay}` : ''}</span></span>
                      </label>
                    ))}
                  </>
                )}
              </Collapsible>
            ) })()}
            <Collapsible title="확인필요 (명단 > 제출)" count={`${m.checkGroups.length}건`}>
              {m.checkGroups.length === 0 ? <p className="text-[12px] text-[#8b95a1]">없음</p> :
                m.checkGroups.map((g) => (
                  <div key={g.gid} className="py-1.5 border-b border-[#f7f8fa] last:border-0">
                    <div className="text-[13px] font-bold text-[#191f28]">{g.rep} <span className="text-[11px] text-[#8b95a1]">{g.gid}</span></div>
                    <div className="text-[11px] text-[#8b95a1] leading-snug">{g.note}</div>
                  </div>
                ))}
            </Collapsible>
          </div>
        )}

        {tab === '문의' && (
          (() => {
            const qs = rows.filter((r) => r.inquiry)
            return qs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#f2f4f6] p-4"><p className="text-[12px] text-[#8b95a1]">문의사항 없음</p></div>
            ) : (
              <div className="space-y-2">
                {qs.map((r) => (
                  <div key={r.row} className="bg-white rounded-2xl border border-[#f2f4f6] p-4">
                    <div className="text-[13px] font-bold text-[#191f28]">{r.name} <span className="text-[11px] text-[#8b95a1] font-normal">{(r.campus || '').replace(' 캠퍼스', '')}·{deptName(r.deptLabel)}{r.contact ? ` · ${fmtPhone(r.contact)}` : ''}</span></div>
                    <div className="text-[12px] text-[#4e5968] mt-1 whitespace-pre-wrap leading-relaxed">{r.inquiry}</div>
                  </div>
                ))}
              </div>
            )
          })()
        )}

        {tab === '버스명단' && (
          <div className="space-y-3">
            {Object.keys(m.byCampus).map((campus) => {
              const list = m.busList.filter((r) => (r.campus || '기타') === campus)
              return (
                <div key={campus} className="bg-white rounded-2xl border border-[#f2f4f6] p-4">
                  <div className="text-[13px] font-bold text-[#191f28] mb-2">{campus.replace(' 캠퍼스', '')} 버스 {list.length}명</div>
                  {list.length === 0 ? <p className="text-[12px] text-[#8b95a1]">없음</p> :
                    <div className="text-[12px] text-[#4e5968] leading-relaxed">{list.map((r) => `${r.name}(${deptName(r.deptLabel)})`).join(', ')}</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 메인 ───────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState('개인')
  if (typeof window !== 'undefined' && window.location.hash.replace(/^#\/?/, '') === 'admin') return <AdminApp />

  return (
    <div className="min-h-screen bg-[#f2f4f6] text-[#333d4b] pb-12 animate-fade-in">
      <div className="max-w-[480px] mx-auto px-4 pt-6">
        {/* 헤더 */}
        <header className="mb-5">
          <div className="text-[12px] font-bold text-[#3182f6] mb-1">BUILD HIS CHURCH</div>
          <h1 className="text-[22px] font-extrabold text-[#191f28] tracking-tight leading-tight">
            2026 전교인 리트릿<br />등록 및 조회·수정
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
          {[
            { k: '개인', t: '개인 등록' },
            { k: '그룹', t: '가족·그룹' },
            { k: '조회', t: '조회·수정' },
          ].map(({ k, t }) => (
            <button
              key={k}
              onClick={() => setMode(k)}
              className={`flex-1 py-3 text-[13px] font-bold rounded-[12px] transition-all ${
                mode === k ? 'bg-white text-[#3182f6] shadow-md' : 'text-[#8b95a1]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {mode === '개인' ? <IndividualMode /> : mode === '그룹' ? <GroupMode /> : <LookupMode />}

        <p className="text-[11px] text-[#b0b8c1] text-center mt-6 leading-relaxed">
          본 페이지에서 등록 신청과 조회·수정을 하실 수 있습니다.<br />
          제출 후 <b>입금까지 완료</b>해야 등록이 확정되며, 환불은 등록기간 이후 어렵습니다.<br />
          가족/그룹은 대표자가 구성원을 모두 입력해 한 번에 제출합니다.
        </p>
      </div>
    </div>
  )
}
