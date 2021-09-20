const ip = require('ip');

async function ipAddress () {
    console.log(ip.address());
}

module.exports = ipAddress;