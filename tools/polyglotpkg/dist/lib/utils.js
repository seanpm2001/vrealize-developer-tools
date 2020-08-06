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
exports.run = exports.notUndefined = exports.getActionManifest = exports.determineActionType = exports.determineRuntime = void 0;
const globby_1 = __importDefault(require("globby"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const which_1 = __importDefault(require("which"));
const child_process_1 = require("child_process");
const model_1 = require("./model");
const logger_1 = __importDefault(require("./logger"));
const logger = logger_1.default();
/**
 * Determine the action runtime based on the action manifest or
 * the action handler if runtime is not specified.
 * @param projectPath
 */
function determineRuntime(projectPath, actionType) {
    return __awaiter(this, void 0, void 0, function* () {
        const pkg = yield getActionManifest(projectPath);
        if (actionType) {
            switch (pkg.platform.runtime) {
                case 'nodejs':
                    return actionType === model_1.ActionType.ABX ? model_1.ActionRuntime.ABX_NODEJS : model_1.ActionRuntime.VRO_NODEJS_12;
                case "powershell":
                    return actionType === model_1.ActionType.ABX ? model_1.ActionRuntime.ABX_POWERSHELL : model_1.ActionRuntime.VRO_POWERCLI_11_PS_62;
                case "python":
                    return actionType === model_1.ActionType.ABX ? model_1.ActionRuntime.ABX_PYTHON : model_1.ActionRuntime.VRO_PYTHON_37;
                default:
                    return pkg.platform.runtime;
            }
        }
        switch (pkg.platform.runtime) {
            case "nodejs":
                return pkg.vro ? model_1.ActionRuntime.VRO_NODEJS_12 : model_1.ActionRuntime.ABX_NODEJS;
            case 'powershell':
                return pkg.vro ? model_1.ActionRuntime.VRO_POWERCLI_11_PS_62 : model_1.ActionRuntime.ABX_POWERSHELL;
            case 'python':
                return pkg.vro ? model_1.ActionRuntime.VRO_PYTHON_37 : model_1.ActionRuntime.ABX_PYTHON;
            default:
                return pkg.platform.runtime;
        }
    });
}
exports.determineRuntime = determineRuntime;
/**
 * Determine the action type based on the action manifest.
 */
function determineActionType(projectPath, actionType) {
    return __awaiter(this, void 0, void 0, function* () {
        const pkg = yield getActionManifest(projectPath);
        if (actionType === model_1.ActionType.ABX) {
            return (pkg === null || pkg === void 0 ? void 0 : pkg.abx) ? model_1.ActionType.ABX : model_1.ActionType.UNKNOWN;
        }
        else if (actionType === model_1.ActionType.VRO) {
            return (pkg === null || pkg === void 0 ? void 0 : pkg.vro) ? model_1.ActionType.VRO : model_1.ActionType.UNKNOWN;
        }
        else if (pkg === null || pkg === void 0 ? void 0 : pkg.vro) {
            return model_1.ActionType.VRO;
        }
        else if (pkg === null || pkg === void 0 ? void 0 : pkg.abx) {
            return model_1.ActionType.ABX;
        }
        else {
            return model_1.ActionType.UNKNOWN;
        }
    });
}
exports.determineActionType = determineActionType;
/**
 * Return the parsed content of the project's package.
 */
function getActionManifest(projectPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const pkg = yield globby_1.default(['package.json', '!**/node_modules/**'], {
            cwd: projectPath,
            absolute: true
        });
        if (pkg.length === 0) {
            return null;
        }
        const pkgObj = yield fs_extra_1.default.readJSONSync(pkg[0]);
        return pkgObj;
    });
}
exports.getActionManifest = getActionManifest;
/**
 * Return true if the value is not undefined
 * @param x
 */
function notUndefined(x) {
    return x !== undefined;
}
exports.notUndefined = notUndefined;
/**
 * Run external command and wait for it to complete
 * @param cmd
 */
function run(cmd, args = [], cwd = process.cwd()) {
    return new Promise((resolve, reject) => {
        which_1.default(cmd, { all: true }, (err, commandPath) => {
            if (err || !commandPath) {
                return reject(new Error(`Cannot find "${cmd}"`));
            }
            const proc = child_process_1.spawn(quoteString(commandPath[0]), args, { cwd, shell: true, stdio: 'inherit' });
            proc.on('close', exitCode => {
                if (exitCode !== 0) {
                    const commandLine = `${quoteString(commandPath[0])} ${args.join(' ')}`;
                    logger.error(`Error running command: ${commandLine}`);
                    return reject(new Error(`Exit code for ${cmd}: ${exitCode}`));
                }
                resolve(exitCode);
            });
        });
    });
}
exports.run = run;
function quoteString(str) {
    return /\s+/.test(str) ? `"${str}"` : str;
}
