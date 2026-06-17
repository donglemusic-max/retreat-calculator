# 2026 전교인 리트릿 등록 — 작업 히스토리 / 인계 문서

> 다른 Claude Code 세션이 이 파일만 읽고 바로 이어서 작업할 수 있게 정리한 핸드오프 노트.
> 사용자(임성현)는 **한국어 존댓말** 선호. 자동화 가능한 건 직접 돌려 검증 후 보고.
> **데이터 해석 표준은 `docs/DATA-GUIDE.md` (반드시 따를 것).**

## 0. 한 줄 요약
주님의교회 "2026 전교인 리트릿(BUILD HIS CHURCH, 7/21~23 델피노)" 등록을 위한 모바일 웹앱.
**계산 → 제출 → 본인 조회·수정 → 관리자(방배정·리마인드·통계)** 까지. 백엔드는 **구글시트 + Apps Script 웹앱**.

## 1. 기술 / 위치
- 프론트: Vite+React18+Tailwind3, **`src/App.jsx` 단일 파일**, 토스 스타일(#3182f6, Pretendard).
- 코드: `C:\Users\shlim\.claude\retreat-calc`
- GitHub: **donglemusic-max/retreat-calculator** (회사 shlim 아님 — 개인계정)
- 배포: Vercel donglemusic 계정 대시보드 import (push 시 자동배포). 프론트 변경은 push만 하면 됨.
- Apps Script: `apps-script/Migrate.gs`(enrich/정리) + `apps-script/Submit.gs`(웹앱: 제출/조회/수정/관리/합치기)

### 빌드/푸시 주의 (중요)
- 회사 CA: `NODE_EXTRA_CA_CERTS=C:\Users\shlim\.claude\ca-bundle.pem` 설정해야 npm/git 동작.
- git push: 기본 credential이 회사(shlim-op)라 막힘 → **항상**:
  ```
  gh auth switch --user donglemusic-max
  TOKEN=$(gh auth token)
  git push "https://donglemusic-max:${TOKEN}@github.com/donglemusic-max/retreat-calculator.git" master
  ```
- 커밋 author: donglemusic-max / donglemusic@gmail.com

## 2. 시트 두 개 (중요)
- **회사 사본** (MCP Google Drive로 읽기 가능): id `1joikU2T51wbvJc0c0BirueZFm6r8ZJh01ifBi72fRNU` ("리트릿"). 개발/검증용. 185행. 탭: 설문지응답 / **방배정용 정리 GPT**(사람이 수기 정리한 표 — 232명 기준) / 셀조직명단 / 카톡응대.
- **실사용 시트**(donglemusic/교회 소유, MCP로 못 읽음): 여기에 실제 웹앱 배포됨. 데이터가 더 많고 계속 쌓임.
- ⚠️ 개발 시 MCP로 회사 사본을 읽어 로직 검증하되, **실사용 시트는 사용자가 직접 enrich 실행/배포**해야 반영됨.

## 3. 웹앱 URL / 배포 (현재)
- 실사용 제출/조회/관리 엔드포인트(App.jsx `SUBMIT_URL` 기본값):
  `https://script.google.com/macros/s/AKfycbxSeDKQOKld3t4L6mAxS5beVV9XhWyQvHDr0PGo-ohx34CK1E1obvSC6Sz8XzDcCOgDUg/exec`
- **버전 확인**: 웹앱 URL을 브라우저로 GET → `{"version":"svN-..."}`. enrich는 토스트에 `[vN-...]`.
  - 현재 코드: enrich **v11-mergefee**, submit **sv7-mergefee**.
- ⚠️ Submit.gs/Migrate.gs 바꾸면 사용자가 **재배포(기존 배포 버전 올리기, URL 유지) / enrich 재실행** 해야 함. 버전 마커로 반영 여부 확인.
- ADMIN_PIN: Submit.gs 상단(기본 '2026', 운영시 변경 권장). 관리자 페이지 `사이트/#admin`.

## 4. 데이터 해석 핵심 (요약 — 상세는 docs/DATA-GUIDE.md)
- **헤더명 기준** 컬럼 읽기(인덱스 금지). 원본 응답 컬럼은 안 건드리고 **앱 컬럼**만 우측에 기록.
- **그룹 묶기 = union-find(이메일 ∪ 전화 ∪ 대표자G ∪ 오버라이드 강제그룹)**. 입금자명·명단(L)은 병합에 안 씀(과병합 위험) — 명단은 확인필요/방배정 페어링·예상인원에만.
- **전화 정규화**: phoneKey로 앞자리0 보정(숫자형 셀 1012345678 → 01012345678). enrich가 F열도 하이픈 정규화.
- **중복 dedup**: 같은 이름 1회만 집계(구버전 후순위), 중복행 제출경로='중복'·금액0.
- **비용(만원)**: 등록비(부서별), 객실(개인 1/4·그룹 6/24), 그룹비(7~8인0/6인5/…/1인50, 그룹당1회), 버스 3.8/인, 설악산 1/인. 객실은 occ가 "N인 투숙"이면 그룹가 1회, 아니면(교회배정/부분) 개인가 인당(본인객실).
- **신청유형**: 그룹(N인투숙)/부분(부분적으로)/개인(교회배정). **침구추가**=max(0,투숙인원−기본정원[패밀리4·스위트5·소노캄5]), 그룹만.
- **미제출 보존**: 명단>제출이면 확인필요. 관리자 요약에 "명단 기준 예상/미제출 추정"(미제출 이름 전체 1회씩, 부정확→추정).

## 5. Apps Script 함수 맵
### Migrate.gs (enrich, v11-mergefee)
- `enrichSheet()` — 응답탭 자동탐색(_findRespSheet_, getActiveSheet 안 씀) → 오버라이드 적용(메모리) → union-find 그룹 → dedup → 비용/신청유형/침구/확인필요 앱컬럼 기록 → F열 전화정규화. 토스트 `[v10-type] N그룹/총액`.
- `ensureOverrideTab()` — `오버라이드` 탭 생성. 컬럼: 대상이름(원본)|표시이름|부서|캠퍼스|교통|신청유형|**강제그룹(같은 값=한 그룹)**|배정방|비고.
- `_loadOverrides_()` — 오버라이드 읽기(이름 trim 키).
- `syncAssignFromGpt()` — "방배정용 정리 GPT" 탭의 방 구성을 응답시트 배정방으로 1회 싱크(이름매칭, 미매칭 토스트).
- `installOnFormSubmit()` — 폼제출 자동 enrich 트리거(옵션).
- 앱 컬럼: 제출경로/그룹ID/그룹대표(추정)/그룹인원(제출)/신청유형/1인등록비/본인객실/본인버스/본인설악산/그룹공동비용(객실+투숙)/그룹총액/침구추가/확인필요/비고. (+관리자: 입금확인/배정방/관리자메모)

### Submit.gs (웹앱 doPost, sv7-mergefee)
- doGet → {ok, version}. doPost는 `action`으로 분기:
  - `submit` 신규제출(개인1행/그룹N행), `lookup`(이름+전화, 그룹이면 전체), `update`(개인필드 수정+재계산)
  - `memberAdd`/`memberDelete`/`groupSet`(객실·투숙) — 그룹편집, 권한=그룹연락처 또는 PIN
  - `admin`(전체조회)/`adminSet`/`adminBatch`(field=assigned|paid|amemo, updates=[{row,value}]) — PIN
  - `mergeGroups`({gids,pin}) — 선택 그룹들을 오버라이드 강제그룹으로 묶고 enrichSheet() 재계산
- `_recalcGroupFull_` — 그룹 단위 재계산(occ는 그룹값 유지=부분그룹). `_verifyGroupAccess_`(PIN/연락처).

## 6. 프론트 (App.jsx)
- 탭: **개인 등록 / 가족·그룹 / 조회·수정**. `#admin` 해시 → AdminApp(PIN).
- 그룹: 구성원(이름·성별·부서·버스), 객실, 투숙(자동/수동), 설악산(전원), 입금방식(대표자일괄/등록비각자), SubmitSection(text/plain POST).
- 조회·수정: 이름+전화 조회. 그룹/그룹객실이면 **GroupEditor**(객실·투숙 변경, 구성원 추가[미제출자]/삭제), 개인이면 EditCard. **본인 부담 금액** 표시(실시간).
- AdminApp 탭: 요약(제출/명단예상/미입금/방배정/버스/설악산/확인필요/캠퍼스) / 방배정(DnD 보드 @dnd-kit, 미배정·요청확인[메모]·방박스, 자동배치=메모없는 사람 캠퍼스·옵션정원, **이미 구성된 그룹: 편집(오버레이 모달)·체크박스 합치기**) / 리마인드(미입금 다중선택 일괄확인·확인필요, 접이식) / 버스명단 / 문의.
- 전화: fmtPhone(010-1234-5678) 입력·표시 통일.

## 7. 현재 상태 / 마지막 작업
- 방금(v11/sv7 — **합치기 추가요금 버그 수정**): 합치기/강제그룹으로 재편성한 그룹에 **객실 그룹가·그룹비·침구가 안 붙어 조회 시 등록비만** 보이던 버그 해결.
  - 근본 원인: "그룹 여부"를 6번 문항 `"N인이 투숙"` 텍스트로만 판정 → 개인/부분 신청자를 합치면 그룹 취급이 안 됨(백엔드 요금 0 + 프론트 표시 게이트도 occ 텍스트 의존).
  - 수정: enrich에서 **강제그룹이고 아무도 N인투숙 안 골랐으면** 그룹으로 간주 → 객실 그룹가=대표자 5번 객실, 그룹비=합산 인원수(`groupFeeByCount_`), 침구=인원수 기준, **신청유형='그룹'** 기록. `_recalcGroupFull_`도 기존 신청유형='그룹'이면 그룹요금 유지(편집해도 안 깨짐). 프론트는 `appType==='그룹'`이면 그룹총액 표시. (기존 그룹=grpRow 있음은 불변 → 검증값 85그룹/64,338,000원 유지)
  - **곁다리 회귀도 수정**: sv6에서 doPost 관리자 가드에 `mergeGroups`/`addPlaceholder`가 빠져 두 액션이 도달 불가(dead code)였음 → 가드에 추가(합치기 자체가 작동하게 됨).
- **사용자 할 일**: ① Migrate.gs/Submit.gs 시트에 붙여넣고 enrich 재실행 + 웹앱 재배포(마커 v11-mergefee / sv7-mergefee 확인) ② 깨진 김연지 그룹 오버라이드 정리 후 재합치기 → 조회 시 그룹총액·추가요금 표시 확인.

## 8. 사용자(운영자)가 직접 하는 것
1. Migrate.gs/Submit.gs 변경 시 시트 Apps Script에 붙여넣기 → enrich 재실행 / 웹앱 재배포(버전 마커 확인).
2. 수기 판단(동명이인 A/B, 개별 케이스 §10, 그룹 강제병합)은 **오버라이드 탭** 또는 관리자 **합치기/편집**으로.
3. 입금확인 체크, 방배정 드래그·자동배치는 관리자에서.

## 9. 알려진 한계 / 백로그
- 명단→미제출자 부서/교통 추정, 그룹 내 교통/캠퍼스 분리(이혜란만 부산 등)는 자동 안 함 → 오버라이드/수기.
- 명단 기준 예상 인원은 자유텍스트라 ±오차(동명이인·메모). GPT 수기표(232)가 더 정확.
- 회사 사본 테스트행 "테스트삭제요망"(A2606...) 삭제 권유한 상태.
- 사람을 한 그룹에서 빼서 다른 그룹/미배정으로 옮기는 기능은 아직 없음(합치기·삭제·편집만).

## 10. 검증 기준값 (회사 사본, 변경 시 깨지면 안 됨)
- 그룹묶기 이메일∪전화∪대표자 + dedup → **85그룹 / 64,338,000원**(임성현 전화공유 시 4명 한 그룹).
- 개인 소노벨스위트 교회배정+버스+설악산 = 336,000. 부분그룹 2명등록·4인방 소노캄 = 996,000.
- enrich v10 토스트 / submit sv5 doGet 버전으로 배포 확인.
