var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");
ctx.strokeStyle = "lightgray";

var canvasOffset = $("#canvas").offset();
var offsetX = canvasOffset.left;
var offsetY = canvasOffset.top;

var mouseIsDown = false;
var creatingLink = false;
var firstNode = null;
var secondNode = null;
var selectedNode = null;
var startX = 0;
var startY = 0;
var scale = 1;
var originx = 0;
var originy = 0;
var zoomIntensity = 0.2;
var maxX = 5000;
var maxY = 5000;

var newNode = false;
var nodes = [];
var nodeSelect = [{id:0, name:'none'}];
var links = [];
var images = [];
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
        return this._insertPicker.datepicker("getDate").toISOString();
    },
    editValue: function() {
        console.log('here');
        return this._editPicker.datepicker("getDate").toISOString();
    }
});
jsGrid.fields.date = DateField;

socket.emit('get_diagram','1');
socket.emit('get_events','1');

socket.on('all_nodes', function (msg) {
    nodes = [];
    nodeSelect = msg;

    for (var node in msg) {
        nodes[msg[node]['id']] = msg[node];
    }
    nodeSelect.unshift({id:0, name:''});
    $('#jsGrid').jsGrid("fieldOption", "source_node","items",nodeSelect);
    $('#jsGrid').jsGrid("fieldOption", "dest_node","items",nodeSelect);
});

socket.on('all_links', function (msg) {
    links = []
    for (var link in msg) {
        links[msg[link]['id']] = msg[link];
    }
});

socket.on('all_events', function (msg) {
    for (var evt in msg) {
        tableData[msg[evt]['id']] = msg[evt];
    }
    $('#jsGrid').jsGrid('loadData');
});

socket.on('update_node', function(msg) {
    var node = JSON.parse(msg);
    nodes[node.id] = node;
    $('#jsGrid').jsGrid("fieldOption", "source_node","items",nodeSelect)
    $('#jsGrid').jsGrid("fieldOption", "dest_node","items",nodeSelect)
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

socket.on('insert_node', function(msg) {
    var node = JSON.parse(msg);
    nodes[node['id']] = node;
});

socket.on('insert_link', function(msg) {
    var link = JSON.parse(msg);
    links[link['id']] = link;
});

socket.on('delete_node', function(msg) {
    var id = JSON.parse(msg);
    delete nodes[id];
    selectedNode = null;
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
    for (link in links) {
        if (nodes[links[link]['node_a']] && nodes[links[link]['node_b']]) {
            drawLink(links[link]);
        }
    }
    for (node in nodes) {
        if (!images[nodes[node].image]) {
            images[nodes[node].image] = new Image();
            images[nodes[node].image].src = "images/icons/" + nodes[node].image;
        }
        drawNode(nodes[node]);
    }
}

function drawLink(link) {
    ctx.beginPath();
    ctx.moveTo(nodes[link.node_a].x + nodes[link.node_a].width/2, nodes[link.node_a].y + nodes[link.node_a].height/2);
    ctx.lineTo(nodes[link.node_a].x + nodes[link.node_a].width/2+10, nodes[link.node_a].y + nodes[link.node_a].height/2+10);
    ctx.lineTo(nodes[link.node_b].x + nodes[link.node_b].width/2+10, nodes[link.node_b].y + nodes[link.node_b].height/2+10);
    ctx.lineTo(nodes[link.node_b].x + nodes[link.node_b].width/2, nodes[link.node_b].y + nodes[link.node_b].height/2);
    ctx.closePath();
    ctx.stroke();
}

function newLink() {
    selectedNode = null;
    closeProperties();
    creatingLink = true;
    showMessage('Click on a node to start a new link.');
    $('#newNode').hide();
    $('#newLink').hide();
    $('#cancelLink').show();
}

function cancelLink() {
    selectedNode = null;
    firstNode = null;
    creatingLink = false;
    showMessage('Link cancelled.',5);
    $('#newNode').show();
    $('#newLink').show();
    $('#cancelLink').hide();
}

function drawNode(node) {
    ctx.drawImage(images[node.image], node.x, node.y, 64, 64);
    ctx.beginPath();
    ctx.moveTo(node.x-2, node.y-2);
    ctx.lineTo(node.x + node.width+2, node.y-2);
    ctx.lineTo(node.x + node.width+2, node.y + node.height+2);
    ctx.lineTo(node.x-2, node.y + node.height+2);
    ctx.closePath();
    if (selectedNode !== null && selectedNode['id'] === node.id)
        ctx.stroke();
    ctx.font = "14px Arial";
    ctx.fillText(node.name,node.x - ctx.measureText(node.name).width/2 + node.width/2, node.y + node.height + 12);
    if (node.address !== null)
        ctx.fillText(node.address,node.x - ctx.measureText(node.address).width/2 + node.width/2, node.y + node.height + 28);
}

function insertNode() {
    socket.emit('insert_node', JSON.stringify({name:$('#propName').val(), address:$('#propAddress').val(), image:$('#propIcon').val()})); 
}

function deleteNode() {
    if (selectedNode !== null && selectedNode['id']) {
        socket.emit('delete_node', JSON.stringify(selectedNode));
    }
}

function showMessage(msg, timeout) {
    $('#message').html(msg);
}

function handleMouseDown(e) {
    e.preventDefault();
    mouseX = parseInt(e.clientX - offsetX);
    mouseY = parseInt(e.clientY - offsetY);
    startX = mouseX;
    startY = mouseY;
    selectedNode = null;
    mouseIsDown = true;
    for (node in nodes) {
        var node = nodes[node];
        drawNode(node);
        if (ctx.isPointInPath(mouseX, mouseY)) {
            if (creatingLink) {
                if (firstNode === null) {
                    firstNode = node;
                    showMessage('Click on a second node to complete the link.');
                } else {
                    $('#newNode').show();
                    $('#newLink').show();
                    $('#cancelLink').hide();
                    showMessage('Link created.', 5);
                    socket.emit('insert_link', JSON.stringify({node_a: firstNode.id, node_b: node.id}));
                    firstNode = null;
                    creatingLink = false;
                }
            } else {
                selectedNode = node;
                $('#propID').val(node.id);
                $('#propName').val(node.name);
                $('#propAddress').val(node.address);
                $('#propIcon').val(node.image);
                $('#propIcon').data('picker').sync_picker_with_select();
                newNode = false;
                openProperties();
            }
            break;
        }
    }
    for (link in links) {
        var link = links[link];

        drawLink(link);
        if (ctx.isPointInPath(mouseX, mouseY)) {
            console.log('clicked link');
        }
    }
    if (selectedNode === null) {
        $('#propID').val('0');
        $('#propName').val('');
        $('#propAddress').val('');
        $('#propIcon').val('');
        $('#propIcon').data('picker').sync_picker_with_select();
        newNode = false;
        closeProperties();
    }
}

function handleMouseUp(e) {
    e.preventDefault();
    if (selectedNode !== null) {
        socket.emit('update_node', JSON.stringify(selectedNode));
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
    if (selectedNode !== null) {
        selectedNode.x += dx / scale;
        selectedNode.y += dy / scale;
        if (dx != 0 && dy != 0)
            socket.emit('update_node', JSON.stringify(selectedNode));
    } else {
        originx -= dx / scale;
        originy -= dy / scale;
    }
    lastX = mouseX;
    lastY = mouseY;
}

function updatePropName(name) {
    if (selectedNode !== null) {
        selectedNode.name = name;
        socket.emit('update_node', JSON.stringify(selectedNode))
        $('#jsGrid').jsGrid("fieldOption", "source_node","items",nodeSelect)
        $('#jsGrid').jsGrid("fieldOption", "dest_node","items",nodeSelect)
    }
}

function updatePropAddress(address) {
    if (selectedNode !== null) {
        selectedNode.address = address;
        socket.emit('update_node', JSON.stringify(selectedNode))
    }
}

function openProperties(makeNew) {
    if (makeNew === undefined || makeNew === null || makeNew === '') {
        $('#propTitle').html('Edit Node');
        $('#insertNodeButton').hide();
        $('#deleteNodeButton').show();
        newNode = false;
    } else {
        selectedNode = null;
        $('#propTitle').html('New Node');
        $('#insertNodeButton').show();
        $('#propID').val('');
        $('#propName').val('');
        $('#propAddress').val('');
        $('#propIcon').val('0000-default.png');
        $('#propIcon').data('picker').sync_picker_with_select();
        $('#deleteNodeButton').hide();
        newNode = true;
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

$(document).ready(function() {
    $('#propIcon').imagepicker({
        hide_select : true,
        selected : function() {
            if (selectedNode !== null) {
                selectedNode.image = $(this).val();
                socket.emit('update_node', JSON.stringify(selectedNode))
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
            { name: 'event_time', title: 'Event Time', type : 'date' },
            { name: 'source_node', title: 'Source Node', type: 'select', items: nodeSelect, valueField: 'id', textField: 'name', filterValue: function() {
                    return this.items[this.filterControl.val()][this.textField];
                }
            },
            { name: 'source_port', title: 'Source Port', type: 'number'},
            { name: 'dest_node', title: 'Destination Node', type: 'select', items: nodeSelect, valueField: 'id', textField: 'name', filterValue: function() {
                    return this.items[this.filterControl.val()][this.textField];
                }
            },
            { name: 'dest_port', title: 'Destination Port', type: 'number'},
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
