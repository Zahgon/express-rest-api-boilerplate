const Hapi = require('@hapi/hapi');

const config = require('../../config/');
const database = require('../../config/database');
const authGuard = require('../../api/plugins/authGuard');
const body = require('../../api/plugins/body');
const cors = require('../../api/plugins/cors');
const respond = require('../../api/plugins/respond');
const routing = require('../../api/plugins/routing');
const secure = require('../../api/plugins/secure');

// The whole plugin stack api/api.js serves, so the behaviour that comes from
// the framework surface rather than from a controller can be driven in a test.
const beforeFullAction = async () => {
  const testapp = Hapi.server({
    compression: false,
    router: { isCaseSensitive: false },
    routes: {
      payload: { parse: false, output: 'data' },
      response: { ranges: false },
    },
  });

  testapp.listener.removeAllListeners('clientError');

  await testapp.register([respond, cors, secure, body, authGuard, routing]);

  await testapp.register({ plugin: config.publicRoutes, routes: { prefix: '/public' } });
  await testapp.register({ plugin: config.privateRoutes, routes: { prefix: '/private' } });

  await testapp.initialize();

  await database.authenticate();
  await database.drop();
  await database.sync();

  return testapp.listener;
};

const afterFullAction = async () => {
  await database.close();
};

module.exports = { beforeFullAction, afterFullAction };
