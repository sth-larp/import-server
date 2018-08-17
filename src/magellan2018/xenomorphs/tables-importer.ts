import * as winston from "winston";

import { configureLogger } from "../../logger";
import { SpaceSuitImporter } from "./spacesuits";

configureLogger("table-import-logs");

const importer = new SpaceSuitImporter();

winston.info(`Started importer`);

importer.import()
    .then(() => winston.info(`Import finished.`))
    .catch((err) => winston.error("Error in import process: ", err));
