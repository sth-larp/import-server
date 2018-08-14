import { XenomorphsQrPrintData } from "../models/magellan-models";
import { QRCode, ErrorCorrectLevel, QRNumber, QRAlphaNum, QR8BitByte, QRKanji } from "qrcode-generator-ts/js";

export function printXenomorph(xeno: XenomorphsQrPrintData) {
    const diseaseQr = createQrCode(xeno.diseaseCode);
    const accountQr = createQrCode(xeno.accountIdCode);

    const qrCodeWithTitle = (code, title) => {
        if (!code) {return ""; }
        return `
<div style="
    display: flex;justify-content: center;align-items: center;
    align-content: center;overflow: hidden;flex-direction: column; margin-left: 2em;margin-right:1em">
    <img src="${code}"">
        <br>
    <b style="text-align: center">${title}</b>
</div>`;
    };

    return `
    <hr>
<div style="width: 100%;">
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
function createQrCode(str: string) {
    if (!str)
    {
        return str;
    }
    const code = new QRCode();
    code.setErrorCorrectLevel(ErrorCorrectLevel.M);
    code.setTypeNumber(4);
    code.addData(str);
    code.make();
    const diseaseQr = code.toDataURL();
    return diseaseQr;
}
