const express = require("express");
const { spawn, execSync } = require("child_process");
const path = require("path");
const os = require("os");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let ffmpegProcess = null;
let streamClients = [];
let currentConfig = null;

// ---------------------------
// Helpers
// ---------------------------
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

function parseV4L2Devices() {
  try {
    const output = execSync("v4l2-ctl --list-devices", { encoding: "utf8" });
    const lines = output.split("\n");

    const devices = [];
    let currentName = null;
    let currentPaths = [];

    function flushCurrent() {
      if (currentName && currentPaths.length > 0) {
        const firstVideo = currentPaths.find(p => p.startsWith("/dev/video"));
        if (firstVideo) {
          devices.push({
            name: currentName.replace(/:$/, "").trim(),
            path: firstVideo.trim()
          });
        }
      }
      currentName = null;
      currentPaths = [];
    }

    for (const rawLine of lines) {
      const line = rawLine.replace(/\r/g, "");
      if (!line.trim()) continue;

      if (!line.startsWith("\t") && !line.startsWith(" ")) {
        flushCurrent();
        currentName = line.trim();
      } else {
        const trimmed = line.trim();
        if (trimmed.startsWith("/dev/video")) {
          currentPaths.push(trimmed);
        }
      }
    }

    flushCurrent();
    return devices;
  } catch (err) {
    console.error("Failed to list V4L2 devices:", err.message);
    return [];
  }
}

function stopFFmpeg() {
  if (ffmpegProcess) {
    ffmpegProcess.kill("SIGTERM");
    ffmpegProcess = null;
  }
  streamClients.forEach(res => {
    try { res.end(); } catch {}
  });
  streamClients = [];
  currentConfig = null;
}

function startFFmpeg({ device, width, height, fps }) {
  stopFFmpeg();

  const args = [
    "-f", "v4l2",
    "-input_format", "mjpeg",
    "-framerate", String(fps),
    "-video_size", `${width}x${height}`,
    "-i", device,
    "-f", "mjpeg",
    "-q:v", "5",
    "-"
  ];

  console.log("Starting ffmpeg:", "ffmpeg", args.join(" "));

  ffmpegProcess = spawn("ffmpeg", args, {
    stdio: ["ignore", "pipe", "pipe"]
  });

  currentConfig = { device, width, height, fps };

  ffmpegProcess.stdout.on("data", chunk => {
    // Broadcast raw MJPEG bytes to all connected clients
    for (const res of streamClients) {
      try {
        res.write(chunk);
      } catch {}
    }
  });

  ffmpegProcess.stderr.on("data", data => {
    const text = data.toString();
    // Optional: comment this out if too noisy
    console.log("[ffmpeg]", text.trim());
  });

  ffmpegProcess.on("close", code => {
    console.log("ffmpeg exited with code", code);
    ffmpegProcess = null;
    currentConfig = null;
    streamClients.forEach(res => {
      try { res.end(); } catch {}
    });
    streamClients = [];
  });
}

// ---------------------------
// API routes
// ---------------------------
app.get("/api/cameras", (req, res) => {
  const devices = parseV4L2Devices();
  res.json({
    ok: true,
    cameras: devices,
    ip: getLocalIP(),
    port: PORT
  });
});

app.get("/api/status", (req, res) => {
  res.json({
    ok: true,
    running: !!ffmpegProcess,
    config: currentConfig,
    ip: getLocalIP(),
    port: PORT
  });
});

app.post("/api/start", (req, res) => {
  const { device, width, height, fps } = req.body || {};

  if (!device) {
    return res.status(400).json({ ok: false, error: "Missing device" });
  }

  const w = parseInt(width, 10) || 1280;
  const h = parseInt(height, 10) || 720;
  const f = parseInt(fps, 10) || 15;

  try {
    startFFmpeg({
      device,
      width: w,
      height: h,
      fps: f
    });

    return res.json({
      ok: true,
      message: "Stream started",
      config: { device, width: w, height: h, fps: f }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      ok: false,
      error: "Failed to start stream"
    });
  }
});

app.post("/api/stop", (req, res) => {
  stopFFmpeg();
  res.json({ ok: true, message: "Stream stopped" });
});

// MJPEG stream endpoint
app.get("/stream", (req, res) => {
  res.writeHead(200, {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "Connection": "close",
    "Content-Type": "multipart/x-mixed-replace; boundary=frame"
  });

  streamClients.push(res);

  req.on("close", () => {
    streamClients = streamClients.filter(r => r !== res);
  });
});

// ---------------------------
// Start server
// ---------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`cam_live running at http://${getLocalIP()}:${PORT}`);
  console.log(`Open it on Omarchy or Windows browser`);
});