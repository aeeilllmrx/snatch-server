"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const knex_1 = __importDefault(require("knex"));
const app = express_1.default();
const socket = require("socket.io"); // must be required apparently
const server = app.listen(5000, function () {
    console.log("listening on *:" + port);
});
const io = socket(server);
const port = process.env.PORT || 5000;
/* ---------- Routes ------------------- */
app.get("/get_wordlist", (req, res) => {
    const words = fs_1.default.readFileSync("./sowpods.txt", "utf8").split("\n");
    res.send({ data: words });
});
/* ----------Postgres connection logic--------- */
const prod = true;
let pg = prod
    ? knex_1.default({
        client: "pg",
        connection: process.env.DATABASE_URL + "?ssl: true"
    })
    : knex_1.default({
        client: "pg",
        connection: {
            host: "127.0.0.1",
            user: "postgres",
            password: "postgres",
            database: "snatch"
        }
    });
function create(room) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield pg("game").insert({ id: room });
        }
        catch (e) {
            console.log(e.stack);
        }
    });
}
function getData(room) {
    return __awaiter(this, void 0, void 0, function* () {
        let response = yield pg("game")
            .select("*")
            .where({ id: room })
            .then((rows) => rows[0])
            .catch((err) => {
            console.log(err);
            throw err;
        });
        return response;
    });
}
function flip(data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield pg("game")
            .where("id", "=", data.room)
            .update({ squares: Object.values(data.squares) })
            .catch((err) => {
            console.log(err);
            throw err;
        });
    });
}
function snatch(data) {
    return __awaiter(this, void 0, void 0, function* () {
        let squares = Object.values(data.squares)
            .map((s) => JSON.stringify(s))
            .join(",");
        yield pg("game")
            .where("id", "=", data.room)
            .update({
            squares: squares,
            p1words: data.p1words.map((s) => JSON.stringify(s)).join(","),
            p2words: data.p2words.map((s) => JSON.stringify(s)).join(",")
        })
            .catch((err) => {
            console.log(err);
            throw err;
        });
    });
}
function reset(room) {
    return __awaiter(this, void 0, void 0, function* () {
        yield pg("game")
            .where("id", "=", room)
            .update({ squares: {}, p1words: [], p2words: [], room: room });
    });
}
/* ------------------------------------------- */
io.on("connection", (socket) => {
    socket.on("join-send", function (data) {
        socket.join(data.room);
    });
    socket.on("get-state-send", (data) => __awaiter(void 0, void 0, void 0, function* () {
        const room = data.room;
        yield create(room);
        const rows = yield getData(room);
        io.sockets.in(room).emit("client-connect-receive", rows);
    }));
    socket.on("flip-send", (data) => {
        flip(data);
        io.sockets.in(data.room).emit("flip-receive", data);
    });
    socket.on("snatch-send", (data) => {
        snatch(data);
        io.sockets.in(data.room).emit("snatch-receive", data);
    });
    socket.on("reset-send", (room) => {
        reset(room);
        io.sockets.in(room).emit("reset-receive");
    });
});
