import * as google from "googleapis";
import * as winston from "winston";
const sheets = google.sheets("v4");

export class GoogleSheetLoader {
    private authClient: any;
    constructor(
        private spreadsheetId: string,
    ) {}

    public async loadRange(range: string): Promise<any> {
        try {
            const request = this.defaultParams({ auth: this.authClient, range });
            winston.debug(`About to query Google docs`);
            const result = await getValues(request);
            winston.debug(`Loaded ${result.values.length} rows from Google`);
            return result;
        } catch (err) {
            winston.error(`Error loading data from Google sheet`, err);
            throw err;
        }
    }

    public authorize(): Promise<any> {
        return new Promise((resolve, reject) => {
            google.auth.getApplicationDefault((err, authClient) => {
                if (err) { return reject(err); }

                if (authClient.createScopedRequired && authClient.createScopedRequired()) {
                    const scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
                    authClient = authClient.createScoped(scopes);
                }

                this.authClient = authClient;

                resolve(authClient);
            });
        });
    }

    private defaultParams(mergeParams) {
        const defParams = {
            spreadsheetId: this.spreadsheetId,
            // valueRenderOption: 'FORMATTED_VALUE',
            // dateTimeRenderOption: 'SERIAL_NUMBER'
        };

        return { ...defParams, ...mergeParams };
    }

}

// tslint:disable-next-line:ban-types
function promisify<T>(fn: Function): (...params: any[]) => Promise<T> {
    return (...params: any[]) => {
        return new Promise((resolve, reject) => {
            const callback = (err, value) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(value);
                }
            };

            fn(...params, callback);
        });
    };
}

const getValues = promisify<any>(sheets.spreadsheets.values.get);
