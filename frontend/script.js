// /static/script.js

document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".preset-card");

  // index.html（プリセット選択画面）の処理
  if (cards.length > 0) {
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        const presetId = card.dataset.id;
        if (!presetId) return;
        // 選んだプリセットIDをクエリに付けて input 画面へ
        window.location.href = `/static/input.html?preset=${presetId}`;
      });
    });
  }

  // ここから先で、input.html や login.html 用の処理も足していける
  // （今はまず index.html を確実に動かす）
});


document.addEventListener("DOMContentLoaded", () => {
  const name = localStorage.getItem("user_name");
  if (name) {
    document.getElementById("login-user-display").textContent =
      `ログイン中：${name} さん`;
  }
});

document.getElementById("register-button").addEventListener("click", async () => {
  const email = document.getElementById("reg-email").value;
  const username = document.getElementById("reg-username").value;
  const password = document.getElementById("reg-password").value;

  const res = await fetch("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password })
  });

  const data = await res.json();
  const msg = document.getElementById("register-message");

  if (res.ok) {
    msg.textContent = "登録に成功しました。ログインしてください。";
  } else {
    msg.textContent = data.detail || "登録に失敗しました。";
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const userInfo = document.getElementById("user-info");

  const username = localStorage.getItem("user_name");
  const token = localStorage.getItem("access_token");

  if (username && token) {
    // ログイン中
    userInfo.innerHTML = `
      👤 <strong>${username}</strong> さん　
      <button id="logout-btn" style="padding:4px 8px;">ログアウト</button>
    `;

    // ログアウトボタン押したとき
    document.getElementById("logout-btn").addEventListener("click", () => {
      localStorage.removeItem("user_name");
      localStorage.removeItem("user_email");
      localStorage.removeItem("access_token");
      location.reload(); // 画面更新
    });

  } else {
    // 未ログインの場合
    userInfo.innerHTML = `
      <a href="/static/login.html">ログイン / 新規登録</a>
    `;
  }
});

