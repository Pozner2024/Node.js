const path = require('path');
const fs = require('fs');

async function main() {
    var stats="";
    try {
        const readStream = fs.createReadStream( path.join(__dirname,"data.txt"), "utf8" );
        for await (const chunk of readStream) {
            stats+=chunk;
            console.log("read "+chunk.length+" chars");
        }
        console.log("all read - "+stats.length+" chars");
    }
    catch ( er ) {
        console.error("ERROR!",er);
    }
}

main();