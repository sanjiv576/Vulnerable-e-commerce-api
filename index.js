const app = require('./app');

// add SSL certificate
const port = 3005;

app.listen(port, () => console.log(`Server is running on port ${port}.`));