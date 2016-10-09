var canvas = new fabric.Canvas('canvas');
canvas.selection = false;

var creatingLink = false;
var firstNode = null;
var startX = 0;
var startY = 0;
var scale = 1;
var originx = 0;
var originy = 0;
var zoomIntensity = 0.2;
var mission = null;
var objectSelect = [{id:0, name:'none/unknown'}];
var dateSlider = null;
var images = {};
var tableData = [];
var eventTimes = [];
var objectsLoaded = null;
var socket = io();
var fps = 10;
var now;
var then = Date.now();
var interval = 1000/fps;
var delta;

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

socket.on('all_objects', function (msg) {
    canvas.clear();
    objectSelect = [{id:0, name:'none/unknown'}];
    objectsLoaded = [];
    for (var o in msg) {
        objectSelect.push({uuid:msg[o].uuid, name:msg[o].name});
        objectsLoaded.push(false);
        addObjectToCanvas(msg[o]);
    }
    checkIfObjectsLoaded();    
});

function checkIfObjectsLoaded() {
    if (objectsLoaded.length == 0) {
        socket.emit('get_links', mission);
        console.log('loaded');
    } else {
        setTimeout(checkIfObjectsLoaded, 100);
    }
}

socket.on('connect', function() {
    $('#modal').modal('hide');
    socket.emit('get_objects', mission);
    socket.emit('get_events', mission);
});

socket.on('disco', function (msg) {
    $('#modal').modal('show');
});

socket.on('disconnect', function() {
    $('#modal').modal('show')
});

socket.on('all_links', function (msg) {
    links = []
    console.log('link');
    for (var link in msg) {
        var fromObject = null;
        var toObject = null;
        for (var i = 0; i < canvas.getObjects().length; i++) {
            if (canvas.item(i).uuid == msg[link].node_a) {
                fromObject = canvas.item(i);
            }
            if (canvas.item(i).uuid == msg[link].node_b) {
                toObject = canvas.item(i);
            }
        }
        if (fromObject !== null && toObject !== null) {
            var from = fromObject.getCenterPoint();
            var to = toObject.getCenterPoint();
            var line = new fabric.Line([from.x, from.y, to.x, to.y], {
                uuid: msg[link].uuid,
                type: 'link',
                from: msg[link].node_a,
                to: msg[link].node_b,
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
        if (canvas.item(i).uuid == o.uuid) {
            if (o.type === 'node' || o.type === 'shape') {
                canvas.item(i).name.text = o.name;
                canvas.item(i).name.address = o.address;
                if (canvas.item(i).image !== o.image) {
                    canvas.item(i).image = o.image;
                    canvas.item(i).color = o.color;
                    var path = 'images/icons/';
                    if (o.type === 'shape')
                        path = 'images/shapes/';
                    fabric.loadSVGFromURL(path + o.image, function(objects, options) {
                        colorSet = o.color;
                        var shape = fabric.util.groupSVGElements(objects, options);
                        shape.set({
                            originX: 'center',
                            originY: 'bottom'
                        });
                        if (shape.isSameColor && shape.isSameColor() || !shape.paths) {
                            shape.setFill(colorSet);
                        } else if (shape.paths) {
                            for (var j = 0; j < shape.paths.length; j++) {
                                if (shape.paths[j].fill !== 'rgba(255,255,255,1)')
                                    shape.paths[j].setFill(colorSet);
                            }
                        }
                        canvas.item(i).shape.set('paths', shape.paths);
                        canvas.renderAll();
                    });
                }
                if (canvas.item(i).color !== o.color) {

                }
                canvas.renderAll();
            }
            break;
        }
    }
    $('#events').jsGrid("fieldOption", "source_object","items",objectSelect)
    $('#events').jsGrid("fieldOption", "dest_object","items",objectSelect)
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
    addObjectToCanvas(o);
});

socket.on('delete_object', function(msg) {
    var uuid = JSON.parse(msg);
    for (var i = 0; i < canvas.getObjects().length; i++) {
        if (canvas.item(i).uuid == uuid) {
            canvas.remove(canvas.item(i)); 
        }
    }
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
            if (options.target.type !== undefined && (options.target.type === 'node' || options.target.type === 'shape')) {
                $('#propID').val(options.target.uuid);
                $('#propName').val(options.target.name.text);
                $('#propAddress').val(options.target.address.text);
                $('#propColor').val(options.target.color);
                if (options.target.type === 'node') {
                    $('#propIcon').val(options.target.image);
                    $('#propIcon').data('picker').sync_picker_with_select();
                } else if (options.target.type === 'shape') {
                    $('#propShape').val(options.target.image);
                    $('#propShape').data('picker').sync_picker_with_select();
                }
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
            var from = canvas.item(i).from;
            var to = canvas.item(i).to;
            var fromObj = null;
            var toObj = null;
            for (var j = 0; j < canvas.getObjects().length; j++) {
                if (canvas.item(j).uuid === from) {
                    fromObj = canvas.item(j);
                }
                if (canvas.item(j).uuid === to) {
                    toObj = canvas.item(j);
                }
            }
            if (fromObj !== null && toObj !== null) {
                if (fromObj.group !== undefined && fromObj.group !== null)
                    canvas.item(i).set({ 'x1': fromObj.getCenterPoint().x + fromObj.group.getCenterPoint().x, 'y1': fromObj.getCenterPoint().y + fromObj.group.getCenterPoint().y });
                else
                    canvas.item(i).set({ 'x1': fromObj.getCenterPoint().x, 'y1': fromObj.getCenterPoint().y + toObj.item(2).getCenterPoint().y });
                if (toObj.group !== undefined && toObj.group !== null)
                        canvas.item(i).set({ 'x2': toObj.getCenterPoint().x + toObj.group.getCenterPoint().x, 'y2': toObj.getCenterPoint().y + toObj.group.getCenterPoint().y });
                else
                    canvas.item(i).set({ 'x2': toObj.getCenterPoint().x, 'y2': toObj.getCenterPoint().y + toObj.item(2).getCenterPoint().y });
            }
        }
    }
});

function cancelMenu() {
    $(window).off('contextmenu', cancelMenu);
    return false;
}

function addZero(i) {
    if (i < 10) {
        i = "0" + i;
    }
    return i;
}

function addObjectToCanvas(o) {
    if (o.image !== undefined && o.image !== null) {
        var path = 'images/icons/';
        if (o.type === 'shape')
            path = 'images/shapes/';
        fabric.loadSVGFromURL(path + o.image, function(objects, options) {
            colorSet = o.color;
            var shape = fabric.util.groupSVGElements(objects, options);
            shape.set({
                originX: 'center',
                originY: 'bottom',
            });
            if (shape.isSameColor && shape.isSameColor() || !shape.paths) {
                shape.setFill(colorSet);
            } else if (shape.paths) {
                for (var i = 0; i < shape.paths.length; i++) {
                //    if (shape.paths[i].fill !== 'rgba(255,255,255,1)')
                //        shape.paths[i].setFill(colorSet);
                }
            }
            var name = new fabric.Text(o.name, {
                textAlign: 'center',
                fontSize: 14,
                originX: 'center',
                originY: 'top',
                scaleX : 1,
                scaleY: 1
            });
            var address = new fabric.Text(o.address, {
                top: 16,
                textAlign: 'center',
                fontSize: 14,
                originX: 'center',
                originY: 'top'
            });
            canvas.add(new fabric.Group([name, address, shape], {
                uuid: o.uuid,
                type: o.type,
                color: o.color,
                shape: shape,
                image: o.image,
                name: name,
                address: address,
                left: o.x,
                top: o.y,
                lockRotation: true
            }));
            canvas.renderAll();
            objectsLoaded.pop();
        });
        $('#events').jsGrid("fieldOption", "source_object","items",objectSelect);
        $('#events').jsGrid("fieldOption", "dest_object","items",objectSelect);
    }
}


function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

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

function insertObject() {
    socket.emit('insert_object', JSON.stringify({mission: mission, name:$('#propName').val(), address:$('#propAddress').val(), color:$('#propColor').val(), image:$('#propIcon').val(), type:$('#propType').val()})); 
}

function deleteObject() {
    if (canvas.getActiveObject().uuid) {
        socket.emit('delete_object', JSON.stringify({uuid:canvas.getActiveObject().uuid, type:canvas.getActiveObject().type}));
    }
}

function showMessage(msg, timeout) {
    $('#message').html(msg);
}

function unselectObjects() {
    selectedObjects = {};
}

function updatePropName(name) {
    if (canvas.getActiveObject() !== null && (canvas.getActiveObject().type === 'node' || canvas.getActiveObject().type === 'shape')) {
        canvas.getActiveObject().name.text = name;
        canvas.renderAll();
        updateObject(canvas.getActiveObject());
        $('#events').jsGrid("fieldOption", "source_object","items",objectSelect)
        $('#events').jsGrid("fieldOption", "dest_object","items",objectSelect)
    }
}

function updatePropColor(color) {
    if (canvas.getActiveObject() !== null && (canvas.getActiveObject().type === 'node' || canvas.getActiveObject().type === 'shape')) {
        canvas.getActiveObject().color = color;
        updateObject(canvas.getActiveObject());
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
    var tempObj = {};
    tempObj.uuid = o.uuid;
    tempObj.x = o.left;
    tempObj.y = o.top;
    tempObj.type = o.type;
    tempObj.color = o.color;
    tempObj.image = o.image;
    tempObj.name = o.name.text;
    tempObj.address = o.address.text;
    socket.emit('update_object', JSON.stringify(tempObj));
}

function toggleProperties(type) {
    if ($('#properties').is(':hidden')) {
        openProperties(type);
    } else {
        if ($('#propType').val() === type)
            closeProperties();
        else
            openProperties(type);

    }
}

function openProperties(type) {
    // edit
    $('#propType').val(type);
    if (canvas.getActiveObject() !== undefined && canvas.getActiveObject() !== null) {
        if (type === 'node') {
            $('#propTitle').html('Edit Node');
            $('#propNameGroup').show();
            $('#propAddressGroup').show();
            $('#propShapeGroup').hide();
            $('#propIconGroup').show();
            $('#deleteNodeButton').hide();
            $('#insertObjectButton').show();
            $('#insertLinkButton').hide();
            $('#nodesButton').css('background-color','lightgray');
            $('#shapesButton').css('background-color','darkgray');
            $('#linksButton').css('background-color','darkgray');
        } else if (type === 'shape') {
            $('#propTitle').html('Edit Shape');
            $('#propNameGroup').show();
            $('#propAddressGroup').hide();
            $('#propShapeGroup').show();
            $('#propIconGroup').hide();
            $('#deleteNodeButton').hide();
            $('#insertObjectButton').show();
            $('#insertLinkButton').hide();
            $('#shapesButton').css('background-color','lightgray');
            $('#nodesButton').css('background-color','darkgray');
            $('#linksButton').css('background-color','darkgray');
        } else if (type === 'link') {
            $('#propTitle').html('Edit Link');
            $('#deleteLinkButton').show();
            $('#linksButton').css('background-color','lightgray');
            $('#shapesButton').css('background-color','darkgray');
            $('#nodesButton').css('background-color','darkgray');
        } else {
            closeProperties();
            return;
        }
    // new
    } else if (canvas.getActiveObject() === undefined || canvas.getActiveObject() === null) {
        if (type === 'node') {
            $('#propTitle').html('New Node');
            $('#propID').val('');
            $('#propType').val('node');
            $('#propNameGroup').show();
            $('#propName').val('');
            $('#propAddressGroup').show();
            $('#propAddress').val('');
            $('#propColor').val('#000000');
            $('#propShapeGroup').hide();
            $('#propIconGroup').show();
            $('#propIcon').val('00-000-hub.png');
            $('#propIcon').data('picker').sync_picker_with_select();
            $('#deleteNodeButton').hide();
            $('#insertObjectButton').show();
            $('#insertLinkButton').hide();
            $('#nodesButton').css('background-color','lightgray');
            $('#shapesButton').css('background-color','darkgray');
            $('#linksButton').css('background-color','darkgray');
        } else if (type === 'shape') {
            $('#propTitle').html('New Shape');
            $('#propID').val('');
            $('#propType').val('shape');
            $('#propNameGroup').show();
            $('#propName').val('');
            $('#propAddressGroup').hide();
            $('#propColor').val('#000000');
            $('#propShapeGroup').show();
            $('#propIconGroup').hide();
            $('#insertObjectButton').show();
            $('#insertLinkButton').hide();
            $('#shapesButton').css('background-color','lightgray');
            $('#nodesButton').css('background-color','darkgray');
            $('#linksButton').css('background-color','darkgray');
        } else if (type === 'link') {
            $('#propTitle').html('New Link');
            $('#propID').val('');
            $('#propType').val('link');
            $('#propNameGroup').hide();
            $('#propAddressGroup').hide();
            $('#propColor').val('#000000');
            $('#propShapeGroup').hide();
            $('#propIconGroup').hide();
            $('#insertShapeButton').show();
            $('#deleteLinkButton').hide();
            $('#deleteButton').hide();
            $('#insertObjectButton').hide();
            $('#insertLinkButton').show();
            $('#linksButton').css('background-color','lightgray');
            $('#nodesButton').css('background-color','darkgray');
            $('#shapesButton').css('background-color','darkgray');
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
    $('#shapesButton').css('background-color','darkgray');
    $('#nodesButton').css('background-color','darkgray');
    $('#linksButton').css('background-color','darkgray');
    resize();
}

$(document).ready(function() {
    mission = getParameterByName('mission');
    resize();
    $('#propIcon').imagepicker({
        hide_select : true,
        selected : function() {
            if (canvas.getActiveObject() !== null && canvas.getActiveObject().type === 'node') {
                canvas.getActiveObject().image = $(this).val();
                fabric.loadSVGFromURL('images/icons/' + $(this).val(), function(objects, options) {
                    canvas.getActiveObject().removeWithUpdate(canvas.getActiveObject().item(2));
                    colorSet = canvas.getActiveObject().color;
                    var shape = fabric.util.groupSVGElements(objects, options);
                    shape.set({
                        originX: 'center',
                        originY: 'bottom',
                        left: canvas.getActiveObject().getCenterPoint().x,
                        top: canvas.getActiveObject().top
                    });
                    if (shape.isSameColor && shape.isSameColor() || !shape.paths) {
                        shape.setFill(colorSet);
                    } else if (shape.paths) {
                        for (var j = 0; j < shape.paths.length; j++) {
                      //      if (shape.paths[j].fill !== 'rgba(255,255,255,1)')
                        //        shape.paths[j].setFill(colorSet);
                        }
                    }
                    canvas.getActiveObject().addWithUpdate(shape);
                    canvas.renderAll();
                });
                updateObject(canvas.getActiveObject());
                setTimeout(function () { canvas.renderAll(); }, 100);
            }
        }
    });
    $('#propShape').imagepicker({
        hide_select : true,
        selected : function() {
            if (canvas.getActiveObject() !== null && canvas.getActiveObject().type === 'shape') {
                canvas.getActiveObject().image = $(this).val();
                fabric.loadSVGFromURL('images/shapes/' + $(this).val(), function(objects, options) {
                    canvas.getActiveObject().removeWithUpdate(canvas.getActiveObject().item(2));
                    colorSet = canvas.getActiveObject().color;
                    var shape = fabric.util.groupSVGElements(objects, options);
                    shape.set({
                        originX: 'center',
                        originY: 'bottom',
                        left: canvas.getActiveObject().getCenterPoint().x,
                        top: canvas.getActiveObject().top
                    });
                    if (shape.isSameColor && shape.isSameColor() || !shape.paths) {
                        shape.setFill(colorSet);
                    } else if (shape.paths) {
                        for (var j = 0; j < shape.paths.length; j++) {
                            if (shape.paths[j].fill !== 'rgba(255,255,255,1)')
                                shape.paths[j].setFill(colorSet);
                        }
                    }
                    canvas.getActiveObject().addWithUpdate(shape);
                    canvas.renderAll();
                });
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
            { name: 'source_object', title: 'Source Node', type: 'select', items: objectSelect, valueField: 'uuid', textField: 'name', width: 65, filterValue: function() {
                    return this.items[this.filterControl.val()][this.textField];
                }
            },
            { name: 'source_port', title: 'SPort', type: 'number', width: 25},
            { name: 'dest_object', title: 'Destination Node', type: 'select', items: objectSelect, valueField: 'uuid', textField: 'name', width: 65, filterValue: function() {
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
                if (item.id === '0') {
                    item.mission = mission;
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
