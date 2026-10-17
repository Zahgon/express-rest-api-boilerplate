const request = require('supertest');
const {
  beforeFullAction,
  afterFullAction,
} = require('../setup/_full');
const User = require('../../api/models/User');

let api;
let token;

const NOT_FOUND_BODY = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="utf-8">',
  '<title>Error</title>',
  '</head>',
  '<body>',
  '<pre>Cannot GET /nope</pre>',
  '</body>',
  '</html>',
  '',
].join('\n');

// The order and the capitalisation of the response header names, which is part
// of what a client sees and is not something the framework preserves by itself.
const rawHeaderNames = (res) => res.res.rawHeaders
  .filter((_, index) => index % 2 === 0);

beforeAll(async () => {
  api = await beforeFullAction();

  const user = await User.create({
    email: 'martin@mail.com',
    password: 'securepassword',
  });

  const res = await request(api)
    .post('/public/login')
    .send({ email: 'martin@mail.com', password: 'securepassword' })
    .expect(200);

  ({ token } = res.body);

  expect(user).toBeTruthy();
  expect(token).toBeTruthy();
});

afterAll(() => {
  afterFullAction();
});

test('Framework | an unknown route is a 404 html page, not a json error', async () => {
  const res = await request(api)
    .get('/nope')
    .expect(404);

  expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
  expect(res.headers['content-security-policy']).toBe("default-src 'self'");
  expect(res.headers['x-content-type-options']).toBe('nosniff');
  expect(res.headers.etag).toBeUndefined();
  expect(res.text).toBe(NOT_FOUND_BODY);
});

test('Framework | the 404 page names the method and the original path', async () => {
  const res = await request(api)
    .delete('/private/users')
    .set('Authorization', `Bearer ${token}`)
    .expect(404);

  expect(res.text).toContain('<pre>Cannot DELETE /private/users</pre>');
});

test('Framework | a wrong method is a 404, never a 405', async () => {
  const res = await request(api)
    .get('/public/login')
    .expect(404);

  expect(res.status).not.toBe(405);
  expect(res.headers.allow).toBeUndefined();
});

test('Framework | a json response is compact, utf-8 and carries no trailing newline', async () => {
  const res = await request(api)
    .get('/private/users')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(res.headers['content-type']).toBe('application/json; charset=utf-8');
  expect(res.text.endsWith('}')).toBe(true);
  expect(res.text).not.toContain('\n');
  expect(res.text.startsWith('{"users":[')).toBe(true);
});

test('Framework | response header names keep their casing and their order', async () => {
  const res = await request(api)
    .get('/private/users')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  const names = rawHeaderNames(res);

  expect(names.slice(0, 7)).toEqual([
    'Access-Control-Allow-Origin',
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'X-XSS-Protection',
    'Content-Type',
    'Content-Length',
    'ETag',
  ]);
  expect(names).not.toContain('cache-control');
  expect(names).not.toContain('accept-ranges');
  expect(names).not.toContain('X-Powered-By');
});

test('Framework | the security headers are on every application response', async () => {
  const res = await request(api)
    .get('/private/users')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(res.headers['strict-transport-security']).toBe('max-age=15552000; includeSubDomains');
  expect(res.headers['x-content-type-options']).toBe('nosniff');
  expect(res.headers['x-xss-protection']).toBe('1; mode=block');
  expect(res.headers['access-control-allow-origin']).toBe('*');
  expect(res.headers['x-frame-options']).toBeUndefined();
  expect(res.headers['x-dns-prefetch-control']).toBeUndefined();
  expect(res.headers['x-download-options']).toBeUndefined();
});

test('Framework | a json response carries a weak etag and honours a conditional get', async () => {
  const first = await request(api)
    .get('/private/users')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(first.headers.etag).toMatch(/^W\//);

  const second = await request(api)
    .get('/private/users')
    .set('Authorization', `Bearer ${token}`)
    .set('If-None-Match', first.headers.etag)
    .expect(304);

  expect(second.headers.etag).toBe(first.headers.etag);
  expect(second.headers['content-type']).toBeUndefined();
  expect(second.headers['content-length']).toBeUndefined();
  expect(second.text).toBeFalsy();
});

test('Framework | a stale conditional get is answered in full', async () => {
  const res = await request(api)
    .get('/private/users')
    .set('Authorization', `Bearer ${token}`)
    .set('If-None-Match', '"deadbeef"')
    .expect(200);

  expect(res.body.users).toBeTruthy();
});

test('Framework | a cors preflight is answered before anything downstream runs', async () => {
  const res = await request(api)
    .options('/public/login')
    .set('Origin', 'http://example.com')
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'content-type')
    .expect(204);

  expect(res.headers['access-control-allow-origin']).toBe('*');
  expect(res.headers['access-control-allow-methods']).toBe('GET,HEAD,PUT,PATCH,POST,DELETE');
  expect(res.headers['access-control-allow-headers']).toBe('content-type');
  expect(res.headers.vary).toBe('Access-Control-Request-Headers');
  expect(res.headers['x-powered-by']).toBe('Express');
  expect(res.headers['strict-transport-security']).toBeUndefined();
});

test('Framework | a preflight for an unknown route is still a 204', async () => {
  const res = await request(api)
    .options('/nope')
    .set('Origin', 'http://example.com')
    .set('Access-Control-Request-Method', 'GET')
    .expect(204);

  expect(res.headers['access-control-allow-methods']).toBe('GET,HEAD,PUT,PATCH,POST,DELETE');
  expect(res.headers['access-control-allow-headers']).toBeUndefined();
});

test('Framework | a malformed json body is a 400 html page naming the syntax error', async () => {
  const res = await request(api)
    .post('/public/login')
    .set('Content-Type', 'application/json')
    .send('{"email":')
    .expect(400);

  expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
  expect(res.text).toContain('<pre>SyntaxError: Unexpected end of JSON input<br>');
});

test('Framework | a body is parsed before the route is resolved', async () => {
  const res = await request(api)
    .post('/nope')
    .set('Content-Type', 'application/json')
    .send('{"email":')
    .expect(400);

  expect(res.text).toContain('SyntaxError');
});

test('Framework | a top level json primitive is a strict mode violation', async () => {
  const res = await request(api)
    .post('/public/login')
    .set('Content-Type', 'application/json')
    .send('"martin"')
    .expect(400);

  expect(res.text).toContain('<pre>SyntaxError: Unexpected token # in JSON at position 0<br>');
});

test('Framework | an unsupported charset is a 415', async () => {
  const res = await request(api)
    .post('/public/login')
    .set('Content-Type', 'application/json; charset=iso-8859-1')
    .send('{"email":"martin@mail.com","password":"securepassword"}')
    .expect(415);

  expect(res.text).toContain('UnsupportedMediaTypeError: unsupported charset &quot;ISO-8859-1&quot;');
});

test('Framework | a body over the 100kb limit is a 413', async () => {
  const res = await request(api)
    .post('/public/login')
    .set('Content-Type', 'application/json')
    .send(JSON.stringify({ email: 'martin@mail.com', pad: 'x'.repeat(200000) }))
    .expect(413);

  expect(res.text).toContain('PayloadTooLargeError: request entity too large');
});

test('Framework | an empty json body parses to an empty object', async () => {
  const res = await request(api)
    .post('/public/login')
    .set('Content-Type', 'application/json')
    .send('')
    .expect(400);

  expect(res.body.msg).toBe('Bad Request: Email or password is wrong');
});

test('Framework | a body whose media type is not declared is left unparsed', async () => {
  const res = await request(api)
    .post('/public/login')
    .set('Content-Type', 'text/plain')
    .send('{"email":"martin@mail.com","password":"securepassword"}')
    .expect(400);

  expect(res.body.msg).toBe('Bad Request: Email or password is wrong');
});

test('Framework | a +json suffix media type is not treated as json', async () => {
  const res = await request(api)
    .post('/public/login')
    .set('Content-Type', 'application/vnd.api+json')
    .send('{"email":"martin@mail.com","password":"securepassword"}')
    .expect(400);

  expect(res.body.msg).toBe('Bad Request: Email or password is wrong');
});

test('Framework | a urlencoded form body is parsed', async () => {
  const res = await request(api)
    .post('/public/login')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send('email=martin@mail.com&password=securepassword')
    .expect(200);

  expect(res.body.token).toBeTruthy();
});

test('Framework | urlencoded nesting is kept flat, so a nested key never arrives', async () => {
  const res = await request(api)
    .post('/public/login')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send('email[0]=martin@mail.com&password=securepassword')
    .expect(400);

  expect(res.body.msg).toBe('Bad Request: Email or password is wrong');
});

test('Framework | a trailing slash still reaches the route', async () => {
  const res = await request(api)
    .post('/public/login/')
    .send({ email: 'martin@mail.com', password: 'securepassword' })
    .expect(200);

  expect(res.body.token).toBeTruthy();
});

test('Framework | one doubled slash inside the mount still reaches the route', async () => {
  const res = await request(api)
    .post('/public//login')
    .send({ email: 'martin@mail.com', password: 'securepassword' })
    .expect(200);

  expect(res.body.token).toBeTruthy();
});

test('Framework | two doubled slashes inside the mount do not', async () => {
  await request(api)
    .post('/public///login')
    .send({ email: 'martin@mail.com', password: 'securepassword' })
    .expect(404);
});

test('Framework | a doubled slash before the mount does not reach the route', async () => {
  await request(api)
    .post('//public/login')
    .send({ email: 'martin@mail.com', password: 'securepassword' })
    .expect(404);
});

test('Framework | a percent encoded path segment is matched raw, so it misses', async () => {
  await request(api)
    .post('/public/%6Cogin')
    .send({ email: 'martin@mail.com', password: 'securepassword' })
    .expect(404);
});

test('Framework | routing ignores the case of the path', async () => {
  const res = await request(api)
    .post('/PUBLIC/LOGIN')
    .send({ email: 'martin@mail.com', password: 'securepassword' })
    .expect(200);

  expect(res.body.token).toBeTruthy();
});

test('Framework | the guard answers before the route is resolved', async () => {
  const res = await request(api)
    .get('/private/nope')
    .expect(401);

  expect(res.body.msg).toBe('No Authorization was found');
});

test('Framework | an authorised request to a missing guarded route is a 404', async () => {
  await request(api)
    .get('/private/nope')
    .set('Authorization', `Bearer ${token}`)
    .expect(404);
});

test('Framework | the guard does not cover the mount without a trailing slash', async () => {
  const res = await request(api)
    .get('/private')
    .expect(404);

  expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
});

test('Framework | the guard covers the mount with a trailing slash', async () => {
  const res = await request(api)
    .get('/private/')
    .expect(401);

  expect(res.body.msg).toBe('No Authorization was found');
});

test('Framework | a head request carries the length of the body it omits', async () => {
  const full = await request(api)
    .get('/private/users')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  const res = await request(api)
    .head('/private/users')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(res.headers['content-length']).toBe(full.headers['content-length']);
  expect(res.text).toBeFalsy();
});

test('Framework | a range request is ignored and the whole body is sent', async () => {
  const res = await request(api)
    .get('/private/users')
    .set('Authorization', `Bearer ${token}`)
    .set('Range', 'bytes=0-4')
    .expect(200);

  expect(res.headers['content-range']).toBeUndefined();
  expect(res.body.users).toBeTruthy();
});

test('Framework | a response is never compressed', async () => {
  const res = await request(api)
    .get('/private/users')
    .set('Authorization', `Bearer ${token}`)
    .set('Accept-Encoding', 'gzip')
    .expect(200);

  expect(res.headers['content-encoding']).toBeUndefined();
  expect(res.headers.vary).toBeUndefined();
});

// The router this replaces matched the path exactly as it was sent, so a . or
// .. segment never reached a route, while hapi resolves them before matching.
// The expected bytes below are what the original application answers.
const authGuard = require('../../api/plugins/authGuard');

const notFoundBody = (message) => NOT_FOUND_BODY.replace('Cannot GET /nope', message);

test('Framework | a dot segment never reaches the guarded route behind it', async () => {
  const res = await request(api)
    .get('/public/../private/users')
    .expect(404);

  expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
  expect(res.headers['content-security-policy']).toBe("default-src 'self'");
  expect(res.headers.etag).toBeUndefined();
  expect(res.text).toBe(notFoundBody('Cannot GET /public/../private/users'));
  expect(res.text).not.toContain('martin@mail.com');
});

test.each([
  ['GET', '/public/../private/users'],
  ['POST', '/public/../private/users'],
  ['DELETE', '/public/../private/users'],
  ['GET', '/x/../private/users'],
  ['POST', '/x/../private/users'],
  ['DELETE', '/x/../private/users'],
  ['GET', '/./public/login'],
  ['POST', '/./public/login'],
  ['DELETE', '/./public/login'],
  ['GET', '/public/./login'],
  ['POST', '/public/./login'],
  ['DELETE', '/public/./login'],
])('Framework | %s %s with a token is the 404 page for the path as sent', async (method, target) => {
  const res = await request(api)[method.toLowerCase()](target)
    .set('Authorization', `Bearer ${token}`)
    .send({ email: 'martin@mail.com', password: 'securepassword' })
    .expect(404);

  expect(res.text).toBe(notFoundBody(`Cannot ${method} ${target}`));
  expect(res.text).not.toContain('martin@mail.com');
  expect(res.text).not.toContain('token');
});

test('Framework | a dot segment path under /private is still guarded, then a 404', async () => {
  const denied = await request(api)
    .get('/private/../private/users')
    .expect(401);

  expect(denied.body).toEqual({ msg: 'No Authorization was found' });

  const res = await request(api)
    .get('/private/../private/users')
    .set('Authorization', `Bearer ${token}`)
    .expect(404);

  expect(res.text).toBe(notFoundBody('Cannot GET /private/../private/users'));
  expect(res.text).not.toContain('martin@mail.com');
});

test('Framework | the guard also judges the path the router is handed', async () => {
  let guard;

  authGuard.register({ ext: (event, method) => { guard = method; } });

  const h = {
    continue: Symbol('continue'),
    response: (payload) => ({
      code: (status) => ({ takeover: () => ({ payload, status }) }),
    }),
  };
  const requestFor = (pathname, path) => ({
    app: { pathname, body: {} },
    path,
    headers: {},
    query: {},
  });

  // An original path its own pattern does not cover, which hapi would still
  // route to /private/users, is answered by the guard all the same.
  expect(await guard(requestFor('/x/users', '/private/users'), h)).toEqual({
    payload: { msg: 'No Authorization was found' },
    status: 401,
  });
  expect(await guard(requestFor('/public/login', '/public/login'), h)).toBe(h.continue);
});

// supertest hands its URL to url.parse, which turns a backslash into a slash
// before anything is sent, so these requests go out through http.request with
// the target exactly as written. The expected bytes are, again, what the
// original application answers.
const http = require('http');

const CREDENTIALS = JSON.stringify({ email: 'martin@mail.com', password: 'securepassword' });

const sendRaw = (method, target, headers = {}, payload = '') => new Promise((resolve, reject) => {
  api.listen(0, '127.0.0.1', () => {
    const { port } = api.address();
    const req = http.request({
      host: '127.0.0.1',
      port,
      method,
      path: target.replace('<host>', `127.0.0.1:${port}`),
      headers,
      agent: false,
    }, (res) => {
      let text = '';

      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => api.close(() => resolve({ status: res.statusCode, text })));
    });

    req.on('error', (err) => api.close(() => reject(err)));
    req.end(payload);
  });
});

const jsonHeaders = (extra = {}) => Object.assign({
  'Content-Type': 'application/json',
  'Content-Length': Buffer.byteLength(CREDENTIALS),
}, extra);

test.each([
  ['POST', '/public\\login', 'Cannot POST /public%5Clogin'],
  ['GET', '/private\\users', 'Cannot GET /private%5Cusers'],
  ['GET', '/public\\..\\private\\users', 'Cannot GET /public%5C..%5Cprivate%5Cusers'],
  ['DELETE', '/x\\..\\private\\users', 'Cannot DELETE /x%5C..%5Cprivate%5Cusers'],
  ['POST', '/public/login\\', 'Cannot POST /public/login%5C'],
  ['POST', '/public\\login#x', 'Cannot POST /public/login'],
  ['POST', '/public/\\login#x', 'Cannot POST /public//login'],
])('Framework | %s %s with a token is the 404 page the backslash leaves', async (method, target, message) => {
  const res = await sendRaw(
    method,
    target,
    jsonHeaders({ Authorization: `Bearer ${token}` }),
    CREDENTIALS,
  );

  expect(res.status).toBe(404);
  expect(res.text).toBe(notFoundBody(message));
  expect(res.text).not.toContain('martin@mail.com');
  expect(res.text).not.toContain('token');
});

test('Framework | a backslash under /private is still guarded, then a 404', async () => {
  const denied = await sendRaw('GET', '/private/users\\');

  expect(denied.status).toBe(401);
  expect(JSON.parse(denied.text)).toEqual({ msg: 'No Authorization was found' });

  const res = await sendRaw('GET', '/private/users\\', { Authorization: `Bearer ${token}` });

  expect(res.status).toBe(404);
  expect(res.text).toBe(notFoundBody('Cannot GET /private/users%5C'));
  expect(res.text).not.toContain('martin@mail.com');
});

test('Framework | a backslash read as a slash by url.parse still reaches its route', async () => {
  const fragment = await sendRaw('POST', '/public/login\\#x', jsonHeaders(), CREDENTIALS);

  expect(fragment.status).toBe(200);
  expect(JSON.parse(fragment.text).token).toBeTruthy();

  const absolute = await sendRaw('POST', 'http://<host>/public\\login', jsonHeaders(), CREDENTIALS);

  expect(absolute.status).toBe(200);
  expect(JSON.parse(absolute.text).token).toBeTruthy();
});

test('Framework | a backslash after the query mark leaves the route alone', async () => {
  const res = await sendRaw('POST', '/public/login?next=a\\b', jsonHeaders(), CREDENTIALS);

  expect(res.status).toBe(200);
  expect(JSON.parse(res.text).token).toBeTruthy();
});
