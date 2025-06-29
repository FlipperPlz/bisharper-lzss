#!/usr/bin/env bun

import { $ } from 'bun';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// @ts-ignore
const ROOT_DIR = import.meta.dir + '/..';
const DIST_DIR = join(ROOT_DIR, 'dist');

async function ensureDir(dir: string) {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

async function buildWasm() {
    console.log('🔨 Building WASM module...');

    try {
        await $`cd ${ROOT_DIR} && zig build wasm`;
        console.log('✅ WASM build complete');
    } catch (error) {
        console.error('❌ WASM build failed:', error);
        process.exit(1);
    }
}

async function buildTypeScript() {
    console.log('🔨 Building TypeScript...');

    try {
        // Build JavaScript bundles
        await $`cd ${ROOT_DIR} && bun build js/index.ts --outdir dist --target node --target browser --format esm --splitting --minify`;

        // Generate TypeScript declarations
        await $`cd ${ROOT_DIR} && tsc --emitDeclarationOnly --outDir dist`;

        console.log('✅ TypeScript build complete');
    } catch (error) {
        console.error('❌ TypeScript build failed:', error);
        process.exit(1);
    }
}

async function copyAssets() {
    console.log('📋 Copying assets...');

    try {
        // Copy package.json with modified fields for distribution
        const originalPkg = await Bun.file(join(ROOT_DIR, 'package.json')).json();
        const { devDependencies, scripts, ...pkg } = originalPkg;
        await Bun.write(join(DIST_DIR, 'package.json'), JSON.stringify(pkg, null, 2));


        // Copy README and LICENSE
        if (existsSync(join(ROOT_DIR, 'README.md'))) {
            await $`cp ${join(ROOT_DIR, 'README.md')} ${join(DIST_DIR, 'README.md')}`;
        }

        if (existsSync(join(ROOT_DIR, 'LICENSE'))) {
            await $`cp ${join(ROOT_DIR, 'LICENSE')} ${join(DIST_DIR, 'LICENSE')}`;
        }

        console.log('✅ Assets copied');
    } catch (error) {
        console.error('❌ Asset copying failed:', error);
    }
}

async function validateBuild() {
    console.log('🔍 Validating build...');

    const requiredFiles = [
        'bisharper.wasm',
        'index.js',
        'index.d.ts',
        'package.json'
    ];

    for (const file of requiredFiles) {
        const filePath = join(DIST_DIR, file);
        if (!existsSync(filePath)) {
            console.error(`❌ Missing required file: ${file}`);
            process.exit(1);
        }
    }

    console.log('✅ Build validation passed');
}

async function main() {
    console.log('🚀 Starting build process...');

    const startTime = Date.now();

    // Ensure dist directory exists
    await ensureDir(DIST_DIR);

    // Run build steps
    await buildWasm();
    await buildTypeScript();
    await copyAssets();
    await validateBuild();

    const duration = Date.now() - startTime;
    console.log(`🎉 Build completed successfully in ${duration}ms`);
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--wasm-only')) {
    buildWasm();
} else if (args.includes('--ts-only')) {
    buildTypeScript();
} else if (args.includes('--clean')) {
    console.log('🧹 Cleaning build directory...');
    // @ts-ignore
    await $`rm -rf ${DIST_DIR}`;
    console.log('✅ Clean complete');
} else {
    main().catch((error) => {
        console.error('💥 Build failed:', error);
        process.exit(1);
    });
}