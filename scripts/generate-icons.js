import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const svgPath = join(__dirname, '../static/favicon.svg');
const svg = readFileSync(svgPath);

const sizes = [192, 512];

for (const size of sizes) {
	const outputPath = join(__dirname, `../static/icon-${size}x${size}.png`);
	await sharp(svg).resize(size, size).png().toFile(outputPath);
	console.log(`Generated: icon-${size}x${size}.png`);
}

console.log('Done!');
