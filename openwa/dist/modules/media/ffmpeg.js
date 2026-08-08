"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FfmpegConversionError = void 0;
exports.buildFfmpegArgs = buildFfmpegArgs;
exports.voiceEncodeArgs = voiceEncodeArgs;
exports.videoEncodeArgs = videoEncodeArgs;
exports.runFfmpeg = runFfmpeg;
exports.probeFfmpeg = probeFfmpeg;
const node_child_process_1 = require("node:child_process");
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
class FfmpegConversionError extends Error {
    detail;
    constructor(message, detail = '') {
        super(message);
        this.detail = detail;
        this.name = 'FfmpegConversionError';
    }
}
exports.FfmpegConversionError = FfmpegConversionError;
const BASE_ARGS = ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y', '-protocol_whitelist', 'file'];
function buildFfmpegArgs(inputPath, outputPath, encodeArgs) {
    return [...BASE_ARGS, '-i', inputPath, ...encodeArgs, outputPath];
}
function voiceEncodeArgs() {
    return ['-vn', '-c:a', 'libopus', '-b:a', '32k', '-ar', '48000', '-ac', '1', '-application', 'voip'];
}
function videoEncodeArgs() {
    return [
        '-c:v',
        'libx264',
        '-profile:v',
        'baseline',
        '-level',
        '3.1',
        '-pix_fmt',
        'yuv420p',
        '-vf',
        "scale='min(1280,iw)':-2",
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
    ];
}
async function runFfmpeg(input, inputExtension, outputExtension, encodeArgs, options) {
    const dir = await (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), 'openwa-convert-'));
    const inputPath = (0, node_path_1.join)(dir, `in.${inputExtension}`);
    const outputPath = (0, node_path_1.join)(dir, `out.${outputExtension}`);
    try {
        await (0, promises_1.writeFile)(inputPath, input);
        await execute(buildFfmpegArgs(inputPath, outputPath, encodeArgs), options);
        const { size } = await (0, promises_1.stat)(outputPath);
        if (size > options.maxOutputBytes) {
            throw new FfmpegConversionError(`Converted media is ${size} bytes, above the ${options.maxOutputBytes} byte limit`);
        }
        if (size === 0) {
            throw new FfmpegConversionError('Conversion produced no output');
        }
        return await (0, promises_1.readFile)(outputPath);
    }
    finally {
        await (0, promises_1.rm)(dir, { recursive: true, force: true });
    }
}
function execute(args, options) {
    return new Promise((resolve, reject) => {
        const child = (0, node_child_process_1.spawn)(options.ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        let timedOut = false;
        child.stderr.on('data', (chunk) => {
            stderr = (stderr + chunk.toString()).slice(-4096);
        });
        const timer = setTimeout(() => {
            timedOut = true;
            child.kill('SIGKILL');
            reject(new FfmpegConversionError(`Conversion timed out after ${options.timeoutMs}ms`));
        }, options.timeoutMs);
        child.on('error', err => {
            clearTimeout(timer);
            reject(new FfmpegConversionError(`Could not run ffmpeg: ${err instanceof Error ? err.message : String(err)}`));
        });
        child.on('close', code => {
            clearTimeout(timer);
            if (timedOut)
                return;
            if (code !== 0) {
                reject(new FfmpegConversionError(`ffmpeg exited with code ${code}`, stderr.trim()));
                return;
            }
            resolve();
        });
    });
}
async function probeFfmpeg(ffmpegPath, timeoutMs = 5_000) {
    try {
        await execute(['-version'], { ffmpegPath, timeoutMs, maxOutputBytes: 0 });
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=ffmpeg.js.map