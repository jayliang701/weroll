
const Model = require("../Model");
const SessionPayload = require("./SessionPayload");
const DAOFactory = require('../../dao/DAOFactory');
const Schema = DAOFactory.Schema;

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

    constructor() {
        const schema = new Schema({
            _id: String,
            _expireAt: Date,
            userid: String
        }, { collection:TABLE, strict: false, versionKey:false });
        schema.index({ userid:1 });
        schema.index({ _expireAt:1 }, { expireAfterSeconds:0 });

        this.table = DAOFactory.getInstance().model(TABLE, schema);
    }

    buildIndexes() {
        
    }

    savePayload (key, payload, expireTime) {
        let date = new Date();
        date.setTime(Date.now() + expireTime * 1000);
        return this.table.update({ _id:key }, { _id:key, ...payload, _expireAt: date }, { upsert: true });
    }
    
    readPayload (key) {
        return this.table.findOne({ _id: key }).then((payload) => {
            if (payload) {
                payload = payload.toObject();
                delete payload["_id"];
                delete payload["_expireAt"];
            }
            return Promise.resolve(payload);
        });
    }
    
    removePayload (key) {
        return this.table.remove({ _id: key }).then(() => {
            return Promise.resolve();
        });
    }
    
    findAllPayloadKeys (userid) {
        return new Promise((resolve, reject) => {
            if (this.session.config.onePointEnter) {
                return reject([this.session.formatKey(userid)]);
            }
            this.table.find({ userid }, { _id:1 }, (err, docs) => {
                if (err) return reject(err);
                resolve(docs.map(doc => doc._id));
            });
        });
    }
    
    refreshPayloadExpireTime (key, expireTime) {
        let date = new Date();
        date.setTime(Date.now() + expireTime * 1000);
        return this.table.update({ _id: key }, { _expireAt: date }).then(() => {
            return Promise.resolve();
        });
    }
}

class MongoSessionPayload extends SessionPayload {

    constructor(option) {
        super();

        if (DAOFactory.getInstance()) {
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
        return this.agent.buildIndexes();
    }

    savePayload (key, payload, expireTime) {
        return this.agent.savePayload(key, payload, expireTime);
    }
    
    readPayload (key) {
        return this.agent.readPayload(key);
    }
    
    removePayload (key) {
        return this.agent.removePayload(key);
    }
    
    findAllPayloadKeys (userid) {
        return this.agent.findAllPayloadKeys(userid);
    }
    
    refreshPayloadExpireTime (key, expireTime) {
        return this.agent.refreshPayloadExpireTime(key, expireTime);
    }
}

module.exports = MongoSessionPayload;