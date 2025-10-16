/// <reference types="@webgpu/types" />
/// <reference path="index.html" />

/**
 *
 * @param {ImageDataArray} pixels
 * @param {number} index
 */
function toGrayscale(pixels, index) {
    const r = pixels[index] / 255;
    const g = pixels[index + 1] / 255;
    const b = pixels[index + 2] / 255;

    // use a fast algorithm for now
    // const value = (r + g * 2 + b) / 4 / 255;
    const value = 0.299 * r + 0.578 * g + 0.114 * b;

    return 1 - value;
}

var chars =
    " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";

const fontFamily = "monospace";
const fontSize = 6;

var output = /** @type {HTMLPreElement} */ (document.getElementById("output"));
output.style.fontFamily = fontFamily;
output.style.fontSize = `${fontSize}px`;
output.addEventListener("click", () => {
    output.scrollIntoView();
});

/**
 *
 * @typedef {{ char:string, pixels:Float32Array }[]} CharMapEntry
 * @typedef {{width:number, height:number, chars:CharMapEntry}} CharMap
 *
 * @returns {CharMap}
 */
function createCharMap() {
    var canvas = document.createElement("canvas");
    canvas.width = fontSize;
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
    context.font = `${fontSize}px ${fontFamily}`;
    context.textAlign = "center";
    context.textBaseline = "middle";

    let maxWidth = 0;
    for (const char of chars) {
        const metrics = context.measureText(char);
        console.log("metrics", char, metrics);
        maxWidth = Math.max(maxWidth, metrics.width);
    }

    const letterSpacing = 1 - (maxWidth % 1);
    output.style.letterSpacing = `${letterSpacing}px`;

    maxWidth = Math.ceil(maxWidth);

    let sumMax = 0;

    /** @type {CharMapEntry} */
    const charMap = [];
    for (var i = 0; i < chars.length; i++) {
        context.fillStyle = "white";
        context.fillRect(0, 0, maxWidth, canvas.height);

        context.fillStyle = "black";
        context.fillText(chars[i], maxWidth / 2, canvas.height / 2);

        var imageData = context.getImageData(0, 0, maxWidth, canvas.height).data;
        var pixels = new Float32Array(imageData.length / 4);
        let sum = 0;
        for (var j = 0; j < imageData.length; j += 4) {
            var grayscale = toGrayscale(imageData, j);
            pixels[j / 4] = grayscale;
            sum += grayscale;
        }

        sumMax = Math.max(sumMax, sum);

        charMap.push({ char: chars[i], pixels: pixels });
    }

    const normalizeFactor = (maxWidth * canvas.height) / sumMax;
    for (const char of charMap) {
        for (let i = 0; i < char.pixels.length; i++) {
            char.pixels[i] *= normalizeFactor;
        }
    }

    document.body.removeChild(canvas);
    return {
        width: maxWidth,
        height: canvas.height,
        chars: charMap,
    };
}

const charMap = createCharMap();
console.log(charMap);

var video = /** @type {HTMLVideoElement} */ (document.getElementById("video"));
video.addEventListener("resize", handleResize);

var width = 0,
    height = 0;

function handleResize() {
    if (!video.videoWidth || !video.videoHeight) {
        return;
    }

    width = innerWidth;
    height = innerHeight;

    if (width / height > video.videoWidth / video.videoHeight) {
        width = (height * video.videoWidth) / video.videoHeight;
    } else {
        height = (width * video.videoHeight) / video.videoWidth;
    }

    console.log("resize", width, height);
}

addEventListener("resize", handleResize);
handleResize();

/**
 * @type {GPUDevice}
 */
let device;
/**
 * @type {GPUComputePipeline}
 */
let pipeline;
/**
 * @type {GPUBuffer}
 */
let charMapBuffer;
/**
 * @type {GPUBuffer}
 */
let uniformBuffer;
/**
 * @type {GPUSampler}
 */
let sampler;

var paintedFrames = 0;

async function convertFrame() {
    const rows = Math.floor(height / charMap.height);
    const columns = Math.floor(width / charMap.width);

    const outputBufferSize = columns * rows * 4;
    const outputBuffer = device.createBuffer({
        size: outputBufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const readBuffer = device.createBuffer({
        size: outputBufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const uniformData = new Float32Array(8);
    const uniformDataU32 = new Uint32Array(uniformData.buffer);
    uniformDataU32[0] = charMap.width;
    uniformDataU32[1] = charMap.height;
    uniformDataU32[2] = charMap.chars.length;
    uniformDataU32[3] = width;
    uniformDataU32[4] = height;
    uniformData[5] = parseFloat(exposure.value);
    uniformData[6] = parseFloat(gamma.value);

    device.queue.writeBuffer(uniformBuffer, 0, uniformData.buffer);

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: charMapBuffer } },
            { binding: 1, resource: device.importExternalTexture({ source: video }) },
            { binding: 2, resource: { buffer: outputBuffer } },
            { binding: 3, resource: { buffer: uniformBuffer } },
            { binding: 4, resource: sampler },
        ],
    });

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(columns / 8), Math.ceil(rows / 8));
    passEncoder.end();

    commandEncoder.copyBufferToBuffer(
        outputBuffer,
        0,
        readBuffer,
        0,
        outputBufferSize
    );

    device.queue.submit([commandEncoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const outputArray = new Uint32Array(readBuffer.getMappedRange());

    let text = "";
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
            const index = y * columns + x;
            text += chars[outputArray[index]];
        }
        text += "\n";
    }
    output.textContent = text;

    readBuffer.unmap();

    paintedFrames++;
    video.requestVideoFrameCallback(convertFrame);
}

var fps = /** @type {HTMLInputElement} */ (document.getElementById("fps"));
setInterval(function () {
    fps.value = paintedFrames.toString();
    paintedFrames = 0;
}, 1000);

var exposure = /** @type {HTMLInputElement} */ (
    document.getElementById("exposure")
);
var gamma = /** @type {HTMLInputElement} */ (document.getElementById("gamma"));

var exposureValue = /** @type {HTMLSpanElement} */ (
    document.getElementById("exposure-value")
);
exposure.addEventListener("input", function () {
    exposureValue.textContent = parseFloat(exposure.value).toFixed(2);
});

var gammaValue = /** @type {HTMLSpanElement} */ (
    document.getElementById("gamma-value")
);
gamma.addEventListener("input", function () {
    gammaValue.textContent = parseFloat(gamma.value).toFixed(2);
});

var file = /** @type {HTMLInputElement} */ (document.getElementById("file"));
file.addEventListener("change", async function () {
    video.src = URL.createObjectURL(/** @type {FileList} */(file.files)[0]);
    await video.play();
    convertFrame();
});

var select = /** @type {HTMLSelectElement} */ (
    document.getElementById("select")
);
select.addEventListener("click", function () {
    file.click();
});

async function main() {
    if (!navigator.gpu) {
        file.disabled = true;
        select.disabled = true;
        select.innerText = "WebGPU is not supported";
        return;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error("No appropriate GPUAdapter found.");
    }
    device = await adapter.requestDevice();

    const charMapSize =
        charMap.width *
        charMap.height *
        charMap.chars.length *
        Float32Array.BYTES_PER_ELEMENT;
    charMapBuffer = device.createBuffer({
        size: charMapSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });
    const charMapBufferArray = new Float32Array(charMapBuffer.getMappedRange());
    for (let i = 0; i < charMap.chars.length; i++) {
        charMapBufferArray.set(
            charMap.chars[i].pixels,
            i * charMap.width * charMap.height
        );
    }
    charMapBuffer.unmap();

    const shaderModule = device.createShaderModule({
        code: await fetch("main.wgsl").then((response) => response.text()),
    });

    pipeline = device.createComputePipeline({
        layout: "auto",
        compute: {
            module: shaderModule,
            entryPoint: "main",
        },
    });

    uniformBuffer = device.createBuffer({
        size: 32, // 5 * 4 bytes for 5 u32s and 2 * 4 bytes for 2 f32s
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
    });
}

main();
