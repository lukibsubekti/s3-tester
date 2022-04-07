import fs from 'fs';
import { join as pathJoin } from 'path';
import { startApp } from './lib/app';

const configBuf = fs.readFileSync(pathJoin(process.cwd(), 'config.json')).toString();

try {
  const config = JSON.parse(configBuf);
  startApp(config);
} catch (error) {
  console.error('Error:', error);
}