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
exports.NodejsStrategy = void 0;
const typescript_1 = __importDefault(require("typescript"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const globby_1 = __importDefault(require("globby"));
const base_1 = require("./base");
const utils_1 = require("../lib/utils");
const model_1 = require("../lib/model");
class NodejsStrategy extends base_1.BaseStrategy {
    constructor(logger, options, phaseCb) { super(logger, options, phaseCb); }
    /**
     * package project into bundle
     */
    packageProject() {
        return __awaiter(this, void 0, void 0, function* () {
            const tsconfigPath = path_1.default.join(this.options.workspace, "tsconfig.json");
            if (!fs_extra_1.default.existsSync(tsconfigPath)) {
                throw new Error('Could not find tsconfig.json in the project root');
            }
            this.phaseCb(model_1.Events.COMPILE_START);
            const tsconfig = this.readConfigFile(tsconfigPath);
            this.compile(tsconfigPath, tsconfig);
            this.phaseCb(model_1.Events.COMPILE_END);
            this.phaseCb(model_1.Events.DEPENDENCIES_START);
            yield this.installDependencies();
            this.phaseCb(model_1.Events.DEPENDENCIES_END);
            this.phaseCb(model_1.Events.BUNDLE_START);
            yield this.createBundle(this.options.workspace, tsconfig);
            this.phaseCb(model_1.Events.BUNDLE_END);
        });
    }
    createBundle(workspaceFolderPath, tsconfig) {
        return __awaiter(this, void 0, void 0, function* () {
            const baseDir = tsconfig.options.baseUrl || workspaceFolderPath;
            const packageJson = yield utils_1.getActionManifest(workspaceFolderPath);
            const patterns = ['package.json'];
            if (Array.isArray(packageJson.files) && packageJson.files.length > 0) {
                patterns.push(...packageJson.files);
            }
            else {
                patterns.push('!.*', '*.js');
                if (tsconfig.options.outDir) {
                    const outDir = path_1.default.relative(baseDir, tsconfig.options.outDir);
                    patterns.push(`${outDir}/**`);
                }
                if (tsconfig.options.rootDir) {
                    const rootDir = path_1.default.relative(baseDir, tsconfig.options.rootDir);
                    patterns.push(`${rootDir}/**`);
                }
            }
            const filesToBundle = yield globby_1.default(patterns, {
                cwd: workspaceFolderPath,
                absolute: true
            });
            const depsToBundle = yield globby_1.default(`${this.DEPENDENCY_TEMP_DIR}/**`, {
                cwd: this.DEPENDENCY_TEMP_DIR,
                absolute: true,
            });
            this.logger.info(`Packaging ${filesToBundle.length + depsToBundle.length} files into bundle ${this.options.bundle}...`);
            const actionBase = packageJson.platform.base ? path_1.default.resolve(packageJson.platform.base) : baseDir;
            this.logger.info(`Action base: ${actionBase}`);
            yield this.zipFiles([
                { files: filesToBundle, baseDir: actionBase },
                { files: depsToBundle, baseDir: this.DEPENDENCY_TEMP_DIR }
            ]);
        });
    }
    compile(tsconfigPath, config) {
        this.logger.info(`Compiling project ${tsconfigPath}...`);
        if (!config) {
            config = this.readConfigFile(tsconfigPath);
        }
        const program = typescript_1.default.createProgram(config.fileNames, Object.assign(Object.assign({}, config.options), { configFilePath: tsconfigPath }));
        const emitResult = program.emit();
        const diagnostics = typescript_1.default.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
        this.reportDiagnostics(diagnostics);
        this.logger.info(`Compilation complete`);
        if (diagnostics.some(val => val.category === typescript_1.default.DiagnosticCategory.Error)) {
            throw new Error('Found compilation errors');
        }
    }
    readConfigFile(tsconfigPath) {
        const configFileText = fs_extra_1.default.readFileSync(tsconfigPath).toString();
        const result = typescript_1.default.parseConfigFileTextToJson(tsconfigPath, configFileText);
        const configObject = result.config;
        if (!configObject) {
            this.reportDiagnostics([result.error]);
            throw new Error(`Could not parse ${tsconfigPath}`);
        }
        const configParseResult = typescript_1.default.parseJsonConfigFileContent(configObject, typescript_1.default.sys, path_1.default.dirname(tsconfigPath));
        const numberOfErrors = configParseResult.errors.length;
        if (numberOfErrors > 0) {
            this.reportDiagnostics(configParseResult.errors);
            throw new Error(`Found ${numberOfErrors} errors in ${tsconfigPath}`);
        }
        this.logger.info(`TS compiler options: ${JSON.stringify(configParseResult.options, null, 2)}`);
        return configParseResult;
    }
    reportDiagnostics(optionalDiagnostics) {
        const diagnostics = optionalDiagnostics.filter(utils_1.notUndefined);
        if (diagnostics.length <= 0) {
            return;
        }
        diagnostics.forEach((diagnostic) => {
            let message = `   ${typescript_1.default.DiagnosticCategory[diagnostic.category]} ts(${diagnostic.code})`;
            if (diagnostic.file && diagnostic.start) {
                let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                message += ` ${diagnostic.file.fileName} (${line + 1},${character + 1})`;
            }
            message += `: ${typescript_1.default.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`;
            this.logger.info(message);
        });
    }
    installDependencies() {
        return __awaiter(this, void 0, void 0, function* () {
            const packageJson = yield utils_1.getActionManifest(this.options.workspace);
            const deps = JSON.stringify(packageJson.dependencies);
            const hash = this.getHash(deps);
            const existingHash = yield this.readDepsHash();
            if (existingHash !== hash) {
                this.logger.info("Installing dependencies...");
                yield fs_extra_1.default.ensureDir(this.DEPENDENCY_TEMP_DIR);
                yield fs_extra_1.default.writeJSON(path_1.default.join(this.DEPENDENCY_TEMP_DIR, 'package.json'), packageJson);
                yield utils_1.run('npm', ['install', '--production'], this.DEPENDENCY_TEMP_DIR);
                yield this.writeDepsHash(deps);
            }
            else {
                this.logger.info("No change in dependencies. Skipping installation...");
            }
        });
    }
}
exports.NodejsStrategy = NodejsStrategy;
