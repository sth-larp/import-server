import * as winston from "winston";
import * as fs from "fs";

import { connectToCouch } from "../../helpers";

import { encodePayloadForQr } from "../../qr-server";
import { printQr } from "./printer";
import { SpaceSuit } from "../models/magellan-models";

const spaceSuitDuration = 35;

async function encodeSpaceSuit(id: string): Promise<string> {
    return await encodePayloadForQr(7, `${id},${spaceSuitDuration}`);
}

const suitStartId = 300;
const count = 400;

export class SpaceSuitImporter {

    private readonly con: PouchDB.Database<any>;

    constructor() {
        this.con = connectToCouch("obj-counters");
    }

    public async import(): Promise<void> {

        const suits: SpaceSuit[] = [];
        for (let i = suitStartId; i < count; i++) {
            const id = `ss${i}`;
            const suitQrCode = await encodeSpaceSuit(id);
            suits.push({payload: suitQrCode, id, title: "Скафандр"});
        }

        winston.info(`Suits: `, suits);

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
        fs.writeFileSync(`planets/suits.html`, printed);

        await this.con.bulkDocs(suits.map( (suit) => ({_id: suit.id})));
        }

    }
