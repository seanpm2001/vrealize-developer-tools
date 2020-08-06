"use strict";
/*
 * Command line interface entrypoint. This module servers the purpose of loading
 * and interracting with the packager from command line.
 */
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
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const command_line_args_1 = __importDefault(require("command-line-args"));
const logger_1 = __importDefault(require("./lib/logger"));
const util_1 = __importDefault(require("util"));
const packager_1 = require("./packager");
const cliOpts = [
    { name: "verbose", alias: "x", type: Boolean, defaultValue: false },
    { name: "version", type: Boolean, defaultValue: false },
    { name: "help", alias: "h", type: Boolean, defaultValue: false },
    { name: "projectDir", alias: "p", type: String, defaultValue: path_1.default.resolve('.') },
    { name: "outDir", alias: "o", type: String, defaultValue: path_1.default.resolve('.', 'out') },
    { name: "bundleName", alias: "b", type: String, defaultValue: path_1.default.resolve('.', 'dist', 'bundle.zip') },
    { name: "vroTree", type: String, defaultValue: path_1.default.resolve('.', 'dist', 'vro') },
    { name: "skipVroTree", type: Boolean, defaultValue: false },
    { name: "env", alias: "e", type: String, defaultValue: null },
];
const input = command_line_args_1.default(cliOpts, { stopAtFirstUnknown: true });
const logger = logger_1.default(input.verbose);
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        logger.debug(`Parsed Inputs: ${util_1.default.inspect(input)}`);
        if (input._unknown) {
            logger.error(`Unexpected option: ${input._unknown}`);
            printUsage();
            return;
        }
        if (input.help) {
            printVersion();
            printUsage();
            return;
        }
        if (input.version) {
            printVersion();
            return;
        }
        const packager = new packager_1.Packager({
            bundle: input.bundleName,
            workspace: input.projectDir,
            out: input.outDir,
            vro: input.vroTree,
            skipVro: input.skipVroTree,
            env: input.env,
        });
        yield packager.packageProject();
        logger.info('Package successfully created');
    });
}
/**
 * Print the tool version
 */
function printVersion() {
    const packageJsonPath = path_1.default.join(__dirname, "../package.json");
    if (fs_extra_1.default.existsSync(packageJsonPath)) {
        const packageConfig = fs_extra_1.default.readJSONSync(packageJsonPath);
        logger.info(`Version ${packageConfig.version}`);
    }
}
/**
 * Print help
 */
function printUsage() {
    const usageFilePath = path_1.default.join(__dirname, "../Usage.txt");
    if (fs_extra_1.default.existsSync(usageFilePath)) {
        const usageText = fs_extra_1.default.readFileSync(usageFilePath).toString();
        logger.info(usageText);
    }
}
run();
