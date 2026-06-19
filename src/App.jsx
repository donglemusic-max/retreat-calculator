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
        {sub && <div className="text-[13px] text-[#8b95a1] mt-0.5 leading-snug">{sub}</div>}
      </div>
      {right != null && (
        <div className={`text-[14px] font-bold whitespace-nowrap ${active ? 'text-[#1b64da]' : 'text-[#8b95a1]'}`}>{right}</div>
      )}
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
        {sub && <div className="text-[13px] text-[#8b95a1] mt-0.5">{sub}</div>}
      </div>
      <div className="flex items-center gap-2">
        {price && <span className={`text-[14px] font-bold ${on ? 'text-[#1b64da]' : 'text-[#8b95a1]'}`}>{price}</span>}
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
  'w-full bg-[#f9fafb] border border-[#e5e8eb] rounded-xl px-3 py-3 text-[15px] focus:ring-2 focus:ring-[#3182f6] focus:outline-none min-h-[48px]'

function Field({ label, required, children }) {
  return (
    <div className="mb-4 last:mb-0">
      <label className="block text-[13px] font-semibold text-[#4e5968] mb-2">
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
          className={`flex-1 py-3 rounded-xl text-[14px] font-bold border transition-all min-h-[48px] ${
            value === o ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#8b95a1]'
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
        <p className="text-[13px] text-[#8b95a1] mb-5">내용을 확인하고 제출해 주세요.</p>

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
                  {l.payer}{l.note ? <span className="text-[#8b95a1]"> ({l.note})</span> : ''}
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
            <div className="mt-1 text-right text-[13px] text-[#8b95a1]">1인 평균 {won(calc.perPerson)} · {calc.count}명</div>
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
          onClick={onConfirm}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-[#191f28] text-white font-bold text-[16px] shadow-lg mb-2"
        >
          {loading ? '제출 중…' : '제출하기'}
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

  const doSubmit = async () => {
    setSubmitLoading(true); setSubmitErr('')
    try {
      const res = await fetch(SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(submission),
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
          <div className="text-[14px] text-[#8b95a1]">
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
      <span className="text-[#8b95a1] ml-2">{gender} · {dept} · {campus.replace(' 캠퍼스', '')} 캠퍼스</span>
    </div>
  )

  return (
    <>
      <Card title="소속 부서" help={HELP.dept} helpTitle="소속부서 / 등록비 안내">
        <p className="text-[13px] text-[#8b95a1] mb-3 leading-relaxed">부서에 따라 1인 등록비가 달라집니다.</p>
        <DeptSelect value={dept} onChange={setDept} />
        <div className="mt-3 bg-[#f2f8ff] rounded-xl px-4 py-3">
          <span className="text-[13px] text-[#4e5968]">선택한 등록비</span>
          <span className="text-[17px] font-extrabold text-[#1b64da] ml-3">{won(d.fee)}</span>
        </div>
      </Card>

      <Card title="방 선택" help={HELP.room} helpTitle="객실 종류 안내">
        <p className="text-[13px] text-[#8b95a1] mb-3 leading-relaxed">
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
      </Card>

      <Card title="교통 / 설악산뷰" help={HELP.move} helpTitle="버스 / 설악산뷰 안내">
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

      <Card title="신청자 정보">
        <Field label="이름" required>
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

      <div className="mb-6">
        {missing.length > 0 && (
          <p className="text-[13px] text-[#f04452] font-semibold mb-3 leading-relaxed">입력 필요: {missing.join(', ')}</p>
        )}
        {submitErr && <p className="text-[13px] text-[#f04452] mb-3 leading-relaxed">제출 오류: {submitErr}</p>}
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={missing.length > 0}
          className={`w-full py-4 rounded-2xl font-bold text-[16px] transition-all ${
            missing.length === 0 ? 'bg-[#191f28] text-white hover:bg-black shadow-lg' : 'bg-[#e5e8eb] text-[#b0b8c1]'
          }`}
        >
          신청 내용 확인하고 제출하기
        </button>
        <p className="text-[13px] text-[#8b95a1] mt-3 leading-relaxed text-center">
          * 제출 후 입금까지 완료해야 등록이 확정됩니다.
        </p>
      </div>

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
  const [members, setMembers] = useState([{ name: '', dept: '장년부', bus: false, gender: '' }])
  const [roomIdx, setRoomIdx] = useState(1)
  const [occOverride, setOccOverride] = useState(null) // null = 자동(인원수 기준)
  const [occOpen, setOccOpen] = useState(false) // 투숙인원 수동선택 영역 열기
  const [seorak, setSeorak] = useState(false)
  const [depositMode, setDepositMode] = useState('leader') // 'leader' | 'split'
  const [email, setEmail] = useState('')
  const [contact, setContact] = useState('')
  const [campus, setCampus] = useState('')
  const [inquiry, setInquiry] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitDone, setSubmitDone] = useState(null)
  const [submitErr, setSubmitErr] = useState('')

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
    if (roomGroup > 0) lines.push({ cat: '객실선택', payer: who, amt: roomGroup, note: room.name })
    if (occFee > 0) lines.push({ cat: '그룹', payer: who, amt: occFee, note: `${effOcc.label} 투숙` })
    if (busTotal > 0) lines.push({ cat: '버스비', payer: who, amt: busTotal, note: `${busCount}명` })
    if (seorakTotal > 0) lines.push({ cat: '설악산', payer: who, amt: seorakTotal, note: `${count}명 전원` })

    return { total, perPerson: Math.round(total / count), lines, count, overMax: count > room.max }
  }, [members, room, effOcc, count, seorak, depositMode, who])

  const subtitle =
    depositMode === 'split'
      ? `등록비는 각 구성원 이름으로, 공동비용(객실·그룹비)은 대표자 ${who} 이름으로 입금`
      : `모든 항목 대표자 ${who} 이름으로 입금`

  const doSubmit = async () => {
    setSubmitLoading(true); setSubmitErr('')
    try {
      const res = await fetch(SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(submission),
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
          <div className="text-[14px] text-[#8b95a1]">
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
          <span className="text-[#8b95a1]">{m.gender} · {m.dept}{m.bus ? ' · 버스' : ''}</span>
          {i === 0 && <span className="text-[12px] text-white bg-[#3182f6] rounded-full px-1.5 py-0.5 font-bold">대표</span>}
        </div>
      ))}
    </div>
  )

  return (
    <>
      <Card title="대표자 정보">
        <p className="text-[13px] text-[#8b95a1] mb-4 leading-relaxed">
          가족·그룹을 대표해서 신청하는 분의 정보입니다. 공동비용 입금 시 이 이름으로 입금합니다.
        </p>
        <Field label="대표자 이름" required>
          <input value={leader} onChange={(e) => setLeader(e.target.value)} placeholder="예: 김바울" className={inputCls} />
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

      <Card title="구성원" badge={count} help={HELP.members} helpTitle="가족 · 그룹 신청 안내">
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
                placeholder={i === 0 ? '이름 (대표자 본인이면 위와 동일하게)' : '이름'}
                className="w-full bg-white border border-[#e5e8eb] rounded-xl px-3 py-3 text-[15px] mb-3 focus:ring-2 focus:ring-[#3182f6] focus:outline-none min-h-[48px]"
              />
              <div className="flex gap-2 mb-3">
                {['남', '여'].map((g) => (
                  <button
                    key={g}
                    onClick={() => updateMember(i, { gender: g })}
                    className={`flex-1 py-3 rounded-xl text-[14px] font-bold border transition-all min-h-[48px] ${
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
                className={`w-full mt-3 py-3 rounded-xl text-[14px] font-bold border transition-all min-h-[48px] ${
                  m.bus ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#8b95a1]'
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

      <Card title="방 선택" help={HELP.room} helpTitle="객실 종류 안내">
        <div className="space-y-2">
          {ROOMS.map((r, i) => (
            <OptionRow
              key={r.name}
              active={roomIdx === i}
              onClick={() => setRoomIdx(i)}
              title={r.name}
              sub={r.desc}
              right={r.group > 0 ? `+${won(r.group)}` : '추가비용 없음'}
            />
          ))}
        </div>
        {calc.overMax && (
          <p className="text-[13px] text-[#f04452] font-bold mt-3">
            구성원 {count}명이 선택한 방 최대 인원({room.max}명)을 초과합니다.
          </p>
        )}
      </Card>

      <Card title="몇 분이 한 방을 쓰나요?" help={HELP.occupancy} helpTitle="투숙 인원 / 방배정 안내">
        <div className="bg-[#f2f8ff] rounded-2xl px-4 py-4 mb-3 flex items-center justify-between">
          <div>
            <div className="text-[13px] text-[#4e5968] mb-0.5">현재 구성원 수 기준 자동 적용</div>
            <div className="text-[17px] font-extrabold text-[#1b64da]">
              {effOcc.label} 투숙
              {effOcc.fee > 0
                ? <span className="text-[14px] font-bold text-[#f04452] ml-2">+{won(effOcc.fee)}</span>
                : <span className="text-[14px] font-bold text-[#15803d] ml-2">추가비용 없음</span>
              }
            </div>
            {occOverride != null && (
              <div className="text-[12px] text-[#8b95a1] mt-0.5">(수동 선택 중)</div>
            )}
          </div>
          {occOverride != null && (
            <button
              onClick={() => { setOccOverride(null); setOccOpen(false) }}
              className="text-[12px] font-bold text-[#3182f6] min-w-[44px] min-h-[44px] flex items-center justify-end"
            >
              자동으로
            </button>
          )}
        </div>

        <button
          onClick={() => setOccOpen((v) => !v)}
          className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-[#f9fafb] border border-[#e5e8eb] text-[13px] font-bold text-[#4e5968] min-h-[48px]"
        >
          <span>직접 선택하기</span>
          <span className={`text-[#8b95a1] text-[12px] transition-transform ${occOpen ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {occOpen && (
          <div className="mt-3">
            <p className="text-[13px] text-[#8b95a1] mb-3 leading-relaxed">
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
                  <span className="text-[13px] font-normal text-[#8b95a1]">{o.fee > 0 ? `+${o.fee/10000}만원` : '추가없음'}</span>
                </button>
              ))}
            </div>
            <p className="text-[13px] text-[#8b95a1] mt-3 leading-relaxed">
              * 일부만 함께 쓰는 경우는 문의사항에 적어주세요.
            </p>
          </div>
        )}
      </Card>

      <Card title="설악산 뷰" help={HELP.seorakGroup} helpTitle="설악산뷰 안내">
        <Toggle
          on={seorak}
          onChange={setSeorak}
          label="설악산 뷰 신청하겠습니다 (전원 적용)"
          sub={`같은 방이라 모두 적용 · ${count}명 × ${won(SEORAK_FEE)}`}
          price={seorak ? `+${won(count * SEORAK_FEE)}` : `+${won(count * SEORAK_FEE)}`}
        />
      </Card>

      <Card title="등록비 입금은 어떻게 하실 건가요?" help={HELP.depositMode} helpTitle="입금 방식 안내">
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
            <div className="text-[13px] text-[#8b95a1] mt-0.5">
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
            <div className="text-[13px] text-[#8b95a1] mt-0.5">
              등록비만 각자, 공동비용(방·그룹비)은 대표자 이름
            </div>
          </button>
        </div>
        {depositMode === 'split' && (
          <p className="text-[13px] text-[#4e5968] mt-3 bg-[#f2f8ff] rounded-xl px-4 py-3 leading-relaxed">
            구성원 이름이 입금자명으로 사용됩니다. 위에 이름을 정확히 입력해 주세요.
          </p>
        )}
      </Card>

      <ResultPanel calc={calc} subtitle={`※ ${subtitle}`} />

      <div className="mb-6">
        {missing.length > 0 && (
          <p className="text-[13px] text-[#f04452] font-semibold mb-3 leading-relaxed">입력 필요: {missing.join(', ')}</p>
        )}
        {submitErr && <p className="text-[13px] text-[#f04452] mb-3 leading-relaxed">제출 오류: {submitErr}</p>}
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={missing.length > 0}
          className={`w-full py-4 rounded-2xl font-bold text-[16px] transition-all ${
            missing.length === 0 ? 'bg-[#191f28] text-white hover:bg-black shadow-lg' : 'bg-[#e5e8eb] text-[#b0b8c1]'
          }`}
        >
          신청 내용 확인하고 제출하기
        </button>
        <p className="text-[13px] text-[#8b95a1] mt-3 leading-relaxed text-center">
          * 제출 후 입금까지 완료해야 등록이 확정됩니다.
        </p>
      </div>

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
        <p className="text-[13px] text-[#8b95a1] mb-3 leading-relaxed">
          아래 항목별로 <b>각각 따로</b> 입금해 주세요. 입금자명 형식: "항목 이름"
        </p>
        <div className="space-y-3">
          {calc.lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-[#f2f4f6] last:border-0">
              <div>
                <span className="inline-block bg-[#f2f8ff] text-[#1b64da] text-[13px] font-bold px-2.5 py-1 rounded-lg mr-2">
                  {l.cat} {l.payer}
                </span>
                {l.note && <span className="text-[12px] text-[#8b95a1]">{l.note}</span>}
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
          <div className="text-[13px] text-[#8b95a1] font-semibold mb-1">입금 계좌</div>
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
          {data.rep && <span className="text-[12px] text-[#8b95a1]">대표 {data.rep}</span>}
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
              <span className="text-[#4e5968]">{f.label}{f.note ? <span className="text-[#8b95a1]"> ({f.note})</span> : ''}</span>
              <span className="font-bold text-[#4e5968]">{won(f.amt)}</span>
            </div>
          ))}
        </div>
        {isGroupRoom && isRep && data.groupTotal > 0 && (
          <div className="mt-2 pt-2 border-t border-[#c8deff] text-[13px] text-[#8b95a1]">
            그룹 전체 총액: {won(data.groupTotal)}
          </div>
        )}
        {isGroupRoom && !isRep && (
          <div className="mt-2 pt-2 border-t border-[#c8deff] text-[13px] text-[#8b95a1]">
            방·그룹비는 대표자({data.rep || '-'})가 납부
          </div>
        )}
      </div>

      <Field label="성별"><SegPicker value={gender} onChange={setGender} options={['남', '여']} /></Field>
      <Field label="연락처"><input value={contact} onChange={(e) => setContact(fmtPhone(e.target.value))} inputMode="tel" className={inputCls} /></Field>
      <Field label="이메일"><input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" className={inputCls} /></Field>
      <Field label="캠퍼스"><SegPicker value={campus} onChange={setCampus} options={CAMPUSES} render={(c) => c.replace(' 캠퍼스', '')} /></Field>
      <Field label="소속부서"><DeptSelect value={deptName} onChange={setDeptName} /></Field>
      <Field label="버스 / 설악산뷰">
        <div className="flex gap-2">
          <button onClick={() => setBus(!bus)} className={`flex-1 py-3 rounded-xl text-[14px] font-bold border min-h-[48px] ${bus ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#8b95a1]'}`}>
            버스{bus ? ' ✓' : ''}
          </button>
          <button onClick={() => setSeorak(!seorak)} className={`flex-1 py-3 rounded-xl text-[14px] font-bold border min-h-[48px] ${seorak ? 'border-2 border-[#3182f6] bg-[#f2f8ff] text-[#1b64da]' : 'border border-[#e5e8eb] text-[#8b95a1]'}`}>
            설악산뷰{seorak ? ' ✓' : ''}
          </button>
        </div>
      </Field>
      <Field label="문의사항"><textarea value={inquiry} onChange={(e) => setInquiry(e.target.value)} rows={2} className={inputCls + ' resize-none'} /></Field>

      <div className="text-[13px] text-[#8b95a1] bg-white rounded-xl p-3 mb-3 leading-relaxed">
        선택한 방: {roomShort || '-'} · 방 종류·투숙인원·입금자명 변경은 별도 문의 바랍니다.
      </div>

      {err && <p className="text-[13px] text-[#f04452] mb-3">{err}</p>}
      <button
        onClick={save}
        disabled={saving}
        className={`w-full py-4 rounded-2xl font-bold text-[15px] min-h-[52px] ${saved ? 'bg-[#15803d] text-white' : 'bg-[#3182f6] text-white hover:bg-[#1b64da]'}`}
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

  const text = `[2026 전교인 리트릿 등록 입금 안내]\n입금 계좌: ${ACCOUNT}\n방식: ${mode === 'leader' && multi ? '대표자 일괄' : '항목별/각자'}\n\n` +
    lines.map((l) => `▸ ${l.cat} ${l.payer}   ${won(l.amt)}`).join('\n') +
    `\n─────────────────\n총 합계: ${won(total)}\n\n* 항목별로 구분하여 따로 입금해 주세요. (입금자명: "항목 이름")`
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
            <div className="text-[13px] text-[#8b95a1] mt-0.5">모든 항목을 대표자 이름으로</div>
          </button>
          <button
            onClick={() => setMode('each')}
            className={`w-full px-4 py-4 rounded-2xl text-left transition-all min-h-[64px] border ${mode === 'each' ? 'border-2 border-[#3182f6] bg-[#f2f8ff]' : 'border border-[#e5e8eb] bg-white'}`}
          >
            <div className={`text-[15px] font-bold ${mode === 'each' ? 'text-[#1b64da]' : 'text-[#333d4b]'}`}>각자 등록비를 본인 이름으로 입금</div>
            <div className="text-[13px] text-[#8b95a1] mt-0.5">공동비용(방·그룹비)은 대표자 이름</div>
          </button>
        </div>
      )}
      <p className="text-[13px] text-[#8b95a1] mb-3 leading-relaxed">
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
        <div className="text-[13px] text-[#8b95a1] font-semibold mb-1">입금 계좌</div>
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
        <p className="text-[14px] text-[#4e5968] mb-4 leading-relaxed">
          신청하실 때 입력한 이름과 연락처로 조회합니다.<br />
          가족·그룹은 대표자 이름으로 조회하세요.
        </p>
        <Field label="이름" required>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김바울" className={inputCls} />
        </Field>
        <Field label="연락처" required>
          <input value={contact} onChange={(e) => setContact(fmtPhone(e.target.value))} placeholder="010-0000-0000" inputMode="tel" className={inputCls} />
        </Field>
        <button
          onClick={lookup}
          disabled={!name.trim() || !contact.trim() || status === 'loading'}
          className={`w-full py-4 rounded-2xl font-bold text-[16px] min-h-[52px] ${name.trim() && contact.trim() && status !== 'loading' ? 'bg-[#191f28] text-white hover:bg-black' : 'bg-[#e5e8eb] text-[#b0b8c1]'}`}
        >
          {status === 'loading' ? '조회 중…' : '조회하기'}
        </button>
        {status === 'error' && <p className="text-[13px] text-[#f04452] mt-3">{err}</p>}
      </Card>

      {status === 'loaded' && (
        results.length === 0 ? (
          <Card title="조회 결과 없음">
            <p className="text-[14px] text-[#4e5968] leading-relaxed">
              해당 이름과 연락처로 제출된 신청이 없습니다.<br />
              입력 내용을 다시 확인하시거나, 안내데스크로 문의해 주세요.
            </p>
          </Card>
        ) : (results.length > 1 || /인이 투숙/.test(results[0].occLabel || '') || results[0].appType === '그룹') ? (
          <GroupEditor members={results} auth={{ verifyContact: contact.trim() }} onRefresh={lookup} title={`${(results.find((r) => r.isSelf) || results[0]).rep || name.trim()}님 그룹`} />
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
  const [moveQ, setMoveQ] = useState('') // 그룹정리: 옮길 사람 이름 검색
  const [movePick, setMovePick] = useState(null) // 선택된 옮길 사람
  const [moveTargetQ, setMoveTargetQ] = useState('') // 대상 그룹 이름 검색
  const [dismissed, setDismissed] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem('retreat_miss_dismiss') || '[]')) } catch { return new Set() } }) // 미제출명단 수동 제외
  const [showNoise, setShowNoise] = useState(false) // 문의탭: '없음/없습니다' 표시 여부
  const [confirmBox, setConfirmBox] = useState(null) // 공용 확인 다이얼로그 {title, lines, onOk, okLabel}
  const ask = (title, lines, onOk, okLabel = '진행') => setConfirmBox({ title, lines, onOk, okLabel })
  const [showGuide, setShowGuide] = useState(false) // 인앱 사용법 가이드
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
    const pool = notDup.filter((r) => isChurchAssigned(r.occLabel))  // 교회배정 풀(미제출 placeholder 포함→배정 가능)
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
    setAssignDraft((d) => ({ ...d, [row]: isPool ? '' : String(over.id) }))
  }
  const addRoom = () => {
    let i = 1; const exist = new Set([...m.pool.map((p) => eff(p)).filter(Boolean), ...extraRooms])
    while (exist.has(`방${i}`)) i++
    setExtraRooms((r) => [...r, `방${i}`])
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
      const label = `${mem[0].rep || mem[0].name} 방`
      const diff = mem.filter((r) => (r.assigned || '') !== label)
      if (diff.length) groupLabels.push(label)
      diff.forEach((r) => updates.push({ row: r.row, value: label }))
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
      <div className="text-[11px] text-[#8b95a1] font-semibold mb-1">{label}</div>
      <div className="text-[20px] font-extrabold text-[#191f28] leading-none">{value}</div>
      {sub && <div className="text-[11px] text-[#8b95a1] mt-1">{sub}</div>}
    </div>
  )

  const TAB_ORDER = ['요약', '그룹정리', '요청조합', '방배정', '리마인드', '문의', '버스명단']
  const TAB_LABEL = { 요약: '요약', 그룹정리: '그룹정리', 요청조합: '같은 방 요청', 방배정: '방배정', 리마인드: '입금·확인', 문의: '문의', 버스명단: '버스' }
  const goTab = (t) => { setTab(t); setMergeSel({}) } // 탭 이동 시 합치기 선택 초기화(탭 간 오선택 방지)

  return (
    <div className="min-h-screen bg-[#f2f4f6] text-[#333d4b] pb-12">
      {showGuide && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setShowGuide(false)}>
          <div className="bg-white w-full max-w-[480px] rounded-2xl my-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-2 sticky top-0 bg-white rounded-t-2xl">
              <div className="text-[17px] font-extrabold text-[#191f28]">📖 리트릿 관리자 사용법</div>
              <button onClick={() => setShowGuide(false)} className="text-[13px] font-bold text-[#8b95a1]">닫기 ✕</button>
            </div>
            <div className="px-5 pb-6 text-[13px] text-[#4e5968] leading-relaxed space-y-4">
              <div>
                <div className="font-bold text-[#191f28] mb-1">① 꼭 알아야 할 2가지</div>
                <div className="bg-[#f9fafb] rounded-xl p-3">
                  <p><b className="text-[#1b64da]">그룹</b> = <b>비용</b>을 함께 내는 단위(가족 등). 합치면 객실 그룹가 등 <b>비용이 다시 계산</b>돼요.</p>
                  <p className="mt-1.5"><b className="text-[#7c3aed]">방</b> = <b>같이 자는</b> 단위. 비용과 무관하게 방 번호만 같이 붙입니다.</p>
                  <p className="mt-1.5 text-[12px] text-[#8b95a1]">→ "돈도 같이"는 <b>그룹정리</b>, "방만 같이"는 <b>같은 방 요청</b> 탭.</p>
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
                <p className="text-[12px] text-[#8b95a1] mt-1">요약 탭의 <b>'확인 리스트'</b>를 위에서부터 누르면 해당 탭으로 갑니다.</p>
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
                <p className="mt-1 text-[12px] text-[#8b95a1]">합치기·이동·일괄저장은 누르면 <b>확인창</b>이 떠요. "비용이 바뀜/안 바뀜"을 보고 진행하세요.</p>
                <p className="mt-1 text-[12px] text-[#8b95a1]">방·입금 작업(방배정·방 맞추기·입금확인)은 헤더 <b>‘↩ 되돌리기’</b>로 직전 작업을 되돌릴 수 있어요.</p>
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
          <p className="text-[12px] text-[#8b95a1] mt-1">신청을 <b className="text-[#4e5968]">① 그룹 정리 → ② 같은 방 요청 → ③ 방배정 → ④ 입금·연락</b> 순으로 진행하면 됩니다.</p>
        </header>

        <div className="flex gap-1.5 bg-[#e9ecef] p-1.5 rounded-[14px] mb-4 overflow-x-auto">
          {TAB_ORDER.map((t) => (
            <button key={t} onClick={() => goTab(t)} className={`flex-1 whitespace-nowrap py-2.5 px-3 text-[13px] font-bold rounded-[10px] ${tab === t ? 'bg-white text-[#3182f6] shadow' : 'text-[#8b95a1]'}`}>{TAB_LABEL[t]}</button>
          ))}
        </div>

        {tab === '요약' && (
          <div>
            {saveMsg && <p className="text-[12px] text-[#1b64da] font-semibold mb-2">{saveMsg}</p>}
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
                  <div className="text-[11px] text-[#8b95a1] mb-2">위에서부터 차례로 누르면 그 탭으로 갑니다.</div>
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
                <p className="text-[11px] text-[#8b95a1] mb-2">설악산뷰는 인원보다 <b>방 수</b>가 중요합니다. 확정된 방과 아직 방이 안 정해진 인원을 함께 봅니다.</p>
                {m.seoRooms.map((rm, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[#f7f8fa] last:border-0">
                    <span className="text-[13px] font-bold text-[#191f28] shrink-0">{rm.label}</span>
                    <span className="text-[11px] text-[#8b95a1] min-w-0">{rm.campus} · {rm.people.length}명 ({rm.people.join(', ')})</span>
                  </div>
                ))}
                {m.seoUnassigned.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#f2f4f6]">
                    <div className="text-[12px] font-bold text-[#b45309] mb-1">⚠ 미배정 {m.seoUnassigned.length}명 — 방 정하면 방 수가 늘어요</div>
                    <div className="text-[11px] text-[#8b95a1] leading-relaxed">{m.seoUnassigned.map((r) => `${r.name}(${(r.campus || '').replace(' 캠퍼스', '')})`).join(', ')}</div>
                  </div>
                )}
              </Collapsible>
            )}
            {(() => {
              const vm = m.missingList.filter((x) => !dismissed.has(x.name))
              if (!vm.length && !dismissed.size) return null
              return (
                <Collapsible title="📋 미제출 추정 명단" count={`${vm.length}명`}>
                  <p className="text-[11px] text-[#8b95a1] mb-2">명단에는 적혔으나 아직 본인 신청서가 없는 사람입니다. '미제출 추가'하면 방배정 대상이 되고, 이름이 아니거나 이미 제출된 사람은 '제외'하세요.{dismissed.size > 0 && <button onClick={clearDismissed} className="text-[#3182f6] font-semibold ml-1">제외 {dismissed.size}건 되돌리기</button>}</p>
                  {vm.map((x, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[#f7f8fa] last:border-0">
                      <span className="text-[13px] text-[#191f28] flex-1 min-w-0">{x.name}<span className="text-[10px] text-[#8b95a1] ml-1">{x.from} 명단</span></span>
                      <button onClick={() => addPlaceholderName(x.name)} className="text-[11px] font-bold text-white bg-[#3182f6] rounded-lg px-2.5 py-1 shrink-0">미제출 추가</button>
                      <button onClick={() => dismissMissing(x.name)} className="text-[11px] font-bold text-[#8b95a1] bg-[#f2f4f6] rounded-lg px-2.5 py-1 shrink-0">제외</button>
                    </div>
                  ))}
                  {!vm.length && <p className="text-[12px] text-[#8b95a1] text-center py-2">모두 처리됨 ✓</p>}
                </Collapsible>
              )
            })()}
          </div>
        )}

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
              {!clusters.length && <p className="text-[13px] text-[#8b95a1] text-center py-10">처리할 방배정 요청이 없습니다.</p>}
              {clusters.map((c, i) => (
                <div key={i} className={`rounded-2xl border p-4 mb-2.5 ${c.done ? 'border-[#e5e8eb] bg-[#f9fafb]' : c.block ? 'border-[#f04452] bg-[#fff5f5]' : c.conflicts.length ? 'border-[#f59e0b] bg-[#fffbeb]' : 'border-[#e5e8eb] bg-white'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-bold text-[#191f28]">{c.done ? '✅' : c.block ? '🔴' : c.conflicts.length ? '🟡' : '🟢'} {c.members.map((p) => p.name).join(', ')}{c.done && <span className="text-[11px] font-normal text-[#1b64da] ml-1">이미 같은 방: {c.room}</span>}</span>
                    <span className={`text-[12px] font-bold ${c.members.length > c.cap ? 'text-[#f04452]' : 'text-[#8b95a1]'}`}>{roomTypeShort(c.roomType)} {c.members.length}/{c.cap}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {c.members.map((p) => (
                      <span key={p.row} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-bold border border-[#e5e8eb] bg-white">
                        {p.name}<span className="text-[10px] text-[#8b95a1] font-normal">{(p.campus || '').replace(' 캠퍼스', '').slice(0, 2)}·{p.gender}·{deptName(p.deptLabel)}</span>
                        {p.assigned && <span className="text-[9px] text-[#1b64da] font-normal">📍{p.assigned}</span>}
                      </span>
                    ))}
                  </div>
                  {c.members.filter((p) => p.list || p.inquiry).map((p) => (
                    <div key={'m' + p.row} className="text-[11px] text-[#8b95a1] leading-snug mb-0.5">📝 {p.name}: {p.list || p.inquiry}</div>
                  ))}
                  {c.conflicts.map((cf, j) => (
                    <div key={j} className={`text-[12px] font-semibold mt-1 ${cf.lv === 'block' ? 'text-[#f04452]' : cf.lv === 'check' ? 'text-[#b45309]' : 'text-[#8b95a1]'}`}>
                      {cf.lv === 'block' ? '🔴' : cf.lv === 'check' ? '🟡' : '⚪'} {cf.msg}
                      {cf.names && cf.names.map((nm) => (
                        <span key={nm} className="inline-flex items-center gap-0.5 ml-1">
                          <button onClick={() => addPlaceholderName(nm)} className="text-[11px] text-white bg-[#f04452] rounded px-1.5 py-0.5">+ {nm} 추가</button>
                          <button onClick={() => dismissMissing(nm)} className="text-[11px] text-[#8b95a1] bg-[#f2f4f6] rounded px-1.5 py-0.5">제외</button>
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
                            className="text-[12px] font-bold text-white bg-[#1b64da] rounded-lg px-3 py-1.5">추천 {c.fillCandidates.length}명 이 방에 추가</button>
                        </>
                      ) : (
                        <div className="text-[11px] text-[#8b95a1]">조정 제안: 조건(같은 성별·캠퍼스) 맞는 미배정자가 없어요. → 객실을 {c.members.length}인으로 줄이거나, 빈자리로 두거나, 다른 부분그룹과 합치세요.</div>
                      )}
                    </div>
                  )}
                  <button onClick={() => assignRoom(c.members.map((p) => p.row), c.label)} disabled={c.block || c.done}
                    className={`w-full mt-3 py-2.5 rounded-xl font-bold text-[13px] ${c.block || c.done ? 'bg-[#e5e8eb] text-[#8b95a1]' : 'bg-[#3182f6] text-white'}`}>
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
          const bookedGroups = {}; rows.forEach((r) => { if (!isChurchAssigned(r.occLabel)) (bookedGroups[r.gid] = bookedGroups[r.gid] || []).push(r) })
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
                  <button onClick={autoAssign} className="flex-1 py-3 rounded-xl bg-[#3182f6] text-white font-bold text-[13px]">자동 배치</button>
                  <button onClick={addRoom} className="px-4 py-3 rounded-xl bg-[#f2f4f6] text-[#4e5968] font-bold text-[13px]">+ 방</button>
                  <button onClick={saveAssign} className="flex-1 py-3 rounded-xl bg-[#191f28] text-white font-bold text-[13px]">저장</button>
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

        {tab === '그룹정리' && (() => {
          const live = rows.filter((r) => r.route !== '중복')
          const groups = {}; live.forEach((r) => { (groups[r.gid] = groups[r.gid] || []).push(r) })
          const gidList = Object.keys(groups)
          const repOf = (g) => (g.find((r) => (r.groupTotal || 0) > 0) || g[0]).rep || g[0].name
          const labelOf = (gid) => `${repOf(groups[gid])} 그룹 (${groups[gid].length})`
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
                {s1.length === 0 && s3.length === 0 && <p className="text-[12px] text-[#8b95a1]">의심 항목 없음</p>}
                {s1.map((s, i) => (
                  <div key={'s1' + i} className="py-2 border-b border-[#f7f8fa]">
                    <div className="text-[12px] font-bold text-[#191f28] mb-1">📞 같은 번호인데 {s.gids.length}개 그룹으로 나뉨</div>
                    <div className="text-[11px] text-[#8b95a1] mb-1">{s.gids.map((g) => labelOf(g)).join(' / ')}</div>
                    <button onClick={() => ask('이 그룹들을 합칠까요?', `같은 번호로 묶인 ${s.gids.length}개 그룹을 한 그룹으로 합칩니다.\n⚠ 비용이 다시 계산됩니다.`, () => { setMergeMsg('합치는 중…'); post({ action: 'mergeGroups', pin, gids: s.gids }).then((j) => { setMergeMsg(j.ok ? `✓ ${j.merged}명 합침` : '오류'); reload() }) }, '합치기')}
                      className="text-[12px] font-bold text-white bg-[#191f28] rounded-lg px-3 py-1.5">이 그룹들 합치기</button>
                  </div>
                ))}
                {s3.map((gid) => (
                  <div key={'s3' + gid} className="py-2 border-b border-[#f7f8fa] last:border-0">
                    <div className="text-[12px] font-bold text-[#191f28]">📝 {repOf(groups[gid])} 그룹 · 명단보다 제출 적음</div>
                    <div className="text-[11px] text-[#8b95a1]">{(groups[gid].find((r) => r.note) || {}).note || '명단에 미제출자 있음 — 미제출 추가/확인'}</div>
                  </div>
                ))}
              </Collapsible>

              {/* 그룹 기준 방 일괄 맞춤 */}
              <div className="bg-white rounded-2xl border border-[#f2f4f6] p-4 mb-3">
                <div className="text-[13px] font-bold text-[#191f28] mb-1">🛏️ 그룹 기준으로 방 맞추기</div>
                <div className="text-[11px] text-[#8b95a1] mb-2">예전에 합치거나 시트에서 직접 수정한 그룹은 방이 안 따라왔을 수 있어요. 지금 묶인 그룹대로 배정방(=대표 방)을 한 번에 맞춥니다. (개인 1명은 안 건드림)</div>
                <button onClick={syncAllRooms} disabled={!roomOutOfSync.length}
                  className={`w-full py-2.5 rounded-xl font-bold text-[13px] ${roomOutOfSync.length ? 'bg-[#191f28] text-white' : 'bg-[#f2f4f6] text-[#b0b8c1]'}`}>
                  {roomOutOfSync.length ? `방 안 맞는 ${roomOutOfSync.length}개 그룹 일괄 정렬` : '모든 그룹이 방과 동기화됨 ✓'}
                </button>
              </div>

              {/* 이름 검색 → 대상 그룹도 이름 검색 → 이동 */}
              <div className="bg-white rounded-2xl border border-[#f2f4f6] p-4 mb-3">
                <div className="text-[13px] font-bold text-[#191f28] mb-1">🔎 이름으로 이동</div>
                <div className="text-[11px] text-[#8b95a1] mb-2">그룹을 옮기거나 합치면 방 배정도 자동으로 같이 맞춰집니다.</div>
                {!movePick ? (
                  <>
                    <div className="text-[11px] text-[#8b95a1] mb-1.5">① 옮길 사람을 검색해 선택하세요</div>
                    <input value={moveQ} onChange={(e) => setMoveQ(e.target.value)} placeholder="옮길 사람 이름 검색" className="w-full bg-[#f9fafb] border border-[#e5e8eb] rounded-xl px-3 py-2.5 text-[14px] mb-2" />
                    {moveQ.trim() && (() => {
                      const matches = live.filter((r) => r.name.indexOf(moveQ.trim()) >= 0).slice(0, 12)
                      if (!matches.length) return <p className="text-[12px] text-[#8b95a1]">일치하는 이름 없음</p>
                      return matches.map((p) => (
                        <button key={p.row} onClick={() => { setMovePick(p); setMoveTargetQ('') }}
                          className="w-full flex items-center gap-2 py-1.5 border-b border-[#f7f8fa] last:border-0 text-left">
                          <span className="text-[13px] text-[#191f28] flex-1 min-w-0">{p.name}<span className="text-[10px] text-[#8b95a1] ml-1">현재: {repOf(groups[p.gid] || [p])} 그룹 · {deptName(p.deptLabel)}</span></span>
                          <span className="text-[12px] font-bold text-[#3182f6] shrink-0">선택 →</span>
                        </button>
                      ))
                    })()}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2 bg-[#eef5ff] rounded-xl px-3 py-2">
                      <span className="text-[13px] text-[#191f28] flex-1 min-w-0"><b>{movePick.name}</b><span className="text-[10px] text-[#8b95a1] ml-1">현재: {repOf(groups[movePick.gid] || [movePick]) } 그룹</span></span>
                      <button onClick={() => { setMovePick(null); setMoveQ(''); setMoveTargetQ('') }} className="text-[11px] text-[#8b95a1] underline shrink-0">다른 사람</button>
                    </div>
                    <div className="text-[11px] text-[#8b95a1] mb-1.5">② 옮길 그룹을 검색하세요 (그 그룹 사람 이름)</div>
                    <input value={moveTargetQ} onChange={(e) => setMoveTargetQ(e.target.value)} placeholder="대상 그룹의 아무 구성원 이름" className="w-full bg-[#f9fafb] border border-[#e5e8eb] rounded-xl px-3 py-2.5 text-[14px] mb-2" />
                    <button onClick={() => { moveMember(movePick.name, '__solo__'); setMovePick(null); setMoveQ(''); setMoveTargetQ('') }}
                      className="w-full text-[12px] text-[#4e5968] bg-[#f2f4f6] rounded-lg py-2 mb-2">{movePick.name}님 단독으로 분리</button>
                    {moveTargetQ.trim() && (() => {
                      const hit = live.filter((r) => r.name.indexOf(moveTargetQ.trim()) >= 0 && r.gid !== movePick.gid)
                      const seen = {}; const tgts = []
                      hit.forEach((r) => { if (!seen[r.gid]) { seen[r.gid] = true; tgts.push(r.gid) } })
                      if (!tgts.length) return <p className="text-[12px] text-[#8b95a1]">일치하는 그룹 없음</p>
                      return tgts.slice(0, 12).map((g) => (
                        <button key={g} onClick={() => { moveMember(movePick.name, g, labelOf(g)); setMovePick(null); setMoveQ(''); setMoveTargetQ('') }}
                          className="w-full flex items-center gap-2 py-1.5 border-b border-[#f7f8fa] last:border-0 text-left">
                          <span className="text-[13px] text-[#191f28] flex-1 min-w-0">{labelOf(g)}<span className="text-[10px] text-[#8b95a1] ml-1">{(groups[g] || []).length}명</span></span>
                          <span className="text-[12px] font-bold text-[#3182f6] shrink-0">여기로 이동 →</span>
                        </button>
                      ))
                    })()}
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-[#8b95a1]">합칠 그룹 체크</span>
                <button onClick={mergeSelected} disabled={selN < 2} className={`ml-auto text-[12px] font-bold px-3 py-1.5 rounded-lg ${selN >= 2 ? 'bg-[#191f28] text-white' : 'bg-[#e5e8eb] text-[#b0b8c1]'}`}>선택 {selN}그룹 합치기</button>
              </div>

              <Collapsible title={`전체 그룹 목록 (${gidList.length}그룹)`}>
              {gidList.map((gid) => (
                <div key={gid} className="bg-white rounded-2xl border border-[#f2f4f6] p-3 mb-2">
                  <label className="flex items-center gap-1.5 mb-2 cursor-pointer">
                    <input type="checkbox" checked={!!mergeSel[gid]} onChange={() => toggleMerge(gid)} className="w-4 h-4" />
                    <span className="text-[13px] font-bold text-[#191f28]">{labelOf(gid)}</span>
                  </label>
                  {groups[gid].map((p) => (
                    <div key={p.row} className="flex items-center gap-2 py-1 border-b border-[#f7f8fa] last:border-0">
                      <span className="text-[13px] text-[#191f28] flex-1">{p.name}<span className="text-[10px] text-[#8b95a1] ml-1">{(p.campus || '').replace(' 캠퍼스', '')}·{deptName(p.deptLabel)}</span></span>
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
                    <div className="text-[13px] font-bold text-[#191f28]">{g.rep} <span className="text-[11px] text-[#8b95a1] font-normal">그룹</span></div>
                    <div className="text-[11px] text-[#8b95a1] leading-snug">{g.note}</div>
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
            const Card = (r) => (
              <div key={r.row} className="bg-white rounded-2xl border border-[#f2f4f6] p-4">
                <div className="text-[13px] font-bold text-[#191f28]">{r.name} <span className="text-[11px] text-[#8b95a1] font-normal">{(r.campus || '').replace(' 캠퍼스', '')}·{deptName(r.deptLabel)}{r.contact ? ` · ${fmtPhone(r.contact)}` : ''}</span></div>
                <div className="text-[12px] text-[#4e5968] mt-1 whitespace-pre-wrap leading-relaxed">{r.inquiry}</div>
              </div>
            )
            if (qs.length === 0) return <div className="bg-white rounded-2xl border border-[#f2f4f6] p-4"><p className="text-[12px] text-[#8b95a1]">문의사항 없음</p></div>
            return (
              <div className="space-y-4">
                <HelpToggle>{`성도들이 남긴 문의를 맥락에 따라 자동으로 나눠 묶었습니다(입금 문의 / 입금 보고 / 방배정 요청 / 방배정 질문 / 기타).

• '없음/없습니다' 같은 빈 문의는 기본 숨김 — 아래 체크박스로 켜고 끌 수 있어요.
• 자동 분류라 가끔 틀릴 수 있으니 참고용으로 보세요.
• 방배정 요청은 '같은 방 요청' 탭에서 실제로 처리합니다.`}</HelpToggle>
                <label className="flex items-center gap-2 bg-white rounded-2xl border border-[#f2f4f6] p-3 text-[12px] text-[#4e5968] cursor-pointer">
                  <input type="checkbox" checked={showNoise} onChange={(e) => setShowNoise(e.target.checked)} className="w-4 h-4" />
                  내용 없는 문의("없음/없습니다") 보기 <span className="text-[#8b95a1]">({noiseN}건 숨김)</span>
                </label>
                {CATS.map((cat) => {
                  const items = grouped[cat.key] || []
                  if (!items.length) return null
                  return (
                    <div key={cat.key}>
                      <div className="text-[13px] font-bold text-[#191f28] mb-1.5 px-1">{cat.label} <span className="text-[11px] text-[#8b95a1] font-normal">{items.length}건 {cat.hint}</span></div>
                      <div className="space-y-2">{items.map(Card)}</div>
                    </div>
                  )
                })}
                {showNoise && noiseN > 0 && (
                  <div>
                    <div className="text-[13px] font-bold text-[#8b95a1] mb-1.5 px-1">🗒️ 내용 없음 <span className="text-[11px] font-normal">{noiseN}건</span></div>
                    <div className="space-y-2">{grouped.none.map(Card)}</div>
                  </div>
                )}
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
          <div className="mt-3 bg-white rounded-2xl border border-[#f2f4f6] p-4 text-[14px] text-[#4e5968] leading-relaxed">
            7/21(화)~23(목) · 델피노 리조트<br />
            등록기간 6/7~6/28 (선착순) · 문의 이흥배 목사 010-9584-7575<br />
            <span className="text-[#8b95a1] text-[13px]">* 새가족 과정 수료자에 한해 등록 가능</span>
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
              className={`flex-1 py-3.5 text-[14px] font-bold rounded-[12px] transition-all min-h-[48px] ${
                mode === k ? 'bg-white text-[#3182f6] shadow-md' : 'text-[#8b95a1]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {mode === '개인' ? <IndividualMode /> : mode === '그룹' ? <GroupMode /> : <LookupMode />}

        <p className="text-[13px] text-[#8b95a1] text-center mt-6 leading-relaxed">
          제출 후 <b>입금까지 완료</b>해야 등록이 확정됩니다.<br />
          환불은 등록기간 이후 어렵습니다.<br />
          가족·그룹은 대표자가 구성원을 모두 입력해 한 번에 제출합니다.
        </p>
      </div>
    </div>
  )
}
