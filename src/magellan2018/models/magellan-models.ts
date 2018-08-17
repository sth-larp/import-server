import { System } from "../../interfaces/model";
import { SpaceSuit } from "./space-suit";
import { AliceBaseModel } from "../../interfaces/deus-model";

export interface MagellanModelBase extends AliceBaseModel {
    systems: System[];
}

export interface HumanModel extends MagellanModelBase {
    profileType: "human";
    planet?: string; // Родная локация
    spaceSuit: SpaceSuit;
    isTopManager: boolean;
}

export interface MiceModel extends MagellanModelBase {
    profileType: "mice";
    spaceSuit: SpaceSuit;
}

export interface XenomorphModel extends MagellanModelBase {
    profileType: "xenomorph";
}

export type MagellanModel = HumanModel | MiceModel | XenomorphModel;

export interface XenomorphsQrPrintData {
    planetCode: string;
    className: string;
    speciesIndex: number;
    accountIdCode: string;
    diseaseCode: string;
    description: string;
}

export type MagellanPill = SimpleQr;

export interface SpaceSuit extends SimpleQr {
    id: string;
}

export interface Reactive extends SimpleQr {
    power: number;
    id: string;
}

export interface SimpleQr {
    payload: string;
    title: string;
}
