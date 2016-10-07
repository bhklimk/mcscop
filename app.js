var express = require('express');
var app = express();
var http = require('http').Server(app);
var fs = require('fs');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bcrypt = require('bcrypt-nodejs');
var bodyParser = require('body-parser');
app.set('view engine', 'pug');
app.use(express.static('public'));
app.use(session({
    secret: 'ProtectxorTheCybxors',
    name: 'session',
    resave: true,
    saveUninitialized: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var mysql = require('mysql');
var connection = mysql.createConnection({
    host : 'localhost',
    user : 'copper',
    password : 'copper_password123',
    database: 'copper'
});

connection.connect();

var io = require('socket.io')(http);
io.engine.ws = new (require('uws').Server)({
    noServer: true,
    perMessageDeflate: true
});

io.on('connection', function(socket) {
    socket.on('get_diagram', function(msg) {
        connection.query('SELECT * FROM nodes', function(err, rows, fields) {
            if (!err) {
                for (i = 0; i < rows.length; i++) {
                    rows[i].type = 'node';
                }
                socket.emit('all_nodes',rows);
            }
        });
        connection.query('SELECT * FROM links', function(err, rows, fields) {
            if (!err) {
                for (i = 0; i < rows.length; i++) {
                    rows[i].type = 'link';
                }
                socket.emit('all_links',rows);
            }
        });
    });
    socket.on('get_events', function(msg) {
        connection.query('SELECT * FROM events ORDER BY event_time ASC', function(err, rows, fields) {
            if (!err) {
                socket.emit('all_events',rows);
            }
        });
    });
    socket.on('update_object', function(msg) {
        var o = JSON.parse(msg);
        if (o.type !== undefined && o.type === 'node') {
            connection.query('UPDATE nodes SET name = ?, address = ?, image = ?, x = ?, y = ? WHERE uuid = ?', [o.name, o.address, o.image, o.x, o.y, o.uuid], function (err, results) {
                if (!err) {
                    socket.broadcast.emit('update_object', msg);
                }
            });
        }
    });
    socket.on('update_object_pos', function(msg) {
        var o = JSON.parse(msg);
        if (o.type !== undefined && o.type === 'node') {
            connection.query('UPDATE nodes SET x = ?, y = ? WHERE uuid = ?', [o.x, o.y, o.uuid], function (err, results) {
                if (!err) {
                    socket.broadcast.emit('update_object_pos', msg);
                }
            });
        }
    });
    socket.on('update_event', function(msg) {
        var evt = JSON.parse(msg);
        connection.query('UPDATE events SET event_time = ?, source_node = ?, source_port = ?, dest_node = ?, dest_port = ?, short_desc = ?, analyst = ? WHERE id = ?', [evt.event_time, evt.source_node, evt.source_port, evt.dest_node, evt.dest_port, evt.short_desc, evt.analyst, evt.id], function (err, results) {
            if (!err) {
                socket.broadcast.emit('update_event', msg);
            }
        });
    });
    socket.on('insert_event', function(msg) {
        var evt = JSON.parse(msg);
        connection.query('INSERT INTO events (mission, event_time, source_node, source_port, dest_node, dest_port, analyst) values (1, ?, ?, ?, ?, ?, ?)', [evt.event_time, evt.source_node, evt.source_port, evt.dest_node, evt.dest_port, evt.analyst], function (err, results) {
            if (!err) {
                evt.id = results.insertId;
                io.emit('insert_event', JSON.stringify(evt));
            }
        });
    });
    socket.on('insert_object', function(msg) {
        var o = JSON.parse(msg);
        if (o.type === 'node') {
            connection.query('INSERT INTO nodes (mission, name, address, image, x, y, width, height) values (1, ?, ?, ?, 64, 64, 64, 64)', [o.name, o.address, o.image], function (err, results) {
                if (!err) {
                    o.id = results.insertId;
                    connection.query('SELECT * FROM nodes WHERE id = ?', [o.id], function(err, rows, fields) {
                        if (!err) {
                            rows[0].type = 'node';
                            socket.emit('insert_object',JSON.stringify(rows[0]));
                        }
                    });
                }
            });
        } else if (o.type === 'link') {
            connection.query('INSERT INTO links (node_a, node_b) values (?, ?)', [o.node_a, o.node_b], function (err, results) {
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
            connection.query('DELETE FROM nodes WHERE uuid = ?', [o.uuid], function (err, results) {
                if (!err) {
                    io.emit('delete_object', JSON.stringify(o.uuid));
                }
            });
        }
    });
});

app.get('/', function (req, res) {
    if (!req.session.loggedin) {
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
            connection.query('SELECT * FROM missions', function(err, rows, fields) {
                if (!err) {
                    res.end(JSON.stringify(rows));
                }
            });
        } else if (req.body.action !== undefined && req.body.action === 'update') {
        } else if (req.body.action !== undefined && req.body.action === 'insert' && req.body.row !== undefined) {
            var row = JSON.parse(req.body.row);
            connection.query('INSERT INTO missions (name, start_date, analyst) values (?, ?, ?)', [row.name, row.start_date, row.analyst], function (err, results) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                }
            });
        } else if (req.body.action !== undefined && req.body.action === 'delete') {
        }
    }
});

app.get('/cop', function (req, res) {
    if (!req.session.loggedin) {
        fs.readdir('./public/images/icons', function(err, items) {
            res.render('cop', { title: 'CS-COP', icons: items});
        });
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
