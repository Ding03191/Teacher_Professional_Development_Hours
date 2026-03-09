(() => {
  const widgets = document.querySelectorAll(".ai-widget");
  widgets.forEach((widget) => {
    const toggleBtn = widget.querySelector("[data-ai-toggle]");
    const sendBtn = widget.querySelector("[data-ai-send]");
    const input = widget.querySelector("textarea");

    toggleBtn?.addEventListener("click", () => {
      widget.classList.toggle("is-collapsed");
    });

    sendBtn?.addEventListener("click", () => {
      if (!input) return;
      const msg = input.value.trim();
      if (!msg) return;
      input.value = "";
      alert("AI 問答尚未連線，已收到訊息。");
    });
  });
})();
