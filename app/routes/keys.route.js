const controller = require('../controllers/keys.controller');

module.exports = function(app) {
  app.use(function(req, res, next) {
    res.header(
      'Access-Control-Allow-Headers',
      'x-access-token, Origin, Content-Type, Accept'
    );
    next();
  });

  app.get(
    '/api/keys/generateKey',
    controller.generateKey
  );

  app.post(
    '/api/keys/downloadKey',
    controller.downloadKey
  );
  
  app.post(
    '/api/keys/uploadKey',
    controller.uploadKey
  );
  
  app.get(
    '/api/keys/getPublicKey',
    controller.getPublicKey
  );
  
  app.get(
    '/api/keys/getPublicKeyURL',
    controller.getPublicKeyURL
  );
};