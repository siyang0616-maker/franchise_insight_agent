export function classifyContentCompetition(totalSearch, blogTotal, newsTotal, items = []) {
  const search = Number(totalSearch || 0);
  const docTotal = Number(blogTotal || 0) + Number(newsTotal || 0);
  const safeItems = Array.isArray(items) ? items : [];
  const recentItems = safeItems.filter((item) => item.ageDays !== null && item.ageDays <= 14);
  const adLike = safeItems.filter((item) => /양도양수형|광고강함/.test(item.intent));

  let demandLevel;
  if (search >= 1000) demandLevel = "high";
  else if (search >= 100) demandLevel = "mid";
  else demandLevel = "low";

  if (demandLevel === "low") {
    if (!safeItems.length) {
      return { label: "관찰", supplyRatio: null, demandLevel, reason: "검색량이 적어 정밀 비교보다는 수요 자체를 먼저 확인하는 것을 권장합니다." };
    }
    if (recentItems.length >= 3 && adLike.length >= 2) {
      return { label: "피하기", supplyRatio: null, demandLevel, reason: "검색량은 적지만 최근 광고성 글이 몰려 있어 노출 경쟁이 있습니다." };
    }
    return { label: "관찰", supplyRatio: null, demandLevel, reason: "검색량이 적어 수요 자체를 먼저 확인하는 것을 권장합니다." };
  }

  const supplyRatio = Math.round((docTotal / (search / 100)) * 100) / 100;
  const recentDensity = safeItems.length ? recentItems.length / safeItems.length : 0;
  const adDensity = safeItems.length ? adLike.length / safeItems.length : 0;

  let label;
  if (supplyRatio < 1) label = "틈새";
  else if (supplyRatio < 10) label = "따라쓰기";
  else if (supplyRatio < 100) label = "관찰";
  else label = "피하기";

  if (label !== "피하기" && recentDensity >= 0.6 && adDensity >= 0.4) {
    label = label === "틈새" ? "따라쓰기" : "피하기";
  }

  return { label, supplyRatio, demandLevel, reason: `검색량 100건당 관련 문서 ${supplyRatio}건으로 추정됩니다.` };
}

export function occupancyBonusFor(row) {
  const label = row?.competitionLabel;
  if (label === "틈새") return 2.0;
  if (label === "따라쓰기") return 0.8;
  if (label === "관찰") return 0;
  if (label === "피하기") return -1.5;
  return 0;
}

export function normalizeDataLabPoints(rawPoints = []) {
  return (Array.isArray(rawPoints) ? rawPoints : []).map((point) => ({
    date: point?.period || "",
    value: Math.round(Number(point?.ratio || 0) * 10) / 10
  }));
}

export function buildTrend7d(trend30d = {}) {
  const trend7Points = (trend30d.points || []).slice(-7);
  const trend7Values = trend7Points.map((point) => Number(point?.value || 0));
  const trend7Average = trend7Values.length
    ? trend7Values.reduce((sum, value) => sum + value, 0) / trend7Values.length
    : 0;
  return {
    points: trend7Points,
    average: Math.round(trend7Average * 10) / 10,
    delta: Math.round(((trend7Values.at(-1) || 0) - (trend7Values[0] || 0)) * 10) / 10
  };
}
