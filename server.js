// Recipe Book - recipes are saved in the browser. When you press the speaker button, QVAC turns the
// text into speech on YOUR machine. Open http://localhost:3007 after starting.

import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadModel, textToSpeech, TTS_MINI_V1_EN_PARLER_TTS_Q8_0 } from "@qvac/sdk";

const PORT = 3007;
const MAX_CHARS = 500;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Step 1: load the text-to-speech model (a big download the first time, then cached) ----
let modelId = null;
const status = { ready: false, message: "Starting...", percent: null, error: null };

async function startModel() {
  try {
    status.message = "Loading the voice model (first run downloads it, this can take a while)...";
    modelId = await loadModel({
      modelSrc: TTS_MINI_V1_EN_PARLER_TTS_Q8_0,
      modelType: "tts",
      modelConfig: { ttsEngine: "parler", voice: "Laura", seed: 42, topK: 1 },
      onProgress: (p) => {
        const value = typeof p === "number" ? p : p?.percentage;
        if (typeof value === "number") status.percent = Math.round(value);
      },
    });
    status.ready = true;
    status.message = "Voice ready";
    console.log("Model loaded. Open http://localhost:" + PORT);
  } catch (err) {
    status.error = String(err?.message || err);
    console.error("Could not load model:", err);
  }
}

// ---- Step 2: the AI gives us raw sound numbers. Wrap them in a WAV header so a browser can play them. ----
function pcmToWav(pcm, sampleRate) {
  let data;
  if (Buffer.isBuffer(pcm) || pcm instanceof Uint8Array) {
    data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength); // already bytes
  } else {
    const nums = Array.from(pcm);
    const max = nums.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    const scale = max <= 1.0001 ? 32767 : 1; // handle decimals between -1 and 1 too
    data = Buffer.from(Int16Array.from(nums, (v) => Math.max(-32768, Math.min(32767, Math.round(v * scale)))).buffer);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8); header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// The voice can only speak one sentence job at a time, so we line requests up
let chain = Promise.resolve();
function enqueue(job) { const p = chain.then(job); chain = p.catch(() => {}); return p; }

// ---- Step 3: a small web server ----
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 5000) { reject(new Error("Too big")); req.destroy(); } });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(await readFile(path.join(__dirname, "public", "index.html")));
  }
  if (req.method === "GET" && req.url === "/api/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(status));
  }

  if (req.method === "POST" && req.url === "/api/speak") {
    if (!status.ready) { res.writeHead(503); return res.end("Voice is not ready yet."); }
    try {
      const { text = "" } = JSON.parse(await readBody(req));
      const clean = String(text).replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
      if (!clean) { res.writeHead(400); return res.end("No text."); }

      const wav = await enqueue(async () => {
        // This is the QVAC call that turns text into speech, on-device
        const result = textToSpeech({ modelId, text: clean, inputType: "text", stream: false });
        const pcm = await result.buffer;
        const sampleRate = await result.sampleRate;
        return pcmToWav(pcm, sampleRate);
      });

      res.writeHead(200, { "Content-Type": "audio/wav", "Content-Length": wav.length });
      return res.end(wav);
    } catch (err) {
      console.error(err);
      res.writeHead(500);
      return res.end("Something went wrong.");
    }
  }

  res.writeHead(404);
  res.end("Not found");
});

// "127.0.0.1" means only YOUR computer can reach this app
server.listen(PORT, "127.0.0.1", () => console.log("Server running at http://localhost:" + PORT));
startModel();
