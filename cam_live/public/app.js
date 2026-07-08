const cameraSelect = document.getElementById("cameraSelect");
const resolutionSelect = document.getElementById("resolutionSelect");
const fpsSelect = document.getElementById("fpsSelect");
const refreshBtn = document.getElementById("refreshBtn");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusBox = document.getElementById("statusBox");
const viewerUrl = document.getElementById("viewerUrl");
const streamImg = document.getElementById("streamImg");
const placeholder = document.getElementById("placeholder");

let appInfo = {
  ip: location.hostname,
  port: location.port || 3000
};

function setStatus(text) {
  statusBox.textContent = text;
}

function setViewerUrl() {
  viewerUrl.textContent = `http://${appInfo.ip}:${appInfo.port}`;
}

async function loadCameras() {
  setStatus("Loading cameras...");
  try {
    const res = await fetch("/api/cameras");
    const data = await res.json();

    if (!data.ok) {
      setStatus("Failed to load cameras.");
      return;
    }

    appInfo.ip = data.ip;
    appInfo.port = data.port;
    setViewerUrl();

    cameraSelect.innerHTML = "";

    if (!data.cameras || data.cameras.length === 0) {
      setStatus("No cameras found.");
      return;
    }

    data.cameras.forEach((cam, index) => {
      const opt = document.createElement("option");
      opt.value = cam.path;
      opt.textContent = `${cam.name} (${cam.path})`;
      cameraSelect.appendChild(opt);

      if (cam.name.toUpperCase().includes("GENERAL WEBCAM")) {
        cameraSelect.selectedIndex = index;
      }
    });

    setStatus(`Found ${data.cameras.length} camera(s).`);
  } catch (err) {
    console.error(err);
    setStatus("Error loading cameras.");
  }
}

async function loadStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();

    appInfo.ip = data.ip;
    appInfo.port = data.port;
    setViewerUrl();

    if (data.running && data.config) {
      const cfg = data.config;
      setStatus(
        `Running\nDevice: ${cfg.device}\nResolution: ${cfg.width}x${cfg.height}\nFPS: ${cfg.fps}`
      );
      showStream();
    } else {
      setStatus("Idle");
      hideStream();
    }
  } catch (err) {
    console.error(err);
    setStatus("Could not load status.");
  }
}

function showStream() {
  streamImg.src = `/stream?t=${Date.now()}`;
  streamImg.style.display = "block";
  placeholder.style.display = "none";
}

function hideStream() {
  streamImg.removeAttribute("src");
  streamImg.style.display = "none";
  placeholder.style.display = "block";
}

async function startStream() {
  const device = cameraSelect.value;
  if (!device) {
    setStatus("Pick a camera first.");
    return;
  }

  const [width, height] = resolutionSelect.value.split("x").map(Number);
  const fps = parseInt(fpsSelect.value, 10) || 15;

  setStatus("Starting stream...");

  try {
    const res = await fetch("/api/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        device,
        width,
        height,
        fps
      })
    });

    const data = await res.json();

    if (!data.ok) {
      setStatus(data.error || "Failed to start stream.");
      return;
    }

    setStatus(
      `Running\nDevice: ${device}\nResolution: ${width}x${height}\nFPS: ${fps}`
    );
    showStream();
  } catch (err) {
    console.error(err);
    setStatus("Error starting stream.");
  }
}

async function stopStream() {
  try {
    await fetch("/api/stop", { method: "POST" });
    setStatus("Stopped");
    hideStream();
  } catch (err) {
    console.error(err);
    setStatus("Error stopping stream.");
  }
}

refreshBtn.addEventListener("click", loadCameras);
startBtn.addEventListener("click", startStream);
stopBtn.addEventListener("click", stopStream);

loadCameras();
loadStatus();