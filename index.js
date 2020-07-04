var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var port = process.env.PORT || 5000;

const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
})

/*
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'snatch',
  password: 'postgres',
  port: 5432,
  ssl: false
});
*/

pool.connect();

// TODO make rooms based on game id
gameId = "103";

const buildFlipQuery = (data, gameId) => {
  squares = Object.values(data['squares'])
      .map((s) => JSON.stringify(s)).join(",");
  return "UPDATE game SET squares = '{" +
    squares + "}' WHERE id = " + gameId
}

const buildSnatchQuery = (data, gameId) => {
  squares = Object.values(data['squares'])
      .map((s) => JSON.stringify(s)).join(",");
  p1words = data['p1words']
      .map((s) => JSON.stringify(s)).join(",");
  p2words = data['p2words']
      .map((s) => JSON.stringify(s)).join(",");
  return "UPDATE game SET squares = '{" + squares +
    "}', p1words = '{" + p1words + "}', p2words = '{" +
    p2words + "}' WHERE id = " + gameId
}

const buildStateQuery = (gameId) => {
  return "SELECT * FROM game WHERE id = " + gameId
}

http.listen(port, function(){
  console.log('listening on *:' + port);
});

app.get('/get_wordlist', (req, res) => {
  console.log("in get wordlist");
  const words = fs.readFileSync("./sowpods.txt", "utf8").split("\n");
  console.log("words length: " + words.length);
  res.send({ data: words });
});

app.get('/check_db', (req, res) => {
  pool.query("SELECT * FROM game")
    .then(res => console.log(res.rows[0]))
    .catch(e => console.error(e.stack))
  });

io.on('connection', function(socket){
  pool
    .query(buildStateQuery(gameId))
    .then(res => io.emit('client-connect-receive', res.rows[0]) )
    .catch(e => console.error(e.stack))

  socket.on('flip-send', function(data){
    pool
      .query(buildFlipQuery(data, gameId))
      .catch(e => console.error(e.stack))
    io.emit('flip-receive', data);
  });

  socket.on('snatch-send', function(data){
    pool
      .query(buildSnatchQuery(data, gameId))
      .catch(e => console.error(e.stack))
    io.emit('snatch-receive', data);
  });

  socket.on('reset-send', () => {
    const data = {'squares': {}, 'p1words': [], 'p2words': []}
    pool
      .query(buildSnatchQuery(data, gameId))
      .catch(e => console.error(e.stack))
    io.emit('reset-receive');
  });
});
