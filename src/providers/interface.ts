import { JoinCharacterInfo } from "../join-importer";
import { AliceBaseModel } from "../interfaces/deus-model";
import { AliceAccount } from "../interfaces/alice-account";

export interface ProvideSuccess {
    result: "success";
}

export interface ProvideNothing {
    result: "nothing";
}
export interface ProvideProblems {
    result: "problems";
    problems: string[];
}

export type ProvideResult = ProvideSuccess | ProvideNothing | ProvideProblems;

export interface Provider<Model extends AliceBaseModel> {
    name: string;
    provide(character: JoinCharacterInfo, model: Model, account: AliceAccount): Promise<ProvideResult>;
}