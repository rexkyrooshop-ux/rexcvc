const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function isAllowedUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);

    if (url.protocol !== "https:") return false;

    const host = url.hostname.toLowerCase();

    return (
      host === "tiktok.com" ||
      host.endsWith(".tiktok.com") ||
      host === "instagram.com" ||
      host.endsWith(".instagram.com") ||
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtu.be"
    );
  } catch {
    return false;
  }
}

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const process = spawn("yt-dlp", args);

    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("error", reject);

    process.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || "yt-dlp gagal."));
      }
    });
  });
}

// Cek link + ambil informasi video
app.post("/api/info", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || !isAllowedUrl(url)) {
      return res.status(400).json({
        error: "Link tidak didukung."
      });
    }

    const output = await runYtDlp([
      "--dump-single-json",
      "--no-download",
      "--no-playlist",
      "--js-runtimes",
      "node",
      url
    ]);

    const data = JSON.parse(output);

    res.json({
      success: true,
      title: data.title || "Video",
      thumbnail: data.thumbnail || "",
      duration: data.duration || 0,
      uploader: data.uploader || "",
      webpage_url: data.webpage_url || url
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Video tidak dapat diproses.",
      detail: error.message
    });
  }
});

// Download MP4
app.get("/api/download", async (req, res) => {
  const url = req.query.url;

  if (!url || !isAllowedUrl(url)) {
    return res.status(400).send("Link tidak didukung.");
  }

  const id = crypto.randomBytes(12).toString("hex");
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "rexcvc-")
  );

  const outputTemplate = path.join(
    tempDir,
    `${id}.%(ext)s`
  );

  try {
    await runYtDlp([
      "--no-playlist",
      "--js-runtimes",
      "node",
      "-f",
      "bv*+ba/b",
      "--merge-output-format",
      "mp4",
      "-o",
      outputTemplate,
      url
    ]);

    const files = fs
      .readdirSync(tempDir)
      .filter((file) => file.endsWith(".mp4"));

    if (!files.length) {
      throw new Error("File MP4 tidak ditemukan.");
    }

    const filePath = path.join(tempDir, files[0]);

    res.download(
      filePath,
      "rexcvc-video.mp4",
      (error) => {
        try {
          fs.rmSync(tempDir, {
            recursive: true,
            force: true
          });
        } catch {}

        if (error) {
          console.error(error);
        }
      }
    );
  } catch (error) {
    console.error(error);

    try {
      fs.rmSync(tempDir, {
        recursive: true,
        force: true
      });
    } catch {}

    res.status(500).send(
      "Download gagal: " + error.message
    );
  }
});

app.get("/", (req, res) => {
  res.json({
    app: "REXCVC Downloader",
    status: "online"
  });
});

app.listen(PORT, () => {
  console.log(`REXCVC backend running on port ${PORT}`);
});