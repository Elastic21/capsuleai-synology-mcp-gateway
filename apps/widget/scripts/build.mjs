import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'public', 'cg-console-widget.html');
const distDir = path.join(root, 'dist');
const target = path.join(distDir, 'cg-console-widget.html');

await mkdir(distDir, { recursive: true });
await copyFile(source, target);
console.log(`Copied widget template to ${target}`);
