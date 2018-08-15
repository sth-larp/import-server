import * as winston from "winston";
import * as clones from "clones";

/**
 * Сохранить в БД (connection) переданный объект (doc)
 * Перед сохранением проверяется есть ли там уже такой думент,
 * если задан update == true, то этот документ обновляется
 *
 */

export interface SaveResult {
     ok: boolean;
     exist: boolean;
}

export async function saveObject( connection: any, doc: any, update: boolean = true ): Promise<SaveResult> {

    doc = clones(doc);

    // Если в объекте не установлен _id => то его можно просто сохранять, проставится автоматически
    if (!doc._id) {
        await connection.post(doc);
        return {ok: true, exist: false};
    }

    let oldDoc;

    try {
        oldDoc = await connection.get(doc._id);
    } catch (err) {
        if (err.status && err.status === 404) {
            await  connection.put(doc);
            return {ok: true, exist: false};
        } else {
            winston.warn(`catch object: `, err, doc);
        }
    }
    winston.debug(`try to save: ${doc._id}`);

    if (update) {
            doc._rev = oldDoc._rev;
            await connection.put(doc);
            return {ok: true, exist: true };
        } else {
            return {ok: false, exist: true };
        }
}
