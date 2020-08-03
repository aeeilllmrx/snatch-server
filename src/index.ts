import express from "express"
import fs from "fs"
import { createServer } from "http"
import socketIO from "socket.io"
import Knex from "knex"

const app = express()
const http = createServer(app)
const io = socketIO(http)
const port = process.env.PORT || 5000

/* ---------- Routes ------------------- */
app.use("*", (req, res, next) => {
  res.header(
    "Access-Control-Allow-Origin",
    "https://snatch-328e83.netlify.app/"
  )
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, X-Auth-Token, Accept"
  )
  res.header("Access-Control-Allow-Credentials", "true")
  next()
})

app.listen(port, () => {
  console.log("listening on *:" + port)
})

app.get("/get_wordlist", (req, res) => {
  const words = fs.readFileSync("./sowpods.txt", "utf8").split("\n")
  res.send({ data: words })
})

/* ----------Postgres connection logic--------- */
const prod = true

let pg = prod
  ? Knex({
      client: "pg",
      connection: process.env.DATABASE_URL + "?ssl: true"
    })
  : Knex({
      client: "pg",
      connection: {
        host: "127.0.0.1",
        user: "postgres",
        password: "postgres",
        database: "snatch"
      }
    })

async function create(room) {
  try {
    await pg("game").insert({ id: room })
  } catch (e) {
    console.log(e.stack)
  }
}

async function getData(room) {
  let response = await pg("game")
    .select("*")
    .where({ id: room })
    .then((rows) => rows[0])
    .catch((err) => {
      console.log(err)
      throw err
    })
  return response
}

async function flip(data) {
  await pg("game")
    .where("id", "=", data.room)
    .update({ squares: Object.values(data.squares) })
    .catch((err) => {
      console.log(err)
      throw err
    })
}

async function snatch(data) {
  let squares = Object.values(data.squares)
    .map((s) => JSON.stringify(s))
    .join(",")

  await pg("game")
    .where("id", "=", data.room)
    .update({
      squares: squares,
      p1words: data.p1words.map((s) => JSON.stringify(s)).join(","),
      p2words: data.p2words.map((s) => JSON.stringify(s)).join(",")
    })
    .catch((err) => {
      console.log(err)
      throw err
    })
}

async function reset(room) {
  await pg("game")
    .where("id", "=", room)
    .update({ squares: {}, p1words: [], p2words: [], room: room })
}

/* ------------------------------------------- */

io.on("connection", (socket) => {
  socket.on("join-send", function (data) {
    socket.join(data.room)
  })

  socket.on("get-state-send", async (data) => {
    const room = data.room
    await create(room)
    const rows = await getData(room)
    io.sockets.in(room).emit("client-connect-receive", rows)
  })

  socket.on("flip-send", (data) => {
    flip(data)
    io.sockets.in(data.room).emit("flip-receive", data)
  })

  socket.on("snatch-send", (data) => {
    snatch(data)
    io.sockets.in(data.room).emit("snatch-receive", data)
  })

  socket.on("reset-send", (room) => {
    reset(room)
    io.sockets.in(room).emit("reset-receive")
  })
})
