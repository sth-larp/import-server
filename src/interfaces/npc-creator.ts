import { Observable } from "rxjs";
import { AliceBaseModel } from "./deus-model";

export interface NpcCreator<T extends AliceBaseModel> {
    generate(firstId: number): Observable<T>;
    count(): number;
    name: string;
}