const secure = {
  name: 'secure',
  register: (server) => {
    server.ext('onPreResponse', (request, h) => {
      const { response } = request;
      const headers = response.isBoom ? response.output.headers : response.headers;

      headers['Strict-Transport-Security'] = 'max-age=15552000; includeSubDomains';
      headers['X-Content-Type-Options'] = 'nosniff';
      headers['X-XSS-Protection'] = '1; mode=block';

      return h.continue;
    });
  },
};

module.exports = secure;
