import * as winston from "winston";
import * as fs from "fs";

import { connectToCouch } from "../../helpers";

import { encodePayloadForQr } from "../../qr-server";
import { printQr } from "./printer";
import { Reactive } from "../models/magellan-models";

const reactives = [
    {count: 180, power: 10},
    {count: 150, power: 50},
];

async function encodeReactiv(id: string, power: number): Promise<string> {
    return await encodePayloadForQr(20, `${id},${power}`);
}

export class ReactiveImporter {

    private readonly con: PouchDB.Database<any>;

    constructor() {
        this.con = connectToCouch("obj-counters");
    }

    public async import(): Promise<void> {

        const suits: Reactive[] = [];

        let num = 10000;
        for (const r of reactives) {
            for (let i = 0; i < r.count; i++) {
                const id = `labrefill${num}`;
                const suitQrCode = await encodeReactiv(id, r.power);
                suits.push({power: r.power, payload: suitQrCode, id, title: `Реактивы ${r.power}`});
                num++;
            }
        }

        winston.info(`Reactives: `, suits);

        const printed = `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8" />
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <title>Скафандры </title>
        </head>
        <body> ${suits.map((suit) => printQr(suit)).join("")}
        </body>
        </html>`;
        fs.writeFileSync(`planets/reactive2.html`, printed);

        await this.con.bulkDocs(suits.map( (suit) => ({_id: suit.id})));
        }

    }
