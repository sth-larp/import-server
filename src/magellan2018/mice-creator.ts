import { MagellanModel, MiceModel } from "./models/magellan-models";
import { createEmptyAliceModel } from "../alice-model-converter";
import { createSystemsFromNucleotides, getSpaceSuit } from "./model-converter";
import { Npc } from "../interfaces/npc-creator";
import { AliceAccount } from "../interfaces/alice-account";

export class MiceCreator {
    public name = "mice";

    constructor(
        private num: number,
    ) {

    }

    public count() {return this.num; }

    public generate(firstId: number): Array<Npc<MagellanModel>> {
        const result = [];
        for (let index = firstId; index < firstId + this.num; index++) {
            result.push (createMice(index));
        }
        return result;
    }
}
function createMice(index: number) {
    const systems = createSystemsFromNucleotides(new Array(7).fill(0));
    const mice: MiceModel = {
        ...createEmptyAliceModel(),
        spaceSuit: getSpaceSuit(),
        _id: index.toString(),
        login: "mice" + index,
        profileType: "mice",
        systems,
        isAlive: true,
        inGame: true,
        firstName: "Микки",
        nicName: "Мышь",
        lastName: "Маус",
    };
    const account: AliceAccount = {
        _id: index.toString(),
        login: mice.login,
        password: "0000",
        jobs: {
            companyBonus: [],
            tradeUnion: {
                isBiologist: false,
                isCommunications: false,
                isEngineer: false,
                isNavigator: false,
                isPilot: false,
                isPlanetolog: false,
                isSupercargo: false,
            },
        },
        professions: {
            isBiologist: false,
            isCommunications: false,
            isEngineer: false,
            isIdelogist: false,
            isJournalist: false,
            isManager: false,
            isNavigator: false,
            isPilot: false,
            isPlanetolog: false,
            isSecurity: false,
            isSupercargo: false,
            isTopManager: false,
        },
        companyAccess: [],
    };
    return { model: mice, account };
}
