const express = require("express");
const cors = require("cors");
const fs = require("fs");
const dbgLog = (...args) => {
  const line = args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : a).join(" ");
  fs.appendFileSync("debug.log", line + "\n");
  console.log(...args);
};

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // index.html을 http://localhost:3000 에서 서빙

const SYSTEM_PROMPT = `
You are a top-tier VC investment analyst with 15 years of experience evaluating Korean startups.

Your job is NOT to summarize. Your job is to produce a structured, high-conviction investment report.
Think deeply before writing. Write like you are authoring a memo for a partner meeting.

Reason through scoring, fail rate, and verdict internally before writing JSON.

================================================================
ABSOLUTE OUTPUT RULES
================================================================

1. Output ONLY valid JSON. Zero text outside the JSON.
2. No markdown, no code blocks, no backticks, no explanation.
3. All values in Korean (except enum strings: GO_SCALE, GO_SIDE, NO_GO, HIGH, MEDIUM, LOW).
4. Do NOT compress insights or shorten artificially.
5. Do NOT repeat same logic across sections — each section adds NEW insight.

================================================================
CITATION MANDATE — use the pre-extracted facts in [서버 전처리] section
================================================================

The user message contains a [서버 전처리] section with 7 pre-extracted facts.
These are ground truth. Base ALL scoring reasons on these values.

The FIRST BULLET of each scorecard reason MUST cite the relevant extracted value:

  customer_acquisition.reason first bullet:
    → "입력 채널: [고객 획득 값 인용] — 이 채널의 현실적 효과는..."

  capital_efficiency.reason first bullet:
    → "입력 수익 모델: [수익 모델 값 인용] — 이 모델의 자본 효율성은..."

  differentiation.reason first bullet:
    → "입력 차별화: [차별화 근거 값 인용] — 이 차별화의 실현 가능성은..."

  market_entry.reason first bullet:
    → "입력 타겟: [타겟 고객 값 인용] — 이 시장의 경쟁 강도는..."

PROHIBITION — these statements are BANNED if the pre-extracted value is not "불명확":
  ✗ "채널 전략 부재"     — 고객 획득이 명시된 경우
  ✗ "수익 모델 불명확"   — 수익 모델이 명시된 경우
  ✗ "타겟 고객 미정"     — 타겟 고객이 명시된 경우
  ✗ "운영 방식 미정"     — 운영 방식이 명시된 경우

================================================================
WRITING STYLE
================================================================

WRONG:
- 기능 경쟁 심함
- 브랜드 중요함

CORRECT (핵심 문장 → 근거 구조):
기능만으로는 차별화가 불가능하다
- 주요 브랜드는 이미 유사 기능을 기본 스펙으로 제공
- 소비자는 기능보다 브랜드 신뢰를 우선 선택
- 결과적으로 가격 경쟁 구조로 수렴됨

WRONG action: → 사용자 인터뷰 진행
CORRECT action: → 2주 내 직장인 20명 인터뷰로 실제 구매 조건 수집

CORE PRINCIPLES:
1. Every section must feel like a real investor memo
2. Be specific to this business — no generic statements
3. Use causal reasoning: 왜 → 그래서 → 결과
4. Include realistic numbers with markers (유사 카테고리 기반 추정, 한국 시장 기준)
5. Execution steps must have timeframe + target + measurable goal

SECTION ROLE SEPARATION — each section must add unique insight:
- investment_thesis  → 왜 이 아이디어가 성립하는가 (기회, 차별화 가능성)
- market_reality     → 이 시장 구조의 냉혹한 현실 (경쟁, 채널, 가격)
- execution_gap      → 실제 실행에서 왜 막히는가 (운영 함정, 이론-현실 갭)
- risk_register      → 리스크별 발생 메커니즘과 대응 전략
- go_strategy        → GO_SCALE/GO_SIDE 판정 시: 어떻게 이길 것인가
- no_go_strategy     → NO_GO 판정 시: 왜 접거나 바꿔야 하는가
- first_step         → 지금 당장 실행할 검증 액션

================================================================
SCORING — DETERMINISTIC RULE APPLICATION (재량 판단 금지)
================================================================

⚠️ 같은 [서버 전처리] 값 → 반드시 같은 점수.
아래 룰테이블을 순서대로 적용하라. 룰 외 자유 판단 절대 금지.
failure_rate와 verdict는 서버가 계산하므로 절대 출력하지 말 것.

■ market_entry (1–10, 높을수록 진입 어려움)
  기준 ①: target_customer
    소상공인/자영업자/사장/매장 포함 → 기본값 7
    일반 소비자(B2C) 타겟          → 기본값 6
    기업/법인(B2B 엔터프라이즈)     → 기본값 7
  보정 (+1): differentiation_source가 "불명확" OR 기존 제품과 동일 기능만 나열
  보정 (-1): differentiation_source에 독점 데이터/특허/하드웨어 통합 명시
  범위: 4–9

■ differentiation (1–10, 높을수록 차별화 실현 용이)
  기준: differentiation_source 내용으로 아래 중 하나 선택
    "불명확"                                → 3
    단순 UI 개선 / 자동화 (복제 용이)        → 4
    API 통합 / 단일 채널 자동화              → 5
    기존 시스템 연동 + 독자 분석 로직        → 6
    독점 데이터 파이프라인 / 특허 기반 기술  → 7
    하드웨어+소프트웨어 통합 / 네트워크 효과  → 8
  보정 (+1): expansion_path에 데이터 축적 또는 네트워크 효과 경로 명시
  보정 (-1): acquisition_channel이 "불명확"
  범위: 3–8

■ capital_efficiency (1–10, 높을수록 자본 효율 좋음)
  기준: revenue_model의 가격 및 과금 방식
    월 구독 ≥ 50,000원          → 8
    월 구독 30,000–49,999원     → 7
    월 구독 10,000–29,999원     → 6
    월 구독 < 10,000원           → 5
    건당/프로젝트 단가            → 5
    수수료(%) 모델               → 4
    "불명확"                     → 4
  보정 (-1): operating_model에 "오프라인", "현장", "하드웨어", "수동" 포함
  보정 (+1): operating_model에 "SaaS", "완전 자동화", "API 전용" 포함
  범위: 3–9

■ customer_acquisition (1–10, 높을수록 획득 어려움)
  기준: acquisition_channel의 채널 수
    "불명확"                                     → 8
    단일 채널 (커뮤니티만 / SNS만 / DM만)        → 7
    2개 채널 (SNS + 검색광고, 커뮤니티 + 네이버)  → 6
    3개 이상 채널 또는 플랫폼 입점 포함           → 5
    인바운드 SEO / 콘텐츠 마케팅 포함             → 5
  보정 (+1): target_customer에 소상공인/자영업자 포함 (직접 영업 필요)
  보정 (-1): expansion_path에 바이럴/추천 구조 명시
  범위: 4–9

RISKS: exactly 5, ordered by probability descending, specific to this business.
Use "유사 카테고리 기반 추정" / "한국 시장 기준" for credibility markers.

================================================================
OUTPUT SCHEMA
================================================================

{
  "summary": {
    "reason": "핵심 판정 결론 한 줄 (강하고 짧게, 투자자 메모 수준) — failure_rate/verdict는 서버 계산이므로 이 필드만 출력"
  },

  "investment_thesis": [
    { "title": "핵심 포인트 제목", "description": "핵심 결론 한 문장\n- 근거\n- 근거\n- 근거" },
    { "title": "핵심 포인트 제목", "description": "핵심 결론 한 문장\n- 근거\n- 근거\n- 근거" },
    { "title": "핵심 포인트 제목", "description": "핵심 결론 한 문장\n- 근거\n- 근거\n- 근거" }
  ],

  "scorecard": {
    "market_entry":         { "score": number, "reason": "핵심 문장\n- 근거\n- 근거", "kpi_tag": "2–4단어 키워드 (예: 경쟁 강도 높음)" },
    "differentiation":      { "score": number, "reason": "핵심 문장\n- 근거\n- 근거", "kpi_tag": "2–4단어 키워드 (예: 차별화 실현 어려움)" },
    "capital_efficiency":   { "score": number, "reason": "핵심 문장\n- 근거\n- 근거", "kpi_tag": "2–4단어 키워드 (예: 초기 회수 가능)" },
    "customer_acquisition": { "score": number, "reason": "핵심 문장\n- 근거\n- 근거", "kpi_tag": "2–4단어 키워드 (예: CAC 높음)" }
  },

  "market_reality": [
    { "title": "시장 구조 분석 제목",    "description": "핵심 결론\n- 근거\n- 근거\n- 근거" },
    { "title": "경쟁/채널/가격 현실 제목", "description": "핵심 결론\n- 근거\n- 근거\n- 근거" }
  ],

  "execution_gap": [
    { "title": "실행 함정 제목", "description": "핵심 문장\n- 실제 문제\n- 실제 문제\n- 실제 문제" },
    { "title": "실행 함정 제목", "description": "핵심 문장\n- 실제 문제\n- 실제 문제\n- 실제 문제" }
  ],

  "risk_register": [
    {
      "title": "리스크명 (짧게)",
      "level": "HIGH | MEDIUM | LOW",
      "probability": number,
      "description": "핵심 문장\n- 발생 메커니즘\n- 파급 효과\n- 이 사업에 특히 해당하는 이유",
      "solution": "→ N주 내 [구체적 행동]으로 [측정 가능한 목표] 달성"
    },
    { "title": "...", "level": "...", "probability": number, "description": "핵심\n- 근거\n- 근거\n- 근거", "solution": "→ ..." },
    { "title": "...", "level": "...", "probability": number, "description": "핵심\n- 근거\n- 근거\n- 근거", "solution": "→ ..." },
    { "title": "...", "level": "...", "probability": number, "description": "핵심\n- 근거\n- 근거\n- 근거", "solution": "→ ..." },
    { "title": "...", "level": "...", "probability": number, "description": "핵심\n- 근거\n- 근거\n- 근거", "solution": "→ ..." }
  ],

  "go_strategy": {
    "core_logic": "이 사업이 성공할 수 있는 핵심 전략 논리 한 줄",
    "actions": [
      "→ N주 내 [구체적 행동] + [측정 목표]",
      "→ N주 내 [구체적 행동] + [측정 목표]",
      "→ N주 내 [구체적 행동] + [측정 목표]"
    ],
    "insight": "투자자가 기억해야 할 가장 중요한 통찰 한 줄 (날카롭게)"
  },

  "no_go_strategy": {
    "core_problem": "구조적 실패 이유 한 줄 (핵심만, 짧게)",
    "actions": [
      "→ 지금 당장 방향 전환을 위한 액션 1",
      "→ 지금 당장 방향 전환을 위한 액션 2"
    ]
  },

  NOTE: go_strategy와 no_go_strategy 둘 다 항상 작성하라. null 사용 금지.
  서버가 verdict에 따라 사용하지 않는 쪽을 null로 처리한다.

  "first_step": [
    "→ 당장 실행할 검증 액션 1 (기간 + 대상 + 목표 포함)",
    "→ 당장 실행할 검증 액션 2 (기간 + 대상 + 목표 포함)",
    "→ 당장 실행할 검증 액션 3 (기간 + 대상 + 목표 포함)"
  ]
}

================================================================
FINAL RULES
================================================================

- Return ONLY the JSON object. No text before or after.
- The first key in the JSON MUST be "summary".
- summary must contain ONLY "reason". Do NOT include failure_rate, failure_rate_calc, or verdict — the server computes these.
- go_strategy와 no_go_strategy 둘 다 항상 작성하라. null 사용 금지.
- risk_register must contain exactly 5 items ordered by probability descending.
- description fields use \\n to separate headline from bullet lines.
- solution and actions must follow: → [기간] + [행동] + [목표] format.
- No abstract bullets. No repeated logic across sections.
- If the description says this tool serves 자영업자/소상공인/사업자 as customers, it is a B2B tool — NOT a consumer app. Analyze accordingly.
`;

const EXTRACT_SYSTEM = `
You are a business analyst. Extract exactly 7 fields from the business description below.
Output ONLY valid JSON, no markdown, no explanation.

Field definitions:
- target_customer:        Who pays? Infer from context if not stated explicitly. (e.g. "반려견·묘를 키우는 30~40대 직장인")
- revenue_model:          How is money made? Include price and billing cycle if mentioned. (e.g. "월 39,000원 정기 구독")
- acquisition_channel:    How are customers reached? Scan broadly: 광고, 바이럴, SNS, 인플루언서, 커뮤니티, 협업, 이벤트, 체험, 플랫폼 키워드. (e.g. "인스타그램·유튜브 인플루언서 협업, 첫 달 무료 체험, 반려동물 커뮤니티 바이럴")
- operating_model:        How is the service delivered? Infer from the business model if not explicit. (e.g. "매달 큐레이션 박스 정기 배송")
- differentiation_source: What makes this different from existing alternatives? Extract stated advantages and comparisons. (e.g. "수의사 추천 상품 + 반려동물 체중·나이 맞춤 큐레이션")
- repeat_purchase_basis:  Why do customers keep paying? Infer from subscription/lock-in mechanics. (e.g. "월 구독 자동 갱신, 큐레이션 편의성")
- expansion_path:         How does this scale beyond the initial market? Look for viral mechanics, network effects, or future segments. (e.g. "반려동물 커뮤니티 바이럴 확산")

Output this exact JSON shape:
{
  "target_customer":        "직접 인용 또는 추론값",
  "revenue_model":          "직접 인용 또는 추론값",
  "acquisition_channel":    "직접 인용 또는 추론값",
  "operating_model":        "직접 인용 또는 추론값",
  "differentiation_source": "직접 인용 또는 추론값",
  "repeat_purchase_basis":  "직접 인용 또는 추론값",
  "expansion_path":         "직접 인용 또는 추론값"
}

RULES:
- Read the FULL description carefully before extracting — long-form inputs contain many implicit signals.
- Quote directly from the description when exact phrases are available.
- When a field is not explicitly stated, INFER from context and write your inference. Do NOT immediately write "불명확".
- Write "불명확" ONLY when the field is truly absent and cannot be reasonably inferred from any part of the description.
- acquisition_channel: look for ANY mention of marketing, advertising, influencers, communities, platforms, word-of-mouth, launch events, trial offers, sales methods, or growth strategies.
- differentiation_source: look for competitor comparisons, stated advantages, unique features, or user experience differences.
- expansion_path: look for viral mechanics, additional target segments, network effects, or future product plans.
- If description says 자영업자/소상공인/사업자 are customers → target_customer must clearly reflect this B2B context.
`;

// ── 서버 사이드 점수 계산 (결정론적 규칙 테이블) ──────────────────────────────
function computeScores(extraction) {
  const {
    target_customer        = "명시 없음",
    revenue_model          = "명시 없음",
    acquisition_channel    = "명시 없음",
    operating_model        = "명시 없음",
    differentiation_source = "명시 없음",
    expansion_path         = "명시 없음"
  } = extraction;

  // ── market_entry (높을수록 진입 어려움, 범위 4–9) ──
  let me;
  if (/소상공인|자영업자|사장|매장/.test(target_customer)) me = 7;
  else if (/기업|법인|B2B|엔터프라이즈/.test(target_customer))  me = 7;
  else me = 6; // 일반 소비자 B2C
  if (differentiation_source === "불명확") me += 1;
  if (/독점.{0,6}데이터|특허|하드웨어.{0,4}통합/.test(differentiation_source)) me -= 1;
  me = Math.min(9, Math.max(4, me));

  // ── differentiation (높을수록 차별화 용이, 범위 3–8) ──
  let diff;
  if (differentiation_source === "불명확") {
    diff = 3;
  } else if (/하드웨어.{0,6}소프트웨어|네트워크.{0,4}효과/.test(differentiation_source)) {
    diff = 8;
  } else if (/독점.{0,6}데이터|특허/.test(differentiation_source)) {
    diff = 7;
  } else if (/기존.{0,6}시스템.{0,6}연동|독자.{0,6}분석/.test(differentiation_source)) {
    diff = 6;
  } else if (/API.{0,6}통합|단일.{0,6}채널.{0,6}자동화/.test(differentiation_source)) {
    diff = 5;
  } else if (/UI.{0,4}개선|자동화/.test(differentiation_source)) {
    diff = 4;
  } else {
    diff = 4; // fallback
  }
  if (/데이터.{0,4}축적|네트워크.{0,4}효과/.test(expansion_path)) diff += 1;
  if (acquisition_channel === "불명확") diff -= 1;
  diff = Math.min(8, Math.max(3, diff));

  // ── capital_efficiency (높을수록 자본 효율 좋음, 범위 3–9) ──
  let ce;
  const priceMatch = revenue_model.match(/(\d[\d,]+)\s*원/);
  const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ""), 10) : 0;
  if (/월\s*구독|월정액|구독/.test(revenue_model)) {
    if      (price >= 50000) ce = 8;
    else if (price >= 30000) ce = 7;
    else if (price >= 10000) ce = 6;
    else if (price >  0)     ce = 5;
    else                     ce = 6; // 구독이지만 가격 미명시
  } else if (/건당|프로젝트/.test(revenue_model)) {
    ce = 5;
  } else if (/수수료|%/.test(revenue_model)) {
    ce = 4;
  } else {
    ce = 4; // 명시 없음
  }
  if (/오프라인|현장|하드웨어|수동/.test(operating_model)) ce -= 1;
  if (/SaaS|완전.{0,4}자동화|API.{0,4}전용/.test(operating_model)) ce += 1;
  ce = Math.min(9, Math.max(3, ce));

  // ── customer_acquisition (높을수록 획득 어려움, 범위 4–9) ──
  let ca;
  if (acquisition_channel === "불명확") {
    ca = 8;
  } else {
    const parts = acquisition_channel.split(/[,+·\/&]/).map(s => s.trim()).filter(Boolean);
    if      (parts.length >= 3) ca = 5;
    else if (parts.length === 2) ca = 6;
    else                         ca = 7;
    if (/SEO|콘텐츠.{0,4}마케팅|플랫폼.{0,4}입점/.test(acquisition_channel)) ca = Math.min(ca, 5);
  }
  if (/소상공인|자영업자/.test(target_customer)) ca += 1;
  if (/바이럴|추천/.test(expansion_path)) ca -= 1;
  ca = Math.min(9, Math.max(4, ca));

  return { market_entry: me, differentiation: diff, capital_efficiency: ce, customer_acquisition: ca };
}

async function callAnthropic(system, userContent, maxTokens = 5000) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      temperature: 0,
      system,
      messages: [{ role: "user", content: userContent }]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Anthropic API error: ${JSON.stringify(data)}`);
  return (data.content || []).map(b => b?.type === "text" ? b.text : "").join("\n").trim();
}

const REPORT_SYSTEM = `
You are a senior VC analyst writing a formal investment memo in Korean.
You will receive a structured JSON analysis of a business idea.
Your job is to convert it into a flowing, human-readable VC report in Korean.

STRICT RULES:
- Do NOT change any numbers, scores, percentages, or the verdict.
- Do NOT add new judgments or data not present in the JSON.
- Do NOT use bullet points or markdown. Write in natural paragraph form.
- Output plain text only — no JSON, no headers with #, no bold markers.
- Write in the voice of a senior partner presenting to an investment committee.
- Keep each section separated by a blank line.
- Total length: 400–600 Korean characters.

Section order to cover (one paragraph each):
1. Verdict & Fail Rate — open with the verdict and failure probability, and why
2. Investment Thesis — what makes this opportunity worth considering
3. Market Reality & Execution Gap — the structural challenges this business faces
4. Key Risks — the top 2–3 risks that matter most
5. Recommendation — the GO/NO-GO action in 1–2 sentences
`;

function buildReportPrompt(analysis) {
  const s = analysis.summary || {};
  const thesis = (analysis.investment_thesis || []).map(t => `[${t.title}] ${t.description}`).join("\n");
  const reality = (analysis.market_reality || []).map(r => `[${r.title}] ${r.description}`).join("\n");
  const gap = (analysis.execution_gap || []).map(g => `[${g.title}] ${g.description}`).join("\n");
  const risks = (analysis.risk_register || []).slice(0, 3).map(r =>
    `[${r.title} / ${r.level} / ${r.probability}%] ${r.description}`
  ).join("\n");
  const strategy = s.verdict === "NO_GO"
    ? `NO_GO 판정: ${(analysis.no_go_strategy || {}).core_problem || ""}`
    : `GO 판정: ${(analysis.go_strategy || {}).core_logic || ""}`;

  return `아래 분석 JSON 요약을 바탕으로 VC 투자 리포트 문장을 작성하라.
수치, 점수, verdict는 절대 변경하지 말 것.

[Verdict]
판정: ${s.verdict} | 실패 확률: ${s.failure_rate}% | 판정 이유: ${s.reason}

[Investment Thesis]
${thesis}

[Market Reality]
${reality}

[Execution Gap]
${gap}

[Key Risks]
${risks}

[Recommendation]
${strategy}
`;
}

async function generateReportText(analysis) {
  const prompt = buildReportPrompt(analysis);
  dbgLog("\n========== [CALL 3] REPORT TEXT GENERATION ==========");
  const text = await callAnthropic(REPORT_SYSTEM, prompt, 2000);
  dbgLog("Report text (앞 300자):", text.slice(0, 300));
  return text;
}

function parseJSON(raw) {
  const cleaned = raw.replace(/```json/gi, "```").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}") + 1;
  if (start === -1 || end <= 0) throw new Error("No JSON found in response");
  return JSON.parse(cleaned.slice(start, end));
}

app.post("/analyze", async (req, res) => {
  const { name, desc } = req.body;

  if (!name || !desc) {
    return res.status(400).json({ error: "name과 desc가 필요합니다." });
  }

  try {
    // ── CALL 1: Extract structured input facts ─────────────────────────
    dbgLog("\n========== [CALL 1] INPUT EXTRACTION ==========");
    const extractRaw = await callAnthropic(
      EXTRACT_SYSTEM,
      `사업명: ${name}\n\n사업 설명:\n${desc}`,
      500
    );
    dbgLog("Extract raw:", extractRaw.slice(0, 400));

    let extraction;
    try {
      extraction = parseJSON(extractRaw);
    } catch (e) {
      dbgLog("Extraction parse failed:", e.message, "— using fallbacks");
      extraction = {
        target_customer: "불명확", revenue_model: "불명확",
        acquisition_channel: "불명확", operating_model: "불명확",
        differentiation_source: "불명확", repeat_purchase_basis: "불명확",
        expansion_path: "불명확"
      };
    }
    dbgLog("Extracted:", JSON.stringify(extraction, null, 2));

    // ── 서버 사이드 점수 계산 (결정론적) ─────────────────────────────────────
    const scores = computeScores(extraction);
    const { market_entry: me, differentiation: diff, capital_efficiency: ce, customer_acquisition: ca } = scores;
    dbgLog("Server-computed scores:", JSON.stringify(scores));

    // ── Server-side failure_rate & verdict (점수도 서버 계산이므로 완전 결정론적) ──
    const raw          = me + (10 - ce) + ca - diff + 5;
    const failure_rate = Math.min(100, Math.max(0, Math.round(raw * 3.3)));

    let verdict;
    if (me >= 8 && diff <= 3) {
      verdict = "NO_GO";
    } else if (failure_rate < 45 && diff >= 6 && ce >= 6) {
      verdict = "GO_SCALE";
    } else if (failure_rate < 65) {
      verdict = "GO_SIDE";
    } else {
      verdict = "NO_GO";
    }
    dbgLog("Server verdict:", verdict, "| failure_rate:", failure_rate);

    // ── CALL 2: Full analysis — 점수는 주입, Claude는 텍스트만 생성 ──────────
    const userMessage = `사업명: ${name}

사업 설명:
${desc}

================================================================
[서버 전처리] 아래는 위 사업 설명에서 이미 추출된 사실입니다.
채점 근거는 반드시 이 값들을 인용해야 합니다.
================================================================
- 타겟 고객:    ${extraction.target_customer}
- 수익 모델:    ${extraction.revenue_model}
- 고객 획득:    ${extraction.acquisition_channel}
- 운영 방식:    ${extraction.operating_model}
- 차별화 근거:  ${extraction.differentiation_source}
- 재구매 근거:  ${extraction.repeat_purchase_basis}
- 확장 경로:    ${extraction.expansion_path}

================================================================
[서버 확정 점수] 아래 점수는 서버가 규칙 테이블로 이미 계산한 값입니다.
scorecard의 score 필드는 반드시 이 값을 그대로 사용할 것. 절대 변경 금지.
================================================================
- market_entry score:         ${me}
- differentiation score:      ${diff}
- capital_efficiency score:   ${ce}
- customer_acquisition score: ${ca}

위 추출값이 "불명확"이 아닌 경우, 해당 항목에 대해 "채널 전략 부재", "수익 모델 불명확", "타겟 미정" 등의 표현을 사용하지 말 것.
`;

    dbgLog("\n========== [CALL 2] FULL ANALYSIS ==========");
    dbgLog("User message (앞 600자):", userMessage.slice(0, 600));

    const analysisRaw = await callAnthropic(SYSTEM_PROMPT, userMessage, 5000);
    dbgLog("\n[DEBUG 1] Analysis raw (앞 800자):", analysisRaw.slice(0, 800));

    let result;
    try {
      result = parseJSON(analysisRaw);
    } catch (e) {
      console.error("Analysis JSON parse error:", analysisRaw.slice(0, 1000));
      return res.status(500).json({ error: "JSON 파싱 실패", raw: analysisRaw.slice(0, 1000) });
    }

    // ── Claude가 점수를 바꿨을 경우 서버 값으로 강제 덮어쓰기 ──────────────────
    if (!result.scorecard) result.scorecard = {};
    result.scorecard.market_entry        = { ...(result.scorecard.market_entry        || {}), score: me };
    result.scorecard.differentiation     = { ...(result.scorecard.differentiation     || {}), score: diff };
    result.scorecard.capital_efficiency  = { ...(result.scorecard.capital_efficiency  || {}), score: ce };
    result.scorecard.customer_acquisition= { ...(result.scorecard.customer_acquisition|| {}), score: ca };

    if (!result.summary) result.summary = {};
    result.summary.failure_rate      = failure_rate;
    result.summary.failure_rate_calc = `((${me} + (10-${ce}) + ${ca}) - ${diff} + 5) × 3.3 = ${raw} × 3.3 = ${failure_rate}`;
    result.summary.verdict           = verdict;

    // Null out the strategy that doesn't apply
    if (verdict === "NO_GO") {
      result.go_strategy = null;
    } else {
      result.no_go_strategy = null;
    }

    // ── Inject extraction into result (server-enforced) ────────────────
    result.input_extraction = extraction;

    dbgLog("\n========== [DEBUG 2] PARSED JSON CORE VALUES ==========");
    dbgLog("verdict      :", result?.summary?.verdict);
    dbgLog("failure_rate :", result?.summary?.failure_rate);
    dbgLog("failure_rate_calc:", result?.summary?.failure_rate_calc);
    dbgLog("input_extraction:", JSON.stringify(result?.input_extraction));
    dbgLog("scorecard    :", JSON.stringify(result?.scorecard, null, 2));
    dbgLog("=======================================================\n");

    // ── CALL 3: Convert JSON analysis → VC report text ────────────────
    const reportText = await generateReportText(result).catch(err => {
      dbgLog("Report text generation failed (non-fatal):", err.message);
      return "";
    });
    result.report_text = reportText;

    res.json(result);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
