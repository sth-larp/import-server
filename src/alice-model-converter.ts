import { CharacterParser } from "./character-parser";
import { AliceAccount } from "./interfaces/alice-account";

import * as winston from "winston";
import { AliceBaseModel } from "./interfaces/deus-model";

export interface ConversionResults<Model extends AliceBaseModel> {
    problems: string[];
    model: Model;
    account: AliceAccount;
}

export function createEmptyAliceModel() {
    return {
        conditions: [],
        changes: [],
        messages: [],
        modifiers: [],
        timers: [],
        _rev: undefined,
        timestamp: Date.now(),
    };
}

export abstract class AliceModelConverter<Model extends AliceBaseModel> {
    public conversionProblems: string[] = [];
    constructor(
        protected character: CharacterParser,
    ) {

    }

    public convert() : ConversionResults<Model> {
        try {
            const result = this.convertModelImpl();
            return {
                problems: this.conversionProblems,
                ...result,
            };
        } catch (e) {
            this.conversionProblems.push("Error in converting model " + e);
        }

        if (this.conversionProblems.length > 0)
        {
            return {model: undefined, account: undefined, problems:  this.conversionProblems};
        }
    }

    private convertModelImpl () {
        if (!this.character.isActive)
        {
            this.conversionProblems.push("Not active character");
            return;
        }
        winston.info(`Try to convert model id=${this.character.characterId}`);

        const base: AliceBaseModel = this.createBaseModel();

        const { model, account }: { model: Model; account: AliceAccount; } = this.convertSpecifics(base);

        return {model, account};
    }

    protected abstract convertSpecifics(base: AliceBaseModel); 

    private createBaseModel(): AliceBaseModel {
        return {
            ...createEmptyAliceModel(),
            _id: this.character.characterId.toString(),
            login: this.getLogin(),
            isAlive: true,
            inGame: this.character.inGame,
            ...this.getFullName(this.getNameFieldId()),
        };
    }

    protected abstract getNameFieldId(): number;

    private getLogin() {
        // Защита от цифрового логина
        const login =  this.character.joinStrFieldValue(3631) || ("user" + this.character.characterId);

        if (!login.match(/^[\w\#\$\-\*\&\%\.]{3,30}$/i) || login.match(/^\d+$/i)) {
            this.conversionProblems.push(`Incorrect login ${login}`);
        }

        return login;
    }

    private getFullName(fullNameFieldNumber: number) {
        const name = this.character.joinStrFieldValue(fullNameFieldNumber);
        const parts = this.parseFullName(name);
        return { 
            firstName: parts.firstName, 
            nicName: parts.nicName, 
            lastName: parts.lastName 
        };
    }

    // Установить имя песрнажа.
    private parseFullName(name: string) {
        const ret = {
            firstName: "",
            nicName: "",
            lastName: "",
            fullName: name,
        };

        let parts = name.match(/^(.*?)\s\"(.*?)\"\s(.*)$/i);

        // Формат имени Имя "Ник" Фамилия
        if (parts) {
            ret.firstName = parts[1];
            ret.nicName = parts[2];
            ret.lastName = parts[3];
            return ret;
        }

        // Формат имени Имя "Ник"
        parts = name.match(/^(.*?)\s\"(.*?)\"\s*$/i);

        if (parts) {
            ret.firstName = parts[1];
            ret.nicName = parts[2];
            ret.lastName = "";
            return ret;
        }

        // Формат имени Имя Фамилия
        parts = name.match(/^(.*?)\s(.*)$/i);

        if (parts) {
            ret.firstName = parts[1];
            ret.lastName = parts[2];
            ret.nicName = "";
            return ret;
        }

        // Формат имени - только имя
        ret.firstName = name;
        ret.nicName = "";
        ret.lastName = "";

        return ret;
    }
}