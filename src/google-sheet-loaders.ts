import * as google from "googleapis";
const sheets = google.sheets("v4");

export class GoogleSheetLoader {
    private authClient: any;
    constructor(
        private spreadsheetId: string,
    ) {}

    public async loadRange(range: string): Promise<any> {
        const request = this.defaultParams({ auth: this.authClient, range });
        return getValues(request);
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

    private  testDataSave(auth): Promise<any> {
    const request = this.defaultParams({
        auth, range: "Test!A3:C5", valueInputOption: "RAW", resource: {
            values: [
                [1, 5, 3],
                [2, 7, 54],
                [254, 767, 454],
            ],
        },
    });
    return setValues(request);
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
const setValues = promisify<any>(sheets.spreadsheets.values.update);
