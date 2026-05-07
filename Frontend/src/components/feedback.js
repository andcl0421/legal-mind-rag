export function setStatus(el, message, tone = "info") {
  if (!el) return;
  el.textContent = message;
  el.classList.remove("status-info", "status-success", "status-error");
  if (tone === "success") el.classList.add("status-success");
  else if (tone === "error") el.classList.add("status-error");
  else el.classList.add("status-info");
}

export function setButtonLoading(button, loadingLabel, isLoading) {
  if (!button) return;
  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = button.textContent || "";
  }
  button.disabled = Boolean(isLoading);
  button.textContent = isLoading ? loadingLabel : button.dataset.defaultLabel;
}

export function toast(message, tone = "info") {
  let wrap = document.getElementById("toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "toast-wrap";
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const item = document.createElement("div");
  item.className = `toast-item toast-${tone}`;
  item.textContent = message;
  wrap.appendChild(item);
  setTimeout(() => {
    item.classList.add("hide");
    setTimeout(() => item.remove(), 240);
  }, 2200);
}
