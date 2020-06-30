var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 5000;
var fs = require('fs');

http.listen(port, function(){
  console.log('listening on *:' + port);
});

app.get('/get_wordlist', (req, res) => {
  const words = fs.readFileSync("./sowpods.txt", "utf8").split("\n");
  res.send({ data: words });
});

io.on('connection', function(socket){
  socket.on('flip-send', function(data){
    io.emit('flip-receive', data);
  });
  socket.on('snatch-send', function(data){
    io.emit('snatch-receive', data);
  });
});
