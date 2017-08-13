if (!permissions)
    permissions = [];
var earliest_message = 2147483647000;
var diagram_rw = false;
if (permissions.indexOf('all') !== -1 || permissions.indexOf('modify_diagram') !== -1) {
    diagram_rw = true;
    $("#propName").prop('disabled', false);
    $("#newObjectButton").prop('disabled', false).click(newObject);
    $("#propFillColor").prop('disabled', false);
    $("#propStrokeColor").prop('disabled', false);
    $("#moveUp").prop('disabled', false).click(moveUp);
    $("#moveDown").prop('disabled', false).click(moveDown);
    $("#moveToFront").prop('disabled', false).click(moveToFront);
    $("#moveToBack").prop('disabled', false).click(moveToBack);
    $("#insertObjectButton").prop('disabled', false).click(insertObject);
    $("#deleteObjectButton").prop('disabled', false).click(deleteObject);;
}
var events_rw = false;
var events_del = false;
var opnotes_rw = false;
var opnotes_del = false;
if (permissions.indexOf('all') !== -1 || permissions.indexOf('create_events') !== -1)
        events_rw = true;
if (permissions.indexOf('all') !== -1 || permissions.indexOf('delete_events') !== -1)
        events_del = true;
if (permissions.indexOf('all') !== -1 || permissions.indexOf('create_opnotes') !== -1)
        opnotes_rw = true;
if (permissions.indexOf('all') !== -1 || permissions.indexOf('delete_opnotes') !== -1)
        opnotes_del = true;

// ---------------------------- FABRIC CANVASES ----------------------------------
var canvas = new fabric.Canvas('canvas', {
    selection: false,
    preserveObjectStacking: true,
    renderOnAddRemove: false,
    enableRetinaScaling: false,
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

var settings = {'zoom': 1.0, 'x': 0, 'y': 0, 'diagram': 700, 'tools': 400, 'tasks': 400, 'notes': 400, 'opnotes': 1200, 'files': 400, 'log': 400};
var creatingLink = false;
var firstObject = null;
var scale = 1;
var offsetX = 0;
var offsetY = 0;
var mission = getParameterByName('mission');
var objectSelect = [{id:0, name:'none/unknown'}];
var dateSlider = null;
var images = {};
var eventTableData = [];
var opnoteTableData = [];
var objectsLoaded = null;
var updatingObject = false;
var diagram;
var toolbarMode = null;
var toolbarState = false;
var firstNode = null;
var zoom = 1.0;
var dirty = false;
var SVGCache = {};
var tempLinks = [];
var objectCache = {};
var resizeTimer = null;
var eventTableTimer = null;
var opnoteTableTimer = null;
var updateSettingsTimer = null;
var sliderTimer = null;
var doc;
var activeToolbar = null;
var lastselection;
var gridsize = 40;
var lastFillColor = '#000000';
var lastStrokeColor = '#ffffff';

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
 
$('#diagram').mousedown(startPan);

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

fabric.util.addListener(canvas.upperCanvasEl, 'dblclick', function (e) {
    var o = canvas.findTarget(e);
    if (canvas.getActiveObject() !== null && canvas.getActiveGroup() === null && !creatingLink) {
        if (o.objType !== undefined) {
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
            $('#prop-' + o.objType).val(o.image);
            $('#prop-' + o.objType).data('picker').sync_picker_with_select();
            openToolbar('tools');
        }
    } else {
        closeToolbar();
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
                            lastFillColor = $('#propFillColor').val();
                            lastStrokeColor = $('#propStrokeColor').val();
                            diagram.send(JSON.stringify({act: 'insert_object', arg: {mission: mission, name:$('#propName').val(), type: 'link', image: $('#prop-link').val(), stroke_color:$('#propStrokeColor').val(), obj_a: firstNode.uuid, obj_b: o.uuid, z: z}}));
                            firstNode = null;
                            creatingLink = false;
                        }
                    }
                } else if (toolbarState) {
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
                    $('#prop-' + o.objType).val(o.image);
                    $('#prop-' + o.objType).data('picker').sync_picker_with_select();
                    openToolbar('tools');
                }
            }
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
                if (tempLinks[i].objType === 'link') {
                    tempLinks[i].set({ 'x1': tempLinks[i].from.getCenterPoint().x, 'y1': tempLinks[i].from.getCenterPoint().y });
                    tempLinks[i].set({ 'x2': tempLinks[i].to.getCenterPoint().x, 'y2': tempLinks[i].to.getCenterPoint().y });
                } else {
                    tempLinks[i].set({top: tempLinks[i].dad.top, left: tempLinks[i].dad.left});
                }
            }
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

// ---------------------------- CHAT / LOG WINDOW  ----------------------------------
function addLogMessage(msg) {
    var lf = $('#log');
    if (msg.more && !msg.prepend)
        lf.append('<div id="get-more-messages"><span onClick="getMoreMessages()">Get more messages.</span></div>');
    for (var i = 0; i < msg.messages.length; i++) {
        var ts = msg.messages[i].timestamp;
        if (ts < earliest_message) {
            earliest_message = ts;
        }
        if (msg.prepend)
            lf.prepend('<div class="message-content"><div class="message-content-header"><span class="message-sender">' + msg.messages[i].analyst + '</span><span class="message-time">' + epochToDateString(ts) + '</span></div><span class="message-body">' + msg.messages[i].text + '</span></div>');
        else
            lf.append('<div class="message-content"><div class="message-content-header"><span class="message-sender">' + msg.messages[i].analyst + '</span><span class="message-time">' + epochToDateString(ts) + '</span></div><span class="message-body">' + msg.messages[i].text + '</span></div>');
    }
    if (msg.more && msg.prepend)
        lf.prepend('<div id="get-more-messages"><span onClick="getMoreMessages()">Get more messages.</span></div>');
    $('#log').scrollTop($('#log')[0].scrollHeight);
}

function getMoreMessages() {
    $('#get-more-messages').remove();
    diagram.send(JSON.stringify({act:'get_log', arg: {mission: mission, start_from: earliest_message}}));
}

// ---------------------------- SETTINGS COOKIE ----------------------------------
function loadSettings() {
    if (decodeURIComponent(document.cookie) === '')
        document.cookie = "mcscop-settings=" + JSON.stringify(settings);
    var dc = decodeURIComponent(document.cookie);
    settings = JSON.parse(dc.split('=')[1]);
    $('#diagram_jumbotron').height(settings.diagram);
    canvas.setZoom(settings.zoom);
    background.setZoom(settings.zoom);
    canvas.relativePan({ x: -1 * settings.x, y: settings.y });
    //background.relativePan({ x: -1 * settings.x, y: settings.y });
    offsetX = settings.x;
    offsetY = settings.y;
}

function updateSettings() {
    if (updateSettingsTimer)
        window.clearTimeout(updateSettingsTimer);
    updateSettingsTimer = setTimeout(function() {
            document.cookie = "mcscop-settings=" + JSON.stringify(settings);
    }, 100);
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
        $('#modal-title').text('Edit Object Notes');
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
    offsetX = offsetX + ((canvas.width - (canvas.width * 0.90))/2) / canvas.getZoom();
    offsetY = offsetY - ((canvas.height - (canvas.height * 0.90))/2) / canvas.getZoom(); 
    canvas.zoomToPoint(new fabric.Point(canvas.width / 2, canvas.height / 2), canvas.getZoom() / 0.90);
    background.zoomToPoint(new fabric.Point(background.width / 2, background.height / 2), background.getZoom() / 0.90);
    settings.x = offsetX;
    settings.y = offsetY;
    settings.zoom = canvas.getZoom();
    updateSettings();
}

function zoomOut() {
    offsetX = offsetX + ((canvas.width - (canvas.width * 1.10))/2) / canvas.getZoom();
    offsetY = offsetY - ((canvas.height - (canvas.height * 1.10))/2) / canvas.getZoom(); 
    canvas.zoomToPoint(new fabric.Point(canvas.width / 2, canvas.height / 2), canvas.getZoom() / 1.1);
    background.zoomToPoint(new fabric.Point(background.width / 2, background.height / 2), background.getZoom() / 1.1);
    settings.zoom = canvas.getZoom();
    settings.x = offsetX;
    settings.y = offsetY;
    updateSettings();
}

function getDate() {
    var date = new Date();
    return date.getFullYear() + '-' + addZero(date.getMonth()+1) + '-' + addZero(date.getDate()) + ' ' + addZero(date.getHours()) + ':' + addZero(date.getMinutes()) + ':' + addZero(date.getSeconds()) + '.' + date.getMilliseconds();
}

function getObjectSelect() {
    objectSelect.sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });
    var objString = '';
    for (var i = 0; i < objectSelect.length; i++) {
        objString += objectSelect[i].uuid + ':' + objectSelect[i].name + ';';
    }
    return objString.substr(0, objString.length - 1);
}

function getOpnoteSubGridData(id) {
    var tdata = new Array();
    for (var i = 0; i < opnoteTableData.length; i++) {
        if (opnoteTableData[i].event == id) {
            tdata.push(opnoteTableData[i]);
        }
    }
    return tdata;
}

function epochToDateString(value){
    if (isNaN(value)) {
        return value;
    }
    var date = new Date(parseInt(value));
    return (date.getFullYear() + '-' + addZero(date.getMonth()+1) + '-' + addZero(date.getDate()) + ' ' + addZero(date.getHours()) + ':' + addZero(date.getMinutes()) + ':' + addZero(date.getSeconds()) + '.' + date.getMilliseconds());
    
}

function dateStringToEpoch(value) {
    var parts = value.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d+)/);
    return(Date.UTC(parts[1], parts[2]-1, parts[3], parts[4], parts[5], parts[6], parts[7]));
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
            offsetX -= (x - x0) / canvas.getZoom();
            offsetY += (y - y0) / canvas.getZoom();
            canvas.relativePan({ x: x - x0, y: y - y0 });
            //background.relativePan({ x: x - x0, y: y - y0 });
            x0 = x;
            y0 = y;
        }
    }
    function stopPan(event) {
        settings.x = Math.round(offsetX);
        settings.y = Math.round(offsetY);
        updateSettings();
        $(window).off('mousemove', continuePan);
        $(window).off('mouseup', stopPan);
    };
    $(window).mousemove(continuePan);
    $(window).mouseup(stopPan);
    $(window).contextmenu(cancelMenu);
};

function newObject() {
    canvas.deactivateAllWithDispatch().renderAll();
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
            fontSize: 10,
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
                lockMovementX: !diagram_rw,
                lockMovementY: !diagram_rw,
                lockScalingX: !diagram_rw,
                lockScalingY: !diagram_rw,
                lockRotation: !diagram_rw
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
                top: o.y,
                lockMovementX: !diagram_rw,
                lockMovementY: !diagram_rw,
                lockScalingX: !diagram_rw,
                lockScalingY: !diagram_rw,
                lockRotation: !diagram_rw
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
                top: o.y,
                lockMovementX: !diagram_rw,
                lockMovementY: !diagram_rw,
                lockScalingX: !diagram_rw,
                lockScalingY: !diagram_rw,
                lockRotation: !diagram_rw
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

function insertLink() {
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
    closeToolbar();
    if ($('#propType').val() === 'link')
        insertLink();
    else {
        var center = new fabric.Point(canvas.width / 2, canvas.height / 2);
        lastFillColor = $('#propFillColor').val();
        lastStrokeColor = $('#propStrokeColor').val();
        diagram.send(JSON.stringify({act: 'insert_object', arg:{mission: mission, name:$('#propName').val(), fill_color:$('#propFillColor').val(), stroke_color:$('#propStrokeColor').val(), image:$('#prop-' + $('#propType').val()).val(), type:$('#propType').val(), x: Math.round(center.x / canvas.getZoom() + offsetX), y: Math.round(center.y / canvas.getZoom() - offsetY), z: canvas.getObjects().length}})); 
    }
}

function sendLogMessage(msg) {
    diagram.send(JSON.stringify({act: 'insert_log', arg: {text: msg}}));
}

function deleteObject() {
    if (canvas.getActiveObject().uuid) {
        diagram.send(JSON.stringify({act: 'delete_object', arg: {uuid:canvas.getActiveObject().uuid, type:canvas.getActiveObject().objType}}));
    }
}

function moveToZ(o, z) {
    if (o) {
        if (o.objType === 'link')
            diagram.send(JSON.stringify({act: 'move_object', arg: {uuid: o.uuid, type: o.objType, z: z}}));
        else if (o.objType === 'icon')
            diagram.send(JSON.stringify({act: 'move_object', arg: {uuid: o.uuid, type: o.objType, x: o.left, y: o.top, z: z, scale_x: o.scaleX, scale_y: o.scaleY}}));
        else if (o.objType === 'shape')
            diagram.send(JSON.stringify({act: 'move_object', arg: {uuid: o.uuid, type: o.objType, x: o.left, y: o.top, z: z, scale_x: o.width, scale_y: o.height}}));
    }
}

function moveToFront() {
    var zTop = canvas.getObjects().length - tempLinks.length - 2;
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
    if (canvas.getActiveObject().uuid && canvas.getObjects().indexOf(o) < canvas.getObjects().length - 2 - tempLinks.length) {
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
    $('#message').html('<span class="messageHeader">' + msg + '</span>');
    $('#message').show();
    if (timeout !== undefined) {
        setTimeout(function() {
            $('#message').html('');
            $('#message').hide();
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
        $('#events2').jqGrid('setColProp', 'dest_object', { editoptions: { value: getObjectSelect() }});
        $('#events2').jqGrid('setColProp', 'source_object', { editoptions: { value: getObjectSelect() }});
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
    toolbarState = true;
    toolbarMode = mode;
    switch(mode) {
        case 'tools':
            activeToolbar = 'tools';
            $('#toolbar-body').css('width', Math.min($('#diagram_jumbotron').width()-60, settings['tools']));
            $('#toolsForm').show();
            $('#tasksForm').hide();
            $('#notesForm').hide();
            $('#opsForm').hide();
            $('#filesForm').hide();
            $('#logForm').hide();
            if (canvas.getActiveObject()) {
                if (diagram_rw)
                    $('#toolbarTitle').html('Edit Object');
                else
                    $('#toolbarTitle').text('View Object');
                $('#propNameGroup').show();
                $('#propObjectGroup').show();
                $('#editDetailsButton').show();
                $('#deleteObjectButton').show();
                $('#insertObjectButton').hide();
                $('#newObjectButton').show();
                $('#propObjectGroup').tabs('disable');
                var objType = $('#propType').val();
                var index = $('#propObjectGroup a[href="#tabs-' + objType + '"]').parent().index();
                $('#propObjectGroup').tabs('enable', index);
                $('#propObjectGroup').tabs('option', 'active', index);
            } else if (canvas.getActiveObject() === undefined || canvas.getActiveObject() === null) {
                $('#toolbarTitle').html('New Object');
                $('#propID').val('');
                $('#propNameGroup').show();
                $('#propName').val('');
                $('#propFillColor').val(lastFillColor);
                $('#propStrokeColor').val(lastStrokeColor);
                $('#propType').val('icon');
                $('#prop-icon').val('00-000-icon-hub.svg');
                $('#prop-icon').data('picker').sync_picker_with_select();
                $('#propObjectGroup').tabs('enable');
                $('#propObjectGroup').tabs('option', 'active', 0);
                $('#newObjectButton').hide();
                $('#editDetailsButton').hide();
                $('#deleteObjectButton').hide();
                $('#insertObjectButton').show();
            }
            break;
        case 'tasks':
            activeToolbar = 'tasks';
            $('#toolbar-body').css('width', Math.min($('#diagram_jumbotron').width()-60, settings['tasks']));
            $('#toolsForm').hide();
            $('#tasksForm').show();
            $('#notesForm').hide();
            $('#opsForm').hide();
            $('#filesForm').hide();
            $('#logForm').hide();
            break;
        case 'notes':
            activeToolbar = 'notes';
            $('#toolbar-body').css('width', Math.min($('#diagram_jumbotron').width()-60, settings['notes']));
            $('#toolsForm').hide();
            $('#tasksForm').hide();
            $('#notesForm').show();
            $('#opsForm').hide();
            $('#filesForm').hide();
            $('#logForm').hide();
            break;
        case 'ops':
            activeToolbar = 'opnotes';
            $('#toolbar-body').css('width', Math.min($('#diagram_jumbotron').width()-60, settings['opnotes']));
            $('#toolsForm').hide();
            $('#tasksForm').hide();
            $('#notesForm').hide();
            $('#opsForm').show();
            $('#logForm').hide();
            setTimeout(function() {
                $("#opnotes").setGridHeight($('#opsForm').height()-65);
                $("#opnotes").setGridWidth($('#opsForm').width()-5); 
            }, 10);
            $('#filesForm').hide();
            break;
        case 'files':
            activeToolbar = 'files';
            $('#toolbar-body').css('width', Math.min($('#diagram_jumbotron').width()-60, settings['files']));
            $('#toolsForm').hide();
            $('#tasksForm').hide();
            $('#notesForm').hide();
            $('#opsForm').hide();
            $('#filesForm').show();
            $('#logForm').hide();
            break;
        case 'log':
            activeToolbar = 'log';
            $('#toolbar-body').css('width', Math.min($('#diagram_jumbotron').width()-60, settings['log']));
            $('#toolsForm').hide();
            $('#tasksForm').hide();
            $('#notesForm').hide();
            $('#opsForm').hide();
            $('#filesForm').hide();
            $('#logForm').show();
        break;
    }
    // edit
    if ($('#toolbar-body').is(':hidden')) {
        $('#toolbar-body').show();
    }
}

function closeToolbar() {
    toolbarState = false;
    $('#toolbar-body').hide();
}

function timestamp(str){
    var date = new Date(str);
    return (date.getFullYear() + '-' + addZero(date.getMonth()+1) + '-' + addZero(date.getDate()) + ' ' + addZero(date.getHours()) + ':' + addZero(date.getMinutes()) + ':' + addZero(date.getSeconds()) + '.' + date.getMilliseconds());
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

function downloadDiagram() {
    window.open(canvas.toDataURL('png'));
}

function downloadOpnotes() {
    JSONToCSVConvertor(opnoteTableData, 'opnotes.csv');
}

function downloadEvents() {
    JSONToCSVConvertor(eventTableData, 'events.csv');
}

// https://ciphertrick.com/2014/12/07/download-json-data-in-csv-format-cross-browser-support/
function msieversion() {
    var ua = window.navigator.userAgent;
    var msie = ua.indexOf("MSIE ");
    if (msie > 0 || !!navigator.userAgent.match(/Trident.*rv\:11\./))
    {
        return true;
    } else { // If another browser,
        return false;
    }
}

function JSONToCSVConvertor(JSONData, fileName) {
    var arrData = typeof JSONData != 'object' ? JSON.parse(JSONData) : JSONData;
    var CSV = '';
    var row = "";
    for (var index in arrData[0]) {
        row += index + ',';
    }
    row = row.slice(0, -1);
    CSV += row + '\r\n';
    for (var i = 0; i < arrData.length; i++) {
        var row = "";
        for (var index in arrData[i]) {
            var arrValue = arrData[i][index] == null ? "" : '"' + arrData[i][index] + '"';
            row += arrValue + ',';
        }
        row.slice(0, row.length - 1);
        CSV += row + '\r\n';
    }
    if (CSV == '') {
        return;
    }
    var fileName = "Result";
    if(msieversion()){
        var IEwindow = window.open();
        IEwindow.document.write('sep=,\r\n' + CSV);
        IEwindow.document.close();
        IEwindow.document.execCommand('SaveAs', true, fileName + ".csv");
        IEwindow.close();
    } else {
        var uri = 'data:application/csv;charset=utf-8,' + escape(CSV);
        var link = document.createElement("a");
        link.href = uri;
        link.style = "visibility:hidden";
        link.download = fileName + ".csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function toggleAnimateSlider() {
    if (sliderTimer) {
        window.clearTimeout(sliderTimer);
    } else {
        animateSlider(0);
    }
}

function animateSlider(i) {
    setSlider(0, i);
    var next = i;
    sliderTimer = setTimeout(function() {
        next += 1;
        if (next >= dateSlider.noUiSlider.options.range.max)
            next = 0;
        animateSlider(next);
    }, 5000);
}

function setSlider(i, value) {
    var r = [null,null];
    r[i] = value;
    dateSlider.noUiSlider.set(r);
}

function resizeCanvas() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        canvas.setHeight($('#diagram').height());
        canvas.setWidth($('#diagram').width());
        background.setHeight($('#diagram').height());
        background.setWidth($('#diagram').width());
        canvas.renderAll();
        $("#events2").setGridWidth($('#events').width()-5);
    }, 50);
}

function startTime() {
    var today = new Date();
    var eh = today.getHours();
    var uh = today.getUTCHours();
    var m = today.getMinutes();
    var s = today.getSeconds();
    m = checkTime(m);
    s = checkTime(s);
    $('#est').html('Local: ' + eh + ":" + m + ":" + s);
    $('#utc').html('UTC: ' + uh + ":" + m + ":" + s);
    var t = setTimeout(startTime, 500);
}

function checkTime(i) {
    if (i < 10) {i = "0" + i};
    return i;
}

function deleteRow(type, table, id) {
    diagram.send(JSON.stringify({act: 'delete_' + type, arg: {id: id}}));
    $(table).jqGrid('delRowData', id);
}

function saveRow(type, table, id) {
    var data = {};
    var act = "update_" + type;
    if (id.indexOf('jqg') !== -1) {
        $(table + ' #' + id).find('input, select, textarea').each(function () {
            data[this.name] = $(this).val();
        });
        act = "insert_" + type;
    }
    else {
        $(table).jqGrid('saveRow', id); 
        data = $(table).getRowData(id);
    }
    data.mission = mission;
    $(table).jqGrid('restoreRow', id, function(){});
    if (data.event_time)
        data.event_time = dateStringToEpoch(data.event_time);
    if (data.discovery_time)
        data.discovery_time = dateStringToEpoch(data.discovery_time);
    diagram.send(JSON.stringify({act: act, arg: data}));
}

$(document).ready(function() {
    startTime();
    // ---------------------------- SOCKETS ----------------------------------
    if (location.protocol === 'https:')
        diagram = new WebSocket('wss://' + window.location.host + '/mcscop/');
    else
        diagram = new WebSocket('ws://' + window.location.host + '/mcscop/');
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
        console.log('get log history');
        diagram.send(JSON.stringify({act:'get_log', arg: {mission: mission}}));
    };
    diagram.onmessage = function(msg) {
        msg = JSON.parse(msg.data);
        switch(msg.act) {
            case 'log':
                addLogMessage(msg.arg);
                break;
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
            case 'update_files':
                $('#files').jstree('refresh');
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
                $('#events2').jqGrid('setColProp', 'dest_object', { editoptions: { value: getObjectSelect() }});
                $('#events2').jqGrid('setColProp', 'source_object', { editoptions: { value: getObjectSelect() }});
                checkIfShapesCached(msg.arg);
                break;
            case 'all_events':
                for (var evt in msg.arg) {
                    eventTableData.push(msg.arg[evt]);
                }
                $('#events2').jqGrid('setGridParam', { 
                    datatype: 'local',
                    data: eventTableData
                }).trigger("reloadGrid");
                dateSlider.noUiSlider.updateOptions({
                    start: [-1, $('#events2').getRowData().length],
                    behaviour: 'drag',
                    range: {
                        'min': -1,
                        'max': $('#events2').getRowData().length
                    },
                    step: 1
                });
                break;
            case 'all_opnotes':
                opnoteTableData = [];
                for (var evt in msg.arg) {
                    opnoteTableData.push(msg.arg[evt]);
                }
                $('#opnotes').jqGrid('setGridParam', { 
                    datatype: 'local',
                    data: opnoteTableData
                }).trigger("reloadGrid");
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
                $('#events2').jqGrid('setColProp', 'dest_object', { editoptions: { value: getObjectSelect() }});
                $('#events2').jqGrid('setColProp', 'source_object', { editoptions: { value: getObjectSelect() }});
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
                                obj.moveTo((o.z)*2 + 1);
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
                $('#events2').jqGrid('setRowData', evt.id, evt);
                break;
            case 'insert_event':
                var evt = msg.arg;
                eventTableData.push(evt);
                $('#events2').jqGrid('addRowData', evt.id, evt, 'last');
                dateSlider.noUiSlider.updateOptions({
                    start: [-1, $('#events2').getRowData().length],
                    behaviour: 'drag',
                    range: {
                        'min': -1,
                        'max': $('#events2').getRowData().length
                    },
                    step: 1
                });
                break;
            case 'delete_event':
                var evt = msg.arg;
                $('#events2').jqGrid('delRowData', evt.id);
                for (var i = 0; i < eventTableData.length; i++) {
                    if (eventTableData[i].id === evt.id) {
                        eventTableData.splice(i, 1);
                        break;
                    }
                }
                dateSlider.noUiSlider.updateOptions({
                    start: [-1, $('#events2').getRowData().length],
                    behaviour: 'drag',
                    range: {
                        'min': -1,
                        'max': $('#events2').getRowData().length
                    },
                    step: 1
                });
                break;
            case 'update_opnote':
                var evt = msg.arg;
                for (var i = 0; i < opnoteTableData.length; i++) {
                    if (opnoteTableData[i].id === evt.id) {
                        opnoteTableData[i] = evt;
                    }
                }
                $('#opnotes').jqGrid('setRowData', evt.id, evt);
                break;
            case 'insert_opnote':
                var evt = msg.arg;
                opnoteTableData.push(evt);
                $('#opnotes').jqGrid('addRowData', evt.id, evt, 'last');
                break;
            case 'delete_opnote':
                var evt = msg.arg;
                for (var i = 0; i < opnoteTableData.length; i++) {
                    if (opnoteTableData[i].id === evt.id) {
                        opnoteTableData.splice(i, 1);
                        break;
                    }
                }
                $('#opnotes').jqGrid('delRowData', evt.id);
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
                $('#events2').jqGrid('setColProp', 'dest_object', { editoptions: { value: getObjectSelect() }});
                $('#events2').jqGrid('setColProp', 'source_object', { editoptions: { value: getObjectSelect() }});
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
    $('#propObjectGroup').tabs({
        beforeActivate: function(e, u) {
            $('#propType').val(u.newPanel.attr('id').split('-')[1]);
        }
    });
    $.each(['icon','shape','link'], function(i, v) {
        $('#prop-' + v).imagepicker({
            hide_select : true,
            initialized: function() {
                if (!diagram_rw)
                    $("#propObjectGroup").find("div").unbind('click');
            },
            selected : function() {
                if (!diagram_rw)
                    return;
                if (canvas.getActiveObject() !== null && canvas.getActiveObject() !== undefined && (canvas.getActiveObject().objType === 'icon' || canvas.getActiveObject().objType === 'shape')) {
                    var obj = canvas.getActiveObject();
                    var oldZ = canvas.getObjects().indexOf(canvas.getActiveObject());
                    obj.image = $(this).val();
                    var type = $(this).val().split('-')[2];
                    if (obj.objType !== type)
                        return;
                    updatingObject = true;
                    changeObject(obj);
                    updatingObject = false;
                } else {
                    var type = $(this).val().split('-')[2];
                    $('#propType').val(type)
                }
            }
        });
    });

    // ---------------------------- DIAGRAM ----------------------------------
    for(var x=1;x<(MAXWIDTH/gridsize);x++)
    {
        background.add(new fabric.Line([gridsize*x - MAXWIDTH/2, 0 - MAXHEIGHT/2, gridsize*x - MAXWIDTH/2, MAXHEIGHT/2],{ stroke: "#bfbfbf", strokeWidth: 1, selectable:false, strokeDashArray: [2, 2]}));
        background.add(new fabric.Line([0 - MAXWIDTH/2, gridsize*x - MAXHEIGHT/2, MAXWIDTH/2, gridsize*x - MAXHEIGHT/2],{ stroke: "#bfbfbf", strokeWidth: 1, selectable:false, strokeDashArray: [2, 2]}));
    }
    background.add(new fabric.Line([-10, 0, 12, 0],{ stroke: "3399ff", strokeWidth: 2, selectable:false, strokeDashArray: [1, 1]}));
    background.add(new fabric.Line([0, -10, 0, 12],{ stroke: "3399ff", strokeWidth: 2, selectable:false, strokeDashArray: [1, 1]}));
    background.renderAll();

    // ---------------------------- SLIDER ----------------------------------
    dateSlider = document.getElementById('slider');
    noUiSlider.create(dateSlider, {
        start: [-1,1],
        behaviour: 'drag',
        range: {
            'min': [-1],
            'max': [1]
        },
        connect: [false, true, false],
        step: 1
    });

    dateSlider.noUiSlider.on('update', function(values, handle) {
        if ($('#events2').getRowData()) {
            var filter = [];
            if (parseInt(values[1]) === $('#events2').getRowData().length) {
                if (parseInt(values[0]) > -1)
                    filter = [parseInt(values[0])];
            } else {
                for (var i = parseInt(values[0]); i <= parseInt(values[1]); i ++) {
                    filter.push(i);
                }
            }
            if (tempLinks.length > 0) {
                for (var i = 0; i < tempLinks.length; i++) {
                    canvas.remove(tempLinks[i]);
                }
                tempLinks = [];
            }
            if (filter.length === 1) {
                $('#message').show();
                $('#message').css('display','inline-block');
            } else {
                $('#message').hide();
            }
            var rows = $('#events2').getRowData();
            for (var i = 0; i < rows.length; i++) {
                if (rows[i]) {
                    if (filter.indexOf(i) !== -1) {
                        if (filter.length === 1)
                            $('#message').html('<span class="messageHeader">' + timestamp(rows[i].event_time) + '</span><br/><span class="messageBody">' + rows[i].short_desc.replace('\n','<br>') + '</span>');
                        $($('#events2').jqGrid("getInd", rows[i].id, true)).addClass('highlight');
                        var from = null;
                        var to = null;
                        var tempLink;
                        for (var j = 0; j < canvas.getObjects().length; j++) {
                            if (canvas.item(j).uuid === rows[i].source_object || canvas.item(j).uuid === rows[i].dest_object) {
                                if (canvas.item(j).uuid === rows[i].source_object) {
                                    from = canvas.item(j);
                                    var shape = new fabric.Rect({
                                        dad: from,
                                        objType: 'shape',
                                        width: from.getWidth() + 10,
                                        height: from.getHeight() + 10,
                                        stroke: 'red',
                                        fill: 'rgba(0,0,0,0)',
                                        strokeWidth: 5,
                                        originX: 'center',
                                        originY: 'center',
                                        left: from.left,
                                        top: from.top,
                                        selectable: false,
                                        evented: false
                                    });
                                    var tempShape = shape;
                                    tempLinks.push(tempShape);
                                    canvas.add(shape);
                                } else if (canvas.item(j).uuid === rows[i].dest_object) {
                                    to = canvas.item(j);
                                    var shape = new fabric.Rect({
                                        dad: to,
                                        objType: 'shape',
                                        width: to.getWidth() + 10,
                                        height: to.getHeight() + 10,
                                        stroke: 'red',
                                        fill: 'rgba(0,0,0,0)',
                                        strokeWidth: 5,
                                        originX: 'center',
                                        originY: 'center',
                                        left: to.left,
                                        top: to.top,
                                        selectable: false,
                                        evented: false
                                    });
                                    var tempShape = shape;
                                    tempLinks.push(tempShape);
                                    canvas.add(shape);
                                }
                            }
                            if (from && to) {
                                var line = new fabric.Line([from.getCenterPoint().x, from.getCenterPoint().y, to.getCenterPoint().x, to.getCenterPoint().y], {
                                    objType: 'link',
                                    from: from,
                                    to: to,
                                    stroke: 'red',
                                    strokeColor: 'red',
                                    strokeWidth: 8,
                                    strokeDashArray: [15,10],
                                    selectable: false,
                                    evented: false
                                });
                                tempLink = line;
                                canvas.add(line);
                                tempLinks.push(tempLink);
                                break;
                            }
                        }
                    } else {
                        $($('#events2').jqGrid("getInd", rows[i].id, true)).removeClass('highlight');
                    }
                }
            }
            canvas.renderAll();
        }
    });
    // ---------------------------- JQGRIDS ----------------------------------
    $("#opnotes").jqGrid({
        datatype: 'local',
        cellsubmit: 'clientArray',
        editurl: 'clientArray',
        data: [],
        height: 300,
        cellEdit: true,
        sortable: true,
        pager: '#opnotesPager',
        pgbuttons: false,
        pgtext: null,
        viewrecords: false,
        colModel: [
            { label: 'Id', name: 'id', hidden: true, key: true, editable: false },
            { label: ' ', template: 'actions', formatter: function(cell, options, row) {
                    var buttons = '<div title="Delete row" style="float: left;';
                    if (!opnotes_del)
                        buttons += ' display: none;';
                    buttons += '" class="ui-pg-div ui-inline-del" id="jDelButton_' + options.rowId + '" onclick="deleteRow(\'opnote\', \'#opnotes\', \'' + options.rowId + '\')" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-trash"></span></div> <div title="Save row" style="float: left; display: none;" class="ui-pg-div ui-inline-save" id="jSaveButton_' + options.rowId + '" onclick="saveRow(\'opnote\', \'#opnotes\', \'' + options.rowId + '\')" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-disk"></span></div><div title="Cancel row editing" style="float: left; display: none;" class="ui-pg-div ui-inline-cancel" id="jCancelButton_' + options.rowId + '" onclick="jQuery.fn.fmatter.rowactions.call(this,\'cancel\');" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-cancel"></span></div>';
                    return buttons;
                },
                width: 15,
                formatoptions: {
                    keys: true,
                }
            },
            { label: 'Id', name: 'event', width: 10, editable: true },
            { label: 'Event Time', name: 'event_time', width: 60, editable: true, formatter: epochToDateString, editoptions: {
                dataInit: function (element) {
                    $(element).datetimepicker({
                        dateFormat: "yy-mm-dd",
                        timeFormat: "HH:mm:ss.l",
                        controlType: 'select',
                        showMillisec: true
                    })
                },
                editrules: {
                    date: true,
                    minValue: 0
                },
                formatoptions: {
                    newformat: 'yy-mm-dd HH:mm:ss.l'
                },
                defaultValue: getDate()
            }},
            { label: 'Host/Device', name: 'source_object', width: 50, editable: true },
            { label: 'Tool', name: 'tool', width: 20, editable: true },
            { label: 'Action', name: 'action', width: 75, editable: true },
            { label: 'Analyst', name: 'analyst', width: 40, editable: false },
        ],
        onSelectRow: function() {
            return false;
        },
        beforeSelectRow: function(rowid, e) {
            return false;
        },
        beforeEditCell: function (id) {
            if (lastselection && lastselection !== id) {
                $("table#opnotes tr#"+$.jgrid.jqID(lastselection)+ " div.ui-inline-del").show();
                $("table#opnotes tr#"+$.jgrid.jqID(lastselection)+ " div.ui-inline-save").hide();
                $("table#opnotes tr#"+$.jgrid.jqID(lastselection)+ " div.ui-inline-cancel").hide();
            }
            $("table#opnotes tr#"+$.jgrid.jqID(id)+ " div.ui-inline-del").hide();
            $("table#opnotes tr#"+$.jgrid.jqID(id)+ " div.ui-inline-save").show();
            $("table#opnotes tr#"+$.jgrid.jqID(id)+ " div.ui-inline-cancel").show();
            lastselection = id;
        },
        beforeSaveCell: function(options, col, value) {
            $("table#opnotes tr#"+$.jgrid.jqID(options)+ " div.ui-inline-del").show();
            $("table#opnotes tr#"+$.jgrid.jqID(options)+ " div.ui-inline-save").hide();
            $("table#opnotes tr#"+$.jgrid.jqID(options)+ " div.ui-inline-cancel").hide();
            lastselection = null;
            var data = $('#opnotes').getRowData(options);
            data[col] = value;
            if (data.event_time)
                data.event_time = dateStringToEpoch(data.event_time);
            delete data.actions;
            diagram.send(JSON.stringify({act: 'update_opnote', arg: data}));
        }
    });
    $('#opnotes').jqGrid('navGrid', '#opnotesPager', {
        add: false,
        edit: false,
        del: false,
    })
    if (opnotes_rw) {
        $('#opnotes').jqGrid('navGrid').jqGrid('navButtonAdd', '#opnotesPager',{
            position:"last",
            caption:"",
            buttonicon:"ui-icon-plus",
            onClickButton: function(){
                $('#opnotes').jqGrid('addRow', {addRowParams: {
                        keys: true,
                        beforeSaveRow: function(options, id) {
                            data = {};
                            $(this).find('input, select, textarea').each(function () {
                                data[this.name] = $(this).val();
                            });
                            data.mission = mission;
                            $('#opnotes').jqGrid('restoreRow', id, function(){});
                            data.event_time = dateStringToEpoch(data.event_time);
                            delete data.actions;
                            diagram.send(JSON.stringify({act: 'insert_opnote', arg: data}));
                        },
                        oneditfunc: function(id) {
                            if (lastselection && lastselection !== id) {
                                $("table#opnotes tr#"+$.jgrid.jqID(lastselection)+ " div.ui-inline-del").show();
                                $("table#opnotes tr#"+$.jgrid.jqID(lastselection)+ " div.ui-inline-save").hide();
                                $("table#opnotes tr#"+$.jgrid.jqID(lastselection)+ " div.ui-inline-cancel").hide();
                            }
                            $("table#opnotes tr#"+$.jgrid.jqID(id)+ " div.ui-inline-del").hide();
                            $("table#opnotes tr#"+$.jgrid.jqID(id)+ " div.ui-inline-save").show();
                            $("table#opnotes tr#"+$.jgrid.jqID(id)+ " div.ui-inline-cancel").show();
                            lastselection = id;
                        }
                    }
               });
            }
        });
    }
    $("#events2").jqGrid({
        datatype: 'local',
        cellsubmit: 'clientArray',
        editurl: 'clientArray',
        data: [],
        height: 250,
        subGrid: true,
        cellEdit: true,
        pager: '#eventsPager',
        pgbuttons: false,
        pgtext: null,
        viewrecords: false,
        toolbar: [true, "top"],
        subGridRowExpanded: function(subgridId, rowid) {
            var subgridTableId = subgridId + "_t";
            $("#" + subgridId).html("<table id='" + subgridTableId + "'></table>");
            $("#" + subgridTableId).jqGrid({
                datatype: 'local',
                autowidth: true,
                data: getOpnoteSubGridData(rowid),
                colModel: [
                    { label: 'E-Id', name: 'id', width: 10, key: true, editable: false },
                    { label: 'Event Time', name: 'event_time', width: 60, editable: false, formatter: epochToDateString },
                    { label: 'Host/Device', name: 'source_object', width: 50, editable: false },
                    { label: 'Tool', name: 'tool', width: 50, editable: false },
                    { label: ' ', name: 'action', width: 100, editable: false },
                    { label: 'Analyst', name: 'analyst', width: 30, editable: false },
                ],
            });
        },
        colModel: [
            { label: ' ', name: 'actions', formatter: function(cell, options, row) {
                    var buttons = '<div title="Delete row" style="float: left;';
                    if (!events_del)
                        buttons += ' display: none;';
                    buttons += '" class="ui-pg-div ui-inline-del" id="jDelButton_' + options.rowId + '" onclick="deleteRow(\'event\', \'#events2\', \'' + options.rowId + '\')" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-trash"></span></div> <div title="Save row" style="float: left; display: none;" class="ui-pg-div ui-inline-save" id="jSaveButton_' + options.rowId + '" onclick="saveRow(\'event\', \'#events2\', \'' + options.rowId + '\')" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-disk"></span></div><div title="Cancel row editing" style="float: left; display: none;" class="ui-pg-div ui-inline-cancel" id="jCancelButton_' + options.rowId + '" onclick="jQuery.fn.fmatter.rowactions.call(this,\'cancel\');" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-cancel"></span></div>';
                    return buttons;
                },
                width: 15,
                formatoptions: {
                    keys: true,
                }
            },
            { label: 'Id', name: 'id', width: 15, key: true, editable: false },
            { label: 'Event Time', name: 'event_time', width: 60, editable: true, formatter: epochToDateString, editoptions: {
                dataInit: function (element) {
                    $(element).datetimepicker({
                        dateFormat: "yy-mm-dd",
                        timeFormat: "HH:mm:ss.l",
                        controlType: 'select',
                        showMillisec: true
                    })
                },
                defaultValue: getDate(),
                editrules: {
                    date: true,
                    minValue: 0
                },
                formatoptions: {
                    newformat: 'yy-mm-dd HH:mm:ss.l'
                }
            }},
            { label: 'Discovery Time', name: 'discovery_time', width: 60, editable: true, formatter: epochToDateString, editoptions: {
                dataInit: function (element) {
                    $(element).datetimepicker({
                        dateFormat: "yy-mm-dd",
                        timeFormat: "HH:mm:ss.l",
                        controlType: 'select',
                        showMillisec: true,
                        vertical: 'top'
                    })
                },
                defaultValue: getDate(),
                editrules: {
                    date: true,
                    minValue: 0
                },
                formatoptions: {
                    newformat: 'yy-mm-dd HH:mm:ss.l'
                }
            }},
            { label: 'Source', name: 'source_object', width: 45, editable: true, formatter: 'select', edittype: 'select', editoptions: {
                value: getObjectSelect()
            }},
            { label: 'SPort', name: 'source_port', width: 15, editable: true },
            { label: 'Destination', name: 'dest_object', width: 45, editable: true, formatter: 'select', edittype: 'select', editoptions: {
                value: getObjectSelect()
            }},
            { label: 'DPort', name: 'dest_port', width: 15, editable: true },
            { label: 'Event Type', name: 'event_type', width: 50, editable: true },
            { label: 'Event Description', name: 'short_desc', width: 150, edittype: 'textarea', editable: true },
            { label: 'Analyst', name: 'analyst', width: 30, editable: false },
        ],
        onSelectRow: function() {
            return false;
        },
        beforeSelectRow: function(rowid, e) {
            return false;
        },
        beforeEditCell: function (id) {
            if (lastselection && lastselection !== id) {
                $("table#events2 tr#"+$.jgrid.jqID(lastselection)+ " div.ui-inline-del").show();
                $("table#events2 tr#"+$.jgrid.jqID(lastselection)+ " div.ui-inline-save").hide();
                $("table#events2 tr#"+$.jgrid.jqID(lastselection)+ " div.ui-inline-cancel").hide();
            }                
            $("table#events2 tr#"+$.jgrid.jqID(id)+ " div.ui-inline-del").hide();
            $("table#events2 tr#"+$.jgrid.jqID(id)+ " div.ui-inline-save").show();
            $("table#events2 tr#"+$.jgrid.jqID(id)+ " div.ui-inline-cancel").show();
            lastselection = id;
        },
        beforeSaveCell: function (options, col, value) {
            $("table#events2 tr#"+$.jgrid.jqID(options)+ " div.ui-inline-del").show();
            $("table#events2 tr#"+$.jgrid.jqID(options)+ " div.ui-inline-save").hide();
            $("table#events2 tr#"+$.jgrid.jqID(options)+ " div.ui-inline-cancel").hide();
            lastselection = null;
            var data = $('#events2').getRowData(options);
            data[col] = value;
            if (data.event_time)
                data.event_time = dateStringToEpoch(data.event_time);
            if (data.discovery_time)
                data.discovery_time = dateStringToEpoch(data.discovery_time);
            delete data.actions;
            diagram.send(JSON.stringify({act: 'update_event', arg: data}));
        }
    });
    $('#events2').jqGrid('navGrid', '#eventsPager', {
        add: false,
        edit: false,
        del: false,
    })
    if (events_rw) {
        $('#events2').jqGrid('navGrid').jqGrid('navButtonAdd', '#eventsPager', {
            position:"last",
            caption:"", 
            buttonicon:"ui-icon-plus", 
            onClickButton: function(){
                $('#events2').jqGrid('addRow', {addRowParams: {
                        keys: true,
                        beforeSaveRow: function(options, id) {
                            data = {};
                            $(this).find('input, select, textarea').each(function () {
                                data[this.name] = $(this).val();
                            });
                            data.mission = mission;
                            $('#events2').jqGrid('restoreRow', id, function(){});
                            data.event_time = dateStringToEpoch(data.event_time);
                            data.discovery_time = dateStringToEpoch(data.discovery_time);
                            delete data.actions;
                            diagram.send(JSON.stringify({act: 'insert_event', arg: data}));
                        },
                        oneditfunc: function(id) {
                            if (lastselection && lastselection !== id) {
                                $("table#events2 tr#"+$.jgrid.jqID(lastselection)+ " div.ui-inline-del").show();
                                $("table#events2 tr#"+$.jgrid.jqID(lastselection)+ " div.ui-inline-save").hide();
                                $("table#events2 tr#"+$.jgrid.jqID(lastselection)+ " div.ui-inline-cancel").hide();
                            }
                            $("table#events2 tr#"+$.jgrid.jqID(id)+ " div.ui-inline-del").hide();
                            $("table#events2 tr#"+$.jgrid.jqID(id)+ " div.ui-inline-save").show();
                            $("table#events2 tr#"+$.jgrid.jqID(id)+ " div.ui-inline-cancel").show();
                            lastselection = id;
                        }
                    }
               });
            }
        });
    }
    $('#t_events2').append($("<div><input id=\"globalSearchText\" type=\"text\"></input>&nbsp;" +
        "<button id=\"globalSearch\" type=\"button\">Search</button></div>"));
    $("#globalSearchText").keypress(function (e) {
        var key = e.charCode || e.keyCode || 0;
        if (key === $.ui.keyCode.ENTER) {
            $("#globalSearch").click();
        }
    });
    $("#globalSearch").button({
    }).click(function () {
        var $grid = $('#events2');
        var rules = [], i, cm, postData = $grid.jqGrid("getGridParam", "postData"),
            colModel = $grid.jqGrid("getGridParam", "colModel"),
            searchText = $("#globalSearchText").val(),
            l = colModel.length;
        for (i = 0; i < l; i++) {
            cm = colModel[i];
            if (cm.search !== false && (cm.stype === undefined || cm.stype === "text")) {
                rules.push({
                    field: cm.name,
                    op: "cn",
                    data: searchText
                });
            }
        }
        postData.filters = JSON.stringify({
            groupOp: "OR",
            rules: rules
        });
        $grid.jqGrid("setGridParam", { search: true });
        $grid.trigger("reloadGrid", [{page: 1, current: true}]);
        return false;
    });
    // ---------------------------- MISC ----------------------------------
    $("#diagram_jumbotron").resizable({ handles: 's', minHeight: 100 });
    $("#toolbar-body").resizable({ handles: 'w', maxWidth: $('#diagram_jumbotron').width()-60 });
    $("#toolbar-body").on("resize", function(event, ui) {
        settings[activeToolbar] = Math.round($('#toolbar-body').width());
        $("#opnotes").setGridWidth($('#opsForm').width()-5);
        updateSettings();
    }); 
    $('#diagram_jumbotron').on('resize', function(event, ui) {
        settings.diagram = Math.round($('#diagram_jumbotron').height());
        $("#opnotes").setGridHeight($('#opsForm').height()-65);
        updateSettings();
        resizeCanvas();
    });
    $("#events2").setGridWidth($('#events').width()-5);
    window.addEventListener('resize', resizeCanvas, false);
    $("#message-input-box").keypress(function (e) {
        var key = e.charCode || e.keyCode || 0;
        if (key === $.ui.keyCode.ENTER) {
            sendLogMessage($("#message-input-box").val());
            $("#message-input-box").val('');
        }
    });
    resizeCanvas();
    loadSettings();
});
