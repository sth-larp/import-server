import { ProvideResult } from "./interface";
import * as   request from "request-promise-native";
import { config } from "../config";
import * as winston from "winston";
import { AliceBaseModel } from "../interfaces/deus-model";
import { AliceAccount } from "../interfaces/alice-account";
import { JoinCharacterInfo } from "../join-importer";

export class EconProvider {
    public name: string = "economic account";

    public async provide(character: JoinCharacterInfo, model: AliceBaseModel, account: AliceAccount) : Promise<ProvideResult>
    {
        const body = {
            userId: account.login,
            initialBalance: 1,
        };

        try {
            await this.callEconomicServer("/economy/provision", body);
        }
        catch (e)
        {
            return {result: "problems", problems: [e] };
        }
        return {result: "success"};
    }

    public async callEconomicServer(urlPart, body)
    {
        try {
            const reqOpts = {
                url: config.econ.baseUrl + urlPart,
                method : "POST",
                auth: config.econ,
                body: body,
                timeout: config.requestTimeout,
                json: true,
            };

            await request(reqOpts);
        }
        catch (e)
        {
            winston.warn(`Error trying to call economic server`, e);
            throw e;
        }
    }
}