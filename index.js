const app = require('./app');
const fs = require('fs');
const key = fs.readFileSync('./localhost.decrypted.key');
const cert = fs.readFileSync('./localhost.crt');
const https = require('https');

// add SSL certificate
const server = https.createServer({key, cert}, app);
const port = 3005;

server.listen(port, () => console.log(`Server is running on port ${port} with SSL certificate.`));