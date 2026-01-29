// /static/script.js

document.addEventListener("DOMContentLoaded", () => {
  // --- preset cards (index.html) ---
  const cards = document.querySelectorAll(".preset-card");
  if (cards.length) {
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        const presetId = card.dataset.id;
        if (!presetId) return;
        window.location.href = `/static/input.html?preset=${presetId}`;
      });
    });
  }

  // --- login user display (login.html など) ---
  const name = localStorage.getItem("user_name");
  const loginUserDisplay = document.getElementById("login-user-display");
  if (loginUserDisplay && name) {
    loginUserDisplay.textContent = `ログイン中：${name} さん`;
  }

  // --- register button (login.html など) ---
  const registerBtn = document.getElementById("register-button");
  if (registerBtn) {
    registerBtn.addEventListener("click", async () => {
      const emailEl = document.getElementById("reg-email");
      const usernameEl = document.getElementById("reg-username");
      const passwordEl = document.getElementById("reg-password");
      const msg = document.getElementById("register-message");
      if (!emailEl || !usernameEl || !passwordEl || !msg) return;

      const res = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailEl.value,
          username: usernameEl.value,
          password: passwordEl.value,
        }),
      });

      const data = await res.json().catch(() => ({}));
      msg.textContent = res.ok
        ? "登録に成功しました。ログインしてください。"
        : (data.detail || "登録に失敗しました。");
    });
  }

  // --- header user-info (全ページ共通) ---
  const userInfo = document.getElementById("user-info");
  const token = localStorage.getItem("access_token");

  if (userInfo) {
    if (name && token) {
      userInfo.innerHTML = `👤 <strong>${name}</strong> さん　
        <button id="logout-btn" style="padding:4px 8px;">ログアウト</button>`;
      const logoutBtn = document.getElementById("logout-btn");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
          localStorage.removeItem("user_name");
          localStorage.removeItem("user_email");
          localStorage.removeItem("access_token");
          location.reload();
        });
      }
    } else {
      userInfo.innerHTML = `<a href="/static/login.html">ログイン / 新規登録</a>`;
    }
  }
});
