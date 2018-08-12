import { AliceBaseModel } from "./interfaces/deus-model";
import { GameFacade } from "./interfaces/game";
import { JoinImporter, JoinCharacter, JoinCharacterInfo } from "./join-importer";
import { TempDbWriter } from "./tempdb-writer";
import { ModelRefresher } from "./model-refresher";
import { MailProvision } from "./mail-provision";
import { ImportRunStats } from "./import-run-stats";
import * as moment from "moment";
import { Observable, BehaviorSubject } from "rxjs";
import * as winston from "winston";
import { Provider } from "./providers/interface";
import { AliceExporter } from "./alice-exporter";
import { config } from "./config";
import { CharacterParser } from "./character-parser";
import { ConversionResults } from "./alice-model-converter";
import { AliceAccount } from "./interfaces/alice-account";
import { CliParams } from "./cli-params";

class ModelImportData <Model extends AliceBaseModel> {
    public importer: JoinImporter = new JoinImporter();
    public cacheWriter: TempDbWriter = new TempDbWriter();
    public modelRefresher: ModelRefresher = new ModelRefresher();
    public mailProvision: MailProvision = new MailProvision();

    public currentStats = new ImportRunStats();

    public lastRefreshTime = moment([1900, 0, 1]);

    public charList: JoinCharacter[] = [];
    public charDetails: CharacterData<Model> [] = [];

    public importCouter: number = 0;
}

interface  CharacterData<Model extends AliceBaseModel> {
    character: JoinCharacterInfo;
    model: Model;
    account: AliceAccount;
}

export class Server<Model extends AliceBaseModel> {
    public isImportRunning:boolean;

    private workData : ModelImportData <Model> = new ModelImportData();

    constructor(
        private facade: GameFacade<Model>,
        private params: CliParams,
    ) {

    }
/**
 * Предвартельные операции для импорта (токен, заливка метаданных, каталоги и т.д)
 */
prepareForImport(data: ModelImportData<Model>): Observable<ModelImportData<Model>> {

    return Observable.fromPromise(data.cacheWriter.getLastStats())
            .map( (loadedStats) => {
                data.lastRefreshTime = loadedStats.importTime;
                return data;
            })
            .flatMap( () => data.importer.init() )
            .flatMap( () => data.importer.getMetadata() )
            .do( () => winston.info(`Received metadata!`) )
            .flatMap( () => data.cacheWriter.saveMetadata(data.importer.metadata) )
            .do( () => winston.info(`Save metadata to cache!`) )
            .flatMap( () => Observable.from([data]) );
}

/**
 * Получение списка обновленных персонажей (выполняется с уже подготовленной ModelImportData)
 */
loadCharacterListFomJoin(data: ModelImportData<Model>): Observable<ModelImportData<Model>> {
    return Observable.fromPromise(
                data.importer.getCharacterList(data.lastRefreshTime.subtract(5, "minutes"))
                .then( ( c: JoinCharacter[] ) => {
                            data.charList = c;
                            return data;
                 }),
            );
}

/**
 * Получение списка персонажей в кеше (выполняется с уже подготовленной ModelImportData)
 */
loadCharacterListFromCache(data: ModelImportData<Model>): Observable<ModelImportData<Model>> {
    return Observable.fromPromise(
                data.cacheWriter.getCacheCharactersList()
                .then( ( c: JoinCharacter[] ) => {
                            winston.info("Debug: " + JSON.stringify(c));
                            data.charList = c;
                            return data;
                 }),
            );
}

/**
 * Сохранение данных о персонаже из Join в кеш на CouchDB
 */
saveCharacterToCache(char: JoinCharacterInfo, data: ModelImportData<Model>): Observable<JoinCharacterInfo> {
    return Observable.fromPromise( data.cacheWriter.saveCharacter(char) )
            .do( (c: any) => winston.info(`Character id: ${c.id} saved to cache`) )
            .map( () => char);
}

assertNever(x: never): never {
    throw new Error("Unexpected object: " + x);
}

private performProvide (
    provider: Provider<Model>,
    char: CharacterData<Model>,
    exportModel: boolean = true
): Observable<CharacterData<Model>> {
    if (!exportModel) {
        return Observable.from([char]);
    }

    const id = char.model._id;

    if (this.params.ignoreInGame) {
    
        return Observable.from([char])
        .do(() => winston.info(`About to provide ${provider.name} for character(${id})`))
        .delay(1000)
        .flatMap(c => provider.provide(c.character, c.model, c.account))
        .map((result) => {
            switch(result.result) {
                case "success": {
                     winston.info(`Provide ${provider.name} for character(${id}) success`);
                     return char;
                }
                case "nothing":  {
                    winston.info(`Provide ${provider.name} for character(${id}) nothing to do`);
                    return char;
                }
                case "problems": {
                    winston.warn(`Provide ${provider.name} for character(${id}) failed with ${result.problems.join(", ")}`);
                    return char;
                }
                default: this.assertNever(result);
            }
        });
    }
}


/**
 * Создание модели персонажа по данным из Join и экспорт в Model-базу
 */
private exportCharacterToAlice(
    char: JoinCharacterInfo,
    converted: ConversionResults<Model>,
    exportModel: boolean): Observable<CharacterData<Model> | null>  {
    
    const result = {character: char, model: converted.model, account: converted.account};

    if (!converted.model || !exportModel) {
        return Observable.of(result);
    }

    const exporter = new AliceExporter(converted.model, converted.account, true, this.params.ignoreInGame);

    return Observable.fromPromise(exporter.export()).filter(c  => c).map(() => result);
}
/**
 * Посылка события Refresh-модели
 */
private async sendModelRefresh(char: CharacterData<Model>, data: ModelImportData<Model>, refreshModel: boolean): Promise<any> {
    if (!refreshModel)
    {
        return;
    }
    
    await data.modelRefresher.sentRefreshEvent(char.model)
    winston.info( `Refresh event sent to model for character id = ${char.model._id}: `);
}

/**
 * Получение потока данных персонажей (выполняется с уже подготовленной ModelImportData)
 */
loadCharactersFromJoin(data: ModelImportData<Model>): Observable<JoinCharacterInfo> {
    let bufferCounter = 0;
    winston.info("Load characters from JoinRPG");

    return Observable.from(data.charList)
            .bufferCount(config.importBurstSize)        // Порезать на группы по 20

            // Добавить задержку между обработкой записей
            .flatMap((c) => Observable.from([c]).delay(config.importBurstDelay), 1 )

            // Каждую группу преобразовать в один общий Promise, ждущий все запросы в группе
            .mergeMap( (cl: JoinCharacter[]) => {
                const characterIds = cl.map((d) => d.CharacterId);
                winston.info(`# Process ${bufferCounter}, size=${config.importBurstSize}: ${characterIds.join(",")} #`);
                bufferCounter++;

                const promiseArr: Array<Promise<JoinCharacterInfo>> = [];
                cl.forEach((c) => promiseArr.push(data.importer.getCharacter(c.CharacterLink)) );

                return Promise.all(promiseArr);
            }, 1)
            .retry(3)

             // Полученные данные группы разбить на отдельные элементы для обработки
            .mergeMap( (cl: JoinCharacterInfo[]) => Observable.from(cl) )

            .do( (c: JoinCharacterInfo) => winston.info(`Imported character: ${c.CharacterId}`) );  // Написать в лог
}

/**
 * Получение потока данных персонажей из кэша (выполняется с уже подготовленной ModelImportData)
 */
loadCharactersFromCache(data: ModelImportData<Model>): Observable<JoinCharacterInfo> {
    let bufferCounter = 0;
    winston.info("Load characters from CouchDB cache");

    return Observable.from(data.charList)
            .bufferCount(config.importBurstSize)        // Порезать на группы по 20
             // Полученные данные группы разбить на отдельные элементы для обработки
            .mergeMap( (cl: JoinCharacter[]) => {
                const characterIds = cl.map((d) => d.CharacterId);
                winston.info(`# Process ${bufferCounter}, size=${config.importBurstSize}: ${characterIds.join(",")} #`);
                bufferCounter++;

                const promiseArr: Array<Promise<JoinCharacterInfo>> = [];
                cl.forEach( (c) => promiseArr.push(data.cacheWriter.getCacheCharacter(c.CharacterId.toString())) );

                return Promise.all(promiseArr);
            }, 1)
            .retry(3)
            // Полученные данные группы разбить на отдельные элементы для обработки
            .mergeMap( (cl: JoinCharacterInfo[]) => Observable.from(cl) )
            .do( (c: JoinCharacterInfo) => winston.info(`Imported character: ${c.CharacterId}`) );  // Написать в лог
}

/**
 *  Функция для импорта данных из Join, записи в кеш CouchDB, создания и экспорта моделей
 *  (т.е. вся цепочка)
 */
importAndCreate(   
                            id: number = 0,
                            importJoin: boolean = true,
                            exportModel: boolean = true,
                            onlyList: boolean = false,
                            updateStats: boolean = true,
                            refreshModel: boolean = false,
                            mailProvision: boolean = true,
                            updatedSince?: moment.Moment,
                            
                        ): Observable<string> {

    const sinceText = updatedSince ? updatedSince.format("DD-MM-YYYY HH:mm:SS") : "";

    winston.info(`Run import sequence with: id=${id}, import=${importJoin}, export=${exportModel}, ` +
                  `onlyList=${onlyList}, updateStats=${updateStats}, refresh=${refreshModel}, ` +
                  `mailProvision=${mailProvision}, updateSince=${sinceText}` );

    // Объект с рабочими данными при импорте - экспорте

    if (this.isImportRunning) {
        winston.info("Import session in progress.. return and wait to next try");
        return Observable.from([]);
    }

    this.isImportRunning = true;

    const returnSubject = new BehaviorSubject("start");

    let chain = this.prepareForImport(this.workData)
    // Установить дату с которой загружать персонажей (если задано)
        .map( (data) => {
            if (updatedSince) { data.lastRefreshTime = updatedSince; }
            winston.info("Using update since time: " +  data.lastRefreshTime.format("DD-MM-YYYY HH:mm:SS"));
            return data;
        })

    // Загрузить список персонажей (Join или кэш), если не задан ID
        .flatMap( (data: ModelImportData<Model>) => {
                if (id) {
                    data.charList.push( JoinImporter.createJoinCharacter(id) );
                    return Observable.from([data]);
                } else if (importJoin) {
                    return this.loadCharacterListFomJoin(data);
                } else {
                    return this.loadCharacterListFromCache(data);
                }
        })

    // Запись в лог
        .do( (data) => winston.info(`Received character list: ${data.charList.length} characters`) )

    // Если это только запрос списка - закончить
        .filter( (data) => !onlyList )

    // Загрузить данные из Join или из кеша
        .flatMap( (data: ModelImportData<Model>) => importJoin ? this.loadCharactersFromJoin(data) : this.loadCharactersFromCache(data) )

    // Добавить задержку между обработкой записей
        .flatMap( (c) => Observable.from([c]).delay(config.importDelay), 1 )

    // Сохранить данные в кеш (если надо)
        .flatMap( (c) => importJoin ? this.saveCharacterToCache(c, this.workData) : Observable.from([c]) )

    // Остановить обработку, если в модели нет флага InGame (игра началась и дальше импортировать что-то левое не нужно)
        .filter( (c) => {
            if (config.importOnlyInGame && !c.InGame) {
                winston.info(`Character id=${c._id} have no flag "InGame", and not imported`);
                return false;
            }
            return true;
         })

    // Экспортировать модель в БД (если надо)
        .flatMap( (c) => Observable.from([c]).delay(1000), 1 )
        .map( (char) => {
            winston.info(`About to convert Character(${char._id})`);

            const converted = this.facade.convertAliceModel(new CharacterParser(char, this.workData.importer.metadata));

            if (!converted.model) {
                winston.warn(`Character(${char._id}) not converted. Reasons: ${converted.problems.join("; ")}`);
            }

            return {char: char, converted: converted};
        })
        .flatMap( (c)  => this.exportCharacterToAlice(c.char, c.converted, exportModel) )

        .filter( (c) => c != null );

    // Выполнить все задачи после экспорта
        this.facade.getAfterConversionProviders().forEach(provider => {
            chain = chain.flatMap((c) => this.performProvide(provider, c, exportModel))
            
        });

        chain
    // Сохранить данные по персонажу в общий список
        .do( (c) => this.workData.charDetails.push(c) )

    // Послать модели Refresh соообщение для создания Work и View-моделей
        .flatMap( (c) => Observable.fromPromise(this.sendModelRefresh(c, this.workData, refreshModel)).map(() => Observable.of(c)) )

    // Посчитать статистику
        .do( () => this.workData.importCouter++ )

    // Собрать из всех обработанных данных всех персонажей общий массив и передать дальше как один элемент
        .toArray()
    // Отправить запрос на создание почтовых ящиков для всхе персонажей
        .filter( () => this.workData.charDetails.length > 0 )
   //     .flatMap( c => mailProvision
   // ? Observable.fromPromise(provisionMailAddreses(workData)) : Observable.from([c]) )
        .subscribe( () => {},
            (error) => {
                winston.error( "Error in pipe: ", error );
                this.isImportRunning = false;
            },
            () => {
                this.isImportRunning = false;

                if (updateStats) {
                    this.workData.cacheWriter.saveLastStats( new ImportRunStats(moment.utc()) );
                }

                winston.info(`Import sequence completed. Imported ${this.workData.importCouter} models!`);

                returnSubject.complete();
            },
        );

    return returnSubject;
}

public createNpcs(): Observable<string> {

    const providers = this.facade.getNpcProviders();

    if (!this.params.provideNpcs) {
        winston.info (`Configured NPC providers ${providers.map(p => p.name).join(", ")} but skipped due to cmd line params`);
        return Observable.of("skip");
    }

    const returnSubject = new BehaviorSubject("start");

    let npcId = config.initialNpcId;

    const streams :Observable<Model>[] = [];

    providers
        .forEach(provider => {
            const lastId = npcId + provider.count() - 1;

            winston.info(`Will create NPC of type ${(provider.name)} in id range ${npcId}...${lastId}`);

            streams.push(provider.generate(npcId));
            npcId = lastId + 1;
        });

    Observable.merge(streams)
    .concatAll()

    // Экспортировать модель в БД (если надо)
    .flatMap( (c) => Observable.from([c]).delay(1000), 1 )
    .flatMap( (model)  => {
        winston.info(`About to save NPC ${model._id}`);
        const exporter = new AliceExporter(model, null, true, this.params.ignoreInGame);
        return Observable.from(exporter.export()).map((res) => {
            return {character: null, model: model, account: null};
        });
    })

    // Послать модели Refresh соообщение для создания Work и View-моделей
    .flatMap( (c) => Observable.fromPromise(this.sendModelRefresh(c, this.workData, true)).map(() => Observable.of(c)) )

    // Собрать из всех обработанных данных всех персонажей общий массив и передать дальше как один элемент
    .toArray()
    .subscribe( () => {},
    (error) => {
    winston.error( "Error in pipe: ", error );
    },
    () => {

    returnSubject.complete();
    },
    );

    return returnSubject;
}

}
