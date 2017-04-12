var DB = require('sharedb').DB;

// Postgres-backed ShareDB database

function MySQLDB(connection) {
  if (!(this instanceof MySQLDB)) return new MySQLDB(connection);
  DB.call(this, connection);
  this.closed = false;
  this.connection = connection;
};
module.exports = MySQLDB;

MySQLDB.prototype = Object.create(DB.prototype);

MySQLDB.prototype.close = function(callback) {
  this.closed = true;
  if (callback) callback();
};

// Persists an op and snapshot if it is for the next version. Calls back with
// callback(err, succeeded)
MySQLDB.prototype.commit = function(collection, id, op, snapshot, options, callback) {
  /*
   * op: CreateOp {
   *   src: '24545654654646',
   *   seq: 1,
   *   v: 0,
   *   create: { type: 'http://sharejs.org/types/JSONv0', data: { ... } },
   *   m: { ts: 12333456456 } }
   * }
   * snapshot: PostgresSnapshot
   */
    var self = this;
    self.connection.query('SELECT max(version) AS max_version FROM ops WHERE collection = ? AND doc_id = ?', [collection, id], function(err, rows, fields) {
        var max_version = rows[0].max_version;
        if (max_version == null)
            max_version = 0;
        if (snapshot.v !== max_version + 1) {
            return callback(null, false);
        }
        self.connection.query('START TRANSACTION', function(err) {
            console.log('c ' + collection, 'i: '+ id, 'sv: ' + snapshot.v, 'op: ' + op);
            self.connection.query('INSERT INTO ops (collection, doc_id, version, operation) VALUES (?, ?, ?, ?)', [collection, id, snapshot.v, JSON.stringify(op)], function(err) {
                if (err) {
                    // TODO: if err is "constraint violation", callback(null, false) instead
                    self.connection.query('ROLLBACK');
                    callback(err);
                    return;
                }
                if (snapshot.v === 1) {
                    self.connection.query('INSERT INTO snapshots (collection, doc_id, doc_type, version, data) VALUES (?, ?, ?, ?, ?)', [collection, id, snapshot.type, snapshot.v, JSON.stringify(snapshot.data)], function(err) {
                        // TODO:
                        // if the insert was successful and did insert, callback(null, true)
                        // if the insert was successful and did not insert, callback(null, false)
                        // if there was an error, rollback and callback(error)
                        if (err) {
                            self.connection.query('ROLLBACK');
                            callback(err);
                            return;
                        }
                        self.connection.query('COMMIT', function(err) {
                            if (err)
                                callback(err);
                            else
                                callback(null, true);
                        });
                    });
                } else {
                    self.connection.query('UPDATE snapshots SET doc_type = ?, version = ?, data = ? WHERE collection = ? AND doc_id = ? AND version = (? - 1)', [snapshot.type, snapshot.v, JSON.stringify(snapshot.data), collection, id, snapshot.v], function(err) {
                        // TODO:
                        // if any rows were updated, success
                        // if 0 rows were updated, rollback and not success
                        // if error, rollback and not success
                        if (err) {
                            self.connection.query('ROLLBACK');
                            callback(err);
                            return;
                        }
                        self.connection.query('COMMIT', function(err) {
                            if (err)
                                callback(err);
                            else
                                callback(null, true);
                        });
                    });
                }
            });
        })
    });
};

// Get the named document from the database. The callback is called with (err,
// snapshot). A snapshot with a version of zero is returned if the docuemnt
// has never been created in the database.
MySQLDB.prototype.getSnapshot = function(collection, id, fields, options, callback) {
    this.connection.query('SELECT version, data, doc_type FROM snapshots WHERE collection = ? AND doc_id = ? LIMIT 1', [collection, id], function(err, rows) {
        if (err) {
          callback(err);
          return;
        }
        if (rows.length) {
            var row = rows[0]
            var snapshot = new PostgresSnapshot(id, row.version, row.doc_type, JSON.parse(row.data), undefined); // TODO: metadata
            callback(null, snapshot);
        } else {
            var snapshot = new PostgresSnapshot(id, 0, null, undefined, undefined);
            callback(null, snapshot);
        }
    });
};

// Get operations between [from, to) noninclusively. (Ie, the range should
// contain start but not end).
//
// If end is null, this function should return all operations from start onwards.
//
// The operations that getOps returns don't need to have a version: field.
// The version will be inferred from the parameters if it is missing.
//
// Callback should be called as callback(error, [list of ops]);
MySQLDB.prototype.getOps = function(collection, id, from, to, options, callback) {
    this.connection.query('SELECT version, operation FROM ops WHERE collection = ? AND doc_id = ? AND version >= ? AND version < ?', [collection, id, from, to], function(err, rows) {
        if (err) {
            callback(err);
            return;
        }
        callback(null, rows.map(function(row) {
           return row.operation;
        }));
    });
};

function PostgresSnapshot(id, version, type, data, meta) {
    this.id = id;
    this.v = version;
    this.type = type;
    this.data = data;
    this.m = meta;
};
