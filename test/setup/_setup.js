const Hapi = require('@hapi/hapi');

const config = require('../../config/');
const database = require('../../config/database');
const authGuard = require('../../api/plugins/authGuard');
const body = require('../../api/plugins/body');
const respond = require('../../api/plugins/respond');
const routing = require('../../api/plugins/routing');

const beforeAction = async () => {
  const testapp = Hapi.server({
    compression: false,
    router: { isCaseSensitive: false },
    routes: {
      payload: { parse: false, output: 'data' },
      response: { ranges: false },
    },
  });

  testapp.listener.removeAllListeners('clientError');

  await testapp.register([respond, body, authGuard, routing]);

  await testapp.register({ plugin: config.publicRoutes, routes: { prefix: '/public' } });
  await testapp.register({ plugin: config.privateRoutes, routes: { prefix: '/private' } });

  // hapi serves through its own listener, which is what the test client drives.
  await testapp.initialize();

  await database.authenticate();
  await database.drop();
  await database.sync().then(() => console.log('Connection to the database has been established successfully'));

  return testapp.listener;
};

const afterAction = async () => {
  await database.close();
};


module.exports = { beforeAction, afterAction };
