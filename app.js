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
    user : 'mcscop',
    password : 'mcscoppassword123',
    database: 'mcscop',
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
        socket.on('join', function (msg) {
            socket.room = msg;
            socket.join(msg);
        });
        socket.on('get_objects', function(msg) {
            var mission = JSON.parse(msg);
            connection.query('SELECT * FROM objects WHERE mission = ?', [mission], function(err, rows, fields) {
                if (!err) {
                    socket.emit('all_objects',rows);
                } else
                    console.log(err);
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
                } else
                    console.log(err);
            });
        });
        socket.on('get_events', function(msg) {
            var mission = JSON.parse(msg);
            connection.query('SELECT id, uuid, event_time, source_object, source_port, dest_object, dest_port, short_desc, (SELECT username FROM users WHERE users.id = analyst) as analyst FROM events WHERE mission = ? ORDER BY event_time ASC', [mission], function(err, rows, fields) {
                if (!err) {
                    socket.emit('all_events',rows);
                } else
                    console.log(err);
            });
        });
        socket.on('get_details', function(msg, fn) {
            var uuid = msg;
            connection.query('SELECT details FROM objects WHERE uuid = ?', [uuid], function(err, rows, fields) {
                if (!err) {
                    fn(rows[0].details);
                } else
                    console.log(err);
            });
        });
        socket.on('change_object', function(msg) {
            var o = JSON.parse(msg);
            if (o.type !== undefined) {
                if (o.type === 'object') {
                    connection.query('UPDATE objects SET type = ?, name = ?, fill_color = ?, stroke_color = ?, image = ?, x = ?, y = ? WHERE uuid = ?', [o.type, o.name, o.fill_color, o.stroke_color, o.image, o.x, o.y, o.uuid], function (err, results) {
                        if (!err) {
                            io.in(socket.room).emit('change_object', msg);
                        } else
                            console.log(err);
                    });
                } else if (o.type === 'link') {
                    connection.query('UPDATE links SET name = ?, stroke_color = ? WHERE uuid = ?', [o.name, o.stroke_color, o.uuid], function (err, results) {
                        if (!err) {
                            socket.broadcast.in(socket.room).emit('change_object', msg);
                        } else
                            console.log(err);
                    });
                }
            }
        });
        socket.on('change_link', function(msg) {
            var o = JSON.parse(msg);
            if (o.type !== undefined && o.type === 'link') {
            }
        });
        socket.on('move_object', function(msg) {
            var o = JSON.parse(msg);
            if (o.type !== undefined && o.type === 'object') {
                connection.query('UPDATE objects SET x = ?, y = ?, z = ?, scale_x = ?, scale_y = ? WHERE uuid = ?', [o.x, o.y, o.z, o.scale_x, o.scale_y, o.uuid], function (err, results) {
                    if (!err) {
                        socket.broadcast.in(socket.room).emit('move_object', msg);
                    } else
                        console.log(err);
                });
            }
        });
        socket.on('update_event', function(msg) {
            var evt = JSON.parse(msg);
            evt.analyst = socket.request.session.user_id;
            connection.query('UPDATE events SET event_time = ?, source_object = ?, source_port = ?, dest_object = ?, dest_port = ?, short_desc = ?, analyst = ? WHERE id = ?', [evt.event_time, evt.source_object, evt.source_port, evt.dest_object, evt.dest_port, evt.short_desc, evt.analyst, evt.id], function (err, results) {
                if (!err) {
                    socket.broadcast.in(socket.room).emit('update_event', msg);
                } else
                    console.log(err);
            });
        });
        socket.on('update_details', function(msg) {
            var o = JSON.parse(msg);
            connection.query('UPDATE objects SET details = ? WHERE uuid = ?', [o.details, o.uuid], function (err, results) {
                if (!err) {
                } else
                    console.log(err);
            });
        });
        socket.on('insert_event', function(msg) {
            var evt = JSON.parse(msg);
            evt.analyst = socket.request.session.user_id;
            connection.query('INSERT INTO events (mission, event_time, source_object, source_port, dest_object, dest_port, short_desc, analyst) values (?, ?, ?, ?, ?, ?, ?, ?)', [evt.mission, evt.event_time, evt.source_object, evt.source_port, evt.dest_object, evt.dest_port, evt.short_desc, evt.analyst], function (err, results) {
                if (!err) {
                    evt.id = results.insertId;
                    io.in(socket.room).emit('insert_event', JSON.stringify(evt));
                } else
                    console.log(err);
            });
        });
        socket.on('delete_event', function(msg) {
            var evt = JSON.parse(msg);
            connection.query('DELETE FROM events WHERE id = ?', [evt.id], function (err, results) {
                if (!err) {
                    socket.broadcast.in(socket.room).emit('delete_event', JSON.stringify(evt));
                } else
                    console.log(err);
            });
        });
        socket.on('insert_link', function(msg) {
            var link = JSON.parse(msg);
            connection.query('INSERT INTO links (mission, name, stroke_color, node_a, node_b) values (?, ?, ?, ?, ?)', [link.mission, link.name, link.stroke_color, link.node_a, link.node_b], function (err, results) {
                if (!err) {
                    link.id = results.insertId;
                    connection.query('SELECT * FROM links WHERE id = ?', [link.id], function(err, rows, fields) {
                        if (!err) {
                                io.in(socket.room).emit('insert_link', JSON.stringify(rows[0]));
                            } else
                                console.log(err);
                        });
                } else
                    console.log(err);
            });
        });
        socket.on('insert_object', function(msg) {
            var o = JSON.parse(msg);
            if (o.type === 'object') {
                connection.query('INSERT INTO objects (mission, type, name, fill_color, stroke_color, image, x, y, width, height) values (?, ?, ?, ?, ?, ?, 64, 64, 64, 64)', [o.mission, o.type, o.name, o.fill_color, o.stroke_color, o.image], function (err, results) {
                    if (!err) {
                        o.id = results.insertId;
                        connection.query('SELECT * FROM objects WHERE id = ?', [o.id], function(err, rows, fields) {
                            if (!err) {
                                io.in(socket.room).emit('insert_object',JSON.stringify(rows[0]));
                            } else
                                console.log(err);
                        });
                    } else
                        console.log(err);
                });
            } else if (o.type === 'link') {
                connection.query('INSERT INTO links (mission, node_a, node_b) values (?, ?, ?)', [o.mission, o.node_a, o.node_b], function (err, results) {
                    if (!err) {
                        o.id = results.insertId;
                        connection.query('SELECT * FROM links WHERE id = ?', [o.id], function(err, rows, fields) {
                            if (!err) {
                                rows[0].type = 'link';
                                io.in(socket.room).emit('insert_object', JSON.stringify(rows[0]));
                            } else
                                console.log(err);
                        });
                    } else
                        console.log(err);
                });
            }
        });
        socket.on('delete_object', function(msg) {
            var o = JSON.parse(msg);
            if (o.type !== undefined) {
                if (o.type === 'object') {
                    connection.query('DELETE FROM objects WHERE uuid = ?', [o.uuid], function (err, results) {
                        if (!err) {
                            io.in(socket.room).emit('delete_object', JSON.stringify(o.uuid));
                            connection.query('SELECT uuid FROM links WHERE node_a = ? OR node_b = ?', [o.uuid, o.uuid], function(err, rows, results) {
                                if (!err) {
                                    for (var r = 0; r < rows.length; r++) {
                                        console.log(rows[r]);
                                        io.in(socket.room).emit('delete_object', JSON.stringify(rows[r].uuid));
                                        connection.query('DELETE FROM links WHERE uuid = ?', [rows[r].uuid], function(err, results) {
                                        });
                                    }
                                } else
                                    console.log(err);
                            });
                        } else
                            console.log(err);
                    });
                } else if (o.type === 'link') {
                    connection.query('DELETE FROM links WHERE uuid = ?', [o.uuid], function (err, results) {
                        if (!err) {
                            io.in(socket.room).emit('delete_object', JSON.stringify(o.uuid));
                        } else
                            console.log(err);
                    });
                }
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
                } else
                    console.log(err);
            });
        } else if (req.body.action !== undefined && req.body.action === 'update' && req.body.row !== undefined) {
            var row = JSON.parse(req.body.row);
            connection.query('UPDATE missions SET name = ?, start_date = ?, analyst = ? WHERE id = ?', [row.name, row.start_date, row.analyst, row.id], function (err, results) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                } else
                    console.log(err);
            });
        } else if (req.body.action !== undefined && req.body.action === 'insert' && req.body.row !== undefined) {
            var row = JSON.parse(req.body.row);
            connection.query('INSERT INTO missions (name, start_date, analyst) values (?, ?, ?)', [row.name, row.start_date, row.analyst], function (err, results) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                } else
                    console.log(err);
            });
        } else if (req.body.action !== undefined && req.body.action === 'delete' && req.body.id !== undefined) {
            var id = JSON.parse(req.body.id);
            connection.query('DELETE FROM missions WHERE id = ?', [id], function (err, results) {
                if (!err) {
                    connection.query('DELETE FROM objects WHERE id = ?', [id], function (err, results) {
                        if (!err) {
                            connection.query('DELETE FROM links WHERE id = ?', [id], function (err, results) {
                                if (!err) {
                                    res.end(JSON.stringify('OK'));
                                } else
                                    console.log(err);
                            });
                        } else
                            console.log(err);
                    });
                } else
                    console.log(err);
            });
        }
    } else if (req.body.table !== undefined && req.body.table === 'users') {
        if (req.body.action !== undefined && req.body.action === 'select') {
            connection.query("SELECT id, username, access_level FROM users", function(err, rows, fields) {
                if (!err) {
                    res.end(JSON.stringify(rows));
                } else
                    console.log(err);
            });
        } else if (req.body.action !== undefined && req.body.action === 'update' && req.body.row !== undefined) {
            var row = JSON.parse(req.body.row);
            connection.query('UPDATE missions SET name = ?, start_date = ?, analyst = ? WHERE id = ?', [row.name, row.start_date, row.analyst, row.id], function (err, results) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                } else
                    console.log(err);
            });
        } else if (req.body.action !== undefined && req.body.action === 'insert' && req.body.row !== undefined) {
            var row = JSON.parse(req.body.row);
            connection.query('INSERT INTO missions (name, start_date, analyst) values (?, ?, ?)', [row.name, row.start_date, row.analyst], function (err, results) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                } else
                    console.log(err);
            });
        } else if (req.body.action !== undefined && req.body.action === 'delete' && req.body.id !== undefined) {
            var id = JSON.parse(req.body.id);
            connection.query('DELETE FROM missions WHERE id = ?', [id], function (err, results) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                } else
                    console.log(err);
            });
        }
    }
});

app.get('/copview', function (req, res) {
    if (req.session.loggedin) {
        if (req.query.mission !== undefined && req.query.mission > 0) {
            fs.readdir('./public/images/icons', function(err, items) {
                fs.readdir('./public/images/shapes', function(err, shapes) {
                    res.render('copview', { title: 'CS-COP', icons: items, shapes: shapes});

                });
            });

        } else {
            res.redirect('/');
        }
    } else {
       res.redirect('/login');
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
        connection.query('SELECT id, password FROM users WHERE username = ?', [req.body.username], function (err, rows, fields) {
            if (!err) {
                if (rows.length === 1) {
                    bcrypt.compare(req.body.password, rows[0].password, function(err, bres) {
                        if (bres) {
                            req.session.user_id = rows[0].id;
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
