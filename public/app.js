const cameraInput   = document.getElementById("cameraInput");
const fileInput     = document.getElementById("fileInput");
const preview       = document.getElementById("preview");
const placeholder   = document.getElementById("placeholder");
const identifyBtn   = document.getElementById("identifyBtn");
const resultsSection = document.getElementById("resultsSection");
const resultsContent = document.getElementById("resultsContent");
const spinner       = document.getElementById("spinner");
const resetBtn      = document.getElementById("resetBtn");

let selectedFile = null;

function loadImage(file) {
  if (!file || !file.type.startsWith("image/")) return;
  selectedFile = file;
  const url = URL.createObjectURL(file);
  preview.src = url;
  preview.hidden = false;
  placeholder.hidden = true;
  identifyBtn.hidden = false;
  // Hide any previous results
  resultsSection.hidden = true;
  resultsContent.innerHTML = "";
}

cameraInput.addEventListener("change", (e) => loadImage(e.target.files[0]));
fileInput.addEventListener("change",   (e) => loadImage(e.target.files[0]));

// Also allow clicking the preview area to pick a new image
document.getElementById("previewArea").addEventListener("click", () => {
  if (selectedFile) fileInput.click();
});

identifyBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  await identify(selectedFile);
});

resetBtn.addEventListener("click", () => {
  selectedFile = null;
  preview.hidden = true;
  preview.src = "";
  placeholder.hidden = false;
  identifyBtn.hidden = true;
  resultsSection.hidden = true;
  resultsContent.innerHTML = "";
  cameraInput.value = "";
  fileInput.value = "";
});

async function identify(file) {
  identifyBtn.disabled = true;
  resultsSection.hidden = false;
  resultsContent.innerHTML = "";
  spinner.hidden = false;

  try {
    const base64 = await toBase64(file);
    // Strip the "data:<mediaType>;base64," prefix
    const [header, data] = base64.split(",");
    const mediaType = header.replace("data:", "").replace(";base64", "");

    const response = await fetch("/api/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: data, mediaType }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let started = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete last line

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") break;

        try {
          const parsed = JSON.parse(payload);
          if (parsed.error) {
            throw new Error(parsed.error);
          }
          if (parsed.text) {
            if (!started) {
              spinner.hidden = true;
              started = true;
            }
            appendText(parsed.text);
          }
        } catch (parseErr) {
          if (parseErr.message !== "Unexpected end of JSON input") throw parseErr;
        }
      }
    }
  } catch (err) {
    spinner.hidden = true;
    resultsContent.innerHTML = `<span style="color:#c0392b">⚠️ ${err.message}</span>`;
  } finally {
    identifyBtn.disabled = false;
    spinner.hidden = true;
  }
}

function appendText(text) {
  // Simple markdown-ish rendering: **bold**
  const node = document.createTextNode(text);
  resultsContent.appendChild(node);
  // Re-render the whole content with bold support after each chunk
  const raw = resultsContent.textContent;
  resultsContent.innerHTML = raw.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Register service worker for PWA offline support
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
