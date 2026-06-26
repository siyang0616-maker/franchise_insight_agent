function llmPrompt(input, plan) {
  return [
    "네이버 블로그용 프랜차이즈 양도양수 상담형 원고를 JSON으로만 작성하세요.",
    "제목 후보는 3개, 본문은 정확히 12문단, 반복문구는 본문 기준 정확히 5회입니다.",
    "허위 수치, 과장 표현, 작성자용 메모, SEO 해설은 금지합니다.",
    `브랜드: ${input.brand}`,
    `지역: ${input.region}`,
    `월매출: ${input.salesText}`,
    `창업비용: ${input.premiumText}`,
    `반복문구: ${input.repeatPhrase}`,
    `브랜드 컨텍스트: ${JSON.stringify(plan.brand)}`,
    `지역 컨텍스트: ${JSON.stringify(plan.area)}`,
    "반환 스키마: {\"titleCandidates\":[\"\",\"\",\"\"],\"bodyParagraphs\":[\"총 12개 문단\"],\"tags\":[\"\",\"\",\"\"],\"editorNotes\":[]}"
  ].join("\n");
}

function extractJson(text) {
  const clean = String(text || "").trim();
  if (!clean) return null;
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

export async function writeDraftWithLlm(input, plan, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL || options.model || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You write practical Korean franchise transfer blog drafts and return strict JSON only." },
        { role: "user", content: llmPrompt(input, plan) }
      ]
    }),
    signal: AbortSignal.timeout(Number(process.env.OPENAI_TIMEOUT_MS || 25000))
  });
  if (!res.ok) throw new Error(`OpenAI API ${res.status}`);
  const data = await res.json();
  return extractJson(data.choices?.[0]?.message?.content);
}
