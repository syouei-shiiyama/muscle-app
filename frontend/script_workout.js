// /static/script_workout.js
(() => {
  function getToken() {
    return localStorage.getItem("access_token");
  }

  function setUserInfo() {
    const userInfo = document.getElementById("user-info");
    const name = localStorage.getItem("user_name");
    const token = getToken();
    if (!userInfo) return;

    if (name && token) {
      userInfo.innerHTML = `ログイン中：<strong>${name}</strong> さん`;
    } else {
      userInfo.innerHTML = `<a href="/static/login.html">ログイン / 新規登録</a>`;
    }
  }

  async function apiJson(url, options = {}) {
    const token = getToken();
    const headers = new Headers(options.headers || {});
    if (token) headers.set("Authorization", "Bearer " + token);

    const res = await fetch(url, { ...options, headers });

    const text = await res.text().catch(() => "");
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      let msg;
      if (data && data.detail) {
        if (Array.isArray(data.detail)) {
          msg = data.detail
            .map(d => `${(d.loc || []).join(".")} : ${d.msg}`)
            .join("\n");
        } else {
          msg = String(data.detail);
        }
      } else {
        msg = text || `HTTP ${res.status}`;
      }
      throw new Error(msg);
    }
    return data;
  }

  function escapeHtml(s) {
    return (s ?? "").toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtDate(isoOrDate) {
    const d = new Date(isoOrDate);
    if (isNaN(d)) return String(isoOrDate);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    setUserInfo();

    const token = getToken();
    if (!token) {
      alert("ログインが必要です");
      location.href = "/static/login.html";
      return;
    }

    // ---- DOM elements
    const performedAtEl = document.getElementById("performedAt");
    const noteEl = document.getElementById("note");
    const setsEl = document.getElementById("sets");
    const msgEl = document.getElementById("msg");

    const addSetBtn = document.getElementById("add-set-btn");
    const addExBtn = document.getElementById("add-ex-btn");
    const newExNameEl = document.getElementById("new-ex-name");
    const saveBtn = document.getElementById("save-btn");

    if (!performedAtEl || !setsEl || !addSetBtn || !addExBtn || !saveBtn) {
      console.error("必要な要素が見つかりません。workout.html の id を確認してください。");
      return;
    }

    performedAtEl.value = new Date().toISOString().slice(0, 10);

    // ---- state
    let exercises = []; // [{id,name,...}]

    async function loadExercises() {
      exercises = await apiJson("/exercises");
    }

    function exerciseOptionsHtml(selectedId) {
      if (!exercises || exercises.length === 0) {
        return `<option value="">（種目なし）</option>`;
      }
      return exercises.map(ex => {
        const sel = (String(ex.id) === String(selectedId)) ? "selected" : "";
        return `<option value="${ex.id}" ${sel}>${escapeHtml(ex.name)}</option>`;
      }).join("");
    }

    function renumberBadges() {
      [...setsEl.children].forEach((child, i) => {
        const badge = child.querySelector(".muted");
        if (badge) badge.textContent = `セット#${i + 1}`;
      });
    }

    function addSetLine(initial = {}) {
      const idx = setsEl.children.length + 1;

      const div = document.createElement("div");
      div.className = "set-line";
      div.innerHTML = `
        <label>種目：
          <select class="ex-select">${exerciseOptionsHtml(initial.exercise_id)}</select>
        </label>

        <label>重量(kg)：
          <input class="w" type="number" step="0.5" min="0" value="${initial.weight_kg ?? ""}" style="width:100px;" />
        </label>

        <label>回数：
          <input class="r" type="number" step="1" min="1" value="${initial.reps ?? ""}" style="width:80px;" />
        </label>

        <span class="muted">セット#${idx}</span>
        <button class="btn remove-btn" type="button">削除</button>
      `;

      div.querySelector(".remove-btn").addEventListener("click", () => {
        div.remove();
        renumberBadges();
      });

      setsEl.appendChild(div);
    }

    async function refreshSelects() {
      document.querySelectorAll(".ex-select").forEach(sel => {
        const current = sel.value;
        sel.innerHTML = exerciseOptionsHtml(current);
      });
    }

    // ---- history
    async function loadHistory() {
      const box = document.getElementById("workout-history");
      if (!box) return;

      try {
        const exercises2 = await apiJson("/exercises");
        const exMap = {};
        exercises2.forEach(ex => { exMap[ex.id] = ex.name; });

        const workouts = await apiJson("/workouts");

        if (!workouts || workouts.length === 0) {
          box.innerHTML = `<p>まだ workout 記録がありません。</p>`;
          return;
        }

        const html = workouts.map((w, idx) => {
          const dateText = fmtDate(w.performed_at);
          const noteText = w.note ? escapeHtml(w.note) : "";

          const rowsHtml = (w.sets || []).map(s => {
            const exName = escapeHtml(exMap[s.exercise_id] || `ID:${s.exercise_id}`);
            return `
              <tr>
                <td>${exName}</td>
                <td>${s.set_no}</td>
                <td>${s.weight_kg}</td>
                <td>${s.reps}</td>
              </tr>
            `;
          }).join("");

          return `
            <div class="workout-card" style="border:1px solid #ddd; border-radius:10px; padding:12px; margin:12px 0;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>${dateText}</strong>
                <span style="color:#666;">#${idx + 1}</span>
              </div>
              ${noteText ? `<p style="margin:8px 0; color:#333;">📝 ${noteText}</p>` : ""}
              <table style="width:100%; border-collapse:collapse; margin-top:8px;">
                <thead>
                  <tr>
                    <th style="text-align:left; border-bottom:1px solid #eee; padding:6px;">種目</th>
                    <th style="text-align:left; border-bottom:1px solid #eee; padding:6px;">セット</th>
                    <th style="text-align:left; border-bottom:1px solid #eee; padding:6px;">kg</th>
                    <th style="text-align:left; border-bottom:1px solid #eee; padding:6px;">reps</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml || `<tr><td colspan="4" style="padding:8px; color:#666;">セット情報なし</td></tr>`}
                </tbody>
              </table>
            </div>
          `;
        }).join("");

        box.innerHTML = html;
      } catch (e) {
        console.error(e);
        box.innerHTML = `<p style="color:red;">履歴の読み込みに失敗しました：${escapeHtml(e.message)}</p>`;
      }
    }

    // ---- init
    try {
      await loadExercises();
    } catch (e) {
      console.error(e);
      alert("種目一覧の取得に失敗しました: " + e.message);
      return;
    }

    addSetLine();
    await loadHistory();

    // ---- handlers
    addSetBtn.addEventListener("click", () => addSetLine());

    addExBtn.addEventListener("click", async () => {
      const exName = (newExNameEl?.value || "").trim();
      if (!exName) {
        alert("種目名を入れてください");
        return;
      }

      try {
        const data = await apiJson("/exercises", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: exName }),
        });

        await loadExercises();
        await refreshSelects();

        if (newExNameEl) newExNameEl.value = "";
        if (msgEl) msgEl.textContent = `種目を追加しました: ${data.name} (id=${data.id})`;
      } catch (e) {
        alert("種目追加に失敗: " + e.message);
      }
    });

    saveBtn.addEventListener("click", async () => {
      if (msgEl) msgEl.textContent = "";

      // workouts: datetime / lifts: date
      const performedDate = performedAtEl.value;           // "YYYY-MM-DD"
      const performed_at = performedDate + "T00:00:00";    // workouts用
      const note = (noteEl?.value || "").trim();

      if (!performedDate) {
        alert("記録日を選択してください");
        return;
      }

      const rows = [...setsEl.children];
      if (rows.length === 0) {
        alert("セットを1つ以上入れてください");
        return;
      }

      const sets = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const exercise_id = Number(row.querySelector(".ex-select")?.value);
        const weight_kg = Number(row.querySelector(".w")?.value);
        const reps = Number(row.querySelector(".r")?.value);

        if (!exercise_id) { alert(`セット#${i + 1}: 種目を選択してください`); return; }
        if (!(weight_kg > 0)) { alert(`セット#${i + 1}: 重量(kg)を正しく入れてください`); return; }
        if (!(reps > 0)) { alert(`セット#${i + 1}: 回数を正しく入れてください`); return; }

        sets.push({ exercise_id, set_no: i + 1, weight_kg, reps });
      }

      // 1) workouts を保存
      try {
        const data = await apiJson("/workouts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ performed_at, note, sets }),
        });

        // 2) 成功したら lifts も保存（グラフ用）
        console.log("[DEBUG] posting lifts sets=", sets);

        for (const s of sets) {
          const liftRes = await fetch("/lifts", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token,
            },
            body: JSON.stringify({
              exercise_id: s.exercise_id,
              performed_at: performedDate,  // ★ date はこれ
              weight_kg: s.weight_kg,
              reps: s.reps,
            }),
          });

          const liftText = await liftRes.text().catch(() => "");
          console.log("[POST /lifts]", liftRes.status, liftText);

          if (!liftRes.ok) {
            alert("POST /lifts が失敗しました:\n" + liftText);
            // workouts は保存済みなので、ここでは中断だけ
            break;
          }
        }

        if (msgEl) msgEl.textContent = "保存しました！セッションID: " + data.id;

        // 入力クリア（weight / reps）
        rows.forEach(r => {
          const w = r.querySelector(".w");
          const rep = r.querySelector(".r");
          if (w) w.value = "";
          if (rep) rep.value = "";
        });

        await loadHistory();
      } catch (e) {
        alert("保存に失敗: " + e.message);
      }
    });
  });
})();
