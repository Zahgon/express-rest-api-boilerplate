const MOUNTS = ['/public', '/private'];

// hapi decodes a path before matching it, so a request for /public/%6Cogin
// would reach the login route; the router it replaces compared the raw,
// still-encoded path and answered 404. Anything carrying an escape is sent to
// a path no declared route can serve.
const UNMATCHED = '/-no-such-route-';

// hapi also resolves . and .. segments before matching, so
// /public/../private/users would reach the users route; the router it replaces
// matched the path as sent, where no route has such a segment, and answered
// 404. A path carrying one is sent to the same place as an escaped one.
const DOT_SEGMENT_REGEXP = /\/\.\.?(?=\/|$)/;

const mountOf = (pathname) => {
  const lowered = pathname.toLowerCase();

  return MOUNTS.find((mount) => lowered.indexOf(`${mount}/`) === 0);
};

// hapi reads a backslash as a slash, while the router it replaces kept one in
// the original path as an ordinary character that no route matches, so such a
// path is rerouted as well. When url.parse had to read the original URL (it
// carries a '#', say), its backslashes are slashes there and the mount
// matched; but that router then cut the mount off the URL as sent and parsed
// the rest again, so a backslash right after the mount left a path starting
// '//' that no route serves.
const backslashAfterMount = (pathname, target = '') => {
  const mount = mountOf(pathname);

  if (!mount || target.charAt(0) !== '/') {
    return false;
  }

  const rest = pathname.slice(mount.length);
  const cut = mount.length + (rest.indexOf('//') === 0 || rest === '/' ? 1 : 0);

  return target.charAt(cut) === '\\';
};

const normalise = (pathname) => {
  const mount = mountOf(pathname);

  if (!mount) {
    return pathname;
  }

  let rest = pathname.slice(mount.length);

  // The mount consumes exactly one slash, so /public//login reaches the router
  // as /login while /public///login reaches it as //login and misses.
  if (rest.indexOf('//') === 0) {
    rest = rest.slice(1);
  }

  // Strict routing is off, so a single trailing slash is optional.
  if (rest.length > 1 && rest.lastIndexOf('/') === rest.length - 1) {
    rest = rest.slice(0, -1);
  }

  return mount + rest;
};

// The path the router is handed: the one hapi parsed itself, unless the
// original path has to be rerouted. The guard reads it too, so the guard and
// the router always judge the same path.
const routedPath = (request) => {
  const { pathname, target } = request.app;

  if (pathname.indexOf('%') !== -1
    || pathname.indexOf('\\') !== -1
    || DOT_SEGMENT_REGEXP.test(pathname)
    || backslashAfterMount(pathname, target)) {
    return UNMATCHED;
  }

  const normalised = normalise(pathname);

  return normalised === pathname ? request.path : normalised;
};

const routing = {
  name: 'routing',
  register: (server) => {
    server.ext('onRequest', (request, h) => {
      const path = routedPath(request);

      if (path !== request.path) {
        request.setUrl(`${path}${request.app.search}`);
      }

      return h.continue;
    });
  },
};

module.exports = routing;
module.exports.normalise = normalise;
module.exports.routedPath = routedPath;
