const encodeUrl = require('encodeurl');
const escapeHtml = require('escape-html');
const etag = require('etag');
const fresh = require('fresh');
const http = require('http');
const url = require('url');

const applyWireFormat = require('./wire');

const NEWLINE_REGEXP = /\n/g;
const DOUBLE_SPACE_REGEXP = /\x20{2}/g; // eslint-disable-line no-control-regex

const environment = process.env.NODE_ENV || 'development';

const DOCUMENT_HEAD = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="utf-8">',
  '<title>Error</title>',
  '</head>',
  '<body>',
  '',
].join('\n');

const DOCUMENT_TAIL = ['', '</body>', '</html>', ''].join('\n');

const createHtmlDocument = (message) => {
  const body = escapeHtml(message)
    .replace(NEWLINE_REGEXP, '<br>')
    .replace(DOUBLE_SPACE_REGEXP, ' &nbsp;');

  return `${DOCUMENT_HEAD}<pre>${body}</pre>${DOCUMENT_TAIL}`;
};

// Only the stack is rendered off production, exactly as the old handler did.
const errorMessage = (err, status) => {
  if (environment !== 'production') {
    return err.stack || String(err);
  }

  return http.STATUS_CODES[status];
};

const errorPage = (h, status, message) => h
  .response(createHtmlDocument(message))
  .code(status)
  .type('text/html; charset=utf-8')
  .header('Content-Security-Policy', "default-src 'self'")
  .header('X-Content-Type-Options', 'nosniff');

const notFoundPage = (h, request) => errorPage(
  h,
  404,
  `Cannot ${request.raw.req.method} ${encodeUrl(request.app.pathname)}`,
);

// The characters that sent the old URL parser off its fast path to url.parse.
const SLOW_PARSE_REGEXP = /[\t\n\f\r #\u00a0\ufeff]/;

// The original URL, read the way the old stack read it. A target that starts
// with a slash and holds none of those characters is only split at its first
// '?', so a backslash in it stays a backslash; anything else goes through
// url.parse, which reads a backslash as a slash.
const parseTarget = (target) => {
  if (target.charAt(0) !== '/' || SLOW_PARSE_REGEXP.test(target)) {
    return url.parse(target);
  }

  const query = target.indexOf('?');

  return query === -1
    ? { pathname: target, search: null }
    : { pathname: target.slice(0, query), search: target.slice(query) };
};

const respond = {
  name: 'respond',
  register: (server) => {
    server.ext('onRequest', (request, h) => {
      applyWireFormat(request.raw.res);

      // The original URL, before any normalisation, is what the 404 page
      // reported and what the private-route guard was matched against.
      const parsed = parseTarget(request.raw.req.url);

      request.app.target = request.raw.req.url;
      request.app.pathname = parsed.pathname;
      request.app.search = parsed.search || '';

      return h.continue;
    });

    server.route({
      method: '*',
      path: '/{any*}',
      handler: (request, h) => notFoundPage(h, request),
    });

    server.ext('onPreResponse', (request, h) => {
      const { response } = request;

      if (response.isBoom) {
        const status = response.output.statusCode;

        if (status === 404) {
          return notFoundPage(h, request);
        }

        return errorPage(h, status, errorMessage(response, status));
      }

      if (response.variety !== 'plain'
        || response.source === null
        || typeof response.source !== 'object') {
        return h.continue;
      }

      const { method } = request.raw.req;
      const status = response.statusCode;
      const body = JSON.stringify(response.source);
      const tag = etag(Buffer.from(body, 'utf8'), { weak: true });

      response.source = body;
      response.type('application/json; charset=utf-8');
      response.header('ETag', tag);

      const cacheable = (status >= 200 && status < 300) || status === 304;

      if ((method === 'GET' || method === 'HEAD')
        && cacheable
        && fresh(request.raw.req.headers, { etag: tag })) {
        response.code(304);
        response.source = '';
      }

      return h.continue;
    });
  },
};

module.exports = respond;
module.exports.errorPage = errorPage;
module.exports.errorMessage = errorMessage;
