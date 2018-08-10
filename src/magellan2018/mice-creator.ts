import { MagellanModel, MiceModel } from "./models/magellan-models";
import { Observable } from "rxjs";
import { createEmptyAliceModel } from "../alice-model-converter";
import { createSystemsFromNucleotides } from "./model-converter";

export class MiceCreator {
    generate(firstId: number, count: number): Observable<MagellanModel> {
        return Observable
            .range(firstId, count)
            .map((index) => {
                const systems = createSystemsFromNucleotides(new Array(7).fill(0));

                const mice : MiceModel = {
                    ...createEmptyAliceModel(),
                    _id: index.toString(),
                    login: "mice" + index,
                    profileType: "mice",
                    systems,
                    isAlive: true,
                    inGame: true,
                    firstName: "Микки",
                    nicName: "Мышь",
                    lastName: "Маус",
                }
                return mice;
            })
    }
}