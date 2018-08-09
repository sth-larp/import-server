import { System } from "../../interfaces/model";
import { SpaceSuit } from "./SpaceSuit";
import { AliceBaseModel } from "../../interfaces/deus-model";

export interface MagellanModel extends AliceBaseModel {
    firstName: string; // имя
    nicName?: string; // ник-нейм
    lastName?: string; // фамилия
    planet?: string; // Родная локация
    profileType: string;
    systems: System[];
    spaceSuit: SpaceSuit;
    isTopManager: boolean;
}