const path = require('path');
const fs = require('fs');

var readStream=fs.createReadStream( path.join(__dirname,"data2.txt") );
var writeStream=fs.createWriteStream( path.join(__dirname,"data_copy.txt") );

readStream.pipe(writeStream);

// подписываемся только ради того чтобы видеть прогресс в консоли
readStream.on('data', chunk => {
    console.log('chunk length='+chunk.length);
});

readStream.on('error', err =>{
    console.log("ERROR!",err);
});
