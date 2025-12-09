// プリセットカードの選択処理
document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".preset-card");
  const nextButton = document.getElementById("next-button");

  let selectedId = null;

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      // 一旦全カードの選択解除
      cards.forEach((c) => c.classList.remove("selected"));

      // クリックしたカードを選択状態に
      card.classList.add("selected");
      selectedId = card.dataset.id;

      // 「次へ進む」ボタンを有効化
      nextButton.disabled = false;
    });
  });

  // 「次へ進む」クリックで input 画面へ遷移
  nextButton.addEventListener("click", () => {
    if (!selectedId) return;

    // preset をクエリに付けて input.html へ
    window.location.href = `/static/input.html?preset=${selectedId}`;
  });
});
