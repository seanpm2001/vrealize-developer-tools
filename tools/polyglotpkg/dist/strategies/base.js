"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseStrategy = void 0;
const adm_zip_1 = __importDefault(require("adm-zip"));
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const crypto_1 = __importDefault(require("crypto"));
class BaseStrategy {
    constructor(logger, options, phaseCb) {
        this.logger = logger;
        this.options = options;
        this.phaseCb = phaseCb;
        this.DEPENDENCY_TEMP_DIR = path_1.default.join(path_1.default.resolve(options.workspace), 'tmp');
    }
    zipFiles(filesets) {
        return __awaiter(this, void 0, void 0, function* () {
            const zip = new adm_zip_1.default();
            filesets.forEach(fileset => {
                const { files: filesToBundle, baseDir } = fileset;
                for (var i = 0; i < filesToBundle.length; i++) {
                    const filePath = filesToBundle[i];
                    const zipPath = path_1.default.dirname(path_1.default.relative(baseDir, filePath));
                    zip.addLocalFile(filePath, zipPath);
                    this.logger.debug(`Packaged: ${filePath}`);
                }
            });
            yield fs_extra_1.default.ensureDir(path_1.default.dirname(this.options.bundle));
            zip.writeZip(this.options.bundle);
            this.logger.info(`Created ${this.options.bundle}`);
        });
    }
    getHash(hashable) {
        return crypto_1.default.createHash('sha256').update(hashable).digest('hex');
    }
    writeDepsHash(hashable) {
        return __awaiter(this, void 0, void 0, function* () {
            const hash = this.getHash(hashable);
            const file = path_1.default.join(this.DEPENDENCY_TEMP_DIR, 'deps.sha256');
            yield fs_extra_1.default.writeFile(file, hash, { encoding: 'utf-8' });
        });
    }
    readDepsHash() {
        return __awaiter(this, void 0, void 0, function* () {
            const file = path_1.default.join(this.DEPENDENCY_TEMP_DIR, 'deps.sha256');
            const exists = yield fs_extra_1.default.pathExists(file);
            if (exists) {
                return yield fs_extra_1.default.readFile(file, 'utf-8');
            }
            else {
                return null;
            }
        });
    }
}
exports.BaseStrategy = BaseStrategy;
