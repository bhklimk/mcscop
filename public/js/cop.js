var canvas = new fabric.Canvas('canvas', {
    selection: false,
    preserveObjectStacking: true,
    renderOnAddRemove: false,
    enableRetinaScaling: true,
    uniScaleTransform: true
});
var background = new fabric.Canvas('background', {
    selection: false,
    preserveObjectStacking: true,
    renderOnAddRemove: false,
    enableRetinaScaling: false
});
MAXWIDTH=4000;
MAXHEIGHT=4000;

canvas.setZoom(1.0);
var creatingLink = false;
var firstObject = null;
var startX = 0;
var startY = 0;
var scale = 1;
var originx = 0;
var originy = 0;
var zoomIntensity = 0.2;
var mission = getParameterByName('mission');
var objectSelect = [{id:0, name:'none/unknown'}];
var dateSlider = null;
var images = {};
var eventTableData = [];
var opnoteTableData = [];
var eventTimes = [];
var objectsLoaded = null;
var updatingObject = false;
var diagram;
var toolbarMode = null;
var firstNode = null;
var zoom = 1.0;
var dirty = false;
var SVGCache = {};
var tempLinks = [];
var objectCache = {};
var doc;
var activeToolbar = null;
var toolbarSizes = {'tools': 400, 'tasks': 400, 'notes': 400, 'opnotes': 1200, 'files': 400};

var CustomDirectLoadStrategy = function(grid) {
    jsGrid.loadStrategies.DirectLoadingStrategy.call(this, grid);
};

// Rescale stroke widths based on object size
// http://jsfiddle.net/davidtorroija/nawLjtn8/
fabric.Object.prototype.resizeToScale = function () {
    switch (this.type) {
        case "circle":
            this.radius *= this.scaleX;
            this.scaleX = 1;
            this.scaleY = 1;
            break;
        case "ellipse":
            this.rx *= this.scaleX;
            this.ry *= this.scaleY;
            this.width = this.rx * 2;
            this.height = this.ry * 2;
            this.scaleX = 1;
            this.scaleY = 1;
            break;
        case "polygon":
        case "polyline":
            var points = this.get('points');
            for (var i = 0; i < points.length; i++) {
                var p = points[i];
                p.x *= this.scaleX
                p.y *= this.scaleY;
            }
            this.scaleX = 1;
            this.scaleY = 1;
            this.width = this.getBoundingBox().width;
            this.height = this.getBoundingBox().height;
            break;
        case "triangle":
        case "line":
        case "rect":
            this.width *= this.scaleX;
            this.height *= this.scaleY;
            this.scaleX = 1;
            this.scaleY = 1;
        default:
            break;
    }
}

fabric.Object.prototype.getBoundingBox = function () {
    var minX = null;
    var minY = null;
    var maxX = null;
    var maxY = null;
    switch (this.type) {
        case "polygon":
        case "polyline":
            var points = this.get('points');

            for (var i = 0; i < points.length; i++) {
                if (typeof (minX) == undefined) {
                    minX = points[i].x;
                } else if (points[i].x < minX) {
                    minX = points[i].x;
                }
                if (typeof (minY) == undefined) {
                    minY = points[i].y;
                } else if (points[i].y < minY) {
                    minY = points[i].y;
                }
                if (typeof (maxX) == undefined) {
                    maxX = points[i].x;
                } else if (points[i].x > maxX) {
                    maxX = points[i].x;
                }
                if (typeof (maxY) == undefined) {
                    maxY = points[i].y;
                } else if (points[i].y > maxY) {
                    maxY = points[i].y;
                }
            }
            break;
        default:
            minX = this.left;
            minY = this.top;
            maxX = this.left + this.width; 
            maxY = this.top + this.height;
    }
    return {
        topLeft: new fabric.Point(minX, minY),
        bottomRight: new fabric.Point(maxX, maxY),
        width: maxX - minX,
        height: maxY - minY
    }
}

// set up a listener for the event where the object has been modified
canvas.observe('object:modified', function (e) {
    if (e.target !== undefined && e.target.resizeToScale)
        e.target.resizeToScale();
});
 
CustomDirectLoadStrategy.prototype = new jsGrid.loadStrategies.DirectLoadingStrategy();
CustomDirectLoadStrategy.prototype.finishInsert = function(loadedData) {
    var grid = this._grid;
    if (loadedData.id !== 0 && loadedData.id !== undefined) {
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
            dateFormat: "yy-mm-dd",
            timeFormat: "HH:mm:ss.l",
            controlType: 'select',
            showMillisec: true
        });
    },
    editTemplate: function(value) {
        this._editPicker = $("<input>").datetimepicker({
            setDate: new Date(value),
            dateFormat: "yy-mm-dd",
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

$('#diagram').mousedown(startPan);

document.onkeydown = checkKey;
function checkKey(e) {
    e = e || window.event;
    if (e.keyCode == '38') {
       // up arrow
       canvas.relativePan({ x: 0, y: -5 });
    }
    else if (e.keyCode == '40') {
       // down arrow
       canvas.relativePan({ x: 0, y: 5 });
    }
    else if (e.keyCode == '37') {
       // left arrow
       canvas.relativePan({ x: -5, y: 0 });
    }
    else if (e.keyCode == '39') {
       // right arrow
       canvas.relativePan({ x: 5, y: 0 });
    }
}

canvas.on('object:moving', function(options) {
    dirty = true;
    options.target.dirty = true;
    for (var j = 0; j < options.target.children.length; j++) {
        options.target.children[j].setTop(options.target.getTop() + (options.target.getHeight()/2));
        options.target.children[j].setLeft(options.target.getLeft());
    }
});

canvas.on('object:scaling', function(options) {
    dirty = true;
    options.target.dirty = true;
    for (var j = 0; j < options.target.children.length; j++) {
        options.target.children[j].setTop(options.target.getTop() + (options.target.getHeight()/2));
        options.target.children[j].setLeft(options.target.getLeft());
    }
});

canvas.on('object:modified', function(options) {
    var o = canvas.getActiveObject();
    if (o !== null) {
        var z = canvas.getObjects().indexOf(o)/2;
        if (o.objType === 'link')
            diagram.send(JSON.stringify({act: 'move_object', arg: {uuid: o.uuid, type: o.objType, z: z}}));
        else if (o.objType === 'icon')
            diagram.send(JSON.stringify({act: 'move_object', arg: {uuid: o.uuid, type: o.objType, x: o.left, y: o.top, z: z, scale_x: o.scaleX, scale_y: o.scaleY}}));
        else if (o.objType === 'shape')
            diagram.send(JSON.stringify({act: 'move_object', arg: {uuid: o.uuid, type: o.objType, x: o.left, y: o.top, z: z, scale_x: o.width, scale_y: o.height}}));
    }
});

canvas.on('object:selected', function(options) {
    var o = options.target;
    if (o) {
        if (canvas.getActiveObject() !== null && canvas.getActiveGroup() === null) {
            if (o.objType !== undefined) {
                if (creatingLink) {
                    if ((o.objType === 'icon' || o.objType === 'shape') && firstNode !== o) {
                        if (firstNode === null) {
                            firstNode = o;
                            showMessage('Click on a second node to complete the link.');
                        } else {
                            showMessage('Link created.', 5);
                            $('#cancelLink').hide();
                            var z = canvas.getObjects().indexOf(firstNode) - 1;
                            if (canvas.getObjects().indexOf(o) < z)
                                z = canvas.getObjects().indexOf(o) - 1;
                            diagram.send(JSON.stringify({act: 'insert_object', arg: {mission: mission, name:$('#propName').val(), type: 'link', image: $('#propIcon').val(), stroke_color:$('#propStrokeColor').val(), obj_a: firstNode.uuid, obj_b: o.uuid, z: z}}));
                            firstNode = null;
                            creatingLink = false;
                        }
                    }
                } else {
                    $('#propID').val(o.uuid);
                    $('#propFillColor').val(o.fill);
                    $('#propStrokeColor').val(o.stroke);
                    $('#propName').val('');
                    if (o.children !== undefined) {
                        for (var i = 0; i < o.children.length; i++) {
                            if (o.children[i].objType === 'name')
                                $('#propName').val(o.children[i].text);
                        }
                    }
                    $('#propType').val(o.objType);
                    $('#propIcon').val(o.image);
                    $('#propIcon').data('picker').sync_picker_with_select();
                    openToolbar('tools');
                }
            }
        } else {
            closeToolbar();
        }
    }
});

canvas.on('before:selection:cleared', function(options) {
    if (!updatingObject)
        closeToolbar();
});

canvas.on('before:render', function(e) {
    if (dirty) {
        for (var i = 0; i < canvas.getObjects().length; i++) {
            if (canvas.item(i).objType && canvas.item(i).objType === 'link') {
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
                if (fromObj && toObj && (fromObj.dirty || toObj.dirty || canvas.item(i).pending)) {
                    if (canvas.item(i).pending)
                        canvas.item(i).pending = false;
                    canvas.item(i).set({ 'x1': fromObj.getCenterPoint().x, 'y1': fromObj.getCenterPoint().y });
                    canvas.item(i).set({ 'x2': toObj.getCenterPoint().x, 'y2': toObj.getCenterPoint().y });
                    canvas.item(i).setCoords();
                    for (var j = 0; j < canvas.item(i).children.length; j++) {
                        canvas.item(i).children[j].set({'left': canvas.item(i).getCenterPoint().x, 'top': canvas.item(i).getCenterPoint().y });
                        var angle = (Math.atan2((canvas.item(i).y1 - canvas.item(i).y2), (canvas.item(i).x1 - canvas.item(i).x2))) * (180/Math.PI);
                        if(Math.abs(angle) > 90)
                            angle += 180;
                        canvas.item(i).children[j].set({'angle': angle});
                    }
                }
            }
        }
        for (var i = 0; i < canvas.getObjects().length; i++) {
            canvas.item(i).dirty = false;
        }
        if (tempLinks.length > 0) {
            for (var i = 0; i < tempLinks.length; i++) {
                tempLinks[i].set({ 'x1': tempLinks[i].from.getCenterPoint().x, 'y1': tempLinks[i].from.getCenterPoint().y });
                tempLinks[i].set({ 'x2': tempLinks[i].to.getCenterPoint().x, 'y2': tempLinks[i].to.getCenterPoint().y });
            }
            background.renderAll();
        }
        dirty = false;
    }
});

function getIcon(icon, type) {
    var path = 'images/icons/';
    $.get(path + icon, function(data) {
        SVGCache[icon] = data;
        objectsLoaded.pop();
    }, 'text');
}


function checkIfShapesCached(msg) {
    if (objectsLoaded.length == 0) {
        console.log('cached');
        for (var o in msg) {
            if (msg[o].type === 'icon')
                objectsLoaded.push(false);
            addObjectToCanvas(msg[o]);
        }
        checkIfObjectsLoaded();
    } else {
        setTimeout(function() {
            checkIfShapesCached(msg);
        }, 50);
    }
}

function checkIfObjectsLoaded() {
    if (objectsLoaded.length == 0) {
        console.log('objects loaded');
        $('#modal').modal('hide');
        dirty = true;
        canvas.renderAll();
        canvas.renderOnAddRemove = true;
    } else {
        setTimeout(checkIfObjectsLoaded, 50);
    }
}

function editDetails(uuid) {
    if (canvas.getActiveObject()) {
        $('#modal-title').text('Edit Object');
        $('#modal-body').html('<input type="hidden" id="object_details_uuid" name="object_details_uuid" value="' + canvas.getActiveObject().uuid + '"><textarea id="object_details" class="object-details"></textarea>');
        $('#modal-footer').html('<button type="button btn-primary" class="button btn btn-default" data-dismiss="modal">Close</button>');
        if (doc) {
            console.log('unsubscribing');
            doc.destroy();
            doc = undefined;
        }
        doc = shareDBConnection.get('mcscop', canvas.getActiveObject().uuid);
        doc.subscribe(function(err) {
            if (doc.type === null) {
                doc.create('');
            }
            if (err) throw err;
            var element = document.getElementById('object_details');
            var binding = new StringBinding(element, doc);
            binding.setup();
        });
        $('#modal').modal('show');
    }
}

function zoomIn() {
    canvas.zoomToPoint(new fabric.Point(canvas.width / 2, canvas.height / 2), canvas.getZoom() / 0.90);
    background.zoomToPoint(new fabric.Point(background.width / 2, background.height / 2), background.getZoom() / 0.90);
}

function zoomOut() {
    canvas.zoomToPoint(new fabric.Point(canvas.width / 2, canvas.height / 2), canvas.getZoom() / 1.1);
    background.zoomToPoint(new fabric.Point(background.width / 2, background.height / 2), background.getZoom() / 1.1);
}

function startPan(event) {
    if (event.button != 2) {
        return;
    }
    var x0 = event.screenX;
    var y0 = event.screenY;
    function continuePan(event) {
        var x = event.screenX,
            y = event.screenY;
        if (x - x0 != 0 || y - y0 != 0)
        {
            canvas.relativePan({ x: x - x0, y: y - y0 });
            background.relativePan({ x: x - x0, y: y - y0 });
            
            x0 = x;
            y0 = y;
        }
    }
    function stopPan(event) {
        $(window).off('mousemove', continuePan);
        $(window).off('mouseup', stopPan);
    };
    $(window).mousemove(continuePan);
    $(window).mouseup(stopPan);
    $(window).contextmenu(cancelMenu);
};

function newObject() {
    toggleToolbar('tools');
    toggleToolbar('tools');
}

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

function addObjectToCanvas(o, select) {
    if (o.type === 'link') {
        var fromObject = null;
        var toObject = null;
        for (var i = 0; i < canvas.getObjects().length; i++) {
            if (canvas.item(i).uuid == o.obj_a) {
                fromObject = canvas.item(i);
            }
            if (canvas.item(i).uuid == o.obj_b) {
                toObject = canvas.item(i);
            }
        }
        var from = {x: 0, y: 0};
        var to = {x: 0, y: 0};
        var pending = true;
        if (fromObject !== null && toObject !== null) {
            var from = fromObject.getCenterPoint();
            var to = toObject.getCenterPoint();
            pending = false;
        }
        var line = new fabric.Line([from.x, from.y, to.x, to.y], {
            pending: pending,
            uuid: o.uuid,
            objType: 'link',
            image: o.image,
            from: o.obj_a,
            to: o.obj_b,
            fill: '#000000',
            stroke: o.stroke_color,
            strokeWidth: 3,
            hasControls: false,
            selctable: true,
            lockMovementX: true,
            lockMovementY: true,
            lockScalingX: true,
            lockScalingY: true,
            lockRotation: true,
        });
        var angle = (Math.atan2((line.y1 - line.y2), (line.x1 - line.x2))) * (180/Math.PI);
            if(Math.abs(angle) > 90)
                angle += 180;
        var name = new fabric.Text(o.name, {
            parent_uuid: o.uuid,
            parent: line,
            objType: 'name',
            selectable: false,
            originX: 'center',
            textAlign: 'center',
            fill: o.stroke_color,
            angle: angle,
            fontSize: 8,
            fontFamily: 'verdana',
            left: line.getCenterPoint().x,
            top: line.getCenterPoint().y
        });
        line.children = [name];
        canvas.add(line);
        canvas.add(name);
        line.moveTo(o.z*2);
        name.moveTo(o.z*2+1);
    } else if (o.type === 'icon' && o.image !== undefined && o.image !== null) {
        var image, func;
        if (SVGCache[o.image] === undefined) {
            image = ('images/icons/' + o.image);
            func = fabric.loadSVGFromURL;
        } else {
            image = SVGCache[o.image];
            func = fabric.loadSVGFromString;
        }
        func(image, function(objects, options) {
            var name;
            var shape = fabric.util.groupSVGElements(objects, options);
            shape.set({
                fill: o.fill_color,
                stroke: o.stroke_color,
                strokeWidth: 1,
                scaleX: o.scale_x,
                scaleY: o.scale_y,
                uuid: o.uuid,
                objType: o.type,
                image: o.image,
                name_val: o.name,
                originX: 'center',
                originY: 'center',
                left: o.x,
                top: o.y,
            });
            if (shape.paths) {
                for (var i = 0; i < shape.paths.length; i++) {
                    if (shape.paths[i].fill !== 'rgba(254,254,254,1)' && shape.paths[i].fill !== '') {
                        shape.paths[i].setFill(o.fill_color);
                    }
                    if (shape.paths[i].stroke !== 'rgba(254,254,254,1)') {
                        shape.paths[i].setStroke(o.stroke_color);
                    }
                }
            }
            name = new fabric.Text(o.name, {
                parent_uuid: o.uuid,
                parent: shape,
                objType: 'name',
                selectable: false,
                originX: 'center',
                textAlign: 'center',
                fontSize: 12,
                fontFamily: 'verdana',
                left: o.x,
                top: o.y + (shape.getHeight()/2)
            });
            shape.children = [name];
            objectsLoaded.pop();
            canvas.add(shape);
            canvas.add(name);
            if (select)
                canvas.setActiveObject(shape);
            shape.moveTo(o.z*2);
            name.moveTo(o.z*2+1);
        });
    } else if (o.type === 'shape') {
        var shape = o.image.split('-')[3].split('.')[0];
        if (shape === 'rect') {
            shape = new fabric.Rect({
                width: o.scale_x,
                height: o.scale_y,
                fill: o.fill_color,
                stroke: o.stroke_color,
                strokeWidth: 2,
                uuid: o.uuid,
                objType: o.type,
                image: o.image,
                name: name,
                originX: 'center',
                originY: 'center',
                left: o.x,
                top: o.y
            });
        } else if (shape === 'circle') {
            shape = new fabric.Ellipse({
                rx: o.scale_x / 2,
                ry: o.scale_y / 2,
                fill: o.fill_color,
                stroke: o.stroke_color,
                strokeWidth: 2,
                uuid: o.uuid,
                objType: o.type,
                image: o.image,
                name: name,
                originX: 'center',
                originY: 'center',
                left: o.x,
                top: o.y
            });
        } else
            return;
        name = new fabric.Text(o.name, {
            parent_uuid: o.uuid,
            parent: shape,
            objType: 'name',
            selectable: false,
            originX: 'center',
            textAlign: 'center',
            fontSize: 12,
            fontFamily: 'verdana',
            left: o.x,
            top: o.y + (shape.getHeight()/2)
        });
        shape.children = [name];
        canvas.add(shape);
        canvas.add(name);
        if (select)
            canvas.setActiveObject(shape);
        shape.moveTo(o.z*2);
        name.moveTo(o.z*2+1);
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

function blink(div) {
    $(div).effect('highlight','slow');
}

function insertLink() {
    closeToolbar();
    creatingLink = true;
    showMessage('Click on a node to start a new link.');
    $('#cancelLink').show();
}

function cancelLink() {
    firstObject = null;
    creatingLink = false;
    showMessage('Link cancelled.',5);
    $('#cancelLink').hide();
}

function insertObject() {
    if ($('#propType').val() === 'link')
        insertLink();
    else
        diagram.send(JSON.stringify({act: 'insert_object', arg:{mission: mission, name:$('#propName').val(), fill_color:$('#propFillColor').val(), stroke_color:$('#propStrokeColor').val(), image:$('#propIcon').val(), type:$('#propType').val(), z: canvas.getObjects().length}})); 
}

function deleteObject() {
    if (canvas.getActiveObject().uuid) {
        diagram.send(JSON.stringify({act: 'delete_object', arg: {uuid:canvas.getActiveObject().uuid, type:canvas.getActiveObject().objType}}));
    }
}

function moveToZ(o, z) {
    if (o.objType === 'link')
        diagram.send(JSON.stringify({act: 'move_object', arg: {uuid: o.uuid, type: o.objType, z: z}}));
    else if (o.objType === 'icon')
        diagram.send(JSON.stringify({act: 'move_object', arg: {uuid: o.uuid, type: o.objType, x: o.left, y: o.top, z: z, scale_x: o.scaleX, scale_y: o.scaleY}}));
    else if (o.objType === 'shape')
        diagram.send(JSON.stringify({act: 'move_object', arg: {uuid: o.uuid, type: o.objType, x: o.left, y: o.top, z: z, scale_x: o.width, scale_y: o.height}}));
}


function moveToFront() {
    var zTop = canvas.getObjects().length;
    var o = canvas.getActiveObject();
    moveToZ(o, zTop/2);
}

function moveToBack() {
    var o = canvas.getActiveObject();
    var z = 0;
    moveToZ(o, z);
}

function moveUp() {
    var o = canvas.getActiveObject();
    if (canvas.getActiveObject().uuid && canvas.getObjects().indexOf(o) < canvas.getObjects().length - 2) {
        var z = canvas.getObjects().indexOf(o) / 2 + 1;
        moveToZ(o, z);
    }
}

function moveDown() {
    var o = canvas.getActiveObject();
    if (canvas.getActiveObject().uuid && canvas.getObjects().indexOf(o) > 0) {
        var z = canvas.getObjects().indexOf(o) / 2 - 1;
        moveToZ(o, z);
    }
}

function showMessage(msg, timeout) {
    $('#message').html(msg);
    if (timeout !== undefined) {
        setTimeout(function() {
            $('#message').html('');
        }, timeout * 1000);
    }
}

function updatePropName(name) {
    var o = canvas.getActiveObject();
    if (o) {
        for (var i = 0; i < o.children.length; i++) {
            if (o.children[i].objType === 'name')
                o.children[i].text = name;
        }
        for (var i = 0; i < objectSelect.length; i++) {
            if (objectSelect[i].uuid === o.uuid) {
                objectSelect[i].name = name.split('\n')[0];
                break;
            }
        }
        objectSelect.sort(function(a, b) {
            return a.name.localeCompare(b.name);
        });
        canvas.renderAll();
        changeObject(o);
        $('#events').jsGrid("fieldOption", "source_object","items",objectSelect)
        $('#events').jsGrid("fieldOption", "dest_object","items",objectSelect)
    }
}

function updatePropFillColor(color) {
    var o = canvas.getActiveObject();
    if (o) {
        o.fill = color;
        changeObject(o);
    }
}

function updatePropStrokeColor(color) {
    var o = canvas.getActiveObject();
    if (o) {
        o.stroke = color;
        changeObject(o);
    }
}

function changeObject(o) {
    var tempObj = {};
    tempObj.uuid = o.uuid;
    tempObj.x = o.left;
    tempObj.y = o.top;
    tempObj.z = canvas.getObjects().indexOf(o);
    tempObj.scale_x = o.scaleX;
    tempObj.scale_y = o.scaleY;
    tempObj.type = o.objType;
    tempObj.fill_color = o.fill;
    tempObj.stroke_color = o.stroke;
    tempObj.image = o.image;
    tempObj.name = '';
    for (var i=0; i < o.children.length; i++) {
        if (o.children[i].objType === 'name') {
            tempObj.name = o.children[i].text;
        }
    }
    diagram.send(JSON.stringify({act: 'change_object', arg: tempObj}));
}

function toggleToolbar(mode) {
    if (canvas.getActiveObject())
        canvas.deactivateAll().renderAll();
    if ($('#toolbar-body').is(':hidden')) {
        openToolbar(mode);
    } else {
        if (toolbarMode === mode)
            closeToolbar();
        else
            openToolbar(mode);
    }
}

function openToolbar(mode) {
    toolbarMode = mode;
    if (mode === 'tools') {
        activeToolbar = 'tools';
        $('#toolbar-body').css('width',toolbarSizes['tools']);
        $('#toolsForm').show();
        $('#tasksForm').hide();
        $('#notesForm').hide();
        $('#opsForm').hide();
        $('#filesForm').hide();
    } else if (mode === 'tasks') {
        activeToolbar = 'tasks';
        $('#toolbar-body').css('width',toolbarSizes['tasks']);
        $('#toolsForm').hide();
        $('#tasksForm').show();
        $('#notesForm').hide();
        $('#opsForm').hide();
        $('#filesForm').hide();
    } else if (mode === 'notes') {
        activeToolbar = 'notes';
        $('#toolbar-body').css('width',toolbarSizes['notes']);
        $('#toolsForm').hide();
        $('#tasksForm').hide();
        $('#notesForm').show();
        $('#opsForm').hide();
        $('#filesForm').hide();
    } else if (mode === 'ops') {
        activeToolbar = 'opnotes';
        $('#toolbar-body').css('width',toolbarSizes['opnotes']);
        $('#toolsForm').hide();
        $('#tasksForm').hide();
        $('#notesForm').hide();
        $('#opsForm').show();
        $('#filesForm').hide();
    } else if (mode === 'files') {
        activeToolbar = 'files';
        $('#toolbar-body').css('width',toolbarSizes['files']);
        $('#toolsForm').hide();
        $('#tasksForm').hide();
        $('#notesForm').hide();
        $('#opsForm').hide();
        $('#filesForm').show();
    }
    // edit
    if (canvas.getActiveObject()) {
        $('#toolbarTitle').html('Edit Object');
        $('#propNameGroup').show();
        $('#propObjectGroup').show();
        if (canvas.getActiveObject().objType && canvas.getActiveObject().objType === 'link')
            $('#propFillColor').hide();
        else
            $('#propFillColor').show();
        $('#editDetailsButton').show();
        $('#deleteObjectButton').show();
        $('#insertObjectButton').hide();
        $('#newObjectButton').show();
    } else if (canvas.getActiveObject() === undefined || canvas.getActiveObject() === null) {
        $('#toolbarTitle').html('New Object');
        $('#propID').val('');
        $('#propType').val();
        $('#propNameGroup').show();
        $('#propName').val('');
        $('#propFillColor').show();
        $('#propFillColor').val('#000000');
        $('#propStrokeColor').val('#ffffff');
        $('#propShapeGroup').hide();
        $('#propIconGroup').show();
        $('#propIcon').val('00-000-hub.svg');
        $('#propIcon').data('picker').sync_picker_with_select();
        $('#newObjectButton').hide();
        $('#editDetailsButton').hide();
        $('#deleteObjectButton').hide();
        $('#insertObjectButton').show();
    } else {
        return;
    }
    if ($('#toolbar-body').is(':hidden')) {
        $('#toolbar-body').show();
        $('#diagram').width($('#diagram').width() - 310);
    }
}

function closeToolbar() {
    $('#toolbar-body').hide();
}

function timestamp(str){
    return new Date(str).getTime();   
}

function startTasks() {
    console.log('starting tasks');
    if (shareDBConnection.state === 'connected') {
        console.log('tasks started');
        var hostTasksDoc;
        hostTasksDoc = shareDBConnection.get('mcscop', 'mission' + mission + 'hostTasks');
        hostTasksDoc.subscribe(function(err) {
            if (hostTasksDoc.type === null) {
                hostTasksDoc.create('Host tasks:');
            }
            if (err) throw err;
            var element = document.getElementById('hostTasks');
            var binding = new StringBinding(element, hostTasksDoc);
            binding.setup();
        });
        var networkTasksDoc;
        networkTasksDoc = shareDBConnection.get('mcscop', 'mission' + mission + 'networkTasks');
        networkTasksDoc.subscribe(function(err) {
            if (networkTasksDoc.type === null) {
                networkTasksDoc.create('Network tasks:');
            }
            if (err) throw err;
            var element = document.getElementById('networkTasks');
            var binding = new StringBinding(element, networkTasksDoc);
            binding.setup();
        });
        var ccirDoc;
        ccirDoc = shareDBConnection.get('mcscop', 'mission' + mission + 'ccirs');
        ccirDoc.subscribe(function(err) {
            if (ccirDoc.type === null) {
                ccirDoc.create('CCIRs:');
            }
            if (err) throw err;
            var element = document.getElementById('ccirs');
            var binding = new StringBinding(element, ccirDoc);
            binding.setup();
        });
        var notesDoc;
        notesDoc = shareDBConnection.get('mcscop', 'mission' + mission + 'notes');
        notesDoc.subscribe(function(err) {
            if (notesDoc.type === null) {
                notesDoc.create('Notes:');
            }
            if (err) throw err;
            var element = document.getElementById('notes');
            var binding = new StringBinding(element, notesDoc);
            binding.setup();
        });
    } else {
        setTimeout(function() {
            console.log('retrying tasks connection');
            startTasks();
        }, 1000);
    }
}

$(document).ready(function() {
    // ---------------------------- SOCKETS ----------------------------------
    diagram = new WebSocket('wss://' + window.location.host + '/mcscop/');
    diagram.onopen = function() {
        $('#modal').modal('hide');
        $('#modal-title').text('Please wait...!');
        $('#modal-body').html('<p>Loading COP, please wait...</p><img src="images/loading.gif"/>');
        $('#modal-footer').html('');
        $('#modal').modal('show')
        console.log('connect');
        diagram.send(JSON.stringify({act:'join', arg: mission}));
        console.log('get objects');
        diagram.send(JSON.stringify({act:'get_objects', arg: mission}));
        console.log('get events');
        diagram.send(JSON.stringify({act:'get_events', arg: mission}));
        console.log('get opnotes');
        diagram.send(JSON.stringify({act:'get_opnotes', arg: mission}));
        console.log('get files');
        diagram.send(JSON.stringify({act:'get_files', arg: mission}));
    };
    diagram.onmessage = function(msg) {
        msg = JSON.parse(msg.data);
        switch(msg.act) {
            case 'disco':
                canvas.clear();
                canvas.renderAll();
                $('#modal').data('bs.modal',null);
                $('#modal-title').text('Attention!');
                $('#modal-body').html('<p>Connection lost! Please refresh the page to continue!</p>');
                $('#modal-footer').html('<button type="button" class="button btn btn-default" data-dismiss="modal">Close</button>');
                $('#modal').modal({
                    backdrop: 'static',
                    keyboard: false
                });
                break;
            case 'all_files':
                $('#fileTree')
                    .on('select_node.jstree', function (e, data) {
                        var o = data.selected[0];
                    })
                    .jstree({'core':{'data':msg.arg}});
                break;
            case 'all_objects':
                objectSelect = [{id:0, name:'none/unknown'}];
                objectsLoaded = [];
                for (var o in msg.arg) {
                    if (msg.arg[o].type !== 'link') {
                        objectSelect.push({uuid:msg.arg[o].uuid, name:msg.arg[o].name.split('\n')[0]});
                    }
                    if (msg.arg[o].type === 'icon' && SVGCache[msg.arg[o].image] === undefined && msg.arg[o].image !== undefined && msg.arg[o].image !== null) {
                        var shape = msg.arg[o].image;
                        SVGCache[msg.arg[o].image] = null;
                        objectsLoaded.push(false);
                        getIcon(msg.arg[o].image);
                    }
                }
                objectSelect.sort(function(a, b) {
                    return a.name.localeCompare(b.name);
                });
                $('#events').jsGrid("fieldOption", "source_object", "items", objectSelect);
                $('#events').jsGrid("fieldOption", "dest_object", "items", objectSelect);
                checkIfShapesCached(msg.arg);
                break;
            case 'all_events':
                eventTableData = [];
                eventTimes = [0,9999999999999];
                for (var evt in msg.arg) {
                    eventTableData.push(msg.arg[evt]);
                    eventTimes.splice(eventTimes.length - 1, 0, msg.arg[evt].event_time);
                }
                var end = eventTimes.length + 1;
                dateSlider.noUiSlider.updateOptions({
                    start: [0,end],
                    range: {
                        'min': 0,
                        'max': end
                    },
                    step: 1
                });
                $('#events').jsGrid('loadData');
                $('#events').jsGrid('sort', 1, 'asc');
                break;
            case 'all_opnotes':
                opnoteTableData = [];
                for (var evt in msg.arg) {
                    opnoteTableData.push(msg.arg[evt]);
                }
                $('#ops').jsGrid('loadData');
                $('#ops').jsGrid('sort', 1, 'asc');
                break;
            case 'change_object':
                var o = msg.arg;
                var selected = false;
                for (var i = 0; i < canvas.getObjects().length; i++) {
                    if (canvas.item(i).uuid === o.uuid) {
                        if (canvas.getActiveObject() && canvas.getActiveObject().uuid === o.uuid) {
                            selected = true;
                        }
                        var to = canvas.item(i);
                        if (o.type === 'icon') {
                            var children = to.children.length;
                            for (var k = 0; k < children; k++)
                                canvas.remove(to.children[k]);
                            canvas.remove(to);
                            addObjectToCanvas(o, selected);
                            canvas.renderAll();
                        } else if (o.type === 'shape' || o.type === 'link') {
                            canvas.item(i).setStroke(o.stroke_color);
                            canvas.item(i).setFill(o.fill_color);
                            canvas.renderAll();
                        }
                        break;
                    }
                }
                $('#events').jsGrid("fieldOption", "source_object","items",objectSelect)
                $('#events').jsGrid("fieldOption", "dest_object","items",objectSelect)
                break;
            case 'move_object':
                dirty = true;
                var o = msg.arg;
                for (var i = 0; i < canvas.getObjects().length; i++) {
                    if (canvas.item(i).uuid == o.uuid) {
                        var obj = canvas.item(i);
                        obj.dirty = true;
                        if (o.type !== 'link') {
                            if (o.type === 'icon') {
                                obj.scaleX = o.scale_x;
                                obj.scaleY = o.scale_y;
                            } else if (o.type === 'shape') {
                                obj.width = o.scale_x;
                                obj.height = o.scale_y;
                            }
                            obj.animate({left: o.x, top: o.y}, {
                                duration: 100,
                                onChange: function() {
                                    dirty = true;
                                    obj.dirty = true;
                                    for (var j = 0; j < obj.children.length; j++) {
                                        obj.children[j].setTop(obj.getTop() + (obj.getHeight()/2));
                                        obj.children[j].setLeft(obj.getLeft());
                                    }
                                    canvas.renderAll();;
                                }
                            });
                        }
                        if (i !== o.z*2) {
                            if (i < o.z*2) {
                                obj.moveTo(o.z*2 + 1);
                                for (var k = 0; k < obj.children.length; k++)
                                    obj.children[k].moveTo(canvas.getObjects().indexOf(obj));
                            } else {
                                obj.moveTo(o.z*2);
                                for (var k = 0; k < obj.children.length; k++)
                                    obj.children[k].moveTo(canvas.getObjects().indexOf(obj)+1);
                            }
                        }
                        break;
                    }
                }
                break;
            case 'update_event':
                var evt = msg.arg;
                for (var i = 0; i < eventTableData.length; i++) {
                    if (eventTableData[i].id === evt.id) {
                        eventTableData[i] = evt;
                    }
                }
                $('#events').jsGrid('loadData');
                $('#events').jsGrid('sort', 1, 'asc');
                break;
            case 'insert_event':
                var evt = msg.arg;
                eventTableData.push(evt);
                $('#events').jsGrid('insertItem', evt);
                break;
            case 'delete_event':
                var evt = msg.arg;
                for (var i = 0; i < eventTableData.length; i++) {
                    if (eventTableData[i].id === evt.id) {
                        eventTableData.splice(i, 1);
                        break;
                    }
                }
                for (i = 0; i < eventTimes.length; i++) {
                    if (eventTimes[i] === evt.event_time) {
                        eventTimes.splice(i, 1);
                        break;
                    }
                }
                dateSlider.noUiSlider.updateOptions({
                    start: [0,eventTimes.length+1],
                    range: {
                        'min': 0,
                        'max': eventTimes.length+1
                    },
                    step: 1
                });
                $('#events').jsGrid('loadData');
                $('#events').jsGrid('sort', 1, 'asc');
                break;
            case 'update_opnote':
                var evt = msg.arg;
                for (var i = 0; i < opnoteTableData.length; i++) {
                    if (opnoteTableData[i].id === evt.id) {
                        opnoteTableData[i] = evt;
                    }
                }
                $('#ops').jsGrid('loadData');
                $('#ops').jsGrid('sort', 1, 'asc');
                break;
            case 'insert_opnote':
                var evt = msg.arg;
                opnoteTableData.push(evt);
                $('#ops').jsGrid('insertItem', evt);
                break;
            case 'delete_opnote':
                var evt = msg.arg;
                for (var i = 0; i < opnoteTableData.length; i++) {
                    if (opnoteTableData[i].id === evt.id) {
                        opnoteTableData.splice(i, 1);
                        break;
                    }
                }
                $('#ops').jsGrid('loadData');
                $('#ops').jsGrid('sort', 1, 'asc');
                break;
            case 'insert_object':
                var o = msg.arg;
                addObjectToCanvas(o, false);
                if (o.type !== 'link') {
                    objectSelect.push({uuid:o.uuid, name:o.name.split('\n')[0]});
                    objectSelect.sort(function(a, b) {
                        return a.name.localeCompare(b.name);
                    });
                }
                $('#events').jsGrid("fieldOption", "source_object", "items", objectSelect);
                $('#events').jsGrid("fieldOption", "dest_object", "items", objectSelect);
                break;
            case 'delete_object':
                var uuid = msg.arg;
                for (var i = 0; i < canvas.getObjects().length; i++) {
                    if (canvas.item(i).uuid == uuid) {
                        var object = canvas.item(i);
                        if (canvas.item(i).children !== undefined) {
                            for (var k = 0; k < object.children.length; k++) {
                                canvas.remove(object.children[k]);
                            }
                        }
                        canvas.remove(object);
                        break;
                    }
                }
                canvas.renderAll();
                break;
        }
    };

    diagram.onclose = function() {
        canvas.clear();
        canvas.renderAll();
        $('#modal-title').text('Attention!');
        $('#modal-body').html('<p>Connection lost! Please refesh the page to retry!</p>');
        $('#modal-footer').html('');
        $('#modal').removeData('bs.modal').modal({backdrop: 'static', keyboard: false});
    };

    startTasks();

    // ---------------------------- IMAGE PICKER ----------------------------------
    $('#propIcon').imagepicker({
        hide_select : true,
        selected : function() {
            if (canvas.getActiveObject() !== null && canvas.getActiveObject() !== undefined && (canvas.getActiveObject().objType === 'icon' || canvas.getActiveObject().objType === 'shape')) {
                var obj = canvas.getActiveObject();
                var oldZ = canvas.getObjects().indexOf(canvas.getActiveObject());
                obj.image = $(this).val();
                var type = $(this).val().split('-')[2];
                if (obj.objType !== type)
                    return;
                updatingObject = true;
                updatingObject = false;
                changeObject(obj);
            } else {
                var type = $(this).val().split('-')[2];
                if (type === 'link') {
                    $('#propFillColor').hide();
                    $('#propStrokeColor').val('#1f1f1f1f');
                } else
                    $('#propFillColor').show();
                $('#propType').val(type)
            }
        }
    });


    // ---------------------------- DIAGRAM ----------------------------------
    var gridsize = 40
    for(var x=1;x<(MAXWIDTH/gridsize);x++)
    {
        background.add(new fabric.Line([gridsize*x - MAXWIDTH/2, 0 - MAXHEIGHT/2, gridsize*x - MAXWIDTH/2, MAXHEIGHT/2],{ stroke: "#bfbfbf", strokeWidth: 1, selectable:false, strokeDashArray: [2, 2]}));
        background.add(new fabric.Line([0 - MAXWIDTH/2, gridsize*x - MAXHEIGHT/2, MAXWIDTH/2, gridsize*x - MAXHEIGHT/2],{ stroke: "#bfbfbf", strokeWidth: 1, selectable:false, strokeDashArray: [2, 2]}));
        background.renderAll();
    }
    background.add(new fabric.Line([-10, 0, 12, 0],{ stroke: "3399ff", strokeWidth: 2, selectable:false, strokeDashArray: [1, 1]}));
    background.add(new fabric.Line([0, -10, 0, 12],{ stroke: "3399ff", strokeWidth: 2, selectable:false, strokeDashArray: [1, 1]}));

    // ---------------------------- SLIDER ----------------------------------
    dateSlider = document.getElementById('slider');
    noUiSlider.create(dateSlider, {
        start: [0,1],
        range: {
            'min': [0],
            'max': [1]
        },
        connect: [false, true, false],
        step: 1
    });

    dateSlider.noUiSlider.on('update', function(values, handle) {
        var filter = [];
        if (parseInt(values[1]) > eventTimes.length)
            filter = [eventTimes[parseInt(values[0])]];
        else {
            for (var i = parseInt(values[0]); i < parseInt(values[1]); i ++) {
                filter.push(eventTimes[i]);
            }
        }
        if (tempLinks.length > 0) {
            for (var i = 0; i < tempLinks.length; i++) {
                background.remove(tempLinks[i]);
            }
            tempLinks = [];
        }
        for (var j = 0; j < canvas.getObjects().length; j++)
            canvas.item(j).setShadow(null);
        for (var i = 0; i < eventTableData.length; i++) {
            if (filter.indexOf(eventTableData[i].event_time) !== -1) {
                var from = null;
                var to = null;
                var tempLink;
                $('#events').jsGrid("rowByItem",eventTableData[i]).addClass('highlight');
                for (var j = 0; j < canvas.getObjects().length; j++) {
                    if (canvas.item(j).uuid === eventTableData[i].source_object || canvas.item(j).uuid === eventTableData[i].dest_object) {
                        if (canvas.item(j).uuid === eventTableData[i].source_object)
                            from = canvas.item(j);
                        else if (canvas.item(j).uuid === eventTableData[i].dest_object)
                            to = canvas.item(j);
                        //canvas.item(j).setShadow("0px 0px 50px rgba(255, 0, 0, 1.0)");
                        canvas.item(j).setShadow({color: 'red', offsetX: 2, offsetY:2, blur: 5});
                    }
                    if (from && to) {
                        var line = new fabric.Line([from.getCenterPoint().x, from.getCenterPoint().y, to.getCenterPoint().x, to.getCenterPoint().y], {
                            from: from,
                            to: to,
                            stroke: 'red',
                            strokeColor: 'red',
                            strokeWidth: 5,
                            hasControls: false,
                            lockMovementX: true,
                            lockMovementY: true,
                            lockScalingX: true,
                            lockScalingY: true,
                            lockRotation: true,
                        });
                        tempLink = line;
                        background.add(line);
                        line.sendToBack();
                        tempLinks.push(tempLink);
                        break;
                    }
                }
            } else {
                $('#events').jsGrid("rowByItem",eventTableData[i]).removeClass('highlight');
            }
        }
        background.renderAll();
        canvas.renderAll();
    });

    // ---------------------------- JSGRIDS ----------------------------------
    $('#ops').jsGrid({
        autoload: false,
        width: '100%',
        height: 650,
        editing: true,
        sorting: true,
        paging: true,
        fields: [
            { name: 'id', type: 'number', css: 'hide', width: 0},
            { name: 'event_time', title: 'Action Time', type : 'date', width: 50,
                insertTemplate: function() {
                    var input = this.__proto__.insertTemplate.call(this);
                    var date = new Date();
                    input.val((date.getFullYear() + '-' + addZero(date.getMonth()+1) + '-' + addZero(date.getDate()) + ' ' + addZero(date.getHours()) + ':' + addZero(date.getMinutes()) + ':' + addZero(date.getSeconds()) + '.' + date.getMilliseconds()));
                    return input;
                }
            },
            { name: 'event', title: 'E. Id', type: 'number', width: 20},
            { name: 'source_object', title: 'Host/Device', type: 'text', width: 50},
            { name: 'tool', title: 'Tool', type: 'text', width: 50},
            { name: 'action', title: 'Action', type: 'textarea'},
            { name: 'analyst', title: 'Analyst', type: 'text', width: 30, readOnly: true},
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
                return Object.keys(opnoteTableData).map(function (key) { return opnoteTableData[key]; });
            },
            insertItem: function(item) {
                if (item.id === 0 || item.id === undefined) {
                    item.mission = mission;
                    diagram.send(JSON.stringify({act: 'insert_opnote', arg: item}));
                }
                return;
            },
            updateItem: function(item) {
                diagram.send(JSON.stringify({act: 'update_opnote', arg: item}));
            },
            deleteItem: function(item) {
                diagram.send(JSON.stringify({act: 'delete_opnote', arg: item}));
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

    $('#events').jsGrid({
        autoload: false,
        width: '100%',
        height: '400px',
        editing: true,
        sorting: true,
        paging: true,
        fields: [
            { name: 'id', type: 'number', title: 'E. Id', width: 20},
            { name: 'event_time', title: 'Event Time', type : 'date', width: 65,
                insertTemplate: function() {
                    var input = this.__proto__.insertTemplate.call(this);
                    var date = new Date();
                    input.val((date.getFullYear() + '-' + addZero(date.getMonth()+1) + '-' + addZero(date.getDate()) + ' ' + addZero(date.getHours()) + ':' + addZero(date.getMinutes()) + ':' + addZero(date.getSeconds()) + '.' + date.getMilliseconds()));
                    return input;
                }
            },
            { name: 'discovery_time', title: 'Discovery Time', type : 'date', width: 65,
                insertTemplate: function() {
                    var input = this.__proto__.insertTemplate.call(this);
                    var date = new Date();
                    input.val((addZero(date.getMonth()+1) + '/' + addZero(date.getDate()) + '/' + date.getFullYear() + ' ' + addZero(date.getHours()) + ':' + addZero(date.getMinutes()) + ':' + addZero(date.getSeconds()) + '.' + date.getMilliseconds()));
                    return input;
                }
            },
            { name: 'source_object', title: 'Source', type: 'select', items: objectSelect, valueField: 'uuid', textField: 'name', width: 65, filterValue: function() {
                    return this.items[this.filterControl.val()][this.textField];
                }
            },
            { name: 'source_port', title: 'SPort', type: 'number', width: 20},
            { name: 'dest_object', title: 'Destination', type: 'select', items: objectSelect, valueField: 'uuid', textField: 'name', width: 65, filterValue: function() {
                    return this.items[this.filterControl.val()][this.textField];
                }
            },
            { name: 'dest_port', title: 'DPort', type: 'number', width: 20},
            { name: 'event_type', title: 'Event Type', type: 'text'},
            { name: 'short_desc', title: 'Event Description', type: 'text'},
            { name: 'analyst', title: 'Analyst', type: 'text', width: 50, readOnly: true},
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
                return Object.keys(eventTableData).map(function (key) { return eventTableData[key]; });
            },
            insertItem: function(item) {
                if (item.id === 0 || item.id === undefined) {
                    item.mission = mission;
                    diagram.send(JSON.stringify({act: 'insert_event', arg: item}));
                    eventTimes.splice(eventTimes.length-1,0,item.event_time);
                    dateSlider.noUiSlider.updateOptions({
                        start: [0,eventTimes.length+1],
                        range: {
                            'min': 0,
                            'max': eventTimes.length+1
                        },
                        step: 1
                    });
                }
                return;
            },
            updateItem: function(item) {
                diagram.send(JSON.stringify({act: 'update_event', arg: item}));
                //eventTableData[item['id']] = item;
            },
            deleteItem: function(item) {
                diagram.send(JSON.stringify({act: 'delete_event', arg: item}));

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

    // ---------------------------- MISC ----------------------------------
    $("#dropZone").dropzone({ url: "upload" })
    $("#diagram_jumbotron").resizable();
    $("#toolbar-body").resizable({ handles: 'w' });
    $("#toolbar-body").on("resize", function( event, ui ) {
        toolbarSizes[activeToolbar] = $('#toolbar-body').css('width');
    }); 

    window.addEventListener('resize', resizeCanvas, false);
    function resizeCanvas() {
        canvas.setHeight(window.innerHeight);
        canvas.setWidth(window.innerWidth);
        background.setHeight(window.innerHeight);
        background.setWidth(window.innerWidth);
        canvas.renderAll();
    }
    resizeCanvas();
});
