import * as moment from "moment";
import * as request from "request-promise-native";
import * as winston from "winston";

import { config } from "./config";
import { DeusModel } from "./interfaces/model";

export interface JoinCharacter {
    CharacterId: number;
    UpdatedAt?: string;
    IsActive?: boolean;
    CharacterLink: string;
}

export interface JoinGroupInfo {
    CharacterGroupId: number;
    CharacterGroupName: string;
}

export interface JoinFieldInfo {
    ProjectFieldId: number;
    FieldName?: string;
    Value: string;
    DisplayString: string;
}

export interface JoinCharacterDetail {
    CharacterId: number;
    UpdatedAt: string;
    IsActive: boolean;
    InGame: boolean;
    BusyStatus: string;
    Groups: JoinGroupInfo[];
    AllGroups: JoinGroupInfo[];
    Fields: JoinFieldInfo[];
    PlayerUserId: string;
    _id?: string;
    _rev?: string;
    model?: DeusModel;
    finalInGame?: boolean;
}

export interface JoinFieldValue {
    ProjectFieldVariantId: number;
    Label: string;
    IsActive: boolean;
    Description: string;
    ProgrammaticValue: string;
}

export interface JoinFieldMetadata {
    FieldName: string;
    ProjectFieldId: number;
    IsActive: boolean;
    FieldType: string;
    ValueList: JoinFieldValue[];
}

export interface JoinMetadata {
    ProjectId: number;
    ProjectName: string;
    Fields: JoinFieldMetadata[];
    _id?: string;
    _rev?: string;
}

export interface JoinData {
    characters: JoinCharacterDetail[];
    metadata: JoinMetadata;
}

export class JoinImporter {

    public static createJoinCharacter(id: number): JoinCharacter {
        return {
            CharacterId: id,
            CharacterLink: `${config.joinCharactersBasePath}/${id}/`,
        };
    }

    public accessToken = "";

    public metadata: JoinMetadata;

    constructor() {}

    public init(): Promise<boolean> {
         // Get token
        const reqOpts: any = {
            url: config.joinTokenUrl,
            method : "POST",
            form: {
                grant_type: "password",
                username: config.joinrpg.login,
                password: config.joinrpg.password,
            },
            timeout: config.requestTimeout,
            json : true,
        };

        return request(reqOpts).then( (result: any) => {
            winston.info(`Received access token!`);
            this.accessToken = result.access_token;
            return true;
        });
    }

    public getCharacterList(modifiedSince: moment.Moment ): Promise<JoinCharacter[]> {
        const reqOpts = {
            url: config.joinListUrl,
            qs : {
                modifiedSince: modifiedSince.format("YYYY-MM-DD") + "T" +  modifiedSince.format("HH:mm:00.000"),
            },
            method : "GET",
            auth : {
                bearer : this.accessToken,
            },
            timeout: config.requestTimeout,
            json : true,
        };
        return request(reqOpts);
    }

    public getCharacter(CharacterLink: string): Promise<JoinCharacterDetail> {
        const reqOpts = {
            url: config.joinBaseUrl + CharacterLink,
            method : "GET",
            auth : {
                bearer : this.accessToken,
            },
            timeout: config.requestTimeout,
            json : true,
        };

        return request(reqOpts);
    }

    public getCharacterByID(id: string): Promise<JoinCharacterDetail> {
        const url = `${config.joinCharactersBasePath}/${id}/`;
        return this.getCharacter(url);
    }

    public getMetadata(): Promise<JoinMetadata> {
         const reqOpts = {
            url: config.joinMetaUrl,
            method : "GET",
            auth : {
                bearer : this.accessToken,
            },
            timeout: config.requestTimeout,
            json : true,
        };

         return request(reqOpts).then( (m: JoinMetadata) => {this.metadata = m; return m; });
    }

}
