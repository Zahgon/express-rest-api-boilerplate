/**
 * third party libraries
 */
const Hapi = require('@hapi/hapi');

/**
 * server configuration
 */
const config = require('../config/');
const dbService = require('./services/db.service');
const authGuard = require('./plugins/authGuard');
const body = require('./plugins/body');
const cors = require('./plugins/cors');
const respond = require('./plugins/respond');
const routing = require('./plugins/routing');
const secure = require('./plugins/secure');

// environment: development, staging, testing, production
const environment = process.env.NODE_ENV;

/**
 * hapi application
 */
const server = Hapi.server({
  port: config.port,
  host: '0.0.0.0',
  compression: false,
  router: { isCaseSensitive: false },
  routes: {
    payload: { parse: false, output: 'data' },
    response: { ranges: false },
  },
});
// hapi answers a malformed request line without the Connection: close the
// bare node server sends; dropping its handler restores that reply.
server.listener.removeAllListeners('clientError');

const DB = dbService(environment, config.migrate).start();

const start = async () => {
  // allow cross origin requests
  // configure to only allow requests from certain origins
  // secure the application
  // parse the request bodys
  // secure your private routes with jwt authentication
  await server.register([respond, cors, secure, body, authGuard, routing]);

  // fill routes for the hapi application
  await server.register({ plugin: config.publicRoutes, routes: { prefix: '/public' } });
  await server.register({ plugin: config.privateRoutes, routes: { prefix: '/private' } });

  await server.start();

  if (environment !== 'production' &&
    environment !== 'development' &&
    environment !== 'testing'
  ) {
    console.error(`NODE_ENV is set to ${environment}, but only production and development are valid.`);
    process.exit(1);
  }

  return DB;
};

start();
