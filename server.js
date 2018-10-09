const express = require("express");
const next = require("next");
const { join } = require("path");
const request = require("request");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();

  server.get("/auth/sign-in", (req, res) => {
    request.post(
      "https://api.twitter.com/oauth/request_token",
      {
        headers: {
          Accept: "*/*"
        },
        oauth: {
          callback: "http://localhost:3000/callback"
        }
      },
      (err, response) => {
        if (err) {
          return res.send(err);
        }
        res.send(response);
      }
    );
  });

  server.get("*", (req, res) => {
    return handle(req, res);
  });

  server.listen(3000, err => {
    if (err) throw err;
    console.log("> Ready on http://localhost:3000");
  });
});
