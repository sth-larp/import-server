import * as express from "express";
import { Observable } from "rxjs";
import * as moment from "moment";
import * as winston from "winston";
import * as PouchDB from "pouchdb";
import * as pouchDBFind from "pouchdb-find";

import { ImportStats } from "./stats";
import { config } from "./config";
import { processCliParams } from "./cli-params";
import { MagellanGame } from "./magellan2018";
import { MagellanModel } from "./magellan2018/models/magellan-models";
import { Server } from "./server-class";
import { configureLogger } from "./logger";

async function main() {

    // start logging
    configureLogger("importserver-logs");

    PouchDB.plugin(pouchDBFind);

    const params = processCliParams();

    if (!params) {
        process.exit(0);
    }

    winston.info("Run CLI parameters: ", params);

    // Statisticts
    const stats = new ImportStats();

    const server = new Server<MagellanModel>(new MagellanGame(), params);

    if (params.provideNpcs) {
        await server.createNpcs();
        process.exit(0);
    }

    if (
        params.export
        || params.import
        || params.id
        || params.list
        || params.refresh
        || params.econ) {
        // tslint:disable-next-line:variable-name
        const _id = params.id ? params.id : 0;
        const since = params.since ? moment(...params.since, "YYYY-MM-DDTHH:mm") : null;
        await server.importAndCreate(_id, (params.import === true), (params.export === true), (params.list === true),
            (params.refresh === true), since);
        process.exit(0);
    } else if (params.server) {
        winston.info(`Start HTTP-server on port: ${config.port} and run import loop`);

        const app = express();
        app.listen(config.port);

        app.get("/", (_, res) => res.send(stats.toString()));

        Observable.timer(0, config.importInterval).
            flatMap(() => Observable.fromPromise(server.importAndCreate()))
            .subscribe(() => { },
                () => {
                    process.exit(1);
                },
                () => {
                    winston.info("Finished!");
                    process.exit(0);
                },
        );
    }
}

main();
