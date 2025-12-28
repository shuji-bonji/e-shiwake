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
	await sharp(svg)
		.resize(size, size)
		.png()
		.toFile(join(__dirname, `../static/icon-${size}x${size}.png`));

	console.log(`Generated icon-${size}x${size}.png`);
}

console.log('All icons generated successfully!');
