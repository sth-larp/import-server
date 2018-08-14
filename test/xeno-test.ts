import chai = require("chai");

import { printXenomorph } from "../src/magellan2018/xenomorphs/printer";
import fs = require ("fs");

const should = chai.should();

const xeno = {
    accountIdCode: "fac5ZAEA8itk913828",
    className: "Членистоногие",
    diseaseCode: "3730CQEA8itk0,-4,0,-4,0,0,2,231",
    planetCode: "DK3",
    speciesIndex: 1,
    description: "Очень долгое описание членистоного, которое прыгает на тебя и пытается убить!",
 };

describe.only("Xenomorph create print form", () => {

    it("no conversion error", () => {
        const isolated = fs.readFileSync("test/xeno_isolated.html").toString().replace(/\s/g, "");
        const converted = printXenomorph(xeno);
        fs.writeFileSync("test.tmp.html", converted);
        converted.replace(/\s/g, "").should.be.equal(isolated);
    });
});
