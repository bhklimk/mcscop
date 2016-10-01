var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");
ctx.strokeStyle = "lightgray";

var canvasOffset = $("#canvas").offset();
var offsetX = canvasOffset.left;
var offsetY = canvasOffset.top;

var mouseIsDown = false;
var creatingLink = false;
var panning = true;
var firstNode = null;
var selectedLink = null;
var startX = 0;
var startY = 0;
var scale = 1;
var originx = 0;
var originy = 0;
var zoomIntensity = 0.2;
var maxX = 5000;
var maxY = 5000;

var objects = {};
var nodeSelect = [{id:0, name:'none'}];
var links = {};
var images = {};
var tableData = [];

var socket = io();

var CustomDirectLoadStrategy = function(grid) {
    jsGrid.loadStrategies.DirectLoadingStrategy.call(this, grid);
};
 
CustomDirectLoadStrategy.prototype = new jsGrid.loadStrategies.DirectLoadingStrategy();
CustomDirectLoadStrategy.prototype.finishInsert = function(loadedData) {
    var grid = this._grid;
    if (loadedData['id'] != 0) {
        grid.option("data").push(loadedData);
        grid.refresh();
    }
    grid.inserting = false;
};

function addZero(i) {
    if (i < 10) {
        i = "0" + i;
    }
    return i;
}

var DateField = function(config) {
    jsGrid.Field.call(this, config);
};
 
DateField.prototype = new jsGrid.Field({
    css: "date-field",
    align: "center",
    sorter: function(date1, date2) {
        return new Date(date1) - new Date(date2);
    },
    itemTemplate: function(value) {
        var date = new Date(value);
        return (date.getFullYear() + '-' + addZero(date.getMonth()) + '-' + addZero(date.getDate()) + ' ' + addZero(date.getHours()) + ':' + addZero(date.getMinutes()) + ':' + addZero(date.getSeconds()) + '.' + date.getMilliseconds());
    },
    insertTemplate: function(value) {
        return this._insertPicker = $("<input>").datetimepicker({
            timeFormat: "HH:mm:ss.l",
            controlType: 'select',
            showMillisec: true
        });
    },
    editTemplate: function(value) {
        this._editPicker = $("<input>").datetimepicker({
            setDate: new Date(value),
            timeFormat: "HH:mm:ss.l",
            controlType: 'select',
            showMillisec: true
        });
        this._editPicker.datetimepicker('setDate', new Date(value));
        return this._editPicker;
    },
    insertValue: function() {
        return this._insertPicker.datepicker("getDate").getTime();
    },
    editValue: function() {
        return this._editPicker.datepicker("getDate").getTime();
    }
});
jsGrid.fields.date = DateField;

socket.emit('get_diagram','1');
socket.emit('get_events','1');

socket.on('all_nodes', function (msg) {
    nodeSelect = msg;
    for (var node in msg) {
        msg[node].selected = false;
        objects[msg[node]['uuid']] = msg[node];
        objects[msg[node]['uuid']].type = 'node';
    }
    nodeSelect.unshift({id:0, name:''});
    $('#jsGrid').jsGrid("fieldOption", "source_node","items",nodeSelect);
    $('#jsGrid').jsGrid("fieldOption", "dest_node","items",nodeSelect);
});

socket.on('all_links', function (msg) {
    links = []
    for (var link in msg) {
        links[msg[link]['id']] = msg[link];
        objects[msg[link].uuid] = msg[link];
        objects[msg[link].uuid].type = 'link';
    }
});

socket.on('all_events', function (msg) {
    for (var evt in msg) {
        tableData[msg[evt]['id']] = msg[evt];
    }
    $('#jsGrid').jsGrid('loadData');
});

socket.on('update_object', function(msg) {
    var o = JSON.parse(msg);
    console.log(o.x, o.y);
    objects[o.uuid] = o;
    if (o.type === 'node') {
        $('#jsGrid').jsGrid("fieldOption", "source_node","items",nodeSelect)
        $('#jsGrid').jsGrid("fieldOption", "dest_node","items",nodeSelect)
    }
});
    
socket.on('update_event', function(msg) {
    var evt = JSON.parse(msg);
    tableData[evt['id']] = evt;
    $('#jsGrid').jsGrid('loadData');
});    

socket.on('insert_event', function(msg) {
    var evt = JSON.parse(msg);
    tableData[evt['id']] = evt;
    $('#jsGrid').jsGrid('insertItem', evt);
});

socket.on('insert_object', function(msg) {
    var o = JSON.parse(msg);
    objects[o.uuid] = o;
});

socket.on('delete_object', function(msg) {
    var uuid = JSON.parse(msg);
    delete objects[uuid];
    closeProperties();
});

canvas.onmousewheel = function (e){
    e.preventDefault();
    var mousex = e.clientX - offsetX;
    var mousey = e.clientY - offsetY;
    var wheel = e.wheelDelta/120;
    var zoom = Math.exp(wheel*zoomIntensity);
    scale *= zoom;
    if (scale > 3)
        scale = 3;
    else if (scale < 1/5)
        scale = 1/5;
    else {
        originx -= mousex/(scale*zoom) - mousex/scale;
        originy -= mousey/(scale*zoom) - mousey/scale;
    }
}

var fps = 10;
var now;
var then = Date.now();
var interval = 1000/fps;
var delta;

function draw() {
    requestAnimationFrame(draw);
    drawAll();
}
draw();

function resize(canvas) {
    var displayWidth  = $('#diagram').parent().width();
    var displayHeight = canvas.clientHeight;
    if ($('#properties').is(':hidden')) {
        $('#diagram').width(displayWidth);
        canvas.width  = displayWidth;
    } else {
        $('#diagram').width(displayWidth - 310);
        canvas.width = $('#diagram').width();
    }
    canvas.height = displayHeight;
}

function drawAll() {
    resize(canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale,scale);
    if (originx < -(maxX / 2))
        originx = -(maxX / 2);
    if (originy < -(maxY / 2))
        originy = -(maxY / 2);
    ctx.translate(-originx, -originy);
    ctx.rect(-(maxX/2),-(maxY/2),maxX,maxY);
    ctx.fillStyle = "ghostwhite";
    ctx.fill();
    ctx.fillStyle = "black";
    for (o in objects) {
        if (objects[o].type === 'link')
           drawObject(objects[o]);
    }
    for (o in objects) {
        if (objects[o].type !== 'link')
            drawObject(objects[o]);
    }
}

function newLink() {
    unselectObjects();
    closeProperties();
    creatingLink = true;
    showMessage('Click on a node to start a new link.');
    $('#newNode').hide();
    $('#newLink').hide();
    $('#cancelLink').show();
}

function newNode() {
    unselectObjects();
    openProperties();
}

function cancelLink() {
    unselectObjects();
    firstNode = null;
    creatingLink = false;
    showMessage('Link cancelled.',5);
    $('#newNode').show();
    $('#newLink').show();
    $('#cancelLink').hide();
}

function drawObject(o, select) {
    if (o.type != 'link') {
        ctx.beginPath();
        ctx.moveTo(o.x-4, o.y-2);
        ctx.lineTo(o.x + o.width+2, o.y-2);
        ctx.lineTo(o.x + o.width+2, o.y + o.height+2);
        ctx.lineTo(o.x-4, o.y + o.height+2);
        ctx.closePath();
        if (o.selected) {
            ctx.fillStyle = 'lightgreen';
            ctx.strokeStyle = 'lightgreen';
            ctx.fill();
        }
        ctx.fillStyle = 'black';
        ctx.strokeStyle = 'black';
        if (o.image !== undefined && o.image !== null) {
           if (!images[o.image]) {
                images[o.image] = new Image();
                images[o.image].src = "images/icons/" + o.image;
            }
            ctx.drawImage(images[o.image], o.x, o.y, 64, 64);
        }
        if (o.type === 'node') {
            ctx.font = "14px Arial";
            ctx.fillText(o.name, o.x - ctx.measureText(o.name).width/2 + o.width/2, o.y + o.height + 12);
            if (o.address !== null)
                ctx.fillText(o.address,o.x - ctx.measureText(o.address).width/2 + o.width/2, o.y + o.height + 28);
        }
    } else {
        if (select || (selectedLink !== null && selectedLink.id == link.id)) {
            x1 = objects[o.node_a].x + objects[o.node_a].width/2;
            y1 = objects[o.node_a].y + objects[o.node_a].height/2;
            x2 = objects[o.node_b].x + objects[o.node_b].width/2;
            y2 = objects[o.node_b].y + objects[o.node_b].height/2;
            var dx = x2 - x1;
            var dy = y2 - y1;
            var lineLength = Math.sqrt(dx * dx + dy * dy);
            var lineRadianAngle = Math.atan2(dy, dx);
            var lineWidth = 15;
            ctx.save();
            ctx.beginPath();
            ctx.translate(x1, y1);
            ctx.rotate(lineRadianAngle);
            ctx.rect(0, -lineWidth / 2, lineLength, lineWidth);
            ctx.translate(-x1, -y1);
            ctx.rotate(-lineRadianAngle);
            ctx.fillStyle = 'lightgreen';
            ctx.strokeStyle = 'lightgreen';
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
        if (!select) {
            ctx.beginPath();
            ctx.moveTo(objects[o.node_a].x + objects[o.node_a].width/2, objects[o.node_a].y + objects[o.node_a].height/2);
            ctx.lineTo(objects[o.node_b].x + objects[o.node_b].width/2, objects[o.node_b].y + objects[o.node_b].height/2);
            ctx.closePath();
            ctx.stroke();
        }
    }
}

function insertNode() {
    socket.emit('insert_object', JSON.stringify({name:$('#propName').val(), address:$('#propAddress').val(), image:$('#propIcon').val(), type:'node'})); 
}

function deleteObject() {
    for (o in objects) {
        if (objects[o].selected) {
            socket.emit('delete_object', JSON.stringify({uuid:objects[o].uuid, type:objects[o].type}));
        }
    }
}

function showMessage(msg, timeout) {
    $('#message').html(msg);
}

function unselectObjects() {
    for (o in objects) {
        objects[o].selected = false;
    }
}

function countSelected() {
    var count = 0;
    for (o in objects) {
        if (objects[o].selected)
            count++;
    }
    console.log(count);
    return count;
}

function handleMouseDown(e) {
    e.preventDefault();
    mouseX = parseInt(e.clientX - offsetX);
    mouseY = parseInt(e.clientY - offsetY);
    startX = mouseX;
    startY = mouseY;
    panning = true;
    mouseIsDown = true;
    for (o in objects) {
        var o = objects[o];
        drawObject(o, true);
        if (ctx.isPointInPath(mouseX, mouseY)) {
            panning = false;
            if (creatingLink) {
                if (firstNode === null) {
                    firstNode = o;
                    showMessage('Click on a second node to complete the link.');
                } else {
                    $('#newNode').show();
                    $('#newLink').show();
                    $('#cancelLink').hide();
                    showMessage('Link created.', 5);
                    socket.emit('insert_object', JSON.stringify({node_a: firstNode.uuid, node_b: o.uuid, type:'link'}));
                    firstNode = null;
                    creatingLink = false;
                }
            } else {
                if (!e.shiftKey && !o.selected)
                    unselectObjects();
                if (!o.selected) {
                    o.selected = true;
                    if (countSelected() === 1) {
                        $('#propID').val(o.id);
                        $('#propName').val(o.name);
                        $('#propAddress').val(o.address);
                        $('#propIcon').val(o.image);
                        $('#propIcon').data('picker').sync_picker_with_select();
                        openProperties();
                    } else {
                        closeProperties();
                    }
                }
            }
            break;
        }
    }
    if (panning)
        unselectObjects();
    /*
    if (!creatingLink) {
        for (link in links) {
            var link = links[link];
            drawLink(link, true);
            if (ctx.isPointInPath(mouseX, mouseY)) {
                panning = false;
                selectedLink = link;
                openProperties();
                break;
            }
        }
    }*/
    if (countSelected() === 0) {
        $('#propID').val('0');
        $('#propName').val('');
        $('#propAddress').val('');
        $('#propIcon').val('');
        $('#propIcon').data('picker').sync_picker_with_select();
        closeProperties();
    }
}

function handleMouseUp(e) {
    e.preventDefault();
    for (o in objects) {
        if (objects[o].selected) {
            socket.emit('update_object', JSON.stringify(objects[o]));
        }
    }
    mouseIsDown = false;
}

function handleMouseOut(e) {
    e.preventDefault();
    mouseIsDown = false;
}

function handleMouseMove(e) {
    if (!mouseIsDown) {
        return;
    }
    mouseX = parseInt(e.clientX - offsetX);
    mouseY = parseInt(e.clientY - offsetY);
    var dx = mouseX - startX;
    var dy = mouseY - startY;
    startX = mouseX;
    startY = mouseY;
    if (!panning) {
        for (o in objects) {
            if (objects[o].selected && objects[o].type != 'link') {
                objects[o].x += (dx / scale);
                objects[o].y += (dy / scale);
                if (dx != 0 && dy != 0) {
                    now = Date.now();
                    delta = now - then;
                    if (delta > interval) {
                        socket.emit('update_object', JSON.stringify(objects[o]));
                        then = now - (delta % interval);
                    }
                }
            }
        }
    } else {
        originx -= dx / scale;
        originy -= dy / scale;
    }
    lastX = mouseX;
    lastY = mouseY;
}

function updatePropName(name) {
    for (o in objects) {
        if (objects[o].selected) {
            objects[o].name = name;
            socket.emit('update_object', JSON.stringify(objects[o]))
            if (objects[o].type === 'node') {
                $('#jsGrid').jsGrid("fieldOption", "source_node","items",nodeSelect)
                $('#jsGrid').jsGrid("fieldOption", "dest_node","items",nodeSelect)
            }
        }
    }
}

function updatePropAddress(address) {
    for (o in objects) {
        if (objects[o].selected) {
            objects[o].address = address;
            socket.emit('update_object', JSON.stringify(objects[o]))
        }
    }
}

function openProperties() {
    if (countSelected() > 0) {
        $('#propTitle').html('Edit Node');
        $('#insertNodeButton').hide();
        $('#deleteNodeButton').show();
    } else {
        unselectObjects();
        $('#propTitle').html('New Node');
        $('#insertNodeButton').show();
        $('#propID').val('');
        $('#propName').val('');
        $('#propAddress').val('');
        $('#propIcon').val('0000-default.png');
        $('#propIcon').data('picker').sync_picker_with_select();
        $('#deleteNodeButton').hide();
    }
    if ($('#properties').is(':hidden')) {
        $('#properties').show();
        $('#diagram').width($('#diagram').width() - 310);
    }
}

function closeProperties() {
    $('#properties').hide();
    $('#diagram').width('100%');
}

$(document).on('scroll', function() {
    canvasOffset = $("#canvas").offset();
    offsetX = canvasOffset.left;
    offsetY = canvasOffset.top - $(window).scrollTop();
});

$("#canvas").mousedown(function (e) {
    handleMouseDown(e);
});
$("#canvas").mousemove(function (e) {
    handleMouseMove(e);
});
$("#canvas").mouseup(function (e) {
    handleMouseUp(e);
});
$('#canvas').mouseout(function (e) {
    handleMouseOut(e);
});

$(document).ready(function() {
    $('#propIcon').imagepicker({
        hide_select : true,
        selected : function() {
            for (o in objects) {
                if (objects[o].selected) {
                  objects[o].image = $(this).val();
                  socket.emit('update_object', JSON.stringify(objects[o]))
                }
            }
        }
    });
    function timestamp(str){
        return new Date(str).getTime();   
    }
    var dateSlider = document.getElementById('slider');
    noUiSlider.create(dateSlider, {
        range: {
            min: timestamp('2010-11-20 00:00:01'),
            max: timestamp('2010-11-20 23:59:59')
        },
        step: 1000,
        start: [ timestamp('2011-11-20 00:00:01') ]
    });

    dateSlider.noUiSlider.on('update', function( values, handle ) {
        console.log(values[handle]);
    });

    $('#jsGrid').jsGrid({
        autoload: false,
        width: '100%',
        height: '400px',
        editing: true,
        sorting: true,
        paging: true,
        fields: [
            { name: 'id', type: 'number', css: 'hide', width: 0},
            { name: 'event_time', title: 'Event Time', type : 'date', width: 55},
            { name: 'source_node', title: 'Source Node', type: 'select', items: nodeSelect, valueField: 'id', textField: 'name', filterValue: function() {
                    return this.items[this.filterControl.val()][this.textField];
                }
            },
            { name: 'source_port', title: 'Source Port', type: 'number', width: 35},
            { name: 'dest_node', title: 'Destination Node', type: 'select', items: nodeSelect, valueField: 'id', textField: 'name', filterValue: function() {
                    return this.items[this.filterControl.val()][this.textField];
                }
            },
            { name: 'dest_port', title: 'Destination Port', type: 'number', width: 35},
            { name: 'short_desc', title: 'Event Text', type: 'text'},
            { name: 'analyst', title: 'Analyst', type: 'text'},
            { 
                type: "control",
                editButton: false,
                headerTemplate: function() {
                    var grid = this._grid;
                    var isInserting = grid.inserting;

                    var $button = $("<input>").attr("type", "button")
                        .addClass([this.buttonClass, this.modeButtonClass, this.insertModeButtonClass].join(" "))
                        .on("click", function() {
                            isInserting = !isInserting;
                            grid.option("inserting", isInserting);
                        });

                    return $button;
                }
            }
        ],
        controller: {
            loadData: function () {
                return Object.keys(tableData).map(function (key) { return tableData[key]; });
            },
            insertItem: function(item) {
                if (item['id'] == '0') {
                    socket.emit('insert_event', JSON.stringify(item));
                }
                return item;
            },
            updateItem: function(item) {
                socket.emit('update_event', JSON.stringify(item));
                console.log(item);
                tableData[item['id']] = item;
            }
        },
        loadStrategy: function() {
            return new CustomDirectLoadStrategy(this);
        },
        rowClick: function(args) {
            var $row = $(args.event.target).closest("tr");
            if(this._editingRow) {
                this.updateItem().done($.proxy(function() {
                    this.editing && this.editItem($row);
                }, this));
                return;
            }
            this.editing && this.editItem($row);
        }
    });
});
