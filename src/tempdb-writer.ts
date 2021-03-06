import * as moment from "moment";
import * as winston from "winston";


import { JoinCharacterInfo,  JoinMetadata, JoinImporter, JoinCharacter } from "./join-importer"
import { ImportRunStats } from "./import-run-stats";
import { connectToCouch } from "./helpers";

export class TempDbWriter {

    private con: any = null;

    private exceptionIds = ["JoinMetadata", "lastImportStats"];

    constructor() {
        this.con = connectToCouch("join-import");
    }
    
    setFieldsNames(c: JoinCharacterInfo, metadata: JoinMetadata): JoinCharacterInfo{
        c.Fields.forEach( (f) => {
            let fmeta = metadata.Fields.find( v => v.ProjectFieldId == f.ProjectFieldId );
            f.FieldName = fmeta ? fmeta.FieldName : "";
        } );

        return c;
    }

    saveCharacter( c: JoinCharacterInfo ): Promise<any>{
        c._id = c.CharacterId.toString();
        
        return this.con.get(c._id)
                        .then( (oldc: JoinCharacterInfo) =>{ 
                            c._rev = oldc._rev;
                            return this.con.put(c);
                        })
                        .catch( () => this.con.put(c) );
    }

    public lastStatsDocID = "lastImportStats";

    public async saveLastStats(s: ImportRunStats): Promise<void> {

        const stats: any = {
            _id: this.lastStatsDocID,
            importTime: s.importTime.format("YYYY-MM-DDTHH:mm"),
            imported: s.imported,
            created: s.created,
            updated: s.updated,
        };
        const oldc = await this.con.get(this.lastStatsDocID);
        stats._rev = oldc._rev;
        await this.con.put(stats);
    }

    public getLastStats(): Promise<ImportRunStats>{
        winston.debug(`Will load stats from cache`);
        return this.con.get(this.lastStatsDocID)
        .then((s: any) => {
            let ret = new ImportRunStats( moment(s.importTime, "YYYY-MM-DDTHH:mm") );
            ret.created = s.created;
            ret.imported = s.imported;
            ret.updated = s.updated;
            winston.info(`Import stats: created ${ret.created}, imported ${ret.imported}, updated: ${ret.updated}`);
            return ret;
         })
        .catch( (err)=>{
            winston.warn(`Cannot get stats from cache`, err);
             return (new ImportRunStats( moment([1900,0,1]) ));
         })
    }

    public metadataDocID = "JoinMetadata";

    saveMetadata(s: JoinMetadata): Promise<any>{
        s._id = this.metadataDocID;

        return this.con.get(this.metadataDocID)
                        .then( (oldc: JoinMetadata) =>{ 
                            s._rev = oldc._rev;
                            winston.info("Metadata saved!");
                            return this.con.put(s);
                        })
                        .catch( () => this.con.put(s) );

    }

    getMetadata(): Promise<JoinMetadata | null>{
        return this.con.get(this.metadataDocID)
                        .catch( () => Promise.resolve(null) );

    }

    getCacheCharactersList(): Promise<JoinCharacter[]>{
        return this.con.allDocs().then( (docs) => {
            return docs.rows
            .filter( (doc: any) => !this.exceptionIds.find(e => e == doc.id ) )
            .map( (doc) => JoinImporter.createJoinCharacter(doc.id) );
        })
    }

    getCacheCharacter(id: string): Promise<JoinCharacterInfo>{
        return this.con.get(id);
    }
}