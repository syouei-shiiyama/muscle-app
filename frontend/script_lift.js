let liftChart = null;

function setUserInfo() {
  const userInfo = document.getElementById("user-info");
  const name = localStorage.getItem("user_name");
  const token = localStorage.getItem("access_token");

  if (name && token) {
    userInfo.textContent = `ログイン中：${name} さん`;
  } else {
    userInfo.innerHTML = `<a href="/static/login.html">ログイン / 新規登録</a>`;
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("access_token");
  if (!token) throw new Error("not logged in");

  const headers = options.headers ? options.headers : {};
  headers["Authorization"] = "Bearer " + token;

  return fetch(path, { ...options, headers });
}

async function loadExercises() {
  const select = document.getElementById("exerciseSelect");
  const msg = document.getElementById("msg");
  msg.textContent = "種目読み込み中...";

  const res = await apiFetch("/exercises");
  const list = await res.json();

  select.innerHTML = "";
  list.forEach(ex => {
    const opt = document.createElement("option");
    opt.value = ex.id;
    opt.textContent = ex.name;
    select.appendChild(opt);
  });

  msg.textContent = list.length ? "" : "種目がありません。追加してください。";
}

function drawSeries(exerciseName, series) {
  const ctx = document.getElementById("liftChart").getContext("2d");

  const labels = series.map(p => {
    const d = new Date(p.t);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const data = series.map(p => p.v);

  if (liftChart) liftChart.destroy();

  liftChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: `${exerciseName} 1RM(kg)`,
          data,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 3,
        }
      ]
    },
    options: {
      scales: {
        y: { beginAtZero: false }
      }
    }
  });
}

async function loadSeries() {
  const select = document.getElementById("exerciseSelect");
  const msg = document.getElementById("msg");

  const exerciseId = Number(select.value);
  if (!exerciseId) return;

  msg.textContent = "グラフ更新中...";

  const res = await apiFetch(`/lifts/series?exercise_id=${exerciseId}`);
  const data = await res.json();

  drawSeries(data.exercise_name, data.series || []);
  msg.textContent = (data.series && data.series.length) ? "" : "この種目の記録がまだありません。";
}

async function addExercise() {
  const name = document.getElementById("newExerciseName").value.trim();
  const msg = document.getElementById("msg");
  if (!name) {
    msg.textContent = "種目名を入力してください。";
    return;
  }

  const res = await apiFetch("/exercises", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    msg.textContent = err.detail || "追加に失敗しました。";
    return;
  }

  document.getElementById("newExerciseName").value = "";
  await loadExercises();
  msg.textContent = "種目を追加しました。";
}

async function saveLift() {
  const msg = document.getElementById("msg");
  const exerciseId = Number(document.getElementById("exerciseSelect").value);
  const performedAt = document.getElementById("performedAtLift").value;
  const weightKg = Number(document.getElementById("weightKg").value);
  const reps = Number(document.getElementById("reps").value);

  if (!exerciseId) return;
  if (!performedAt) { msg.textContent = "記録日を選択してください。"; return; }
  if (!weightKg || weightKg <= 0) { msg.textContent = "重量(kg)を正しく入力してください。"; return; }
  if (!reps || reps <= 0) { msg.textContent = "回数(reps)を正しく入力してください。"; return; }

  const res = await apiFetch("/lifts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      exercise_id: exerciseId,
      performed_at: performedAt,
      weight_kg: weightKg,
      reps: reps
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    msg.textContent = err.detail || "保存に失敗しました。";
    return;
  }

  msg.textContent = "保存しました！";
  await loadSeries();
}

document.addEventListener("DOMContentLoaded", async () => {
  setUserInfo();

  const token = localStorage.getItem("access_token");
  if (!token) return;

  document.getElementById("performedAtLift").value = todayStr();

  await loadExercises();
  await loadSeries();

  document.getElementById("exerciseSelect").addEventListener("change", loadSeries);
  document.getElementById("addExerciseBtn").addEventListener("click", addExercise);
  document.getElementById("saveLiftBtn").addEventListener("click", saveLift);
});
