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
var images = [];

var socket = io();
socket.emit('get_diagram','1');

socket.on('full_diagram', function (msg) {
    nodes = [];
    for (var node in msg) {
        nodes[msg[node]['id']] = msg[node];
//        makeNode(nodes[node]['id'], nodes[node]['x'], nodes[node]['y'], 64, 64, "skyblue", "1.png");
    }
});

socket.on('update_node', function(msg) {
    node = JSON.parse(msg);
    nodes[node.id] = node;
});    

function draw() {
    requestAnimationFrame(draw);
    drawAllNodes();
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

function drawAllNodes() {
    resize(canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (node in nodes) {
        if (!images[nodes[node].image]) {
            images[nodes[node].image] = new Image();
            images[nodes[node].image].src = "images/" + nodes[node].image;
        }
        drawNode(nodes[node]);
        ctx.stroke();
    }
}

function drawNode(node) {
    ctx.drawImage(images[node.image], node.x, node.y, 64, 64);
    ctx.beginPath();
    ctx.moveTo(node.x, node.y);
    ctx.lineTo(node.x + node.width, node.y);
    ctx.lineTo(node.x + node.width, node.y + node.height);
    ctx.lineTo(node.x, node.y + node.height);
    ctx.closePath();
}

function handleMouseDown(e) {
    e.preventDefault();
    mouseX = parseInt(e.clientX - offsetX);
    mouseY = parseInt(e.clientY - offsetY);
    startX = mouseX;
    startY = mouseY;
    for (node in nodes) {
        var node = nodes[node];
        drawNode(node);
        if (ctx.isPointInPath(mouseX, mouseY)) {
            selectedNode = node;
            mouseIsDown = true;
        }
    }
}

function handleMouseUp(e) {
    e.preventDefault();
    if (selectedNode !== null) {
        socket.emit('update_node', JSON.stringify(selectedNode));
    }
    selectedNode = null;
    mouseIsDown = false;
}

function handleMouseOut(e) {
    e.preventDefault();
    selectedNode = null;
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
        selectedNode.right = selectedNode.x + selectedNode.width;
        selectedNode.bottom = selectedNode.y + selectedNode.height;
    }
    // mousemove stuff here
    lastX = mouseX;
    lastY = mouseY;
}

$("#canvas").mousedown(function (e) {
    handleMouseDown(e);
});
$("#canvas").mousemove(function (e) {
    handleMouseMove(e);
});
$("#canvas").mouseup(function (e) {
    handleMouseUp(e);
});
