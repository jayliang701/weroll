
const Model = require("../Model");
const SessionPayload = require("./SessionPayload");

const TABLE = "session";

class NativeAgent {
    buildIndexes() {
        Model.DB.getIndexes(TABLE, (err, result) => {
            if (err) return console.error(err);
            if (!result || !result["userid_1"]) Model.DB.ensureIndex(TABLE, "userid");
            if (!result || !result["_expireAt_1"]) Model.DB.ensureIndex(TABLE, "_expireAt", { expireAfterSeconds:0 });
            
        });
    }

    savePayload (key, payload, expireTime) {
        let date = new Date();
        date.setTime(Date.now() + expireTime * 1000);
        return Model.DB.update(TABLE, { _id:key }, { _id:key, ...payload, _expireAt: date }, { upsert: true });
    }
    
    readPayload (key) {
        return Model.DB.findOne(TABLE, { _id: key }).then((payload) => {
            return Promise.resolve(payload);
        });
    }
    
    removePayload (key) {
        return Model.DB.remove(TABLE, { _id: key }).then(() => {
            return Promise.resolve();
        });
    }
    
    findAllPayloadKeys (userid) {
        return new Promise((resolve, reject) => {
            if (this.session.config.onePointEnter) {
                return reject([this.session.formatKey(userid)]);
            }
            Model.DB.find(TABLE, { userid }, { _id:1 }, (err, docs) => {
                if (err) return reject(err);
                resolve(docs.map(doc => doc._id));
            });
        });
    }
    
    refreshPayloadExpireTime (key, expireTime) {
        let date = new Date();
        date.setTime(Date.now() + expireTime * 1000);
        return Model.DB.update(TABLE, { _id: key }, { _expireAt: date }).then(() => {
            return Promise.resolve();
        });
    }
}

class MongooseAgent {
    buildIndexes() {
        Model.DB.getIndexes(TABLE, (err, result) => {
            if (err) return console.error(err);
            if (!result || !result["userid_1"]) Model.DB.ensureIndex(TABLE, "userid");
            if (!result || !result["_expireAt_1"]) Model.DB.ensureIndex(TABLE, "_expireAt", { expireAfterSeconds:0 });
            
        });
    }

    savePayload (key, payload, expireTime) {
        let date = new Date();
        date.setTime(Date.now() + expireTime * 1000);
        return Model.DB.update(TABLE, { _id:key }, { _id:key, ...payload, _expireAt: date }, { upsert: true });
    }
    
    readPayload (key) {
        return Model.DB.findOne(TABLE, { _id: key }).then((payload) => {
            return Promise.resolve(payload);
        });
    }
    
    removePayload (key) {
        return Model.DB.remove(TABLE, { _id: key }).then(() => {
            return Promise.resolve();
        });
    }
    
    findAllPayloadKeys (userid) {
        return new Promise((resolve, reject) => {
            if (this.session.config.onePointEnter) {
                return reject([this.session.formatKey(userid)]);
            }
            Model.DB.find(TABLE, { userid }, { _id:1 }, (err, docs) => {
                if (err) return reject(err);
                resolve(docs.map(doc => doc._id));
            });
        });
    }
    
    refreshPayloadExpireTime (key, expireTime) {
        let date = new Date();
        date.setTime(Date.now() + expireTime * 1000);
        return Model.DB.update(TABLE, { _id: key }, { _expireAt: date }).then(() => {
            return Promise.resolve();
        });
    }
}

class MongoSessionPayload extends SessionPayload {

    constructor(option) {
        super();

        const mongoose = require("mongoose");
        if (Model.DB.engine.__driver === mongoose) {
            this.agent = new MongooseAgent();
        } else {
            this.agent = new NativeAgent();
        }


        option = option || {};
        if (option.buildIndexes) {
            option.buildIndexes.bind(this)();
        } else {
            this.buildIndexes();
        }
    }

    buildIndexes() {
        this.table.indexInformation((err, result) => {
            if (err) return console.error(err);
            console.log(result);
            if (!result || !result["userid_1"]) Model.DB.ensureIndex(TABLE, "userid");
            if (!result || !result["_expireAt_1"]) Model.DB.ensureIndex(TABLE, "_expireAt", { expireAfterSeconds:0 });
            
        });
    }

    savePayload (key, payload, expireTime) {
        let date = new Date();
        date.setTime(Date.now() + expireTime * 1000);
        return Model.DB.update(TABLE, { _id:key }, { _id:key, ...payload, _expireAt: date }, { upsert: true });
    }
    
    readPayload (key) {
        return Model.DB.findOne(TABLE, { _id: key }).then((payload) => {
            return Promise.resolve(payload);
        });
    }
    
    removePayload (key) {
        return Model.DB.remove(TABLE, { _id: key }).then(() => {
            return Promise.resolve();
        });
    }
    
    findAllPayloadKeys (userid) {
        return new Promise((resolve, reject) => {
            if (this.session.config.onePointEnter) {
                return reject([this.session.formatKey(userid)]);
            }
            Model.DB.find(TABLE, { userid }, { _id:1 }, (err, docs) => {
                if (err) return reject(err);
                resolve(docs.map(doc => doc._id));
            });
        });
    }
    
    refreshPayloadExpireTime (key, expireTime) {
        let date = new Date();
        date.setTime(Date.now() + expireTime * 1000);
        return Model.DB.update(TABLE, { _id: key }, { _expireAt: date }).then(() => {
            return Promise.resolve();
        });
    }
}

module.exports = MongoSessionPayload;