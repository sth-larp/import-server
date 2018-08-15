import { AliceBaseModel } from "./interfaces/deus-model";
import { connectToCouch } from "./helpers";
import * as winston from "winston";

export class ModelRefresher {
    private eventsCon: any = null;

    constructor() {
        this.eventsCon = connectToCouch("events");

    }

    // Послать _Refresh событие для экспортрованной модели, что бы сформировалась Work/ViewModel
    public async sentRefreshEvent(model: AliceBaseModel): Promise<void> {
        winston.debug(`Sending event for ${model._id}`);
        let timestamp;
        // if (model && model.timestamp) {
            // timestamp = model.timestamp + 1000;
        // } else {
        timestamp = Date.now() + 1000;
        // }

        const event = {
                characterId: model._id,
                timestamp,
                eventType: "_RefreshModel",
                data: "",
            };

        await this.eventsCon.post(event);

        winston.debug(`Sent event for ${model._id}`);
    }
}
