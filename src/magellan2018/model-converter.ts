import { CharacterParser } from "../character-parser";
import { MagellanModel, HumanModel } from "./models/magellan-models";
import { AliceAccount } from "../interfaces/alice-account";

import { Professions, TradeUnions, Company } from "../interfaces/model";
import { AliceBaseModel } from "../interfaces/deus-model";
import { AliceModelConverter } from "../alice-model-converter";

export class MagellanModelConverter extends AliceModelConverter<MagellanModel> {
    public conversionProblems: string[] = [];

    constructor(character: CharacterParser) {
        super(character);
    }

    protected getNameFieldId(): number {
        return 2786;
    }

    protected convertSpecifics(base: AliceBaseModel)  {
        const model: HumanModel = {
            ...base,
            spaceSuit: this.getSpaceSuit(),
            ...this.getPlanetAndGenome(2787),
            profileType: "human",
            isTopManager: this.getCompanyAccess().some((company) => company.isTopManager),
        };
        const account: AliceAccount = {
            _id: model._id,
            login: model.login,
            password: this.character.joinStrFieldValue(3630) || "0000",
            professions: this.getProfessions(),
            companyAccess: this.getCompanyAccess(),
            jobs: {
                tradeUnion: this.getTradeUnionMembership(),
                companyBonus: this.getCompanies(),
            }
        };
        return { model, account };
    }

    private getCompanies() {
        const companies : Company[] = [];

        const checkAccess  = (g, companyName) => {
            if (this.character.partOfGroup(g))
            {
                companies.push(companyName);
            }    
        }

        checkAccess(8492, "gd");
        checkAccess(8495, "pre");
        checkAccess(8497, "kkg");
        checkAccess(8498, "mat");
        checkAccess(8499, "mst");

        return companies;

    }

    private getCompanyAccess() {
        return this.getCompanies().map(
            company => {
                return {companyName: company, isTopManager: this.character.partOfGroup(9906)};
            }
        )
    }

    private getPlanetAndGenome(planetFieldId: number) {
        // Локация
        if (!this.character.joinStrFieldValue(planetFieldId)) {
            this.conversionProblems.push(`Missing required field homeworld (${planetFieldId})`);
        }
        else {
            const planet = this.character.joinStrFieldValue(planetFieldId);
            const nucleotides = 
            this.character.joinFieldProgrammaticValue(planetFieldId)
            .split(" ", 7)
            .map((sp) => Number.parseInt(sp, 10));

            const systems = createSystemsFromNucleotides(nucleotides);

        return {planet, systems};
        }
    }

    private getSpaceSuit() {
        return {
            on: false,
            oxygenCapacity: 0,
            timestampWhenPutOn: 0,
            diseases: [],
        };
    }

    private getTradeUnionMembership(): TradeUnions {
        const field = (f) => this.character.hasFieldValue(3438, f);

        const group = (g) => this.character.partOfGroup(g);

        return {
            isBiologist: group(8489) || field(3448),
            isCommunications: group(8486) || field(3445),
            isEngineer: group(8488) || field(3447),
            isNavigator: group(8446) || field(3444),
            isPilot: group(8445) || field(3443),
            isPlanetolog: group(3449) || field(3449),
            isSupercargo: group(8487) || field(3446),
        };
    }

    private getProfessions(): Professions {
        const field = (f) => this.character.hasFieldValue(3438, f);

        const group = (g) => this.character.partOfGroup(g);

        return {
            ...this.getTradeUnionMembership(),
            isIdelogist: group(8556),
            isJournalist: field(3450),
            isSecurity: group(9907),
            isTopManager: group(9906),
            isManager: group(8491),
        };
    }
}

export function createSystemsFromNucleotides(nucleotides: number[]) {
    if (nucleotides.length != 7)
    {
        throw new Error("Incorrect nucleotides count");
    }
    const systems = [];
    nucleotides.forEach((element, index) => {
        systems[index] = { value: 0, nucleotide: element, lastModified: 0, present: true };
    });
    return systems;
}
