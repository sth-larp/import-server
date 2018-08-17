import * as winston from "winston";

import { configureLogger } from "../../logger";
import { PillImporter } from "./pill";

configureLogger("table-import-logs");

const importer = new PillImporter();

winston.info(`Started importer`);

importer.import()
    .then(() => winston.info(`Import finished.`))
    .catch((err) => winston.error("Error in import process: ", err));
