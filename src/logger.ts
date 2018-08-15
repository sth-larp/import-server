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
            handleExceptions: true,
            humanReadableUnhandledException: true,
        });

        // winston.handleExceptions(winston.transports.Console);
    }

    // winston.add(winston.transports.File, {
    //             filename: config.log.logFileName,
    //             json: false,
    //             level: "debug",
    //         });

    winston.add(Elasticsearch,
        { level: "debug",  indexPrefix: indexName, clientOpts: { host: config.log.elasticHost } });

    winston.add(winston.transports.File, {
        name: "warn-files",
        filename: config.log.warnFileName,
        json: false,
        level: "warn",
    });

    // ({
    //             name: "exc-console",
    //             handleExceptions: true,
    //             humanReadableUnhandledException: true,
    //             json: false,
    //             level: "debug",
    //             colorize: true,
    //             prettyPrint: true,
    //         }));
}
