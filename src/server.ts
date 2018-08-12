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

// start logging
configureLogger();

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
                            false, (params.refresh === true), (params.mail === true), since)
    // tslint:disable-next-line:no-empty
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
} else if (params.server) {
    winston.info(`Start HTTP-server on port: ${config.port} and run import loop`);

    const app = express();
    app.listen(config.port);

    app.get("/", (req, res) => res.send(stats.toString()));

    Observable.timer(0, config.importInterval).
        flatMap( () => server.importAndCreate() )
        .subscribe( (data: string) => {},
            (error: any) => {
                process.exit(1);
            },
            () => {
                winston.info("Finished!");
                process.exit(0);
            },
        );
}

function configureLogger() {

    winston.remove("console");
    if (process.env.NODE_ENV !== "production") {

        winston.add(winston.transports.Console, {
            level: "debug",
            colorize: true,
            prettyPrint: true
        });
    }

    winston.add(winston.transports.File, {
                filename: config.log.logFileName,
                json: false,
                level: "debug",
            });
            
    winston.add(Elasticsearch,
        { level: "debug",  indexPrefix: "importserver-logs", clientOpts: { host: config.log.elasticHost } });


    winston.add(winston.transports.File, {
        name: "warn-files",
        filename: config.log.warnFileName,
        json: false,
        level: "warn",
    });

    winston.handleExceptions(new winston.transports.File({
                 filename: "path/to/exceptions.log",
                handleExceptions: true,
                humanReadableUnhandledException: true,
                json: false,
                level: "debug",
            }));
}