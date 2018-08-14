import { Observable } from "rxjs";
import * as PouchDB from "pouchdb";
import * as winston from "winston";
import * as clones from "clones";

/**
 * Сохранить в БД (connection) переданный объект (doc)
 * Перед сохранением проверяется есть ли там уже такой думент,
 * если задан update == true, то этот документ обновляется
 *
 */
export async function saveObject( connection: any, doc: any, update: boolean = true ): Promise<any> {

    doc = clones(doc);

    // Если в объекте не установлен _id => то его можно просто сохранять, проставится автоматически
    if (!doc._id) {
        await connection.post(doc);
    }

    let oldDoc;

    try {
        oldDoc = await connection.get(doc._id);
    } catch (err) {
        if (err.status && err.status === 404) {
            await  connection.put(doc);
        } else {
            winston.warn(`catch object: `, err, doc);
        }
    }
    winston.debug(`try to save: ${doc._id}`);

    if (update) {
            doc._rev = oldDoc._rev;
            await connection.put(doc);
        } else {
            return { status: "exist", oldDoc };
        }
}
