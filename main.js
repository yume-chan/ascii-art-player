/// <reference path="index.html" />

/**
 *
 * @param {ImageDataArray} pixels
 * @param {number} index
 */
function toGrayscale(pixels, index) {
    // return 299 * imageData[index] + 578 * imageData[index + 1] + 114 * imageData[index + 2] / 1000;

    // use a fast algorithm for now
    return (pixels[index] + pixels[index + 1] * 2 + pixels[index + 2]) >> 2;
}

var chars =
    " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";

const fontFamily = "monospace";
const fontSize = 16;

/**
 *
 * @typedef {{ char:string, pixels:number[] }[]} CharMapEntry
 * @typedef {{width:number, height:number, chars:CharMapEntry}} CharMap
 *
 * @returns {CharMap}
 */
function createCharMap() {
    var canvas = document.createElement("canvas");
    canvas.width = fontSize / 2;
    canvas.height = fontSize;
    canvas.style.scale = "10";
    canvas.style.transformOrigin = "0 0";
    canvas.style.background = "red";
    document.body.appendChild(canvas);

    var context = /** @type {CanvasRenderingContext2D } */ (
        canvas.getContext("2d", {
            alpha: false,
            // desynchronized: true,
            willReadFrequently: true,
        })
    );
    context.font = `${fontSize}px "${fontFamily}"`;
    context.textAlign = "center";
    context.textBaseline = "middle";

    /** @type {CharMapEntry} */
    const charMap = [];
    for (var i = 0; i < chars.length; i++) {
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "black";
        context.fillText(chars[i], canvas.width / 2, canvas.height / 2);

        var imageData = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        ).data;
        var pixels = [];
        for (var j = 0; j < imageData.length; j += 4) {
            pixels.push(toGrayscale(imageData, j));
        }

        charMap.push({ char: chars[i], pixels: pixels });
    }

    document.body.removeChild(canvas);
    return {
        width: canvas.width,
        height: canvas.height,
        chars: charMap,
    };
}

const charMap = createCharMap();
console.log(charMap);

var video = /** @type {HTMLVideoElement} */ (document.getElementById("video"));
video.addEventListener('resize', handleResize)

var canvas = document.createElement("canvas");
var context = /** @type {CanvasRenderingContext2D } */ (
    canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
        willReadFrequently: true,
    })
);

var width = 0,
    height = 0;

function handleResize() {
    video.style.maxWidth = innerWidth + "px";
    video.style.maxHeight = innerHeight + "px";

    width = video.clientWidth;
    height = video.clientHeight;

    canvas.width = width;
    canvas.height = height;

    console.log('resize', width, height);
}

addEventListener("resize", handleResize);
handleResize();

var paintedFrames = 0;

/**
 *
 * @param {CharMap} charMap
 * @param {ImageData} imageData
 * @param {number} imageOffset
 * @returns
 */
function findBestCharacter(charMap, imageData, imageOffset) {
    var minDistance = Number.MAX_VALUE;
    var bestChar = " ";

    for (var i = 0; i < charMap.chars.length; i++) {
        var distance = 0;
        var charPixels = charMap.chars[i].pixels;

        var imagePixels = imageData.data;
        var imageIndex = imageOffset;
        var charPixelIndex = 0;
        for (var y = 0; y < charMap.height; y++) {
            for (var x = 0; x < charMap.width; x++) {
                var d =
                    toGrayscale(imagePixels, imageIndex) - charPixels[charPixelIndex++];
                distance += Math.abs(d)
                imageIndex += 4;
            }
            imageIndex += (imageData.width - charMap.width) * 4;
        }

        if (distance < minDistance) {
            minDistance = distance;
            bestChar = charMap.chars[i].char;
        }
    }

    return bestChar;
}

var output = /** @type {HTMLPreElement} */ (document.getElementById("output"));
output.style.fontFamily = fontFamily;
output.style.fontSize = `${fontSize}px`;

function convertFrame() {
    context.drawImage(video, 0, 0, width, height);

    var imageData = context.getImageData(0, 0, width, height);
    var index = 0,
        text = "";
    var rows = Math.floor(height / charMap.height);
    var columns = Math.floor(width / charMap.width);
    var skipCount = width * charMap.height * 4 - (columns * charMap.width) * 4;
    for (var y = 0; y < rows; y += 1) {
        for (var x = columns; x--;) {
            text += findBestCharacter(charMap, imageData, index);
            index += charMap.width * 4;
        }
        text += "\n";
        index += skipCount;
    }
    output.innerHTML = text;

    paintedFrames++;
    video.requestVideoFrameCallback(convertFrame);
}

var fps = /** @type {HTMLInputElement} */ (document.getElementById("fps"));
setInterval(function () {
    fps.value = paintedFrames.toString();
    paintedFrames = 0;
}, 1000);

var file = /** @type {HTMLInputElement} */ (document.getElementById("file"));
file.addEventListener("change", function () {
    video.src = URL.createObjectURL(/** @type {FileList} */(file.files)[0]);
    video.play();
    convertFrame();
});

var select = /** @type {HTMLSelectElement} */ (
    document.getElementById("select")
);
select.addEventListener("click", function () {
    file.click();
});
