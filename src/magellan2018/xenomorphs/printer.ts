import { XenomorphsQrPrintData, SimpleQr } from "../models/magellan-models";
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

export function printQr(obj: SimpleQr) {
    const qr = createQrCode(obj.payload.toString());

    return `
<div style="float:left">
    ${qrCodeWithTitle(qr, obj.title)}
</div>
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
