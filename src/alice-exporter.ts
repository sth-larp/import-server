import { Observable } from "rxjs";
import * as PouchDB from "pouchdb";
import * as winston from "winston";
import * as clones from "clones";

import { config } from "./config";

import { DeusEvent } from "./interfaces/events";
import { saveObject } from "./helpers";
import { AliceBaseModel } from "./interfaces/deus-model";
import { AliceAccount } from "./interfaces/alice-account";

export class AliceExporter<Model extends AliceBaseModel> {
    private con: any = null;
    private accCon: any = null;
    private eventsCon: any = null;

    private eventsToSend: DeusEvent[] = [];

    constructor(
                private model: Model,
                private account: AliceAccount,
                public isUpdate: boolean = true,
                public ignoreInGame: boolean = false) {

        const ajaxOpts = {
            auth: {
                username: config.username,
                password: config.password,
            },

            timeout: 6000 * 1000,
        };

        this.con = new PouchDB(`${config.url}${config.modelDBName}`, ajaxOpts);
        this.accCon = new PouchDB(`${config.url}${config.accountDBName}`, ajaxOpts);
        this.eventsCon = new PouchDB(`${config.url}${config.eventsDBName}`, ajaxOpts);
    }

    // tslint:disable-next-line:member-ordering
    public async export(): Promise<boolean> {

        const {model, account } = this;

        winston.info(`Will export converted Character(${model._id})`);

        const results: any = {
            clearEvents: null,
            account: null,
            model: null,
            saveEvents: null,
        };

        const refreshEvent = {
            characterId: model._id,
            eventType: "_RefreshModel",
            timestamp: model.timestamp + 100,
            data: {},
        };

        if (this.eventsToSend.length) {
            refreshEvent.timestamp = this.eventsToSend[this.eventsToSend.length - 1].timestamp + 100;
        }

        this.eventsToSend.push(refreshEvent);

        const oldModel = await this.getOldModel(model._id);
        const thisModel = Observable.of(model);

        if (oldModel && oldModel.inGame) {
            winston.info(`Character model ${model._id} already in game!`);
            return false;
        }

        results.clearEvents = await this.clearEvents(model._id);

        results.model = (await saveObject(this.con, model, this.isUpdate)).ok ? "ok" : "error";

        if (this.eventsToSend.length) {
            const result =  await this.eventsCon.bulkDocs(this.eventsToSend);
            results.saveEvents = result.length;
        }

        if (account) {
                    winston.info(`Providing account for character ${account._id}`);
                    results.account = (await saveObject(this.accCon, account, this.isUpdate)).ok ? "ok" : "error";
                } else {
                    winston.info(`Skip providing account for Character(${model._id})`);
                    results.account = "skip";
                }
        winston.info(`Exported model and account for character ${model._id}`, results);

        return true;
    }

    /**
     * Очистка очереди события для данного персонажа (если они были)
     */
    public async clearEvents(id: string): Promise<any> {
        const selector = {
            selector: { characterId: id },
            limit: 10000,
        };

        const result = await this.eventsCon.find(selector);
        return await this.eventsCon.bulkDocs(
                    result.docs.map((x) => {
                        const x2 = clones(x);
                        x2._deleted = true;
                        return x2;
                    }),
                );
    }

    private async getOldModel(id: string): Promise<Model | null> {
        if (this.ignoreInGame) {
            winston.info(`Override inGame flag for id=${id}`);
            return null;
        }
        try {
            return await this.con.get(id);
        } catch (err) {
            winston.info(`Model doesnt exist`, err);
            return null;
        }
    }
}
