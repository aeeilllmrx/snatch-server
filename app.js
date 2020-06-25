const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
const fs = require('fs');

// console.log that your server is up and running
app.listen(port, () => console.log(`Listening on port ${port}`));

// get a list of words
app.get('/get_wordlist', (req, res) => {
  const words = fs.readFileSync("./sowpods.txt", "utf8").split("\n");
  res.send({ data: words });
});


