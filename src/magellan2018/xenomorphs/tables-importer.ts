import * as winston from "winston";

import { configureLogger } from "../../logger";
import { XenoImporter } from "./xeno";

configureLogger("table-import-logs");

const importer = new XenoImporter();

winston.info(`Started importer`);

importer.importXeno()
    .then(() => winston.info(`Import finished.`))
    .catch((err) => winston.error("Error in import process: ", err));
