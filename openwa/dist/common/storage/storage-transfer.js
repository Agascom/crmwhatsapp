"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExportStream = createExportStream;
exports.importFromStream = importFromStream;
const archiver_1 = require("archiver");
const tar = __importStar(require("tar-stream"));
const zlib_1 = require("zlib");
const stream_1 = require("stream");
const DEFAULT_IMPORT_MAX_BYTES = 200 * 1024 * 1024;
const DEFAULT_IMPORT_MAX_ENTRIES = 100_000;
function positiveIntFromEnv(name, fallback) {
    const parsed = Number.parseInt(process.env[name] ?? '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
async function createExportStream(listFiles, getFile, logger) {
    const files = await listFiles();
    const output = new stream_1.PassThrough();
    const archive = new archiver_1.TarArchive({
        gzip: true,
        gzipOptions: { level: 6 },
    });
    archive.on('error', (err) => {
        logger.error('Export archive failed', String(err));
        output.destroy(err);
    });
    archive.pipe(output);
    for (const file of files) {
        try {
            const data = await getFile(file);
            archive.append(data, { name: file });
        }
        catch (error) {
            logger.warn(`Failed to export file: ${file}`, { error: String(error) });
        }
    }
    archive.finalize().catch(() => undefined);
    return output;
}
async function importFromStream(inputStream, putFile, logger) {
    let importedCount = 0;
    let entryCount = 0;
    const maxEntryBytes = positiveIntFromEnv('STORAGE_IMPORT_MAX_BYTES', DEFAULT_IMPORT_MAX_BYTES);
    const maxEntries = positiveIntFromEnv('STORAGE_IMPORT_MAX_ENTRIES', DEFAULT_IMPORT_MAX_ENTRIES);
    const extract = tar.extract();
    const gunzip = (0, zlib_1.createGunzip)();
    return new Promise((resolve, reject) => {
        let settled = false;
        const fail = (err) => {
            if (settled)
                return;
            settled = true;
            extract.destroy();
            gunzip.destroy();
            inputStream.destroy();
            reject(err);
        };
        gunzip.on('error', (err) => {
            logger.error('Import failed (gzip)', String(err));
            fail(err);
        });
        inputStream.on('error', (err) => {
            logger.error('Import failed (input)', String(err));
            fail(err);
        });
        extract.on('entry', (header, stream, next) => {
            if (settled) {
                stream.resume();
                return;
            }
            if (++entryCount > maxEntries) {
                stream.resume();
                fail(new Error(`Import aborted: archive exceeds the ${maxEntries}-entry limit`));
                return;
            }
            const chunks = [];
            let entryBytes = 0;
            let entryAborted = false;
            stream.on('data', (chunk) => {
                if (entryAborted || settled)
                    return;
                entryBytes += chunk.length;
                if (entryBytes > maxEntryBytes) {
                    entryAborted = true;
                    stream.resume();
                    fail(new Error(`Import aborted: entry "${header.name}" exceeds the ${maxEntryBytes}-byte per-entry cap`));
                }
                else {
                    chunks.push(chunk);
                }
            });
            stream.on('end', () => {
                if (entryAborted || settled)
                    return;
                const data = Buffer.concat(chunks);
                putFile(header.name, data)
                    .then(() => {
                    importedCount++;
                    logger.debug(`Imported file: ${header.name}`);
                    next();
                })
                    .catch((error) => {
                    logger.error(`Failed to import file: ${header.name}`, String(error));
                    next();
                });
            });
            stream.resume();
        });
        extract.on('finish', () => {
            if (settled)
                return;
            settled = true;
            logger.log(`Import completed: ${importedCount} files`);
            resolve(importedCount);
        });
        extract.on('error', (err) => {
            logger.error('Import failed', String(err));
            fail(err);
        });
        inputStream.pipe(gunzip).pipe(extract);
    });
}
//# sourceMappingURL=storage-transfer.js.map