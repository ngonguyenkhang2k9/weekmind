const STORAGE_KEY = "weekmind-app";
const STORAGE_API = "/api/storage";
const ENABLE_SERVER_STORAGE = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const appState = loadAppState();
let state = getCurrentUserState();
let saveSyncTimer = null;
let isEntryTransitionRunning = false;
let surveyRetryTimer = null;

const els = {
  body: document.body,
  authGate: document.querySelector("#auth-gate"),
  pageShell: document.querySelector(".page-shell"),
  topbar: document.querySelector(".topbar"),
  topbarHoverZone: document.querySelector(".topbar-hover-zone"),
  mobileMenuButton: document.querySelector("#mobile-menu-button"),
  mainNav: document.querySelector("#main-nav"),
  topbarCta: document.querySelector("#topbar-cta"),
  workspace: document.querySelector("#workspace"),
  workspaceTitle: document.querySelector("#workspace-title"),
  workspaceMain: document.querySelector(".workspace-main"),
  authPanelTitle: document.querySelector("#auth-panel-title"),
  authPanelCopy: document.querySelector("#auth-panel-copy"),
  authForm: document.querySelector("#auth-form"),
  gateAuthForm: document.querySelector("#gate-auth-form"),
  gateAuthEmail: document.querySelector("#gate-auth-email"),
  gateAuthPassword: document.querySelector("#gate-auth-password"),
  gateAuthMessage: document.querySelector("#gate-auth-message"),
  gateLoginButton: document.querySelector("#gate-login-button"),
  authEmail: document.querySelector("#auth-email"),
  authPassword: document.querySelector("#auth-password"),
  authMessage: document.querySelector("#auth-message"),
  loginButton: document.querySelector("#login-button"),
  logoutButton: document.querySelector("#logout-button"),
  forgotPasswordButton: document.querySelector("#forgot-password-button"),
  forgotPasswordModal: document.querySelector("#forgot-password-modal"),
  closeModalButton: document.querySelector("#close-modal"),
  forgotPasswordForm: document.querySelector("#forgot-password-form"),
  forgotEmail: document.querySelector("#forgot-email"),
  forgotName: document.querySelector("#forgot-name"),
  forgotAge: document.querySelector("#forgot-age"),
  forgotMessage: document.querySelector("#forgot-message"),
  profileForm: document.querySelector("#profile-form"),
  surveyForm: document.querySelector("#survey-form"),
  analysisContent: document.querySelector("#analysis-content"),
  planContent: document.querySelector("#plan-content"),
  journalForm: document.querySelector("#journal-form"),
  journalList: document.querySelector("#journal-list"),
  profileContent: document.querySelector("#profile-content"),
  clearAccountDataButton: document.querySelector("#clear-account-data-button"),
  generatePlanButton: document.querySelector("#generate-plan"),
  welcomeName: document.querySelector("#welcome-name"),
  welcomeGoal: document.querySelector("#welcome-goal"),
  surveyStatus: document.querySelector("#survey-status"),
  analysisStatus: document.querySelector("#analysis-status"),
  planStatus: document.querySelector("#plan-status"),
  completionRate: document.querySelector("#completion-rate"),
  progressFill: document.querySelector("#progress-fill"),
  journalDay: document.querySelector("#journal-day"),
  name: document.querySelector("#name"),
  age: document.querySelector("#age"),
  goal: document.querySelector("#goal"),
  freeTime: document.querySelector("#freeTime"),
  focusTime: document.querySelector("#focusTime"),
  strengthsWeaknesses: document.querySelector("#strengthsWeaknesses"),
};

function bindEvent(element, eventName, handler) {
  if (element) {
    element.addEventListener(eventName, handler);
  }
}

document.querySelectorAll("[data-scroll]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.querySelector(button.dataset.scroll);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

bindEvent(els.authForm, "submit", handleSignup);
bindEvent(els.gateAuthForm, "submit", handleGateSignup);
bindEvent(els.mobileMenuButton, "click", toggleMobileMenu);
bindEvent(els.loginButton, "click", handleLogin);
bindEvent(els.gateLoginButton, "click", handleGateLogin);
bindEvent(els.logoutButton, "click", handleLogout);
bindEvent(els.forgotPasswordButton, "click", openForgotPasswordModal);
bindEvent(els.closeModalButton, "click", closeForgotPasswordModal);
bindEvent(els.forgotPasswordModal, "click", (event) => {
  if (event.target === els.forgotPasswordModal) {
    closeForgotPasswordModal();
  }
});
bindEvent(els.forgotPasswordForm, "submit", handleForgotPassword);
bindEvent(els.profileForm, "submit", handleProfileSubmit);
bindEvent(els.surveyForm, "submit", handleSurveySubmit);
bindEvent(els.clearAccountDataButton, "click", handleClearAccountData);
bindEvent(els.generatePlanButton, "click", handleGeneratePlan);
bindEvent(els.journalForm, "submit", handleJournalSubmit);
bindEvent(els.topbarHoverZone, "mouseenter", showTopbar);
bindEvent(els.topbar, "mouseenter", showTopbar);
bindEvent(els.topbar, "mouseleave", hideTopbarDesktop);

if (els.journalDay) {
  els.journalDay.value = getCurrentWeekdayLabel();
}

hydrateInputs();
renderQuestions();
renderAll();
initializeTopbar();
syncStateFromServer();

function initializeTopbar() {
  if (!els.topbar) return;
  syncTopbarMode();
  window.addEventListener("resize", syncTopbarMode);
  window.addEventListener("scroll", syncTopbarVisibilityByScroll, { passive: true });
}

function syncTopbarMode() {
  if (!els.topbar || !els.mainNav) return;
  if (window.innerWidth > 860) {
    els.topbar.classList.remove("mobile-open");
    els.mainNav.classList.remove("mobile-open");
    syncTopbarVisibilityByScroll();
  } else {
    els.topbar.classList.remove("topbar-hidden");
  }
}

function syncTopbarVisibilityByScroll() {
  if (window.innerWidth <= 860 || !els.topbar) return;
  if (window.scrollY <= 40) {
    els.topbar.classList.remove("topbar-hidden");
    return;
  }
  els.topbar.classList.add("topbar-hidden");
}

function showTopbar() {
  if (window.innerWidth <= 860 || !els.topbar) return;
  els.topbar.classList.remove("topbar-hidden");
}

function hideTopbarDesktop() {
  if (window.innerWidth <= 860 || !els.topbar) return;
  if (window.scrollY <= 40) {
    els.topbar.classList.remove("topbar-hidden");
    return;
  }
  els.topbar.classList.add("topbar-hidden");
}

function toggleMobileMenu() {
  if (window.innerWidth > 860 || !els.topbar || !els.mainNav) return;
  els.topbar.classList.toggle("mobile-open");
  els.mainNav.classList.toggle("mobile-open");
}

function createEmptyUserState() {
  return {
    profile: null,
    questions: [],
    surveySource: null,
    surveyError: "",
    isGeneratingSurvey: false,
    surveyRetryAt: null,
    answers: {},
    analysis: null,
    plan: [],
    journal: [],
    coach: null,
  };
}

function loadAppState() {
  const fallback = {
    currentUser: null,
    users: {},
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function getCurrentUserState() {
  if (!appState.currentUser || !appState.users[appState.currentUser]) {
    return createEmptyUserState();
  }

  return {
    ...createEmptyUserState(),
    ...appState.users[appState.currentUser].data,
  };
}

function saveAppState() {
  if (appState.currentUser && appState.users[appState.currentUser]) {
    appState.users[appState.currentUser].data = state;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  scheduleServerSync();
}

function isLoggedIn() {
  return Boolean(appState.currentUser);
}

function scheduleServerSync() {
  if (!ENABLE_SERVER_STORAGE) {
    return;
  }

  window.clearTimeout(saveSyncTimer);
  saveSyncTimer = window.setTimeout(() => {
    persistStateToServer();
  }, 180);
}

async function persistStateToServer() {
  if (!ENABLE_SERVER_STORAGE) {
    return;
  }

  try {
    await fetch(STORAGE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(appState),
    });
  } catch {
    // Keep localStorage as fallback when server storage is unavailable.
  }
}

async function syncStateFromServer() {
  if (!ENABLE_SERVER_STORAGE) {
    return;
  }

  try {
    const response = await fetch(STORAGE_API, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok || !result.storage) {
      return;
    }

    const serverState = normalizeAppState(result.storage);
    appState.currentUser = serverState.currentUser;
    appState.users = serverState.users;
    state = getCurrentUserState();
    saveLocalOnly();
    hydrateInputs();
    renderQuestions();
    renderAll();
  } catch {
    // Continue with localStorage when server state cannot be loaded.
  }
}

function saveLocalOnly() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function normalizeAppState(raw) {
  return {
    currentUser: raw?.currentUser || null,
    users: raw?.users && typeof raw.users === "object" ? raw.users : {},
  };
}

function getAuthValues(source = "sidebar") {
  const fromGate = source === "gate";
  const emailField = fromGate ? els.gateAuthEmail : els.authEmail;
  const passwordField = fromGate ? els.gateAuthPassword : els.authPassword;

  return {
    email: emailField?.value.trim().toLowerCase() || "",
    password: passwordField?.value.trim() || "",
  };
}

function setGateAuthMessage(message) {
  if (els.gateAuthMessage) {
    els.gateAuthMessage.textContent = message;
  }
}

function handleSignup(event) {
  event.preventDefault();
  signupUser(getAuthValues("sidebar"));
}

function handleGateSignup(event) {
  event.preventDefault();
  signupUser(getAuthValues("gate"));
}

function signupUser({ email, password }) {

  if (!email || !password) {
    setAuthMessage("Nhập email và mật khẩu để tạo tài khoản.");
    setGateAuthMessage("Nhập email và mật khẩu để tạo tài khoản.");
    return;
  }

  if (appState.users[email]) {
    setAuthMessage("Tài khoản đã tồn tại. Hãy đăng nhập.");
    setGateAuthMessage("Tài khoản đã tồn tại. Hãy đăng nhập.");
    return;
  }

  appState.users[email] = {
    password,
    data: createEmptyUserState(),
  };
  appState.currentUser = email;
  state = getCurrentUserState();
  saveAppState();
  resetWorkspaceInputs();
  renderQuestions();
  renderAll();
  triggerPostLoginTransition();
  setAuthMessage(`Đã tạo tài khoản ${email} và đăng nhập thành công.`);
  setGateAuthMessage(`Đã tạo tài khoản ${email} và đăng nhập thành công.`);
  syncAuthFields(email, password);
}

function handleLogin() {
  loginUser(getAuthValues("sidebar"));
}

function handleGateLogin() {
  loginUser(getAuthValues("gate"));
}

function loginUser({ email, password }) {
  const user = appState.users[email];

  if (!user || user.password !== password) {
    setAuthMessage("Email hoặc mật khẩu không đúng.");
    setGateAuthMessage("Email hoặc mật khẩu không đúng.");
    return;
  }

  appState.currentUser = email;
  state = getCurrentUserState();
  saveAppState();
  hydrateInputs();
  renderQuestions();
  renderAll();
  triggerPostLoginTransition();
  setAuthMessage(`Đang làm việc với tài khoản ${email}.`);
  setGateAuthMessage(`Đăng nhập thành công với tài khoản ${email}.`);
  syncAuthFields(email, password);
}

function handleLogout() {
  appState.currentUser = null;
  state = createEmptyUserState();
  saveAppState();
  syncAuthFields("", "");
  resetWorkspaceInputs();
  renderQuestions();
  renderAll();
  setAuthMessage("Đã đăng xuất khỏi tài khoản hiện tại.");
  setGateAuthMessage("Đăng nhập để mở website và kích hoạt không gian tài khoản cá nhân.");
}

function syncAuthFields(email, password) {
  if (els.authEmail) els.authEmail.value = email;
  if (els.authPassword) els.authPassword.value = password;
  if (els.gateAuthEmail) els.gateAuthEmail.value = email;
  if (els.gateAuthPassword) els.gateAuthPassword.value = password;
}

function openForgotPasswordModal() {
  els.forgotPasswordModal.style.display = "flex";
  els.forgotMessage.textContent = "Nhập email tài khoản hoặc tên hồ sơ và tuổi để tạo yêu cầu khôi phục.";
}

function closeForgotPasswordModal() {
  els.forgotPasswordModal.style.display = "none";
  els.forgotPasswordForm.reset();
}

function handleForgotPassword(event) {
  event.preventDefault();

  const email = els.forgotEmail.value.trim().toLowerCase();
  const name = els.forgotName.value.trim().toLowerCase();
  const age = Number(els.forgotAge.value);

  if (!email && (!name || !age)) {
    els.forgotMessage.textContent = "Cần nhập email tài khoản hoặc nhập đủ tên và tuổi.";
    return;
  }

  const matchedEntry = Object.entries(appState.users).find(([userEmail, userData]) => {
    const profile = userData.data?.profile;
    if (email) return userEmail === email;
    if (!profile) return false;
    return profile.name?.trim().toLowerCase() === name && Number(profile.age) === age;
  });

  if (!matchedEntry) {
    els.forgotMessage.textContent = "Không tìm thấy tài khoản phù hợp với thông tin cung cấp.";
    return;
  }

  const [matchedEmail, userData] = matchedEntry;
  const profile = userData.data?.profile || {};
  const subject = `Week Mind - Yêu cầu khôi phục tài khoản ${matchedEmail}`;
  const body = [
    "YÊU CẦU KHÔI PHỤC TÀI KHOẢN WEEK MIND",
    "",
    `Email tài khoản: ${matchedEmail}`,
    `Tên hồ sơ: ${profile.name || "Chưa có"}`,
    `Tuổi: ${profile.age || "Chưa có"}`,
    `Mục tiêu: ${profile.goal || "Chưa có"}`,
    "",
    "Người dùng đã xác minh bằng:",
    email ? `- Email: ${email}` : `- Tên: ${profile.name || name}`,
    !email ? `- Tuổi: ${profile.age || age}` : "- Xác minh phụ: không cung cấp",
    "",
    "Vui lòng kiểm tra và hỗ trợ khôi phục mật khẩu.",
  ].join("\n");

  window.location.href = `mailto:${DESTINATION_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  els.forgotMessage.textContent = "Đã mở ứng dụng email để gửi yêu cầu khôi phục.";
}

function setAuthMessage(message) {
  if (els.authMessage) {
    els.authMessage.textContent = message;
  }
}

function resetWorkspaceInputs() {
  els.profileForm?.reset();
  els.journalForm?.reset();
  if (els.journalDay) {
    els.journalDay.value = getCurrentWeekdayLabel();
  }
  hydrateInputs();
}

function hydrateInputs() {
  const profile = state.profile || {};
  if (els.name) els.name.value = profile.name || "";
  if (els.age) els.age.value = profile.age || "";
  if (els.goal) els.goal.value = profile.goal || "";
  if (els.freeTime) els.freeTime.value = profile.freeTime || "";
  if (els.focusTime) els.focusTime.value = profile.focusTime || "";
  if (els.strengthsWeaknesses) els.strengthsWeaknesses.value = profile.strengthsWeaknesses || "";
}

function ensureLoggedIn() {
  if (isLoggedIn()) return true;
  setAuthMessage("Tạo tài khoản hoặc đăng nhập trước khi lưu dữ liệu cá nhân.");
  return false;
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  if (!ensureLoggedIn()) return;

  state.profile = {
    name: els.name.value.trim(),
    age: Number(els.age.value),
    goal: els.goal.value.trim(),
    freeTime: els.freeTime.value.trim(),
    focusTime: els.focusTime.value.trim(),
    strengthsWeaknesses: els.strengthsWeaknesses.value.trim(),
  };

  state.questions = [];
  state.surveySource = null;
  state.surveyError = "";
  state.isGeneratingSurvey = true;
  state.answers = {};
  state.analysis = null;
  state.plan = [];
  saveAppState();
  renderQuestions();
  renderAll();
  await generateSurveyWithAI(state.profile);
}

function buildQuestions(profile) {
  const goalType = detectGoalType(profile.goal);
  const targetLabel = goalType === "skill" ? "kỹ năng" : goalType === "work" ? "công việc" : "học tập";
  const goalText = profile.goal || `mục tiêu ${targetLabel}`;
  const focusTime = profile.focusTime || "khung giờ bạn thấy tỉnh táo nhất";
  const freeTime = profile.freeTime || "quỹ thời gian hiện có";

  return [
    {
      type: "radio",
      prompt: `Với mục tiêu "${goalText}", mức độ hiện tại của bạn đang ở đâu?`,
      options: [
        "Mới bắt đầu, chưa có nền tảng rõ",
        "Đã có nền tảng cơ bản",
        "Đang ở mức trung bình và muốn tăng tốc",
        "Đã khá tốt và muốn bứt phá mạnh",
      ],
    },
    {
      type: "radio",
      prompt: "Rào cản lớn nhất đang làm chậm tiến độ của bạn là gì?",
      options: [
        "Thiếu thời gian ổn định mỗi ngày",
        "Dễ xao nhãng hoặc mất tập trung",
        "Thiếu kiến thức nền hoặc lộ trình rõ ràng",
        "Áp lực học tập, công việc hoặc việc cá nhân",
      ],
    },
    {
      type: "radio",
      prompt: `Trong ${focusTime}, bạn muốn AI ưu tiên nhóm nhiệm vụ nào nhất?`,
      options: [
        "Task khó cần tập trung sâu",
        "Task thực hành hoặc làm bài",
        "Task ôn tập, tổng hợp, ghi chú",
        "Task linh hoạt theo tình trạng từng ngày",
      ],
    },
    {
      type: "radio",
      prompt: `Dựa trên quỹ thời gian rảnh "${freeTime}", bạn muốn Week Mind phân bổ lịch theo kiểu nào?`,
      options: [
        "Chia đều mỗi ngày để giữ nhịp ổn định",
        "Dồn các phiên sâu vào vài buổi chính",
        "Linh hoạt theo ngày bận và ngày rảnh",
        "Ưu tiên ít việc nhưng làm thật chắc",
      ],
    },
    {
      type: "radio",
      prompt: "Điểm mạnh nổi bật nhất của bạn lúc này là gì?",
      options: [
        "Kỷ luật và giữ lịch khá đều",
        "Tiếp thu nhanh khi đã bắt nhịp",
        "Làm việc bền và chịu được áp lực",
        "Chủ động tự tìm cách giải quyết vấn đề",
      ],
    },
    {
      type: "radio",
      prompt: "Thói quen nào khiến bạn dễ trượt kế hoạch nhất?",
      options: [
        "Trì hoãn khi task quá lớn",
        "Chỉ làm khi có cảm hứng",
        "Ôm quá nhiều việc cùng lúc",
        "Thiếu nghỉ ngơi nên nhanh hụt năng lượng",
      ],
    },
    {
      type: "radio",
      prompt: "Sau 4 tuần, bạn kỳ vọng đầu ra nào rõ nhất?",
      options: [
        "Hoàn thành một mốc nền tảng quan trọng",
        "Tăng rõ hiệu suất và sự đều đặn mỗi tuần",
        "Có sản phẩm, kết quả hoặc điểm số cụ thể",
        "Xây được lịch ổn định và bền vững lâu dài",
      ],
    },
    {
      type: "radio",
      prompt: "Bạn muốn AI đồng hành theo kiểu nào?",
      options: [
        "Nhắc kỷ luật mạnh và bám tiến độ sát",
        "Tối ưu workload nhẹ nhàng, không quá áp lực",
        "Cân bằng giữa hiệu suất và sức bền",
        "Ưu tiên thích nghi linh hoạt theo thực tế",
      ],
    },
  ];
}

async function generateSurveyWithAI(profile) {
  const fallbackQuestions = buildQuestions(profile);

  window.clearTimeout(surveyRetryTimer);
  state.isGeneratingSurvey = true;
  state.surveySource = null;
  state.surveyError = "";
  state.surveyRetryAt = null;

  if (els.surveyForm) {
    els.surveyForm.innerHTML = '<div class="empty-state">AI đang tạo bộ câu hỏi khảo sát theo mục tiêu của bạn...</div>';
  }
  renderAll();

  try {
    const response = await fetch("/api/survey", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ profile }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok || !Array.isArray(result.questions)) {
      throw new Error(result.error || "AI survey generation failed.");
    }

    state.questions = normalizeQuestions(result.questions, fallbackQuestions);
    state.surveySource = "ai";
    state.surveyError = "";
    state.surveyRetryAt = null;
    setAuthMessage("Đã tạo bộ câu hỏi khảo sát theo mục tiêu của bạn.");
  } catch (error) {
    const message = error.message || "Không gọi được Gemini.";
    const retryDelayMs = getRetryDelayFromMessage(message);
    const isQuotaError = isGeminiQuotaError(message);

    state.surveyError = message;
    state.surveyRetryAt = retryDelayMs ? Date.now() + retryDelayMs : null;

    if (isQuotaError) {
      state.questions = [];
      state.surveySource = "quota";
      setAuthMessage(`Gemini chưa tạo được khảo sát vì quota hoặc rate limit. ${retryDelayMs ? "Hệ thống sẽ tự thử lại." : "Cần kiểm tra quota/billing của Gemini."}`);

      if (retryDelayMs) {
        surveyRetryTimer = window.setTimeout(() => {
          generateSurveyWithAI(profile);
        }, retryDelayMs);
      }
    } else {
      state.questions = fallbackQuestions;
      state.surveySource = "fallback";
      setAuthMessage(`Không gọi được Gemini cho khảo sát, đang dùng bộ câu hỏi dự phòng. Lỗi: ${message}`);
    }
  } finally {
    state.isGeneratingSurvey = false;
  }

  saveAppState();
  renderQuestions();
  renderAll();
}

function normalizeQuestions(questions, fallbackQuestions) {
  const normalized = questions
    .filter((question) => question && typeof question.prompt === "string")
    .map((question, index) => ({
      type: "radio",
      prompt: question.prompt.trim(),
      options: Array.isArray(question.options)
        ? question.options
            .map((option) => String(option).trim())
            .filter(Boolean)
            .slice(0, 4)
        : [],
    }))
    .filter((question) => question.prompt && question.options.length >= 4)
    .slice(0, 8)
    .map((question) => ({
      ...question,
      options: question.options.slice(0, 4),
    }));

  return normalized.length >= 6 ? normalized : fallbackQuestions;
}

function renderQuestions() {
  if (!els.surveyForm) return;

  if (!isLoggedIn()) {
    els.surveyForm.innerHTML = '<div class="empty-state">Đăng nhập để tạo khảo sát AI và lưu dữ liệu riêng cho tài khoản của bạn.</div>';
    return;
  }

  if (!state.questions.length) {
    let message = "Điền hồ sơ ở phía trên để AI sinh bộ câu hỏi khảo sát phù hợp.";

    if (state.isGeneratingSurvey) {
      message = "AI đang tạo bộ câu hỏi khảo sát theo mục tiêu của bạn...";
    } else if (state.surveySource === "quota") {
      message = buildQuotaSurveyMessage();
    }

    els.surveyForm.innerHTML = `<div class="empty-state">${message}</div>`;
    return;
  }

  const surveyNotice = state.surveySource === "ai"
    ? '<div class="empty-state">Nguồn câu hỏi: Gemini AI.</div>'
    : state.surveySource === "fallback"
      ? `<div class="empty-state">Nguồn câu hỏi: bộ dự phòng local. Gemini không phản hồi kịp hoặc trả lỗi${state.surveyError ? `: ${state.surveyError}` : ""}.</div>`
      : "";

  const questionsMarkup = state.questions.map((question, index) => `
    <label class="question-card">
      <span>Câu ${index + 1}. ${question.prompt}</span>
      <div class="choice-group">
        ${question.options.map((option) => `
          <label class="choice-item">
            <input
              type="radio"
              name="question-${index}"
              value="${option}"
              ${state.answers[`question-${index}`] === option ? "checked" : ""}
              required
            >
            <span>${option}</span>
          </label>
        `).join("")}
      </div>
    </label>
  `).join("");

  els.surveyForm.innerHTML = `
    ${surveyNotice}
    ${questionsMarkup}
    <button type="submit" class="primary-button wide-button">Gửi khảo sát để AI phân tích</button>
  `;
}

function handleSurveySubmit(event) {
  event.preventDefault();
  if (!ensureLoggedIn()) return;

  const formData = new FormData(els.surveyForm);
  state.answers = Object.fromEntries(formData.entries());
  els.analysisContent.className = "empty-state";
  els.analysisContent.textContent = "AI đang phân tích dữ liệu và đánh giá mức độ khả thi...";
  state.plan = [];
  saveAppState();
  analyzeWithAI();
}

function generateAnalysis(profile, answers, journal) {
  const answerValues = Object.values(answers);
  const answerText = answerValues.join(" ").toLowerCase();
  const freeTime = (profile.freeTime || "").toLowerCase();
  const focusTime = (profile.focusTime || "").toLowerCase();
  const strengths = (profile.strengthsWeaknesses || "").toLowerCase();
  const completionScore = calculateCompletionRate(journal);
  const currentLevel = answerValues[1] || "chưa mô tả rõ";
  const mainBarrier = answerValues[1] || "chưa xác định rõ";
  const focusTaskType = answerValues[2] || "chưa xác định";
  const preferredStyle = answerValues[3] || "chưa xác định";
  const mainStrength = answerValues[4] || "chưa xác định";
  const mainWeakness = answerValues[5] || "chưa xác định";
  const fourWeekGoal = answerValues[6] || "chưa nêu rõ";
  const aiSupportMode = answerValues[7] || "chưa chọn";

  const strengthsList = [
    answerText.includes("kỷ luật") || strengths.includes("kỷ luật") ? "Bạn có nền tảng kỷ luật khá tốt khi mục tiêu đã được làm rõ." : "Bạn có động lực nội tại tương đối rõ với mục tiêu đã chọn.",
    freeTime ? `Bạn đã xác định được quỹ thời gian khả dụng: ${profile.freeTime}.` : "Bạn có ý thức dành thời gian riêng cho phát triển bản thân.",
    focusTime ? `Bạn hiểu tương đối rõ khung giờ hiệu quả nhất: ${profile.focusTime}.` : "Bạn vẫn còn dư địa để tìm ra giờ vàng học và làm việc hiệu quả hơn.",
    `Hiện trạng bản thân đã được mô tả ở mức: ${currentLevel}.`,
    `Điểm mạnh chính có thể tận dụng là: ${mainStrength}.`,
  ];

  const improvements = [
    answerText.includes("trì hoãn") || strengths.includes("trì hoãn") ? "Cần chia nhỏ đầu việc và đặt điểm bắt đầu thật rõ để giảm trì hoãn." : "Nên quy đổi mục tiêu lớn thành chỉ số tuần cụ thể hơn.",
    answerText.includes("mệt") || answerText.includes("quá tải") ? "Cần chèn khoảng nghỉ ngắn và phân bố sức bền để tránh hụt năng lượng kéo dài." : "Nên khóa trước các khung tập trung sâu trong tuần thay vì chờ cảm hứng.",
    `Rào cản chính hiện tại là: ${mainBarrier}. Kế hoạch cần xử lý trực diện điểm nghẽn này.`,
    `Thói quen dễ làm trượt kế hoạch nhất là: ${mainWeakness}.`,
    completionScore < 50 ? "Cần cơ chế kiểm tra cuối ngày để tăng tỷ lệ hoàn thành thật." : "Nên duy trì phản hồi hằng ngày để AI tinh chỉnh chính xác hơn.",
  ];

  const feasibility = (() => {
    if ((freeTime.includes("1") || freeTime.includes("2")) && (answerText.includes("bứt tốc") || answerText.includes("rất cao"))) return "Trung bình";
    if (freeTime.includes("3") || freeTime.includes("4") || freeTime.includes("5") || freeTime.includes("6")) return "Cao";
    return "Khá";
  })();

  const habits = [
    focusTime ? `Bạn có xu hướng đạt hiệu quả cao vào ${profile.focusTime}.` : "Hiệu suất hiện còn phụ thuộc vào việc xác định rõ giờ vàng cá nhân.",
    `Bạn thiên về kiểu phân bổ lịch: ${preferredStyle}.`,
    `Trong khung giờ mạnh nhất, AI nên ưu tiên: ${focusTaskType}.`,
    answerText.includes("buổi tối") ? "Năng lượng có xu hướng dồn về cuối ngày, nên tránh xếp task nặng quá sớm." : "Nên gom các nhiệm vụ quan trọng vào khối thời gian ít gián đoạn nhất.",
    journal.length ? `Dữ liệu nhật ký hiện tại cho thấy tỷ lệ hoàn thành khoảng ${completionScore}%.` : "Chưa có đủ dữ liệu nhật ký nên phân tích hành vi vẫn đang ở mức khởi tạo.",
  ];

  return {
    strengths: strengthsList,
    improvements,
    habits,
    feasibility,
    summary: `Mục tiêu "${profile.goal}" hiện có mức khả thi ${feasibility.toLowerCase()}. Bạn đang ở trạng thái "${currentLevel}", đích ngắn hạn sau 4 tuần là "${fourWeekGoal}", và kiểu hỗ trợ AI phù hợp lúc này là "${aiSupportMode}".`,
  };
}

function handleGeneratePlan() {
  if (!ensureLoggedIn()) return;

  if (!state.profile || !state.analysis) {
    els.planContent.innerHTML = '<div class="empty-state">Bạn cần hoàn thành hồ sơ và khảo sát trước khi tạo kế hoạch tuần.</div>';
    return;
  }

  els.planContent.className = "empty-state";
  els.planContent.textContent = "AI đang tạo bảng kế hoạch tuần cá nhân hóa...";
  generatePlanWithAI();
}

function buildPlan(profile, analysis, journal) {
  const goalType = detectGoalType(profile.goal);
  const efficiency = latestEfficiency(journal);
  const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  const templates = {
    study: [
      ["Ôn lý thuyết trọng tâm", "90 phút", "high"],
      ["Luyện bài tập hoặc đề thực hành", "75 phút", "high"],
      ["Tổng hợp ghi chú và flashcards", "30 phút", "medium"],
    ],
    work: [
      ["Deep work cho nhiệm vụ quan trọng", "120 phút", "high"],
      ["Xử lý task phối hợp và phản hồi", "60 phút", "medium"],
      ["Rà soát KPI và tối ưu quy trình", "30 phút", "low"],
    ],
    skill: [
      ["Học kỹ năng mới theo module", "90 phút", "high"],
      ["Làm mini project hoặc bài thực hành", "80 phút", "high"],
      ["Viết note và tự đánh giá", "25 phút", "medium"],
    ],
  };

  return days.map((day, index) => {
    const baseTasks = templates[goalType].map(([task, time, priority], taskIndex) => ({
      task: `${task} ${index % 2 === 0 && taskIndex === 1 ? `cho mục tiêu ${profile.goal}` : ""}`.trim(),
      time,
      priority,
    }));

    if (efficiency === "Thấp") {
      baseTasks.push({ task: "Buffer phục hồi và dọn task tồn", time: "25 phút", priority: "low" });
    } else if (efficiency === "Cao") {
      baseTasks.push({ task: "Tăng cường một phiên bứt tốc", time: "35 phút", priority: "medium" });
    }

    return {
      day,
      focus: analysis.habits[index % analysis.habits.length],
      tasks: baseTasks,
    };
  });
}

function handleJournalSubmit(event) {
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
    if (state.plan.length) {
      state.plan = buildSmartPlan(state.profile, state.analysis, state.journal);
    }
  }

  saveAppState();
  els.journalForm.reset();
  if (els.journalDay) {
    els.journalDay.value = getCurrentWeekdayLabel();
  }
  renderAll();
}

function renderAll() {
  renderEntryFlow();
  renderWorkspaceGate();
  renderSidebar();
  renderAnalysis();
  renderPlan();
  renderJournal();
  renderProfile();
}

function renderEntryFlow() {
  const loggedIn = isLoggedIn();

  if (els.body) {
    els.body.classList.toggle("app-locked", !loggedIn);
    els.body.classList.toggle("app-ready", loggedIn);
  }

  if (els.authGate) {
    els.authGate.hidden = loggedIn && !isEntryTransitionRunning;
  }

  if (els.pageShell) {
    els.pageShell.hidden = !loggedIn;
  }

  if (els.topbarHoverZone) {
    els.topbarHoverZone.hidden = !loggedIn;
  }
}

function triggerPostLoginTransition() {
  if (isEntryTransitionRunning || !els.body || !els.authGate || !els.pageShell) {
    queueIntroScroll();
    return;
  }

  isEntryTransitionRunning = true;
  els.authGate.hidden = false;
  els.pageShell.hidden = false;
  els.body.classList.add("app-transitioning");

  requestAnimationFrame(() => {
    els.body.classList.add("app-transition-enter");
  });

  window.setTimeout(() => {
    els.authGate.hidden = true;
    els.body.classList.remove("app-transitioning", "app-transition-enter");
    isEntryTransitionRunning = false;
    renderEntryFlow();
    queueIntroScroll();
  }, 900);
}

function queueIntroScroll() {
  const introSection = document.querySelector("#home");
  if (!introSection) return;

  window.setTimeout(() => {
    introSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 120);
}

function renderWorkspaceGate() {
  if (!els.workspace) return;

  const loggedIn = isLoggedIn();
  els.workspace.classList.remove("workspace-locked");

  if (els.topbarCta) {
    const accountLabel = state.profile?.name || appState.currentUser || "Khách";
    els.topbarCta.textContent = loggedIn ? `Tài khoản: ${accountLabel}` : "Đăng nhập";
    els.topbarCta.dataset.scroll = "#workspace";
  }

  if (els.workspaceTitle) {
    els.workspaceTitle.textContent = "Bảng điều khiển cá nhân";
  }

  if (els.authPanelTitle) {
    els.authPanelTitle.textContent = loggedIn ? "Tài khoản đã sẵn sàng" : "Đăng nhập để bắt đầu";
  }

  if (els.authPanelCopy) {
    els.authPanelCopy.textContent = loggedIn
      ? "Bạn đã đăng nhập. Từ đây có thể lưu hồ sơ, làm khảo sát AI và xem toàn bộ phân tích, kế hoạch của riêng mình."
      : "Hãy đăng nhập từ màn hình chào để mở dashboard cá nhân.";
  }
}

function renderSidebar() {
  const identity = appState.currentUser || "khách";
  const name = state.profile?.name || identity;
  if (els.authEmail) {
    els.authEmail.value = appState.currentUser || els.authEmail.value;
  }
  if (els.welcomeName) {
    els.welcomeName.textContent = `Xin chào, ${name}`;
  }
  if (els.welcomeGoal) {
    els.welcomeGoal.textContent = state.profile?.goal || (isLoggedIn() ? "Tạo hồ sơ để bắt đầu chu trình lập kế hoạch." : "Đăng nhập để bật không gian làm việc cá nhân.");
  }
  if (els.logoutButton) {
    els.logoutButton.style.display = isLoggedIn() ? "inline-flex" : "none";
  }
  if (els.surveyStatus) {
    if (state.isGeneratingSurvey) {
      els.surveyStatus.textContent = "AI đang tạo";
    } else if (!state.questions.length) {
      els.surveyStatus.textContent = state.surveySource === "quota" ? "Hết quota Gemini" : "Chưa bắt đầu";
    } else if (state.surveySource === "ai") {
      els.surveyStatus.textContent = "Từ Gemini";
    } else if (state.surveySource === "fallback") {
      els.surveyStatus.textContent = "Dự phòng local";
    } else {
      els.surveyStatus.textContent = "Đã tạo câu hỏi";
    }
  }
  if (els.analysisStatus) {
    els.analysisStatus.textContent = state.analysis ? `Mức khả thi ${state.analysis.feasibility}` : "Chưa có dữ liệu";
  }
  if (els.planStatus) {
    els.planStatus.textContent = state.plan.length ? `${state.plan.length} ngày đã lên lịch` : "Chưa tạo";
  }

  const completion = calculateCompletionRate(state.journal);
  if (els.completionRate) {
    els.completionRate.textContent = `${completion}%`;
  }
  if (els.progressFill) {
    els.progressFill.style.width = `${completion}%`;
  }
}

function renderAnalysis() {
  if (!isLoggedIn()) {
    els.analysisContent.className = "empty-state";
    els.analysisContent.textContent = "Đăng nhập để nhận phân tích AI và lưu lịch sử theo tài khoản.";
    return;
  }

  if (!state.analysis) {
    els.analysisContent.className = "empty-state";
    els.analysisContent.textContent = "Hoàn thành khảo sát để nhận phân tích về thói quen, mức độ khả thi và các điểm cần cải thiện.";
    return;
  }

  els.analysisContent.className = "";
  els.analysisContent.innerHTML = `
    <p>${state.analysis.summary}</p>
    <div class="analysis-grid">
      <article class="analysis-block">
        <h4>Nhận xét thói quen</h4>
        <ul>${state.analysis.habits.map((item) => `<li>${item}</li>`).join("")}</ul>
      </article>
      <article class="analysis-block">
        <h4>Điểm mạnh</h4>
        <ul>${state.analysis.strengths.map((item) => `<li>${item}</li>`).join("")}</ul>
      </article>
      <article class="analysis-block">
        <h4>Điểm cần cải thiện</h4>
        <ul>${state.analysis.improvements.map((item) => `<li>${item}</li>`).join("")}</ul>
      </article>
      <article class="analysis-block">
        <h4>Mức độ khả thi</h4>
        <ul>
          <li>Mục tiêu hiện tại được đánh giá ở mức <strong>${state.analysis.feasibility}</strong>.</li>
          <li>Duy trì nhật ký hằng ngày sẽ giúp AI cập nhật lại phân tích chính xác hơn.</li>
        </ul>
      </article>
      <article class="analysis-block">
        <h4>Việc cần làm ngay</h4>
        <ul>${(state.analysis.nextActions || []).map((item) => `<li>${item}</li>`).join("")}</ul>
      </article>
      <article class="analysis-block">
        <h4>Rủi ro chính</h4>
        <ul>${(state.analysis.risks || []).map((item) => `<li>${item}</li>`).join("")}</ul>
      </article>
    </div>
    <div class="analysis-roadmap">
      ${(state.analysis.roadmap || []).map((step) => `
        <article class="analysis-block roadmap-block">
          <h4>${step.week}</h4>
          <p><strong>Mục tiêu:</strong> ${step.goal}</p>
          <ul>${(step.focus || []).map((item) => `<li>${item}</li>`).join("")}</ul>
        </article>
      `).join("")}
    </div>
  `;
}

function renderPlan() {
  if (!isLoggedIn()) {
    els.planContent.className = "empty-state";
    els.planContent.textContent = "Đăng nhập để tạo kế hoạch tuần cá nhân hóa.";
    return;
  }

  if (!state.plan.length) {
    els.planContent.className = "empty-state";
    els.planContent.textContent = "Chưa có kế hoạch. Hãy hoàn thành hồ sơ và phân tích trước khi tạo lịch tuần.";
    return;
  }

  els.planContent.className = "planner-grid";
  els.planContent.innerHTML = state.plan.map((day) => `
    <article class="day-plan">
      <h4>${day.day}</h4>
      <p>${day.focus}</p>
      <div>
        ${day.tasks.map((task) => `
          <div class="task-row">
            <div class="task-meta">${task.time}</div>
            <div>${task.task}</div>
            <div class="priority ${task.priority}">${priorityLabel(task.priority)}</div>
          </div>
        `).join("")}
      </div>
    </article>
  `).join("");
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

  els.journalList.className = "journal-list";
  els.journalList.innerHTML = state.journal.map((entry) => `
    <article class="journal-item">
      <div class="journal-item-header">
        <strong>${entry.day || formatDate(entry.date)}</strong>
        <div class="tag">${entry.status} • ${entry.efficiency}</div>
      </div>
      <p>${entry.done}</p>
    </article>
  `).join("");
}

function renderProfile() {
  if (!els.profileContent) return;

  if (!isLoggedIn()) {
    els.profileContent.className = "profile-content empty-state";
    els.profileContent.textContent = "Đăng nhập để xem hồ sơ cá nhân, lịch sử kế hoạch và phân tích AI theo thời gian.";
    return;
  }

  if (!state.profile) {
    els.profileContent.className = "profile-content empty-state";
    els.profileContent.textContent = "Tạo hồ sơ để xem lịch sử kế hoạch, thống kê tiến độ và phân tích AI theo thời gian.";
    return;
  }

  const completion = calculateCompletionRate(state.journal);
  els.profileContent.className = "profile-grid";
  els.profileContent.innerHTML = `
    <article class="profile-block">
      <h4>Thông tin cá nhân</h4>
      <ul>
        <li>Tài khoản: ${appState.currentUser}</li>
        <li>Tên: ${state.profile.name}</li>
        <li>Tuổi: ${state.profile.age}</li>
        <li>Mục tiêu: ${state.profile.goal}</li>
      </ul>
    </article>
    <article class="profile-block">
      <h4>Tiến độ hiện tại</h4>
      <ul>
        <li>Tỷ lệ hoàn thành nhật ký: ${completion}%</li>
        <li>Số bản ghi hằng ngày: ${state.journal.length}</li>
        <li>Số ngày đã lên kế hoạch: ${state.plan.length}</li>
        <li>Phân tích AI: ${state.analysis ? `Khả thi ${state.analysis.feasibility}` : "Chưa có"}</li>
      </ul>
    </article>
    <article class="profile-block">
      <h4>Lịch sử AI</h4>
      <ul>
        <li>Câu hỏi khảo sát đã tạo: ${state.questions.length}</li>
        <li>Phản hồi đã lưu: ${Object.keys(state.answers).length}</li>
        <li>Khung giờ ưu tiên: ${state.profile.focusTime || "Chưa cập nhật"}</li>
        <li>Thời gian rảnh: ${state.profile.freeTime || "Chưa cập nhật"}</li>
      </ul>
    </article>
    <article class="profile-block">
      <h4>Gợi ý bước tiếp theo</h4>
      <ul>
        <li>Ghi nhật ký cuối ngày để cải thiện độ chính xác.</li>
        <li>Cập nhật lại mục tiêu nếu ưu tiên thay đổi.</li>
        <li>Tạo lại kế hoạch tuần sau khi có thêm dữ liệu thật.</li>
      </ul>
    </article>
  `;
}

function handleClearAccountData() {
  if (!ensureLoggedIn()) return;

  const confirmed = window.confirm("Bạn có chắc muốn xóa toàn bộ hồ sơ, khảo sát, phân tích, kế hoạch và nhật ký của tài khoản này không?");
  if (!confirmed) return;

  state = createEmptyUserState();
  saveAppState();
  resetWorkspaceInputs();
  renderQuestions();
  renderAll();
  setAuthMessage("Đã xóa toàn bộ dữ liệu của tài khoản hiện tại. Bạn có thể nhập thông tin mới.");
}

function calculateCompletionRate(journal) {
  if (!journal.length) return 0;
  const completedEntries = journal.filter((entry) => entry.status === "Hoàn thành").length;
  return Math.round((completedEntries / journal.length) * 100);
}

function isGeminiQuotaError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("quota exceeded")
    || text.includes("rate limit")
    || text.includes("billing details")
    || text.includes("retry in");
}

function getRetryDelayFromMessage(message) {
  const text = String(message || "");
  const match = text.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (!match) return null;

  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.ceil(seconds * 1000);
}

function buildQuotaSurveyMessage() {
  const retryText = state.surveyRetryAt
    ? ` AI sẽ tự thử lại sau khoảng ${Math.max(1, Math.ceil((state.surveyRetryAt - Date.now()) / 1000))} giây.`
    : "";
  const errorText = state.surveyError
    ? ` Chi tiết: ${escapeHtml(state.surveyError)}`
    : "";

  return `Gemini chưa thể tạo khảo sát vì quota hoặc rate limit.${retryText}${errorText}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function latestEfficiency(journal) {
  return journal[0]?.efficiency || "Trung bình";
}

function detectGoalType(goal) {
  const text = (goal || "").toLowerCase();
  if (text.includes("việc") || text.includes("dự án") || text.includes("công việc")) return "work";
  if (text.includes("kỹ năng") || text.includes("thiết kế") || text.includes("frontend")) return "skill";
  return "study";
}

async function analyzeWithAI() {
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildAiPayload()),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok || !result.analysis) {
      throw new Error(result.error || "AI analysis failed.");
    }

    state.analysis = normalizeAnalysis(result.analysis);
  } catch (error) {
    state.analysis = generateSmartAnalysis(state.profile, state.answers, state.journal);
    setAuthMessage(`Không gọi được Gemini cho phân tích, đang dùng bản dự phòng. Lỗi: ${error.message}`);
  }

  state.plan = [];
  saveAppState();
  renderAll();
  document.querySelector("#analysis")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function generatePlanWithAI() {
  try {
    const response = await fetch("/api/plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildAiPayload()),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok || !Array.isArray(result.plan)) {
      throw new Error(result.error || "AI planning failed.");
    }

    state.plan = normalizePlan(result.plan);
  } catch (error) {
    state.plan = buildSmartPlan(state.profile, state.analysis, state.journal);
    setAuthMessage(`Không gọi được Gemini cho kế hoạch tuần, đang dùng bản dự phòng. Lỗi: ${error.message}`);
  }

  saveAppState();
  renderAll();
}

function buildAiPayload() {
  return {
    profile: state.profile,
    questions: state.questions,
    answers: state.answers,
    analysis: state.analysis,
    journal: state.journal,
    coach: state.coach,
  };
}

function normalizeAnalysis(analysis) {
  return {
    summary: analysis.summary || "Chưa có tóm tắt.",
    feasibility: analysis.feasibility || "Trung bình",
    strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
    improvements: Array.isArray(analysis.improvements) ? analysis.improvements : [],
    habits: Array.isArray(analysis.habits) ? analysis.habits : [],
    nextActions: Array.isArray(analysis.nextActions) ? analysis.nextActions : [],
    risks: Array.isArray(analysis.risks) ? analysis.risks : [],
    roadmap: Array.isArray(analysis.roadmap) ? analysis.roadmap.map((step) => ({
      week: step.week || "Tuần",
      goal: step.goal || "Chưa có mục tiêu tuần.",
      focus: Array.isArray(step.focus) ? step.focus : [],
    })) : [],
  };
}

function normalizePlan(plan) {
  return plan.map((day) => ({
    day: day.day || "Chưa rõ ngày",
    focus: day.focus || "Chưa có mô tả trọng tâm.",
    tasks: Array.isArray(day.tasks)
      ? day.tasks.map((task) => ({
          task: task.task || "Chưa có task",
          time: task.time || "30 phút",
          priority: ["high", "medium", "low"].includes(task.priority) ? task.priority : "medium",
        }))
      : [],
  }));
}

function generateSmartAnalysis(profile, answers, journal) {
  const answerValues = Object.values(answers);
  const answerText = answerValues.join(" ").toLowerCase();
  const freeTime = (profile.freeTime || "").toLowerCase();
  const focusTime = (profile.focusTime || "").toLowerCase();
  const strengths = (profile.strengthsWeaknesses || "").toLowerCase();
  const completionScore = calculateCompletionRate(journal);
  const currentLevel = answerValues[0] || "chưa mô tả rõ";
  const mainBarrier = answerValues[1] || "chưa xác định rõ";
  const focusTaskType = answerValues[2] || "chưa xác định";
  const preferredStyle = answerValues[3] || "chưa xác định";
  const mainStrength = answerValues[4] || "chưa xác định";
  const mainWeakness = answerValues[5] || "chưa xác định";
  const fourWeekGoal = answerValues[6] || "chưa nêu rõ";
  const aiSupportMode = answerValues[7] || "chưa chọn";
  const realism = assessGoalRealism(profile.goal, currentLevel, fourWeekGoal, freeTime);
  const roadmap = buildAnalysisRoadmap(profile, {
    currentLevel,
    mainBarrier,
    focusTaskType,
    preferredStyle,
    mainWeakness,
    fourWeekGoal,
    feasibility: realism.feasibility,
  });

  const strengthsList = [
    answerText.includes("kỷ luật") || strengths.includes("kỷ luật") ? "Bạn có nền tảng kỷ luật khá tốt khi mục tiêu đã được làm rõ." : "Bạn có động lực nội tại tương đối rõ với mục tiêu đã chọn.",
    freeTime ? `Bạn đã xác định được quỹ thời gian khả dụng: ${profile.freeTime}.` : "Bạn có ý thức dành thời gian riêng cho phát triển bản thân.",
    focusTime ? `Bạn hiểu tương đối rõ khung giờ hiệu quả nhất: ${profile.focusTime}.` : "Bạn vẫn còn dư địa để tìm ra giờ vàng học và làm việc hiệu quả hơn.",
    `Hiện trạng bản thân đang ở mức: ${currentLevel}.`,
    `Điểm mạnh nổi bật nhất hiện tại là: ${mainStrength}.`,
  ];

  const improvements = [
    answerText.includes("trì hoãn") || strengths.includes("trì hoãn") ? "Cần chia nhỏ đầu việc và đặt điểm bắt đầu thật rõ để giảm trì hoãn." : "Nên quy đổi mục tiêu lớn thành các mốc tuần cụ thể hơn.",
    answerText.includes("mệt") || answerText.includes("quá tải") ? "Cần chèn khoảng nghỉ ngắn và phân bố sức bền để tránh hụt năng lượng kéo dài." : "Nên khóa trước các khung tập trung sâu trong tuần thay vì chờ cảm hứng.",
    `Rào cản chính hiện tại là: ${mainBarrier}.`,
    `Thói quen dễ làm trượt kế hoạch nhất là: ${mainWeakness}.`,
    realism.adjustment,
    completionScore < 50 ? "Cần cơ chế kiểm tra cuối ngày để tăng tỷ lệ hoàn thành thật." : "Nên duy trì phản hồi hằng ngày để AI tinh chỉnh chính xác hơn.",
  ];

  const habits = [
    focusTime ? `Bạn có xu hướng đạt hiệu quả cao vào ${profile.focusTime}.` : "Hiệu suất hiện còn phụ thuộc vào việc xác định rõ giờ vàng cá nhân.",
    `Bạn thiên về kiểu phân bổ lịch: ${preferredStyle}.`,
    `Trong khung giờ mạnh nhất, AI nên ưu tiên: ${focusTaskType}.`,
    journal.length ? `Dữ liệu nhật ký hiện tại cho thấy tỷ lệ hoàn thành khoảng ${completionScore}%.` : "Chưa có đủ dữ liệu nhật ký nên phân tích hành vi vẫn đang ở mức khởi tạo.",
  ];

  const nextActions = [
    `Chốt lại một đích 4 tuần ngắn gọn, đo được và bám sát mục tiêu "${profile.goal}".`,
    freeTime ? `Khóa trước ${profile.freeTime} vào lịch cố định để tránh học/làm việc theo cảm hứng.` : "Chốt trước khung thời gian cố định trong ngày để tạo nhịp ổn định.",
    `Bắt đầu từ một đầu việc nhỏ nhất liên quan đến ${fourWeekGoal.toLowerCase()}.`,
    `Thiết lập cơ chế tự kiểm tra cuối ngày để xử lý rào cản "${mainBarrier.toLowerCase()}".`,
  ];

  const risks = [
    `Rào cản chính hiện tại là ${mainBarrier.toLowerCase()}, nếu không xử lý sớm kế hoạch sẽ dễ bị đứt nhịp.`,
    `Thói quen "${mainWeakness.toLowerCase()}" có thể làm giảm tỷ lệ hoàn thành thực tế.`,
    freeTime ? `Quỹ thời gian "${profile.freeTime}" cần được giữ ổn định, nếu bị xé lẻ hiệu quả sẽ giảm mạnh.` : "Nếu không cố định được quỹ thời gian, kế hoạch sẽ khó duy trì quá 1-2 tuần.",
  ];

  return {
    strengths: strengthsList,
    improvements,
    habits,
    nextActions,
    risks,
    roadmap,
    feasibility: realism.feasibility,
    summary: `Mục tiêu "${profile.goal}" hiện được đánh giá ở mức ${realism.feasibility.toLowerCase()}. ${realism.reason} Bạn đang ở trạng thái "${currentLevel}", đích 4 tuần là "${fourWeekGoal}", và kiểu hỗ trợ phù hợp lúc này là "${aiSupportMode}".`,
  };
}

function buildAnalysisRoadmap(profile, context) {
  const goal = profile.goal || "mục tiêu hiện tại";
  const weekOneGoal = context.feasibility === "Rất thấp" || context.feasibility === "Thấp"
    ? `Thu nhỏ mục tiêu "${goal}" thành một mốc gần và kiểm soát được`
    : `Ổn định nền tảng để tiến tới mục tiêu "${goal}"`;

  return [
    {
      week: "Tuần 1",
      goal: weekOneGoal,
      focus: [
        `Làm rõ hiện trạng ở mức "${context.currentLevel}".`,
        `Chốt 1 đầu ra nhỏ liên quan đến "${context.fourWeekGoal}".`,
        `Thiết kế lịch bám theo kiểu phân bổ "${context.preferredStyle}".`,
      ],
    },
    {
      week: "Tuần 2",
      goal: "Tạo nhịp làm việc ổn định và xử lý điểm nghẽn chính",
      focus: [
        `Ưu tiên xử lý rào cản "${context.mainBarrier}".`,
        `Đặt khối tập trung cho nhóm việc "${context.focusTaskType}".`,
        "Theo dõi tỷ lệ hoàn thành và điều chỉnh khối lượng nếu đang quá tải.",
      ],
    },
    {
      week: "Tuần 3",
      goal: "Đẩy đầu ra thực tế và kiểm tra tiến bộ",
      focus: [
        "Hoàn thành một đầu ra nhìn thấy được hoặc đo được.",
        "Đối chiếu kết quả thực tế với mục tiêu 4 tuần đã chốt.",
        `Giảm ảnh hưởng của thói quen "${context.mainWeakness}".`,
      ],
    },
    {
      week: "Tuần 4",
      goal: "Tổng kết, củng cố và quyết định bước kế tiếp",
      focus: [
        "Tổng hợp phần đã làm được và phần còn thiếu.",
        "Giữ lại những khung giờ, cách học/làm việc hiệu quả nhất.",
        "Chốt mục tiêu tiếp theo dựa trên dữ liệu thực tế thay vì kỳ vọng cảm tính.",
      ],
    },
  ];
}

function assessGoalRealism(goal, currentLevel, fourWeekGoal, freeTime) {
  const text = (goal || "").toLowerCase();
  const current = (currentLevel || "").toLowerCase();
  const target4Weeks = (fourWeekGoal || "").toLowerCase();
  const free = (freeTime || "").toLowerCase();

  const unrealisticGoals = [
    "tổng thống mỹ",
    "president of the united states",
    "thành tổng thống",
    "trở thành tỷ phú",
    "nổi tiếng toàn cầu",
    "thống trị thế giới",
  ];

  if (unrealisticGoals.some((pattern) => text.includes(pattern))) {
    return {
      feasibility: "Rất thấp",
      reason: "Mục tiêu này đòi hỏi điều kiện pháp lý, bối cảnh xã hội và lộ trình nhiều năm nên không thể xem là khả thi trong ngắn hạn.",
      adjustment: "Nên đổi sang mục tiêu gần hơn và kiểm soát được, ví dụ xây kỹ năng nền, hồ sơ thành tích hoặc năng lực lãnh đạo liên quan.",
    };
  }

  if (text.includes("ceo") || text.includes("giám đốc") || text.includes("startup triệu đô") || text.includes("tỷ phú")) {
    return {
      feasibility: "Thấp",
      reason: "Mục tiêu hiện quá lớn so với khung 4 tuần và thường cần nhiều nguồn lực, kinh nghiệm, mạng lưới và thời gian dài.",
      adjustment: "Nên tách mục tiêu lớn thành mốc gần hơn trong 4-12 tuần, ví dụ hoàn thành kỹ năng lõi, sản phẩm đầu tiên hoặc chứng chỉ nền tảng.",
    };
  }

  const limitedTime = free.includes("1") || free.includes("2");
  const ambitiousStart = current.includes("mới bắt đầu") && (target4Weeks.includes("sản phẩm") || target4Weeks.includes("điểm") || target4Weeks.includes("kết quả"));
  if (limitedTime && ambitiousStart) {
    return {
      feasibility: "Trung bình",
      reason: "Quỹ thời gian hiện tại khá hẹp trong khi kỳ vọng 4 tuần tương đối cao, nên cần giảm phạm vi mục tiêu.",
      adjustment: "Nên thu nhỏ đầu ra 4 tuần thành một mốc nền tảng rõ và đo được để tăng xác suất hoàn thành.",
    };
  }

  if (free.includes("3") || free.includes("4") || free.includes("5") || free.includes("6")) {
    return {
      feasibility: "Khá",
      reason: "Mục tiêu có thể khả thi nếu được chia nhỏ hợp lý, bám đúng khung giờ mạnh và có kiểm tra tiến độ đều.",
      adjustment: "Tập trung vào đầu ra ngắn hạn thật cụ thể thay vì cố đạt toàn bộ mục tiêu lớn trong một giai đoạn ngắn.",
    };
  }

  return {
    feasibility: "Trung bình",
    reason: "Mục tiêu không phải bất khả thi, nhưng cần thêm ràng buộc thực tế về thời gian, năng lực hiện tại và mốc đo tiến độ.",
    adjustment: "Nên quy đổi mục tiêu thành các mốc ngắn hạn rõ hơn để đánh giá tiến triển chính xác.",
  };
}

function buildSmartPlan(profile, analysis, journal) {
  const goalType = detectGoalType(profile.goal);
  const efficiency = latestEfficiency(journal);
  const goal = profile.goal || "mục tiêu hiện tại";
  const days = [
    { name: "Thứ 2", theme: "Khởi động và đặt nhịp" },
    { name: "Thứ 3", theme: "Đào sâu phần cốt lõi" },
    { name: "Thứ 4", theme: "Thực hành và kiểm tra" },
    { name: "Thứ 5", theme: "Tăng tốc đầu ra" },
    { name: "Thứ 6", theme: "Vá điểm yếu và củng cố" },
    { name: "Thứ 7", theme: "Tổng kết và tối ưu tuần" },
  ];

  const library = {
    study: [
      [["Chốt 3 nội dung học quan trọng nhất trong tuần", "25 phút", "medium"], ["Ôn lý thuyết nền cho mục tiêu", "80 phút", "high"], ["Lập checklist nội dung cần hoàn thành", "20 phút", "low"]],
      [["Học sâu một chủ điểm khó nhất", "90 phút", "high"], ["Tự diễn giải lại kiến thức bằng ghi chú ngắn", "30 phút", "medium"], ["Tạo bộ câu hỏi tự kiểm tra", "20 phút", "medium"]],
      [["Làm bài tập hoặc đề thực hành có giới hạn thời gian", "85 phút", "high"], ["Chữa lỗi và đánh dấu phần hổng", "40 phút", "high"], ["Ôn lại phần làm sai", "20 phút", "medium"]],
      [["Làm một phiên bứt tốc cho nội dung quan trọng", "95 phút", "high"], ["Tổng hợp kiến thức thành sơ đồ hoặc flashcards", "30 phút", "medium"], ["Tự chấm mức độ hiểu bài", "15 phút", "low"]],
      [["Rà lại các phần còn yếu trong tuần", "70 phút", "high"], ["Làm lại một bài từng chưa tốt", "45 phút", "medium"], ["Điều chỉnh chiến lược học tuần sau", "20 phút", "low"]],
      [["Kiểm tra tổng hợp tuần cho mục tiêu " + goal, "90 phút", "high"], ["Ghi lại tiến bộ và điểm còn thiếu", "25 phút", "medium"], ["Chuẩn bị tài liệu cho tuần kế tiếp", "20 phút", "low"]],
    ],
    work: [
      [["Xác định 3 đầu việc quan trọng nhất của tuần", "20 phút", "medium"], ["Deep work cho nhiệm vụ trọng tâm", "110 phút", "high"], ["Sắp xếp lại deadline và mức ưu tiên", "20 phút", "low"]],
      [["Xử lý phần việc khó cần tập trung sâu", "100 phút", "high"], ["Gỡ điểm nghẽn bằng ghi chú hoặc tài liệu rõ ràng", "35 phút", "medium"], ["Cập nhật tiến độ ngắn cho bản thân hoặc nhóm", "15 phút", "low"]],
      [["Thực thi một đầu việc có đầu ra cụ thể", "90 phút", "high"], ["Kiểm thử, rà lỗi hoặc hoàn thiện chi tiết", "45 phút", "high"], ["Chốt lại phần đã hoàn thành", "15 phút", "low"]],
      [["Đẩy nhanh hạng mục gần deadline", "100 phút", "high"], ["Xử lý việc phối hợp và phản hồi", "45 phút", "medium"], ["Ghi chú các điểm cần cải tiến", "20 phút", "low"]],
      [["Rà soát KPI hoặc kết quả tuần", "60 phút", "high"], ["Khóa các việc tồn đọng nhỏ", "35 phút", "medium"], ["Lên định hướng tuần sau", "20 phút", "medium"]],
      [["Tổng kết bài học từ công việc tuần này", "35 phút", "medium"], ["Tối ưu một quy trình làm việc", "40 phút", "medium"], ["Dọn backlog mức nhẹ", "25 phút", "low"]],
    ],
    skill: [
      [["Xác định kỹ năng lõi cần đẩy trong tuần", "20 phút", "medium"], ["Học module nền tảng cho kỹ năng", "85 phút", "high"], ["Viết checklist phần cần thực hành", "20 phút", "low"]],
      [["Học sâu một kỹ thuật hoặc công cụ quan trọng", "90 phút", "high"], ["Tạo ví dụ nhỏ để hiểu bản chất", "35 phút", "medium"], ["Ghi note về lỗi thường gặp", "15 phút", "low"]],
      [["Làm bài thực hành hoặc mini exercise", "85 phút", "high"], ["Sửa lỗi và so sánh trước/sau", "40 phút", "high"], ["Lưu lại bài học rút ra", "20 phút", "medium"]],
      [["Làm mini project áp dụng kỹ năng", "95 phút", "high"], ["Hoàn thiện một phần có thể nhìn thấy kết quả", "45 phút", "high"], ["Đánh giá phần còn yếu", "15 phút", "low"]],
      [["Luyện lại phần kỹ thuật còn chậm", "75 phút", "high"], ["Tối ưu sản phẩm hoặc bài thực hành", "35 phút", "medium"], ["Viết note tổng hợp kiến thức tuần", "20 phút", "medium"]],
      [["Tổng kết kỹ năng đã học trong tuần", "35 phút", "medium"], ["Làm demo hoặc bài test nhỏ", "45 phút", "high"], ["Chọn mục tiêu kỹ năng cho tuần sau", "20 phút", "low"]],
    ],
  };

  return days.map((day, index) => {
    const tasks = library[goalType][index].map(([task, time, priority]) => ({
      task: index === 3 || index === 5 ? `${task} cho mục tiêu ${goal}` : task,
      time,
      priority,
    }));

    if (analysis.feasibility === "Rất thấp" || analysis.feasibility === "Thấp") {
      tasks.unshift({ task: "Thu nhỏ mục tiêu thành một mốc gần và đo được", time: "20 phút", priority: "high" });
    }

    if (efficiency === "Thấp") {
      tasks.push({ task: "Buffer phục hồi và dọn task tồn nhẹ", time: "20 phút", priority: "low" });
    } else if (efficiency === "Cao" && index < 5) {
      tasks.push({ task: "Phiên tăng tốc ngắn khi còn năng lượng tốt", time: "30 phút", priority: "medium" });
    }

    return {
      day: day.name,
      focus: `${day.theme}. ${analysis.habits[index % analysis.habits.length]}`,
      tasks,
    };
  });
}

function priorityLabel(priority) {
  if (priority === "high") return "Cao";
  if (priority === "medium") return "Vừa";
  return "Thấp";
}

function formatDate(value) {
  const date = new Date(value);
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getCurrentWeekdayLabel() {
  const weekdays = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  return weekdays[new Date().getDay()];
}
