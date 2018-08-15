import * as express from "express";
import { Observable  } from "rxjs";
import * as moment from "moment";
import * as winston from "winston";
import Elasticsearch = require("winston-elasticsearch");
import * as PouchDB from "pouchdb";
import * as pouchDBFind from "pouchdb-find";

import { ImportStats} from "./stats";
import { config } from "./config";
import { processCliParams } from "./cli-params";
import { MagellanGame } from "./magellan2018";
import { MagellanModel } from "./magellan2018/models/magellan-models";
import { Server } from "./server-class";
import { configureLogger } from "./logger";

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
    server.createNpcs()
    .subscribe( (data: string) => { },
    (error: any) => {
        winston.error(`Error`, error);
        process.exit(1);
    },
    () => {
        winston.info("Finished!");
        process.exit(0);
    },
);
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
    server.importAndCreate(_id, (params.import === true), (params.export === true), (params.list === true),
                            (params.refresh === true),  since)
                            .then(() => {
                                winston.info("Finished!");
                                process.exit(0);
                            })
                            .catch((error) => {
        winston.error(`Error`, error);
        process.exit(1);
    });

} else if (params.server) {
    winston.info(`Start HTTP-server on port: ${config.port} and run import loop`);

    const app = express();
    app.listen(config.port);

    app.get("/", (req, res) => res.send(stats.toString()));

    Observable.timer(0, config.importInterval).
        flatMap( () => server.importAndCreate() )
        .subscribe( () => {},
            (error: any) => {
                process.exit(1);
            },
            () => {
                winston.info("Finished!");
                process.exit(0);
            },
        );
}
