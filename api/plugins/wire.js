/**
 * The order and the capitalisation Express put on the wire. hapi lower-cases
 * every response header name and emits them in its own order, and neither is
 * configurable, so the canonical form is restored on the raw response.
 */
const HEADER_ORDER = [
  'X-Powered-By',
  'Access-Control-Allow-Origin',
  'Access-Control-Allow-Methods',
  'Vary',
  'Access-Control-Allow-Headers',
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'X-XSS-Protection',
  'Content-Security-Policy',
  'Content-Type',
  'Content-Length',
  'ETag',
];

// hapi adds these two of its own accord; the Express application never sent them.
const DROPPED = ['cache-control', 'accept-ranges'];

/* eslint-disable no-param-reassign */
const applyWireFormat = (res) => {
  const pending = new Map();
  const setHeader = res.setHeader.bind(res);
  const removeHeader = res.removeHeader.bind(res);
  const writeHead = res.writeHead.bind(res);

  res.setHeader = (name, value) => {
    pending.set(String(name).toLowerCase(), value);
    return res;
  };

  res.getHeader = (name) => pending.get(String(name).toLowerCase());

  res.hasHeader = (name) => pending.has(String(name).toLowerCase());

  res.removeHeader = (name) => {
    pending.delete(String(name).toLowerCase());
    removeHeader(name);
  };

  res.writeHead = (...args) => {
    DROPPED.forEach((name) => pending.delete(name));

    // res.send() drops the entity headers on a 304 before writing it.
    if (args[0] === 304) {
      pending.delete('content-type');
      pending.delete('content-length');
    }

    HEADER_ORDER.forEach((name) => {
      const key = name.toLowerCase();

      if (pending.has(key)) {
        setHeader(name, pending.get(key));
        pending.delete(key);
      }
    });

    pending.forEach((value, key) => setHeader(key, value));
    pending.clear();

    return writeHead(...args);
  };
};
/* eslint-enable no-param-reassign */

module.exports = applyWireFormat;
