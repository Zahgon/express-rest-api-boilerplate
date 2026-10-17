const UserController = require('../../api/controllers/UserController');

const publicRoutes = {
  name: 'publicRoutes',
  register: (server) => {
    server.route([
      {
        method: 'POST',
        path: '/user',
        handler: UserController().register,
      },
      {
        method: 'POST',
        path: '/register', // alias for POST /user
        handler: UserController().register,
      },
      {
        method: 'POST',
        path: '/login',
        handler: UserController().login,
      },
      {
        method: 'POST',
        path: '/validate',
        handler: UserController().validate,
      },
    ]);
  },
};

module.exports = publicRoutes;
