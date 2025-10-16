struct Uniforms {
    char_map_width: u32,
    char_map_height: u32,
    char_map_length: u32,
    image_width: u32,
    image_height: u32,
    exposure: f32,
    gamma: f32,
};

@group(0) @binding(0) var<storage, read> char_map: array<f32>;
@group(0) @binding(1) var video_frame: texture_external;
@group(0) @binding(2) var<storage, read_write> output: array<u32>;
@group(0) @binding(3) var<uniform> uniforms: Uniforms;
@group(0) @binding(4) var video_sampler: sampler;

fn to_grayscale(color: vec4<f32>) -> f32 {
    // let value = ((color.r + color.g * 2.0 + color.b) / 4.0);
    let value = 0.299 * color.r + 0.578 * color.g + 0.114 * color.b;
    return 1.0 - clamp(value * uniforms.gamma + uniforms.exposure, 0.0, 1.0);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let x = global_id.x;
    let y = global_id.y;

    let tile_width = uniforms.char_map_width;
    let tile_height = uniforms.char_map_height;
    let tile_pixel_count = tile_width * tile_height;

    if (x >= uniforms.image_width / tile_width || y >= uniforms.image_height / tile_height) {
        return;
    }

    // Create a local array to cache the grayscale values for the current video frame tile.
    // The size 128 is based on the char_map tile size (8x16).
    var tile_pixels: array<f32, 128>;

    // Pre-sample the video frame tile once and store the grayscale values in the local cache.
    for (var char_y = 0u; char_y < tile_height; char_y = char_y + 1u) {
        for (var char_x = 0u; char_x < tile_width; char_x = char_x + 1u) {
            let image_x = x * tile_width + char_x;
            let image_y = y * tile_height + char_y;
            let image_coords = vec2<f32>(
                (f32(image_x) + 0.5) / f32(uniforms.image_width),
                (f32(image_y) + 0.5) / f32(uniforms.image_height)
            );
            let image_color = textureSampleBaseClampToEdge(video_frame, video_sampler, image_coords);

            let tile_index = char_y * tile_width + char_x;
            tile_pixels[tile_index] = to_grayscale(image_color);
        }
    }

    var min_distance: f32 = 3.4e38;
    var best_char_index = 0u;

    // Now, loop through the characters and compare against the cached pixel values.
    for (var i = 0u; i < uniforms.char_map_length; i = i + 1u) {
        var distance: f32 = 0.0;
        let char_map_offset = i * tile_pixel_count;

        for (var tile_index = 0u; tile_index < tile_pixel_count; tile_index = tile_index + 1u) {
            let image_grayscale = tile_pixels[tile_index];
            let char_grayscale = char_map[char_map_offset + tile_index];

            let diff = image_grayscale - char_grayscale;
            distance = distance + diff * diff;
        }

        if (distance < min_distance) {
            min_distance = distance;
            best_char_index = i;
        }
    }

    let output_index = y * (uniforms.image_width / tile_width) + x;
    output[output_index] = best_char_index;
}
