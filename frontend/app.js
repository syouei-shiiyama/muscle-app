// /static/app.js
let cachedWorkoutDates = null;
let cachedWorkoutDatesPromise = null;

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("access_token");
  if (!token) {
    location.href = "/static/login.html";
    return;
  }

  // ===== 上部ユーザー表示 =====
  const userInfo = document.getElementById("user-info");
  const name = localStorage.getItem("user_name") || "User";
  if (userInfo) {
    userInfo.innerHTML = `
      <span style="opacity:.9;">${name}</span>
      <button id="logout-btn" style="
        margin-left:10px; padding:6px 10px; border-radius:10px;
        border:1px solid rgba(255,255,255,.15); background:transparent; color:#e5e7eb;
        cursor:pointer;
      ">ログアウト</button>
    `;
    document.getElementById("logout-btn")?.addEventListener("click", () => {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_email");
      localStorage.removeItem("user_name");
      location.href = "/static/login.html";
    });
  }

  // ===== 共通API =====
  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        Authorization: "Bearer " + token,
      },
    });

    if (res.status === 401) {
      localStorage.removeItem("access_token");
      location.href = "/static/login.html";
      return null;
    }

    const text = await res.text().catch(() => "");
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) {
      throw new Error(`${path} ${res.status}\n${text}`);
    }
    return data;
  }

  // ===== 画面切り替え =====
  const views = ["home", "history", "level", "team"];

  async function showView(key) {
  views.forEach((v) => {
    const el = document.getElementById("view-" + v);
    if (!el) return;
    el.style.display = (v === key) ? "block" : "none";
  });

  document.querySelectorAll(".navbtn").forEach((btn) => {
    btn.style.opacity = (btn.dataset.to === key) ? "1" : "0.6";
    btn.style.fontWeight = (btn.dataset.to === key) ? "700" : "600";
  });

  if (key === "home") {
    await renderHome();
  }

  if (key === "history") {
    await renderHistory();
    await initHistory1RM(); 
  }
}


  document.querySelectorAll(".navbtn").forEach((btn) => {
    btn.addEventListener("click", () => showView(btn.dataset.to));
  });

  // ===== ホーム：カレンダー =====
  function ymd(y, m, d) {
    const mm = String(m).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  async function loadWorkoutDates() {
    if (cachedWorkoutDates) return cachedWorkoutDates;
    if (cachedWorkoutDatesPromise) return cachedWorkoutDatesPromise;

    cachedWorkoutDatesPromise = (async () => {
      const workouts = await api("/workouts");
      const set = new Set((workouts || []).map(w => String(w.performed_at).slice(0, 10)));
      cachedWorkoutDates = set;
      return set;
    })();

    return cachedWorkoutDatesPromise;
  }

  function buildCalendar(year, month, doneSet) {
    const container = document.createElement("div");
    container.style.display = "grid";
    container.style.gridTemplateColumns = "repeat(7, 1fr)";
    container.style.gap = "8px";

    const header = document.createElement("div");
    header.style.gridColumn = "1 / -1";
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.margin = "8px 0 12px";

    header.innerHTML = `
      <button id="cal-prev" style="padding:6px 10px; border-radius:10px; background:transparent; color:#e5e7eb; border:1px solid rgba(255,255,255,.15); cursor:pointer;">←</button>
      <div style="font-weight:800;">${year} / ${month}</div>
      <button id="cal-next" style="padding:6px 10px; border-radius:10px; background:transparent; color:#e5e7eb; border:1px solid rgba(255,255,255,.15); cursor:pointer;">→</button>
    `;
    container.appendChild(header);

    const wds = ["日","月","火","水","木","金","土"];
    wds.forEach((w) => {
      const el = document.createElement("div");
      el.textContent = w;
      el.style.opacity = "0.7";
      el.style.textAlign = "center";
      el.style.fontSize = "12px";
      container.appendChild(el);
    });

    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    const startDay = first.getDay();
    const days = last.getDate();

    for (let i = 0; i < startDay; i++) container.appendChild(document.createElement("div"));

    for (let d = 1; d <= days; d++) {
      const cell = document.createElement("div");
      const dateStr = ymd(year, month, d);
      const done = doneSet.has(dateStr);

      cell.style.border = "1px solid rgba(255,255,255,.10)";
      cell.style.borderRadius = "12px";
      cell.style.padding = "10px 6px";
      cell.style.textAlign = "center";
      cell.style.minHeight = "54px";
      cell.style.position = "relative";
      cell.style.background = done ? "rgba(34,197,94,.12)" : "rgba(255,255,255,.03)";

      cell.innerHTML = `
        <div style="font-weight:700;">${d}</div>
        ${done ? `<div style="position:absolute; left:50%; transform:translateX(-50%); bottom:8px; font-size:12px;">●</div>` : ""}
      `;
      container.appendChild(cell);
    }

    return container;
  }

  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth() + 1;

  async function renderHome() {
    const calendarEl = document.getElementById("calendar");
    if (!calendarEl) return;

    calendarEl.textContent = "読み込み中...";
    const doneSet = await loadWorkoutDates();

    calendarEl.innerHTML = "";
    const cal = buildCalendar(calYear, calMonth, doneSet);
    calendarEl.appendChild(cal);

    cal.querySelector("#cal-prev")?.addEventListener("click", () => {
      calMonth--;
      if (calMonth <= 0) { calMonth = 12; calYear--; }
      cachedWorkoutDates = null;
      cachedWorkoutDatesPromise = null;
      renderHome();
    });

    cal.querySelector("#cal-next")?.addEventListener("click", () => {
      calMonth++;
      if (calMonth >= 13) { calMonth = 1; calYear++; }
      cachedWorkoutDates = null;
      cachedWorkoutDatesPromise = null;
      renderHome();
    });
  }

  // ===== 履歴 =====
  async function renderHistory() {
    const box = document.getElementById("history-list");
    if (!box) return;

    box.textContent = "読み込み中...";
    const workouts = await api("/workouts");
    if (!workouts || workouts.length === 0) {
      box.textContent = "まだ workout 記録がありません。";
      return;
    }

    workouts.sort((a, b) => (b.performed_at || "").localeCompare(a.performed_at || ""));
    box.innerHTML = "";

    workouts.forEach((w) => {
      const card = document.createElement("div");
      card.style.border = "1px solid rgba(255,255,255,.10)";
      card.style.borderRadius = "14px";
      card.style.padding = "12px";
      card.style.marginBottom = "10px";
      card.style.background = "rgba(255,255,255,.03)";

      const dateText = String(w.performed_at || "").slice(0, 10);
      const noteText = w.note ? `📝 ${w.note}` : "";
      const sets = Array.isArray(w.sets) ? w.sets : [];

      const setsHtml = sets.map(s => `
        <li style="margin:4px 0;">
          <b>exercise_id=${s.exercise_id}</b>：${s.weight_kg}kg × ${s.reps}回（${s.set_no}）
        </li>
      `).join("");

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-weight:800;">${dateText}</div>
          <div style="opacity:.7; font-size:12px;">id=${w.id}</div>
        </div>
        ${noteText ? `<div style="margin-top:6px; opacity:.9;">${noteText}</div>` : ""}
        <ul style="margin:10px 0 0; padding-left:18px;">
          ${setsHtml || `<li style="opacity:.7;">セットがありません</li>`}
        </ul>
      `;
      box.appendChild(card);
    });
  }

  let history1rmInited = false;
let historyChart = null;

async function initHistory1RM() {
  if (history1rmInited) return; // 二重登録防止
  history1rmInited = true;

  const select = document.getElementById("history-exercise");
  const canvas = document.getElementById("history1rmChart");
  if (!select || !canvas) return;

  // 種目一覧
  const exercises = await api("/exercises"); // [{id,name,...}]
  select.innerHTML = "";
  exercises.forEach(ex => {
    const opt = document.createElement("option");
    opt.value = ex.id;
    opt.textContent = ex.name;
    select.appendChild(opt);
  });

  async function loadAndDraw(exerciseId) {
    const data = await api(`/lifts/series?exercise_id=${exerciseId}`);
    if (!data || !data.series) return;

    const labels = data.series.map(p => {
      const d = new Date(p.t);
      return `${d.getMonth()+1}/${d.getDate()}`;
    });
    const values = data.series.map(p => p.v);

    const ctx = canvas.getContext("2d");
    if (historyChart) historyChart.destroy();

    historyChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: `推定1RM (kg)`,
          data: values,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 3,
        }]
      }
    });
  }

  // 最初の1回
  if (exercises.length > 0) {
    await loadAndDraw(exercises[0].id);
  }

  // 変更時
  select.addEventListener("change", async () => {
    await loadAndDraw(Number(select.value));
  });
}


  // ===== workout画面へ =====
  document.getElementById("go-workout")?.addEventListener("click", () => {
    location.href = "/static/workout.html";
  });

  // ===== 初期表示 =====
  const initial = (location.hash || "#home").replace("#", "");
  showView(views.includes(initial) ? initial : "home").catch(console.error);
});
