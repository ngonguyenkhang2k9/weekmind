"use strict";

function normalizeAnalysis(analysis) {
  return {
    summary: analysis?.summary || "Chưa có tóm tắt.",
    feasibility: analysis?.feasibility || "Trung bình",
    motivation: Array.isArray(analysis?.motivation) ? analysis.motivation : [],
    encouragement: Array.isArray(analysis?.encouragement) ? analysis.encouragement : [],
    supportInfo: Array.isArray(analysis?.supportInfo) ? analysis.supportInfo : [],
    strengths: Array.isArray(analysis?.strengths) ? analysis.strengths : [],
    improvements: Array.isArray(analysis?.improvements) ? analysis.improvements : [],
    habits: Array.isArray(analysis?.habits) ? analysis.habits : [],
    nextActions: Array.isArray(analysis?.nextActions) ? analysis.nextActions : [],
    risks: Array.isArray(analysis?.risks) ? analysis.risks : [],
    roadmap: Array.isArray(analysis?.roadmap)
      ? analysis.roadmap.map((step) => ({
          week: step.week || "Tuần",
          goal: step.goal || "Chưa có mục tiêu tuần.",
          focus: Array.isArray(step.focus) ? step.focus : [],
        }))
      : [],
  };
}

function normalizeCoach(coach) {
  return {
    summary: coach?.summary || "Chưa có phản hồi AI cho giai đoạn 4.",
    motivationBoost: Array.isArray(coach?.motivationBoost) ? coach.motivationBoost : [],
    insights: Array.isArray(coach?.insights) ? coach.insights : [],
    adjustments: Array.isArray(coach?.adjustments) ? coach.adjustments : [],
    microSteps: Array.isArray(coach?.microSteps) ? coach.microSteps : [],
    recommendedResources: Array.isArray(coach?.recommendedResources) ? coach.recommendedResources : [],
  };
}

function detectMotivationState(profile, answers) {
  const values = Object.values(answers || {});
  const combined = `${profile?.goal || ""} ${profile?.strengthsWeaknesses || ""} ${values.join(" ")}`.toLowerCase();
  const lowSignals = [
    "mất động lực",
    "không thấy tiến bộ",
    "nản",
    "ngại bắt đầu",
    "tụt hứng",
    "chỉ làm khi có cảm hứng",
    "trì hoãn",
  ];
  const isLow = lowSignals.some((signal) => combined.includes(signal));

  return {
    isLow,
    label: isLow ? "động lực chưa ổn định" : "động lực tương đối ổn",
  };
}

function analyzeJournalMomentum(journal) {
  const recent = Array.isArray(journal) ? journal.slice(0, 5) : [];
  const completed = recent.filter((entry) => entry.status === "Hoàn thành").length;
  const lowEfficiency = recent.filter((entry) => entry.efficiency === "Thấp").length;
  const highEfficiency = recent.filter((entry) => entry.efficiency === "Cao").length;

  if (!recent.length) {
    return {
      trend: "chưa có dữ liệu",
      note: "Chưa có dữ liệu nhật ký để đọc nhịp thực tế.",
      adjustment: "Bắt đầu bằng một bản ghi ngắn sau mỗi phiên học hoặc làm.",
    };
  }

  if (completed >= 3 && highEfficiency >= 2) {
    return {
      trend: "đà tiến triển tốt",
      note: "Nhật ký gần đây cho thấy bạn vẫn giữ được nhịp tương đối tốt.",
      adjustment: "Có thể tăng nhẹ độ khó nhưng vẫn giữ một task dễ hoàn thành mỗi ngày.",
    };
  }

  if (lowEfficiency >= 2 || completed <= 1) {
    return {
      trend: "đà đang hụt",
      note: "Nhật ký gần đây cho thấy nhịp thực thi đang chậm hoặc chưa ổn định.",
      adjustment: "Giảm độ nặng ở đầu buổi và thêm các bước ngắn để lấy lại nhịp.",
    };
  }

  return {
    trend: "đà trung bình",
    note: "Bạn đang có tiến triển nhưng nhịp chưa đều.",
    adjustment: "Giữ khối lượng vừa phải và chốt một kết quả nhỏ mỗi ngày.",
  };
}

function getFeasibilityTone(feasibility) {
  const value = String(feasibility || "").toLowerCase();
  if (value.includes("rất thấp") || value.includes("rat thap")) {
    return {
      badge: "Cần thu nhỏ mục tiêu",
      line: "Mục tiêu này chưa cần ép nhanh. Thu nhỏ đúng sẽ giúp bạn đi được đường dài hơn.",
    };
  }
  if (value.includes("thấp") || value.includes("thap")) {
    return {
      badge: "Cần đi chắc",
      line: "Bạn vẫn đi tiếp được, nhưng nên lấy lại nhịp bằng các bước nhỏ có thể hoàn thành.",
    };
  }
  if (value.includes("cao")) {
    return {
      badge: "Đà đang tốt",
      line: "Bạn đang có nền khá ổn. Điều quan trọng là giữ được chuỗi tiến bộ đều.",
    };
  }
  return {
    badge: "Có thể tiến lên",
    line: "Bạn chưa cần hoàn hảo. Bạn chỉ cần tiến thêm một đoạn đủ nhỏ mỗi ngày.",
  };
}

function buildCoachFallback(profile, answers, analysis, journal, plan) {
  const motivation = detectMotivationState(profile || {}, answers || {});
  const momentum = analyzeJournalMomentum(journal || []);
  const latestEntry = Array.isArray(journal) && journal.length ? journal[0] : null;
  const latestTaskHint = Array.isArray(plan) && plan.length && Array.isArray(plan[0].tasks) && plan[0].tasks.length
    ? plan[0].tasks[0].task
    : "một việc nhỏ liên quan trực tiếp đến mục tiêu";

  return normalizeCoach({
    summary: latestEntry
      ? `Giai đoạn 4 cho thấy bạn đang ở trạng thái ${momentum.trend}. ${momentum.note}`
      : "Chưa có nhật ký để AI đọc nhịp thực tế. Hãy bắt đầu bằng một bản ghi ngắn sau phiên đầu tiên.",
    motivationBoost: motivation.isLow
      ? [
          "Hôm nay không cần làm nhiều, chỉ cần khởi động được.",
          "Một phiên 10-15 phút vẫn là tiến bộ thật.",
        ]
      : [
          "Bạn đang có đà, hãy biến đà này thành chuỗi ngày ổn định.",
          "Giữ một kết quả nhỏ mỗi ngày sẽ giúp mục tiêu lớn bám sát thực tế hơn.",
        ],
    insights: [
      latestEntry
        ? `Bản ghi mới nhất cho thấy hôm nay bạn ở mức hiệu quả "${latestEntry.efficiency}".`
        : "Chưa có dữ liệu hiệu quả hằng ngày nên AI chưa thấy rõ nhịp năng lượng của bạn.",
      momentum.note,
    ],
    adjustments: [
      momentum.adjustment,
      "Giảm số quyết định đầu buổi bằng cách chốt sẵn việc phải làm từ trước.",
      "Giữ 1 task tạo cảm giác hoàn thành sớm trong mỗi ngày.",
    ],
    microSteps: [
      `Làm ngay: ${latestTaskHint}.`,
      "Dành 10 phút nhắc lại lý do học hoặc làm.",
      "Ghi 3 dòng: hôm nay vướng ở đâu, đã tiến gì, mai làm gì.",
    ],
    recommendedResources: [
      "Tạo checklist 3 việc quan trọng nhất cho mỗi ngày.",
      "Chuẩn bị template nhật ký 3 câu: đã làm, chưa làm, bước kế tiếp.",
    ],
  });
}

async function requestCoachWithAI() {
  try {
    const response = await fetch("/api/coach", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildAiPayload()),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok || !result.coach) {
      throw new Error(result.error || "AI coach failed.");
    }
    state.coach = normalizeCoach(result.coach);
  } catch (error) {
    state.coach = buildCoachFallback(state.profile, state.answers, state.analysis, state.journal, state.plan);
    setAuthMessage(`Không gọi được AI cho giai đoạn 4, đang dùng phản hồi dự phòng. Lỗi: ${error.message}`);
  }
}

async function handleJournalSubmit(event) {
  event.preventDefault();
  if (!ensureLoggedIn()) return;

  const entry = {
    day: document.querySelector("#journal-day").value,
    done: document.querySelector("#journal-done").value.trim(),
    status: document.querySelector("#journal-status").value,
    efficiency: document.querySelector("#journal-efficiency").value,
  };

  state.journal = [entry, ...state.journal].slice(0, 14);

  if (state.profile && Object.keys(state.answers).length) {
    state.analysis = generateSmartAnalysis(state.profile, state.answers, state.journal);
    state.plan = buildSmartPlan(state.profile, state.analysis, state.journal);
    state.coach = buildCoachFallback(state.profile, state.answers, state.analysis, state.journal, state.plan);
    setAuthMessage("AI đang đọc dữ liệu giai đoạn 4 để bổ sung gợi ý và điều chỉnh nhịp cho bạn.");
    await requestCoachWithAI();
  }

  saveAppState();
  els.journalForm.reset();
  if (els.journalDay) {
    els.journalDay.value = getCurrentWeekdayLabel();
  }
  renderAll();
}

function renderAnalysis() {
  if (!isLoggedIn()) {
    els.analysisContent.className = "empty-state";
    els.analysisContent.textContent = "Đăng nhập để nhận phân tích AI và lưu lịch sử theo tài khoản.";
    return;
  }

  if (!state.analysis) {
    els.analysisContent.className = "empty-state";
    els.analysisContent.textContent = "Hoàn thành khảo sát để nhận phân tích về thói quen, động lực và mức độ khả thi.";
    return;
  }

  const tone = getFeasibilityTone(state.analysis.feasibility);
  const roadmapMarkup = (state.analysis.roadmap || []).map((step) => `
    <article class="analysis-block roadmap-block">
      <div class="section-kicker">${step.week}</div>
      <h4>${step.goal}</h4>
      <ul>${(step.focus || []).map((item) => `<li>${item}</li>`).join("")}</ul>
    </article>
  `).join("");

  els.analysisContent.className = "analysis-shell";
  els.analysisContent.innerHTML = `
    <div class="analysis-hero">
      <div class="section-kicker">Bản đồ tiến lên</div>
      <h3 class="section-title">${tone.badge}</h3>
      <p class="section-lead">${state.analysis.summary}</p>
      <div class="analysis-note">${tone.line}</div>
    </div>
    <div class="analysis-grid">
      <article class="analysis-block analysis-block-accent">
        <div class="section-kicker">Giữ lửa</div>
        <h4>Động lực hiện tại</h4>
        <ul>${(state.analysis.motivation || []).map((item) => `<li>${item}</li>`).join("") || "<li>Chưa có dữ liệu động lực cụ thể.</li>"}</ul>
      </article>
      <article class="analysis-block">
        <div class="section-kicker">Tạo đà</div>
        <h4>Đòn bẩy động lực</h4>
        <ul>${(state.analysis.encouragement || []).map((item) => `<li>${item}</li>`).join("") || "<li>Chưa có gợi ý động lực.</li>"}</ul>
      </article>
      <article class="analysis-block">
        <div class="section-kicker">Bổ sung</div>
        <h4>Thông tin AI gợi ý thêm</h4>
        <ul>${(state.analysis.supportInfo || []).map((item) => `<li>${item}</li>`).join("") || "<li>Chưa có thông tin bổ sung.</li>"}</ul>
      </article>
      <article class="analysis-block">
        <div class="section-kicker">Điểm tựa</div>
        <h4>Điểm mạnh đang có</h4>
        <ul>${state.analysis.strengths.map((item) => `<li>${item}</li>`).join("")}</ul>
      </article>
      <article class="analysis-block">
        <div class="section-kicker">Cần chỉnh</div>
        <h4>Điểm cần cải thiện</h4>
        <ul>${state.analysis.improvements.map((item) => `<li>${item}</li>`).join("")}</ul>
      </article>
      <article class="analysis-block">
        <div class="section-kicker">Nhịp làm việc</div>
        <h4>Thói quen đang chi phối</h4>
        <ul>${state.analysis.habits.map((item) => `<li>${item}</li>`).join("")}</ul>
      </article>
      <article class="analysis-block">
        <div class="section-kicker">Hành động</div>
        <h4>Việc nên làm ngay</h4>
        <ul>${state.analysis.nextActions.map((item) => `<li>${item}</li>`).join("")}</ul>
      </article>
      <article class="analysis-block">
        <div class="section-kicker">Cảnh báo</div>
        <h4>Rủi ro cần để ý</h4>
        <ul>${state.analysis.risks.map((item) => `<li>${item}</li>`).join("")}</ul>
      </article>
    </div>
    <div class="analysis-roadmap">
      ${roadmapMarkup}
    </div>
  `;
}

function renderJournal() {
  if (!isLoggedIn()) {
    els.journalList.className = "journal-list empty-state";
    els.journalList.textContent = "Đăng nhập để lưu nhật ký hằng ngày và kích hoạt vòng phản hồi AI.";
    return;
  }

  if (!state.journal.length) {
    els.journalList.className = "journal-list empty-state";
    els.journalList.textContent = "Chưa có nhật ký nào được lưu.";
    return;
  }

  const coach = state.coach ? normalizeCoach(state.coach) : null;
  const coachMarkup = coach ? `
    <article class="journal-item journal-item-coach">
      <div class="journal-item-header">
        <strong>AI giai đoạn 4</strong>
        <span>Bổ sung thông tin và tạo đà</span>
      </div>
      <p>${coach.summary}</p>
      <ul>${coach.motivationBoost.map((item) => `<li>${item}</li>`).join("")}</ul>
      <ul>${coach.insights.map((item) => `<li>${item}</li>`).join("")}</ul>
      <ul>${coach.adjustments.map((item) => `<li>${item}</li>`).join("")}</ul>
      <ul>${coach.microSteps.map((item) => `<li>${item}</li>`).join("")}</ul>
      <ul>${coach.recommendedResources.map((item) => `<li>${item}</li>`).join("")}</ul>
    </article>
  ` : "";

  els.journalList.className = "journal-list";
  els.journalList.innerHTML = `
    ${coachMarkup}
    ${state.journal.map((entry) => `
      <article class="journal-item">
        <div class="journal-item-header">
          <strong>${entry.day}</strong>
          <span>${entry.efficiency} • ${entry.status}</span>
        </div>
        <p>${entry.done}</p>
      </article>
    `).join("")}
  `;
}

function applyAICopyUpdates() {
  const timelineCards = document.querySelectorAll(".timeline-card");
  const surveyHeader = document.querySelector("#survey .card-top h3");
  const analysisHeader = document.querySelector("#analysis .card-top h3");
  const plannerHeader = document.querySelector("#planner .card-top h3");
  const journalHeader = document.querySelector("#journal .card-top h3");

  if (timelineCards.length >= 4) {
    const timelineData = [
      {
        title: "AI khảo sát nhu cầu",
        text: "AI tự tạo câu hỏi, khai thác mục tiêu, rào cản, động lực và dữ liệu ban đầu.",
      },
      {
        title: "AI phân tích và bổ sung",
        text: "AI phân tích thực tế, đánh giá khả thi, bổ sung thông tin giúp bạn tiếp cận mục tiêu dễ hơn.",
      },
      {
        title: "AI lập kế hoạch hành động",
        text: "AI tạo lịch tuần cá nhân hóa, chia nhỏ task và cài cơ chế giữ nhịp động lực.",
      },
      {
        title: "AI theo dõi và tiếp lửa",
        text: "AI đọc nhật ký, phản hồi tự động, điều chỉnh cách làm và thêm gợi ý để bạn không mất đà.",
      },
    ];

    timelineCards.forEach((card, index) => {
      const title = card.querySelector("h3");
      const text = card.querySelector("p");
      if (title && timelineData[index]) title.textContent = timelineData[index].title;
      if (text && timelineData[index]) text.textContent = timelineData[index].text;
    });
  }

  if (surveyHeader) surveyHeader.textContent = "Khảo sát AI và thu thập nhu cầu";
  if (analysisHeader) analysisHeader.textContent = "AI phân tích, bổ sung thông tin";
  if (plannerHeader) plannerHeader.textContent = "AI lập kế hoạch tiến tới mục tiêu";
  if (journalHeader) journalHeader.textContent = "AI phản hồi hằng ngày và tiếp lửa";
}

applyAICopyUpdates();
