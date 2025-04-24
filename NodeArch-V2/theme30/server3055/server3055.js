const express = require('express');

const webserver = express(); // создаём веб-сервер

const port = 3055;

webserver.get('/service1', (req, res) => { 
    console.log(`service1 called, req.originalUrl=${req.originalUrl}`);
    res.send("service1 ok!");
});

webserver.listen(port,()=>{ 
    console.log("web server running on port "+port);
}); 
