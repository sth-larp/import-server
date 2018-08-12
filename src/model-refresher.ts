import * as PouchDB from 'pouchdb';

import { config } from './config';
import { AliceBaseModel } from './interfaces/deus-model';


export class ModelRefresher{
    private eventsCon:any = null;

    constructor() {

        const ajaxOpts = {
                auth:{
                    username: config.username,
                    password: config.password
                }
        };

        this.eventsCon = new PouchDB(`${config.url}${config.eventsDBName}`, ajaxOpts);        

    }

    //Послать _Refresh событие для экспортрованной модели, что бы сформировалась Work/ViewModel
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