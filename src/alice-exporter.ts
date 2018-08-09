import { Observable } from "rxjs/Rx";
import * as PouchDB from "pouchdb";
import * as winston from "winston";
import * as clones from "clones";

import { config } from "./config";
import { JoinCharacterDetail } from "./join-importer";
import { JoinMetadata } from "./join-importer";

import { DeusEvent } from "./interfaces/events";
import { saveObject } from "./helpers";
import { CharacterParser } from "./character-parser";
import { AliceAccount } from "./interfaces/alice-account";
import { DeusModel } from "./interfaces/deus-model";
import { convertAliceModel } from "./alice-model-converter";

export interface INameParts {
    firstName: string;
    nicName: string;
    lastName: string;
    fullName: string;
}

export class AliceExporter {

    public model: DeusModel = new DeusModel();
    public account?: AliceAccount;

    public conversionProblems: string[] = [];

    private con: any = null;
    private accCon: any = null;
    private eventsCon: any = null;

    private eventsToSend: DeusEvent[] = [];

    private character: CharacterParser;

    constructor(character: JoinCharacterDetail,
                metadata: JoinMetadata,
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

        this.character = new CharacterParser(character, metadata);

        this.createModel();
    }

    public export(): Promise<any> {

        if (!this.model) {
            winston.warn(`Character(${this.character.characterId}) not converted. Reasons: ${this.conversionProblems.join("; ")}`);
            return Promise.resolve();
        }

        winston.info(`Will export converted Character(${this.model._id})`);

        const results: any = {
            clearEvents: null,
            account: null,
            model: null,
            saveEvents: null,
        };

        const refreshEvent = {
            characterId: this.model._id,
            eventType: "_RefreshModel",
            timestamp: this.model.timestamp + 100,
            data: {},
        };

        if (this.eventsToSend.length) {
            refreshEvent.timestamp = this.eventsToSend[this.eventsToSend.length - 1].timestamp + 100;
        }

        this.eventsToSend.push(refreshEvent);

        let oldModel = Observable
        .fromPromise(this.con.get(this.model._id))
        .catch((err) => {
            winston.info(`Model doesnt exist`, err);
            return Observable.of(null);
        });

        if (this.ignoreInGame) {
            winston.info(`Ovveride inGame flag for id=${this.model._id}`);
            oldModel = Observable.of(null);
        }

        const thisModel = Observable.of(this.model);

        return Observable.zip(thisModel, oldModel, (a, b) => [a, b])
            // ===== Проверка InGame для для случая обновления ==============================
            .filter(([, o]: [DeusModel, DeusModel | null]) => {
                if (o && o.inGame) {
                    winston.info(`Character model ${this.model._id} already in game!`);
                    return false;
                }
                return true;
            })

            .map(([thisM,]) => thisM)

            .flatMap(() => this.clearEvents())
            .do((result) => results.clearEvents = result.length)

            .flatMap(() => saveObject(this.con, this.model, this.isUpdate))
            .do((result) => results.model = result.ok ? "ok" : "error")

            .flatMap(() =>
                this.eventsToSend.length ? this.eventsCon.bulkDocs(this.eventsToSend) : Observable.from([[]]))
            .do((result: any) => results.saveEvents = result.length)

            .flatMap(() => {
                if (this.account) {
                    winston.debug(`Providing account for character ${this.account._id}`)
                    return saveObject(this.accCon, this.account, this.isUpdate);
                } else {
                    winston.warn(`Cannot provide account for Character(${this.model._id})`);
                    return Promise.resolve(false);
                }
            })
            .do((result) => results.account = result.ok ? "ok" : "error")

            .map(() => results)
            .toPromise();

    }

    /**
     * Очистка очереди события для данного персонажа (если они были)
     */
    public clearEvents(): Observable<any> {
        const selector = {
            selector: { characterId: this.model._id },
            limit: 10000,
        };

        return Observable.from(this.eventsCon.find(selector))
            .flatMap((result: any) => {
                return this.eventsCon.bulkDocs(
                    result.docs.map((x) => {
                        const x2 = clones(x);
                        x2._deleted = true;
                        return x2;
                    }),
                );
            });
    }

    private createModel() {
        const result = convertAliceModel(this.character);
        this.model = result.model;
        this.account = result.account;
        this.conversionProblems = result.problems;
    }
}
