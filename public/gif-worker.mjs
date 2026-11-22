import { normalizeGif } from "./gif-image.mjs";

self.addEventListener("message", ({ data }) => {
  try {
    self.postMessage({ sprite: normalizeGif(data) });
  } catch (error) {
    const message = /[가-힣]/.test(error.message) ? error.message : "GIF 파일을 읽을 수 없어요.";
    self.postMessage({ error: message });
  }
});
