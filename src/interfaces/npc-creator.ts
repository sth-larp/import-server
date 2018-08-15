import { Observable } from "rxjs";
import { AliceBaseModel } from "./deus-model";

export interface NpcCreator<T extends AliceBaseModel> {
    name: string;
    generate(firstId: number): Observable<T>;
    count(): number;
}
