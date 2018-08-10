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

export type MagellanModel = HumanModel | MiceModel;