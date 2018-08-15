import * as winston from "winston";

import { configureLogger } from "../../logger";
import { PillImporter } from "./pill";

configureLogger("table-import-logs");

const importer = new PillImporter();

importer.importPill().subscribe(
    () => { winston.info(`Import finished.`); },
    (err) => {
        winston.error("Error in import process: ", err);
    },
    () => { process.exit(0); },
);
