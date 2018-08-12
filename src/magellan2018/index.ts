import { ConversionResults } from "../alice-model-converter";
import { CharacterParser } from "../character-parser";
import { MagellanModelConverter } from "./model-converter";
import { EconProvider } from "../providers/econ-provider";
import { Provider } from "../providers/interface";
import { NpcCreator } from "../interfaces/npc-creator";
import { MagellanModel } from "./models/magellan-models";
import { MiceCreator } from "./mice-creator";

export class MagellanGame  {
   
    public convertAliceModel (character: CharacterParser): ConversionResults<MagellanModel> {
        const converter = new MagellanModelConverter(character);
        return converter.convert();
    }

    public getAfterConversionProviders() : Provider<MagellanModel>[] {
        return [new EconProvider()];
    }

    public getNpcProviders() : NpcCreator<MagellanModel>[] {
        return [new MiceCreator(1000)];
    }
}