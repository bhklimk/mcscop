var canvas = new fabric.Canvas('canvas', {
    selection: false,
    preserveObjectStacking: true
});

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
var updatingObject = false;
var socket = io();
var fps = 10;
var now;
var then = Date.now();
var interval = 1000/fps;
var delta;
var firstNode = null;
var zoom = 1.0;

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

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
    socket.emit('join', mission);
    $('#modal').modal('hide');
    socket.emit('get_objects', mission);
});

socket.on('disco', function (msg) {
    $('#modal').modal('show');
});

socket.on('disconnect', function() {
    $('#modal').modal('show')
});

socket.on('all_links', function (msg) {
    links = []
    for (var link in msg) {
        addLinkToCanvas(msg[link]);
    }
});

socket.on('change_object', function(msg) {
    var o = JSON.parse(msg);
    for (var i = 0; i < canvas.getObjects().length; i++) {
        if (canvas.item(i).uuid == o.uuid) {
            var to = canvas.item(i);
            if (o.type === 'object') {
                if (to.image !== o.image || to.fillColor !== o.fillColor) {
                    var children = to.children.length;
                    for (var k = 0; k < children; k++)
                        canvas.remove(to.children[k]);
                    canvas.remove(to);
                    addObjectToCanvas(o);
                } else {
                    for (var k = 0; k < canvas.item(i).children.length;k ++) {
                        if (canvas.item(i).children[k].objType === 'name')
                            canvas.item(i).children[k].text = o.name;
                    }
                }
                canvas.renderAll();
            } else if (o.type === 'link') {
                canvas.item(i).stroke_color = o.stroke_color;
                canvas.item(i).stroke = o.stroke_color;
                canvas.renderAll();
            }
            break;
        }
    }
});

socket.on('move_object', function (msg) {
    var o = JSON.parse(msg);
    for (var i = 0; i < canvas.getObjects().length; i++) {
        if (canvas.item(i).uuid == o.uuid) {
            canvas.item(i).animate({left: o.x, top: o.y}, {
                duration: 100,
                onChange: function() {
                    for (var j = 0; j < canvas.item(i).children.length; j++) {
                        canvas.item(i).children[j].setTop(canvas.item(i).getTop() + (canvas.item(i).getHeight()/2));
                        canvas.item(i).children[j].setLeft(canvas.item(i).getLeft());
                    }
                    canvas.renderAll();;
                }
            });
            break;
        }
    }
});

socket.on('insert_object', function(msg) {
    var o = JSON.parse(msg);
    addObjectToCanvas(o);
});

socket.on('insert_link', function(msg) {
    var o = JSON.parse(msg);
    addLinkToCanvas(o);
});

socket.on('delete_object', function(msg) {
    var uuid = JSON.parse(msg);
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
});

function zoomIn() {
    zoom += 0.1;
    canvas.setZoom(zoom);
}

function zoomOut() {
    zoom -= 0.1;
    canvas.setZoom(zoom);
}

function cancelMenu() {
    $(window).off('contextmenu', cancelMenu);
    return false;
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

canvas.on('object:moving', function(options) {
    for (var j = 0; j < options.target.children.length; j++) {
        options.target.children[j].setTop(options.target.getTop() + (options.target.getHeight()/2));
        options.target.children[j].setLeft(options.target.getLeft());
    }
});

canvas.on('object:scaling', function(options) {
    for (var j = 0; j < options.target.children.length; j++) {
        options.target.children[j].setTop(options.target.getTop() + (options.target.getHeight()/2));
        options.target.children[j].setLeft(options.target.getLeft());
    }
});

canvas.on('object:modified', function(options) {
    if (options.target) {
        if (canvas.getActiveObject() !== null) {
            var z = canvas.getObjects().indexOf(options.target);
            socket.emit('move_object', JSON.stringify({uuid: options.target.uuid, type: options.target.objType, x: options.target.left, y: options.target.top, z: z, scale_x: options.target.scaleX, scale_y: options.target.scaleY}));
        } else if (canvas.getActiveGroup() !== null) {
            for (var i = 0; i < options.target.getObjects().length; i++) {
                var left = options.target.getCenterPoint().x + options.target.item(i).left;
                var top = options.target.getCenterPoint().y + options.target.item(i).top;
                socket.emit('move_object', JSON.stringify({uuid: options.target.item(i).uuid, type: options.target.item(i).objType, x: left, y: top, z: z, scale_x: options.target.scaleX, scale_y: options.target.scaleY}));
            }
        }
    }
});

canvas.on('before:render', function(e) {
    for (var i = 0; i < canvas.getObjects().length; i++) {
        if (canvas.item(i).objType !== undefined && canvas.item(i).objType === 'link') {
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
                canvas.item(i).set({ 'x1': fromObj.getCenterPoint().x, 'y1': fromObj.getCenterPoint().y });
                canvas.item(i).set({ 'x2': toObj.getCenterPoint().x, 'y2': toObj.getCenterPoint().y });
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
});

function addLinkToCanvas(o) {
    var fromObject = null;
    var toObject = null;
    for (var i = 0; i < canvas.getObjects().length; i++) {
        if (canvas.item(i).uuid == o.node_a) {
            fromObject = canvas.item(i);
        }
        if (canvas.item(i).uuid == o.node_b) {
            toObject = canvas.item(i);
        }
    }
    if (fromObject !== null && toObject !== null) {
        var from = fromObject.getCenterPoint();
        var to = toObject.getCenterPoint();
        var line = new fabric.Line([from.x, from.y, to.x, to.y], {
            uuid: o.uuid,
            objType: 'link',
            from: o.node_a,
            to: o.node_b,
            fill: 'black',
            stroke: o.stroke_color,
            strokeColor: o.stroke_color,
            strokeWidth: 2,
            hasControls: false,
            lockMovementX: true,
            lockMovementY: true,
            lockScalingX: true,
            lockScalingY: true,
            lockRotation: true,
        });
        var name = new fabric.Text(o.name, {
            parent_uuid: o.uuid,
            objType: 'name',
            selectable: false,
            originX: 'center',
            textAlign: 'center',
            fill: o.stroke_color,
            angle: (Math.atan2((line.y1 - line.y2), (line.x1 - line.x2)) * (180/Math.PI)),
            fontSize: 10,
            left: line.getCenterPoint().x,
            top: line.getCenterPoint().y
        });
        line.children = [name];
        canvas.add(line).moveTo(line, 1);
        canvas.add(name).moveTo(line, 1);
    }
}

function addObjectToCanvas(o) {
    if (o.image !== undefined && o.image !== null) {
        var path = 'images/icons/';
        if (o.type === 'shape')
            path = 'images/shapes/';
        console.log('start');
        fabric.loadSVGFromURL(path + o.image, function(objects, options) {
            var name;
            var shape = fabric.util.groupSVGElements(objects, options);
//            var shape2 = fabric.util.groupSVGElements(objects, options);
            shape.set({
                uuid: o.uuid,
                objType: o.type,
                fillColor: o.fill_color,
                strokeColor: o.stroke_color,
                image: o.image,
                name: name,
                originX: 'center',
                originY: 'center',
                left: o.x,
                top: o.y,
                scaleX: o.scale_x,
                scaleY: o.scale_y
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
                objType: 'name',
                selectable: false,
                originX: 'center',
                textAlign: 'center',
                fontSize: 14,
                left: o.x,
                top: o.y + (shape.getHeight()/2)
            });
//            c2.clear();
//            c2.setWidth(Math.ceil(shape2.width+1));
//            c2.setHeight(Math.ceil(shape2.height+1));
//            c2.add(shape2);
//            console.log(c2.toDataURL('image/png'));
            shape.children = [name];
            objectsLoaded.pop();
            canvas.add(shape);
            canvas.add(name);
            shape.moveTo(0);
            name.moveTo(0);
            canvas.renderAll();
        });
        console.log('finish');
    } else {
        objectsLoaded.pop();
    }
}

function changeObject(o) {
    var tempObj = {};
    if (o.objType === 'object') {

        tempObj.uuid = o.uuid;
        tempObj.x = o.left;
        tempObj.y = o.top;
        tempObj.scale_x = o.scaleX;
        tempObj.scale_y = o.scaleY;
        tempObj.type = o.objType;
        tempObj.fill_color = o.fillColor;
        tempObj.stroke_color = o.strokeColor;
        tempObj.image = o.image;
        tempObj.name = '';
        for (var i=0; i < o.children.length; i++) {
            if (o.children[i].objType === 'name') {
                tempObj.name = o.children[i].text;
            }
        }
    } else if (o.objType === 'link') {
        tempObj.uuid = o.uuid;
        tempObj.type = o.objType;
        tempObj.stroke_color = o.strokeColor;
        tempObj.name = '';
        for (var i=0; i < o.children.length; i++) {
            if (o.children[i].objType === 'name') {
                tempObj.name = o.children[i].text;
            }
        }
    }
    socket.emit('change_object', JSON.stringify(tempObj));
}

$(document).ready(function() {
    mission = getParameterByName('mission');
});

(function(){
  window.addEventListener('resize', resizeCanvas, false);
  function resizeCanvas() {
    canvas.setHeight(window.innerHeight);
    canvas.setWidth(window.innerWidth);
    canvas.renderAll();
  }
  resizeCanvas();
})();
