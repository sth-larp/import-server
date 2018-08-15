import { XenomorphsQrPrintData, MagellanPill, SpaceSuit } from "../models/magellan-models";
import { createQrCode } from "../../qr-server";

export function printXenomorph(xeno: XenomorphsQrPrintData) {
    const diseaseQr = createQrCode(xeno.diseaseCode);
    const accountQr = createQrCode(xeno.accountIdCode);

    return `
    <hr>
<div style="width: 100%;break-inside:avoid">
    <b>${xeno.className}</b>
    <hr>
    <div style="display:flex; flex-direction:row">
    ${qrCodeWithTitle(accountQr, "Образец для лаборатории")}
    ${qrCodeWithTitle(diseaseQr, "Отсканируй сейчас")}
    <div>
            <h2>Образец с планеты ${xeno.planetCode}</h2>
                ${xeno.description}
        </div>
    </div>
</div>
<hr>
`;
}

export function printPill(xeno: MagellanPill) {
    const diseaseQr = createQrCode(xeno.payload);

    return `
    <hr>
<div style="width: 100%;break-inside:avoid">
    <div style="display:flex; flex-direction:row">
    ${qrCodeWithTitle(diseaseQr, xeno.title)}
</div>
<hr>
`;
}

export function printSuit(suit: SpaceSuit) {
    const qr = createQrCode(suit.payload);

    return `
    <hr>
<div style="width: 100%;break-inside:avoid">
    <div style="display:flex; flex-direction:row">
    ${qrCodeWithTitle(qr, "скафандр")}
</div>
<hr>
`;
}

function qrCodeWithTitle(code, title) {
    if (!code) {return ""; }
    return `
<div style="
display: flex;justify-content: center;align-items: center;
align-content: center;overflow: hidden;flex-direction: column; margin-left: 2em;margin-right:1em">
<img src="${code}"">
    <br>
<b style="text-align: center">${title}</b>
</div>`;
}
