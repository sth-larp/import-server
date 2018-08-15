import * as winston from "winston";
import Elasticsearch = require("winston-elasticsearch");

import { config } from "./config";

export function configureLogger(indexName: string) {

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
        { level: "debug",  indexPrefix: indexName, clientOpts: { host: config.log.elasticHost } });

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
