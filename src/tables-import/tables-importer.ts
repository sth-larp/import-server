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

interface XenomorphsQrPrintData {
    planetCode: string;
    className: string;
    speciesIndex: number;
    accountIdCode: string;
    diseaseCode: string;
}

async function accountIdCode(id: string): Promise<string> {
    const r = await rp.get(
        `http://localhost:8159/encode?type=100&kind=1&validUntil=1680601600&payload=${id}`,
        { json: true });
    return r.content;
}

async function getDiseaseCode(values: number[], power: number): Promise<string> {
    const seq = [...values, power];
    const stringifiedSeq = seq.join(",");
    const r = await rp.get(
        `http://localhost:8159/encode?type=9&kind=1&validUntil=1680601600&payload=${stringifiedSeq}`,
        { json: true });
    return r.content;
}

export class TablesImporter {

    private readonly numberOfSystems = 7;

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

            await Promise.all([
                this.importXenos(authClient),
            ]);
            return this;
        };

        return Observable.fromPromise(promise());
    }

    private splitCell(value: string): number[] {
        const result = value.split(" ").map(Number);
        if (result.length !== this.numberOfSystems) {
            winston.error("Incorrect cell value, not 7 numbers: " + value);
        }
        return result;
    }

    private assertMatch(values: number[], mask: number[]) {
        for (let i = 0; i < this.numberOfSystems; ++i) {
            if (values[i] !== 0 && mask[i] === 0) {
                winston.error(`Value is present for missing system. values=${values}, mask=${mask}`);
            }
        }
    }

    private async importXenos(authClient: any) {
        const ajaxOpts = {
            auth: {
                username: config.username,
                password: config.password,
            },

            timeout: 6000 * 1000,
        };

        const con = new PouchDB(`${config.url}${config.workModelDBName}`, ajaxOpts);

        const data = await loaders.xenomorphsDataLoad(authClient);
        data.values.forEach(async (line, rowIndex: number) => {
            const planet = line[0];
            if (planet.length === 0) {
                return;
            }

            const xenomorphsQrData: XenomorphsQrPrintData[] = [];

            winston.info(`Processing planet ${planet}`);
            for (let i = 0; i < this.systemsPresence.length; ++i) {
                const nucleotideString = line[1 + 8 * i];
                if (nucleotideString === "-") {
                    continue;
                }

                const systemsMask = this.systemsPresence[i];
                const nucleotide = this.splitCell(nucleotideString);
                this.assertMatch(nucleotide, systemsMask);

                const diseasePowerString = line[1 + 8 * i + 6];
                const diseaseValuesString = line[1 + 8 * i + 7];
                const diseasePower = diseasePowerString === "-" ? 0 : Number(diseasePowerString);
                const diseaseValues =
                    diseasePowerString === "-" ? [0, 0, 0, 0, 0 , 0 , 0] : this.splitCell(diseaseValuesString);
                const diseaseCode = await getDiseaseCode(diseaseValues, diseasePower);

                for (let j = 0; j < 5; ++j) {
                    const columnIndex = 1 + 8 * i + j;
                    const systemValuesString = line[columnIndex];

                    const systemsValues = this.splitCell(systemValuesString);
                    this.assertMatch(systemsValues, systemsMask);

                    const id = "9" + rowIndex.toString().padStart(3, "0") + columnIndex.toString().padStart(2, "0");

                    xenomorphsQrData.push({
                        accountIdCode: await accountIdCode(id),
                        className: this.classNames[i],
                        diseaseCode,
                        planetCode: planet,
                        speciesIndex: j + 1,
                    });

                    const systems: System[] = [];
                    for (let s = 0; s < this.numberOfSystems; ++s) {
                        systems.push({
                            lastModified: 0,
                            present: systemsMask[s] === 1,
                            value: systemsValues[s],
                            nucleotide: nucleotide[s],
                        });
                    }

                    const model = {
                        ...createEmptyAliceModel(),
                        _id: id,
                        firstName: "Инопланетный",
                        lastName: "организм",
                        profileType: "xenomorph",
                        systems,
                    };

                    try {
                        await saveObject(con, model, true).toPromise();
                    } catch (e) {
                        winston.error(e);
                    }
                }
            }
            if (xenomorphsQrData.length) {
                fs.writeFileSync(`planets/${planet}.csv`, stringify(xenomorphsQrData));
            }
        });
    }
}

const importer = new TablesImporter();

importer.import().subscribe((result) => {
    winston.info(`Import finished.`);
},
    (err) => {
        winston.info("Error in import process: ", err);
    },
);
