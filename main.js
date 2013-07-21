/// <reference path="index.html" />

"use strict";

/*
var canvas = document.createElement("canvas");
canvas.width = 7;
canvas.height = 10;
document.body.appendChild(canvas);
var context = canvas.getContext("2d");
context.font = '5px "Courier New"';
context.textBaseline = "top";

var bigCanvas = document.createElement("canvas");
bigCanvas.width = 70;
bigCanvas.height = 100;
document.body.appendChild(bigCanvas);
var bigContext = bigCanvas.getContext("2d");

var chars = "1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`~!@#$%^&*()_+-={}|[]\:\";'<>?,./";
for (var i = 0; i < chars.length; i++) {
    context.clearRect(0, 0, 7, 10);
    context.fillText(chars[i], 2, 2);

    bigContext.clearRect(0, 0, 70, 100);
    bigContext.drawImage(canvas, 0, 0, 70, 100);

    var imageData = bigContext.getImageData(0, 0, 70, 100).data;
    var fillRate = 0, index = 3;
    for (var j = 0; j < 70 * 100; j++) {
        fillRate += imageData[index];
        index += 4;
    }

    console.log("char " + chars[i] + " 's fill rate is " + fillRate);
}
*/

var video = document.getElementById("video");

var canvas = document.createElement("canvas");
var context = canvas.getContext("2d");

var width, height;
var blockWidth = 3, blockHeight = 6;

var rowCount, columnCount, skipCount;

function resize() {
    width = innerWidth, height = innerHeight;

    video.width = width;
    video.height = height;

    canvas.width = width;
    canvas.height = height;

    rowCount = Math.floor(height / blockHeight);
    columnCount = Math.floor(width / blockWidth);
    skipCount = (width * (blockHeight - 1) + width % blockWidth) * 4;
}
resize();
addEventListener("resize", resize);

var chars;

var use6px = false;
if (use6px)
    chars = "QK9DUul]+)~:,`. ";
else
    chars = "BHW82ewl+{=;:`. ";

var output = document.getElementById("output");
var imageData, index, text;
function convertFrame() {
    context.drawImage(video, 0, 0, width, height);

    imageData = context.getImageData(0, 0, width, height).data;
    index = 0;
    text = "";
    for (var y = rowCount; y--;) {
        for (var x = columnCount ; x--;) {
            // var gray = 299 * imageData[index] + 578 * imageData[index + 1] + 114 * imageData[index + 2];
            // text += chars[parseInt(gray / 1000 / 16)];
            text += chars[(imageData[index] + imageData[index + 1] * 2 + imageData[index + 2]) >> 6];
            index += blockWidth * 4;
        }
        text += "\n";
        index += skipCount;
    }
    output.textContent = text;

    paintedFrames++;
    requestAnimationFrame(convertFrame);
}

var paintedFrames = 0;
var fps = document.getElementById("fps");
setInterval(function () {
    fps.value = paintedFrames;
    paintedFrames = 0;
}, 1000);

var file = document.getElementById("file");
file.addEventListener("change", function () {
    video.src = URL.createObjectURL(this.files[0]);
    video.play();
    convertFrame();
});

var select = document.getElementById("select");
select.addEventListener("click", function () {
    file.click();
});