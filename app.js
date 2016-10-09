var express = require('express');
var app = express();
var http = require('http').Server(app);
var fs = require('fs');
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var cookieParser = require('cookie-parser');
var bcrypt = require('bcrypt-nodejs');
var bodyParser = require('body-parser');
app.set('view engine', 'pug');
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
var mysql = require('mysql');
var mysqlOptions = {
    host : 'localhost',
    user : 'copper',
    password : 'copper_password123',
    database: 'copper',
};
var sessionStore = new MySQLStore(mysqlOptions);
var sessionMiddleware = session({
    key: 'session',
    secret: 'ProtectxorTheCybxors',
    name: 'session',
    resave: true,
    saveUninitialized: true,
    store: sessionStore
});
var connection = mysql.createConnection(mysqlOptions);
connection.connect();

var io = require('socket.io')(http);
io.engine.ws = new (require('uws').Server)({
    noServer: true,
    perMessageDeflate: true
});

io.use(function(socket, next) {
    sessionMiddleware(socket.request, socket.request.res, next);
});

app.use(sessionMiddleware);

io.on('connection', function(socket) {
    if (!socket.request.session.loggedin) {
        socket.emit('disco','no_session');
        socket.disconnect();
    }
    else {
        socket.on('get_objects', function(msg) {
            var mission = JSON.parse(msg);
            connection.query('SELECT * FROM objects WHERE mission = ?', [mission], function(err, rows, fields) {
                if (!err) {
                    socket.emit('all_objects',rows);
                }
            });
        });
        socket.on('get_links', function(msg) {
            var mission = JSON.parse(msg);
            connection.query('SELECT * FROM links WHERE mission = ?', [mission], function(err, rows, fields) {
                if (!err) {
                    for (i = 0; i < rows.length; i++) {
                        rows[i].type = 'link';
                    }
                    socket.emit('all_links',rows);
                }
            });
        });
        socket.on('get_events', function(msg) {
            var mission = JSON.parse(msg);
            connection.query('SELECT id, uuid, event_time, source_object, source_port, dest_object, dest_port, short_desc, (SELECT username FROM users WHERE users.id = analyst) as analyst FROM events WHERE mission = ? ORDER BY event_time ASC', [mission], function(err, rows, fields) {
                if (!err) {
                    socket.emit('all_events',rows);
                }
            });
        });
        socket.on('update_object', function(msg) {
            var o = JSON.parse(msg);
            console.log(o);
            if (o.type !== undefined && (o.type === 'node' || o.type === 'shape')) {
                connection.query('UPDATE objects SET type = ?, name = ?, address = ?, color = ?, image = ?, x = ?, y = ? WHERE uuid = ?', [o.type, o.name, o.address, o.color, o.image, o.x, o.y, o.uuid], function (err, results) {
                    if (!err) {
                        socket.broadcast.emit('update_object', msg);
                    }
                });
            }
        });
        socket.on('update_object_pos', function(msg) {
            var o = JSON.parse(msg);
            if (o.type !== undefined && (o.type === 'node' || o.type === 'shape')) {
                connection.query('UPDATE objects SET x = ?, y = ? WHERE uuid = ?', [o.x, o.y, o.uuid], function (err, results) {
                    if (!err) {
                        socket.broadcast.emit('update_object_pos', msg);
                    }
                });
            }
        });
        socket.on('update_event', function(msg) {
            var evt = JSON.parse(msg);
            connection.query('UPDATE events SET event_time = ?, source_object = ?, source_port = ?, dest_object = ?, dest_port = ?, short_desc = ?, analyst = ? WHERE id = ?', [evt.event_time, evt.source_object, evt.source_port, evt.dest_object, evt.dest_port, evt.short_desc, evt.analyst, evt.id], function (err, results) {
                if (!err) {
                    socket.broadcast.emit('update_event', msg);
                }
            });
        });
        socket.on('insert_event', function(msg) {
            var evt = JSON.parse(msg);
            connection.query('INSERT INTO events (mission, event_time, source_object, source_port, dest_object, dest_port, analyst) values (?, ?, ?, ?, ?, ?, ?)', [evt.mission, evt.event_time, evt.source_object, evt.source_port, evt.dest_object, evt.dest_port, evt.analyst], function (err, results) {
                if (!err) {
                    evt.id = results.insertId;
                    io.emit('insert_event', JSON.stringify(evt));
                }
            });
        });
        socket.on('insert_object', function(msg) {
            var o = JSON.parse(msg);
            console.log(o);
            if (o.type === 'node' || o.type === 'shape') {
                connection.query('INSERT INTO objects (mission, type, name, address, color, image, x, y, width, height) values (?, ?, ?, ?, ?, ?, 64, 64, 64, 64)', [o.mission, o.type, o.name, o.address, o.color, o.image], function (err, results) {
                    if (!err) {
                        o.id = results.insertId;
                        connection.query('SELECT * FROM objects WHERE id = ?', [o.id], function(err, rows, fields) {
                            if (!err) {
                                socket.emit('insert_object',JSON.stringify(rows[0]));
                            }
                        });
                    }
                });
            } else if (o.type === 'link') {
                connection.query('INSERT INTO links (mission, node_a, node_b) values (?, ?, ?)', [o.mission, o.node_a, o.node_b], function (err, results) {
                    if (!err) {
                        o.id = results.insertId;
                        connection.query('SELECT * FROM links WHERE id = ?', [o.id], function(err, rows, fields) {
                            if (!err) {
                                rows[0].type = 'link';
                                io.emit('insert_object', JSON.stringify(rows[0]));
                            }
                        });
                    }
                });
            }
        });
        socket.on('delete_object', function(msg) {
            var o = JSON.parse(msg);
            if (o.type !== undefined && o.type === 'node') {
                connection.query('DELETE FROM objects WHERE uuid = ?', [o.uuid], function (err, results) {
                    if (!err) {
                        io.emit('delete_object', JSON.stringify(o.uuid));
                    }
                });
            }
        });
    }
});

app.get('/', function (req, res) {
    if (req.session.loggedin) {
            res.render('index', { title: 'CS-COP'});
    } else {
       res.redirect('/login');
    }
});

app.get('/logout', function (req, res) {
    req.session.destroy();
    res.redirect('/login');
});

app.post('/api', function (req, res) {
    res.writeHead(200, {"Content-Type": "application/json"});
    if (req.body.table !== undefined && req.body.table === 'missions') {
        if (req.body.action !== undefined && req.body.action === 'select') {
            connection.query("SELECT id, name, start_date, (SELECT username FROM users WHERE users.id = id) as analyst FROM missions", function(err, rows, fields) {
                if (!err) {
                    res.end(JSON.stringify(rows));
                }
            });
        } else if (req.body.action !== undefined && req.body.action === 'update' && req.body.row !== undefined) {
            var row = JSON.parse(req.body.row);
            connection.query('UPDATE missions SET name = ?, start_date = ?, analyst = ? WHERE id = ?', [row.name, row.start_date, row.analyst, row.id], function (err, results) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                }
            });
        } else if (req.body.action !== undefined && req.body.action === 'insert' && req.body.row !== undefined) {
            var row = JSON.parse(req.body.row);
            connection.query('INSERT INTO missions (name, start_date, analyst) values (?, ?, ?)', [row.name, row.start_date, row.analyst], function (err, results) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                }
            });
        } else if (req.body.action !== undefined && req.body.action === 'delete' && req.body.id !== undefined) {
            var id = JSON.parse(req.body.id);
            connection.query('DELETE FROM missions WHERE id = ?', [id], function (err, results) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                }
            });
        }
    } else if (req.body.table !== undefined && req.body.table === 'users') {
        if (req.body.action !== undefined && req.body.action === 'select') {
            connection.query("SELECT id, username, access_level FROM users", function(err, rows, fields) {
                if (!err) {
                    res.end(JSON.stringify(rows));
                }
            });
        } else if (req.body.action !== undefined && req.body.action === 'update' && req.body.row !== undefined) {
            var row = JSON.parse(req.body.row);
            connection.query('UPDATE missions SET name = ?, start_date = ?, analyst = ? WHERE id = ?', [row.name, row.start_date, row.analyst, row.id], function (err, results) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                }
            });
        } else if (req.body.action !== undefined && req.body.action === 'insert' && req.body.row !== undefined) {
            var row = JSON.parse(req.body.row);
            connection.query('INSERT INTO missions (name, start_date, analyst) values (?, ?, ?)', [row.name, row.start_date, row.analyst], function (err, results) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                }
            });
        } else if (req.body.action !== undefined && req.body.action === 'delete' && req.body.id !== undefined) {
            var id = JSON.parse(req.body.id);
            connection.query('DELETE FROM missions WHERE id = ?', [id], function (err, results) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                }
            });
        }
    }
});

app.get('/cop', function (req, res) {
    if (req.session.loggedin) {
        if (req.query.mission !== undefined && req.query.mission > 0) {
            fs.readdir('./public/images/icons', function(err, items) {
                fs.readdir('./public/images/shapes', function(err, shapes) {
                    res.render('cop', { title: 'CS-COP', icons: items, shapes: shapes});

                });
            });

        } else {
            res.redirect('/');
        }
    } else {
       res.redirect('/login');
    }
});

app.post('/login', function (req, res) {
    if (req.body.username !== undefined && req.body.username !== '' && req.body.password !== undefined && req.body.password !== '') {
        connection.query('SELECT password FROM users WHERE username = ?', [req.body.username], function (err, rows, fields) {
            if (!err) {
                if (rows.length === 1) {
                    bcrypt.compare(req.body.password, rows[0].password, function(err, bres) {
                        if (bres) {
                            req.session.loggedin = true;
                            res.redirect('/login');
                        } else
                            res.render('login', { title: 'CS-COP', message: 'Invalid username or password.' });
                    });
                } else {
                    res.render('login', { title: 'CS-COP', message: 'Invalid username or password.' });
                }
            }
        });
    } else {
        res.render('login', { title: 'CS-COP', message: 'Invalid username or password.' });
    }
});

app.get('/login', function (req, res) {
    if (req.session.loggedin)
        res.redirect('/');
    else
        res.render('login', { title: 'CS-COP Login' });
});

http.listen(3000, function () {
    console.log('Server listening on port 3000!');
});
