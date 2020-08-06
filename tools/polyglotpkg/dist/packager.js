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
exports.Packager = void 0;
const model_1 = require("./lib/model");
const utils_1 = require("./lib/utils");
const nodejs_1 = require("./strategies/nodejs");
const vro_1 = require("./vro");
const python_1 = require("./strategies/python");
const powershell_1 = require("./strategies/powershell");
const logger_1 = __importDefault(require("./lib/logger"));
const events_1 = require("events");
class Packager extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.options = options;
        this.logger = logger_1.default(false, options.outputStream);
    }
    packageProject() {
        return __awaiter(this, void 0, void 0, function* () {
            const actionRuntime = yield utils_1.determineRuntime(this.options.workspace, this.options.env);
            const actionType = yield utils_1.determineActionType(this.options.workspace, this.options.env);
            if (actionType === model_1.ActionType.UNKNOWN || actionRuntime === model_1.ActionRuntime.UNKNOWN) {
                throw new Error(`Unsupported action type or runtime: ${actionType} ${actionRuntime}`);
            }
            this.logger.info(`Packaging ${actionType} ${actionRuntime} action...`);
            let strategy;
            switch (actionRuntime) {
                case model_1.ActionRuntime.ABX_NODEJS:
                case model_1.ActionRuntime.VRO_NODEJS_12:
                    strategy = new nodejs_1.NodejsStrategy(this.logger, this.options, (e) => this.emit(e));
                    yield strategy.packageProject();
                    break;
                case model_1.ActionRuntime.ABX_PYTHON:
                case model_1.ActionRuntime.VRO_PYTHON_37:
                    strategy = new python_1.PythonStrategy(this.logger, this.options, (e) => this.emit(e));
                    yield strategy.packageProject();
                    break;
                case model_1.ActionRuntime.ABX_POWERSHELL:
                case model_1.ActionRuntime.VRO_POWERCLI_11_PS_62:
                    strategy = new powershell_1.PowershellStrategy(this.logger, this.options, (e) => this.emit(e));
                    strategy.packageProject();
                    break;
                default:
                    throw new Error(`Action runtime ${actionRuntime} is not yet supported`);
            }
            if (!this.options.skipVro && actionType === model_1.ActionType.VRO) {
                const tree = new vro_1.VroTree(this.logger, this.options);
                yield tree.createTree();
            }
        });
    }
}
exports.Packager = Packager;
