import { AliceBaseModel } from "./deus-model";
import { AliceAccount } from "./alice-account";

export interface Npc<T extends AliceBaseModel> {
    model: T;
    account: AliceAccount;
}

export interface NpcCreator<T extends AliceBaseModel> {
    name: string;
    generate(firstId: number): Array<Npc<T>>;
    count(): number;
}
