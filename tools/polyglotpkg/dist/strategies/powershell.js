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
exports.PowershellStrategy = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const globby_1 = __importDefault(require("globby"));
const base_1 = require("./base");
const utils_1 = require("../lib/utils");
const model_1 = require("../lib/model");
class PowershellStrategy extends base_1.BaseStrategy {
    constructor(logger, options, phaseCb) { super(logger, options, phaseCb); }
    /**
     * package project into bundle
     */
    packageProject() {
        return __awaiter(this, void 0, void 0, function* () {
            const packageJson = yield utils_1.getActionManifest(this.options.workspace);
            this.phaseCb(model_1.Events.COMPILE_START);
            yield this.compile(path_1.default.join(this.options.workspace, 'src'), this.options.out);
            this.phaseCb(model_1.Events.COMPILE_END);
            // TODO: install dependencies
            this.phaseCb(model_1.Events.BUNDLE_START);
            yield this.createBundle(this.options.workspace, packageJson);
            this.phaseCb(model_1.Events.BUNDLE_END);
        });
    }
    createBundle(workspaceFolderPath, packageJson) {
        return __awaiter(this, void 0, void 0, function* () {
            const patterns = ['package.json'];
            if (Array.isArray(packageJson.files) && packageJson.files.length > 0) {
                patterns.push(...packageJson.files);
            }
            else {
                patterns.push('!.*', '*.ps1');
                const outDir = path_1.default.relative(workspaceFolderPath, this.options.out);
                patterns.push(`${outDir}/**`);
            }
            const filesToBundle = yield globby_1.default(patterns, {
                cwd: workspaceFolderPath,
                absolute: true
            });
            this.logger.info(`Packaging ${filesToBundle.length} files into bundle ${this.options.bundle}...`);
            const actionBase = packageJson.platform.base ? path_1.default.resolve(packageJson.platform.base) : workspaceFolderPath;
            this.logger.info(`Action base: ${actionBase}`);
            yield this.zipFiles([
                { files: filesToBundle, baseDir: actionBase }
            ]);
        });
    }
    compile(source, destination) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.info(`Compiling project...`);
            yield fs_extra_1.default.copy(source, destination);
            this.logger.info(`Compilation complete`);
        });
    }
}
exports.PowershellStrategy = PowershellStrategy;
