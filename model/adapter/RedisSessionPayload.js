
const Redis = require("../Redis");
const SessionPayload = require("./SessionPayload");

class RedisSessionPayload extends SessionPayload {

    savePayload (key, payload, expireTime) {
        return Redis.set(key, JSON.stringify(payload), expireTime);
    }
    
    readPayload (key) {
        return Redis.get(key).then((payload) => {
            if (payload) {
                try {
                    payload = JSON.parse(payload);
                } catch (err) {
                    payload = null;
                }
            }
            return Promise.resolve(payload);
        });
    }
    
    removePayload (key) {
        return Redis.del(key).then(() => {
            return Promise.resolve();
        });
    }
    
    findAllPayloadKeys (userid) {
        return new Promise((resolve, reject) => {
            if (this.session.config.onePointEnter) {
                return reject([this.session.formatKey(userid)]);
            }
            Redis.do("keys", [this.session.formatKey(userid, "*")], (err, keys) => {
                if (err) return reject(err);
                resolve(keys);
            });
        });
    }
    
    refreshPayloadExpireTime (key, expireTime) {
        return Redis.setExpireTime(key, expireTime).then(() => {
            return Promise.resolve();
        });
    }
}

module.exports = RedisSessionPayload;