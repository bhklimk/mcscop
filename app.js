var express = require('express');
var fs = require('fs');
var app = express();
var multer = require('multer');
var ShareDB = require('sharedb');
var WebSocketJSONStream = require('websocket-json-stream');
var http = require('http').Server(app);
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var cookieParser = require('cookie-parser');
var bcrypt = require('bcrypt-nodejs');
var bodyParser = require('body-parser');
var mysql = require('mysql');
var wss = require('ws');
var async = require('async');
var path = require('path');
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
var ws = new wss.Server({server:http});
var upload = multer({dest: './temp_uploads'});

Array.prototype.move = function (old_index, new_index) {
    if (new_index >= this.length) {
        var k = new_index - this.length;
        while ((k--) + 1) {
            this.push(undefined);
        }
    }
    this.splice(new_index, 0, this.splice(old_index, 1)[0]);
    return this;
};

app.set('view engine', 'pug');
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(sessionMiddleware);

connection.connect();

var db = require('sharedb-mongo')('mongodb://localhost:27017/mcscop');
var backend = new ShareDB({db: db});

function sendToRoom(room, msg, sender, roleFilter) {
    if (rooms.get(room)) {
        rooms.get(room).forEach((socket) => {
            if (socket && socket.readyState === socket.OPEN)
                if (sender && roleFilter) {
                   if (socket.sub_roles.indexOf(roleFilter) !== -1 || sender === socket)
                        socket.send(msg); 
                } else if (sender) {
                    if (sender === socket)
                        socket.send(msg);
                } else
                    socket.send(msg);
        });
    }
}

function getDir(dir, mission, cb) {
    var resp = new Array();
    if (dir === path.join(__dirname + '/mission-files/mission-' + mission)) {
        resp.push({
            "id": '/',
            "text": '/',
            "icon" : 'jstree-custom-folder',
            "state": {
                "opened": true,
                "disabled": true,
                "selected": false
            },
            "li_attr": {
                "base": '#',
                "isLeaf": false
            },
            "a_attr": {
                "class": 'droppable'
            },
            "children": null
        });
    }
    fs.readdir(dir, function(err, list) {
        if (list) {
            var children = new Array();
            list.sort(function(a, b) {
                return a.toLowerCase() < b.toLowerCase() ? -1 : 1;
            }).forEach(function(file, key) {
                children.push(processNode(dir, mission, file));
            });
            if (dir === path.join(__dirname + '/mission-files/mission-' + mission)) {
                resp[0].children = children;
                cb(resp);
            } else
                cb(children);
        } else {
            cb([]);
        }
    });
}

function processNode(dir, mission, f) {
    var s = fs.statSync(path.join(dir, f));
    var base = path.join(dir, f);
    var rel = path.relative(path.join(__dirname, '/mission-files/mission-' + mission), base);
    return {
        "id": rel,
        "text": f,
        "icon" : s.isDirectory() ? 'jstree-custom-folder' : 'jstree-custom-file',
        "state": {
            "opened": false,
            "disabled": false,
            "selected": false
        },
        "li_attr": {
            "base": rel,
            "isLeaf": !s.isDirectory()
        },
        "a_attr": {
            "class": (s.isDirectory() ? 'droppable' : '')
        },
        "children": s.isDirectory()
    };
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
                    socket.role = data.role;
                    socket.sub_roles = data.sub_roles;
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
                    socket.mission = msg.arg;
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
                    connection.query('SELECT id, uuid, event_time, discovery_time, event_type, source_object, source_port, dest_object, dest_port, short_desc, (SELECT username FROM users WHERE users.id = analyst) as analyst FROM events WHERE mission = ? ORDER BY event_time ASC', [mission], function(err, rows, fields) {
                        if (!err) {
                            socket.send(JSON.stringify({act:'all_events', arg:rows}));
                        } else
                            console.log(err);
                    });
                    break;
                case 'get_opnotes':
                    var mission = JSON.parse(msg.arg);
                    var analyst = socket.user_id;
                    var query = 'SELECT id, event_time, event, source_object, tool, action, (SELECT username FROM users WHERE users.id = analyst) as analyst FROM opnotes WHERE mission = ? AND (analyst = ? OR role IN (?)) ORDER BY event_time ASC'
                    var args = [mission, analyst, socket.sub_roles];
                    if (socket.sub_roles.length === 0) {
                        query = 'SELECT id, event_time, event, source_object, tool, action, (SELECT username FROM users WHERE users.id = analyst) as analyst FROM opnotes WHERE mission = ? AND analyst = ? ORDER BY event_time ASC'
                        args = [mission, analyst];
                    }
                    connection.query(query, args, function(err, rows, fields) {
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
                    connection.query('SELECT uuid FROM objects WHERE mission = ? ORDER BY z ASC', [socket.mission], function (err, results) {
                        var zs = [];
                        for (var i = 0; i < results.length; i++)
                            zs.push(results[i].uuid);
                        if (o.z !== zs.indexOf(o.uuid)) {
                            zs.move(zs.indexOf(o.uuid), o.z);
                            async.forEachOf(zs, function(item, index, callback) {
                                connection.query('UPDATE objects SET z = ? WHERE uuid = ?', [index, item], function (err, results) {
                                    if (err)
                                        console.log(err);
                                    callback();
                                });
                            }, function(err) {
                                sendToRoom(socket.room, JSON.stringify({act: 'move_object', arg: msg.arg}));
                            });
                        } else  {
                            if (o.type !== undefined && (o.type === 'icon' || o.type === 'shape')) {
                                connection.query('UPDATE objects SET x = ?, y = ?, scale_x = ?, scale_y = ? WHERE uuid = ?', [o.x, o.y, o.scale_x, o.scale_y, o.uuid], function (err, results) {
                                    if (!err) {
                                        sendToRoom(socket.room, JSON.stringify({act: 'move_object', arg: msg.arg}));
                                    } else
                                        console.log(err);
                                });
                            }
                        }
                    });
                    break;
                case 'change_link':
                    var o = msg.arg;
                    if (o.type !== undefined && o.type === 'link') {
                    }
                    break;
                case 'update_event':
                    var evt = msg.arg;
                    connection.query('UPDATE events SET event_time = ?, discovery_time = ?, source_object = ?, source_port = ?, dest_object = ?, dest_port = ?, event_type = ?, short_desc = ? WHERE id = ?', [evt.event_time, evt.discovery_time, evt.source_object, evt.source_port, evt.dest_object, evt.dest_port, evt.event_type, evt.short_desc, evt.id], function (err, results) {
                        if (!err) {
                            sendToRoom(socket.room, JSON.stringify({act: 'update_event', arg: msg.arg}));
                        } else
                            console.log(err);
                    });
                    break;
                case 'insert_event':
                    var evt = msg.arg;
                    evt.analyst = socket.user_id;
                    connection.query('INSERT INTO events (mission, event_time, discovery_time, source_object, source_port, dest_object, dest_port, event_type, short_desc, analyst) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [evt.mission, evt.event_time, evt.discovery_time, evt.source_object, evt.source_port, evt.dest_object, evt.dest_port, evt.event_type, evt.short_desc, evt.analyst], function (err, results) {
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
                    connection.query('UPDATE opnotes SET event_time = ?, event = ?, source_object = ?, tool = ?, action = ?, analyst = ? WHERE id = ?', [evt.event_time, evt.event, evt.source_object, evt.tool, evt.action, evt.analyst, evt.id], function (err, results) {
                        if (!err) {
                            evt.analyst = socket.username;
                            sendToRoom(socket.room, JSON.stringify({act: 'update_opnote', arg: msg.arg}), socket, socket.role);
                        } else
                            console.log(err);
                    });
                    break;
                case 'insert_opnote':
                    var evt = msg.arg;
                    evt.analyst = socket.user_id;
                    connection.query('SELECT role FROM users WHERE id = ?', [socket.user_id], function (err, results) {
                        if (!err) {
                            var role = results[0].role;
                            connection.query('INSERT INTO opnotes (mission, event, role, event_time, source_object, tool, action, analyst) values (?, ?, ?, ?, ?, ?, ?, ?)', [evt.mission, evt.event, role, evt.event_time, evt.source_object, evt.tool, evt.action, evt.analyst], function (err, results) {
                                if (!err) {
                                    evt.id = results.insertId;
                                    evt.analyst = socket.username;
                                    sendToRoom(socket.room, JSON.stringify({act: 'insert_opnote', arg: evt}), socket, socket.role);
                                } else
                                    console.log(err);
                            });
                        } else {
                            console.log(err);
                        }
                    });
                    break;
                case 'delete_opnote':
                    var evt = msg.arg;
                    connection.query('DELETE FROM opnotes WHERE id = ?', [evt.id], function (err, results) {
                        if (!err) {
                            sendToRoom(socket.room, JSON.stringify({act: 'delete_opnote', arg: msg.arg}), socket, socket.role);
                        } else
                            console.log(err);
                    });
                    break;
                case 'insert_object':
                    var o = msg.arg;
                    if (!o.image || o.image === '') {
                        socket.send(JSON.stringify({act: 'error', arg: 'Error: Missing image!'}));
                        break;
                    }
                    connection.query('SELECT count(*) AS z FROM objects WHERE mission = ?', [o.mission], function (err, results) {
                        var x = 32;
                        var y = 32;
                        if (!isNaN(parseFloat(o.x)) && isFinite(o.x) && !isNaN(parseFloat(o.y)) && isFinite(o.y)) {
                            x = o.x;
                            y = o.y;
                        }
                        o.z = results[0].z;
                        if (o.type === 'icon' || o.type === 'shape') {
                            var scale_x = 1;
                            var scale_y = 1;
                            if (o.type === 'shape') {
                                scale_x = 64;
                                scale_y = 64;
                            }
                            connection.query('INSERT INTO objects (mission, type, name, fill_color, stroke_color, image, scale_x, scale_y, x, y, z) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [o.mission, o.type, o.name, o.fill_color, o.stroke_color, o.image, scale_x, scale_y, x, y, o.z], function (err, results) {
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
                                        } else {
                                            console.log(err);
                                            socket.send(JSON.stringify({act: 'error', arg: 'Error: ' + err}));
                                        }
                                    });
                                } else {
                                    console.log(err);
                                    socket.send(JSON.stringify({act: 'error', arg: 'Error: ' + err}));
                                }
                            });
                        }
                    });
                    break;
                case 'delete_object':
                    var o = msg.arg;
                    if (o.type && o.uuid) {
                        if (o.type === 'icon' || o.type === 'shape') {
                            connection.query('DELETE FROM objects WHERE uuid = ?', [o.uuid], function (err, results) {
                                if (!err) {
                                    sendToRoom(socket.room, JSON.stringify({act: 'delete_object', arg:o.uuid}));
                                    connection.query('SELECT uuid FROM objects WHERE obj_a = ? OR obj_b = ?', [o.uuid, o.uuid], function(err, rows, results) {
                                        if (!err) {
                                            async.each(rows, function(row, callback) {
                                                connection.query('DELETE FROM objects WHERE uuid = ?', [rows.uuid], function(err, results) {
                                                    if (err) {
                                                        console.log(err);
                                                        socket.send(JSON.stringify({act: 'error', arg: 'Error: ' + err}));
                                                    } else
                                                        sendToRoom(socket.room, JSON.stringify({act: 'delete_object', arg:row.uuid}));
                                                });
                                            }, function() {
                                                connection.query('SELECT uuid FROM objects WHERE mission = ? ORDER BY z ASC', [socket.mission], function (err, results) {
                                                    for (var i = 0; i < results.length; i++) {
                                                        connection.query('UPDATE objects SET z = ? WHERE uuid = ?', [i, results[i].uuid], function (err, results) {
                                                            if (err) {
                                                                console.log(err);
                                                                socket.send(JSON.stringify({act: 'error', arg: 'Error: ' + err}));
                                                            }
                                                        });
                                                    }
                                                });
                                            });
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
                                    connection.query('SELECT uuid FROM objects WHERE mission = ? ORDER BY z ASC', [socket.mission], function (err, results) {
                                        if (!err) {
                                            for (var i = 0; i < results.length; i++) {
                                                connection.query('UPDATE objects SET z = ? WHERE uuid = ?', [i, results[i].uuid], function (err, results) {
                                                    if (err) {
                                                        console.log(err);
                                                        socket.send(JSON.stringify({act: 'error', arg: 'Error: ' + err}));
                                                    }
                                                });
                                            }
                                        } else {
                                            console.log(err);
                                            socket.send(JSON.stringify({act: 'error', arg: 'Error: ' + err}));
                                        }
                                    });
                                } else {
                                    console.log(err);
                                    socket.send(JSON.stringify({act: 'error', arg: 'Error: ' + err}));
                                }
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
            connection.query("SELECT id, username, name, '********' as password, role FROM users", function(err, rows, fields) {
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
                    connection.query('UPDATE users SET name = ?, password = ?, role = ? WHERE id = ?', [row.name, hash, row.role, row.id], function (err, results) {
                        if (!err) {
                            res.end(JSON.stringify('OK'));
                        } else {
                            res.end(JSON.stringify('ERR'));
                            console.log(err);
                        }
                    });
                });
            } else {
                var query = 'UPDATE users SET name = ?, role = ? WHERE id = ?';
                var args = [row.name, row.role, row.id];
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
                connection.query('INSERT INTO users (username, name, password, role) values (?, ?, ?, ?)', [row.username, row.name, hash, row.role], function (err, results) {
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
    } else if (req.body.table !== undefined && req.body.table === 'roles') {
        if (req.body.action !== undefined && req.body.action === 'select') {
            connection.query("SELECT roles.id, roles.name, (SELECT GROUP_CONCAT(sub_role_id) FROM sub_role_rel WHERE sub_role_rel.role_id = roles.id) as sub_roles FROM roles", function(err, rows, fields) {
                if (!err) {
                    res.end(JSON.stringify(rows));
                } else {
                    res.end(JSON.stringify('[]'));
                    console.log(err);
                }
            });
        } else if (req.body.action !== undefined && req.body.action === 'update' && req.body.row !== undefined) {
            var row = JSON.parse(req.body.row);
            connection.query('UPDATE roles SET name = ? WHERE id = ?', [row.name, row.id], function (err, results) {
                if (!err) {
                    if (row.sub_roles) {
                        var sub_roles = [];
                        for (var i = 0; i < row.sub_roles.length; i++) {
                            sub_roles.push(parseInt(row.sub_roles[i]));
                        }
                        connection.query('SELECT id, sub_role_id FROM sub_role_rel WHERE role_id = ?', [row.id], function (err, results) {
                            if (err) {
                                res.end(JSON.stringify('ERR'));
                                console.log(err);
                            } else {
                                var curr_roles = [];
                                for (var j = 0; j < results.length; j++) {
                                    curr_roles.push(results[j].sub_role_id);
                                }
                                var additions = sub_roles.filter(x => curr_roles.indexOf(x) < 0 );
                                var subtractions = curr_roles.filter(x => sub_roles.indexOf(x) < 0 );
                                if (subtractions.length === 0)
                                    subtractions = '';
                                connection.query('DELETE FROM sub_role_rel WHERE role_id = ? AND sub_role_id IN (?)', [row.id, subtractions], function (err, results) {
                                    if (err) {
                                        console.log(err);
                                        res.end(JSON.stringify('ERR'));
                                    } else {
                                        if (additions.length === 0)
                                            res.end(JSON.stringify('OK'));
                                        else {
                                            for (i = 0; i < additions.length; i++) {
                                                connection.query('INSERT INTO sub_role_rel (role_id, sub_role_id) values (?, ?)', [row.id, additions[i]], function (err, results) {
                                                    if (err) {
                                                        res.end(JSON.stringify('ERR'));
                                                        console.log(err);
                                                    } else if (i === additions.length) {
                                                        res.end(JSON.stringify('OK'));
                                                    }
                                                });
                                            }
                                        }
                                    }
                                });
                            }
                        });
                    }
                } else {
                    res.end(JSON.stringify('ERR'));
                    console.log(err);
                }
            });
        } else if (req.body.action !== undefined && req.body.action === 'insert' && req.body.row !== undefined) {
            var row = JSON.parse(req.body.row);
            connection.query('INSERT INTO roles (name) values (?)', [row.name], function (err, results) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                } else {
                    res.end(JSON.stringify('ERR'));
                    console.log(err);
                }
            });
        } else if (req.body.action !== undefined && req.body.action === 'delete' && req.body.id !== undefined) {
            var id = JSON.parse(req.body.id);
            if (id != 0) {
                connection.query('DELETE FROM roles WHERE id = ?', [id], function (err, results) {
                    if (!err) {
                        res.end(JSON.stringify('OK'));
                    } else {
                        console.log(err);
                        res.end(JSON.stringify('ERR'));
                    }
                });
            }
        }
    } else {
        res.end(JSON.stringify('ERR'));
    }
});

app.get('/config', function (req, res) {
    if (req.session.loggedin) {
        res.render('config', { title: 'MCSCOP'});
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
        connection.query('SELECT id, username, password, role FROM users WHERE username = ?', [req.body.username], function (err, rows, fields) {
            if (!err) {
                if (rows.length === 1) {
                    bcrypt.compare(req.body.password, rows[0].password, function(err, bres) {
                        if (bres) {
                            req.session.user_id = rows[0].id;
                            req.session.username = rows[0].username;
                            req.session.loggedin = true;
                            req.session.role = rows[0].role;
                            req.session.sub_roles = [];
                            connection.query('SELECT sub_role_id FROM sub_role_rel WHERE role_id = ?', [rows[0].role], function (err, rows, fields) {
                                 if (!err) {
                                    for (var i = 0; i < rows.length; i++) {
                                        req.session.sub_roles.push(rows[i].sub_role_id);
                                    }
                                }
                                res.redirect('login');
                            });
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


// --------------------------------------- FILES ------------------------------------------

app.post('/dir/', function (req, res) {
    var dir = req.body.id;
    var mission = req.body.mission;
    if (dir && mission && dir !== '#') {
        dir = path.normalize(dir).replace(/^(\.\.[\/\\])+/, '');
        dir = path.join(__dirname + '/mission-files/mission-' + mission, dir);
        var s = fs.statSync(dir);
        if (s.isDirectory()) {
            getDir(dir, mission, function(r) {
                res.send(r);
            })
        } else {
            res.status(404).send('Not found');
        }
    } else if (dir && mission) {
        dir = path.join(__dirname, '/mission-files/mission-' + mission);
        getDir(dir, mission, function(r) {
            res.send(r);
        });
    }
});

app.use('/download', express.static(path.join(__dirname, 'mission-files'), {
    etag: false,
    setHeaders: function(res, path) {
        res.attachment(path);
    }

}))

app.post('/mkdir', function (req, res) {
    var id = req.body.id;
    var name = req.body.name;
    var mission = req.body.mission;
    if (id && name && mission) {
        var dir = path.normalize(id).replace(/^(\.\.[\/\\])+/, '');
        name = path.normalize('/' + name + '/').replace(/^(\.\.[\/\\])+/, '');
        dir = path.join(path.join(path.join(__dirname, '/mission-files/mission-' + mission + '/'), dir), name);
        fs.stat(dir, function (err, s) {
            if (err == null)
                res.status(500).send('mkdir error');
            else if (err.code == 'ENOENT') {
                fs.mkdir(dir,function(err){
                    if(err)
                        res.status(500).send('mkdir error');
                    else
                        res.send('{}');
               });
            } else {
                res.status(500).send('mkdir error');
            }
        });
    } else
        res.status(404).send('Y U bein wierd?');
});

app.post('/mv', function (req, res) {
    var dst = req.body.dst;
    var src = req.body.src;
    var mission = req.body.mission;
    if (dst && src && mission) {
        var dstdir = path.normalize(dst).replace(/^(\.\.[\/\\])+/, '');
        var srcdir = path.normalize(src).replace(/^(\.\.[\/\\])+/, '');
        dstdir = path.join(path.join(__dirname, '/mission-files/mission-' + mission), dstdir);
        srcdir = path.join(path.join(__dirname, '/mission-files/mission-' + mission), srcdir);
        fs.stat(dstdir, function (err, s) {
            if (s.isDirectory()) {
                fs.stat(srcdir, function (err, s) {
                    if (s.isDirectory() || s.isFile()) {
                        fs.rename(srcdir, dstdir + '/' + path.basename(srcdir), function(err) {
                            if (err)
                                res.status(500).send('mv error');
                            res.send('{}');
                        });
                    } else
                        res.status(500).send('mv error');
                });
            } else
                res.status(500).send('mv error');
        });
    } else
        res.status(404).send('Y U bein wierd?');
});

app.post('/delete', function (req, res) {
    var id = req.body.id;
    var mission = req.body.mission;
    if (id) {
        var dir = path.normalize(id).replace(/^(\.\.[\/\\])+/, '');
        dir = path.join(path.join(__dirname, '/mission-files/mission-' + mission + '/'), dir);
        fs.stat(dir, function (err, s) {
            if (err)
                res.status(500).send('delete error');
            if (s.isDirectory()) {
                fs.rmdir(dir,function(err){
                    if(err)
                        res.status(500).send('delete error');
                    else
                        res.send('{}');
               });
            } else {
                fs.unlink(dir,function(err){
                    if(err)
                        res.status(500).send('delete error');
                    else
                        res.send('{}');
               });
            }
        });
    } else
        res.status(404).send('Y U bein wierd?');
});

app.post('/upload', upload.any(), function (req, res) {
    if (req.body.dir && req.body.dir.indexOf('_anchor') && req.body.mission) {
        var dir = req.body.dir.substring(0,req.body.dir.indexOf('_anchor'));
        dir = path.normalize(dir).replace(/^(\.\.[\/\\])+/, '');
        dir = path.join(__dirname + '/mission-files/mission-' + req.body.mission + '/', dir);
        async.each(req.files, function(file, callback) {
            fs.rename(file.path, dir + '/' + file.originalname, function(err) {
                if (err)
                    res.status(500).send('delete error');
                callback();
            });
        }, function() {
            res.send('{}');
            getDir('./mission-files', req.body.mission, function(resp) {
            });
        });
    } else
       res.status(404).send('Y U bein wierd?');
});

// -------------------------------------------------------------------------

http.listen(3000, function () {
    console.log('Server listening on port 3000!');
});
