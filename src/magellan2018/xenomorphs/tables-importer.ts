import * as winston from "winston";

import { configureLogger } from "../../logger";
import { EnterExitImporter } from "./enterexit";

configureLogger("table-import-logs");

const importer = new EnterExitImporter();

winston.info(`Started importer`);

importer.import()
    .then(() => winston.info(`Import finished.`))
    .catch((err) => winston.error("Error in import process: ", err));
