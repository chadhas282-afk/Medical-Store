const app = require('../server');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 5001;

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`PharmaTrack Server running on http://${HOST}:${PORT}`);
  });
}

module.exports = app;