/// <reference types="node" />
import { PackagerOptions } from "./lib/model";
import { EventEmitter } from 'events';
export declare class Packager extends EventEmitter {
    private readonly options;
    private readonly logger;
    constructor(options: PackagerOptions);
    packageProject(): Promise<void>;
}
