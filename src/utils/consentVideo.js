const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

/**
 * Compress on the server when ffmpeg is available, including camera uploads
 * from browsers that ignore MediaRecorder bitrate hints. Falls back to the
 * original video when ffmpeg is unavailable or produces a larger file.
 */
async function compressConsentVideo(file) {
    if (!file?.path || !file?.filename) return file;
    const source = file.path;
    const outputName = `${path.parse(file.filename).name}-small.mp4`;
    const output = path.join(path.dirname(source), outputName);
    const args = [
        '-hide_banner', '-loglevel', 'error', '-y', '-i', source,
        '-vf', 'scale=320:-2,fps=12', '-c:v', 'libx264', '-preset', 'veryfast',
        '-crf', '39', '-c:a', 'aac', '-b:a', '24k',
        '-movflags', '+faststart', output,
    ];
    try {
        const code = await new Promise(resolve => {
            const child = spawn('ffmpeg', args, { stdio: 'ignore' });
            const timer = setTimeout(() => child.kill('SIGKILL'), 45000);
            child.on('error', () => { clearTimeout(timer); resolve(-1); });
            child.on('close', result => { clearTimeout(timer); resolve(result); });
        });
        if (code === 0) {
            const [original, converted] = await Promise.all([fs.stat(source), fs.stat(output)]);
            if (converted.size > 0 && converted.size < original.size) {
                await fs.unlink(source);
                return { ...file, path: output, filename: outputName, size: converted.size, mimetype: 'video/mp4' };
            }
        }
    } catch (error) {
        console.warn('Optional consent compression skipped:', error.message);
    }
    await fs.unlink(output).catch(() => {});
    return file;
}

module.exports = { compressConsentVideo };
