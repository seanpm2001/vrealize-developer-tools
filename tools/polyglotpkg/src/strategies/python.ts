import fs from 'fs-extra';
import path from 'path';
import globby from 'globby';

import { Logger } from "winston";
import { BaseStrategy } from "./base";
import { getActionManifest, run } from "../lib/utils";
import { PackagerOptions, PlatformDefintion, Events } from "../lib/model";

export class PythonStrategy extends BaseStrategy {

    constructor(logger: Logger, options: PackagerOptions, phaseCb: Function) { super(logger, options, phaseCb) }

    /**
     * package project into bundle
     */
    async packageProject() {
        const packageJson = await getActionManifest(this.options.workspace) as PlatformDefintion;
        this.phaseCb(Events.COMPILE_START);
        await this.compile(path.join(this.options.workspace, 'src'), this.options.out);
        this.phaseCb(Events.COMPILE_END);
        this.phaseCb(Events.DEPENDENCIES_START);
        await this.installDependencies();
        this.phaseCb(Events.DEPENDENCIES_END);
        this.phaseCb(Events.BUNDLE_START);
        await this.createBundle(this.options.workspace, packageJson);
        this.phaseCb(Events.BUNDLE_END);
    }

    private async createBundle(workspaceFolderPath: string, packageJson: PlatformDefintion): Promise<void> {
        const patterns = ['package.json'];

        if (Array.isArray(packageJson.files) && packageJson.files.length > 0) {
            patterns.push(...packageJson.files);
        } else {
            patterns.push('!.*', '*.py');
            const outDir = path.relative(workspaceFolderPath, this.options.out);
            patterns.push(`${outDir}/**`);
        }

        const filesToBundle = await globby(patterns, {
            cwd: workspaceFolderPath,
            absolute: true
        });

        const depsToBundle = await globby(`${this.DEPENDENCY_TEMP_DIR}/**`, {
            cwd: this.DEPENDENCY_TEMP_DIR,
            absolute: true,
        });

        this.logger.info(`Packaging ${filesToBundle.length + depsToBundle.length} files into bundle ${this.options.bundle}...`);
        const actionBase = packageJson.platform.base ? path.resolve(path.join(workspaceFolderPath, packageJson.platform.base)) : workspaceFolderPath;
        this.logger.info(`Action base: ${actionBase}`);
        await this.zipFiles([
            { files: filesToBundle, baseDir: actionBase },
            { files: depsToBundle, baseDir: this.DEPENDENCY_TEMP_DIR },
        ]);
    }

    private async compile(source: string, destination: string) {
        this.logger.info(`Compiling project...`);
        await fs.copy(source, destination);
        this.logger.info(`Compilation complete`);
    }

    private async installDependencies() {
        const depsManifest = path.join(this.options.workspace, 'requirements.txt');
        const deps = await fs.readFile(depsManifest);
        const hash = this.getHash(deps.toString());
        const existingHash = await this.readDepsHash();
        if (existingHash !== hash) {
            this.logger.info("Installing dependencies...");
            await run('pip3', ['install', '-r', `'${depsManifest}'`, '--target', `'${this.DEPENDENCY_TEMP_DIR}'`, '--upgrade']);
            await this.writeDepsHash(deps.toString());
        } else {
            this.logger.info("No change in dependencies. Skipping installation...");
        }
    }

}
