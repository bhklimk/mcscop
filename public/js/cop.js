var canvas = new fabric.Canvas('canvas');
canvas.selection = false;

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

var nodeSelect = [{id:0, name:'none'}];
var dateSlider = null;
var images = {};
var tableData = [];
var eventTimes = [];

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
        return (date.getFullYear() + '-' + addZero(date.getMonth()+1) + '-' + addZero(date.getDate()) + ' ' + addZero(date.getHours()) + ':' + addZero(date.getMinutes()) + ':' + addZero(date.getSeconds()) + '.' + date.getMilliseconds());
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
        if (msg[node].image !== undefined && msg[node].image !== null) {
            if (!images[msg[node].image]) {
                images[msg[node].image] = new Image();
                images[msg[node].image].src = "images/icons/" + msg[node].image;
            }
            var image = new fabric.Image(images[msg[node].image], {
                originX: 'center',
                originY: 'bottom',
                width: msg[node].width,
                height: msg[node].height,
            });
            var name = new fabric.Text(msg[node].name, {
                textAlign: 'center',
                fontSize: 14,
                originX: 'center'
            });
            var address = new fabric.Text(msg[node].address, {
                textAlign: 'center',
                fontSize: 14,
                originX: 'center',
                top: 18
            });
            canvas.add(new fabric.Group([image, name, address], {
                uuid: msg[node].uuid,
                type: 'node',
                image: image,
                image_file: msg[node].image,
                name: name,
                address: address,
                left: msg[node].x,
                top: msg[node].y
            }));
        }
    }
    setTimeout(function() { canvas.renderAll(); }, 100);
    nodeSelect.unshift({id:0, name:''});
    $('#events').jsGrid("fieldOption", "source_node","items",nodeSelect);
    $('#events').jsGrid("fieldOption", "dest_node","items",nodeSelect);
});

socket.on('all_links', function (msg) {
    links = []
    for (var link in msg) {
        var firstObject = null;
        var secondObject = null;
        for (var i = 0; i < canvas.getObjects().length; i++) {
            if (canvas.item(i).uuid == msg[link].node_a) {
                firstObject = canvas.item(i);
            }
            if (canvas.item(i).uuid == msg[link].node_b) {
                secondObject = canvas.item(i);
            }
        }
        if (firstObject !== null && secondObject !== null) {
            var from = firstObject.getCenterPoint();
            var to = secondObject.getCenterPoint();
            var line = new fabric.Line([from.x, from.y, to.x, to.y], {
                uuid: msg[link].uuid,
                type: 'link',
                fromObj: firstObject,
                toObj: secondObject,
                fill: 'black',
                stroke: 'black',
                strokeWidth: 2,
                selectable: false
            });
            canvas.add(line).sendToBack(line);
        }
    }
});

socket.on('all_events', function (msg) {
    tableData = [];
    eventTimes = [0];
    for (var evt in msg) {
        tableData.push(msg[evt]);
        eventTimes.push(msg[evt].event_time);
    }
    dateSlider.noUiSlider.updateOptions({
        range: {
            min: 0,
            max: eventTimes.length-1
        },
        start: 0,
        handles: 1,
    }); 
    $('#events').jsGrid('loadData');
    $('#events').jsGrid('sort', 1, 'asc');
});

socket.on('update_object', function(msg) {
    var o = JSON.parse(msg);
    for (var i = 0; i < canvas.getObjects().length; i++) {
        if (canvas.item(i).uuid = o.uuid) {

        }
    }
    if (o.type === 'node') {
        $('#events').jsGrid("fieldOption", "source_node","items",nodeSelect)
        $('#events').jsGrid("fieldOption", "dest_node","items",nodeSelect)
    }
});

socket.on('update_object_pos', function (msg) {
    var o = JSON.parse(msg);
    for (var i = 0; i < canvas.getObjects().length; i++) {
        if (canvas.item(i).uuid == o.uuid) {
            canvas.item(i).animate({left: o.x, top: o.y}, {
                duration: 100,
                onChange: function() {
                    canvas.renderAll();;
                }
            });
        }
    }
});
    
socket.on('update_event', function(msg) {
    var evt = JSON.parse(msg);
    for (var i = 0; i < tableData.length; i++) {
        if (tableData[i].uuid === evt.uuid) {
            tableData[i] = evt;
        }
    }
    $('#events').jsGrid('loadData');
    $('#events').jsGrid('sort', 1, 'asc');
});    

socket.on('insert_event', function(msg) {
    var evt = JSON.parse(msg);
    tableData[evt['id']] = evt;
    $('#events').jsGrid('insertItem', evt);
});

socket.on('insert_object', function(msg) {
    var o = JSON.parse(msg);
});

socket.on('delete_object', function(msg) {
    var uuid = JSON.parse(msg);
    closeProperties();
});

function startPan(event) {
    if (event.button != 2) {
        return;
    }
    var x0 = event.screenX;
    var y0 = event.screenY;
    function continuePan(event) {
        var x = event.screenX,
            y = event.screenY;
        canvas.relativePan({ x: x - x0, y: y - y0 });
        x0 = x;
        y0 = y;
    }
    function stopPan(event) {
        $(window).off('mousemove', continuePan);
        $(window).off('mouseup', stopPan);
    };
    $(window).mousemove(continuePan);
    $(window).mouseup(stopPan);
    $(window).contextmenu(cancelMenu);
};

function cancelMenu() {
    $(window).off('contextmenu', cancelMenu);
    return false;
}
$('#diagram').mousedown(startPan);

canvas.on('object:modified', function(options) {
    if (options.target) {
        if (canvas.getActiveObject() !== null) {
            socket.emit('update_object_pos', JSON.stringify({uuid: options.target.uuid, type: options.target.type, x: options.target.left, y: options.target.top}));
        } else if (canvas.getActiveGroup() !== null) {
            for (var i = 0; i < options.target.getObjects().length; i++) {
                var left = options.target.getCenterPoint().x + options.target.item(i).left;
                var top = options.target.getCenterPoint().y + options.target.item(i).top;
                socket.emit('update_object_pos', JSON.stringify({uuid: options.target.item(i).uuid, type: options.target.item(i).type, x: left, y: top}));
            }
        }
    }
});

canvas.on('object:selected', function(options) {
    if (options.target) {
        if (canvas.getActiveObject() !== null && canvas.getActiveGroup() === null) {
            if (options.target.type !== undefined && options.target.type === 'node') {
                $('#propID').val(options.target.uuid);
                $('#propName').val(options.target.name.text);
                $('#propAddress').val(options.target.address.text);
                $('#propIcon').val(options.target.image_file);
                $('#propIcon').data('picker').sync_picker_with_select();
                openProperties(options.target.type);
            }
        } else {
            closeProperties();
        }
    }
});

canvas.on('before:selection:cleared', function(options) {
    closeProperties();
});

canvas.on('before:render', function(e) {
    for (var i = 0; i < canvas.getObjects().length; i++) {
        if (canvas.item(i).type !== undefined && canvas.item(i).type === 'link') {
            var fromObj = canvas.item(i).fromObj;
            var toObj = canvas.item(i).toObj;
            if (fromObj.group !== undefined || toObj.group !== undefined) {
                if (fromObj.group !== undefined)
                    canvas.item(i).set({ 'x1': fromObj.getCenterPoint().x + fromObj.group.getCenterPoint().x, 'y1': fromObj.getCenterPoint().y + fromObj.group.getCenterPoint().y });
                if (toObj.group !== undefined)
                    canvas.item(i).set({ 'x2': toObj.getCenterPoint().x + toObj.group.getCenterPoint().x, 'y2': toObj.getCenterPoint().y + toObj.group.getCenterPoint().y });
            } else {
                canvas.item(i).set({ 'x1': fromObj.getCenterPoint().x, 'y1': fromObj.getCenterPoint().y });
                canvas.item(i).set({ 'x2': toObj.getCenterPoint().x, 'y2': toObj.getCenterPoint().y });
            }
        }
    }
});

var fps = 10;
var now;
var then = Date.now();
var interval = 1000/fps;
var delta;

function resize() {
    var displayWidth  = $('#diagram').parent().width();
    if ($('#properties').is(':hidden')) {
        $('#diagram').width(displayWidth - 60);
        canvas.setWidth($('#diagram').width());
        canvas.setHeight($('#diagram').height());
        canvas.calcOffset();
        canvas.renderAll();
    } else {
        $('#diagram').width(displayWidth - (310 + 45));
        canvas.setWidth($('#diagram').width());
        canvas.setHeight($('#diagram').height());
        canvas.calcOffset();
        canvas.renderAll();
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

function cancelLink() {
    unselectObjects();
    firstNode = null;
    creatingLink = false;
    showMessage('Link cancelled.',5);
    $('#newNode').show();
    $('#newLink').show();
    $('#cancelLink').hide();
}

function insertNode() {
    socket.emit('insert_object', JSON.stringify({name:$('#propName').val(), address:$('#propAddress').val(), image:$('#propIcon').val(), type:'node'})); 
}

function deleteObject() {
    for (o in objects) {
        if (selectedObjects[objects[o].uuid]) {
            socket.emit('delete_object', JSON.stringify({uuid:objects[o].uuid, type:objects[o].type}));
        }
    }
}

function showMessage(msg, timeout) {
    $('#message').html(msg);
}

function unselectObjects() {
    selectedObjects = {};
}

function updatePropName(name) {
    if (canvas.getActiveObject() !== null && canvas.getActiveObject().type === 'node') {
        canvas.getActiveObject().name.text = name;
        canvas.renderAll();
        updateObject(canvas.getActiveObject());
        $('#events').jsGrid("fieldOption", "source_node","items",nodeSelect)
        $('#events').jsGrid("fieldOption", "dest_node","items",nodeSelect)
    }
}

function updatePropAddress(address) {
    if (canvas.getActiveObject() !== null && canvas.getActiveObject().type === 'node') {
        canvas.getActiveObject().address.text = address;
        canvas.renderAll();
        updateObject(canvas.getActiveObject());
    }
}

function updateObject(o) {

    //socket.emit('update_object', JSON.stringify(objects[o]))
}

function toggleProperties(type) {
    if ($('#properties').is(':hidden')) {
        openProperties(type);
    } else {
        if ($('#' + type + 'sForm').is(':hidden'))
            openProperties(type);
        else
            closeProperties();
    }
}

function openProperties(type) {
    // edit
    if (canvas.getActiveObject() !== undefined && canvas.getActiveObject() !== null) {
        if (type === 'node') {
            $('#propTitle').html('Edit Node');
            $('#insertNodeButton').hide();
            $('#deleteButton').show();
            $('#nodesButton').css('border-right','0px');
            $('#shapesForm').hide();
            $('#linksForm').hide();
            $('#nodesForm').show();
        } else if (type === 'shape') {
            $('#propTitle').html('Edit Shape');
            $('#shapesForm').show();
            $('#linksForm').hide();
            $('#nodesForm').hide();
        } else if (type === 'link') {
            $('#propTitle').html('Edit Link');
            $('#nodesForm').hide();
            $('#shapesForm').hide();
            $('#linksForm').show();
        } else {
            closeProperties();
            return;
        }
    // new
    } else if (canvas.getActiveObject() === undefined || canvas.getActiveObject() === null) {
        if (type === 'node') {
            $('#propTitle').html('New Node');
            $('#insertNodeButton').show();
            $('#propID').val('');
            $('#propName').val('');
            $('#propAddress').val('');
            $('#propIcon').val('00-000-hub.png');
            $('#propIcon').data('picker').sync_picker_with_select();
            $('#deleteButton').hide();
            $('#nodesButton').css('border-right','0px');
            $('#shapesForm').hide();
            $('#linksForm').hide();
            $('#nodesForm').show();
        } else if (type === 'shape') {
            $('#propTitle').html('New Shape');
            $('#insertShapeButton').show();
            $('#propID').val('');
            $('#propName').val('');
            $('#deleteButton').hide();
            $('#shapesButton').css('border-right','0px');
            $('#shapesForm').show();
            $('#linksForm').hide();
            $('#nodesForm').hide();
        } else if (type === 'link') {
            $('#propTitle').html('New Link');
            $('#shapesForm').hide();
            $('#linksForm').show();
            $('#nodesForm').hide();
        }
    } else {
        return;
    }
    if ($('#properties').is(':hidden')) {
        $('#properties').show();
        $('#diagram').width($('#diagram').width() - 310);
    }
    resize();
}

function closeProperties() {
    $('#properties').hide();
    $('#diagram').width('100%');
    $('#nodesButton').css('border-right','1px black solid');
    $('#linksButton').css('border-right','1px black solid');
    $('#shapesButton').css('border-right','1px black solid');
    $('#nodesForm').show();
    $('#linksForm').show();
    $('#shapesForm').show();
    resize();
}

$(document).ready(function() {
    resize();
    $('#propIcon').imagepicker({
        hide_select : true,
        selected : function() {
            if (canvas.getActiveObject() !== null && canvas.getActiveObject().type === 'node') {
                canvas.getActiveObject().image_file = $(this).val();
                if (!images[$(this).val()]) {
                    images[$(this).val()] = new Image();
                    images[$(this).val()].src = "images/icons/" + $(this).val();
                }
                canvas.getActiveObject().image.setElement(images[$(this).val()]);
                canvas.getActiveObject().image.setWidth(64);
                canvas.getActiveObject().image.setHeight(64);
                updateObject(canvas.getActiveObject());
                setTimeout(function () { canvas.renderAll(); }, 100);
            }
        }
    });
    function timestamp(str){
        return new Date(str).getTime();   
    }
    dateSlider = document.getElementById('slider');
    noUiSlider.create(dateSlider, {
        range: {
            min: 0,
            max: 1
        },
        step: 1,
        start: [0]
    });

    dateSlider.noUiSlider.on('update', function(values, handle) {
        var filter = eventTimes[parseInt(values[handle])];
        for (var i = 0; i < tableData.length; i++) {
            if (tableData[i].event_time === filter) {
                $('#events').jsGrid("rowByItem",tableData[i]).addClass('highlight');
            } else {
                $('#events').jsGrid("rowByItem",tableData[i]).removeClass('highlight');
            }
        }
    });

    $('#events').jsGrid({
        autoload: false,
        width: '100%',
        height: '400px',
        editing: true,
        sorting: true,
        paging: true,
        fields: [
            { name: 'id', type: 'number', css: 'hide', width: 0},
            { name: 'event_time', title: 'Event Time', type : 'date', width: 65},
            { name: 'source_node', title: 'Source Node', type: 'select', items: nodeSelect, valueField: 'id', textField: 'name', width: 65, filterValue: function() {
                    return this.items[this.filterControl.val()][this.textField];
                }
            },
            { name: 'source_port', title: 'SPort', type: 'number', width: 25},
            { name: 'dest_node', title: 'Destination Node', type: 'select', items: nodeSelect, valueField: 'id', textField: 'name', width: 65, filterValue: function() {
                    return this.items[this.filterControl.val()][this.textField];
                }
            },
            { name: 'dest_port', title: 'DPort', type: 'number', width: 25},
            { name: 'short_desc', title: 'Event Text', type: 'text'},
            { name: 'analyst', title: 'Analyst', type: 'text', width: 50},
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

$(function() {
  $('.tabs nav a').on('click', function() {
    show_content($(this).index());
  });
  show_content(0);
  function show_content(index) {
    $('.tabs .content.visible').removeClass('visible');
    $('.tabs .content:nth-of-type(' + (index + 1) + ')').addClass('visible');
    $('.tabs nav a.selected').removeClass('selected');
    $('.tabs nav a:nth-of-type(' + (index + 1) + ')').addClass('selected');
  }
});
