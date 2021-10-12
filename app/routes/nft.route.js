const controller = require('../controllers/nft.controller');

module.exports = function(app) {
  app.use(function(req, res, next) {
    res.header(
      'Access-Control-Allow-Headers',
      'x-access-token, Origin, Content-Type, Accept'
    );
    next();
  });

  app.post(
    '/api/nft/saveShamir',
    controller.saveShamir
  );

  app.post(
    '/api/nft/saveShamirBatch',
    controller.saveShamirBatch
  );
  
  app.post(
    '/api/nft/getShamir',
    controller.getShamir
  );
};