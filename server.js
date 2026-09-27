const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "1mb" }));

const ALLOWED_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",

  "tiktok.com",
  "www.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",

  "instagram.com",
  "www.instagram.com",
];

function isAllowedUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    return ALLOWED_HOSTS.some(
      (host) =>
        hostname === host ||
        hostname.endsWith("." + host)
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
        timeout: 10 * 60 * 1000,
        maxBuffer: 100 * 1024 * 1024,
        env: {
          ...process.env,
          HOME: process.env.HOME || "/tmp",
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error("=================================");
          console.error("YT-DLP ERROR");
          console.error(stderr || error.message);
          console.error("=================================");

          reject(
            new Error(
              stderr ||
                error.message ||
                "yt-dlp gagal."
            )
          );

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
    service: "Rexcvc Downloader",
    version: "4.0.0",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Rexcvc Downloader",
  });
});

app.get("/api/test", async (req, res) => {
  try {
    const output = await runYtDlp([
      "--version",
    ]);

    res.json({
      status: "ok",
      yt_dlp: output.trim(),
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
});

async function getVideoInfo(url) {
  const output = await runYtDlp([
    "--dump-single-json",
    "--no-download",
    "--no-playlist",
    "--no-warnings",
    "--js-runtimes",
    "node",
    url,
  ]);

  return JSON.parse(output);
}

app.post("/api/info", async (req, res) => {
  try {
    const url =
      req.body &&
      typeof req.body.url === "string"
        ? req.body.url.trim()
        : "";

    if (!url) {
      return res.status(400).json({
        error: "Link video belum dimasukkan.",
      });
    }

    if (!isAllowedUrl(url)) {
      return res.status(400).json({
        error:
          "URL tidak valid atau platform tidak didukung.",
      });
    }

    console.log("INFO REQUEST:", url);

    const info = await getVideoInfo(url);

    return res.json({
      status: "ok",

      title:
        info.title ||
        "Rexcvc Video",

      thumbnail:
        info.thumbnail ||
        null,

      duration:
        info.duration ||
        null,

      uploader:
        info.uploader ||
        null,

      platform:
        info.extractor_key ||
        info.extractor ||
        null,
    });
  } catch (error) {
    console.error("INFO ERROR:", error);

    return res.status(500).json({
      status: "error",
      error:
        "Gagal mengambil informasi video. Pastikan link publik dan masih aktif.",
    });
  }
});

app.get("/api/download", async (req, res) => {
  let tempDir = null;

  try {
    const url =
      typeof req.query.url === "string"
        ? req.query.url.trim()
        : "";

    if (!url) {
      return res.status(400).json({
        error: "Link video belum dimasukkan.",
      });
    }

    if (!isAllowedUrl(url)) {
      return res.status(400).json({
        error:
          "URL tidak valid atau platform tidak didukung.",
      });
    }

    console.log("=================================");
    console.log("DOWNLOAD REQUEST");
    console.log(url);
    console.log("=================================");

    const id = crypto
      .randomBytes(12)
      .toString("hex");

    tempDir = path.join(
      os.tmpdir(),
      `rexcvc-${id}`
    );

    fs.mkdirSync(tempDir, {
      recursive: true,
    });

    const outputTemplate = path.join(
      tempDir,
      "video.%(ext)s"
    );

    await runYtDlp([
      "--no-playlist",
      "--no-warnings",
      "--js-runtimes",
      "node",

      "-f",
      "bv*+ba/b",

      "--merge-output-format",
      "mp4",

      "--restrict-filenames",

      "-o",
      outputTemplate,

      url,
    ]);

    const files =
      fs.readdirSync(tempDir);

    const videoFile = files.find(
      (file) =>
        file
          .toLowerCase()
          .endsWith(".mp4")
    );

    if (!videoFile) {
      throw new Error(
        "File MP4 tidak ditemukan."
      );
    }

    const videoPath = path.join(
      tempDir,
      videoFile
    );

    const stat =
      fs.statSync(videoPath);

    if (
      !stat.isFile() ||
      stat.size <= 0
    ) {
      throw new Error(
        "File video kosong."
      );
    }

    console.log(
      "VIDEO READY:",
      stat.size,
      "bytes"
    );

    res.status(200);

    res.setHeader(
      "Content-Type",
      "video/mp4"
    );

    res.setHeader(
      "Content-Length",
      stat.size
    );

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Rexcvc-Video.mp4"'
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    const stream =
      fs.createReadStream(
        videoPath
      );

    stream.on(
      "error",
      (error) => {
        console.error(
          "STREAM ERROR:",
          error
        );

        if (!res.headersSent) {
          res.status(500).json({
            error:
              "Gagal mengirim video.",
          });
        }
      }
    );

    stream.on(
      "close",
      () => {
        cleanup();
      }
    );

    stream.pipe(res);

    function cleanup() {
      if (
        tempDir &&
        fs.existsSync(tempDir)
      ) {
        try {
          fs.rmSync(
            tempDir,
            {
              recursive: true,
              force: true,
            }
          );

          tempDir = null;
        } catch (error) {
          console.error(
            "CLEANUP ERROR:",
            error
          );
        }
      }
    }
  } catch (error) {
    console.error(
      "DOWNLOAD ERROR:",
      error
    );

    if (
      tempDir &&
      fs.existsSync(tempDir)
    ) {
      try {
        fs.rmSync(
          tempDir,
          {
            recursive: true,
            force: true,
          }
        );
      } catch {}
    }

    if (!res.headersSent) {
      return res.status(500).json({
        status: "error",
        error:
          "Gagal mengunduh video. Pastikan link video publik dan masih aktif.",
      });
    }
  }
});

app.use((req, res) => {
  res.status(404).json({
    error:
      "Endpoint tidak ditemukan.",
  });
});

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      "================================="
    );

    console.log(
      "REXCVC DOWNLOADER SERVER"
    );

    console.log(
      "PORT:",
      PORT
    );

    console.log(
      "================================="
    );

    console.log(
      `Server running on port ${PORT}`
    );
  }
);