import chai = require('chai');

import { NpcCreator } from '../src/interfaces/npc-creator';

import {MiceCreator } from '../src/magellan2018/mice-creator';
import { AliceBaseModel } from '../src/interfaces/deus-model';

const should = chai.should();

describe("NPC creators should work", () => {
    ensureCreatorsWork([ new MiceCreator(5)]);
});

function ensureCreatorsWork<Creator extends NpcCreator<Model>, Model extends AliceBaseModel>(creators: Creator[]) {
    creators.forEach((creator) =>  {
        it (`Ensure that creator ${typeof(creator)} works`, async () => {
            let count = 0;
            const generated = await creator.generate(1000).subscribe(
                (result) => {
                    result._id.should.be.not.undefined;
                    count ++ 
                },
                (e) => e.should.be.null,
                () => count.should.be.equal(5),
            );
        });
    });
}
