let selectedPresetId = null;

async function loadPresets() {
  const res = await fetch("/presets");
  const presets = await res.json();

  const container = document.getElementById("preset-container");
  container.innerHTML = "";

  presets.forEach((preset) => {
    const card = document.createElement("div");
    card.className = "preset-card";

    card.innerHTML = `
      <h3>${preset.name}</h3>
      <p>${preset.description}</p>
    `;

    card.onclick = () => {
      selectedPresetId = preset.id;

      document
        .querySelectorAll(".preset-card")
        .forEach((c) => c.classList.remove("selected"));

      card.classList.add("selected");

      document.getElementById("next-button").disabled = false;
      document.getElementById("selected-info").textContent =
        `選択中: ${preset.name}`;
    };

    container.appendChild(card);
  });

  // カスタムカード
  const custom = document.createElement("div");
  custom.className = "preset-card";
  custom.innerHTML = `<h3>カスタム</h3><p>自分で目標を作る</p>`;

  custom.onclick = () => {
    selectedPresetId = null;

    document
      .querySelectorAll(".preset-card")
      .forEach((c) => c.classList.remove("selected"));

    custom.classList.add("selected");

    document.getElementById("next-button").disabled = false;
    document.getElementById("selected-info").textContent =
      "選択中: カスタム目標";
  };

  container.appendChild(custom);
}

document.addEventListener("DOMContentLoaded", loadPresets);
