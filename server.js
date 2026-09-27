const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const ALLOWED_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "m.youtube.com",
  "tiktok.com",
  "www.tiktok.com",
  "vm.tiktok.com",
  "instagram.com",
  "www.instagram.com"
];

function isAllowedUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    return ALLOWED_HOSTS.some(
      host => hostname === host || hostname.endsWith("." + host)
    );
  } catch {
    return false;
  }
}

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    execFile(
      "yt-dlp",
      args,
      {
        maxBuffer: 50 * 1024 * 1024
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }

        resolve(stdout);
      }
    );
  });
}

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Rexcvc Downloader"
  });
});

app.post("/api/info", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || !isAllowedUrl(url)) {
      return res.status(400).json({
        error: "URL tidak valid atau platform tidak didukung."
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

    const info = JSON.parse(output);

    res.json({
      title: info.title || "Rexcvc Video",
      thumbnail: info.thumbnail || null,
      duration: info.duration || null,
      uploader: info.uploader || null
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Gagal mengambil informasi video."
    });
  }
});

app.get("/api/download", async (req, res) => {
  let tempDir = null;

  try {
    const { url } = req.query;

    if (!url || !isAllowedUrl(url)) {
      return res.status(400).json({
        error: "URL tidak valid atau platform tidak didukung."
      });
    }

    const id = crypto.randomBytes(12).toString("hex");

    tempDir = path.join(os.tmpdir(), `rexcvc-${id}`);

    fs.mkdirSync(tempDir, {
      recursive: true
    });

    const outputTemplate = path.join(
      tempDir,
      "rexcvc-video.%(ext)s"
    );

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

    const files = fs.readdirSync(tempDir);

    const videoFile = files.find(file =>
      file.endsWith(".mp4")
    );

    if (!videoFile) {
      throw new Error("File video tidak ditemukan.");
    }

    const fullPath = path.join(tempDir, videoFile);

    res.download(
      fullPath,
      "Rexcvc-Video.mp4",
      error => {
        fs.rmSync(tempDir, {
          recursive: true,
          force: true
        });

        if (error) {
          console.error(error);
        }
      }
    );
  } catch (error) {
    console.error(error);

    if (tempDir) {
      fs.rmSync(tempDir, {
        recursive: true,
        force: true
      });
    }

    res.status(500).json({
      error: "Gagal mengunduh video. Coba link lain."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Rexcvc Downloader berjalan di port ${PORT}`);
});
