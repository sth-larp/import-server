import { MagellanModel } from "./models/MagellanModel";
import { Observable } from "rxjs";

export class MiceCreator {
    generate(firstId: number, count: number): Observable<MagellanModel> {
        return Observable.empty();
    }
}