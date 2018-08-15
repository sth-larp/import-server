import { AliceBaseModel } from './interfaces/deus-model';
import { connectToCouch } from './helpers';


export class ModelRefresher{
    private eventsCon:any = null;

    constructor() {
        this.eventsCon = connectToCouch("events");

    }

    // Послать _Refresh событие для экспортрованной модели, что бы сформировалась Work/ViewModel
    sentRefreshEvent(model: AliceBaseModel): Promise<any>{
        let timestamp = Date.now();

        if(model && model.timestamp){
            timestamp = model.timestamp + 1000;
        }

        let event =   {
                characterId: model._id,
                timestamp,
                eventType: "_RefreshModel",
                data: ""
            };

        return this.eventsCon.post(event);
    }
}