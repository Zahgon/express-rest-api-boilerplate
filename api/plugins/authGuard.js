const auth = require('../policies/auth.policy');
const { routedPath } = require('./routing');

const PRIVATE_ROUTES_REGEXP = /^\/private\/(.*)$/i;

const authGuard = {
  name: 'authGuard',
  register: (server) => {
    server.ext('onRequest', (request, h) => {
      // The original path is what the guard it replaces matched; the routed
      // path is what hapi will serve. Judging both, no request can reach a
      // private route the guard has not looked at.
      if (!PRIVATE_ROUTES_REGEXP.test(request.app.pathname)
        && !PRIVATE_ROUTES_REGEXP.test(routedPath(request))) {
        return h.continue;
      }

      return auth(request, h);
    });
  },
};

module.exports = authGuard;
