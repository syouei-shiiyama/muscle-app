let teamChart = null;

function setMsg(text) {
  const msg = document.getElementById("team-msg");
  if (msg) msg.textContent = text;
}

function setUserInfo() {
  const userInfo = document.getElementById("user-info");
  if (!userInfo) return;

  const name = localStorage.getItem("user_name");
  const token = localStorage.getItem("access_token");

  if (name && token) {
    userInfo.textContent = `ログイン中：${name} さん`;
  } else {
    userInfo.innerHTML = `<a href="/static/login.html">ログイン / 新規登録</a>`;
  }
}

function shortDate(iso) {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

// 全員の日時をユニーク化して labels を作り、各人の欠損は null にする
function alignSeries(seriesList) {
  const set = new Set();
  seriesList.forEach(s => (s.points || []).forEach(p => set.add(p.t)));

  const labelsISO = Array.from(set).sort((a, b) => new Date(a) - new Date(b));
  const labels = labelsISO.map(shortDate);

  const datasets = seriesList.map(s => {
    const map = new Map((s.points || []).map(p => [p.t, p.v]));
    return {
      label: s.username,
      data: labelsISO.map(t => (map.has(t) ? map.get(t) : null)),
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 3,
      spanGaps: false,
    };
  });

  return { labels, datasets };
}

function drawChart(labels, datasets, metric) {
  const el = document.getElementById("teamChart");
  if (!el) return;

  const ctx = el.getContext("2d");
  if (teamChart) teamChart.destroy();

  teamChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      plugins: { legend: { position: "top" } },
      scales: {
        y: metric === "level"
          ? { min: 0, max: 100, ticks: { stepSize: 20 } }
          : { beginAtZero: false }
      }
    }
  });
}

// チーム一覧
async function loadMyTeams() {
  const token = localStorage.getItem("access_token");
  const sel = document.getElementById("team-id");
  if (!sel) return;

  sel.innerHTML = `<option value="">チームを選択</option>`;

  if (!token) {
    setMsg("ログインしてください。");
    return;
  }

  try {
    const res = await fetch(`/teams/my`, {
      headers: { Authorization: "Bearer " + token }
    });

    const data = await res.json().catch(() => ([]));
    console.log("my teams:", data);

    if (!res.ok) {
      setMsg(data.detail || `チーム一覧の取得に失敗しました (${res.status})`);
      return;
    }

    if (!Array.isArray(data) || data.length === 0) {
      setMsg("所属チームがありません（チーム作成 or 招待コードで参加）");
      return;
    }

    for (const t of data) {
      const opt = document.createElement("option");
      opt.value = String(t.id);
      opt.textContent = t.name ? `${t.name} (id:${t.id})` : `team ${t.id}`;
      sel.appendChild(opt);
    }

    setMsg(`チーム一覧を読み込みました（${data.length}件）`);
  } catch (e) {
    console.error(e);
    setMsg("通信エラー（チーム一覧）");
  }
}

// チーム作成
async function createTeam() {
  const token = localStorage.getItem("access_token");
  const name = document.getElementById("team-create-name")?.value?.trim();
  const msg = document.getElementById("team-create-msg");
  if (msg) msg.textContent = "";

  if (!token) { if (msg) msg.textContent = "ログインしてください。"; return; }
  if (!name) { if (msg) msg.textContent = "チーム名を入力してください。"; return; }

  try {
    const res = await fetch("/teams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ name })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (msg) msg.textContent = data.detail || `作成に失敗しました (${res.status})`;
      return;
    }

    // ★ invite_code を表示（ここが大事）
    const codeText = data.invite_code ? ` 招待コード: ${data.invite_code}` : "";
    if (msg) msg.textContent = `作成しました：${data.name || name} (id:${data.id})${codeText}`;

    await loadMyTeams();
    const sel = document.getElementById("team-id");
    if (sel && data.id) sel.value = String(data.id);

  } catch (e) {
    console.error(e);
    if (msg) msg.textContent = "通信エラーが発生しました。";
  }
}

// 招待コードで参加
async function joinTeamByCode() {
  const token = localStorage.getItem("access_token");
  const code = document.getElementById("team-join-code")?.value?.trim();
  const msg = document.getElementById("team-join-msg");
  if (msg) msg.textContent = "";

  if (!token) { if (msg) msg.textContent = "ログインしてください。"; return; }
  if (!code) { if (msg) msg.textContent = "招待コードを入力してください。"; return; }

  try {
    // ★ main.py 側を /teams/join_by_code に統一する（後述）
    const res = await fetch(`/teams/join_by_code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ invite_code: code })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (msg) msg.textContent = data.detail || `参加に失敗しました (${res.status})`;
      return;
    }

    if (msg) msg.textContent = "参加しました！";
    await loadMyTeams();

    // 参加できたチームを自動選択
    const sel = document.getElementById("team-id");
    if (sel && data.team_id) sel.value = String(data.team_id);

  } catch (e) {
    console.error(e);
    if (msg) msg.textContent = "通信エラーが発生しました。";
  }
}

// グラフ表示
async function loadTeamSeries() {
  const token = localStorage.getItem("access_token");
  if (!token) { setMsg("ログインしてください。"); return; }

  const teamIdStr = document.getElementById("team-id")?.value;
  const metric = document.getElementById("metric")?.value || "level";
  if (!teamIdStr) { setMsg("チームを選択してください。"); return; }

  setMsg("読み込み中...");

  try {
    const res = await fetch(`/teams/${teamIdStr}/series?metric=${metric}`, {
      headers: { Authorization: "Bearer " + token }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(data.detail || `取得に失敗しました (${res.status})`); return; }
    if (!data.series || data.series.length === 0) { setMsg("メンバーがいません。"); return; }

    const { labels, datasets } = alignSeries(data.series);
    drawChart(labels, datasets, metric);
    setMsg(`表示しました（${data.series.length}人）`);
  } catch (e) {
    console.error(e);
    setMsg("通信エラーが発生しました。");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setUserInfo();

  const btn = document.getElementById("load-team");
  const sel = document.getElementById("team-id");
  const canvas = document.getElementById("teamChart");

  if (!btn || !sel || !canvas) {
    console.warn("team page elements not found. skip init.");
    return;
  }

  loadMyTeams();
  btn.addEventListener("click", loadTeamSeries);

  const createBtn = document.getElementById("team-create-btn");
  if (createBtn) createBtn.addEventListener("click", createTeam);

  const joinBtn = document.getElementById("team-join-btn");
  // ★ここ！ joinTeamById ではなく joinTeamByCode
  if (joinBtn) joinBtn.addEventListener("click", joinTeamByCode);
});
