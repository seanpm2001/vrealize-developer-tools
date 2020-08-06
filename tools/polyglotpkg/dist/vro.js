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
exports.VroTree = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const utils_1 = require("./lib/utils");
const xmlbuilder2_1 = require("xmlbuilder2");
/**
 * Create vRO tree structure that can be later converted to a vRO package
 */
class VroTree {
    constructor(logger, options) {
        this.logger = logger;
        this.options = options;
        this.DEFAULT_VERSION = '1.0.0';
        this.DEFAULT_MEMORY_LIMIT_MB = 64;
        this.DEFAULT_TIMEOUT_SEC = 180;
        this.treeDir = options.vro;
        this.scriptModuleDir = path_1.default.join(this.options.vro, 'src', 'main', 'resources', 'ScriptModule');
    }
    createTree() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.info('Creating vRO tree structure...');
            const actionDefintion = yield utils_1.getActionManifest(this.options.workspace);
            // create structure
            yield fs_extra_1.default.ensureDir(this.scriptModuleDir);
            yield this.generatePOM(actionDefintion);
            yield this.generateAction(actionDefintion);
            yield this.generateMeta(actionDefintion);
            yield this.generateTags(actionDefintion);
            yield this.copyBundle(actionDefintion);
        });
    }
    generatePOM(actionDefintion) {
        return __awaiter(this, void 0, void 0, function* () {
            const content = {
                project: {
                    '@xmlns': 'http://maven.apache.org/POM/4.0.0',
                    '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                    '@xsi:schemaLocation': 'http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd',
                    modelVersion: '4.0.0',
                    groupId: actionDefintion.vro.module,
                    artifactId: actionDefintion.platform.action,
                    version: actionDefintion.version || this.DEFAULT_VERSION,
                    packaging: 'package',
                }
            };
            const doc = xmlbuilder2_1.create({ version: '1.0', encoding: 'UTF-8' }, content);
            const xml = doc.end({ prettyPrint: true });
            yield fs_extra_1.default.writeFile(path_1.default.join(this.treeDir, 'pom.xml'), xml);
        });
    }
    generateAction(actionDefintion) {
        return __awaiter(this, void 0, void 0, function* () {
            const runtime = yield utils_1.determineRuntime(this.options.workspace, this.options.env);
            const content = {
                'dunes-script-module': Object.assign({ '@name': actionDefintion.platform.action, '@result-type': actionDefintion.vro.outputType, '@api-version': '6.0.0', '@id': this.getId(actionDefintion), '@version': (actionDefintion.version || this.DEFAULT_VERSION).replace('-SNAPSHOT', ''), '@allowed-operations': 'vfe', '@memory-limit': (actionDefintion.platform.memoryLimitMb || this.DEFAULT_MEMORY_LIMIT_MB) * 1024 * 1024, '@timeout': actionDefintion.platform.timeoutSec || this.DEFAULT_TIMEOUT_SEC, description: { '$': actionDefintion.description || '' }, runtime: { '$': runtime }, 'entry-point': { '$': actionDefintion.platform.entrypoint } }, (actionDefintion.vro.inputs && { param: Object.entries(actionDefintion.vro.inputs).map(([inputName, inputType]) => ({
                        '@n': inputName,
                        '@t': inputType
                    })) }))
            };
            const doc = xmlbuilder2_1.create({ version: '1.0', encoding: 'UTF-8' }, content);
            const xml = doc.end({ prettyPrint: true });
            yield fs_extra_1.default.writeFile(path_1.default.join(this.scriptModuleDir, `${actionDefintion.platform.action}.xml`), xml);
        });
    }
    generateMeta(actionDefintion) {
        return __awaiter(this, void 0, void 0, function* () {
            const content = {
                'properties': {
                    comment: 'UTF-16',
                    entry: [
                        { '@key': 'categoryPath', '#': actionDefintion.vro.module, },
                        { '@key': 'type', '#': 'ScriptModule', },
                        { '@key': 'id', '#': this.getId(actionDefintion), },
                    ]
                }
            };
            // TODO: generate doctype:
            // <!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">
            const doc = xmlbuilder2_1.create({ version: '1.0', encoding: 'UTF-8', standalone: false }, content);
            const xml = doc.end({ prettyPrint: true });
            yield fs_extra_1.default.writeFile(path_1.default.join(this.scriptModuleDir, `${actionDefintion.platform.action}.element_info.xml`), xml);
        });
    }
    generateTags(actionDefintion) {
        return __awaiter(this, void 0, void 0, function* () {
            const content = {
                'tags': {
                    tag: (actionDefintion.platform.tags || []).map(t => ({ '@name': t, '@global': true }))
                }
            };
            const doc = xmlbuilder2_1.create({ version: '1.0', encoding: 'UTF-8' }, content);
            const xml = doc.end({ prettyPrint: true });
            yield fs_extra_1.default.writeFile(path_1.default.join(this.scriptModuleDir, `${actionDefintion.platform.action}.tags.xml`), xml);
        });
    }
    copyBundle(actionDefintion) {
        return __awaiter(this, void 0, void 0, function* () {
            const source = this.options.bundle;
            const dest = path_1.default.join(this.scriptModuleDir, `${actionDefintion.platform.action}.bundle.zip`);
            yield fs_extra_1.default.copyFile(source, dest);
        });
    }
    getId(actionDefintion) {
        return actionDefintion.vro.id || uuid_1.v5(`${actionDefintion.vro.module}:${actionDefintion.platform.action}`, uuid_1.v5.DNS);
    }
}
exports.VroTree = VroTree;
