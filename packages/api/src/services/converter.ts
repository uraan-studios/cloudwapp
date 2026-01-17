import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';

// Configure ffmpeg path
console.log("FFmpeg Path from static:", ffmpegPath);
if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
} else {
    console.warn("FFmpeg binary not found!");
}

export const convertToOgg = async (inputPath: string): Promise<string> => {
    if (!ffmpegPath) return inputPath; // Fallback if no ffmpeg

    const outputPath = inputPath.replace(/\.[^.]+$/, '.ogg'); // Change extension to .ogg

    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .toFormat('ogg')
            .audioCodec('libopus')
            .audioChannels(1)
            .audioBitrate('16k')
            .on('end', async () => {
                console.log(`Conversion finished: ${outputPath}`);
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error('Conversion error: ', err);
                reject(err);
            })
            .save(outputPath);
    });
};
