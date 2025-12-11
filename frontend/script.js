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
