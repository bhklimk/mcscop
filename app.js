var express = require('express');
var fs = require('fs');
var app = express();
var ShareDB = require('sharedb');
var WebSocketJSONStream = require('websocket-json-stream');
var http = require('http').Server(app);
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var cookieParser = require('cookie-parser');
var bcrypt = require('bcrypt-nodejs');
var bodyParser = require('body-parser');
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
var rooms = new Map();
var connection = mysql.createConnection(mysqlOptions);
var ws = new require('ws').Server({server:http});

app.set('view engine', 'pug');
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(sessionMiddleware);

connection.connect();

var sdb = require('./sharedb-mysql')(connection);
var backend = new ShareDB({db: sdb});

// Create initial document then fire callback
var backconnection = backend.connect();
var doc = backconnection.get('examples', 'textarea');
doc.fetch(function(err) {
    if (err) throw err;
    if (doc.type === null) {
        doc.create('');
        return;
    }
});

function sendToRoom(room, msg) {
    if (rooms.get(room)) {
        rooms.get(room).forEach((socket) => {
            if (socket && socket.readyState === socket.OPEN)
                socket.send(msg);
        });
    }
}

ws.on('connection', function(socket) {
    socket.loggedin = false;
    socket.session = '';
    session = socket.upgradeReq.headers.cookie.split('session=s%3A')[1].split('.')[0];
    if (session) {
        socket.session = session;
        connection.query('SELECT data FROM sessions WHERE session_id = ? LIMIT 1', [session], function(err, rows, fields) {
            if (!err) {
                try {
                    data = JSON.parse(rows[0].data);
                    socket.loggedin = data.loggedin;
                    socket.user_id = data.user_id;
                    socket.username = data.username;
                } catch (e) {
                }
            } else
                console.log(err);
        });
    }
    socket.on('message', function(msg, flags) {
        try {
            msg = JSON.parse(msg);
        } catch (e) {
            return;
        }
        if (socket.loggedin && msg.act) {
            switch (msg.act) {
                case 'stream':
                    var stream = new WebSocketJSONStream(socket);
                    backend.listen(stream);
                    break;
                case 'join':
                    socket.room = msg.arg;
                    if (!rooms.get(msg.arg))
                        rooms.set(msg.arg, new Set());
                    rooms.get(msg.arg).add(socket);
                    break;
                case 'get_objects':
                    var mission = msg.arg;
                    connection.query('SELECT * FROM objects WHERE mission = ? ORDER BY FIELD(type, "icon", "shape", "link"), z', [mission], function(err, rows, fields) {
                        if (!err) {
                            socket.send(JSON.stringify({act:'all_objects', arg:rows}));
                        } else
                            console.log(err);
                    });
                    break;
                case 'get_events':
                    var mission = JSON.parse(msg.arg);
                    connection.query('SELECT id, uuid, event_time, event_type, source_object, source_port, dest_object, dest_port, short_desc, (SELECT username FROM users WHERE users.id = analyst) as analyst FROM events WHERE mission = ? ORDER BY event_time ASC', [mission], function(err, rows, fields) {
                        if (!err) {
                            socket.send(JSON.stringify({act:'all_events', arg:rows}));
                        } else
                            console.log(err);
                    });
                    break;
                case 'get_opnotes':
                    var mission = JSON.parse(msg.arg);
                    var analyst = socket.user_id;
                    connection.query('SELECT id, event_time, source_object, tool, action, (SELECT username FROM users WHERE users.id = analyst) as analyst FROM opnotes WHERE mission = ? AND analyst = ? ORDER BY event_time ASC', [mission, analyst], function(err, rows, fields) {
                        if (!err) {
                            socket.send(JSON.stringify({act:'all_opnotes', arg:rows}));
                        } else
                            console.log(err);
                    });
                    break;
                case 'change_object':
                    var o = msg.arg;
                    if (o.type !== undefined) {
                        if (o.type === 'icon' || o.type === 'shape') {
                            connection.query('UPDATE objects SET name = ?, fill_color = ?, stroke_color = ?, image = ? WHERE uuid = ?', [o.name, o.fill_color, o.stroke_color, o.image, o.uuid], function (err, results) {
                                if (!err) {
                                    sendToRoom(socket.room, JSON.stringify({act: 'change_object', arg: msg.arg}));
                                } else
                                    console.log(err);
                            });
                        } else if (o.type === 'link') {
                            connection.query('UPDATE objects SET name = ?, stroke_color = ? WHERE uuid = ?', [o.name, o.stroke_color, o.uuid], function (err, results) {
                                if (!err) {
                                    sendToRoom(socket.room, JSON.stringify({act: 'change_object', arg: msg.arg}));
                                } else
                                    console.log(err);
                            });
                        }
                    }
                    break;
                case 'move_object':
                    var o = msg.arg;
                    if (o.type !== undefined && (o.type === 'icon' || o.type === 'shape')) {
                        connection.query('UPDATE objects SET x = ?, y = ?, z = ?, scale_x = ?, scale_y = ? WHERE uuid = ?', [o.x, o.y, o.z, o.scale_x, o.scale_y, o.uuid], function (err, results) {
                            if (!err) {
                                sendToRoom(socket.room, JSON.stringify({act: 'move_object', arg: msg.arg}));
                            } else
                                console.log(err);
                        });
                    } else if (o.type !== undefined && o.type === 'link') {
                        connection.query('UPDATE objects SET z = ? WHERE uuid = ?', [o.z, o.uuid], function (err, results) {
                            if (!err) {
                                sendToRoom(socket.room, JSON.stringify({act: 'move_object', arg: msg.arg}));
                            } else
                                console.log(err);
                        });
                    }
                    break;
                case 'change_link':
                    var o = msg.arg;
                    if (o.type !== undefined && o.type === 'link') {
                    }
                    break;
                case 'update_layers':
                    var objs = msg.arg;
                    for (var i = 0; i < objs.length; i ++) {
                        var o = objs[i];
                        if (o.type !== undefined && (o.type === 'icon' || o.type === 'shape')) {
                            connection.query('UPDATE objects SET z = ? WHERE uuid = ?', [o.z, o.uuid], function (err, results) {
                                if (!err) {
                                } else
                                    console.log(err);
                            });
                        } else if (o.type !== undefined && o.type === 'link') {
                            connection.query('UPDATE objects SET z = ? WHERE uuid = ?', [o.z, o.uuid], function (err, results) {
                                if (!err) {
                                } else
                                    console.log(err);
                            });
                        }
                    }
                    break;
                case 'update_event':
                    var evt = msg.arg;
                    evt.analyst = socket.user_id;
                    connection.query('UPDATE events SET event_time = ?, source_object = ?, source_port = ?, dest_object = ?, dest_port = ?, event_type = ?, short_desc = ?, analyst = ? WHERE id = ?', [evt.event_time, evt.source_object, evt.source_port, evt.dest_object, evt.dest_port, evt.event_type, evt.short_desc, evt.analyst, evt.id], function (err, results) {
                        if (!err) {
                            sendToRoom(socket.room, JSON.stringify({act: 'update_event', arg: msg.arg}));
                        } else
                            console.log(err);
                    });
                    break;
                case 'insert_event':
                    var evt = msg.arg;
                    evt.analyst = socket.user_id;
                    connection.query('INSERT INTO events (mission, event_time, source_object, source_port, dest_object, dest_port, event_type, short_desc, analyst) values (?, ?, ?, ?, ?, ?, ?, ?, ?)', [evt.mission, evt.event_time, evt.source_object, evt.source_port, evt.dest_object, evt.dest_port, evt.event_type, evt.short_desc, evt.analyst], function (err, results) {
                        if (!err) {
                            evt.id = results.insertId;
                            evt.analyst = socket.username;
                            sendToRoom(socket.room, JSON.stringify({act: 'insert_event', arg: evt}));
                        } else
                            console.log(err);
                    });
                    break;
                case 'delete_event':
                    var evt = msg.arg;
                    connection.query('DELETE FROM events WHERE id = ?', [evt.id], function (err, results) {
                        if (!err) {
                            sendToRoom(socket.room, JSON.stringify({act: 'delete_event', arg: msg.arg}));
                        } else
                            console.log(err);
                    });
                    break;
                case 'update_opnote':
                    var evt = msg.arg;
                    evt.analyst = socket.user_id;
                    connection.query('UPDATE opnotes SET event_time = ?, source_object = ?, tool = ?, action = ?, analyst = ? WHERE id = ?', [evt.event_time, evt.source_object, evt.tool, evt.action, evt.analyst, evt.id], function (err, results) {
                        if (!err) {
                            sendToRoom(socket.room, JSON.stringify({act: 'update_opnote', arg: msg.arg}));
                        } else
                            console.log(err);
                    });
                    break;
                case 'insert_opnote':
                    var evt = msg.arg;
                    evt.analyst = socket.user_id;
                    connection.query('INSERT INTO opnotes (mission, event_time, source_object, tool, action, analyst) values (?, ?, ?, ?, ?, ?)', [evt.mission, evt.event_time, evt.source_object, evt.tool, evt.action, evt.analyst], function (err, results) {
                        if (!err) {
                            evt.id = results.insertId;
                            evt.analyst = socket.username;
                            sendToRoom(socket.room, JSON.stringify({act: 'insert_opnote', arg: evt}));
                        } else
                            console.log(err);
                    });
                    break;
                case 'delete_opnote':
                    var evt = msg.arg;
                    connection.query('DELETE FROM opnotes WHERE id = ?', [evt.id], function (err, results) {
                        if (!err) {
                            sendToRoom(socket.room, JSON.stringify({act: 'delete_opnote', arg: msg.arg}));
                        } else
                            console.log(err);
                    });
                    break;
                case 'insert_object':
                    var o = msg.arg;
                    if (o.type === 'icon' || o.type === 'shape') {
                        connection.query('INSERT INTO objects (mission, type, name, fill_color, stroke_color, image, x, y, z) values (?, ?, ?, ?, ?, ?, 64, 64, ?)', [o.mission, o.type, o.name, o.fill_color, o.stroke_color, o.image, o.z], function (err, results) {
                            if (!err) {
                                o.id = results.insertId;
                                connection.query('SELECT * FROM objects WHERE id = ?', [o.id], function(err, rows, fields) {
                                    if (!err) {
                                        sendToRoom(socket.room, JSON.stringify({act: 'insert_object', arg:rows[0]}));
                                    } else
                                        console.log(err);
                                });
                            } else
                                console.log(err);
                        });
                    } else if (o.type === 'link') {
                        connection.query('INSERT INTO objects (mission, type, name, stroke_color, image, obj_a, obj_b, z) values (?, ?, ?, ?, ?, ?, ?, ?)', [o.mission, o.type, o.name, o.stroke_color, o.image, o.obj_a, o.obj_b, o.z], function (err, results) {
                            if (!err) {
                                o.id = results.insertId;
                                connection.query('SELECT * FROM objects WHERE id = ?', [o.id], function(err, rows, fields) {
                                    if (!err) {
                                        sendToRoom(socket.room, JSON.stringify({act: 'insert_object', arg:rows[0]}));
                                    } else
                                        console.log(err);
                                });
                            } else
                                console.log(err);
                        });
                    }
                    break;
                case 'delete_object':
                    var o = msg.arg;
                    if (o.type !== undefined) {
                        if (o.type === 'icon' || o.type === 'shape') {
                            connection.query('DELETE FROM objects WHERE uuid = ?', [o.uuid], function (err, results) {
                                if (!err) {
                                    sendToRoom(socket.room, JSON.stringify({act: 'delete_object', arg:o.uuid}));
                                    connection.query('SELECT uuid FROM objects WHERE obj_a = ? OR obj_b = ?', [o.uuid, o.uuid], function(err, rows, results) {
                                        if (!err) {
                                            for (var r = 0; r < rows.length; r++) {
                                                sendToRoom(socket.room, JSON.stringify({act: 'delete_object', arg:rows[r].uuid}));
                                                connection.query('DELETE FROM objects WHERE uuid = ?', [rows[r].uuid], function(err, results) {
                                                });
                                            }
                                        } else
                                            console.log(err);
                                    });
                                } else
                                    console.log(err);
                            });
                        } else if (o.type === 'link') {
                            connection.query('DELETE FROM objects WHERE uuid = ?', [o.uuid], function (err, results) {
                                if (!err) {
                                    sendToRoom(socket.room, JSON.stringify({act: 'delete_object', arg: o.uuid}));
                                } else
                                    console.log(err);
                            });
                        }
                    }
                    break;
            }
        }
    });
});

app.get('/', function (req, res) {
    if (req.session.loggedin) {
            res.render('index', { title: 'MCSCOP'});
    } else {
       res.redirect('login');
    }
});

app.get('/logout', function (req, res) {
    req.session.destroy();
    res.redirect('login');
});

app.post('/api', function (req, res) {
    res.writeHead(200, {"Content-Type": "application/json"});
    if (req.body.table !== undefined && req.body.table === 'missions') {
        if (req.body.action !== undefined && req.body.action === 'select') {
            connection.query("SELECT id, name, start_date, (SELECT username FROM users WHERE users.id = analyst) as analyst FROM missions", function(err, rows, fields) {
                if (!err) {
                    res.end(JSON.stringify(rows));
                } else {
                    res.end(JSON.stringify('[]'));
                    console.log(err);
                }
            });
        } else if (req.body.action !== undefined && req.body.action === 'update' && req.body.row !== undefined) {
            var row = JSON.parse(req.body.row);
            connection.query('UPDATE missions SET name = ?, start_date = ?, analyst = ? WHERE id = ?', [row.name, row.start_date, row.analyst, row.id], function (err, results) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                } else {
                    console.log(err);
                    res.end(JSON.stringify('ERR'));
                }
            });
        } else if (req.body.action !== undefined && req.body.action === 'insert' && req.body.row !== undefined) {
            var row = JSON.parse(req.body.row);
            connection.query('INSERT INTO missions (name, start_date, analyst) values (?, ?, ?)', [row.name, row.start_date, row.analyst], function (err, results) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                } else {
                    console.log(err);
                    res.end(JSON.stringify('ERR'));
                }
            });
        } else if (req.body.action !== undefined && req.body.action === 'delete' && req.body.id !== undefined) {
            var id = JSON.parse(req.body.id);
            connection.query('DELETE FROM missions WHERE id = ?', [id], function (err, results) {
                if (!err) {
                    connection.query('DELETE FROM objects WHERE id = ?', [id], function (err, results) {
                        if (!err) {
                            res.end(JSON.stringify('OK'));
                        } else {
                            res.end(JSON.stringify('ERR'));
                            console.log(err);
                        }
                    });
                } else
                    console.log(err);
            });
        }
    } else if (req.body.table !== undefined && req.body.table === 'users') {
        if (req.body.action !== undefined && req.body.action === 'select') {
            connection.query("SELECT id, username, name, '********' as password, access_level FROM users", function(err, rows, fields) {
                if (!err) {
                    res.end(JSON.stringify(rows));
                } else {
                    res.end(JSON.stringify('[]'));
                    console.log(err);
                }
            });
        } else if (req.body.action !== undefined && req.body.action === 'update' && req.body.row !== undefined) {
            var row = JSON.parse(req.body.row);
            if (row.password !== '********') {
                bcrypt.hash(row.password, null, null, function(err, hash) {
                    connection.query('UPDATE users SET name = ?, password = ?, access_level = ? WHERE id = ?', [row.name, hash, row.access_level, row.id], function (err, results) {
                        if (!err) {
                            res.end(JSON.stringify('OK'));
                        } else {
                            res.end(JSON.stringify('ERR'));
                            console.log(err);
                        }
                    });
                });
            } else {
                var query = 'UPDATE users SET name = ? WHERE id = ?';
                var args = [row.name, row.id];
                connection.query(query, args, function (err, results) {
                    if (!err) {
                        res.end(JSON.stringify('OK'));
                    } else {
                        res.end(JSON.stringify('ERR'));
                        console.log(err);
                    }
                });
            }
        } else if (req.body.action !== undefined && req.body.action === 'insert' && req.body.row !== undefined) {
            var row = JSON.parse(req.body.row);
            bcrypt.hash(row.password, null, null, function(err, hash) {
                connection.query('INSERT INTO users (username, name, password, access_level) values (?, ?, ?, ?)', [row.username, row.name, hash, row.access_level], function (err, results) {
                    if (!err) {
                        res.end(JSON.stringify('OK'));
                    } else {
                        res.end(JSON.stringify('ERR'));
                        console.log(err);
                    }
                });
            });
        } else if (req.body.action !== undefined && req.body.action === 'delete' && req.body.id !== undefined) {
            var id = JSON.parse(req.body.id);
            if (id != 0) {
                connection.query('DELETE FROM users WHERE id = ?', [id], function (err, results) {
                    if (!err) {
                        res.end(JSON.stringify('OK'));
                    } else {
                        console.log(err);
                        res.end(JSON.stringify('ERR'));
                    }
                });
            }
        }
    }
});

app.get('/users', function (req, res) {
    if (req.session.loggedin) {
        res.render('users', { title: 'MCSCOP'});
    } else {
       res.redirect('login');
    }
});

app.get('/copview', function (req, res) {
    if (req.session.loggedin) {
        if (req.query.mission !== undefined && req.query.mission > 0) {
            fs.readdir('./public/images/icons', function(err, icons) {
                fs.readdir('./public/images/shapes', function(err, shapes) {
                    res.render('cop', { title: 'MCSCOP', icons: icons, shapes: shapes});
                });
            });

        } else {
            res.redirect('../');
        }
    } else {
       res.redirect('login');
    }
});

app.get('/cop', function (req, res) {
    if (req.session.loggedin) {
        if (req.query.mission !== undefined && req.query.mission > 0) {
            fs.readdir('./public/images/icons', function(err, items) {
                fs.readdir('./public/images/shapes', function(err, shapes) {
                    res.render('cop', { title: 'MCSCOP', icons: items, shapes: shapes});
                });
            });

        } else {
            res.redirect('../');
        }
    } else {
       res.redirect('login');
    }
});

app.post('/login', function (req, res) {
    if (req.body.username !== undefined && req.body.username !== '' && req.body.password !== undefined && req.body.password !== '') {
        connection.query('SELECT id, username, password FROM users WHERE username = ?', [req.body.username], function (err, rows, fields) {
            if (!err) {
                if (rows.length === 1) {
                    bcrypt.compare(req.body.password, rows[0].password, function(err, bres) {
                        if (bres) {
                            req.session.user_id = rows[0].id;
                            req.session.username = rows[0].username;
                            req.session.loggedin = true;
                            res.redirect('login');
                        } else
                            res.render('login', { title: 'MCSCOP', message: 'Invalid username or password.' });
                    });
                } else {
                    res.render('login', { title: 'MCSCOP', message: 'Invalid username or password.' });
                }
            }
        });
    } else {
        res.render('login', { title: 'MCSCOP', message: 'Invalid username or password.' });
    }
});

app.get('/login', function (req, res) {
    if (req.session.loggedin)
        res.redirect('.');
    else
        res.render('login', { title: 'MCSCOP Login' });
});

http.listen(3000, function () {
    console.log('Server listening on port 3000!');
});
