import chai = require('chai');

import { testCharData01 } from './test-char1';
import { testCharData02 } from './test-char2';
import { metadata } from './test-metadata';
import { convertAliceModel } from '../src/alice-model-converter';
import { NpcCreator } from '../src/interfaces/npc-creator';

import {MiceCreator } from '../src/magellan2018/mice-creator';

const should = chai.should();

describe("NPC creators should work", () => {
    const npcCreators : NpcCreator[] = [ new MiceCreator()];

    npcCreators.forEach((creator) =>  {
        it (`Ensure that creator ${typeof(creator)} works`, async () => {
            let count = 0;
            const generated = await creator.generate(1000, 5).subscribe(
                () => count ++,
                (e) => e.should.be.null,
                () => count.should.be.equal(5),
            );
        });
    });
});
