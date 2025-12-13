# 투자일지 웹앱 개발 계획

## 주요 기능
1. 투자일지 작성 폼 (반복 요소 템플릿화)
2. 시간축 차트 (자산총액 변화 + 일지 기록 시점)
3. 차트 포인트 클릭 시 상세 일지 보기
4. 일지 목록 및 관리

## 구현할 파일들
1. `src/pages/Index.tsx` - 메인 대시보드 (차트 + 일지 목록)
2. `src/components/InvestmentChart.tsx` - 자산 변화 차트 컴포넌트
3. `src/components/JournalForm.tsx` - 투자일지 작성 폼
4. `src/components/JournalDetail.tsx` - 일지 상세보기 모달
5. `src/types/investment.ts` - 타입 정의
6. `src/hooks/useInvestmentData.ts` - 데이터 관리 훅
7. `src/lib/storage.ts` - 로컬스토리지 관리

## 데이터 구조
- 투자일지: 날짜, 자산총액, 해외주식, 국내주식, 현금, 평가금액, 매매내역, 심리체크, 시장이슈 등
- 차트 데이터: 시간축 + 자산총액 + 일지 포인트