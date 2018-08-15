import { Observable } from "rxjs/Rx";
import * as winston from "winston";
import * as fs from "fs";

import { config } from "../../config";

import * as loaders from "../../google-sheet-loaders";

import { MagellanPill } from "../models/magellan-models";
import { printPill } from "./printer";
import { encodePayloadForQr } from "../../qr-server";

export class PillImporter {

    private readonly numberOfSystems = 7;

    private loader: loaders.GoogleSheetLoader;

    constructor() {
        this.loader = new loaders.GoogleSheetLoader(config.biology.spreadsheetId);
    }

    public importPill() {
        const promise = async () => {
            await this.loader.authorize();
            winston.info("Authorization success!");

            const pill = await this.loader.loadRange("Farmacia!A2:B");

            await this.handlePills(pill.values);

            return this;
        };

        return Observable.fromPromise(promise());
    }

    private async handlePills(data: any) {
        const pills = [];
        let rowIndex = 0;
        for (const line of data) {
            const pill = await this.handlePillLine(line, rowIndex);
            rowIndex++;

            if (pill) {
                pills.push(pill);
            }
        }

        winston.info(`Pills: `, pills);

        const printed = `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8" />
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <title>Пилюли </title>
        </head>
        <body> ${pills.map((pill) => printPill(pill)).join("")}
        </body>
        </html>`;
        fs.writeFileSync(`planets/pills.html`, printed);
    }

    private async handlePillLine(line: string[], rowIndex: number): Promise<MagellanPill> {
        const [action, description] = line;

        if (!action) {
            return;
        }

        const parsedAction = this.getParsedSystems(action);

        if (!parsedAction) {
            winston.warn(`Pill ${action} in row ${rowIndex + 2} cannot be parsed`);
            return;
        }

        const pillQr = await encodePayloadForQr(4, parsedAction.join(","));

        return {title: description, payload: pillQr};
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

}
