var express = require('express');
var app = express();
var http = require('http').Server(app);
var fs = require('fs');
app.set('view engine', 'pug');
app.use(express.static('public'));

var mysql = require('mysql');
var connection = mysql.createConnection({
    host : 'localhost',
    user : 'copper',
    password : 'copper_password123',
    database: 'copper'
});

connection.connect();

var io = require('socket.io')(http);

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
        connection.query('SELECT * FROM events', function(err, rows, fields) {
            if (!err) {
                socket.emit('all_events',rows);
            }
        });
    });
    socket.on('update_object', function(msg) {
        var o = JSON.parse(msg);
        if (o.type !== undefined && o.type === 'node') {
            connection.query('UPDATE nodes SET name = ?, address = ?, image = ?, x = ?, y = ? WHERE id = ?', [o.name, o.address, o.image, o.x, o.y, o.id], function (err, results) {
                if (!err) {
                    socket.broadcast.emit('update_object', msg);
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
    console.log('connection');
});

app.get('/', function (req, res) {
    fs.readdir('./public/images/icons', function(err, items) {
        res.render('index', { title: 'COPTool', message: 'Big table goes here...', icons: items});
    }); 
});

http.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});
