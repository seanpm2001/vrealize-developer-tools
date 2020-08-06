import { Logger } from "winston";
import { PackagerOptions } from "./lib/model";
/**
 * Create vRO tree structure that can be later converted to a vRO package
 */
export declare class VroTree {
    private readonly logger;
    private readonly options;
    private readonly treeDir;
    private readonly scriptModuleDir;
    private readonly DEFAULT_VERSION;
    private readonly DEFAULT_MEMORY_LIMIT_MB;
    private readonly DEFAULT_TIMEOUT_SEC;
    constructor(logger: Logger, options: PackagerOptions);
    createTree(): Promise<void>;
    private generatePOM;
    private generateAction;
    private generateMeta;
    private generateTags;
    private copyBundle;
    private getId;
}
