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

export function configureLogger() {

    winston.remove("console");
    if (process.env.NODE_ENV !== "production") {

        winston.add(winston.transports.Console, {
            level: "debug",
            colorize: true,
            prettyPrint: true,
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
