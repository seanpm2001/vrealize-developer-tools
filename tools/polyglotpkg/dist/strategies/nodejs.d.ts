import { Logger } from "winston";
import { BaseStrategy } from "./base";
import { PackagerOptions } from "../lib/model";
export declare class NodejsStrategy extends BaseStrategy {
    constructor(logger: Logger, options: PackagerOptions, phaseCb: Function);
    /**
     * package project into bundle
     */
    packageProject(): Promise<void>;
    private createBundle;
    private compile;
    private readConfigFile;
    private reportDiagnostics;
    private installDependencies;
}
