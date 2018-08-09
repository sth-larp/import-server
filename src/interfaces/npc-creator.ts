import { Observable } from "rxjs";
import { MagellanModel } from "../magellan2018/models/MagellanModel";

export interface NpcCreator {
    generate(firstId: number, count: number): Observable<MagellanModel>;
}