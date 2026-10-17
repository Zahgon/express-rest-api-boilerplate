const contentType = require('content-type');
const createError = require('http-errors');
const querystring = require('querystring');
const rawBody = require('raw-body');
const typeis = require('type-is');
const zlib = require('zlib');

const { errorMessage, errorPage } = require('./respond');

const LIMIT = '100kb';
const PARAMETER_LIMIT = 1000;

// Whitespace allowed before the first significant character, per RFC 7159.
const FIRST_CHAR_REGEXP = /^[\x20\x09\x0a\x0d]*(.)/; // eslint-disable-line no-control-regex

const charsetError = (charset) => createError(415, `unsupported charset "${charset.toUpperCase()}"`, {
  charset: charset.toLowerCase(),
  type: 'charset.unsupported',
});

const getCharset = (req) => {
  try {
    return (contentType.parse(req).parameters.charset || '').toLowerCase();
  } catch (e) {
    return undefined;
  }
};

const contentStream = (req) => {
  const encoding = (req.headers['content-encoding'] || 'identity').toLowerCase();

  if (encoding === 'deflate') {
    return { stream: req.pipe(zlib.createInflate()), length: undefined };
  }

  if (encoding === 'gzip') {
    return { stream: req.pipe(zlib.createGunzip()), length: undefined };
  }

  if (encoding === 'identity') {
    return { stream: req, length: req.headers['content-length'] };
  }

  throw createError(415, `unsupported content encoding "${encoding}"`, {
    encoding,
    type: 'encoding.unsupported',
  });
};

// The error page is only written once the request has been read to the end,
// so that the connection survives a rejected body instead of being closed.
const drain = (req) => new Promise((resolve) => {
  if (req.complete) {
    resolve();

    return;
  }

  req.on('end', resolve);
  req.on('close', resolve);
  req.on('error', resolve);
  req.resume();
});

const read = async (req, charset) => {
  const { stream, length } = contentStream(req);

  try {
    return await rawBody(stream, { encoding: charset, length, limit: LIMIT });
  } catch (err) {
    if (err.type === 'encoding.unsupported') {
      throw charsetError(charset);
    }

    stream.resume();

    throw createError(400, err);
  }
};

/* eslint-disable no-param-reassign */
const normalizeJsonSyntaxError = (error, props) => {
  Object.getOwnPropertyNames(error).forEach((key) => {
    if (key !== 'stack' && key !== 'message') {
      delete error[key];
    }
  });

  Object.keys(props).forEach((key) => {
    error[key] = props[key];
  });

  return error;
};
/* eslint-enable no-param-reassign */

// Reproduces the native parser's wording for a strict-mode violation by
// re-parsing the offending prefix with a sentinel character.
const createStrictSyntaxError = (str, char) => {
  const index = str.indexOf(char);
  const partial = `${str.substring(0, index)}#`;

  try {
    JSON.parse(partial);

    throw new SyntaxError('strict violation');
  } catch (e) {
    return normalizeJsonSyntaxError(e, {
      message: e.message.replace('#', char),
      stack: e.stack,
    });
  }
};

const parseJson = (body) => {
  if (body.length === 0) {
    return {};
  }

  const first = FIRST_CHAR_REGEXP.exec(body)[1];

  if (first !== '{' && first !== '[') {
    throw createStrictSyntaxError(body, first);
  }

  try {
    return JSON.parse(body);
  } catch (e) {
    throw normalizeJsonSyntaxError(e, { stack: e.stack });
  }
};

const parameterCount = (body, limit) => {
  let count = 0;
  let index = body.indexOf('&');

  while (index !== -1) {
    count += 1;

    if (count === limit) {
      return undefined;
    }

    index = body.indexOf('&', index + 1);
  }

  return count;
};

const parseUrlencoded = (body) => {
  if (body.length === 0) {
    return {};
  }

  if (parameterCount(body, PARAMETER_LIMIT) === undefined) {
    throw createError(413, 'too many parameters', { type: 'parameters.too.many' });
  }

  return querystring.parse(body, undefined, undefined, { maxKeys: PARAMETER_LIMIT });
};

const parseBody = async (req) => {
  if (!typeis.hasBody(req)) {
    return {};
  }

  if (typeis(req, 'application/x-www-form-urlencoded')) {
    const charset = getCharset(req) || 'utf-8';

    if (charset !== 'utf-8') {
      throw charsetError(charset);
    }

    const raw = await read(req, charset);

    try {
      return parseUrlencoded(raw);
    } catch (err) {
      throw createError(400, err);
    }
  }

  if (typeis(req, 'application/json')) {
    const charset = getCharset(req) || 'utf-8';

    if (charset.substr(0, 4) !== 'utf-') {
      throw charsetError(charset);
    }

    const raw = await read(req, charset);

    try {
      return parseJson(raw);
    } catch (err) {
      throw createError(400, err);
    }
  }

  return {};
};

const body = {
  name: 'body',
  register: (server) => {
    server.ext('onRequest', async (request, h) => {
      try {
        request.app.body = await parseBody(request.raw.req);
      } catch (err) {
        const status = err.status || err.statusCode || 400;

        await drain(request.raw.req);

        return errorPage(h, status, errorMessage(err, status)).takeover();
      }

      return h.continue;
    });
  },
};

module.exports = body;
