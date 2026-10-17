const JWTService = require('../services/auth.service');

// usually: "Authorization: Bearer [token]" or "token: [token]"
module.exports = (request, h) => {
  let tokenToVerify;

  if (request.headers.authorization) {
    const parts = request.headers.authorization.split(' ');

    if (parts.length === 2) {
      const scheme = parts[0];
      const credentials = parts[1];

      if (/^Bearer$/.test(scheme)) {
        tokenToVerify = credentials;
      } else {
        return h.response({ msg: 'Format for Authorization: Bearer [token]' }).code(401).takeover();
      }
    } else {
      return h.response({ msg: 'Format for Authorization: Bearer [token]' }).code(401).takeover();
    }
  } else if (request.app.body.token) {
    tokenToVerify = request.app.body.token;
    delete request.query.token;
  } else {
    return h.response({ msg: 'No Authorization was found' }).code(401).takeover();
  }

  return new Promise((resolve) => {
    JWTService().verify(tokenToVerify, (err, thisToken) => {
      if (err) return resolve(h.response({ err }).code(401).takeover());
      request.app.token = thisToken; // eslint-disable-line no-param-reassign

      return resolve(h.continue);
    });
  });
};
