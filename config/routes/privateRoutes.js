const UserController = require('../../api/controllers/UserController');

const privateRoutes = {
  name: 'privateRoutes',
  register: (server) => {
    server.route([
      {
        method: 'GET',
        path: '/users',
        handler: UserController().getAll,
      },
    ]);
  },
};

module.exports = privateRoutes;
