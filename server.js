const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "*"
}));

app.use(express.json());

/*
==================================================
TIKTOK ONLY
==================================================
*/

function isTikTokUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      return false;
    }

    const host = url.hostname.toLowerCase();

    return (
      host === "tiktok.com" ||
      host === "www.tiktok.com" ||
      host === "vm.tiktok.com" ||
      host === "vt.tiktok.com" ||
      host.endsWith(".tiktok.com")
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

function run(command, args, timeout = 15 * 60 * 1000) {

  return new Promise((resolve, reject) => {

    console.log("");
    console.log("=================================");
    console.log("RUN COMMAND");
    console.log(command);
    console.log(args.join(" "));
    console.log("=================================");

    execFile(
      command,
      args,
      {
        timeout,
        maxBuffer: 200 * 1024 * 1024,

        env: {
          ...process.env,
          HOME: process.env.HOME || os.tmpdir()
        }
      },

      (error, stdout, stderr) => {

        if (error) {

          console.error("");
          console.error("=================================");
          console.error("COMMAND FAILED");
          console.error("ERROR:");
          console.error(stderr || error.message);
          console.error("=================================");

          reject(
            new Error(
              stderr?.trim() ||
              error.message ||
              "Command gagal."
            )
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
ROOT
==================================================
*/

app.get("/", (req, res) => {

  res.json({
    status: "ok",
    service: "Rexcvc TikTok Downloader",
    version: "1.0.0"
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
    service: "Rexcvc TikTok Downloader",
    version: "1.0.0"
  });

});

/*
==================================================
TEST YT-DLP
==================================================
*/

app.get("/api/test", async (req, res) => {

  const result = {
    status: "ok",
    yt_dlp: null,
    ffmpeg: null
  };

  /*
  ------------------------------------------
  TEST YT-DLP
  ------------------------------------------
  */

  try {

    const yt =
      await run(
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

  /*
  ------------------------------------------
  TEST FFMPEG
  ------------------------------------------
  */

  try {

    const ffmpeg =
      await run(
        "ffmpeg",
        ["-version"]
      );

    result.ffmpeg =
      ffmpeg.stdout
        .split("\n")[0]
        .trim();

  } catch (error) {

    result.status = "error";

    result.ffmpeg =
      error.message;

  }

  res.json(result);

});

/*
==================================================
TIKTOK INFO
==================================================
*/

app.get("/api/info", async (req, res) => {

  try {

    const url =
      typeof req.query.url === "string"
        ? req.query.url.trim()
        : "";

    /*
    ------------------------------------------
    VALIDATE
    ------------------------------------------
    */

    if (!url) {

      return res.status(400).json({
        status: "error",
        error: "Link TikTok belum dimasukkan."
      });

    }

    if (!isTikTokUrl(url)) {

      return res.status(400).json({
        status: "error",
        error: "Link yang dimasukkan bukan link TikTok."
      });

    }

    console.log("");
    console.log("=================================");
    console.log("TIKTOK INFO REQUEST");
    console.log(url);
    console.log("=================================");

    /*
    ------------------------------------------
    GET INFO
    ------------------------------------------
    */

    const result =
      await run(
        "yt-dlp",
        [
          "--dump-single-json",
          "--no-download",
          "--no-playlist",
          "--no-warnings",

          url
        ]
      );

    const info =
      JSON.parse(
        result.stdout
      );

    /*
    ------------------------------------------
    RESPONSE
    ------------------------------------------
    */

    return res.json({

      status: "ok",

      title:
        info.title ||
        "TikTok Video",

      thumbnail:
        info.thumbnail ||
        null,

      uploader:
        info.uploader ||
        info.uploader_id ||
        null,

      duration:
        info.duration ||
        null,

      platform: "TikTok"

    });

  } catch (error) {

    console.error(
      "TIKTOK INFO ERROR:",
      error
    );

    return res.status(500).json({

      status: "error",

      error:
        error.message ||
        "Gagal mengambil informasi TikTok."

    });

  }

});

/*
==================================================
TIKTOK DOWNLOAD
==================================================
*/

app.get("/api/download", async (req, res) => {

  let tempDir = null;

  try {

    const url =
      typeof req.query.url === "string"
        ? req.query.url.trim()
        : "";

    /*
    ------------------------------------------
    VALIDATE URL
    ------------------------------------------
    */

    if (!url) {

      return res.status(400).json({
        status: "error",
        error: "Link TikTok belum dimasukkan."
      });

    }

    if (!isTikTokUrl(url)) {

      return res.status(400).json({
        status: "error",
        error: "Link yang dimasukkan bukan link TikTok."
      });

    }

    console.log("");
    console.log("=================================");
    console.log("TIKTOK DOWNLOAD");
    console.log(url);
    console.log("=================================");

    /*
    ------------------------------------------
    TEMP FOLDER
    ------------------------------------------
    */

    const id =
      crypto
        .randomBytes(12)
        .toString("hex");

    tempDir =
      path.join(
        os.tmpdir(),
        "rexcvc-" + id
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

    const output =
      path.join(
        tempDir,
        "video.%(ext)s"
      );

    /*
    ------------------------------------------
    DOWNLOAD
    ------------------------------------------
    */

    await run(
      "yt-dlp",
      [
        "--no-playlist",
        "--no-warnings",

        /*
        TikTok biasanya cukup dengan
        format terbaik yang tersedia.
        */

        "-f",
        "best",

        /*
        Output
        */

        "-o",
        output,

        url

      ]
    );

    /*
    ------------------------------------------
    FIND VIDEO
    ------------------------------------------
    */

    const files =
      fs.readdirSync(
        tempDir
      );

    console.log(
      "DOWNLOADED FILES:",
      files
    );

    const videoFile =
      files.find(
        file =>
          /\.(mp4|webm|mkv|mov)$/i.test(
            file
          )
      );

    if (!videoFile) {

      throw new Error(
        "Video berhasil diproses tetapi file video tidak ditemukan."
      );

    }

    const videoPath =
      path.join(
        tempDir,
        videoFile
      );

    /*
    ------------------------------------------
    CHECK FILE
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

    console.log("");
    console.log("=================================");
    console.log("VIDEO READY");
    console.log("FILE:", videoPath);
    console.log("SIZE:", stat.size);
    console.log("=================================");

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
      'attachment; filename="Rexcvc-TikTok.mp4"'
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
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
      error => {

        console.error(
          "STREAM ERROR:",
          error
        );

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

    console.error("");
    console.error("=================================");
    console.error("TIKTOK DOWNLOAD ERROR");
    console.error(error);
    console.error("=================================");

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
          "Gagal mengunduh TikTok."

      });

    }

  }

});

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
START
==================================================
*/

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log("");
    console.log("=================================");
    console.log("REXCVC TIKTOK DOWNLOADER");
    console.log("VERSION: 1.0.0");
    console.log("PORT:", PORT);
    console.log("=================================");
    console.log("");

  }
);