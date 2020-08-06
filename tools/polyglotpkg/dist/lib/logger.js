"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
let logger;
const streams = [];
function createLogger(verbose = false, outputStream) {
    if (!logger) {
        logger = winston_1.default.createLogger({
            level: verbose ? 'debug' : 'info',
            format: winston_1.default.format.json(),
            transports: [
                new winston_1.default.transports.Console({
                    format: winston_1.default.format.simple()
                }),
            ]
        });
    }
    if (outputStream && !streams.includes(outputStream)) {
        logger.add(new winston_1.default.transports.Stream({
            stream: outputStream,
            format: winston_1.default.format.simple(),
        }));
        streams.push(outputStream);
    }
    return logger;
}
exports.default = createLogger;
