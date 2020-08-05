/*!
 * Copyright 2018-2019 VMware, Inc.
 * SPDX-License-Identifier: MIT
 */

export interface MavenProfilesMap {
    [id: string]: MavenProfile
}

export interface MavenProfile extends Partial<Record<MavenProfileKeys, string>> {
    id: string
}

type MavenProfileKeys = VroProfileKeys | VraProfileKeys | VraNgProfileKeys
type VroProfileKeys = "vro.host" | "vro.port" | "vro.username" | "vro.password" | "vro.auth" | "vro.tenant"
type VraProfileKeys = "vra.host" | "vra.port" | "vra.username" | "vra.password" | "vra.tenant"
type VraNgProfileKeys = "vrang.org.id" | "vrang.project.id"
