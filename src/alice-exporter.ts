import { Observable } from 'rxjs/Rx';
import * as moment from "moment";
import * as PouchDB from 'pouchdb';
import * as request from 'request-promise-native';
import * as chance from 'chance';
import * as winston from 'winston';
import * as uuid from 'uuid/v4';
import * as clones from 'clones';

import { ImportStats, ImportRunStats } from './stats';
import { config } from './config';
import { JoinCharacterDetail, JoinData, JoinFieldInfo, JoinFieldMetadata, JoinFieldValue, JoinGroupInfo, JoinMetadata } from './join-importer'
import { joinValues, insuranceSourceIT } from './join-import-tables';

import { DeusModel, MindData } from './interfaces/model';
import { DeusModifier } from './interfaces/modifier';
import { DeusCondition } from './interfaces/condition';
import { DeusEffect } from './interfaces/effect';
import { DeusEvent } from './interfaces/events';
import { mindModelData } from './mind-model-stub';
import { CatalogsLoader } from './catalogs-loader';
import { saveObject } from './helpers'

const PHYS_SYSTEMS_NUMBER = 6;

interface IAliceAccount {
    _id: string;
    _rev?: string;
    password: string;
    login: string;
}

export interface INameParts {
    firstName: string,
    nicName: string,
    lastName: string,
    fullName: string
};


export class AliceExporter {
    private con: any = null;
    private accCon: any = null;
    private eventsCon: any = null;


    private chance: Chance.SeededChance;
    public model: DeusModel = new DeusModel();

    private eventsToSend: DeusEvent[] = [];

    public account: IAliceAccount = { _id: "", password: "", login: "" };

    constructor(private character: JoinCharacterDetail,
        private metadata: JoinMetadata,
        private catalogs: CatalogsLoader,
        public isUpdate: boolean = true,
        public ignoreInGame: boolean = false) {

        const ajaxOpts = {
            auth: {
                username: config.username,
                password: config.password
            }
        };

        this.con = new PouchDB(`${config.url}${config.modelDBName}`, ajaxOpts);
        this.accCon = new PouchDB(`${config.url}${config.accountDBName}`, ajaxOpts);
        this.eventsCon = new PouchDB(`${config.url}${config.eventsDBName}`, ajaxOpts);

        this.chance = new chance(character.CharacterId);

        this.createModel();
    }

    export(): Promise<any> {
        
        if (!this.model._id) {
            return Promise.reject(`AliceExporter.export(): ${this.character._id} Incorrect model ID or problem in conversion!`);
        }

        winston.info(`Will export converted Character(${this.model._id})`);

        let results: any = {
            clearEvents: null,
            account: null,
            model: null,
            saveEvents: null
        };

        let refreshEvent = {
            characterId: this.model._id,
            eventType: "_RefreshModel",
            timestamp: this.model.timestamp + 100,
            data: {}
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

        if(this.ignoreInGame){
            winston.info(`Ovveride inGame flag for id=${this.model._id}`);
            oldModel = Observable.of(null);
        }

        let thisModel = Observable.of(this.model);

        return Observable.zip(thisModel, oldModel, (a, b) => [a, b])
            // ===== Проверка InGame для для случая обновления ==============================
            .filter(([thisModel, oldModel]: [DeusModel, DeusModel | null]) => {
                if (oldModel && oldModel.inGame) {
                    winston.info(`Character model ${this.model._id} already in game!`);
                    return false;
                }
                return true;
            })

            .map(([thisModel, oldModel]) => thisModel)

//            .flatMap(() => this.clearEvents())
//            .do(result => results.clearEvents = result.length)

            .flatMap(() => saveObject(this.con, this.model, this.isUpdate))
            .do(result => results.model = result.ok ? "ok" : "error")

//            .flatMap(() => this.eventsToSend.length ? this.eventsCon.bulkDocs(this.eventsToSend) : Observable.from([[]]))
//            .do((result: any) => results.saveEvents = result.length)

            .flatMap(() => (this.account.login && this.account.password) ? saveObject(this.accCon, this.account, this.isUpdate) : Promise.resolve(false))
            .do(result => results.account = result.ok ? "ok" : "error")

            .map(result => results)
            .toPromise();

    }

    /**
     * Очистка очереди события для данного персонажа (если они были)
     */
    clearEvents(): Observable<any> {
        let selector = {
            selector: { characterId: this.model._id },
            sort: [{ characterId: "desc" },
            { timestamp: "desc" }],
            limit: 10000
        };

        return Observable.from(this.eventsCon.find(selector))
            .flatMap((result: any) => {
                return this.eventsCon.bulkDocs(
                    result.docs.map((x) => {
                        let x2 = clones(x);
                        x2._deleted = true
                        return x2;
                    })
                );
            })
    }

    private createModel() {
        try {
            winston.info(`Try to convert model id=${this.character.CharacterId}`);

            this.model.timestamp = Date.now();

            //ID Alice. CharacterId
            this.model._id = this.character.CharacterId.toString();
            this.account._id = this.model._id;

            //Персонаж жив
            this.model.isAlive = true;

            //Состояние "в игре"
            this.model.inGame = this.character.InGame;

            //Login (e-mail). Field: 1905
            //Защита от цифрового логина
            this.model.login =  "t" + this.model._id; //this.findStrFieldValue(1905).split("@")[0].toLowerCase();

            if (!this.model.login.match(/^[\w\#\$\-\*\&\%\.]{4,30}$/i) || this.model.login.match(/^\d+$/i)) {
                winston.warn(`ERROR: can't convert id=${this.character.CharacterId} incorrect login=\"${this.model.login}\"`);
                //this.model._id = "";
                //return;
                this.model.login = "";
            }

            this.account.login = this.model.login;

            if (this.model.login) {
                this.model.mail = this.model.login + "@alice.digital";
            } else {
                this.model.mail = "";
            }

            //Password. 
            this.account.password = this.findStrFieldValue(3630);

            //Установить имя песрнажа. 
            this.setFullName(2786);

            //Локация  
            this.model.planet = this.findStrFieldValue(2787);

            this.setGenome();
            winston.info(`Character(${this.character.CharacterId}) was converted`, this.model, this.account);

        } catch (e) {
            winston.info(`Error in converting model id=${this.character.CharacterId}: ` + e);
            this.model._id = "";
        }
    }

    public static joinStrFieldValue(character: JoinCharacterDetail,
        fieldID: number,
        convert: boolean = false): string {

        const field = character.Fields.find(fi => fi.ProjectFieldId == fieldID);

        if (!field) return "";

        if (!convert) {
            return field.DisplayString.trim();
        } else {
            return joinValues.hasOwnProperty(field.Value) ? joinValues[field.Value] : "";
        }
    }
    public static joinNumFieldValue(character: JoinCharacterDetail,
        fieldID: number): number {

        const field = character.Fields.find(fi => fi.ProjectFieldId == fieldID);

        if (field) {
            let value: number = Number.parseInt(field.Value);
            if (!Number.isNaN(value)) {
                return value;
            }
        }

        return Number.NaN;
    }

    //Возвращается DisplayString поля, или ""
    //Если convert==true, то тогда возращается выборка по Value из таблицы подставновки
    findStrFieldValue(fieldID: number, convert: boolean = false): string {
        return AliceExporter.joinStrFieldValue(this.character, fieldID, convert);
    }

    //Возвращается Value, которое должно быть цифровым или Number.NaN
    findNumFieldValue(fieldID: number): number {
        return AliceExporter.joinNumFieldValue(this.character, fieldID);
    }

    //Возвращается Value, которое должно булевым. 
    //Если значение поля "on" => true, иначе false
    findBoolFieldValue(fieldID: number): boolean {
        let text = AliceExporter.joinStrFieldValue(this.character, fieldID, false);
        return (text == 'on');
    }

    //Возвращается Value, которое должно быть списком цифр, разделенных запятыми
    //Если в списке встретится что-то не цифровое, в массиве будет Number.NaN
    findNumListFieldValue(fieldID: number): number[] {
        const field = this.character.Fields.find(fi => fi.ProjectFieldId == fieldID);

        if (field) {
            return field.Value.split(',').map(el => Number.parseInt(el));
        }

        return [];
    }

    //Конвертирует числовое ID значения поля мультивыбора в Description для этого значения
    //при конвертации убирает HTML-теги
    convertToDescription(fieldID: number, variantID: number): string {
        let field = this.metadata.Fields.find(f => f.ProjectFieldId == fieldID);

        if (field && field.ValueList) {

            let value = field.ValueList.find(fv => fv.ProjectFieldVariantId == variantID);
            if (value && value.Description) {
                return value.Description.replace(/\<(.*?)\>/ig, '')
            }
        }

        return null;
    }

    //Создает значение поля Геном для модели. 
    setGenome() {
        this.model.systems =  [
            {
              "value": 1,
              "nucleotide": 0,
              "lastModified": 0
            },
            {
              "value": 1,
              "nucleotide": 0,
              "lastModified": 0
            },
            {
              "value": -1,
              "nucleotide": 0,
              "lastModified": 0
            },
            {
              "value": 1,
              "nucleotide": 0,
              "lastModified": 0
            },
            {
              "value": 0,
              "nucleotide": 0,
              "lastModified": 0
            },
            {
              "value": 1,
              "nucleotide": 0,
              "lastModified": 0
            },
            {
              "value": 1,
              "nucleotide": 0,
              "lastModified": 0
            }
          ];
    }

    setFullName(fullNameFieldNumber: number) {
        const name = this.findStrFieldValue(fullNameFieldNumber);
        let nameParts: INameParts = AliceExporter.parseFullName(name);

        this.model.firstName = nameParts.firstName;
        this.model.nicName = nameParts.nicName;
        this.model.lastName = nameParts.lastName;
    }

    //Установить имя песрнажа. Field: 496
    public static parseFullName(name: string): INameParts {
        let ret: INameParts = {
            firstName: "",
            nicName: "",
            lastName: "",
            fullName: name
        };

        let parts = name.match(/^(.*?)\s\"(.*?)\"\s(.*)$/i);

        //Формат имени Имя "Ник" Фамилия
        if (parts) {
            ret.firstName = parts[1];
            ret.nicName = parts[2];
            ret.lastName = parts[3];
            return ret;
        }

        //Формат имени Имя "Ник"
        parts = name.match(/^(.*?)\s\"(.*?)\"\s*$/i);

        if (parts) {
            ret.firstName = parts[1];
            ret.nicName = parts[2];
            ret.lastName = "";
            return ret;
        }

        //Формат имени Имя Фамилия
        parts = name.match(/^(.*?)\s(.*)$/i);

        if (parts) {
            ret.firstName = parts[1];
            ret.lastName = parts[2];
            ret.nicName = "";
            return ret;
        }

        //Формат имени - только имя
        ret.firstName = name;
        ret.nicName = "";
        ret.lastName = "";

        return ret;
    }
}   
