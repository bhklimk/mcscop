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
                socket.emit('all_nodes',rows);
            }
        });
        connection.query('SELECT * FROM links', function(err, rows, fields) {
            if (!err) {
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
    socket.on('update_node', function(msg) {
        var node = JSON.parse(msg);
        connection.query('UPDATE nodes SET name = ?, address = ?, image = ?, x = ?, y = ? WHERE id = ?', [node.name, node.address, node.image, node.x, node.y, node.id], function (err, results) {
            if (!err) {
                socket.broadcast.emit('update_node', msg);
            }
        });
    });
    socket.on('update_event', function(msg) {
        var evt = JSON.parse(msg);
        connection.query('UPDATE events SET event_time = ?, source_node = ?, source_port = ?, dest_node = ?, dest_port = ?, analyst = ? WHERE id = ?', [evt.event_time, evt.source_node, evt.source_port, evt.dest_node, evt.dest_port, evt.analyst, evt.id], function (err, results) {
            if (!err) {
                socket.broadcast.emit('update_event', msg);
            }
        });
    });
    socket.on('insert_event', function(msg) {
        var evt = JSON.parse(msg);
        connection.query('INSERT INTO events (event_time, source_node, source_port, dest_node, dest_port, analyst) values (?, ?, ?, ?, ?, ?)', [evt.event_time, evt.source_node, evt.source_port, evt.dest_node, evt.dest_port, evt.analyst], function (err, results) {
            if (!err) {
                evt.id = results.insertId;
                io.emit('insert_event', JSON.stringify(evt));
            }
        });
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
