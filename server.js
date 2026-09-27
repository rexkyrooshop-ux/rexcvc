const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

/*
========================================
CORS
========================================
*/

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Accept",
    "Origin",
  ],
  exposedHeaders: [
    "Content-Length",
    "Content-Disposition",
  ],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

/*
========================================
BODY PARSER
========================================
*/

app.use(
  express.json({
    limit: "1mb",
  })
);

/*
========================================
ALLOWED PLATFORMS
========================================
*/

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

/*
========================================
URL VALIDATION
========================================
*/

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

/*
========================================
RUN YT-DLP
========================================
*/

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    execFile(
      "yt-dlp",
      args,
      {
        timeout: 10 * 60 * 1000,

        maxBuffer:
          100 * 1024 * 1024,

        env: {
          ...process.env,
          HOME:
            process.env.HOME || "/tmp",
        },
      },

      (error, stdout, stderr) => {
        if (error) {
          console.error(
            "================================="
          );

          console.error(
            "YT-DLP ERROR"
          );

          console.error(
            stderr || error.message
          );

          console.error(
            "================================="
          );

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

/*
========================================
ROOT
========================================
*/

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Rexcvc Downloader",
    version: "5.0.0",
  });
});

/*
========================================
HEALTH CHECK
========================================
*/

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Rexcvc Downloader",
    version: "5.0.0",
  });
});

/*
========================================
API TEST
========================================
*/

app.get("/api/test", async (req, res) => {
  try {
    const output =
      await runYtDlp([
        "--version",
      ]);

    res.json({
      status: "ok",
      yt_dlp: output.trim(),
    });
  } catch (error) {
    console.error(
      "API TEST ERROR:",
      error
    );

    res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
});

/*
========================================
GET VIDEO INFO
========================================
*/

async function getVideoInfo(url) {
  const output =
    await runYtDlp([
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

/*
========================================
FORMAT VIDEO INFO
========================================
*/

function formatVideoInfo(info) {
  return {
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
  };
}

/*
========================================
GET /api/info
========================================

Dipakai oleh APK.

Contoh:

/api/info?url=https%3A%2F%2F...
*/

app.get("/api/info", async (req, res) => {
  try {
    const url =
      typeof req.query.url === "string"
        ? req.query.url.trim()
        : "";

    if (!url) {
      return res.status(400).json({
        status: "error",
        error:
          "Link video belum dimasukkan.",
      });
    }

    if (!isAllowedUrl(url)) {
      return res.status(400).json({
        status: "error",
        error:
          "URL tidak valid atau platform tidak didukung.",
      });
    }

    console.log(
      "================================="
    );

    console.log(
      "INFO GET REQUEST"
    );

    console.log(url);

    console.log(
      "================================="
    );

    const info =
      await getVideoInfo(url);

    return res.json(
      formatVideoInfo(info)
    );
  } catch (error) {
    console.error(
      "INFO GET ERROR:",
      error
    );

    return res.status(500).json({
      status: "error",
      error:
        "Gagal mengambil informasi video. Pastikan link publik dan masih aktif.",
    });
  }
});

/*
========================================
POST /api/info
========================================

Tetap dipertahankan sebagai fallback.
*/

app.post("/api/info", async (req, res) => {
  try {
    const url =
      req.body &&
      typeof req.body.url === "string"
        ? req.body.url.trim()
        : "";

    if (!url) {
      return res.status(400).json({
        status: "error",
        error:
          "Link video belum dimasukkan.",
      });
    }

    if (!isAllowedUrl(url)) {
      return res.status(400).json({
        status: "error",
        error:
          "URL tidak valid atau platform tidak didukung.",
      });
    }

    console.log(
      "================================="
    );

    console.log(
      "INFO POST REQUEST"
    );

    console.log(url);

    console.log(
      "================================="
    );

    const info =
      await getVideoInfo(url);

    return res.json(
      formatVideoInfo(info)
    );
  } catch (error) {
    console.error(
      "INFO POST ERROR:",
      error
    );

    return res.status(500).json({
      status: "error",
      error:
        "Gagal mengambil informasi video. Pastikan link publik dan masih aktif.",
    });
  }
});

/*
========================================
DOWNLOAD VIDEO
========================================
*/

app.get(
  "/api/download",
  async (req, res) => {
    let tempDir = null;

    try {
      const url =
        typeof req.query.url === "string"
          ? req.query.url.trim()
          : "";

      if (!url) {
        return res.status(400).json({
          status: "error",
          error:
            "Link video belum dimasukkan.",
        });
      }

      if (!isAllowedUrl(url)) {
        return res.status(400).json({
          status: "error",
          error:
            "URL tidak valid atau platform tidak didukung.",
        });
      }

      console.log(
        "================================="
      );

      console.log(
        "DOWNLOAD REQUEST"
      );

      console.log(url);

      console.log(
        "================================="
      );

      /*
      ========================================
      TEMP DIRECTORY
      ========================================
      */

      const id =
        crypto
          .randomBytes(12)
          .toString("hex");

      tempDir = path.join(
        os.tmpdir(),
        `rexcvc-${id}`
      );

      fs.mkdirSync(tempDir, {
        recursive: true,
      });

      /*
      ========================================
      OUTPUT
      ========================================
      */

      const outputTemplate =
        path.join(
          tempDir,
          "video.%(ext)s"
        );

      /*
      ========================================
      YT-DLP DOWNLOAD
      ========================================
      */

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

      /*
      ========================================
      FIND MP4
      ========================================
      */

      const files =
        fs.readdirSync(tempDir);

      const videoFile =
        files.find(
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

      const videoPath =
        path.join(
          tempDir,
          videoFile
        );

      /*
      ========================================
      CHECK FILE
      ========================================
      */

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

      /*
      ========================================
      RESPONSE HEADERS
      ========================================
      */

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

      /*
      ========================================
      STREAM
      ========================================
      */

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
              status: "error",
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

      /*
      ========================================
      CLEANUP
      ========================================
      */

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

      /*
      Cleanup jika gagal
      */

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

      /*
      Response error
      */

      if (!res.headersSent) {
        return res.status(500).json({
          status: "error",
          error:
            "Gagal mengunduh video. Pastikan link video publik dan masih aktif.",
        });
      }
    }
  }
);

/*
========================================
404
========================================
*/

app.use(
  (req, res) => {
    res.status(404).json({
      status: "error",
      error:
        "Endpoint tidak ditemukan.",
    });
  }
);

/*
========================================
START SERVER
========================================
*/

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
      "VERSION: 5.0.0"
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