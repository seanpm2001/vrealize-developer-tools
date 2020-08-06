"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Events = exports.ActionRuntime = exports.ActionType = void 0;
var ActionType;
(function (ActionType) {
    ActionType["UNKNOWN"] = "unknown";
    ActionType["VRO"] = "vro";
    ActionType["ABX"] = "abx";
})(ActionType = exports.ActionType || (exports.ActionType = {}));
var ActionRuntime;
(function (ActionRuntime) {
    ActionRuntime["UNKNOWN"] = "unknown";
    ActionRuntime["VRO_NODEJS_12"] = "node:12";
    ActionRuntime["VRO_POWERCLI_11_PS_62"] = "powercli:11-powershell-6.2";
    ActionRuntime["VRO_PYTHON_37"] = "python:3.7";
    ActionRuntime["ABX_NODEJS"] = "nodejs";
    ActionRuntime["ABX_POWERSHELL"] = "powershell";
    ActionRuntime["ABX_PYTHON"] = "python";
})(ActionRuntime = exports.ActionRuntime || (exports.ActionRuntime = {}));
var Events;
(function (Events) {
    Events["COMPILE_START"] = "compileStart";
    Events["COMPILE_END"] = "compileEnd";
    Events["COMPILE_ERROR"] = "compileError";
    Events["DEPENDENCIES_START"] = "dependenciesStart";
    Events["DEPENDENCIES_END"] = "dependenciesEnd";
    Events["DEPENDENCIES_ERROR"] = "dependenciesError";
    Events["BUNDLE_START"] = "bundleStart";
    Events["BUNDLE_END"] = "bundleEnd";
    Events["BUNDLE_ERROR"] = "bundleError";
})(Events = exports.Events || (exports.Events = {}));
