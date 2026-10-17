const User = require('../models/User');
const authService = require('../services/auth.service');
const bcryptService = require('../services/bcrypt.service');

const UserController = () => {
  const register = async (request, h) => {
    const { body } = request.app;

    if (body.password === body.password2) {
      try {
        const user = await User.create({
          email: body.email,
          password: body.password,
        });
        const token = authService().issue({ id: user.id });

        return h.response({ token, user }).code(200);
      } catch (err) {
        console.log(err);
        return h.response({ msg: 'Internal server error' }).code(500);
      }
    }

    return h.response({ msg: 'Bad Request: Passwords don\'t match' }).code(400);
  };

  const login = async (request, h) => {
    const { email, password } = request.app.body;

    if (email && password) {
      try {
        const user = await User
          .findOne({
            where: {
              email,
            },
          });

        if (!user) {
          return h.response({ msg: 'Bad Request: User not found' }).code(400);
        }

        if (bcryptService().comparePassword(password, user.password)) {
          const token = authService().issue({ id: user.id });

          return h.response({ token, user }).code(200);
        }

        return h.response({ msg: 'Unauthorized' }).code(401);
      } catch (err) {
        console.log(err);
        return h.response({ msg: 'Internal server error' }).code(500);
      }
    }

    return h.response({ msg: 'Bad Request: Email or password is wrong' }).code(400);
  };

  const validate = (request, h) => {
    const { token } = request.app.body;

    return new Promise((resolve) => {
      authService().verify(token, (err) => {
        if (err) {
          return resolve(h.response({ isvalid: false, err: 'Invalid Token!' }).code(401));
        }

        return resolve(h.response({ isvalid: true }).code(200));
      });
    });
  };

  const getAll = async (request, h) => {
    try {
      const users = await User.findAll();

      return h.response({ users }).code(200);
    } catch (err) {
      console.log(err);
      return h.response({ msg: 'Internal server error' }).code(500);
    }
  };


  return {
    register,
    login,
    validate,
    getAll,
  };
};

module.exports = UserController;
