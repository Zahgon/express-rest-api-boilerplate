const ALLOWED_METHODS = 'GET,HEAD,PUT,PATCH,POST,DELETE';

const cors = {
  name: 'cors',
  register: (server) => {
    server.ext('onRequest', (request, h) => {
      const { req, res } = request.raw;

      if (req.method !== 'OPTIONS') {
        return h.continue;
      }

      // A preflight is answered here and nothing downstream runs, which is why
      // an OPTIONS response carries none of the security headers.
      res.statusCode = 204;
      res.setHeader('X-Powered-By', 'Express');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
      res.setHeader('Vary', 'Access-Control-Request-Headers');

      const requested = req.headers['access-control-request-headers'];

      if (requested) {
        res.setHeader('Access-Control-Allow-Headers', requested);
      }

      res.setHeader('Content-Length', '0');
      res.end();

      return h.abandon;
    });

    server.ext('onPreResponse', (request, h) => {
      const { response } = request;
      const headers = response.isBoom ? response.output.headers : response.headers;

      headers['Access-Control-Allow-Origin'] = '*';

      return h.continue;
    });
  },
};

module.exports = cors;
