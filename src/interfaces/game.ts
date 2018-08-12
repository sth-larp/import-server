import { ConversionResults } from "../alice-model-converter";
import { CharacterParser } from "../character-parser";
import { Provider } from "../providers/interface";
import { NpcCreator } from "./npc-creator";
import { AliceBaseModel } from "./deus-model";

export interface GameFacade <ModelAccount extends AliceBaseModel> {
    convertAliceModel (character: CharacterParser): ConversionResults<ModelAccount>;
    getAfterConversionProviders(): Provider<ModelAccount>[];
    getNpcProviders(): NpcCreator<ModelAccount>[];
}