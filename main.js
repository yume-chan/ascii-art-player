/// <reference path="index.html" />

/*
var canvas = document.createElement("canvas");
canvas.width = 7;
canvas.height = 10;
document.body.appendChild(canvas);
var context = canvas.getContext("2d");
context.font = '6px "Courier New"';
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

var width = innerWidth, height = innerHeight;

video.width = width;
video.height = height;

canvas.width = innerWidth;
canvas.height = innerHeight;

addEventListener("resize", function () {
    width = innerWidth, height = innerHeight;

    video.width = width;
    video.height = height;

    canvas.width = innerWidth;
    canvas.height = innerHeight;
});

var chars = "QK9DUul]+)~:,`. ";

var paintedFrames = 0;

var output = document.getElementById("output");
function convertFrame() {
    context.drawImage(video, 0, 0, width, height);

    var imageData = context.getImageData(0, 0, width, height).data;
    var index = 0, text = "";
    var columnCount = Math.ceil(width / 4),
        skipCount = (width * 5 - (4 - width % 4)) * 4;
    for (var y = Math.floor(height / 6) ; y--;) {
        for (var x = columnCount; x--;) {
            // var gray = 299 * imageData[index] + 578 * imageData[index + 1] + 114 * imageData[index + 2];
            // text += chars[parseInt(gray / 1000 / 16)];

            var gray = (imageData[index] + imageData[index + 1] * 2 + imageData[index + 2]) >> 2;
            text += chars[gray >> 4];

            index += 4 * 4;
        }
        text += "\n";
        index += skipCount;
    }
    output.innerHTML = text;

    paintedFrames++;
    requestAnimationFrame(convertFrame);
}

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