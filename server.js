const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT =
  process.env.PORT || 3000;


app.use(
  cors({
    origin: "*",
    methods: [
      "GET",
      "POST",
      "OPTIONS"
    ],
    allowedHeaders: [
      "Content-Type"
    ]
  })
);


app.use(
  express.json({
    limit: "1mb"
  })
);


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


function isAllowedUrl(value) {

  try {

    const url =
      new URL(value);

    if (
      url.protocol !==
      "https:"
    ) {

      return false;

    }

    const hostname =
      url.hostname.toLowerCase();


    return ALLOWED_HOSTS.some(
      host =>
        hostname === host ||
        hostname.endsWith("." + host)
    );

  } catch {

    return false;

  }
}


function runYtDlp(args) {

  return new Promise(
    (resolve, reject) => {

      execFile(
        "yt-dlp",
        args,
        {
          maxBuffer:
            100 * 1024 * 1024,

          timeout:
            10 * 60 * 1000
        },

        (
          error,
          stdout,
          stderr
        ) => {

          if (error) {

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

    }
  );

}


app.get(
  "/",
  (req, res) => {

    res.json({
      status: "ok",
      service:
        "Rexcvc Downloader",
      version:
        "2.0.0"
    });

  }
);


app.get(
  "/health",
  (req, res) => {

    res.json({
      status: "ok"
    });

  }
);


async function getInfo(url) {

  const output =
    await runYtDlp([

      "--dump-single-json",

      "--no-download",

      "--no-playlist",

      "--no-warnings",

      "--js-runtimes",
      "node",

      url

    ]);


  return JSON.parse(output);

}


app.post(
  "/api/info",
  async (req, res) => {

    try {

      const url =
        req.body &&
        req.body.url;


      if (
        !url ||
        !isAllowedUrl(url)
      ) {

        return res.status(400).json({
          error:
            "URL tidak valid atau platform tidak didukung."
        });

      }


      const info =
        await getInfo(url);


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
          null

      });


    } catch (error) {

      console.error(
        "INFO ERROR:",
        error
      );


      res.status(500).json({

        error:
          "Gagal mengambil informasi video. Pastikan link masih aktif dan video dapat diakses."

      });

    }

  }
);


app.get(
  "/api/download",
  async (req, res) => {

    let tempDir =
      null;


    try {

      const url =
        req.query.url;


      if (
        !url ||
        !isAllowedUrl(url)
      ) {

        return res.status(400).json({
          error:
            "URL tidak valid atau platform tidak didukung."
        });

      }


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


      const outputTemplate =
        path.join(
          tempDir,
          "rexcvc-video.%(ext)s"
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

        "-o",
        outputTemplate,

        url

      ]);


      const files =
        fs.readdirSync(
          tempDir
        );


      const videoFile =
        files.find(
          file =>
            file.toLowerCase()
              .endsWith(".mp4")
        );


      if (!videoFile) {

        throw new Error(
          "File video MP4 tidak ditemukan."
        );

      }


      const fullPath =
        path.join(
          tempDir,
          videoFile
        );


      const stat =
        fs.statSync(
          fullPath
        );


      if (
        !stat.isFile() ||
        stat.size === 0
      ) {

        throw new Error(
          "File video kosong."
        );

      }


      res.setHeader(
        "Content-Type",
        "video/mp4"
      );


      res.setHeader(
        "Content-Disposition",
        'attachment; filename="Rexcvc-Video.mp4"'
      );


      res.setHeader(
        "Content-Length",
        stat.size
      );


      res.download(
        fullPath,
        "Rexcvc-Video.mp4",
        error => {

          if (tempDir) {

            fs.rmSync(
              tempDir,
              {
                recursive: true,
                force: true
              }
            );

          }


          if (error) {

            console.error(
              "DOWNLOAD RESPONSE ERROR:",
              error
            );

          }

        }
      );


    } catch (error) {

      console.error(
        "DOWNLOAD ERROR:",
        error
      );


      if (tempDir) {

        fs.rmSync(
          tempDir,
          {
            recursive: true,
            force: true
          }
        );

      }


      if (!res.headersSent) {

        res.status(500).json({

          error:
            "Gagal mengunduh video. Coba link lain atau pastikan video dapat diakses publik."

        });

      }

    }

  }
);


app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Rexcvc Downloader berjalan di port ${PORT}`
    );

  }
);