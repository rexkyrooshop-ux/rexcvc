const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;

const APP_NAME = "Rexcvc Downloader";
const VERSION = "6.0.0";

/*
==================================================
CORS
==================================================
*/

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Accept",
      "Origin"
    ],
    exposedHeaders: [
      "Content-Length",
      "Content-Disposition"
    ]
  })
);

/*
==================================================
BODY PARSER
==================================================
*/

app.use(
  express.json({
    limit: "1mb"
  })
);

/*
==================================================
ALLOWED HOSTS
==================================================
*/

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
  "www.instagram.com"
];

/*
==================================================
URL VALIDATION
==================================================
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
==================================================
RUN COMMAND
==================================================
*/

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        timeout: options.timeout || 15 * 60 * 1000,
        maxBuffer: 200 * 1024 * 1024,

        env: {
          ...process.env,
          HOME: process.env.HOME || os.tmpdir()
        }
      },
      (error, stdout, stderr) => {
        if (error) {
          const message =
            stderr?.trim() ||
            stdout?.trim() ||
            error.message ||
            "Command gagal.";

          console.error("\n==============================");
          console.error("COMMAND ERROR");
          console.error("COMMAND:", command);
          console.error("ARGS:", args.join(" "));
          console.error("ERROR:", message);
          console.error("==============================\n");

          reject(
            new Error(message)
          );

          return;
        }

        resolve({
          stdout: stdout || "",
          stderr: stderr || ""
        });
      }
    );
  });
}

/*
==================================================
YT-DLP
==================================================
*/

function runYtDlp(args, options = {}) {
  return runCommand(
    "yt-dlp",
    args,
    options
  );
}

/*
==================================================
ROOT
==================================================
*/

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: APP_NAME,
    version: VERSION
  });
});

/*
==================================================
HEALTH
==================================================
*/

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: APP_NAME,
    version: VERSION
  });
});

/*
==================================================
SYSTEM TEST
==================================================
*/

app.get("/api/test", async (req, res) => {
  const result = {
    status: "ok",
    yt_dlp: null,
    node: null,
    ffmpeg: null
  };

  try {
    const yt =
      await runCommand(
        "yt-dlp",
        ["--version"]
      );

    result.yt_dlp =
      yt.stdout.trim();
  } catch (error) {
    result.status = "error";
    result.yt_dlp =
      error.message;
  }

  try {
    const node =
      await runCommand(
        "node",
        ["--version"]
      );

    result.node =
      node.stdout.trim();
  } catch (error) {
    result.status = "error";
    result.node =
      error.message;
  }

  try {
    const ffmpeg =
      await runCommand(
        "ffmpeg",
        ["-version"]
      );

    const firstLine =
      ffmpeg.stdout
        .split("\n")[0]
        .trim();

    result.ffmpeg =
      firstLine;
  } catch (error) {
    result.status = "error";
    result.ffmpeg =
      error.message;
  }

  res.json(result);
});

/*
==================================================
VIDEO INFO
==================================================
*/

async function getVideoInfo(url) {
  const result =
    await runYtDlp([
      "--dump-single-json",
      "--no-download",
      "--no-playlist",

      "--js-runtimes",
      "node",

      "--remote-components",
      "ejs:npm",

      url
    ]);

  return JSON.parse(
    result.stdout
  );
}

/*
==================================================
FORMAT INFO
==================================================
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
      null
  };
}

/*
==================================================
GET /api/info
==================================================
*/

app.get(
  "/api/info",
  async (req, res) => {
    try {
      const url =
        typeof req.query.url === "string"
          ? req.query.url.trim()
          : "";

      if (!url) {
        return res.status(400).json({
          status: "error",
          error:
            "Link video belum dimasukkan."
        });
      }

      if (!isAllowedUrl(url)) {
        return res.status(400).json({
          status: "error",
          error:
            "URL tidak valid atau platform tidak didukung."
        });
      }

      console.log(
        "\n================================="
      );

      console.log(
        "INFO REQUEST"
      );

      console.log(url);

      console.log(
        "=================================\n"
      );

      const info =
        await getVideoInfo(url);

      return res.json(
        formatVideoInfo(info)
      );

    } catch (error) {
      console.error(
        "INFO ERROR:",
        error
      );

      return res.status(500).json({
        status: "error",
        error:
          error.message ||
          "Gagal mengambil informasi video."
      });
    }
  }
);

/*
==================================================
POST /api/info
==================================================
*/

app.post(
  "/api/info",
  async (req, res) => {
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
            "Link video belum dimasukkan."
        });
      }

      if (!isAllowedUrl(url)) {
        return res.status(400).json({
          status: "error",
          error:
            "URL tidak valid atau platform tidak didukung."
        });
      }

      const info =
        await getVideoInfo(url);

      return res.json(
        formatVideoInfo(info)
      );

    } catch (error) {
      console.error(
        "POST INFO ERROR:",
        error
      );

      return res.status(500).json({
        status: "error",
        error:
          error.message ||
          "Gagal mengambil informasi video."
      });
    }
  }
);

/*
==================================================
DOWNLOAD
==================================================
*/

app.get(
  "/api/download",
  async (req, res) => {

    let tempDir = null;
    let videoPath = null;

    try {

      const url =
        typeof req.query.url === "string"
          ? req.query.url.trim()
          : "";

      /*
      ------------------------------------------
      VALIDASI URL
      ------------------------------------------
      */

      if (!url) {
        return res.status(400).json({
          status: "error",
          error:
            "Link video belum dimasukkan."
        });
      }

      if (!isAllowedUrl(url)) {
        return res.status(400).json({
          status: "error",
          error:
            "URL tidak valid atau platform tidak didukung."
        });
      }

      console.log(
        "\n================================="
      );

      console.log(
        "DOWNLOAD REQUEST"
      );

      console.log(url);

      console.log(
        "=================================\n"
      );

      /*
      ------------------------------------------
      TEMP DIRECTORY
      ------------------------------------------
      */

      const id =
        crypto
          .randomBytes(12)
          .toString("hex");

      tempDir =
        path.join(
          os.tmpdir(),
          `rexcvc-${id}`
        );

      fs.mkdirSync(
        tempDir,
        {
          recursive: true
        }
      );

      /*
      ------------------------------------------
      OUTPUT
      ------------------------------------------
      */

      const outputTemplate =
        path.join(
          tempDir,
          "video.%(ext)s"
        );

      /*
      ------------------------------------------
      DOWNLOAD YT-DLP
      ------------------------------------------
      */

      await runYtDlp([
        "--no-playlist",

        "--newline",

        "--js-runtimes",
        "node",

        "--remote-components",
        "ejs:npm",

        /*
        Prioritaskan MP4.
        Kalau tidak tersedia, gunakan format
        terbaik yang tersedia.
        */

        "-f",
        "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b",

        "--merge-output-format",
        "mp4",

        /*
        Nama file aman
        */

        "--restrict-filenames",

        /*
        Output
        */

        "-o",
        outputTemplate,

        url

      ], {
        timeout:
          15 * 60 * 1000
      });

      /*
      ------------------------------------------
      CARI FILE
      ------------------------------------------
      */

      const files =
        fs.readdirSync(
          tempDir
        );

      console.log(
        "FILES:",
        files
      );

      /*
      Cari MP4 dulu
      */

      let videoFile =
        files.find(
          (file) =>
            file
              .toLowerCase()
              .endsWith(".mp4")
        );

      /*
      Kalau MP4 tidak ada,
      cari video lain
      */

      if (!videoFile) {

        videoFile =
          files.find(
            (file) =>
              /\.(webm|mkv|mov|avi)$/i.test(
                file
              )
          );
      }

      if (!videoFile) {
        throw new Error(
          "yt-dlp selesai tetapi file video tidak ditemukan. Pastikan FFmpeg tersedia di server."
        );
      }

      videoPath =
        path.join(
          tempDir,
          videoFile
        );

      /*
      ------------------------------------------
      FILE CHECK
      ------------------------------------------
      */

      const stat =
        fs.statSync(
          videoPath
        );

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
        videoPath
      );

      console.log(
        "SIZE:",
        stat.size,
        "bytes"
      );

      /*
      ------------------------------------------
      RESPONSE
      ------------------------------------------
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
        "no-store, no-cache, must-revalidate"
      );

      /*
      ------------------------------------------
      STREAM
      ------------------------------------------
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
                "Gagal mengirim file video."
            });
          }

        }
      );

      stream.on(
        "end",
        () => {

          console.log(
            "DOWNLOAD FINISHED"
          );

          cleanup();

        }
      );

      stream.pipe(res);

      /*
      ------------------------------------------
      CLEANUP
      ------------------------------------------
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
                force: true
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
        "\n================================="
      );

      console.error(
        "DOWNLOAD ERROR"
      );

      console.error(
        error
      );

      console.error(
        "=================================\n"
      );

      /*
      ------------------------------------------
      CLEANUP
      ------------------------------------------
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
              force: true
            }
          );

        } catch {}

      }

      /*
      ------------------------------------------
      ERROR RESPONSE
      ------------------------------------------
      */

      if (!res.headersSent) {

        return res.status(500).json({
          status: "error",
          error:
            error.message ||
            "Gagal mengunduh video."
        });

      }

    }

  }
);

/*
==================================================
404
==================================================
*/

app.use(
  (req, res) => {

    res.status(404).json({
      status: "error",
      error:
        "Endpoint tidak ditemukan."
    });

  }
);

/*
==================================================
START SERVER
==================================================
*/

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "\n================================="
    );

    console.log(
      "REXCVC DOWNLOADER SERVER"
    );

    console.log(
      "VERSION:",
      VERSION
    );

    console.log(
      "PORT:",
      PORT
    );

    console.log(
      "=================================\n"
    );

  }
);