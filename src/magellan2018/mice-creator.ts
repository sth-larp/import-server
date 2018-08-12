import { MagellanModel, MiceModel } from "./models/magellan-models";
import { Observable } from "rxjs";
import { createEmptyAliceModel } from "../alice-model-converter";
import { createSystemsFromNucleotides } from "./model-converter";

export class MiceCreator {
    public name = "mice";
    
    constructor (
        private num: number,
    ) {

    }

    public count() {return this.num};

    generate(firstId: number): Observable<MagellanModel> {
        return Observable
            .range(firstId, this.num)
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