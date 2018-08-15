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

export interface MagellanPill {
    payload: string;
    title: string;
}

export interface SpaceSuit {
    payload: string;
    id: string;
}

export interface Reactive {
    power: number;
    id: string;
}

export interface SimpleQr {
    payload: string;
    title: string;
}
