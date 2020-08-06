import { Logger } from "winston";
import { PackagerOptions, BundleFileset } from "../lib/model";
export interface IStrategy {
    packageProject(): Promise<void>;
}
export declare abstract class BaseStrategy implements IStrategy {
    protected readonly logger: Logger;
    protected readonly options: PackagerOptions;
    protected readonly phaseCb: Function;
    protected readonly DEPENDENCY_TEMP_DIR: string;
    constructor(logger: Logger, options: PackagerOptions, phaseCb: Function);
    protected zipFiles(filesets: Array<BundleFileset>): Promise<void>;
    protected getHash(hashable: string): string;
    protected writeDepsHash(hashable: string): Promise<void>;
    protected readDepsHash(): Promise<string | null>;
    abstract packageProject(): Promise<void>;
}
