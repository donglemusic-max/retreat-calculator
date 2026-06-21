import React, { useState, useMemo, useEffect, useRef } from 'react'
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
  { name: '소노벨 패밀리', group: 0, indiv: 0, max: 6, desc: '최대 6인 · 원룸(더블 2개) · 예배실 도보 3~5분', plan: 'floorplan/family.png',
    label: '소노벨 패밀리 (최대 인원 6인 원룸. 더블침대 2개) - 객실당 추가 비용은 없음 (인원에 따른 추가 비용은 선택에 따라 발생)' },
  { name: '소노벨 스위트', group: 60000, indiv: 10000, max: 8, desc: '최대 8인 · 투룸(온돌 / 더블·싱글) · 예배실 도보 3~5분', plan: 'floorplan/suite.png',
    label: '소노벨 스위트 (최대 인원 8인 투룸. 침실A: 온돌 / 침실B: 더블 1개 or 싱글 2개) - 객실당 추가로 [그룹의 경우] 6만원 혹은 [개인비용] 1만원' },
  { name: '소노캄 스위트', group: 240000, indiv: 40000, max: 8, desc: '최대 8인 · 투룸(싱글2 / 더블) · 예배실 옆 건물', plan: 'floorplan/sonokam.png',
    label: '소노캄 스위트 (최대 인원 8인 투룸. 침실A: 싱글 2개, 침실B: 더블 1개) - 객실당 추가로 [그룹의 경우] 24만원 혹은 [개인의 경우] 4만원' },
]
// 선택한 객실 평면도 (방 선택 아래 표시 · 탭하면 확대)
function FloorPlan({ room }) {
  const [zoom, setZoom] = useState(false)
  const [big, setBig] = useState(false)
  if (!room || !room.plan) return null
  const close = () => { setZoom(false); setBig(false) }
  return (
    <div className="mt-3">
      <div className="text-[12px] font-bold text-[#1b64da] mb-1.5">📐 {room.name} 평면도 <span className="font-normal text-[#3182f6]">· 탭하면 확대</span></div>
      <button type="button" onClick={() => setZoom(true)} className="block w-full">
        <img src={room.plan} alt={`${room.name} 평면도`} loading="lazy" className="w-full rounded-xl border border-[#cfe0ff] bg-white" />
      </button>
      {zoom && (
        <div className="fixed inset-0 z-[70] bg-black/85 overflow-auto animate-fade-in" onClick={close}>
          <div className="min-h-full flex items-start justify-center p-3 py-12">
            <img src={room.plan} alt={`${room.name} 평면도`}
              onClick={(e) => { e.stopPropagation(); setBig((b) => !b) }}
              className={`rounded-lg bg-white cursor-zoom-in ${big ? 'max-w-none w-[200%] cursor-zoom-out' : 'w-full max-w-[920px]'}`} />
          </div>
          <button onClick={close} className="fixed top-3 right-4 text-white text-[30px] leading-none font-light">✕</button>
          <div className="fixed bottom-4 left-0 right-0 text-center text-white/80 text-[13px] font-bold pointer-events-none">{room.name} 평면도 · 이미지 탭하면 {big ? '축소' : '더 확대'} · 빈 곳 탭하면 닫힘</div>
        </div>
      )}
    </div>
  )
}

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
// 부분 그룹: 일부만 함께, 나머지는 교회 배정. 투숙(그룹)비는 추후 결정, 객실선택은 그룹비용으로 처리(#7·#8)
const OCC_PARTIAL = '부분 그룹 신청 (나머지는 교회에서 배정, 추가비용 추후 결정)'
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
function Card({ title, badge, help, helpTitle, children, step, id }) {
  return (
    <section id={id} className="bg-white rounded-[22px] shadow-sm border border-[#f2f4f6] p-5 mb-4 scroll-mt-[120px]">
      {title && (
        <div className="flex items-center gap-2 mb-4">
          {step != null && (
            <span className="shrink-0 w-6 h-6 rounded-full bg-[#191f28] text-white text-[12px] font-extrabold flex items-center justify-center">{step}</span>
          )}
          <h2 className="text-[16px] font-bold text-[#191f28] tracking-tight">{title}</h2>
          {badge != null && (
            <span className="bg-[#3182f6] text-white text-[12px] px-2 py-0.5 rounded-full font-bold">{badge}</span>
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
      className={`w-full flex items-center justify-between gap-3 px-4 py-4 rounded-2xl border text-left transition-all min-h-[52px] ${
        active
          ? 'border-2 border-[#3182f6] bg-[#f2f8ff]'
          : 'border border-[#e5e8eb] bg-white hover:bg-[#f9fafb]'
      }`}
    >
      <div className="min-w-0">
        <div className={`text-[15px] font-bold ${active ? 'text-[#1b64da]' : 'text-[#333d4b]'}`}>{title}</div>
        {sub && <div className="text-[13px] text-[#5f6b7a] mt-0.5 leading-snug">{sub}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {right != null && (
          <div className={`text-[14px] font-bold whitespace-nowrap ${active ? 'text-[#1b64da]' : 'text-[#5f6b7a]'}`}>{right}</div>
        )}
        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${active ? 'bg-[#3182f6] text-white' : 'border border-[#d1d8e0] text-transparent'}`}>✓</span>
      </div>
    </button>
  )
}

function Toggle({ on, onChange, label, sub, price }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl border transition-all min-h-[56px] ${
        on ? 'border-2 border-[#3182f6] bg-[#f2f8ff]' : 'border border-[#e5e8eb] bg-white'
      }`}
    >
      <div className="text-left">
        <div className={`text-[15px] font-bold ${on ? 'text-[#1b64da]' : 'text-[#333d4b]'}`}>{label}</div>
        {sub && <div className="text-[13px] text-[#5f6b7a] mt-0.5">{sub}</div>}
      </div>
      <div className="flex items-center gap-2">
        {price && <span className={`text-[14px] font-bold ${on ? 'text-[#1b64da]' : 'text-[#5f6b7a]'}`}>{price}</span>}
        <div className={`w-12 h-7 rounded-full p-0.5 transition-all ${on ? 'bg-[#3182f6]' : 'bg-[#d1d8e0]'}`}>
          <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
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
      className="w-full bg-[#f9fafb] border border-[#e5e8eb] rounded-xl px-3 py-3 text-[15px] font-semibold text-[#333d4b] focus:ring-2 focus:ring-[#3182f6] focus:outline-none min-h-[48px]"
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
  'w-full bg-[#f9fafb] border border-[#e5e8eb] rounded-xl px-3 py-3 text-[15px] text-[#16233d] placeholder:text-[#aeb6c2] placeholder:font-normal focus:ring-2 focus:ring-[#3182f6] focus:outline-none min-h-[48px]'

function Field({ label, required, children, id, error }) {
  return (
    <div id={id} className="mb-4 last:mb-0 scroll-mt-24">
      <label className="block text-[13px] font-semibold text-[#4e5968] mb-2">
        {label}{required && <span className="text-[#f04452]"> *</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-[12px] font-semibold text-[#f04452]">{error}</p>}
    </div>
  )
}

// 첫 미입력 칸으로 부드럽게 이동 (#3). scrollIntoView 대신 window.scrollTo 사용.
function scrollToId(id) {
  if (typeof document === 'undefined') return
  var el = document.getElementById(id); if (!el) return
  var y = el.getBoundingClientRect().top + window.scrollY - 80
  window.scrollTo({ top: y < 0 ? 0 : y, behavior: 'smooth' })
}

// 긴 폼 상단 진행 가이드(#10): 섹션 칩 + 스크롤 시 현재 섹션 강조 + 탭하면 이동.
function StepGuide({ steps }) {
  const [active, setActive] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      var cur = 0
      for (var i = 0; i < steps.length; i++) {
        var el = document.getElementById(steps[i].id)
        if (el && el.getBoundingClientRect().top <= 150) cur = i
      }
      setActive(cur)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [steps])
  return (
    <div className="sticky top-[60px] z-[9] -mx-4 px-4 py-2 bg-[#f2f4f6]/95 backdrop-blur-sm mb-3 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-1.5 w-max">
        {steps.map((s, i) => (
          <React.Fragment key={s.id}>
            <button onClick={() => scrollToId(s.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-all ${i === active ? 'bg-[#191f28] text-white' : 'bg-white text-[#5f6b7a] border border-[#e5e8eb]'}`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${i === active ? 'bg-white text-[#191f28]' : 'bg-[#e9ecef] text-[#5f6b7a]'}`}>{i + 1}</span>
              {s.label}
            </button>
            {i < steps.length - 1 && <span className="text-[#c4c9d0] text-[11px]">›</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

// 화면 하단 고정 금액 요약 바 (#1) + 단일 주 버튼(#2). 옵션 바꾸면 total이 즉시 갱신됨.
function StickyBar({ total, count, perPerson, hint, cta, onCta }) {
  return (
    <>
      <div aria-hidden style={{ height: 86 }} />
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#e5e8eb] bg-white/95 backdrop-blur-sm">
        <div className="max-w-[480px] mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-[#5f6b7a] leading-none mb-1">{hint || '총 등록 금액'}</div>
            <div className="text-[22px] font-extrabold text-[#191f28] leading-none truncate">
              {won(total)}{count > 1 && <span className="text-[12px] font-medium text-[#5f6b7a] ml-2">1인 평균 {won(perPerson)}</span>}
            </div>
          </div>
          <button onClick={onCta} className="shrink-0 px-6 py-3.5 rounded-2xl bg-[#191f28] text-white font-bold text-[15px] hover:bg-black shadow-lg active:scale-[0.98] transition">
            {cta}
          </button>
        </div>
      </div>
    </>
  )
}

function SegPicker({ value, onChange, options, render, invalid }) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`flex-1 py-3 rounded-xl text-[14px] font-bold border transition-all min-h-[48px] ${
            value === o ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]'
              : invalid ? 'border-2 border-[#f04452] bg-[#fff5f5] text-[#f04452]' : 'border border-[#e5e8eb] text-[#5f6b7a]'
          }`}
        >
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  )
}

// ── 제출 전 확인 바텀시트 ──────────────────────────────────────
function ConfirmSheet({ open, onClose, onConfirm, calc, subtitle, memberSummary, loading }) {
  const [copied, setCopied] = useState(false)
  const copyGuide = async () => {
    try { await navigator.clipboard.writeText(depositGuideText(calc, subtitle)); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { alert('복사에 실패했습니다. 길게 눌러 직접 복사해 주세요.') }
  }
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 animate-backdrop" />
      <div
        className="relative w-full max-w-[480px] bg-white rounded-t-[28px] max-h-[85vh] overflow-y-auto p-6 pb-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[#e5e8eb] rounded-full mx-auto mb-5" />
        <h3 className="text-[18px] font-extrabold text-[#191f28] mb-1">이 내용으로 신청하시나요?</h3>
        <p className="text-[13px] text-[#5f6b7a] mb-5">내용을 확인하고 제출해 주세요.</p>

        {memberSummary && (
          <div className="bg-[#f9fafb] rounded-2xl p-4 mb-4">
            <div className="text-[13px] font-bold text-[#4e5968] mb-2">신청 인원</div>
            {memberSummary}
          </div>
        )}

        <div className="bg-[#f9fafb] rounded-2xl p-4 mb-4">
          <div className="text-[13px] font-bold text-[#4e5968] mb-3">입금 항목</div>
          <div className="space-y-2">
            {calc.lines.map((l, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-[13px] text-[#4e5968]">
                  <span className="inline-block bg-[#f2f8ff] text-[#1b64da] text-[12px] font-bold px-1.5 py-0.5 rounded-md mr-1.5">{l.cat}</span>
                  {l.payer}{l.note ? <span className="text-[#5f6b7a]"> ({l.note})</span> : ''}
                </span>
                <span className="text-[14px] font-bold text-[#191f28]">{won(l.amt)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-[#e5e8eb] flex items-center justify-between">
            <span className="text-[14px] font-bold text-[#191f28]">총 합계</span>
            <span className="text-[22px] font-extrabold text-[#191f28]">{won(calc.total)}</span>
          </div>
          {calc.count > 1 && (
            <div className="mt-1 text-right text-[13px] text-[#5f6b7a]">1인 평균 {won(calc.perPerson)} · {calc.count}명</div>
          )}
        </div>

        {subtitle && (
          <div className="bg-[#fff9e6] border border-[#ffe082] rounded-xl px-4 py-3 mb-5">
            <div className="text-[13px] font-bold text-[#b45309] mb-1">입금 안내</div>
            <div className="text-[13px] text-[#78350f] leading-relaxed">{subtitle}</div>
            <div className="text-[13px] font-bold text-[#191f28] mt-1">{ACCOUNT}</div>
          </div>
        )}

        <button
          onClick={copyGuide}
          className="w-full py-3.5 rounded-2xl bg-[#f2f8ff] text-[#1b64da] font-bold text-[15px] border border-[#d8e8ff] mb-2 min-h-[52px]"
        >
          {copied ? '✓ 복사 완료' : '입금 안내 문구 복사하기'}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-[#191f28] text-white font-bold text-[16px] shadow-lg mb-2"
        >
          {loading ? '제출 중…' : '저장하고 제출하기'}
        </button>
        <button onClick={onClose} className="w-full py-3 rounded-2xl bg-[#f2f4f6] text-[#4e5968] font-bold text-[14px]">
          돌아가서 수정하기
        </button>
      </div>
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
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitDone, setSubmitDone] = useState(null)
  const [submitErr, setSubmitErr] = useState('')
  const [showErr, setShowErr] = useState(false)

  const d = DEPTS.find((x) => x.name === dept)
  const room = ROOMS[roomIdx]

  const missing = []
  if (!name.trim()) missing.push('이름')
  if (!gender) missing.push('성별')
  if (!contact.trim()) missing.push('연락처')
  if (!email.trim()) missing.push('이메일')
  if (!campus) missing.push('캠퍼스')
  // #3 미입력 시 첫 빈 칸으로 이동 + 인라인 에러. 채워지면 즉시 사라짐.
  const tryNext = () => {
    if (missing.length) {
      setShowErr(true)
      var order = [['f-name', !name.trim()], ['f-gender', !gender], ['f-contact', !contact.trim()], ['f-email', !email.trim()], ['f-campus', !campus]]
      var first = order.filter(function (o) { return o[1] })[0]
      if (first) scrollToId(first[0])
      return
    }
    setConfirmOpen(true)
  }
  const errCls = (bad) => inputCls + (showErr && bad ? ' border-2 border-[#f04452] focus:ring-[#f04452]' : '')

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
  const subtitle = `입금자명: ${name.trim() || '이름'} (본인 이름으로 입금)`

  const doSubmit = async () => {
    setSubmitLoading(true); setSubmitErr('')
    try {
      const res = await fetch(SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...submission, guideText: depositGuideText(calc, '※ ' + subtitle) }),
      })
      const j = await res.json()
      if (j.ok) { setSubmitDone(j); setConfirmOpen(false) }
      else { setSubmitErr(j.error || '제출 실패'); setConfirmOpen(false) }
    } catch (e) { setSubmitErr(String(e)); setConfirmOpen(false) }
    finally { setSubmitLoading(false) }
  }

  if (submitDone) {
    return (
      <Card title="신청 완료">
        <div className="text-center py-4">
          <div className="text-[48px] mb-3">✅</div>
          <div className="text-[17px] font-bold text-[#191f28] mb-2">신청서가 제출되었습니다</div>
          <div className="text-[14px] text-[#5f6b7a]">
            접수번호 {submitDone.groupId} · 총 {won(submitDone.total || 0)}
          </div>
          <p className="text-[14px] text-[#4e5968] mt-4 leading-relaxed">
            입금까지 완료해야 등록이 확정됩니다.<br />아래 "입금 안내"대로 항목별로 입금해 주세요.
          </p>
        </div>
        <ResultPanel calc={calc} subtitle={`※ 입금자명: ${name.trim()}`} />
      </Card>
    )
  }

  const memberSummary = (
    <div className="text-[14px] text-[#191f28]">
      <span className="font-bold">{name.trim() || '(이름 미입력)'}</span>
      <span className="text-[#5f6b7a] ml-2">{gender} · {dept} · {campus.replace(' 캠퍼스', '')} 캠퍼스</span>
    </div>
  )

  return (
    <>
      <StepGuide steps={[{ id: 'sec-info', label: '정보' }, { id: 'sec-dept', label: '부서' }, { id: 'sec-room', label: '방' }, { id: 'sec-move', label: '이동' }]} />
      <Card title="신청자 정보" id="sec-info" step={1}>
        <Field label="이름" required id="f-name" error={showErr && !name.trim() ? '이름을 입력해 주세요.' : ''}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김바울" className={errCls(!name.trim())} />
        </Field>
        <Field label="성별" required id="f-gender" error={showErr && !gender ? '성별을 선택해 주세요.' : ''}>
          <SegPicker value={gender} onChange={setGender} options={['남', '여']} invalid={showErr && !gender} />
        </Field>
        <Field label="연락처" required id="f-contact" error={showErr && !contact.trim() ? '연락처를 입력해 주세요.' : ''}>
          <input value={contact} onChange={(e) => setContact(fmtPhone(e.target.value))} placeholder="010-0000-0000" inputMode="tel" className={errCls(!contact.trim())} />
        </Field>
        <Field label="이메일" required id="f-email" error={showErr && !email.trim() ? '이메일을 입력해 주세요.' : ''}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@gmail.com" inputMode="email" className={errCls(!email.trim())} />
        </Field>
        <Field label="주로 예배드리는 캠퍼스" required id="f-campus" error={showErr && !campus ? '캠퍼스를 선택해 주세요.' : ''}>
          <SegPicker value={campus} onChange={setCampus} options={CAMPUSES} render={(c) => c.replace(' 캠퍼스', '')} invalid={showErr && !campus} />
        </Field>
        <Field label="문의사항 (선택)">
          <textarea value={inquiry} onChange={(e) => setInquiry(e.target.value)} rows={2} className={inputCls + ' resize-none'} />
        </Field>
      </Card>

      <Card title="소속 부서" id="sec-dept" step={2} help={HELP.dept} helpTitle="소속부서 / 등록비 안내">
        <p className="text-[13px] text-[#5f6b7a] mb-3 leading-relaxed">부서에 따라 1인 등록비가 달라집니다.</p>
        <DeptSelect value={dept} onChange={setDept} />
        <div className="mt-3 bg-[#f2f8ff] rounded-xl px-4 py-3">
          <span className="text-[13px] text-[#4e5968]">선택한 등록비</span>
          <span className="text-[17px] font-extrabold text-[#1b64da] ml-3">{won(d.fee)}</span>
        </div>
      </Card>

      <Card title="방 선택" id="sec-room" step={3} help={HELP.room} helpTitle="객실 종류 안내">
        <p className="text-[13px] text-[#5f6b7a] mb-3 leading-relaxed">
          혼자 등록하시면 교회에서 방을 배정해 드립니다. 원하는 방이 있으면 선택하세요. (추가 비용 발생 가능)
        </p>
        <div className="space-y-2">
          {ROOMS.map((r, i) => (
            <OptionRow
              key={r.name}
              active={roomIdx === i}
              onClick={() => setRoomIdx(i)}
              title={r.name}
              sub={r.desc}
              right={r.indiv > 0 ? `+${won(r.indiv)}` : '추가비용 없음'}
            />
          ))}
        </div>
        <FloorPlan room={room} />
      </Card>

      <Card title="교통 / 설악산뷰" id="sec-move" step={4} help={HELP.move} helpTitle="버스 / 설악산뷰 안내">
        <div className="space-y-3">
          <Toggle
            on={bus}
            onChange={setBus}
            label="버스 이용하겠습니다"
            sub={`왕복 · 자차 이용 시 선택 안 함`}
            price={`+${won(BUS_FEE)}`}
          />
          <Toggle
            on={seorak}
            onChange={setSeorak}
            label="설악산 뷰 신청하겠습니다"
            sub="선착순 배정"
            price={`+${won(SEORAK_FEE)}`}
          />
        </div>
      </Card>

      <LiveSummary calc={calc} subtitle={subtitle} />
      <div className="bg-white rounded-[22px] shadow-sm border border-[#f2f4f6] p-4 mb-3">
        <div className="text-[13px] font-bold text-[#191f28] mb-2">💡 입금자명 예시</div>
        <DepositExample />
        <p className="text-[12px] text-[#5f6b7a] leading-relaxed mt-2">계좌번호와 항목별 복사는 제출 완료 화면에 안내됩니다.</p>
      </div>
      {submitErr && <p className="text-[13px] text-[#f04452] font-semibold mb-2 leading-relaxed">제출 오류: {submitErr}</p>}
      <p className="text-[12px] text-[#5f6b7a] mb-2 leading-relaxed text-center">제출 후 입금까지 완료해야 등록이 확정됩니다.</p>
      <StickyBar total={calc.total} count={1} hint="총 등록 금액" cta="신청 내용 확인" onCta={tryNext} />

      <ConfirmSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doSubmit}
        calc={calc}
        subtitle={`${name.trim() || '이름'} 이름으로 항목별 입금`}
        memberSummary={memberSummary}
        loading={submitLoading}
      />
    </>
  )
}

// ── 가족 / 그룹 등록 ──────────────────────────────────────────
function GroupMode() {
  const [leader, setLeader] = useState('')
  const [members, setMembers] = useState([{ name: '', dept: '장년부', bus: false, gender: '', campus: '' }])
  const [roomIdx, setRoomIdx] = useState(1)
  const [occOverride, setOccOverride] = useState(null) // null = 자동(인원수 기준)
  const [occOpen, setOccOpen] = useState(false) // 투숙인원 수동선택 영역 열기
  const [seorak, setSeorak] = useState(false)
  const [depositMode, setDepositMode] = useState('leader') // 'leader' | 'split'
  const [busSeorakBy, setBusSeorakBy] = useState('leader') // split일 때만: 'leader'(대표자 모아서) | 'each'(개인별)
  const [partial, setPartial] = useState(false) // 부분그룹: 나머지는 교회 배정(투숙비 추후결정)
  const [partialPref, setPartialPref] = useState('') // 부분그룹 희망 방 인원(추후결정, 참고용)
  const [fillByChurch, setFillByChurch] = useState(false) // 확정그룹 + 큰 방, 빈자리는 교회가 채움
  const [email, setEmail] = useState('')
  const [contact, setContact] = useState('')
  const [campus, setCampus] = useState('')
  const [inquiry, setInquiry] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitDone, setSubmitDone] = useState(null)
  const [submitErr, setSubmitErr] = useState('')
  const [showErr, setShowErr] = useState(false)

  const room = ROOMS[roomIdx]
  const count = members.length
  const effOcc = occOverride != null ? OCCUPANCY.find((o) => o.label === occOverride) : deriveOcc(count)
  const who = leader.trim() || '대표자'
  // 방 정원이 등록 인원보다 클 때의 빈자리 수 (확정그룹 + 큰 방, 빈자리 교회배정)
  const roomGap = (!partial && effOcc && effOcc.people > count) ? (effOcc.people - count) : 0

  const updateMember = (i, patch) =>
    setMembers((m) => m.map((mm, idx) => (idx === i ? { ...mm, ...patch } : mm)))
  const addMember = () => setMembers((m) => [...m, { name: '', dept: '장년부', bus: false, gender: '', campus: '' }])
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
  const memberIncomplete = members.some((m) => !m.name.trim() || !m.gender)
  const tryNext = () => {
    if (missing.length) {
      setShowErr(true)
      var order = [['f-leader', !leader.trim()], ['f-contact', !contact.trim()], ['f-email', !email.trim()], ['f-campus', !campus], ['f-members', memberIncomplete]]
      var first = order.filter(function (o) { return o[1] })[0]
      if (first) scrollToId(first[0])
      return
    }
    setConfirmOpen(true)
  }
  const errCls = (bad) => inputCls + (showErr && bad ? ' border-2 border-[#f04452] focus:ring-[#f04452]' : '')

  const submission = {
    mode: '그룹', email: email.trim(), contact: contact.trim(), campus, leader: leader.trim(), inquiry: inquiry.trim(),
    roomLabel: room.label, occLabel: partial ? OCC_PARTIAL : effOcc.formLabel, seorak, depositMode,
    roster: partial ? roster + ' [부분그룹·나머지 교회배정' + (partialPref ? '·희망 ' + (partialPref === '상관없음' ? '인원무관' : partialPref) : '') + ']' : (fillByChurch && roomGap > 0 ? roster + ' [빈자리 ' + roomGap + '자리 교회배정 요청]' : roster),
    members: members.map((m) => ({ name: m.name.trim(), gender: m.gender, deptLabel: DEPTS.find((d) => d.name === m.dept).label, bus: m.bus, campus: m.campus || campus })),
  }

  const calc = useMemo(() => {
    const memberFee = (m) => DEPTS.find((d) => d.name === m.dept)?.fee || 0
    const baseSum = members.reduce((s, m) => s + memberFee(m), 0)
    const busCount = members.filter((m) => m.bus).length
    const roomGroup = room.group
    const occFee = partial ? 0 : effOcc.fee // 부분그룹: 투숙(그룹)비 추후결정 → 지금은 0
    const busTotal = busCount * BUS_FEE
    const seorakTotal = seorak ? count * SEORAK_FEE : 0
    const total = baseSum + roomGroup + occFee + busTotal + seorakTotal

    const lines = []
    if (depositMode === 'split') {
      members.forEach((m, i) =>
        lines.push({ cat: '등록', payer: m.name.trim() || `구성원${i + 1}`, amt: memberFee(m), note: m.dept }),
      )
    } else {
      lines.push({ cat: '등록비', payer: who, amt: baseSum, note: `${count}명 합산` })
    }
    if (roomGroup > 0) lines.push({ cat: '객실선택', payer: who, amt: roomGroup, note: partial ? `${room.name} · 그룹 기준` : room.name })
    if (occFee > 0) lines.push({ cat: '그룹', payer: who, amt: occFee, note: `${effOcc.label} 투숙` })
    // 버스·설악: split 모드에서 '개인별'이면 각자 본인 이름으로, 아니면 대표자가 모아서
    const byEach = depositMode === 'split' && busSeorakBy === 'each'
    if (busTotal > 0) {
      if (byEach) members.forEach((m, i) => { if (m.bus) lines.push({ cat: '버스비', payer: m.name.trim() || `구성원${i + 1}`, amt: BUS_FEE }) })
      else lines.push({ cat: '버스비', payer: who, amt: busTotal, note: `${busCount}명` })
    }
    if (seorakTotal > 0) {
      if (byEach) members.forEach((m, i) => lines.push({ cat: '설악산', payer: m.name.trim() || `구성원${i + 1}`, amt: SEORAK_FEE }))
      else lines.push({ cat: '설악산', payer: who, amt: seorakTotal, note: `${count}명 전원` })
    }

    return { total, perPerson: Math.round(total / count), lines, count, overMax: count > room.max }
  }, [members, room, effOcc, count, seorak, depositMode, busSeorakBy, partial, who])

  const subtitle =
    depositMode === 'split'
      ? (busSeorakBy === 'each'
          ? `등록비·버스·설악산뷰는 각 구성원 이름으로, 공동비용(객실·그룹비)은 대표자 ${who} 이름으로 입금`
          : `등록비는 각 구성원 이름으로, 공동비용(객실·그룹비·버스·설악산뷰)은 대표자 ${who} 이름으로 입금`)
      : `모든 항목 대표자 ${who} 이름으로 입금`

  const doSubmit = async () => {
    setSubmitLoading(true); setSubmitErr('')
    try {
      const res = await fetch(SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...submission, guideText: depositGuideText(calc, '※ ' + subtitle) }),
      })
      const j = await res.json()
      if (j.ok) { setSubmitDone(j); setConfirmOpen(false) }
      else { setSubmitErr(j.error || '제출 실패'); setConfirmOpen(false) }
    } catch (e) { setSubmitErr(String(e)); setConfirmOpen(false) }
    finally { setSubmitLoading(false) }
  }

  if (submitDone) {
    return (
      <Card title="신청 완료">
        <div className="text-center py-4">
          <div className="text-[48px] mb-3">✅</div>
          <div className="text-[17px] font-bold text-[#191f28] mb-2">신청서가 제출되었습니다</div>
          <div className="text-[14px] text-[#5f6b7a]">
            접수번호 {submitDone.groupId} · {submitDone.rows}명 · 총 {won(submitDone.total || 0)}
          </div>
          <p className="text-[14px] text-[#4e5968] mt-4 leading-relaxed">
            입금까지 완료해야 등록이 확정됩니다.<br />아래 "입금 안내"대로 항목별로 입금해 주세요.
          </p>
        </div>
        <ResultPanel calc={calc} subtitle={`※ ${subtitle}`} />
      </Card>
    )
  }

  const memberSummary = (
    <div className="space-y-1.5">
      {members.map((m, i) => (
        <div key={i} className="flex items-center gap-2 text-[14px]">
          <span className="font-bold text-[#191f28]">{m.name.trim() || `(${i+1}번 이름 미입력)`}</span>
          <span className="text-[#5f6b7a]">{m.gender} · {m.dept}{m.bus ? ' · 버스' : ''}</span>
          {i === 0 && <span className="text-[12px] text-white bg-[#3182f6] rounded-full px-1.5 py-0.5 font-bold">대표</span>}
        </div>
      ))}
    </div>
  )

  return (
    <>
      <StepGuide steps={[{ id: 'sec-leader', label: '대표자' }, { id: 'sec-members', label: '구성원' }, { id: 'sec-room', label: '방' }, { id: 'sec-deposit', label: '입금' }]} />
      <Card title="대표자 정보" id="sec-leader" step={1}>
        <p className="text-[13px] text-[#5f6b7a] mb-4 leading-relaxed">
          가족·그룹을 대표해서 신청하는 분의 정보입니다. 공동비용 입금 시 이 이름으로 입금합니다.
        </p>
        <Field label="대표자 이름" required id="f-leader" error={showErr && !leader.trim() ? '대표자 이름을 입력해 주세요.' : ''}>
          <input value={leader} onChange={(e) => { setLeader(e.target.value); updateMember(0, { name: e.target.value }) }} placeholder="예: 김바울" className={errCls(!leader.trim())} />
        </Field>
        <Field label="연락처" required id="f-contact" error={showErr && !contact.trim() ? '연락처를 입력해 주세요.' : ''}>
          <input value={contact} onChange={(e) => setContact(fmtPhone(e.target.value))} placeholder="010-0000-0000" inputMode="tel" className={errCls(!contact.trim())} />
        </Field>
        <Field label="이메일" required id="f-email" error={showErr && !email.trim() ? '이메일을 입력해 주세요.' : ''}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@gmail.com" inputMode="email" className={errCls(!email.trim())} />
        </Field>
        <Field label="주로 예배드리는 캠퍼스" required id="f-campus" error={showErr && !campus ? '캠퍼스를 선택해 주세요.' : ''}>
          <SegPicker value={campus} onChange={setCampus} options={CAMPUSES} render={(c) => c.replace(' 캠퍼스', '')} invalid={showErr && !campus} />
        </Field>
        <Field label="문의사항 (선택)">
          <textarea value={inquiry} onChange={(e) => setInquiry(e.target.value)} rows={2} className={inputCls + ' resize-none'} />
        </Field>
      </Card>

      <div id="f-members" className="scroll-mt-24" />
      <Card title="구성원" id="sec-members" step={2} badge={count} help={HELP.members} helpTitle="가족 · 그룹 신청 안내">
        {showErr && memberIncomplete && (
          <p className="text-[12px] font-semibold text-[#f04452] mb-2">모든 구성원의 이름과 성별을 입력해 주세요.</p>
        )}
        <div className="space-y-3">
          {members.map((m, i) => (
            <div key={i} className="bg-[#f9fafb] rounded-2xl p-4 border border-[#f2f4f6]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-bold text-[#4e5968]">
                  {i + 1}번 구성원{i === 0 ? <span className="text-[#3182f6] ml-1">(대표자)</span> : ''}
                </span>
                {members.length > 1 && (
                  <button onClick={() => removeMember(i)} className="text-[13px] font-bold text-[#f04452] min-w-[44px] min-h-[44px] flex items-center justify-end">삭제</button>
                )}
              </div>
              <input
                value={m.name}
                onChange={(e) => updateMember(i, { name: e.target.value })}
                placeholder={i === 0 ? '대표자 이름 (위에서 자동 입력)' : '이름'}
                className={`w-full bg-white rounded-xl px-3 py-3 text-[15px] mb-3 focus:ring-2 focus:ring-[#3182f6] focus:outline-none min-h-[48px] border ${showErr && !m.name.trim() ? 'border-2 border-[#f04452] bg-[#fff5f5]' : 'border-[#e5e8eb]'}`}
              />
              <div className="flex gap-2 mb-3">
                {['남', '여'].map((g) => (
                  <button
                    key={g}
                    onClick={() => updateMember(i, { gender: g })}
                    className={`flex-1 py-3 rounded-xl text-[14px] font-bold border transition-all min-h-[48px] ${
                      m.gender === g ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]'
                        : showErr && !m.gender ? 'border-2 border-[#f04452] bg-[#fff5f5] text-[#f04452]' : 'border border-[#e5e8eb] text-[#5f6b7a]'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <DeptSelect value={m.dept} onChange={(v) => updateMember(i, { dept: v })} />
              <div className="mt-3">
                <div className="text-[12px] font-bold text-[#5f6b7a] mb-1.5">캠퍼스 {(m.campus || campus) ? '' : '(미선택 시 대표자와 동일)'}</div>
                <div className="flex gap-2">
                  {CAMPUSES.map((c) => {
                    const active = (m.campus || campus) === c
                    return (
                      <button
                        key={c}
                        onClick={() => updateMember(i, { campus: c })}
                        className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold border transition-all min-h-[44px] ${active ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#5f6b7a]'}`}
                      >
                        {c.replace(' 캠퍼스', '')}
                      </button>
                    )
                  })}
                </div>
              </div>
              <button
                onClick={() => updateMember(i, { bus: !m.bus })}
                className={`w-full mt-3 py-3 rounded-xl text-[14px] font-bold border transition-all min-h-[48px] ${
                  m.bus ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#5f6b7a]'
                }`}
              >
                버스 이용하겠습니다{m.bus ? ' ✓' : ''} <span className="font-normal text-[13px]">(왕복 {won(BUS_FEE)})</span>
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addMember}
          className="w-full mt-3 py-4 rounded-2xl text-[14px] font-bold text-[#3182f6] bg-[#f2f8ff] border-2 border-dashed border-[#3182f6]/30 hover:bg-[#e8f3ff] min-h-[52px]"
        >
          + 구성원 추가
        </button>
      </Card>

      <Card title="몇 분이 한 방을 쓰나요?" step={3} help={HELP.occupancy} helpTitle="투숙 인원 / 방배정 안내">
        <div className="bg-[#f2f8ff] rounded-2xl px-4 py-4 mb-3 flex items-center justify-between">
          <div>
            <div className="text-[13px] text-[#4e5968] mb-0.5">{partial ? '부분 그룹 신청' : '현재 구성원 수 기준 자동 적용'}</div>
            <div className="text-[17px] font-extrabold text-[#1b64da]">
              {partial ? (
                <>나머지는 교회 배정<span className="text-[14px] font-bold text-[#5f6b7a] ml-2">추가비용 추후 결정</span></>
              ) : (
                <>
                  {effOcc.label} 투숙
                  {effOcc.fee > 0
                    ? <span className="text-[14px] font-bold text-[#1b64da] ml-2">+{won(effOcc.fee)}</span>
                    : <span className="text-[14px] font-bold text-[#15803d] ml-2">추가비용 없음</span>
                  }
                </>
              )}
            </div>
            {!partial && occOverride != null && (
              <div className="text-[12px] text-[#5f6b7a] mt-0.5">(수동 선택 중)</div>
            )}
          </div>
          {!partial && occOverride != null && (
            <button
              onClick={() => { setOccOverride(null); setOccOpen(false) }}
              className="text-[12px] font-bold text-[#3182f6] min-w-[44px] min-h-[44px] flex items-center justify-end"
            >
              자동으로
            </button>
          )}
        </div>

        {!partial && effOcc.fee > 0 && (
          <div className="bg-[#f7f8fa] rounded-xl px-4 py-3 mb-3 text-[13px] text-[#4e5968] leading-relaxed">
            한 방에 <b>적은 인원</b>이 투숙할수록 방값을 나눠 내는 사람이 적어 1인당 부담이 올라갑니다.
            <span className="block text-[12px] text-[#5f6b7a] mt-1">이 방 기준 1인당 약 {won(Math.round(effOcc.fee / count))} · 인원이 늘면 자동으로 낮아져요.</span>
          </div>
        )}

        {/* #7 부분그룹 체크박스 */}
        <button
          onClick={() => setPartial((v) => !v)}
          className={`w-full mb-3 flex items-start gap-2 text-left px-4 py-3 rounded-xl border transition-all ${partial ? 'border-2 border-[#3182f6] bg-[#f2f8ff]' : 'border border-[#e5e8eb] bg-white'}`}
        >
          <span className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center text-[12px] font-bold shrink-0 ${partial ? 'bg-[#3182f6] text-white' : 'border border-[#c4c9d0] text-transparent'}`}>✓</span>
          <span className="text-[13px] font-bold text-[#333d4b] leading-snug">
            나머지 멤버는 교회에서 배정해주시면 좋겠습니다.
            <span className="block text-[12px] font-normal text-[#5f6b7a] mt-0.5">이 경우 추가금(그룹 투숙비)은 추후 결정됩니다.</span>
          </span>
        </button>

        {!partial && (
          <>
            <button
              onClick={() => setOccOpen((v) => !v)}
              className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-[#f9fafb] border border-[#e5e8eb] text-[13px] font-bold text-[#4e5968] min-h-[48px]"
            >
              <span>직접 선택하기</span>
              <span className={`text-[#5f6b7a] text-[12px] transition-transform ${occOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {occOpen && (
              <div className="mt-3">
                <p className="text-[13px] text-[#5f6b7a] mb-3 leading-relaxed">
                  방에 실제로 투숙하는 인원에 따라 추가비용이 달라집니다. 7~8명이면 추가비용 없음.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {OCCUPANCY.map((o) => (
                    <button
                      key={o.label}
                      onClick={() => { setOccOverride(o.label); setOccOpen(false) }}
                      className={`py-3 rounded-xl text-[14px] font-bold border transition-all min-h-[52px] ${
                        occOverride === o.label ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#333d4b]'
                      }`}
                    >
                      {o.label}<br />
                      <span className="text-[13px] font-normal text-[#5f6b7a]">{o.fee > 0 ? `+${o.fee/10000}만원` : '추가없음'}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[13px] text-[#5f6b7a] mt-3 leading-relaxed">
                  * 일부만 함께 쓰는 경우는 위 체크박스를 이용하거나 문의사항에 적어주세요.
                </p>
              </div>
            )}
          </>
        )}
        {partial && (
          <div>
            <p className="text-[13px] text-[#5f6b7a] mb-3 leading-relaxed">
              나머지 인원은 교회에서 배정해드립니다. 원하는 방 인원이 있으면 골라주세요. <b>추가비용은 최종 방배정 후 결정</b>됩니다.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {OCCUPANCY.map((o) => (
                <button
                  key={o.label}
                  onClick={() => setPartialPref(o.label)}
                  className={`py-3 rounded-xl text-[14px] font-bold border transition-all min-h-[52px] ${partialPref === o.label ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#333d4b]'}`}
                >
                  {o.label}<br />
                  <span className="text-[12px] font-normal text-[#5f6b7a]">추후 결정됨</span>
                </button>
              ))}
              <button
                onClick={() => setPartialPref('상관없음')}
                className={`py-3 rounded-xl text-[14px] font-bold border transition-all min-h-[52px] ${partialPref === '상관없음' ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#333d4b]'}`}
              >
                인원은 상관없습니다<br />
                <span className="text-[12px] font-normal text-[#5f6b7a]">추후 결정됨</span>
              </button>
            </div>
          </div>
        )}
        {/* 확정그룹 + 큰 방: 빈자리 교회배정 요청 (예: 4명인데 6~8인 방) */}
        {roomGap > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setFillByChurch((v) => !v)}
              className={`w-full flex items-start gap-2 text-left px-4 py-3 rounded-xl border transition-all ${fillByChurch ? 'border-2 border-[#3182f6] bg-[#f2f8ff]' : 'border border-[#e5e8eb] bg-white'}`}
            >
              <span className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center text-[12px] font-bold shrink-0 ${fillByChurch ? 'bg-[#3182f6] text-white' : 'border border-[#c4c9d0] text-transparent'}`}>✓</span>
              <span className="text-[13px] font-bold text-[#333d4b] leading-snug">
                남는 {roomGap}자리는 교회에서 다른 분으로 배정해 주세요
                <span className="block text-[12px] font-normal text-[#5f6b7a] mt-0.5">우리 {count}명은 한 방으로 확정하고, 빈자리({roomGap}자리)는 교회가 채워줍니다. 추가되는 분은 본인 등록비를 따로 냅니다.</span>
              </span>
            </button>
          </div>
        )}
      </Card>

      <Card title="방 선택" id="sec-room" step={4} help={HELP.room} helpTitle="객실 종류 안내">
        <div className="space-y-2">
          {ROOMS.map((r, i) => (
            <OptionRow
              key={r.name}
              active={roomIdx === i}
              onClick={() => setRoomIdx(i)}
              title={r.name}
              sub={r.desc}
              right={partial
                ? (r.indiv > 0 ? `1인 +${won(r.indiv)}` : '추가비용 없음')
                : (r.group > 0 ? `+${won(r.group)}` : '추가비용 없음')}
            />
          ))}
        </div>
        <FloorPlan room={room} />
        {partial && (
          <p className="text-[13px] text-[#5f6b7a] mt-3 leading-relaxed">
            * 부분 그룹은 <b>1인 기준</b> 객실 추가비용을 참고로 보여드립니다. 입금 안내는 방(그룹) 기준으로 안내되며, 최종 방배정 후 조정될 수 있습니다.
          </p>
        )}
        {calc.overMax && (
          <p className="text-[13px] text-[#f04452] font-bold mt-3">
            구성원 {count}명이 선택한 방 최대 인원({room.max}명)을 초과합니다.
          </p>
        )}
      </Card>

      <Card title="설악산 뷰" step={5} help={HELP.seorakGroup} helpTitle="설악산뷰 안내">
        <Toggle
          on={seorak}
          onChange={setSeorak}
          label="설악산 뷰 신청하겠습니다 (전원 적용)"
          sub={`같은 방이라 모두 적용 · ${count}명 × ${won(SEORAK_FEE)}`}
          price={seorak ? `+${won(count * SEORAK_FEE)}` : `+${won(count * SEORAK_FEE)}`}
        />
      </Card>

      <Card title="등록비 입금은 어떻게 하실 건가요?" id="sec-deposit" step={6} help={HELP.depositMode} helpTitle="입금 방식 안내">
        <div className="space-y-2">
          <button
            onClick={() => setDepositMode('leader')}
            className={`w-full px-4 py-4 rounded-2xl text-left transition-all min-h-[64px] border ${
              depositMode === 'leader' ? 'border-2 border-[#3182f6] bg-[#f2f8ff]' : 'border border-[#e5e8eb] bg-white'
            }`}
          >
            <div className={`text-[15px] font-bold ${depositMode === 'leader' ? 'text-[#1b64da]' : 'text-[#333d4b]'}`}>
              대표자가 한꺼번에 입금
            </div>
            <div className="text-[13px] text-[#5f6b7a] mt-0.5">
              모든 항목을 대표자({who}) 이름으로 입금
            </div>
          </button>
          <button
            onClick={() => setDepositMode('split')}
            className={`w-full px-4 py-4 rounded-2xl text-left transition-all min-h-[64px] border ${
              depositMode === 'split' ? 'border-2 border-[#3182f6] bg-[#f2f8ff]' : 'border border-[#e5e8eb] bg-white'
            }`}
          >
            <div className={`text-[15px] font-bold ${depositMode === 'split' ? 'text-[#1b64da]' : 'text-[#333d4b]'}`}>
              각자 등록비를 본인 이름으로 입금
            </div>
            <div className="text-[13px] text-[#5f6b7a] mt-0.5">
              등록비만 각자, 공동비용(방·그룹비)은 대표자 이름
            </div>
          </button>
        </div>
        {depositMode === 'split' && (
          <>
            <p className="text-[13px] text-[#4e5968] mt-3 bg-[#f2f8ff] rounded-xl px-4 py-3 leading-relaxed">
              구성원 이름이 입금자명으로 사용됩니다. 위에 이름을 정확히 입력해 주세요.
            </p>
            <div className="mt-3">
              <div className="text-[13px] font-bold text-[#4e5968] mb-2">버스비·설악산뷰는 어떻게 입금하실 건가요?</div>
              <div className="space-y-2">
                <button
                  onClick={() => setBusSeorakBy('each')}
                  className={`w-full px-4 py-3 rounded-xl text-left text-[14px] font-bold border min-h-[52px] ${busSeorakBy === 'each' ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#333d4b]'}`}
                >
                  개인별로 등록비에 합해서 입금
                  <span className="block text-[12px] font-normal text-[#5f6b7a] mt-0.5">버스·설악산뷰를 각자 본인 이름으로</span>
                </button>
                <button
                  onClick={() => setBusSeorakBy('leader')}
                  className={`w-full px-4 py-3 rounded-xl text-left text-[14px] font-bold border min-h-[52px] ${busSeorakBy === 'leader' ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#333d4b]'}`}
                >
                  대표자가 모아서 입금
                  <span className="block text-[12px] font-normal text-[#5f6b7a] mt-0.5">버스·설악산뷰를 대표자({who}) 이름으로</span>
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      <LiveSummary calc={calc} subtitle={subtitle} />
      <div className="bg-white rounded-[22px] shadow-sm border border-[#f2f4f6] p-4 mb-3">
        <div className="text-[13px] font-bold text-[#191f28] mb-2">💡 입금자명 예시</div>
        <DepositExample />
        <p className="text-[12px] text-[#5f6b7a] leading-relaxed mt-2">계좌번호와 항목별 복사는 제출 완료 화면에 안내됩니다.</p>
      </div>
      {submitErr && <p className="text-[13px] text-[#f04452] font-semibold mb-2 leading-relaxed">제출 오류: {submitErr}</p>}
      <p className="text-[12px] text-[#5f6b7a] mb-2 leading-relaxed text-center">제출 후 입금까지 완료해야 등록이 확정됩니다.</p>
      <StickyBar total={calc.total} count={count} perPerson={calc.perPerson} hint="총 등록 금액" cta="신청 내용 확인" onCta={tryNext} />

      <ConfirmSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doSubmit}
        calc={calc}
        subtitle={subtitle}
        memberSummary={memberSummary}
        loading={submitLoading}
      />
    </>
  )
}

// ── 결과 / 입금 안내 ──────────────────────────────────────────
// 입금 안내 복사 문구 (ResultPanel / ConfirmSheet 공용). 첫 줄에 컬럼 범례(#2).
function depositGuideText(calc, subtitle) {
  const legend = '▸ 입금자명   금액   (설명)'
  const lines = calc.lines
    .map((l) => `▸ ${l.cat}  ${l.payer}   ${won(l.amt)}${l.note ? `   (${l.note})` : ''}`)
    .join('\n')
  const perLine = calc.count > 1 ? `\n(1인 평균 ${won(calc.perPerson)} · ${calc.count}명)` : ''
  const sub = subtitle ? `${subtitle}\n` : ''
  return `[2026 전교인 리트릿 등록 입금 안내]\n입금 계좌: ${ACCOUNT}\n${sub}\n${legend}\n${lines}\n─────────────────\n총 합계: ${won(calc.total)}${perLine}\n\n* 원활한 등록 관리를 위하여, 위 항목별로 구분하여 따로 입금해 주시기를 부탁드립니다.`
}

// #3 입금자명 예시 이미지 (Claude Design에서 받은 디자인을 자체포함 iframe으로 — pulseRing 애니메이션 유지)
const DEPOSIT_EXAMPLE_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}html,body{margin:0;width:1080px;height:1350px;overflow:hidden;background:#e3ecfa}
@keyframes pulseRing{0%{transform:scale(0.94);opacity:0.55}70%{transform:scale(1.06);opacity:1}100%{transform:scale(0.94);opacity:0.55}}
</style></head><body><div>
<div style="width:1080px;height:1350px;background:linear-gradient(170deg,#eef3fb 0%,#e3ecfa 55%,#dbe7f8 100%);font-family:'Noto Sans KR',-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;padding:60px 80px 56px;position:relative;overflow:hidden;">
<div style="position:absolute;top:-120px;right:-100px;width:380px;height:380px;border-radius:50%;background:radial-gradient(circle,rgba(37,99,235,0.10),rgba(37,99,235,0) 70%);"></div>
<div style="position:absolute;bottom:-140px;left:-120px;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(37,99,235,0.08),rgba(37,99,235,0) 70%);"></div>
<div style="text-align:center;z-index:2;">
<div style="display:inline-block;background:#2563eb;color:#fff;font-size:26px;font-weight:700;letter-spacing:1px;padding:12px 26px;border-radius:999px;margin-bottom:28px;">송금 안내</div>
<h1 style="margin:0;font-size:72px;font-weight:900;color:#16233d;line-height:1.18;letter-spacing:-1.5px;">입금자명,<br>이렇게 적어주세요</h1>
</div>
<div style="margin-top:44px;width:470px;height:660px;background:#0f172a;border-radius:56px;padding:14px;box-shadow:0 40px 80px -20px rgba(15,40,90,0.35),0 0 0 2px rgba(255,255,255,0.5);z-index:2;position:relative;">
<div style="width:100%;height:100%;background:#f5f7fb;border-radius:44px;overflow:hidden;display:flex;flex-direction:column;position:relative;">
<div style="display:flex;justify-content:space-between;align-items:center;padding:20px 34px 8px;font-size:22px;font-weight:700;color:#16233d;"><span>9:41</span><span style="display:flex;gap:7px;align-items:center;"><span style="font-size:17px;">●●●</span><span style="font-size:17px;">📶</span><span style="display:inline-block;width:34px;height:17px;border:2px solid #16233d;border-radius:5px;position:relative;"><span style="position:absolute;inset:2px;right:7px;background:#16233d;border-radius:1px;"></span></span></span></div>
<div style="display:flex;align-items:center;gap:14px;padding:12px 28px 18px;"><span style="font-size:30px;color:#16233d;">‹</span><span style="font-size:26px;font-weight:700;color:#16233d;">계좌이체</span></div>
<div style="flex:1;background:#fff;border-radius:30px 30px 0 0;padding:34px 30px;display:flex;flex-direction:column;gap:22px;">
<div><div style="font-size:19px;font-weight:500;color:#8a94a6;margin-bottom:9px;">받는 분</div><div style="display:flex;align-items:center;gap:14px;background:#f1f5fb;border-radius:16px;padding:18px 20px;"><div style="width:44px;height:44px;border-radius:12px;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;">교</div><div><div style="font-size:25px;font-weight:700;color:#16233d;">주님의 교회</div><div style="font-size:17px;color:#8a94a6;margin-top:2px;">우리 1005-803-168121</div></div></div></div>
<div><div style="font-size:19px;font-weight:500;color:#8a94a6;margin-bottom:9px;">보낼 금액</div><div style="background:#f1f5fb;border-radius:16px;padding:18px 20px;display:flex;align-items:baseline;gap:8px;"><span style="font-size:40px;font-weight:900;color:#16233d;letter-spacing:-1px;">278,000</span><span style="font-size:24px;font-weight:700;color:#16233d;">원</span></div></div>
<div style="position:relative;"><div style="font-size:19px;font-weight:700;color:#2563eb;margin-bottom:9px;">입금자명</div><div style="position:relative;background:#eef4ff;border:3px solid #2563eb;border-radius:16px;padding:18px 20px;"><span style="font-size:28px;font-weight:900;color:#16233d;">등록비 김바울</span><div style="position:absolute;right:-16px;top:-16px;bottom:-16px;left:-16px;border:4px solid #2563eb;border-radius:22px;pointer-events:none;animation:pulseRing 1.8s ease-in-out infinite;"></div></div><div style="position:absolute;right:-8px;bottom:-58px;display:flex;align-items:center;gap:8px;"><span style="font-size:21px;font-weight:700;color:#2563eb;">항목 + 이름</span><span style="font-size:30px;color:#2563eb;transform:rotate(-12deg);">↖</span></div></div>
<div style="margin-top:auto;background:#2563eb;color:#fff;text-align:center;font-size:26px;font-weight:700;padding:22px;border-radius:18px;">이체하기</div>
</div></div></div>
<div style="margin-top:44px;text-align:center;z-index:2;max-width:880px;">
<p style="margin:0;font-size:34px;font-weight:700;color:#16233d;line-height:1.5;">항목마다 <span style="color:#2563eb;">따로 송금</span>하고,<br>입금자명은 <span style="color:#2563eb;">'항목 + 이름'</span> 으로!</p>
<div style="margin-top:24px;display:flex;gap:14px;justify-content:center;flex-wrap:wrap;"><span style="background:#fff;border:2px solid #c9d8f2;color:#2c4a7d;font-size:24px;font-weight:700;padding:12px 24px;border-radius:999px;">등록비 김바울</span><span style="background:#fff;border:2px solid #c9d8f2;color:#2c4a7d;font-size:24px;font-weight:700;padding:12px 24px;border-radius:999px;">버스비 김바울</span><span style="background:#fff;border:2px solid #c9d8f2;color:#2c4a7d;font-size:24px;font-weight:700;padding:12px 24px;border-radius:999px;">객실선택 김바울</span></div>
</div>
</div></div></body></html>`

function DepositExample() {
  const wrapRef = useRef(null)
  const [scale, setScale] = useState(0)
  useEffect(() => {
    const measure = () => { const w = wrapRef.current ? wrapRef.current.clientWidth : 0; if (w) setScale(w / 1080) }
    measure()
    const t = setTimeout(measure, 60) // 레이아웃 안정 후 한 번 더
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (ro && wrapRef.current) ro.observe(wrapRef.current)
    window.addEventListener('resize', measure)
    return () => { clearTimeout(t); if (ro) ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [])
  return (
    <div
      ref={wrapRef}
      className="rounded-2xl border border-[#e5e8eb] overflow-hidden"
      style={{ position: 'relative', width: '100%', height: scale ? Math.round(1350 * scale) : 0 }}
    >
      <iframe
        title="입금자명 예시"
        srcDoc={DEPOSIT_EXAMPLE_HTML}
        scrolling="no"
        style={{ position: 'absolute', top: 0, left: 0, width: '1080px', height: '1350px', transformOrigin: 'top left', transform: `scale(${scale || 0.0001})`, border: 0 }}
      />
    </div>
  )
}

// 폼에서 옵션 고르면 즉시 갱신되는 실시간 항목별 요약(입금 액션은 제출 완료 화면).
function LiveSummary({ calc, subtitle }) {
  return (
    <div className="bg-white rounded-2xl border border-[#f2f4f6] p-4 mb-3">
      <div className="text-[13px] font-bold text-[#191f28] mb-3">입금 예정 항목</div>
      <div className="space-y-2">
        {calc.lines.map((l, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-[13px] text-[#4e5968]">
              <span className="inline-block bg-[#f2f8ff] text-[#1b64da] text-[12px] font-bold px-1.5 py-0.5 rounded-md mr-1.5">{l.cat}</span>
              {l.payer}{l.note ? <span className="text-[#5f6b7a]"> ({l.note})</span> : ''}
            </span>
            <span className="text-[14px] font-bold text-[#191f28]">{won(l.amt)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-[#e5e8eb] flex items-center justify-between">
        <span className="text-[14px] font-bold text-[#191f28]">총 합계</span>
        <span className="text-[20px] font-extrabold text-[#191f28]">{won(calc.total)}</span>
      </div>
      {calc.count > 1 && <div className="mt-1 text-right text-[12px] text-[#5f6b7a]">1인 평균 {won(calc.perPerson)} · {calc.count}명</div>}
      {subtitle && <div className="mt-3 bg-[#f2f8ff] rounded-xl px-3 py-2 text-[12px] text-[#1b64da] leading-relaxed">{subtitle}</div>}
    </div>
  )
}

function ResultPanel({ calc, subtitle }) {
  const [copied, setCopied] = useState(false)

  const guideText = useMemo(() => depositGuideText(calc, subtitle), [calc, subtitle])

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
        <div className="text-[#adb5bd] text-[14px] font-bold mb-2">총 등록 금액</div>
        <div className="text-[36px] font-extrabold tracking-tight leading-none">
          {calc.total.toLocaleString('ko-KR')}
          <span className="text-[22px] font-medium text-[#adb5bd] ml-1">원</span>
        </div>
        {calc.count > 1 && (
          <div className="mt-4 pt-4 border-t border-white/10 flex justify-between text-[14px]">
            <span className="text-[#adb5bd]">1인 평균 ({calc.count}명)</span>
            <span className="font-bold text-[#3182f6]">{won(calc.perPerson)}</span>
          </div>
        )}
      </div>

      {/* 항목별 입금 안내 */}
      <Card title="항목별 입금 안내" help={HELP.deposit} helpTitle="입금 방법 안내">
        {subtitle && (
          <div className="bg-[#f2f8ff] rounded-xl px-4 py-3 mb-4">
            <p className="text-[13px] text-[#1b64da] font-semibold leading-relaxed">{subtitle}</p>
          </div>
        )}
        <p className="text-[13px] text-[#5f6b7a] mb-3 leading-relaxed">
          아래 항목별로 <b>각각 따로</b> 입금해 주세요. 입금자명 형식: "항목 이름"
        </p>
        <DepositExample />
        <div className="space-y-3">
          {calc.lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-[#f2f4f6] last:border-0">
              <div>
                <span className="inline-block bg-[#f2f8ff] text-[#1b64da] text-[13px] font-bold px-2.5 py-1 rounded-lg mr-2">
                  {l.cat} {l.payer}
                </span>
                {l.note && <span className="text-[12px] text-[#5f6b7a]">{l.note}</span>}
              </div>
              <span className="text-[15px] font-bold text-[#191f28]">{won(l.amt)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[14px] font-bold text-[#4e5968]">합계</span>
            <span className="text-[18px] font-extrabold text-[#191f28]">{won(calc.total)}</span>
          </div>
        </div>

        <div className="mt-4 bg-[#f9fafb] rounded-2xl p-4">
          <div className="text-[13px] text-[#5f6b7a] font-semibold mb-1">입금 계좌</div>
          <div className="text-[15px] font-bold text-[#191f28]">{ACCOUNT}</div>
        </div>

        <button
          onClick={copy}
          className="w-full mt-3 py-4 rounded-2xl bg-[#3182f6] hover:bg-[#1b64da] text-white font-bold text-[15px] transition-all shadow-lg min-h-[52px]"
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
        <p className="text-[12px] text-[#5f6b7a] leading-relaxed">
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
          <div className="text-[12px] text-[#5f6b7a]">
            접수번호 {result?.groupId} · {result?.rows}명 · 총 {won(result?.total || 0)}
          </div>
          <p className="text-[12px] text-[#5f6b7a] mt-3 leading-relaxed">
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
      <p className="text-[11px] text-[#5f6b7a] mt-3 leading-relaxed">
        * 제출 후에도 입금을 완료해야 등록이 확정됩니다. 가족/그룹은 구성원 정보를 정확히 입력해 주세요.
      </p>
    </Card>
  )
}

// ── 내 신청 조회 / 수정 ────────────────────────────────────────
function EditCard({ data, onDelete, hideSeorak }) {
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
          action: 'update', row: data.row, name: data.name, email: data.email,
          fields: { gender, contact, email, campus, deptLabel, bus, seorak, inquiry },
        }),
      })
      const j = await res.json()
      if (j.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
      else setErr(j.error || '수정 실패')
    } catch (e) { setErr(String(e)) } finally { setSaving(false) }
  }

  const isGroupRoom = /인이 투숙/.test(data.occLabel || '') || data.appType === '그룹'
  const selfRoom = isGroupRoom ? 0 : roomIndivFee(data.roomLabel)
  const common = data.common || 0
  const isRep = common > 0 || data.groupTotal > 0
  const deptF = DEPTS.find((d) => d.name === deptName)?.fee || 0
  const selfFee = deptF + selfRoom + (bus ? BUS_FEE : 0) + (seorak ? SEORAK_FEE : 0) + (isRep ? common : 0)
  const roomShort = (data.roomLabel || '').split(' (')[0]

  const feeBreakdown = [
    { label: '등록비', amt: deptF, note: deptName },
    selfRoom > 0 && { label: '객실 추가', amt: selfRoom, note: roomShort },
    bus && { label: '버스', amt: BUS_FEE, note: '왕복' },
    seorak && { label: '설악산뷰', amt: SEORAK_FEE },
    isRep && common > 0 && { label: '방·그룹비 (공동)', amt: common, note: '대표자 납부분' },
  ].filter(Boolean)

  return (
    <div className="bg-[#f9fafb] rounded-2xl p-4 border border-[#f2f4f6] mb-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[16px] font-bold text-[#191f28]">
          {data.name}
          {data.isSelf && <span className="ml-1.5 text-[11px] font-bold text-white bg-[#3182f6] rounded-full px-1.5 py-0.5 align-middle">본인</span>}
        </span>
        <div className="flex items-center gap-2">
          {data.rep && <span className="text-[12px] text-[#5f6b7a]">대표 {data.rep}</span>}
          {onDelete && (
            <button onClick={onDelete} className="text-[13px] font-bold text-[#f04452] min-w-[44px] min-h-[44px] flex items-center justify-end">삭제</button>
          )}
        </div>
      </div>

      {/* 내가 내야 할 금액 요약 */}
      <div className="bg-[#f2f8ff] rounded-2xl p-4 mb-4 border border-[#d8e8ff]">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-[14px] font-bold text-[#1b64da]">
            {isRep ? '내가 입금할 금액 (공동비용 포함)' : '내가 입금할 금액'}
          </span>
          <span className="text-[26px] font-extrabold text-[#191f28] leading-none">{won(selfFee)}</span>
        </div>
        <div className="space-y-1">
          {feeBreakdown.map((f, i) => (
            <div key={i} className="flex items-center justify-between text-[13px]">
              <span className="text-[#4e5968]">{f.label}{f.note ? <span className="text-[#5f6b7a]"> ({f.note})</span> : ''}</span>
              <span className="font-bold text-[#4e5968]">{won(f.amt)}</span>
            </div>
          ))}
        </div>
        {isGroupRoom && isRep && data.groupTotal > 0 && (
          <div className="mt-2 pt-2 border-t border-[#c8deff] text-[13px] text-[#5f6b7a]">
            그룹 전체 총액: {won(data.groupTotal)}
          </div>
        )}
        {isGroupRoom && !isRep && (
          <div className="mt-2 pt-2 border-t border-[#c8deff] text-[13px] text-[#5f6b7a]">
            방·그룹비는 대표자({data.rep || '-'})가 납부
          </div>
        )}
      </div>

      <Field label="성별"><SegPicker value={gender} onChange={setGender} options={['남', '여']} /></Field>
      <Field label="연락처"><input value={contact} onChange={(e) => setContact(fmtPhone(e.target.value))} inputMode="tel" className={inputCls} /></Field>
      <Field label="이메일"><input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" className={inputCls} /></Field>
      <Field label="캠퍼스"><SegPicker value={campus} onChange={setCampus} options={CAMPUSES} render={(c) => c.replace(' 캠퍼스', '')} /></Field>
      <Field label="소속부서"><DeptSelect value={deptName} onChange={setDeptName} /></Field>
      <Field label={hideSeorak ? '버스' : '버스 / 설악산뷰'}>
        <div className="flex gap-2">
          <button onClick={() => setBus(!bus)} className={`flex-1 py-3 rounded-xl text-[14px] font-bold border min-h-[48px] ${bus ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#5f6b7a]'}`}>
            버스{bus ? ' ✓' : ''}
          </button>
          {!hideSeorak && (
            <button onClick={() => setSeorak(!seorak)} className={`flex-1 py-3 rounded-xl text-[14px] font-bold border min-h-[48px] ${seorak ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#5f6b7a]'}`}>
              설악산뷰{seorak ? ' ✓' : ''}
            </button>
          )}
        </div>
        {hideSeorak && <p className="text-[12px] text-[#5f6b7a] mt-1.5">설악산뷰는 그룹 공통입니다. 위 "설악산뷰(그룹 전체)"에서 변경하세요.</p>}
      </Field>
      <Field label="문의사항"><textarea value={inquiry} onChange={(e) => setInquiry(e.target.value)} rows={2} className={inputCls + ' resize-none'} /></Field>

      <div className="text-[13px] text-[#5f6b7a] bg-white rounded-xl p-3 mb-3 leading-relaxed">
        선택한 방: {roomShort || '-'} · 방 종류·투숙인원·입금자명 변경은 별도 문의 바랍니다.
      </div>

      {err && <p className="text-[13px] text-[#f04452] mb-3">{err}</p>}
      <button
        onClick={save}
        disabled={saving}
        className={`w-full py-4 rounded-2xl font-bold text-[15px] min-h-[52px] ${saved ? 'bg-[#15803d] text-white' : 'bg-[#191f28] text-white hover:bg-black'}`}
      >
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
  const occInit = (() => { if (/인원무관/.test(cur.occLabel || '')) return '상관없음'; const mm = (cur.occLabel || '').match(/(\d)인/); const ppl = mm ? +mm[1] : (members.length || 8); return (OCCUPANCY.find((o) => o.people === ppl || (ppl >= 7 && o.people === 8)) || OCCUPANCY[0]).label })()
  const [occSel, setOccSel] = useState(occInit)
  const [occStatus, setOccStatus] = useState(/인이 투숙/.test(cur.occLabel || '') ? 'confirmed' : 'pending') // #15 확정/미정
  const [seorakAll, setSeorakAll] = useState(members.some((m) => m.seorak)) // #11 설악 그룹 공통
  const [add, setAdd] = useState({ name: '', gender: '', dept: DEPTS[0].name, bus: false, campus: '' })
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [confirmDel, setConfirmDel] = useState(null) // 삭제 확인 대상 {row, name}
  const [repPick, setRepPick] = useState('') // #29 대표자 삭제 시 새 대표자

  const occLabelFor = (n) => (OCCUPANCY.find((o) => o.people === n || (n >= 7 && o.people === 8)) || OCCUPANCY[0]).label
  const post = (p) => fetch(SUBMIT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...p, ...auth }) }).then((r) => r.json())
  const saveGroup = async () => {
    setBusy('group'); setMsg('')
    const roomLabel = ROOMS.find((r) => r.name === roomName).label
    // #21 미정: 투숙비는 추후결정(OCC_PARTIAL)이되 희망 인원은 기록해 다음 조회 때 유지
    const occLabel = occStatus === 'pending'
      ? (OCC_PARTIAL + (occSel === '상관없음' ? ' · 희망 인원무관' : occSel ? ' · 희망 ' + occSel : ''))
      : (OCCUPANCY.find((o) => o.label === occSel) || OCCUPANCY[0]).formLabel
    const j = await post({ action: 'groupSet', gid, roomLabel, occLabel, seorak: seorakAll })
    setBusy(''); setMsg(j.ok ? '✓ 저장되었습니다' : '오류: ' + (j.error || '')); if (j.ok) onRefresh && onRefresh()
  }
  const delMember = async (row, nm, newRep) => {
    if (members.length <= 1) { setMsg('마지막 1명은 삭제할 수 없습니다.'); return }
    setBusy('d' + row); setMsg('')
    const j = await post({ action: 'memberDelete', gid, row, name: nm, ...(newRep ? { newRep } : {}) })
    setBusy('')
    if (j.ok) { if (occStatus === 'confirmed') setOccSel(occLabelFor(Math.max(1, members.length - 1))); onRefresh && onRefresh() } else setMsg('오류: ' + (j.error || ''))
  }
  const addMember = async () => {
    if (!add.name.trim() || !add.gender) { setMsg('추가할 분의 이름·성별을 입력해 주세요.'); return }
    setBusy('add'); setMsg('')
    const deptLabel = DEPTS.find((d) => d.name === add.dept).label
    const j = await post({ action: 'memberAdd', gid, member: { name: add.name.trim(), gender: add.gender, deptLabel, bus: add.bus, campus: add.campus || cur.campus || '' } })
    setBusy('')
    if (j.ok) {
      if (occStatus === 'confirmed') { setOccSel(occLabelFor(members.length + 1)); setMsg('투숙 인원이 ' + occLabelFor(members.length + 1) + '으로 맞춰졌어요. "저장"을 눌러 반영하세요.') } // #20
      setAdd({ name: '', gender: '', dept: DEPTS[0].name, bus: false, campus: '' }); onRefresh && onRefresh()
    } else setMsg('오류: ' + (j.error || ''))
  }

  return (
    <Card title={title || `그룹 편집 (${members.length}명)`}>
      <p className="text-[12px] text-[#5f6b7a] mb-3 leading-relaxed">방(객실)과 투숙 인원을 정하고, 구성원을 추가·삭제할 수 있습니다. 투숙 인원은 방 크기로, 등록 인원과 다르게(부분 그룹) 정할 수 있어요.</p>
      <Field label="객실 종류">
        <select value={roomName} onChange={(e) => setRoomName(e.target.value)} className={inputCls}>
          {ROOMS.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>
        <FloorPlan room={ROOMS.find((r) => r.name === roomName)} />
      </Field>
      <Field label="투숙 인원 (방 크기)">
        <div className="flex gap-2 mb-2">
          {[['confirmed', '확정'], ['pending', '미정']].map(([v, lbl]) => (
            <button key={v} onClick={() => { setOccStatus(v); if (v === 'confirmed' && occSel === '상관없음') setOccSel(occLabelFor(members.length || 8)) }}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold border ${occStatus === v ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#5f6b7a]'}`}>
              {lbl}
            </button>
          ))}
        </div>
        {occStatus === 'confirmed' ? (
          <div className="grid grid-cols-2 gap-2">
            {OCCUPANCY.map((o) => (
              <button key={o.label} onClick={() => setOccSel(o.label)}
                className={`py-3 rounded-xl text-[14px] font-bold border transition-all min-h-[52px] ${occSel === o.label ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#333d4b]'}`}>
                {o.label}<br />
                <span className="text-[12px] font-normal text-[#5f6b7a]">{o.fee > 0 ? `그룹 +${o.fee / 10000}만` : '추가없음'}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {OCCUPANCY.map((o) => (
                <button key={o.label} onClick={() => setOccSel(o.label)}
                  className={`py-3 rounded-xl text-[14px] font-bold border transition-all min-h-[52px] ${occSel === o.label ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#333d4b]'}`}>
                  {o.label}<br />
                  <span className="text-[12px] font-normal text-[#5f6b7a]">추후 결정됨</span>
                </button>
              ))}
              <button onClick={() => setOccSel('상관없음')}
                className={`py-3 rounded-xl text-[14px] font-bold border transition-all min-h-[52px] ${occSel === '상관없음' ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#333d4b]'}`}>
                인원은 상관없습니다<br />
                <span className="text-[12px] font-normal text-[#5f6b7a]">추후 결정됨</span>
              </button>
            </div>
            <p className="text-[12px] text-[#5f6b7a] mt-2 leading-relaxed">원하는 인원을 고르면 참고용으로 기록돼요. 나머지 인원은 교회에서 배정해드리고, 투숙 추가비용은 최종 방배정 후 결정됩니다.</p>
          </>
        )}
      </Field>
      <Field label="설악산뷰 (그룹 전체)">
        <button onClick={() => setSeorakAll((v) => !v)} className={`w-full py-3 rounded-xl text-[14px] font-bold border min-h-[48px] ${seorakAll ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#5f6b7a]'}`}>
          설악산뷰 신청{seorakAll ? ' ✓' : ''} <span className="font-normal text-[12px]">(전원 적용 · 1인 {won(SEORAK_FEE)})</span>
        </button>
      </Field>
      <button onClick={saveGroup} disabled={busy === 'group'} className="w-full py-2.5 rounded-xl bg-[#191f28] hover:bg-black text-white font-bold text-[13px] mb-1">
        {busy === 'group' ? '저장 중…' : '객실/인원/설악산뷰 저장'}
      </button>
      {msg && <p className="text-[12px] text-[#1b64da] font-semibold my-2">{msg}</p>}

      <div className="text-[13px] font-bold text-[#191f28] mt-4 mb-2">구성원 ({members.length}명)</div>
      {members.map((mm) => <EditCard key={mm.row} data={{ ...mm, groupId: gid }} onDelete={members.length > 1 ? () => setConfirmDel({ row: mm.row, name: mm.name }) : null} hideSeorak={true} />)}

      <div className="bg-[#f9fafb] rounded-2xl p-3 border border-dashed border-[#3182f6]/40 mt-2">
        <div className="text-[12px] font-bold text-[#1b64da] mb-2">+ 구성원 추가 (미제출자 등)</div>
        <input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} placeholder="이름" className={inputCls + ' mb-2'} />
        <div className="flex gap-2 mb-2">
          {['남', '여'].map((g) => (
            <button key={g} onClick={() => setAdd({ ...add, gender: g })} className={`flex-1 py-2 rounded-xl text-[12px] font-bold border ${add.gender === g ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#5f6b7a]'}`}>{g}</button>
          ))}
        </div>
        <DeptSelect value={add.dept} onChange={(v) => setAdd({ ...add, dept: v })} />
        <div className="flex gap-2 mt-2">
          {CAMPUSES.map((c) => {
            const active = (add.campus || cur.campus) === c
            return (
              <button key={c} onClick={() => setAdd({ ...add, campus: c })} className={`flex-1 py-2 rounded-xl text-[12px] font-bold border ${active ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#5f6b7a]'}`}>{c.replace(' 캠퍼스', '')}</button>
            )
          })}
        </div>
        <button onClick={() => setAdd({ ...add, bus: !add.bus })} className={`w-full mt-2 py-2 rounded-xl text-[12px] font-bold border ${add.bus ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#5f6b7a]'}`}>버스 신청 {add.bus ? '✓' : ''}</button>
        <button onClick={addMember} disabled={busy === 'add'} className="w-full mt-2 py-2.5 rounded-xl bg-[#fff5f5] text-[#f04452] border-2 border-dashed border-[#f04452]/40 hover:bg-[#ffecec] font-bold text-[13px]">{busy === 'add' ? '추가 중…' : '+ 구성원 추가'}</button>
      </div>

      {confirmDel && (() => {
        const isRepDel = confirmDel.name === (cur.rep || '') // #29 대표자를 삭제하는가
        const remaining = members.filter((m) => m.name !== confirmDel.name)
        const blocked = isRepDel && !repPick
        const close = () => { setConfirmDel(null); setRepPick('') }
        return (
          <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={close}>
            <div className="bg-white w-full max-w-[400px] rounded-2xl p-5 animate-slide-up sm:animate-none" onClick={(e) => e.stopPropagation()}>
              <div className="text-[15px] font-bold text-[#191f28] mb-2">구성원 삭제</div>
              <p className="text-[13px] text-[#4e5968] leading-relaxed mb-4"><b className="text-[#191f28]">{confirmDel.name}</b>님의 등록 신청을 취소하고, 그룹에서 삭제합니다.</p>
              {isRepDel && (
                <div className="mb-4 p-3 rounded-xl bg-[#fff4f4] border border-[#ffd9dc]">
                  <p className="text-[13px] font-bold text-[#f04452] mb-2">⚠️ 대표자({confirmDel.name})를 삭제합니다.<br />남은 구성원 중 새 대표자를 선택해 주세요.</p>
                  <select value={repPick} onChange={(e) => setRepPick(e.target.value)} className={inputCls}>
                    <option value="">새 대표자 선택…</option>
                    {remaining.map((m) => <option key={m.row} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={close} className="flex-1 py-3 rounded-xl bg-[#f2f4f6] text-[#4e5968] font-bold text-[14px]">취소</button>
                <button onClick={() => { const d = confirmDel; const nr = isRepDel ? repPick : undefined; close(); delMember(d.row, d.name, nr) }} disabled={busy.indexOf('d') === 0 || blocked} className={`flex-1 py-3 rounded-xl text-white font-bold text-[14px] ${blocked ? 'bg-[#f0445280]' : 'bg-[#f04452]'}`}>확인</button>
              </div>
            </div>
          </div>
        )
      })()}
    </Card>
  )
}

// 조회 결과의 입금 안내 (대표자 일괄 / 등록비 각자 토글 + 계좌 + 복사)
function LookupDeposit({ results }) {
  const [copied, setCopied] = useState(false)
  const [mode, setMode] = useState('leader') // leader=대표자 일괄, each=등록비 각자
  const deptFeeOfLabel = (label) => DEPTS.find((d) => d.label === label)?.fee || 0
  const isGroup = results.some((r) => /인이 투숙/.test(r.occLabel || '') || r.appType === '그룹')
  const multi = results.length > 1
  const rep = results.find((r) => (r.common || 0) > 0 || (r.groupTotal || 0) > 0) || results[0]
  const repName = rep.rep || rep.name
  const common = rep.common || 0
  const rg = isGroup ? roomGroupFee(rep.roomLabel) : 0
  const occFee = isGroup ? Math.max(0, common - rg) : 0

  const lines = []
  if (mode === 'leader' && multi) {
    const regSum = results.reduce((s, r) => s + deptFeeOfLabel(r.deptLabel) + (isGroup ? 0 : roomIndivFee(r.roomLabel)), 0)
    lines.push({ cat: '등록비', payer: repName, amt: regSum })
    if (rg > 0) lines.push({ cat: '객실선택', payer: repName, amt: rg })
    if (occFee > 0) lines.push({ cat: '그룹', payer: repName, amt: occFee })
    const busSum = results.filter((r) => r.bus).length * BUS_FEE; if (busSum) lines.push({ cat: '버스비', payer: repName, amt: busSum })
    const seoSum = results.filter((r) => r.seorak).length * SEORAK_FEE; if (seoSum) lines.push({ cat: '설악산', payer: repName, amt: seoSum })
  } else {
    results.forEach((r) => {
      lines.push({ cat: '등록비', payer: r.name, amt: deptFeeOfLabel(r.deptLabel) })
      if (!isGroup) { const ri = roomIndivFee(r.roomLabel); if (ri > 0) lines.push({ cat: '객실선택', payer: r.name, amt: ri }) }
    })
    if (rg > 0) lines.push({ cat: '객실선택', payer: repName, amt: rg })
    if (occFee > 0) lines.push({ cat: '그룹', payer: repName, amt: occFee })
    results.forEach((r) => { if (r.bus) lines.push({ cat: '버스비', payer: r.name, amt: BUS_FEE }) })
    results.forEach((r) => { if (r.seorak) lines.push({ cat: '설악산', payer: r.name, amt: SEORAK_FEE }) })
  }
  const total = lines.reduce((s, l) => s + l.amt, 0)

  const text = `[2026 전교인 리트릿 등록 입금 안내]\n입금 계좌: ${ACCOUNT}\n방식: ${mode === 'leader' && multi ? '대표자 일괄' : '항목별/각자'}\n\n▸ 입금자명   금액\n` +
    lines.map((l) => `▸ ${l.cat}  ${l.payer}   ${won(l.amt)}`).join('\n') +
    `\n─────────────────\n총 합계: ${won(total)}\n\n* 원활한 등록 관리를 위하여, 위 항목별로 구분하여 따로 입금해 주시기를 부탁드립니다.`
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { alert('복사 실패 — 길게 눌러 복사해 주세요.') } }

  return (
    <Card title="입금 안내">
      {multi && (
        <div className="space-y-2 mb-4">
          <button
            onClick={() => setMode('leader')}
            className={`w-full px-4 py-4 rounded-2xl text-left transition-all min-h-[64px] border ${mode === 'leader' ? 'border-2 border-[#3182f6] bg-[#f2f8ff]' : 'border border-[#e5e8eb] bg-white'}`}
          >
            <div className={`text-[15px] font-bold ${mode === 'leader' ? 'text-[#1b64da]' : 'text-[#333d4b]'}`}>대표자({repName})가 한꺼번에 입금</div>
            <div className="text-[13px] text-[#5f6b7a] mt-0.5">모든 항목을 대표자 이름으로</div>
          </button>
          <button
            onClick={() => setMode('each')}
            className={`w-full px-4 py-4 rounded-2xl text-left transition-all min-h-[64px] border ${mode === 'each' ? 'border-2 border-[#3182f6] bg-[#f2f8ff]' : 'border border-[#e5e8eb] bg-white'}`}
          >
            <div className={`text-[15px] font-bold ${mode === 'each' ? 'text-[#1b64da]' : 'text-[#333d4b]'}`}>각자 등록비를 본인 이름으로 입금</div>
            <div className="text-[13px] text-[#5f6b7a] mt-0.5">공동비용(방·그룹비)은 대표자 이름</div>
          </button>
        </div>
      )}
      <p className="text-[13px] text-[#5f6b7a] mb-3 leading-relaxed">
        아래 항목별로 <b>각각 따로</b> 입금해 주세요.
      </p>
      <div className="space-y-2 mb-4">
        {lines.map((l, i) => (
          <div key={i} className="flex items-center justify-between py-2.5 border-b border-[#f7f8fa] last:border-0">
            <span className="inline-block bg-[#f2f8ff] text-[#1b64da] text-[13px] font-bold px-2.5 py-1 rounded-lg">{l.cat} {l.payer}</span>
            <span className="text-[15px] font-bold text-[#191f28]">{won(l.amt)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2">
          <span className="text-[14px] font-bold text-[#4e5968]">총 합계</span>
          <span className="text-[20px] font-extrabold text-[#191f28]">{won(total)}</span>
        </div>
      </div>
      <div className="bg-[#f9fafb] rounded-xl p-4 mb-3">
        <div className="text-[13px] text-[#5f6b7a] font-semibold mb-1">입금 계좌</div>
        <div className="text-[15px] font-bold text-[#191f28]">{ACCOUNT}</div>
      </div>
      <button
        onClick={copy}
        className="w-full py-4 rounded-2xl bg-[#3182f6] hover:bg-[#1b64da] text-white font-bold text-[15px] min-h-[52px]"
      >
        {copied ? '✓ 복사 완료' : '입금 안내 문구 복사하기'}
      </button>
    </Card>
  )
}

function LookupMode() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | loaded | error
  const [results, setResults] = useState([])
  const [grouped, setGrouped] = useState(false)
  const [err, setErr] = useState('')

  const lookup = async () => {
    setStatus('loading'); setErr('')
    try {
      const res = await fetch(SUBMIT_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'lookup', name: name.trim(), email: email.trim() }),
      })
      const j = await res.json()
      if (j.ok) { setResults(j.results || []); setGrouped(!!j.grouped); setStatus('loaded') }
      else { setErr(j.error || '조회 실패'); setStatus('error') }
    } catch (e) { setErr(String(e)); setStatus('error') }
  }

  return (
    <>
      <Card title="내 신청 조회·수정">
        <p className="text-[14px] text-[#4e5968] mb-4 leading-relaxed">
          신청하실 때 적으신 <b className="text-[#191f28]">이름</b>과 <b className="text-[#191f28]">이메일</b>로 확인하실 수 있어요.<br />
          가족·그룹은 <b className="text-[#1b64da]">대표자 이름</b>이나 <b className="text-[#1b64da]">구성원 이름</b> 무엇으로든 모두 조회됩니다.
        </p>
        <Field label="이름">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="신청서에 적은 이름 (예: 김바울)" className={inputCls} />
        </Field>
        <Field label="이메일">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="신청서에 적은 이메일" inputMode="email" className={inputCls} />
        </Field>
        <p className="text-[12px] text-[#5f6b7a] mb-3 -mt-1">* 가족·그룹은 대표자가 신청 시 적은 이메일로 함께 조회돼요.</p>
        <button
          onClick={lookup}
          disabled={!name.trim() || !email.trim() || status === 'loading'}
          className={`w-full py-4 rounded-2xl font-bold text-[16px] min-h-[52px] ${name.trim() && email.trim() && status !== 'loading' ? 'bg-[#191f28] text-white hover:bg-black' : 'bg-[#e5e8eb] text-[#b0b8c1]'}`}
        >
          {status === 'loading' ? '조회 중…' : '조회하기'}
        </button>
        {status === 'error' && <p className="text-[13px] text-[#f04452] mt-3">{err}</p>}
      </Card>

      {status === 'loaded' && (
        results.length === 0 ? (
          <Card title="조회 결과가 없어요">
            <p className="text-[14px] text-[#4e5968] leading-relaxed">
              <b className="text-[#191f28]">{name.trim() || '입력하신 이름'}</b>님의 신청을 찾지 못했어요. 😢<br />
              이름·이메일에 오타가 없는지 확인해 주세요. 가족·그룹이면 <b>구성원 이름</b>으로도 조회할 수 있어요.<br />
              그래도 안 되면 안내데스크로 편하게 문의해 주세요.
            </p>
          </Card>
        ) : (results.length > 1 || /인이 투숙/.test(results[0].occLabel || '') || results[0].appType === '그룹') ? (
          <GroupEditor members={results} auth={{ verifyEmail: email.trim() }} onRefresh={lookup} title={`${(results.find((r) => r.isSelf) || results[0]).rep || name.trim()}님 그룹`} />
        ) : (
          <Card title={`조회 결과 (${results.length}건)`}>
            {results.map((r) => <EditCard key={r.row} data={r} />)}
          </Card>
        )
      )}

      {status === 'loaded' && results.length > 0 && <LookupDeposit results={results} />}
    </>
  )
}

// 헤더 "등록 안내 전체보기" 버튼
// 비용 안내 예시 (Claude Design '비용 안내.dc.html' 이식) — 탭형 예시 + 모달
const COST_DEPTS = [
  ['장년부·청년부', '27.8'], ['중고등부', '26.8'], ['소년부', '25.8'], ['초등부', '24.8'],
  ['유년부', '22.8'], ['유치부', '20.8'], ['영유아부', '19.8'], ['영아부(돌 전)', '17.8'],
]
const COST_EXAMPLES = [
  {
    tab: '청년부', tab2: '혼자', badgeText: '예시 1 · 청년부 혼자 등록 (개인)', badgeBg: '#eff6ff', badgeColor: '#1d4ed8',
    situation: '“혼자 등록해요. 방 멤버는 따로 정하지 않았고, 소노벨 스위트에 설악산 뷰·버스도 신청합니다.”',
    lines: [
      { label: '기본 등록비 (청년부)', calc: '27.8 × 1명', amount: '27.8' },
      { label: '버스', calc: '3.8 × 1명', amount: '3.8' },
      { label: '설악산 뷰', calc: '1 × 1명', amount: '1' },
      { label: '객실 선택비 (소노벨 스위트)', calc: '1 × 1명', amount: '1' },
    ],
    total: '33.6만원', payNote: '본인 이름으로 항목별(등록비·버스비·설악산·객실선택)로 나누어 입금해 주세요.',
  },
  {
    tab: '4인', tab2: '가족', badgeText: '예시 2 · 4인 가족 등록', badgeBg: '#ecfdf5', badgeColor: '#047857',
    situation: '“4식구(아빠·엄마·아들·딸)가 소노벨 스위트 한 방. 버스·설악산 뷰도 전원 신청합니다.”',
    lines: [
      { label: '기본 등록비 (4명)', calc: '27.8+27.8+26.8+22.8', amount: '105.2' },
      { label: '버스', calc: '3.8 × 4명', amount: '15.2' },
      { label: '설악산 뷰', calc: '1 × 4명', amount: '4' },
      { label: '객실 선택비 (소노벨 스위트)', calc: '1 × 4명', amount: '4' },
    ],
    total: '128.6만원', payNote: '가족 비용을 모아 대표자(예: 아빠 김바울) 한 분 이름으로, 항목별로 묶어 입금해 주세요.',
  },
  {
    tab: '셀·성도', tab2: '그룹', badgeText: '예시 3 · 셀·성도 모아 등록 (그룹)', badgeBg: '#eef2ff', badgeColor: '#4338ca',
    situation: '“장년부 셀 5명이 소노캄 스위트 한 방을 같이 써요. 버스도 함께, 설악산 뷰는 없어도 됩니다.”',
    lines: [
      { label: '기본 등록비 (5명)', calc: '27.8 × 5명', amount: '139.0' },
      { label: '버스', calc: '3.8 × 5명', amount: '19.0' },
      { label: '객실 선택비 (소노캄 스위트 · 그룹)', calc: '그룹당 1개', amount: '24' },
      { label: '투숙 인원별 (5인 한 방)', calc: '그룹당 1개', amount: '10' },
    ],
    total: '192.0만원', payNote: '등록비·버스비는 1인당 비용을 모아 대표자 이름으로 항목별로 입금해 주세요. 객실 선택비·투숙 인원별 비용은 방 하나당(그룹당) 비용이라 대표자 이름으로 한 번씩 입금해 주시면 됩니다.',
  },
  {
    tab: '부분', tab2: '등록', badgeText: '예시 4 · 부분 등록', badgeBg: '#fef2f2', badgeColor: '#b91c1c',
    situation: '“아들과 둘이 같은 방을 쓰고 싶어요. 소노벨 스위트, 설악산 뷰는 필요 없고 버스는 같이 타요.”',
    lines: [
      { label: '기본 등록비 (2명)', calc: '27.8 + 26.8', amount: '54.6' },
      { label: '버스', calc: '3.8 × 2명', amount: '7.6' },
      { label: '객실 선택비 (소노벨 스위트)', calc: '1 × 2명', amount: '2' },
    ],
    total: '64.2만원', payNote: '방만 함께 쓰고 비용은 각자 부담입니다. 대표자 이름으로 항목별로 묶어 입금해 주시면 됩니다.',
  },
]
function CostExamples() {
  const [tab, setTab] = useState(0)
  const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20, marginBottom: 14 }
  const secLabel = { fontSize: 13, fontWeight: 700, color: '#1d4ed8', letterSpacing: '0.02em', marginBottom: 14 }
  const chip = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb', borderRadius: 10, padding: '12px 14px' }
  const ex = COST_EXAMPLES[tab]
  const payRows = [
    ['입금자명', '반드시 신청자(또는 그룹 대표자) 본인 이름으로 입금해 주세요.', true],
    ['항목별로', '등록비 · 버스비 · 설악산 · 객실선택을 나누어 입금해 주세요. (그룹은 + 그룹비용)', true],
    ['개인', '본인 이름으로 항목별 입금.', false],
    ['가족', '대표자 한 분이 가족 비용을 모아 항목별 입금.', false],
    ['그룹', '등록비·버스비는 1인당 모아 대표자 이름으로, 객실·그룹비용은 그룹당 대표자 이름으로 입금.', false],
  ]
  return (
    <div id="cost-guide-print" style={{ fontFamily: "'Pretendard',-apple-system,sans-serif" }}>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, lineHeight: 1.3, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>등록비는 이렇게 구성됩니다</h2>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: '#4b5563' }}>기본 등록비에 원하시는 선택을 더하는 방식입니다. 아래에서 <strong style={{ color: '#1d4ed8' }}>상황과 비슷한 예시</strong>를 보시면 한눈에 이해하실 수 있습니다. <span style={{ color: '#6b7280' }}>(단위: 만원)</span></p>
      </div>
      <div style={card}>
        <div style={secLabel}>1 · 기본 등록비 <span style={{ color: '#9ca3af', fontWeight: 500 }}>(부서별 · 1인당)</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
          {COST_DEPTS.map(([n, v]) => (
            <div key={n} style={{ ...chip, alignItems: 'baseline' }}><span style={{ fontSize: 14, color: '#374151' }}>{n}</span><span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{v}</span></div>
          ))}
        </div>
      </div>
      <div style={card}>
        <div style={secLabel}>2 · 원하면 더하는 선택 <span style={{ color: '#9ca3af', fontWeight: 500 }}>(1인당)</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={chip}><span style={{ fontSize: 14, color: '#374151' }}>🚌 버스 <span style={{ color: '#9ca3af', fontSize: 13 }}>(자차는 0)</span></span><span style={{ fontSize: 15, fontWeight: 700, color: '#1d4ed8' }}>+3.8</span></div>
          <div style={chip}><span style={{ fontSize: 14, color: '#374151' }}>🏔 설악산 뷰</span><span style={{ fontSize: 15, fontWeight: 700, color: '#1d4ed8' }}>+1</span></div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', margin: '16px 0 10px' }}>객실 선택비 <span style={{ color: '#9ca3af', fontWeight: 500 }}>(개인 신청 시 1인당)</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={chip}><span style={{ fontSize: 14, color: '#374151' }}>소노벨 패밀리 <span style={{ color: '#9ca3af', fontSize: 13 }}>(기본)</span></span><span style={{ fontSize: 15, fontWeight: 700, color: '#6b7280' }}>+0</span></div>
          <div style={chip}><span style={{ fontSize: 14, color: '#374151' }}>소노벨 스위트</span><span style={{ fontSize: 15, fontWeight: 700, color: '#1d4ed8' }}>+1</span></div>
          <div style={chip}><span style={{ fontSize: 14, color: '#374151' }}>소노캄 스위트</span><span style={{ fontSize: 15, fontWeight: 700, color: '#1d4ed8' }}>+4</span></div>
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 9, alignItems: 'flex-start', background: '#eff6ff', borderRadius: 10, padding: '11px 13px' }}>
          <span style={{ flex: 'none', fontSize: 14 }}>💡</span>
          <span style={{ fontSize: 13, lineHeight: 1.55, color: '#1e40af' }}>셀·성도분들이 <strong>한 방을 통째로</strong> 쓰는 그룹 신청은 계산 방식이 달라집니다. 아래 <strong>3번</strong>을 참고해 주세요.</span>
        </div>
      </div>
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#4338ca', letterSpacing: '0.02em', marginBottom: 6 }}>3 · 그룹(방 전체)으로 신청하시면 <span style={{ color: '#9ca3af', fontWeight: 500 }}>(그룹당)</span></div>
        <p style={{ margin: '0 0 16px', fontSize: 13.5, lineHeight: 1.6, color: '#6b7280' }}>셀·성도가 한 방을 통째로 쓰실 때는 아래 두 비용이 <strong>방 하나당(그룹당)</strong>으로 붙습니다. 개인(1인당) 객실비는 적용되지 않습니다.</p>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#6b7280', marginBottom: 9 }}>Ⓐ 투숙 인원별 추가 비용 <span style={{ color: '#9ca3af', fontWeight: 500 }}>(적게 쓸수록 큽니다)</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 18 }}>
          {[['7~8인 · 비선택', '0', '#6b7280'], ['6인', '5', '#111827'], ['5인', '10', '#111827'], ['4인', '20', '#111827'], ['3인', '30', '#111827'], ['2인', '40', '#111827'], ['1인', '50', '#111827']].map(([n, v, c]) => (
            <div key={n} style={{ ...chip, alignItems: 'baseline', padding: '10px 13px' }}><span style={{ fontSize: 14, color: '#374151' }}>{n}</span><span style={{ fontSize: 15, fontWeight: 700, color: c }}>{v}</span></div>
          ))}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#6b7280', marginBottom: 9 }}>Ⓑ 객실 선택비 <span style={{ color: '#9ca3af', fontWeight: 500 }}>(그룹당)</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={chip}><span style={{ fontSize: 14, color: '#374151' }}>소노벨 패밀리 <span style={{ color: '#9ca3af', fontSize: 13 }}>(기본)</span></span><span style={{ fontSize: 15, fontWeight: 700, color: '#6b7280' }}>0</span></div>
          <div style={chip}><span style={{ fontSize: 14, color: '#374151' }}>소노벨 스위트</span><span style={{ fontSize: 15, fontWeight: 700, color: '#4338ca' }}>6</span></div>
          <div style={chip}><span style={{ fontSize: 14, color: '#374151' }}>소노캄 스위트</span><span style={{ fontSize: 15, fontWeight: 700, color: '#4338ca' }}>24</span></div>
        </div>
      </div>
      <div style={{ margin: '26px 0 14px' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', letterSpacing: '-0.01em' }}>상황과 비슷한 예시를 골라 보세요</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7, marginBottom: 14 }}>
        {COST_EXAMPLES.map((e, i) => {
          const active = tab === i
          return (
            <button key={i} onClick={() => setTab(i)} style={{
              border: active ? 'none' : '1px solid #e5e7eb', borderRadius: 11, padding: '11px 4px',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700, lineHeight: 1.3, cursor: 'pointer', transition: 'all .15s',
              background: active ? '#1d4ed8' : '#fff', color: active ? '#fff' : '#4b5563',
              boxShadow: active ? '0 4px 12px rgba(29,78,216,0.28)' : '0 1px 2px rgba(0,0,0,0.05)',
            }}>{e.tab}<br />{e.tab2}</button>
          )
        })}
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 22, marginBottom: 14 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: ex.badgeBg, color: ex.badgeColor, borderRadius: 999, padding: '5px 12px', fontSize: 12.5, fontWeight: 700, marginBottom: 14 }}>{ex.badgeText}</div>
        <p style={{ margin: '0 0 18px', fontSize: 15, lineHeight: 1.6, color: '#374151' }}>{ex.situation}</p>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#6b7280', letterSpacing: '0.02em', marginBottom: 10 }}>비용 구성</div>
        <div style={{ border: '1px solid #eef0f3', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          {ex.lines.map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ minWidth: 0 }}><div style={{ fontSize: 14, color: '#111827', fontWeight: 600 }}>{row.label}</div><div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 2 }}>{row.calc}</div></div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>{row.amount}</div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, background: '#eff6ff' }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#1e3a8a' }}>총 등록 금액</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#1d4ed8' }}>{ex.total}</span>
          </div>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#6b7280', letterSpacing: '0.02em', marginBottom: 10 }}>입금은 이렇게</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '13px 15px' }}>
          <span style={{ flex: 'none', fontSize: 16 }}>💳</span>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: '#92400e' }}>{ex.payNote}</p>
        </div>
      </div>
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#b45309', letterSpacing: '0.02em', marginBottom: 14 }}>입금은 이렇게 해주세요</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {payRows.map(([k, v, warn]) => (
            <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: warn ? '#fffbeb' : '#f9fafb', borderRadius: 10, padding: '12px 14px' }}>
              <span style={{ flex: 'none', width: 76, fontSize: 13.5, fontWeight: 700, color: warn ? '#b45309' : '#374151' }}>{k}</span>
              <span style={{ fontSize: 13.5, lineHeight: 1.5, color: warn ? '#92400e' : '#4b5563' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={card} className="no-print">
        <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', letterSpacing: '-0.01em', marginBottom: 4 }}>원본 비용표 한 장으로 보기</div>
        <p style={{ margin: '0 0 14px', fontSize: 13.5, lineHeight: 1.6, color: '#6b7280' }}>표로 한눈에 보거나 단톡방에 공유하고 싶으실 때. 아래에서 <strong>원본 비용표(PDF)</strong>를 저장하실 수 있습니다.</p>
        <a href="cost-example.pdf" download="2026 전교인 리트릿 - 비용 예시.pdf" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', background: '#1d4ed8', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 700, padding: 14, borderRadius: 11 }}>⬇ 원본 비용표 PDF 저장하기</a>
        <a href="cost-example.pdf" target="_blank" rel="noopener" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', marginTop: 8, background: '#fff', color: '#1d4ed8', textDecoration: 'none', fontSize: 14, fontWeight: 700, padding: 13, borderRadius: 11, border: '1.5px solid #c7d2fe' }}>📄 새 탭에서 열어보기</a>
      </div>
      <p style={{ margin: '16px 4px 0', fontSize: 12.5, lineHeight: 1.6, color: '#9ca3af' }}>※ 그룹(방 전체) 객실 선택비는 투숙 인원·객실 종류에 따라 달라집니다.</p>
    </div>
  )
}
function CostGuideButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} className="mt-2 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#eff6ff] text-[#1d4ed8] font-bold text-[12px] hover:bg-[#e3eeff] transition-colors">
        🧮 비용 예시 보기
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40 animate-backdrop" />
          <div className="relative w-full max-w-[480px] bg-[#f3f4f6] rounded-t-[26px] max-h-[88vh] overflow-y-auto p-5 pb-8 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <div className="w-6" />
              <div className="w-10 h-1 bg-[#d1d5db] rounded-full" />
              <button onClick={() => setOpen(false)} className="text-[#9ca3af] text-[20px] leading-none w-6 text-right">✕</button>
            </div>
            <CostExamples />
            <button onClick={() => setOpen(false)} className="w-full mt-4 py-3 rounded-2xl bg-white border border-[#e5e7eb] text-[#4b5563] font-bold text-[14px]">닫기</button>
          </div>
        </div>
      )}
    </>
  )
}
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

// 자유텍스트(명단/문의)에서 '사람 이름' 토큰만 추출 — 문장/조사/객실용어/동사어미 제외
const NAME_STOP = /투숙|신청|상관|배정|교회|추가|비용|없|캠퍼스|함께|함깨|성도|다른|또는|혹은|그룹|가족|부분|명방|방으로|방을|방도|방은|방만|님이|형제|자매|가능|모두|각각|각가|먼저|보냅|원합|소노|패밀|스위|원룸|온돌|침대|침실|좋겠|좋을|주시|부탁|드림|드려|되겠|혼자|요청|선택|이용|출퇴근|식사|객실|추천|배치|희망|인원|인실|대표|정도|혹시|설악|뷰는|이렇게|그렇게|저렇게|어떻게|그래서|그러면|그리고|하지만|그런데|그냥|다시|같이|여러|아주|조금|많이|서로|이번|모여|모이|채워|제가|저는|저희|우리|확인|참여|참석|예정|관련|문의|답변|수정|변경|취소|괜찮|그게|명은|명이|명만|명과|명도|명들|여명|몇명|채워|모이|모여/
const NAME_END = /(구요|구여|네요|어요|아요|에요|예요|세요|지면|으면|해서|하고|이고|되고|라서|래서|면서|는데|니다|니까|을까|겠어|겠습|드려|드림|어서|아서|시면|시는|시고|군요|거든|잖아|는걸|에서|에게|한테|부터|까지|마다|조차|구나|드릴|합니|입니|텐데|는지|을지|어용|아용)$/
const nameTokens = (t) => (t || '').split(/[^가-힣A-Za-z]+/).filter((x) => /^[가-힣]{2,4}$/.test(x) && !NAME_STOP.test(x) && !NAME_END.test(x))
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
      className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[12px] font-bold border-2 cursor-grab active:cursor-grabbing touch-none select-none ${isDragging ? 'opacity-70 border-[#3182f6] shadow-lg' : warn ? 'border-[#f59e0b] bg-[#fffbeb]' : p.gender === '남' ? 'border-[#9ec5ff] bg-[#eff6ff] text-[#1b64da]' : p.gender === '여' ? 'border-[#ffc2d1] bg-[#fff1f5] text-[#e0407a]' : 'border-[#e5e8eb] bg-white'}`}>
      <span className="text-[#b0b8c1] text-[11px] leading-none" aria-hidden>⠿</span>
      {warn && <span title="신청한 객실 옵션과 다른 방">⚠️</span>}
      {p.name}
      {p.route === '미제출' && <span className="text-[9px] font-bold text-white bg-[#f04452] rounded px-1">미제출</span>}
      <span className="text-[10px] text-[#5f6b7a] font-normal">{(p.campus || '').replace(' 캠퍼스', '').slice(0, 2)}·{p.gender}·{deptName(p.deptLabel)}</span>
      <span className="text-[10px] text-[#1b64da] font-normal">{roomTypeShort(reqRoomType(p.roomLabel))}</span>
      {p.list && <span title={p.list}>📝</span>}
    </div>
  )
}

// 읽기 전용 사람 칩
function ReadChip({ p }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[12px] font-bold border border-[#e5e8eb] bg-[#f9fafb] text-[#4e5968]">
      {p.name}<span className="text-[10px] text-[#5f6b7a] font-normal">{p.gender}·{deptName(p.deptLabel)}</span>
    </span>
  )
}

// 드롭 가능한 방 박스
function RoomDrop({ id, title, sub, count, cap, danger, children, onDelete }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`rounded-2xl border p-3 mb-2 transition-colors ${isOver ? 'border-2 border-[#3182f6] bg-[#eaf3ff]' : danger ? 'border-[#f04452] bg-[#fff5f5]' : 'border-[#e5e8eb] bg-white'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-bold text-[#191f28]">{title}{sub && <span className="text-[11px] text-[#5f6b7a] font-normal ml-1">{sub}</span>}</span>
        <span className="flex items-center gap-2">
          {cap != null && <span className={`text-[12px] font-bold ${danger ? 'text-[#f04452]' : 'text-[#5f6b7a]'}`}>{count}/{cap}명</span>}
          {onDelete && <button onClick={onDelete} title="방 삭제 (인원은 미배정으로)" className="text-[#b0b8c1] hover:text-[#f04452] text-[13px] leading-none">✕</button>}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-[34px]">{children}</div>
    </div>
  )
}

// 탭별 도움말 토글 (ⓘ 누르면 상세 설명)
function HelpToggle({ children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-3">
      <button onClick={() => setOpen(!open)} className="text-[12px] font-bold text-[#1b64da] bg-[#eef5ff] rounded-lg px-2.5 py-1.5">ⓘ 이 탭 사용법 {open ? '▲' : '▼'}</button>
      {open && <div className="mt-2 bg-[#f9fafb] border border-[#eef0f2] rounded-xl p-3 text-[12px] text-[#4e5968] leading-relaxed whitespace-pre-wrap">{children}</div>}
    </div>
  )
}

// #3 상태색 4단계 통일: 초록=완료/전원, 노랑=진행/부분, 빨강=문제/중복, 회색=대기/정보
const TONE = {
  done: 'bg-[#e7f5ec] text-[#1d7a4d] border border-[#bfe6cd]',
  prog: 'bg-[#fef3e2] text-[#b45309] border border-[#f6dcb0]',
  prob: 'bg-[#fde7ea] text-[#dc2626] border border-[#f6c9d0]',
  wait: 'bg-[#eef0f3] text-[#5f6b7a] border border-[#e0e3e8]',
}
function Badge({ tone = 'wait', children }) {
  return <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${TONE[tone]}`}>{children}</span>
}
function StatusLegend() {
  const items = [['done', '완료·전원'], ['prog', '진행·부분'], ['prob', '문제·중복'], ['wait', '대기·정보']]
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-3 bg-white rounded-xl border border-[#f2f4f6] px-3 py-2">
      <span className="text-[11px] font-bold text-[#83868c] mr-0.5">상태색</span>
      {items.map(([t, l]) => <Badge key={t} tone={t}>{l}</Badge>)}
    </div>
  )
}
// 이름 검색 + 결과수 (#1 공통). list=객체배열, keys=검색대상 필드들
function FilterBar({ q, setQ, total, shown, placeholder }) {
  return (
    <div className="mb-3 sticky top-[52px] z-10">
      <div className="relative">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder || '이름 검색'}
          className="w-full bg-white border border-[#e5e8eb] rounded-xl pl-9 pr-20 py-2.5 text-[14px] focus:ring-2 focus:ring-[#3182f6] focus:outline-none" />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa0a8] text-[14px]">🔍</span>
        {q ? <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#5f6b7a] bg-[#f2f4f6] rounded-lg px-2 py-1">{shown}/{total} ✕</button>
          : <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#9aa0a8]">{total}명</span>}
      </div>
    </div>
  )
}

function Collapsible({ title, count, defaultOpen, children }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="bg-white rounded-2xl border border-[#f2f4f6] mb-3 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3">
        <span className="text-[13px] font-bold text-[#191f28]">{title}{count != null && <span className="text-[#5f6b7a] font-normal"> · {count}</span>}</span>
        <span className={`text-[#5f6b7a] text-[12px] transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// 운영자(=Claude) 전수 분석 정리안 — 2026-06-21 신청 데이터 기준. (새 신청은 미반영 스냅샷 / AI 갱신·새 데이터 주면 갱신)
const CURATED_SORT = {
  at: '6/21 분석',
  groups: [
    { rep: '송재혁', room: '패밀리·5', campus: '분당', members: ['송재혁', '조안나', '송주하', '송은하', '송선주'], missing: [], status: '전원' },
    { rep: '조형만', room: '소노캄·4', flags: '설악', campus: '부산', members: ['조형만', '조영렬', '김미정', '조윤정'], missing: [], status: '전원' },
    { rep: '김영표', room: '소노캄·6', campus: '부산', members: ['김영표', '선현미', '김건우', '김지후', '김찬우', '김현우'], missing: [], status: '전원' },
    { rep: '김민구', room: '소노벨스위트·6', campus: '분당', members: ['김민구', '이유란', '김예소', '김요한', '김다니엘', '김요엘'], missing: [], status: '전원' },
    { rep: '문경모', room: '패밀리·4', campus: '분당', members: ['문경모', '윤수정', '문지호', '문태준'], missing: [], status: '전원' },
    { rep: '홍규화', room: '패밀리·4', campus: '분당', members: ['홍규화', '홍라희', '홍요셉', '홍민정'], missing: [], status: '전원' },
    { rep: '방호근', room: '패밀리·4', campus: '분당', members: ['방호근', '김혜진', '방세아', '방상연'], missing: [], status: '전원' },
    { rep: '김경민A', room: '소노벨스위트·3', campus: '분당', members: ['김경민A', '임채순', '김준'], missing: [], status: '전원' },
    { rep: '여용구', room: '패밀리·3', campus: '분당', members: ['여용구', '심은희', '여하임'], missing: [], status: '전원' },
    { rep: '최미수', room: '소노벨스위트·4', campus: '분당', members: ['최미수', '권한준', '권예서', '권시원'], missing: [], status: '전원' },
    { rep: '백요한', room: '패밀리·4', campus: '분당', members: ['백요한', '김귀리', '백지민', '백아윤'], missing: [], status: '전원' },
    { rep: '임창은', room: '소노벨스위트·5', campus: '분당', members: ['임창은', '이시우', '이리사', '이주회', '이한나B'], missing: [], status: '전원' },
    { rep: '김상아', room: '패밀리·6', campus: '분당', members: ['김상아', '이종만', '이사랑B', '이다니엘', '이새롬', '이솔로몬'], missing: [], status: '전원' },
    { rep: '임성현', room: '소노캄·4', flags: '설악', campus: '분당', members: ['임성현', '윤예영', '최데이빗', '이지윤'], missing: [], status: '전원' },
    { rep: '이부희', room: '소노벨스위트·6', flags: '버스', campus: '분당', members: ['이부희', '박금영', '강수자', '최은정', '임정은', '이은영'], missing: [], status: '전원' },
    { rep: '심우영', room: '소노벨스위트·5', campus: '분당', members: ['심우영', '최은지', '심온유', '심예준', '심예은'], missing: [], status: '전원' },
    { rep: '임재윤', room: '소노벨스위트·4', campus: '분당', members: ['임재윤', '조은하', '임라엘', '조은샘'], missing: [], status: '전원' },
    { rep: '김효진', room: '패밀리·3', campus: '분당', members: ['김효진', '최병준', '최시안'], missing: [], status: '전원' },
    { rep: '강봉환', room: '소노벨스위트·4', campus: '분당', members: ['강봉환', '김주연', '강다윗', '강모세'], missing: [], status: '전원' },
    { rep: '박노진', room: '소노벨스위트·5', campus: '분당', members: ['박노진', '한유나', '박노아', '박에스더', '박주빌리'], missing: [], status: '전원' },
    { rep: '박민수', room: '패밀리·5', campus: '분당', members: ['박민수', '김동환', '김예주', '김여호수아', '김데이빗'], missing: [], status: '전원' },
    { rep: '노재용', room: '패밀리·4', campus: '분당', members: ['노재용', '김주애', '노누엘', '노누시'], missing: [], status: '전원' },
    { rep: '민준규', room: '패밀리·4', campus: '분당', members: ['민준규', '강미희', '민세윤', '민세진'], missing: [], status: '전원' },
    { rep: '강혜연', room: '패밀리·4', campus: '분당', members: ['강혜연', '이창원', '이선우', '이시은'], missing: [], status: '전원' },
    { rep: '김승희', room: '소노캄·4', campus: '분당', members: ['김승희', '김정연', '김영균', '김서연'], missing: [], status: '전원' },
    { rep: '정석현', room: '패밀리·4', campus: '부산', members: ['정석현', '홍은희', '정해이', '정시하'], missing: [], status: '전원' },
    { rep: '장성태', room: '소노벨스위트·5', campus: '분당', members: ['장성태', '김보희', '장수아', '장루아', '장사무엘'], missing: [], status: '전원' },
    { rep: '김진명', room: '패밀리·3', campus: '분당', members: ['김진명'], missing: ['최경진', '김이안'], status: '1/3' },
    { rep: '유건희', room: '소노캄·6', flags: '청년·버스', campus: '분당', members: ['유건희', '김지호', '이원균', '김예성', '강현민'], missing: ['천은빈'], status: '5/6' },
    { rep: '안성일', room: '소노벨스위트·4', campus: '분당', members: ['안성일'], missing: ['양영애', '안예원', '안희원'], status: '1/4' },
    { rep: '박현철', room: '소노캄·6', flags: '버스', campus: '분당', members: ['박현철', '박양정'], missing: ['박은후', '남경주', '박종근', '박일렴'], status: '2/6' },
    { rep: '김종명', room: '소노벨스위트·3', campus: '분당', members: ['김종명'], missing: ['김성은', '김찬영'], status: '1/3' },
    { rep: '김미선B', room: '소노벨스위트·6', flags: '부산·버스', campus: '부산', members: ['김미선B', '김미선A', '임채경', '김미경'], missing: ['박영수', '박민경'], status: '4/6' },
    { rep: '김은학', room: '소노캄·7~8', flags: '청년·버스', campus: '분당', members: ['김은학', '강주원', '김지민B', '김경은'], missing: ['고은비', '신채희', '김현지'], status: '4/7' },
    { rep: '박윤정', room: '소노벨스위트·6', flags: '버스', campus: '분당', members: ['박윤정'], missing: ['이수향', '오주연', '김보영', '박지영', '김순자'], status: '1/6' },
    { rep: '함보라', room: '소노캄·7~8', flags: '버스·객실불일치', campus: '분당', members: ['선정희', '함보라', '박혜영'], missing: ['이동신', '안혜천', '김소은', '박윤숙'], status: '3/7' },
    { rep: '석현수', room: '소노캄·7~8', flags: '청년·대표/객실', campus: '분당', members: ['성호민', '석현수'], missing: ['박준영', '이주형', '전동현', '전성민', '김찬'], status: '2/7' },
    { rep: '김연지', room: '소노캄·7~8', flags: '청년·버스·대표미제출', campus: '부산/분당', members: ['신원영', '차윤선', '차윤주', '이한나(청년)', '김윤하'], missing: ['김연지', '전혜리'], status: '5/7' },
    { rep: '김민선', room: '소노벨스위트·6', flags: '청년·버스·대표미제출', campus: '분당', members: ['지유림', '차영민'], missing: ['김민선', '김예은', '김혜민', '이예원'], status: '2/6' },
    { rep: '이경미', room: '소노캄·5', flags: '구버전확인', campus: '분당', members: ['이경미'], missing: ['이상미', '조이한', '조요한', '조영광'], status: '1/5' },
    { rep: '전은혜', room: '패밀리·4', flags: '중복행확인', campus: '분당', members: ['전은혜', '김순우', '김지유'], missing: ['김지안'], status: '3/4' },
    { rep: '이혜란', room: '소노캄·7~8', flags: '버스·설악·비용분리문의', campus: '부산', members: ['이혜란'], missing: ['허준석', '심윤지', '허모세', '허갈렙', '허준영', '안소영', '허온유'], status: '1/8' },
  ],
  partial: [
    { rep: '이선희', members: ['이선희', '안현진'], desc: '외 2명 교회배정 (소노캄)', campus: '분당' },
    { rep: '조형원', members: ['조형원', '최윤선'], desc: '다른 성도와 4명 방', campus: '분당' },
    { rep: '강창모', members: ['강창모', '강현우'], desc: '다른 성도와 패밀리 (둘 다 개인행 제출)', campus: '분당' },
    { rep: '김남현', members: ['김남현', '길태형', '문상철'], desc: '부산청년, 다른 성도와 6명 방', campus: '부산' },
    { rep: '박은미', members: ['박은미', '이사랑A'], desc: '다른 성도와 7~8명 (6인도 가능)', campus: '분당' },
    { rep: '김태희', members: ['김태희', '정나리련'], desc: '+4명 모아 7~8명 희망 (정나리련=6인 신청)', campus: '분당' },
  ],
  individual: [
    { name: '이재민', bus: true, seorak: true }, { name: '강승미', bus: true, seorak: true }, { name: '김민욱', bus: true, seorak: true }, { name: '김민수', bus: true, seorak: true },
    { name: '이병곤', bus: true, seorak: false }, { name: '김혜영', bus: true, seorak: false }, { name: '김진원', bus: true, seorak: false }, { name: '허영숙', bus: true, seorak: false },
    { name: '김유하', bus: true, seorak: false }, { name: '전성훈', bus: true, seorak: false }, { name: '이승원', bus: true, seorak: false }, { name: '박수림', bus: true, seorak: false },
    { name: '황상화', bus: true, seorak: false }, { name: '이정태', bus: true, seorak: false }, { name: '이주형', bus: true, seorak: false }, { name: '문옥진', bus: true, seorak: false },
    { name: '정종진', bus: false, seorak: false }, { name: '김세화', bus: false, seorak: false }, { name: '성원준', bus: false, seorak: false }, { name: '김수연', bus: false, seorak: false },
    { name: '성시우', bus: false, seorak: false }, { name: '이경희', bus: false, seorak: false }, { name: '김창준', bus: false, seorak: false }, { name: '이은희', bus: false, seorak: false }, { name: '강현우', bus: false, seorak: false },
  ],
  duplicates: [
    { name: '김상아', reason: '구버전 2건 → 7:46 1건만 유효' },
    { name: '김말숙', reason: '6/14 소노벨스위트 + 6/16 소노캄 → 최신만' },
    { name: '전은혜', reason: '장년·초등 2행 → 초등행 = 김지안 오기 의심' },
    { name: '이상미 가족', reason: '구버전(koinonewjj)만 존재, 이경미만 재제출' },
    { name: '박테스트1·3·4 / 김마리 / 최베드로 / 테스트2', reason: '테스트 행(집계 제외)' },
    { name: '임성현 테스트', reason: '앱에서 삭제신청' },
  ],
  decisions: [
    '1. 김연지 청년그룹: 대표 김연지·전혜리 미제출. 청년 이한나는 임창은네 이한나B와 동명이인. 실제 제출 = 신원영·차윤선·차윤주·이한나·김윤하.',
    '2. 김윤하: cjkimhope 이메일로 개인 신청인데 김연지 그룹 명단에도 있음 → 개인? 김연지 그룹?',
    '3. 성호민/석현수 청년: 대표 둘로 갈림 + 객실 소노벨스위트(성호민) vs 소노캄(석현수) 불일치, 미제출 4명. 이주형은 개인으로도 제출.',
    '4. 함보라/박혜영/선정희: 같은 7~8 그룹? 객실 소노벨스위트(선정희) vs 소노캄(함보라·박혜영) 불일치. 대표 확정.',
    '5. 김태희+정나리련: 김태희 부분→7~8 희망, 정나리련 6인 그룹. 같은 그룹인지 + 미제출 4명.',
    '6. 이상미 그룹: 이상미·조이한·조요한은 구버전에만(재제출 X), 이경미만 재제출 → 유효 처리?',
    '7. 박은미·이사랑A: 7~8 또는 6인 가능. 버스 편도/왕복 비용 문의.',
    '8. 문옥진: 6인 그룹 선택했으나 명단 공란 → 개인으로 볼지.',
    '9. 강창모·강현우: 서로 다른 개인 행으로 "둘이 패밀리 배정" 요청 → 2인 부분그룹으로 묶을지.',
    '10. 이혜란 그룹(8인): 7명 미제출 + "각 가족당 비용 따로" 문의 → 비용 분리 방침.',
    '11. 이부희 그룹: 출퇴근으로 식사·객실 일부 미이용 문의 → 비용 처리.',
    '12. 동명이인 표시이름: 이한나A(청년·김연지)/B(임창은네), 이사랑A(박은미)/B(김상아네), 김미선A/B, 김지민B, 김경민A.',
    '13. 오기 정정: 조영렬 캠퍼스(부산↔분당), 김혜진 연락처(=방호근), 문상철 연락처 자리수, 함보라 연락처(특수문자).',
  ],
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
  const [qUnpaid, setQUnpaid] = useState('') // #1 미입금 검색(이름·입금자명)
  const [qList, setQList] = useState('') // #1 정리안 검색
  const [onlyProblem, setOnlyProblem] = useState(false) // #6 정리안 문제만 보기
  const [gSort, setGSort] = useState('time') // 정리안 그룹 정렬: time(접수순)/name(ㄱㄴㄷ)/size(인원)
  const [liveSort, setLiveSort] = useState('time') // 실시간 목록 정렬(그룹정리·미입금): time=접수(행)순/name/size
  const [doneInq, setDoneInq] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem('retreat_done_inq') || '[]')) } catch { return new Set() } }) // #8 문의 완료
  const [onlyUndoneInq, setOnlyUndoneInq] = useState(true) // #8 미처리만 보기
  const toggleDoneInq = (key) => { const ns = new Set(doneInq); ns.has(key) ? ns.delete(key) : ns.add(key); setDoneInq(ns); try { localStorage.setItem('retreat_done_inq', JSON.stringify([...ns])) } catch (e) {} }
  const [boarded, setBoarded] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem('retreat_boarded') || '[]')) } catch { return new Set() } }) // #9 버스 탑승 체크
  const toggleBoarded = (key) => { const ns = new Set(boarded); ns.has(key) ? ns.delete(key) : ns.add(key); setBoarded(ns); try { localStorage.setItem('retreat_boarded', JSON.stringify([...ns])) } catch (e) {} }
  const [extraRooms, setExtraRooms] = useState([]) // 빈 방 라벨 (타입 인코딩: "방1 (소노캄)")
  const [poolSort, setPoolSort] = useState('name') // 미배정 정렬: name(ㄱㄴㄷ)/dept(부서)
  const [poolRoomFilter, setPoolRoomFilter] = useState('all') // 미배정 객실 필터
  const [editGid, setEditGid] = useState(null) // 관리자 그룹 편집 대상
  const [mergeSel, setMergeSel] = useState({}) // 합치기 선택 gid→bool
  const [mergeMsg, setMergeMsg] = useState('')
  const [ph, setPh] = useState({ name: '', dept: '' }) // 미제출 인원 추가
  const [phMsg, setPhMsg] = useState('')
  const [moveQ, setMoveQ] = useState('') // 그룹정리: 옮길 사람 이름 검색
  const [movePick, setMovePick] = useState(null) // 선택된 옮길 사람
  const [moveTargetQ, setMoveTargetQ] = useState('') // 대상 그룹 이름 검색
  const [dismissed, setDismissed] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem('retreat_miss_dismiss') || '[]')) } catch { return new Set() } }) // 미제출명단 수동 제외
  const [showNoise, setShowNoise] = useState(false) // 문의탭: '없음/없습니다' 표시 여부
  const [confirmBox, setConfirmBox] = useState(null) // 공용 확인 다이얼로그 {title, lines, onOk, okLabel}
  const ask = (title, lines, onOk, okLabel = '진행') => setConfirmBox({ title, lines, onOk, okLabel })
  const [showGuide, setShowGuide] = useState(false) // 인앱 사용법 가이드
  const [mailTpl, setMailTpl] = useState(null) // #26/#30 메일 템플릿(관리자 편집)
  const [mailDef, setMailDef] = useState({}) // 기본값(초기화용)
  const [mailMsg, setMailMsg] = useState('')
  const [mailPrev, setMailPrev] = useState({}) // 메일별 전체 미리보기 펼침
  const loadMailTpl = async () => { setMailMsg('불러오는 중…'); const j = await post({ action: 'mailTplGet', pin }); if (j.ok) { setMailTpl(j.tpl); setMailDef(j.defaults || {}); setMailMsg('') } else setMailMsg('오류: ' + (j.error || '')) }
  const saveMailTpl = async () => { setMailMsg('저장 중…'); const j = await post({ action: 'mailTplSet', pin, tpl: mailTpl }); setMailMsg(j.ok ? '✓ 저장되었습니다 (이후 발송부터 적용)' : '오류: ' + (j.error || '')) }
  // 🤖 AI 정리안
  const [aiSort, setAiSort] = useState(() => { try { return JSON.parse(localStorage.getItem('retreat_ai_sort') || 'null') } catch { return null } })
  const [aiOff, setAiOff] = useState(false) // 규칙기반으로 보기 토글
  const [aiBusy, setAiBusy] = useState(false)
  const [aiMsg, setAiMsg] = useState('')
  const runAiSort = async () => {
    setAiBusy(true); setAiMsg('AI가 시트를 읽고 분석 중… (몇 초 걸려요)')
    try {
      const j = await post({ action: 'aiSort', pin })
      if (j.ok) { const v = { at: j.at, result: j.result }; setAiSort(v); setAiOff(false); try { localStorage.setItem('retreat_ai_sort', JSON.stringify(v)) } catch (e) {} setAiMsg('') }
      else setAiMsg('오류: ' + (j.error || ''))
    } catch (e) { setAiMsg('오류: ' + String(e)) } finally { setAiBusy(false) }
  }
  const [undoStack, setUndoStack] = useState([]) // 실행 취소: 방/입금 컬럼 작업의 직전 값 스냅샷
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

  // 실행 취소: 작업 전 해당 컬럼 값을 스냅샷 → 되돌릴 때 그대로 복원
  const pushUndo = (label, field, rowNums) => {
    const updates = [...new Set(rowNums)].map((r) => { const row = rows.find((x) => x.row === r); return { row: r, value: (row && row[field]) || '' } })
    if (updates.length) setUndoStack((s) => [...s, { label, field, updates }].slice(-10))
  }
  const undoLast = () => {
    const last = undoStack[undoStack.length - 1]
    if (!last) return
    ask('실행 취소할까요?', `직전 작업 '${last.label}'을(를) 되돌립니다 (${last.updates.length}건 원래대로).`, async () => {
      setSaveMsg('되돌리는 중…'); setMergeMsg('되돌리는 중…')
      const j = await post({ action: 'adminBatch', pin, field: last.field, updates: last.updates })
      if (j.ok) { setUndoStack((s) => s.slice(0, -1)); setSaveMsg('↩ 되돌렸어요'); setMergeMsg('↩ 되돌렸어요'); await reload() } else { setSaveMsg('오류: ' + (j.error || '')); setMergeMsg('오류: ' + (j.error || '')) }
      setTimeout(() => { setSaveMsg(''); setMergeMsg('') }, 3000)
    }, '되돌리기')
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
    // 그룹(gid)에 객실 예약(N인 투숙) 멤버가 하나라도 있으면 그 그룹은 '예약그룹' → 전원 풀에서 제외(한 그룹이 쪼개지지 않게)
    const bookedGids = new Set(notDup.filter((r) => !isChurchAssigned(r.occLabel)).map((r) => r.gid))
    const pool = notDup.filter((r) => isChurchAssigned(r.occLabel) && !bookedGids.has(r.gid))  // 교회배정 풀(미제출 placeholder 포함→배정 가능)
    const unassigned = pool.filter((r) => !(r.assigned || assignDraft[r.row]))
    const checkGroups = {}
    rows.forEach((r) => { if (r.check === 'Y') checkGroups[r.gid] = { rep: r.rep, gid: r.gid, note: r.note } })
    // 명단 기준 예상: 제출 인원 + "명단에 적혔지만 아무도 제출 안 한 이름"(전체 1회씩)
    // → 그룹이 쪼개져도 이중계산 안 됨. 이름 정규화(공백/"가족/" 제거)로 매칭 정확도 ↑
    const norm = (x) => String(x || '').replace(/\s+/g, '').replace(/^가족\//, '')
    const allNames = new Set(notDup.map((r) => norm(r.name)))   // 제출 + 미제출(placeholder) 행 전체
    const baseNames = new Set(allNames)                          // + 동명이인 접미사(A/B/숫자) 뗀 형태도 등록으로 인정
    notDup.forEach((r) => { const b = norm(r.name).replace(/[A-Za-z0-9]+$/, ''); if (b.length >= 2) baseNames.add(b) })
    const josa = /(와|과|은|는|이|가|을|를|도|만|의|님|씨|께|들|랑|이랑|에게|한테|에서|하고)$/
    // 조사 보정은 "자른 결과가 실제 등록자일 때만" 적용 (이사랑→이사 같은 오절단 방지). 아니면 원본 유지
    const resolveNm = (k) => { if (baseNames.has(k)) return k; const s = k.replace(josa, ''); return (s.length >= 2 && baseNames.has(s)) ? s : k }
    const missMap = {}
    rows.forEach((r) => { nameTokens(r.list).forEach((nm) => { const k = resolveNm(norm(nm)); if (k.length >= 2 && !baseNames.has(k)) { (missMap[k] = missMap[k] || new Set()).add(r.rep || r.name) } }) })
    const missingList = Object.keys(missMap).map((k) => ({ name: k, from: [...missMap[k]].slice(0, 3).join(', ') }))
    const missing = missingList.length
    const expected = notDup.length + missing
    // 설악산뷰: 방 단위 집계 (확정 그룹=그룹, 배정 풀=배정방, 미배정 인원 분리). 인원보다 방 수가 실제 자원 단위
    const seoMap = {}; const seoUnassigned = []
    notDup.filter((r) => r.seorak).forEach((r) => {
      const cs = (r.campus || '').replace(' 캠퍼스', '')
      if (!isChurchAssigned(r.occLabel)) { const k = 'G:' + r.gid; (seoMap[k] = seoMap[k] || { label: `${r.rep || r.name} 그룹`, campus: cs, people: [] }).people.push(r.name) }
      else if (r.assigned) { const k = 'R:' + r.assigned; (seoMap[k] = seoMap[k] || { label: r.assigned, campus: cs, people: [] }).people.push(r.name) }
      else seoUnassigned.push(r)
    })
    const seoRooms = Object.values(seoMap)
    return { totalPeople, placeholderN, totalAmount, byCampus, busList, seorakN, unpaid, pool, unassigned, checkGroups: Object.values(checkGroups), expected, missing, missingList, seoRooms, seoUnassigned }
  }, [rows, assignDraft])

  // 요청조합: 부분그룹·"○○와 같은 방" 요청을 파싱 → 그래프로 묶고 → 교차검증
  // (비용은 그대로 두고 배정방만 지정. mergeGroups 호출 안 함 = 비용 중복부과 방지)
  const reqCombine = useMemo(() => {
    const norm = (x) => String(x || '').replace(/\s+/g, '').replace(/^가족\//, '')
    const josa = /(와|과|은|는|이|가|을|를|도|만|의|님|씨|께|들|랑|이랑|에게|한테|에서|하고)$/
    const tok = nameTokens // 공통 이름추출 함수 사용
    const live = rows.filter((r) => r.route !== '중복')
    const byName = {}
    live.forEach((r) => { const k = norm(r.name); (byName[k] = byName[k] || []).push(r) })
    const rowByNum = {}; live.forEach((r) => { rowByNum[r.row] = r })
    const gidBooked = {}; live.forEach((r) => { if (/인이 투숙/.test(r.occLabel || '')) gidBooked[r.gid] = true })
    const isPool = (r) => isChurchAssigned(r.occLabel)
    // 토큰 → 등록자 이름 해소 (조사 제거 보정). 못 찾으면 원본 토큰 반환
    const resolve = (k) => { if (byName[k]) return k; const s = k.replace(josa, ''); return (s.length >= 2 && byName[s]) ? s : k }
    const picksOf = (r) => { const self = norm(r.name); return [...new Set([...tok(r.list), ...tok(r.inquiry)].map(resolve))].filter((k) => k && k !== self) }
    // 외부(타 그룹) 지목이 있거나, 본인이 부분그룹인 풀 멤버 = 요청자. 단 본인 그룹이 이미 확정그룹이면 제외(대표 오탐 방지)
    const isPartial = (r) => /부분/.test(r.occLabel || '') || /부분/.test(r.note || '')
    const isCross = (r, k) => { const c = byName[k] || []; return c.length > 0 && !c.every((p) => p.gid === r.gid) }
    const reqRows = live.filter((r) => isPool(r) && !gidBooked[r.gid] && (picksOf(r).some((k) => isCross(r, k)) || isPartial(r)))
    if (!reqRows.length) return { clusters: [], count: 0 }
    const parent = {}
    const init = (x) => { if (parent[x] === undefined) parent[x] = x }
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
    const union = (a, b) => { init(a); init(b); const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb }
    reqRows.forEach((r) => init(r.row))
    const noteByRow = {}
    reqRows.forEach((r) => {
      noteByRow[r.row] = { unresolved: [], ambiguous: [], booked: [] }
      picksOf(r).forEach((k) => {
        const cand = byName[k] || []
        if (!cand.length) { noteByRow[r.row].unresolved.push(k); return }
        if (cand.length > 1) { noteByRow[r.row].ambiguous.push(k); return }
        const p = cand[0]
        if (!isPool(p)) { noteByRow[r.row].booked.push(p.name); return } // 타 확정 그룹 소속
        union(r.row, p.row) // 같은 그룹/타 그룹 모두 한 방 후보로 묶기
      })
    })
    const byGid = {}
    reqRows.forEach((r) => { (byGid[r.gid] = byGid[r.gid] || []).push(r) })
    Object.values(byGid).forEach((arr) => arr.slice(1).forEach((x) => union(arr[0].row, x.row)))
    const comp = {}
    Object.keys(parent).forEach((rw) => { const root = find(Number(rw)); (comp[root] = comp[root] || []).push(Number(rw)) })
    const clusters = Object.values(comp).map((nums) => {
      const members = [...new Set(nums)].map((x) => rowByNum[x]).filter(Boolean)
      const genders = [...new Set(members.map((p) => p.gender).filter(Boolean))]
      const campuses = [...new Set(members.map((p) => (p.campus || '').replace(' 캠퍼스', '')).filter(Boolean))]
      const roomType = roomTypeOfMembers(members)
      const cap = ROOM_CAP[roomType] || 8
      const rooms = [...new Set(members.map((p) => p.assigned).filter(Boolean))]
      const allSameRoom = rooms.length === 1 && members.every((p) => p.assigned)
      const done = allSameRoom
      const unresolved = [...new Set(members.flatMap((p) => noteByRow[p.row]?.unresolved || []))].filter((k) => !dismissed.has(k))
      const ambiguous = [...new Set(members.flatMap((p) => noteByRow[p.row]?.ambiguous || []))]
      const booked = [...new Set(members.flatMap((p) => noteByRow[p.row]?.booked || []))]
      const conflicts = []
      if (genders.length > 1) conflicts.push({ lv: 'warn', msg: `남녀 같은 방 (${genders.join('·')}) — 부부·가족이면 OK, 아니면 분리` })
      if (members.length > cap) conflicts.push({ lv: 'block', msg: `정원 초과 (${members.length}/${cap}명) — 객실 변경 또는 분리` })
      if (booked.length) conflicts.push({ lv: 'block', msg: `이미 그룹 소속: ${booked.join(', ')} (확정 그룹 우선)` })
      if (!done && rooms.length) conflicts.push({ lv: 'check', msg: `이미 배정됨(서로 다름): ${members.filter((p) => p.assigned).map((p) => `${p.name}→${p.assigned}`).join(', ')}` })
      if (ambiguous.length) conflicts.push({ lv: 'check', msg: `동명이인: ${ambiguous.join(', ')} — 누구인지 확인` })
      if (unresolved.length) conflicts.push({ lv: 'check', msg: '명단에 없는 사람', names: unresolved })
      if (campuses.length > 1) conflicts.push({ lv: 'warn', msg: `캠퍼스 혼합: ${campuses.join('·')}` })
      const block = conflicts.some((c) => c.lv === 'block')
      const score = (done ? -10 : 0) + conflicts.reduce((s, c) => s + (c.lv === 'block' ? 100 : c.lv === 'check' ? 10 : 1), 0)
      return { members, roomType, cap, conflicts, block, done, room: allSameRoom ? rooms[0] : '', score, label: '', genders, campuses }
    })
    clusters.sort((a, b) => b.score - a.score)
    clusters.forEach((c, i) => { c.label = `요청-${roomTypeShort(c.roomType)}-${i + 1}` })
    // 빈자리 자동 매칭 / 조정 제안: 더 채우려는(부분) 묶음에 조건 맞는 미배정자를 추천
    const clusteredRows = new Set(clusters.flatMap((c) => c.members.map((p) => p.row)))
    const gidCount = {}; live.forEach((r) => { gidCount[r.gid] = (gidCount[r.gid] || 0) + 1 })
    const pool = live.filter((r) => isPool(r))
    const fillIntent = /외|다른|채우|채워|더|남는|배정해|함께|같이|명\s*방|6명|7명|8명|7~8|7-8/
    clusters.forEach((c) => {
      const open = c.cap - c.members.length
      const intent = c.members.some((p) => fillIntent.test(p.list || '') || fillIntent.test(p.inquiry || ''))
      c.openSlots = open
      c.wantsMore = open > 0 && intent && !c.block
      c.fillRoom = c.done ? c.room : c.label // 이미 방 있으면 그 방으로, 아니면 새 라벨
      if (!c.wantsMore) return
      const cand = pool.filter((p) => !p.assigned && !clusteredRows.has(p.row) && gidCount[p.gid] === 1
        && (c.genders.length !== 1 || p.gender === c.genders[0])
        && (c.campuses.length !== 1 || (p.campus || '').replace(' 캠퍼스', '') === c.campuses[0]))
      c.fillCandidates = cand.slice(0, open)
      c.fillMore = cand.length
    })
    return { clusters, count: clusters.length }
  }, [rows, dismissed])

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
    if (!isPool) {
      const target = String(over.id)
      const person = m.pool.find((p) => p.row === row)
      const occ = m.pool.filter((p) => p.row !== row && (assignDraft[p.row] !== undefined ? assignDraft[p.row] : (p.assigned || '')) === target)
      const clash = occ.find((p) => p.gender && person && person.gender && p.gender !== person.gender)
      if (clash) { setSaveMsg(`⚠️ 한 방에 남녀를 함께 배정할 수 없습니다 — ${target}: ${clash.name}(${clash.gender}) ↔ ${person.name}(${person.gender})`); return }
    }
    setAssignDraft((d) => ({ ...d, [row]: isPool ? '' : String(over.id) }))
  }
  const roomTypeShort2 = (t) => (t === '소노캄 스위트' ? '소노캄' : t === '소노벨 스위트' ? '스위트' : '패밀리')
  const addRoom = (type) => {
    const short = roomTypeShort2(type || '소노벨 패밀리')
    const labOf = (n) => `방${n} (${short})`
    let i = 1; const exist = new Set([...m.pool.map((p) => eff(p)).filter(Boolean), ...extraRooms])
    while (exist.has(labOf(i))) i++
    setExtraRooms((r) => [...r, labOf(i)])
  }
  const removeRoom = (lab) => {
    setExtraRooms((r) => r.filter((x) => x !== lab))
    setAssignDraft((d) => { const nd = { ...d }; m.pool.forEach((p) => { const cur = d[p.row] !== undefined ? d[p.row] : (p.assigned || ''); if (cur === lab) nd[p.row] = '' }); return nd })
  }

  const saveAssign = () => {
    const changed = m.pool.filter((p) => eff(p) !== (p.assigned || '')).length
    ask('방배정을 저장할까요?', `교회배정 대상 ${m.pool.length}명의 방배정을 시트에 저장합니다.${changed ? `\n(이번에 바뀐 사람: ${changed}명)` : '\n(바뀐 내용이 없습니다)'}`, async () => {
      pushUndo('방배정 저장', 'assigned', m.pool.filter((p) => eff(p) !== (p.assigned || '')).map((p) => p.row))
      const updates = m.pool.map((p) => ({ row: p.row, value: eff(p), assigned: eff(p) }))
      setSaveMsg('저장 중…')
      const j = await post({ action: 'adminBatch', pin, field: 'assigned', updates })
      if (j.ok) { setSaveMsg(`✓ ${updates.length}명 저장`); await reload(); setAssignDraft({}); setExtraRooms([]) } else setSaveMsg('오류: ' + (j.error || ''))
      setTimeout(() => setSaveMsg(''), 3000)
    }, '저장')
  }

  const togglePaid = async (row, cur) => {
    const val = cur === 'Y' ? '' : 'Y'
    setRows((rs) => rs.map((r) => (r.row === row ? { ...r, paid: val } : r)))
    await post({ action: 'adminSet', pin, row, field: 'paid', value: val })
  }

  const batchConfirmPaid = () => {
    const updates = Object.keys(sel).filter((r) => sel[r]).map((r) => ({ row: Number(r), value: 'Y' }))
    if (!updates.length) return
    ask('입금확인 처리할까요?', `선택한 ${updates.length}명을 '입금확인'으로 표시합니다. 실제로 입금된 분만 선택했는지 확인하세요.`, async () => {
      pushUndo('입금확인 일괄', 'paid', updates.map((u) => u.row))
      setRows((rs) => rs.map((r) => (sel[r.row] ? { ...r, paid: 'Y' } : r)))
      setSel({})
      await post({ action: 'adminBatch', pin, field: 'paid', updates })
    }, '입금확인')
  }
  const toggleSel = (row) => setSel((s) => ({ ...s, [row]: !s[row] }))

  const mergeSelected = () => {
    const gids = Object.keys(mergeSel).filter((g) => mergeSel[g])
    if (gids.length < 2) { setMergeMsg('2개 이상 선택하세요'); return }
    const names = rows.filter((r) => gids.includes(r.gid) && r.route !== '중복').map((r) => r.name)
    ask('이 그룹들을 합칠까요?', `선택한 ${gids.length}개 그룹을 한 그룹(같은 비용 단위)으로 합칩니다.\n대상: ${names.join(', ')}\n\n⚠ 비용이 다시 계산됩니다(객실 그룹가 등). 되돌리려면 그룹정리에서 다시 나눠야 해요.`, async () => {
      setMergeMsg('합치는 중… (재계산 포함, 수 초 소요)')
      const j = await post({ action: 'mergeGroups', pin, gids })
      if (j.ok) { setMergeMsg(`✓ ${j.merged}명을 한 그룹으로 합침`); setMergeSel({}); await reload() } else setMergeMsg('오류: ' + (j.error || ''))
      setTimeout(() => setMergeMsg(''), 4000)
    }, '합치기')
  }
  const toggleMerge = (gid) => setMergeSel((s) => ({ ...s, [gid]: !s[gid] }))

  const moveMember = (name, to, toLabel) => {
    const dest = to === '__solo__' ? '단독(혼자) 그룹으로 분리' : `${toLabel || '선택한'} 그룹으로 이동`
    ask('이동할까요?', `${name}님을 ${dest}합니다.\n\n⚠ 비용이 다시 계산되고, 방 배정도 같이 맞춰집니다.`, async () => {
      setMergeMsg(`${name} 이동 중… (재계산 포함, 수 초)`)
      const j = await post({ action: 'moveMember', pin, name, to })
      if (j.ok) { setMergeMsg(`✓ ${name} 이동 완료`); await reload() } else setMergeMsg('오류: ' + (j.error || ''))
      setTimeout(() => setMergeMsg(''), 3500)
    }, to === '__solo__' ? '분리' : '이동')
  }

  const addPlaceholder = async () => {
    if (!ph.name.trim()) { setPhMsg('이름을 입력하세요'); return }
    setPhMsg('추가 중…')
    const deptLabel = ph.dept ? DEPTS.find((d) => d.name === ph.dept)?.label : ''
    const j = await post({ action: 'addPlaceholder', pin, name: ph.name.trim(), deptLabel })
    if (j.ok) { setPh({ name: '', dept: '' }); setPhMsg('✓ 미제출 인원 추가됨'); await reload() } else setPhMsg('오류: ' + (j.error || ''))
    setTimeout(() => setPhMsg(''), 3000)
  }

  // 요청조합 확정: 같은 방 라벨(배정방)만 부여 — 비용은 그대로(그룹 합치기 아님)
  const assignRoom = async (rowList, label) => {
    if (!rowList.length) return
    pushUndo(`방 배정(${label})`, 'assigned', rowList)
    setSaveMsg(`${label} 배정 중…`)
    const updates = rowList.map((row) => ({ row, value: label }))
    const j = await post({ action: 'adminBatch', pin, field: 'assigned', updates })
    if (j.ok) { setSaveMsg(`✓ ${label} ${updates.length}명 배정`); await reload() } else setSaveMsg('오류: ' + (j.error || ''))
    setTimeout(() => setSaveMsg(''), 3000)
  }
  const addPlaceholderName = (name) => {
    ask('미제출 인원으로 추가할까요?', `'${name}'을(를) 미제출 인원으로 추가해 방배정 대상에 넣습니다.\n이름이 맞는지(오타·문장 일부가 아닌지) 확인하세요.`, async () => {
      setSaveMsg(`${name} 추가 중…`)
      const j = await post({ action: 'addPlaceholder', pin, name })
      if (j.ok) { setSaveMsg(`✓ ${name} 미제출 추가`); await reload() } else setSaveMsg('오류: ' + (j.error || ''))
      setTimeout(() => setSaveMsg(''), 3000)
    }, '추가')
  }

  const dismissMissing = (name) => setDismissed((s) => { const n = new Set(s); n.add(name); try { localStorage.setItem('retreat_miss_dismiss', JSON.stringify([...n])) } catch {} return n })
  const clearDismissed = () => { setDismissed(new Set()); try { localStorage.removeItem('retreat_miss_dismiss') } catch {} }

  // 현재 그룹(gid) 기준으로 배정방 일괄 정렬: 2명 이상 그룹만 배정방="{대표} 방"
  // (과거 sv10 배포 전에 합치거나 시트 직접 수정해 방 싱크가 빠진 그룹 보정. 1인=개인은 건드리지 않음)
  const syncAllRooms = () => {
    const byGid = {}
    rows.filter((r) => r.route !== '중복').forEach((r) => { (byGid[r.gid] = byGid[r.gid] || []).push(r) })
    const updates = []; const groupLabels = []
    Object.values(byGid).forEach((mem) => {
      if (mem.length < 2) return
      const label = `${mem[0].rep || mem[0].name} 방` // 보이는 그룹 그대로: 전원 "{대표} 방"
      let touched = false
      mem.forEach((r) => { if ((r.assigned || '') !== label) { updates.push({ row: r.row, value: label }); touched = true } })
      if (touched) groupLabels.push(label)
    })
    if (!updates.length) { setMergeMsg('이미 모든 그룹이 방과 동기화돼 있습니다'); setTimeout(() => setMergeMsg(''), 3000); return }
    ask('그룹 기준으로 방을 맞출까요?', `${groupLabels.length}개 그룹(${updates.length}명)의 배정방을 '대표 방'으로 통일합니다.\n바뀌는 방: ${groupLabels.slice(0, 8).join(', ')}${groupLabels.length > 8 ? ` 외 ${groupLabels.length - 8}개` : ''}\n\n※ 개인(1명)은 안 건드립니다. 방배정 보드에서 따로 지정한 라벨이 있으면 덮어써집니다.`, async () => {
      pushUndo('그룹 기준 방 맞추기', 'assigned', updates.map((u) => u.row))
      setMergeMsg(`방 일괄 정렬 중… ${updates.length}명`)
      const j = await post({ action: 'adminBatch', pin, field: 'assigned', updates })
      if (j.ok) { setMergeMsg(`✓ ${updates.length}명 배정방을 그룹 기준으로 맞췄습니다`); setAssignDraft({}); setExtraRooms([]); await reload() } else setMergeMsg('오류: ' + (j.error || ''))
      setTimeout(() => setMergeMsg(''), 4000)
    }, '맞추기')
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
      <div className="text-[11px] text-[#5f6b7a] font-semibold mb-1">{label}</div>
      <div className="text-[20px] font-extrabold text-[#191f28] leading-none">{value}</div>
      {sub && <div className="text-[11px] text-[#5f6b7a] mt-1">{sub}</div>}
    </div>
  )

  const TAB_ORDER = ['요약', '정리안', '그룹정리', '요청조합', '방배정', '리마인드', '문의', '버스명단', '메일문구']
  const TAB_LABEL = { 요약: '요약', 정리안: '정리안', 그룹정리: '그룹정리', 요청조합: '같은 방 요청', 방배정: '방배정', 리마인드: '입금·확인', 문의: '문의', 버스명단: '버스', 메일문구: '✉️ 메일문구' }
  // #11 워크플로우 단계 번호(① 그룹정리 → ② 같은방 → ③ 방배정 → ④ 입금) + 처리할 건수 배지
  const TAB_STEP = { 그룹정리: 1, 요청조합: 2, 방배정: 3, 리마인드: 4 }
  const tabCount = (t) => t === '리마인드' ? m.unpaid.length : t === '방배정' ? m.unassigned.length : t === '그룹정리' ? m.checkGroups.length : 0
  const goTab = (t) => { setTab(t); setMergeSel({}); if (t === '메일문구' && !mailTpl) loadMailTpl() } // 탭 이동 시 합치기 선택 초기화(탭 간 오선택 방지)

  return (
    <div className="min-h-screen bg-[#f2f4f6] text-[#333d4b] pb-12">
      {showGuide && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setShowGuide(false)}>
          <div className="bg-white w-full max-w-[480px] rounded-2xl my-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-2 sticky top-0 bg-white rounded-t-2xl">
              <div className="text-[17px] font-extrabold text-[#191f28]">📖 리트릿 관리자 사용법</div>
              <button onClick={() => setShowGuide(false)} className="text-[13px] font-bold text-[#5f6b7a]">닫기 ✕</button>
            </div>
            <div className="px-5 pb-6 text-[13px] text-[#4e5968] leading-relaxed space-y-4">
              <div>
                <div className="font-bold text-[#191f28] mb-1">① 꼭 알아야 할 2가지</div>
                <div className="bg-[#f9fafb] rounded-xl p-3">
                  <p><b className="text-[#1b64da]">그룹</b> = <b>비용</b>을 함께 내는 단위(가족 등). 합치면 객실 그룹가 등 <b>비용이 다시 계산</b>돼요.</p>
                  <p className="mt-1.5"><b className="text-[#7c3aed]">방</b> = <b>같이 자는</b> 단위. 비용과 무관하게 방 번호만 같이 붙입니다.</p>
                  <p className="mt-1.5 text-[12px] text-[#5f6b7a]">→ "돈도 같이"는 <b>그룹정리</b>, "방만 같이"는 <b>같은 방 요청</b> 탭.</p>
                </div>
              </div>
              <div>
                <div className="font-bold text-[#191f28] mb-1">② 이 순서로 하면 됩니다</div>
                <ol className="list-decimal pl-5 space-y-1">
                  <li><b>그룹정리</b> — 잘못 묶이거나 떨어진 가족·그룹을 바로잡기</li>
                  <li><b>같은 방 요청</b> — "○○랑 같은 방" 요청을 모아 방 묶기(비용 각자)</li>
                  <li><b>방배정</b> — 교회가 정해줄 사람을 방에 배치(자동배치 + 드래그)</li>
                  <li><b>입금·확인</b> — 입금 확인하고, 미제출자 연락</li>
                </ol>
                <p className="text-[12px] text-[#5f6b7a] mt-1">요약 탭의 <b>'확인 리스트'</b>를 위에서부터 누르면 해당 탭으로 갑니다.</p>
              </div>
              <div>
                <div className="font-bold text-[#191f28] mb-1">③ 자주 하는 일</div>
                <ul className="list-disc pl-5 space-y-1">
                  <li><b>잘못 나뉜 가족 합치기</b>: 그룹정리 → 의심목록 '합치기' 또는 체크 후 합치기</li>
                  <li><b>사람 다른 그룹으로 옮기기</b>: 그룹정리 → '이름으로 이동'</li>
                  <li><b>같은 방 요청 처리</b>: 같은 방 요청 → 🟢/🟡 카드 '묶기'</li>
                  <li><b>부분그룹 빈자리 채우기</b>: 같은 방 요청 카드의 '➕ 빈자리'에서 추천 인원 추가</li>
                  <li><b>그룹대로 방 통일</b>: 방배정(또는 그룹정리) → '🛏️ 그룹 기준으로 방 맞추기'</li>
                  <li><b>미제출자 추가</b>: 요약 '미제출 추정 명단' 또는 방배정에서 추가</li>
                  <li><b>입금 확인</b>: 입금·확인 → 체크 후 '입금확인'</li>
                </ul>
              </div>
              <div>
                <div className="font-bold text-[#191f28] mb-1">④ 신호 색</div>
                <p>🔴 먼저 풀어야 함 · 🟡 확인 후 진행 · 🟢/✅ 바로 가능·완료</p>
                <p className="mt-1 text-[12px] text-[#5f6b7a]">합치기·이동·일괄저장은 누르면 <b>확인창</b>이 떠요. "비용이 바뀜/안 바뀜"을 보고 진행하세요.</p>
                <p className="mt-1 text-[12px] text-[#5f6b7a]">방·입금 작업(방배정·방 맞추기·입금확인)은 헤더 <b>‘↩ 되돌리기’</b>로 직전 작업을 되돌릴 수 있어요.</p>
              </div>
              <div>
                <div className="font-bold text-[#191f28] mb-1">⑤ 이럴 땐 웹앱 제작자에게</div>
                <p>비용이 이상하게 계산됨 · 오류 메시지가 뜸 · 화면이 안 바뀜(배포/시트 문제). 그 외 자유텍스트 분류(요청조합·미제출 명단)는 <b>어림짐작</b>이라 틀릴 수 있으니 사람이 확인하고 진행하세요.</p>
              </div>
              <button onClick={() => setShowGuide(false)} className="w-full py-3 rounded-xl bg-[#3182f6] text-white font-bold text-[14px]">알겠습니다</button>
            </div>
          </div>
        </div>
      )}
      {confirmBox && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setConfirmBox(null)}>
          <div className="bg-white w-full max-w-[420px] rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-bold text-[#191f28] mb-2">{confirmBox.title}</div>
            <div className="text-[13px] text-[#4e5968] leading-relaxed mb-4 max-h-[45vh] overflow-y-auto whitespace-pre-wrap">{confirmBox.lines}</div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmBox(null)} className="flex-1 py-3 rounded-xl bg-[#f2f4f6] text-[#4e5968] font-bold text-[14px]">취소</button>
              <button onClick={() => { const fn = confirmBox.onOk; setConfirmBox(null); if (fn) fn() }} className="flex-1 py-3 rounded-xl bg-[#3182f6] text-white font-bold text-[14px]">{confirmBox.okLabel}</button>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-[720px] mx-auto px-4 pt-6">
        <header className="mb-3">
          <div className="flex items-center justify-between">
            <h1 className="text-[20px] font-extrabold text-[#191f28]">리트릿 관리자</h1>
            <div className="flex gap-1.5">
              {undoStack.length > 0 && <button onClick={undoLast} className="text-[12px] bg-[#fff4e5] text-[#b45309] px-3 py-1.5 rounded-xl font-bold whitespace-nowrap">↩ 되돌리기</button>}
              <button onClick={() => setShowGuide(true)} className="text-[12px] bg-[#eef5ff] text-[#1b64da] px-3 py-1.5 rounded-xl font-bold whitespace-nowrap">📖 사용법</button>
              <button onClick={reload} className="text-[12px] bg-white border border-[#f2f4f6] px-3 py-1.5 rounded-xl font-bold text-[#4e5968] whitespace-nowrap">새로고침</button>
            </div>
          </div>
          <p className="text-[12px] text-[#5f6b7a] mt-1">신청을 <b className="text-[#4e5968]">① 그룹 정리 → ② 같은 방 요청 → ③ 방배정 → ④ 입금·연락</b> 순으로 진행하면 됩니다.</p>
        </header>

        <div className="flex gap-1.5 bg-[#e9ecef] p-1.5 rounded-[14px] mb-4 overflow-x-auto sticky top-0 z-20 shadow-sm">
          {TAB_ORDER.map((t) => {
            const cnt = tabCount(t)
            const step = TAB_STEP[t]
            return (
              <button key={t} onClick={() => goTab(t)} className={`flex-1 whitespace-nowrap py-2.5 px-3 text-[13px] font-bold rounded-[10px] flex items-center justify-center gap-1 ${tab === t ? 'bg-white text-[#3182f6] shadow' : 'text-[#5f6b7a]'}`}>
                {step && <span className={`w-[15px] h-[15px] rounded-full text-[10px] font-extrabold flex items-center justify-center ${tab === t ? 'bg-[#3182f6] text-white' : 'bg-[#cbd2da] text-white'}`}>{step}</span>}
                {TAB_LABEL[t]}
                {cnt > 0 && <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${tab === t ? 'bg-[#fde7ea] text-[#dc2626]' : 'bg-[#dc2626] text-white'}`}>{cnt}</span>}
              </button>
            )
          })}
        </div>

        <StatusLegend />

        {tab === '요약' && (
          <div>
            {saveMsg && <p className="text-[12px] text-[#1b64da] font-semibold mb-2">{saveMsg}</p>}
            {/* #4 등록 진행률 막대 (제출 / 명단 예상) */}
            {(() => {
              const pct = m.expected > 0 ? Math.min(100, Math.round((m.totalPeople / m.expected) * 100)) : 0
              return (
                <div className="bg-white rounded-2xl border border-[#f2f4f6] p-4 mb-3">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-[13px] font-bold text-[#191f28]">등록 진행률</span>
                    <span className="text-[12px] text-[#5f6b7a]">제출 <b className="text-[#191f28]">{m.totalPeople}</b> / 예상 {m.expected}명</span>
                  </div>
                  <div className="h-3 rounded-full bg-[#eef0f3] overflow-hidden">
                    <div className="h-full rounded-full bg-[#3182f6] transition-all" style={{ width: pct + '%' }} />
                  </div>
                  <div className="text-[11px] text-[#5f6b7a] mt-1.5">{pct}% · 미제출 추정 {m.missing}명{m.unpaid.length > 0 ? ` · 미입금 ${m.unpaid.length}명` : ''}</div>
                </div>
              )
            })()}
            {(() => {
              const todo = [
                { n: m.checkGroups.length, label: '확인 필요한 그룹 점검', tab: '그룹정리' },
                { n: reqCombine.clusters.filter((c) => !c.done).length, label: '같은 방 요청 처리', tab: '요청조합' },
                { n: m.unassigned.length, label: '방배정 (아직 방 안 정해진 사람)', tab: '방배정' },
                { n: m.unpaid.length, label: '미입금 확인', tab: '리마인드' },
              ]
              const left = todo.filter((t) => t.n > 0).length
              return (
                <div className="bg-white rounded-2xl border border-[#f2f4f6] p-4 mb-3">
                  <div className="text-[13px] font-bold text-[#191f28] mb-1">✅ 확인 리스트 {left === 0 ? '— 다 끝났어요 🎉' : `(${left}가지)`}</div>
                  <div className="text-[11px] text-[#5f6b7a] mb-2">위에서부터 차례로 누르면 그 탭으로 갑니다.</div>
                  {todo.map((t, i) => (
                    <button key={i} onClick={() => t.n > 0 && goTab(t.tab)} disabled={t.n === 0}
                      className="w-full flex items-center gap-2 py-2 border-b border-[#f7f8fa] last:border-0 text-left">
                      <span className="text-[14px]">{t.n > 0 ? '☐' : '✅'}</span>
                      <span className={`text-[13px] flex-1 ${t.n > 0 ? 'text-[#191f28] font-semibold' : 'text-[#b0b8c1] line-through'}`}>{t.label}</span>
                      {t.n > 0 ? <span className="text-[12px] font-bold text-[#3182f6] shrink-0">{t.n}건 →</span> : <span className="text-[11px] text-[#b0b8c1] shrink-0">완료</span>}
                    </button>
                  ))}
                </div>
              )
            })()}
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              {stat('제출 인원 (확정)', m.totalPeople + '명', m.placeholderN > 0 ? `+ 미제출 ${m.placeholderN}명` : '중복 제외')}
              {stat('명단 기준 예상', m.expected + '명', `미제출 추정 ${m.missing}명 (어림수)`)}
              {stat('총 등록 금액', won(m.totalAmount))}
              {stat('미입금', m.unpaid.length + '명', '입금확인 안 된 인원')}
              {stat('방배정 필요', m.pool.length + '명', `미배정 ${m.unassigned.length}명`)}
              {stat('버스 신청', m.busList.length + '명')}
              {stat('설악산뷰', m.seoRooms.length + '개 방', `신청 ${m.seorakN}명 · 미배정 ${m.seoUnassigned.length}명`)}
              {stat('확인필요 그룹', m.checkGroups.length + '건', '명단>제출')}
              {stat('캠퍼스', Object.entries(m.byCampus).map(([k, v]) => `${k.replace(' 캠퍼스', '')} ${v}`).join(' / '))}
            </div>
            {(m.seoRooms.length > 0 || m.seoUnassigned.length > 0) && (
              <Collapsible title="🏔️ 설악산뷰 방 현황" count={`확정 ${m.seoRooms.length}개 방`}>
                <p className="text-[11px] text-[#5f6b7a] mb-2">설악산뷰는 인원보다 <b>방 수</b>가 중요합니다. 확정된 방과 아직 방이 안 정해진 인원을 함께 봅니다.</p>
                {m.seoRooms.map((rm, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[#f7f8fa] last:border-0">
                    <span className="text-[13px] font-bold text-[#191f28] shrink-0">{rm.label}</span>
                    <span className="text-[11px] text-[#5f6b7a] min-w-0">{rm.campus} · {rm.people.length}명 ({rm.people.join(', ')})</span>
                  </div>
                ))}
                {m.seoUnassigned.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#f2f4f6]">
                    <div className="text-[12px] font-bold text-[#b45309] mb-1">⚠ 미배정 {m.seoUnassigned.length}명 — 방 정하면 방 수가 늘어요</div>
                    <div className="text-[11px] text-[#5f6b7a] leading-relaxed">{m.seoUnassigned.map((r) => `${r.name}(${(r.campus || '').replace(' 캠퍼스', '')})`).join(', ')}</div>
                  </div>
                )}
              </Collapsible>
            )}
            {(() => {
              const vm = m.missingList.filter((x) => !dismissed.has(x.name))
              if (!vm.length && !dismissed.size) return null
              return (
                <Collapsible title="📋 미제출 추정 명단" count={`${vm.length}명`}>
                  <p className="text-[11px] text-[#5f6b7a] mb-2">명단에는 적혔으나 아직 본인 신청서가 없는 사람입니다. '미제출 추가'하면 방배정 대상이 되고, 이름이 아니거나 이미 제출된 사람은 '제외'하세요.{dismissed.size > 0 && <button onClick={clearDismissed} className="text-[#3182f6] font-semibold ml-1">제외 {dismissed.size}건 되돌리기</button>}</p>
                  {vm.map((x, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[#f7f8fa] last:border-0">
                      <span className="text-[13px] text-[#191f28] flex-1 min-w-0">{x.name}<span className="text-[10px] text-[#5f6b7a] ml-1">{x.from} 명단</span></span>
                      <button onClick={() => addPlaceholderName(x.name)} className="text-[11px] font-bold text-white bg-[#3182f6] rounded-lg px-2.5 py-1 shrink-0">미제출 추가</button>
                      <button onClick={() => dismissMissing(x.name)} className="text-[11px] font-bold text-[#5f6b7a] bg-[#f2f4f6] rounded-lg px-2.5 py-1 shrink-0">제외</button>
                    </div>
                  ))}
                  {!vm.length && <p className="text-[12px] text-[#5f6b7a] text-center py-2">모두 처리됨 ✓</p>}
                </Collapsible>
              )
            })()}
          </div>
        )}

        {tab === '정리안' && (() => {
          // 원본(구글폼) 전수 분류 — 운영자 확정 정리안(정적 스냅샷). 앱 자동 그룹과 별개의 기준.
          // 라이브 응답 데이터로 정리안 자동 생성 (route '중복' 제외, void/테스트는 이미 제외됨) — 항상 최신
          const _norm = (s) => (s || '').replace(/\s/g, '')
          const _key = (s) => (s || '').replace(/\s/g, '').replace(/[A-Za-z0-9]+$/, '') // 표시이름 접미사(A/B/숫자) 무시: 이사랑B↔이사랑
          const _josa = (s) => (s || '').replace(/(와|과|은|는|이|가|도|만|의|들|님|랑|하고)$/, '') // 문장형 명단의 조사 제거: 박은미와→박은미
          const _real = rows.filter((r) => r.route !== '중복')
          const _byG = {}; _real.forEach((r) => { (_byG[r.gid] = _byG[r.gid] || []).push(r) })
          const _roomShort = (l) => /소노캄/.test(l || '') ? '소노캄' : /소노벨\s?스위트/.test(l || '') ? '소노벨스위트' : '패밀리'
          const _occN = (o) => /나머지는 교회에서 배정|부분적으로/.test(o || '') ? '' : /7~8/.test(o || '') ? '7~8' : ((o || '').match(/(\d)인/) || [, ''])[1]
          const _G = [], _P = [], _indiv = []
          Object.keys(_byG).forEach((gid) => {
            const grp = _byG[gid]
            const rep = (grp.find((r) => (r.gtotal || 0) > 0) || grp[0]).rep || grp[0].name
            const repRow = grp.find((r) => r.name === rep) || grp[0]
            const members = grp.map((r) => r.name)
            const isPartial = grp.some((r) => /나머지는 교회에서 배정|부분적으로/.test(r.occLabel || ''))
            const hasGroupOcc = grp.some((r) => /인이 투숙/.test(r.occLabel || ''))
            const listNames = []; grp.forEach((r) => nameTokens(r.list).forEach((n) => { const t = _josa(n); if (t.length >= 2 && !listNames.includes(t)) listNames.push(t) }))
            const subSet = new Set(members.map(_key))
            const missing = listNames.filter((n) => !subSet.has(_key(n)))
            const noteM = (grp.map((r) => r.note || '').find((t) => /명단 \d+명/.test(t)) || '').match(/명단 (\d+)명/)
            const listN = Math.max(members.length + missing.length, noteM ? +noteM[1] : 0)
            const campus = (repRow.campus || '').replace(' 캠퍼스', '')
            const flags = (grp.some((r) => r.seorak) ? ' (설악)' : '') + (grp.some((r) => r.bus) ? ' (버스)' : '')
            const ocn = _occN(repRow.occLabel)
            const roomOcc = _roomShort(repRow.roomLabel) + (ocn ? '·' + ocn : '') + flags
            if (isPartial) {
              _P.push([rep, members.join('·') || rep, missing.length ? `+${missing.length}명 추가 예정` : '추가 배정 예정', campus])
            } else if (members.length >= 2 || hasGroupOcc || listN >= 2) {
              _G.push([rep, roomOcc, members.join('·'), missing.join('·'), campus, missing.length === 0 ? '전원' : `${members.length}/${listN}`])
            } else {
              _indiv.push(repRow)
            }
          })
          const _ib = (pred) => _indiv.filter(pred).map((r) => r.name)
          const _SOLO = [['버스+설악', _ib((r) => r.bus && r.seorak)], ['버스', _ib((r) => r.bus && !r.seorak)], ['자차', _ib((r) => !r.bus && !r.seorak)], ['설악만', _ib((r) => !r.bus && r.seorak)]]
            .filter((x) => x[1].length).map((x) => [`${x[0]} (${x[1].length})`, x[1].join(', ')])
          const _DUP = rows.filter((r) => r.route === '중복').map((r) => [r.name, r.note || '중복 재제출(집계 제외)'])
          const _DEC = [
            '1. cjkimhope 이메일에 3명(김창준·이은희·김윤하) 각자 개인 신청. 김윤하는 김연지 청년그룹 명단에도 있음 → 개인? 김연지 그룹?',
            '2. 김연지 그룹: 대표 김연지·전혜리 미제출, 청년 이한나는 임창은네 이한나B와 동명이인. 실제 제출=신원영·차윤선·차윤주·이한나.',
            '3. 성호민/석현수 청년: 대표 둘로 갈림 + 객실 소노벨스위트 vs 소노캄 불일치, 미제출 4명. 대표·객실 확정.',
            '4. 함보라/박혜영/선정희: 같은 7~8인 그룹? 객실 소노벨스위트(선정희) vs 소노캄 불일치. 대표 확정.',
            '5. 김태희+정나리련: 김태희 부분→7~8명 희망, 정나리련 6인 그룹. 같은 그룹인지 + 미제출 4명.',
            '6. 이혜란 그룹(8인): 7명 미제출 + "각 가족당 비용 따로" 문의 → 비용 분리 방침.',
            '7. 문옥진: 6인 그룹 선택했으나 명단 공란 → 개인으로 볼지.',
            '8. 전은혜 초등부 행 = 김지안 오기 추정. 확인.',
            '9. 이상미 그룹: 이상미·조이한·조요한은 구버전에만 존재(본인 재제출 없음), 이경미만 재제출 → 유효 처리?',
            '10. 성원준+성시우: 같은 이메일(부자 추정), 둘 다 개인 → 가족 2인으로 묶을지.',
            '11. 박윤정·김민선·안성일·김진명·김종명: 대표/일부만 제출, 명단 다수 미제출 → 미제출자 등록 받을지.',
            '12. 동명이인 표시이름 확정: 이한나A/B, 이사랑A/B, 김미선A/B, 김지민B, 김경민A.',
            '13. 오기 정정: 조영렬 캠퍼스(분당↔부산), 김혜진 연락처(=방호근), 문상철 연락처 자리수.',
          ]
          // AI 결과(버튼)가 있으면 그걸, 아니면 운영자 분석본(CURATED_SORT)을 기본으로 사용
          const isAi = !!(aiSort && aiSort.result && !aiOff)
          const aiR = isAi ? aiSort.result : CURATED_SORT
          const _aib = (pred) => (aiR ? aiR.individual || [] : []).filter(pred).map((p) => p.name)
          const G = aiR ? (aiR.groups || []).map((x) => [x.rep, (x.room || '') + (x.flags ? ` (${x.flags})` : ''), (x.members || []).join('·'), (x.missing || []).join('·'), x.campus || '', x.status || '전원']) : _G
          const P = aiR ? (aiR.partial || []).map((x) => [x.rep, (x.members || []).join('·') || x.rep, x.desc || '추가 배정 예정', x.campus || '']) : _P
          const SOLO = aiR ? [['버스+설악', _aib((p) => p.bus && p.seorak)], ['버스', _aib((p) => p.bus && !p.seorak)], ['자차', _aib((p) => !p.bus && !p.seorak)], ['설악만', _aib((p) => !p.bus && p.seorak)]].filter((x) => x[1].length).map((x) => [`${x[0]} (${x[1].length})`, x[1].join(', ')]) : _SOLO
          const DUP = aiR ? (aiR.duplicates || []).map((x) => [x.name, x.reason || '']) : _DUP
          const DEC = aiR ? (aiR.decisions || []) : _DEC
          const indivLen = aiR ? (aiR.individual || []).length : _indiv.length
          const statusCls = (s) => s === '전원' ? 'bg-[#12b886]' : /^\d+\/\d+$/.test(s) ? 'bg-[#f59f00]' : 'bg-[#f04452]'
          const gPeople = (g) => g[2].split('·').filter(Boolean).length + (g[3] ? g[3].split('·').filter(Boolean).length : 0) // 명단+미제출 인원
          return (
            <div>
              <HelpToggle>{`운영자가 전체 신청 데이터를 직접 분석해 정리한 화면입니다. (스냅샷 · 새 신청은 미반영 → 데이터 주시면 갱신, 또는 '🤖 AI 정리안 갱신')
• 그룹 = 비용 함께 내는 묶음. 초록 '전원'=명단 전원 제출, 주황 'N/M'=일부 미제출.
• 부분그룹 = "다른 성도와 같은 방" 요청(추가 배정 예정).
• 개인 = 교회 배정 단독.
• ⚠ 의사결정 = 교회만 아는 정보(누가 한 가족인지 등) 확인 필요 항목 — 이 부분은 수기로 관리합니다.
※ 미제출 = 명단엔 있으나 본인 신청서 없는 사람. 명단 글자가 이름과 달라(예: 이한나B) 미제출로 보일 수 있어요.`}</HelpToggle>
              <div className="bg-white border border-[#f2f4f6] rounded-xl px-3 py-2.5 mb-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-bold text-[#191f28]">{isAi ? '🤖 AI 정리안' : '📋 정리안 (운영자 분석)'}<span className="text-[11px] font-normal text-[#5f6b7a] ml-1">{isAi ? `· ${aiSort.at} 분석` : `· ${CURATED_SORT.at}`}</span></span>
                  <button onClick={runAiSort} disabled={aiBusy} className={`text-[11px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap ${aiBusy ? 'bg-[#e5e8eb] text-[#b0b8c1]' : 'bg-[#1b64da] text-white'}`}>{aiBusy ? 'AI 분석 중…' : '🤖 AI 정리안 갱신'}</button>
                </div>
                {aiMsg && <p className="text-[11px] text-[#1b64da] font-semibold mt-1.5">{aiMsg}</p>}
                <div className="flex items-center gap-2 mt-1.5 text-[12px] text-[#1b64da]">
                  <span>그룹 {G.length} · 부분 {P.length} · 개인 {indivLen} · 중복 {DUP.length}</span>
                  {aiSort && aiSort.result && <button onClick={() => setAiOff((v) => !v)} className="ml-auto text-[11px] font-bold text-[#5f6b7a] underline">{aiOff ? 'AI 결과 보기' : '운영자 정리안 보기'}</button>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {stat('그룹', G.length + '개')}
                {stat('부분그룹', P.length + '개')}
                {stat('개인', indivLen + '명')}
              </div>
              <Collapsible title="① 그룹 (가족·예약그룹)" count={`${G.length}개`} defaultOpen>
                <div className="flex gap-2 mb-2">
                  <button onClick={() => setOnlyProblem(false)} className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg ${!onlyProblem ? 'bg-[#191f28] text-white' : 'bg-[#f2f4f6] text-[#5f6b7a]'}`}>전체 {G.length}</button>
                  <button onClick={() => setOnlyProblem(true)} className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg ${onlyProblem ? 'bg-[#191f28] text-white' : 'bg-[#f2f4f6] text-[#5f6b7a]'}`}>문제만 {G.filter((g) => g[5] !== '전원').length}</button>
                </div>
                <div className="flex gap-1.5 mb-2 items-center">
                  <span className="text-[11px] text-[#9ca3af] font-bold mr-0.5">정렬</span>
                  {[['time', '접수순'], ['name', 'ㄱㄴㄷ순'], ['size', '인원순']].map(([v, lbl]) => (
                    <button key={v} onClick={() => setGSort(v)} className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg ${gSort === v ? 'bg-[#1b64da] text-white' : 'bg-[#f2f4f6] text-[#5f6b7a]'}`}>{lbl}</button>
                  ))}
                </div>
                {G.map((g, idx) => ({ g, idx }))
                  .filter(({ g }) => !onlyProblem || g[5] !== '전원')
                  .sort((a, b) => gSort === 'name' ? a.g[0].localeCompare(b.g[0], 'ko') : gSort === 'size' ? gPeople(b.g) - gPeople(a.g) : a.idx - b.idx)
                  .map(({ g }, i) => {
                  const tone = g[5] === '전원' ? 'done' : /^\d+\/\d+$/.test(g[5]) ? 'prog' : 'prob'
                  const mem = g[2].split('·'); const miss = g[3] ? g[3].split('·') : []
                  return (
                    <div key={i} className="py-2 border-b border-[#f7f8fa] last:border-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-[13px] font-bold text-[#191f28]">{g[0]}</span>
                        <span className="text-[11px] text-[#5f6b7a]">{g[1]} · {g[4]}</span>
                        <Badge tone={tone}>{g[5]}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {mem.map((nm, j) => <span key={j} className="text-[11px] bg-[#eef0f3] text-[#4e5968] rounded px-1.5 py-0.5">{nm}</span>)}
                        {miss.map((nm, j) => <span key={'x' + j} className="text-[11px] bg-[#fde7ea] text-[#dc2626] rounded px-1.5 py-0.5">{nm} 미제출</span>)}
                      </div>
                    </div>
                  )
                })}
              </Collapsible>
              <Collapsible title="② 부분그룹 (추가 배정 예정)" count={`${P.length}개`}>
                {P.map((g, i) => (
                  <div key={i} className="py-2 border-b border-[#f7f8fa] last:border-0">
                    <span className="text-[13px] font-bold text-[#191f28]">{g[0]}</span>
                    <span className="text-[11px] text-[#5f6b7a] ml-1">{g[3]}</span>
                    <div className="text-[12px] text-[#4e5968] mt-0.5">{g[1]} <span className="text-[11px] text-[#1b64da]">— {g[2]}</span></div>
                  </div>
                ))}
              </Collapsible>
              <Collapsible title="③ 개인 (교회 배정)" count={`${indivLen}명`}>
                {SOLO.map((s, i) => (
                  <div key={i} className="py-1.5 border-b border-[#f7f8fa] last:border-0">
                    <span className="text-[12px] font-bold text-[#191f28]">{s[0]}</span>
                    <div className="text-[12px] text-[#4e5968]">{s[1]}</div>
                  </div>
                ))}
              </Collapsible>
              <Collapsible title="④ 중복 (집계 제외)" count={`${DUP.length}건`}>
                {DUP.map((d, i) => (
                  <div key={i} className="text-[12px] text-[#4e5968] py-0.5">{d[0]} <span className="text-[11px] text-[#5f6b7a]">— {d[1]}</span></div>
                ))}
              </Collapsible>
              <Collapsible title="⑤ ⚠ 의사결정 필요" count={`${DEC.length}건`} defaultOpen>
                {DEC.map((d, i) => (
                  <div key={i} className="text-[12px] text-[#4e5968] py-1.5 border-b border-[#f7f8fa] last:border-0 leading-relaxed">{d}</div>
                ))}
              </Collapsible>
            </div>
          )
        })()}

        {tab === '요청조합' && (() => {
          const { clusters } = reqCombine
          return (
            <div>
              <HelpToggle>{`성도들이 명단·문의에 적은 "○○랑 같은 방 해주세요" 요청을 자동으로 모았습니다.

• 카드 = 같은 방 후보 한 묶음
• 🔴 = 먼저 풀어야 함(남녀 혼방·정원 초과·이미 다른 그룹 등) → 묶기 버튼 잠김
• 🟡 = 확인 후 묶기(동명이인·미등록자 등)
• 🟢/✅ = 바로 묶기 가능 / 이미 같은 방

• ➕ '빈자리'가 뜨면 같은 성별·캠퍼스 미배정자를 추천해줍니다 → 확인 후 추가(조건 안 맞으면 조정 제안).

⚠ 여기서 '묶기'는 같은 방 번호만 붙입니다. 비용은 각자 그대로예요(가족처럼 돈도 합치려면 '그룹정리' 탭).
이름이 아닌 단어가 잡히면 옆 '제외'를 누르세요.`}</HelpToggle>
              <div className="bg-white rounded-2xl border border-[#f2f4f6] p-4 mb-3">
                <p className="text-[12px] text-[#4e5968] leading-relaxed">
                  부분그룹·"○○와 같은 방" 요청을 모아 방으로 묶습니다. 🔴는 해소 후, 🟡는 확인 후 묶으세요.
                  <b className="text-[#191f28]"> 방만 같이 쓰고 비용은 각자</b>라서, 그룹 합치기가 아니라 <b>배정방만</b> 지정됩니다.
                </p>
                {saveMsg && <p className="text-[12px] text-[#1b64da] font-semibold mt-2">{saveMsg}</p>}
              </div>
              {!clusters.length && <p className="text-[13px] text-[#5f6b7a] text-center py-10">처리할 방배정 요청이 없습니다.</p>}
              {[...clusters].sort((a, b) => (a.done ? 3 : a.block ? 0 : a.conflicts.length ? 1 : 2) - (b.done ? 3 : b.block ? 0 : b.conflicts.length ? 1 : 2)).map((c, i) => (
                <div key={i} className={`rounded-2xl border p-4 mb-2.5 ${c.done ? 'border-[#e5e8eb] bg-[#f9fafb]' : c.block ? 'border-[#f04452] bg-[#fff5f5]' : c.conflicts.length ? 'border-[#f59e0b] bg-[#fffbeb]' : 'border-[#e5e8eb] bg-white'}`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Badge tone={c.done ? 'done' : c.block ? 'prob' : c.conflicts.length ? 'prog' : 'done'}>{c.done ? '배정됨' : c.block ? '해소 필요' : c.conflicts.length ? '확인 필요' : '묶기 가능'}</Badge>
                      <span className="text-[13px] font-bold text-[#191f28] truncate">{c.members.map((p) => p.name).join(', ')}</span>
                    </div>
                    <span className={`text-[12px] font-bold shrink-0 ${c.members.length > c.cap ? 'text-[#f04452]' : 'text-[#5f6b7a]'}`}>{roomTypeShort(c.roomType)} {c.members.length}/{c.cap}</span>
                  </div>
                  {c.done && <div className="text-[11px] text-[#1b64da] mb-1.5">이미 같은 방: {c.room}</div>}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {c.members.map((p) => (
                      <span key={p.row} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-bold border border-[#e5e8eb] bg-white">
                        {p.name}<span className="text-[10px] text-[#5f6b7a] font-normal">{(p.campus || '').replace(' 캠퍼스', '').slice(0, 2)}·{p.gender}·{deptName(p.deptLabel)}</span>
                        {p.assigned && <span className="text-[9px] text-[#1b64da] font-normal">📍{p.assigned}</span>}
                      </span>
                    ))}
                  </div>
                  {c.members.filter((p) => p.list || p.inquiry).length > 0 && (
                    <details className="mb-1">
                      <summary className="text-[11px] text-[#5f6b7a] cursor-pointer select-none">📝 원문 메모 보기</summary>
                      {c.members.filter((p) => p.list || p.inquiry).map((p) => (
                        <div key={'m' + p.row} className="text-[11px] text-[#5f6b7a] leading-snug mb-0.5 mt-1">{p.name}: {p.list || p.inquiry}</div>
                      ))}
                    </details>
                  )}
                  {c.conflicts.map((cf, j) => (
                    <div key={j} className={`text-[12px] font-semibold mt-1 ${cf.lv === 'block' ? 'text-[#f04452]' : cf.lv === 'check' ? 'text-[#b45309]' : 'text-[#5f6b7a]'}`}>
                      {cf.lv === 'block' ? '🔴' : cf.lv === 'check' ? '🟡' : '⚪'} {cf.msg}
                      {cf.names && cf.names.map((nm) => (
                        <span key={nm} className="inline-flex items-center gap-0.5 ml-1">
                          <button onClick={() => addPlaceholderName(nm)} className="text-[11px] text-white bg-[#f04452] rounded px-1.5 py-0.5">+ {nm} 추가</button>
                          <button onClick={() => dismissMissing(nm)} className="text-[11px] text-[#5f6b7a] bg-[#f2f4f6] rounded px-1.5 py-0.5">제외</button>
                        </span>
                      ))}
                    </div>
                  ))}
                  {c.wantsMore && (
                    <div className="mt-2 pt-2 border-t border-[#eef0f2]">
                      <div className="text-[12px] font-bold text-[#1b64da] mb-1">➕ 빈자리 {c.openSlots}석 — 같은 방에 더 넣을 수 있어요</div>
                      {c.fillCandidates && c.fillCandidates.length > 0 ? (
                        <>
                          <div className="text-[11px] text-[#4e5968] mb-1.5">추천(같은 성별·캠퍼스·미배정): {c.fillCandidates.map((p) => `${p.name}(${deptName(p.deptLabel)})`).join(', ')}{c.fillMore > c.fillCandidates.length ? ` · 후보 ${c.fillMore}명 중` : ''}</div>
                          <button onClick={() => ask('이 방에 추가할까요?', `${c.fillCandidates.map((p) => p.name).join(', ')}님을 '${c.fillRoom}' 방에 같이 배정합니다.\n(방만 같이 쓰고 비용은 각자입니다)`, () => assignRoom([...c.members.map((p) => p.row), ...c.fillCandidates.map((p) => p.row)], c.fillRoom), '추가')}
                            className="text-[12px] font-bold text-[#1b64da] bg-white border border-[#1b64da] rounded-lg px-3 py-1.5">추천 {c.fillCandidates.length}명 이 방에 추가</button>
                        </>
                      ) : (
                        <div className="text-[11px] text-[#5f6b7a]">조정 제안: 조건(같은 성별·캠퍼스) 맞는 미배정자가 없어요. → 객실을 {c.members.length}인으로 줄이거나, 빈자리로 두거나, 다른 부분그룹과 합치세요.</div>
                      )}
                    </div>
                  )}
                  <button onClick={() => assignRoom(c.members.map((p) => p.row), c.label)} disabled={c.block || c.done}
                    className={`w-full mt-3 py-2.5 rounded-xl font-bold text-[13px] ${c.block || c.done ? 'bg-[#e5e8eb] text-[#5f6b7a]' : 'bg-[#3182f6] text-white'}`}>
                    {c.block ? '충돌 해소 후 묶기 가능' : c.done ? '✓ 이미 같은 방으로 배정됨' : `이 방 같이 쓰기 (비용은 각자) → ${c.label}`}
                  </button>
                </div>
              ))}
            </div>
          )
        })()}

        {tab === '방배정' && (() => {
          const roomMap = {}; m.pool.forEach((p) => { const l = eff(p); if (l) (roomMap[l] = roomMap[l] || []).push(p) })
          extraRooms.forEach((l) => { if (!roomMap[l]) roomMap[l] = [] })
          const roomLabels = Object.keys(roomMap).sort()
          const unassigned = m.pool.filter((p) => !eff(p))
          const reqCheck = unassigned.filter((p) => p.list)   // 메모 있는 사람(수동 확인)
          const plain = unassigned.filter((p) => !p.list)
          // 이미 구성된 그룹(N인 투숙) = 읽기 전용 (재계산된 클러스터 기준)
          // 예약그룹: 멤버 중 N인 투숙이 하나라도 있는 그룹 → 그 그룹 전원(개인배정 멤버 포함, 중복 제외)을 함께 표시
          const bookedGids = new Set(rows.filter((r) => r.route !== '중복' && !isChurchAssigned(r.occLabel)).map((r) => r.gid))
          const bookedGroups = {}; rows.forEach((r) => { if (r.route !== '중복' && bookedGids.has(r.gid)) (bookedGroups[r.gid] = bookedGroups[r.gid] || []).push(r) })
          const bookedList = Object.entries(bookedGroups).map(([gid, mem]) => [gid, mem, mem[0].rep])
          return (
            <div>
              <HelpToggle>{`교회가 방을 정해줘야 하는 사람(개인·부분 신청)을 방에 배치하는 화면입니다.

• [자동 배치]: 요청을 안 적은 사람만 캠퍼스·객실 종류별로 방에 자동으로 채웁니다.
• "○○랑 같이"처럼 글을 남긴 사람은 자동배치에서 빠지고 '🔎 배정 요청 확인'에 모입니다 → 직접 칸으로 끌어다 놓으세요(모바일은 길게 누른 뒤 드래그).
• 다 옮겼으면 꼭 [저장]을 눌러야 시트에 반영됩니다.
• '이미 구성된 가족·그룹'은 따로 방 안 정해도 됩니다(참고용).`}</HelpToggle>
              <div className="bg-white rounded-2xl border border-[#f2f4f6] p-4 mb-3">
                <p className="text-[12px] text-[#4e5968] leading-relaxed mb-3">
                  교회 배정 대상 <b>{m.pool.length}명</b>. <b>자동 배치</b>는 <u>메모 없는</u> 사람만 캠퍼스·신청 객실옵션별 정원(패밀리 6 / 스위트·소노캄 8)에 맞춰 채웁니다. 메모 있는 사람은 아래 "배정 요청 확인"에 따로 두니 직접 드래그하세요.
                </p>
                <div className="flex gap-2">
                  <button onClick={autoAssign} className="flex-1 py-3 rounded-xl bg-white border border-[#3182f6] text-[#3182f6] font-bold text-[13px]">자동 배치</button>
                  <select value="" onChange={(e) => { if (e.target.value) addRoom(e.target.value) }} className="px-2 py-3 rounded-xl bg-[#f2f4f6] text-[#4e5968] font-bold text-[12px] border-0">
                    <option value="">+ 방 추가 ▾</option>
                    <option value="소노벨 패밀리">+ 패밀리 방</option>
                    <option value="소노벨 스위트">+ 소노벨 스위트 방</option>
                    <option value="소노캄 스위트">+ 소노캄 스위트 방</option>
                  </select>
                  <button onClick={saveAssign} disabled={!Object.keys(assignDraft).length} className={`flex-1 py-3 rounded-xl font-bold text-[13px] ${Object.keys(assignDraft).length ? 'bg-[#191f28] text-white' : 'bg-[#e5e8eb] text-[#b0b8c1]'}`}>저장{Object.keys(assignDraft).length ? ` (${Object.keys(assignDraft).length})` : ''}</button>
                </div>
                {saveMsg && <p className="text-[12px] text-[#1b64da] font-semibold mt-2">{saveMsg}</p>}
                <div className="mt-3 pt-3 border-t border-[#f2f4f6]">
                  <div className="text-[12px] text-[#4e5968] mb-2">같은 그룹(가족)인데 방이 따로면, <b>그룹대로 방 이름을 한 번에 통일</b>합니다. (개인 1명은 안 건드림)</div>
                  <button onClick={syncAllRooms} className="w-full py-2.5 rounded-xl bg-[#f2f4f6] text-[#4e5968] font-bold text-[13px] border border-[#e5e8eb]">🛏️ 그룹 기준으로 방 맞추기</button>
                  {mergeMsg && <p className="text-[12px] text-[#1b64da] font-semibold mt-2">{mergeMsg}</p>}
                </div>
                <div className="mt-3 pt-3 border-t border-[#f2f4f6]">
                  <div className="text-[12px] font-bold text-[#191f28] mb-2">미제출 인원 추가 (이름만, 방배정용)</div>
                  <div className="flex gap-2">
                    <input value={ph.name} onChange={(e) => setPh({ ...ph, name: e.target.value })} placeholder="이름" className="flex-1 bg-[#f9fafb] border border-[#e5e8eb] rounded-xl px-3 py-2 text-[13px]" />
                    <select value={ph.dept} onChange={(e) => setPh({ ...ph, dept: e.target.value })} className="bg-[#f9fafb] border border-[#e5e8eb] rounded-xl px-2 py-2 text-[12px]">
                      <option value="">부서?</option>
                      {DEPTS.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                    </select>
                    <button onClick={addPlaceholder} className="px-3 py-2 rounded-xl bg-[#4e5968] text-white font-bold text-[12px] whitespace-nowrap">+ 미제출</button>
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
                      <span className="text-[11px] text-[#5f6b7a]">떨어진 그룹 체크 → 합치기</span>
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
                            <span className="text-[12px] font-bold text-[#191f28]">{rep || mem[0].name} 그룹 <span className="text-[11px] font-normal text-[#5f6b7a]">· {roomTypeShort(type)} {mem.length}/{cap}명</span></span>
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
                {(() => {
                  const DORD = DEPTS.map((d) => d.name)
                  let pv = poolRoomFilter === 'all' ? plain : plain.filter((p) => reqRoomType(p.roomLabel) === poolRoomFilter)
                  pv = [...pv].sort((a, b) => poolSort === 'dept' ? ((DORD.indexOf(deptName(a.deptLabel)) - DORD.indexOf(deptName(b.deptLabel))) || a.name.localeCompare(b.name, 'ko')) : a.name.localeCompare(b.name, 'ko'))
                  const fcss = (on) => `text-[11px] font-bold px-2 py-1 rounded-lg ${on ? 'bg-[#1b64da] text-white' : 'bg-[#f2f4f6] text-[#5f6b7a]'}`
                  return (
                    <RoomDrop id="__pool__" title="미배정" count={plain.length}>
                      <div className="flex flex-wrap items-center gap-1.5 mb-2 w-full">
                        <span className="text-[11px] text-[#9ca3af] font-bold">정렬</span>
                        <button onClick={() => setPoolSort('name')} className={fcss(poolSort === 'name')}>ㄱㄴㄷ</button>
                        <button onClick={() => setPoolSort('dept')} className={fcss(poolSort === 'dept')}>부서순</button>
                        <span className="text-[11px] text-[#9ca3af] font-bold ml-1">객실</span>
                        {[['all', '전체'], ['소노벨 패밀리', '패밀리'], ['소노벨 스위트', '스위트'], ['소노캄 스위트', '소노캄']].map(([v, l]) => <button key={v} onClick={() => setPoolRoomFilter(v)} className={fcss(poolRoomFilter === v)}>{l}</button>)}
                      </div>
                      {['남', '여', '기타'].map((g) => { const list = pv.filter((p) => (p.gender || '기타') === g); if (!list.length) return null; return (
                        <div key={g} className="w-full mb-1.5">
                          <div className={`text-[11px] font-bold mb-1 ${g === '남' ? 'text-[#1b64da]' : g === '여' ? 'text-[#e0407a]' : 'text-[#5f6b7a]'}`}>{g === '기타' ? '성별미상' : g} {list.length}명</div>
                          <div className="flex flex-wrap gap-1.5">{list.map((p) => <PersonChip key={p.row} p={p} />)}</div>
                        </div>
                      ) })}
                      {!pv.length && <p className="text-[12px] text-[#5f6b7a]">해당 조건의 미배정 인원이 없습니다.</p>}
                    </RoomDrop>
                  )
                })()}
                {roomLabels.map((lab) => {
                  const mem = roomMap[lab]
                  const type = (/소노캄/.test(lab) ? '소노캄 스위트' : /스위트/.test(lab) ? '소노벨 스위트' : /패밀리/.test(lab) ? '소노벨 패밀리' : null) || roomTypeOfMembers(mem)
                  const cap = ROOM_CAP[type]
                  // 씨앗 방: 부분그룹(다른 성도와 함께 배정 요청)이 든 방 → '추가 배정 필요' 표시 + 남은 자리
                  const seed = mem.some((p) => /나머지는 교회에서 배정|부분적으로/.test(p.occLabel || ''))
                  const sub = roomTypeShort(type) + (seed ? ` · 🟡 부분·추가 ${Math.max(0, cap - mem.length)}자리` : '')
                  return (
                    <RoomDrop key={lab} id={lab} title={lab} sub={sub} count={mem.length} cap={cap} danger={mem.length > cap} onDelete={() => removeRoom(lab)}>
                      {mem.map((p) => <PersonChip key={p.row} p={p} warn={!seed && reqRoomType(p.roomLabel) !== type} />)}
                    </RoomDrop>
                  )
                })}
              </DndContext>
              <p className="text-[11px] text-[#b0b8c1] text-center mt-1">칩을 길게 눌러 방으로 끌어다 놓으세요. ⚠️=신청 옵션과 다른 방. "저장"을 눌러야 반영됩니다.</p>
            </div>
          )
        })()}

        {tab === '그룹정리' && (() => {
          const live = rows.filter((r) => r.route !== '중복')
          const groups = {}; live.forEach((r) => { (groups[r.gid] = groups[r.gid] || []).push(r) })
          const gidList = Object.keys(groups)
          const repOf = (g) => (g.find((r) => (r.groupTotal || 0) > 0) || g[0]).rep || g[0].name
          const labelOf = (gid) => `${repOf(groups[gid])} 그룹 (${groups[gid].length})`
          const minRow = (gid) => Math.min.apply(null, groups[gid].map((p) => p.row || 1e9))
          const gidSorted = gidList.slice().sort((a, b) => liveSort === 'name' ? repOf(groups[a]).localeCompare(repOf(groups[b]), 'ko') : liveSort === 'size' ? groups[b].length - groups[a].length : minRow(a) - minRow(b))
          const pk = (s) => { let d = String(s || '').replace(/\D/g, ''); if (d.length === 10 && d.charAt(0) === '1') d = '0' + d; return d }
          // S1: 같은 전화번호인데 그룹이 여러 개
          const phoneG = {}; live.forEach((r) => { const p = pk(r.contact); if (p) { (phoneG[p] = phoneG[p] || {}); phoneG[p][r.gid] = true } })
          const s1 = Object.keys(phoneG).filter((p) => Object.keys(phoneG[p]).length > 1).map((p) => ({ phone: p, gids: Object.keys(phoneG[p]) }))
          // S3: 명단>제출(확인필요)
          const s3 = gidList.filter((gid) => groups[gid].some((r) => r.check === 'Y'))
          const selN = Object.keys(mergeSel).filter((g) => mergeSel[g]).length
          const roomOutOfSync = gidList.filter((gid) => groups[gid].length >= 2)
            .filter((gid) => { const lbl = `${repOf(groups[gid])} 방`; return groups[gid].some((r) => (r.assigned || '') !== lbl) })
          return (
            <div>
              <HelpToggle>{`그룹 = 비용을 함께 내는 단위(가족 등)입니다. 잘못 나뉘거나 합쳐진 그룹을 바로잡습니다.

• '의심 목록': 같은 번호인데 따로 묶인 그룹 등을 자동으로 찾아줍니다 → '합치기'.
• '이름으로 이동': 사람을 다른 그룹으로 옮기거나 혼자로 분리.
• '그룹 기준으로 방 맞추기': 그룹대로 방 이름을 통일(예전에 합쳐 방이 안 따라온 경우).

⚠ 여기서 '합치기/이동'을 하면 비용이 다시 계산됩니다(누르면 확인창이 떠요). 단순히 같은 방만 쓰는 건 '같은 방 요청' 탭에서 하세요.`}</HelpToggle>
              <div className="bg-white rounded-2xl border border-[#f2f4f6] p-4 mb-3">
                <p className="text-[12px] text-[#4e5968] leading-relaxed">잘못 묶이거나 따로 떨어진 그룹을 정리합니다. <b>의심 목록</b>에서 합치고, 아래 그룹에서 사람을 <b>다른 그룹으로 이동</b>하거나 <b>단독 분리</b>하세요.</p>
                {mergeMsg && <p className="text-[12px] text-[#1b64da] font-semibold mt-2">{mergeMsg}</p>}
              </div>

              <Collapsible title="⚠ 확인이 필요해요 (의심 목록)" count={`${s1.length + s3.length}건`} defaultOpen>
                {s1.length === 0 && s3.length === 0 && <p className="text-[12px] text-[#5f6b7a]">의심 항목 없음</p>}
                {s1.map((s, i) => (
                  <div key={'s1' + i} className="py-2 border-b border-[#f7f8fa]">
                    <div className="text-[12px] font-bold text-[#191f28] mb-1">📞 같은 번호인데 {s.gids.length}개 그룹으로 나뉨</div>
                    <div className="text-[11px] text-[#5f6b7a] mb-1">{s.gids.map((g) => labelOf(g)).join(' / ')}</div>
                    <button onClick={() => ask('이 그룹들을 합칠까요?', `같은 번호로 묶인 ${s.gids.length}개 그룹을 한 그룹으로 합칩니다.\n⚠ 비용이 다시 계산됩니다.`, () => { setMergeMsg('합치는 중…'); post({ action: 'mergeGroups', pin, gids: s.gids }).then((j) => { setMergeMsg(j.ok ? `✓ ${j.merged}명 합침` : '오류'); reload() }) }, '합치기')}
                      className="text-[12px] font-bold text-white bg-[#191f28] rounded-lg px-3 py-1.5">이 그룹들 합치기</button>
                  </div>
                ))}
                {s3.map((gid) => (
                  <div key={'s3' + gid} className="py-2 border-b border-[#f7f8fa] last:border-0">
                    <div className="text-[12px] font-bold text-[#191f28]">📝 {repOf(groups[gid])} 그룹 · 명단보다 제출 적음</div>
                    <div className="text-[11px] text-[#5f6b7a]">{(groups[gid].find((r) => r.note) || {}).note || '명단에 미제출자 있음 — 미제출 추가/확인'}</div>
                  </div>
                ))}
              </Collapsible>

              {/* 그룹 기준 방 일괄 맞춤 */}
              <div className="bg-white rounded-2xl border border-[#f2f4f6] p-4 mb-3">
                <div className="text-[13px] font-bold text-[#191f28] mb-1">🛏️ 그룹 기준으로 방 맞추기</div>
                <div className="text-[11px] text-[#5f6b7a] mb-2">예전에 합치거나 시트에서 직접 수정한 그룹은 방이 안 따라왔을 수 있어요. 지금 묶인 그룹대로 배정방(=대표 방)을 한 번에 맞춥니다. (개인 1명은 안 건드림)</div>
                <button onClick={syncAllRooms} disabled={!roomOutOfSync.length}
                  className={`w-full py-2.5 rounded-xl font-bold text-[13px] ${roomOutOfSync.length ? 'bg-[#191f28] text-white' : 'bg-[#f2f4f6] text-[#b0b8c1]'}`}>
                  {roomOutOfSync.length ? `방 안 맞는 ${roomOutOfSync.length}개 그룹 일괄 정렬` : '모든 그룹이 방과 동기화됨 ✓'}
                </button>
              </div>

              {/* 이름 검색 → 대상 그룹도 이름 검색 → 이동 */}
              <div className="bg-white rounded-2xl border border-[#f2f4f6] p-4 mb-3">
                <div className="text-[13px] font-bold text-[#191f28] mb-1">🔎 이름으로 이동</div>
                <div className="text-[11px] text-[#5f6b7a] mb-2">그룹을 옮기거나 합치면 방 배정도 자동으로 같이 맞춰집니다.</div>
                {!movePick ? (
                  <>
                    <div className="text-[11px] text-[#5f6b7a] mb-1.5">① 옮길 사람을 검색해 선택하세요</div>
                    <input value={moveQ} onChange={(e) => setMoveQ(e.target.value)} placeholder="옮길 사람 이름 검색" className="w-full bg-[#f9fafb] border border-[#e5e8eb] rounded-xl px-3 py-2.5 text-[14px] mb-2" />
                    {moveQ.trim() && (() => {
                      const matches = live.filter((r) => r.name.indexOf(moveQ.trim()) >= 0).slice(0, 12)
                      if (!matches.length) return <p className="text-[12px] text-[#5f6b7a]">일치하는 이름 없음</p>
                      return matches.map((p) => (
                        <button key={p.row} onClick={() => { setMovePick(p); setMoveTargetQ('') }}
                          className="w-full flex items-center gap-2 py-1.5 border-b border-[#f7f8fa] last:border-0 text-left">
                          <span className="text-[13px] text-[#191f28] flex-1 min-w-0">{p.name}<span className="text-[10px] text-[#5f6b7a] ml-1">현재: {repOf(groups[p.gid] || [p])} 그룹 · {deptName(p.deptLabel)}</span></span>
                          <span className="text-[12px] font-bold text-[#3182f6] shrink-0">선택 →</span>
                        </button>
                      ))
                    })()}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2 bg-[#eef5ff] rounded-xl px-3 py-2">
                      <span className="text-[13px] text-[#191f28] flex-1 min-w-0"><b>{movePick.name}</b><span className="text-[10px] text-[#5f6b7a] ml-1">현재: {repOf(groups[movePick.gid] || [movePick]) } 그룹</span></span>
                      <button onClick={() => { setMovePick(null); setMoveQ(''); setMoveTargetQ('') }} className="text-[11px] text-[#5f6b7a] underline shrink-0">다른 사람</button>
                    </div>
                    <div className="text-[11px] text-[#5f6b7a] mb-1.5">② 옮길 그룹을 검색하세요 (그 그룹 사람 이름)</div>
                    <input value={moveTargetQ} onChange={(e) => setMoveTargetQ(e.target.value)} placeholder="대상 그룹의 아무 구성원 이름" className="w-full bg-[#f9fafb] border border-[#e5e8eb] rounded-xl px-3 py-2.5 text-[14px] mb-2" />
                    <button onClick={() => { moveMember(movePick.name, '__solo__'); setMovePick(null); setMoveQ(''); setMoveTargetQ('') }}
                      className="w-full text-[12px] text-[#4e5968] bg-[#f2f4f6] rounded-lg py-2 mb-2">{movePick.name}님 단독으로 분리</button>
                    {moveTargetQ.trim() && (() => {
                      const hit = live.filter((r) => r.name.indexOf(moveTargetQ.trim()) >= 0 && r.gid !== movePick.gid)
                      const seen = {}; const tgts = []
                      hit.forEach((r) => { if (!seen[r.gid]) { seen[r.gid] = true; tgts.push(r.gid) } })
                      if (!tgts.length) return <p className="text-[12px] text-[#5f6b7a]">일치하는 그룹 없음</p>
                      return tgts.slice(0, 12).map((g) => (
                        <button key={g} onClick={() => { moveMember(movePick.name, g, labelOf(g)); setMovePick(null); setMoveQ(''); setMoveTargetQ('') }}
                          className="w-full flex items-center gap-2 py-1.5 border-b border-[#f7f8fa] last:border-0 text-left">
                          <span className="text-[13px] text-[#191f28] flex-1 min-w-0">{labelOf(g)}<span className="text-[10px] text-[#5f6b7a] ml-1">{(groups[g] || []).length}명</span></span>
                          <span className="text-[12px] font-bold text-[#3182f6] shrink-0">여기로 이동 →</span>
                        </button>
                      ))
                    })()}
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-[#5f6b7a]">합칠 그룹 체크</span>
                <button onClick={mergeSelected} disabled={selN < 2} className={`ml-auto text-[12px] font-bold px-3 py-1.5 rounded-lg ${selN >= 2 ? 'bg-[#191f28] text-white' : 'bg-[#e5e8eb] text-[#b0b8c1]'}`}>선택 {selN}그룹 합치기</button>
              </div>

              <Collapsible title={`전체 그룹 목록 (${gidList.length}그룹)`}>
              <div className="flex gap-1.5 mb-2 items-center">
                <span className="text-[11px] text-[#9ca3af] font-bold mr-0.5">정렬</span>
                {[['time', '시간순'], ['name', 'ㄱㄴㄷ순'], ['size', '인원순']].map(([v, lbl]) => (
                  <button key={v} onClick={() => setLiveSort(v)} className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg ${liveSort === v ? 'bg-[#1b64da] text-white' : 'bg-[#f2f4f6] text-[#5f6b7a]'}`}>{lbl}</button>
                ))}
              </div>
              {gidSorted.map((gid) => (
                <div key={gid} className="bg-white rounded-2xl border border-[#f2f4f6] p-3 mb-2">
                  <label className="flex items-center gap-1.5 mb-2 cursor-pointer">
                    <input type="checkbox" checked={!!mergeSel[gid]} onChange={() => toggleMerge(gid)} className="w-4 h-4" />
                    <span className="text-[13px] font-bold text-[#191f28]">{labelOf(gid)}</span>
                  </label>
                  {groups[gid].map((p) => (
                    <div key={p.row} className="flex items-center gap-2 py-1 border-b border-[#f7f8fa] last:border-0">
                      <span className="text-[13px] text-[#191f28] flex-1">{p.name}<span className="text-[10px] text-[#5f6b7a] ml-1">{(p.campus || '').replace(' 캠퍼스', '')}·{deptName(p.deptLabel)}</span></span>
                      <select defaultValue="" onChange={(e) => { const v = e.target.value; e.target.value = ''; if (v) moveMember(p.name, v, v === '__solo__' ? '' : labelOf(v)) }}
                        className="bg-[#f9fafb] border border-[#e5e8eb] rounded-lg px-2 py-1 text-[11px] max-w-[130px]">
                        <option value="">이동 ▾</option>
                        <option value="__solo__">단독으로 분리</option>
                        {gidList.filter((g) => g !== gid).map((g) => <option key={g} value={g}>→ {labelOf(g)}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              ))}
              </Collapsible>
            </div>
          )
        })()}

        {tab === '리마인드' && (
          <div>
            <HelpToggle>{`입금 확인과 연락이 필요한 사람을 봅니다.

• '미입금': 아직 입금확인 안 된 사람. 체크 후 [선택 N명 입금확인]으로 한 번에 처리.
• '확인 필요': 명단엔 있는데 본인 신청서가 없는 그룹 — 연락해 신청을 받거나 미제출로 추가하세요.`}</HelpToggle>
            {(() => {
              const selN = Object.keys(sel).filter((r) => sel[r]).length
              const amt = (r) => (r.ifee || 0) + (r.iroom || 0) + (r.mbus || 0) + (r.mseo || 0) + (r.common || 0)
              const q = qUnpaid.trim()
              const filtered = q ? m.unpaid.filter((r) => (r.name || '').includes(q) || (r.pay || '').includes(q)) : m.unpaid
              const byPay = {}
              filtered.forEach((r) => { const k = (r.pay || '').trim() || r.name; (byPay[k] = byPay[k] || []).push(r) })
              const minRowOf = (mem) => Math.min.apply(null, mem.map((r) => r.row || 1e9))
              const groups = Object.entries(byPay).sort((a, b) => liveSort === 'name' ? a[0].localeCompare(b[0], 'ko') : liveSort === 'size' ? b[1].length - a[1].length : minRowOf(a[1]) - minRowOf(b[1]))
              return (
              <Collapsible title="미입금" count={`${m.unpaid.length}명`} defaultOpen>
                {m.unpaid.length === 0 ? <p className="text-[12px] text-[#5f6b7a]">전원 입금확인 완료</p> : (
                  <>
                    <FilterBar q={qUnpaid} setQ={setQUnpaid} total={m.unpaid.length} shown={filtered.length} placeholder="이름·입금자명 검색" />
                    <div className="flex gap-1.5 mb-2 items-center">
                      <span className="text-[11px] text-[#9ca3af] font-bold mr-0.5">정렬</span>
                      {[['time', '시간순'], ['name', 'ㄱㄴㄷ순'], ['size', '인원순']].map(([v, lbl]) => (
                        <button key={v} onClick={() => setLiveSort(v)} className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg ${liveSort === v ? 'bg-[#1b64da] text-white' : 'bg-[#f2f4f6] text-[#5f6b7a]'}`}>{lbl}</button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <button onClick={() => setSel(Object.fromEntries(filtered.map((r) => [r.row, true])))} className="text-[11px] font-bold text-[#3182f6] bg-[#f2f8ff] px-2.5 py-1.5 rounded-lg">전체선택</button>
                      <button onClick={() => setSel({})} className="text-[11px] font-bold text-[#5f6b7a] bg-[#f2f4f6] px-2.5 py-1.5 rounded-lg">해제</button>
                      <button onClick={batchConfirmPaid} disabled={!selN} className={`ml-auto text-[12px] font-bold px-3 py-1.5 rounded-lg ${selN ? 'bg-[#191f28] text-white' : 'bg-[#e5e8eb] text-[#b0b8c1]'}`}>선택 {selN}명 입금확인</button>
                    </div>
                    {groups.length === 0 ? <p className="text-[12px] text-[#5f6b7a]">검색 결과 없음</p> : groups.map(([payName, mem]) => {
                      const sum = mem.reduce((s, r) => s + amt(r), 0)
                      const allSel = mem.every((r) => sel[r.row])
                      return (
                        <div key={payName} className="border border-[#f2f4f6] rounded-xl mb-2 overflow-hidden">
                          <label className="flex items-center gap-2 px-3 py-2 bg-[#f9fafb] cursor-pointer">
                            <input type="checkbox" checked={allSel} onChange={() => { const ns = { ...sel }; mem.forEach((r) => { ns[r.row] = !allSel }); setSel(ns) }} className="w-4 h-4" />
                            <span className="text-[13px] font-bold text-[#191f28] flex-1 min-w-0 truncate">입금자명 {payName}{mem.length > 1 && <span className="text-[11px] text-[#5f6b7a] font-normal"> · {mem.length}명</span>}</span>
                            <span className="text-[13px] font-extrabold text-[#1b64da] shrink-0">{won(sum)}</span>
                          </label>
                          <div className="px-3">
                            {mem.map((r) => (
                              <label key={r.row} className="flex items-center gap-2 py-1.5 border-b border-[#f7f8fa] last:border-0 cursor-pointer">
                                <input type="checkbox" checked={!!sel[r.row]} onChange={() => toggleSel(r.row)} className="w-4 h-4" />
                                <span className="text-[13px] text-[#191f28] flex-1 min-w-0">{r.name} <span className="text-[11px] text-[#5f6b7a]">{(r.campus || '').replace(' 캠퍼스', '')}·{deptName(r.deptLabel)}</span></span>
                                <span className="text-[12px] font-bold text-[#4e5968] shrink-0">{won(amt(r))}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </Collapsible>
            ) })()}
            <Collapsible title="확인필요 (명단 > 제출)" count={`${m.checkGroups.length}건`}>
              {m.checkGroups.length === 0 ? <p className="text-[12px] text-[#5f6b7a]">없음</p> :
                m.checkGroups.map((g) => (
                  <div key={g.gid} className="py-1.5 border-b border-[#f7f8fa] last:border-0">
                    <div className="text-[13px] font-bold text-[#191f28]">{g.rep} <span className="text-[11px] text-[#5f6b7a] font-normal">그룹</span></div>
                    <div className="text-[11px] text-[#5f6b7a] leading-snug">{g.note}</div>
                  </div>
                ))}
            </Collapsible>
          </div>
        )}

        {tab === '문의' && (
          (() => {
            const qs = rows.filter((r) => r.inquiry)
            // 맥락 분류
            const classify = (t) => {
              const s = (t || '').replace(/\s/g, '')
              if (!s || /^(없음|없습니다|없어요|없네요|없습니당|x|X|\.|-|무|아니요|아니오)$/.test(s) || (/^없/.test(s) && s.length <= 6)) return 'none'
              const isPay = /입금|송금|이체|납부|비용|금액|계좌|등록비|얼마|만원|원입니다|결제/.test(t)
              const paid = /입금했|입금완료|입금하였|입금해|보냈|송금|이체했|납부했|완료했|했습니다|했어요|드렸|보냅니다|보냈습니다|이체|입금합니다/.test(s)
              const isRoom = /방|배정|객실|투숙|숙소|인실|같은방|한방|동숙|룸메/.test(t)
              const isReq = /해주|원합|부탁|배정해|넣어|함께|같이|원해|주세요|좋겠|희망/.test(t)
              const isQ = /\?|나요|는지|인가요|될까|되나|어떻게|얼마|궁금|맞나|맞는지|가능한가|할까요|하나요|되겠|되는지|할지/.test(t)
              if (isPay && paid && !isQ) return 'pay_report'
              if (isRoom && isReq && !isQ) return 'room_req'
              if (isPay) return 'pay_q'
              if (isRoom) return 'room_q'
              return 'etc'
            }
            const CATS = [
              { key: 'pay_q', label: '💰 입금 관련 문의', hint: '("이렇게 맞나요?" 등)' },
              { key: 'pay_report', label: '✅ 입금 보고', hint: '("입금했습니다" 등)' },
              { key: 'room_req', label: '🛏️ 방배정 요청', hint: '("같은 방으로 해주세요")' },
              { key: 'room_q', label: '❓ 방배정 질문', hint: '' },
              { key: 'etc', label: '📌 기타', hint: '' },
            ]
            const grouped = {}; qs.forEach((r) => { const c = classify(r.inquiry); (grouped[c] = grouped[c] || []).push(r) })
            const noiseN = (grouped.none || []).length
            const Card = (r) => {
              const done = doneInq.has(r.row)
              return (
              <div key={r.row} className={`bg-white rounded-2xl border border-[#f2f4f6] p-4 ${done ? 'opacity-55' : ''}`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-[#191f28]">{r.name} <span className="text-[11px] text-[#5f6b7a] font-normal">{(r.campus || '').replace(' 캠퍼스', '')}·{deptName(r.deptLabel)}{r.contact ? ` · ${fmtPhone(r.contact)}` : ''}</span></div>
                    <div className={`text-[12px] text-[#4e5968] mt-1 whitespace-pre-wrap leading-relaxed ${done ? 'line-through' : ''}`}>{r.inquiry}</div>
                  </div>
                  <button onClick={() => toggleDoneInq(r.row)} className={`shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-lg ${done ? 'bg-[#e7f5ec] text-[#1d7a4d]' : 'bg-[#f2f4f6] text-[#5f6b7a]'}`}>{done ? '완료 ✓' : '완료'}</button>
                </div>
              </div>
            ) }
            if (qs.length === 0) return <div className="bg-white rounded-2xl border border-[#f2f4f6] p-4"><p className="text-[12px] text-[#5f6b7a]">문의사항 없음</p></div>
            return (
              <div className="space-y-4">
                <HelpToggle>{`성도들이 남긴 문의를 맥락에 따라 자동으로 나눠 묶었습니다(입금 문의 / 입금 보고 / 방배정 요청 / 방배정 질문 / 기타).

• '없음/없습니다' 같은 빈 문의는 기본 숨김 — 아래 체크박스로 켜고 끌 수 있어요.
• 자동 분류라 가끔 틀릴 수 있으니 참고용으로 보세요.
• 방배정 요청은 '같은 방 요청' 탭에서 실제로 처리합니다.`}</HelpToggle>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 bg-white rounded-2xl border border-[#f2f4f6] p-3 text-[12px] text-[#4e5968] cursor-pointer">
                    <input type="checkbox" checked={onlyUndoneInq} onChange={(e) => setOnlyUndoneInq(e.target.checked)} className="w-4 h-4" />
                    미처리만 보기 <span className="text-[#5f6b7a]">(완료 {doneInq.size}건 숨김)</span>
                  </label>
                  <label className="flex items-center gap-2 bg-white rounded-2xl border border-[#f2f4f6] p-3 text-[12px] text-[#4e5968] cursor-pointer">
                    <input type="checkbox" checked={showNoise} onChange={(e) => setShowNoise(e.target.checked)} className="w-4 h-4" />
                    내용 없는 문의("없음/없습니다") 보기 <span className="text-[#5f6b7a]">({noiseN}건 숨김)</span>
                  </label>
                </div>
                {CATS.map((cat) => {
                  const items = (grouped[cat.key] || []).filter((r) => !onlyUndoneInq || !doneInq.has(r.row))
                  if (!items.length) return null
                  return (
                    <div key={cat.key}>
                      <div className="text-[13px] font-bold text-[#191f28] mb-1.5 px-1">{cat.label} <span className="text-[11px] text-[#5f6b7a] font-normal">{items.length}건 {cat.hint}</span></div>
                      <div className="space-y-2">{items.map(Card)}</div>
                    </div>
                  )
                })}
                {showNoise && noiseN > 0 && (
                  <div>
                    <div className="text-[13px] font-bold text-[#5f6b7a] mb-1.5 px-1">🗒️ 내용 없음 <span className="text-[11px] font-normal">{noiseN}건</span></div>
                    <div className="space-y-2">{grouped.none.map(Card)}</div>
                  </div>
                )}
              </div>
            )
          })()
        )}

        {tab === '버스명단' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-[#5f6b7a]">탑승 체크는 이 기기에만 저장됩니다. 당일 현장용.</p>
              <button onClick={() => window.print()} className="text-[11px] font-bold text-[#4e5968] bg-white border border-[#e5e8eb] px-3 py-1.5 rounded-lg">🖨 인쇄</button>
            </div>
            {Object.keys(m.byCampus).map((campus) => {
              const list = m.busList.filter((r) => (r.campus || '기타') === campus)
              const onN = list.filter((r) => boarded.has(r.row)).length
              return (
                <div key={campus} className="bg-white rounded-2xl border border-[#f2f4f6] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[13px] font-bold text-[#191f28]">{campus.replace(' 캠퍼스', '')} 버스 {list.length}명</div>
                    {list.length > 0 && <span className="text-[12px] font-extrabold text-[#1b64da]">탑승 {onN}/{list.length}</span>}
                  </div>
                  {list.length === 0 ? <p className="text-[12px] text-[#5f6b7a]">없음</p> : (
                    <div>
                      {list.map((r) => {
                        const on = boarded.has(r.row)
                        return (
                          <label key={r.row} className="flex items-center gap-2 py-1.5 border-b border-[#f7f8fa] last:border-0 cursor-pointer">
                            <input type="checkbox" checked={on} onChange={() => toggleBoarded(r.row)} className="w-4 h-4" />
                            <span className={`text-[13px] flex-1 ${on ? 'text-[#5f6b7a] line-through' : 'text-[#191f28]'}`}>{r.name} <span className="text-[11px] text-[#5f6b7a]">{deptName(r.deptLabel)}</span></span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {tab === '메일문구' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-[#f2f4f6] p-4">
              <p className="text-[12px] text-[#4e5968] leading-relaxed">성도에게 자동 발송되는 메일 문구를 직접 수정합니다. <b>저장하면 이후 발송분부터</b> 적용돼요. 치환자는 발송 시 실제 값으로 바뀝니다:</p>
              <p className="text-[11px] text-[#5f6b7a] mt-2 leading-relaxed">
                <code className="bg-[#f2f4f6] px-1 rounded">{'{name}'}</code> 이름 · <code className="bg-[#f2f4f6] px-1 rounded">{'{gid}'}</code> 접수번호 · <code className="bg-[#f2f4f6] px-1 rounded">{'{guide}'}</code> 항목별 입금안내 · <code className="bg-[#f2f4f6] px-1 rounded">{'{summary}'}</code> 최종 등록내역 · <code className="bg-[#f2f4f6] px-1 rounded">{'{changes}'}</code> 변경된 항목 · <code className="bg-[#f2f4f6] px-1 rounded">{'{vision}'}</code> 비전문구 · <code className="bg-[#f2f4f6] px-1 rounded">{'{foot}'}</code> 공통마무리
              </p>
            </div>
            {!mailTpl ? (
              <button onClick={loadMailTpl} className="w-full py-3 rounded-xl bg-[#191f28] text-white font-bold text-[13px]">메일 문구 불러오기</button>
            ) : (
              <>
                {(() => {
                  const set = (k, v) => setMailTpl({ ...mailTpl, [k]: v })
                  // ⚠️ 컴포넌트로 정의하면 키 입력마다 remount되어 포커스가 풀림 → 일반 함수로 인라인 요소 반환
                  const reset = (k) => mailDef[k] != null && mailTpl[k] !== mailDef[k] ? <button onClick={() => set(k, mailDef[k])} className="text-[11px] font-bold text-[#f04452]">기본값으로</button> : null
                  const body = (k, rows = 6) => <textarea value={mailTpl[k] || ''} onChange={(e) => set(k, e.target.value)} rows={rows} className={inputCls + ' resize-y text-[12px] leading-relaxed font-mono'} />
                  const subj = (k) => <input value={mailTpl[k] || ''} onChange={(e) => set(k, e.target.value)} className={inputCls + ' text-[13px] mb-2'} />
                  const MAILS = [['submit', '접수 메일 (신규 신청)'], ['update', '수정 메일 (본인 정보)'], ['add', '구성원 추가 메일'], ['delete', '구성원 취소 메일'], ['groupset', '그룹설정 변경 메일 (객실/인원/설악)']]
                  // 전체 미리보기: 본문의 {…} 자리에 샘플 값을 넣어 실제 발송 모습 그대로 보여줌
                  const SAMPLE = {
                    name: '김바울', gid: 'A1234',
                    guide: '▸ 등록비    김바울   278,000원  (장년부)\n▸ 버스비    김바울    38,000원\n총 등록 금액: 316,000원\n입금 계좌: 우리은행 1005803168121 주님의 교회',
                    summary: '[최종 등록 내역]\n· 인원 2명: 김바울, 김노아\n· 객실: 소노벨 스위트\n\n▸ 등록비        546,000원\n▸ 객실선택       60,000원\n─────────────────\n총 합계: 606,000원\n입금 계좌: 우리은행 1005803168121 주님의 교회',
                    changes: '\n\n[변경된 항목]\n▸ 버스: 자차 → 신청',
                  }
                  const fill = (s) => String(s || '').replace(/\{(\w+)\}/g, (mm, key) => key === 'vision' ? (mailTpl.vision ? '\n\n' + mailTpl.vision : '') : key === 'foot' ? (mailTpl.foot || '') : (SAMPLE[key] != null ? SAMPLE[key] : ''))
                  return (
                    <>
                      <div className="bg-white rounded-2xl border border-[#f2f4f6] p-4">
                        <div className="flex items-center justify-between mb-1"><div className="text-[13px] font-bold text-[#191f28]">✨ 비전·영적 기대 문구 (#30)</div>{reset('vision')}</div>
                        <p className="text-[11px] text-[#5f6b7a] mb-2">비워두면 안 나오고, 적으면 모든 안내 메일 끝(마무리 위)에 들어갑니다.</p>
                        {body('vision', 4)}
                      </div>
                      <div className="bg-white rounded-2xl border border-[#f2f4f6] p-4">
                        <div className="flex items-center justify-between mb-1"><div className="text-[13px] font-bold text-[#191f28]">공통 마무리 문구</div>{reset('foot')}</div>
                        {body('foot', 4)}
                      </div>
                      {MAILS.map(([k, label]) => (
                        <div key={k} className="bg-white rounded-2xl border border-[#f2f4f6] p-4">
                          <div className="flex items-center justify-between mb-2"><div className="text-[13px] font-bold text-[#191f28]">{label}</div>{reset(k + '_body')}</div>
                          <div className="text-[11px] font-bold text-[#5f6b7a] mb-1">제목</div>
                          {subj(k + '_subject')}
                          <div className="text-[11px] font-bold text-[#5f6b7a] mb-1">본문 <span className="font-normal text-[#9ca3af]">(이 본문이 메일 전체 내용입니다)</span></div>
                          {body(k + '_body', 7)}
                          <button onClick={() => setMailPrev({ ...mailPrev, [k]: !mailPrev[k] })} className="mt-2 text-[12px] font-bold text-[#1d4ed8]">{mailPrev[k] ? '▲ 전체 미리보기 접기' : '▼ 전체 미리보기 (실제 발송 모습)'}</button>
                          {mailPrev[k] && (
                            <div className="mt-2 rounded-xl border border-[#e5e8eb] overflow-hidden">
                              <div className="bg-[#f9fafb] px-3 py-2 border-b border-[#eef0f3] text-[12px] font-bold text-[#374151]">제목: {fill(mailTpl[k + '_subject'])}</div>
                              <div className="px-3 py-3 text-[12px] leading-relaxed text-[#374151] whitespace-pre-wrap">{fill(mailTpl[k + '_body'])}</div>
                              <div className="bg-[#fffbeb] px-3 py-1.5 text-[11px] text-[#92400e]">※ 위 김바울·금액·내역은 예시이며, 실제로는 신청자 정보로 자동 채워집니다.</div>
                            </div>
                          )}
                        </div>
                      ))}
                      <div className="sticky bottom-2 bg-white rounded-2xl border border-[#e5e8eb] shadow-lg p-3 flex items-center gap-2">
                        <button onClick={saveMailTpl} className="flex-1 py-3 rounded-xl bg-[#191f28] text-white font-bold text-[14px]">메일 문구 저장</button>
                        <button onClick={loadMailTpl} className="px-4 py-3 rounded-xl bg-[#f2f4f6] text-[#4e5968] font-bold text-[13px]">되돌리기</button>
                      </div>
                      {mailMsg && <p className="text-[12px] text-[#1b64da] font-semibold text-center">{mailMsg}</p>}
                    </>
                  )
                })()}
              </>
            )}
            {mailMsg && !mailTpl && <p className="text-[12px] text-[#1b64da] font-semibold text-center">{mailMsg}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 메인 ───────────────────────────────────────────────────────
export default function App() {
  const [top, setTop] = useState('등록')  // '등록' | '조회' (#9)
  const [reg, setReg] = useState('개인')   // '개인' | '그룹'
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
          <div className="mt-3 bg-white rounded-2xl border border-[#f2f4f6] p-4 text-[14px] text-[#4e5968] leading-relaxed">
            7/21(화)~23(목) · 델피노 리조트<br />
            등록기간 6/7~6/28 (선착순) · 문의 이흥배 목사 010-9584-7575<br />
            <span className="text-[#5f6b7a] text-[13px]">* 새가족 과정 수료자에 한해 등록 가능</span>
            <GuideButton />
            <CostGuideButton />
          </div>
        </header>

        {/* 상단 탭: 등록 ↔ 조회·수정 분리 (#9) */}
        <div className="flex items-center gap-2 mb-3 sticky top-2 z-10">
          <button
            onClick={() => setTop('등록')}
            className={`flex-1 py-3.5 text-[15px] font-bold rounded-[14px] transition-all min-h-[48px] ${top === '등록' ? 'bg-[#191f28] text-white shadow-md' : 'bg-white text-[#5f6b7a] border border-[#e5e8eb]'}`}
          >
            등록하기
          </button>
          <button
            onClick={() => setTop('조회')}
            className={`px-4 py-3.5 text-[14px] font-bold rounded-[14px] transition-all min-h-[48px] ${top === '조회' ? 'bg-[#191f28] text-white shadow-md' : 'bg-white text-[#5f6b7a] border border-[#e5e8eb]'}`}
          >
            조회·수정
          </button>
        </div>

        {/* 등록 하위: 개인 / 가족·그룹 */}
        {top === '등록' && (
          <div className="flex gap-1.5 bg-[#e9ecef] p-1.5 rounded-[14px] mb-4">
            {[{ k: '개인', t: '개인' }, { k: '그룹', t: '가족·그룹' }].map(({ k, t }) => (
              <button
                key={k}
                onClick={() => setReg(k)}
                className={`flex-1 py-3 text-[14px] font-bold rounded-[11px] transition-all min-h-[44px] ${reg === k ? 'bg-white text-[#3182f6] shadow-sm' : 'text-[#5f6b7a]'}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {top === '조회' ? <LookupMode /> : reg === '개인' ? <IndividualMode /> : <GroupMode />}

        <p className="text-[13px] text-[#5f6b7a] text-center mt-6 leading-relaxed">
          제출 후 <b>입금까지 완료</b>해야 등록이 확정됩니다.<br />
          환불은 등록기간 이후 어렵습니다.<br />
          가족·그룹은 대표자가 구성원을 모두 입력해 한 번에 제출합니다.
        </p>
      </div>
    </div>
  )
}
