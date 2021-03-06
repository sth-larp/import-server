import dotenv = require("dotenv");

if (process.env.NODE_ENV !== "production") {
    dotenv.load();
}

export type CouchDbNames = "obj-counters" | "work-models" | "join-import" | "models" | "accounts" | "events";

export const config = {
    port: process.env.PORT || 8100,

    url: "https://couchdb.alice.magellan2018.ru/",
    username: process.env.COUCHDB_USER,
    password: process.env.COUCHDB_PASSWORD,

    importDelay: 200,
    importOnlyInGame: true,

    joinrpg: {
        login: process.env.JOINRPG_USER,
        password: process.env.JOINRPG_PASSWORD,
        baseUrl: "https://joinrpg.ru",
        tokenPath: "/x-api/token",
        listPath: "/x-game-api/329/characters",
        metaPath: "/x-game-api/329/metadata/fields",
        charactersPath: "/x-game-api/329/characters",
    },

    econ: {
        baseUrl: "https://api.alice.magellan2018.ru",
        username: process.env.ADMIN_USER,
        password: process.env.ADMIN_PASSWORD,
    },

    qrServer: {
        baseUrl: "https://qr.alice.magellan2018.ru",
    },

    importInterval: 30000,
    importBurstSize: 10,
    requestTimeout: 120000,
    importBurstDelay: 1000,

    log: {
        logFileName: "import-server.log",
        warnFileName: "import-server.warn.log",
        supportLogFileName: "import-support-server.log",
        elasticHost: "",
        // elasticHost: "https://elasticsearch.alice.magellan2018.ru/",
    },

    mailServerAPIUrl: "",

    initialNpcId : 10500,

    biology: {
        spreadsheetId: "1HpNnkNHhJaryi8hBhElwuvB-8ooaoGS7f4IrY-Z0bQY",
    },
};
