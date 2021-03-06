import * as winston from "winston";
import * as fs from "fs";

import { config } from "../../config";
import { saveObject, connectToCouch } from "../../helpers";

import * as loaders from "../../google-sheet-loaders";
import { System } from "../../interfaces/model";
import { createEmptyAliceModel } from "../../alice-model-converter";

import stringify = require("csv-stringify/lib/sync");
// import load = require("csv-parse/lib/sync");
import { MagellanModel, XenomorphsQrPrintData } from "../models/magellan-models";
import { printXenomorph } from "./printer";
import { encodePayloadForQr } from "../../qr-server";
import { delay } from "bluebird";

async function accountIdCode(id: string): Promise<string> {
    return await encodePayloadForQr(100, id);
}

async function getDiseaseCode(values: number[], power: number): Promise<string> {
    const seq = [...values, power];
    const stringifiedSeq = seq.join(",");
    return await encodePayloadForQr(9, stringifiedSeq);
}

export class XenoImporter {

    private readonly numberOfSystems = 7;
    private readonly con: PouchDB.Database<any>;

    private loader: loaders.GoogleSheetLoader;

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
        this.con = connectToCouch("work-models");

        this.loader = new loaders.GoogleSheetLoader(config.biology.spreadsheetId);
    }

    public async importXeno(): Promise<void> {
        winston.debug(`Start import`);

        await this.loader.authorize();
        winston.info("Authorization success!");

        const data = await this.loader.loadRange("Xenomorphs!A3:CM2009");

        await this.handleXenomorphs(data.values);
    }

    private async handleXenomorphs(data: string[][]) {
        let rowIndex = 0;
        for (const line of data) {
            await this.handleLine(line, rowIndex);
            rowIndex++;
        }
    }

    private splitCell(value: string, planet: string): number[] {
        const result = this.getParsedSystems(value);
        if (result.length !== this.numberOfSystems) {
            winston.error(`Incorrect cell value ${value} for planet ${planet}.`);
        }
        return result;
    }

    private getParsedSystems(value: string): number[] | undefined {
        if (!value) {
            return undefined;
        }
        const result = value.trim().split(" ").map(Number);
        if (result.length !== this.numberOfSystems) {
            return undefined;
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

    private async handleLine(line: string[], rowIndex: number): Promise<void> {
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

            winston.debug(`Will get disease code for ${diseaseValues}, ${diseasePowerString}`);

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

                    await delay(300);
                    const model = this.createAliceModelForXenomorph(systemsMask, systemsValues, nucleotide, id);
                    try {
                        await saveObject(this.con, model, true);
                    } catch (e) {
                        winston.error(e);
                    }
                }
            }
        if (xenomorphsQrData.length) {
                fs.writeFileSync(`planets/${planet}.csv`, stringify(xenomorphsQrData));
                this.printPlanet(xenomorphsQrData, planet);
            }
    }

    private printPlanet(xenomorphsQrData: XenomorphsQrPrintData[], planet: string) {
        const printed = `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8" />
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <title>Планета </title>
        </head>
        <body> ${xenomorphsQrData.map((data) => printXenomorph(data)).join("")}
        </body>
        </html>`;
        fs.writeFileSync(`planets/${planet}.html`, printed);
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
