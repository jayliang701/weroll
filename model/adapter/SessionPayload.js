
const CACHE = require("memory-cache");

class SessionPayload {

    constructor() {
        this.session = null;
    }

    savePayload (key, payload, expireTime) {
        throw new Error("the method should be overrided");
    }
    
    readPayload (key) {
        throw new Error("the method should be overrided");
    }
    
    removePayload (key) {
        throw new Error("the method should be overrided");
    }
    
    findAllPayloadKeys (userid) {
        throw new Error("the method should be overrided");
    }
    
    refreshPayloadExpireTime (key, expireTime) {
        throw new Error("the method should be overrided");
    }
}

module.exports = SessionPayload;