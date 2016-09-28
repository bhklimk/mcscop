var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");
ctx.strokeStyle = "lightgray";

var canvasOffset = $("#canvas").offset();
var offsetX = canvasOffset.left;
var offsetY = canvasOffset.top;

var mouseIsDown = false;
var selectedNode = null;
var startX = 0;
var startY = 0;

var nodes = [];
var nodeSelect = [{id:0, name:'none'}];
var links = [];
var images = [];
var tableData = [];

var socket = io();

var MyCustomDirectLoadStrategy = function(grid) {
    jsGrid.loadStrategies.DirectLoadingStrategy.call(this, grid);
};
 
MyCustomDirectLoadStrategy.prototype = new jsGrid.loadStrategies.DirectLoadingStrategy();
MyCustomDirectLoadStrategy.prototype.finishInsert = function(loadedData) {
    var grid = this._grid;
    if (loadedData['id'] != 0) {
        grid.option("data").push(loadedData);
        grid.refresh();
    }
    grid.inserting = false;
};

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

function draw() {
    requestAnimationFrame(draw);
    drawAll();
}
draw();

function resize(canvas) {
    var displayWidth  = canvas.clientWidth;
    var displayHeight = canvas.clientHeight;
    if (canvas.width  != displayWidth || canvas.height != displayHeight) {
        canvas.width  = displayWidth;
        canvas.height = displayHeight;
    }
}

function drawAll() {
    resize(canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    ctx.lineTo(nodes[link.node_b].x + nodes[link.node_b].width/2, nodes[link.node_b].y + nodes[link.node_b].height/2);
    ctx.closePath();
    ctx.stroke();
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

function handleMouseDown(e) {
    e.preventDefault();
    mouseX = parseInt(e.clientX - offsetX);
    mouseY = parseInt(e.clientY - offsetY);
    startX = mouseX;
    startY = mouseY;
    selectedNode = null;
    for (node in nodes) {
        var node = nodes[node];
        drawNode(node);
        if (ctx.isPointInPath(mouseX, mouseY)) {
            selectedNode = node;
            $('#propID').val(node.id);
            $('#propName').val(node.name);
            $('#propAddress').val(node.address);
            $('#propIcon').val(node.image);
            $('#propIcon').data('picker').sync_picker_with_select();
            mouseIsDown = true;
            break;
        }
    }
    if (selectedNode === null) {
        $('#propID').val('0');
        $('#propName').val('');
        $('#propAddress').val('');
        $('#propIcon').val('');
        $('#propIcon').data('picker').sync_picker_with_select();
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
        selectedNode.x += dx;
        selectedNode.y += dy;
        if (dx != 0 && dy != 0)
            socket.emit('update_node', JSON.stringify(selectedNode));
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

    $('#jsGrid').jsGrid({
        autoload: false,
        width: '100%',
        height: '400px',
        editing: true,
        sorting: true,
        paging: true,
        fields: [
            { name: 'id', type: 'number', css: 'hide', width: 0},
            { name: 'event_time', title: 'Event Time', type : 'text' },
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
            return new MyCustomDirectLoadStrategy(this);
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
