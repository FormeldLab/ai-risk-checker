// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const STORAGE_KEY = "airc_recent_v2";
const USAGE_KEY   = "airc_usage_v1";
const DAILY_LIMIT = 5;

const SAMPLE_INPUT = {
  name: "반려동물 프리미엄 구독 케어 박스",
  desc: `어떤 문제를 해결하나요?
바쁜 반려인이 매달 반려동물 용품(사료·간식·위생용품)을 개별 구매하는 번거로움과 과소비를 해결합니다.

누가 돈을 내나요?
반려견·묘 1마리 이상을 키우는 30~40대 직장인. 월 소비 5만원 이상 이미 지출 중인 고관여 반려인.

얼마에 팔 건가요?
월 39,000원 정기 구독. 일반 소매가 대비 20% 절감 + 큐레이션 프리미엄 포지셔닝.

왜 기존 대안 대신 이걸 선택하나요?
쿠팡·네이버는 개별 구매 번거로움, 기존 구독박스는 품질 낮고 선택권 없음. 수의사 추천 상품 + 반려동물 체중·나이 맞춤 큐레이션으로 차별화.

고객은 어떻게 모을 건가요?
인스타그램·유튜브 반려동물 인플루언서 협업, 첫 달 무료 체험, 반려동물 커뮤니티 바이럴.`
};

// ═══════════════════════════════════════════════════════════
// LOCAL STORAGE
// ═══════════════════════════════════════════════════════════

function saveToRecent(name, desc, verdict, failRate) {
  try {
    const list = getRecent();
    list.unshift({ name, desc, verdict, failRate, ts: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 5)));
  } catch (e) { /* ignore */ }
}

function getRecent() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}

function renderRecentSection() {
  const list = getRecent();
  const wrap = document.getElementById("recentWrap");
  const container = document.getElementById("recentList");
  if (!list.length) { wrap.style.display = "none"; return; }

  wrap.style.display = "";
  container.innerHTML = list.map((item, i) => {
    const date = new Date(item.ts).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
    const verdictCls = (item.verdict === "GO" || item.verdict === "GO_SCALE") ? "go-scale"
                     : item.verdict === "GO_SIDE" ? "go-side" : "no-go";
    return `
      <div class="recent-item" data-idx="${i}">
        <div class="recent-item-left">
          <span class="recent-verdict ${verdictCls}">${item.verdict || "—"}</span>
          <span class="recent-name">${item.name}</span>
        </div>
        <div class="recent-item-right">
          <span class="recent-fail">${item.failRate}%</span>
          <span class="recent-date">${date}</span>
        </div>
      </div>`;
  }).join("");

  container.querySelectorAll(".recent-item").forEach(el => {
    el.addEventListener("click", () => {
      const item = list[Number(el.dataset.idx)];
      nameInput.value = item.name;
      descInput.value = item.desc;
      syncBtn();
      nameInput.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

// ═══════════════════════════════════════════════════════════
// DAILY USAGE LIMIT
// ═══════════════════════════════════════════════════════════

function getUsageState() {
  try {
    const raw = JSON.parse(localStorage.getItem(USAGE_KEY) || "{}");
    const today = new Date().toLocaleDateString("sv-SE"); // "YYYY-MM-DD"
    if (raw.date !== today) return { date: today, count: 0 };
    return { date: today, count: Number(raw.count) || 0 };
  } catch { return { date: new Date().toLocaleDateString("sv-SE"), count: 0 }; }
}

function canUseToday() {
  return getUsageState().count < DAILY_LIMIT;
}

function increaseTodayUsage() {
  try {
    const state = getUsageState();
    state.count += 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

function renderUsageStatus() {
  const el = document.getElementById("usageStatus");
  if (!el) return;
  const { count } = getUsageState();
  const remaining = DAILY_LIMIT - count;
  el.textContent = `오늘 ${DAILY_LIMIT}회 중 ${count}회 사용`;
  el.className = remaining <= 0 ? "usage-status usage-limit" : "usage-status";
}

// ═══════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════

async function analyze(name, desc) {
  const response = await fetch("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, desc })
  });

  const apiData = await response.json();
  if (!response.ok) throw new Error(apiData.error || "분석 요청 실패");

  const raw = apiData.summary || {};
  const verdictMap = {
    GO:       { label: "GO",      cls: "go-scale" },
    GO_SCALE: { label: "GO",      cls: "go-scale" },
    GO_SIDE:  { label: "GO SIDE", cls: "go-side"  },
    NO_GO:    { label: "NO GO",   cls: "no-go"    }
  };
  const vi = verdictMap[raw.verdict] || { label: raw.verdict || "—", cls: "no-go" };

  // ── [DEBUG 3] 화면 렌더 직전 값 확인 ──────────────────────
  console.log("\n========== [DEBUG 3] PRE-RENDER VALUES ==========");
  console.log("API raw.verdict      :", raw.verdict);
  console.log("API raw.failure_rate :", raw.failure_rate);
  console.log("verdictMap 매핑 결과 :", vi);
  console.log("verdictRaw (저장값)  :", raw.verdict || "NO_GO");
  console.log("isGo                 :", raw.verdict === "GO" || raw.verdict === "GO_SIDE");
  console.log("==================================================\n");
  // ──────────────────────────────────────────────────────────

  return {
    generatedAt:   new Date().toLocaleString("ko-KR"),
    bizName:       name,
    verdictLabel:  vi.label,
    verdictCls:    vi.cls,
    verdictRaw:    raw.verdict || "NO_GO",
    isGo:          raw.verdict === "GO" || raw.verdict === "GO_SIDE",
    failureRate:     Number(raw.failure_rate) || 0,
    failureRateCalc: raw.failure_rate_calc || "",
    summaryReason:   raw.reason || "",
    thesis:        Array.isArray(apiData.investment_thesis) ? apiData.investment_thesis : [],
    scorecard:     apiData.scorecard || {},
    marketReality: Array.isArray(apiData.market_reality)   ? apiData.market_reality   : [],
    execGap:       Array.isArray(apiData.execution_gap)    ? apiData.execution_gap    : [],
    risks:         Array.isArray(apiData.risk_register)    ? apiData.risk_register    : [],
    goStrategy:    apiData.go_strategy    || null,
    nogoStrategy:  apiData.no_go_strategy || null,
    firstStep:     Array.isArray(apiData.first_step)       ? apiData.first_step       : [],
    reportText:    apiData.report_text || ""
  };
}

// ═══════════════════════════════════════════════════════════
// RENDER HELPERS
// ═══════════════════════════════════════════════════════════

function riskColor(v) {
  const n = Number(v) || 0;
  if (n >= 65) return "var(--accent-red)";
  if (n >= 40) return "var(--accent-orange)";
  return "var(--accent-blue)";
}

function scoreBarColor(key, score) {
  const isPositive = key === "differentiation" || key === "capital_efficiency";
  const n = score * 10;
  if (isPositive) {
    return n >= 70 ? "var(--accent-green)" : n >= 40 ? "var(--accent-orange)" : "var(--accent-red)";
  } else {
    return n >= 70 ? "var(--accent-red)" : n >= 40 ? "var(--accent-orange)" : "var(--accent-green)";
  }
}

/** Score → High/Medium/Low label + color */
function scoreToLevel(_key, score) {
  const high = { label: "High",   color: "#B91C1C" }; /* red-700 */
  const med  = { label: "Medium", color: "#C2610A" }; /* orange-700 */
  const low  = { label: "Low",    color: "#A16207" }; /* yellow-700 */
  if (score >= 7) return high;
  if (score >= 4) return med;
  return low;
}

/** Extract headline (first non-empty line) from reason text */
function reasonHeadline(text) {
  return String(text || "").split("\n").find(l => l.trim()) || "";
}

/** Extract KPI summary — "—" 뒤 결론 문장, JS 잘라붙이기 없음 */
function reasonFirstBullet(text) {
  const lines = String(text || "").split("\n").filter(l => l.trim());
  const headline = (lines[0] || "").replace(/^[-–•]\s*/, "").trim();

  // "—" 또는 "—" 이후가 실제 분석 결론
  const afterDash = headline.split(/\s*[—–]\s*/)[1] || "";

  if (afterDash) {
    // "이 채널의 현실적 효과는", "이 시장의 경쟁 강도는" 등 상투적 도입부 제거
    return afterDash
      .replace(/^이\s+\S+(의|은|는|이)\s+\S+(은|는|이|가)\s+/, "")
      .replace(/^(이|그|이런|이러한)\s+/, "")
      .trim();
  }

  // "—"가 없으면 "입력 X:" 접두어만 제거하고 반환
  return headline.replace(/^입력\s+\S+:\s+[^—–]+[—–]\s*/, "").trim() || headline;
}

function renderDesc(text) {
  if (!text) return "";
  const lines    = String(text).split("\n");
  const headline = lines[0] || "";
  const bullets  = lines.slice(1).filter(l => l.trim());
  const bulletsHtml = bullets.map(b =>
    `<li class="desc-bullet">${b.replace(/^[-–•]\s*/, "")}</li>`
  ).join("");
  return `<p class="desc-headline">${headline}</p>${bulletsHtml ? `<ul class="desc-bullets">${bulletsHtml}</ul>` : ""}`;
}

/** Numbered thesis item (01, 02, 03 style) */
function renderThesisItem(item, index) {
  const num = String(index + 1).padStart(2, "0");
  return `
    <div class="thesis-item">
      <span class="thesis-num">${num}</span>
      <div class="thesis-body">
        <div class="thesis-title">${item.title || ""}</div>
        ${item.description ? `<div class="thesis-desc">${reasonHeadline(item.description)}</div>` : ""}
      </div>
    </div>`;
}

/** Score bar row */
function renderScoreItem(key, label, item) {
  const score = Number(item.score) || 0;
  const pct   = score * 10;
  const color = scoreBarColor(key, score);
  const headline = reasonHeadline(item.reason || "");
  return `
    <div class="sc-item">
      <div class="sc-header">
        <span class="sc-name">${label}</span>
        <span class="sc-num" style="color:${color}">${score}<span class="sc-denom">/10</span></span>
      </div>
      <div class="sc-track">
        <div class="sc-fill" data-w="${pct}" style="background:${color};width:0%"></div>
      </div>
      ${headline ? `<div class="sc-reason">${headline}</div>` : ""}
    </div>`;
}

/** Market Reality — single column row */
function renderMarketCell(item) {
  const lines   = String(item.description || "").split("\n").filter(l => l.trim());
  const headline = lines[0] || "";
  const bullets  = lines.slice(1).filter(l => l.replace(/^[-–•]\s*/, "").trim());
  return `
    <div class="market-row">
      <div class="market-row-title">${item.title || ""}</div>
      <div class="market-row-headline">${headline}</div>
      ${bullets.length ? `<ul class="market-row-bullets">${bullets.map(b =>
        `<li>${b.replace(/^[-–•]\s*/, "")}</li>`).join("")}</ul>` : ""}
    </div>`;
}

/** Execution Gap item (Gap1 / Gap2 / Gap3 badge) */
function renderGapItem(item, index) {
  const headline = reasonHeadline(item.description || "") || item.title || "";
  return `
    <div class="gap-item">
      <span class="gap-badge">Gap ${index + 1}</span>
      <div class="gap-text">${headline}</div>
    </div>`;
}

/** Risk item with bar + Mitigation */
function renderRiskItem(risk, index) {
  const prob  = Number(risk.probability) || 0;
  const color = riskColor(prob);
  const headline = reasonHeadline(risk.description || "");
  return `
    <div class="risk-item">
      <div class="risk-header">
        <div class="risk-header-left">
          <span class="risk-num">${index + 1}</span>
          <span class="risk-title">${risk.title || ""}</span>
        </div>
        <span class="risk-pct-val" style="color:${color}">${prob}%</span>
      </div>
      <div class="risk-bar-track">
        <div class="risk-bar-fill" data-w="${prob}" style="background:${color};width:0%"></div>
      </div>
      ${headline ? `<div class="risk-desc">${headline}</div>` : ""}
      ${risk.solution ? `<div class="risk-mitigation-label">Mitigation</div><div class="risk-mitigation-text">${risk.solution.replace(/^→\s*/, "")}</div>` : ""}
    </div>`;
}

/** Checkbox step item */
function renderStepItem(text, idx, group) {
  return `
    <li class="step-item">
      <label class="step-label">
        <input type="checkbox" class="step-check" data-group="${group}" data-idx="${idx}">
        <span class="step-check-box">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5L4 7.5 8.5 2.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="step-text">${text}</span>
      </label>
    </li>`;
}

function renderActionChecks(actions, group) {
  return (actions || []).map((a, i) => renderStepItem(a, i, group)).join("");
}

// ═══════════════════════════════════════════════════════════
// COPY
// ═══════════════════════════════════════════════════════════

let currentData = null;

function buildCopyText(data) {
  const lines = [
    `[AI Risk Checker] ${data.bizName}`,
    `생성일: ${data.generatedAt}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `판정: ${data.verdictLabel}  |  실패 확률: ${data.failureRate}%`,
    `핵심: ${data.summaryReason}`,
    ``,
    `── 투자 가능성 근거 ──`,
    ...data.thesis.map(t => {
      const first = (t.description || "").split("\n")[0];
      return `• ${t.title}: ${first}`;
    }),
    ``,
    `── 지금 당장 실행할 것 ──`,
    ...data.firstStep,
  ];
  if (data.isGo && data.goStrategy) {
    lines.push("", "── GO 전략 ──", data.goStrategy.core_logic || "");
    (data.goStrategy.actions || []).forEach(a => lines.push(a));
  } else if (!data.isGo && data.nogoStrategy) {
    lines.push("", "── NO-GO 분석 ──", data.nogoStrategy.core_problem || "");
  }
  return lines.join("\n");
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("toast--show");
  setTimeout(() => t.classList.remove("toast--show"), 2200);
}

// ═══════════════════════════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════════════════════════

function renderReport(data) {
  currentData = data;

  // ── Header ──────────────────────────────────────────────
  document.getElementById("rTime").textContent    = data.generatedAt || "";
  document.getElementById("rBizName").textContent = data.bizName     || "";

  // ── ① Verdict Banner ────────────────────────────────────
  const vEl = document.getElementById("rVerdict");
  vEl.textContent = data.verdictLabel || "";
  vEl.className   = "verdict-badge " + (data.verdictCls || "no-go");

  const banner = document.getElementById("rVerdictBanner");
  banner.className = "verdict-banner verdict-banner--" + (data.verdictCls || "no-go");

  document.getElementById("rSummaryReason").textContent = data.summaryReason || "";

  // ── ② 4-stat row ────────────────────────────────────────
  const sc = data.scorecard || {};
  const fr = data.failureRate || 0;

  // Fail rate stat
  const failEl = document.getElementById("rFailPct");
  failEl.textContent = fr + "%";
  const verdict = data.verdict || "";
  failEl.style.color = verdict === "GO_SCALE" ? "#15803D"   /* green-700 */
                     : verdict === "GO_SIDE"  ? "#C2610A"   /* orange-700 */
                     :                          "#B91C1C";  /* red-700 */
  const failSub = fr < 45 ? "낮음" : fr < 65 ? "보통" : "높음";
  document.getElementById("rFailSub").textContent = failSub;

  // market_entry stat
  const meScore = Number((sc.market_entry || {}).score) || 0;
  const meLvl   = scoreToLevel("market_entry", meScore);
  document.getElementById("rMarketStat").textContent    = meLvl.label;
  document.getElementById("rMarketStat").style.color    = meLvl.color;
  document.getElementById("rMarketStatSub").textContent = (sc.market_entry || {}).kpi_tag || reasonFirstBullet((sc.market_entry || {}).reason);

  // capital_efficiency stat
  const ceLvl = scoreToLevel("capital_efficiency", Number((sc.capital_efficiency || {}).score) || 0);
  document.getElementById("rCapStat").textContent    = ceLvl.label;
  document.getElementById("rCapStat").style.color    = ceLvl.color;
  document.getElementById("rCapStatSub").textContent = (sc.capital_efficiency || {}).kpi_tag || reasonFirstBullet((sc.capital_efficiency || {}).reason);

  // customer_acquisition stat
  const caLvl = scoreToLevel("customer_acquisition", Number((sc.customer_acquisition || {}).score) || 0);
  document.getElementById("rAcqStat").textContent    = caLvl.label;
  document.getElementById("rAcqStat").style.color    = caLvl.color;
  document.getElementById("rAcqStatSub").textContent = (sc.customer_acquisition || {}).kpi_tag || reasonFirstBullet((sc.customer_acquisition || {}).reason);

  // ── ③ Investment Thesis (numbered) ──────────────────────
  document.getElementById("rThesis").innerHTML =
    data.thesis.map((t, i) => renderThesisItem(t, i)).join("");

  // ── ④ Score Card ────────────────────────────────────────
  const scLabels = {
    market_entry:         "시장 진입 난이도",
    differentiation:      "차별화 실현 가능성",
    capital_efficiency:   "초기 자본 부담",
    customer_acquisition: "고객 획득 난이도"
  };
  document.getElementById("rScorecard").innerHTML =
    Object.entries(scLabels).map(([key, label]) =>
      renderScoreItem(key, label, sc[key] || {})
    ).join("");

  // Score footer: fail rate calc
  const failCalcRaw = data.failureRateCalc || "";
  document.getElementById("rScoreFooter").innerHTML = failCalcRaw
    ? `<span class="score-footer-calc">${failCalcRaw} → 조정 기준 ${fr}%, 검산 일치 / 유사 카테고리 기반 추정</span>`
    : `<span class="score-footer-calc">${fr}% 최종 실패 확률</span>`;

  setTimeout(() => {
    document.querySelectorAll(".sc-fill, .risk-bar-fill").forEach(el => {
      el.style.width = el.dataset.w + "%";
    });
  }, 80);

  // ── ⑤ Market Reality (2-col grid) ───────────────────────
  document.getElementById("rMarketReality").innerHTML =
    data.marketReality.map(m => renderMarketCell(m)).join("");

  // ── ⑥ Execution Gap (Gap1/2/3 badges) ───────────────────
  document.getElementById("rExecGap").innerHTML =
    data.execGap.map((g, i) => renderGapItem(g, i)).join("");

  // ── ⑦ Risk Register ─────────────────────────────────────
  document.getElementById("rRisks").innerHTML =
    data.risks.length
      ? data.risks.map((r, i) => renderRiskItem(r, i)).join("")
      : '<p class="empty-state">리스크 데이터 없음</p>';

  // ── ⑧ Strategy (판단 근거만) ───────────────────────────
  const stratEl = document.getElementById("rStrategy");
  if (data.isGo && data.goStrategy) {
    const g = data.goStrategy;
    stratEl.className = "report-block strat-go";
    stratEl.innerHTML = `
      <div class="block-label">${data.verdictLabel} — 판단 근거</div>
      ${g.core_logic ? `<div class="strat-logic">${g.core_logic}</div>` : ""}
      ${g.insight    ? `<div class="strat-key-insight">${g.insight}</div>` : ""}`;
  } else if (!data.isGo && data.nogoStrategy) {
    const n = data.nogoStrategy;
    stratEl.className = "report-block strat-nogo";
    stratEl.innerHTML = `
      <div class="block-label">NO GO — 판단 근거</div>
      ${n.core_problem ? `<div class="strat-logic">${n.core_problem}</div>` : ""}`;
  } else {
    stratEl.innerHTML = "";
    stratEl.className = "";
  }

  // ── ⑨ Action Plan — 최대 4개, 시간순 정렬 ─────────────
  const stratActions = data.isGo
    ? (data.goStrategy?.actions || [])
    : (data.nogoStrategy?.actions || []);
  const allActions = [...stratActions, ...data.firstStep];

  // 주(week) 숫자 추출해서 시간순 정렬, 중복 유사 항목 제거
  function extractWeeks(s) {
    const m = String(s).match(/(\d+)\s*주/);
    return m ? parseInt(m[1]) : 999;
  }
  const sorted = allActions
    .filter((a, i, arr) => {
      // 앞에 이미 비슷한 키워드(8글자 이상 겹침)가 있으면 제거
      const aCore = String(a).replace(/[→\s\d주내]/g, "").slice(0, 10);
      return !arr.slice(0, i).some(b =>
        String(b).replace(/[→\s\d주내]/g, "").slice(0, 10) === aCore
      );
    })
    .sort((a, b) => extractWeeks(a) - extractWeeks(b))
    .slice(0, 4);

  document.getElementById("rFirstStep").innerHTML =
    renderActionChecks(sorted, "action");

  // Bind checkbox interactions
  document.querySelectorAll(".step-check").forEach(cb => {
    cb.addEventListener("change", () => {
      cb.closest(".step-label").classList.toggle("step-done", cb.checked);
    });
  });

  // Report Text (Full narrative)
  const reportTextBlock = document.getElementById("rReportTextBlock");
  const reportTextEl    = document.getElementById("rReportText");
  const reportTextToggle = document.getElementById("reportTextToggle");

  if (data.reportText) {
    reportTextBlock.style.display = "";
    reportTextEl.textContent = data.reportText;
    reportTextEl.style.display = "none";
    reportTextToggle.textContent = "펼치기";
    reportTextToggle.onclick = () => {
      const isOpen = reportTextEl.style.display !== "none";
      reportTextEl.style.display = isOpen ? "none" : "block";
      reportTextToggle.textContent = isOpen ? "펼치기" : "접기";
    };
  } else {
    reportTextBlock.style.display = "none";
    reportTextToggle.onclick = null;
  }
}

// ═══════════════════════════════════════════════════════════
// LOADER
// ═══════════════════════════════════════════════════════════

const LOADER_STEPS = [
  "사업 구조 분석 중…",
  "시장 현실 체크 중…",
  "리스크 평가 중…",
  "리포트 생성 중…"
];

function startLoaderCycle() {
  const el = document.getElementById("loaderStep");
  let i = 0;
  el.textContent = LOADER_STEPS[0];
  return setInterval(() => {
    i = (i + 1) % LOADER_STEPS.length;
    el.textContent = LOADER_STEPS[i];
  }, 1100);
}

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════

const nameInput = document.getElementById("bizName");
const descInput = document.getElementById("bizDesc");
const btn       = document.getElementById("analyzeBtn");
const loaderEl  = document.getElementById("loader");
const reportEl  = document.getElementById("report");

function syncBtn() {
  btn.disabled = !(nameInput.value.trim() && descInput.value.trim());
}
nameInput.addEventListener("input", syncBtn);
descInput.addEventListener("input", syncBtn);

// Auto-resize textarea
descInput.addEventListener("input", () => {
  descInput.style.height = "auto";
  descInput.style.height = descInput.scrollHeight + "px";
});

// Sample button
document.getElementById("sampleBtn").addEventListener("click", () => {
  nameInput.value = SAMPLE_INPUT.name;
  descInput.value = SAMPLE_INPUT.desc;
  syncBtn();
  descInput.focus();
  showToast("예시 내용이 입력됐어요. 분석을 시작해보세요!");
});

// Analyze
btn.addEventListener("click", async () => {
  if (!canUseToday()) {
    alert(`오늘 무료 분석 ${DAILY_LIMIT}회를 모두 사용했습니다.`);
    return;
  }

  const name = nameInput.value.trim();
  const desc = descInput.value.trim();

  reportEl.classList.remove("active");
  loaderEl.classList.add("active");
  btn.disabled = true;

  const timer = startLoaderCycle();

  try {
    const data = await analyze(name, desc);
    clearInterval(timer);
    loaderEl.classList.remove("active");
    renderReport(data);
    reportEl.classList.add("active");
    reportEl.scrollIntoView({ behavior: "smooth", block: "start" });
    // ── [DEBUG 4] recent 저장 직전 값 확인 ──────────────────
    console.log("\n========== [DEBUG 4] SAVE TO RECENT ==========");
    console.log("저장 verdictRaw :", data.verdictRaw);
    console.log("저장 failureRate:", data.failureRate);
    console.log("현재 recent 목록:", JSON.stringify(getRecent().map(r => ({ name: r.name, verdict: r.verdict, failRate: r.failRate }))));
    console.log("===============================================\n");
    // ────────────────────────────────────────────────────────
    increaseTodayUsage();
    renderUsageStatus();
    saveToRecent(name, desc, data.verdictRaw, data.failureRate);
    renderRecentSection();
  } catch (err) {
    clearInterval(timer);
    loaderEl.classList.remove("active");
    console.error("분석 오류:", err);
    alert("분석 중 오류가 발생했습니다: " + err.message);
  } finally {
    btn.disabled = !(nameInput.value.trim() && descInput.value.trim());
  }
});

// Copy button
document.getElementById("copyBtn").addEventListener("click", () => {
  if (!currentData) return;
  const text = buildCopyText(currentData);
  navigator.clipboard.writeText(text)
    .then(() => showToast("클립보드에 복사됐습니다!"))
    .catch(() => showToast("복사에 실패했습니다."));
});

// Re-analyze
document.getElementById("reanalyzeBtn").addEventListener("click", () => {
  if (!currentData) return;
  reportEl.classList.remove("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => btn.click(), 400);
});

// New idea
document.getElementById("newBtn").addEventListener("click", () => {
  nameInput.value = "";
  descInput.value = "";
  syncBtn();
  reportEl.classList.remove("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => nameInput.focus(), 400);
});

// Premium notify (placeholder)
document.querySelector(".premium-notify-btn")?.addEventListener("click", () => {
  showToast("알림 신청이 접수됐습니다. 출시 시 안내 드릴게요!");
});

// Init
renderRecentSection();
renderUsageStatus();
