import { AliceBaseModel } from "./interfaces/deus-model";
import { GameFacade } from "./interfaces/game";
import { JoinImporter, JoinCharacter, JoinCharacterInfo } from "./join-importer";
import { TempDbWriter } from "./tempdb-writer";
import { ModelRefresher } from "./model-refresher";
import { ImportRunStats } from "./import-run-stats";
import * as moment from "moment";
import * as winston from "winston";
import { Provider } from "./providers/interface";
import { AliceExporter } from "./alice-exporter";
import { config } from "./config";
import { CharacterParser } from "./character-parser";
import { ConversionResults } from "./alice-model-converter";
import { AliceAccount } from "./interfaces/alice-account";
import { CliParams } from "./cli-params";
import { Npc } from "./interfaces/npc-creator";
import { delay } from "bluebird";

class ModelImportData<Model extends AliceBaseModel> {
    public importer: JoinImporter = new JoinImporter();
    public cacheWriter: TempDbWriter = new TempDbWriter();
    public modelRefresher: ModelRefresher = new ModelRefresher();

    public currentStats = new ImportRunStats();

    public lastRefreshTime = moment([1900, 0, 1]);

    public charList: JoinCharacter[] = [];
    public charDetails: Array<CharacterData<Model>> = [];

    public importCouter: number = 0;
}

interface CharacterData<Model extends AliceBaseModel> {
    character: JoinCharacterInfo;
    model: Model;
    account: AliceAccount;
}

// tslint:disable-next-line:max-classes-per-file
export class Server<Model extends AliceBaseModel> {
    public isImportRunning: boolean;

    private workData: ModelImportData<Model> = new ModelImportData<Model>();

    constructor(
        private facade: GameFacade<Model>,
        private params: CliParams,
    ) {

    }

    private assertNever(x: never): never {
        throw new Error("Unexpected object: " + x);
    }

    private async createOneNpc(model): Promise<boolean> {
        winston.info(`About to save NPC ${model.model._id}`);
        const exporter = new AliceExporter(model.model, model.account, true, this.params.ignoreInGame);
        const res = await exporter.export();

        if (!res) {
            return false;
        }

        await this.sendModelRefresh(model, true);

        winston.info(`Finished with NPC(${model.model._id})`);

        return true;
    }

    // tslint:disable-next-line:member-ordering
    public async createNpcs(): Promise<string> {
        try {

            const providers = this.facade.getNpcProviders();

            if (!this.params.provideNpcs) {
                // tslint:disable-next-line:max-line-length
                winston.info(`Configured NPC providers ${providers.map((p) => p.name).join(", ")} but skipped due to cmd line params`);
                return "skip";
            }

            let npcId = config.initialNpcId;

            const streams: Array<Npc<Model>> = [];

            providers
                .forEach((provider) => {
                    const lastId = npcId + provider.count() - 1;

                    winston.info(`Will create NPC of type ${(provider.name)} in id range ${npcId}...${lastId}`);

                    const npcs = provider.generate(npcId);
                    npcs.forEach((npc) => streams.push(npc));
                    npcId = lastId + 1;
                });

            for (const npc of streams) {
                await delay(3000);
                await this.createOneNpc(npc);
            }
        } catch (error) {
            winston.error("Error in pipe: ", error);
        }

        return "complete";
    }
    /**
     * Предвартельные операции для импорта (токен, заливка метаданных, каталоги и т.д)
     */
    private async prepareForImport(data: ModelImportData<Model>): Promise<ModelImportData<Model>> {

        const loadedStats = await data.cacheWriter.getLastStats();
        data.lastRefreshTime = loadedStats.importTime;
        await data.importer.init();
        await data.importer.getMetadata();
        winston.info(`Received metadata!`);
        await data.cacheWriter.saveMetadata(data.importer.metadata);
        winston.info(`Save metadata to cache!`);

        return data;
    }

    private async performProvide(
        provider: Provider<Model>,
        char: CharacterData<Model>,
        exportModel: boolean = true,
    ): Promise<boolean> {
        if (!exportModel) {
            return false;
        }

        const id = char.model._id;

        winston.info(`About to provide ${provider.name} for character(${id})`);
        const result = await provider.provide(char.character, char.model, char.account);
        switch (result.result) {
            case "success": {
                winston.info(`Provide ${provider.name} for character(${id}) success`);
                return true;
            }
            case "nothing": {
                winston.info(`Provide ${provider.name} for character(${id}) nothing to do`);
                return true;
            }
            case "problems": {
                // tslint:disable-next-line:max-line-length
                winston.warn(`Provide ${provider.name} for character(${id}) failed with ${result.problems.join(", ")}`);
                return false;
            }
            default: this.assertNever(result);
        }
    }

    /**
     * Создание модели персонажа по данным из Join и экспорт в Model-базу
     */
    private async exportCharacterToAlice(
        converted: ConversionResults<Model>,
        exportModel: boolean): Promise<boolean> {

        if (!converted.model || !exportModel) {
            return false;
        }

        const exporter = new AliceExporter(converted.model, converted.account, true, this.params.ignoreInGame);

        return await exporter.export();
    }
    /**
     * Посылка события Refresh-модели
     */
    private async sendModelRefresh(
        char: CharacterData<Model>,
        refreshModel: boolean): Promise<void> {
        if (!refreshModel) {
            return;
        }

        await this.workData.modelRefresher.sentRefreshEvent(char.model);
        winston.info(`Refresh event sent to model for character id = ${char.model._id}: `);
    }

    // tslint:disable-next-line:member-ordering
    public async performCharacterImport(
        id: number,
        exportModel: boolean = true,
        refreshModel: boolean = false,
    ) {
        winston.debug(`About to import character(${id}`);
        const character = await this.workData.importer.getCharacterByID(id);
        if (config.importOnlyInGame && !character.InGame) {
            winston.info(`Character id=${character._id} have no flag "InGame", and not imported`);
            return false;
        }

        const converted =
            this.facade.convertAliceModel(new CharacterParser(character, this.workData.importer.metadata));

        if (!converted.model) {
            winston.warn(`Character(${character._id}) not converted. Reasons: ${converted.problems.join("; ")}`);
            return false;
        }

        if (!(await this.exportCharacterToAlice(converted, exportModel))) {
            return false;
        }

        const chData = { model: converted.model, account: converted.account, character };

        await Promise.all(this.facade.getAfterConversionProviders().map(async (provider) => {
            await this.performProvide(
                provider, chData, exportModel);
        }));

        await this.sendModelRefresh(chData, refreshModel);

        this.workData.importCouter++;
    }

    /**
     *  Функция для импорта данных из Join, записи в кеш CouchDB, создания и экспорта моделей
     *  (т.е. вся цепочка)
     */
    // tslint:disable-next-line:member-ordering
    public async importAndCreate(
        id: number = 0,
        importJoin: boolean = true,
        exportModel: boolean = true,
        onlyList: boolean = false,
        refreshModel: boolean = false,
        updatedSince?: moment.Moment,
    ): Promise<void> {

        const sinceText = updatedSince ? updatedSince.format("DD-MM-YYYY HH:mm:SS") : "";

        winston.info(`Run import sequence with: id=${id}, import=${importJoin}, export=${exportModel}, ` +
            `onlyList=${onlyList},  refresh=${refreshModel}, ` +
            ` updateSince=${sinceText}`);

        // Объект с рабочими данными при импорте - экспорте

        if (this.isImportRunning) {
            winston.info("Import session in progress.. return and wait to next try");
            return;
        }

        this.isImportRunning = true;
        try {
            this.workData = await this.prepareForImport(this.workData);
            winston.info("Loaded this.workData");

            // Установить дату с которой загружать персонажей (если задано)
            if (updatedSince) {
                this.workData.lastRefreshTime = updatedSince;
                winston.info("Using update since time: " + this.workData.lastRefreshTime.format("DD-MM-YYYY HH:mm:SS"));
            }

            // Загрузить список персонажей (Join или кэш), если не задан ID
            if (id) {
                this.workData.charList.push(JoinImporter.createJoinCharacter(id));
            } else if (importJoin || true) {
                this.workData.charList
                    = await this.workData.importer.getCharacterList(
                        this.workData.lastRefreshTime.subtract(5, "minutes"));
            } else {
                // return this.loadCharacterListFromCache(data);
            }

            // Запись в лог
            winston.info(`Received character list: ${this.workData.charList.length} characters`);

            if (onlyList) { // Если это только запрос списка - закончить
                return;
            }

            for (const char of this.workData.charList) {
                await this.performCharacterImport(char.CharacterId, exportModel, refreshModel);
            }
            if (!id) {
                await this.workData.cacheWriter.saveLastStats(new ImportRunStats(moment.utc()));
            }
            winston.info(`Import sequence completed. Imported ${this.workData.importCouter} models!`);
        } catch (err) {
            winston.error(err);
        } finally {
            this.isImportRunning = false;
        }
    }
}
