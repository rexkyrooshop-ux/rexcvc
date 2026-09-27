const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;

/* =========================================
   MIDDLEWARE
========================================= */

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "1mb" }));

/* =========================================
   PLATFORM YANG DIDUKUNG
========================================= */

const ALLOWED_HOSTS = [
  // YouTube
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",

  // TikTok
  "tiktok.com",
  "www.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",

  // Instagram
  "instagram.com",
  "www.instagram.com",
];

/* =========================================
   CEK URL
========================================= */

function isAllowedUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    return ALLOWED_HOSTS.some((host) => {
      return (
        hostname === host ||
        hostname.endsWith("." + host)
      );
    });
  } catch {
    return false;
  }
}

/* =========================================
   JALANKAN YT-DLP
========================================= */

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    execFile(
      "yt-dlp",
      args,
      {
        timeout: 10 * 60 * 1000,
        maxBuffer: 100 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error("YT-DLP ERROR:");
          console.error(stderr || error.message);

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

/* =========================================
   ROOT
========================================= */

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Rexcvc Downloader",
    version: "3.0.0",
  });
});

/* =========================================
   HEALTH CHECK
========================================= */

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
  });
});

/* =========================================
   AMBIL INFO VIDEO
========================================= */

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

/* =========================================
   API INFO
========================================= */

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

    res.json({
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
    console.error(
      "INFO ERROR:",
      error
    );

    res.status(500).json({
      error:
        "Gagal mengambil informasi video. Pastikan link masih aktif dan video dapat diakses publik.",
    });
  }
});

/* =========================================
   API DOWNLOAD
========================================= */

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

    console.log(
      "DOWNLOAD REQUEST:",
      url
    );

    /* =====================================
       BUAT FOLDER TEMPORARY
    ===================================== */

    const randomId =
      crypto
        .randomBytes(12)
        .toString("hex");

    tempDir = path.join(
      os.tmpdir(),
      "rexcvc-" + randomId
    );

    fs.mkdirSync(tempDir, {
      recursive: true,
    });

    const outputTemplate = path.join(
      tempDir,
      "video.%(ext)s"
    );

    /* =====================================
       DOWNLOAD DENGAN YT-DLP
    ===================================== */

    await runYtDlp([
      "--no-playlist",

      "--no-warnings",

      "--js-runtimes",
      "node",

      "-f",
      "bv*+ba/b",

      "--merge-output-format",
      "mp4",

      "-o",
      outputTemplate,

      url,
    ]);

    /* =====================================
       CARI FILE MP4
    ===================================== */

    const files =
      fs.readdirSync(tempDir);

    const videoFile =
      files.find((file) =>
        file
          .toLowerCase()
          .endsWith(".mp4")
      );

    if (!videoFile) {
      throw new Error(
        "File MP4 tidak ditemukan setelah proses download."
      );
    }

    const videoPath =
      path.join(
        tempDir,
        videoFile
      );

    /* =====================================
       CEK FILE
    ===================================== */

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

    /* =====================================
       HEADER DOWNLOAD
    ===================================== */

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

    /* =====================================
       KIRIM FILE
    ===================================== */

    const stream =
      fs.createReadStream(
        videoPath
      );

    stream.on(
      "error",
      (error) => {
        console.error(
          "FILE STREAM ERROR:",
          error
        );

        if (!res.headersSent) {
          res.status(500).json({
            error:
              "Gagal mengirim file video.",
          });
        }
      }
    );

    stream.on(
      "close",
      () => {
        cleanupTemp();
      }
    );

    stream.pipe(res);

    /* =====================================
       CLEANUP
    ===================================== */

    function cleanupTemp() {
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
        } catch (cleanupError) {
          console.error(
            "CLEANUP ERROR:",
            cleanupError
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
      res.status(500).json({
        error:
          "Gagal mengunduh video. Pastikan link video publik dan masih aktif.",
      });
    }
  }
});

/* =========================================
   404
========================================= */

app.use((req, res) => {
  res.status(404).json({
    error:
      "Endpoint tidak ditemukan.",
  });
});

/* =========================================
   ERROR HANDLER
========================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "SERVER ERROR:",
      error
    );

    if (
      res.headersSent
    ) {
      return next(error);
    }

    res.status(500).json({
      error:
        "Terjadi kesalahan pada server.",
    });
  }
);

/* =========================================
   START SERVER
========================================= */

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
  }
);