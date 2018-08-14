import * as rp from "request-promise";
import { config } from "./config";
import { QRCode, ErrorCorrectLevel } from "qrcode-generator-ts/js";

export async function encodePayloadForQr(type: number, payload: string): Promise<string> {
    const r = await rp.get(
        `${config.qrServer.baseUrl}/encode?type=${type}&kind=1&validUntil=1680601600&payload=${payload}`,
        { json: true });
    return r.content;
}

export function createQrCode(str: string) {
    if (!str) {
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
