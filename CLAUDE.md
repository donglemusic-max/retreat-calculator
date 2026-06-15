# 2026 전교인 리트릿 등록비 계산기 — 작업 히스토리 / 인계 문서

> 다른 Claude Code 세션이 이 문서만 읽고 맥락을 파악해 이어서 작업할 수 있도록 정리한 핸드오프 노트.
> (사용자는 한국어 존댓말 응답 선호)

## 한 줄 요약
주님의교회 "2026 전교인 리트릿(BUILD HIS CHURCH, 7/21~23 델피노리조트)" 구글폼 등록 안내를 보고,
복잡한 **등록비/추가비용을 자동 계산하고 입금을 항목별로 나눠 안내**해주는 모바일 웹 계산기.
접수 자체는 기존 구글폼이 담당, 이 앱은 금액 산정·입금 안내용.

## 기술 스택 / 구조
- Vite 5 + React 18 + Tailwind CSS 3 (JSX, TypeScript 아님)
- 핵심 로직과 UI 전부 `src/App.jsx` 단일 파일
- `src/index.css` : Tailwind 지시어 + Pretendard 폰트 + fade/slide-up 애니메이션
- 폰트: Pretendard CDN (`index.html`)
- 디자인 언어: 토스(Toss) 스타일 — primary `#3182f6`, 배경 `#f2f4f6`, 카드 흰색 라운드, 모바일 폭 `max-w-[480px]`
  - 회사의 기존 "인터넷 요금 계산기 / 위약금 계산기"와 톤 통일

## 빌드 / 로컬 실행
```bash
npm install
npm run dev      # 로컬 개발
npm run build    # 프로덕션 (dist/)
```
⚠️ **회사 네트워크 CA 이슈**: npm/git/vercel 등 Node 도구가 self-signed cert 오류를 내면
`NODE_EXTRA_CA_CERTS=C:\Users\shlim\.claude\ca-bundle.pem` 환경변수를 설정하고 실행할 것.

## 요금 계산 로직 (구글폼 해석 → 코드 반영한 가정)
`src/App.jsx` 상단 상수에 데이터 정의(`DEPTS`, `ROOMS`, `OCCUPANCY`, `BUS_FEE`, `SEORAK_FEE`).

- **등록비 (개인 비용, 부서별)**: 장년/청년 278,000 ~ 영아부(돌전) 178,000원
- **객실 추가비용** — 개인 등록은 인당 / 그룹 신청은 객실당:
  - 소노벨 패밀리: 0
  - 소노벨 스위트: [그룹] 6만 / [개인] 1만
  - 소노캄 스위트: [그룹] 24만 / [개인] 4만
- **투숙 인원 추가비용 (그룹 비용, 객실당)**: 7~8인 0 / 6인 5만 / 5인 10만 / 4인 20만 / 3인 30만 / 2인 40만 / 1인 50만
- **버스 (개인)**: 왕복 1인 38,000원
- **설악산뷰 (개인)**: 1인 10,000원
- 객실 추가비용과 투숙인원 추가비용은 **둘 다 그룹 비용이라 합산**됨
- 버스·설악산뷰는 인당 → 그룹은 신청 인원수만큼 합산

### 입금 분할 (핵심 가치)
교회가 입금을 항목별로 따로 받기를 원함. 앱은 다음 항목으로 쪼개 안내:
`등록비 / 객실선택 / 가족(그룹) / 버스비 / 설악산` — 각각 입금자명(개인=본인, 그룹=대표자) 붙여서.
"입금 안내 문구 복사하기" 버튼으로 카톡 전송용 텍스트 한 번에 복사.

### 모드
- **개인 등록** 탭 / **가족·그룹 등록** 탭 (그룹은 구성원 추가, 대표자명으로 입금)

## 도움말 (구글폼 설명 담기)
`HELP` 상수에 구글폼 안내문 원문을 항목별로 보관.
각 카드 제목 옆 **ⓘ 아이콘** 탭 → 하단 시트(`HelpModal`)로 표시. 헤더에 "등록 안내 전체보기" 버튼(전체 안내).
→ 메인 화면은 깔끔하게, 상세 설명은 필요할 때만 펼치는 progressive disclosure 방식.

## 배포 (중요 — 계정 분리)
- **GitHub**: `donglemusic-max/retreat-calculator` (사용자 개인 계정. **회사 계정 shlim/shlim-op 아님!**)
- **Vercel**: donglemusic 계정에 **대시보드 import** 방식으로 연결 (vercel.com/new).
  - Vercel CLI는 회사 계정(`shlim-7675`)만 로그인돼 있어 CLI 배포 사용 안 함.
  - 대시보드 연결 시 push 하면 자동 재배포됨. (Vite 자동 감지: build `npm run build`, output `dist`)

### ⚠️ git push 주의 (계정 충돌)
이 머신은 gh에 회사(`shlim-op`)와 개인(`donglemusic-max`) 두 계정이 있고,
기본 credential helper가 회사 계정을 잡아 push가 403으로 막힘. 개인 계정으로 push하는 절차:
```bash
gh auth switch --user donglemusic-max
TOKEN=$(gh auth token)
git push "https://donglemusic-max:${TOKEN}@github.com/donglemusic-max/retreat-calculator.git" master
```
(gh active 계정이 종종 shlim-op로 되돌아가니 push 직전 항상 switch 확인)

## 현재 상태 (2026-06-15 기준)
- [x] 계산 로직 + 개인/그룹 모드 UI 완성, 빌드 통과, 4개 시나리오 수동 검증 완료
- [x] GitHub donglemusic-max에 push
- [x] 도움말 ⓘ + 하단 시트 추가
- [ ] Vercel 대시보드 연결은 **사용자가 직접 진행 중** (URL 미확정)

## 다음에 할 수 있는 일 (사용자와 논의된 백로그)
1. **구글폼 prefill 연동 (추천)**: 계산 결과를 들고 "신청서 작성하러 가기" → 값이 미리 채워진 구글폼 열기.
   - 구글폼 prefill URL(`?usp=pp_url&entry.xxx=값`) 사용. 폼의 각 `entry.id` 추출 필요.
   - 폼 편집/응답 권한 있는 구글 계정 필요.
2. (더 큰 작업) 구글시트 직접 제출(Apps Script) 또는 자체 신청 시스템(Supabase+관리자) — 사용자가 부담 인지함, 보류.
3. 도움말 문구 다듬기 / ⓘ 추가 항목은 사용자 피드백 대기.

## 검증 메모
초기 시나리오 검증값 (변경 시 깨지면 안 됨):
- 개인: 장년부+소노캄(개인4만)+버스+설악산 = **366,000원**
- 그룹: 4인(장년x2+초등+유년)+소노벨스위트(그룹6만)+4인투숙(20만)+전원버스+2명설악산 = **1,464,000원** (1인 366,000)
- 그룹: 8인 전원 장년부+소노캄(그룹24만)+7~8인투숙 = **2,464,000원** (1인 308,000)
