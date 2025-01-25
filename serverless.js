import pkg from 'stremio-addon-sdk';
import addonInterface from "./addon";

const { getRouter } = pkg;

const router = getRouter(addonInterface);

export default function(req, res) {
    router(req, res, function() {
        res.statusCode = 404;
        res.end();
    });
}