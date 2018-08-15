import * as winston from "winston";
import * as fs from "fs";

import { encodePayloadForQr } from "../../qr-server";
import { printQr } from "./printer";
import { SimpleQr } from "../models/magellan-models";

async function encodeEnter(id: number): Promise<string> {
    return await encodePayloadForQr(5, `${id}`);
}

async function encodeExit(): Promise<string> {
    return await encodePayloadForQr(6, "1");
}

export class EnterExitImporter {

    constructor() {
    }

    public async import(): Promise<void> {

        const suits: SimpleQr[] = [];

        suits.push({payload: await encodeEnter(1), title: "Вход на корабль 1"});
        suits.push({payload: await encodeEnter(2), title: "Вход на корабль 2"});
        suits.push({payload: await encodeEnter(3), title: "Вход на корабль 3"});
        suits.push({payload: await encodeEnter(4), title: "Вход на корабль 4"});
        suits.push({payload: await encodeEnter(5), title: "Вход на корабль 5"});
        suits.push({payload: await encodeExit(), title: "Выход с корабля"});
        suits.push({payload: await encodeExit(), title: "Выход с корабля"});
        suits.push({payload: await encodeExit(), title: "Выход с корабля"});
        suits.push({payload: await encodeExit(), title: "Выход с корабля"});
        suits.push({payload: await encodeExit(), title: "Выход с корабля"});

        winston.info(`Reactives: `, suits);

        const printed = `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8" />
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <title>Вход / выход </title>
        </head>
        <body> ${suits.map((suit) => printQr(suit)).join("")}
        </body>
        </html>`;
        fs.writeFileSync(`planets/enterexit.html`, printed);

        }

    }
