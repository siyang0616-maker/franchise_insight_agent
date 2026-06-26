import { analyzeReferencePosts } from "./reference-style-analyzer.mjs";

const DEFAULT_RESEARCH_KEYS = ["cost", "area", "brandTrust", "newVsTransfer", "operationRisk"];
const DEFAULT_QUALITY_KEYS = ["searchIntent", "proof", "checklist", "naturalTone", "localTrust"];
const DEFAULTS = {
  hookFocus: "매출 대비 창업비용",
  writingTone: "전문가 상담형",
  ctaStyle: "부드러운 상담 유도",
  target: "예비 창업자 또는 양수자",
  message: "내 예산과 운영 가능성에 맞는지 비교",
  ruleVersion: "rule2",
  mode: "hybrid",
  length: "naver"
};

const AWKWARD_PHRASES = [
  "흐름라는",
  "수요을",
  "조건라는",
  "장점라는",
  "구조라는",
  "고객 동선를",
  "상권을 확인됩니다",
  "매출을 보여집니다",
  "판단됩니다만",
  "추천 근거로 드러납니다",
  "이 부분은 중요합니다만",
  "본 매물은 좋은 매물입니다"
];

const FORBIDDEN_EXPRESSIONS = [
  "키워드",
  "문단",
  "SEO 점수",
  "상위노출 전략",
  "개발자 메모",
  "내부 메모",
  "최고",
  "무조건",
  "확실한 수익",
  "수익 보장",
  "보장됩니다",
  "100%",
  "좋은 매장입니다",
  "추천드립니다"
];

const PROOF_TERMS = ["POS", "임대료", "인건비", "원가율", "배달비중", "본사승인"];
const BAD_NUMERIC_CLAIM_TERMS = ["점포", "전국", "업계 1위", "공식"];
const WEAK_SENTENCE_PATTERNS = [
  /창업 전에 확인해야 할 부분이 많습니다/,
  /상권이 좋아 안정적인 운영이 가능합니다/,
  /브랜드 인지도가 높아 양도양수에 적합합니다/,
  /확인해야 (?:합니다|한다)/,
  /점검해야 (?:합니다|한다)/,
  /중요합니다|중요하다/,
  /봐야 (?:합니다|한다)/,
  /보는 것이 좋습니다/,
  /보는 편이 좋습니다/,
  /자료로 살피는 편이 좋습니다/,
  /세부 메모가 더해지면 상담 전 비교 기준을 더 좁힐 수 있습니다/,
  /최근 이슈는 검증된 자료가 있을 때만 본문에서 확정적으로 다루는 편이 안전합니다/,
  /유동인구라는 말만으로 결론을 내리기보다/,
  /상담 전 가장 먼저 받아볼 자료입니다/,
  /리스크도 분명히 남습니다/,
  /조건만 보면 좋아 보여도/,
  /월매출 .*은 결과 숫자일 뿐이고/,
  /창업비용 .*은 총액보다 구성과 회수 가능성이 중요합니다/,
  /낮아 보이는 금액도 리뉴얼이나 장비 교체가 남아 있으면 실제 부담이 커질 수 있습니다/,
  /프랜차이즈 업종 안에서 브랜드 수요, 상권 적합성, 운영 안정성 같은 요소가 중요한 브랜드입니다/
];

function ctx(data) {
  return data;
}

const BRAND_CONTEXTS = {
  "메가커피": ctx({
    category: "저가 커피",
    customerBase: ["출근길 고객", "학생층", "주거지 반복 구매"],
    operatingTraits: ["빠른 제조", "테이크아웃 회전", "피크타임 대응"],
    transferAdvantages: ["브랜드 인지도", "기존 단골", "검증된 회전율"],
    riskChecks: ["주변 저가커피 경쟁", "인건비", "임대료", "원가율"],
    contentAngles: ["생활밀착형 커피 수요", "빠른 회전", "반복 구매"],
    avoidClaims: ["브랜드 이름만으로 안정성을 단정하지 않기"],
    validationTerms: ["저가 커피", "테이크아웃", "반복 구매", "빠른 제조", "피크타임"]
  }),
  "컴포즈커피": ctx({
    category: "저가 커피",
    customerBase: ["가성비 음료 고객", "학생층", "직장인"],
    operatingTraits: ["대용량 음료 제조", "테이크아웃", "피크타임 주문 처리"],
    transferAdvantages: ["반복 방문", "합리적 가격대", "기존 고객층"],
    riskChecks: ["상권 내 저가커피 포화", "임대료", "인건비", "원가율"],
    contentAngles: ["대용량 커피", "생활 동선", "반복 방문"],
    avoidClaims: ["모든 상권에서 안정적이라고 단정하지 않기"],
    validationTerms: ["대용량", "합리적 가격", "테이크아웃", "반복 방문", "생활 동선"]
  }),
  "우지커피": ctx({
    category: "성장형 커피",
    customerBase: ["젊은 고객층", "동네 단골", "감성 커피 선호 고객"],
    operatingTraits: ["시그니처 음료", "브랜드 이미지 관리", "테이크아웃 대응"],
    transferAdvantages: ["성장 브랜드 선점", "기존 리뷰", "젊은 상권 적합성"],
    riskChecks: ["지역별 인지도 차이", "경쟁 카페", "피크타임 인력"],
    contentAngles: ["시그니처 음료", "젊은 고객층", "성장 브랜드"],
    avoidClaims: ["전국 대중 인지도를 단정하지 않기"],
    validationTerms: ["시그니처", "젊은 고객층", "성장 브랜드", "브랜드 이미지", "동네 단골"]
  }),
  "빽다방": ctx({
    category: "저가 커피",
    customerBase: ["대중 고객", "출근 동선 고객", "생활상권 반복 고객"],
    operatingTraits: ["테이크아웃 회전", "디저트 동반 구매", "시간대별 음료 수요"],
    transferAdvantages: ["브랜드 친숙도", "폭넓은 고객층", "기존 매출 흐름"],
    riskChecks: ["주변 경쟁 브랜드", "임대료", "인건비", "피크타임 회전"],
    contentAngles: ["저가커피 수요", "출근 동선", "생활밀착형 상권"],
    avoidClaims: ["고급 체류형 카페처럼 설명하지 않기"],
    validationTerms: ["저가커피", "출근 동선", "생활밀착형", "브랜드 친숙도", "테이크아웃"]
  }),
  "투썸플레이스": ctx({
    category: "디저트 카페",
    customerBase: ["모임 고객", "선물 수요", "디저트 구매 고객"],
    operatingTraits: ["케이크 관리", "객단가 관리", "홀과 배달 균형"],
    transferAdvantages: ["프리미엄 이미지", "케이크 수요", "기존 내방 고객"],
    riskChecks: ["상품 폐기", "인건비", "임대료", "객단가 변동"],
    contentAngles: ["디저트 수요", "선물 수요", "객단가"],
    avoidClaims: ["저가커피 회전율 중심으로 설명하지 않기"],
    validationTerms: ["디저트", "케이크", "객단가", "선물", "프리미엄"]
  }),
  "서브웨이": ctx({
    category: "샌드위치 외식",
    customerBase: ["직장인", "학생", "가벼운 식사 고객"],
    operatingTraits: ["재료 신선도", "주문 응대", "피크타임 동선"],
    transferAdvantages: ["식사 대체 수요", "브랜드 인지도", "기존 리뷰"],
    riskChecks: ["재료 관리", "인건비", "임대료", "본사승인"],
    contentAngles: ["식사 대체", "건강식 이미지", "점심 수요"],
    avoidClaims: ["커피 회전율로 설명하지 않기"],
    validationTerms: ["샌드위치", "식사 대체", "재료 신선도", "주문 응대", "점심 수요"]
  }),
  "배스킨라빈스": ctx({
    category: "아이스크림 디저트",
    customerBase: ["가족 고객", "학생층", "기념일 선물 수요"],
    operatingTraits: ["계절 매출", "케이크 재고", "배달과 포장"],
    transferAdvantages: ["높은 브랜드 인지도", "가족 고객층", "아이스크림 케이크 수요"],
    riskChecks: ["계절 편차", "상품 폐기", "냉동 설비", "임대료"],
    contentAngles: ["가족 고객층", "아이스크림 케이크", "간식 수요"],
    avoidClaims: ["사계절 매출이 같다고 쓰지 않기"],
    validationTerms: ["아이스크림", "케이크", "가족 고객", "계절", "선물"]
  }),
  "파리바게뜨": ctx({
    category: "베이커리",
    customerBase: ["생활밀착형 고객", "아침 식사 고객", "간식과 케이크 구매 고객"],
    operatingTraits: ["제조와 진열", "폐기 관리", "아침 피크 대응"],
    transferAdvantages: ["생활 수요", "케이크 선물 수요", "브랜드 신뢰"],
    riskChecks: ["폐기율", "인건비", "제조 난이도", "본사 운영 기준"],
    contentAngles: ["아침 수요", "간식 수요", "케이크 선물 수요"],
    avoidClaims: ["폐기와 제조 난이도를 빼고 쉽게 설명하지 않기"],
    validationTerms: ["베이커리", "아침", "간식", "케이크", "폐기"]
  }),
  "맘스터치": ctx({
    category: "버거·치킨",
    customerBase: ["학생층", "가족 고객", "배달 고객"],
    operatingTraits: ["주방 동선", "조리 피크", "배달 포장"],
    transferAdvantages: ["버거와 치킨 복합 수요", "점심·저녁 피크", "기존 리뷰"],
    riskChecks: ["배달 수수료", "인건비", "조리 난이도", "원가율"],
    contentAngles: ["버거 수요", "치킨 수요", "배달 포장"],
    avoidClaims: ["조리 난이도를 낮게 단정하지 않기"],
    validationTerms: ["버거", "치킨", "배달", "주방 동선", "조리"]
  }),
  "노모어피자": ctx({
    category: "피자",
    customerBase: ["젊은 고객층", "배달 고객", "포장 고객"],
    operatingTraits: ["배달·포장 운영", "광고 반응", "피크타임 조리"],
    transferAdvantages: ["브랜드 인지도 상승", "배달 포장 수요", "젊은 고객층"],
    riskChecks: ["광고비", "배달 수수료", "원가율", "상권 내 피자 경쟁"],
    contentAngles: ["브랜드 인지도 상승", "배달/포장 수요", "젊은 고객층"],
    avoidClaims: ["특정 광고모델이나 최신 캠페인을 단정하지 않기"],
    validationTerms: ["피자", "배달", "포장", "젊은 고객층", "광고"]
  }),
  "샐러디": ctx({
    category: "건강식·간편식",
    customerBase: ["직장인", "건강식 선호 고객", "운동 고객"],
    operatingTraits: ["신선재료 관리", "점심 피크", "배달 포장"],
    transferAdvantages: ["건강식 트렌드", "식사 대용 수요", "오피스 점심 수요"],
    riskChecks: ["재료 폐기", "원가율", "배달 수수료", "상권 적합성"],
    contentAngles: ["건강식", "식사 대용", "오피스 점심"],
    avoidClaims: ["모든 상권에 맞는다고 쓰지 않기"],
    validationTerms: ["건강식", "식사 대용", "신선재료", "점심", "배달"]
  }),
  "포케올데이": ctx({
    category: "포케·건강식",
    customerBase: ["건강식 고객", "직장인", "배달 재주문 고객"],
    operatingTraits: ["토핑 준비", "신선재료", "포장 품질"],
    transferAdvantages: ["포케 전문성", "프리미엄 간편식", "배달 재주문"],
    riskChecks: ["재료 폐기", "원가율", "배달 수수료", "상권 수요"],
    contentAngles: ["포케 전문", "건강한 한 끼", "재주문"],
    avoidClaims: ["대중 패스트푸드처럼 과장하지 않기"],
    validationTerms: ["포케", "건강한 한 끼", "토핑", "신선재료", "재주문"]
  }),
  "슬로우캘리": ctx({
    category: "포케·웰니스 외식",
    customerBase: ["여성 고객층", "직장인", "웰니스 식사 고객"],
    operatingTraits: ["신선재료", "포장 품질", "피크타임 대응"],
    transferAdvantages: ["웰니스 이미지", "포케·보울 구성", "젊은 고객층"],
    riskChecks: ["재료 폐기", "원가율", "상권 고객층", "배달 수수료"],
    contentAngles: ["웰니스", "건강한 한 끼", "여성 고객층"],
    avoidClaims: ["감성 이미지로만 설명하지 않기"],
    validationTerms: ["웰니스", "포케", "보울", "여성 고객층", "신선재료"]
  }),
  "샤브로21": ctx({
    category: "1인 샤브 외식",
    customerBase: ["혼밥 고객", "직장인", "젊은 외식 고객"],
    operatingTraits: ["테이블 회전", "주방 동선", "점심·저녁 피크"],
    transferAdvantages: ["1인 샤브 수요", "식사 매출", "경험형 외식"],
    riskChecks: ["인건비", "원가율", "회전율", "주방 운영"],
    contentAngles: ["1인 샤브", "혼밥 수요", "테이블 회전"],
    avoidClaims: ["테이크아웃 브랜드처럼 설명하지 않기"],
    validationTerms: ["샤브", "혼밥", "테이블 회전", "주방", "식사"]
  }),
  "샤브보트": ctx({
    category: "1인 샤브 외식",
    customerBase: ["혼밥 고객", "오피스 점심 고객", "가벼운 외식 고객"],
    operatingTraits: ["1인 좌석", "회전율", "식재료 준비"],
    transferAdvantages: ["1인 식사 수요", "오피스 점심", "기존 고객 흐름"],
    riskChecks: ["원가율", "인건비", "피크타임 회전", "임대료"],
    contentAngles: ["1인 샤브", "오피스 점심", "혼밥"],
    avoidClaims: ["배달 중심 브랜드처럼 설명하지 않기"],
    validationTerms: ["샤브", "1인", "혼밥", "회전율", "오피스"]
  }),
  "롯데리아": ctx({
    category: "패스트푸드",
    customerBase: ["학생층", "가족 고객", "직장인"],
    operatingTraits: ["주문 포장", "배달", "피크타임 조리"],
    transferAdvantages: ["높은 브랜드 친숙도", "전 연령 수요", "기존 리뷰"],
    riskChecks: ["인건비", "원가율", "배달 수수료", "장비 상태"],
    contentAngles: ["버거 수요", "가족 고객", "배달·포장"],
    avoidClaims: ["건강식 브랜드처럼 설명하지 않기"],
    validationTerms: ["패스트푸드", "버거", "가족 고객", "배달", "포장"]
  }),
  "한촌설렁탕": ctx({
    category: "한식",
    customerBase: ["중장년층", "가족 고객", "직장인 점심 고객"],
    operatingTraits: ["주방 숙련도", "점심 피크", "포장과 배달"],
    transferAdvantages: ["식사 수요", "생활밀착형 한식", "기존 단골"],
    riskChecks: ["주방 인력", "원가율", "임대료", "배달 수수료"],
    contentAngles: ["한식 식사 수요", "중장년 고객", "점심 매출"],
    avoidClaims: ["가벼운 간식 브랜드처럼 설명하지 않기"],
    validationTerms: ["한식", "설렁탕", "점심", "중장년", "주방"]
  }),
  "맘스터치": ctx({
    category: "버거 외식",
    customerBase: ["학생층", "가족 고객", "배달 의존 고객"],
    operatingTraits: ["치킨버거 조리", "배달 비중 관리", "피크타임 인력 운영"],
    transferAdvantages: ["가성비 인지도", "배달 채널 안착", "기존 단골"],
    riskChecks: ["배달앱 수수료", "인건비", "원가율", "임대료"],
    contentAngles: ["가성비 버거 수요", "배달 매출 비중", "학생·가족 고객"],
    avoidClaims: ["프리미엄 버거처럼 설명하지 않기"],
    validationTerms: ["가성비", "배달 비중", "치킨버거", "학생층", "피크타임"]
  }),
  "버거킹": ctx({
    category: "글로벌 버거",
    customerBase: ["직장인", "가족 고객", "드라이브스루 이용 고객"],
    operatingTraits: ["대용량 주문 처리", "매장 표준화 운영", "피크타임 회전"],
    transferAdvantages: ["글로벌 브랜드 인지도", "기존 매출 흐름", "검증된 운영 매뉴얼"],
    riskChecks: ["본사 로열티", "원가율", "인건비", "임대료"],
    contentAngles: ["글로벌 브랜드 신뢰도", "드라이브스루 동선", "패밀리 수요"],
    avoidClaims: ["로컬 브랜드처럼 친숙함만 강조하지 않기"],
    validationTerms: ["글로벌 브랜드", "드라이브스루", "표준화 운영", "패밀리 수요", "로열티"]
  }),
  "맥도날드": ctx({
    category: "글로벌 버거",
    customerBase: ["전 연령대 고객", "가족 고객", "드라이브스루·배달 고객"],
    operatingTraits: ["대형 매장 운영", "24시간 대응 가능성", "키오스크·배달 채널 관리"],
    transferAdvantages: ["글로벌 최상위 인지도", "검증된 운영 시스템", "다채널 매출 구조"],
    riskChecks: ["본사 로열티", "초기 투자 규모", "인건비", "임대료"],
    contentAngles: ["전 연령대 수요", "다채널 매출", "운영 시스템 표준화"],
    avoidClaims: ["소규모 매장처럼 초기비용을 단정하지 않기"],
    validationTerms: ["글로벌 인지도", "다채널 매출", "표준화 시스템", "전 연령대", "드라이브스루"]
  }),
  "교촌치킨": ctx({
    category: "프리미엄 치킨",
    customerBase: ["배달 의존 고객", "가족 모임 고객", "단골 재구매 고객"],
    operatingTraits: ["조리 표준 준수", "배달 동선 관리", "피크타임(저녁·주말) 대응"],
    transferAdvantages: ["프리미엄 치킨 인지도", "재구매율", "기존 배달 단골"],
    riskChecks: ["원가율", "배달앱 수수료", "인건비", "본사승인"],
    contentAngles: ["프리미엄 치킨 수요", "저녁·주말 매출", "배달 재구매"],
    avoidClaims: ["저가 치킨처럼 가격 경쟁력을 강조하지 않기"],
    validationTerms: ["프리미엄 치킨", "재구매율", "배달 동선", "저녁·주말 매출", "단골"]
  }),
  "BBQ": ctx({
    category: "치킨 외식",
    customerBase: ["가족 모임 고객", "배달 고객", "단체 주문 고객"],
    operatingTraits: ["조리 표준 준수", "배달 동선 관리", "피크타임(저녁·주말) 대응"],
    transferAdvantages: ["넓은 브랜드 인지도", "기존 배달 단골", "검증된 매출 흐름"],
    riskChecks: ["원가율", "배달앱 수수료", "인건비", "본사승인"],
    contentAngles: ["인지도 높은 치킨", "저녁·주말 매출", "단체·모임 수요"],
    avoidClaims: ["프리미엄 단가만으로 수익성을 단정하지 않기"],
    validationTerms: ["브랜드 인지도", "단체 주문", "배달 동선", "저녁·주말 매출", "원가율", "조리 표준"]
  }),
  "BHC": ctx({
    category: "치킨 외식",
    customerBase: ["배달 의존 고객", "젊은 고객층", "단골 재구매 고객"],
    operatingTraits: ["조리 표준 준수", "배달 동선 관리", "피크타임(저녁·주말) 대응"],
    transferAdvantages: ["젊은 고객층 선호", "기존 배달 단골", "검증된 매출 흐름"],
    riskChecks: ["원가율", "배달앱 수수료", "인건비", "본사승인"],
    contentAngles: ["젊은 고객층 치킨 수요", "저녁·주말 매출", "배달 재구매"],
    avoidClaims: ["전 연령대 동일 수요라고 단정하지 않기"],
    validationTerms: ["젊은 고객층", "배달 재구매", "저녁·주말 매출", "조리 표준", "원가율"]
  }),
  "굽네치킨": ctx({
    category: "건강 치킨",
    customerBase: ["건강 지향 고객", "배달 의존 고객", "가족 고객"],
    operatingTraits: ["오븐 조리 표준", "배달 동선 관리", "피크타임(저녁·주말) 대응"],
    transferAdvantages: ["건강식 이미지", "기존 배달 단골", "검증된 매출 흐름"],
    riskChecks: ["오븐 설비 관리", "배달앱 수수료", "인건비", "본사승인"],
    contentAngles: ["건강식 치킨 수요", "저녁·주말 매출", "배달 재구매"],
    avoidClaims: ["일반 튀김 치킨과 동일하게 설명하지 않기"],
    validationTerms: ["건강식 이미지", "오븐 조리", "배달 재구매", "저녁·주말 매출", "가족 고객"]
  }),
  "본죽": ctx({
    category: "죽·한식 외식",
    customerBase: ["환자·회복기 고객", "1인 가구", "건강식 선호 고객"],
    operatingTraits: ["소량 다품종 조리", "포장·배달 비중 관리", "재료 신선도 관리"],
    transferAdvantages: ["건강식 이미지", "꾸준한 포장 수요", "기존 단골"],
    riskChecks: ["재료 원가율", "인건비", "임대료", "포장 용기비"],
    contentAngles: ["건강식 수요", "1인 가구 포장", "회복기 식사 대체"],
    avoidClaims: ["대중 외식처럼 회전율을 단정하지 않기"],
    validationTerms: ["건강식", "포장 수요", "1인 가구", "재료 신선도", "꾸준한 수요"]
  }),
  "한솥도시락": ctx({
    category: "도시락 외식",
    customerBase: ["직장인", "학생", "1인 가구"],
    operatingTraits: ["테이크아웃 회전", "점심 피크타임 대응", "재료 준비 효율"],
    transferAdvantages: ["가성비 인지도", "점심 단골 수요", "기존 매출 흐름"],
    riskChecks: ["원가율", "인건비", "임대료", "점심 외 시간대 매출 공백"],
    contentAngles: ["가성비 점심 수요", "테이크아웃 회전", "직장인·학생 동선"],
    avoidClaims: ["저녁·주말 매출까지 균일하다고 단정하지 않기"],
    validationTerms: ["가성비", "점심 수요", "테이크아웃", "직장인", "회전율"]
  }),
  "역전할머니맥주": ctx({
    category: "주류 외식",
    customerBase: ["20·30대 고객", "단체 모임 고객", "야간 매출 의존 고객"],
    operatingTraits: ["야간 피크타임 대응", "안주 메뉴 관리", "테이블 회전율 관리"],
    transferAdvantages: ["가성비 주점 인지도", "기존 단골", "야간 매출 검증"],
    riskChecks: ["야간 인건비", "임대료", "주류 원가율", "상권 야간 유동"],
    contentAngles: ["가성비 주점 수요", "야간 매출", "20·30대 모임"],
    avoidClaims: ["낮 시간대 매출까지 동일하다고 단정하지 않기"],
    validationTerms: ["가성비 주점", "야간 매출", "테이블 회전율", "20·30대", "모임 수요"]
  }),
  "홍콩반점": ctx({
    category: "중식 외식",
    customerBase: ["가족 고객", "배달 의존 고객", "점심 직장인 고객"],
    operatingTraits: ["조리 표준 준수", "배달 동선 관리", "점심·저녁 피크타임 대응"],
    transferAdvantages: ["중식 프랜차이즈 인지도", "기존 배달 단골", "검증된 매출 흐름"],
    riskChecks: ["원가율", "배달앱 수수료", "인건비", "본사승인"],
    contentAngles: ["중식 배달 수요", "점심·저녁 매출", "가족 고객"],
    avoidClaims: ["개인 중식당과 동일한 마진 구조라고 단정하지 않기"],
    validationTerms: ["중식 프랜차이즈", "배달 수요", "점심·저녁 매출", "가족 고객", "조리 표준"]
  }),
  "던킨": ctx({
    category: "도넛·디저트 카페",
    customerBase: ["출근길 고객", "선물·모임 수요", "테이크아웃 고객"],
    operatingTraits: ["도넛 진열 관리", "테이크아웃 회전", "시즌 메뉴 대응"],
    transferAdvantages: ["브랜드 친숙도", "선물 수요", "기존 단골"],
    riskChecks: ["폐기율", "인건비", "임대료", "원가율"],
    contentAngles: ["도넛 선물 수요", "출근길 테이크아웃", "시즌 메뉴"],
    avoidClaims: ["커피 전문점처럼 체류형 수요를 단정하지 않기"],
    validationTerms: ["도넛", "선물 수요", "테이크아웃", "시즌 메뉴", "출근길"]
  }),
  "파스쿠찌": ctx({
    category: "디저트 카페",
    customerBase: ["모임 고객", "디저트 구매 고객", "직장인 휴게 수요"],
    operatingTraits: ["케이크·디저트 관리", "객단가 관리", "홀 운영"],
    transferAdvantages: ["프리미엄 카페 이미지", "디저트 수요", "기존 내방 고객"],
    riskChecks: ["상품 폐기", "인건비", "임대료", "객단가 변동"],
    contentAngles: ["디저트 수요", "모임 공간", "객단가"],
    avoidClaims: ["저가커피 회전율 중심으로 설명하지 않기"],
    validationTerms: ["디저트", "모임 공간", "객단가", "프리미엄 카페", "홀 운영"]
  }),
  "공차": ctx({
    category: "음료 전문점",
    customerBase: ["학생층", "젊은 고객층", "테이크아웃 고객"],
    operatingTraits: ["음료 제조 표준", "테이크아웃 회전", "피크타임(방과후) 대응"],
    transferAdvantages: ["젊은 고객층 인지도", "기존 단골", "검증된 회전율"],
    riskChecks: ["원가율", "인건비", "임대료", "주변 음료 브랜드 경쟁"],
    contentAngles: ["젊은 고객층 음료 수요", "방과후 동선", "테이크아웃 회전"],
    avoidClaims: ["전 연령대 동일 수요라고 단정하지 않기"],
    validationTerms: ["젊은 고객층", "테이크아웃", "방과후 동선", "음료 전문점", "회전율"]
  })
};

BRAND_CONTEXTS["베스킨라빈스"] = BRAND_CONTEXTS["배스킨라빈스"];
BRAND_CONTEXTS["파리바게트"] = BRAND_CONTEXTS["파리바게뜨"];

const DEFAULT_BRAND_POOL = {
  expertSentences: ["프랜차이즈 인수는 브랜드 이름보다 해당 매장의 고객 흐름과 비용 구조를 같이 읽어야 한다."],
  buyerConcerns: ["예비 양수인은 매출 숫자보다 직접 운영했을 때 감당 가능한 업무 강도를 궁금해한다."],
  transferLogic: ["양도양수는 이미 형성된 고객 반응을 보고 시작할 수 있지만, 기존 운영의 약점도 같이 승계될 수 있다."],
  operationRisks: ["임대료, 인건비, 원가율이 맞지 않으면 월매출이 높아도 실제 회수기간은 길어질 수 있다."],
  verificationPoints: ["최근 POS 매출, 임대차 조건, 인력 구조, 본사승인 가능성을 상담 전에 나란히 검토해야 한다."],
  ctaAngles: ["현재 검토 중인 매장이 있다면 매출표와 비용 구조를 나란히 놓고 인수 가능성을 차분히 따져보는 것이 좋다."]
};

const BRAND_SENTENCE_POOLS = {
  "메가커피": {
    expertSentences: [
      "저가커피는 객단가보다 반복 방문과 입지 노출이 중요하다.",
      "출근길, 점심 이후, 하교 시간대 수요가 다르게 움직일 수 있다.",
      "대용량 커피 수요가 강한 대신 피크타임 제조 속도와 직원 숙련도가 수익성에 영향을 준다."
    ],
    buyerConcerns: ["초보 양수인이라면 매출 숫자보다 피크타임 제조 속도와 직원 숙련도를 먼저 묻게 된다."],
    transferLogic: ["기존 고객이 반복 구매하는 자리를 인수하면 신규 홍보 부담을 줄일 수 있다."],
    operationRisks: ["주변 저가커피 경쟁이 가까우면 같은 월매출이라도 방어력이 다르게 나타난다."],
    verificationPoints: ["시간대별 POS 매출, 테이크아웃 비중, 직원 숙련도, 주변 경쟁점 위치를 확인해야 한다."],
    ctaAngles: ["메가커피 매장을 검토 중이라면 매출표와 피크타임 제조 동선을 함께 놓고 인수 가능성을 비교하는 편이 좋다."]
  },
  "배스킨라빈스": {
    expertSentences: [
      "단순 디저트 매장이 아니라 가족 단위, 선물, 케이크 예약 수요까지 함께 봐야 한다.",
      "아이스크림 케이크 매출은 시즌성과 행사 수요가 반영되므로 월별 매출 편차 확인이 필요하다.",
      "냉동 설비, 재고 관리, 폐기 리스크는 일반 카페와 다른 방식으로 검토해야 한다."
    ],
    buyerConcerns: ["양수인은 가족 고객층이 꾸준한지와 케이크 예약 수요가 실제 매출로 이어지는지를 궁금해한다."],
    transferLogic: ["기념일과 선물 수요가 잡힌 매장은 신규 홍보보다 기존 고객 경험을 이어받는 장점이 있다."],
    operationRisks: ["계절 편차와 냉동 설비 상태를 놓치면 월매출만 보고 수익성을 오해할 수 있다."],
    verificationPoints: ["월별 POS 매출, 케이크 예약 비중, 냉동 설비 상태, 폐기율을 확인해야 한다."],
    ctaAngles: ["배스킨라빈스는 월평균만 보지 말고 시즌별 매출과 설비 상태를 같이 놓고 상담하는 편이 안전하다."]
  },
  "빽다방": {
    expertSentences: [
      "가격 경쟁력이 강한 브랜드일수록 유동 동선과 반복 고객 확보가 핵심이다.",
      "객단가가 높지 않은 구조에서는 임대료와 인건비 비중이 수익률을 크게 흔든다.",
      "최근 브랜드 재주목 흐름을 활용하더라도, 실제 매장의 피크타임 처리 능력을 확인해야 한다."
    ],
    buyerConcerns: ["예비 양수인은 브랜드 친숙도보다 출근 동선에서 반복 고객이 생기는지를 먼저 따져보게 된다."],
    transferLogic: ["대중성이 있는 브랜드라도 기존 매장의 피크타임 처리 능력이 확인될 때 양도양수 장점이 커진다."],
    operationRisks: ["임대료와 인건비 비중이 높으면 저가커피 매장의 수익률은 빠르게 흔들릴 수 있다."],
    verificationPoints: ["출근 시간 POS, 테이크아웃 비중, 임대료, 인건비, 주변 경쟁 브랜드를 확인해야 한다."],
    ctaAngles: ["빽다방은 출근 동선과 고정비를 함께 놓고 회수 가능성을 계산해보는 상담이 필요하다."]
  },
  "노모어피자": {
    expertSentences: [
      "브랜드 인지도 상승은 초기 관심을 만드는 데 유리하지만, 실제 수익은 배달권역과 재주문율이 좌우한다.",
      "피자 업종은 원가율, 배달 수수료, 피크타임 주방 동선이 함께 맞아야 한다.",
      "광고 효과만 보고 접근하기보다 해당 지역에서 포장과 배달 수요가 충분한지 확인해야 한다."
    ],
    buyerConcerns: ["양수인은 브랜드 화제성보다 배달권역 안에서 재주문이 반복되는지를 더 궁금해한다."],
    transferLogic: ["배달 리뷰와 포장 수요가 이미 형성된 매장은 신규 창업보다 초기 반응을 확인하고 들어갈 수 있다."],
    operationRisks: ["배달 수수료와 광고비가 커지면 월매출이 좋아도 실수익이 약해질 수 있다."],
    verificationPoints: ["배달권역, 재주문율, 광고비, 원가율, 주방 피크타임 동선을 확인해야 한다."],
    ctaAngles: ["노모어피자는 브랜드 관심도보다 배달권역과 주방 운영 자료를 함께 놓고 검토하는 편이 현실적이다."]
  },
  "파리바게뜨": {
    expertSentences: [
      "베이커리 매장은 생활밀착형 반복 수요가 강하지만, 제조·폐기·인력 관리 난이도도 함께 봐야 한다.",
      "아침, 간식, 케이크, 선물 수요가 시간대별로 다르게 발생한다.",
      "안정적인 브랜드라도 점주의 운영 개입도와 직원 숙련도에 따라 수익성이 달라질 수 있다."
    ],
    buyerConcerns: ["예비 양수인은 브랜드 안정성보다 제조, 폐기, 직원 숙련도를 실제로 감당할 수 있는지 고민한다."],
    transferLogic: ["생활 수요와 케이크 선물 수요가 잡힌 자리는 신규 홍보 부담을 줄이는 양도양수 장점이 있다."],
    operationRisks: ["폐기율과 인력 관리가 맞지 않으면 베이커리 매장의 수익성은 월매출보다 낮게 체감될 수 있다."],
    verificationPoints: ["시간대별 POS 매출, 폐기율, 제조 인력, 케이크 예약 수요, 본사 운영 기준을 확인해야 한다."],
    ctaAngles: ["파리바게뜨는 매출표만 보지 말고 폐기와 인력 구조까지 함께 놓고 인수 가능성을 따져보는 것이 좋다."]
  }
};

for (const [brand, context] of Object.entries(BRAND_CONTEXTS)) {
  Object.assign(context, DEFAULT_BRAND_POOL, BRAND_SENTENCE_POOLS[brand] || {});
}
BRAND_CONTEXTS["베스킨라빈스"] = BRAND_CONTEXTS["배스킨라빈스"];
BRAND_CONTEXTS["파리바게트"] = BRAND_CONTEXTS["파리바게뜨"];

const CATEGORY_FALLBACKS = [
  ["피자", BRAND_CONTEXTS["노모어피자"]],
  ["커피", BRAND_CONTEXTS["메가커피"]],
  ["베이커리", BRAND_CONTEXTS["파리바게뜨"]],
  ["샐러드", BRAND_CONTEXTS["샐러디"]],
  ["치킨", BRAND_CONTEXTS["교촌치킨"]],
  ["버거", BRAND_CONTEXTS["롯데리아"]],
  ["샤브", BRAND_CONTEXTS["샤브로21"]],
  ["아이스크림", BRAND_CONTEXTS["배스킨라빈스"]],
  ["한식", BRAND_CONTEXTS["한촌설렁탕"]]
];

const SEOUL_AREAS = {
  "강남구": ["오피스", "역세권", "고소득 주거", "점심·퇴근 수요"],
  "서초구": ["법조·오피스", "주거 배후", "학원·병원", "차량 접근성"],
  "송파구": ["대단지 주거", "오피스", "쇼핑 동선", "주말 가족 수요"],
  "강동구": ["주거 배후", "역세권", "학원·병원", "생활밀착 수요"],
  "마포구": ["오피스", "주거 혼합", "대학가", "저녁 외식 수요"],
  "용산구": ["업무지", "주거 배후", "관광·외국인 동선", "고객층 혼합"],
  "성동구": ["업무지", "주거 배후", "젊은 유동", "브랜드 민감도"],
  "광진구": ["대학가", "주거상권", "역세권", "저녁 외식 수요"],
  "동대문구": ["대학·병원", "주거 배후", "전통 상권", "점심 수요"],
  "중랑구": ["주거 배후", "생활 동선", "역세권", "가족 고객"],
  "성북구": ["대학가", "주거상권", "학원 수요", "생활밀착 수요"],
  "강북구": ["주거상권", "역세권", "생활 동선", "가격 민감도"],
  "도봉구": ["주거 배후", "학원·병원", "생활 상권", "가족 고객"],
  "노원구": ["대단지 주거", "학원가", "역세권", "학생·가족 수요"],
  "은평구": ["주거 배후", "신규 주거지", "역세권", "생활밀착 수요"],
  "서대문구": ["대학가", "주거 혼합", "오피스", "점심·저녁 수요"],
  "양천구": ["대단지 주거", "학원가", "가족 고객", "생활 동선"],
  "강서구": ["오피스", "주거 배후", "공항·마곡 동선", "점심 수요"],
  "구로구": ["업무지구", "주거 배후", "지하철 동선", "점심·퇴근 수요"],
  "금천구": ["오피스", "지식산업센터", "주거 배후", "평일 점심 수요"],
  "영등포구": ["업무지구", "상업시설", "주거 배후", "퇴근 동선"],
  "동작구": ["주거 배후", "출근 동선", "대학가", "생활밀착형 수요"],
  "관악구": ["대학가", "주거상권", "가격 민감도", "배달 수요"],
  "종로구": ["오피스", "관광 동선", "전통 상권", "점심 수요"],
  "중구": ["오피스", "상업시설", "관광 동선", "점심·퇴근 수요"],
  "수원시": ["행정·상업 중심", "대학가", "역세권", "주거 배후 수요"],
  "용인시": ["대단지 신도시", "역세권", "학원가", "가족 고객"],
  "성남시": ["분당 오피스", "대단지 주거", "역세권", "고소득 주거"],
  "안양시": ["역세권 상업지", "주거 배후", "학원가", "생활밀착 수요"],
  "부천시": ["주거 배후", "역세권", "생활 동선", "가족 고객"],
  "의정부시": ["역세권 상업지", "주거 배후", "군 관련 유동", "생활밀착 수요"],
  "천안시": ["대학가", "산업단지 배후", "역세권", "유동인구 혼합"],
  "경기": ["신도시 주거 배후", "출퇴근 동선", "역세권", "가족 고객 비중"],
  "인천": ["항만·산업 배후", "신도시 주거", "역세권", "유동인구 혼합"]
};

const AREA_CONTEXTS = Object.fromEntries(
  Object.entries(SEOUL_AREAS).map(([name, traits]) => [
    name,
    {
      type: traits.slice(0, 2).join("·"),
      traits,
      text: `${name}는 ${traits.slice(0, 3).join(", ")} 같은 수요가 겹칠 수 있는 지역입니다. 그래서 평일과 주말, 점심과 저녁의 고객 흐름을 나누어 봐야 합니다.`,
      validationTerms: traits
    }
  ])
);

const DEFAULT_AREA_POOL = {
  tradeAreaSentences: ["지역 상권은 매장 앞 동선, 배후 수요, 경쟁점, 고정비가 맞물려야 매출 흐름이 안정적으로 읽힌다."],
  buyerCheckpoints: ["예비 양수인은 상권 설명보다 시간대별 POS와 실제 구매 동선을 먼저 확인해야 한다."],
  trafficPatterns: ["평일과 주말, 점심과 저녁의 고객 흐름을 나누면 매출의 성격이 더 선명해진다."],
  riskNotes: ["유동인구가 많아도 구매 동선과 임대료가 맞지 않으면 수익률은 낮아질 수 있다."]
};

const AREA_SENTENCE_POOLS = {
  "강동구": {
    tradeAreaSentences: ["주거 배후가 강한 지역은 평일 저녁과 주말 생활 수요를 함께 봐야 한다."],
    buyerCheckpoints: ["역세권과 아파트 배후 상권은 매출 패턴이 다를 수 있으므로 시간대별 POS 확인이 필요하다."],
    trafficPatterns: ["학원, 병원, 주거 동선이 겹치는 곳은 오후와 주말 매출을 분리해서 봐야 한다."],
    riskNotes: ["신규 주거지와 기존 상권의 고객 흐름이 다르면 같은 브랜드라도 매출 안정성이 달라질 수 있다."]
  },
  "구로구": {
    tradeAreaSentences: ["업무지구와 주거지가 혼재된 지역은 평일 점심 수요와 퇴근 이후 수요를 나눠 봐야 한다."],
    buyerCheckpoints: ["오피스 수요가 강한 매장은 주말 매출 공백이 있는지 확인해야 한다."],
    trafficPatterns: ["지하철 동선과 업무지구 점심 수요가 맞물리면 평일 매출 비중이 높아질 수 있다."],
    riskNotes: ["평일 매출에 치우친 매장은 주말과 공휴일 매출 방어력을 따로 확인해야 한다."]
  },
  "동작구": {
    tradeAreaSentences: ["출퇴근 동선과 주거 배후가 맞물리는 입지에서는 반복 방문 고객 확보가 중요하다."],
    buyerCheckpoints: ["대학가, 역세권, 주거지 중 어느 수요가 중심인지에 따라 운영 전략이 달라진다."],
    trafficPatterns: ["출근 시간과 저녁 생활 수요가 나뉘는 지역은 시간대별 매출표를 먼저 봐야 한다."],
    riskNotes: ["유동은 있어도 구매 목적이 약하면 같은 브랜드라도 회전율이 낮게 나올 수 있다."]
  },
  "강남구": {
    tradeAreaSentences: ["유동인구가 많아도 임대료와 경쟁 밀도가 높으면 실제 수익률은 낮아질 수 있다."],
    buyerCheckpoints: ["브랜드 인지도보다 해당 입지에서 고객이 왜 이 매장을 선택하는지 확인해야 한다."],
    trafficPatterns: ["오피스 점심, 퇴근 후 소비, 주말 수요가 서로 다르게 움직이는 지역이다."],
    riskNotes: ["높은 권리 성격의 비용이 이미 선반영되어 있으면 회수기간이 길어질 수 있다."]
  },
  "마포구": {
    tradeAreaSentences: ["오피스, 주거, 대학가, 관광 동선이 섞이는 지역은 시간대별 매출 구조를 분리해 봐야 한다."],
    buyerCheckpoints: ["유동이 많은 지역일수록 권리금이 선반영되어 있는지 검토해야 한다."],
    trafficPatterns: ["점심 수요와 저녁 외식 수요가 다르게 움직이므로 요일별 매출 편차를 확인해야 한다."],
    riskNotes: ["상권 이미지가 좋아도 임대료와 경쟁 밀도가 높으면 실제 회수기간이 길어질 수 있다."]
  },
  "수원시": {
    tradeAreaSentences: ["행정·상업 중심지와 대학가가 섞인 지역은 평일과 주말 유동의 성격이 다르게 움직인다."],
    buyerCheckpoints: ["역세권 상권은 임대료가 먼저 반영되어 있을 수 있어 권리금 구성을 따로 확인해야 한다."],
    trafficPatterns: ["출퇴근 동선과 대학가 동선이 겹치는 시간대를 나눠서 매출 패턴을 봐야 한다."],
    riskNotes: ["신도시 확장과 구도심 상권의 매출 흐름이 다르므로 위치에 따라 회수기간 차이가 클 수 있다."]
  },
  "용인시": {
    tradeAreaSentences: ["대단지 신도시 상권은 입주 시기와 인구 밀도에 따라 매출 흐름이 달라질 수 있다."],
    buyerCheckpoints: ["신도시 상권은 향후 입점 예정 매장이 많을 수 있어 주변 공실률을 같이 확인해야 한다."],
    trafficPatterns: ["학원가 동선과 주거 동선이 겹치는 시간대에 매출이 몰릴 수 있다."],
    riskNotes: ["신도시 초기 상권은 유동인구가 아직 자리잡지 않아 매출이 안정되기까지 시간이 걸릴 수 있다."]
  },
  "성남시": {
    tradeAreaSentences: ["오피스 밀집 지역과 대단지 주거 지역의 매출 패턴은 시간대별로 뚜렷하게 나뉜다."],
    buyerCheckpoints: ["오피스 점심 수요에 치우친 매장은 주말 매출 공백이 있는지 먼저 확인해야 한다."],
    trafficPatterns: ["평일 점심·퇴근 수요와 주말 가족 수요를 구분해서 매출표를 봐야 한다."],
    riskNotes: ["고소득 상권일수록 임대료와 권리금이 이미 높게 반영되어 있을 수 있다."]
  },
  "안양시": {
    tradeAreaSentences: ["역세권 상업지와 주거 배후가 함께 있는 지역은 생활밀착형 반복 수요가 중요하다."],
    buyerCheckpoints: ["학원가 인접 매장은 하원 시간대 매출 집중도를 따로 확인해야 한다."],
    trafficPatterns: ["출퇴근 동선과 학원가 동선이 겹치는 저녁 시간대 매출 비중을 봐야 한다."],
    riskNotes: ["생활밀착형 상권은 경쟁점이 늘어나면 회전율이 빠르게 낮아질 수 있다."]
  },
  "부천시": {
    tradeAreaSentences: ["주거 배후가 강한 역세권 상권은 평일 저녁과 주말 생활 수요를 함께 봐야 한다."],
    buyerCheckpoints: ["가족 단위 고객이 중심인 매장은 주말 매출 비중을 따로 확인해야 한다."],
    trafficPatterns: ["출퇴근 동선과 주거지 생활 동선이 겹치는 저녁 시간대에 매출이 몰릴 수 있다."],
    riskNotes: ["생활밀착형 상권은 같은 업종 경쟁점이 늘어나면 매출 분산 속도가 빠를 수 있다."]
  },
  "의정부시": {
    tradeAreaSentences: ["역세권 상업지와 주거 배후가 섞인 지역은 평일과 주말의 고객 성격이 다르게 움직인다."],
    buyerCheckpoints: ["군 관련 유동이 있는 상권은 해당 수요가 매출에서 차지하는 비중을 별도로 확인해야 한다."],
    trafficPatterns: ["출퇴근 동선과 생활 동선이 겹치는 시간대를 나눠서 매출 패턴을 봐야 한다."],
    riskNotes: ["특정 수요에 매출이 치우쳐 있다면 수요 변화 시 영향을 받을 수 있다."]
  },
  "천안시": {
    tradeAreaSentences: ["대학가와 산업단지 배후가 함께 있는 지역은 학기 중과 방학, 평일과 주말의 매출 편차가 클 수 있다."],
    buyerCheckpoints: ["대학가 인접 매장은 방학 기간 매출 공백이 있는지 먼저 확인해야 한다."],
    trafficPatterns: ["산업단지 근무 시간대와 대학가 동선이 겹치는 시간을 구분해서 봐야 한다."],
    riskNotes: ["학기·방학에 따른 계절성이 있는 상권은 연간 매출 평균을 기준으로 회수기간을 계산해야 한다."]
  },
  "경기": {
    tradeAreaSentences: ["신도시 위주의 상권은 입주 연차와 인구 구성에 따라 매출 흐름이 크게 달라질 수 있다."],
    buyerCheckpoints: ["광역 단위로 비교할 때는 같은 브랜드라도 입지별 매출 편차가 크다는 점을 먼저 확인해야 한다."],
    trafficPatterns: ["출퇴근 동선이 서울로 향하는 지역은 평일 낮 시간대 유동이 상대적으로 적을 수 있다."],
    riskNotes: ["신도시 확장 지역은 향후 경쟁점 추가 입점 가능성을 함께 검토해야 한다."]
  },
  "인천": {
    tradeAreaSentences: ["항만·산업 배후 수요와 신도시 주거 수요가 함께 있는 지역은 상권 성격이 구역별로 다르게 나타난다."],
    buyerCheckpoints: ["신도시와 구도심 상권은 임대료 수준이 달라 권리금 구성을 구역별로 따로 확인해야 한다."],
    trafficPatterns: ["산업단지 근무 시간대와 주거지 생활 동선이 겹치는 시간을 구분해서 매출을 봐야 한다."],
    riskNotes: ["구역별 상권 성숙도 차이가 커서 같은 브랜드라도 회수기간 차이가 클 수 있다."]
  }
};

for (const [areaName, context] of Object.entries(AREA_CONTEXTS)) {
  Object.assign(context, DEFAULT_AREA_POOL, AREA_SENTENCE_POOLS[areaName] || {});
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function uniqueList(items) {
  return [...new Set((items || []).map(clean).filter(Boolean))];
}

function splitList(value) {
  if (Array.isArray(value)) return uniqueList(value);
  return uniqueList(String(value || "").split(/[\n,]+/));
}

function parseKeys(value, fallback) {
  const items = splitList(value);
  return items.length ? items : [...fallback];
}

function moneyText(value) {
  const raw = clean(value).replace(/,/g, "");
  if (/^\d+\s*억/.test(raw)) return clean(value);
  if (/^\d+\s*만원$/.test(raw)) return clean(value).replace(/\s+/g, "");
  const num = Number(raw || 0);
  if (!num) return "상담 시 별도 검토";
  if (num >= 10000) {
    const eok = Math.floor(num / 10000);
    const rest = num % 10000;
    return rest ? `${eok}억 ${rest.toLocaleString("ko-KR")}만원` : `${eok}억원`;
  }
  return `${num.toLocaleString("ko-KR")}만원`;
}

function hasFinalConsonant(value) {
  const chars = Array.from(clean(value)).reverse();
  const char = chars.find((item) => /[가-힣]/.test(item));
  if (!char) return false;
  const code = char.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3 && ((code - 0xac00) % 28) !== 0;
}

export function josa(value, withFinal, withoutFinal) {
  return `${value}${hasFinalConsonant(value) ? withFinal : withoutFinal}`;
}

function brandContextFor(brand) {
  if (BRAND_CONTEXTS[brand]) return BRAND_CONTEXTS[brand];
  const found = CATEGORY_FALLBACKS.find(([keyword]) => brand.includes(keyword));
  if (found) return found[1];
  return {
    category: "프랜차이즈",
    customerBase: ["브랜드 인지 고객", "지역 생활 고객", "반복 구매 고객"],
    operatingTraits: ["운영 시스템", "피크타임 대응", "고정비 관리"],
    transferAdvantages: ["기존 고객층", "운영 이력", "검증 가능한 매출 흐름"],
    riskChecks: ["임대료", "인건비", "원가율", "본사승인"],
    contentAngles: ["브랜드 수요", "상권 적합성", "운영 안정성"],
    avoidClaims: ["브랜드 이름만으로 안정성을 단정하지 않기"],
    validationTerms: ["프랜차이즈", "기존 고객층", "운영 이력", "고정비", "상권"]
  };
}

function areaContextFor(region) {
  const exact = AREA_CONTEXTS[region];
  if (exact) return exact;
  const matched = Object.entries(AREA_CONTEXTS).find(([name]) => region.includes(name) || name.includes(region));
  if (matched) return matched[1];
  return {
    type: "지역 상권",
    traits: ["주거 배후", "생활 동선", "경쟁점", "고정비"],
    text: `${region || "해당 지역"}은 매장 앞 동선, 주변 경쟁점, 배후 수요, 고정비 수준을 같이 봐야 하는 상권입니다.`,
    validationTerms: ["주거 배후", "생활 동선", "경쟁점", "고정비"],
    ...DEFAULT_AREA_POOL
  };
}

function normalizeLength(value) {
  const text = clean(value);
  if (/3000|장문|long/i.test(text)) return "naver3000";
  return text === "naver3000" ? "naver3000" : "naver";
}

function normalizeRule(value) {
  const text = clean(value);
  if (/1/.test(text)) return "rule1";
  return "rule2";
}

export function normalizeInput(form = {}) {
  const brand = clean(form.brand);
  const region = clean(form.region);
  const repeatPhrase = clean(form.repeatPhrase) || [region, brand, "양도양수"].filter(Boolean).join(" ");
  return {
    brand,
    region,
    sales: clean(form.sales),
    premium: clean(form.premium || form.rightsFee),
    salesText: moneyText(form.sales),
    premiumText: moneyText(form.premium || form.rightsFee),
    strengths: splitList(form.strengths),
    listingMemo: clean(form.listingMemo || form.memo),
    memo: clean(form.memo || form.listingMemo),
    brandNews: clean(form.brandNews),
    readerPain: clean(form.readerPain),
    proofDetails: clean(form.proofDetails),
    repeatPhrase,
    writingTone: clean(form.writingTone) || DEFAULTS.writingTone,
    ctaStyle: clean(form.ctaStyle) || DEFAULTS.ctaStyle,
    target: clean(form.target) || DEFAULTS.target,
    message: clean(form.message) || DEFAULTS.message,
    hookFocus: clean(form.hookFocus) || DEFAULTS.hookFocus,
    length: normalizeLength(form.length || DEFAULTS.length),
    mode: clean(form.mode) || DEFAULTS.mode,
    ruleVersion: normalizeRule(form.ruleVersion || DEFAULTS.ruleVersion),
    researchKeys: parseKeys(form.researchKeys, DEFAULT_RESEARCH_KEYS),
    qualityKeys: parseKeys(form.qualityKeys, DEFAULT_QUALITY_KEYS)
  };
}

function sentence(value) {
  const text = clean(value).replace(/[.。]+$/, "");
  return text ? `${text}.` : "";
}

function styleGuideFromOptions(options = {}) {
  if (options.styleGuide) return options.styleGuide;
  try {
    return analyzeReferencePosts(options.referenceOptions || {});
  } catch {
    return { styleGuidelines: [] };
  }
}

export function buildArticlePlan(inputArg, options = {}) {
  const input = normalizeInput(inputArg);
  const brand = brandContextFor(input.brand);
  const area = areaContextFor(input.region);
  const styleGuide = styleGuideFromOptions(options);
  const strengths = input.strengths.length
    ? input.strengths
    : [...brand.transferAdvantages.slice(0, 2), ...area.traits.slice(0, 1)];
  return {
    input,
    brand,
    area,
    strengths,
    styleGuide,
    repeatParagraphs: [1, 3, 6, 10, 12],
    sections: [
      "검색 의도와 클릭 이유",
      "매장 조건 요약",
      "브랜드 해석",
      "지역과 상권 해석",
      "월매출 해석",
      "창업비용과 회수 관점",
      "수익 구조",
      "예비 양수자 고민",
      "검증 자료",
      "신규창업과 양도양수 비교",
      "리스크",
      "상담형 마무리"
    ]
  };
}

function buildTitles(plan) {
  const { input } = plan;
  return [
    `${input.region} ${input.brand} 양도양수, 월매출 ${input.salesText} 조건을 보는 기준`,
    `${input.brand} 창업비용 ${input.premiumText}, 신규창업과 비교할 포인트`,
    `${input.region} ${input.brand} 매장 인수 전 상담에서 살필 자료`
  ];
}

function buildTags(plan) {
  const { input, brand } = plan;
  return uniqueList([
    input.brand,
    `${input.brand}양도양수`,
    `${input.region}${input.brand}`,
    `${input.region}창업`,
    brand.category.replace(/[·\s]/g, ""),
    "프랜차이즈창업",
    "창업비용",
    "양도양수"
  ]);
}

function memoText(input) {
  return input.listingMemo ? `입력된 매장 메모에서는 ${input.listingMemo}도 같이 보입니다.` : "세부 메모가 더해지면 상담 전 비교 기준을 더 좁힐 수 있습니다.";
}

function brandNewsText(input) {
  return input.brandNews ? `사용자가 제공한 브랜드 흐름은 ${input.brandNews}입니다.` : "최근 이슈는 검증된 자료가 있을 때만 본문에서 확정적으로 다루는 편이 안전합니다.";
}

function poolItem(items, index, fallback = "") {
  if (Array.isArray(items) && items[index]) return items[index];
  if (Array.isArray(items) && items[0]) return items[0];
  return fallback;
}

function financialDepthSentence(input) {
  return `월매출 ${input.salesText}은 임대료, 인건비, 원가율, 배달 수수료를 빼고 남는 구조까지 계산해야 회수기간을 현실적으로 볼 수 있습니다.`;
}

function startupCostDepthSentence(input) {
  return `창업비용 ${input.premiumText}은 권리금 성격, 시설 승계 범위, 리뉴얼 가능성을 분리해야 신규창업 대비 부담이 보입니다.`;
}

function brandDepthSentence(input, brand) {
  const trait = poolItem(brand.operatingTraits, 0, "운영 동선");
  return `${input.brand}의 인지도는 초기 유입에 도움을 주지만, 인수 기준은 기존 고객의 재방문율과 ${trait} 같은 운영 특성이 비용 구조와 맞을 때 설득력이 생깁니다.`;
}

function areaDepthSentence(input) {
  return `${input.region} 상권은 평일 점심, 퇴근 시간, 주말 수요가 어떻게 나뉘는지에 따라 필요한 직원 수와 운영 전략이 달라질 수 있습니다.`;
}

function proofDepthSentence() {
  return "POS 매출은 지속성, 임대료와 인건비는 실수익, 본사승인은 인수 가능성을 나누어 대조해야 상담 기준이 선명해집니다.";
}

function buyerDepthSentence() {
  return "예비 양수자가 실제로 묻는 지점은 좋은 매장인지가 아니라 내 자금과 운영 시간 안에서 감당 가능한 구조인지입니다.";
}

function riskDepthSentence() {
  return "리스크는 권리금, 매출 기복, 직원 의존도, 리뉴얼 비용 중 어느 항목이 회수기간을 흔드는지로 좁혀 읽을 때 선명해집니다.";
}

function ctaDepthSentence() {
  return "현재 검토 중인 매장이라면 월매출, 비용 구조, 임대차 조건을 나란히 놓고 회수 가능성부터 계산하는 쪽이 현실적입니다.";
}

function memoDepthSentence() {
  return "입력 메모는 장점 나열보다 시간대 수요, 운영 인력, 추가 비용을 좁히는 자료로 쓰일 때 의미가 있습니다.";
}

function sentenceLikeParts(text) {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function weakSentenceHits(text) {
  return sentenceLikeParts(text).filter((sentenceText) =>
    WEAK_SENTENCE_PATTERNS.some((pattern) => pattern.test(sentenceText))
  );
}

function rewriteWeakSentence(sentenceText, input, plan) {
  const brand = plan?.brand || brandContextFor(input.brand);
  if (/상권이 좋아 안정적인 운영이 가능합니다|유동인구|시간대|평일과 주말|구매가 일어나는/.test(sentenceText)) {
    return areaDepthSentence(input);
  }
  if (/브랜드 인지도|단순 인지도|반복 방문|중요한 브랜드|브랜드 수요|상권 적합성|운영 안정성/.test(sentenceText)) {
    return brandDepthSentence(input, brand);
  }
  if (/창업 전에 확인해야|월매출 .*결과 숫자|매출표|객단가|회전율/.test(sentenceText)) {
    return financialDepthSentence(input);
  }
  if (/창업비용|구성과 회수 가능성|낮아 보이는 금액|장비 교체|리뉴얼/.test(sentenceText)) {
    return startupCostDepthSentence(input);
  }
  if (/검증 자료|이 자료가 있어야|POS|본사승인|임대차|확인해야|점검해야/.test(sentenceText)) {
    return proofDepthSentence();
  }
  if (/좋은 매장인가|예비 양수자의 질문/.test(sentenceText)) {
    return buyerDepthSentence();
  }
  if (/리스크도 분명|조건만 보면|맞는 선택인지/.test(sentenceText)) {
    return /조건만 보면|맞는 선택인지/.test(sentenceText) ? ctaDepthSentence() : riskDepthSentence();
  }
  if (/최근 이슈|세부 메모/.test(sentenceText)) {
    return memoDepthSentence();
  }
  if (/봐야|보는 것이|보는 편|자료로 살피는 편|중요합니다|중요하다/.test(sentenceText)) {
    return proofDepthSentence();
  }
  return sentenceText;
}

function rewriteWeakSentences(text, input, plan) {
  return sentenceLikeParts(text)
    .map((sentenceText) =>
      WEAK_SENTENCE_PATTERNS.some((pattern) => pattern.test(sentenceText))
        ? rewriteWeakSentence(sentenceText, input, plan)
        : sentenceText
    )
    .join(" ");
}

function compactDuplicateSentences(text, input = {}) {
  const seen = new Set();
  return sentenceLikeParts(text)
    .filter((sentenceText) => {
      if (sentenceText.includes(input.repeatPhrase || "")) return true;
      const key = sentenceText.replace(/\s+/g, " ");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(" ");
}

function proofDepthVariant(index) {
  const variants = [
    "POS는 매출 지속성, 임대차는 고정비 부담, 본사승인은 양수 가능성을 나눠 보여주는 자료입니다.",
    "자료 검토에서는 매출 총액보다 비용표와 승인 조건이 함께 맞는지부터 대조하는 편이 현실적입니다.",
    "매출 자료와 비용 자료가 같이 있어야 인수 뒤 남는 금액을 더 차분하게 계산할 수 있습니다."
  ];
  return variants[index % variants.length];
}

function areaDepthVariant(input, index) {
  const variants = [
    `${input.region}에서는 점심 피크와 퇴근 이후, 주말 생활 수요를 분리해야 직원 배치가 맞습니다.`,
    "같은 유동이라도 시간대가 몰리면 주문 처리와 인력 계획의 부담이 달라집니다.",
    "상권 평가는 유동량보다 실제 구매가 반복되는 시간대를 잡을 때 더 현실적입니다."
  ];
  return variants[index % variants.length];
}

function brandDepthVariant(input, index) {
  const variants = [
    `${input.brand}은 이름보다 실제 매장의 재방문 흐름과 피크타임 처리력이 더 큰 기준이 됩니다.`,
    "기존 고객이 남아 있는지와 운영 동선이 안정적인지가 인수 후 만족도를 더 크게 좌우합니다.",
    "브랜드 장점은 매장별 비용 구조와 고객 흐름이 맞을 때 실제 수익으로 이어집니다."
  ];
  return variants[index % variants.length];
}

function varyDuplicateProfessionalSentences(paragraphs, input) {
  const seen = new Map();
  return paragraphs.map((paragraph) =>
    sentenceLikeParts(paragraph)
      .map((sentenceText) => {
        if (sentenceText.includes(input.repeatPhrase || "")) return sentenceText;
        const key = sentenceText.replace(/\s+/g, " ");
        const count = seen.get(key) || 0;
        seen.set(key, count + 1);
        if (count === 0) return sentenceText;
        if (key === proofDepthSentence()) return proofDepthVariant(count - 1);
        if (key === areaDepthSentence(input)) return areaDepthVariant(input, count - 1);
        if (key.includes("인지도는 초기 유입에 도움")) return brandDepthVariant(input, count - 1);
        return sentenceText;
      })
      .join(" ")
  );
}

function ctaText(input, brand, area) {
  const ctaAngle = poolItem(brand.ctaAngles, 0, DEFAULT_BRAND_POOL.ctaAngles[0]);
  const operationRisk = poolItem(brand.operationRisks, 0, DEFAULT_BRAND_POOL.operationRisks[0]);
  const patterns = {
    "부드러운 상담 유도": `${ctaAngle} 조건만 보면 좋아 보여도 실제 인수 과정에서는 임대차, 본사승인, 인력 승계에서 차이가 생길 수 있습니다.`,
    "실매물 검토형": `현재 검토 중인 실매장이 있다면 매출표, 비용 구조, 임대차 조건을 한 번에 놓고 실제 인수 가능성을 따져보는 편이 좋습니다.`,
    "리스크 점검형": `${operationRisk} 그래서 마지막에는 장점보다 리스크가 내 운영 방식 안에서 감당되는지를 먼저 계산해야 합니다.`,
    "신규창업 비교형": `신규창업과 비교할 때 절약되는 공사비와 홍보 기간이 실제 창업비용 차이로 이어지는지 확인하면 결정이 더 차분해집니다.`,
    "초보 양수인 안내형": `초보 양수인이라면 매출보다 직원 의존도, 피크타임 운영, 본사승인 일정을 먼저 정리해두면 상담에서 흔들릴 가능성이 줄어듭니다.`
  };
  return patterns[input.ctaStyle] || patterns["부드러운 상담 유도"];
}

function paragraphDrafts(plan) {
  const { input, brand, area, strengths } = plan;
  const brandTraits = uniqueList([
    ...brand.contentAngles,
    ...brand.operatingTraits,
    ...brand.transferAdvantages
  ]);
  const areaTraits = area.traits;
  const strengthLine = strengths.slice(0, 4).join(", ");
  const pain = input.readerPain || "이 매장이 내 예산과 운영 시간 안에서 감당 가능한지";
  const proof = input.proofDetails ? `${input.proofDetails}처럼 사용자가 적어둔 자료` : "최근 12개월 POS 매출";
  const cta = ctaText(input, brand, area);
  const brandExpert0 = poolItem(brand.expertSentences, 0, DEFAULT_BRAND_POOL.expertSentences[0]);
  const brandExpert1 = poolItem(brand.expertSentences, 1, brandExpert0);
  const brandBuyerConcern = poolItem(brand.buyerConcerns, 0, DEFAULT_BRAND_POOL.buyerConcerns[0]);
  const brandTransferLogic = poolItem(brand.transferLogic, 0, DEFAULT_BRAND_POOL.transferLogic[0]);
  const brandOperationRisk = poolItem(brand.operationRisks, 0, DEFAULT_BRAND_POOL.operationRisks[0]);
  const brandVerificationPoint = poolItem(brand.verificationPoints, 0, DEFAULT_BRAND_POOL.verificationPoints[0]);
  const areaTradeSentence = poolItem(area.tradeAreaSentences, 0, DEFAULT_AREA_POOL.tradeAreaSentences[0]);
  const areaRiskNote = poolItem(area.riskNotes, 0, DEFAULT_AREA_POOL.riskNotes[0]);

  return [
    `${input.repeatPhrase}를 검색한 분들은 대개 브랜드 이름보다 인수 후 실제 운영이 가능한지를 알고 싶어 합니다. ${input.region}에서 ${josa(input.brand, "을", "를")} 볼 때도 첫 기준은 월매출 ${input.salesText}과 창업비용 ${input.premiumText}이 서로 맞는지입니다. 이 글은 과장된 추천보다 예비 양수자가 먼저 살필 기준을 정리합니다. 특히 ${input.target}라면 매장 설명보다 내 자금과 운영 시간이 맞는지를 먼저 떠올리게 됩니다.`,
    `오늘 조건은 ${input.region} ${input.brand} 매장, 월매출 ${input.salesText}, 창업비용 ${input.premiumText}입니다. 핵심 장점은 ${strengthLine || brandTraits.slice(0, 3).join(", ")}이며, ${memoText(input)} 숫자와 현장 조건을 한 번에 놓고 봐야 매장 요약이 실무적으로 읽힙니다. 이 요약은 광고 문구가 아니라 상담 전 비교표의 첫 줄에 가깝습니다.`,
    `${josa(input.brand, "은", "는")} ${brand.category} 업종 안에서 ${brandTraits.slice(0, 3).join(", ")} 같은 요소가 중요한 브랜드입니다. ${brandExpert0} ${input.repeatPhrase} 검토에서는 단순 인지도보다 고객이 왜 반복 방문하는지, 그 수요가 현재 자리에서도 이어지는지를 봐야 합니다. ${brandNewsText(input)}`,
    `${input.region} 상권은 ${area.type} 성격으로 해석할 수 있습니다. ${areaTradeSentence} ${area.text} 특히 ${areaTraits.slice(0, 3).join(", ")} 같은 특성이 매출 흐름에 영향을 줄 수 있으므로, 유동인구라는 말만으로 결론을 내리기보다 구매가 일어나는 시간대를 나누어 봐야 합니다.`,
    `월매출 ${input.salesText}은 결과 숫자일 뿐이고, 실제로는 객단가, 회전율, 고정비 이후 남는 구조까지 이어서 읽어야 합니다. ${brandExpert1} 매출이 일정해 보이는 매장도 평일 점심에 몰리는지, 저녁과 주말까지 분산되는지에 따라 운영 전략이 달라집니다. 그래서 매출표는 상담 전 가장 먼저 받아볼 자료입니다.`,
    `창업비용 ${input.premiumText}은 총액보다 구성과 회수 가능성이 중요합니다. ${input.repeatPhrase} 조건에서는 기존 시설, 고객층, 영업 이력, 본사승인 가능성을 신규창업 비용과 비교해야 합니다. 낮아 보이는 금액도 리뉴얼이나 장비 교체가 남아 있으면 실제 부담이 커질 수 있습니다.`,
    `수익 구조는 월매출 하나로 끝나지 않습니다. 임대료, 인건비, 원가율, 배달비중, 로열티, 운영 시간을 나누어야 실제 남는 금액이 보입니다. ${brandOperationRisk} 특히 ${brand.riskChecks.slice(0, 3).join(", ")} 같은 비용 항목은 ${input.brand} 인수 상담에서 빠뜨리기 쉬우므로 자료로 살피는 편이 좋습니다.`,
    `예비 양수자의 질문은 "좋은 매장인가"보다 "${pain}"에 가깝습니다. ${brandBuyerConcern} 초보 창업자라면 운영 난이도와 직원 의존도를 먼저 볼 수 있고, 경험이 있는 분이라면 회수 기간과 추가 성장 여지를 더 깊게 볼 수 있습니다. 독자 상황에 따라 같은 조건도 다르게 읽힙니다.`,
    `검증 자료는 ${proof}, 임대차 조건, 임대료, 인건비, 원가율, 배달비중, 본사승인 여부까지 묶어서 보는 것이 좋습니다. ${brandVerificationPoint} 이 자료가 있어야 매출이 일시적인지, 기존 고객이 유지되는지, 인수 후 비용이 예상 범위 안에 들어오는지 차분하게 비교할 수 있습니다.`,
    `신규창업은 인테리어, 초기 홍보, 고객 형성 기간을 처음부터 부담해야 합니다. 반대로 ${input.repeatPhrase}는 이미 운영된 매출 흐름과 고객 반응을 보고 들어갈 수 있다는 장점이 있습니다. ${brandTransferLogic} 다만 기존 운영의 문제까지 이어받을 수 있으므로 자료가 부족하면 서두르지 않는 편이 낫습니다.`,
    `리스크도 분명히 남습니다. 권리금 성격의 비용이 적정한지, 매출 기복이 큰지, 특정 직원이나 점주 개인에게 고객이 묶여 있는지, 리뉴얼 비용이 예정되어 있는지 살펴야 합니다. ${areaRiskNote} ${input.brand}의 장점이 있어도 ${brand.riskChecks.slice(0, 3).join(", ")} 같은 조건이 맞지 않으면 실제 만족도는 낮아질 수 있습니다.`,
    `정리하면 ${input.region} ${josa(input.brand, "은", "는")} 브랜드 측면(${brandTraits.slice(0, 2).join(", ")})과 지역 측면(${areaTraits.slice(0, 2).join(", ")})을 나란히 놓고 봐야 합니다. ${input.repeatPhrase}가 맞는 선택인지 알고 싶다면 장점보다 자료, 비용, 운영 가능성을 순서대로 맞춰보면 됩니다. ${sentence(cta)}`
  ];
}

function naver3000Expansions(plan) {
  const { input, brand, area } = plan;
  return [
    `처음부터 결론을 정하기보다 ${input.hookFocus} 기준으로 살피면 불필요한 기대를 줄일 수 있습니다. 검색자가 알고 싶은 것은 단순 소개가 아니라 실제 상담에서 어떤 자료를 요구해야 하는지입니다.`,
    `이 요약은 광고 문구가 아니라 상담 전 체크리스트에 가깝습니다. 월매출과 창업비용을 먼저 세우고, 장점은 그 숫자를 설명할 때만 의미가 있습니다.`,
    `${brand.avoidClaims[0]} 그래서 브랜드의 장점은 해당 상권의 고객 흐름, 기존 리뷰, 재방문 패턴과 연결해서 읽어야 합니다.`,
    `${input.region} 안에서도 같은 역세권이라도 출구, 횡단보도, 배달권역에 따라 결과가 달라질 수 있습니다. ${area.traits.slice(0, 4).join(", ")}을 나누어 보는 이유가 여기에 있습니다.`,
    `매출 자료를 볼 때는 총액만 받아 적지 말고 요일별 편차와 피크타임을 같이 물어보는 것이 좋습니다. 이 과정이 있어야 실제 운영 시간과 인력 부담을 계산할 수 있습니다.`,
    `신규 매장보다 초기 시행착오가 적다는 점은 장점입니다. 다만 승계 비용 안에 어떤 시설과 자산이 포함되는지 모르면 회수 기간을 계산하기 어렵습니다.`,
    `수익성은 매출표보다 비용표에서 더 선명해질 때가 많습니다. 원가율과 인건비가 높으면 매출이 좋아도 실수익이 약해질 수 있습니다.`,
    `읽는 대상이 초보 창업자인지, 이미 운영 경험이 있는 양수자인지에 따라 질문도 달라집니다. 초보자는 운영 난이도, 경험자는 회수 기간과 확장 가능성을 더 중점적으로 볼 수 있습니다.`,
    `POS 자료와 임대차 조건이 정리되어 있으면 상담이 훨씬 빠르게 진행됩니다. 반대로 자료가 모호하면 조건이 좋아 보여도 비교가 어려워집니다.`,
    `양도양수의 장점은 시간 절약이지만, 그 시간 절약이 비용에 비해 합리적인지는 별도로 계산해야 합니다. 공사비와 초기 홍보비를 아낄 수 있는지 확인하는 이유입니다.`,
    `위험 요소를 쓰는 것은 매장을 깎아내리려는 목적이 아닙니다. 인수 후 예상하지 못한 비용을 줄이기 위해 미리 질문을 정리하는 과정입니다.`,
    `상담에서는 한 매장만 놓고 결정하기보다 같은 예산대의 다른 브랜드와 지역 조건을 같이 비교하는 편이 안전합니다. 그래야 좋은 조건과 맞는 조건을 구분할 수 있습니다.`
  ];
}

export function writeDraftFromPlan(plan, options = {}) {
  const paragraphs = paragraphDrafts(plan);
  const bodyParagraphs = plan.input.length === "naver3000"
    ? paragraphs.map((paragraph, index) => `${paragraph} ${naver3000Expansions(plan)[index]}`)
    : paragraphs;
  return {
    input: plan.input,
    plan,
    source: options.source || "local-engine",
    titleCandidates: buildTitles(plan),
    bodyParagraphs,
    tags: buildTags(plan),
    editorNotes: []
  };
}

function replaceAwkward(text, input = {}, plan = {}) {
  const fixed = rewriteWeakSentences(String(text || ""), input, plan)
    .replace(/흐름라는/g, "흐름이라는")
    .replace(/수요을/g, "수요를")
    .replace(/조건라는/g, "조건이라는")
    .replace(/장점라는/g, "장점이라는")
    .replace(/구조라는/g, "구조라는 표현보다 구조라고")
    .replace(/고객 동선를/g, "고객 동선을")
    .replace(/상권을 확인됩니다/g, "상권을 확인할 수 있습니다")
    .replace(/매출을 보여집니다/g, "매출이 나타납니다")
    .replace(/판단됩니다만/g, "판단할 수 있지만")
    .replace(/추천 근거로 드러납니다/g, "검토 근거가 됩니다")
    .replace(/이 부분은 중요합니다만/g, "이 부분은 중요하지만")
    .replace(/본 매물은 좋은 매물입니다/g, "이 매장은 자료를 기준으로 검토해야 합니다")
    .replace(/\s{2,}/g, " ")
    .trim();
  return compactDuplicateSentences(fixed, input);
}

export function polishDraft(draft, inputArg = draft.input, plan = draft.plan) {
  const input = normalizeInput(inputArg);
  const bodyParagraphs = varyDuplicateProfessionalSentences(
    (draft.bodyParagraphs || []).map((paragraph) => replaceAwkward(paragraph, input, plan)),
    input
  );
  return {
    ...draft,
    input,
    plan,
    titleCandidates: (draft.titleCandidates || []).map((title) => replaceAwkward(title, input, plan)).slice(0, 3),
    bodyParagraphs,
    tags: uniqueList(draft.tags || []),
    polished: true
  };
}

function countRepeat(paragraphs, repeatPhrase) {
  if (!repeatPhrase) return 0;
  const escaped = repeatPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (paragraphs.join("\n\n").match(new RegExp(escaped, "g")) || []).length;
}

function normalizeRepeatCount(draft, input, plan) {
  const repeat = input.repeatPhrase;
  let seen = 0;
  const bodyParagraphs = draft.bodyParagraphs.map((paragraph) =>
    paragraph.replace(new RegExp(repeat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), (match) => {
      seen += 1;
      return seen <= 5 ? match : `${input.region} ${input.brand} 매장`;
    })
  );
  let count = countRepeat(bodyParagraphs, repeat);
  for (const paragraphNumber of plan.repeatParagraphs) {
    if (count >= 5) break;
    const index = paragraphNumber - 1;
    if (!bodyParagraphs[index].includes(repeat)) {
      bodyParagraphs[index] = `${bodyParagraphs[index]} ${repeat} 조건은 자료를 기준으로 비교해야 합니다.`;
      count += 1;
    }
  }
  return { ...draft, bodyParagraphs };
}

function noSpaceLength(paragraphs) {
  return paragraphs.join("\n\n").replace(/\s/g, "").length;
}

function ensureLength(draft, input, plan) {
  const defaultAdditions = [
    "상담 전에는 매출표와 비용표를 나란히 놓고 보며 실제 결정을 준비하는 과정이 필요합니다.",
    "이 과정을 거치면 장점과 보완점이 분리되어 불필요한 기대를 줄이는 데 도움이 됩니다.",
    "자료가 충분할수록 예비 양수자는 감이 아니라 숫자로 매장 조건을 비교하게 됩니다.",
    "반대로 자료가 부족하면 비용이 낮아 보여도 결정을 서두르기 어렵습니다.",
    "결국 좋은 조건은 브랜드, 상권, 숫자, 운영 부담이 일정하게 맞을 때 더 설득력을 갖습니다."
  ];
  const longAdditions = [
    "첫 상담에서는 조건을 크게 보기보다 매출표, 비용표, 임대차 자료의 순서로 좁혀가면 흐름이 선명해집니다.",
    "이렇게 정리하면 장점과 보완점이 분리되어 불필요한 기대를 줄이는 데 도움이 됩니다.",
    "자료가 충분할수록 예비 양수자는 감이 아니라 숫자로 매장 조건을 비교하게 됩니다.",
    "반대로 자료가 부족하면 비용이 낮아 보여도 결정을 서두르기 어렵습니다.",
    "좋은 조건은 브랜드, 상권, 숫자, 운영 부담이 일정하게 맞을 때 더 설득력을 갖습니다.",
    "비슷한 예산대의 다른 매장과 나란히 놓으면 창업비용의 무게도 더 현실적으로 읽힙니다.",
    "운영 시간이 길거나 피크타임이 짧게 몰리는 매장은 인력 계획까지 같이 세워야 합니다.",
    "초보 창업자라면 직접 운영할 시간과 직원 운영 가능성을 먼저 계산해두는 편이 안전합니다.",
    "운영 경험이 있는 양수자라면 기존 매출을 유지할 수 있는 고객 흐름을 더 깊게 볼 필요가 있습니다.",
    "자료가 정리된 매장은 상담 속도가 빠르고, 자료가 모호한 매장은 협의 전에 질문이 늘어납니다.",
    "위험 요소를 먼저 적어두면 인수 후 예상하지 못한 비용을 줄이는 데 도움이 됩니다.",
    "마지막 결정은 한 매장의 장점보다 내 자금 계획과 운영 방식에 맞는지에서 갈립니다."
  ];
  const additions = input.length === "naver3000" ? longAdditions : defaultAdditions;
  const bodyParagraphs = [...draft.bodyParagraphs];
  let cursor = 0;
  const targetMinLength = input.length === "naver3000" ? 3000 : 1980;
  while (noSpaceLength(bodyParagraphs) < targetMinLength && cursor < 24) {
    const index = cursor % bodyParagraphs.length;
    bodyParagraphs[index] = `${bodyParagraphs[index]} ${additions[cursor % additions.length]}`;
    cursor += 1;
  }
  if (input.length === "naver") {
    const trims = [
      " 이 과정을 거치면 장점과 보완점이 분리되어 불필요한 기대를 줄이는 데 도움이 됩니다.",
      " 상담 전에는 매출표와 비용표를 나란히 놓고 보며 실제 결정을 준비하는 과정이 필요합니다.",
      " 자료가 충분할수록 예비 양수자는 감이 아니라 숫자로 매장 조건을 비교하게 됩니다.",
      " 결국 좋은 조건은 브랜드, 상권, 숫자, 운영 부담이 일정하게 맞을 때 더 설득력을 갖습니다.",
      " 반대로 자료가 부족하면 비용이 낮아 보여도 결정을 서두르기 어렵습니다."
    ];
    for (const trim of trims) {
      if (noSpaceLength(bodyParagraphs) <= 2100) break;
      for (let i = bodyParagraphs.length - 1; i >= 0; i -= 1) {
        if (noSpaceLength(bodyParagraphs) <= 2100) break;
        bodyParagraphs[i] = bodyParagraphs[i].replace(trim, "");
      }
    }
  }
  return { ...draft, bodyParagraphs };
}

export function repairDraft(draft, inputArg = draft.input, rules = {}) {
  const input = normalizeInput(inputArg);
  const plan = draft.plan || buildArticlePlan(input);
  let next = polishDraft(draft, input, plan);
  next = normalizeRepeatCount(next, input, plan);
  next = ensureLength(next, input, plan);
  next = polishDraft(next, input, plan);
  return {
    ...next,
    repairApplied: uniqueList([...(draft.repairApplied || []), "반복문구/길이/어색한 표현 보정"])
  };
}

function bodyOnly(draft) {
  return (draft.bodyParagraphs || []).join("\n\n");
}

function wholeText(draft) {
  return [...(draft.titleCandidates || []), ...(draft.tags || []), bodyOnly(draft)].join("\n");
}

function check(ok, value, detail) {
  return { ok: Boolean(ok), value, detail };
}

function countTerms(text, terms) {
  return uniqueList(terms).filter((term) => text.includes(term)).length;
}

function countPoolSentences(text, groups) {
  return uniqueList(groups.flat()).filter((sentence) => sentence && text.includes(sentence)).length;
}

function countOccurrences(text, term) {
  return (String(text || "").match(new RegExp(term, "g")) || []).length;
}

function sentenceStarts(paragraphs) {
  return paragraphs
    .map((paragraph) => clean(paragraph).slice(0, 14))
    .filter(Boolean);
}

function sentenceEndings(paragraphs) {
  return paragraphs
    .map((paragraph) => {
      const cleanText = clean(paragraph).replace(/[.!?。]+$/, "");
      return cleanText.slice(-10);
    })
    .filter(Boolean);
}

function maxDuplicate(items) {
  const counts = new Map();
  for (const item of items) counts.set(item, (counts.get(item) || 0) + 1);
  return Math.max(0, ...counts.values());
}

function advisoryReview(draft, input, checks) {
  const paragraphs = draft.bodyParagraphs || [];
  const chars = noSpaceLength(paragraphs);
  const warnings = [];
  const shortCount = paragraphs.filter((paragraph) => paragraph.replace(/\s/g, "").length < 90).length;
  if (shortCount) warnings.push(`짧은 문단 ${shortCount}개: 각 문단은 최소 90자 이상이 좋습니다.`);
  if (input.length === "naver" && chars < 1850) warnings.push(`lower-boundary writing: ${chars}자라 기본 목표보다 얕게 보일 수 있습니다.`);
  if (input.length === "naver" && chars <= 1810) warnings.push(`minimum-boundary writing: ${chars}자라 최소 기준에 붙어 있습니다.`);
  if (!checks.brandSentencePool.ok) warnings.push("브랜드 sentence pool 반영이 부족합니다.");
  if (!checks.areaSentencePool.ok) warnings.push("지역 sentence pool 반영이 부족합니다.");
  return warnings;
}

function numericClaimCheck(text, input) {
  const allowed = new Set([
    clean(input.sales).replace(/,/g, ""),
    clean(input.premium).replace(/,/g, ""),
    ...(clean(input.sales).match(/\d[\d,]*/g) || []).map((item) => item.replace(/,/g, "")),
    ...(clean(input.premium).match(/\d[\d,]*/g) || []).map((item) => item.replace(/,/g, "")),
    ...(clean(input.salesText).match(/\d[\d,]*/g) || []).map((item) => item.replace(/,/g, "")),
    ...(clean(input.premiumText).match(/\d[\d,]*/g) || []).map((item) => item.replace(/,/g, "")),
    "12"
  ].filter(Boolean));
  const numbers = [...text.matchAll(/\d[\d,]*/g)].map((match) => match[0].replace(/,/g, ""));
  const unexpected = numbers.filter((num) => !allowed.has(num));
  const riskyTerm = BAD_NUMERIC_CLAIM_TERMS.find((term) => text.includes(term));
  return { unexpected, riskyTerm };
}

function industryMismatch(draft, input, brand) {
  const text = bodyOnly(draft);
  if (brand.category.includes("샌드위치") && /커피 회전율|카페창업|저가커피/.test(text)) return "샌드위치 브랜드에 커피 문맥이 섞였습니다.";
  if (brand.category.includes("커피") && /샌드위치|아이스크림 케이크|샤브/.test(text)) return "커피 브랜드에 다른 업종 문맥이 섞였습니다.";
  if (brand.category.includes("베이커리") && /튀김|샤브|포케/.test(text)) return "베이커리 브랜드에 다른 업종 문맥이 섞였습니다.";
  return "";
}

export function validateDraft(draft, inputArg = draft.input, rules = {}) {
  const input = normalizeInput(inputArg);
  const brand = brandContextFor(input.brand);
  const area = areaContextFor(input.region);
  const text = wholeText(draft);
  const body = bodyOnly(draft);
  const chars = noSpaceLength(draft.bodyParagraphs || []);
  const repeatCount = countRepeat(draft.bodyParagraphs || [], input.repeatPhrase);
  const forbidden = FORBIDDEN_EXPRESSIONS.filter((term) => text.includes(term));
  const awkward = AWKWARD_PHRASES.filter((term) => text.includes(term));
  const proofCount = countTerms(body, PROOF_TERMS);
  const brandPoolCount = countPoolSentences(body, [
    brand.expertSentences || [],
    brand.buyerConcerns || [],
    brand.transferLogic || [],
    brand.operationRisks || [],
    brand.verificationPoints || []
  ]);
  const areaPoolCount = countPoolSentences(body, [
    area.tradeAreaSentences || [],
    area.buyerCheckpoints || [],
    area.trafficPatterns || [],
    area.riskNotes || []
  ]) + (body.includes(areaDepthSentence(input)) ? 1 : 0);
  const brandTraitCount = countTerms(body, [
    ...brand.validationTerms,
    ...brand.contentAngles,
    ...brand.operatingTraits,
    ...brand.transferAdvantages
  ]);
  const areaTraitCount = countTerms(body, area.validationTerms);
  const numeric = numericClaimCheck(body, input);
  const mismatch = industryMismatch(draft, input, brand);
  const weakHits = weakSentenceHits(body);
  const paragraphCount = (draft.bodyParagraphs || []).length;
  const lengthOk = input.length === "naver3000" ? chars >= 3000 : chars >= 1800 && chars <= 2100;
  const repetitionFailures = [];
  const judgementCount = countOccurrences(body, "판단");
  const inspectionCount = countOccurrences(body, "점검");
  const checkCount = countOccurrences(body, "확인");
  const togetherCount = countOccurrences(body, "함께");
  if (judgementCount > 4) repetitionFailures.push(`판단 ${judgementCount}회`);
  if (inspectionCount > 4) repetitionFailures.push(`점검 ${inspectionCount}회`);
  if (checkCount > 8) repetitionFailures.push(`확인 ${checkCount}회`);
  if (togetherCount > 3) repetitionFailures.push(`함께 ${togetherCount}회`);
  if (maxDuplicate(sentenceStarts(draft.bodyParagraphs || [])) >= 3) repetitionFailures.push("같은 문장 시작 반복");
  if (maxDuplicate(sentenceEndings(draft.bodyParagraphs || [])) >= 3) repetitionFailures.push("같은 문장 끝맺음 반복");
  const second = draft.bodyParagraphs?.[1] || "";
  const last = draft.bodyParagraphs?.at(-1) || "";
  const financialOk = /월매출[\s\S]{0,120}(객단가|회전율|고정비|피크타임|매출표|임대료|인건비|원가율|배달 수수료)/.test(body)
    && /창업비용[\s\S]{0,120}(구성|회수|신규창업|리뉴얼|비교)/.test(body)
    && /(권리금|권리 성격|권리금 성격)/.test(body);
  const ctaBad = /문의\s*주세요|추천드립니다|좋은 매장입니다|놓치면/.test(last);
  const ctaGood = /(매출표|비용 구조|임대차|본사승인|인수 가능성|회수 가능성|자료|비교|상담)/.test(last);
  const checks = {
    titleCandidates: check((draft.titleCandidates || []).length === 3, `${(draft.titleCandidates || []).length}/3`, "제목 후보 3개"),
    paragraphs: check(paragraphCount === 12, `${paragraphCount}/12`, "본문 12문단"),
    repeatPhrase: check(repeatCount === 5, `${repeatCount}/5`, "반복문구 정확히 5회"),
    length: check(lengthOk, `${chars.toLocaleString("ko-KR")}자`, input.length === "naver3000" ? "3000자 이상" : "1800~2100자"),
    summaryParagraph: check(second.includes(input.brand) && second.includes(input.region) && second.includes("월매출") && second.includes("창업비용"), "2문단", "매장 조건 요약"),
    brandTraits: check(brandTraitCount >= 3, `${brandTraitCount}/3`, "브랜드 특성 최소 3개 반영"),
    areaTraits: check(areaTraitCount >= 2, `${areaTraitCount}/2`, "지역/상권 특성 최소 2개 반영"),
    transferCompare: check(body.includes("신규창업") && body.includes("양도양수"), "비교", "신규창업 대비 양도양수 비교"),
    proofItems: check(proofCount >= 3, `${proofCount}/3`, "POS/임대료/인건비/원가율/배달비중/본사승인 중 3개 이상"),
    brandSentencePool: check(brandPoolCount >= 2, `${brandPoolCount}/2`, "브랜드 sentence pool 최소 2개 반영"),
    areaSentencePool: check(areaPoolCount >= 1, `${areaPoolCount}/1`, "지역 sentence pool 최소 1개 반영"),
    financialInterpretation: check(financialOk, financialOk ? "해석 연결" : "부족", "월매출/창업비용/권리금 해석 연결"),
    ctaQuality: check(!ctaBad && ctaGood, !ctaBad && ctaGood ? "상담형" : "광고성 또는 근거 부족", "마지막 문단 CTA 품질"),
    professionalSentenceDepth: check(weakHits.length === 0, weakHits.slice(0, 3).join(" / ") || "전문 문장 구조", "일반론·점검형·내부 메모형 문장 금지"),
    awkwardPhrases: check(awkward.length === 0, awkward.join(", ") || "없음", "조사 오류와 어색한 표현 금지"),
    repeatedWords: check(repetitionFailures.length === 0, repetitionFailures.join(", ") || "기준 충족", "반복 표현 과다 금지"),
    forbidden: check(forbidden.length === 0, forbidden.join(", ") || "없음", "작성자용 표현과 과장 표현 금지"),
    numericClaims: check(numeric.unexpected.length === 0 && !numeric.riskyTerm, numeric.unexpected.join(", ") || numeric.riskyTerm || "안전", "입력값에 없는 확정 수치 금지"),
    industryMismatch: check(!mismatch, mismatch || "없음", "브랜드 업종 혼선 금지"),
    tags: check((draft.tags || []).length >= 3, `${(draft.tags || []).length}개`, "태그 존재")
  };
  const warnings = Object.entries(checks)
    .filter(([, item]) => !item.ok)
    .map(([key, item]) => `${key}: ${item.detail} (${item.value})`);
  const advisoryWarnings = advisoryReview(draft, input, checks);
  return {
    ok: warnings.length === 0,
    checks,
    warnings,
    advisoryWarnings,
    allWarnings: [...warnings, ...advisoryWarnings],
    structure: {
      paragraphs: paragraphCount,
      repeatCount,
      charsNoSpace: chars
    },
    qualityMetrics: {
      weakSentenceCount: weakHits.length,
      weakSentences: weakHits
    }
  };
}

export function scoreDraft(draft, inputArg = draft.input, rules = {}) {
  const validation = validateDraft(draft, inputArg, rules);
  const failed = validation.warnings.length;
  const weakSentencePenalty = Math.min(18, (validation.qualityMetrics?.weakSentenceCount || 0) * 4);
  const score = Math.max(0, 100 - failed * 9 - validation.advisoryWarnings.length * 3 - weakSentencePenalty);
  const status = failed === 0 ? "pass" : failed <= 2 ? "check" : "fail";
  const criticalFailures = Object.entries(validation.checks)
    .filter(([key, item]) => !item.ok && ["paragraphs", "repeatPhrase", "length", "awkwardPhrases", "forbidden", "numericClaims", "industryMismatch"].includes(key))
    .map(([key, item]) => `${key}: ${item.detail}`);
  const roles = [
    { role: "시니어 편집장", status: validation.checks.awkwardPhrases.ok && validation.checks.repeatedWords.ok && validation.checks.professionalSentenceDepth.ok ? "pass" : "check" },
    { role: "네이버 SEO", status: validation.checks.paragraphs.ok && validation.checks.repeatPhrase.ok && validation.checks.length.ok ? "pass" : "fail" },
    { role: "프랜차이즈 컨설턴트", status: validation.checks.brandTraits.ok && validation.checks.areaTraits.ok && validation.checks.proofItems.ok ? "pass" : "check" },
    { role: "운영 책임자", status: validation.checks.transferCompare.ok && validation.checks.numericClaims.ok && validation.checks.industryMismatch.ok ? "pass" : "fail" }
  ].map((role) => ({
    ...role,
    passed: role.status === "pass" ? 1 : 0,
    total: 1,
    issue: role.status === "pass" ? "발행 기준을 충족합니다." : "보강 항목이 남아 있습니다."
  }));
  return {
    ...validation,
    score,
    qualityScore: score,
    status,
    criticalFailures,
    roles
  };
}

function toBodyText(draft) {
  return [draft.titleCandidates?.[0] || "", ...(draft.bodyParagraphs || [])].filter(Boolean).join("\n\n");
}

function relatedPosts(input, brand) {
  return [
    `${input.brand} 창업비용, 신규창업과 양도양수 차이`,
    `${input.region} ${brand.category} 상권에서 매장 고를 때 확인할 기준`,
    `${input.brand} 양도양수 상담 전 받아볼 자료`
  ];
}

function isLlmDraftUsable(draft, input) {
  if (!draft) return false;
  const bodyParagraphs = Array.isArray(draft.bodyParagraphs)
    ? draft.bodyParagraphs
    : Array.isArray(draft.bodyParagraphs)
      ? draft.bodyParagraphs
      : draft.body ? String(draft.body).split(/\n{2,}/).slice(1) : [];
  const candidate = repairDraft({
    input,
    titleCandidates: draft.titleCandidates || draft.titles || [],
    bodyParagraphs,
    tags: draft.tags || []
  }, input);
  return validateDraft(candidate, input).ok;
}

export function generateLocalBlogArticle(inputArg = {}, options = {}) {
  const input = normalizeInput(inputArg);
  const plan = buildArticlePlan(input, options);
  let draft = writeDraftFromPlan(plan, options);
  draft = polishDraft(draft, input, plan);
  draft = repairDraft(draft, input, {});
  const score = scoreDraft(draft, input, {});
  return {
    ok: score.ok,
    ...draft,
    body: toBodyText(draft),
    score,
    validation: score,
    warnings: score.warnings,
    relatedPosts: relatedPosts(input, plan.brand)
  };
}

export async function generateBlogArticle(inputArg = {}, options = {}) {
  const input = normalizeInput(inputArg);
  const plan = buildArticlePlan(input, options);
  if (options.useLlm !== false && process.env.OPENAI_API_KEY) {
    try {
      const { writeDraftWithLlm } = await import("./llm-writer.mjs");
      const llmDraft = await writeDraftWithLlm(input, plan, options);
      if (isLlmDraftUsable(llmDraft, input)) {
        let draft = repairDraft({
          input,
          plan,
          source: "llm",
          titleCandidates: llmDraft.titleCandidates || llmDraft.titles || [],
          bodyParagraphs: llmDraft.bodyParagraphs || [],
          tags: llmDraft.tags || [],
          editorNotes: llmDraft.editorNotes || []
        }, input, {});
        const score = scoreDraft(draft, input, {});
        return {
          ok: score.ok,
          ...draft,
          body: toBodyText(draft),
          score,
          validation: score,
          warnings: score.warnings,
          relatedPosts: relatedPosts(input, plan.brand)
        };
      }
    } catch {
      // LLM is optional. The deterministic local engine is the source of reliability.
    }
  }
  return generateLocalBlogArticle(input, options);
}

export const brandContexts = BRAND_CONTEXTS;
export const areaContexts = AREA_CONTEXTS;
export const awkwardPhrases = AWKWARD_PHRASES;
