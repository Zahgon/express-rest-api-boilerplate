# express-rest-api-boilerplate

> hapi REST API with JWT Authentication and support for sqlite, mysql, and postgresql

- authentication via [JWT](https://jwt.io/)
- routes mapping via [hapi](https://hapi.dev/) plugins
- support for [sqlite](https://www.sqlite.org/), [mysql](https://www.mysql.com/), and [postgresql](https://www.postgresql.org/)
- environments for `development`, `testing`, and `production`
- linting via [eslint](https://github.com/eslint/eslint)
- integration tests running with [Jest](https://github.com/facebook/jest)
- built with [npm sripts](#npm-scripts)
- example for User model and User controller, with jwt authentication, simply type `npm i` and `npm start`

## Table of Contents

- [Install & Use](#install-and-use)
- [Folder Structure](#folder-structure)
- [Controllers](#controllers)
  - [Create a Controller](#create-a-controller)
- [Models](#models)
  - [Create a Model](#create-a-model)
- [Policies](#policies)
  - [auth.policy](#authpolicy)
- [Services](#services)
- [Config](#config)
  - [Connection and Database](#connection-and-database)
- [Routes](#routes)
  - [Create Routes](#create-routes)
- [Test](#test)
  - [Setup](#setup)
- [npm Scripts](#npm-scripts)

## Install and Use

Start by cloning this repository

```sh
# HTTPS
$ git clone https://github.com/aichbauer/express-rest-api-boilerplate.git
```

then

```sh
# cd into project root
$ yarn
# to use mysql
$ yarn add mysql2
# to use postgresql
$ yarn add pg pg-hstore
# start the api
$ yarn start
```

or

```sh
# cd into project root
$ npm i
# to use mysql
$ npm i mysql2 -S
# to use postgresql
$ npm i -S pg pg-hstore
# start the api
$ npm start
```

sqlite is supported out of the box as it is the default.

## Folder Structure

This boilerplate has 4 main directories:

- api - for controllers, models, services, etc.
- config - for routes, database, etc.
- db - this is only a dir for the sqlite db, the default for NODE_ENV development
- test - using [Jest](https://github.com/facebook/jest)

## Controllers

### Create a Controller

Controllers in this boilerplate have a naming convention: `ModelnameController.js` and uses an object factory pattern.
To use a model inside of your controller you have to require it.
We use [Sequelize](http://docs.sequelizejs.com/) as ORM, if you want further information read the [Docs](http://docs.sequelizejs.com/).

Example Controller for all **CRUD** oparations:

```js
const Model = require('../models/Model');

const ModelController = () => {
  const create = async (request, h) => {
    // body is part of a form-data
    const { value } = request.app.body;

    try {
      const model = await Model.create({
        key: value
      });

      if(!model) {
        return h.response({ msg: 'Bad Request: Model not found' }).code(400);
      }

      return h.response({ model }).code(200);
    } catch (err) {
      // better save it to log file
      console.error(err);

      return h.response({ msg: 'Internal server error' }).code(500);
    }
  };

  const getAll = async (request, h) => {
    try {
      const model = await Model.findAll();

      if(!models){
        return h.response({ msg: 'Bad Request: Models not found' }).code(400);
      }

      return h.response({ models }).code(200);
    } catch (err) {
      // better save it to log file
      console.error(err);

      return h.response({ msg: 'Internal server error' }).code(500);
    }
  };

  const get = async (request, h) => {
    // params is part of an url
    const { id } = request.params;

    try {
      const model = await Model.findOne({
        where: {
          id,
        },
      });

      if(!model) {
        return h.response({ msg: 'Bad Request: Model not found' }).code(400);
      }

      return h.response({ model }).code(200);
    } catch (err) {
      // better save it to log file
      console.error(err);

      return h.response({ msg: 'Internal server error' }).code(500);
    }
  };

  const update = async (request, h) => {
    // params is part of an url
    const { id } = request.params;

    // body is part of form-data
    const { value } = request.app.body;

    try {
      const model = await Model.findById(id);

      if(!model) {
        return h.response({ msg: 'Bad Request: Model not found' }).code(400);
      }

      const updatedModel = await model.update({
        key: value,
      )};

      return h.response({ updatedModel }).code(200);
    } catch (err) {
      // better save it to log file
      console.error(err);

      return h.response({ msg: 'Internal server error' }).code(500);
    }
  };

  const destroy = async (request, h) => {
    // params is part of an url
    const { id } = request.params;

    try {
      const model =  Model.findById(id);

      if(!model) {
        return h.response({ msg: 'Bad Request: Model not found' }).code(400)
      }

      await model.destroy();

      return h.response({ msg: 'Successfully destroyed model' }).code(200);
    } catch (err) {
      // better save it to log file
      console.error(err);

      return h.response({ msg: 'Internal server error' }).code(500);
    }
  };

  // IMPORTANT
  // don't forget to return the functions
  return {
    create,
    getAll,
    get,
    update,
    destroy,
  };
};

model.exports = ModelController;
```

## Models

### Create a Model

Models in this boilerplate have a naming convention: `Model.js` and uses [Sequelize](http://docs.sequelizejs.com/) to define our Models, if you want further information read the [Docs](http://docs.sequelizejs.com/).

Example User Model:

```js
const Sequelize = require('sequelize');

// for encrypting our passwords
const bcryptSevice = require('../services/bcrypt.service');

// the DB connection
const sequelize = require('../../config/database');

// hooks are functions that can run before or after a specific event
const hooks = {
  beforeCreate(user) {
    user.password = bcryptSevice.password(user);
  },
};

// naming the table in DB
const tableName = 'users';

// the actual model
const User = sequelize.define('User', {
  username: {
    type: Sequelize.STRING,
    unique: true,
  },
  password: {
    type: Sequelize.STRING,
  },
}, { hooks, tableName });

// instead of using instanceMethod
// in sequelize > 4 we are writing the function
// to the prototype object of our model.
// as we do not want to share sensitive data, the password
// field gets ommited before sending
User.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());

  delete values.password;

  return values;
};

// IMPORTANT
// don't forget to export the Model
module.exports = User;
```

## Policies

Policies are extension functions that can run before hitting a apecific or more specified route(s).

Example policy:

Only allow if the user is marked as admin.

> Note: this is not a secure example, only for presentation puposes

```js
module.exports = (request, h) => {
  if(request.app.body.userrole === 'admin') {
    // do some verification stuff
    const verified = verifyAdmin(request.app.body.userid);

    if(verified) {
      return h.continue;
    }

    return h.response({ msg: 'Unauthorized' }).code(401).takeover();
  }

  return h.response({ msg: 'Unauthorized' }).code(401).takeover();
};
```

To use this policy on all routes that only admins are allowed:

api.js

```js
const adminPolicy = require('./policies/admin.policy');

server.ext('onRequest', (request, h) => (
  /^\/admin\/(.*)$/i.test(request.path) ? adminPolicy(request, h) : h.continue
));
```

Or for one specific route

api.js

```js
const adminPolicy = require('./policies/admin.policy');

server.route({
  method: 'GET',
  path: '/admin/myroute',
  options: {
    ext: {
      onPreHandler: [{ method: adminPolicy }],
    },
  },
  handler: (request, h) => {
  //do some fancy stuff
  },
});
```

## auth.policy

The `auth.policy` checks wether a `JSON Web Token` ([further information](https://jwt.io/)) is send in the header of an request as `Authorization: Bearer [JSON Web Token]` or inside of the body of an request as `token: [JSON Web Token]`.
The policy runs default on all api routes that are are prefixed with `/private`. To map multiple routes read the [docs](https://hapi.dev/api/#-serverrouteroute) from `hapi`.

To use this policy on all routes of a specific prefix:

app.js

```js
await server.register({ plugin: yourRoutes, routes: { prefix: '/prefix' } });
server.ext('onRequest', (request, h) => (
  /^\/prefix\/(.*)$/i.test(request.path) ? auth(request, h) : h.continue
));
```

or to use this policy on one specific route:

app.js

```js
server.route({
  method: 'GET',
  path: '/specificRoute',
  options: {
    ext: {
      onPreHandler: [{ method: auth }],
    },
  },
  handler: (request, h) => {
  // do some fancy stuff
  },
});
```

## Services

Services are little useful snippets, or calls to another API that are not the main focus of your API.

Example service:

Get comments from another API:

```js
const commentService = () => {
  const getComments = async () => {
    try {
      const res = await fetch('https://jsonplaceholder.typicode.com/comments', {
        method: 'get'
      });

      // do some fancy stuff with the response
    } catch (err) {
      // handle a error
    }
  };

  return {
    getComments,
  };
};

module.exports = commentService;
```

## Config

Holds all the server configurations.

## Connection and Database

> Note: if you use msql make sure mysql server is running on the machine

> Note: if you use postgres make sure postgres server is running on the machine

This two files are the way to establish a connaction to a database.

You only need to touch connection.js, default for `development` is sqlite, but it is easy as typing `mysql` or `postgres` to switch to another db.

> Note: to run a mysql db install these package with: `yarn add mysql2` or `npm i mysql2 -S`

> Note: to run a postgres db run these package with: `yarn add pg pg-hstore` or `npm i -S pg pg-hstore`

Now simple configure the keys with your credentials.

```js
{
  database: 'databasename',
  username: 'username',
  password: 'password',
  host: 'localhost',
  dialect: 'sqlite' || 'mysql' || 'postgres',
}
```

To not configure the production code.

To start the DB, add the credentials for production. add `environment variables` by typing e.g. `export DB_USER=yourusername` before starting the api.

## Routes

Here you define all your routes for your api. It doesn't matter how you structure them. By default they are mapped on `privateRoutes` and `publicRoutes`. You can define as much routes files as you want e.g. for every model or for specific use cases, e.g. normal user and admins.

## Create Routes

For further information read the [docs](https://hapi.dev/api/#-serverrouteroute) of hapi.

Example for User Model:

> Note: a route file is a hapi plugin, so it has a `name` and a `register` function.

userRoutes.js

```js
const UserController = require('../../api/controllers/UserController');

const userRoutes = {
  name: 'userRoutes',
  register: (server) => {
    server.route([
      {
        method: 'POST',
        path: '/user',
        handler: UserController().create,
      },
      {
        method: 'GET',
        path: '/users',
        handler: UserController().getAll,
      },
      {
        method: 'GET',
        path: '/user/{id}',
        handler: UserController().get,
      },
      {
        method: 'PUT',
        path: '/user/{id}',
        handler: UserController().update,
      },
      {
        method: 'DELETE',
        path: '/user',
        handler: UserController().destroy,
      },
    ]);
  },
};

module.exports = userRoutes;
```

To use these routes in your application, require them in the config/index.js and export them.

```js
const userRoutes = require('./userRoutes');

const config = {
  allTheOtherStuff,
  userRoutes,
};

module.exports = config;
```

api.js

```js
await server.register({ plugin: config.userRoutes, routes: { prefix: '/prefix' } });

// to protect them with authentication
server.ext('onRequest', (request, h) => (
  /^\/prefix\/(.*)$/i.test(request.path) ? auth(request, h) : h.continue
));
```

## Test

All test for this boilerplate uses [Jest](https://github.com/facebook/jest) and [supertest](https://github.com/visionmedia/superagent) for integration testing. So read their docs on further information.

### Setup

The setup directory holds the `_setup.js` which holds `beforeAction` which starts a test hapi application and connects to your test database, and a `afterAction` which closes the db connection.

### Controller

> Note: those request are asynchronous, we use `async await` syntax.

> Note: As we don't use import statements inside the api we also use the require syntax for tests

To test a Controller we create `fake requests` to our api routes.

Example `GET /user` from last example with prefix `prefix`:

```js
const request = require('supertest');
const {
  beforeAction,
  afterAction,
} = require('../setup/_setup');

let api;

beforeAll(async () => {
  api = await beforeAction();
});

afterAll(() => {
  afterAction();
});

test('test', async () => {
  const token = 'this-should-be-a-valid-token';

  const res = await request(api)
    .get('/prefix/user')
    .set('Accept', /json/)
    // if auth is needed
    .set('Authorization', `Bearer ${token}`)
    .set('Content-Type', 'application/json')
    .expect(200);

  // read the docs of jest for further information
  expect(res.body.user).toBe('something');
});
```

### Models

Are usually automatically tested in the integration tests as the Controller uses the Models, but you can test them separatly.

## npm scripts

There are no automation tool or task runner like [grunt](https://gruntjs.com/) or [gulp](http://gulpjs.com/) used for this boilerplate. These boilerplate only uses npm scripts for automatization.

### npm start

This is the entry for a developer. This command:

By default it uses a sqlite databse, if you want to migrate the sqlite db by each start, disable the `prestart` and `poststart` command. Also mind if you are using a sqlite database to delete the `drop-sqlite-db` in the prepush hook.

- runs **nodemon watch task** for the all files conected to `.api/api.js`
- sets the **environment variable** `NODE_ENV` to `development`
- opens the db connection for `development`
- starts the server on 127.0.0.1:2017

### npm test

This command:

- runs `npm run lint` ([eslint](http://eslint.org/)) with the [airbnb styleguide](https://github.com/airbnb/javascript) without arrow-parens rule for **better readability**
- sets the **environment variable** `NODE_ENV` to `testing`
- creates the `database.sqlite` for the test
- runs `jest --coverage` for testing with [Jest](https://github.com/facebook/jest) and the coverage
- drops the `database.sqlite` after the test

## npm run production

This command:

- sets the **environment variable** to `production`
- opens the db connection for `production`
- starts the server on 127.0.0.1:2017 or on 127.0.0.1:PORT_ENV

Before running on production you have to set the **environment vaiables**:

- DB_NAME - database name for production
- DB_USER - database username for production
- DB_PASS - database password for production
- DB_HOST - database host for production
- JWT_SECERT - secret for json web token

Optional:

- PORT - the port your api on 127.0.0.1, default to 2017

### other commands

- `npm run dev` - simply start the server withou a watcher
- `npm run create-sqlite-db` - creates the sqlite database
- `npm run drop-sqlite-db` - drops **ONLY** the sqlite database
- `npm run lint` - linting with [eslint](http://eslint.org/)
- `npm run nodemon` - same as `npm start``
- `npm run prepush` - a hook wich runs before pushing to a repository, runs `npm test` and `npm run dropDB`
- `pretest` - runs linting before `npm test`
- `test-ci` - only runs tests, nothing in pretest, nothing in posttest, for better use with ci tools

## LICENSE

MIT © Lukas Aichbauer
