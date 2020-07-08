var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var port = process.env.PORT || 5000;

const { Pool } = require('pg')

/* ---------- Routes ------------------- */
http.listen(port, function(){
  console.log('listening on *:' + port);
});

app.get('/get_wordlist', (req, res) => {
  const words = fs.readFileSync("./sowpods.txt", "utf8").split("\n");
  res.send({ data: words });
});

/* ----------Postgres connection logic--------- */
const prod = true;
let pool = undefined;
if (prod) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  })
} else {
  pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'snatch',
    password: 'postgres',
    port: 5432,
    ssl: false
  });
}

async function getData(room) {
  try {
    response = await pool.query("SELECT * FROM game WHERE id = " + room);
  } catch (error) {
    console.error(e.stack)
  }
  return response.rows[0];
}

async function create(room) {
  try {
    response = await pool.query(
      "INSERT INTO game (id) VALUES (" + room + ") ON CONFLICT DO NOTHING"
    )
  } catch (error) {
    console.error(e.stack)
  }
}

const buildFlipQuery = (data) => {
  squares = Object.values(data['squares']).map((s) => JSON.stringify(s)).join(",");
  return "UPDATE game SET squares = '{" + squares + "}' WHERE id = " + data['room']
}

const buildSnatchQuery = (data) => {
  squares = Object.values(data['squares']).map((s) => JSON.stringify(s)).join(",");
  p1words = data['p1words'].map((s) => JSON.stringify(s)).join(",");
  p2words = data['p2words'].map((s) => JSON.stringify(s)).join(",");
  return "UPDATE game SET squares = '{" + squares +
    "}', p1words = '{" + p1words + "}', p2words = '{" +
    p2words + "}' WHERE id = " + data['room']
}

/* ------------------------------------------- */

io.sockets.on('connection', function(socket){
  socket.on('join-send', function(data) {
    socket.join(data['room']);
  });

  socket.on('get-state-send', async (data) => {
    const room = data['room']
    await create(room);
    const rows = await getData(room)
    io.sockets.in(room).emit('client-connect-receive', rows) 
  })

  socket.on('flip-send', function(data){
    pool
      .query(buildFlipQuery(data))
      .catch(e => console.error(e.stack))
    io.sockets.in(data['room']).emit('flip-receive', data);
  });

  socket.on('snatch-send', function(data){
    pool
      .query(buildSnatchQuery(data))
      .catch(e => console.error(e.stack))
    io.sockets.in(data['room']).emit('snatch-receive', data);
  });

  socket.on('reset-send', (room) => {
    const data = {'squares': {}, 'p1words': [], 'p2words': [], 'room': room}
    pool
      .query(buildSnatchQuery(data))
      .catch(e => console.error(e.stack))
    io.sockets.in(data['room']).emit('reset-receive');
  });
})
