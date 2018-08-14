import { Observable } from "rxjs/Rx";
import * as PouchDB from "pouchdb";
import * as winston from "winston";
import * as google from "googleapis";
import * as parse from "csv-parse/lib/sync";
import * as fs from "fs";

import { config } from "../config";
import { saveObject } from "../helpers";

import * as loaders from "./loaders";
import { System } from "../interfaces/model";
import { createEmptyAliceModel } from "../alice-model-converter";

import * as rp from "request-promise";

import stringify = require("csv-stringify/lib/sync");
import { configureLogger } from "../logger";
import { AliceBaseModel } from "../interfaces/deus-model";
import { MagellanModel } from "../magellan2018/models/magellan-models";

interface XenomorphsQrPrintData {
    planetCode: string;
    className: string;
    speciesIndex: number;
    accountIdCode: string;
    diseaseCode: string;
    description: string;
}

async function accountIdCode(id: string): Promise<string> {
    const r = await rp.get(
        `${config.qrServer.baseUrl}/encode?type=100&kind=1&validUntil=1680601600&payload=${id}`,
        { json: true });
    return r.content;
}

async function getDiseaseCode(values: number[], power: number): Promise<string> {
    const seq = [...values, power];
    const stringifiedSeq = seq.join(",");
    const r = await rp.get(
        `${config.qrServer.baseUrl}/encode?type=9&kind=1&validUntil=1680601600&payload=${stringifiedSeq}`,
        { json: true });
    return r.content;
}

function sleeper(ms) {
    return (x) =>  new Promise((resolve) => setTimeout(() => resolve(x), ms));
}

export class TablesImporter {

    private readonly numberOfSystems = 7;
    private readonly con: PouchDB.Database<any>;

    private classNames = [
        "Одноклеточные",
        "Растения",
        "Грибы",
        "Членистоногие",
        "Моллюски",
        "Черви",
        "Рыбы",
        "Рептилии",
        "Птицы",
        "Млекопитающие",
    ];

    private readonly systemsPresence = [
        [0, 0, 1, 1, 0, 0, 1], // Одноклеточные
        [0, 0, 0, 1, 1, 0, 1], // Растения
        [0, 0, 0, 1, 1, 1, 1], // Грибы
        [1, 1, 1, 0, 0, 0, 1], // Членистоногие
        [1, 1, 0, 1, 1, 1, 1], // Моллюски
        [1, 0, 0, 0, 0, 0, 1], // Черви
        [1, 0, 1, 1, 1, 1, 1], // Рыбы
        [1, 1, 1, 0, 1, 1, 1], // Рептилии
        [1, 1, 1, 1, 1, 1, 1], // Птицы
        [1, 1, 1, 1, 1, 1, 1], // Млекопитающие
    ];

    constructor() {
        const ajaxOpts = {
            auth: {
                username: config.username,
                password: config.password,
            },

            timeout: 6000 * 1000,
        };

        this.con = new PouchDB(`${config.url}${config.workModelDBName}`, ajaxOpts);
    }

    public authorize(): Promise<any> {
        return new Promise((resolve, reject) => {
            google.auth.getApplicationDefault((err, authClient) => {
                if (err) { return reject(err); }

                if (authClient.createScopedRequired && authClient.createScopedRequired()) {
                    const scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
                    authClient = authClient.createScoped(scopes);
                }

                resolve(authClient);
            });
        });
    }

    public import(): Observable<TablesImporter> {
        const promise = async () => {
            const authClient = await this.authorize();
            winston.info("Authorization success!");

            const data = await loaders.xenomorphsDataLoad(authClient);

            let rowIndex = 0;
            for (const line of data.values) {
                await this.handleLine(line, rowIndex);
                rowIndex++;
            }

            return this;
        };

        return Observable.fromPromise(promise());
    }

    private splitCell(value: string, planet: string): number[] {
        const result = value.split(" ").map(Number);
        if (result.length !== this.numberOfSystems) {
            winston.error(`Incorrect cell value ${value} for planet ${planet} expected 7 numbers: `);
        }
        return result;
    }

    private assertMatch(values: number[], mask: number[], planet: string) {
        for (let i = 0; i < this.numberOfSystems; ++i) {
            if (values[i] !== 0 && mask[i] === 0) {
                winston.error(
                    `Value is present for missing system in planet ${planet}. values=${values}, mask=${mask}`);
            }
        }
    }

    private async handleLine(line: string[], rowIndex: number): Promise<any> {
        const planet = line[0].replace("SN: ", "");
        if (planet.length === 0) {
                return;
            }
        const xenomorphsQrData: XenomorphsQrPrintData[] = [];
        winston.info(`Processing planet ${planet}`);
        for (let i = 0; i < this.systemsPresence.length; ++i) {
            const className = this.classNames[i];
            const columnOffset = 9 * i;
            const [
                    nucleotideString,
                    description,
                    ex1,
                    ex2,
                    ex3,
                    ex4,
                    ex5,
                    diseasePowerString,
                    diseaseValuesString,
                ] = line.slice(columnOffset + 1, columnOffset + 1 + 9);
            const examples = [ex1, ex2, ex3, ex4, ex5];
            if (nucleotideString === "-") {
                    continue;
            } else {
                winston.info(`Planet ${planet} has "${className}"`);
            }
            const systemsMask = this.systemsPresence[i];
            const nucleotide = this.splitCell(nucleotideString, planet);
            this.assertMatch(nucleotide, systemsMask, planet);
            if (diseasePowerString === "#VALUE!" || diseaseValuesString === "#VALUE!") {
                    winston.warn(`Please fix planet ${planet} diseases`);
                    continue;
                }
            const diseasePower = diseasePowerString === "-" ? 0 : Number(diseasePowerString);
            const diseaseValues = diseaseValuesString === "-" ?
                [0, 0, 0, 0, 0, 0, 0] : this.splitCell(diseaseValuesString, planet);

            const diseaseCode = await getDiseaseCode(diseaseValues, diseasePower);
            winston.debug(`
                    Nucleotides: ${nucleotideString},
                    description: ${description},
                    disease (Power: ${diseasePower}, value: ${diseaseValues.join(", ")}, code: ${diseaseCode}`);
            for (let j = 0; j < examples.length; ++j) {
                    const columnIndex = 1 + columnOffset + j;
                    const systemValuesString = examples[j];
                    const systemsValues = this.splitCell(systemValuesString, planet);
                    this.assertMatch(systemsValues, systemsMask, planet);
                    const id = "9" + rowIndex.toString().padStart(3, "0") + columnIndex.toString().padStart(2, "0");

                    const xenomorph = {
                        accountIdCode: await accountIdCode(id),
                        className,
                        diseaseCode,
                        planetCode: planet,
                        speciesIndex: j + 1,
                        description,
                    };

                    xenomorphsQrData.push(xenomorph);

                    winston.debug(`xenomorph`, xenomorph);

                    const model = this.createAliceModelForXenomorph(systemsMask, systemsValues, nucleotide, id);
                    try {
                        // await sleeper(1000);
                        await saveObject(this.con, model, true);
                    } catch (e) {
                        winston.error(e);
                    }
                }
            }
        if (xenomorphsQrData.length) {
                fs.writeFileSync(`planets/${planet}.csv`, stringify(xenomorphsQrData));
            }
    }

    private createAliceModelForXenomorph(
        systemsMask: number[],
        systemsValues: number[],
        nucleotide: number[],
        id: string,
        ): MagellanModel {
        const systems: System[] = [];
        for (let s = 0; s < this.numberOfSystems; ++s) {
            systems.push({
                lastModified: 0,
                present: systemsMask[s] === 1,
                value: systemsValues[s],
                nucleotide: nucleotide[s],
            });
        }
        return {
            ...createEmptyAliceModel(),
            _id: id,
            login: "xeno" + id.toString,
            isAlive: true,
            inGame: true,
            firstName: "Инопланетный",
            lastName: "организм",
            profileType: "xenomorph",
            systems,
        };
    }
}

configureLogger("table-import-logs");

const importer = new TablesImporter();

importer.import().subscribe(
    (result) => { winston.info(`Import finished.`); },
    (err) => {
        winston.error("Error in import process: ", err);
    },
    () => { process.exit(0); },
);
