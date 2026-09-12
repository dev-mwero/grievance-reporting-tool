import fs from 'fs';
import path from 'path';

// This module is compiled to <outputRoot>/config/static.js.
// The client build is expected at <outputRoot>/public in the cPanel bundle.
const resolvedConfigDir = path.resolve(__dirname);

// `<outputRoot>/config` -> `<outputRoot>/public`
const defaultPublicDir = path.resolve(resolvedConfigDir, '..', 'public');

const publicDir = process.env.CLIENT_DIST_DIR
  ? path.resolve(process.env.CLIENT_DIST_DIR)
  : defaultPublicDir;

export const clientPublicDir = publicDir;

export function hasClientBuild(): boolean {
  try {
    return fs.existsSync(path.join(publicDir, 'index.html'));
  } catch {
    return false;
  }
}
