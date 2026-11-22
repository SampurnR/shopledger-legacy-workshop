var isDeepStrictEqual = require('util').isDeepStrictEqual;

// Save the response with the mutation so a retry can replay a committed result.
exports.start = function (db, req, res, scope) {
  var key = req.headers && req.headers['idempotency-key'];
  if (key == null) return function () {};
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(key)) {
    res.status(400).json({ error: 'Invalid Idempotency-Key' });
    return null;
  }

  var id = scope + ':' + key;
  var existing = db.requestLog && db.requestLog[id];
  if (existing) {
    if (isDeepStrictEqual(existing.body, req.body)) {
      res.status(201).json(existing.result);
    } else {
      res.status(409).json({ error: 'This request key was already used for a different submission' });
    }
    return null;
  }

  return function (result) {
    if (!db.requestLog) db.requestLog = {};
    db.requestLog[id] = JSON.parse(JSON.stringify({ body: req.body, result: result }));
  };
};
