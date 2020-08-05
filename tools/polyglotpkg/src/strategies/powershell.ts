import fs from 'fs-extra';
import path from 'path';
import globby from 'globby';

import { Logger } from "winston";
import { BaseStrategy } from "./base";
import { getActionManifest } from "../lib/utils";
import { PackagerOptions, PlatformDefintion, Events } from "../lib/model";

export class PowershellStrategy extends BaseStrategy {

    constructor(logger: Logger, options: PackagerOptions, phaseCb: Function) { super(logger, options, phaseCb) }

    /**
     * package project into bundle
     */
    async packageProject() {

        const packageJson = await getActionManifest(this.options.workspace) as PlatformDefintion;
        this.phaseCb(Events.COMPILE_START);
        await this.compile(path.join(this.options.workspace, 'src'), this.options.out);
        this.phaseCb(Events.COMPILE_END);
        // TODO: install dependencies
        this.phaseCb(Events.BUNDLE_START);
        await this.createBundle(this.options.workspace, packageJson);
        this.phaseCb(Events.BUNDLE_END);
    }

    private async createBundle(workspaceFolderPath: string, packageJson: PlatformDefintion): Promise<void> {
        const patterns = ['package.json'];

        if (Array.isArray(packageJson.files) && packageJson.files.length > 0) {
            patterns.push(...packageJson.files);
        } else {
            patterns.push('!.*', '*.ps1');
            const outDir = path.relative(workspaceFolderPath, this.options.out);
            patterns.push(`${outDir}/**`);
        }

        const filesToBundle = await globby(patterns, {
            cwd: workspaceFolderPath,
            absolute: true
        });

        this.logger.info(`Packaging ${filesToBundle.length} files into bundle ${this.options.bundle}...`);
        const actionBase = packageJson.platform.base ? path.resolve(packageJson.platform.base) : workspaceFolderPath;
        this.logger.info(`Action base: ${actionBase}`);
        await this.zipFiles([
            { files: filesToBundle, baseDir: actionBase }
        ]);
    }

    private async compile(source: string, destination: string) {
        this.logger.info(`Compiling project...`);
        await fs.copy(source, destination);
        this.logger.info(`Compilation complete`);
    }

}
