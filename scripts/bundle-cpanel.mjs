#!/usr/bin/env node
/**
 * Bundle script for cPanel (and single-folder) deployment.
 *
 * Assembles a self-contained deployment folder at <repo-root>/dist from the
 * compiled outputs of the shared, server, and client packages.
 *
 * Expected layout:
 *   dist/
 *   ├── package.json     # deploy package.json (server prod deps + shared file dep)
 *   ├── .env.example     # reference env file
 *   ├── server.js        # compiled server entry (from server/dist)
 *   ├── app.js, config/, middleware/, models/, modules/, ...  # from server/dist
 *   ├── shared/          # compiled shared package (index.js, dist/, package.json)
 *   └── public/          # compiled client (from client/dist)
 *
 * On cPanel: upload these contents, run `npm install --omit=dev`, configure
 * the Node app entry point to `server.js`, and set env vars.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dist = join(root, 'dist');

const serverPackage = JSON.parse(readFileSync(join(root, 'server', 'package.json'), 'utf8'));

const requiredSources = [
  join(root, 'server', 'dist', 'server.js'),
  join(root, 'client', 'dist', 'index.html'),
  join(root, 'shared', 'dist', 'index.js'),
];

for (const src of requiredSources) {
  if (!existsSync(src)) {
    console.error(`Missing build output: ${src}`);
    console.error('Run `npm run build -w shared && npm run build -w server && npm run build -w client` first.');
    process.exit(1);
  }
}

console.log('Cleaning previous bundle...');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// 1. Server compiled output -> dist/ root
console.log('Copying server build...');
cpSync(join(root, 'server', 'dist'), dist, { recursive: true });

// 2. Client build -> dist/public
console.log('Copying client build -> public/');
cpSync(join(root, 'client', 'dist'), join(dist, 'public'), { recursive: true });

// 3. Shared workspace package -> dist/shared (with its compiled dist/)
console.log('Copying shared package -> shared/');
mkdirSync(join(dist, 'shared'), { recursive: true });
cpSync(join(root, 'shared', 'package.json'), join(dist, 'shared', 'package.json'));
cpSync(join(root, 'shared', 'dist'), join(dist, 'shared', 'dist'), { recursive: true });

// 4. Deployment package.json
console.log('Writing deployment package.json...');
const deployPackage = {
  name: serverPackage.name,
  version: serverPackage.version,
  private: true,
  type: serverPackage.type,
  main: 'server.js',
  scripts: {
    start: 'node server.js',
  },
  dependencies: {
    ...serverPackage.dependencies,
    shared: 'file:./shared',
  },
};
writeFileSync(
  join(dist, 'package.json'),
  JSON.stringify(deployPackage, null, 2) + '\n'
);

// 5. Reference .env.example
console.log('Copying .env.example...');
cpSync(join(root, '.env.example'), join(dist, '.env.example'));

// 6. Minimal README for the deploy folder
writeFileSync(
  join(dist, 'README-DEPLOY.md'),
  [
    '# cPanel Deployment',
    '',
    '1. Upload the contents of this folder to your Node.js app directory.',
    '2. Run `npm install --omit=dev` (creates node_modules and links `shared`).',
    '3. Configure the cPanel Node.js app:',
    '   - Application entry point: `server.js`',
    '   - Environment variables from `.env.example` (set `MONGODB_URI`, JWT secrets, `NODE_ENV=production`).',
    '   - Node version: 18+',
    '4. Restart the Node.js app.',
    '',
    'The same Express server serves the React client at `/` and the API at `/api/*`.',
    '',
  ].join('\n')
);

console.log('\n✅ Bundle created at ' + dist);
console.log('\nNext steps: upload the contents of dist/ to cPanel, then run:');
console.log('  npm install --omit=dev');
console.log('\nConfigure the Node app entry point to "server.js" and set env vars (see README-DEPLOY.md).');
