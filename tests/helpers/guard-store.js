'use strict';

// Imported before server.js in HTTP tests. Any accidental real-store access
// fails rather than reading or writing the tracked workshop database.
const store = require('../../lib/store');
function forbidden() {
  throw new Error('Tests must never access data/db.json; inject an in-memory store');
}
store.read = forbidden;
store.write = forbidden;
module.exports = store;
